// ⭐⭐ JAN-EXEC PHASE 5 — THE HOST'S OWN RECORD OF WHAT A COMMAND PRODUCED, so a test result can become evidence.
//
// ── ⛔ THE SEAM THIS EXISTS TO CLOSE, MEASURED BEFORE IT WAS BUILT ───────────────────────────────────────────
//
// **THE EXIT CODE OF A MODEL-RUN TEST SUITE EXISTED NOWHERE AFTER THE TURN ENDED.** `ProcessRunOutcome.retention`
// — the one field naming the durable capture — had NO production consumer: `RUN_COMMAND.mint` built its result
// from `exitCode`/`timedOut`/`durationMs`/`outputComplete` and dropped the rest on the floor, and the tool-call
// observer's `since()` returns `{ name, outcome }` only. ⚠ And `ObservedToolCall.outcome === 'COMPLETED'` does
// NOT mean the command passed — `tool-call-observer.ts` says so in those words, because a failing test suite
// completes its call. So nothing downstream could say what ran, what it printed, or whether it exited 0.
//
// ── ⭑ WHY THIS IS THE HOST'S INSTRUMENT AND NOT THE MODEL'S REPORT ──────────────────────────────────────────
//
// §22.1 makes model output untrusted external input, so *"the model said the tests passed"* is not evidence that
// they did. This module is the answer's shape, filled in by the one party that DROVE the run. It is the same
// argument `tool-call-observer.ts` makes and deliberately the same posture: an instrument the host owns, kept
// beside the tool it watches.
//
// ⛔ **AND IT IS A DIFFERENT INSTRUMENT FROM THAT ONE, NOT AN EXTENSION OF IT.** `ObservedToolCall` has no
// argument, result, exit-code or output field BY CONSTRUCTION (`R11`), because it is a RECORD-PLANE type and the
// record plane is permanent. ⚠ What this holds is CONTENT-plane material and must never be written to a
// `MODEL_EXCHANGE`: an exit code may be minted into an ARTIFACT or an EVIDENCE, where `PER-9`'s E-6 redaction
// path exists, and may not be hung on the permanent record where it does not. Widening `ObservedToolCall` to
// carry any of this would undo the guarantee `R11` established structurally.
//
// ── ⚠ WHAT IS HELD, AND WHAT THAT COSTS ─────────────────────────────────────────────────────────────────────
//
// The TRANSIENT streams are held, in host memory, for the length of the step. ⭑ That adds NO retention surface
// that did not already exist: `run_command` hands both streams back to the model, so they are already in the E-1
// composite `createMaterializedInputRecorder` captures and already stored under `RETAINED_BY_PARTICIPATION`
// (`execution-tool-surface.ts`, Phase 3's second `REG-Q-066` disposition). What Phase 5 adds is an ADDRESSABLE
// copy — `ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')` — because the composite is the whole provider
// payload for a turn and nothing inside it names the test run.
//
// ⛔ **AND IT IS BOUNDED, WITH THE CUT DECLARED, BECAUSE AN UNBOUNDED ONE IS A STEP THAT EXHAUSTS THE HOST BY
// RUNNING COMMANDS.** `W-2` already records that nothing bounds a step's tool-call count. Until that is ruled,
// this instrument bounds ITSELF rather than inheriting an absence — and it declares the bound, because a
// silently-dropped run is a command that happened and left no trace, which is the fabricated-completeness defect
// `omittedRegions` exists one plane down to prevent.
//
// ── ⛔⛔ THE RETENTION DISPOSITION THIS FILE OWES, BECAUSE IT BINDS `stderr` (`REG-Q-066`) ──────────────
//
// `verif/agy-stderr-unbound.test.ts` went RED the moment this file existed, with its own instruction: a binding
// *"must not arrive as a debugging convenience."* This is the THIRD disposition, and it answers a question the
// first two did not: Phase 2b answered who CAPTURES the streams, Phase 3 who HANDS THEM TO A MODEL, and this
// one who turns them into EVIDENCE — which is different because evidence is CITED IN A JUDGEMENT and outlives
// the turn.
//
// **WHAT IS NEW HERE: NOTHING, AND THAT IS THE ANSWER.** These are the TRANSIENT strings `run_command` already
// hands back to the model, so they are already inside the E-1 composite stored under
// `RETAINED_BY_PARTICIPATION`. This module holds the same strings in host memory for the length of the step and
// **persists nothing**. The durable copy is still the runner's `PURGEABLE_AT_EXPIRY` capture, named by
// `retention` below and reachable by `Workspace.purge` — untouched and unreclassified, because re-labelling it
// would retroactively falsify `R7` for every prior run.
//
// **WHAT IS NEW ELSEWHERE, AND IT IS A DELIBERATE ACT WITH A DECLARED CLASS.** `R16`: a caller that turns a run
// into evidence mints an ADDRESSABLE copy with `ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')`. The
// class follows `REG-D-050` — participation is a property of USE, and a floor run JUDGES these bytes.
// ⛔ The mint is the CALLER'S act and is disposed of at ITS site; this file is why the bytes are reachable to
// mint, and it retains none of them.
//
// ⛔ AND NO BYTE REACHES THE RECORD PLANE. That is not discipline here, it is the shape of `ObservedToolCall`:
// four fields, none of which could hold one (`R11`). See the header above on why this is a SECOND instrument.
import type { ProcessOutputOmission, ProcessOutputRetention } from '@janumipwb/rph-ports';

