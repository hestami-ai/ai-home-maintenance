// Test fixtures for recording a floor assessment through the live command bus.
//
// WHY THIS EXISTS. Eight call sites across seven test files each completed an assessment with
// `{ validatorResult: { dispositionRecommendation: 'SATISFIED' } }` — a ONE-FIELD verdict that could never
// exist on the wire. They were not sloppy; `ValidatorResultSchema` was `z.record(z.string(), z.unknown())` —
// any object — so a one-field fake was indistinguishable from a real verdict, and the production recorder was
// doing the same thing (two fields, one of them not in the contract). Every test in the system was rehearsing
// against a shape the ratified contract does not have, and passing.
//
// DOC-007 §20 is now enforced, so a verdict has to BE a verdict. This builder produces the smallest honest one:
// every one of §20's sixteen fields, bound to the subject AND its semantic version (DOC-004 invariant 2 —
// "Every assessment identifies its subject semantic version").
//
// Not in `kit.ts`: that is production. `__tests__/` is excluded from tsconfig.build and does not match vitest's
// `*.test.ts` include, so this compiles with the tests and ships nowhere.
import type {
	ActorReference,
	AssuranceDispositionRecommendation,
	DomainCommand
} from '@janumipwb/rph-contracts';
import { FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';

/** Just enough of the Engine for the seed helpers to drive the bus. */
interface DispatchLike {
	dispatch(command: DomainCommand): { readonly status: string; readonly error?: unknown };
}

const SEED_ACTOR = { actorId: 'seed-1', actorType: 'HUMAN' as const, displayName: 'Policy Seeder' };
const SEED_TS = '2026-07-12T00:00:00Z';

function policyCommand(
	commandType: string,
	policyId: string,
	payload: Record<string, unknown>,
	now: string,
	tag: string
): DomainCommand {
	return {
		commandId: `${tag}-${policyId}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: 'ASSURANCE_POLICY',
		targetAggregateId: policyId,
		issuedAt: now,
		issuedBy: SEED_ACTOR,
		correlationId: 'seed',
		idempotencyKey: `${tag}-${policyId}`,
		payload
	};
}

function createOnly(
	engine: DispatchLike,
	policyId: string,
	createPayload: Record<string, unknown>,
	now: string
): void {
	const created = engine.dispatch(
		policyCommand('CreateAssurancePolicy', policyId, createPayload, now, 'seedpol')
	);
	if (created.status !== 'ACCEPTED') {
		throw new Error(`seed policy create: ${policyId} -> ${JSON.stringify(created.error)}`);
	}
}

/** Create + ACTIVATE a REGULAR policy: createAssurancePolicy produces the ratified DRAFT initial state for
 *  non-floor policies (DOC-002 §18), so a regular policy must be activated before an assessment may cite it. Floor
 *  policies are born ACTIVE and locked (Activate rejects on them) — use createOnly for those. */
function createAndActivate(
	engine: DispatchLike,
	policyId: string,
	createPayload: Record<string, unknown>,
	now: string
): void {
	createOnly(engine, policyId, createPayload, now);
	const activated = engine.dispatch(
		policyCommand('ActivateAssurancePolicy', policyId, { policyId }, now, 'seedact')
	);
	if (activated.status !== 'ACCEPTED') {
		throw new Error(`seed policy activate: ${policyId} -> ${JSON.stringify(activated.error)}`);
	}
}

/**
 * Seed the three de minimis floor policies as ASSURANCE_POLICY objects, from the canonical
 * `FLOOR_POLICY_DEFINITIONS` (the same source `seed-workbench.ts::seedFloorPolicies` uses). Any test that records a
 * floor assessment must call this first: `requestAssuranceAssessment` now fails closed when the cited policy does
 * not exist (independence follow-up B), and a floor assessment citing an unseeded `floor.*` policy is exactly that.
 */
export function seedFloorPolicies(engine: DispatchLike, now: string = SEED_TS): void {
	for (const def of FLOOR_POLICY_DEFINITIONS) {
		createOnly(
			engine,
			def.policyId,
			{
				policyId: def.policyId,
				version: '1.0.0',
				name: def.name,
				purpose: def.purpose,
				rationale: def.rationale,
				applicableObjectTypes: [
					'PROFESSIONAL_WORK_ARCHITECTURE',
					'PROFESSIONAL_WORK_UNIT',
					'ARTIFACT'
				],
				evaluatedClaimTypes: def.evaluatedClaimTypes,
				criteria: def.criteria,
				evaluatorRole: def.evaluatorRole,
				independenceRequirement: def.independence,
				findingDefinitions: def.findingDefinitions,
				permittedControlActions: def.permittedControlActions
			},
			now
		);
	}
}

/**
 * Seed a minimal, schema-valid ASSURANCE_POLICY for tests that cite a named policy (e.g. `pol_arch`). Independence
 * requirement defaults to NONE; pass one to exercise the gate. Same reason as `seedFloorPolicies`: an assessment
 * against a policy the store has never seen is now rejected.
 */
export function seedPolicy(
	engine: DispatchLike,
	policyId: string,
	opts: {
		independenceRequirement?: string;
		now?: string;
		requiredEvidence?: unknown[];
		/** DOC-004 §5.1 scope. Absent = the wholesale default below, which applies to every PWU kind. */
		applicability?: unknown;
		/** §10.3 foreclosure rules. Absent = the policy forecloses no disposition, so Gate C skips entirely — which
		 *  is why a test that forgets these gets a PASS from a gate that never ran. */
		dispositionRules?: unknown[];
	} = {}
): void {
	createAndActivate(
		engine,
		policyId,
		{
			policyId,
			version: '1.0.0',
			name: `Policy ${policyId}`,
			purpose: 'Assess the subject against its approved need.',
			rationale: 'Seeded for a live command-drive test.',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			...(opts.applicability ? { applicability: opts.applicability } : {}),
			...(opts.dispositionRules ? { dispositionRules: opts.dispositionRules } : {}),
			evaluatedClaimTypes: ['FITNESS'],
			criteria: [
				{
					id: 'C1',
					name: 'Fit',
					description: 'The subject is fit for its approved need.',
					criterionType: 'QUALITATIVE',
					evaluationMethod: 'HUMAN_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				}
			],
			evaluatorRole: 'REVIEWER',
			// Omitted → absent, not []: a policy that declares no required evidence and one that declares an empty
			// list are the same to the engine, but the ABSENT form is what every real seeded policy carries, so a
			// fixture that always sent [] would be testing a shape production never produces.
			...(opts.requiredEvidence ? { requiredEvidence: opts.requiredEvidence } : {}),
			independenceRequirement: opts.independenceRequirement ?? 'NONE',
			findingDefinitions: [
				{
					code: 'UNFIT',
					name: 'Unfit',
					description: 'Not fit for the approved need.',
					defaultSeverity: 'MATERIAL',
					affectedClaimTypes: ['FITNESS'],
					defaultControlActions: ['CONTINUE']
				}
			],
			permittedControlActions: ['CONTINUE']
		},
		opts.now ?? SEED_TS
	);
}

export interface FloorObservationFixture {
	readonly findingCode: string;
	readonly severity: string;
	readonly statement: string;
}

export interface FloorValidatorResultArgs {
	readonly assessmentId: string;
	readonly policyId: string;
	readonly subjectId: string;
	/** The subject's semantic version AT THE TIME OF JUDGEMENT. A verdict that does not name it cannot be
	 *  checked for staleness — the whole point of the version-bound floor. */
	readonly subjectSemanticVersion: number;
	readonly disposition: AssuranceDispositionRecommendation;
	readonly observations?: readonly FloorObservationFixture[];
	readonly policyVersion?: string;
	readonly validatorId?: string;
}

/** One OPEN finding to record against the assessment before completing it. `findingCode` must be the CRITERION a
 *  waiver would have to name — `openFindingCodes` in floor-gate.ts reads exactly this field. */
export interface FloorOpenFinding {
	readonly observationId: string;
	readonly findingCode: string;
	readonly severity?: string;
	readonly statement?: string;
}

export interface RecordFloorArgs {
	readonly assessmentId: string;
	readonly policyId: string;
	readonly subjectId: string;
	/** The subject's CURRENT semanticVersion. Read it from the store — do NOT default it to 1. See the header. */
	readonly subjectSemanticVersion: number;
	readonly disposition: AssuranceDispositionRecommendation;
	/** OPEN observations to record BEFORE completion. Without at least one, `waiverDischargesFloorPolicy` returns
	 *  false at its "nothing to waive" branch and the waiver-scope comparison is never reached. */
	readonly openFindings?: readonly FloorOpenFinding[];
	readonly now?: string;
	readonly actor?: ActorReference;
}

/**
 * Record ONE floor assessment over `subjectId` through the live bus, ASSERTING every step — request, each OPEN
 * observation, completion.
 *
 * WHY THIS EXISTS, AND WHY IT THROWS. `floor-waiver-scope.test.ts` hand-rolled this sequence with a helper that
 * asserted NOTHING and defaulted the subject version to the literal 1. Every `RequestAssuranceAssessment` in that
 * file was REFUSED — the floor policies were never seeded, and the request fails closed on a policy the store has
 * never seen — so no assessment aggregate was ever created and no floor was ever recorded. Both of its tests still
 * passed, because a PWA with no floor is refused publication for MISSING, which is also `REJECTED` with
 * `RPH_INVARIANT_VIOLATION`: the assertions were true, about a different refusal. Proven by instrumentation, three
 * separate shields deep — see the file's header.
 *
 * So this helper's contract is that a fixture may not silently arrange nothing. Every dispatch is checked, and the
 * caller must state the version rather than inherit a default that is wrong the moment a PWU-Type is defined.
 */
export function recordFloorAssessment(engine: DispatchLike, args: RecordFloorArgs): void {
	const now = args.now ?? SEED_TS;
	const actor = args.actor ?? SEED_ACTOR;
	let n = 0;
	const send = (
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: Record<string, unknown>
	): void => {
		const tag = `floorasmt-${args.assessmentId}-${++n}`;
		const r = engine.dispatch({
			commandId: tag,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggregateType,
			targetAggregateId: aggregateId,
			issuedAt: now,
			issuedBy: actor,
			correlationId: 'floor-fixture',
			idempotencyKey: tag,
			payload
		} as DomainCommand);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`${commandType} (${aggregateId}): ${JSON.stringify(r.error)}`);
		}
	};

	send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {
		assessmentId: args.assessmentId,
		assurancePolicyId: args.policyId,
		policyVersion: '1.0.0',
		subjectObjectIds: [args.subjectId],
		subjectSemanticVersions: { [args.subjectId]: args.subjectSemanticVersion },
		claimIds: []
	});
	// THE READY -> ASSESSING ARROW (REG-F-021 increment 3). requestAssuranceAssessment now crosses
	// REQUESTED -> EVIDENCE_PENDING and lands in READY (no policy declares required evidence — REG-F-022 — so
	// "all required evidence present" is vacuously true). The assessment must be BEGUN before it is assessed.
	send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {});
	for (const f of args.openFindings ?? []) {
		send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', f.observationId, {
			assessmentId: args.assessmentId,
			observationType: 'FINDING',
			findingCode: f.findingCode,
			severity: f.severity ?? 'MATERIAL',
			statement: f.statement ?? `Criterion ${f.findingCode} was not met.`
		});
	}
	send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {
		validatorResult: floorValidatorResult({
			assessmentId: args.assessmentId,
			policyId: args.policyId,
			subjectId: args.subjectId,
			subjectSemanticVersion: args.subjectSemanticVersion,
			disposition: args.disposition,
			observations: (args.openFindings ?? []).map((f) => ({
				findingCode: f.findingCode,
				severity: f.severity ?? 'MATERIAL',
				statement: f.statement ?? `Criterion ${f.findingCode} was not met.`
			}))
		})
	});
}

/** A schema-valid DOC-007 §20 ValidatorResult for a floor policy's verdict over `subjectId` at a given version. */
export function floorValidatorResult(args: FloorValidatorResultArgs): Record<string, unknown> {
	return {
		validatorId: args.validatorId ?? `deterministic.${args.policyId.replace(/^floor\./, '')}`,
		validatorVersion: '1',
		policyId: args.policyId,
		policyVersion: args.policyVersion ?? '1.0.0',
		assessmentId: args.assessmentId,
		subjectObjectIds: [args.subjectId],
		subjectSemanticVersions: { [args.subjectId]: args.subjectSemanticVersion },
		// Empty for the same reason the production recorder leaves it empty: §20 routes per-criterion results
		// only through `claimResults`, and a floor assessment carries `claimIds: []`. See record-assurance.ts.
		claimResults: [],
		evidenceConsideredIds: [],
		evidenceRejected: [],
		observations: (args.observations ?? []).map((o) => ({
			findingCode: o.findingCode,
			severity: o.severity,
			statement: o.statement,
			subjectObjectIds: [args.subjectId]
		})),
		dispositionRecommendation: args.disposition,
		recommendedControlActions: [],
		residualUncertainty: [],
		limitations: [],
		executionProvenance: {}
	};
}
