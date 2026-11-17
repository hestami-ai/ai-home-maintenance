/**
 * `bun run sonar:compare -- <before run folder> <after run folder> [--files <list.txt>] [--fail-on-introduced]` —
 * what a change cleared and what it introduced, between two runs of the Sonar runner (JAN-SONARCM D-1, J2, J3;
 * roadmap S1). Ported from cycle 6's `compare_sweeps.py`, which compared two of the old runner's worklists.
 *
 * WHAT IT REFUSES (exit 2), because the comparison would not mean anything (J2, J3; the design's V-15):
 * - a run that does not record its engine version, its rule set's hash or its census's hash;
 * - two runs under different engines ("Counts are compared only under the same engine version");
 * - two runs under different rule sets (a finding "cleared" by a rule no longer run is not cleared);
 * - a run the runner refused, whose results are not a run's.
 * Two runs whose censuses differ are compared: a scope that grew between them is ordinary, and it is reported.
 *
 * HOW FINDINGS ARE MATCHED. Per file, as a multiset of (rule, message), because an edit moves line numbers. S3776's
 * message carries the complexity, so a lower complexity shows as one cleared and one introduced, both printed. Only
 * files the AFTER run analysed are compared; a file either run did not analyse is listed as not compared, never as
 * clean (J4).
 *
 * exit: 0 compared; 1 with --fail-on-introduced, a finding was introduced; 2 refused.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface Finding {
	readonly rule: string;
	readonly line: number;
	readonly message: string;
}

export interface FileResult {
	readonly status: string;
	readonly findings: readonly Finding[];
}

export interface RunRecord {
	readonly status?: string;
	readonly refusal?: string;
	readonly engine?: Readonly<Record<string, string | undefined>>;
	readonly ruleSet?: { readonly sha256?: string };
	readonly census?: { readonly sha256?: string };
}

export interface Run {
	readonly dir: string;
	readonly record: RunRecord;
	readonly results: Readonly<Record<string, FileResult>>;
}

/** The engine fields two runs must share (the runner writes all four; SonarJS is the one D-4 names). */
export const ENGINE_FIELDS = ['extension', 'languageServer', 'sonarjs', 'jre'] as const;

export function loadRun(dir: string): Run {
	const record = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) as RunRecord;
	const results = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8')) as Record<string, FileResult>;
	return { dir, record, results };
}

/** Every reason one run cannot be compared at all (J2), in words that name the run. */
export function recordProblems(run: Run): string[] {
	const r = run.record;
	const problems: string[] = [];
	if (r.status === 'refused') problems.push(`${run.dir}: the runner refused this run (${r.refusal ?? 'no reason recorded'})`);
	if (typeof r.engine?.sonarjs !== 'string' || r.engine.sonarjs === '') problems.push(`${run.dir}: no engine version recorded`);
	if (typeof r.ruleSet?.sha256 !== 'string' || r.ruleSet.sha256 === '') problems.push(`${run.dir}: no rule-set hash recorded`);
	if (typeof r.census?.sha256 !== 'string' || r.census.sha256 === '') problems.push(`${run.dir}: no census hash recorded`);
	return problems;
}

/** Every reason two runs cannot be compared with each other (J2, J3); empty when they can. */
export function comparabilityProblems(before: Run, after: Run): string[] {
	const problems = [...recordProblems(before), ...recordProblems(after)];
	if (problems.length > 0) return problems;
	for (const f of ENGINE_FIELDS) {
		const a = before.record.engine?.[f];
		const b = after.record.engine?.[f];
		if (a !== b) problems.push(`the runs used different engines: ${f} ${a ?? '(none)'} before, ${b ?? '(none)'} after (J3)`);
	}
	if (before.record.ruleSet?.sha256 !== after.record.ruleSet?.sha256) {
		problems.push('the runs used different rule sets: a finding a dropped rule no longer reports is not cleared');
	}
	return problems;
}

function shortRule(rule: string): string {
	return rule.slice(rule.lastIndexOf(':') + 1);
}

/** Findings as a multiset of rule and message, keyed by the two joined with a NUL. */
function multiset(findings: readonly Finding[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const f of findings) {
		const k = `${shortRule(f.rule)}\u0000${f.message}`;
		m.set(k, (m.get(k) ?? 0) + 1);
	}
	return m;
}

/** The keys of `from` beyond `less`, with their excess counts. */
function minus(from: Map<string, number>, less: Map<string, number>): { rule: string; message: string; count: number }[] {
	const out: { rule: string; message: string; count: number }[] = [];
	for (const [k, n] of from) {
		const extra = n - (less.get(k) ?? 0);
		if (extra > 0) {
			const [rule = '', message = ''] = k.split('\u0000');
			out.push({ rule, message, count: extra });
		}
	}
	return out;
}

