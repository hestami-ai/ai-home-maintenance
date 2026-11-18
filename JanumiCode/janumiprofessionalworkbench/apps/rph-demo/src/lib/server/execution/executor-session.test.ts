// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D85 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.39; `REG-D-167` (4); `REG-D-169`) — WHERE
// EACH EXECUTOR SESSION IS KEPT AND HOW IT OPENS, READ FROM ITS FOLDER; the result a stopped step's unanswered call is given; ~~and the note a
// replacement whose predecessor left no session records for the run report~~ ⭐ and, since package L17b3 (design D89, `REG-D-173`), no fork and no
// note: a replacement opens a new session of its own, a file naming a parent is refused, and D91's question of a reopened file — whether it holds
// the reviewed answer — is asked of the reviewed try's own messages.
//
// ⭑ WHAT MUST HOLD (D85, the sponsor's `REG-D-169`, the lead's rulings): with a durable store, a unit's session is Pi's own file in
// `<D>.sessions/executor/<unit id>/` — created at the unit's first step, reopened at every later step, ~~forked from its predecessor's at a
// replacement's first step~~ ⭐ a replacement's first step a unit's first step like any other (D89); two files in a folder are refused, naming it;
// with no durable store, held in memory as before. A call the stopped step never answered is given a recorded result saying the stop cut it off
// (the lead's ruling).
// ⭑ PI-FREE: the session files here are Pi's JSON lines, written by the test as Pi writes them (`session-manager.js`); Pi's own reading of them is
// `pi-executor-session.test.ts`'s.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// ⭐ L17b3 (D89) — the fork's readers and its note go with the fork, their imports struck: ~~`forkedHistoryHeldFindings`, `historyAnswered`,
// `PREDECESSOR_WITHOUT_SESSION_SCHEMA`, `predecessorWithoutSessionNameOf`, `recordPredecessorWithoutSession`~~, ~~`createInMemoryArtifactStore`~~
// (the note's store). The module is read whole once, to say they are gone.
import * as executorSessionModule from './executor-session.js';
import {
	CARRIED_FINDINGS_LINE,
	CUT_OFF_RESULT,
	executorSessionPlaceOf,
	FEEDBACK_HEADING,
	parentedSessionFileRefusal,
	reviewedTryHeld,
	sessionFileHoldings,
	sessionFilesIn,
	supplyCutOffResults,
	twoSessionFilesRefusal,
	unlistableSessionFolderRefusal,
	unreadableSessionFileRefusal
} from './executor-session.js';
import { durableSessionsRoot, sessionFolderOf } from './workspace-host.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-executor-session-'));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
let n = 0;
/** A fresh sessions root, `<D>.sessions`, for one case. */
const sessionsRoot = (): string => {
	const root = join(ROOT, `case-${++n}`, 'demo.sqlite.sessions');
	mkdirSync(root, { recursive: true });
	return root;
};

/** A session file as Pi writes one: its header, then each entry, one JSON object per line. */
function sessionFile(folder: string, name: string, entries: readonly Record<string, unknown>[]): string {
	mkdirSync(folder, { recursive: true });
	const file = join(folder, name);
	const header = { type: 'session', version: 3, id: name.replace('.jsonl', ''), timestamp: '2026-11-16T00:00:00.000Z', cwd: ROOT };
	writeFileSync(file, `${[header, ...entries].map((e) => JSON.stringify(e)).join('\n')}\n`);
	return file;
}
const userEntry = (id: string, text: string) => ({
	type: 'message',
	id,
	parentId: null,
	timestamp: '2026-11-16T00:00:01.000Z',
	message: { role: 'user', content: [{ type: 'text', text }], timestamp: 1 }
});
/** ⭐ The review's defect 8 — an assistant entry as Pi writes one: an answer that ended its turn (`stop`), or a turn that stopped in a tool call. */
const assistantEntry = (id: string, stopReason: 'stop' | 'toolUse') => ({
	type: 'message',
	id,
	parentId: null,
	timestamp: '2026-11-16T00:00:02.000Z',
	message: {
		role: 'assistant',
		content:
			stopReason === 'stop' ? [{ type: 'text', text: 'The work.' }] : [{ type: 'toolCall', id: 'call_1|fc_1', name: 'run_command', arguments: {} }],
		stopReason,
		timestamp: 2
	}
});
/** ⭐ The review's re-check (A) — an assistant entry with the text it says, `''` saying none, ended as `stopReason` says. */
const assistantSaying = (id: string, stopReason: 'stop' | 'length' | 'toolUse' | 'error' | 'aborted', text: string) => ({
	type: 'message',
	id,
	parentId: null,
	timestamp: '2026-11-16T00:00:02.000Z',
	message: { role: 'assistant', content: text === '' ? [] : [{ type: 'text', text }], stopReason, timestamp: 2 }
});
/** ⭐ The review's defect 1 — a fork as Pi writes one (`forkFrom`): a header naming its parent, the parent's entries copied whole, then its own. */
function forkedFile(folder: string, name: string, parent: string, own: readonly Record<string, unknown>[]): string {
	mkdirSync(folder, { recursive: true });
	const copied = readFileSync(parent, 'utf8')
		.trim()
		.split('\n')
		.map((l) => JSON.parse(l) as Record<string, unknown>)
		.filter((e) => e.type !== 'session');
	const header = { type: 'session', version: 3, id: name.replace('.jsonl', ''), timestamp: '2026-11-16T00:00:00.000Z', cwd: ROOT, parentSession: parent };
	const file = join(folder, name);
	writeFileSync(file, `${[header, ...copied, ...own].map((e) => JSON.stringify(e)).join('\n')}\n`);
	return file;
}
/** What a file holding one plain user turn holds: no answer, no findings, no feedback (the review's defects 1 and 8). */
const HOLDS_A_TURN = { returnedAnswer: false, ownFindings: false, crossUnitFeedback: false } as const;
/** ⭐ The lead's ruling (e) on the review's third re-check — what a reader reads from `file`, or, where it refuses, its refusal's words. */
function readOrRefusal<T>(file: string, read: (file: string) => T): T | string {
	try {
		return read(file);
	} catch (e) {
		return e instanceof Error ? e.message : String(e);
	}
}

