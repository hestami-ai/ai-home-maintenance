/**
 * guards:export — the EXPORT-GUARD census and ratchet. `bun run scripts/export-guard.ts --write | --check`
 *
 * ── THE UNIT IS THE PRODUCTION-CONSUMED EXPORT, AND THAT CHOICE IS THE WHOLE DESIGN ─────────────────────────
 * The sponsor rejected "at least one mutant per file" in the terms that name its defect: it measures
 * INSTRUMENTATION, not consequence. A file is not owed a guard because it is a file; it is owed one because
 * other production code imports something from it and therefore relies on a promise.
 *
 * ⛔ ~~AND IT IS A DERIVED STANDARD, NOT AN INVENTED TARGET: 0.97 mutants per production-consumed export, MEDIAN
 * PER-FILE RATIO 1.00 — what good practice here already looks like, stated as a rule.~~ **THAT CLAIM IS REFUTED,
 * BY THE ATTRIBUTION THIS SCRIPT NOW PERFORMS.** Those figures divided a per-FILE mutant COUNT by a per-EXPORT
 * denominator, so a file with six mutants on one export scored 1.00. Measured with guards actually ATTRIBUTED to
 * the export they anchor in: **111 of 331 consumed exports are guarded — 0.34 aggregate, and a MEDIAN PER-FILE
 * FRACTION OF 0.06.**
 *
 * ⚠ SO "ONE GUARD PER PRODUCTION-CONSUMED EXPORT" IS AN ASPIRATION, NOT A DESCRIPTION OF CURRENT PRACTICE, and
 * this header says so because the earlier wording was the design's central warrant for the unit. ⭑ The UNIT
 * survives — it is relational, and what a file owes the system still flows through what other modules import
 * from it. What does not survive is the claim that the repository was already meeting it.
 * ⭐ And the suspicion recorded against the old figure was right for the wrong reason: a ratio landing on 1.00
 * straight after a definitional change deserved distrust, it was disaggregated — and the disaggregation used the
 * SAME contaminated numerator, so mean and median agreed with each other while both were wrong.
 *
 * ── WHY NOT THE OBVIOUS PROXIES, EACH REFUTED BY MEASUREMENT ────────────────────────────────────────────────
 *   · "one per file"        — a token. `governance.ts` has 794 lines and 128 branches; one mutant proves one
 *                             claim and nothing about the rest.
 *   · "scaled to branches"  — a target dressed as a floor.
 *   · "files whose exports no test imports are the weak ones" — REFUTED. A 16-mutant sample over six peripheral
 *                             files had SIX exports with no test importer and all six were KILLED by indirect
 *                             suites. Ordering this burn-down by that proxy would prioritise the wrong files.
 *
 * ── IT IS INTRODUCED FROZEN ─────────────────────────────────────────────────────────────────────────────────
 * ⛔ The check does NOT demand the outstanding obligation on the day it lands. It refuses REGRESSION: a file may
 * not lose a guard it had, and the population may not move without the census being regenerated. Introducing a
 * ratchet and demanding the work in one act makes a failure attributable to neither.
 *
 * ⚠ `--check` NEVER WRITES, and the census is DERIVED — regenerate with `--write` in the same commit as the
 * change that moved it. Editing a number here is indistinguishable, afterwards, from the work that earned it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
	attributeGuard,
	type ExportSpan,
	compareGuardCensus,
	isGeneratedSource,
	isProductionConsumer,
	outstandingObligation,
	type GuardCensus,
	type GuardEntry
} from './export-guard-core.js';
import { DECLARED_MUTANTS, isHistory } from './mutants/ledger.js';
import { anchorRange } from './mutants/scope-core.js';

// ⛔ FORWARD SLASHES, EVERYWHERE, FROM THE ROOT DOWN. `fileURLToPath` yields backslashes on Windows, and the
// walk normalises its results — so a barrel path built from a backslash ROOT and a file path from the walk are
// the SAME FILE SPELLED TWO WAYS. The map lookup then misses silently and the file reports ZERO consumed
// exports. Observed: `governance.ts` showed an empty surface while nine production modules import from it.
const ROOT = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');
const BASELINE = `${ROOT}verif/floors/export-guard.baseline.json`;

const flags = process.argv.slice(2);
const mode = flags.filter((f) => f === '--write' || f === '--check');
if (mode.length !== 1) {
	process.stderr.write('guards:export — use exactly one of --write or --check.\n');
	process.exit(2);
}

const fwd = (p: string) => p.split('\\').join('/');
const rel = (p: string) => fwd(p).slice(fwd(ROOT).length);

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'dist' || name === '.svelte-kit') continue;
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/[.](ts|tsx|svelte)$/.test(name)) out.push(fwd(p));
	}
	return out;
}

function sourceOf(file: string): ts.SourceFile {
	let text = readFileSync(file, 'utf8');
	if (file.endsWith('.svelte')) {
		// Only the script blocks are TypeScript; the markup would derail the parser.
		const open = /<script[^>]*>/g;
		const parts: string[] = [];
		let m: RegExpExecArray | null;
		while ((m = open.exec(text)) !== null) {
			const start = m.index + m[0].length;
			const end = text.indexOf('</' + 'script>', start);
			if (end > start) parts.push(text.slice(start, end));
		}
		text = parts.join('\n');
	}
	return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

const isExported = (n: ts.Node) =>
	(ts.getCombinedModifierFlags(n as ts.Declaration) & ts.ModifierFlags.Export) !== 0;

/**
 * Exported VALUES and their declaration spans. A type makes no runtime promise a mutant can attack, so types
 * are excluded.
 *
 * ⭑ THE SPANS ARE WHAT MAKE ATTRIBUTION POSSIBLE. A mutant's anchor resolves to a line range; an export owns a
 * line range; a guard belongs to the export whose range CONTAINS it. Without this the census could only count
 * mutants per file, which made guards fungible within a file.
 */