export interface FileComparison {
	readonly file: string;
	readonly before: number;
	readonly after: number;
	readonly cleared: readonly { rule: string; message: string; count: number }[];
	readonly introduced: readonly { rule: string; message: string; count: number; lines: readonly number[] }[];
}

export interface Comparison {
	readonly files: readonly FileComparison[];
	/** Files one run did not analyse, so not compared (J4): never counted as clean. */
	readonly notCompared: readonly { file: string; why: string }[];
	readonly cleared: number;
	readonly introduced: number;
	readonly censusChanged: boolean;
}

function notComparedReason(before: Run, after: Run, file: string): string | undefined {
	const a = after.results[file];
	if (a?.status !== 'ok') return `the after run did not analyse it (${a?.status ?? 'absent'})`;
	const b = before.results[file];
	if (b !== undefined && b.status !== 'ok') return `the before run did not analyse it (${b.status})`;
	return undefined;
}

/** The comparison of two comparable runs, over the after run's files (or the named ones). */
export function compareRuns(before: Run, after: Run, only?: ReadonlySet<string>): Comparison {
	const files: FileComparison[] = [];
	const notCompared: { file: string; why: string }[] = [];
	const names = Object.keys(after.results)
		.filter((f) => only === undefined || only.has(f))
		.sort((x, y) => Number(x > y) - Number(x < y));
	for (const file of names) {
		const why = notComparedReason(before, after, file);
		if (why !== undefined) {
			notCompared.push({ file, why });
			continue;
		}
		const was = multiset(before.results[file]?.findings ?? []);
		const aFindings = after.results[file]?.findings ?? [];
		const now = multiset(aFindings);
		const introduced = minus(now, was).map((x) => ({
			...x,
			lines: aFindings.filter((f) => shortRule(f.rule) === x.rule && f.message === x.message).map((f) => f.line)
		}));
		const cleared = minus(was, now);
		if (cleared.length > 0 || introduced.length > 0) {
			files.push({ file, before: before.results[file]?.findings.length ?? 0, after: aFindings.length, cleared, introduced });
		}
	}
	const sum = (xs: readonly { count: number }[]): number => xs.reduce((n, x) => n + x.count, 0);
	return {
		files,
		notCompared,
		cleared: files.reduce((n, f) => n + sum(f.cleared), 0),
		introduced: files.reduce((n, f) => n + sum(f.introduced), 0),
		censusChanged: before.record.census?.sha256 !== after.record.census?.sha256
	};
}

export function render(c: Comparison): string {
	const lines: string[] = [];
	for (const f of c.files) {
		lines.push(`${f.file} | before ${f.before}  after ${f.after}`);
		for (const x of f.cleared) lines.push(`    cleared    ${x.count}x ${x.rule}  ${x.message.slice(0, 150)}`);
		for (const x of f.introduced) lines.push(`    INTRODUCED ${x.count}x ${x.rule} @L${x.lines.join(',')}  ${x.message.slice(0, 150)}`);
	}
	for (const n of c.notCompared) lines.push(`NOT COMPARED ${n.file}: ${n.why}`);
	if (c.censusChanged) lines.push('(the two runs used different scope censuses; files present in both are compared)');
	lines.push(`TOTAL cleared ${c.cleared} | introduced ${c.introduced} | not compared ${c.notCompared.length}`);
	return `${lines.join('\n')}\n`;
}

export function main(argv: readonly string[], out: (s: string) => void, err: (s: string) => void): number {
	const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--files');
	const filesAt = argv.indexOf('--files');
	if (positional.length !== 2 || (filesAt >= 0 && argv[filesAt + 1] === undefined)) {
		err('usage: bun run sonar:compare -- <before run folder> <after run folder> [--files <list.txt>] [--fail-on-introduced]\n');
		return 2;
	}
	const [beforeDir = '', afterDir = ''] = positional;
	const before = loadRun(resolve(beforeDir));
	const after = loadRun(resolve(afterDir));
	const problems = comparabilityProblems(before, after);
	if (problems.length > 0) {
		err(`sonar:compare refused: ${problems.join('; ')}\n`);
		return 2;
	}
	const only =
		filesAt < 0
			? undefined
			: new Set(
					readFileSync(argv[filesAt + 1] ?? '', 'utf8')
						.split(/\r?\n/)
						.map((s) => s.trim().replaceAll('\\', '/'))
						.filter((s) => s !== '')
				);
	const c = compareRuns(before, after, only);
	out(render(c));
	return argv.includes('--fail-on-introduced') && c.introduced > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2), (s) => process.stdout.write(s), (s) => process.stderr.write(s)));