describe('⭐⭐ L17b1 (D85) — the sessions root and a session’s folder', () => {
	it('⛔ RED FIRST — the root is `<D>.sessions`, only for a process that declares itself serving with a store; else none, and every session is held in memory', () => {
		expect(
			[
				durableSessionsRoot({ RPH_DEMO_MODE: 'server', JPWB_DEMO_DB: join(ROOT, 'demo.sqlite') }),
				durableSessionsRoot({ RPH_DEMO_MODE: 'test', JPWB_DEMO_DB: join(ROOT, 'demo.sqlite') }),
				durableSessionsRoot({ RPH_DEMO_MODE: 'server' }),
				durableSessionsRoot({})
			],
			'the sessions root is not `<D>.sessions` under the serving declaration alone'
		).toEqual([`${join(ROOT, 'demo.sqlite')}.sessions`, undefined, undefined, undefined]);
	});

	it('⛔ RED FIRST — a unit’s folder is `executor/<unit id>`, a round’s helpers’ `hypothesizer/<round id>` and `unsticking/<round id>`; an id that is not one segment, or a root that is not absolute, is refused', () => {
		const root = sessionsRoot();
		expect(
			[sessionFolderOf(root, 'executor', 'pwu_1'), sessionFolderOf(root, 'hypothesizer', 'asm_1'), sessionFolderOf(root, 'unsticking', 'asm_1')],
			'the folders are not the role’s and the id’s, under the root'
		).toEqual([resolve(root, 'executor', 'pwu_1'), resolve(root, 'hypothesizer', 'asm_1'), resolve(root, 'unsticking', 'asm_1')]);
		for (const id of ['', '../pwu_1', 'a/b'])
			expect(() => sessionFolderOf(root, 'executor', id), `the id ${JSON.stringify(id)} named a folder`).toThrow(
				'cannot name a session folder'
			);
		expect(() => sessionFolderOf('relative/demo.sqlite.sessions', 'executor', 'pwu_1'), 'a relative root named a folder').toThrow(
			'cannot be a sessions root'
		);
	});
});