function exportedValueSpans(file: string): ExportSpan[] {
	const sf = sourceOf(file);
	const spans: ExportSpan[] = [];
	const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
	const push = (name: string, node: ts.Node) => {
		spans.push({ name, startLine: lineOf(node.getStart(sf)), endLine: lineOf(node.getEnd()) });
	};
	for (const st of sf.statements) {
		if (ts.isFunctionDeclaration(st) && isExported(st) && st.name) push(st.name.text, st);
		else if (ts.isClassDeclaration(st) && isExported(st) && st.name) push(st.name.text, st);
		else if (ts.isEnumDeclaration(st) && isExported(st)) push(st.name.text, st);
		else if (ts.isVariableStatement(st) && isExported(st)) {
			// Several names can share one statement (`export const a = 1, b = 2`); each owns the whole span.
			for (const d of st.declarationList.declarations) {
				if (ts.isIdentifier(d.name)) push(d.name.text, st);
			}
		} else if (
			ts.isExportDeclaration(st) &&
			!st.moduleSpecifier &&
			st.exportClause &&
			ts.isNamedExports(st.exportClause)
		) {
			for (const el of st.exportClause.elements) {
				if (!el.isTypeOnly && !st.isTypeOnly) push(el.name.text, st);
			}
		}
	}
	return spans;
}

const exportedValues = (file: string): string[] => exportedValueSpans(file).map((e) => e.name);

function resolveRelative(fromFile: string, spec: string): string | undefined {
	if (!spec.startsWith('.')) return undefined;
	const base = fromFile.slice(0, fromFile.lastIndexOf('/'));
	const stem = spec.replace(/[.]js$/, '');
	for (const candidate of [`${base}/${stem}.ts`, `${base}/${stem}/index.ts`]) {
		const segs: string[] = [];
		for (const s of candidate.split('/')) {
			if (s === '.') continue;
			if (s === '..') segs.pop();
			else segs.push(s);
		}
		const joined = segs.join('/');
		if (existsSync(joined)) return joined;
	}
	return undefined;
}

// ── package surfaces, so an import of a BARREL is attributed to the file that DEFINES the name ──────────────
const pkgSurface = new Map<string, Map<string, string>>();
/** absolute path of a package's `src/index.ts` -> its package name */
const barrelOwner = new Map<string, string>();

