// Assurance-side handlers: Evidence (propose/admit/invalidate), Claim (assert), Assumption (detect), Assurance
// Assessment (request/complete), Assurance Observation (record). The exec≠assurance separation (INV-5) is upheld
// structurally — nothing here is driven by executionState; a satisfied assessment is a separate, explicit act
// whose disposition comes from the validator recommendation and is gated by the AssuranceAssessment.state machine
// (which makes VALIDATOR_FAILED→REJECTED and INDEPENDENCE_VIOLATION→SATISFIED illegal). Evidence admissibility
// (§8.11) is enforced at AdmitEvidence by @janumipwb/rph-assurance's evidenceAdmissibility — the kernel rule,
// called, not a copy of it. Validator-independence scoring still lives there uncalled; that is the next increment.
import {
	checkIndependence,
	evaluateApplicability,
	evidenceAdmissibility,
	FLOOR_POLICY_IDS,
	type Identity,
	type IndependenceRequirement
} from '@janumipwb/rph-assurance';
import {
	applicabilityPermitsAssessment,
	assessFalsification,
	classifyEvidenceInvalidation,
	policyApplicability,
	TraceGraph
} from '@janumipwb/rph-domain';
import type {
	ActorReference,
	AdmitEvidencePayload,
	AssertClaimPayload,
	CommandResult,
	CreateAssurancePolicyPayload,
	DetectAssumptionPayload,
	DomainCommand,
	ExpireAssumptionPayload,
	FalsifyAssumptionPayload,
	EditAssurancePolicyPayload,
	ProposeEvidencePayload,
	RecordClaimAssessmentPayload,
	RecordAssuranceObservationPayload,
	BeginAssuranceAssessmentPayload,
	CancelAssuranceAssessmentPayload,
	RequestAssuranceAssessmentPayload,
	SelectAssuranceEvaluatorPayload,
	SubmitEvidenceForAssessmentPayload,
	SupersedeAssurancePolicyPayload
} from '@janumipwb/rph-contracts';
import { AssuranceDispositionRecommendationSchema } from '@janumipwb/rph-contracts';
import {
	advanceStatus,
	checkPrecondition,
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';
import { allOf, fromStates, noOpEditPrecondition, predicate } from './command-precondition.js';

/** Non-object primitive union: the cast that keeps String() off Object's default stringification (S6551). */
type Stringifiable = string | number | boolean;

// ---- Assurance Policy ----
const POLICY = 'ASSURANCE_POLICY';

// The 3 de minimis floor policies (guide §8.4) are LOCKED: always-apply, non-waivable, non-editable — the
// exec≠assurance floor (INV-5). Their ids come from the single canonical source (@janumipwb/rph-assurance
// FLOOR_POLICY_IDS) — the edge is acyclic and already taken by floor-gate.ts, so no literal copy (F-13). Edit /
// Supersede / Suspend / Activate all reject when targeting one.
const FLOOR_POLICY_ID_SET: ReadonlySet<string> = new Set(Object.values(FLOOR_POLICY_IDS));

/** A status-transition guard that rejects any lifecycle change to a locked de minimis floor policy. */
function rejectIfFloorLocked(command: DomainCommand): () => ReturnType<typeof reject> | null {
	return () =>
		FLOOR_POLICY_ID_SET.has(command.targetAggregateId)
			? reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`The de minimis floor policy ${command.targetAggregateId} is locked (always-applies, non-waivable) and cannot be edited, suspended, or superseded`,
					[command.targetAggregateId]
				)
			: null;
}

/** The severities the AUTHORED `escalateOnOpenSeverities` shortcut accepts. §10.3 is a *default precedence* — its
 *  own words, "Unless a policy overrides it:" — and CRITICAL is the ONLY severity that default pairs with ESCALATED
 *  ("CRITICAL open finding → REJECTED or ESCALATED"; BLOCKING → REJECTED; MATERIAL → CONDITIONALLY_SATISFIED /
 *  INCONCLUSIVE / REJECTED). So this shortcut deliberately covers exactly that one unambiguous ESCALATED case. It is
 *  NOT a claim that the corpus forbids escalating another severity: §10.3 explicitly permits a policy to override the
 *  default, but that override is expressed through the ratified `EscalationRule.trigger` (PolicyExpression, §13) — the
 *  general residual predicate — NOT through this authored severity shortcut. Keeping the shortcut CRITICAL-only makes
 *  it fail closed (an ambiguous BLOCKING/MATERIAL use is refused and directed to `trigger`) rather than authoring an
 *  override the corpus routes through a different, ratified mechanism. Widen ONLY if a machine-evaluable multi-severity
 *  escalation mapping is later ratified. */
const ESCALATABLE_SEVERITIES: ReadonlySet<string> = new Set(['CRITICAL']);

/** Reject a policy whose escalationRules use the `escalateOnOpenSeverities` shortcut for a severity outside
 *  ESCALATABLE_SEVERITIES — fail closed at authoring rather than persist a silently-inert rule (Gate D would never act
 *  on it), and direct any deliberate override to the ratified `EscalationRule.trigger` (§13). */
function rejectUnratifiedEscalationSeverities(
	command: DomainCommand,
	escalationRules: ReadonlyArray<{ escalateOnOpenSeverities?: readonly string[] }> | undefined
): ReturnType<typeof reject> | null {
	const bad = [
		...new Set(
			(escalationRules ?? [])
				.flatMap((r) => r?.escalateOnOpenSeverities ?? [])
				.filter((s) => !ESCALATABLE_SEVERITIES.has(s))
		)
	];
	return bad.length === 0
		? null
		: reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`escalationRules.escalateOnOpenSeverities accepts only ${[...ESCALATABLE_SEVERITIES].join(', ')} — the single severity §10.3's default precedence pairs with ESCALATED; got [${bad.join(', ')}]. This authored shortcut covers that one unambiguous case; to override the default and escalate another severity (§10.3 "Unless a policy overrides it"), express it through the ratified EscalationRule.trigger (§13), not this field.`,
				[command.targetAggregateId]
			);
}

/** #5 — the RemediationRule invariant, checked at authoring: a remediation rule may only prescribe control actions
 *  the policy PERMITS (§11). Runtime remediation FIRING is staged (no trigger point yet), but a settable remediation
 *  that names an ungoverned action is incoherent, so it fails closed here. ABSENT vs EMPTY are distinct: `undefined`
 *  (no permitted set declared at all) can't be subset-checked, so skip; an explicit `[]` means the policy permits NO
 *  control action, so ANY non-empty remediationAction is ungoverned and must reject (set-theoretically X ⊆ [] holds
 *  only for empty X — collapsing `[]` into "unconstrained" would fail OPEN, the exact state this guard forecloses). */
function rejectRemediationActionsNotPermitted(
	command: DomainCommand,
	remediationRules: ReadonlyArray<{ remediationActions?: readonly string[] }> | undefined,
	permittedControlActions: readonly string[] | undefined
): ReturnType<typeof reject> | null {
	if (permittedControlActions === undefined) return null;
	const permitted = new Set(permittedControlActions);
	const bad = [
		...new Set(
			(remediationRules ?? [])
				.flatMap((r) => r?.remediationActions ?? [])
				.filter((a) => !permitted.has(a))
		)
	];
	return bad.length === 0
		? null
		: reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`remediationRules prescribe control action(s) [${bad.join(', ')}] the policy does not permit (§11) — a remediation may only use the policy's permittedControlActions.`,
				[command.targetAggregateId]
			);
}

/** CreateAssurancePolicy — create a versioned ASSURANCE_POLICY object. Regular (catalog) policies are born DRAFT
 *  (the ratified DOC-002 §18 initial state) and must be activated to govern; the de minimis floor policies (§8.4)
 *  are seeded through this too but are born ACTIVE (locked, always-apply — they cannot be activated). See bornStatus
 *  below. ALL SIX governing rule arrays are now settable from the payload (evidence, disposition, escalation, waiver
 *  — DOC-004 §6.1/§10.2/§13/§12.1 — and remediationRules, whose element shape was AUTHORED 2026-07-19 since the
 *  corpus defines none). The enum-typed fields are validated by the object schema. */
export const createAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateAssurancePolicyPayload;
	// #1b — escalationRules may only escalate on §10.3's ratified escalatable severity (CRITICAL). Fail closed here.
	const escBlock = rejectUnratifiedEscalationSeverities(command, p.escalationRules);
	if (escBlock) return escBlock;
	// #5 — remediationRules may only prescribe permitted control actions (§11).
	const remBlock = rejectRemediationActionsNotPermitted(
		command,
		p.remediationRules,
		p.permittedControlActions
	);
	if (remBlock) return remBlock;
	// The initial governance state, split by policy kind:
	//   - REGULAR (ratified DOC-004 catalog) policies are born DRAFT — the RATIFIED AssurancePolicy.status initial
	//     state (DOC-002 §18: initialState DRAFT, with a guarded DRAFT -> ACTIVE "policy activated" transition). The
	//     handler used to write 'ACTIVE' for ALL policies, bypassing that lifecycle — which is why the reference
	//     undertaking's ActivateAssurancePolicy call was a meaningless ACTIVE->ACTIVE no-op. A regular policy now
	//     governs only once deliberately activated (requestAssuranceAssessment requires ACTIVE).
	//   - The three de minimis FLOOR policies (§8.4, a guide construct) are LOCKED and always-apply: rejectIfFloorLocked
	//     rejects Activate/Suspend/Supersede/Edit on them, so they CANNOT be activated and MUST be born ACTIVE. The
	//     ratified §18 lifecycle governs the ratified catalog; the authored floor overlay is exempt by construction.
	const bornStatus = FLOOR_POLICY_ID_SET.has(p.policyId) ? 'ACTIVE' : 'DRAFT';
	const state: Record<string, unknown> = {
		...newEnvelope(command, POLICY, p.policyId, {
			lifecycleStatus: bornStatus,
			originType: 'HUMAN_DECISION'
		}),
		version: p.version,
		name: p.name,
		purpose: p.purpose,
		rationale: p.rationale,
		applicableObjectTypes: p.applicableObjectTypes,
		// DOC-004 §5.1's ApplicabilityRule — WHICH WORK THIS POLICY APPLIES TO. This was hardcoded `{}`, an empty
		// rule, while `ApplicabilityRuleSchema` was an opaque record that could not object. That is why REG-F-022's
		// second instance could exist: the ontology authors `appliesToPwuKinds` per policy and it had nowhere to go.
		// Omitted by the caller → derived from the object types the policy declares, so a policy always states what
		// it applies to. §5.1 makes `objectTypeConditions` the one REQUIRED field, which is why `{}` is no longer a
		// legal value at all.
		applicability: p.applicability ?? { objectTypeConditions: p.applicableObjectTypes },
		evaluatedClaimTypes: p.evaluatedClaimTypes,
		defaultClaimTemplates: [],
		requiredEvidence: p.requiredEvidence ?? [],
		optionalEvidence: p.optionalEvidence ?? [],
		criteria: p.criteria,
		evaluatorRole: p.evaluatorRole,
		independenceRequirement: p.independenceRequirement,
		findingDefinitions: p.findingDefinitions,
		// AssurancePolicyDefinition has SIX governing rule arrays that were REQUIRED by the object schema but carried
		// by NO command — hardcoded empty here, exactly like ARTIFACT's outputArtifactIds (Increment 10a): the object
		// demands it, nothing could set it, so a seeded policy could declare NONE of the rules that make it a policy
		// (its outcome, its escalation, its evidence, its waivability).
		//
		// ALL SIX are now SETTABLE (payload fields authored under the §0.3 grant; element shapes transcribed from
		// DOC-004 where it defines them, AUTHORED where it does not): requiredEvidence + optionalEvidence (§6.1),
		// dispositionRules (§10.2), escalationRules (§13), waiverRules (§12.1), and remediationRules (AUTHORED
		// 2026-07-19 — the corpus defines no RemediationRule, so its shape is grounded in ControlAction §11 + the
		// sibling family, labelled AUTHORED). (riskProfiles IS a seventh AssurancePolicyDefinition array — DOC-004 §3.1
		// L130 `riskProfiles: AssuranceProfileRule[]` — but it is NOT one of these six evidence/disposition/escalation/
		// waiver/remediation RULE arrays; it is a distinct profile-rule array, not yet threaded (an open settable gap,
		// tracked; the M0 Ratify Sheet retains it as optional). Do not read the "six" as denying it exists.)
		//
		// FIVE now GOVERN, not just occupy their homes: requiredEvidence (Gate A), permittedControlActions (Gate B),
		// dispositionRules' forbiddenOpenSeverities (Gate C, §10.3 foreclosure), escalationRules'
		// escalateOnOpenSeverities (Gate D, §10.3 CRITICAL escalation) — all at completeAssuranceAssessment — and
		// waiverRules at requestWaiver (§12/§36.4). remediationRules is settable + subset-validated (its actions ⊆
		// permittedControlActions, above), but its runtime FIRING is STAGED: no remediation trigger point exists in
		// the assurance loop yet (a remediation fires at a governed repair/decision step not built).
		dispositionRules: p.dispositionRules ?? [],
		// #5 — now SETTABLE (was hardcoded [] while RemediationRule was an undefined FORCE_PLACEHOLDER). The shape is
		// authored + threaded; its remediationActions are subset-validated against permittedControlActions above.
		remediationRules: p.remediationRules ?? [],
		escalationRules: p.escalationRules ?? [],
		waiverRules: p.waiverRules ?? [],
		permittedControlActions: p.permittedControlActions,
		status: bornStatus
	};
	return createObject(ctx, command, {
		objectType: POLICY,
		aggregateId: p.policyId,
		state,
		eventType: 'AssurancePolicyCreated'
	});
};

/** The ASSURANCE_POLICY content fields EditAssurancePolicy may patch (envelope fields are handled separately).
 *  waiverRules + remediationRules were on the Edit payload but historically dropped on the edit side (create
 *  threaded them); including them here closes that pre-existing gap (adversarial review, Inc C / #5). */
const EDITABLE_PATCH_FIELDS = [
	'name',
	'purpose',
	'rationale',
	'applicableObjectTypes',
	'evaluatedClaimTypes',
	'criteria',
	'evaluatorRole',
	'independenceRequirement',
	'findingDefinitions',
	'requiredEvidence',
	'optionalEvidence',
	'dispositionRules',
	'escalationRules',
	'waiverRules',
	'remediationRules',
	'permittedControlActions',
	// `applicability` was on the Edit PAYLOAD and missing from this list, so an edit that supplied it had it
	// SILENTLY DROPPED — the authored-then-dropped shape REG-F-022 named, on the very field REG-F-024 was about
	// (adversarial review, 2026-08-05). Worse than inert: `applicableObjectTypes` IS patchable, so narrowing that
	// left `applicability` — the field the newly-enforced §5.1 gate PREFERS — pinned at its creation value. The
	// declared scope and the enforced scope could be driven apart through a supported command, which is REG-F-024
	// re-openable by anyone with an EditAssurancePolicy. See `reconcileApplicability` below for the other half.
	'applicability'
] as const satisfies readonly (keyof EditAssurancePolicyPayload)[];

