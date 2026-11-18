// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D85 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.39; `REG-D-167` (4); `REG-D-169`) — WHERE A PI
// SESSION IS KEPT, AND HOW IT OPENS: read from the folder it lives in, never from memory.
//
// ⭑ WHAT THIS IS. With a durable store, each Pi session the executor's harness opens is Pi's own session file, one per folder, beside the run's records
// (`<D>.sessions/`, `workspace-host.ts`, `durableSessionsRoot`): a unit's in `executor/<unit id>/`, the assurance stage's helpers' in
// `hypothesizer/<round id>/` and `unsticking/<round id>/`. A unit's FIRST step creates its file; EVERY LATER STEP — a stopped unit's work re-run, D71's
// re-run in place — reopens it, after a restart or not (`REG-D-169`, the sponsor's ruling: "Continue the conversation"); a replacement unit's first step
// forks its predecessor's (D72's successor). With no durable store a session is held in memory, byte for byte as before.
// ⛔ A FOLDER HOLDING MORE THAN ONE SESSION FILE IS REFUSED, NAMING THE FOLDER: which conversation a later step continues is then a guess.
// ⭑ PI-FREE, as `pi-executor-resources.ts` is: the folder is read with `node:fs`, and the session file's lines are Pi's JSON entries, read as data; only
// `pi-executor.ts` opens Pi's `SessionManager` on what this decides (`executorSessionManager`).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerFromTurnEnd } from '../tools/backing-tool.js';
// ⭐ The lead's ruling (k) on the review's fifth re-check — the one describer of a thrown value, and the one reader of its code, neither able to throw: the
// two refusals below describe through them, so a refusal is said, whatever value the read threw.
import { describedThrow, thrownCode } from '../described-throw.js';
import { NO_RECORD_SENTENCE } from './earlier-attempt-record.js';
import type { ExecutorSessionPlace, SessionFileHoldings } from './producer-session.js';
import { sessionFolderOf } from './workspace-host.js';

/** Pi writes each session as one JSON-lines file (`<timestamp>_<id>.jsonl`, `session-manager.js`, `newSession`, `forkFrom`). */
export const SESSION_FILE_SUFFIX = '.jsonl';

/**
 * Every session file in `folder`, in name order (Pi names them by their start time), or none when the folder does not exist yet. ⛔ The independent
 * review's defect 3 — ONLY A FOLDER THAT DOES NOT EXIST IS NO SESSION: one that exists and cannot be listed would read as holding none — its history
 * dropped, a second file made beside it, its unit said to have left none — so it throws, naming the folder and why, and the step refuses. ⭐ The lead's
 * ruling (m) on the review's sixth re-check — the listing's failure is classified through the one reader of a code (`thrownCode`), so whatever value the
 * listing throws — a revoked `Proxy`, `null`, `undefined` — the refusal naming the folder and why is built, never the read's own error in its place. The
 * listing is passed in (`list`), the filesystem's by default, so a test can reach the classifier.
 */
export function sessionFilesIn(folder: string, list: (folder: string) => string[] = (f) => readdirSync(f)): string[] {
	let names: string[];
	try {
		names = list(folder);
	} catch (e) {
		if (thrownCode(e) === 'ENOENT') return [];
		throw new Error(unlistableSessionFolderRefusal(folder, e));
	}
	return names
		.filter((n) => n.endsWith(SESSION_FILE_SUFFIX))
		.sort((a, b) => Number(a > b) - Number(a < b))
		.map((n) => join(folder, n));
}

/** ⛔ D85, the independent review's defect 3 — why a session folder that exists and cannot be listed refuses the step, naming it and why. */
export function unlistableSessionFolderRefusal(folder: string, e: unknown): string {
	const code = thrownCode(e) ?? 'an error';
	return (
		`the session folder ${folder} cannot be listed (${code}: ${describedThrow(e)}), so whether it holds a session cannot ` +
		'be told: refused rather than read as holding none (design D85).'
	);
}

