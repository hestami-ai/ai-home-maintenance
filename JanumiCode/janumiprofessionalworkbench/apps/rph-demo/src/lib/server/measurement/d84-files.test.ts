// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1, Q5) — THE MEASUREMENT FOLDER'S FILES: its manifests,
// the record of the sponsor's approval held to a manifest's sha256 (T7), the paid flag (T11), records written once, and the report's mechanical part.
// ⛔ HERMETIC: every folder is a temporary one this file makes; no program runs.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { AssuranceStageDeps } from '../assurance/assurance-stage.js';
import {
	approvalRefusal,
	D84_LAYOUT,
	D84_PAID_VARIABLE,
	manifestDifferences,
	manifestOf,
	paidRefusal,
	readJson,
	recordApproval,
	reserveAttempt,
	roleFolderOf,
	sha256Of,
	takeLock,
	treeEntries,
	writeOnce,
	type Manifest
} from './d84-files.js';
import { D84_DEPARTURES, gatherReport } from './d84-report.js';
import { callRole, type D84Transports } from './d84-roles.js';

const TMP = mkdtempSync(join(tmpdir(), 'jpwb-d84-files-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const fresh = (name: string): string => mkdtempSync(join(TMP, `${name}-`));
const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** A folder showing `files`, its manifest written as a showing writes it. */
function shownFolder(files: Readonly<Record<string, string>>): { readonly folder: string; readonly manifest: Manifest } {
	const folder = fresh('shown');
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, D84_LAYOUT.shown, path, '..'), { recursive: true });
		writeFileSync(join(folder, D84_LAYOUT.shown, path), text);
	}
	const manifest = manifestOf(treeEntries(join(folder, D84_LAYOUT.shown)));
	writeOnce(join(folder, D84_LAYOUT.manifest), manifest);
	return { folder, manifest };
}

describe('⭐ D84 — a manifest: every file and link under a folder by its path and sha256, in code-unit order, and the sha256 of those entries', () => {
	it('⛔ RED FIRST — each file by its bytes, a link by its target’s text and never followed, sorted by code unit; a folder left out; the manifest the sha256 of its entries’ JSON', () => {
		const root = fresh('tree');
		mkdirSync(join(root, 'b', 'deeper'), { recursive: true });
		mkdirSync(join(root, 'linked'));
		mkdirSync(join(root, 'left', 'out'), { recursive: true });
		writeFileSync(join(root, 'b', 'deeper', 'z.txt'), 'z\r\n');
		writeFileSync(join(root, 'B.txt'), Buffer.from([0xff, 0x00]));
		writeFileSync(join(root, 'linked', 'inside.txt'), 'inside');
		writeFileSync(join(root, 'left', 'out', 'gone.txt'), 'gone');
		// ⚠ A junction: Windows makes one with no privilege; elsewhere `symlinkSync` ignores the type (the run archive's own test does the same).
		symlinkSync(join(root, 'linked'), join(root, 'link'), 'junction');
		const entries = treeEntries(root, ['left']);
		// ⭐ RESTATED (r2, `D84R-B03`): ~~`entries.find((e) => e.path === 'link')?.target ?? ''`~~ — the result under test was its own expectation, so a wrong
		// target that was not empty passed. The link's target, read by this test from the file system itself.
		const target = readlinkSync(join(root, 'link'));
		expect(entries, 'the entries are not each file by its bytes and the link by its target’s text, in code-unit order').toEqual([
			{ path: 'B.txt', kind: 'file', bytes: 2, sha256: sha256(Buffer.from([0xff, 0x00])) },
			{ path: 'b/deeper/z.txt', kind: 'file', bytes: 3, sha256: sha256('z\r\n') },
			{ path: 'link', kind: 'link', bytes: Buffer.byteLength(target), sha256: sha256(target), target },
			{ path: 'linked/inside.txt', kind: 'file', bytes: 6, sha256: sha256('inside') }
		]);
		expect(target.length, 'arrangement: the link’s target is read').toBeGreaterThan(0);
		const manifest = manifestOf([...entries].reverse());
		expect(manifest, 'the manifest is not its entries sorted, and the sha256 of their JSON').toEqual({ entries, sha256: sha256(JSON.stringify(entries)) });
	});

	it('⛔ RED FIRST — two manifests’ differences, each path named: one only the approved holds, one only now holds, and one whose bytes differ; none where they agree', () => {
		const a = manifestOf([
			{ path: 'kept', kind: 'file', bytes: 1, sha256: '1'.repeat(64) },
			{ path: 'gone', kind: 'file', bytes: 1, sha256: '2'.repeat(64) },
			{ path: 'moved', kind: 'file', bytes: 1, sha256: '3'.repeat(64) }
		]);
		const b = manifestOf([
			{ path: 'kept', kind: 'file', bytes: 1, sha256: '1'.repeat(64) },
			{ path: 'moved', kind: 'file', bytes: 1, sha256: '4'.repeat(64) },
			{ path: 'new', kind: 'file', bytes: 1, sha256: '5'.repeat(64) }
		]);
		expect(manifestDifferences(a, b)).toEqual([
			'gone: approved, and not there now',
			`moved: its bytes differ from what was approved (sha256 ${'3'.repeat(64)} approved, ${'4'.repeat(64)} now)`,
			'new: not in what was approved'
		]);
		expect(manifestDifferences(a, a), 'a manifest differs from itself').toEqual([]);
	});

	it('⛔ RED FIRST — a record is written once: a second write is refused, the first kept', () => {
		const at = join(fresh('once'), 'record.json');
		writeOnce(at, { first: true });
		expect(() => writeOnce(at, { second: true }), 'a record was written over').toThrow(/EEXIST/);
		expect(readJson(at)).toEqual({ first: true });
		expect(readJson(join(TMP, 'none.json')), 'an absent record is not read as absent').toBeUndefined();
	});
});