for (const dir of readdirSync(`${ROOT}packages`).filter((d) => d.startsWith('rph-'))) {
	const manifest = `${ROOT}packages/${dir}/package.json`;
	const barrel = `${ROOT}packages/${dir}/src/index.ts`;
	if (!existsSync(manifest) || !existsSync(barrel)) continue;
	const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name: string }).name;
	const map = new Map<string, string>();
	for (const st of sourceOf(barrel).statements) {
		if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier))
			continue;
		const target = resolveRelative(barrel, st.moduleSpecifier.text);
		if (target === undefined) continue;
		if (!st.exportClause) for (const n of exportedValues(target)) map.set(n, target);
		else if (ts.isNamedExports(st.exportClause))
			for (const el of st.exportClause.elements) map.set(el.name.text, target);
	}
	for (const n of exportedValues(barrel)) map.set(n, barrel);
	pkgSurface.set(name, map);
	barrelOwner.set(barrel, name);
}

// ── who imports what ───────────────────────────────────────────────────────────────────────────────────────
/** definingFile -> exportName -> importers */
const consumers = new Map<string, Map<string, Set<string>>>();
const note = (def: string, name: string, importer: string) => {
	if (def === importer) return;
	if (!consumers.has(def)) consumers.set(def, new Map());
	const m = consumers.get(def)!;
	if (!m.has(name)) m.set(name, new Set());
	m.get(name)!.add(importer);
};

for (const file of [`${ROOT}packages`, `${ROOT}apps`, `${ROOT}verif`, `${ROOT}scripts`].flatMap((d) =>
	walk(d)
)) {
	for (const st of sourceOf(file).statements) {
		const spec =
			ts.isImportDeclaration(st) || ts.isExportDeclaration(st) ? st.moduleSpecifier : undefined;
		if (spec === undefined || !ts.isStringLiteral(spec)) continue;
		let names: string[] = [];
		if (
			ts.isImportDeclaration(st) &&
			st.importClause?.namedBindings &&
			ts.isNamedImports(st.importClause.namedBindings)
		)
			names = st.importClause.namedBindings.elements.map((e) => (e.propertyName ?? e.name).text);
		else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause))
			names = st.exportClause.elements.map((e) => (e.propertyName ?? e.name).text);
		if (names.length === 0) continue;

		const s = spec.text;
		if (s.startsWith('.')) {
			const target = resolveRelative(file, s);
			if (target === undefined) continue;
			// ⚠ A RELATIVE IMPORT CAN LAND ON A BARREL TOO. Attributing the names to `index.ts` instead of the
			// file that DEFINES them is how `canPromoteBaseline` read as having no test importer while
			// `governance.test.ts` imports it fourteen times from `./index.js`.
			const owner = barrelOwner.get(target);
			for (const n of names) note(owner ? (pkgSurface.get(owner)?.get(n) ?? target) : target, n, file);
		} else {
			const map = pkgSurface.get(s);
			if (map) for (const n of names) { const t = map.get(n); if (t) note(t, n, file); }
		}
	}
}

// ── the census ─────────────────────────────────────────────────────────────────────────────────────────────
const MEASURABLE = DECLARED_MUTANTS.filter((m) => !isHistory(m));
/** file -> the measurable mutants declared against it, so each can be attributed to an export by line. */
const mutantsByFile = new Map<string, typeof MEASURABLE>();
for (const m of MEASURABLE) {
	const list = mutantsByFile.get(m.file) ?? [];
	list.push(m);
	mutantsByFile.set(m.file, list);
}

