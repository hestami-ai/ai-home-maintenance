// Test fixtures for putting an execution plan's steps into a given arrangement of states.
//
// WHY THIS EXISTS (JAN-EXECREM WP-0 / SM-7). Across four suites, ~35 arrangements seed non-QUEUED step states by
// passing them THROUGH `ProposeExecutionPlan` — `activePlan(['SUCCEEDED', 'QUEUED'])` proposes a plan whose first
// step is *authored* already-SUCCEEDED. That works only because propose performs no step-set validation at all,
// which is itself one of the defects this program fixes: an authored `NOT_READY` step is a permanent deadlock
// (F-09/F-27) and a duplicate step id is unaddressable (F-10).
//
// So the test corpus DEPENDS ON THE ABSENCE OF THE RULE that WP-6 must add. Left alone, that dependence would
// present WP-6's implementer with a choice between weakening the rule and rewriting 35 arrangements under
// deadline — and weakening the rule to keep tests green is precisely the inversion that produced this defect
// family (DS-001 §4: "tests codified the holes as intent"). This seam removes the choice BEFORE the rule lands.
//
// WHAT IT DOES. Patches step states directly into the stored aggregate via `store.commit`, bypassing the command
// bus — the arrangement is SET UP here, not driven. That is legitimate for a fixture (the suites using it are
// testing the start-gate / completion / supersede rules, not how a step reached its state) and it is the only
// way to arrange states the bus cannot reach at all.
//
// WHAT IT REFUSES. `NOT_READY` and `READY` are rejected: no command drives a step INTO either (F-27), so a test
// arranging them is exercising a population the engine cannot produce. Without that refusal this seam would
// become the back door that reinstates the very defect WP-6 closes. The two loudly-named `_LEGACY_ONLY` escapes
// exist for the conformance sweep (WP-9), which must probe exactly that unreachable population to prove each
// `requireFrom` refuses it — and their names are the point: they cannot be reached for casually.
//
// Not in `kit.ts`: that is production. `__tests__/` is excluded from tsconfig.build and does not match vitest's
// `*.test.ts` include, so nothing here ships or runs as a suite (precedent: `floor-fixtures.ts`, same directory).
import { ExecutionPlanSchema, type StepState, StepStateSchema } from '@janumipwb/rph-contracts';
import type { StorageAdapter } from '@janumipwb/rph-ports';

/** States no command can drive a step INTO, so they cannot be arranged through the bus (F-27). */
const UNREACHABLE_BY_COMMAND: readonly StepState[] = ['NOT_READY', 'READY'];

let seq = 0;

interface SeedOptions {
	/** Permit the two command-unreachable states. WP-9's arrow ledger is the only sanctioned caller. */
	readonly allowUnreachable?: boolean;
}

/**
 * Put `planId`'s steps into `states` (by position), committing one revision with no events.
 *
 * The patched state is re-parsed against `ExecutionPlanSchema` before it is written, because `store.commit`
 * bypasses the handler kit's `validateAgainst` — a fixture that can write a shape the contract forbids would
 * let a suite rehearse against an impossible aggregate, which is how `floor-fixtures.ts`'s own defect arose.
 */
export function seedStepStates(
	store: StorageAdapter,
	planId: string,
	states: readonly string[],
	options: SeedOptions = {}
): void {
	const stored = store.loadObject(planId);
	if (!stored) throw new Error(`seedStepStates: no stored object for plan ${planId}`);

	const plan = ExecutionPlanSchema.parse(stored.state);
	const steps = plan.steps ?? [];
	if (states.length !== steps.length) {
		throw new Error(
			`seedStepStates: plan ${planId} has ${steps.length} step(s) but ${states.length} state(s) were supplied — ` +
				`the arrangement must be positional and total, so a silently-ignored extra state cannot hide a fixture bug.`
		);
	}

	const parsed = states.map((raw, i) => {
		const state = StepStateSchema.safeParse(raw);
		if (!state.success)
			throw new Error(`seedStepStates: '${raw}' (step ${i + 1}) is not a ratified StepState`);
		if (!options.allowUnreachable && UNREACHABLE_BY_COMMAND.includes(state.data))
			throw new Error(
				`seedStepStates: '${state.data}' is not reachable by any command, so arranging it here would test a ` +
					`population the engine cannot produce. If you are proving a guard REFUSES it (WP-9's arrow ledger), ` +
					`call seedBelowQueuedStepState_LEGACY_ONLY and say so at the call site.`
			);
		return state.data;
	});

	const nextState = ExecutionPlanSchema.parse({
		...plan,
		steps: steps.map((s, i) => ({ ...s, stepState: parsed[i] }))
	});

	seq += 1;
	const result = store.commit({
		aggregateType: 'EXECUTION_PLAN',
		aggregateId: planId,
		objectType: 'EXECUTION_PLAN',
		expectedRevision: stored.revision,
		newRevision: stored.revision + 1,
		newSemanticVersion: stored.semanticVersion,
		currentState: nextState,
		events: [],
		receipt: {
			commandId: `fixture-seedStepStates-${seq}`,
			idempotencyKey: `fixture-seedStepStates-${seq}`,
			commandType: 'FixtureSeedStepStates',
			targetAggregateId: planId,
			status: 'ACCEPTED',
			producedEventIds: []
		}
	});
	if (!result.ok)
		throw new Error(
			`seedStepStates: commit refused for ${planId} (${result.reason}, actual revision ${String(result.actualRevision)})`
		);
}

/**
 * The sanctioned escape for arranging `NOT_READY`/`READY` — the states no command produces.
 *
 * ONLY for proving that a guard REFUSES that population (WP-9's machine-arrow ledger). It is deliberately
 * verbose: if this name appears in a suite that is not a refusal proof, that is the finding.
 */
export function seedBelowQueuedStepState_LEGACY_ONLY(
	store: StorageAdapter,
	planId: string,
	states: readonly string[]
): void {
	seedStepStates(store, planId, states, { allowUnreachable: true });
}

/**
 * Arrange a plan with ZERO steps.
 *
 * WP-6 refuses a step-less proposal (SM-4 rule L1), but `execution-plan-completion.test.ts` legitimately proves
 * what plan completion does with an empty step set — a population that will exist only in stored history once
 * propose forbids minting new ones. Named `_LEGACY_ONLY` for the same reason as above.
 */
export function seedEmptyStepArray_LEGACY_ONLY(store: StorageAdapter, planId: string): void {
	const stored = store.loadObject(planId);
	if (!stored) throw new Error(`seedEmptyStepArray_LEGACY_ONLY: no stored object for plan ${planId}`);
	const plan = ExecutionPlanSchema.parse(stored.state);
	const nextState = ExecutionPlanSchema.parse({ ...plan, steps: [] });

	seq += 1;
	const result = store.commit({
		aggregateType: 'EXECUTION_PLAN',
		aggregateId: planId,
		objectType: 'EXECUTION_PLAN',
		expectedRevision: stored.revision,
		newRevision: stored.revision + 1,
		newSemanticVersion: stored.semanticVersion,
		currentState: nextState,
		events: [],
		receipt: {
			commandId: `fixture-seedEmptySteps-${seq}`,
			idempotencyKey: `fixture-seedEmptySteps-${seq}`,
			commandType: 'FixtureSeedEmptySteps',
			targetAggregateId: planId,
			status: 'ACCEPTED',
			producedEventIds: []
		}
	});
	if (!result.ok)
		throw new Error(`seedEmptyStepArray_LEGACY_ONLY: commit refused for ${planId} (${result.reason})`);
}
