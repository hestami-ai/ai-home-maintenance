// JAN-SLICE — the Slice Ledger generator (JAN-SLICE-SWP-01).
//
// ── SL-L1: THE LEDGER IS DERIVED, NEVER AUTHORED ─────────────────────────────────────────────────────────────
// This module reads Slice declarations out of Slice sources and renders the ledger from those alone. There is no
// hand-authored input anywhere, and there must never be one. The reason is measured, not stylistic: the master
// tracker's progress log froze on 2026-07-12 while ~19 hand-written ROADMAP-*.md files grew around it, and a
// record that is authored and then read will always drift from what it describes.
//
// ── SL-L5: THE REGISTER GOVERNS; THIS IS A DERIVED VIEW ──────────────────────────────────────────────────────
// It does NOT read `JPWB-REG-005`. Where the register and the ledger disagree, the register is right and this
// generator is defective.
//
// ── WHY DECLARATIONS ARE PARSED AND NEVER IMPORTED ───────────────────────────────────────────────────────────
// Importing a Slice module was driven and rejected. Outside its runner the module does not load at all; inside
// vitest, importing a Slice RE-REGISTERS its suites into the importing file — so the ledger would go red whenever
// a Slice went red, unable to tell "the ledger is stale" from "a slice is failing". The suite is red for the
// whole SWP-00 -> SWP-03 window by design, which makes that fatal rather than untidy. The TypeScript compiler API
// reads the declaration without executing a line of it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { SCENARIO_CLASSES } from '@janumipwb/rph-contracts/slice';
import ts from 'typescript';

/**
 * ⚠ THE PERMANENT CANARY. Committed unreachable ON PURPOSE.
 *
 * `discovery \ recognition == {}` is an ABSENCE assertion, and this repository's standing rule is that an absence
 * claim needs a positive control of the same shape — otherwise a sweep that silently returned nothing satisfies
 * it and the gate is green because it looked at no files. So exactly one Slice-shaped file lives where the
 * recognition predicate cannot reach it, and the gate asserts the delta is EXACTLY this one. Empty means the
 * sweep stopped working; a superset means a real Slice is hiding.
 */
export const CANARY = 'packages/rph-engine/test-fixtures/slice-predicate-canary/CANARY.slice.test.ts';

/**
 * RECOGNITION — the four patterns the ledger is built from, and nothing else.
 *
 * Written as explicit regexes rather than globs so the predicate is auditable in the file that applies it. In
 * glob terms, with <pkg> for one path segment and <any> for any depth:
 *
 *   packages/<pkg>/src/<any>/<name>.slice.test.ts
 *   apps/<app>/src/<any>/<name>.slice.test.ts
 *   verif/<any>/<name>.slice.test.ts
 *   apps/<app>/e2e/<any>/<name>.slice.e2e.ts
 *
 * ⚠ THE DOUBLE SUFFIX IS LOAD-BEARING (REG-F-293). A plain `.slice.ts` is collected by NO runner here — the
 * vitest package projects include only `.test.ts` under `src`, and Playwright matches only `.e2e.ts` — and under
 * a package's `src` it would additionally be emitted into `dist` and enter the coverage denominator. A Slice no
 * runner collects asserts nothing while still appearing in this ledger, which is the worst outcome available to
 * this programme.
 */
export const RECOGNITION: readonly RegExp[] = [
	/^packages\/[^/]+\/src\/(?:.+\/)?[^/]+\.slice\.test\.ts$/,
	/^apps\/[^/]+\/src\/(?:.+\/)?[^/]+\.slice\.test\.ts$/,
	/^verif\/(?:.+\/)?[^/]+\.slice\.test\.ts$/,
	/^apps\/[^/]+\/e2e\/(?:.+\/)?[^/]+\.slice\.e2e\.ts$/
];

/** The gitignore-aware working set: tracked files plus untracked-but-not-ignored ones. */
export function workingSet(root: string): string[] {
	const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});
	return out.split('\n').filter((l) => l.length > 0);
}