const census: GuardCensus = {};
for (const file of walk(`${ROOT}packages`)) {
	if (!/\/src\//.test(file) || /[.](test|spec)[.]ts$/.test(file) || file.endsWith('/index.ts')) continue;
	const text = readFileSync(file, 'utf8');
	if (isGeneratedSource(text)) continue;

	const spans = exportedValueSpans(file);
	const map = consumers.get(file) ?? new Map<string, Set<string>>();
	const consumed = spans
		.filter((e) => [...(map.get(e.name) ?? [])].some((c) => isProductionConsumer(c)))
		.map((e) => e.name);
	const key = rel(file);
	const declared = mutantsByFile.get(key) ?? [];

	// ── ATTRIBUTION: a guard belongs to the export whose declaration CONTAINS its anchor ─────────────────
	const guarded = new Set<string>();
	let unattributed = 0;
	for (const m of declared) {
		const at = anchorRange(text, m.find);
		if (typeof at === 'string') {
			// An anchor that no longer lands cannot be attributed. `verif/mutant-ledger.test.ts` owns reporting
			// ledger rot; here it simply credits nothing, which is the conservative reading.
			unattributed += 1;
			continue;
		}
		const owner = attributeGuard(spans, at.startLine);
		if (owner.length === 0) unattributed += 1;
		else for (const name of owner) guarded.add(name);
	}

	if (consumed.length === 0 && declared.length === 0) continue; // nothing promised, nothing guarded
	census[key] = {
		consumedExports: [...consumed].sort((a, b) => a.localeCompare(b)),
		guardedExports: [...guarded].filter((n) => consumed.includes(n)).sort((a, b) => a.localeCompare(b)),
		unattributedMutants: unattributed
	} satisfies GuardEntry;
}

const sorted: GuardCensus = Object.fromEntries(
	Object.entries(census).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
);

if (mode[0] === '--write') {
	mkdirSync(dirname(BASELINE), { recursive: true });
	writeFileSync(
		BASELINE,
		`${JSON.stringify(
			{
				note: 'DERIVED — never hand-edited. Regenerate with `bun run guards:export` in the same commit as the change that moved it. The unit is the PRODUCTION-CONSUMED VALUE EXPORT.',
				generator: 'scripts/export-guard.ts --write',
				files: sorted
			},
			null,
			'\t'
		)}\n`
	);
	const o = outstandingObligation(sorted);
	process.stdout.write(
		`guards:export — wrote ${o.files} files to ${rel(BASELINE)}\n` +
			`  production-consumed exports:   ${o.consumedExports}\n` +
			`  of those GUARDED (attributed): ${o.guardedExports}\n` +
			`  mutants crediting no export:   ${o.unattributedMutants}\n` +
			`  files with NO guarded export:  ${o.filesWithNoGuard}\n` +
			`  OUTSTANDING OBLIGATION:        ${o.owed}\n`
	);
	process.exit(0);
}

// ── --check ────────────────────────────────────────────────────────────────────────────────────────────────
if (!existsSync(BASELINE)) {
	process.stderr.write(
		`guards:export — MISSING BASELINE at ${rel(BASELINE)}. Generate it with \`bun run guards:export\`.\n` +
			'An absent baseline is not an empty one.\n'
	);
	process.exit(2);
}
if (Object.keys(sorted).length === 0) {
	// ⛔ An empty measurement makes every comparison below vacuously true — the reader-blinded failure arriving
	// through a walk that found nothing rather than a file that was missing.
	process.stderr.write(
		'guards:export — the walk produced ZERO files. That is a broken reader, not a clean repository.\n'
	);
	process.exit(2);
}

const recorded = (JSON.parse(readFileSync(BASELINE, 'utf8')) as { files: GuardCensus }).files;
const { guardLost, populationChanged } = compareGuardCensus(recorded, sorted);

const problems: string[] = [];
if (guardLost.length > 0)
	problems.push(
		`guards:export — GUARD_LOST: ${guardLost.length} export(s) lost the guard they had.`,
		...guardLost.map((g) => `  GUARD_LOST  ${g}`)
	);
if (populationChanged.length > 0)
	problems.push(
		`guards:export — POPULATION_CHANGED: the measured surface differs from the baseline's.`,
		...populationChanged.map((p) => `  POPULATION_CHANGED  ${p}`),
		'  Regenerate with `bun run guards:export` in the SAME COMMIT as the change that moved it.'
	);

if (problems.length > 0) {
	process.stderr.write(`${problems.join('\n')}\n`);
	process.exit(1);
}

const o = outstandingObligation(sorted);
process.stdout.write(
	// ⚠ THE WORDING IS PART OF THE GUARANTEE. "no guard lost" described the per-FILE count this check no longer
	// performs; what it now verifies is that no EXPORT lost the guard it had. A message that outlives the
	// semantics it described is how a reader comes to believe a weaker claim than the one being made.
	`guards:export — ${o.files} files, no export lost its guard, surface unchanged. ` +
		`Outstanding obligation: ${o.owed} bare export(s); ${o.guardedExports} of ${o.consumedExports} guarded; ` +
		`${o.filesWithNoGuard} file(s) with no guarded export; ${o.unattributedMutants} mutant(s) crediting none.\n`
);
