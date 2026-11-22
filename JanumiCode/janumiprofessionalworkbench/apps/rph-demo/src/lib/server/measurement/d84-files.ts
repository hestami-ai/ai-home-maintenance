// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.38, as amended 2026-11-21; `REG-D-189`; the lead's
// rulings r1 on `d84/d84-facts.md` §3) — THE MEASUREMENT FOLDER'S FILES: its layout, the manifest of a folder's files by their sha256, the record of
// the sponsor's approval against a manifest's sha256, and the paid flag.
//
// ⭑ WHAT A MANIFEST IS: every file and link under a folder, by its `/`-separated path from the folder, sorted by code unit — a file by its bytes and
// their sha256, a link by its target's text and that text's sha256, as the run archive hashes a link (`scripts/phase7/run-archive.ts`, `fileHashes`) —
// and the sha256 of those entries, written as one JSON array. An empty folder leaves no entry: nothing of it is sent.
// ⭑ WHAT AN APPROVAL IS (`REG-D-189` (1)): the lead's record that the sponsor approved what was shown, held to the shown manifest's sha256. A call
// is refused without one, and where the manifest it names is not the one the folder holds.
// ⛔ WRITTEN ONCE: a record of this folder is never written over (`writeOnce`), so what was shown, approved and called stays as it was.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** ⭐ D84 (the lead's rulings r1, Q5) — the flag without which no call of D84's is made: exactly `1`, as the paid lane's own (`JPWB_PHASE7_PAID`). */
export const D84_PAID_VARIABLE = 'JPWB_D84_PAID';

/** ⭐ `REG-D-189` (3) — the most probe calls D84 may make. */
export const D84_MAX_PROBES = 6;

/** ⭐ D84 — the three roles, in the stage's order (`REG-D-189` (1)). */
export const D84_ROLES = ['writer', 'hypothesizer', 'historian'] as const;
export type D84Role = (typeof D84_ROLES)[number];

/** ⭐ D84 — the measurement folder's layout (`d84/d84-facts.md` §3.3). */
export const D84_LAYOUT = {
	state: 'd84.json',
	copy: 'copy',
	copyManifest: 'copy-manifest.json',
	case: 'case.json',
	policy: 'policy.json',
	roles: 'roles',
	probes: 'probes',
	report: 'report.json',
	shown: 'shown',
	check: 'check',
	manifest: 'manifest.json',
	approval: 'approval.json',
	call: 'call.json',
	after: 'after',
	definition: 'definition',
	// ⭐ r2 (`D84R-A01`) — a call's attempt, reserved before its program; and the folder's lock, held by one step at a time.
	attempt: 'attempt.json',
	lock: 'd84.lock'
} as const;

/** One role's folder: `roles/<n>-<role>`, numbered in the stage's order. */
export function roleFolderOf(folder: string, role: D84Role): string {
	return join(folder, D84_LAYOUT.roles, `${D84_ROLES.indexOf(role) + 1}-${role}`);
}

/** The copy's record store, as the server names it (`JPWB_DEMO_DB`): `<folder>/copy/demo.sqlite`. */
export function copyStoreOf(folder: string): string {
	return join(folder, D84_LAYOUT.copy, 'demo.sqlite');
}

/** The sha256 of `bytes`, in lower-case hex. */
export const sha256Of = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** One entry of a manifest: a file by its bytes, or a link by its target's text. */
export interface ManifestEntry {
	readonly path: string;
	readonly kind: 'file' | 'link';
	readonly bytes: number;
	readonly sha256: string;
	readonly target?: string;
}

/** A manifest: its entries, and the sha256 of their JSON. */
export interface Manifest {
	readonly entries: readonly ManifestEntry[];
	readonly sha256: string;
}

/** Strings in code-unit order, as the run archive orders paths: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

/**
 * ⭐ D84 — EVERY FILE AND LINK UNDER `root`, as a manifest lists them: each by its `/`-separated path, sorted by code unit; a link never followed. `leave`
 * names paths (relative, `/`-separated) whose whole subtree is left out — a folder the manifest is not about.
 */
export function treeEntries(root: string, leave: readonly string[] = []): ManifestEntry[] {
	const out: ManifestEntry[] = [];
	const walk = (dir: string, rel: string): void => {
		for (const name of readdirSync(dir).sort(byCodeUnit)) {
			const path = rel === '' ? name : `${rel}/${name}`;
			if (leave.includes(path)) continue;
			const full = join(dir, name);
			const stat = lstatSync(full);
			if (stat.isSymbolicLink()) {
				const target = readlinkSync(full);
				out.push({ path, kind: 'link', bytes: Buffer.byteLength(target, 'utf8'), sha256: sha256Of(target), target });
			} else if (stat.isDirectory()) walk(full, path);
			else if (stat.isFile()) {
				const bytes = readFileSync(full);
				out.push({ path, kind: 'file', bytes: bytes.length, sha256: sha256Of(bytes) });
			}
		}
	};
	walk(root, '');
	return out.sort((a, b) => byCodeUnit(a.path, b.path));
}

