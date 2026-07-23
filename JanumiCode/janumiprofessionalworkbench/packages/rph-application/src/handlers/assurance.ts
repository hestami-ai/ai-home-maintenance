// Assurance-side handlers: Evidence (propose/admit/invalidate), Claim (assert), Assumption (detect), Assurance
// Assessment (request/complete), Assurance Observation (record). The exec≠assurance separation (INV-5) is upheld
// structurally — nothing here is driven by executionState; a satisfied assessment is a separate, explicit act
// whose disposition comes from the validator recommendation and is gated by the AssuranceAssessment.state machine
// (which makes VALIDATOR_FAILED→REJECTED and INDEPENDENCE_VIOLATION→SATISFIED illegal). Evidence admissibility
// (§8.11) is enforced at AdmitEvidence by @janumipwb/rph-assurance's evidenceAdmissibility — the kernel rule,
// called, not a copy of it. Validator-independence scoring still lives there uncalled; that is the next increment.
import {
	checkIndependence,
	evidenceAdmissibility,
	FLOOR_POLICY_IDS,
	type Identity,
	type IndependenceRequirement
} from '@janumipwb/rph-assurance';
import type {
	ActorReference,
	AdmitEvidencePayload,
	AssertClaimPayload,
	CommandResult,
	CreateAssurancePolicyPayload,
	DetectAssumptionPayload,
	DomainCommand,
	ExpireAssumptionPayload,
	EditAssurancePolicyPayload,
	ProposeEvidencePayload,
	RecordAssuranceObservationPayload,
	RequestAssuranceAssessmentPayload,
	SubmitEvidenceForAssessmentPayload,
	SupersedeAssurancePolicyPayload
} from '@janumipwb/rph-contracts';
import {
	advanceStatus,
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler
} from './kit.js';
import { fromStates } from './command-precondition.js';

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
		applicability: {},
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
	'permittedControlActions'
] as const satisfies readonly (keyof EditAssurancePolicyPayload)[];

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
	return next;
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
 *  it. The successor id (if given) is recorded as a `superseded-by:<id>` tag. Floor policies reject. */
export const supersedeAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as SupersedeAssurancePolicyPayload;
	return advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUPERSEDED',
		eventType: 'AssurancePolicySuperseded',
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

/** SuspendAssurancePolicy — temporarily disable a policy (ACTIVE -> SUSPENDED). Floor policies reject. */
export const suspendAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUSPENDED',
		eventType: 'AssurancePolicySuspended',
		guard: rejectIfFloorLocked(command)
	});

/** ActivateAssurancePolicy — put a policy into force (DRAFT|SUSPENDED -> ACTIVE). */
export const activateAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'ACTIVE',
		eventType: 'AssurancePolicyActivated',
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
				id: String((state.id ?? '') as string | number | boolean),
				provenance: state.provenance,
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

/** InvalidateEvidence — ADMISSIBLE -> INVALIDATED (P4: dependent claims are re-contested by the controller). */
export const invalidateEvidence: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'INVALIDATED',
		eventType: 'EvidenceInvalidated'
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
export const expireAssumption: CommandHandler = (ctx, command, payload) => {
	const p = payload as ExpireAssumptionPayload;
	return advanceStatus(ctx, command, {
		objectType: ASSUMPTION,
		statusField: 'status',
		machine: 'Assumption.status',
		target: 'EXPIRED',
		eventType: 'AssumptionExpired',
		eventPayload: () => ({
			status: 'EXPIRED',
			...(p.expirationCondition ? { expirationCondition: p.expirationCondition } : {})
		})
	});
};

// ---- Assurance Assessment ----
const ASSESSMENT = 'ASSURANCE_ASSESSMENT';
const DISPOSITIONS = new Set([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED'
]);

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
		{ status?: string; requiredEvidence?: Array<{ id?: string }> } | undefined;
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
	// the fold's source). Empty when the policy requires no evidence = a real sourced "none", not "unknown". The
	// per-requirement SATISFACTION side (§32 submitEvidenceForAssessment -> AssuranceEvidenceReceived) is a separate
	// increment; until it lands, the read model reports the full required set as missing (DOC-004 §31 L1770).
	const requiredEvidenceIds = (policy.requiredEvidence ?? [])
		.map((r) => r?.id)
		.filter((id): id is string => typeof id === 'string');
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSESSMENT, p.assessmentId, {
			lifecycleStatus: 'ASSESSING',
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
		startedAt: command.issuedAt,
		assessmentState: 'ASSESSING',
		residualUncertainty: [],
		recommendedControlActions: []
	};
	return createObject(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: p.assessmentId,
		state,
		eventType: 'AssuranceAssessmentStarted',
		eventPayload: { ...p, requiredEvidenceIds }
	});
};

/** SubmitEvidenceForAssessment (DOC-004 §32) — the SATISFACTION side of "missing evidence". Records that an
 *  Evidence object satisfying one of the assessment's declared EvidenceRequirements (§6.1) was received, emitting
 *  AssuranceEvidenceReceived (§31). The §38 view folds `missingEvidence = requiredEvidenceIds` (from the Started
 *  event, Increment K) MINUS the requirement ids received here — so it flips from "the whole required set" to a
 *  faithful required-minus-received. Ratified NAMES, AUTHORED schema (§31 L1770: "ratified names here but
 *  schematized nowhere ... a schema-and-wiring task, NOT a ratification decision"). The received fact lives on the
 *  EVENT, not the assessment snapshot — symmetric with requiredEvidenceIds living on AssuranceAssessmentStarted,
 *  and the read model is the fold's consumer. */
export const submitEvidenceForAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as SubmitEvidenceForAssessmentPayload;
	const id = command.targetAggregateId; // the assessment aggregate
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	// Evidence may only be submitted while the assessment is OPEN. requestAssuranceAssessment creates it in
	// ASSESSING and completeAssuranceAssessment moves it to a terminal disposition; recording evidence against a
	// completed assessment would silently shrink its "missing" set after the verdict was already reached.
	const assessmentState = loaded.state.assessmentState;
	if (assessmentState !== 'ASSESSING') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SubmitEvidenceForAssessment: assessment ${id} is ${String(assessmentState)}, not ASSESSING — evidence may only be submitted while the assessment is open.`,
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
	const newRevision = loaded.revision + 1;
	// The assessment SNAPSHOT is unchanged beyond the envelope bump — the received-evidence fact lives on the EVENT.
	const next = nextEnvelope(loaded.state, command, newRevision);
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
	// in this codebase (nor do §32's `recordCriterionResult`, `submitEvidenceForAssessment`, or
	// `beginAssuranceAssessment` — 4 of §32's 13). Their absence is exactly why the evaluator was smuggled
	// through the verdict and why criterion results and evidence are dropped at the boundary: the commands that
	// own those facts were never built. Surfaced in HARMONIZATION-LOG PART 4, not fixed here.
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