describe('⭐⭐ D84 (T7; `REG-D-189` (1)) — the sponsor’s approval, recorded against the sha256 of what was shown', () => {
	it('⛔ RED FIRST — recorded against the manifest shown, with the sponsor’s words, by the lead, once; refused where nothing was shown, where the sha256 is not the manifest’s, and where the words are empty', () => {
		const empty = fresh('nothing-shown');
		expect(recordApproval(empty, { manifestSha256: 'a'.repeat(64), words: 'Approved.', approvedAt: 'now' })).toEqual({
			refusedBecause: 'nothing has been shown here: manifest.json is not written, so there is nothing to approve'
		});
		const { folder, manifest } = shownFolder({ 'prompt.txt': 'the prompt' });
		expect(recordApproval(folder, { manifestSha256: 'a'.repeat(64), words: 'Approved.', approvedAt: 'now' }), 'an approval of another manifest was recorded').toEqual({
			refusedBecause: `the approval names manifest "${'a'.repeat(64)}", and what was shown here is manifest ${manifest.sha256}: an approval is recorded only against what was shown`
		});
		expect(recordApproval(folder, { manifestSha256: manifest.sha256, words: '  ', approvedAt: 'now' }), 'an approval with no words was recorded').toEqual({
			refusedBecause: 'the sponsor’s words are empty: an approval is recorded with what the sponsor said'
		});
		const recorded = recordApproval(folder, { manifestSha256: manifest.sha256, words: 'Approved as shown.', approvedAt: '2026-11-21T12:00:00.000Z' });
		expect(recorded, 'the approval is not recorded as the lead records it').toEqual({
			recorded: { manifestSha256: manifest.sha256, approvedAt: '2026-11-21T12:00:00.000Z', words: 'Approved as shown.', recordedBy: 'the lead' }
		});
		expect(readJson(join(folder, D84_LAYOUT.approval))).toEqual('recorded' in recorded ? recorded.recorded : undefined);
		expect(recordApproval(folder, { manifestSha256: manifest.sha256, words: 'Again.', approvedAt: 'later' }), 'a second approval was recorded').toEqual({
			refusedBecause: 'an approval is recorded here already (approval.json), and a record is written once'
		});
	});

	it('⛔ RED FIRST — a call is refused without its approval, and where the approval is of another manifest than the one shown; ⭑ CONTROL: the approval of what was shown admits it', () => {
		const { folder, manifest } = shownFolder({ 'prompt.txt': 'the prompt' });
		expect(approvalRefusal(folder), 'a call was admitted with no approval').toBe(
			'no approval is recorded (approval.json): no call runs without its approval record (REG-D-189 (1))'
		);
		writeOnce(join(folder, D84_LAYOUT.approval), { manifestSha256: 'b'.repeat(64), approvedAt: 'now', words: 'Approved.', recordedBy: 'the lead' });
		expect(approvalRefusal(folder), 'a call was admitted on the approval of another manifest').toBe(
			`the approval is of manifest ${'b'.repeat(64)}, and what was shown is manifest ${manifest.sha256}: no call runs on what was not approved`
		);
		const control = shownFolder({ 'prompt.txt': 'the prompt' });
		expect(recordApproval(control.folder, { manifestSha256: control.manifest.sha256, words: 'Approved.', approvedAt: 'now' })).toHaveProperty('recorded');
		expect(approvalRefusal(control.folder), '⭑ CONTROL: the approval of what was shown does not admit the call').toBeUndefined();
	});
});