/** ⭐ D84 — the manifest of `entries`: the entries, sorted by path, and the sha256 of their JSON. */
export function manifestOf(entries: readonly ManifestEntry[]): Manifest {
	const sorted = [...entries].sort((a, b) => byCodeUnit(a.path, b.path));
	return { entries: sorted, sha256: sha256Of(JSON.stringify(sorted)) };
}

/** ⭐ D84 — each path two manifests disagree on, named: one only the first holds, one only the second holds, or one whose bytes differ. */
export function manifestDifferences(approved: Manifest, now: Manifest): string[] {
	const before = new Map(approved.entries.map((e) => [e.path, e] as const));
	const after = new Map(now.entries.map((e) => [e.path, e] as const));
	const out: string[] = [];
	for (const path of [...new Set([...before.keys(), ...after.keys()])].sort(byCodeUnit)) {
		const a = before.get(path);
		const b = after.get(path);
		if (a === undefined) out.push(`${path}: not in what was approved`);
		else if (b === undefined) out.push(`${path}: approved, and not there now`);
		else if (a.kind !== b.kind || a.sha256 !== b.sha256 || a.bytes !== b.bytes)
			out.push(`${path}: its bytes differ from what was approved (sha256 ${a.sha256} approved, ${b.sha256} now)`);
	}
	return out;
}