/** JAN-CMDPRE DWP-08 (EDIT): refuse a no-op EditAssurancePolicy — every payload-present editable field already equals
 *  the policy's current value. Compares exactly EDITABLE_PATCH_FIELDS (the set buildEditedPolicyState patches). */
const editPolicyNoOp = noOpEditPrecondition('EditAssurancePolicy', EDITABLE_PATCH_FIELDS);

/** Build the next ASSURANCE_POLICY state for an edit: the envelope bump plus a patch that changes ONLY the
 *  payload-present fields (an absent field is left exactly as it was — same version, revision++). Extracted from
 *  editAssurancePolicy so the handler's reject short-circuit stays flat; the per-field patch is pure construction. */
function buildEditedPolicyState(
	loadedState: Record<string, unknown>,
	command: DomainCommand,
	p: EditAssurancePolicyPayload,
	newRevision: number
): Record<string, unknown> {
	// The envelope bump carries the prior state forward; each payload-present field then overrides it, so an
	// absent field is left exactly as it was. remediationRules is subset-validated above.
	const next: Record<string, unknown> = { ...nextEnvelope(loadedState, command, newRevision) };
	for (const field of EDITABLE_PATCH_FIELDS) {
		if (p[field] !== undefined) next[field] = p[field];
	}
	return reconcileApplicability(next, p);
}

/**
 * KEEP THE TWO SCOPE REPRESENTATIONS FROM DIVERGING (adversarial review, 2026-08-05).
 *
 * A policy carries its object-type scope TWICE: as `applicableObjectTypes` (DOC-007's field, older) and inside
 * `applicability.objectTypeConditions` (DOC-004 §5.1's rule, which the enforced determination reads and prefers).
 * `createAssurancePolicy` derives the second from the first when none is supplied, so a created policy is always
 * consistent. EDIT had no such rule: patching `applicableObjectTypes` alone changed the field the gate falls back
 * to while leaving the field the gate actually reads at its creation value.
 *
 * That is the same "two copies, no test that they agree" shape that produced the hand-written policy lists and
 * the seeder's kind abbreviations, arriving this time on the one field a live refusal depends on. So the edit
 * seam now states the invariant instead of hoping: when an edit narrows `applicableObjectTypes` and does NOT
 * supply an explicit rule, the rule's object-type arm follows — and every OTHER arm it carries (kind conditions,
 * tags, a §18 expression) is preserved, because those were authored separately and a type edit does not speak
 * to them.
 *
 * An edit that supplies `applicability` explicitly wins outright: it is the more specific statement of scope.
 */
function reconcileApplicability(
	next: Record<string, unknown>,
	p: EditAssurancePolicyPayload
): Record<string, unknown> {
	if (p.applicability !== undefined) return next; // explicit rule wins; nothing to reconcile
	if (p.applicableObjectTypes === undefined) return next; // scope untouched by this edit
	const existing = (next.applicability ?? {}) as Record<string, unknown>;
	return {
		...next,
		applicability: { ...existing, objectTypeConditions: [...p.applicableObjectTypes] }
	};
}

/** EditAssurancePolicy — revise a non-floor, non-superseded policy's content in place (same version, revision++).
 *  Only payload-present fields change (patch). Floor policies + SUPERSEDED policies reject. */
export const editAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as EditAssurancePolicyPayload;
	const id = command.targetAggregateId;
	const floorBlock = rejectIfFloorLocked(command)();
	if (floorBlock) return floorBlock;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.status === 'SUPERSEDED') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Policy ${id} is SUPERSEDED and cannot be edited — create a new version instead`,
			[id]
		);
	}
	// #1b — a revised escalationRules must also honor §10.3's escalatable severity (CRITICAL only). Content validation
	// runs AFTER the existence/SUPERSEDED checks (mirroring remBlock) so a lifecycle rejection takes precedence over a
	// payload-shape rejection.
	const escBlock = rejectUnratifiedEscalationSeverities(command, p.escalationRules);
	if (escBlock) return escBlock;
	// #5 — the effective remediationRules (new or existing) must keep remediationActions ⊆ the effective permitted
	// set, so an edit that narrows permittedControlActions or revises remediationRules cannot leave an ungoverned
	// remediation action behind.
	const remBlock = rejectRemediationActionsNotPermitted(
		command,
		(p.remediationRules ?? loaded.state.remediationRules) as
			ReadonlyArray<{ remediationActions?: readonly string[] }> | undefined,
		(p.permittedControlActions ?? loaded.state.permittedControlActions) as
			readonly string[] | undefined
	);
	if (remBlock) return remBlock;
	// JAN-CMDPRE DWP-08: refuse a no-op edit (every payload-present field already equals current) — it would append a
	// second AssurancePolicyEdited and bump revision for a change that did not happen. Sited AFTER the lifecycle +
	// shape guards so a floor/SUPERSEDED/shape rejection keeps precedence, and before commit.
	const noop = checkPrecondition(ctx, command, editPolicyNoOp, loaded.state);
	if (noop) return noop;
	const newRevision = loaded.revision + 1;
	const next = buildEditedPolicyState(loaded.state, command, p, newRevision);
	const event = makeEvent(ctx, command, {
		eventType: 'AssurancePolicyEdited',
		aggregateType: POLICY,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: POLICY,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** SupersedeAssurancePolicy — retire a policy version (ACTIVE|SUSPENDED -> SUPERSEDED) when a successor replaces
 *  it. The successor id (if given) is recorded as a `superseded-by:<id>` tag. Floor policies reject.
 *
 *  `precondition: fromStates('ACTIVE', 'SUSPENDED')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2, fork F-4 + INV-6) — the
 *  machine's two in-arrows to SUPERSEDED (AssurancePolicy.status, UNRATIFIED-AUTHORED from the rows since no
 *  `drivesFrom` exists, fork F-4; each source is exercised by the widest-in-arrow positive fixture, INV-5). This is
 *  the concrete accumulative-field case INV-6 generalizes from DS-001 F-4: `tags` is an array PUSH, so a
 *  SUPERSEDED -> SUPERSEDED re-issue carrying a `supersededByPolicyId` would append a SECOND `superseded-by:<id>` tag —
 *  the governed record growing a fact for a supersession that did not happen. Refusing the NOOP re-issue is what keeps
 *  `tags` from compounding. `rejectIfFloorLocked` is an INDEPENDENT domain rule (the floor lock) retained AFTER the
 *  precondition (INV-3 non-example); because the precondition runs first, a floor policy in a wrong source state now
 *  refuses on state before the floor-lock arm — the floor-lock refusal for a floor policy in a legal source is
 *  unchanged (SPEC-001 §5.2 note). */
export const supersedeAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as SupersedeAssurancePolicyPayload;
	return advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUPERSEDED',
		eventType: 'AssurancePolicySuperseded',
		precondition: fromStates('ACTIVE', 'SUSPENDED'),
		guard: rejectIfFloorLocked(command),
		mutate: p.supersededByPolicyId
			? (base) => ({
					...base,
					tags: [
						...(Array.isArray(base.tags) ? (base.tags as unknown[]) : []),
						`superseded-by:${p.supersededByPolicyId}`
					]
				})
			: undefined
	});
};

/** SuspendAssurancePolicy — temporarily disable a policy (ACTIVE -> SUSPENDED). Floor policies reject.
 *  `precondition: fromStates('ACTIVE')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2, fork F-4) — the machine's single
 *  ACTIVE -> SUSPENDED in-arrow. A SUSPENDED -> SUSPENDED re-issue was a NOOP appending a second
 *  AssurancePolicySuspended. `rejectIfFloorLocked` retained after the precondition (INV-3 non-example). NONE site,
 *  no code change (wrong-source was already RPH_ILLEGAL_STATE_TRANSITION). */
export const suspendAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUSPENDED',
		eventType: 'AssurancePolicySuspended',
		precondition: fromStates('ACTIVE'),
		guard: rejectIfFloorLocked(command)
	});

/** ActivateAssurancePolicy — put a policy into force (DRAFT|SUSPENDED -> ACTIVE).
 *  `precondition: fromStates('DRAFT', 'SUSPENDED')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2, fork F-4) — the machine's TWO
 *  in-arrows to ACTIVE (a first activation from DRAFT and a re-activation from SUSPENDED; BOTH are exercised by the
 *  mandatory two-source positive fixture, INV-5). An ACTIVE -> ACTIVE re-issue was a NOOP appending a second
 *  AssurancePolicyActivated. `rejectIfFloorLocked` retained (INV-3 non-example): a floor policy is born ACTIVE, so
 *  ACTIVE is not in this set and the precondition now refuses a floor Activate on STATE
 *  (RPH_ILLEGAL_STATE_TRANSITION) before the floor-lock arm — a benign ordering effect within the same REJECTED
 *  result (SPEC-001 §5.2 note). NONE site otherwise, no code change. */
export const activateAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'ACTIVE',
		eventType: 'AssurancePolicyActivated',
		precondition: fromStates('DRAFT', 'SUSPENDED'),
		guard: rejectIfFloorLocked(command)
	});

// ---- Evidence ----
const EVIDENCE = 'EVIDENCE';

/** ProposeEvidence — create Evidence in PROPOSED. */
export const proposeEvidence: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeEvidencePayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, EVIDENCE, p.evidenceId, { lifecycleStatus: 'PROPOSED' }),
		evidenceType: p.evidenceType,
		contentReference: p.contentReference,
		producedBy: p.producedBy,
		supportsClaimIds: p.supportsClaimIds,
		contradictsClaimIds: p.contradictsClaimIds,
		scope: p.scope,
		limitations: p.limitations,
		capturedAt: p.capturedAt,
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: EVIDENCE,
		aggregateId: p.evidenceId,
		births: [{ machine: 'Evidence.status', statusField: 'status', values: ['PROPOSED'] }],
		state,
		eventType: 'EvidenceProposed',
		// The event records the RESULTING state. EvidenceProposed declares the evidence + the created `status`
		// (PROPOSED); the raw command payload omits `status`. Emit the declared shape — the required evidence fields
		// (contentReference passes through as-is) + status, plus the optional claim links / limitations when
		// supplied (absent = not specified, never a fabricated empty). (Pinned defect; now conforms.)
		eventPayload: {
			evidenceType: p.evidenceType,
			contentReference: p.contentReference,
			producedBy: p.producedBy,
			scope: p.scope,
			capturedAt: p.capturedAt,
			status: 'PROPOSED',
			...(p.supportsClaimIds?.length ? { supportsClaimIds: p.supportsClaimIds } : {}),
			...(p.contradictsClaimIds?.length ? { contradictsClaimIds: p.contradictsClaimIds } : {}),
			...(p.limitations?.length ? { limitations: p.limitations } : {})
		}
	});
};

/**
 * AdmitEvidence — PROPOSED -> ADMISSIBLE, and ONLY if the Evidence is admissible.
 *
 * This was a bare status advance: admission was a label anyone could apply to anything. §8.11 L1027 makes
 * admissibility a precondition, and the kernel has evaluated it correctly all along —
 * `evidenceAdmissibility` (rph-assurance) implements all 8 conditions and is unit-proven. Nothing called it.
 * The gap was never the rule; it was the wiring.
 *
 * `sufficientlyCurrent` and `claimId` are deliberately NOT passed: freshness needs a policy-supplied horizon
 * and relevance needs the target Claim, and neither is on this Command. Passing a guess would re-create the
 * defect this fixes. The 6 conditions the accepted contract can answer are enforced; the 2 it cannot are left
 * to the floor, which has the policy context.
 */
export const admitEvidence: CommandHandler = (ctx, command, payload) => {
	const p = payload as AdmitEvidencePayload;
	return advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'ADMISSIBLE',
		// JAN-CMDPRE DWP-03: single in-arrow to ADMISSIBLE, from PROPOSED (Evidence.status). A re-admit of
		// already-ADMISSIBLE evidence would re-run the admissibility guard and append a second EvidenceAdmitted.
		precondition: fromStates('PROPOSED'),
		eventType: 'EvidenceAdmitted',
		// §14.3 EvidenceAdmittedPayload — was the raw AdmitEvidence command payload (admissibilityAssessmentId /
		// admittedScope / admittedClaimIds, which §14.3 does want, verbatim). Delta: + evidenceId (the target
		// aggregate id), + status ('ADMISSIBLE' — the transition this handler just proved legal and admissible).
		eventPayload: () => ({
			evidenceId: command.targetAggregateId,
			status: 'ADMISSIBLE',
			admissibilityAssessmentId: p.admissibilityAssessmentId,
			admittedScope: p.admittedScope,
			admittedClaimIds: p.admittedClaimIds
		}),
		guard: (state) => {
			const verdict = evidenceAdmissibility({
				id: String((state.id ?? '') as Stringifiable),
				provenance: state.provenance,
				// REG-F-008: the PRODUCING ACTOR, which the predicate could not see before. `proposeEvidence` writes
				// it from the ratified required `ProposeEvidence.producedBy`; the envelope's `provenance` is a
				// defaulted origin record and never named an actor.
				producedBy: state.producedBy,
				contentReference: state.contentReference,
				scope: state.scope as string | undefined,
				limitations: state.limitations as readonly string[] | undefined,
				status: state.status as string | undefined,
				supportsClaimIds: state.supportsClaimIds as readonly string[] | undefined
			});
			return verdict.admissible
				? null
				: reject(
						command,
						'RPH_VALIDATION_SEMANTIC_FAILED',
						`AdmitEvidence blocked: ${command.targetAggregateId} is inadmissible (§8.11) — failed ${verdict.failed.join(', ')}.`,
						[command.targetAggregateId]
					);
		}
	});
};

/**
 * The SUPPORTS trace graph, folded from the event log.
 *
 * `StorageAdapter` exposes `loadObject(id)` and `readAllEvents()` and no list-by-type, so the SUPPORTS relation
 * is read where it was recorded: `EvidenceProposed.supportsClaimIds`. Nodes are added before links because
 * `TraceGraph.addLink` validates directionality only when it knows both endpoints' types — omitting them would
 * silently skip the check that makes the graph trustworthy.
 */
function supportsGraph(ctx: HandlerContext): TraceGraph {
	const graph = new TraceGraph();
	for (const event of ctx.store.readAllEvents()) {
		if (event.eventType !== 'EvidenceProposed') continue;
		const payload = (event.payload ?? {}) as Record<string, unknown>;
		const evidenceId = event.aggregateId;
		const claimIds = Array.isArray(payload.supportsClaimIds)
			? (payload.supportsClaimIds as unknown[]).filter((c): c is string => typeof c === 'string')
			: [];
		if (claimIds.length === 0) continue;
		graph.addNode({ id: evidenceId, objectType: EVIDENCE });
		for (const claimId of claimIds) {
			graph.addNode({ id: claimId, objectType: CLAIM });
			graph.addLink({
				id: `${evidenceId}->${claimId}`,
				relation: 'SUPPORTS',
				from: evidenceId,
				to: claimId
			});
		}
	}
	return graph;
}