describe('⭐⭐ D84 (T11; the lead’s rulings r1, Q5) — no call without JPWB_D84_PAID, exactly 1', () => {
	const REFUSED: readonly (string | undefined)[] = [undefined, '', '0', 'true', 'yes', ' 1', '1 ', '01', 'TRUE'];

	it('⛔ RED FIRST — the flag unset, or any value but exactly 1, refuses, naming the value; exactly 1 admits', () => {
		for (const value of REFUSED)
			expect(paidRefusal(value === undefined ? {} : { [D84_PAID_VARIABLE]: value }), `${JSON.stringify(value)} admitted a call`).toBe(
				`JPWB_D84_PAID is ${value === undefined ? 'not set' : JSON.stringify(value)}, and D84 makes no call unless it is exactly "1" (REG-D-189; the lead's rulings r1, Q5)`
			);
		expect(paidRefusal({ JPWB_D84_PAID: '1' }), 'exactly 1 refused').toBeUndefined();
	});

	it('⛔ RED FIRST — a role’s call is refused on the flag before anything else is read or any program runs', async () => {
		let ran = 0;
		const transports: D84Transports = {
			devinExec: async () => {
				ran += 1;
				return { stdout: '' };
			},
			openPi: async () => {
				ran += 1;
				throw new Error('Pi was opened');
			},
			devinVersion: async () => {
				ran += 1;
				return 'devin 3000.11.234';
			}
		};
		// ⭑ Deps that throw on any read: the flag's refusal comes before every one of them.
		const deps = new Proxy({} as AssuranceStageDeps, {
			get: (_t, property) => {
				throw new Error(`the call read its deps (${String(property)}) before its flag`);
			}
		});
		const at = { folder: fresh('unpaid'), unitId: 'pwu_x', roundId: 'asmt_x' };
		for (const value of REFUSED)
			for (const role of ['writer', 'hypothesizer', 'historian'] as const)
				expect(await callRole(role, deps, at, transports, value === undefined ? {} : { JPWB_D84_PAID: value }), `the ${role} was not refused on ${JSON.stringify(value)}`).toEqual({
					refusedBecause: paidRefusal(value === undefined ? {} : { JPWB_D84_PAID: value })
				});
		expect(ran, 'a program ran with the flag refused').toBe(0);
	});
});

describe('⭐⭐ D84 (r2, `D84R-A01`) — a role that holds an attempt and no call record is not called again on its copy', () => {
	it('⛔ RED FIRST — the writer approved, an attempt left with no call record (a kill during the call, staged by the test): its second call refused by the attempt’s words, before its deps are read and with no program run', async () => {
		const folder = fresh('attempted');
		writeOnce(join(folder, D84_LAYOUT.case), { reading: { roundId: 'asmt_x' } });
		writeOnce(join(folder, D84_LAYOUT.policy), { prepared: false });
		const writer = roleFolderOf(folder, 'writer');
		mkdirSync(join(writer, D84_LAYOUT.shown), { recursive: true });
		writeFileSync(join(writer, D84_LAYOUT.shown, 'prompt.txt'), 'the prompt');
		const manifest = manifestOf(treeEntries(join(writer, D84_LAYOUT.shown)));
		writeOnce(join(writer, D84_LAYOUT.manifest), manifest);
		expect(recordApproval(writer, { manifestSha256: manifest.sha256, words: 'Approved.', approvedAt: 'now' })).toHaveProperty('recorded');
		// ⭑ The attempt a call writes before its program, and no record after it: the call was killed, or threw, in between.
		writeOnce(join(writer, 'attempt.json'), { manifestSha256: manifest.sha256, at: '2026-11-21T20:00:00.000Z' });
		let ran = 0;
		const transports: D84Transports = {
			devinExec: async () => {
				ran += 1;
				return { stdout: '' };
			},
			openPi: async () => {
				ran += 1;
				throw new Error('Pi was opened');
			},
			devinVersion: async () => {
				ran += 1;
				return 'devin 3000.11.234';
			}
		};
		const deps = new Proxy({} as AssuranceStageDeps, {
			get: (_t, property) => {
				throw new Error(`the call read its deps (${String(property)}) past its attempt`);
			}
		});
		const again = await callRole('writer', deps, { folder, unitId: 'pwu_x', roundId: 'asmt_x' }, transports, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({
			threw: e instanceof Error ? e.message : String(e)
		}));
		expect('refusedBecause' in again ? again.refusedBecause : JSON.stringify(again), 'a role holding an attempt and no call record was called again').toContain(
			'an attempt was made on this copy and its record was never written: it is not called again here'
		);
		expect([ran, existsSync(join(writer, D84_LAYOUT.call))], 'a program ran, or a call record was written, for a role holding an attempt').toEqual([0, false]);
	});
});

