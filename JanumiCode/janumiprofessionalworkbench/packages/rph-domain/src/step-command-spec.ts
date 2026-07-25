// The DECLARED contract of every ExecutionStep command (JAN-EXECREM WP-8 / SM-2). Pure data; no behaviour.
//
// WHY THIS EXISTS. `advanceStep` had exactly three extension points — `precheck`, `requireFrom`, `eventType`/
// `target` — all OPTIONAL, all supplied per call site, and declared NOWHERE a reader or a test could enumerate.
// Nothing in the system could answer "which rules does StartExecutionStep enforce, and which does
// CompleteExecutionStep not?" without reading nine docblocks and trusting them. That is the shape behind a whole
// family of findings: four `requireFrom` sets with no kill test (F-11/12/13/14/18/19), a plan-ACTIVE precheck
// present on five commands and absent on four with no statement of which absence was intended (F-26), and eight
// of twenty machine arrows with no test at all (F-40). An omission is invisible in a list that does not exist.
//
// So the contract becomes DATA. `Readonly<Record<StepCommandType, StepCommandSpec>>` makes the table TOTAL: adding
// a tenth step command without declaring its row is a compile error, not a discovery. WP-9's kill-test battery and
// WP-16's conformance gates both ITERATE this table rather than restating it, so a site with no kill test fails the
// build instead of waiting for the next adversarial review.
//
// SITED IN rph-domain deliberately: rph-projections may depend on rph-domain (its affordance projection consumes
// this table), and rph-domain may not depend on rph-application. Putting it beside the handlers would have made the
// read-model unable to derive affordances from the same declaration the authority enforces — the exact
// read-model/authority divergence the F-11 discipline exists to prevent.
import type { StepState } from '@janumipwb/rph-contracts';

/** The nine commands that advance an ExecutionStep.stepState. */
export type StepCommandType =
	| 'StartExecutionStep'
	| 'CompleteExecutionStep'
	| 'FailExecutionStep'
	| 'RetryExecutionStep'
	| 'SkipExecutionStep'
	| 'CancelExecutionStep'
	| 'PruneExecutionStep'
	| 'EnterExecutionStepWait'
	| 'ResolveExecutionStepWait';

export interface StepCommandSpec {
	readonly commandType: StepCommandType;
	/** The stepState this command drives the step TO. */
	readonly target: StepState;
	/**
	 * The states this command may be issued FROM — its `drivesFrom`.
	 *
	 * The machine alone is NOT sufficient: it classifies `from === to` as a NOOP (so a re-issue was absorbed while
	 * STILL emitting an event), and it legalises every arrow into the target from ANY source (so Start on a WAITING
	 * step performed a silent RESUME). This set is the per-command narrowing the machine cannot express.
	 */
	readonly sourceStates: readonly StepState[];
	/** The event emitted on success. */
	readonly eventType: string;
	/**
	 * Does this command require an ACTIVE plan (RPH-EXE-002: a superseded/terminal plan opens no new work)?
	 *
	 * Declared per command BECAUSE the answer legitimately differs, and the differences were previously invisible.
	 * `false` here is a positive statement that the omission is intended, not an oversight — see each row.
	 */
	readonly requiresActivePlan: boolean;
	/** Why `requiresActivePlan` is what it is. Prose, so the intent survives the next reader. */
	readonly activePlanRationale: string;
}

const spec = (s: StepCommandSpec): StepCommandSpec => s;

/**
 * The table. TOTAL over `StepCommandType` — a new step command cannot be added without declaring its contract.
 *
 * NOTE ON `requiresActivePlan`: this field DESCRIBES the shipped prechecks rather than enforcing them; WP-12 makes
 * it the enforcement point after settling which of the four omissions are correct (F-26). Declaring it now is what
 * lets WP-12 argue about a table instead of about nine docblocks.
 */