/**
 * InvalidateEvidence — ADMISSIBLE -> INVALIDATED, naming the claims the evidence was supporting.
 *
 * P4 / CT-10, and the last of the W1 hollow-kernel triage's five WIRE gaps. This used to advance the status and
 * stop, behind a comment that delegated the rest: *"dependent claims are re-contested by the controller"*. No
 * controller did it, so an invalidation left every claim it undermined exactly as supported as before — the
 * silent-loss case CT-10 exists to forbid.
 *
 * `classifyEvidenceInvalidation` computes the answer and was reachable from nothing but its own tests;
 * `EvidenceInvalidatedPayloadSchema` has always declared `affectedClaimIds` and nothing ever populated it. So
 * this is wiring, not design: an existing adversarially-reviewed kernel gains the call site its declared output
 * field was already waiting for.
 *
 * WHAT THIS DOES NOT DO, stated because the difference matters: it RECORDS the impact on the event. It does not
 * mutate the claims. Re-contesting a claim is a controller act with its own authority and its own command, and
 * inventing one here would be this repository's recurring defect — a handler performing an act nothing ratified.
 * The disclosure is what CT-10 requires and what was missing.
 */
export const invalidateEvidence: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'INVALIDATED',
		// JAN-CMDPRE DWP-03: single in-arrow to INVALIDATED, from ADMISSIBLE (Evidence.status). A re-issue against
		// already-INVALIDATED evidence would append a second EvidenceInvalidated and re-trigger P4 claim re-contest.
		precondition: fromStates('ADMISSIBLE'),
		eventType: 'EvidenceInvalidated',
		eventPayload: (next) => ({
			invalidationReason: String(
				(((command.payload ?? {}) as Record<string, unknown>).invalidationReason ??
					'') as Stringifiable
			),
			affectedClaimIds: classifyEvidenceInvalidation(
				supportsGraph(ctx),
				command.targetAggregateId
			).map((impact) => impact.objectId),
			status: String((next.status ?? '') as Stringifiable)
		})
	});

// ---- Claim ----
const CLAIM = 'CLAIM';

/** AssertClaim — create a Claim in OPEN (the claim id is the command's target aggregate id). */
export const assertClaim: CommandHandler = (ctx, command, payload) => {
	const p = payload as AssertClaimPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, CLAIM, id, { lifecycleStatus: 'OPEN' }),
		statement: p.statement,
		claimType: p.claimType,
		assertedBy: command.issuedBy,
		subjectObjectIds: p.subjectObjectIds,
		supportingEvidenceIds: p.supportingEvidenceIds ?? [],
		contradictingEvidenceIds: p.contradictingEvidenceIds ?? [],
		status: 'OPEN'
	};
	// §13.1 ClaimAssertedPayload — was the raw AssertClaim command payload. Delta: + claimId (the command's target
	// aggregate id — the command carries the claim id in the envelope, not the payload), + assertedBy
	// (command.issuedBy, the same value the state records), + status ('OPEN'); - supportingEvidenceIds /
	// - contradictingEvidenceIds (accepted by the command, not defined by §13.1 — a strictObject rejects them as
	// extra keys; they persist on the object state, which is where the claim's evidence links live).
	return createObject(ctx, command, {
		objectType: CLAIM,
		aggregateId: id,
		births: [{ machine: 'Claim.status', statusField: 'status', values: ['OPEN'] }],
		state,
		eventType: 'ClaimAsserted',
		eventPayload: {
			claimId: id,
			statement: p.statement,
			claimType: p.claimType,
			subjectObjectIds: p.subjectObjectIds,
			assertedBy: command.issuedBy,
			status: 'OPEN'
		}
	});
};

/**
 * The claim ids that have at least one ADMISSIBLE piece of evidence supporting them.
 *
 * DERIVED FROM COMMITTED STATE, NEVER FROM THE PAYLOAD — which is the whole reason this check is worth
 * anything. Evidence reaches `ADMISSIBLE` only through `AdmitEvidence`, which runs the eight-condition kernel
 * predicate `evidenceAdmissibility`; a caller cannot assert admissibility on the command that consumes it.
 *
 * `ADMISSIBLE` and not "exists": `EvidenceStatus` is PROPOSED | ADMISSIBLE | REJECTED | SUPERSEDED |
 * INVALIDATED, and RPH-EVD-002's word is *admissible*. A presence check would satisfy the sentence's shape and
 * not its content — the same distinction `authorityDecisionId` needed when it began resolving to an EFFECTIVE
 * Decision rather than to any Decision at all.
 */
function claimsWithAdmissibleEvidence(ctx: HandlerContext): ReadonlySet<string> {
	const evidenceIds = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === EVIDENCE) evidenceIds.add(e.aggregateId);
	const supported = new Set<string>();
	for (const id of evidenceIds) {
		const st = ctx.store.loadObject(id)?.state as
			| { status?: unknown; supportsClaimIds?: unknown }
			| undefined;
		if (!st || String(st.status) !== 'ADMISSIBLE') continue;
		if (!Array.isArray(st.supportsClaimIds)) continue;
		for (const claimId of st.supportsClaimIds) if (typeof claimId === 'string') supported.add(claimId);
	}
	return supported;
}

/** The ratified event each destination records (RPH-DOC-002 §26.5). Absent = the machine allows the move and
 *  the corpus ratifies no event for it, which is REG-F-045's territory and is refused below rather than
 *  papered over with an invented event name. */
const CLAIM_STATUS_EVENT: Readonly<Record<string, string>> = {
	SUPPORTED: 'ClaimSupported',
	CONTESTED: 'ClaimContested',
	REJECTED: 'ClaimRejected',
	// AUTHORED, and disclosed in full at its vocab row. The corpus ratifies NO event for this state, and
	// the reconstructed machine makes it the sole in-arrow of every state the corpus DOES ratify — so
	// every ratified claim state is unreachable without an unratified event. Emitting `ClaimAsserted`
	// instead was tried and the engine's own event gate REFUSED it, which is the gate working.
	UNDER_ASSESSMENT: 'ClaimUnderAssessment'
};

/**
 * RecordClaimAssessment — the act that moves a Claim off OPEN. REG-D-024 (sponsor conferral) / REG-F-044.
 *
 * ── WHY A COMMAND AT ALL, since the corpus ratifies EVENTS and no claim command ────────────────────────────
 * Because the corpus ratifies the command BY PRESUPPOSITION and only its name was missing. RPH-DOC-008 §13
 * RPH-EVD-002: *"Given a claim with no admissible evidence. When status is changed to SUPPORTED. Then THE
 * COMMAND IS REJECTED."* And JPWB-DOC-003 §9 PER-3 forecloses the alternative — canonical state moves "only
 * through authenticated, authorized, semantically named commands", with PER-7 shutting the projection escape.
 * A prior measurement read the events-with-no-commands gap as evidence that status was meant to be DERIVED;
 * that gap is not claim-specific (EvidenceRejected, EvidenceExpired and WaiverExpired share it) and §34's own
 * heading is "Minimum API Surface". A minimum is not a doctrine.
 *
 * ── ONE COMMAND, NOT FOUR VERBS ────────────────────────────────────────────────────────────────────────────
 * The corpus draws no distinction between them: three ratified event NAMES and no command names at all. Four
 * identifiers would be four inventions where one suffices, and the emitted event is chosen from the target
 * status — so the payload must be built for whichever event was picked (the REG-F-020 trap: one call site,
 * three declared interfaces, satisfying none).
 *
 * ── ⚠ WHAT THIS IS NOT ─────────────────────────────────────────────────────────────────────────────────────
 * NOT A GATE. This engine has no authentication layer, so one actor can propose evidence, admit its own
 * evidence, and then record the assessment that consumes it. Measured before this was written: nine such
 * commands from a single actor, all ACCEPTED, against a policy declaring DIFFERENT_AGENT independence. What
 * this delivers is a REACHABLE machine and LIVE consumers, not unforgeable claim status. The smallest thing
 * that would close it is an assessment rendered by a validator the caller does not control, which needs the
 * authentication tier the Charter allocates elsewhere (the boundary REG-F-014 and RPH-EXE-004 both record).
 *
 * The transition table this rides on is AUTHORED, not ratified — all 15 Claim.status arrows are, and the
 * vocab says so ("Transitions RECONSTRUCTED … NO explicit matrix") in a field the generator cannot carry
 * (REG-F-045).
 */
