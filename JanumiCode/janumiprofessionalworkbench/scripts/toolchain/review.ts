/**
 * `toolchain:review` — the monthly currency review (JAN-TOOLCUR D-10; roadmap T0). It writes a dated report and gates
 * nothing.
 *
 * WHAT IT READS. The npm registry for each matrix package (newest versions, and npm's own deprecation marks); Node's
 * release schedule; endoflife.date for the products it tracks (F-13: nodejs, bun, svelte, eslint, electron,
 * eclipse-temurin, git, python among ours); VS Code's stable releases and, from each tag's `.npmrc`, the Electron it
 * ships, mapped to Node through Electron's release list; `bun outdated` and `bun audit`; and the machine tools' versions
 * now, against the ones the matrix records.
 *
 * WHAT IT FLAGS (the triggers of D-10): a locked version npm marks deprecated; an end of life within 90 days, or
 * past; a machine tool that drifted from its recorded value; `bun audit` reporting vulnerabilities. `bun audit` feeds
 * this report only, never a gate step: dependency scanning stays deferred as a gate family (REG-Q-049).
 *
 * A SOURCE THAT COULD NOT BE READ IS REPORTED AS NOT READ, with its reason (roadmap §1 rule 8) — never skipped in
 * silence, so a quiet report cannot mean "nothing was looked at".
 *
 * usage: bun run scripts/toolchain/review.ts [--out=<file>] [--today=YYYY-MM-DD] [--offline=<dir>] [--root=<dir>]
 *        [--override=<path>=<file> ...]
 *   --offline reads saved responses from <dir> instead of the network and the machine (file names in `OFFLINE`).
 * exit:  0 the report was written; 2 it could not be.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edgeInstalled, executableVersion, parseMachinePaths, sonarLintInstalled, type MachinePaths } from './machine.js';
import { compareVersions, parseMatrix, versionParts, type Matrix } from './matrix.js';
import { makeReader, parseOverrides } from './tree.js';

const USER_AGENT = 'jpwb-toolchain-review';
const DAY_MS = 86_400_000;

/** Offline file names, relative to the --offline folder. */
export const OFFLINE = {
	npm: (name: string): string => `npm/${name.replaceAll('/', '__')}.json`,
	nodeSchedule: 'node-schedule.json',
	endOfLife: (product: string): string => `endoflife/${product}.json`,
	vscodeStable: 'vscode-stable.json',
	vscodeNpmrc: (version: string): string => `vscode-npmrc/${version}.txt`,
	electron: 'electron-releases.json',
	bunOutdated: 'bun-outdated.txt',
	bunAudit: 'bun-audit.txt',
	machine: 'machine.json'
} as const;

type Got = { ok: true; text: string } | { ok: false; why: string };

interface Sources {
	get(url: string, offlineName: string, accept?: string): Promise<Got>;
	command(args: readonly string[], offlineName: string): Got;
	readonly offline: string | undefined;
}