/**
 * ⛔ The lead's ruling (e) on the review's third re-check — why a session file the step would reopen or fork that cannot be read refuses the step, naming
 * it and why, as a folder that cannot be listed does (`unlistableSessionFolderRefusal`).
 */
export function unreadableSessionFileRefusal(file: string, e: unknown): string {
	const code = thrownCode(e) ?? 'an error';
	return (
		`the session file ${file} cannot be read (${code}: ${describedThrow(e)}), so what it holds cannot be told: refused rather ` +
		'than read as holding everything or as holding no findings (design D85).'
	);
}

/** ⛔ D85 — why a folder holding more than one session file is refused, naming it. */
export function twoSessionFilesRefusal(folder: string, count: number): string {
	return (
		`the session folder ${folder} holds ${count} session files, and a work unit's session is one file: which conversation this step continues ` +
		'cannot be told, so it is refused rather than guessed (design D85).'
	);
}

/**
 * ⭐ D85 — THE PLACE A UNIT'S STEP OPENS ITS EXECUTOR SESSION IN, read from its folder: none on a store with no durable path (held in memory, as
 * before); its one file reopened when it has one (the unit's earlier steps, `REG-D-169`); else a new file. ⛔ Two files refuse, naming the folder.
 * ⭐ The independent review's defects 1 and 8 — and what the file holds is read here, before anything is dispatched (`sessionFileHoldings`); ⛔ the
 * lead's ruling (e) on the review's third re-check — a file it would reopen that cannot be read refuses the step, naming it and why.
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173`) — ~~`predecessorId`; for a replacement, its predecessor's one file forked; a
 * predecessor with no session file said (`predecessorWithoutSession`)~~: NOTHING FORKS. A replacement is a unit of its own: its first step opens a
 * new file in its own folder, its later steps reopen it, and its predecessor's file is left byte for byte; the record of the units it replaces is in
 * reach through its tool (`earlier-attempt-record.ts`). A file whose header names a parent — which only package L17b1's fork wrote — is refused at
 * its reopening (`sessionFileHoldings`, `parentedSessionFileRefusal`). ⭐ The lead's ruling 4 (§16) — `lineSentence`, the record's sentence the
 * unit's step would say, where it replaces any: what a reopened file is read against to hold the line (`sessionFileHoldings`).
 */
export function executorSessionPlaceOf(
	root: string | undefined,
	unitId: string,
	lineSentence?: string
): ExecutorSessionPlace | { readonly refusedBecause: string } {
	if (root === undefined) return { kind: 'IN_MEMORY' };
	const folder = sessionFolderOf(root, 'executor', unitId);
	const own = sessionFilesIn(folder);
	if (own.length > 1) return { refusedBecause: twoSessionFilesRefusal(folder, own.length) };
	if (own.length === 1) return { kind: 'DURABLE', folder, opening: { kind: 'REOPEN', file: own[0]!, held: sessionFileHoldings(own[0]!, lineSentence) } };
	return { kind: 'DURABLE', folder, opening: { kind: 'NEW' } };
}

/**
 * ⭐⭐ Package L17b3 — design D89 — why a session file whose header names a parent is refused: a fork of another unit's session, which no step makes
 * since D89 — never read as the unit's own (the builder's words, §4.2).
 */
export function parentedSessionFileRefusal(file: string, parent: string): string {
	return `the session file ${file} names a parent session (${parent}): a fork of another unit's session, which no step makes since design D89 — refused rather than read as this unit's own (design D89).`;
}

/**
 * The two lines the host writes into a first turn that carries findings: RD8's (`run-model-step.ts`, `firstTurn`) and D77's feedback heading
 * (`successor-feedback.ts`). ⭑ The host's own fixed words, never the model's, so finding them is a reading of what this host sent.
 */