describe('⭐⭐ D84 (r4, `D84S-A02`) — an attempt cut short, as by a kill during its own write, is an attempt all the same', () => {
	it('⛔ RED FIRST — an attempt.json empty, or cut mid-JSON: a second call refused by the attempt’s words, its record named unreadable, before its deps are read and with no program run; and the report counts it and names it, never throwing', async () => {
		for (const [cut, text] of [
			['empty', ''],
			['cut mid-JSON', '{"manifestSha256": "ab'],
		] as const) {
			const folder = fresh(`cut-${cut === 'empty' ? 'empty' : 'mid'}`);
			writeOnce(join(folder, D84_LAYOUT.case), { reading: { roundId: 'asmt_x' } });
			writeOnce(join(folder, D84_LAYOUT.policy), { prepared: false });
			const writer = roleFolderOf(folder, 'writer');
			mkdirSync(join(writer, D84_LAYOUT.shown), { recursive: true });
			writeFileSync(join(writer, D84_LAYOUT.shown, 'prompt.txt'), 'the prompt');
			const manifest = manifestOf(treeEntries(join(writer, D84_LAYOUT.shown)));
			writeOnce(join(writer, D84_LAYOUT.manifest), manifest);
			expect(recordApproval(writer, { manifestSha256: manifest.sha256, words: 'Approved.', approvedAt: 'now' })).toHaveProperty('recorded');
			// ⭑ The attempt as a kill during its own write leaves it: the file made, its record not, or not whole.
			writeFileSync(join(writer, 'attempt.json'), text);
			let ran = 0;
			const counted = async () => {
				ran += 1;
				throw new Error('a program ran');
			};
			const transports: D84Transports = { devinExec: counted, openPi: counted, devinVersion: counted };
			const deps = new Proxy({} as AssuranceStageDeps, {
				get: (_t, property) => {
					throw new Error(`the call read its deps (${String(property)}) past its attempt`);
				}
			});

			const again = await callRole('writer', deps, { folder, unitId: 'pwu_x', roundId: 'asmt_x' }, transports, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({
				threw: e instanceof Error ? e.message : String(e)
			}));
			const report = (() => {
				try {
					return gatherReport(folder);
				} catch (e) {
					return { threw: e instanceof Error ? e.message : String(e) };
				}
			})();

			expect('refusedBecause' in again ? again.refusedBecause : JSON.stringify(again), `a role whose attempt is ${cut} was not refused by it`).toBe(
				"the writer: an attempt was made on this copy and its record was never written: it is not called again here (attempt.json, its record unreadable; the lead's rulings r2, D84R-A01)"
			);
			expect([ran, existsSync(join(writer, D84_LAYOUT.call))], `a program ran, or a call record was written, for a role whose attempt is ${cut}`).toEqual([0, false]);
			expect(
				'calls' in report ? [report.calls, report.unrecorded] : report,
				`the report did not count and name an attempt ${cut}, or threw on it`
			).toEqual([{ reviewer: 1, executor: 0, probes: 0 }, ['writer']]);
		}
	});
});

