/**
 * coverage:floor — the PER-FILE coverage ratchet. `bun run scripts/coverage-floor.ts --write | --check`
 *
 * ── WHY A PER-FILE RATCHET AT ALL, WHEN FOUR GLOBAL THRESHOLDS ALREADY BLOCK ────────────────────────────────
 * `vitest.config.ts` holds ONE global threshold per metric over a MERGED population. It passes, and it passes in
 * a way that cannot distinguish "every file is adequately covered" from "the average is". Measured on the day
 * this was written: branches 87.61% against a floor of 83, with **24 of 106 files individually below 83**, the
 * worst at 60.0%. `JAN-CSAAEXT` S9 demonstrated the failure mode rather than arguing it — 126 branches added,
 * the global rose 84.92 → 87.61, and NOT ONE of the 24 weak files moved. Nothing in the gate said so.
 * ⭑ An aggregate is a claim about a population and is silent about every member.
 *
 * ── IT RECORDS UNCOVERED **COUNTS**, NOT PERCENTAGES, AND THE DIFFERENCE IS THE WHOLE POINT ─────────────────
 * A percentage floor lets a file add uncovered branches provided it adds covered ones alongside — the averaging
 * defect reproduced inside a single file. A count ceiling says the thing actually wanted: **you may not add
 * uncovered code.** It is also immune to rounding drift (87.61 → 87.60 fails a percentage floor spuriously and
 * is invisible here). ⚠ It is STRICTER, and that is disclosed rather than discovered: a file that gains one
 * uncovered branch fails even if its percentage improves.
 *
 * ── WHY A COMMITTED BASELINE RATHER THAN `thresholds.perFile` ───────────────────────────────────────────────
 * `perFile: true` is a BOOLEAN that reapplies the SAME four numbers to every file. Turned on at today's numbers
 * it fails 38 of 106 files; set to numbers everything passes it drops the effective floors to 71/60/50/75 —
 * surrendering the aggregate guarantee to buy the per-file one. That is a TRADE, not an addition, and the
 * opposite of a ratchet. Glob-keyed thresholds are additive but aggregate over matched files, so only a
 * one-file glob is genuinely per-file — 38 hand-maintained config pins, which is the stale-pin defect
 * multiplied. Both confirmed against vitest's shipped source (`coverage.DM_a_rWm.js:838,861,886`).
 *
 * ── TWO LIMBS, AND THEY MUST FAIL SEPARATELY ────────────────────────────────────────────────────────────────
 *   FLOOR_REGRESSED    — a file's uncovered count ROSE above its recorded figure. Names the file, the metric,
 *                        the baseline and the measured value. Never a bare count.
 *   POPULATION_CHANGED — the measured file set differs from the baseline's. Without this limb a NEW file full
 *                        of uncovered code is invisible, which is the hole the mechanism exists to close.
 * ⚠ If one mutation trips both, they are one check wearing two names (`REG-F-099`'s shape). `verif/` drives
 * each limb with its own fixture precisely so that cannot go unnoticed.
 *
 * ── THE BASELINE IS DERIVED. IT IS NEVER HAND-EDITED ────────────────────────────────────────────────────────
 * Regenerate it with `--write` in the SAME COMMIT as the change that moved it, exactly as `slices:ledger` and
 * `csaa:inventory` are. Editing a number here to make a gate pass is indistinguishable, afterwards, from the
 * work that would have earned it.
 *
 * ⚠ `--check` NEVER WRITES, and a MISSING INPUT IS A LOUD FAILURE, never "nothing to check". A checker that
 * treats an absent summary as success is the control-that-cannot-fail this repository keeps recording.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The four metrics istanbul reports, ratcheted together — a per-file rule covering one invites the gap to move. */
const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
type Metric = (typeof METRICS)[number];

/** Per file, the number of UNCOVERED units for each metric. */
type FloorEntry = Record<Metric, number>;
interface Baseline {
	readonly note: string;
	readonly generator: string;
	readonly files: Record<string, FloorEntry>;
}

const DEFAULT_SUMMARY = `${ROOT}coverage/coverage-summary.json`;
// ⚠ NOT `verif/coverage/` — `.gitignore:6` is `coverage/`, which matches a directory of that name at ANY
// depth, so a baseline placed there would be silently UNCOMMITTABLE and would simply not exist for anyone
// else. A derived artifact whose whole purpose is to be committed must live somewhere git will keep it; the
// sibling precedent is `verif/slices/slice-ledger.baseline.json`.
const DEFAULT_BASELINE = `${ROOT}verif/floors/per-file-floor.baseline.json`;

const flags = process.argv.slice(2);
const mode = flags.filter((f) => f === '--write' || f === '--check');
const valueOf = (name: string): string | undefined => {
	const hit = flags.find((f) => f.startsWith(`${name}=`));
	return hit === undefined ? undefined : hit.slice(name.length + 1);
};
const summaryPath = valueOf('--summary') ?? DEFAULT_SUMMARY;
const baselinePath = valueOf('--baseline') ?? DEFAULT_BASELINE;

function die(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(2);
}

if (mode.length !== 1) die('coverage:floor — use exactly one of --write or --check.');

/** Repo-relative, forward slashes, so the baseline is identical on every machine that generates it. */
function normalise(key: string): string {
	const forward = key.split('\\').join('/');
	const rootForward = ROOT.split('\\').join('/');
	return forward.startsWith(rootForward) ? forward.slice(rootForward.length) : forward;
}