export const recordClaimAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordClaimAssessmentPayload;
	const target = String(p.targetStatus);
	const eventType = CLAIM_STATUS_EVENT[target];
	if (!eventType)
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RecordClaimAssessment cannot record ${target}: this build mints no event name for it. DOC-002 ` +
				`\u00a726.5 ratifies claim events for SUPPORTED, CONTESTED and REJECTED; UNDER_ASSESSMENT is authored ` +
				`and disclosed (REG-D-024). CONDITIONALLY_SUPPORTED, WAIVED and SUPERSEDED have neither a ratified ` +
				`event nor a consumer \u2014 and a state reached by an INVENTED event looks governed, where a state ` +
				`nothing can reach is visible.`
		);

	return advanceStatus(ctx, command, {
		objectType: CLAIM,
		statusField: 'status',
		machine: 'Claim.status',
		// The RANGE, from the one table that already bounds it — `eventType` is looked up in
		// CLAIM_STATUS_EVENT above and an unlisted target is rejected before we get here. Declaring the keys
		// rather than a second literal list keeps ONE source of truth: a state added to that table becomes
		// performable here and visible to the C-0 arrow census in the same edit, with no list to forget.
		targetStates: Object.keys(CLAIM_STATUS_EVENT),
		target,
		eventType,
		// JAN-CMDPRE: the states this command may be issued FROM — every non-terminal claim state. Which
		// DESTINATIONS are legal from each is the machine's judgement; duplicating it here would create a
		// second, drifting copy of the arrow table (REG-F-027's shape).
		precondition: fromStates(
			'OPEN',
			'UNDER_ASSESSMENT',
			'SUPPORTED',
			'CONDITIONALLY_SUPPORTED',
			'CONTESTED'
		),
		// ── RPH-EVD-002, THE ONE NON-FORGEABLE REFUSAL IN THIS COMMAND ────────────────────────────────────────
		// Scoped to SUPPORTED, because that is the destination the ratified test names. A guard that demanded
		// evidence for every destination would pass the refusal tests and be wrong: CONTESTED and REJECTED are
		// precisely the outcomes reached when evidence is absent or against.
		guard: (_state, hctx) => {
			if (target !== 'SUPPORTED') return null;
			if (claimsWithAdmissibleEvidence(hctx).has(command.targetAggregateId)) return null;
			return reject(
				command,
				'RPH_INVARIANT_VIOLATION',
				`Claim ${command.targetAggregateId} cannot be SUPPORTED: no ADMISSIBLE evidence supports it ` +
					`(RPH-DOC-008 §13 RPH-EVD-002). Evidence that is merely PROPOSED has not been admitted.`,
				[command.targetAggregateId]
			);
		},
		mutate: (base) => ({
			...base,
			...(p.contradictingEvidenceIds?.length
				? { contradictingEvidenceIds: p.contradictingEvidenceIds }
				: {}),
			// The supporting evidence is DERIVED and written onto the claim, closing the other half of the
			// hollow: `supportingEvidenceIds` was written once at creation and never populated thereafter, so
			// the one decision that reads it (baseline promotion's pull-guard) traversed to zero evidence.
			...(target === 'SUPPORTED'
				? {
						supportingEvidenceIds: [...admissibleEvidenceFor(ctx, command.targetAggregateId)]
					}
				: {})
		}),
		// Built per the event actually chosen — REG-F-020's medicine.
		eventPayload: (next) => {
			const status = String(next.status);
			if (eventType === 'ClaimSupported')
				return {
					supportingEvidenceIds: (next.supportingEvidenceIds as string[] | undefined) ?? [],
					...(p.assessmentId ? { assessmentId: p.assessmentId } : {}),
					status
				};
			if (eventType === 'ClaimUnderAssessment')
				return { status, ...(p.assessmentId ? { assessmentId: p.assessmentId } : {}) };
			if (eventType === 'ClaimContested')
				return {
					contradictingEvidenceIds: (next.contradictingEvidenceIds as string[] | undefined) ?? [],
					status
				};
			return {
				...(p.assessmentId ? { assessmentId: p.assessmentId } : {}),
				...(p.rationale ? { rationale: p.rationale } : {}),
				status
			};
		}
	});
};

/** The ADMISSIBLE evidence ids supporting one claim — the same fold as `claimsWithAdmissibleEvidence`, kept
 *  separate so the guard answers a yes/no question and the mutator records the actual ids. */
function admissibleEvidenceFor(ctx: HandlerContext, claimId: string): string[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === EVIDENCE) ids.add(e.aggregateId);
	const out: string[] = [];
	for (const id of ids) {
		const st = ctx.store.loadObject(id)?.state as
			| { status?: unknown; supportsClaimIds?: unknown }
			| undefined;
		if (!st || String(st.status) !== 'ADMISSIBLE') continue;
		if (Array.isArray(st.supportsClaimIds) && st.supportsClaimIds.includes(claimId)) out.push(id);
	}
	return out;
}

// ---- Assumption ----
const ASSUMPTION = 'ASSUMPTION';

/** DetectAssumption — create a first-class Assumption in PROPOSED (a material assumption must not stay in prose). */
export const detectAssumption: CommandHandler = (ctx, command, payload) => {
	const p = payload as DetectAssumptionPayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSUMPTION, p.assumptionId, {
			lifecycleStatus: 'PROPOSED',
			originType: 'MODEL_GENERATION'
		}),
		statement: p.statement,
		...(p.basis ? { basis: p.basis } : {}),
		introducedBy: p.introducedBy,
		affectedObjectIds: p.affectedObjectIds,
		materiality: p.materiality,
		status: 'PROPOSED'
	};
	// §12.2 AssumptionDetectedPayload — was the raw DetectAssumption command payload, which carries every §12.2
	// field EXCEPT `status`. Delta: + status only; the other eight are the command's, 1:1.
	//
	// The value is the object's own (PROPOSED), not §12.2's literal `status: 'DISCLOSED'`. §12.2 writes that
	// literal, but this command creates the Assumption in PROPOSED and the generated schema is the
	// AssumptionStatus enum, not a literal — so PROPOSED satisfies it. This is the DOC-007-§12.2-vs-DOC-002-§26.3
	// VALUE DRIFT already recorded in the vocab (DOC-002 makes DISCLOSED a separate AssumptionDisclosed
	// transition). Emitting 'DISCLOSED' would make the event contradict the object it describes; the event reports
	// the status the object actually has. Resolving the drift is a vocab act, not a handler one.
	return createObject(ctx, command, {
		objectType: ASSUMPTION,
		aggregateId: p.assumptionId,
		births: [{ machine: 'Assumption.status', statusField: 'status', values: ['PROPOSED'] }],
		state,
		eventType: 'AssumptionDetected',
		eventPayload: {
			assumptionId: p.assumptionId,
			statement: p.statement,
			...(p.basis ? { basis: p.basis } : {}),
			introducedBy: p.introducedBy,
			affectedObjectIds: p.affectedObjectIds,
			materiality: p.materiality,
			status: state.status,
			...(p.sourceArtifactId ? { sourceArtifactId: p.sourceArtifactId } : {}),
			...(p.sourceExecutionAttemptId
				? { sourceExecutionAttemptId: p.sourceExecutionAttemptId }
				: {})
		}
	});
};

/**
 * ExpireAssumption — advance an Assumption to EXPIRED (RPH-ASM-006 / §12.2). W3-INC-2 (WP-3-008): before this,
 * the Assumption lifecycle was un-instantiated beyond PROPOSED (only DetectAssumption existed), so the kernel
 * `canAuthorizeNewWork` — which forbids an EXPIRED/FALSIFIED/SUPERSEDED assumption from authorizing new work —
 * could never fire. This instantiates the expiry transition; the RPH-ASM-006 guard is then wired at
 * ApproveExecutionPlan (execution.ts). The event is UNRATIFIED-AUTHORED (ungated), like DetectAssumption.
 */
/**
 * DiscloseAssumption — PROPOSED -> DISCLOSED. THE ONLY ROUTE INTO THE MIDDLE OF THE LIFECYCLE.
 *
 * ⚠ AUTHORED BECAUSE `FalsifyAssumption` WOULD OTHERWISE HAVE SHIPPED DEAD, and that is worth stating plainly
 * because I nearly shipped it. `Assumption.status` reaches FALSIFIED only from
 * DISCLOSED|UNDER_VERIFICATION|ACCEPTED|VERIFIED; every one of those traces back to DISCLOSED; and DISCLOSED's
 * only in-arrow is from PROPOSED, which **no command drove**. `DetectAssumption` creates in PROPOSED and
 * `ExpireAssumption` leaves for EXPIRED, so the entire middle of the ratified lifecycle was unoccupiable.
 *
 * A `FalsifyAssumption` registered without this would have been scored **COVERED** by the C-0 arrow census and
 * been unable to fire — which is REG-F-067's finding arriving in practice within the hour: **an arrow out of an
 * unoccupied source is dead however many commands declare it**, and neither C-0 nor `state-reachability` asks
 * whether a state is ever actually occupied.
 *
 * The EVENT is ratified (`AssumptionDisclosedPayloadSchema`); only the command name is authored.
 */
export const discloseAssumption: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: ASSUMPTION,
		statusField: 'status',
		machine: 'Assumption.status',
		target: 'DISCLOSED',
		// The machine's single in-arrow. A re-issue against an already-DISCLOSED assumption would append a
		// second AssumptionDisclosed for a disclosure that already happened.
		precondition: fromStates('PROPOSED'),
		eventType: 'AssumptionDisclosed',
		eventPayload: () => ({ status: 'DISCLOSED' })
	});

/**
 * The contradicting evidence must EXIST, and be EVIDENCE. RPH-ASM-004 / §12.2 / §29.1 make contradicting
 * evidence CONSTITUTIVE of falsification — it is not a note attached to the act, it is the act's basis. So a
 * falsification citing ids that resolve to nothing would be an unfounded status change wearing a governed name,
 * which is the same fiction D-1 removed from `issuedBy` one layer up.
 *
 * Non-empty is checked here rather than in the payload schema because the schema is GENERATED from the vocab
 * and `string[]` is its only array spelling; putting the arity in a hand-edited schema would put a rule
 * somewhere `bun run gen` would silently revert.
 */
const contradictingEvidenceExists = predicate(
	'every cited contradicting evidence id resolves to an EVIDENCE object, and at least one is cited',
	({ payload, read }) => {
		const p = payload as FalsifyAssumptionPayload;
		if (p.contradictingEvidenceIds.length === 0) {
			return (
				'FalsifyAssumption cites no contradicting evidence. Contradicting evidence is what falsifies an ' +
				'assumption (RPH-ASM-004 / §12.2); a falsification with no basis is an unfounded status change.'
			);
		}
		const missing = p.contradictingEvidenceIds.filter(
			(id) => read.objectState(id)?.objectType !== EVIDENCE
		);
		return missing.length === 0
			? null
			: `FalsifyAssumption cites contradicting evidence that does not exist as EVIDENCE: ${missing.join(', ')}. ` +
					`ASR-8 requires the contradicting artifact to remain attached and visible, which an unresolvable id cannot be.`;
	}
);

/**
 * FalsifyAssumption — DISCLOSED|UNDER_VERIFICATION|ACCEPTED|VERIFIED -> FALSIFIED (REG-F-069).
 *
 * ── THIS IS A JOIN, NOT A NEW CAPABILITY, AND ALL FOUR PARTS PREDATE IT ──────────────────────────────────────
 *   1. CANON obliges the act — JPWB-DOC-003 §3 OBJ-4: *"falsification triggers impact analysis"*; §6 STA-7
 *      routes falsified premises into reshaping or invalidation.
 *   2. The EVENT is RATIFIED — `AssumptionFalsifiedPayloadSchema` is a member of `RATIFIED_EVENT_PAYLOADS`,
 *      and was the ONLY member of that set no handler emitted.
 *   3. The KERNEL already computes the outcome — `assessFalsification` (rph-domain) returns the status, the
 *      impacted objects and the event name, and had NO CALLER. It is called below rather than reimplemented.
 *   4. The CONSUMER is already wired and already refuses FALSIFIED — `canAuthorizeNewWork` via
 *      `approveExecutionPlan`. The enforcement register records RPH-ASM-006 as *"enforced on one third of its
 *      own predicate"* precisely because FALSIFIED and SUPERSEDED were unreachable. This closes one third.
 *
 * ── ⚠ THE CASCADE IS DELIBERATELY NOT BUILT, AND THAT IS THE RATIFIED SHAPE — NOT A SHORTFALL ────────────────
 * STA-7's own conservatism clause: *"Automatic invalidation is conservative where consequences are high —
 * **flag for review rather than cascade destructively**."* That is a CEILING on this increment, not a floor: it
 * licenses raising a flag and withholds licence for a destructive cascade. `impactAnalysisRequired: true` on
 * the ratified event IS the flag, and ASR-15 states the purpose in the only operational terms canon offers —
 * dependent work *"cannot keep standing on it silently."* Recording the fact loudly is the discharge available;
 * a routing engine is not, and inventing one would be the convenient interpretation §0.3 forbids.
 *
 * ── AND THE PRIOR SATISFACTION IS NOT REWRITTEN ──────────────────────────────────────────────────────────────
 * STA-7 SCOPE: *"History is never rewritten by invalidation — the record of prior satisfaction stands (PER-2)."*
 * `priorStatus` is carried on the event for exactly that reason, and nothing here touches a dependent object.
 */
export const falsifyAssumption: CommandHandler = (ctx, command, payload) => {
	const p = payload as FalsifyAssumptionPayload;
	// PRIOR STATUS IS READ HERE, NOT STASHED FROM `mutate`. `eventPayload` receives only the NEXT state, and the
	// obvious trick — capture it in the `mutate` closure, which currently runs first — would silently yield ''
	// the day anyone reorders `advanceStatus`. A wrong `priorStatus` on a ratified event is worse than a second
	// read of an object this dispatch has already loaded synchronously. If the object is absent, `advanceStatus`
	// rejects below and this value is never used.
	const priorStatus = String(
		(ctx.store.loadObject(command.targetAggregateId)?.state as Record<string, unknown> | undefined)
			?.status ?? ''
	);
	return advanceStatus(ctx, command, {
		objectType: ASSUMPTION,
		statusField: 'status',
		machine: 'Assumption.status',
		target: 'FALSIFIED',
		// The machine's OWN in-arrows, read from transitions.data.ts rather than chosen. PROPOSED is absent
		// there and therefore absent here: an assumption not yet disclosed has authorized nothing.
		precondition: allOf(
			fromStates('DISCLOSED', 'UNDER_VERIFICATION', 'ACCEPTED', 'VERIFIED'),
			contradictingEvidenceExists
		),
		eventType: 'AssumptionFalsified',
		// ⚠ THE IDS RIDE THE EVENT ONLY, AND I TRIED TO PUT THEM ON THE OBJECT FIRST.
		// I wrote a `mutate` adding `contradictingEvidenceIds` to the Assumption, citing ASR-8's "contradicting
		// evidence remains attached and visible". The ratified `AssumptionObject` is a strictObject with 23
		// fields and no such key, so the write was REFUSED by schema validation — the gate working.
		//
		// And the citation was an OVER-REACH, which is the part worth keeping: ASR-8 sits in §8.3 *Evidence*
		// and its subject is evidence invalidation propagating to CLAIMS. `contradictingEvidenceIds` IS a
		// ratified field — on CLAIM, not on Assumption. Stretching a rule from the aggregate it governs to a
		// neighbouring one is exactly REG-F-065's shape, caught here by the schema instead of by me.
		//
		// The ratified home is the EVENT: `AssumptionFalsifiedPayloadSchema.contradictingEvidenceIds` exists
		// for precisely this, and PER-1 SCOPE names an invalidation as event-backed domain history. Adding the
		// field to a ratified object to match my own citation would have been the invention.
		eventPayload: (nextState) => {
			// THE KERNEL DECIDES, NOT THIS HANDLER. `assessFalsification` already encapsulates the outcome; calling
			// it is what stops a second, drifting copy of the rule appearing here (REG-F-027's shape).
			const outcome = assessFalsification(
				{
					assumptionId: command.targetAggregateId,
					materiality: String(nextState.materiality ?? ''),
					status: String(nextState.status ?? ''),
					affectedObjectIds: (nextState.affectedObjectIds as string[] | undefined) ?? []
				},
				p.contradictingEvidenceIds
			);
			return {
				assumptionId: command.targetAggregateId,
				priorStatus,
				newStatus: outcome.newStatus,
				contradictingEvidenceIds: [...outcome.contradictingEvidenceIds],
				affectedObjectIds: [...outcome.impactedObjectIds],
				impactAnalysisRequired: outcome.impactAnalysisRequired
			};
		}
	});
};

export const expireAssumption: CommandHandler = (ctx, command, payload) => {
	const p = payload as ExpireAssumptionPayload;
	return advanceStatus(ctx, command, {
		objectType: ASSUMPTION,
		statusField: 'status',
		machine: 'Assumption.status',
		target: 'EXPIRED',
		// JAN-CMDPRE DWP-03: Assumption.status has FOUR in-arrows to EXPIRED — from PROPOSED, DISCLOSED,
		// UNDER_VERIFICATION, ACCEPTED (every non-terminal state; VERIFIED/FALSIFIED/EXPIRED/SUPERSEDED are terminal).
		// A re-issue against an already-EXPIRED assumption would append a second AssumptionExpired.
		precondition: fromStates('PROPOSED', 'DISCLOSED', 'UNDER_VERIFICATION', 'ACCEPTED'),
		eventType: 'AssumptionExpired',
		eventPayload: () => ({
			status: 'EXPIRED',
			...(p.expirationCondition ? { expirationCondition: p.expirationCondition } : {})
		})
	});
};

// ---- Assurance Assessment ----
/**
 * Does this evidence requirement demand at least one instance? (DOC-004 §6.1 `cardinality`.)
 *
 * ── WHY THIS EXISTS (REG-E-026) ───────────────────────────────────────────────────────────────────────────────
 * `ZERO_OR_MORE` means exactly what it says: zero instances SATISFY the requirement. Every "outstanding evidence"
 * computation in this file used to work on ids alone — required MINUS received — which treats a ZERO_OR_MORE
 * requirement as unmet until something arrives, i.e. the precise inverse of what the policy declared.
 *
 * It was invisible while every policy shipped `requiredEvidence: []` (REG-F-022): a field nothing could reach
 * cannot be misread. It became live the moment the catalog's 89 requirements were delivered, and DOC-004 §15.5's
 * "prior intent version WHERE APPLICABLE" is a real instance — an intent with no predecessor would otherwise have
 * been permanently unable to reach a SATISFIED verdict for want of a version that does not exist.
 *
 * REG-F-022's own family, one field deeper: a declared governance field no consumer read. The lesson recorded
 * with it is that DELIVERING authored content is not the end of the work — every field of that content has to be
 * read by something, or the delivery just moves the vacuum somewhere less visible.
 *
 * FAIL CLOSED on an absent or unrecognised cardinality: a requirement whose cardinality cannot be read demands an
 * instance. The other arm would let a malformed requirement silently stop gating.
 */
const demandsAnInstance = (r: unknown): boolean =>
	(r as { cardinality?: string } | undefined)?.cardinality !== 'ZERO_OR_MORE';

const ASSESSMENT = 'ASSURANCE_ASSESSMENT';
/**
 * DERIVED FROM THE RATIFIED ENUM, NOT RESTATED (REG-F-026 group (a)).
 *
 * This was a hand-written `new Set([...])` of the same five values. It was CORRECT — and it was the third copy of
 * the same list, alongside `AssuranceDispositionRecommendationSchema` and the `AssuranceAssessmentCompleted.
 * disposition` vocab field. That is how the enum came to be misnamed in the vocab (`AssessmentDispositionSchema`,
 * which resolves to nothing) without any of the copies noticing: each was individually right, and none was the
 * source. Deriving here removes one copy and makes the remaining agreement structural rather than maintained.
 */
const DISPOSITIONS = new Set<string>(AssuranceDispositionRecommendationSchema.options);

/** RequestAssuranceAssessment — create an assessment already in ASSESSING (request-and-begin; the evidence-
 * pending/ready prep states are a deeper increment — see RESUME-STATE). */
export const requestAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestAssuranceAssessmentPayload;
	// FAIL CLOSED on policy governance state (independence follow-up B + the DOC-002 §18 lifecycle). The assessment's
	// policy is what defines its criteria AND its independenceRequirement; the I2 independence gate skips silently
	// when the cited policy id does not resolve. Before this, the handler stored assurancePolicyId blindly, so an
	// assessment could cite a phantom policy — assessing against nothing, and disarming the independence check by
	// making its requirement unresolvable. And a policy governs an assessment only while IN FORCE: the §18 machine is
	// DRAFT -> ACTIVE -> (SUSPENDED) -> SUPERSEDED, so a new assessment must cite an ACTIVE policy — not a DRAFT one
	// (not yet activated), a SUSPENDED one (out of force), or a SUPERSEDED version (a new assessment pins the current
	// version, §18). Two distinct rejections so the audit says which.
	const policy = ctx.store.loadObject(p.assurancePolicyId)?.state as
		| {
				status?: string;
				requiredEvidence?: Array<{ id?: string }>;
				applicability?: unknown;
				applicableObjectTypes?: string[];
		  }
		| undefined;
	if (!policy) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestAssuranceAssessment: assurance policy ${p.assurancePolicyId} does not exist — an assessment cannot be requested against a policy that was never created (its criteria and independence requirement are unresolvable).`,
			[p.assessmentId, p.assurancePolicyId]
		);
	}
	if (policy.status !== 'ACTIVE') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestAssuranceAssessment: assurance policy ${p.assurancePolicyId} is ${String(policy.status)}, not ACTIVE — a policy governs an assessment only while in force (DOC-002 §18). Activate it (or cite the current active version) before assessing against it.`,
			[p.assessmentId, p.assurancePolicyId]
		);
	}
	// §38 "missing evidence" is sourced here. The policy's requiredEvidence (DOC-004 §6.1) names the required
	// evidence-requirement ids; resolved from the (now loaded) policy and carried on the Started EVENT so the read
	// model can report what this assessment requires — NOT on the command payload (the operator does not choose it,
	// the policy does), and NOT on the object state (the ASSURANCE_ASSESSMENT schema does not carry it; the event is
	// the fold's source). Empty when the policy requires no evidence = a real sourced "none", not "unknown".
	//
	// The per-requirement SATISFACTION side (§32 submitEvidenceForAssessment -> AssuranceEvidenceReceived) HAS SINCE
	// BEEN BUILT — it is ~60 lines below in this file, registered, and the §38 view folds a real
	// required-minus-received (assurance-view.ts). This note used to say it was "a separate increment; until it
	// lands, the read model reports the full required set as missing", which was stale in the safe direction: it
	// understated the engine while the capability sat in the same file. Corrected 2026-08-04.
	//
	// WHAT IS ACTUALLY EMPTY, AND IT IS NOT THIS CODE: no production path declares requiredEvidence on any policy,
	// so this resolves to [] for every assessment the product can create — REG-F-022, pinned by
	// verif/policy-evidence-requirement-census.test.ts. The resolution below is correct; its INPUT is empty.
	// ── DOES THIS POLICY GOVERN THIS WORK AT ALL? (DOC-004 §5.1 / §5.2) — NOW ENFORCED (REG-F-024 CLOSED) ─────
	// Wiring this was written, run, and WITHDRAWN on 2026-08-05, because it refused 54 drives and failed the
	// canonical reference undertaking at step #47 on an EVIDENCE subject under `floor.schema-invariant`. The
	// withdrawal note said the cause was that `seedFloorPolicies` scoped the floor to PROFESSIONAL_WORK_ARCHITECTURE
	// because of a *"single-value applicableObjectTypes limitation … §16-unresolved"*.
	//
	// THAT DIAGNOSIS WAS WRONG, AND IT IS WHY THIS SAT BLOCKED. There is no single-value limitation: the field is
	// `z.array(ProfessionalWorkObjectTypeSchema)`, and `git log -S` puts that comment in the SAME commit as the
	// code it describes. It was a code comment taken as evidence of a contract constraint. §16 item 23 IS open, but
	// about material-boundary CLASSIFICATION — and its own instruction runs the other way: *"Never interpret the
	// missing wire shape as permission to omit or hide the floor."* The narrow scope was the forbidden reading, not
	// a placeholder awaiting one. The floor's declared scope is now derived from the object-type enum, and the 54
	// refusals were a false declaration rather than a scope conflict.
	//
	// ── DOES THIS POLICY GOVERN THIS WORK AT ALL? (DOC-004 §5.1 / §5.2) — ENFORCED ────────────────────────────
	// Written, run and withdrawn THREE times before it could land. Each run found a real and different defect,
	// which is what the instrument was for; twice my account of the blocker was itself wrong:
	//   #47 → REG-F-024. The floor declared a scope narrower than the one it enforced. The stated cause — a
	//         "single-value applicableObjectTypes limitation … §16-unresolved" — does not exist in the schema; it
	//         was a code comment taken as evidence of a contract constraint. FIXED (scope derived from the enum,
	//         at BOTH creation sites; the first fix covered one and the gate could not see the other).
	//   #56 → REG-F-028. The seeder's PWU kinds were abbreviations of the corpus names the catalog uses, so
	//         kind-scoped policies matched nothing. FIXED (five renames, each snake-casing the name the type
	//         already carried).
	//   then → REG-F-029. The canonical drive cited ONE policy for every PWU. On the seeded path that is
	//         `pol_fitness_for_purpose`, scoped to three kinds — and the eight PWUs the drive assesses are of four
	//         OTHER kinds, so the assessed population and the scope were PERFECTLY DISJOINT. FIXED: the drive now
	//         selects DECLARED ∩ DETERMINED per PWU and assesses the resulting SET.
	//
	// IT PASSES BY CONSTRUCTION, NOT BY COINCIDENCE. The drive runs `policyApplicability` over the same policy
	// objects this handler reads, so "which policies govern this PWU" has one answer computed once. A drive that
	// merely happened to agree would drift the first time either side moved.
	//
	// IT REFUSES ONLY A DECIDED NEGATIVE. `applicabilityPermitsAssessment` admits every §5.2 outcome except
	// NOT_APPLICABLE — including REQUIRES_HUMAN_DETERMINATION, which an unevaluable `expression` yields. Blocking
	// on a condition nobody can evaluate would stop real work on the strength of not understanding it.
	//
	// AND AN UNRESOLVABLE SUBJECT IS NOT A NEGATIVE. The first version read
	// `objectType: String(subj?.objectType ?? '')`, so a subject the store could not load became the empty string,
	// matched no condition, and was reported NOT_APPLICABLE — a decided negative manufactured from having no
	// information, at the call site of the kernel built to prevent exactly that. A subject that does not resolve
	// is left to the checks that own it; this one declines to answer.
	const applicabilityBlock = ((): CommandResult | null => {
		const subjectId = p.subjectObjectIds?.[0];
		if (!subjectId) return null;
		const subject = ctx.store.loadObject(subjectId)?.state as
			{ objectType?: unknown; pwuKind?: unknown; tags?: unknown } | undefined;
		if (typeof subject?.objectType !== 'string') return null; // cannot decide; do not decide
		const outcome = policyApplicability(
			policy.applicability ?? { objectTypeConditions: policy.applicableObjectTypes },
			{
				objectType: subject.objectType,
				...(typeof subject.pwuKind === 'string' ? { pwuKind: subject.pwuKind } : {}),
				...(Array.isArray(subject.tags) ? { tags: subject.tags as string[] } : {})
			},
			// The DOC-007 §18 evaluator, injected (rph-domain cannot import rph-assurance — cycle). Passing it is
			// what makes an `expression` DECIDE rather than come back undecidable; see policyApplicability's note.
			(expr, subj) => evaluateApplicability(expr as never, subj)
		);
		if (applicabilityPermitsAssessment(outcome)) return null;
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestAssuranceAssessment: assurance policy ${p.assurancePolicyId} does not apply to ${subjectId} (a ${subject.objectType}${typeof subject.pwuKind === 'string' ? `, kind ${subject.pwuKind}` : ''}) — its DOC-004 §5.1 applicability rule yields ${outcome}. Assessing work a policy does not govern would record a verdict against criteria written for something else.`,
			[p.assessmentId, p.assurancePolicyId, subjectId]
		);
	})();
	if (applicabilityBlock) return applicabilityBlock;
	const requiredEvidenceIds = (policy.requiredEvidence ?? [])
		.filter(demandsAnInstance)
		.map((r) => r?.id)
		.filter((id): id is string => typeof id === 'string');
	// WHICH requirements gate ASSESSING, and why it is not all of them. §6.1's `requiredForDispositions` says what
	// a requirement is required FOR. 'ALL' means the assessment cannot be judged without it — that is a
	// precondition of assessing, and it is what the §30 EVIDENCE_PENDING -> READY guard is about.
	// 'SATISFIED_ONLY' / 'CONDITIONAL_OR_SATISFIED' mean the requirement gates a positive CONCLUSION, not the act
	// of assessing: an assessor may examine the work and REJECT it without ever seeing evidence that only a
	// SATISFIED verdict would need. Those stay with Gate A at completion.
	//
	// Reading the arrow as "all declared requirements" would collapse the two checks into one and make Gate A
	// unreachable — you could never be ASSESSING with any requirement outstanding, so its refusal could never
	// fire. Two guards that cannot both matter is one guard and a decoration.
	const blockingEvidenceIds = (policy.requiredEvidence ?? [])
		.filter(
			(r) =>
				(r as { requiredForDispositions?: string } | undefined)?.requiredForDispositions === 'ALL'
		)
		.filter(demandsAnInstance)
		.map((r) => r?.id)
		.filter((id): id is string => typeof id === 'string');
	//
	// ── THE FLIP (REG-F-021 increment 3) ──────────────────────────────────────────────────────────────────────
	// This handler used to create the assessment ALREADY IN `ASSESSING`, with `startedAt` stamped, emitting
	// `AssuranceAssessmentStarted` — the event belonging to the LAST arrow of the §30 machine, fired at the FIRST
	// arrow's moment. Three ratified states were occupied by nothing and two of three arrows were never taken.
	//
	// It now crosses the arrows the corpus declares, in one dispatch, because the trigger text says they belong to
	// ONE act: "AssuranceAssessmentRequested; claims instantiated, evidence requirements evaluated, missing
	// evidence requested (AssuranceEvidenceRequired)". Two governed facts, one trigger — so two events, committed
	// atomically (kit's `alsoEvents`, each independently passing the event gate).
	//
	// WHERE IT LANDS DEPENDS ON A RULE, WRITTEN EXPLICITLY:
	//   requiredEvidenceIds NON-EMPTY -> EVIDENCE_PENDING. Evidence is genuinely outstanding; the assessment waits,
	//                                    and `submitEvidenceForAssessment` advances it when the last one arrives.
	//   requiredEvidenceIds EMPTY     -> READY. "All required evidence present" is VACUOUSLY TRUE, so the machine
	//                                    does not linger in a state whose exit condition is already met.
	//
	// THE EMPTY ARM IS A RULE, NOT AN ACCIDENT, and that distinction is the whole design. Today it is the ONLY arm
	// that ever runs: no production path declares `requiredEvidence` on any policy (REG-F-022), so every assessment
	// this product creates takes the vacuous route. Written as "advance when the required set is empty" it keeps
	// working — and starts genuinely gating — the day REG-F-022 is fixed. Written as "advance unless something
	// objects" it would pass for a reason nobody recorded, and fixing REG-F-022 would silently change the behaviour
	// of every caller at once. The `AssuranceEvidenceRequired` event carries the set either way, so the audit log
	// records a real sourced "none" rather than a silence.
	const evidenceOutstanding = blockingEvidenceIds.length > 0;
	const landingState = evidenceOutstanding ? 'EVIDENCE_PENDING' : 'READY';
	// `startedAt` is NOT stamped here — the assessment has not started. Increment 0 made the field optional on the
	// object for exactly this moment, and `beginAssuranceAssessment` is what fills it. The kit's state-conditional
	// invariant enforces that it IS present from ASSESSING onward, so the guarantee did not lapse with the field.
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSESSMENT, p.assessmentId, {
			lifecycleStatus: landingState,
			sourceObjectIds: p.subjectObjectIds
		}),
		assurancePolicyId: p.assurancePolicyId,
		policyVersion: p.policyVersion,
		policySemanticVersion: 1,
		subjectObjectIds: p.subjectObjectIds,
		subjectSemanticVersions: p.subjectSemanticVersions,
		claimIds: p.claimIds,
		evidenceConsideredIds: [],
		rejectedEvidence: [],
		observationIds: [],
		assessmentState: landingState,
		residualUncertainty: [],
		recommendedControlActions: []
	};
	return createObject(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: p.assessmentId,
		// CONDITIONAL, and both arms are real: `landingState` is EVIDENCE_PENDING when blocking evidence is
		// outstanding, READY otherwise. Declaring only READY would mark EVIDENCE_PENDING unoccupiable and
		// report its out-arrows dead; declaring extras would hide dead arrows. Neither value is the machine's
		// declared `initialState` (REQUESTED), which nothing writes — REG-F-071's fourth case.
		births: [
			{
				machine: 'AssuranceAssessment.state',
				statusField: 'assessmentState',
				values: ['EVIDENCE_PENDING', 'READY']
			}
		],
		state,
		// THE REQUEST MOMENT, recorded at last. Its payload was corrected in increment 1: the authored shape
		// REQUIRED `evaluator` and `disposition` — chosen two arrows later and produced at the very end — so no
		// conformant emitter was possible, which is a large part of why nothing ever emitted it.
		eventType: 'AssuranceAssessmentRequested',
		eventPayload: {
			assessmentId: p.assessmentId,
			assurancePolicyId: p.assurancePolicyId,
			policySemanticVersion: 1,
			subjectObjectIds: p.subjectObjectIds,
			subjectSemanticVersions: p.subjectSemanticVersions,
			claimIds: p.claimIds
		},
		// THE REQUIREMENT EVALUATION, which §38 folds "missing evidence" from. Emitted even when the set is empty:
		// an absent event would make "requires nothing" indistinguishable from "was never evaluated".
		alsoEvents: [
			{
				eventType: 'AssuranceEvidenceRequired',
				payload: {
					assessmentId: p.assessmentId,
					assurancePolicyId: p.assurancePolicyId,
					requiredEvidenceIds
				}
			}
		]
	});
};