function makeSources(root: string, offline: string | undefined): Sources {
	return {
		offline,
		async get(url, offlineName, accept): Promise<Got> {
			if (offline !== undefined) {
				const file = join(offline, offlineName);
				return existsSync(file) ? { ok: true, text: readFileSync(file, 'utf8') } : { ok: false, why: `offline: ${offlineName} absent` };
			}
			try {
				const headers: Record<string, string> = { 'user-agent': USER_AGENT };
				if (accept !== undefined) headers.accept = accept;
				const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
				if (!res.ok) return { ok: false, why: `${url}: HTTP ${res.status}` };
				return { ok: true, text: await res.text() };
			} catch (e) {
				return { ok: false, why: `${url}: ${(e as Error).message}` };
			}
		},
		command(args, offlineName): Got {
			if (offline !== undefined) {
				const file = join(offline, offlineName);
				return existsSync(file) ? { ok: true, text: readFileSync(file, 'utf8') } : { ok: false, why: `offline: ${offlineName} absent` };
			}
			// S4036: kept - bun is the operator's own, found on PATH as the gate's `bun run` steps find it.
			const r = spawnSync('bun', [...args], { cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
			if (r.error !== undefined) return { ok: false, why: `bun ${args.join(' ')}: ${r.error.message}` };
			return { ok: true, text: `${r.stdout}${r.stderr}`.trim() + `\n(exit ${r.status})` };
		}
	};
}

function semver(): { satisfies(v: string, r: string): boolean } {
	const bun = (globalThis as { Bun?: { semver?: { satisfies(v: string, r: string): boolean } } }).Bun;
	if (bun?.semver === undefined) throw new Error('toolchain:review reads ranges with Bun.semver, so it must run under Bun');
	return bun.semver;
}

const STABLE = /^\d+\.\d+\.\d+$/;

interface PackageLine {
	readonly cells: string[];
	readonly flags: string[];
}

async function reviewPackage(src: Sources, row: Matrix['packages'][number]): Promise<PackageLine> {
	const url = `https://registry.npmjs.org/${row.component.replace('/', '%2f')}`;
	const got = await src.get(url, OFFLINE.npm(row.component), 'application/vnd.npm.install-v1+json');
	const ranges = [...new Set(Object.values(row.declared))].join(', ');
	if (!got.ok) return { cells: [row.component, row.pin, ranges, row.locked, 'not read', 'not read', got.why], flags: [] };
	const doc = JSON.parse(got.text) as {
		'dist-tags'?: Record<string, string>;
		versions?: Record<string, { deprecated?: string }>;
	};
	const versions = doc.versions ?? {};
	const deprecated = (v: string): string | undefined => versions[v]?.deprecated;
	const stable = Object.keys(versions).filter((v) => STABLE.test(v));
	stable.sort(compareVersions);
	const usable = stable.filter((v) => deprecated(v) === undefined);
	const inRange = usable.filter((v) => [...new Set(Object.values(row.declared))].every((r) => semver().satisfies(v, r)));
	const latest = doc['dist-tags']?.latest ?? '';
	const highest = stable.at(-1) ?? '';
	const notes: string[] = [];
	const flags: string[] = [];
	const lockedMark = deprecated(row.locked);
	if (lockedMark !== undefined) {
		flags.push(`DEPRECATED: ${row.component} ${row.locked}, the locked version, is marked deprecated by npm: "${lockedMark}"`);
	}
	if (latest !== '' && deprecated(latest) !== undefined) notes.push(`skip ${latest} (\`latest\`, deprecated)`);
	if (highest !== '' && highest !== latest && deprecated(highest) !== undefined) notes.push(`skip ${highest} (highest, deprecated)`);
	return {
		cells: [row.component, row.pin, ranges, row.locked, inRange.at(-1) ?? '—', latest || '—', notes.join('; ') || '—'],
		flags
	};
}

/** Which rows endoflife.date tracks, and the cycle each one is on (F-13's product list). */
function endOfLifeTargets(m: Matrix): { label: string; product: string; cycle: string }[] {
	const out: { label: string; product: string; cycle: string }[] = [];
	const majorOf = (v: string): string => String(versionParts(v)[0]);
	const minorOf = (v: string): string => versionParts(v).slice(0, 2).join('.');
	// endoflife.date names Node's and Bun's cycles by major ('24'; '1', read 2026-11-16).
	out.push({ label: 'Node', product: 'nodejs', cycle: majorOf(m.node.dayToDay) }, { label: 'Bun', product: 'bun', cycle: majorOf(m.bun.version) });
	const pkg = (name: string): string | undefined => m.packages.find((p) => p.component === name)?.locked;
	const svelte = pkg('svelte');
	if (svelte !== undefined) out.push({ label: 'svelte', product: 'svelte', cycle: majorOf(svelte) });
	const eslint = pkg('eslint');
	if (eslint !== undefined) out.push({ label: 'eslint', product: 'eslint', cycle: majorOf(eslint) });
	for (const t of m.machine) {
		if (t.component === 'java') out.push({ label: 'Java', product: 'eclipse-temurin', cycle: majorOf(t.observed) });
		if (t.component === 'git') out.push({ label: 'git', product: 'git', cycle: minorOf(t.observed) });
		if (t.component === 'python') out.push({ label: 'Python', product: 'python', cycle: minorOf(t.observed) });
	}
	out.push({ label: 'Electron at the VS Code floor', product: 'electron', cycle: majorOf(m.vscode.floorElectron) });
	return out;
}

async function reviewEndOfLife(src: Sources, m: Matrix, today: Date): Promise<{ lines: string[]; flags: string[] }> {
	const lines: string[] = [];
	const flags: string[] = [];
	const targets = endOfLifeTargets(m);
	const responses = await Promise.all(
		targets.map((t) => src.get(`https://endoflife.date/api/v1/products/${t.product}`, OFFLINE.endOfLife(t.product)))
	);
	for (const [i, target] of targets.entries()) {
		const got = responses[i] ?? { ok: false, why: 'no response' };
		if (!got.ok) {
			lines.push(`| ${target.label} | ${target.product} ${target.cycle} | not read: ${got.why} |`);
			continue;
		}
		const releases = (JSON.parse(got.text) as { result?: { releases?: { name: string; eolFrom?: string | null }[] } }).result?.releases ?? [];
		const release = releases.find((r) => r.name === target.cycle);
		if (release === undefined) {
			lines.push(`| ${target.label} | ${target.product} ${target.cycle} | endoflife.date lists no cycle ${target.cycle} |`);
			continue;
		}
		const eol = release.eolFrom ?? null;
		if (eol === null) {
			lines.push(`| ${target.label} | ${target.product} ${target.cycle} | no end of life announced |`);
			continue;
		}
		const days = Math.round((Date.parse(`${eol}T00:00:00Z`) - today.getTime()) / DAY_MS);
		lines.push(`| ${target.label} | ${target.product} ${target.cycle} | end of life ${eol} (${days} days) |`);
		if (days < 0) flags.push(`PAST END OF LIFE: ${target.label} (${target.product} ${target.cycle}) ended ${eol}, ${-days} days ago`);
		else if (days <= 90) flags.push(`END OF LIFE WITHIN 90 DAYS: ${target.label} (${target.product} ${target.cycle}) ends ${eol}, in ${days} days`);
	}
	return { lines, flags };
}

/** One VS Code tag's line, and whether its `.npmrc` named the Electron target the walk stops at. */
function vscodeLine(v: string, npmrc: Got, nodeOf: ReadonlyMap<string, string>): { line: string; found: boolean } {
	if (!npmrc.ok) return { line: `- VS Code ${v}: its .npmrc was not read (${npmrc.why})`, found: false };
	const target = /target="?([\d.]+)"?/.exec(npmrc.text)?.[1];
	if (target === undefined) return { line: `- VS Code ${v}: its .npmrc names no Electron target`, found: false };
	const node = nodeOf.get(target) || 'not in the Electron list read';
	return { line: `- VS Code ${v}: Electron ${target}, Node ${node}`, found: true };
}

async function reviewVsCode(src: Sources, m: Matrix): Promise<string[]> {
	const lines: string[] = [];
	const stable = await src.get('https://update.code.visualstudio.com/api/releases/stable', OFFLINE.vscodeStable);
	if (!stable.ok) return [`- VS Code releases: not read: ${stable.why}`];
	const versions = (JSON.parse(stable.text) as string[]).slice(0, 6);
	const [electron, ...npmrcs] = await Promise.all([
		src.get('https://releases.electronjs.org/releases.json', OFFLINE.electron),
		...versions.map((v) => src.get(`https://raw.githubusercontent.com/microsoft/vscode/${v}/.npmrc`, OFFLINE.vscodeNpmrc(v)))
	]);
	const nodeOf = new Map<string, string>();
	if (electron?.ok) {
		for (const r of JSON.parse(electron.text) as { version: string; node?: string }[]) nodeOf.set(r.version, r.node ?? '');
	} else lines.push(`- Electron releases: not read: ${electron?.ok === false ? electron.why : 'no response'}`);
	for (const [i, v] of versions.entries()) {
		const { line, found } = vscodeLine(v, npmrcs[i] ?? { ok: false, why: 'no response' }, nodeOf);
		lines.push(line);
		if (found) break;
	}
	lines.push(`- The matrix's floor: VS Code ${m.vscode.floor}, Electron ${m.vscode.floorElectron}, Node ${m.vscode.floorNode}.`);
	return lines;
}

/** The machine tools' versions now: probed live, or read from the saved `machine.json` offline. */
function machineNow(src: Sources, m: Matrix, paths: MachinePaths): Record<string, string | undefined> {
	if (src.offline !== undefined) {
		const file = join(src.offline, OFFLINE.machine);
		return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {};
	}
	const edge = edgeInstalled(paths);
	const now: Record<string, string | undefined> = {
		edge: edge === undefined ? undefined : String(versionParts(edge.version)[0]),
		sonarlint: sonarLintInstalled(paths)?.version
	};
	for (const t of m.machine) {
		const exe = t.probe === undefined ? undefined : paths.executables[t.probe];
		if (exe !== undefined) now[t.component] = executableVersion(exe);
	}
	return now;
}

function reviewMachine(src: Sources, m: Matrix, paths: MachinePaths): { lines: string[]; flags: string[] } {
	const now = machineNow(src, m, paths);
	const lines: string[] = [];
	const flags: string[] = [];
	for (const t of m.machine) {
		const seen = now[t.component];
		lines.push(`| ${t.component} | ${t.observed} (${t.date}) | ${seen ?? 'not read'} |`);
		if (seen !== undefined && seen !== t.observed) {
			flags.push(`MACHINE DRIFT: ${t.component} is ${seen}; the matrix records ${t.observed} (${t.date})`);
		}
	}
	return { lines, flags };
}

const TABLE_PIPE = String.raw`\|`;

function tableCell(c: string): string {
	return c.replaceAll('|', TABLE_PIPE);
}

export async function writeReview(argv: readonly string[]): Promise<{ out: string; text: string }> {
	const flag = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const root = flag('root') ?? fileURLToPath(new URL('../../', import.meta.url));
	const todayText = flag('today') ?? new Date().toISOString().slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(todayText)) throw new Error(`--today must be YYYY-MM-DD, not ${todayText}`);
	const today = new Date(`${todayText}T00:00:00Z`);
	const reader = makeReader(root, parseOverrides(argv));
	const matrixText = reader.read('scripts/toolchain/matrix.json');
	if (matrixText === undefined) throw new Error('scripts/toolchain/matrix.json is missing');
	const m = parseMatrix(matrixText);
	const pathsText = reader.read('scripts/toolchain/machine-paths.json');
	if (pathsText === undefined) throw new Error('scripts/toolchain/machine-paths.json is missing');
	const paths = parseMachinePaths(pathsText);
	const src = makeSources(root, flag('offline'));
	const out = flag('out') ?? join(root, 'docs', 'operations', 'toolchain-reviews', `${todayText.slice(0, 7)}.md`);

	const packages = await Promise.all(m.packages.map((row) => reviewPackage(src, row)));
	const schedule = await src.get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json', OFFLINE.nodeSchedule);
	const nodeMajor = `v${versionParts(m.node.dayToDay)[0]}`;
	const scheduleEntry = schedule.ok ? JSON.stringify((JSON.parse(schedule.text) as Record<string, unknown>)[nodeMajor] ?? 'not listed') : '';
	const scheduleLine = schedule.ok ? `Node's schedule for ${nodeMajor}: ${scheduleEntry}` : `Node's schedule: not read (${schedule.why})`;
	const eol = await reviewEndOfLife(src, m, today);
	const vscode = await reviewVsCode(src, m);
	const machine = reviewMachine(src, m, paths);
	const outdated = src.command(['outdated'], OFFLINE.bunOutdated);
	const audit = src.command(['audit'], OFFLINE.bunAudit);
	const auditFlags: string[] = [];
	if (audit.ok && /\bvulnerabilit/i.test(audit.text) && !/\(exit 0\)\s*$/.test(audit.text)) {
		auditFlags.push('SECURITY: `bun audit` reports vulnerabilities (below); act within days (D-10)');
	}
	const flags = [...packages.flatMap((p) => p.flags), ...eol.flags, ...machine.flags, ...auditFlags];
	const fence = '```';
	const provenance = src.offline === undefined ? '' : ' from saved responses';
	const text = [
		`# Toolchain currency review, ${todayText.slice(0, 7)}`,
		'',
		`Written by \`bun run toolchain:review\` on ${todayText}${provenance}.`,
		`Matrix: Node ${m.node.dayToDay} (floor ${m.node.floor}), Bun ${m.bun.version}, ${m.packages.length} packages.`,
		'The procedure and the meaning of each field are in `docs/operations/toolchain.md`.',
		'',
		'## Flags',
		'',
		...(flags.length === 0 ? ['None.'] : flags.map((f) => `- ${f}`)),
		'',
		'## Packages',
		'',
		'Newest in range: the highest stable version npm does not mark deprecated that every declared range admits.',
		'',
		'| Package | Pin | Declared | Locked | Newest in range | `latest` | Notes |',
		'| --- | --- | --- | --- | --- | --- | --- |',
		...packages.map((p) => `| ${p.cells.map(tableCell).join(' | ')} |`),
		'',
		'## Runtimes and end of life',
		'',
		scheduleLine,
		'',
		'| Row | endoflife.date cycle | End of life |',
		'| --- | --- | --- |',
		...eol.lines,
		'',
		'## The VS Code chain',
		'',
		...vscode,
		'',
		'## Machine tools',
		'',
		'| Tool | Recorded | Now |',
		'| --- | --- | --- |',
		...machine.lines,
		'',
		'## `bun outdated`',
		'',
		fence,
		outdated.ok ? outdated.text : `not read: ${outdated.why}`,
		fence,
		'',
		'## `bun audit`',
		'',
		fence,
		audit.ok ? audit.text : `not read: ${audit.why}`,
		fence,
		''
	].join('\n');
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, text);
	return { out, text };
}

if (import.meta.main) {
	try {
		const { out, text } = await writeReview(process.argv.slice(2));
		const flagged = text.split('\n## Packages')[0]?.split('\n').filter((l) => l.startsWith('- ')).length ?? 0;
		process.stdout.write(`toolchain:review — wrote ${out} (${flagged} flag(s)).\n`);
	} catch (e) {
		process.stderr.write(`toolchain:review — ${(e as Error).message}\n`);
		process.exitCode = 2;
	}
}