/** ⭐ D84 — a JSON record written once: a file that exists is refused, never written over. */
export function writeOnce(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

/** A JSON record, or `undefined` where there is none. ⛔ A record that is not JSON throws: it is never read as absent. */
export function readJson<T>(path: string): T | undefined {
	return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined;
}

/**
 * ⭐⭐ D84 (the lead's rulings r1, Q5) — WHY NO CALL MAY BE MADE, or `undefined` where the flag says it may: `JPWB_D84_PAID` exactly `1`. ⛔ Every
 * other value refuses, `true`, ` 1` and `yes` among them: a flag is read affirmatively and exactly, as the lane reads its own.
 */
export function paidRefusal(env: Readonly<Record<string, string | undefined>>): string | undefined {
	const value = env[D84_PAID_VARIABLE];
	return value === '1'
		? undefined
		: `${D84_PAID_VARIABLE} is ${value === undefined ? 'not set' : JSON.stringify(value)}, and D84 makes no call unless it is exactly "1" (REG-D-189; the lead's rulings r1, Q5)`;
}

/** ⭐ D84 — the sponsor's approval, as the lead records it: what was approved (by its manifest's sha256), when, and the sponsor's words. */
export interface ApprovalRecord {
	readonly manifestSha256: string;
	readonly approvedAt: string;
	readonly words: string;
	readonly recordedBy: 'the lead';
}

/** The manifest a role's or a probe's folder holds, as it was written when it was shown. */
export function shownManifestOf(folder: string): Manifest | undefined {
	return readJson<Manifest>(join(folder, D84_LAYOUT.manifest));
}

/**
 * ⭐⭐ D84 — RECORD THE SPONSOR'S APPROVAL OF WHAT `folder` SHOWS, held to the sha256 of the manifest the lead was shown: refused where the folder holds
 * no manifest, where the sha256 given is not that manifest's, where the sponsor's words are empty, and where an approval is recorded already.
 */
export function recordApproval(
	folder: string,
	a: { readonly manifestSha256: string; readonly words: string; readonly approvedAt: string }
): { readonly recorded: ApprovalRecord } | { readonly refusedBecause: string } {
	const manifest = shownManifestOf(folder);
	if (manifest === undefined) return { refusedBecause: `nothing has been shown here: ${D84_LAYOUT.manifest} is not written, so there is nothing to approve` };
	if (a.manifestSha256 !== manifest.sha256)
		return {
			refusedBecause: `the approval names manifest ${JSON.stringify(a.manifestSha256)}, and what was shown here is manifest ${manifest.sha256}: an approval is recorded only against what was shown`
		};
	if (a.words.trim() === '') return { refusedBecause: 'the sponsor’s words are empty: an approval is recorded with what the sponsor said' };
	const at = join(folder, D84_LAYOUT.approval);
	if (existsSync(at)) return { refusedBecause: `an approval is recorded here already (${D84_LAYOUT.approval}), and a record is written once` };
	const recorded: ApprovalRecord = { manifestSha256: manifest.sha256, approvedAt: a.approvedAt, words: a.words, recordedBy: 'the lead' };
	writeOnce(at, recorded);
	return { recorded };
}

/**
 * ⭐⭐ D84 (`REG-D-189` (1)) — WHY A CALL OF WHAT `folder` SHOWS IS REFUSED FOR WANT OF ITS APPROVAL, or `undefined`: no approval recorded, no manifest
 * shown, or an approval of another manifest than the one shown.
 */
export function approvalRefusal(folder: string): string | undefined {
	const approval = readJson<ApprovalRecord>(join(folder, D84_LAYOUT.approval));
	if (approval === undefined) return `no approval is recorded (${D84_LAYOUT.approval}): no call runs without its approval record (REG-D-189 (1))`;
	const manifest = shownManifestOf(folder);
	if (manifest === undefined) return `no manifest of what was shown is written (${D84_LAYOUT.manifest}), so the approval holds to nothing`;
	if (approval.manifestSha256 !== manifest.sha256)
		return `the approval is of manifest ${approval.manifestSha256}, and what was shown is manifest ${manifest.sha256}: no call runs on what was not approved`;
	return undefined;
}

/** ⭐ r2 (`D84R-A01` (a)) — a call's attempt: the manifest approved, and when the call was about to run its program. */
export interface AttemptRecord {
	readonly manifestSha256: string;
	readonly at: string;
}

/** The words of a call refused for its attempt: one was made on this copy, and its record never written. */
const attemptWords = (what: string, at: string): string =>
	`${what}: an attempt was made on this copy and its record was never written: it is not called again here (${D84_LAYOUT.attempt}, made at ${at}; the lead's rulings r2, D84R-A01)`;

/**
 * ⭐⭐ r2 (`D84R-A01` (a)) — WHY `what`, WHOSE FOLDER IS `folder`, IS NOT CALLED FOR ITS ATTEMPT: it holds an attempt and no call record — a call killed,
 * or thrown out of, between its program and its record. `undefined` where it holds no attempt. ⛔ Nothing deletes an attempt.
 */
export function attemptRefusal(folder: string, what: string): string | undefined {
	if (!existsSync(join(folder, D84_LAYOUT.attempt))) return undefined;
	const attempt = readJson<Partial<AttemptRecord>>(join(folder, D84_LAYOUT.attempt));
	return attemptWords(what, String(attempt?.at ?? 'a time not recorded'));
}

/**
 * ⭐⭐ r2 (`D84R-A01` (a)) — THE ATTEMPT, RESERVED IMMEDIATELY BEFORE A CALL'S PROGRAM CAN RUN, after every check: written exclusively, so a second
 * launcher fails at this write and is refused with the attempt's words. `undefined` where it is reserved.
 */
export function reserveAttempt(folder: string, what: string, attempt: AttemptRecord): string | undefined {
	try {
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, D84_LAYOUT.attempt), `${JSON.stringify(attempt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
		return undefined;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
		return attemptWords(what, String(readJson<Partial<AttemptRecord>>(join(folder, D84_LAYOUT.attempt))?.at ?? 'a time not recorded'));
	}
}

/** ⭐ r2 (`D84R-A01` (b)) — the folder's lock, as a step holds it: its process, when it began, and which step it is. */
export interface LockRecord {
	readonly pid: number;
	readonly at: string;
	readonly step: string;
}

/** The words of a step refused for the folder's lock, and how the lead clears a lock a kill left. */
function lockWords(held: Partial<LockRecord> | undefined): string {
	return (
		`the measurement folder is held by another step (${D84_LAYOUT.lock}: the step ${JSON.stringify(held?.step ?? 'not recorded')}, process ` +
		`${String(held?.pid ?? 'not recorded')}, since ${String(held?.at ?? 'a time not recorded')}): only one step runs at a time in a measurement folder. ` +
		`If no driver process runs — look for that process id — the lock was left by a step that was stopped, and the lead may delete ${D84_LAYOUT.lock} ` +
		"then; the driver never clears it itself (the lead's rulings r2, D84R-A01 (b))"
	);
}

/**
 * ⭐⭐ r2 (`D84R-A01` (b)) — TAKE THE FOLDER'S LOCK for one step: written exclusively, holding this process's id and the time; its `release` removes it,
 * and only while it is still this step's own. ⛔ A lock held, or left by a kill, refuses, naming it — and is never cleared here.
 */
export function takeLock(folder: string, lock: LockRecord): { readonly release: () => void } | { readonly refusedBecause: string } {
	const path = join(folder, D84_LAYOUT.lock);
	const text = `${JSON.stringify(lock)}\n`;
	try {
		writeFileSync(path, text, { encoding: 'utf8', flag: 'wx' });
	} catch (e) {
		const code = (e as NodeJS.ErrnoException).code;
		if (code === 'EEXIST') {
			let held: Partial<LockRecord> | undefined;
			try {
				held = readJson<Partial<LockRecord>>(path);
			} catch {
				held = undefined;
			}
			return { refusedBecause: lockWords(held) };
		}
		if (code === 'ENOENT') return { refusedBecause: `the measurement folder ${folder} does not exist, so no step can hold it` };
		throw e;
	}
	return {
		release: () => {
			if (existsSync(path) && readFileSync(path, 'utf8') === text) rmSync(path, { force: true });
		}
	};
}