/** JAN-CMDPRE DWP-08 (EVENT-LOG-DEPENDENT): refuse re-submitting the SAME (evidenceId, satisfiesRequirementId) pair
 *  for this assessment. submitEvidenceForAssessment commits NO state delta by design (the receipt lives on the
 *  AssuranceEvidenceReceived EVENT), so a "did state change" rule cannot decide it — the reader inspects the
 *  aggregate's committed events for a prior receipt of the same pair. Matches on BOTH ids: the same evidence for a
 *  DIFFERENT requirement, or DIFFERENT evidence for the same requirement, are legitimate and admitted. */
const evidenceNotAlreadyReceived = predicate(
	'the (evidenceId, satisfiesRequirementId) pair has not already been received for this assessment',
	({ command, payload, read }) => {
		const p = payload as SubmitEvidenceForAssessmentPayload;
		const already = read.aggregateEvents(ASSESSMENT, command.targetAggregateId).some((e) => {
			if (e.eventType !== 'AssuranceEvidenceReceived') return false;
			const ep = e.payload as { evidenceId?: string; satisfiesRequirementId?: string };
			return (
				ep.evidenceId === p.evidenceId && ep.satisfiesRequirementId === p.satisfiesRequirementId
			);
		});
		return already
			? `SubmitEvidenceForAssessment: evidence ${p.evidenceId} was already received for requirement '${p.satisfiesRequirementId}' on assessment ${command.targetAggregateId}. Re-issuing would append a second AssuranceEvidenceReceived recording a receipt that already happened.`
			: null;
	},
	'RPH_VALIDATION_SEMANTIC_FAILED'
);

/** SubmitEvidenceForAssessment (DOC-004 §32) — the SATISFACTION side of "missing evidence". Records that an
 *  Evidence object satisfying one of the assessment's declared EvidenceRequirements (§6.1) was received, emitting
 *  AssuranceEvidenceReceived (§31). The §38 view folds `missingEvidence = requiredEvidenceIds` (from the Started
 *  event, Increment K) MINUS the requirement ids received here — so it flips from "the whole required set" to a
 *  faithful required-minus-received. Ratified NAMES, AUTHORED schema (§31 L1783-1785: "ratified names here but
 *  schematized nowhere ... a schema-and-wiring task, NOT a ratification decision"). The received fact lives on the
 *  EVENT, not the assessment snapshot — symmetric with requiredEvidenceIds living on AssuranceAssessmentStarted,
 *  and the read model is the fold's consumer. */
