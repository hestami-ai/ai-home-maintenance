// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`) — THE MEASUREMENT'S REPORT, ITS MECHANICAL PART: what the folder records,
// gathered in one place — the copy and its checks, the case, the policy's preparation, each role's shown manifest, approval and call, each probe's,
// and every call counted: the roles' reviewer calls (the writer's and the Historian's), the Hypothesizer's executor turn, and the probes apart — an
// attempt with no call record among them, and named (the lead's rulings r2, `D84R-A01`): a call that may have been made, and paid for.
// ⛔ IT JUDGES NOTHING: each expectation D84 wrote down is the lead's to hold the answers to, with its evidence. This gathers what the record says.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseReading } from './d84-case.js';
import type { CopyManifest, MeasurementState } from './d84-folder.js';
import { attemptOf, D84_LAYOUT, D84_ROLES, readJson, roleFolderOf, writeOnce, type ApprovalRecord, type AttemptReading, type D84Role, type Manifest } from './d84-files.js';
import { D84_STOPPED, type CallRecord } from './d84-roles.js';
import type { ProbeCallRecord } from './d84-probes.js';

/** ⭐ D84 — one role's or one probe's part of the report. */
export interface ShownAndCalled<C> {
	readonly shown?: { readonly manifestSha256: string; readonly files: number; readonly bytes: number };
	readonly approval?: ApprovalRecord;
	/** ⭐ r2 (`D84R-A01`) — the attempt its call reserved before its program. ⭐ r4 (`D84S-A02`): or, where its record was cut short, that it is unreadable. */
	readonly attempt?: AttemptReading;
	readonly call?: C;
}

/** ⭐ D84 — the calls a folder records: the roles' reviewer calls (the writer's and the Historian's), the Hypothesizer's executor turn, the probes apart. */
export interface CallCounts {
	readonly reviewer: number;
	readonly executor: number;
	readonly probes: number;
}

/**
 * ⭐ D84 — the four departures from D84 as amended that the lead accepted (the lead's rulings r1: 4, 5, 6 and 9), each named in the report, in the
 * lead's words.
 */
export const D84_DEPARTURES = [
	'4: an open that writes is detected and refused, the events counted by a read-only open first',
	'5: the process output, the purge records and the sessions folder are copied',
	'6: the stricter folder refusals',
	"9: the writer's time is the driver's own measurement"
] as const;

/** ⭐ D84 — the report's mechanical part (`report.json`). */
export interface D84Report {
	readonly state?: MeasurementState;
	readonly copy?: { readonly files: number; readonly checks: readonly string[] };
	readonly case?: CaseReading;
	readonly policy?: unknown;
	readonly roles: Readonly<Record<D84Role, ShownAndCalled<CallRecord>>>;
	readonly probes: Readonly<Record<string, ShownAndCalled<ProbeCallRecord>>>;
	readonly stopped: boolean;
	readonly calls: CallCounts;
	/**
	 * ⭐ r2 (`D84R-A01`) — each role (by its name) and each probe (by its own) holding an attempt and no call record: a call that may have been made, and
	 * paid for, its record never written. Each is counted among `calls`.
	 */
	readonly unrecorded: readonly string[];
	/** The calls already spent on this case, in each earlier measurement folder the begin step named (Q10), by its folder. */
	readonly spentBefore: readonly { readonly folder: string; readonly calls: CallCounts }[];
	readonly departures: readonly string[];
}

/** What a folder shows and records. */
function shownAndCalled<C>(at: string): ShownAndCalled<C> {
	const manifest = readJson<Manifest>(join(at, D84_LAYOUT.manifest));
	const approval = readJson<ApprovalRecord>(join(at, D84_LAYOUT.approval));
	// ⭐ r4 (`D84S-A02`) — read as the refusal reads it: by its file's existence alone, its record only where it parses, never thrown on.
	const attempt = attemptOf(at);
	const call = readJson<C>(join(at, D84_LAYOUT.call));
	return {
		...(manifest === undefined
			? {}
			: { shown: { manifestSha256: manifest.sha256, files: manifest.entries.length, bytes: manifest.entries.reduce((n, e) => n + e.bytes, 0) } }),
		...(approval === undefined ? {} : { approval }),
		...(attempt === undefined ? {} : { attempt }),
		...(call === undefined ? {} : { call })
	};
}

/** ⭐ r2 (`D84R-A01`) — a call spent: its record written, or its attempt reserved — a call that may have been made, its record never written. */
const spent = (p: ShownAndCalled<unknown>): boolean => p.call !== undefined || p.attempt !== undefined;

/**
 * ⭐⭐ D84 — GATHER THE REPORT (see the header), and write it once. A role is counted as a call where its call record exists, or its attempt (r2,
 * `D84R-A01`): the writer and the Historian as reviewer calls, the Hypothesizer as an executor turn; a probe where its own does — apart.
 */
export function gatherReport(folder: string): D84Report {
	const { roles, probes, calls, unrecorded } = callsOf(folder);
	const copy = readJson<CopyManifest>(join(folder, D84_LAYOUT.copyManifest));
	const state = readJson<MeasurementState>(join(folder, D84_LAYOUT.state));
	const reading = readJson<{ readonly reading?: CaseReading }>(join(folder, D84_LAYOUT.case))?.reading;
	const policy = readJson<unknown>(join(folder, D84_LAYOUT.policy));
	return {
		...(state === undefined ? {} : { state }),
		...(copy === undefined ? {} : { copy: { files: copy.files.length, checks: copy.checks } }),
		...(reading === undefined ? {} : { case: reading }),
		...(policy === undefined ? {} : { policy }),
		roles,
		probes,
		stopped: existsSync(join(folder, D84_STOPPED)),
		calls,
		unrecorded,
		spentBefore: (state?.earlierFolders ?? []).map((earlier) => ({ folder: earlier, calls: callsOf(earlier).calls })),
		departures: [...D84_DEPARTURES]
	};
}

/** What a measurement folder shows and records of its roles and its probes, and the calls it counts. */
function callsOf(folder: string): {
	readonly roles: Record<D84Role, ShownAndCalled<CallRecord>>;
	readonly probes: Record<string, ShownAndCalled<ProbeCallRecord>>;
	readonly calls: CallCounts;
	readonly unrecorded: readonly string[];
} {
	const roles = Object.fromEntries(D84_ROLES.map((r) => [r, shownAndCalled<CallRecord>(roleFolderOf(folder, r))] as const)) as Record<D84Role, ShownAndCalled<CallRecord>>;
	const probesRoot = join(folder, D84_LAYOUT.probes);
	const probes = Object.fromEntries(
		(existsSync(probesRoot) ? readdirSync(probesRoot).sort() : []).map((n) => [n, shownAndCalled<ProbeCallRecord>(join(probesRoot, n))] as const)
	);
	return {
		roles,
		probes,
		calls: {
			reviewer: (['writer', 'historian'] as const).filter((r) => spent(roles[r])).length,
			executor: spent(roles.hypothesizer) ? 1 : 0,
			probes: Object.values(probes).filter(spent).length
		},
		unrecorded: [...D84_ROLES.map((r) => [r, roles[r]] as const), ...Object.entries(probes)]
			.filter(([, p]) => p.call === undefined && p.attempt !== undefined)
			.map(([name]) => name)
	};
}

/** ⭐ D84 — the report written, once (`report.json`). */
export function writeReport(folder: string): D84Report {
	const report = gatherReport(folder);
	writeOnce(join(folder, D84_LAYOUT.report), report);
	return report;
}
