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
import type { AssuranceDispositionRecommendation } from '@janumipwb/rph-contracts';

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
