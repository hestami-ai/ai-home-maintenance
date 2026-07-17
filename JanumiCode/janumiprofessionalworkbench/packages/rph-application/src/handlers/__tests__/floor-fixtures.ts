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
import type { AssuranceDispositionRecommendation, DomainCommand } from '@janumipwb/rph-contracts';
import { FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';

/** Just enough of the Engine for the seed helpers to drive the bus. */
interface DispatchLike {
	dispatch(command: DomainCommand): { readonly status: string; readonly error?: unknown };
}

const SEED_ACTOR = { actorId: 'seed-1', actorType: 'HUMAN' as const, displayName: 'Policy Seeder' };
const SEED_TS = '2026-07-12T00:00:00Z';

function createPolicyCommand(
	policyId: string,
	payload: Record<string, unknown>,
	now: string
): DomainCommand {
	return {
		commandId: `seedpol-${policyId}`,
		commandType: 'CreateAssurancePolicy',
		commandSchemaVersion: 1,
		targetAggregateType: 'ASSURANCE_POLICY',
		targetAggregateId: policyId,
		issuedAt: now,
		issuedBy: SEED_ACTOR,
		correlationId: 'seed',
		idempotencyKey: `seedpol-${policyId}`,
		payload
	};
}

/**
 * Seed the three de minimis floor policies as ASSURANCE_POLICY objects, from the canonical
 * `FLOOR_POLICY_DEFINITIONS` (the same source `seed-workbench.ts::seedFloorPolicies` uses). Any test that records a
 * floor assessment must call this first: `requestAssuranceAssessment` now fails closed when the cited policy does
 * not exist (independence follow-up B), and a floor assessment citing an unseeded `floor.*` policy is exactly that.
 */
export function seedFloorPolicies(engine: DispatchLike, now: string = SEED_TS): void {
	for (const def of FLOOR_POLICY_DEFINITIONS) {
		const r = engine.dispatch(
			createPolicyCommand(
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
			)
		);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`seedFloorPolicies: ${def.policyId} -> ${JSON.stringify(r.error)}`);
		}
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
	opts: { independenceRequirement?: string; now?: string } = {}
): void {
	const r = engine.dispatch(
		createPolicyCommand(
			policyId,
			{
				policyId,
				version: '1.0.0',
				name: `Policy ${policyId}`,
				purpose: 'Assess the subject against its approved need.',
				rationale: 'Seeded for a live command-drive test.',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
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
		)
	);
	if (r.status !== 'ACCEPTED') {
		throw new Error(`seedPolicy: ${policyId} -> ${JSON.stringify(r.error)}`);
	}
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