function readMeasured(): Record<string, FloorEntry> {
	// ⛔ THE READER-BLINDED CASE, AND IT FAILS LOUDLY. `--check` runs immediately after `test:coverage`; if the
	// summary is absent the coverage run did not happen, and reporting "no regressions" would be a gate that
	// passes precisely when it has measured nothing.
	if (!existsSync(summaryPath))
		die(
			`coverage:floor — MISSING COVERAGE SUMMARY at ${normalise(summaryPath)}.\n` +
				`This check runs after \`test:coverage\` and has nothing to read, which is a FAILURE, not an all-clear.\n` +
				`Run \`bun run test:coverage\` first.`
		);
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(summaryPath, 'utf8'));
	} catch (cause) {
		die(`coverage:floor — coverage summary at ${normalise(summaryPath)} is not readable JSON: ${String(cause)}`);
	}
	if (typeof raw !== 'object' || raw === null)
		die(`coverage:floor — coverage summary at ${normalise(summaryPath)} is not an object.`);

	const out: Record<string, FloorEntry> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (key === 'total') continue; // the aggregate this whole mechanism exists to look past
		const per = value as Partial<Record<Metric, { total?: number; covered?: number }>>;
		const entry = {} as FloorEntry;
		for (const metric of METRICS) {
			const m = per[metric];
			if (typeof m?.total !== 'number' || typeof m?.covered !== 'number')
				die(`coverage:floor — ${normalise(key)} has no usable "${metric}" totals in the summary.`);
			entry[metric] = m.total - m.covered;
		}
		out[normalise(key)] = entry;
	}
	if (Object.keys(out).length === 0)
		die(
			`coverage:floor — the coverage summary at ${normalise(summaryPath)} reports ZERO files.\n` +
				`An empty population makes every per-file assertion below vacuously true, so it is refused.`
		);
	return out;
}

const sortedByKey = (files: Record<string, FloorEntry>): Record<string, FloorEntry> =>
	Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

if (mode[0] === '--write') {
	const files = sortedByKey(readMeasured());
	const baseline: Baseline = {
		note: 'DERIVED — never hand-edited. Regenerate with `bun run coverage:floor` in the same commit as the change that moved it. Values are UNCOVERED COUNTS per metric, not percentages.',
		generator: 'scripts/coverage-floor.ts --write',
		files
	};
	mkdirSync(dirname(baselinePath), { recursive: true });
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, '\t')}\n`);
	process.stdout.write(
		`coverage:floor — wrote ${Object.keys(files).length} file floors to ${normalise(baselinePath)}\n`
	);
	process.exit(0);
}

// ── --check ─────────────────────────────────────────────────────────────────────────────────────────────────
if (!existsSync(baselinePath))
	die(
		`coverage:floor — MISSING BASELINE at ${normalise(baselinePath)}.\n` +
			`Generate it with \`bun run coverage:floor\`. An absent baseline is not an empty one.`
	);

let baseline: Baseline;
try {
	baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;
} catch (cause) {
	die(`coverage:floor — baseline at ${normalise(baselinePath)} is not readable JSON: ${String(cause)}`);
}
if (typeof baseline?.files !== 'object' || baseline.files === null)
	die(`coverage:floor — baseline at ${normalise(baselinePath)} has no "files" map.`);

const measured = readMeasured();
const recorded = baseline.files;

// LIMB 2 — POPULATION. Computed first because a regression report over a mismatched population is noise.
const added = Object.keys(measured).filter((f) => !(f in recorded)).sort();
const removed = Object.keys(recorded).filter((f) => !(f in measured)).sort();

// LIMB 1 — RATCHET, over the files BOTH sides know about, so the two limbs stay independent.
const regressions: string[] = [];
for (const file of Object.keys(measured).sort()) {
	const before = recorded[file];
	if (before === undefined) continue;
	for (const metric of METRICS) {
		const now = measured[file]![metric];
		const then = before[metric];
		if (typeof then !== 'number')
			die(`coverage:floor — baseline entry for ${file} has no "${metric}" figure.`);
		if (now > then)
			regressions.push(
				`  FLOOR_REGRESSED  ${file}  ${metric}: ${then} uncovered at baseline, ${now} now (+${now - then})`
			);
	}
}

const problems: string[] = [];
if (regressions.length > 0)
	problems.push(
		`coverage:floor — ${regressions.length} per-file regression(s). Uncovered counts may not RISE:`,
		...regressions
	);
if (added.length > 0 || removed.length > 0) {
	problems.push(
		`coverage:floor — POPULATION_CHANGED: the measured file set differs from the baseline's.`,
		...added.map((f) => `  POPULATION_CHANGED  ${f}  is measured but absent from the baseline`),
		...removed.map((f) => `  POPULATION_CHANGED  ${f}  is in the baseline but no longer measured`),
		`  Regenerate with \`bun run coverage:floor\` in the SAME COMMIT as the change that moved it.`
	);
}

if (problems.length > 0) {
	process.stderr.write(`${problems.join('\n')}\n`);
	process.exit(1);
}

process.stdout.write(
	`coverage:floor — ${Object.keys(measured).length} files, no uncovered count rose, population unchanged.\n`
);