export const STEP_COMMAND_SPECS: Readonly<Record<StepCommandType, StepCommandSpec>> = {
	StartExecutionStep: spec({
		commandType: 'StartExecutionStep',
		target: 'RUNNING',
		sourceStates: ['QUEUED'],
		eventType: 'ExecutionStepStarted',
		requiresActivePlan: true,
		activePlanRationale: 'starting is new work; a superseded plan opens none (RPH-EXE-002).'
	}),
	CompleteExecutionStep: spec({
		commandType: 'CompleteExecutionStep',
		target: 'SUCCEEDED',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepSucceeded',
		requiresActivePlan: false,
		activePlanRationale:
			'UNSETTLED (F-26): completing work already RUNNING is arguably closing out, not opening new work — but the omission carries no written rationale and no positive test. WP-12 decides.'
	}),
	FailExecutionStep: spec({
		commandType: 'FailExecutionStep',
		target: 'FAILED',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepFailed',
		requiresActivePlan: false,
		activePlanRationale:
			'UNSETTLED (F-26): recording that running work failed is closing out, not opening new work. Same standing as Complete; WP-12 decides both together.'
	}),
	RetryExecutionStep: spec({
		commandType: 'RetryExecutionStep',
		target: 'QUEUED',
		sourceStates: ['FAILED'],
		eventType: 'ExecutionStepRetried',
		requiresActivePlan: true,
		activePlanRationale:
			'a retry RE-OPENS the attempt cycle, so it is new work even though the step already exists (RPH-EXE-002).'
	}),
	SkipExecutionStep: spec({
		commandType: 'SkipExecutionStep',
		target: 'SKIPPED',
		sourceStates: ['READY', 'QUEUED'],
		eventType: 'ExecutionStepSkipped',
		requiresActivePlan: true,
		activePlanRationale: 'a skip disposes of work the plan still owns; a superseded plan owns none.'
	}),
	CancelExecutionStep: spec({
		commandType: 'CancelExecutionStep',
		target: 'CANCELLED',
		sourceStates: ['READY', 'QUEUED', 'RUNNING', 'WAITING', 'FAILED'],
		eventType: 'ExecutionStepCancelled',
		requiresActivePlan: false,
		activePlanRationale:
			'INTENTIONAL: cancel is CLEANUP. It must remain available on a plan that has already been superseded or has failed, or live/failed work would be stranded with no exit. FAILED is in the source set since WP-5 (abandoning an arm nobody will retry).'
	}),
	PruneExecutionStep: spec({
		commandType: 'PruneExecutionStep',
		target: 'SKIPPED',
		sourceStates: ['NOT_READY', 'READY', 'QUEUED'],
		eventType: 'ExecutionStepPruned',
		requiresActivePlan: true,
		activePlanRationale:
			'a prune is within-execution branch resolution, which only an ACTIVE plan performs. NOT_READY is in the set so a not-taken arm that never became ready is still clearable (D5 anti-deadlock).'
	}),
	EnterExecutionStepWait: spec({
		commandType: 'EnterExecutionStepWait',
		target: 'WAITING',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepWaiting',
		requiresActivePlan: false,
		activePlanRationale:
			'INTENTIONAL: waiting SUSPENDS work that is already running; it opens nothing. Recorded with a positive test.'
	}),
	ResolveExecutionStepWait: spec({
		commandType: 'ResolveExecutionStepWait',
		target: 'RUNNING',
		sourceStates: ['WAITING'],
		eventType: 'ExecutionStepWaitResolved',
		requiresActivePlan: true,
		activePlanRationale:
			'resuming returns a step to RUNNING, which IS new work on the plan; the WAITING source set is also what keeps Start from performing a silent resume.'
	})
};

/** Every declared step command, for a caller that needs to sweep them all (WP-9, WP-16). */
export const STEP_COMMAND_TYPES = Object.keys(STEP_COMMAND_SPECS) as readonly StepCommandType[];

/** The spec for one command. Total, so this cannot return undefined for a declared type. */
export function stepCommandSpec(commandType: StepCommandType): StepCommandSpec {
	return STEP_COMMAND_SPECS[commandType];
}
