// EVERY REGISTER ID CITED BY THE CODE RESOLVES TO AN ENTRY THAT EXISTS.
//
// ── WHAT WAS MISSING ─────────────────────────────────────────────────────────────────────────────────────────
// The register is this repository's audit record, and the code cites it constantly — a mutant's `source` field, a
// handler's docblock, a census's rationale. **Nothing checked that a cited id was ever written.** Three were not:
// `REG-F-128` (cited by the arrow census, its coverage test, and a mutant ledger entry), `REG-F-130` (cited by
// two handlers and the conformance ledger), and `REG-F-139`.
//
// ⚠ AND THE THIRD WAS CREATED BY THE SAME AUTHOR ON THE DAY THIS GATE WAS WRITTEN. A commit titled
// "REG-F-139: I escalated a canon correction that was not owed" struck the offending text inside REG-F-138 and
// added a bullet — and never appended the entry its own title names. **A commit message is not a record.** The
// register is the record, and a citation pointing at nothing is a footnote to a page that was never printed.
//
// ── WHY THIS IS NOT THE SAME AS THE STALE-PROSE CLASS ───────────────────────────────────────────────────────
// A stale number says something false. A dangling citation says nothing at all: the reader follows it, finds
// no entry, and cannot tell whether the finding was withdrawn, renumbered, or simply never written. It is the
// difference between a wrong answer and a broken link, and only the first has ever reddened anything here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Every canon document — the register is not the only one that DEFINES ids (`REG-E-*` live in the Ratify Sheet). */
function canonText(): string {
	const dir = `${ROOT}docs/canon`;
	return readdirSync(dir)
		.filter((f) => f.endsWith('.md'))
		.map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
		.join('\n');
}

/** Ids that a canon document DEFINES with a heading, struck or not. */
function definedIds(): Set<string> {
	const out = new Set<string>();
	for (const m of canonText().matchAll(/^### (?:~~)?(REG-[A-Z]-\d+)/gm)) out.add(m[1]!);
	return out;
}

/**
 * Ids the CODE cites, mapped to the files citing them.
 *
 * ⚠ `packages/csaa` is excluded for the same reason the mutation gate excludes it: it is another programme's
 * package, outside this one's remit by standing instruction. That is a scope decision, not a soundness one.
 */
function citedIds(): Map<string, string[]> {
	const walk = (dir: string, out: string[] = []): string[] => {
		for (const e of readdirSync(dir)) {
			if (e === 'node_modules' || e === '.git' || e === 'dist' || e === '.svelte-kit' || e === 'csaa') continue;
			// This file NAMES the dangling ids in its own docblock and fabricates one in its CONTROL. A gate that
			// scanned itself would report its own examples as findings.
			if (e === 'register-citations.test.ts') continue;
			const p = `${dir}/${e}`;
			if (statSync(p).isDirectory()) walk(p, out);
			else if (/\.(ts|svelte)$/.test(e)) out.push(p);
		}
		return out;
	};
	const files = ['packages', 'verif', 'scripts', 'apps'].flatMap((d) => walk(`${ROOT}${d}`));
	const out = new Map<string, string[]>();
	for (const f of files) {
		// ⚠ SCOPED TO THE SERIES THE CANON DEFINES WITH HEADINGS — `REG-D`, `REG-F`, `REG-Q`. `REG-E` is
		// DELIBERATELY OUT OF SCOPE and the reason is a shape, not an oversight: the Ratify Sheet carries them as
		// "Part 3 — Elicitation questions (REG-E-001..022)", a numbered LIST, so a heading resolver cannot see
		// them and would report every one as dangling. The first draft of this gate did exactly that — eight
		// false positives — which is the same "check the population before accusing" failure this file's own
		// neighbours have recorded four times.
		for (const m of readFileSync(f, 'utf8').matchAll(/\b(REG-[DFQ]-\d+)\b/g)) {
			const rel = f.slice(ROOT.length);
			if (!out.has(m[1]!)) out.set(m[1]!, []);
			if (!out.get(m[1]!)!.includes(rel)) out.get(m[1]!)!.push(rel);
		}
	}
	return out;
}

/**
 * Ids that appear in code but are NOT citations of a real entry.
 *
 * `register-status.test.ts` builds synthetic register text in its own controls; those ids are fixtures, not
 * references. Pinned BY NAME so a real dangling id can never be waved through as "probably a fixture".
 */
const SYNTHETIC = new Set(['REG-F-998', 'REG-F-999']);

describe('register citations resolve', () => {
	it('every REG id cited by the code names an entry that exists', () => {
		const defined = definedIds();
		const dangling = [...citedIds()]
			.filter(([id]) => !SYNTHETIC.has(id) && !defined.has(id))
			.map(([id, files]) => `${id} — cited by ${files.slice(0, 3).join(', ')}`)
			.sort((a, b) => a.localeCompare(b));
		expect(
			dangling,
			`these ids are cited by code and defined by NO canon document:\n${dangling.join('\n')}\n` +
				'Either the entry was never written (write it), or the id is wrong (fix the citation). A commit ' +
				'message naming an entry does not create one.'
		).toEqual([]);
	});

	// CONTROL — `[]` is also what a reader that finds no citations returns, and what one that treats every id as
	// defined returns. This pins that both halves see real data, and that a fabricated id IS caught.
	it('CONTROL — the reader finds real citations, real definitions, and catches a fabricated id', () => {
		const defined = definedIds();
		const cited = citedIds();
		expect(defined.size, 'the canon must define many entries, or the resolver is blind').toBeGreaterThan(150);
		expect(cited.size, 'the code must cite many entries, or the scanner is blind').toBeGreaterThan(150);
		// A definition that exists, and one that cannot.
		expect(defined.has('REG-F-133'), 'a known entry must resolve').toBe(true);
		expect(defined.has('REG-F-000'), 'an id nobody wrote must NOT resolve').toBe(false);
		// And the synthetic exemption must be exactly the fixtures, never a real gap.
		for (const id of SYNTHETIC)
			expect(defined.has(id), `${id} is exempted as a fixture but a canon document defines it`).toBe(false);
	});
});