export const CARRIED_FINDINGS_LINE = 'An independent assurance review of an earlier attempt at this work found the following:';
export const FEEDBACK_HEADING = 'Holistic feedback — what the assurance of this Undertaking’s work has recorded since this work was last done:';

/** The text of a Pi message, its text blocks joined: a user turn's, or ⭐ (the review's re-check, A) an assistant's answer, as the adapter reads it. */
function userText(message: unknown): string {
	const content = (message as { content?: unknown }).content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content.map((b) => (typeof (b as { text?: unknown }).text === 'string' ? (b as { text: string }).text : '')).join('');
}

/** One entry of a Pi session file, as far as this module reads it: its kind, its id, a header's parent, a message's role, stop and content. */
interface SessionEntry {
	readonly type?: unknown;
	readonly id?: unknown;
	readonly parentSession?: unknown;
	readonly message?: { readonly role?: unknown; readonly stopReason?: unknown; readonly content?: unknown };
}

/**
 * A session file's entries, one JSON object a line, a line Pi itself would skip (`parseSessionEntryLine`) skipped. ⛔ The lead's ruling (e) on the review's
 * third re-check — A FILE THAT CANNOT BE READ REFUSES THE STEP, naming it and why (`unreadableSessionFileRefusal`), as a folder that cannot be listed
 * does: it is read neither as holding everything nor as holding no findings.
 */
function sessionEntriesOf(file: string): SessionEntry[] {
	let text: string;
	try {
		text = readFileSync(file, 'utf8');
	} catch (e) {
		throw new Error(unreadableSessionFileRefusal(file, e));
	}
	const entries: SessionEntry[] = [];
	for (const line of text.split('\n')) {
		if (line.trim() === '') continue;
		try {
			entries.push(JSON.parse(line) as SessionEntry);
		} catch {
			// A line Pi itself would skip: not an entry.
		}
	}
	return entries;
}

/** The text of each user turn among `entries`, in order. */
function userTurnsOf(entries: readonly SessionEntry[]): string[] {
	return entries.filter((e) => e.type === 'message' && e.message?.role === 'user').map((e) => userText(e.message));
}

/**
 * ⭐ The independent review's defect 8 — whether entries hold a returned answer. ⭐ The review's re-check (A), and the lead's ruling on it — WHAT A SESSION
 * HOLDS IS WHAT PI WILL SEND, read here, the one predicate: an assistant message holds an answer where the adapter reads one at a turn's end
 * (`answerFromTurnEnd`, `tools/backing-tool.ts`: any text, whatever its stop — an answer cut at the length limit is one) AND Pi replays it — not a message
 * that ended in `error` or was `aborted`, which Pi does not send again (`transform-messages.js`), whatever its text. A `stop` that said nothing is none; a
 * try that stopped in a tool call, saying nothing, returned none, though Pi keeps its file from its first assistant message. ⭑ The step reads this
 * predicate's result, through what the place says the session holds (`returnedAnswer`), for its first turn's words and its declarations.
 * ⚠ The edge this leaves, named (the lead's ruling): the adapter's own judgement of what a step RECORDS is unchanged, so a work product recorded from a
 * message Pi does not replay stays on the record though the turns the session holds do not show it; the files that try wrote stay in the workspace.
 */
function entriesAnswered(entries: readonly SessionEntry[]): boolean {
	return entries.some(
		(e) =>
			e.type === 'message' &&
			e.message?.role === 'assistant' &&
			replayedByPi(e.message.stopReason) &&
			answerFromTurnEnd(userText(e.message), { stopReason: typeof e.message.stopReason === 'string' ? e.message.stopReason : '' }).arrived
	);
}

/** ⭐ The lead's ruling on the re-check's A — whether Pi sends a message again: not one that ended in `error` or was `aborted` (`transform-messages.js`). */
function replayedByPi(stopReason: unknown): boolean {
	return stopReason !== 'error' && stopReason !== 'aborted';
}