describe('⭐⭐ D84 (r2, `D84R-A01`) — the attempt and the lock, each written exclusively, and each step’s lock its own', () => {
	it('⛔ RED FIRST — an attempt is reserved once: a second reservation on the copy, as a second launcher’s, is refused at its write, naming the first, whose record stays; ⭑ CONTROL: the first is reserved', () => {
		const folder = fresh('reserved');
		const first = reserveAttempt(folder, 'the writer', { manifestSha256: 'a'.repeat(64), at: '2026-11-21T20:00:00.000Z' });
		expect(first, '⭑ CONTROL: the first attempt was not reserved').toBeUndefined();

		const second = reserveAttempt(folder, 'the writer', { manifestSha256: 'b'.repeat(64), at: '2026-11-21T20:00:01.000Z' });

		expect(second, 'a second attempt was reserved on one copy').toBe(
			"the writer: an attempt was made on this copy and its record was never written: it is not called again here (attempt.json, made at 2026-11-21T20:00:00.000Z; the lead's rulings r2, D84R-A01)"
		);
		expect(readJson(join(folder, 'attempt.json')), 'the first attempt’s record was written over').toEqual({ manifestSha256: 'a'.repeat(64), at: '2026-11-21T20:00:00.000Z' });
	});

	it('⛔ RED FIRST — a step removes only its own lock: one that is not the lock it took — another step’s, taken after its own was cleared — is left where it is; ⭑ CONTROL: its own is removed', () => {
		const folder = fresh('lock');
		const mine = takeLock(folder, { pid: 1, at: 'then', step: 'report' });
		if (!('release' in mine)) throw new Error(`arrangement: ${mine.refusedBecause}`);
		// ⭑ Its lock cleared by the lead, and another step's taken in its place.
		rmSync(join(folder, 'd84.lock'));
		writeFileSync(join(folder, 'd84.lock'), `${JSON.stringify({ pid: 2, at: 'now', step: 'call' })}\n`);

		mine.release();

		expect(existsSync(join(folder, 'd84.lock')), 'a step removed a lock that is not its own').toBe(true);
		rmSync(join(folder, 'd84.lock'));
		const own = takeLock(folder, { pid: 3, at: 'now', step: 'copy' });
		if (!('release' in own)) throw new Error(`arrangement: ${own.refusedBecause}`);
		own.release();
		expect(existsSync(join(folder, 'd84.lock')), '⭑ CONTROL: a step’s own lock was not removed').toBe(false);
	});
});

describe('⭐ D84 — the report’s mechanical part: what the folder records, every call counted, the probes apart, and the calls already spent on the case', () => {
	it('⛔ RED FIRST — the roles’ reviewer calls (the writer’s and the Historian’s) and the Hypothesizer’s executor turn counted, the probes apart; an earlier folder’s calls named; the four departures named', () => {
		const earlier = fresh('earlier');
		writeOnce(join(earlier, D84_LAYOUT.state), { begunAt: 'then', checkoutHead: 'x', source: 's', unitId: 'u', earlierFolders: [] });
		writeOnce(join(roleFolderOf(earlier, 'writer'), D84_LAYOUT.call), { role: 'writer' });
		const folder = fresh('report');
		writeOnce(join(folder, D84_LAYOUT.state), { begunAt: 'now', checkoutHead: 'x', source: 's', unitId: 'u', earlierFolders: [earlier] });
		for (const role of ['writer', 'hypothesizer'] as const) writeOnce(join(roleFolderOf(folder, role), D84_LAYOUT.call), { role });
		// ⭐ r2 (`D84R-A01`) — the Historian's attempt, and no record of its call: a call that may have been made, and paid for.
		writeOnce(join(roleFolderOf(folder, 'historian'), 'attempt.json'), { manifestSha256: 'a'.repeat(64), at: 'then' });
		writeOnce(join(folder, D84_LAYOUT.probes, '01-tilde', D84_LAYOUT.call), { probe: '01-tilde' });
		mkdirSync(join(folder, D84_LAYOUT.probes, '02-shown-only'), { recursive: true });
		const report = gatherReport(folder);
		expect(report.calls, 'the calls are not counted, the probes apart, an attempt with no record among them').toEqual({ reviewer: 2, executor: 1, probes: 1 });
		expect(report.unrecorded, 'an attempt with no call record is not named among the calls spent').toEqual(['historian']);
		expect(report.spentBefore, 'the calls already spent on the case are not named').toEqual([{ folder: earlier, calls: { reviewer: 1, executor: 0, probes: 0 } }]);
		expect(report.departures, 'the accepted departures are not named').toEqual([...D84_DEPARTURES]);
		expect(report.stopped, 'a folder not stopped is reported stopped').toBe(false);
		expect(sha256Of('x'), 'arrangement: the sha256 is hex').toBe(sha256('x'));
	});
});