describe('⭐⭐ L17b1 (D85; REG-D-169) — where a unit’s step opens its executor session', () => {
	// ⭐ RESTATED IN FORM 2026-11-17 (package L17b3, D89): a place is the unit's alone — ~~`executorSessionPlaceOf(undefined, 'pwu_1', undefined)`~~,
	// ~~`executorSessionPlaceOf(undefined, 'pwu_2', 'pwu_1')`~~ — no predecessor is handed in, since nothing forks; the replacement's limb kept, a
	// replacement a unit like any other.
	it('⭑ CONTROL — with no durable store, the session is held in memory, byte for byte as before', () => {
		expect(executorSessionPlaceOf(undefined, 'pwu_1'), 'a store with no durable path keeps no session file').toEqual({
			kind: 'IN_MEMORY'
		});
		expect(executorSessionPlaceOf(undefined, 'pwu_2'), 'a replacement with no durable path keeps none either').toEqual({
			kind: 'IN_MEMORY'
		});
	});

	it('⛔ RED FIRST — a unit’s first step opens a NEW file in its folder; a later step REOPENS its one file; two files are refused, naming the folder', () => {
		const root = sessionsRoot();
		const folder = sessionFolderOf(root, 'executor', 'pwu_1');

		// ⭐ L17b3 (D89) — each call restated in form: ~~`executorSessionPlaceOf(root, 'pwu_1', undefined)`~~, the predecessor no argument.
		expect(executorSessionPlaceOf(root, 'pwu_1'), 'a unit’s first step does not open a new file').toEqual({
			kind: 'DURABLE',
			folder,
			opening: { kind: 'NEW' }
		});
		const first = sessionFile(folder, '2026-11-16T00-00-00-000Z_aaa.jsonl', [userEntry('u1', 'Write the Source.')]);
		expect(executorSessionPlaceOf(root, 'pwu_1'), 'a later step does not reopen the unit’s one file').toEqual({
			kind: 'DURABLE',
			folder,
			// ⭐ RESTATED for the review's defects 1 and 8: the place carries what the file holds, read from it — here one user turn, no answer.
			opening: { kind: 'REOPEN', file: first, held: HOLDS_A_TURN }
		});
		sessionFile(folder, '2026-11-16T00-00-01-000Z_bbb.jsonl', []);
		expect(executorSessionPlaceOf(root, 'pwu_1'), 'two session files were not refused').toEqual({
			refusedBecause: twoSessionFilesRefusal(folder, 2)
		});
		expect(twoSessionFilesRefusal(folder, 2), 'the refusal does not name the folder').toContain(folder);
		expect(sessionFilesIn(folder).length, 'arrangement: the folder holds two files').toBe(2);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173`): ~~'⛔ RED FIRST — a replacement’s first step FORKS its
	// predecessor’s one file; with none, it starts NEW and says whose session it lacks; two are refused'~~, its places ~~`{ kind: 'NEW',
	// predecessorWithoutSession: 'pwu_1' }`~~ and ~~`{ kind: 'FORK', from: file, predecessorId: 'pwu_1', heldFindings: false, returnedAnswer: false }`~~,
	// and its refusal of two predecessor files ~~`{ refusedBecause: twoSessionFilesRefusal(theirs, 2) }`~~ — nothing forks since D89: a replacement's
	// first step opens a NEW file in its own folder whatever its predecessor's folder holds, which no step reads, and which is left byte for byte. The
	// promise kept: a replacement's first step opens its session in its own folder, the predecessor's never written to.
	it('⭐ a replacement’s first step opens a NEW file in its own folder, whatever its predecessor’s folder holds — none, one or two — and leaves that folder byte for byte (D89)', () => {
		const root = sessionsRoot();
		const own = sessionFolderOf(root, 'executor', 'pwu_2');
		const theirs = sessionFolderOf(root, 'executor', 'pwu_1');
		const NEW = { kind: 'DURABLE', folder: own, opening: { kind: 'NEW' } };

		expect(executorSessionPlaceOf(root, 'pwu_2'), 'a replacement whose predecessor left no file did not open a new file of its own').toEqual(NEW);
		const file = sessionFile(theirs, '2026-11-16T00-00-00-000Z_aaa.jsonl', [userEntry('u1', 'Write the Source.')]);
		const before = readFileSync(file, 'utf8');
		expect(executorSessionPlaceOf(root, 'pwu_2'), 'a replacement whose predecessor left a file did not open a new file of its own').toEqual(NEW);
		sessionFile(theirs, '2026-11-16T00-00-01-000Z_bbb.jsonl', []);
		expect(executorSessionPlaceOf(root, 'pwu_2'), 'a replacement whose predecessor left two files did not open a new file of its own').toEqual(NEW);
		expect([readFileSync(file, 'utf8'), sessionFilesIn(theirs).length], 'the predecessor’s folder was changed').toEqual([before, 2]);
	});

	// ⭐ RESTATED IN FORM 2026-11-17 (package L17b3, D89): ~~`executorSessionPlaceOf(root, 'pwu_2', 'pwu_1')`~~, the predecessor no argument.
	it('⭑ CONTROL — a replacement’s later step reopens its own file, never its predecessor’s', () => {
		const root = sessionsRoot();
		sessionFile(sessionFolderOf(root, 'executor', 'pwu_1'), '2026-11-16T00-00-00-000Z_aaa.jsonl', [userEntry('u1', 'Write the Source.')]);
		const mine = sessionFile(sessionFolderOf(root, 'executor', 'pwu_2'), '2026-11-16T00-00-02-000Z_ccc.jsonl', [userEntry('u2', 'Again.')]);
		expect(executorSessionPlaceOf(root, 'pwu_2'), 'the replacement’s own file is not the one reopened').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', 'pwu_2'),
			opening: { kind: 'REOPEN', file: mine, held: HOLDS_A_TURN }
		});
	});

	it('⛔ RED FIRST — a folder that exists and cannot be listed is not "no session": the place refuses, naming the folder and why; only a folder that does not exist is none (the review’s defect 3)', () => {
		const root = sessionsRoot();
		mkdirSync(join(root, 'executor'), { recursive: true });
		const own = sessionFolderOf(root, 'executor', 'pwu_1');
		writeFileSync(own, 'a file where the unit’s folder should be');
		expect(() => executorSessionPlaceOf(root, 'pwu_1'), 'a folder that cannot be listed read as holding no session').toThrow(
			`the session folder ${own} cannot be listed`
		);
		// ⭐ RESTATED 2026-11-17 (package L17b3, D89): ~~`expect(() => executorSessionPlaceOf(root, 'pwu_10', 'pwu_9'), 'a predecessor’s folder that cannot be
		// listed read as one that left no session').toThrow(`the session folder ${theirs} cannot be listed`)`~~ — no step lists a predecessor's folder since
		// D89: the replacement opens a new file of its own, whatever that folder is.
		const theirs = sessionFolderOf(root, 'executor', 'pwu_9');
		writeFileSync(theirs, 'a file where the predecessor’s folder should be');
		expect(executorSessionPlaceOf(root, 'pwu_10'), 'a replacement read its predecessor’s folder').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', 'pwu_10'),
			opening: { kind: 'NEW' }
		});
		expect(sessionFilesIn(join(root, 'executor', 'pwu_none')), 'a folder that does not exist is not read as none').toEqual([]);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89): ~~'… and the conversation it was forked from (the review’s defects 1 and
	// 8)'~~, the two forks' holdings ~~`{ returnedAnswer: false, ownFindings: false, crossUnitFeedback: true, forkedFrom: { predecessorId: 'pwu_1',
	// heldFindings: false, returnedAnswer: true } }`~~ and ~~`{ returnedAnswer: true, ownFindings: false, crossUnitFeedback: false, forkedFrom: {
	// predecessorId: 'pwu_5', heldFindings: true, returnedAnswer: false } }`~~, the reopened fork's place ~~`{ kind: 'REOPEN', file: forked, held:
	// sessionFileHoldings(forked) }`~~ and the stopped try's fork ~~`{ kind: 'FORK', from: stopped, predecessorId: 'pwu_3', heldFindings: false,
	// returnedAnswer: false }`~~ — no step forks since D89, and a file whose header names a parent, which only package L17b1's fork wrote, is refused,
	// naming it and its parent, never read as the unit's own. The promise kept: what a unit's own file holds is read from it, and one that cannot be read
	// refuses.
	it('⛔ RED FIRST — what a reopened file holds is read from it: its own answer or none, its findings, D77’s feedback; ~~and the conversation it was forked from~~ ⭐ a file whose header names a parent refused, naming it and its parent (the review’s defects 1 and 8; D89)', () => {
		const root = sessionsRoot();
		const parent = sessionFile(sessionFolderOf(root, 'executor', 'pwu_1'), 'p.jsonl', [userEntry('u1', 'Write the Source.'), assistantEntry('a1', 'stop')]);
		const forked = forkedFile(sessionFolderOf(root, 'executor', 'pwu_2'), 'f.jsonl', parent, [
			userEntry('u2', `Write the Source.\n\n${FEEDBACK_HEADING}\n- Chapter art_1:`),
			assistantEntry('a2', 'toolUse')
		]);
		// ⭑ A conversation that carried a re-run's findings and returned nothing — stopped in a tool call — and a fork of it that answered.
		const carried = sessionFile(sessionFolderOf(root, 'executor', 'pwu_5'), 'c.jsonl', [
			userEntry('u1', `Write the Tests.\n\n${CARRIED_FINDINGS_LINE}\n- C1: no.`),
			assistantEntry('a1', 'toolUse')
		]);
		const forkedAnswered = forkedFile(sessionFolderOf(root, 'executor', 'pwu_6'), 'g.jsonl', carried, [
			userEntry('u2', 'Write the Tests.'),
			assistantEntry('a2', 'stop')
		]);
		// ⭑ The unit's own repair turn: a second user turn.
		const repaired = sessionFile(sessionFolderOf(root, 'executor', 'pwu_7'), 'r.jsonl', [
			userEntry('u1', 'Write the Docs.'),
			assistantEntry('a1', 'stop'),
			userEntry('u2', 'Produce it again.'),
			assistantEntry('a2', 'stop')
		]);
		const absent = join(root, 'absent.jsonl');

		// ⭐ RESTATED 2026-11-17 (the lead's ruling (e) on the review's third re-check): a file the step would reopen or fork that cannot be read refuses the
		// step, naming it and why — read neither as holding everything nor as holding no findings. Each reader is read through `readOrRefusal`; the
		// superseded words, struck: ~~`.map((f) => sessionFileHoldings(f))`~~; ~~`// ⭑ What cannot be read is held to hold everything: declared, never said
		// short.`~~ ~~`{ returnedAnswer: true, ownFindings: true, crossUnitFeedback: true }`~~; ~~`[historyAnswered(parent), historyAnswered(carried),
		// historyAnswered(absent)]`~~, ~~'whether each conversation returned a work product, one that cannot be read held to have'~~,
		// ~~`.toEqual([true, false, true])`~~.
		expect(
			[parent, forked, carried, forkedAnswered, repaired, absent].map((f) => readOrRefusal(f, sessionFileHoldings)),
			'what each file holds, a file naming a parent refused'
		).toEqual([
			{ returnedAnswer: true, ownFindings: false, crossUnitFeedback: false },
			// ⭐ L17b3 (D89) — a file whose header names a parent refuses, naming it and its parent.
			expect.stringContaining(`the session file ${forked} names a parent session (${parent})`),
			{ returnedAnswer: false, ownFindings: true, crossUnitFeedback: false },
			expect.stringContaining(`the session file ${forkedAnswered} names a parent session (${carried})`),
			{ returnedAnswer: true, ownFindings: true, crossUnitFeedback: false },
			// ⭑ What cannot be read refuses, naming it and why.
			expect.stringContaining(`the session file ${absent} cannot be read (ENOENT: `)
		]);
		// ⭐ L17b3 (D89) — struck with the fork's reader: ~~`expect([historyAnswered(parent), historyAnswered(carried), readOrRefusal(absent,
		// historyAnswered)], 'whether each conversation returned a work product, one that cannot be read refused').toEqual([true, false,
		// expect.stringContaining(…)])`~~ — its promise is the `returnedAnswer` above, each file's own.
		expect(parentedSessionFileRefusal(forked, parent), 'the refusal of a file naming a parent').toBe(
			`the session file ${forked} names a parent session (${parent}): a fork of another unit's session, which no step makes since design D89 — refused rather than read as this unit's own (design D89).`
		);
		expect(() => executorSessionPlaceOf(root, 'pwu_2'), 'a reopened fork was read as the unit’s own').toThrow(parentedSessionFileRefusal(forked, parent));
		// ⭑ A predecessor whose try stopped in its first tool call: its replacement opens a new file of its own (D89).
		sessionFile(sessionFolderOf(root, 'executor', 'pwu_3'), 's.jsonl', [userEntry('u1', 'Write the Tests.'), assistantEntry('a1', 'toolUse')]);
		expect(executorSessionPlaceOf(root, 'pwu_4'), 'the replacement of a stopped try did not open a new file of its own').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', 'pwu_4'),
			opening: { kind: 'NEW' }
		});
	});

	it('⛔ RED FIRST — an answer is read as the adapter reads one, by its text whatever its stop: a `length` answer is held, an empty or blank `stop` is none (the review’s re-check, A)', () => {
		const root = sessionsRoot();
		const own = (unitId: string, answer: Record<string, unknown>) =>
			sessionFile(sessionFolderOf(root, 'executor', unitId), 's.jsonl', [userEntry('u1', 'Write the Source.'), answer]);
		const cut = own('pwu_cut', assistantSaying('a1', 'length', '{"workProduct": {"document": "The reader reads the whole inp'));
		const silent = own('pwu_silent', assistantSaying('a1', 'stop', ''));
		const blank = own('pwu_blank', assistantSaying('a1', 'stop', '  \n '));

		expect(
			[cut, silent, blank].map((f) => sessionFileHoldings(f).returnedAnswer),
			'an answer cut at the length limit read as none, or a stop that said nothing read as an answer'
		).toEqual([true, false, false]);
		// ⭐ RESTATED IN FORM 2026-11-17 (package L17b3, D89) — the fork's limbs struck, with the fork: ~~`expect([cut, silent, blank].map((f) =>
		// historyAnswered(f)), 'a forked conversation’s answer read by its stop').toEqual([true, false, false])`~~; ~~`expect(executorSessionPlaceOf(root,
		// 'pwu_next', 'pwu_cut'), 'the fork of a cut answer is said to hold no work product').toEqual({ …, opening: { kind: 'FORK', from: cut, predecessorId:
		// 'pwu_cut', heldFindings: false, returnedAnswer: true } })`~~. The promise kept: the unit's own file's answer, read by its text, above.
	});

	it('⛔ RED FIRST — what a session holds is what Pi will send: a message Pi does not replay, `aborted` or `error`, holds no answer, whatever its text (the lead’s ruling on the re-check’s A)', () => {
		const root = sessionsRoot();
		const own = (unitId: string, answer: Record<string, unknown>) =>
			sessionFile(sessionFolderOf(root, 'executor', unitId), 's.jsonl', [userEntry('u1', 'Write the Source.'), answer]);
		const aborted = own('pwu_aborted', assistantSaying('a1', 'aborted', '{"workProduct": {"document": "The reader reads the whole inp'));
		const errored = own('pwu_errored', assistantSaying('a1', 'error', '{"workProduct": {"document": "The reader reads a pipe."}}'));

		expect(
			[aborted, errored].map((f) => sessionFileHoldings(f).returnedAnswer),
			'a message Pi does not replay read as an answer the session holds'
		).toEqual([false, false]);
		// ⭐ RESTATED IN FORM 2026-11-17 (package L17b3, D89) — the fork's limbs struck, with the fork: ~~`expect([aborted, errored].map((f) =>
		// historyAnswered(f)), 'a forked conversation’s unreplayed message read as its answer').toEqual([false, false])`~~;
		// ~~`expect(executorSessionPlaceOf(root, 'pwu_next', 'pwu_errored'), 'the fork of an errored answer is said to hold a work product').toEqual({ …,
		// opening: { kind: 'FORK', from: errored, predecessorId: 'pwu_errored', heldFindings: false, returnedAnswer: false } })`~~. The promise kept: the
		// unit's own file, above.
		// ⭑ CONTROL: the same text, ended as Pi replays it, is an answer the session holds.
		const kept = own('pwu_kept', assistantSaying('a1', 'length', '{"workProduct": {"document": "The reader reads the whole inp'));
		expect(sessionFileHoldings(kept).returnedAnswer, 'arrangement: a replayed message with that text is an answer').toBe(true);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89): ~~'⛔ RED FIRST — a forked history is said to hold review findings when
	// it holds a second user turn, or a first turn carrying findings; else not'~~, ~~`.map((f) => readOrRefusal(f, forkedHistoryHeldFindings))`~~,
	// ~~`.toEqual([false, true, true, true, expect.stringContaining(…)])`~~ — the forked history's reader goes with the fork. The promise kept, of a unit's
	// own file as its later step reopens it: a second user turn and RD8's carried findings are its own findings, D77's feedback the loop's, a plain turn
	// neither, and an unreadable file refuses.
	it('⭑ CONTROL — a unit’s own file is read to hold its own findings when it holds a second user turn, or a first turn carrying findings; D77’s feedback as the loop’s; else neither (D89)', () => {
		const folder = join(sessionsRoot(), 'held');
		const plain = sessionFile(folder, 'plain.jsonl', [userEntry('u1', 'Write the Source.')]);
		const repaired = sessionFile(folder, 'repaired.jsonl', [userEntry('u1', 'Write the Source.'), userEntry('u2', 'Produce it again.')]);
		const carried = sessionFile(folder, 'carried.jsonl', [userEntry('u1', `Write the Source.\n\n${CARRIED_FINDINGS_LINE}\n- C1: no.`)]);
		const fed = sessionFile(folder, 'fed.jsonl', [userEntry('u1', `Write the Source.\n\n${FEEDBACK_HEADING}\n- Chapter art_1:`)]);
		// ⭐ RESTATED 2026-11-17 (the lead's ruling (e) on the review's third re-check): a predecessor's file that cannot be read refuses the step, naming it
		// and why — never read as holding no findings. The superseded words, struck: ~~`.map((f) => forkedHistoryHeldFindings(f))`~~,
		// ~~`.toEqual([false, true, true, true, false])`~~.
		const absent = join(folder, 'absent.jsonl');
		/** A file's own findings and the loop's feedback, as the reader holds them, or its refusal's words. */
		const findingsOf = (f: string) => {
			const held = readOrRefusal(f, sessionFileHoldings);
			return typeof held === 'string' ? held : [held.ownFindings, held.crossUnitFeedback];
		};
		expect(
			[plain, repaired, carried, fed, absent].map(findingsOf),
			'which files hold findings: a plain turn, a repair turn, RD8’s carried findings, D77’s feedback, an unreadable file'
		).toEqual([
			[false, false],
			[true, false],
			[true, false],
			[false, true],
			expect.stringContaining(`the session file ${absent} cannot be read (ENOENT: `)
		]);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89): ~~'⛔ RED FIRST — a session file the step would reopen or fork that cannot
	// be read refuses the step, naming it and why — never read as holding everything, nor as holding no findings; a reopened fork whose parent cannot be
	// read is held, as before, to hold everything its parent could (…)'~~, its fork limb ~~`expect(() => executorSessionPlaceOf(root, 'pwu_10', 'pwu_9'),
	// 'a predecessor’s file the step would fork read though it cannot be').toThrow(…)`~~, its readers ~~`readOrRefusal(theirs, historyAnswered)`~~ and
	// ~~`readOrRefusal(theirs, forkedHistoryHeldFindings)`~~, and its CONTROL ~~'a reopened fork whose parent cannot be read refused, or held short'~~
	// ~~`.toEqual({ returnedAnswer: false, ownFindings: true, crossUnitFeedback: false, forkedFrom: { predecessorId: 'pwu_3', heldFindings: true,
	// returnedAnswer: true } })`~~ — no step forks or reads a predecessor's file since D89, and a file naming a parent is refused whether its parent is
	// there or gone. The promise kept: a file the step would reopen that cannot be read refuses the step, naming it and why, by every reader left.
	it('⛔ RED FIRST — a session file the step would reopen that cannot be read refuses the step, naming it and why — never read as holding everything, nor as holding no findings; ~~a reopened fork whose parent cannot be read is held, as before, to hold everything its parent could~~ ⭐ a file naming a parent, its parent gone, refused as a fork (the lead’s ruling (e) on the review’s third re-check; D89)', () => {
		const root = sessionsRoot();
		// ⭑ A file that cannot be read: a folder where Pi's file would be, named as Pi names one, so the folder's listing finds it and its read fails.
		const unreadable = (unitId: string): string => {
			const file = join(sessionFolderOf(root, 'executor', unitId), '2026-11-16T00-00-00-000Z_aaa.jsonl');
			mkdirSync(file, { recursive: true });
			return file;
		};
		const own = unreadable('pwu_1');
		expect(() => executorSessionPlaceOf(root, 'pwu_1'), 'a file the step would reopen read though it cannot be').toThrow(
			`the session file ${own} cannot be read (EISDIR: `
		);
		const theirs = unreadable('pwu_9');
		// ⭑ D91's reader of a reopened file refuses one that cannot be read as well: `reviewedTryHeld`'s own test, below.
		expect(
			[readOrRefusal(own, sessionFileHoldings), readOrRefusal(theirs, sessionFileHoldings)],
			'a reader read a file that cannot be read as holding everything, or as holding no findings'
		).toEqual([
			expect.stringContaining(`the session file ${own} cannot be read (EISDIR: `),
			expect.stringContaining(`the session file ${theirs} cannot be read (EISDIR: `)
		]);
		// ⭐ L17b3 (D89) — a reopened fork whose parent's file is gone is refused as any fork is: its header names a parent, whatever is left of it.
		const parent = sessionFile(sessionFolderOf(root, 'executor', 'pwu_3'), 'p.jsonl', [userEntry('u1', 'Write the Source.')]);
		const forked = forkedFile(sessionFolderOf(root, 'executor', 'pwu_4'), 'f.jsonl', parent, [userEntry('u2', 'Write the Source.')]);
		rmSync(parent);
		expect(readOrRefusal(forked, sessionFileHoldings), 'a reopened fork whose parent is gone was read as the unit’s own').toEqual(
			expect.stringContaining(`the session file ${forked} names a parent session (${parent})`)
		);
	});

	it('⛔ RED FIRST — each refusal describes whatever value its read threw, through the one describer and the one reader of a code: a value that cannot be described, or a revoked Proxy, is said to be one, never thrown (the lead’s ruling (k) on the review’s fifth re-check)', () => {
		const revoked = Proxy.revocable(new Error('behind a proxy'), {});
		revoked.revoke();
		/** A refusal's words, or what it threw, as the test can say it: never a throw of the test's own. */
		const saidBy = (refuse: () => string): string => {
			try {
				return refuse();
			} catch (e) {
				try {
					return `threw: ${e instanceof Error ? e.message : String(e)}`;
				} catch {
					return 'threw: (a value the test cannot describe)';
				}
			}
		};
		const LISTED = 'the session folder the-folder cannot be listed (an error: a thrown value that cannot be described), so whether it holds a session cannot be told: refused rather than read as holding none (design D85).';
		const READ = 'the session file the-file.jsonl cannot be read (an error: a thrown value that cannot be described), so what it holds cannot be told: refused rather than read as holding everything or as holding no findings (design D85).';

		expect(
			[Object.create(null), revoked.proxy].flatMap((v) => [
				saidBy(() => unlistableSessionFolderRefusal('the-folder', v)),
				saidBy(() => unreadableSessionFileRefusal('the-file.jsonl', v))
			]),
			'a refusal threw on the value its read threw, or said it wrongly'
		).toEqual([LISTED, READ, LISTED, READ]);
	});

	it('⛔ RED FIRST — the listing’s failure is classified through the one reader of a code: a listing that throws a revoked Proxy, null or undefined refuses, naming the folder and why; an ENOENT still reads as no session (the lead’s ruling (m) on the review’s sixth re-check)', () => {
		const revoked = Proxy.revocable(new Error('behind a proxy'), {});
		revoked.revoke();
		const enoent = Object.assign(new Error("ENOENT: no such file or directory, scandir 'the-folder'"), { code: 'ENOENT' });
		/** The folder's files as `sessionFilesIn` reads them through a listing that throws `thrown`, or its refusal's words: never a throw of the test's own. */
		const listedWhenItThrows = (thrown: unknown): readonly string[] | string => {
			try {
				return sessionFilesIn('the-folder', () => {
					throw thrown;
				});
			} catch (e) {
				try {
					return e instanceof Error ? e.message : String(e);
				} catch {
					return '(a value the test cannot describe)';
				}
			}
		};
		const refused = (why: string) =>
			`the session folder the-folder cannot be listed (an error: ${why}), so whether it holds a session cannot be told: refused rather than read as holding none (design D85).`;

		expect(
			[revoked.proxy, null, undefined, enoent].map((v) => listedWhenItThrows(v)),
			'a listing that threw read as no session, or refused without naming the folder and why'
		).toEqual([refused('a thrown value that cannot be described'), refused('null'), refused('undefined'), []]);
	});
});