/**
 * ⭐ What a conversation's own entries hold: an answer, findings carried (a second turn, RD8's), and D77's feedback. ⭐⭐ Package L17b3 — design D89 —
 * and whether a first turn on it told it of the record's line (the record's sentence, or that no unit in the line left a record), so a later step on
 * the file does not say it again (`heldLine`, absent where it was told nothing). ⭐ The lead's ruling 4 (§16; the independent review's L17C-04) —
 * ~~a turn that holds the phrase `with the read_earlier_attempt tool`, or the no-record sentence, anywhere~~: the line is held only where a user turn
 * ENDS with the exact sentence the step would say (`lineSentence`), after the blank line the step puts before it, or with the no-record sentence as
 * its whole last paragraph — never a phrase found anywhere in a turn.
 */
function ownHoldingsOf(own: readonly SessionEntry[], lineSentence?: string): SessionFileHoldings {
	const users = userTurnsOf(own);
	return {
		returnedAnswer: entriesAnswered(own),
		ownFindings: users.length > 1 || users.some((t) => t.includes(CARRIED_FINDINGS_LINE)),
		crossUnitFeedback: users.some((t) => t.includes(FEEDBACK_HEADING)),
		...(users.some((t) => lineSaidBy(t, lineSentence)) ? { heldLine: true as const } : {})
	};
}

/** ⭐ The lead's ruling 4 — whether a user turn ends with the line's sentence, after a blank line, or with the no-record sentence as its last paragraph. */
function lineSaidBy(turn: string, lineSentence: string | undefined): boolean {
	if (lineSentence !== undefined && turn.endsWith(`\n\n${lineSentence}`)) return true;
	const at = turn.lastIndexOf('\n\n');
	return (at < 0 ? turn : turn.slice(at + 2)) === NO_RECORD_SENTENCE;
}

/**
 * ⭐⭐ The independent review's defects 1 and 8 — WHAT A SESSION FILE HOLDS, READ FROM IT before a step reopens it: whether its own turns returned an
 * answer, carried findings or carried D77's feedback, and (package L17b3, D89) whether it holds the record's line. ⛔ The lead's ruling (e) on the
 * review's third re-check — the file, read to be reopened, refuses the step where it cannot be read, naming it and why (`sessionEntriesOf`).
 * ⭐⭐ Package L17b3 — design D89 — ~~and, where it began as a fork, what the conversation it was forked from holds~~: a file whose header names a
 * parent (`parentSession`, Pi's `forkFrom`) is refused, naming it and its parent — no step forks since D89, and a fork's copied history is another
 * unit's conversation, never this unit's own. ⭐ The lead's ruling 4 (§16) — `lineSentence`, the record's sentence the step would say, what the line
 * held is read against (`ownHoldingsOf`); none given, only the no-record sentence holds it.
 */
