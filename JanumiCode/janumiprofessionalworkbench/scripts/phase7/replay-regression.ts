// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-D-111` (5); `REG-F-530`) — THE REPLAY REGRESSION'S
// VERDICT: what a replay of a recorded run must show, as a list of problems — empty when it shows all of it.
//
//   1. THE RECORDED MATRIX — every cell the recording expects, by stage and row, with its value, and no cell it does not
//      expect. The observed matrix is the run report's own (`buildRunReport`), computed over what the replay's stores
//      hold (`observedMatrix`), so "the matrix" means one thing for the paid run and its replay.
//   2. NO EXCHANGE GRADED `PROVIDER_REPORTED` — no provider reported a replayed call (`REG-F-530`, "Identity"). A
//      replay whose record said one did would be a record of calls that did not happen.
//   3. NO PROGRAM SPAWNED — commands are replayed, never re-run; the regression runs with PATH emptied as well.
//   4. THE WHOLE RECORDING SERVED, AND NOTHING REFUSED — every recorded executor try, command and reviewer call taken, in
//      order, and the replay never stale or exhausted. ⛔ A replay that served fewer calls than were recorded is a run that
//      diverged before its end, whatever its matrix says.
// ⚠ IT JUDGES; IT DOES NOT DRIVE. The driver — in-process through the Undertaking page's actions, or the lane in its
// replay mode — collects the observation; this module is shared so both judge alike.
import type {
	Recording,
	RecordedCell
} from '../../apps/rph-demo/src/lib/server/replay/recording.js';
import { buildRunReport, type LaneRows, type StoreRows } from './run-report-core.js';

/** What a replay of a recording was seen to do. */
export interface ReplayObservation {
	/** The stage matrix the replay's stores give (`observedMatrix`). */
	readonly matrix: readonly RecordedCell[];
	/** Every MODEL_EXCHANGE the replay recorded: its id, and the two identity facts' grades as recorded. */
	readonly exchanges: readonly {
		readonly id: string;
		readonly modelEvidence: string | null;
		readonly providerEvidence: string | null;
	}[];
	/** How many programs anything started while the replay ran. */
	readonly spawned: number;
	/** How many of each the replay served. */
	readonly consumed: {
		readonly executor: number;
		readonly commands: number;
		readonly reviewer: number;
	};
	/** The refusal that poisoned the replay, if one did (`REPLAY_STALE`, `REPLAY_EXHAUSTED`). */
	readonly poisonedBy?: string;
}

/**
 * ⭐ THE STAGE MATRIX OVER A REPLAY'S STORES — the run report's own cells (`buildRunReport`), reduced to stage, row and
 * value. ⚠ The report also builds a re-run manifest, which it checks for the account name; the regression reads only
 * the matrix, so it hands the report a name no text contains rather than none, which the report refuses (`REG-F-545`).
 */
export function observedMatrix(store: StoreRows, lane: LaneRows): RecordedCell[] {
	return buildRunReport(store, lane, {
		accountNames: ['jpwb-replay-regression-reads-the-matrix-only']
	}).report.matrix.map((c) => ({ stage: c.stage, row: c.row, value: c.value }));
}

const cellKey = (c: RecordedCell): string => `${c.stage} ${c.row}`;

/** ⭐ THE REGRESSION'S VERDICT: every way the replay differs from its recording, each named. Empty means it reproduced it. */
export function replayRegressionProblems(recording: Recording, o: ReplayObservation): string[] {
	const problems: string[] = [];
	const observed = new Map(o.matrix.map((c) => [cellKey(c), c.value]));
	const expected = new Map(recording.manifest.expectedMatrix.map((c) => [cellKey(c), c.value]));
	for (const [key, value] of expected) {
		if (!observed.has(key))
			problems.push(
				`the matrix: the replay gave no cell ${key}, which the recording expects ${JSON.stringify(value)}`
			);
		else if (observed.get(key) !== value)
			problems.push(
				`the matrix: cell ${key} is ${JSON.stringify(observed.get(key))}, and the recording expects ${JSON.stringify(value)}`
			);
	}
	for (const key of observed.keys())
		if (!expected.has(key))
			problems.push(`the matrix: the replay gave a cell ${key} the recording does not hold`);
	for (const x of o.exchanges)
		if (x.modelEvidence === 'PROVIDER_REPORTED' || x.providerEvidence === 'PROVIDER_REPORTED')
			problems.push(
				`exchange ${x.id} is graded PROVIDER_REPORTED, and no provider reported a replayed call`
			);
	if (o.spawned > 0) problems.push(`${o.spawned} program(s) were started: a replay runs none`);
	if (o.poisonedBy !== undefined) problems.push(`the replay refused: ${o.poisonedBy}`);
	const recorded = {
		executor: recording.executor.length,
		commands: recording.commands.length,
		reviewer: recording.reviewer.length
	};
	for (const part of ['executor', 'commands', 'reviewer'] as const)
		if (o.consumed[part] !== recorded[part])
			problems.push(
				`the replay served ${o.consumed[part]} of the recording's ${recorded[part]} ${part === 'executor' ? 'executor tries' : part === 'commands' ? 'commands' : 'reviewer calls'}`
			);
	return problems;
}
