/**
 * tracker:measure — W-3's mechanical verdicts. `bun scripts/tracker/measure.ts [--write]`
 *
 * Emits verdict/attr NDJSON for the census populations that can be measured WITHOUT judgment:
 *
 *   rules     — the enforcement register's three-way disposition, translated honestly:
 *               ENFORCED → ENFORCED (its own bar is "a named production site refuses, OBSERVED
 *               end-to-end through Engine.dispatch"); UNENFORCED_DISCLOSED → DIVERGENT_FILED
 *               (the disclosure in a GATED register IS the filing); NOT_A_COMMAND_REFUSAL → an
 *               attr, never a ladder verdict — it is a scope classification, not an
 *               implementation tier, and laundering it into the ladder would manufacture ~56
 *               verdicts about nothing.
 *   commands  — TESTED, on the strength of verif/command-dispatch-census.test.ts, which asserts
 *               every COMMANDS key is named as a string literal by a driving test.
 *   queries/  — consumer-walk: the name searched across production sources (DECLARED), test
 *   events/     sources too (TESTED), or nowhere — in which case ABSENT is emitted ONLY when the
 *   surfaces    instrument's positive control (a name known to be present) fires; a search that
 *               cannot find the control refuses to call anything absent (P-3 in code).
 *
 * DETERMINISTIC: pure function of the tree; output sorted by (item_id, verdict); measured_at is
 * the DATE THE MEASUREMENT WAS TAKEN, carried in the records — re-running on a changed tree is a
 * NEW measurement and appends new records; it never edits old ones.
 *
 * ⚠ What this deliberately does NOT measure: the 192 invariants (prose→code mapping is judgment
 * work — a lane-and-refuter program, not a grep) and OBSERVED/DRIVEN tiers (probe mutations and
 * end-to-end drives are separate acts with their own evidence). Absence of a verdict here is the
 * honest state, visible in `tracker:query unverified`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRecords } from './core.js';
import { hasIdentifierOccurrence, stripComments } from './match.js';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(join(SCRIPT_DIR, '..', '..'));
const MEASURED_AT = '2026-08-20';

interface Emitted {
	readonly line: string;
	readonly sortKey: string;
}
const out: Emitted[] = [];
function emitVerdict(itemId: string, verdict: string, evidence: string, method: string): void {
	out.push({
		sortKey: `${itemId} v ${verdict}`,
		line: JSON.stringify(
			{ type: 'verdict', item_id: itemId, verdict, evidence, method, measured_at: MEASURED_AT },
			null,
			0
		)
	});
}
function emitAttr(itemId: string, key: string, value: string): void {
	out.push({
		sortKey: `${itemId} a ${key}`,
		line: JSON.stringify({ type: 'attr', item_id: itemId, key, value }, null, 0)
	});
}

/** ── Source walks (production vs test), computed once ─────────────────────────────────────── */
function walk(dir: string, acc: string[]): void {
	for (const entry of readdirSync(dir)) {
		if (['node_modules', 'dist', '.turbo', 'coverage', '.svelte-kit', 'gen'].includes(entry))
			continue;
		const absolute = join(dir, entry);
		if (statSync(absolute).isDirectory()) walk(absolute, acc);
		else if (/\.(ts|svelte)$/.test(entry)) acc.push(absolute);
	}
}
const sourceFiles: string[] = [];
walk(join(ROOT, 'packages'), sourceFiles);
walk(join(ROOT, 'apps'), sourceFiles);
const isTest = (p: string): boolean => /\.(test|spec|e2e)\.ts$/.test(p) || p.includes('e2e');
const production = sourceFiles.filter((p) => !isTest(p));
const tests = sourceFiles.filter(isTest);
// CODE ONLY, NEVER COMMENTS — see match.ts for the incident: a docblock naming four ratified queries
// as things that DO NOT exist was read as production evidence that they DO, flipping all four from
// ABSENT to DECLARED. Writing the documentation would have manufactured the implementation.
const cache = new Map<string, string>();
const text = (p: string): string => {
	if (!cache.has(p)) cache.set(p, stripComments(readFileSync(p, 'utf8')));
	return cache.get(p)!;
};
// IDENTIFIER-BOUNDARY, never substring — see match.ts for the `getPwu` ⊂ `getPwuTemplate` incident
// this signature exists to prevent, and for the derived blast radius (1 verdict of 118).
const foundIn = (needle: string, files: readonly string[]): string | null => {
	for (const file of files)
		if (hasIdentifierOccurrence(text(file), needle))
			return file.slice(ROOT.length + 1).replaceAll('\\', '/');
	return null;
};

/**
 * The consumer-walk with its positive control INSIDE the instrument: before any ABSENT is
 * emitted, a name known to exist must be findable by the identical search, or the instrument
 * refuses — a search that cannot find the control has no standing to call anything absent.
 */
const CONTROL_NAME = 'IntentCaptured';
const controlFires = foundIn(CONTROL_NAME, production) !== null;

