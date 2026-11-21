// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`) — THE MEASUREMENT'S REPORT, ITS MECHANICAL PART: what the folder records,
// gathered in one place — the copy and its checks, the case, the policy's preparation, each role's shown manifest, approval and call, each probe's,
// and every call counted: the roles' reviewer calls (the writer's and the Historian's), the Hypothesizer's executor turn, and the probes apart.
// ⛔ IT JUDGES NOTHING: each expectation D84 wrote down is the lead's to hold the answers to, with its evidence. This gathers what the record says.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseReading } from './d84-case.js';
import type { CopyManifest, MeasurementState } from './d84-folder.js';
import { D84_LAYOUT, D84_ROLES, readJson, roleFolderOf, writeOnce, type ApprovalRecord, type D84Role, type Manifest } from './d84-files.js';
import { D84_STOPPED, type CallRecord } from './d84-roles.js';
import type { ProbeCallRecord } from './d84-probes.js';

/** ⭐ D84 — one role's or one probe's part of the report. */
export interface ShownAndCalled<C> {
	readonly shown?: { readonly manifestSha256: string; readonly files: number; readonly bytes: number };
	readonly approval?: ApprovalRecord;
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
	/** The calls already spent on this case, in each earlier measurement folder the begin step named (Q10), by its folder. */
	readonly spentBefore: readonly { readonly folder: string; readonly calls: CallCounts }[];
	readonly departures: readonly string[];
}

/** What a folder shows and records. */
function shownAndCalled<C>(at: string): ShownAndCalled<C> {
	const manifest = readJson<Manifest>(join(at, D84_LAYOUT.manifest));
	const approval = readJson<ApprovalRecord>(join(at, D84_LAYOUT.approval));
	const call = readJson<C>(join(at, D84_LAYOUT.call));
	return {
		...(manifest === undefined
			? {}
			: { shown: { manifestSha256: manifest.sha256, files: manifest.entries.length, bytes: manifest.entries.reduce((n, e) => n + e.bytes, 0) } }),
		...(approval === undefined ? {} : { approval }),
		...(call === undefined ? {} : { call })
	};
}

/**
 * ⭐⭐ D84 — GATHER THE REPORT (see the header), and write it once. A role is counted as a call where its call record exists: the writer and the Historian
 * as reviewer calls, the Hypothesizer as an executor turn; a probe where its own does — apart.
 */
export function gatherReport(folder: string): D84Report {
	const { roles, probes, calls } = callsOf(folder);
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
		spentBefore: (state?.earlierFolders ?? []).map((earlier) => ({ folder: earlier, calls: callsOf(earlier).calls })),
		departures: [...D84_DEPARTURES]
	};
}

/** What a measurement folder shows and records of its roles and its probes, and the calls it counts. */
function callsOf(folder: string): {
	readonly roles: Record<D84Role, ShownAndCalled<CallRecord>>;
	readonly probes: Record<string, ShownAndCalled<ProbeCallRecord>>;
	readonly calls: CallCounts;
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
			reviewer: (['writer', 'historian'] as const).filter((r) => roles[r].call !== undefined).length,
			executor: roles.hypothesizer.call === undefined ? 0 : 1,
			probes: Object.values(probes).filter((p) => p.call !== undefined).length
		}
	};
}

/** ⭐ D84 — the report written, once (`report.json`). */
export function writeReport(folder: string): D84Report {
	const report = gatherReport(folder);
	writeOnce(join(folder, D84_LAYOUT.report), report);
	return report;
}
