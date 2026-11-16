/**
 * Regenerate the matrix's GENERATED fields (JAN-TOOLCUR D-7; roadmap T0), and the table on the human page.
 *
 * Generated: each package row's declared ranges (manifest directory -> range), its hoisted lock version and its nested
 * copies (lock key -> version), and the day-to-day Node, read from `.node-version`. Every other field — the
 * hand-written judgments and the observed machine versions — is kept exactly as it stands. Rows keep their order and
 * keys their place, and the maps it writes are sorted, so the output depends only on the inputs: generating twice gives
 * the same bytes (roadmap T0's exit criterion), which `--check` asserts.
 *
 * Regenerating is an ordinary re-baseline (I7): it records facts the lock and the manifests already state. It is not a
 * way to make `toolchain:check` pass — the check compares these fields with the lock and the manifests, so a
 * regenerated matrix still fails wherever a hand-written pin style or a peer range is broken.
 *
 * usage: bun run scripts/toolchain/generate.ts [--check] [--root=<dir>] [--override=<path>=<file> ...]
 * exit:  0 written (or current, with --check); 1 --check found a difference; 2 the inputs could not be read.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copiesOf, parseLockfile, type Lockfile } from './lockfile.js';
import { parseMatrix } from './matrix.js';
import { externalDeclarations, makeReader, parseOverrides, readManifest, workspaceDirs, type TreeReader } from './tree.js';

export const MATRIX_PATH = 'scripts/toolchain/matrix.json';
export const PAGE_PATH = 'docs/operations/toolchain.md';
export const TABLE_BEGIN = '<!-- matrix table: written by scripts/toolchain/generate.ts; do not edit by hand -->';
export const TABLE_END = '<!-- end of matrix table -->';

function sortedRecord(entries: Iterable<[string, string]>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of [...entries].sort(([a], [b]) => a.localeCompare(b))) out[k] = v;
	return out;
}

/** The matrix text with its generated fields recomputed from the tree. Throws, naming the input, when one is unusable. */
export function regenerate(reader: TreeReader, matrixText: string): string {
	const raw = JSON.parse(matrixText) as {
		node?: Record<string, unknown>;
		packages?: Record<string, unknown>[];
	};
	const lockText = reader.read('bun.lock');
	if (lockText === undefined) throw new Error('bun.lock is missing');
	const lock: Lockfile = parseLockfile(lockText);
	const nodeVersion = reader.read('.node-version')?.trim();
	if (nodeVersion === undefined || nodeVersion === '') throw new Error('.node-version is missing or empty');
	const declarations = workspaceDirs(reader).map((dir) => {
		const manifest = readManifest(reader, dir);
		if (manifest === undefined) throw new Error(`${dir}/package.json is missing`);
		return { dir, declared: externalDeclarations(manifest) };
	});
	if (raw.node === undefined || !Array.isArray(raw.packages)) throw new Error('the matrix has no node row or no packages');
	raw.node.dayToDay = nodeVersion;
	for (const row of raw.packages) {
		const component = typeof row.component === 'string' ? row.component : '';
		if (component === '') throw new Error('a package row has no component name');
		const declared: [string, string][] = [];
		for (const { dir, declared: d } of declarations) {
			const range = d.get(component);
			if (range !== undefined) declared.push([dir, range]);
		}
		const copies = copiesOf(lock, component);
		const hoisted = copies.find((c) => c.parent === '');
		if (hoisted === undefined) throw new Error(`bun.lock holds no hoisted ${component}`);
		row.declared = sortedRecord(declared);
		row.locked = hoisted.version;
		row.nested = sortedRecord(copies.filter((c) => c.parent !== '').map((c): [string, string] => [c.key, c.version]));
	}
	const text = `${JSON.stringify(raw, null, '\t')}\n`;
	parseMatrix(text);
	return text;
}

function cell(s: string): string {
	return s.replaceAll('|', String.raw`\|`).replace(/\r?\n/g, ' ');
}