// CITATION CORRECTED 2026-08-04: this ruling was cited as "§31 L1783-1785" here and in five other artifacts. The
// quoted sentence is at L1783-1785; L1783-1785 is a different line ("steps that drive the §30 state machine"). Checked
// against the commit that introduced the ruling — the doc never moved, so the pointer was wrong from the start.
export const submitEvidenceForAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as SubmitEvidenceForAssessmentPayload;
	const id = command.targetAggregateId; // the assessment aggregate
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	// Evidence may only be submitted while the assessment is OPEN, and "open" now means the states in which
	// evidence can still change the outcome. `completeAssuranceAssessment` moves the assessment to a terminal
	// disposition; recording evidence against a completed one would silently shrink its "missing" set AFTER the
	// verdict was already reached.
	//
	// WIDENED IN REG-F-021 INCREMENT 3, AND IT HAD TO BE. This guard read `!== 'ASSESSING'`, which was right while
	// requestAssuranceAssessment created assessments directly in ASSESSING. Under the restored §30 machine evidence
	// is submitted in EVIDENCE_PENDING — the state whose exit condition is "all required evidence present" — so the
	// ratified trigger for the EVIDENCE_PENDING -> READY arrow was being REFUSED at the state the arrow starts
	// from. The guard would have blocked the very transition it exists to serve.
	//
	// READY is included too: an evaluator may have been selected and the assessment not yet begun, and evidence
	// arriving in that window is still evidence for a verdict not yet given. REQUESTED is NOT: the required set has
	// not been evaluated there, so `satisfiesRequirementId` could not be checked against a declared requirement.
	const OPEN_FOR_EVIDENCE = ['EVIDENCE_PENDING', 'READY', 'ASSESSING'];
	const assessmentState = loaded.state.assessmentState;
	if (typeof assessmentState !== 'string' || !OPEN_FOR_EVIDENCE.includes(assessmentState)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SubmitEvidenceForAssessment: assessment ${id} is ${String(assessmentState)}, not one of [${OPEN_FOR_EVIDENCE.join(', ')}] — evidence may only be submitted while the assessment is open to it.`,
			[id]
		);
	}
	// A submission must satisfy a requirement the assessment's policy actually DECLARES (§6.1). The required set is
	// EvidenceRequirement ids while evidenceId is an Evidence OBJECT id — different namespaces, so the binding is
	// explicit (satisfiesRequirementId), never inferred from proximity. Fail closed when the requirement is not
	// declared: otherwise "missing evidence" could be reduced by evidence that satisfies nothing the policy asked
	// for. (This is exactly the namespace subtlety Increment K flagged as why this was not a trivial fold.)
	const policyId = loaded.state.assurancePolicyId as string | undefined;
	const policy = policyId
		? (ctx.store.loadObject(policyId)?.state as
				{ requiredEvidence?: Array<{ id?: string }> } | undefined)
		: undefined;
	const declared = new Set(
		(policy?.requiredEvidence ?? [])
			.map((r) => r?.id)
			.filter((x): x is string => typeof x === 'string')
	);
	if (!declared.has(p.satisfiesRequirementId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SubmitEvidenceForAssessment: '${p.satisfiesRequirementId}' is not an evidence requirement the assessment's policy declares (DOC-004 §6.1) — evidence can only be submitted against a declared requirement.`,
			[id, p.satisfiesRequirementId]
		);
	}
	// JAN-CMDPRE DWP-08 (reader): refuse a duplicate receipt of the same (evidenceId, requirement) pair — decidable
	// only from the event log, since this handler commits no state delta (the receipt lives on the event).
	const dup = checkPrecondition(ctx, command, evidenceNotAlreadyReceived, loaded.state);
	if (dup) return dup;
	const newRevision = loaded.revision + 1;
	// ── THE EVIDENCE_PENDING -> READY ARROW (REG-F-021 increment 3) ────────────────────────────────────────────
	// §30's guard is "all required evidence present and admissible per §6.2", and §32 names THIS command as the
	// arrow's trigger. So the arrow is taken HERE, at the moment the last outstanding requirement is satisfied —
	// required MINUS received, the same difference §38 folds "missing evidence" from and the same one Gate A
	// recomputes at completion, so the view, this arrow, and the completion gate cannot disagree.
	//
	// The receipt for THIS submission is not yet in the event log (it is committed below), so it is added to the
	// received set explicitly. Reading the log alone would leave the assessment one requirement short forever.
	const receivedIds = new Set(
		ctx.store
			.readAggregateEvents(ASSESSMENT, id)
			.filter((e) => e.eventType === 'AssuranceEvidenceReceived')
			.map((e) => (e.payload as { satisfiesRequirementId?: string }).satisfiesRequirementId)
			.filter((x): x is string => typeof x === 'string')
	);
	receivedIds.add(p.satisfiesRequirementId);
	// Only the requirements that gate ASSESSING (requiredForDispositions === 'ALL') hold the arrow — see the
	// request handler. A 'SATISFIED_ONLY' requirement outstanding does not keep an assessment out of ASSESSING; it
	// keeps a SATISFIED verdict out, at Gate A.
	const blocking = (policy?.requiredEvidence ?? [])
		.filter(
			(r) =>
				(r as { requiredForDispositions?: string } | undefined)?.requiredForDispositions === 'ALL'
		)
		.filter(demandsAnInstance)
		.map((r) => r?.id)
		.filter((x): x is string => typeof x === 'string');
	const stillOutstanding = blocking.filter((r) => !receivedIds.has(r));
	// Only from EVIDENCE_PENDING: submitting more evidence to an assessment already READY or ASSESSING records the
	// receipt without moving anything, which is correct — the machine does not go backwards and does not re-enter a
	// state it has left.
	const advancesToReady = assessmentState === 'EVIDENCE_PENDING' && stillOutstanding.length === 0;
	// The assessment SNAPSHOT is otherwise unchanged beyond the envelope bump — the received-evidence fact lives on
	// the EVENT.
	const next = {
		...nextEnvelope(loaded.state, command, newRevision),
		...(advancesToReady ? { assessmentState: 'READY', lifecycleStatus: 'READY' } : {})
	};
	const event = makeEvent(ctx, command, {
		eventType: 'AssuranceEvidenceReceived',
		aggregateType: ASSESSMENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: {
			assessmentId: id,
			evidenceId: p.evidenceId,
			satisfiesRequirementId: p.satisfiesRequirementId,
			...(p.evidenceType !== undefined ? { evidenceType: p.evidenceType } : {})
		}
	});
	return commitState(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/**
 * SelectAssuranceEvaluator (DOC-004 §32) — the FIRST of the two acts the ratified §30 `READY -> ASSESSING` arrow
 * names: *"selectAssuranceEvaluator (AssuranceEvaluatorSelected) then beginAssuranceAssessment
 * (AssuranceAssessmentStarted)"*. It records WHO will assess and deliberately does NOT move the machine.
 *
 * WHY IT IS WORTH BUILDING RATHER THAN FOLDING INTO `begin`. Today `completeAssuranceAssessment` reads its
 * evaluator off `p.validatorResult?.executionProvenance?.evaluator` — the identity of the assessor arrives inside
 * the VERDICT, because no governed selection act existed to carry it. That is the one place this restoration buys
 * a governance guarantee rather than ordering fidelity alone: after this command, *who assessed* is a committed
 * fact with its own event, not a field of the answer they produced.
 *
 * REACHABILITY, STATED PLAINLY: no assessment reaches `READY` until increment 3 flips `requestAssuranceAssessment`
 * to create in `REQUESTED`. So this handler is correct and, on the production paths, not yet reachable. Its tests
 * place the assessment in `READY` through the real write seam rather than pretending otherwise.
 *
 * AUTHORED SCHEMA, NO CORPUS RULING. §32 ratifies the NAME. Unlike `AssuranceEvidenceRequired`/`Received`, the §31
 * "schema-and-wiring, not a ratification decision" ruling does NOT name this event — that paragraph is about §38's
 * missing-evidence pair. This shape rests on the ordinary standing grant, and says so rather than borrowing.
 */
export const selectAssuranceEvaluator: CommandHandler = (ctx, command, payload) => {
	const p = payload as SelectAssuranceEvaluatorPayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	// FROM_STATES as a first-class precondition: an evaluator is selected for an assessment that is READY to be
	// assessed. Selecting one for an assessment already ASSESSING would change the assessor mid-judgment; selecting
	// one for a terminal assessment would edit who made a verdict already given.
	const pre = checkPrecondition(ctx, command, fromStates('READY'), loaded.state, {
		statusField: 'assessmentState',
		subject: ASSESSMENT,
		eventType: 'AssuranceEvaluatorSelected'
	});
	if (pre) return pre;
	const newRevision = loaded.revision + 1;
	const next = {
		...nextEnvelope(loaded.state, command, newRevision),
		evaluator: p.evaluator
	};
	// The policy's requirement is resolved HERE and recorded on the event, so an audit reads what independence was
	// required AT SELECTION TIME rather than what the policy happens to require now. Absent when the policy does not
	// resolve — a fail-open would be worse than silence, and the independence gate at completion is unaffected.
	const policy = ctx.store.loadObject(loaded.state.assurancePolicyId as string)?.state as
		{ independenceRequirement?: string } | undefined;
	const event = makeEvent(ctx, command, {
		eventType: 'AssuranceEvaluatorSelected',
		aggregateType: ASSESSMENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: {
			assessmentId: id,
			evaluator: p.evaluator,
			...(policy?.independenceRequirement
				? { independenceRequirement: policy.independenceRequirement }
				: {})
		}
	});
	return commitState(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/**
 * BeginAssuranceAssessment (DOC-004 §32) — the SECOND act of the `READY -> ASSESSING` arrow, and the only one that
 * moves the machine. It emits `AssuranceAssessmentStarted`.
 *
 * THIS EVENT IS THE WHOLE OF REG-F-021. `requestAssuranceAssessment` emits `AssuranceAssessmentStarted` today, at
 * the moment of the REQUEST — the LAST arrow's event fired at the FIRST arrow's moment, because the engine fused
 * request-and-begin. Until increment 3 moves that emission, both this handler and the request emit it, which is
 * why the census's bound-but-unemitted pin cannot yet see the difference (it compares SETS).
 *
 * `startedAt` IS STAMPED HERE, which is the moment it has always meant. Increment 0 made the field optional on the
 * object precisely so an assessment that has not begun can honestly lack it; this is where it stops lacking it,
 * and the kit's state-conditional invariant enforces that from `ASSESSING` onward.
 */
export const beginAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as BeginAssuranceAssessmentPayload;
	return advanceStatus(ctx, command, {
		objectType: ASSESSMENT,
		statusField: 'assessmentState',
		machine: 'AssuranceAssessment.state',
		target: 'ASSESSING',
		precondition: fromStates('READY'),
		eventType: 'AssuranceAssessmentStarted',
		setLifecycleStatus: true,
		mutate: (base) => ({ ...base, startedAt: p.startedAt ?? command.issuedAt }),
		eventPayload: (next) => ({
			assessmentId: command.targetAggregateId,
			assurancePolicyId: next.assurancePolicyId,
			policyVersion: next.policyVersion,
			subjectObjectIds: next.subjectObjectIds,
			subjectSemanticVersions: next.subjectSemanticVersions,
			claimIds: next.claimIds
		})
	});
};

/**
 * CancelAssuranceAssessment — close an assessment that will never reach a verdict.
 *
 * THE ARROW IS RATIFIED, THE NAME IS NOT. DOC-004 §30's "Alternate transitions" block declares
 * `ANY ACTIVE → CANCELLED`. §32/§31 named no cancel command or event when this was written — an arrow with no
 * trigger — and both are RATIFIED as of 2026-08-05 (§0.3 authored clarification). Five of §30's six alternate
 * arrows were transcribed into `m2-transitions.json` and this one was dropped, because its from-state is
 * QUANTIFIED rather than literal — "ANY ACTIVE" is not a row. So CANCELLED sat declared, TERMINAL and reachable
 * by nothing, which is why REG-F-021's residual R-1 existed: an assessment stalled in EVIDENCE_PENDING, its
 * required evidence never arriving, could not be closed by any command in the system.
 *
 * ACTIVE means the four states before an outcome: REQUESTED, EVIDENCE_PENDING, READY, ASSESSING. A concluded
 * assessment is not cancelled — post-outcome change is what INVALIDATED and WAIVER_EXPIRED are for, and §32's
 * `invalidateAssuranceAssessment` invalidates a VERDICT, which a cancelled assessment never reached.
 *
 * AND IT IS NOT `INCONCLUSIVE`. That disposition means "we assessed and could not conclude". CANCELLED means "we
 * never assessed". Recording a never-started assessment as a judgment that reached no conclusion is a stronger
 * claim than the truth — the reason the two must stay distinct even though both close an assessment without a
 * positive verdict.
 */
export const cancelAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as CancelAssuranceAssessmentPayload;
	const loaded = loadOrReject(ctx, command, command.targetAggregateId);
	if (!loaded.ok) return loaded.result;
	// Captured BEFORE the transition: the terminal state records that the assessment was cancelled and not from
	// where. An assessment abandoned in EVIDENCE_PENDING (evidence never arrived) and one abandoned in ASSESSING
	// (the assessor withdrew) are different facts, and only the event will ever hold the difference.
	const cancelledFromState = String(loaded.state.assessmentState);
	return advanceStatus(ctx, command, {
		objectType: ASSESSMENT,
		statusField: 'assessmentState',
		machine: 'AssuranceAssessment.state',
		target: 'CANCELLED',
		// The machine itself refuses a cancel from a concluded state — every ACTIVE state has the arrow and no
		// other state does — so this precondition is the machine's own shape, not a second opinion about it.
		precondition: fromStates('REQUESTED', 'EVIDENCE_PENDING', 'READY', 'ASSESSING'),
		eventType: 'AssuranceAssessmentCancelled',
		setLifecycleStatus: true,
		eventPayload: (next) => ({
			assessmentId: command.targetAggregateId,
			assurancePolicyId: next.assurancePolicyId,
			cancelledFromState,
			reason: p.reason
		})
	});
};

/** The reverse of record-assurance.ts's `identityToActorReference`: map the ratified wire `ActorReference` back
 *  onto the assurance-island `Identity` that `checkIndependence` reasons over. Symmetric with the forward seam —
 *  `actorId`↔`agentId`, `modelId`, `providerId`, `executionInstanceId`↔`invocationId`, `actorType`.
 *  `contextInstanceId`/`orgId` have no `ActorReference` source and stay undefined; an independence dimension keyed on
 *  one of those is then unprovable from a bare `ActorReference`, which `differs()` treats as NOT independent — a
 *  fail-closed absence, never a fabricated pass. */
function actorReferenceToIdentity(a: ActorReference): Identity {
	return {
		agentId: a.actorId,
		...(a.modelId ? { modelId: a.modelId } : {}),
		...(a.providerId ? { providerId: a.providerId } : {}),
		...(a.executionInstanceId ? { invocationId: a.executionInstanceId } : {}),
		actorType: a.actorType
	};
}

/** The validator's verdict as CompleteAssuranceAssessment receives it (DOC-007 §20 ValidatorResult, the fields
 *  this handler reads). Named so the parsing/gate helpers below can share the shape with the handler. */
interface CompleteValidatorResult {
	validatorId?: string;
	validatorVersion?: string;
	dispositionRecommendation?: string;
	subjectObjectIds?: string[];
	subjectSemanticVersions?: Record<string, number>;
	evidenceConsideredIds?: string[];
	residualUncertainty?: string[];
	recommendedControlActions?: Record<string, unknown>[];
	executionProvenance?: { evaluator?: ActorReference };
}

/** The validated completion inputs, or the rejection to return. Threads `disposition` back as a proven `string`
 *  (not `string | undefined`) so the caller keeps the same narrowing the inline `if (!disposition)` gave it. */
type ParsedCompletion =
	| { readonly ok: false; readonly result: CommandResult }
	| {
			readonly ok: true;
			readonly disposition: string;
			readonly subjectIds: string[];
			readonly versions: Record<string, number>;
	  };

/** Parse + validate the validatorResult: a legal disposition recommendation AND (DOC-004 invariant 2) a named
 *  semantic version for every subject. Reject short-circuit order preserved — disposition first, then invariant 2. */
function parseCompletion(
	command: DomainCommand,
	validatorResult: CompleteValidatorResult | undefined
): ParsedCompletion {
	const disposition = validatorResult?.dispositionRecommendation;
	if (!disposition || !DISPOSITIONS.has(disposition)) {
		return {
			ok: false,
			result: reject(
				command,
				'RPH_VALIDATOR_OUTPUT_INVALID',
				`CompleteAssuranceAssessment requires validatorResult.dispositionRecommendation in ${[...DISPOSITIONS].join('|')}`
			)
		};
	}
	// DOC-004 INVARIANT 2 — "Every assessment identifies its subject semantic version." THE SCHEMA CANNOT SAY
	// THIS. `subjectSemanticVersions: Record<string, number>` is satisfied by `{}`, so a verdict that names a
	// subject and no version for it is schema-valid and meaningless: nothing downstream can tell whether the
	// judgement still applies to the object as it now stands. Found by mutation — emptying the record left the
	// §20 strictObject perfectly happy and every test green, which is precisely the class of hole this whole
	// effort exists to close. A shape check is not an invariant check.
	//
	// §13.3: "Fail closed on missing identity, tenant, policy, schema, or authority context."
	const subjectIds = validatorResult?.subjectObjectIds ?? [];
	const versions = validatorResult?.subjectSemanticVersions ?? {};
	const unversioned = subjectIds.filter((id) => typeof versions[id] !== 'number');
	if (unversioned.length > 0) {
		return {
			ok: false,
			result: reject(
				command,
				'RPH_VALIDATOR_OUTPUT_INVALID',
				`CompleteAssuranceAssessment: validatorResult.subjectSemanticVersions must name a version for every subject (DOC-004 invariant 2 — "Every assessment identifies its subject semantic version"). Missing: ${unversioned.join(', ')}`,
				unversioned
			)
		};
	}
	return { ok: true, disposition, subjectIds, versions };
}

/** GATE B (Increment R) — permittedControlActions ENFORCED: a validator may only recommend a control action the
 *  policy permits (§11). An empty permitted set constrains nothing (skip). Returns a rejection or null (pass). */
function rejectUnpermittedControlActions(
	command: DomainCommand,
	validatorResult: CompleteValidatorResult | undefined,
	permittedControlActions: readonly string[] | undefined
): CommandResult | null {
	const permitted = new Set(permittedControlActions ?? []);
	if (permitted.size === 0) return null;
	const offending = (validatorResult?.recommendedControlActions ?? [])
		.map((r) => (r as { action?: unknown }).action)
		.filter((a): a is string => typeof a === 'string' && !permitted.has(a));
	if (offending.length === 0) return null;
	return reject(
		command,
		'RPH_VALIDATION_SEMANTIC_FAILED',
		`CompleteAssuranceAssessment: the validator recommended control action(s) [${offending.join(', ')}] that this policy does not permit (§11). Permitted: [${[...permitted].join(', ')}].`,
		[command.targetAggregateId]
	);
}

/** GATE C (#1a) — dispositionRules ENFORCED: the §10.3 foreclosure. The policy's rule for the recommended
 *  disposition may forbid it while an observation of certain severities is still OPEN. Only fires when the policy
 *  declares forbiddenOpenSeverities for this disposition. `openSeverities` is the memoized per-completion loader.
 *  Returns a rejection or null (pass). */
function rejectForeclosedDisposition(
	command: DomainCommand,
	disposition: string,
	dispositionRules:
		| ReadonlyArray<{ disposition?: string; forbiddenOpenSeverities?: readonly string[] }>
		| undefined,
	openSeverities: () => Set<string>
): CommandResult | null {
	const dispositionRule = (dispositionRules ?? []).find((r) => r?.disposition === disposition);
	const forbidden = new Set(dispositionRule?.forbiddenOpenSeverities ?? []);
	if (forbidden.size === 0) return null;
	const openForbiddenSeverities = [...openSeverities()].filter((s) => forbidden.has(s));
	if (openForbiddenSeverities.length === 0) return null;
	return reject(
		command,
		'RPH_VALIDATION_SEMANTIC_FAILED',
		`CompleteAssuranceAssessment: a ${disposition} disposition is foreclosed — the policy's dispositionRules forbid it while an observation of severity [${[...new Set(openForbiddenSeverities)].join(', ')}] is still OPEN (DOC-004 §10.3). Resolve or waive the finding, or return a non-satisfied disposition.`,
		[command.targetAggregateId]
	);
}

/** CompleteAssuranceAssessment — ASSESSING -> a terminal disposition read from the validator recommendation
 * (validatorResult.dispositionRecommendation). The AssuranceAssessment.state machine rejects the illegal
 * disposition transitions (INV-8/INV-9/INV-10). */
export const completeAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as {
		validatorResult?: CompleteValidatorResult;
		/** Increment I2: the identity that PRODUCED the subject, for the independence check against the evaluator. */
		producer?: ActorReference;
	};
	const parsed = parseCompletion(command, p.validatorResult);
	if (!parsed.ok) return parsed.result;
	const { disposition, subjectIds, versions } = parsed;
	// Record WHO judged. The Assessment object has always carried an optional `evaluator: ActorReference`; the
	// completion path simply never wrote it, so the model/provider that actually reviewed the artifact was
	// persisted nowhere (§9.7 "resolved provider/model/version actually invoked"; §8.4 L851 "actual identities and
	// lineage are recorded"). Validated against the ratified schema at the aggregate boundary like any field.
	//
	// IT MOVED, from `validatorResult.evaluator` to `validatorResult.executionProvenance.evaluator`, because
	// DOC-007 §20 has no `evaluator` field — the old path only type-checked while ValidatorResultSchema was
	// `z.record(z.string(), z.unknown())`, and a §20 strictObject rejects it outright. `executionProvenance` is
	// where §9.7's "resolved provider/model/version actually invoked" belongs.
	//
	// AND THIS IS STILL NOT THE RATIFIED HOME. DOC-004 §32 ratifies `selectAssuranceEvaluator` as its own
	// command — choosing the evaluator is a governed act, not a rider on the verdict. That command does not exist
	// in this codebase (nor do §32's `recordCriterionResult` or `beginAssuranceAssessment` — ~~4~~ THREE of §32's
	// 13; corrected 2026-08-04, REG-F-021: this sentence also named `submitEvidenceForAssessment`, which HAS been
	// built and is registered, so the count was one too many and the record went stale in the safe direction —
	// claiming less capability than exists). Their absence is exactly why the evaluator is smuggled through the
	// verdict and why criterion results are dropped at the boundary: the commands that own those facts were never
	// built. Surfaced in HARMONIZATION-LOG PART 4, not fixed here.
	//
	// THE MISSING TWO ARE THE ARROWS THAT LIFECYCLE COLLAPSE RUNS THROUGH (REG-F-021). The ratified
	// `AssuranceAssessment.state` machine is REQUESTED -> EVIDENCE_PENDING -> READY -> ASSESSING, and
	// `requestAssuranceAssessment` creates the assessment ALREADY IN `ASSESSING`. Measured: `REQUESTED`,
	// `EVIDENCE_PENDING` and `READY` are written by NO production line. Three ratified states no assessment ever
	// occupies, and the two commands that would move through them are the two still missing.
	const evaluator = p.validatorResult?.executionProvenance?.evaluator;

	// INDEPENDENCE (Increment I2). §39 invariant 8 ("Required independence must be verified"), §8.4, §20.2: a
	// required independence must be verified before an assessment may be satisfied. `checkIndependence` is the kernel
	// rule (@janumipwb/rph-assurance), called here the same way `admitEvidence` calls `evidenceAdmissibility` — the
	// rule, invoked, not a copy of it. On a real violation the assessment does NOT complete to a disposition; it
	// transitions ASSESSING -> INDEPENDENCE_VIOLATION (the ratified §30 arrow, which INV-8 forbids from ever reaching
	// SATISFIED), recording `AssuranceIndependenceViolated`.
	//
	// GATED, and honest about the gate. The check runs only when the policy's requirement RESOLVES, is not `NONE`,
	// and BOTH operands are present. When it cannot — the policy id does not resolve (a known boundary hole:
	// `requestAssuranceAssessment` never checked policy existence either, so the standalone drive's floor assessments
	// cite absent policies), the requirement is `NONE`, or this caller did not supply the subject's producer (the
	// floor recording path does not yet) — the assessment proceeds WITHOUT a check rather than fabricate a pass or a
	// violation. Those paths leave independence unverified; recorded in HARMONIZATION-LOG, closed incrementally,
	// never papered over with a defaulted identity. The positive `AssuranceIndependenceVerified` signal is Increment I4.
	const producer = p.producer;
	const assessmentState = ctx.store.loadObject(command.targetAggregateId)?.state as
		{ assurancePolicyId?: string } | undefined;
	// Load the governing policy ONCE — its rule arrays must actually decide, not sit settable-and-ignored (the
	// "hollow governed layer"). Three fields govern here: independenceRequirement (the §39-inv-8 check below,
	// Increment I2), permittedControlActions (Gate B), and requiredEvidence (Gate A).
	const policyState = assessmentState?.assurancePolicyId
		? (ctx.store.loadObject(assessmentState.assurancePolicyId)?.state as
				| {
						independenceRequirement?: string;
						permittedControlActions?: readonly string[];
						requiredEvidence?: ReadonlyArray<{ id?: string; requiredForDispositions?: string }>;
						dispositionRules?: ReadonlyArray<{
							disposition?: string;
							forbiddenOpenSeverities?: readonly string[];
						}>;
						escalationRules?: ReadonlyArray<{
							escalateOnOpenSeverities?: readonly string[];
							escalationTarget?: string;
						}>;
				  }
				| undefined)
		: undefined;

	// Shared by Gate D (escalation) and Gate C (foreclosure): the CURRENT severities of this assessment's still-OPEN
	// observations. Loaded per-object from the store (not read off the recording event) so a resolved or WAIVED
	// finding no longer counts. Memoized — computed at most once per completion, and only if a gate needs it.
	let openSevMemo: Set<string> | undefined;
	const openObservationSeverities = (): Set<string> =>
		(openSevMemo ??= new Set(
			ctx.store
				.readAllEvents()
				.filter(
					(e) =>
						e.eventType === 'AssuranceObservationRecorded' &&
						(e.payload as { assessmentId?: string }).assessmentId === command.targetAggregateId
				)
				.map((e) => (e.payload as { observationId?: string }).observationId)
				.filter((oid): oid is string => typeof oid === 'string')
				.map(
					(oid) =>
						ctx.store.loadObject(oid)?.state as
							{ severity?: string; disposition?: string } | undefined
				)
				.filter((o) => o?.disposition === 'OPEN' && typeof o.severity === 'string')
				.map((o) => o!.severity as string)
		));

	// ── GATE D — A DISABLED VALIDATOR'S RESULT IS REFUSED (REG-E-024(c), DOC-004 §35) ──────────────────────────
	//
	// §35 makes availability a selection input and §34.1 requires an *alternate validator implementation* be
	// choosable when one fails. Both are empty words unless a withdrawn implementation is actually barred.
	//
	// WHY HERE AND NOT AT SELECTION, WHICH IS WHERE §35's PROSE POINTS. `selectAssuranceEvaluator` carries an
	// `evaluator: ActorReference` — a PERSON OR AGENT — while the registry keys on `validatorId`, an
	// IMPLEMENTATION. They are different namespaces: the reference undertaking's evaluator is `evaluator-1` and
	// its validator is `reference-undertaking.reviewer`. Joining them would be inferring a binding from
	// proximity, which is the exact error REG-F-022 records for `evidenceId` vs requirement id.
	//
	// `validatorId` enters the assurance flow in exactly one place — `validatorResult` on THIS command — so this
	// is the only seam where the check is sound. It is also the stronger position: it refuses the RESULT, not
	// merely the intention to use the validator.
	//
	// DEGRADED DOES NOT REFUSE. §35 says selection *considers* availability; a degraded implementation is
	// impaired, not withdrawn, and barring it would be stronger than the corpus states. Stating the non-refusal
	// is part of the design, not an omission.
	//
	// AN UNREGISTERED VALIDATOR DOES NOT REFUSE — the disclosed fail-open, the same shape as `attemptsMade` and
	// `lastFailureClass`. No production path registers a validator today, so refusing on absence would make every
	// existing assessment uncompletable: a gate that bars the entire product is not a stricter gate, it is a
	// broken one.
	const validatorIdOnResult = (
		command.payload as { validatorResult?: { validatorId?: string } } | undefined
	)?.validatorResult?.validatorId;
	if (typeof validatorIdOnResult === 'string') {
		const entry = ctx.store.loadObject(validatorIdOnResult)?.state as
			| { status?: string }
			| undefined;
		if (entry?.status === 'DISABLED')
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`CompleteAssuranceAssessment: validator ${validatorIdOnResult} is DISABLED in the registry (DOC-004 §35), so its result cannot complete an assessment. §34.1's response to a failed validator is an ALTERNATE implementation; accepting a withdrawn one instead would defeat both that and §35's availability consideration. Re-enable it (EnableValidator) or complete with a validator that is ACTIVE or DEGRADED.`,
				[command.targetAggregateId, validatorIdOnResult]
			);
	}

	// GATE B (Increment R) — permittedControlActions ENFORCED, not merely displayed. A validator may only recommend
	// a control action the policy permits (§11); an action outside the permitted set is a policy violation, so the
	// completion fails closed rather than record an ungoverned recommendation. permittedControlActions is now a
	// coherent per-policy set with a universal escalate-and-reshape floor (Increment N), so "permitted" means
	// something for every policy. Empty permitted set → skip (a policy that declares none constrains nothing).
	const gateBReject = rejectUnpermittedControlActions(
		command,
		p.validatorResult,
		policyState?.permittedControlActions
	);
	if (gateBReject) return gateBReject;

	// INV-8 INDEPENDENCE (precedes Gate D — adversarial-review fix). A required-independence VIOLATION is a
	// PRECONDITION failure that invalidates the evaluation itself, so it must decide BEFORE the outcome gates —
	// including Gate D escalation. Were it left after Gate D, an open-CRITICAL + escalation-rule assessment would
	// escalate and the ratified AssuranceIndependenceViolated event (the §30 ASSESSING -> INDEPENDENCE_VIOLATION
	// arrow, which INV-8 forbids from ever reaching SATISFIED) would never be recorded. Runs only when the
	// requirement resolves, is not NONE, and both operands are present; else falls through unverified (recorded,
	// never a fabricated pass).
	const independenceRequirement = policyState?.independenceRequirement;
	// 'VERIFIED' only when the check RAN and PASSED; left undefined when it did not run (see the gate note above) so
	// the §38 view reads that as "unknown", never a fabricated pass. The negative branch returns early below.
	let independenceResult: string | undefined;
	if (independenceRequirement && independenceRequirement !== 'NONE' && producer && evaluator) {
		const verdict = checkIndependence(
			independenceRequirement as IndependenceRequirement,
			actorReferenceToIdentity(producer),
			actorReferenceToIdentity(evaluator)
		);
		if (!verdict.independent) {
			return advanceStatus(ctx, command, {
				objectType: ASSESSMENT,
				statusField: 'assessmentState',
				machine: 'AssuranceAssessment.state',
				target: 'INDEPENDENCE_VIOLATION',
				// Every terminal disposition is reachable ONLY from ASSESSING. Re-issuing over an already-terminal
				// assessment overwrote the recorded producer/evaluator pair — so an independence violation would no
				// longer name the operands that violated it, which is exactly what this mutate exists to preserve.
				precondition: fromStates('ASSESSING'),
				eventType: 'AssuranceIndependenceViolated',
				setLifecycleStatus: true,
				eventPayload: (next) => ({
					assessmentId: command.targetAggregateId,
					assurancePolicyId: next.assurancePolicyId,
					policyVersion: next.policyVersion,
					subjectObjectIds: subjectIds,
					subjectSemanticVersions: versions,
					independenceRequirement,
					reason: verdict.reason ?? 'required independence not satisfied'
				}),
				// Record BOTH identities the check compared (contract-drift fix): an INV-8 violation whose object
				// state names neither operand cannot answer "producer X vs evaluator Y" — the very pair that failed.
				// The violation path previously wrote neither; both are recorded now.
				mutate: (base) => ({
					...base,
					completedAt: command.issuedAt,
					...(producer ? { producer } : {}),
					...(evaluator ? { evaluator } : {})
				})
			});
		}
		independenceResult = 'VERIFIED';
	}

	// GATE D (#1b) — escalationRules ENFORCED: the ratified escalation trigger fires. §10.3's DEFAULT precedence pairs
	// ESCALATED with a CRITICAL open finding ("CRITICAL open finding → REJECTED or ESCALATED"); a policy declares, via
	// an escalationRule's escalateOnOpenSeverities, that it takes the ESCALATE branch for that case. When such a
	// CRITICAL observation is still OPEN, the assessment transitions ASSESSING → ESCALATED (the ratified §30 arrow,
	// transitions.data.ts) and emits AssuranceAssessmentEscalated — REACHABLE for the first time — instead of completing
	// to the recommended disposition. Runs AFTER the independence gate (a precondition) but BEFORE the reject/satisfy
	// gates (A/C), so a declared escalation takes precedence over an outcome. RESTRICTED to ESCALATABLE_SEVERITIES
	// (= {CRITICAL}); authoring already refused any other value here, and intersecting is defense-in-depth so the
	// shortcut only ever fires for the one severity §10.3's default escalates — a policy overriding the default for
	// another severity does so through EscalationRule.trigger (§13), not this field. Empty escalationRules → skip.
	const escalationRules = policyState?.escalationRules ?? [];
	if (escalationRules.length > 0) {
		const openSev = openObservationSeverities();
		const matchable = (r: { escalateOnOpenSeverities?: readonly string[] }): string[] => [
			...new Set(
				(r.escalateOnOpenSeverities ?? []).filter(
					(s) => ESCALATABLE_SEVERITIES.has(s) && openSev.has(s)
				)
			)
		];
		const rule = escalationRules.find((r) => matchable(r).length > 0);
		if (rule) {
			const matched = matchable(rule);
			const target = String(rule.escalationTarget ?? 'the policy escalation target');
			return advanceStatus(ctx, command, {
				objectType: ASSESSMENT,
				statusField: 'assessmentState',
				machine: 'AssuranceAssessment.state',
				target: 'ESCALATED',
				precondition: fromStates('ASSESSING'),
				eventType: 'AssuranceAssessmentEscalated',
				setLifecycleStatus: true,
				eventPayload: () => ({
					escalationReason: `open observation(s) of severity [${matched.join(', ')}] → escalation to ${target} per policy escalationRules (§10.3/§13)`,
					disposition: 'ESCALATED'
				})
			});
		}
	}

	// GATE A (Increment R) — a POSITIVE disposition may not stand while its own mandatory evidence is unmet. §6.1's
	// requiredForDispositions declares which dispositions each requirement gates; a SATISFIED verdict that ignores
	// its required evidence certifies past its own gaps (§10.3). The received set is folded from the §32
	// AssuranceEvidenceReceived events (Increment Q) — the SAME required-minus-received the §38 view shows — so the
	// gate and the view agree. Negative dispositions (REJECTED / ESCALATED / INCONCLUSIVE) are deliberately NOT
	// gated: escalating or rejecting BECAUSE evidence is insufficient is the correct response, not a blocked one.
	if (disposition === 'SATISFIED' || disposition === 'CONDITIONALLY_SATISFIED') {
		const received = new Set(
			ctx.store
				.readAllEvents()
				.filter(
					(e) =>
						e.eventType === 'AssuranceEvidenceReceived' &&
						(e.payload as { assessmentId?: string }).assessmentId === command.targetAggregateId
				)
				.map((e) => (e.payload as { satisfiesRequirementId?: string }).satisfiesRequirementId)
				.filter((x): x is string => typeof x === 'string')
		);
		// requiredForDispositions: ALL gates every disposition; SATISFIED_ONLY only SATISFIED; CONDITIONAL_OR_SATISFIED
		// gates both positive dispositions (and we are already inside the positive branch).
		const gates = (rfd: string | undefined): boolean =>
			rfd === 'ALL' ||
			rfd === 'CONDITIONAL_OR_SATISFIED' ||
			(rfd === 'SATISFIED_ONLY' && disposition === 'SATISFIED');
		const unmet = (policyState?.requiredEvidence ?? [])
			.filter((r) => gates(r?.requiredForDispositions))
			.filter(demandsAnInstance)
			.map((r) => r?.id)
			.filter((id): id is string => typeof id === 'string' && !received.has(id));
		if (unmet.length > 0) {
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`CompleteAssuranceAssessment: a ${disposition} disposition requires evidence for [${unmet.join(', ')}] (§6.1 requiredForDispositions) but none was submitted for those requirements — a positive disposition cannot stand with unmet mandatory evidence (§10.3). Submit it (SubmitEvidenceForAssessment) first, or return a non-satisfied disposition.`,
				[command.targetAggregateId, ...unmet]
			);
		}
	}

	// GATE C (#1a) — dispositionRules ENFORCED: the §10.3 foreclosure. The policy's rule for the recommended
	// disposition may forbid it while an observation of certain severities is still OPEN ("an open MATERIAL finding
	// forecloses SATISFIED"). The matching rule's `forbiddenOpenSeverities` names them; the assessment's observation
	// OBJECTS carry the CURRENT disposition, so a finding that was resolved or WAIVED no longer forecloses (loaded
	// per-object, not read from the recording event, precisely so a later waiver is honored). Only fires when the
	// policy declares dispositionRules with forbiddenOpenSeverities for this disposition — otherwise skipped.
	const gateCReject = rejectForeclosedDisposition(
		command,
		disposition,
		policyState?.dispositionRules,
		openObservationSeverities
	);
	if (gateCReject) return gateCReject;

	return advanceStatus(ctx, command, {
		objectType: ASSESSMENT,
		statusField: 'assessmentState',
		machine: 'AssuranceAssessment.state',
		// The RANGE, taken from the ratified enum that already bounds it — `disposition` is refused above unless
		// it is one of `DISPOSITIONS`, which IS this schema's options. Naming the schema rather than retyping its
		// members keeps one source of truth: a disposition added to the contract becomes performable here and
		// visible to the C-0 arrow census in the same edit.
		targetStates: AssuranceDispositionRecommendationSchema.options,
		target: disposition,
		// The verdict's CONTENT (subject versions, validator identity, residual uncertainty) rides the EVENT, not the
		// object — so re-completing an already-terminal assessment appended a second, fully contradicting verdict: a
		// different validator, a different subject semanticVersion, even a different independence posture, with the
		// object still reading SATISFIED. A reader taking the latest event concludes a version was assured that was
		// never assessed. Every terminal disposition has exactly one in-arrow, from ASSESSING.
		precondition: fromStates('ASSESSING'),
		eventType: 'AssuranceAssessmentCompleted',
		setLifecycleStatus: true,
		// §19.3 AssuranceAssessmentCompletedPayload — was the raw CompleteAssuranceAssessment command payload,
		// i.e. `{ validatorResult }`: a single key §19.3 does not define, and NINE of its ten fields absent. The
		// verdict — what was judged, at which version, and how it came out — was never in the event; the audit log
		// recorded the validator's raw return and nothing about the assessment it completed. Delta: + assessmentId,
		// + assurancePolicyId, + policyVersion, + subjectObjectIds, + subjectSemanticVersions, + disposition,
		// + evidenceConsideredIds, + observationIds, + residualUncertainty, + recommendedControlActions;
		// - validatorResult (not a §19.3 field; a strictObject rejects it).
		//
		// Identity + policy come from the aggregate (`next`); subjects + versions from the validatorResult the
		// invariant-2 gate above just proved complete; disposition is the transition target.
		//
		// evidenceConsideredIds / residualUncertainty / recommendedControlActions are read from the validatorResult
		// and NOT from the object, which reports [] for all three: requestAssuranceAssessment hardcodes them empty
		// and no completion path ever writes them (the §32 commands that own those facts do not exist — see the
		// evaluator note above). So the object's [] is silence, not a finding of "none". The validator's values are
		// the real ones, they are on the validated command, and §19.3 asks the event for exactly them — emitting []
		// would put a known-false record in the audit log. The event therefore carries more than the object does;
		// reconciling the object is the §32 increment, not this one.
		//
		// WHO/WHAT VALIDATED (Increment 37). validatorId + validatorVersion are the §20 ValidatorResult's
		// "validator implementation identity" — WHICH validator, at WHICH version, produced this verdict. §38
		// REQUIRES the Assurance View to show it and §22 REQUIRES the audit log to record "validator/version" for
		// every validator call, yet §19.3's first-slice payload (§16 item 6) omitted it, so the completion event
		// recorded the outcome and erased the author of it. The value is REQUIRED on the §20 ValidatorResult the
		// command boundary already validated, so it is threaded through, never invented; the `?? ''` is an
		// unreachable TS guard (a rejected command never reaches here).
		//
		// INDEPENDENCE RESULT (Increment I4). `independenceResult: 'VERIFIED'` rides the completion when the check
		// above RAN and PASSED — the §22 "independence result" the audit log requires and the §38 view's "independence
		// status" source. It is a PROPERTY of this completion, not a state change (the violation IS a state change, so
		// it earns its own AssuranceIndependenceViolated event + INDEPENDENCE_VIOLATION state instead). Spread only
		// when set: an unverified completion omits it, and the view reads absence as "unknown", never a fabricated pass.
		eventPayload: (next) => ({
			assessmentId: command.targetAggregateId,
			assurancePolicyId: next.assurancePolicyId,
			policyVersion: next.policyVersion,
			subjectObjectIds: subjectIds,
			subjectSemanticVersions: versions,
			disposition,
			evidenceConsideredIds: p.validatorResult?.evidenceConsideredIds ?? [],
			observationIds: next.observationIds ?? [],
			residualUncertainty: p.validatorResult?.residualUncertainty ?? [],
			recommendedControlActions: p.validatorResult?.recommendedControlActions ?? [],
			validatorId: p.validatorResult?.validatorId ?? '',
			validatorVersion: p.validatorResult?.validatorVersion ?? '',
			...(independenceResult ? { independenceResult } : {})
		}),
		mutate: (base) => ({
			...base,
			completedAt: command.issuedAt,
			...(evaluator ? { evaluator } : {}),
			// producer: the INV-8 counterparty checkIndependence compared evaluator against. Contract-drift fix —
			// it was read to compute independenceResult then discarded; now recorded beside evaluator so a VERIFIED
			// completion names both operands of the independence determination, not just its outcome.
			...(producer ? { producer } : {})
		})
	});
};