export function sessionFileHoldings(file: string, lineSentence?: string): SessionFileHoldings {
	const entries = sessionEntriesOf(file);
	const header = entries.find((e) => e.type === 'session');
	const parent = typeof header?.parentSession === 'string' && header.parentSession !== '' ? header.parentSession : undefined;
	if (parent !== undefined) throw new Error(parentedSessionFileRefusal(file, parent));
	return ownHoldingsOf(
		entries.filter((e) => e.type !== 'session'),
		lineSentence
	);
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D91 (`REG-F-649`; the lead's ruling 10 on Stage 0) — D91'S CHECK ON A REOPENED FILE: whether it
 * holds the reviewed try's answer as Pi replays it. The reviewed try is found by its turn's text — the ONE user entry equal to it; its messages are
 * the assistant's after it, up to the next user entry. `HELD` where every one of those that carried text is of a kind Pi replays (D85's predicate,
 * `replayedByPi`); `NOT_HELD` where any is not; `NOT_SHOWN` where no single entry is the turn — and the work is then sent again. ⛔ A file that
 * cannot be read refuses, naming it and why (`sessionEntriesOf`).
 */
export function reviewedTryHeld(file: string, turnText: string): 'HELD' | 'NOT_HELD' | 'NOT_SHOWN' {
	const entries = sessionEntriesOf(file).filter((e) => e.type === 'message');
	const matches = entries.flatMap((e, i) => (e.message?.role === 'user' && userText(e.message) === turnText ? [i] : []));
	if (matches.length !== 1) return 'NOT_SHOWN';
	const after = entries.slice(matches[0]! + 1);
	const next = after.findIndex((e) => e.message?.role === 'user');
	const replies = (next < 0 ? after : after.slice(0, next)).filter((e) => e.message?.role === 'assistant' && userText(e.message) !== '');
	// ⭐ The lead's ruling 2 (§16; the independent review's L17C-02) — no message that carried text after the reviewed turn — its user entry alone, or an
	// answer whose line the reader skips — shows nothing the session holds of the reviewed answer: NOT_SHOWN, never HELD.
	if (replies.length === 0) return 'NOT_SHOWN';
	return replies.every((e) => replayedByPi(e.message?.stopReason)) ? 'HELD' : 'NOT_HELD';
}

/**
 * ⭐⭐ D85, as the lead ruled it: THE RESULT A REOPENED SESSION IS GIVEN FOR A TOOL CALL ITS STOPPED STEP NEVER ANSWERED. Pi would send the call with
 * an output of its own, *"No result provided"* (`pi-ai`, `transformMessages`), which no record holds and which does not say why; this one is appended
 * to the file, so the request carries it and the record keeps it.
 */
export const CUT_OFF_RESULT =
	'This call was cut off: the work unit’s step stopped before its result was recorded, so whether the command ran, and what it did, is not known.';

/** The part of Pi's `SessionManager` the cut-off results need: the active path, and an append. */
export interface AppendableSession {
	getBranch(): readonly { readonly type: string; readonly message?: unknown }[];
	appendMessage(message: never): string;
}

/**
 * ⭐ D85 — APPEND A CUT-OFF RESULT FOR EACH TOOL CALL OF THE PATH'S LAST ASSISTANT TURN THAT HAS NO RESULT (`isError`, `CUT_OFF_RESULT`), and say how
 * many. ⛔ Not for an assistant turn that ended in an error or was aborted: Pi does not replay such a turn, nor its calls (`transformMessages`), so a
 * result for one would answer a call the request never carries.
 */
export function supplyCutOffResults(session: AppendableSession, now: () => number = Date.now): number {
	const path = session.getBranch();
	let at = -1;
	for (let i = path.length - 1; i >= 0; i--) {
		const m = path[i]!.message as { role?: unknown } | undefined;
		if (path[i]!.type === 'message' && m?.role === 'assistant') {
			at = i;
			break;
		}
	}
	if (at < 0) return 0;
	const assistant = path[at]!.message as { stopReason?: unknown; content?: unknown };
	if (assistant.stopReason === 'error' || assistant.stopReason === 'aborted') return 0;
	const calls = (Array.isArray(assistant.content) ? assistant.content : []).filter(
		(b): b is { type: 'toolCall'; id: string; name: string } => (b as { type?: unknown }).type === 'toolCall'
	);
	const answered = new Set(
		path
			.slice(at + 1)
			.map((e) => e.message as { role?: unknown; toolCallId?: unknown } | undefined)
			.filter((m) => m?.role === 'toolResult')
			.map((m) => m!.toolCallId)
	);
	let supplied = 0;
	for (const call of calls) {
		if (answered.has(call.id)) continue;
		session.appendMessage({
			role: 'toolResult',
			toolCallId: call.id,
			toolName: call.name,
			content: [{ type: 'text', text: CUT_OFF_RESULT }],
			isError: true,
			timestamp: now()
		} as never);
		supplied += 1;
	}
	return supplied;
}