/** The human page's table, rebuilt from the matrix text between its two markers. */
export function regeneratePage(pageText: string, matrixText: string): string {
	const m = parseMatrix(matrixText);
	const begin = pageText.indexOf(TABLE_BEGIN);
	const end = pageText.indexOf(TABLE_END);
	if (begin < 0 || end < begin) throw new Error(`${PAGE_PATH} lacks its table markers`);
	const lines = [
		TABLE_BEGIN,
		'',
		'| Component | Group | Pin | Declared → locked | Nested copies | Blockers |',
		'| --- | --- | --- | --- | --- | --- |',
		`| Node | ${cell(m.node.group)} | floor and day to day | \`>=${m.node.floor}\`; day to day ${m.node.dayToDay} | — | ${cell(m.node.blockers.join('; ') || '—')} |`,
		`| Bun | ${cell(m.bun.group)} | exact | ${m.bun.version} | — | ${cell(m.bun.blockers.join('; ') || '—')} |`
	];
	for (const p of m.packages) {
		const declared = Object.entries(p.declared)
			.map(([dir, range]) => `${dir}: \`${range}\``)
			.join(', ');
		const nested = Object.entries(p.nested)
			.map(([key, version]) => `${key} ${version}`)
			.join(', ');
		lines.push(
			`| ${cell(p.component)} | ${cell(p.group)} | ${p.pin} | ${cell(declared)} → ${p.locked} | ${cell(nested || '—')} | ${cell(p.blockers.join('; ') || '—')} |`
		);
	}
	for (const t of m.machine) {
		const pin = t.check === 'none' ? 'observed' : `observed, ${t.check} checked`;
		lines.push(`| ${cell(t.component)} | ${cell(t.group)} | ${pin} | ${cell(t.observed)} (${t.date}) | — | ${cell(t.detail)} |`);
	}
	lines.push(
		`| VS Code | ${cell(m.vscode.group)} | floor | ${m.vscode.floor}: Electron ${m.vscode.floorElectron}, Node ${m.vscode.floorNode} | — | ${cell(m.vscode.source)} |`,
		'',
		TABLE_END
	);
	return pageText.slice(0, begin) + lines.join('\n') + pageText.slice(end + TABLE_END.length);
}

interface Generated {
	readonly matrixIn: string;
	readonly matrixOut: string;
	readonly pageIn: string;
	readonly pageOut: string;
}

function generateAll(root: string, argv: readonly string[]): Generated {
	const reader = makeReader(root, parseOverrides(argv));
	const matrixIn = reader.read(MATRIX_PATH);
	if (matrixIn === undefined) throw new Error(`${MATRIX_PATH} is missing`);
	const matrixOut = regenerate(reader, matrixIn);
	const pageIn = reader.read(PAGE_PATH);
	if (pageIn === undefined) throw new Error(`${PAGE_PATH} is missing`);
	return { matrixIn, matrixOut, pageIn, pageOut: regeneratePage(pageIn, matrixOut) };
}

export function main(argv: readonly string[], out: (s: string) => void, err: (s: string) => void): number {
	const rootFlag = argv.find((f) => f.startsWith('--root='));
	const root = rootFlag === undefined ? fileURLToPath(new URL('../../', import.meta.url)) : rootFlag.slice('--root='.length);
	let g: Generated;
	try {
		g = generateAll(root, argv);
	} catch (e) {
		err(`toolchain:generate — ${(e as Error).message}\n`);
		return 2;
	}
	const stale = [g.matrixIn === g.matrixOut ? '' : MATRIX_PATH, g.pageIn === g.pageOut ? '' : PAGE_PATH].filter((s) => s !== '');
	if (argv.includes('--check')) {
		if (stale.length > 0) {
			err(`toolchain:generate --check — not current: ${stale.join(', ')}\n`);
			return 1;
		}
		out('toolchain:generate --check — the matrix and its page are current.\n');
		return 0;
	}
	writeFileSync(join(root, MATRIX_PATH), g.matrixOut);
	writeFileSync(join(root, PAGE_PATH), g.pageOut);
	out(`toolchain:generate — wrote ${stale.length === 0 ? 'no change' : stale.join(', ')}.\n`);
	return 0;
}

if (import.meta.main) {
	process.exitCode = main(
		process.argv.slice(2),
		(s) => process.stdout.write(s),
		(s) => process.stderr.write(s)
	);
}
