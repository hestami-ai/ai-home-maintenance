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
import { basename, dirname, join } from 'node:path';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { answerFromTurnEnd } from '../tools/backing-tool.js';
// ⭐ The lead's ruling (k) on the review's fifth re-check — the one describer of a thrown value, and the one reader of its code, neither able to throw: the
// two refusals below describe through them, so a refusal is said, whatever value the read threw.
import { describedThrow, thrownCode } from '../described-throw.js';
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
 * before); its one file reopened when it has one (the unit's earlier steps, `REG-D-169`); else, for a replacement, its predecessor's one file forked;
 * else a new file. ⛔ Two files in either folder refuse, naming it. ⭑ A predecessor with no session file is said (`predecessorWithoutSession`), so the
 * run report can say the successor started as a new unit does (D85). ⭐ The independent review's defects 1 and 8 — and what each file holds is read
 * here, before anything is dispatched: a reopened file's own answer, findings and feedback and the conversation it was forked from
 * (`sessionFileHoldings`), and whether a predecessor's conversation returned a work product (`historyAnswered`). ⛔ The lead's ruling (e) on the review's
 * third re-check — a file it would reopen or fork that cannot be read refuses the step, naming it and why (`sessionEntriesOf`).
 */
export function executorSessionPlaceOf(
	root: string | undefined,
	unitId: string,
	predecessorId: string | undefined
): ExecutorSessionPlace | { readonly refusedBecause: string } {
	if (root === undefined) return { kind: 'IN_MEMORY' };
	const folder = sessionFolderOf(root, 'executor', unitId);
	const own = sessionFilesIn(folder);
	if (own.length > 1) return { refusedBecause: twoSessionFilesRefusal(folder, own.length) };
	if (own.length === 1) return { kind: 'DURABLE', folder, opening: { kind: 'REOPEN', file: own[0]!, held: sessionFileHoldings(own[0]!) } };
	if (predecessorId === undefined) return { kind: 'DURABLE', folder, opening: { kind: 'NEW' } };
	const theirs = sessionFolderOf(root, 'executor', predecessorId);
	const files = sessionFilesIn(theirs);
	if (files.length > 1) return { refusedBecause: twoSessionFilesRefusal(theirs, files.length) };
	if (files.length === 0) return { kind: 'DURABLE', folder, opening: { kind: 'NEW', predecessorWithoutSession: predecessorId } };
	return {
		kind: 'DURABLE',
		folder,
		opening: {
			kind: 'FORK',
			from: files[0]!,
			predecessorId,
			heldFindings: forkedHistoryHeldFindings(files[0]!),
			returnedAnswer: historyAnswered(files[0]!)
		}
	};
}

/** ⭐ D85 — the schema of the note a successor records when its predecessor left no session (`recordPredecessorWithoutSession`). */
export const PREDECESSOR_WITHOUT_SESSION_SCHEMA = 'jpwb.executor-session.predecessor-without-session/1';

/** ⭐ D85 — the name that note is bound to on the content plane: its unit's, under the host's tenant prefix (§31.2). */
export function predecessorWithoutSessionNameOf(tenantPrefix: string, unitId: string): string {
	return `${tenantPrefix}/executor-session/${unitId}/predecessor-without-session`;
}

/**
 * ⭐⭐ D85 — A REPLACEMENT WHOSE PREDECESSOR LEFT NO SESSION FILE STARTS AS A NEW UNIT DOES, AND THAT IS RECORDED FOR THE RUN REPORT: a note on the content
 * plane (`application/json`, `RETAINED_BY_PARTICIPATION`), bound to its unit's name (`predecessorWithoutSessionNameOf`), so a reader that knows only the
 * unit reaches it. ⭑ Its bytes are its facts alone, so a later step of the same unit binding it again names the same entry, which `bindName` admits.
 * ⛔ A binding the store refuses throws: the caller fails the step, as it does for the unit's baseline (`deliverable-view.ts`, `unitBaselineOf`).
 */
export async function recordPredecessorWithoutSession(
	store: Pick<ArtifactStore, 'put' | 'bindName'>,
	tenantPrefix: string,
	note: { readonly unitId: string; readonly predecessorId: string }
): Promise<void> {
	const ref = await store.put({
		tenantPrefix,
		bytes: JSON.stringify({
			schema: PREDECESSOR_WITHOUT_SESSION_SCHEMA,
			unitId: note.unitId,
			predecessorId: note.predecessorId,
			statement:
				`The unit this one replaces, ${note.predecessorId}, left no session file, so this unit's session began as a new unit's does, ` +
				'holding nothing of its predecessor’s conversation (design D85).'
		}),
		mediaType: 'application/json',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const named = await store.bindName(predecessorWithoutSessionNameOf(tenantPrefix, note.unitId), ref.storageKey);
	if (!named.bound)
		throw new Error(`the note that work unit ${note.unitId}'s predecessor left no session could not be named: ${named.refusedBecause}`);
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

/**
 * ⭐⭐ `REG-D-170` — WHETHER A PREDECESSOR'S SESSION HELD REVIEW FINDINGS, so its successor's first turn declares PRIOR_REVIEW_FINDING at
 * THIS_UNDERTAKING with its history, and only then: a second user turn (a repair turn's findings, or a later step's), or a first turn that carried
 * findings (RD8's line, or D77's feedback). ⛔ The lead's ruling (e) on the review's third re-check — a file that cannot be read refuses the step, naming
 * it and why (`sessionEntriesOf`): never read as holding no findings, since our read and Pi's are two reads, and a file locked for a moment can fail ours
 * and pass Pi's, the fork then going on with findings in its history undeclared.
 */
export function forkedHistoryHeldFindings(file: string): boolean {
	return turnsHeldFindings(userTurnsOf(sessionEntriesOf(file)));
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

/** Whether user turns held review findings: a second turn (a repair turn's findings, or a later step's), or a turn carrying RD8's or D77's. */
function turnsHeldFindings(users: readonly string[]): boolean {
	if (users.length > 1) return true;
	return users.some((t) => t.includes(CARRIED_FINDINGS_LINE) || t.includes(FEEDBACK_HEADING));
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
 * ⭐ The independent review's defect 8 — whether a session file's conversation returned an answer. ⛔ The lead's ruling (e) on the review's third
 * re-check — one that cannot be read refuses the step, naming it and why (`sessionEntriesOf`).
 */
export function historyAnswered(file: string): boolean {
	return entriesAnswered(sessionEntriesOf(file));
}

/** ⭐ What a conversation's own entries hold: an answer, findings carried (a second turn, RD8's), and D77's feedback. */
function ownHoldingsOf(own: readonly SessionEntry[]): Omit<SessionFileHoldings, 'forkedFrom'> {
	const users = userTurnsOf(own);
	return {
		returnedAnswer: entriesAnswered(own),
		ownFindings: users.length > 1 || users.some((t) => t.includes(CARRIED_FINDINGS_LINE)),
		crossUnitFeedback: users.some((t) => t.includes(FEEDBACK_HEADING))
	};
}

/**
 * ⭐⭐ The independent review's defects 1 and 8 — WHAT A SESSION FILE HOLDS, READ FROM IT before a step reopens it: whether its own turns returned an
 * answer, carried findings or carried D77's feedback; and, where it began as a fork — its header names its parent (`parentSession`, Pi's `forkFrom`) —
 * what the conversation it was forked from holds. Pi copies a parent's entries whole, their ids kept, so the entries that are not the parent's are the
 * unit's own. ⛔ The lead's ruling (e) on the review's third re-check — the file itself, read to be reopened, refuses the step where it cannot be read,
 * naming it and why (`sessionEntriesOf`). ⭑ The conversation it was forked from, where its parent's file cannot be read, is held, as before, to hold
 * everything its parent could — declared, never said short (`parentEntriesOf`).
 */
export function sessionFileHoldings(file: string): SessionFileHoldings {
	const entries = sessionEntriesOf(file);
	const header = entries.find((e) => e.type === 'session');
	const parent = typeof header?.parentSession === 'string' && header.parentSession !== '' ? header.parentSession : undefined;
	const body = entries.filter((e) => e.type !== 'session');
	if (parent === undefined) return ownHoldingsOf(body);
	const theirs = parentEntriesOf(parent);
	const theirIds = new Set((theirs ?? []).flatMap((e) => (typeof e.id === 'string' ? [e.id] : [])));
	return {
		...ownHoldingsOf(body.filter((e) => !(typeof e.id === 'string' && theirIds.has(e.id)))),
		forkedFrom: {
			predecessorId: basename(dirname(parent)),
			heldFindings: theirs === undefined ? true : turnsHeldFindings(userTurnsOf(theirs)),
			returnedAnswer: theirs === undefined ? true : entriesAnswered(theirs)
		}
	};
}

/**
 * ⭐ The lead's ruling (e) on the review's third re-check — THE CONVERSATION A REOPENED FORK WAS FORKED FROM, read from its parent's file: `undefined`
 * where that file cannot be read, never a refusal — the fork's own file holds the entries Pi copied, so Pi does not need the parent — and the fork is then
 * held to hold everything its parent could (`sessionFileHoldings`).
 */
function parentEntriesOf(parent: string): SessionEntry[] | undefined {
	try {
		return sessionEntriesOf(parent);
	} catch {
		return undefined;
	}
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