/**
 * One command the host ran on the model's behalf, as the host observed it.
 *
 * ⭑ `argv` IS HERE AND IS NOT ON `ObservedToolCall`, and the asymmetry is the whole design. The record plane
 * holds a tool NAME and nothing the model chose; the content plane may hold what it chose, because that is where
 * a redaction path exists. A reader asking *"which command produced this evidence"* is asking a content-plane
 * question and gets a content-plane answer.
 */
export interface ObservedProcessRun {
	/** 1-based, in the order the host STARTED the runs. */
	readonly ordinal: number;
	/** The program and its arguments, as the model chose them and the runner received them. */
	readonly argv: readonly string[];
	/**
	 * ⛔ `null` MEANS TERMINATED BY A SIGNAL, AND IT IS NEVER FOLDED INTO A NUMBER. The port is explicit that
	 * `exitCode: null` would otherwise assert a termination nobody observed. Under `R17` this is one of the two
	 * BLOCKING conditions: a result with no verdict is not evidence of a verdict.
	 */
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly durationMs: number;
	/** Whether BOTH streams reached EOF before the outcome was produced. `R17`: a recorded LIMITATION, not a block. */
	readonly outputComplete: boolean;
	/** What the capture CUT, carried so the bytes below cannot read as complete. `R17`: a LIMITATION, not a block. */
	readonly omittedRegions: readonly ProcessOutputOmission[];
	/** Where the runner's own durable, PURGEABLE_AT_EXPIRY copy lives. Carried so a reader can reach both copies. */
	readonly retention: ProcessOutputRetention;
	/** ⚠ THE TRANSIENT COPY, held only for this step. The participating copy is minted by the caller. */
	readonly stdout: string;
	readonly stderr: string;
}

/**
 * How many runs one step's observer retains.
 *
 * ⚠ AUTHORED, AND SAID TO BE. Nothing measured says 32. What is argued is that a bound must exist and must
 * belong to the HOST — the same argument `EXECUTION_COMMAND_TIMEOUT_MS` makes, for the same reason: a resource
 * bound under an untrusted party's control is not a bound. ⭑ It is deliberately the SAME NUMBER as `R11`'s
 * record-plane call cap, so a step cannot retain more process runs than the record can name tool calls.
 */
export const OBSERVED_PROCESS_RUN_LIMIT = 32;

export interface ProcessRunObservation {
	/** The runs retained, in start order. */
	readonly runs: readonly ObservedProcessRun[];
	/** How many ran in total. ⛔ Greater than `runs.length` means the rest were DROPPED, and this is where it says so. */
	readonly observedCount: number;
	readonly recordedLimit: number;
}

export interface ProcessRunObserver {
	/** A run the host completed. ⚠ A REFUSED run is never reported here: nothing was produced to evidence. */
	ran(run: Omit<ObservedProcessRun, 'ordinal'>): void;
	/** Everything retained so far, with the bound declared. */
	observed(): ProcessRunObservation;
}

export function createProcessRunObserver(
	limit: number = OBSERVED_PROCESS_RUN_LIMIT
): ProcessRunObserver {
	const runs: ObservedProcessRun[] = [];
	let total = 0;
	return {
		ran(run) {
			total += 1;
			// ⛔ THE FIRST N ARE KEPT, NOT THE LAST N, AND THE CHOICE IS NOT ARBITRARY. `R11`'s record-plane list
			// keeps the first N so an ordinal in one instrument means the same act as the same ordinal in the
			// other. Keeping the last N here would silently re-number the same turn two different ways.
			if (runs.length < limit) runs.push({ ordinal: total, ...run });
		},
		observed: () => ({ runs: [...runs], observedCount: total, recordedLimit: limit })
	};
}