function consumerWalk(itemId: string, name: string, searchLabel: string): void {
	const prod = foundIn(name, production);
	const test = foundIn(name, tests);
	if (prod !== null && test !== null)
		emitVerdict(
			itemId,
			'TESTED',
			`'${name}' in production (${prod}) and tests (${test})`,
			'consumer-walk:w3'
		);
	else if (prod !== null)
		emitVerdict(
			itemId,
			'DECLARED',
			`'${name}' in production (${prod}); no test names it`,
			'consumer-walk:w3'
		);
	else if (test !== null)
		// Test-only is NOT TESTED — nothing in production carries the name the test exercises.
		emitAttr(itemId, 'consumer_walk', `test-only: '${name}' appears only in ${test}`);
	else if (controlFires)
		emitVerdict(
			itemId,
			'ABSENT',
			`'${name}' not found in ${production.length} production or ${tests.length} test sources under packages/+apps/ (${searchLabel}, identifier-boundary match); positive control '${CONTROL_NAME}' fires`,
			'consumer-walk:w3'
		);
	else
		emitAttr(
			itemId,
			'consumer_walk',
			`SEARCH INVALID: control '${CONTROL_NAME}' not found — no absence claims emitted`
		);
}

/** ── 1. Enforcement register → per-rule verdicts ──────────────────────────────────────────── */
const register = readFileSync(
	join(ROOT, 'packages/rph-domain/src/enforcement-register.ts'),
	'utf8'
);
const dispositions = new Map<string, string>();
// The kind line may sit under COMMENT lines inside the entry (two rows do exactly that — found
// when the first run caught 110 of the file's 112 entries; a count that disagrees with the
// independent reader in the gate is how this class of miss stays impossible).
for (const m of register.matchAll(
	/'(RPH-[A-Z]+-\d{3})': \{[ \t\r]*\n(?:[ \t]*\/\/[^\n]*\r?\n)*[ \t]*kind: '(ENFORCED|UNENFORCED_DISCLOSED|NOT_A_COMMAND_REFUSAL)'/g
))
	dispositions.set(m[1]!, m[2]!);
for (const [rule, kind] of [...dispositions].sort(
	(a, b) => Number(a[0] > b[0]) - Number(a[0] < b[0])
)) {
	const id = `cap:rule:${rule}`;
	if (kind === 'ENFORCED')
		emitVerdict(
			id,
			'ENFORCED',
			`enforcement-register: a named production site refuses, observed through Engine.dispatch`,
			'enforcement-register:w3'
		);
	else if (kind === 'UNENFORCED_DISCLOSED')
		emitVerdict(
			id,
			'DIVERGENT_FILED',
			`enforcement-register: UNENFORCED_DISCLOSED — nothing in production enforces it, and the gated register says so`,
			'enforcement-register:w3'
		);
	else emitAttr(id, 'enforcement_class', 'NOT_A_COMMAND_REFUSAL');
}

/** ── 2. Commands → TESTED via the dispatch census ─────────────────────────────────────────── */
const messages = readFileSync(join(ROOT, 'packages/rph-contracts/src/messages.ts'), 'utf8');
const commandsBlock =
	/^export const COMMANDS = \{$([\s\S]*?)^\} as const;/m.exec(messages)?.[1] ?? '';
for (const m of commandsBlock.matchAll(/^\t([A-Z][A-Za-z0-9]+): \{$/gm))
	emitVerdict(
		`cap:command:${m[1]!}`,
		'TESTED',
		`verif/command-dispatch-census.test.ts asserts every COMMANDS key is named by a driving test`,
		'dispatch-census:w3'
	);

/** ── 3. Census doc-side populations → consumer walks ──────────────────────────────────────── */
const census = loadRecords(join(ROOT, 'docs', 'tracking', 'census'));
for (const item of census.items) {
	if (item.id.startsWith('cap:query:')) consumerWalk(item.id, item.name, 'query name');
	else if (item.id.startsWith('cap:event:')) consumerWalk(item.id, item.name, 'event name');
	else if (item.id.startsWith('cap:surface:')) {
		// Surface names are prose ("PWA Designer"); the walk searches the display string.
		consumerWalk(item.id, item.name.replace(/^.*?— /, ''), 'surface display name');
	}
}

const byKey = (a: Emitted, b: Emitted): number =>
	Number(a.sortKey > b.sortKey) - Number(a.sortKey < b.sortKey);
const sorted = [...out];
sorted.sort(byKey);
const lines = sorted.map((e) => e.line);
if (process.argv.includes('--write')) {
	const path = join(ROOT, 'docs', 'tracking', 'census', 'w3-verdicts.ndjson');
	const { writeFileSync } = await import('node:fs');
	writeFileSync(path, lines.join('\n') + '\n');
	console.log(JSON.stringify({ ok: true, mode: 'write', path, records: lines.length }));
} else {
	console.log(lines.join('\n'));
	console.error(JSON.stringify({ ok: true, mode: 'preview', records: lines.length }));
}