// ---- Assurance Observation ----
const OBSERVATION = 'ASSURANCE_OBSERVATION';

/** RecordAssuranceObservation — create an observation in OPEN, linked to its assessment (inherits policy +
 * subjects from the assessment). */
export const recordAssuranceObservation: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordAssuranceObservationPayload;
	const id = command.targetAggregateId;
	const assessment = ctx.store.loadObject(p.assessmentId)?.state as
		{ assurancePolicyId?: string; subjectObjectIds?: string[] } | undefined;
	if (!assessment) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RecordAssuranceObservation requires an existing assessment ${p.assessmentId}`,
			[id]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, OBSERVATION, id, { lifecycleStatus: 'OPEN' }),
		assessmentId: p.assessmentId,
		policyId: assessment.assurancePolicyId ?? p.assessmentId,
		subjectObjectIds: assessment.subjectObjectIds ?? [],
		findingCode: p.findingCode ?? p.observationType,
		observationType: p.observationType,
		severity: p.severity,
		statement: p.statement,
		implication: p.statement,
		evidenceIds: p.evidenceIds ?? [],
		disposition: 'OPEN'
	};
	// §21.1 AssuranceObservationRecordedPayload — was the raw RecordAssuranceObservation command payload, which
	// defines neither the observation's id nor the policy/subjects it is against. Delta: + observationId (target
	// aggregate id), + policyId / + subjectObjectIds (inherited from the assessment, exactly as the state does),
	// + implication, + disposition ('OPEN'); findingCode and evidenceIds are optional on the command but REQUIRED
	// by §21.1, so both carry the state's resolved value (findingCode defaults to observationType, evidenceIds to
	// []); - observationType (on the command, undefined by §21.1 — a strictObject rejects it; DOC-002 §26.5 is the
	// variant that keeps it, and the object state does too).
	//
	// Every value is read off `state`, so the event reports the object as persisted. That includes `implication`,
	// which the object sets to a copy of `statement` — §21.1 wants the observation's consequence and no command
	// field carries one. That placeholder is pre-existing object state and out of scope here; the event inherits
	// it rather than inventing a second, differently-wrong value.
	return createObject(ctx, command, {
		objectType: OBSERVATION,
		aggregateId: id,
		state,
		eventType: 'AssuranceObservationRecorded',
		eventPayload: {
			observationId: id,
			assessmentId: p.assessmentId,
			policyId: state.policyId,
			subjectObjectIds: state.subjectObjectIds,
			findingCode: state.findingCode,
			severity: p.severity,
			statement: p.statement,
			implication: state.implication,
			evidenceIds: state.evidenceIds,
			disposition: 'OPEN'
		}
	});
};