export function recognise(files: readonly string[]): string[] {
	return files.filter((f) => RECOGNITION.some((re) => re.test(f))).sort(byCodeUnit);
}

/**
 * The predicate's own implementation, which necessarily contains the marker it searches for.
 *
 * ⚠ THIS IS AN EXEMPTION LIST, AND THIS REPOSITORY HAS RECORDED THAT EXEMPTION LISTS ROT INTO ALLOWLISTS. It is
 * therefore held to the same rule as every other one here: **no exemption may name a thing that is not actually
 * handled, and every exemption must name a thing that exists.** `slice-ledger.test.ts` drives both directions —
 * each named file must exist AND must really contain the marker, so an entry whose reason expired fails rather
 * than lingering. Two files, both self-referential by construction, and nothing else may be added without the
 * same proof.
 */
export const PREDICATE_SELF: readonly string[] = ['verif/slice-ledger.ts', 'verif/slice-ledger.test.ts'];

/**
 * DISCOVERY — deliberately wider than recognition, in three limbs.
 *
 * ⚠ KEYING THIS ON THE WORD "slice" WAS REJECTED WITH A NUMBER: 52 tracked `.ts` files contain it, so such a
 * predicate starts at day-one false positives and gets weakened within a week. These three limbs match 0 files
 * today and still catch the exact filename the roadmap originally proposed.
 *
 * ⚠ AND THE RESIDUAL THIS DOES NOT CLOSE: every limb keys on the word "slice". They catch a Slice that was MOVED.
 * They do NOT catch a Slice-shaped substrate INVENTED under another vocabulary — which is precisely what
 * `docs/tracking/w3b/` was to the tracker index: 614 records typed "limb", a type that loader throws on, invisible
 * to it from one day after it was built.
 */