describe('⭐⭐ L17b1 (D85, the lead’s ruling) — a call its stopped step never answered is given a recorded result on reopening', () => {
	/** The part of Pi's manager the supply reads and appends to, over a branch the case writes. */
	const branchOf = (messages: readonly Record<string, unknown>[]) => {
		const appended: Record<string, unknown>[] = [];
		return {
			appended,
			session: {
				getBranch: () => messages.map((message) => ({ type: 'message', message })),
				appendMessage: (m: never) => {
					appended.push(m as unknown as Record<string, unknown>);
					return `e${appended.length}`;
				}
			}
		};
	};
	const call = (id: string) => ({ type: 'toolCall', id, name: 'run_command', arguments: { argv: ['node', '--version'] } });

	it('⛔ RED FIRST — each call of the last assistant turn with no result gets one, `isError`, saying the stop cut it off; an answered call gets none', () => {
		const { session, appended } = branchOf([
			{ role: 'user', content: [{ type: 'text', text: 'Write the Source.' }] },
			{ role: 'assistant', content: [call('call_1|fc_1'), call('call_2|fc_2')], stopReason: 'toolUse' },
			{ role: 'toolResult', toolCallId: 'call_1|fc_1', toolName: 'run_command', content: [{ type: 'text', text: 'v24' }], isError: false }
		]);

		expect(supplyCutOffResults(session, () => 7), 'the count of calls given a result').toBe(1);
		expect(appended, 'the unanswered call was not given the cut-off result').toEqual([
			{ role: 'toolResult', toolCallId: 'call_2|fc_2', toolName: 'run_command', content: [{ type: 'text', text: CUT_OFF_RESULT }], isError: true, timestamp: 7 }
		]);
		expect(CUT_OFF_RESULT, 'the result does not say the stop cut the call off').toContain('cut off');
	});

	it('⭑ CONTROL — a turn that ended in an error or was aborted, a turn with no call, and a session with no answer are given none', () => {
		for (const last of [
			{ role: 'assistant', content: [call('call_1')], stopReason: 'error' },
			{ role: 'assistant', content: [call('call_1')], stopReason: 'aborted' },
			{ role: 'assistant', content: [{ type: 'text', text: 'Done.' }], stopReason: 'stop' }
		]) {
			const { session, appended } = branchOf([{ role: 'user', content: [{ type: 'text', text: 'Write.' }] }, last]);
			expect([supplyCutOffResults(session), appended.length], `a ${String(last.stopReason)} turn was given a result`).toEqual([0, 0]);
		}
		const { session, appended } = branchOf([{ role: 'user', content: [{ type: 'text', text: 'Write.' }] }]);
		expect([supplyCutOffResults(session), appended.length], 'a session with no answer was given a result').toEqual([0, 0]);
	});
});

// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173`): ~~'⭐⭐ L17b1 (D85) — a replacement whose predecessor left no
// session records it, for the run report'~~, ~~'⛔ RED FIRST — a note bound to the unit’s name on the content plane, naming its predecessor; recorded
// again, it names the same entry'~~, its body ~~`await recordPredecessorWithoutSession(store, 'tnt-test', { unitId: 'pwu_2', predecessorId: 'pwu_1' });
// const ref = await store.resolveName(predecessorWithoutSessionNameOf('tnt-test', 'pwu_2')); … expect([note.schema, note.unitId, note.predecessorId],
// …).toEqual([PREDECESSOR_WITHOUT_SESSION_SCHEMA, 'pwu_2', 'pwu_1']); expect(String(note.statement), …).toContain('began as a new unit'); …`~~ — the
// note said that a replacement began as a new unit for want of a predecessor's session to fork; since D89 every replacement begins so, so nothing
// is noted, and the note's writer, its name and its schema go with the fork's code. The promise left: none of the three is exported.
describe('⭐⭐ L17b3 (D89) — ~~a replacement whose predecessor left no session records it, for the run report~~ ⭐ no replacement notes a missing fork', () => {
	it('⛔ RED FIRST — the fork’s note is gone with the fork: no writer, name or schema of it is exported', () => {
		const exported = executorSessionModule as unknown as Record<string, unknown>;
		expect(exported.recordPredecessorWithoutSession, 'the fork’s note is still written').toBeUndefined();
		expect(
			['predecessorWithoutSessionNameOf', 'PREDECESSOR_WITHOUT_SESSION_SCHEMA', 'forkedHistoryHeldFindings', 'historyAnswered'].filter((name) => name in exported),
			'the fork’s note or its readers are still exported'
		).toEqual([]);
	});
});

