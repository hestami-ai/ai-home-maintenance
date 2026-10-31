// ⭐⭐ `JAN-EXEC` Phase 7, package X — D34 (`REG-F-590`; `REG-F-554`'s remedy, applied to the kill;
// `docs/_working/DESIGN-data-flow-order-and-deliverable-review.md` §10.5, revision 5) — WHAT A REVIEWER CALL KILLED AT ITS BOUND
// LEFT BEHIND, AS ITS OWN CLASS.
//
// ⛔ WHAT WAS WRONG. A kill carries a signal and no exit code, so `devinPrint` threw it as a plain error with its diagnostic
// alone, and its `finally` then removed the folder holding the export devin wrote (`REG-F-554`). v12's three timeouts at devin's
// 240 s kill (`REG-F-590`) left the record unable to tell a call that was answering from one that had printed nothing.
// ⭐ WHAT THIS MODULE HOLDS, so the adapter that throws the class, the validator that records it and the qualification's
// transport agree on it: the facts (`KilledCallFacts`), the error that carries them (`ToolCallKilled`), its one reading off a
// thrown value (`killedCallOf`), and the one statement of them (`killedCallFacts`) — the validator's no-response detail and the
// transport's TIMEOUT reason both state it.
// ⛔ COUNTS AND FACTS ONLY, NEVER TEXT: whether an export was written, what its last agent step counted, how many characters the
// tool printed before the kill, and the kill's signal. No byte of a reply, an export or a diagnostic is kept here.
// ⚠ PURE, AND IMPORTING NOTHING AT RUNTIME BUT A PATTERN: the validator and the transport read it, and neither may load the
// adapter that throws it (`devin-reviewer.ts` imports `node:child_process`).
import { FINISH_REASON_SHAPE, type OutputLimitFacts } from './output-limit.js';

/** How a kill's signal may look to be carried onto the record: a signal's name, bounded, never free text. */
export const SIGNAL_SHAPE = /^SIG[A-Z0-9]{1,12}$/;

/** What a killed call left behind: each fact the tool's own, counted or named, never its text. */
export interface KilledCallFacts {
	/** The signal the kill sent: `execFile`'s own kill at its `timeout` sends `SIGTERM`. In `SIGNAL_SHAPE`. */
	readonly signal: string;
	/** How many characters the tool had printed on stdout when the kill came — counted, never kept. */
	readonly printedChars: number;
	/** Whether the tool had written its export when the kill came. */
	readonly exportWritten: boolean;
	/** What that export's last agent step counted (`OutputLimitFacts`: its output tokens and finish reason), each where it did. */
	readonly lastStep: OutputLimitFacts;
}

/**
 * ⭐ THE CLASS, AS THE ADAPTER THROWS IT: a call its program was killed during — a signal, and no exit code. ⛔ `message` is the
 * adapter's diagnostic, exactly what it throws for every other failure (the prompt measured out of it), so the validator's seam
 * sanitises it as it sanitises every throw: the facts ride BESIDE it, never in it.
 */
export class ToolCallKilled extends Error {
	readonly killed: KilledCallFacts;

	constructor(message: string, killed: KilledCallFacts) {
		super(message);
		this.name = 'ToolCallKilled';
		this.killed = killed;
	}
}

/** The facts a thrown value carries, when it is the class; `undefined` for any other failure. */
export function killedCallOf(e: unknown): KilledCallFacts | undefined {
	return e instanceof ToolCallKilled ? e.killed : undefined;
}

/** What the statement writes for a count or a finish reason the export did not report. */
const NOT_REPORTED = 'not reported';

/**
 * ⭐ THE ONE STATEMENT OF THE FACTS, as the validator's no-response detail and the qualification's TIMEOUT reason write it. A
 * finish reason is stated only in `FINISH_REASON_SHAPE`, and a signal only in `SIGNAL_SHAPE`, whatever the class was handed.
 */
export function killedCallFacts(f: KilledCallFacts): string {
	const signal = SIGNAL_SHAPE.test(f.signal) ? f.signal : 'a signal not named';
	const reason =
		f.lastStep.finishReason !== undefined && FINISH_REASON_SHAPE.test(f.lastStep.finishReason)
			? f.lastStep.finishReason
			: NOT_REPORTED;
	const tokens = f.lastStep.outputTokens ?? NOT_REPORTED;
	const exported = f.exportWritten
		? `its export written, whose last agent step counted output_tokens ${tokens}, finish_reason ${reason}`
		: 'no export written';
	return `killed by ${signal}, ${f.printedChars} characters printed on stdout before the kill, ${exported}`;
}