export function discover(root: string, files: readonly string[]): string[] {
	// ⚠ ALL THREE LIMBS ARE SCOPED TO SOURCE FILES, AND THAT SCOPE IS LOAD-BEARING RATHER THAN AN OPTIMISATION.
	// A first draft applied the filename and directory limbs to every path, and the sweep immediately found the
	// ledger's OWN PRODUCTS — `verif/slices/slice-ledger.baseline.json` and `docs/tracking/slices/LEDGER.md` both
	// sit under a `slices/` segment. A generator whose blind-spot control fires on its own output would have been
	// weakened within a week, which is exactly how these predicates rot. Discovery looks for Slice SOURCE.
	const isSource = (f: string): boolean => /\.(ts|tsx|svelte)$/.test(f);
	const hits = new Set<string>();
	for (const f of files) {
		if (!isSource(f)) continue;
		if (/\.slice\./.test(basename(f))) hits.add(f); // D-1 filename
		if (/(^|\/)slices\//.test(f)) hits.add(f); // D-2 directory
	}
	for (const f of files) {
		if (!isSource(f) || hits.has(f)) continue; // D-3 marker
		if (PREDICATE_SELF.includes(f)) continue; // the searcher is not the searched-for
		let text: string;
		try {
			text = readFileSync(`${root}/${f}`, 'utf8');
		} catch {
			continue; // a working-set entry that vanished mid-run is not a Slice
		}
		if (text.includes('export const SLICE')) hits.add(f);
	}
	return [...hits].sort(byCodeUnit);
}

function refuse(message: string): never {
	throw new Error(`slice-ledger: ${message}`);
}

/**
 * Code-unit ordering, stated explicitly.
 *
 * ⚠ NOT `localeCompare`, THOUGH A LINTER WILL ASK FOR IT. `localeCompare` orders by the RUNNING MACHINE'S locale,
 * so two developers could generate byte-different ledgers from identical declarations and the staleness gate
 * would blame whoever ran it second. A committed artifact needs an order that is the same everywhere.
 */
function byCodeUnit(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

/** The four scalar forms, split out so `literal` stays within the repository's cognitive-complexity budget. */
function scalarLiteral(node: ts.Node): { readonly hit: boolean; readonly value: unknown } {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
		return { hit: true, value: node.text };
	if (ts.isNumericLiteral(node)) return { hit: true, value: Number(node.text) };
	if (node.kind === ts.SyntaxKind.TrueKeyword) return { hit: true, value: true };
	if (node.kind === ts.SyntaxKind.FalseKeyword) return { hit: true, value: false };
	return { hit: false, value: undefined };
}

/** Literal-only extraction. Anything the compiler does not hand us as a literal is a refusal, never a guess. */
function literal(node: ts.Node, path: string, field: string): unknown {
	const scalar = scalarLiteral(node);
	if (scalar.hit) return scalar.value;
	if (ts.isArrayLiteralExpression(node))
		return node.elements.map((e, i) => literal(e, path, `${field}[${i}]`));
	if (ts.isObjectLiteralExpression(node)) {
		const o: Record<string, unknown> = {};
		for (const p of node.properties) {
			if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
				refuse(`SLICE.${field} — unsupported property form at ${path}`);
			const key = p.name.text;
			o[key] = literal(p.initializer, path, `${field}.${key}`);
		}
		return o;
	}
	if (ts.isAsExpression(node)) return literal(node.expression, path, field); // `as const`
	refuse(`SLICE.${field} — not a literal (SyntaxKind ${ts.SyntaxKind[node.kind]}) at ${path}`);
}

export interface RawSlice {
	readonly path: string;
	readonly declaration: Record<string, unknown>;
}

/**
 * Parse one Slice's declaration out of SOURCE TEXT, without executing it and without touching the filesystem.
 *
 * ⚠ THE TEXT-IN SIGNATURE IS NOT A CONVENIENCE — IT IS WHAT MAKES THE READER TESTABLE AT ALL. A first draft took
 * a path, so its tests had to write fixture files; and a fixture named to exercise the reader necessarily matched
 * the recognition predicate, which meant the reader's own test polluted the recognised set and refused the whole
 * ledger. Any fixture containing `export const SLICE` would likewise have been caught by the discovery sweep and
 * broken the blind-spot control. Parsing a string is the only shape with neither problem.
 */
export function parseSliceSource(source: string, path: string): RawSlice {
	// ⚠ PUBLIC API ONLY. `SourceFile.parseDiagnostics` is internal and not on the public type; a program's
	// `getSyntacticDiagnostics` is the supported way to ask "did this parse". A single in-memory file, no lib,
	// no resolution — we are reading a declaration, not typechecking a project.
	const sf = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
	const host: ts.CompilerHost = {
		getSourceFile: (name) => (name === path ? sf : undefined),
		writeFile: () => undefined,
		getDefaultLibFileName: () => 'lib.d.ts',
		useCaseSensitiveFileNames: () => true,
		getCanonicalFileName: (n) => n,
		getCurrentDirectory: () => '',
		getNewLine: () => '\n',
		fileExists: (name) => name === path,
		readFile: (name) => (name === path ? source : undefined)
	};
	const program = ts.createProgram([path], { noResolve: true, noLib: true, noEmit: true }, host);
	const syntactic = program.getSyntacticDiagnostics(sf);
	if (syntactic.length > 0) {
		const first = ts.flattenDiagnosticMessageText(syntactic[0]!.messageText, ' ');
		refuse(`${path} — SLICE declaration does not parse (${first})`);
	}

	const found: ts.Expression[] = [];
	for (const stmt of sf.statements) {
		if (!ts.isVariableStatement(stmt)) continue;
		const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
		if (!exported) continue;
		for (const d of stmt.declarationList.declarations)
			if (ts.isIdentifier(d.name) && d.name.text === 'SLICE' && d.initializer)
				found.push(d.initializer);
	}
	if (found.length === 0) refuse(`${path} — no exported const named SLICE`);
	if (found.length > 1) refuse(`${path} — more than one exported const named SLICE`);

	const value = literal(found[0]!, path, '') as Record<string, unknown>;
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		refuse(`${path} — SLICE is not an object literal`);
	return { path, declaration: value };
}

/** Read one Slice's declaration from disk. A thin wrapper: all the logic is in `parseSliceSource`. */
export function readSlice(root: string, path: string): RawSlice {
	return parseSliceSource(readFileSync(`${root}/${path}`, 'utf8'), path);
}

const RULE_CATALOG = (root: string): Set<string> => {
	const text = readFileSync(`${root}/packages/rph-domain/vocab/m12-conformance.json`, 'utf8');
	return new Set([...text.matchAll(/"(RPH-[A-Z0-9]+-\d{3})"/g)].map((m) => m[1]!));
};

export interface LedgerRow {
	readonly id: string;
	readonly title: string;
	readonly plane: string;
	readonly scenarioClass: string;
	readonly citedRules: string[];
	readonly dischargesRegisterEntries: string[];
	readonly presupposes?: string;
	readonly mutantCount: number;
	readonly path: string;
}

/**
 * Validate and normalise. Every refusal names the file and the field, because a check that fails without saying
 * which law broke teaches its reader to re-run until green — the sibling `tracker:check` says so in its own words.
 */
export function toRow(raw: RawSlice, catalog: ReadonlySet<string>): LedgerRow {
	const d = raw.declaration;
	const str = (f: string): string => {
		const v = d[f];
		if (typeof v !== 'string' || v.length === 0) refuse(`${raw.path} — SLICE.${f} must be a non-empty string`);
		return v;
	};
	const arr = (f: string): string[] => {
		const v = d[f];
		if (!Array.isArray(v)) refuse(`${raw.path} — SLICE.${f} must be an array`);
		return v.map((x, i) => {
			if (typeof x !== 'string') refuse(`${raw.path} — SLICE.${f}[${i}] must be a string`);
			return x;
		});
	};

	const plane = str('plane');
	if (plane !== 'ENGINE' && plane !== 'SURFACE')
		refuse(`${raw.path} — SLICE.plane '${plane}' is not ENGINE or SURFACE`);

	const scenarioClass = str('scenarioClass');
	if (!(SCENARIO_CLASSES as readonly string[]).includes(scenarioClass))
		refuse(`${raw.path} — SLICE.scenarioClass '${scenarioClass}' is not one of the eight ratified classes`);

	const citedRules = arr('citedRules');
	if (citedRules.length === 0)
		refuse(`${raw.path} — SLICE.citedRules is empty; a Slice citing no ratified rule is a demonstration, not a verification (SL-1)`);
	for (const id of citedRules)
		if (!catalog.has(id)) refuse(`${raw.path} — SLICE.citedRules names '${id}', which is not in the M12 rule catalog`);

	const mutants = d['mutants'];
	if (!Array.isArray(mutants)) refuse(`${raw.path} — SLICE.mutants must be an array`);
	if (mutants.length === 0)
		refuse(`${raw.path} — SLICE.mutants is empty; a Slice with no predicted red proves nothing (SL-3)`);
	mutants.forEach((m, i) => {
		const mm = m as Record<string, unknown>;
		const msg = mm['predictedMessage'];
		if (typeof msg !== 'string' || msg.length < 20)
			refuse(
				`${raw.path} — SLICE.mutants[${i}].predictedMessage is shorter than 20 characters; predict a MESSAGE, not a code`
			);
		const red = mm['expectRed'];
		if (!Array.isArray(red) || red.length === 0)
			refuse(`${raw.path} — SLICE.mutants[${i}].expectRed is empty; a mutant with no named victim proves nothing`);
	});

	const row: LedgerRow = {
		id: str('id'),
		title: str('title'),
		plane,
		scenarioClass,
		citedRules,
		dischargesRegisterEntries: arr('dischargesRegisterEntries'),
		...(plane === 'SURFACE' ? { presupposes: str('presupposes') } : {}),
		mutantCount: mutants.length,
		path: raw.path
	};
	return row;
}

export interface Ledger {
	readonly rows: LedgerRow[];
	readonly recognisedCount: number;
	readonly workingSetCount: number;
	readonly sweptCount: number;
}

export function buildLedger(root: string): Ledger {
	const files = workingSet(root);
	const recognised = recognise(files);
	const catalog = RULE_CATALOG(root);
	const rows = recognised.map((p) => toRow(readSlice(root, p), catalog));

	const seenId = new Map<string, string>();
	const seenMessage = new Map<string, string>();
	for (const r of rows) {
		const prior = seenId.get(r.id);
		if (prior) refuse(`SLICE.id '${r.id}' is declared twice — ${prior} and ${r.path}`);
		seenId.set(r.id, r.path);
	}
	for (const p of recognised) {
		const raw = readSlice(root, p);
		for (const m of raw.declaration['mutants'] as Record<string, unknown>[]) {
			const msg = m['predictedMessage'] as string;
			const prior = seenMessage.get(msg);
			if (prior)
				refuse(
					`SLICE.mutants[].predictedMessage duplicates ${prior} — a message shared by two mutants tells neither apart`
				);
			const mid = typeof m['id'] === 'string' ? m['id'] : '<unnamed>';
			seenMessage.set(msg, `${p}#${mid}`);
		}
	}

	return {
		rows,
		recognisedCount: recognised.length,
		workingSetCount: files.length,
		sweptCount: files.filter((f) => /\.(ts|svelte)$/.test(f)).length
	};
}

/** Canonical JSON: key-sorted, code-unit ordering (NOT localeCompare, whose order is locale-dependent). */
export function canonicalJson(value: unknown): string {
	const sort = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(sort);
		if (v && typeof v === 'object') {
			const o = v as Record<string, unknown>;
			const out: Record<string, unknown> = {};
			for (const k of Object.keys(o).sort(byCodeUnit)) out[k] = sort(o[k]);
			return out;
		}
		return v;
	};
	return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function sha256(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

export const BEGIN = '<!-- JAN-SLICE:GENERATED-LEDGER:BEGIN -->';
export const END = '<!-- JAN-SLICE:GENERATED-LEDGER:END -->';

/**
 * The predicate statement. It MUST appear in the ledger, and it MUST say what the ledger does not buy.
 *
 * ⚠ STATING A PREDICATE IS NECESSARY AND DEMONSTRABLY INSUFFICIENT. `docs/tracking/README.md` already stated its
 * own predicate in prose, and `docs/tracking/w3b/` appeared beside it anyway one day later. The driven control in
 * `slice-ledger.test.ts` is the load-bearing half; this text is so a reader knows what the green means.
 */
export function renderRegion(ledger: Ledger): string {
	const lines: string[] = [];
	lines.push(BEGIN);
	lines.push('');
	lines.push('> **GENERATED — DO NOT EDIT.** Written by `verif/slice-ledger.ts` via `bun run slices:ledger`.');
	lines.push('> A hand edit is reverted by the next write and fails `slices:ledger:check` in the meantime.');
	lines.push('');
	lines.push('### The predicate');
	lines.push('');
	lines.push(
		'This ledger is built from every file matching one of these four patterns, and from nothing else: ' +
			'`packages/*/src/**/*.slice.test.ts`, `apps/*/src/**/*.slice.test.ts`, `verif/**/*.slice.test.ts`, ' +
			'`apps/*/e2e/**/*.slice.e2e.ts` — matched against the gitignore-aware working set ' +
			'(`git ls-files -co --exclude-standard`). **A Slice placed anywhere else is NOT in this ledger, and ' +
			'its absence here is not evidence that it does not exist.**'
	);
	lines.push('');
	lines.push(
		'⚠ **No working-set FILE COUNT is printed here, and that is deliberate.** A first draft printed one, and ' +
			'driving `--write` then `--check` immediately reported the ledger stale: writing the two products ' +
			'added two files to the very set the header counted. The same defect would have reddened this gate ' +
			'for anyone holding an untracked scratch file — a generator whose output changes the input it ' +
			'measures produces false positives, and a gate that cries wolf is weakened within a week. Volatile ' +
			'counts are asserted live in `verif/slice-ledger.test.ts`, where both sides are computed in the same ' +
			'run, and never baked into a committed artifact.'
	);
	lines.push('');
	lines.push('### The control on that predicate');
	lines.push('');
	lines.push(
		'A wider sweep — every `.ts` and `.svelte` in the same working set whose name contains `.slice.`, or ' +
			'which lies under a `slices/` path segment, or which contains the byte sequence `export const SLICE` ' +
			'— runs on every gate run and FAILS when its result differs from the recognised set by anything other ' +
			`than the single permanent canary at \`${CANARY}\`. That canary is committed UNREACHABLE ON PURPOSE: ` +
			'it is the only reason a green here means the sweep RAN, rather than that the sweep returned nothing.'
	);
	lines.push('');
	lines.push('### What this does not buy');
	lines.push('');
	lines.push(
		'Both layers key on the word "slice". They catch a Slice that was **MOVED**. They do **not** catch a ' +
			'Slice-shaped substrate **INVENTED** under a different vocabulary — which is exactly what ' +
			'`docs/tracking/w3b/` was to the tracker index: 614 records typed `"limb"`, a type that index\'s ' +
			'loader throws on, invisible to it from one day after it was built. Nothing here closes that.'
	);
	lines.push('');
	lines.push('### What a row claims');
	lines.push('');
	lines.push(
		'`citedRules` is a **claim by the Slice\'s author** about what the Slice asserts. This generator checks ' +
			'only that each id exists in the ratified M12 catalog — it does **not** check that the Slice asserts ' +
			'it. Only the per-clause mutants, and the messages they predict, make that claim true. See ' +
			'`JAN-SLICE-DR-001` F-3: the conformance gate checks that a cited file EXISTS and never that it ' +
			'asserts anything, 125 of 125.'
	);
	lines.push('');
	lines.push('### Slices');
	lines.push('');
	if (ledger.rows.length === 0) {
		lines.push('**None.** No file matches the recognition predicate. This is the true state, not an error —');
		lines.push('`SWP-02` admits the first Slice.');
	} else {
		lines.push('| id | plane | scenario class | cited rules | mutants | discharges | source |');
		lines.push('|---|---|---|---|---|---|---|');
		for (const r of ledger.rows)
			lines.push(
				`| \`${r.id}\` | ${r.plane} | ${r.scenarioClass} | ${r.citedRules.map((x) => `\`${x}\``).join(', ')} ` +
					`| ${String(r.mutantCount)} | ${r.dischargesRegisterEntries.map((x) => `\`${x}\``).join(', ') || '—'} ` +
					`| \`${r.path}\` |`
			);
	}
	lines.push('');
	lines.push(END);
	return lines.join('\n');
}

/**
 * Replace the generated region, preserving the document's existing line endings.
 *
 * ⚠ THE EOL DETECTION IS NOT COSMETIC. On this host a text-mode write flipped LF to CRLF and turned a 12-line
 * edit into a 3137-line diff. Semantics are taken verbatim from the CSAA inventory's `replaceGeneratedRegion`:
 * exactly one begin marker and one end marker, each standalone on its own line.
 */
export function replaceRegion(document: string, region: string): string {
	const eol = document.includes('\r\n') ? '\r\n' : '\n';
	const flat = document.replace(/\r\n/g, '\n');
	const begins = flat.split(BEGIN).length - 1;
	const ends = flat.split(END).length - 1;
	if (begins !== 1 || ends !== 1)
		refuse(`the generated region markers must appear exactly once each (found ${begins} begin, ${ends} end)`);
	const start = flat.indexOf(BEGIN);
	const stop = flat.indexOf(END) + END.length;
	if (stop < start) refuse('the END marker precedes the BEGIN marker');
	const out = `${flat.slice(0, start)}${region}${flat.slice(stop)}`;
	return eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
}