describe('⭐⭐ L17b3 (D89, D91) — what a reopened file holds of the record’s line, and of the reviewed try', () => {
	/** D89's sentence for a line of one unit with a record, a faulty successor's, as a replacement's first turn says it. */
	const LINE =
		'The unit this one replaces, "Source" (pwu_1), was worked on before, and its conversation is on the record. You can read it with the read_earlier_attempt tool. ' +
		'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, ' +
		'so that you do not try it again, unless something material has changed that would let it succeed now.';

	// ⭐⭐ RESTATED 2026-11-18 (`JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 4, §16; the independent review's L17C-04): ~~'… holds the line, so a
	// later step on it does not say it again; a file told nothing of a record holds no line (D89)'~~, read by ~~a phrase found anywhere in a turn
	// (`with the read_earlier_attempt tool`)~~ — the line is held only where a user turn ENDS with the exact sentence the step would say, after the
	// blank line the step puts before it (`sessionFileHoldings(file, sentence)`), or with the no-record sentence as its whole last paragraph. The
	// promise kept: a file whose first turn said the line holds it, and a file told nothing of a record holds none.
	it('⛔ RED FIRST — a file whose first turn ENDS with the line’s exact sentence — or with the no-record sentence as its last paragraph — holds the line, so a later step on it does not say it again; a turn that only mentions the tool, or holds the sentence elsewhere, or another line’s, holds none (D89; the lead’s ruling 4)', () => {
		const folder = join(sessionsRoot(), 'line');
		const told = sessionFile(folder, 'told.jsonl', [
			userEntry('u1', `Write the Source.\n\n${FEEDBACK_HEADING}\n- Chapter art_1:\n\n${LINE}`),
			assistantEntry('a1', 'stop')
		]);
		const toldNone = sessionFile(folder, 'none.jsonl', [
			userEntry('u1', `Write the Source.\n\n${FEEDBACK_HEADING}\n- Chapter art_1:\n\nThe unit this one replaces left no recorded conversation.`),
			assistantEntry('a1', 'stop')
		]);
		const plain = sessionFile(folder, 'plain.jsonl', [userEntry('u1', 'Write the Source.'), assistantEntry('a1', 'stop')]);
		// ⭐ The lead's ruling 4 — a turn that only MENTIONS the tool (an instruction about it, under a narrower grant that said no sentence); one that
		// holds the sentence and goes on after it; and one that ends with another line's sentence.
		const mentions = sessionFile(folder, 'mentions.jsonl', [
			userEntry('u1', 'Write the Source. Document how to work with the read_earlier_attempt tool.'),
			assistantEntry('a1', 'stop')
		]);
		const within = sessionFile(folder, 'within.jsonl', [userEntry('u1', `Write the Source.\n\n${LINE}\n\nThen write the Tests.`), assistantEntry('a1', 'stop')]);
		const another = sessionFile(folder, 'another.jsonl', [userEntry('u1', `Write the Source.\n\n${LINE.replace('pwu_1', 'pwu_9')}`), assistantEntry('a1', 'stop')]);
		// ~~`expect(sessionFileHoldings(told).heldLine, …).toBe(true)`~~ — the sentence the step would say, given:
		expect(sessionFileHoldings(told, LINE).heldLine, 'a file whose first turn ended with the line’s sentence is not read to hold the line').toBe(true);
		expect(
			// ~~`[sessionFileHoldings(toldNone).heldLine, sessionFileHoldings(plain).heldLine]`~~
			[sessionFileHoldings(toldNone, LINE).heldLine, sessionFileHoldings(plain, LINE).heldLine],
			'a file told that no record was left, or told nothing of a record, read to hold the line'
		).toEqual([true, undefined]);
		expect(
			[mentions, within, another].map((f) => sessionFileHoldings(f, LINE).heldLine),
			'a turn that only mentions the tool, holds the sentence elsewhere, or ends with another line’s, read to hold the line (the lead’s ruling 4)'
		).toEqual([undefined, undefined, undefined]);
		expect(sessionFileHoldings(told).heldLine, 'a file read with no sentence to say held the line by its record sentence (the lead’s ruling 4)').toBeUndefined();
	});

	it('⛔ RED FIRST — whether a reopened file holds the reviewed answer is asked of its messages after the reviewed try’s own turn: each that carried text replayed, HELD; any not, NOT_HELD; the turn not in the file, NOT_SHOWN; a file that cannot be read refuses (D91)', () => {
		const folder = join(sessionsRoot(), 'reviewed');
		const TURN = 'Write the Tests.';
		const held = sessionFile(folder, 'held.jsonl', [userEntry('u1', TURN), assistantSaying('a1', 'stop', 'The tests.')]);
		const ended = sessionFile(folder, 'ended.jsonl', [userEntry('u1', TURN), assistantSaying('a1', 'error', 'The tests, cut.')]);
		const aborted = sessionFile(folder, 'aborted.jsonl', [userEntry('u1', TURN), assistantSaying('a1', 'aborted', 'The tests, cut.')]);
		// ⭑ A reply Pi dropped to go on, kept in its history: the answer may have been gathered from it (an answer recorded before D92).
		const dropped = sessionFile(folder, 'dropped.jsonl', [
			userEntry('u1', TURN),
			assistantSaying('a1', 'error', 'PARTIAL '),
			assistantSaying('a2', 'stop', 'The tests.')
		]);
		// ⭑ An errored message with no text carried none into the answer.
		const silent = sessionFile(folder, 'silent.jsonl', [userEntry('u1', TURN), assistantSaying('a1', 'error', ''), assistantSaying('a2', 'stop', 'The tests.')]);
		// ⭑ An earlier answer held and the reviewed one not: never asked of the history as a whole.
		const earlier = sessionFile(folder, 'earlier.jsonl', [
			userEntry('u0', 'Write the Source.'),
			assistantSaying('a0', 'stop', 'The Source.'),
			userEntry('u1', TURN),
			assistantSaying('a1', 'error', 'The tests, cut.')
		]);
		const elsewhere = sessionFile(folder, 'elsewhere.jsonl', [userEntry('u0', 'Write the Source.'), assistantSaying('a0', 'stop', 'The Source.')]);
		const absent = join(folder, 'absent.jsonl');
		// ⭐ The independent review's L17-09 — two user entries equal to the reviewed turn: no single match, so which try was reviewed cannot be shown.
		const twice = sessionFile(folder, 'twice.jsonl', [
			userEntry('u1', TURN),
			assistantSaying('a1', 'stop', 'The tests.'),
			userEntry('u2', TURN),
			assistantSaying('a2', 'stop', 'The tests again.')
		]);
		// ⭐ L17-09 — the reviewed try's messages end at the next user entry: a later try's errored answer is not the reviewed one's.
		const bounded = sessionFile(folder, 'bounded.jsonl', [
			userEntry('u1', TURN),
			assistantSaying('a1', 'stop', 'The tests.'),
			userEntry('u2', 'Write the Lint.'),
			assistantSaying('a2', 'error', 'The lint, cut.')
		]);

		expect(reviewedTryHeld(held, TURN), 'a file whose reviewed answer Pi replays is not read to hold it').toBe('HELD');
		expect(
			[held, ended, aborted, dropped, silent, earlier, elsewhere, absent].map((f) => readOrRefusal(f, (file) => reviewedTryHeld(file, TURN))),
			'whether each file holds the reviewed answer'
		).toEqual([
			'HELD',
			'NOT_HELD',
			'NOT_HELD',
			'NOT_HELD',
			'HELD',
			'NOT_HELD',
			'NOT_SHOWN',
			expect.stringContaining(`the session file ${absent} cannot be read (ENOENT: `)
		]);
		expect(
			[twice, bounded].map((f) => readOrRefusal(f, (file) => reviewedTryHeld(file, TURN))),
			'a turn found twice was read as one try, or the reviewed try’s messages ran past the next user entry (the review’s L17-09)'
		).toEqual(['NOT_SHOWN', 'HELD']);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 2 (§16; the independent review's L17C-02): A REVIEWED TURN FOLLOWED BY NO MESSAGE THAT
	// CARRIED TEXT before the next user entry shows nothing the session holds of the reviewed answer — the user entry alone, or an answer whose line the
	// reader skips (a truncated line, as Pi itself would skip it) — so it is NOT_SHOWN, and the work is sent again; never HELD.
	it('⛔ RED FIRST — a reviewed turn followed by no message that carried text — the user entry alone, or an answer whose line the reader skips — is NOT_SHOWN, never HELD (the lead’s ruling 2)', () => {
		const folder = join(sessionsRoot(), 'unshown');
		const TURN = 'Write the Tests.';
		const alone = sessionFile(folder, 'alone.jsonl', [userEntry('u1', TURN)]);
		const truncated = sessionFile(folder, 'truncated.jsonl', [userEntry('u1', TURN)]);
		// ⭑ The answer's line cut where a killed write would cut it: JSON that does not parse, which the reader skips, as Pi's own reader does.
		writeFileSync(truncated, `${readFileSync(truncated, 'utf8')}${JSON.stringify(assistantSaying('a1', 'stop', 'The tests.')).slice(0, 60)}\n`);
		expect(
			[alone, truncated].map((f) => reviewedTryHeld(f, TURN)),
			'a reviewed turn followed by no message that carried text was read to hold the reviewed answer'
		).toEqual(['NOT_SHOWN', 'NOT_SHOWN']);
	});
});
