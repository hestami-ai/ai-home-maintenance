// THE NUMBER CENSUS — every number a contract admits must be one the engine can HASH (REG-F-018).
//
// WHAT IT ASSERTS: no schema in the generated contracts admits a non-integer number. The list of exceptions is
// EMPTY, and it is a real list rather than a rhetorical one — an exception can be added, with a reason, and the
// gate will say so.
//
// ── WHY IT EXISTS, AND WHY A TEST RATHER THAN A CONVENTION ───────────────────────────────────────────────────
// `contentHash` canonicalizes every persisted object state and admits only FINITE INTEGERS — "the domain models
// quantities as integers or strings; a float in hashed content is a modeling smell and is rejected loudly". The
// generators emitted bare `z.number()` for all 24 number-typed vocab fields, so the contracts promised to accept
// values the store cannot write. That is not a tidiness point: `recordArtifact` copies `byteSize` straight into
// state, so `RecordArtifact` with `byteSize: 1.5` passed validation, reached `contentHash(nextState)` in `kit.ts`,
// and threw a `CanonicalJsonError` OUT of `Engine.dispatch` — a throw where the contract promises a typed
// `CommandResult`.
//
// AND THE CONSTRAINT ALREADY EXISTED, UNUSED, which is the shape this programme keeps finding: `common.ts` defines
// `NonNegativeIntSchema` and re-exports it as `SemanticVersionSchema` / `RevisionSchema` / `SchemaVersionSchema`.
// `envelopes.ts` uses it. The generated surface — including fields literally named `approvedSemanticVersion` and
// `policySemanticVersion` — did not.
//
// THE FIX IS IN THE GENERATOR, so it cannot be forgotten per-field; this gate is what keeps that true. A new
// number-typed vocab field, or an edit that reverts the mapping, reddens here. Without it, the correction lives
// only in two `if` branches and a comment, and nothing notices when a third branch is added.
//
// WHAT THIS CANNOT SEE, stated so the gate is not read as more than it is: it reads the EMITTED source, so it
// covers exactly what the generators write. A hand-authored schema elsewhere in `rph-contracts` (`common.ts`,
// `envelopes.ts`) is out of scope — those are the files that were already correct.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The generated contract surface. Both files are written by `bun run gen`; neither is hand-edited. */
const GENERATED = ['packages/rph-contracts/src/messages.ts', 'packages/rph-contracts/src/objects.ts'];

/**
 * Fields permitted to admit a non-integer number, each with the reason it is genuinely fractional.
 *
 * EMPTY, and that is the finding rather than an accident: every number-typed field in the vocabulary is a
 * version, revision, schema version, count, attempt number or byte size. The two generic slots
 * (`ApplicabilityExpression.value` / `.values`) are constrained too — that removes no capability, because a
 * fractional threshold there could never have been PERSISTED, only crashed on. If the domain ever needs one, the
 * canonicalization contract's own sentence says how: a string, or a scaled integer.
 */
const FRACTIONAL_BY_DESIGN: Readonly<Record<string, string>> = {};

/** `z.number()` NOT immediately followed by `.int()`, with the line it sits on. */
function unconstrainedNumbers(source: string): { line: number; text: string }[] {
	const hits: { line: number; text: string }[] = [];
	source.split('\n').forEach((text, i) => {
		// Scan every occurrence on the line — one line can carry several (`z.record(z.string(), z.number())`,
		// and the inline object-version array carries a nested one).
		for (const m of text.matchAll(/z\.number\(\)/g)) {
			const after = text.slice(m.index + m[0].length);
			if (!after.startsWith('.int()')) hits.push({ line: i + 1, text: text.trim() });
		}
	});
	return hits;
}

describe('REG-F-018: the generated contracts admit only numbers the engine can hash', () => {
	it.each(GENERATED)('%s declares no unconstrained number', (file) => {
		const source = readFileSync(`${REPO_ROOT}${file}`, 'utf8');
		const hits = unconstrainedNumbers(source).filter(
			(h) => FRACTIONAL_BY_DESIGN[`${file}:${h.line}`] === undefined
		);
		expect(
			hits,
			`Unconstrained z.number() in a GENERATED file. Fix the mapping in ` +
				`packages/rph-contracts/src/gen/{gen-messages,gen-objects}.ts and re-run \`bun run gen\` — not the ` +
				`emitted file, which the next generation overwrites. If a field is genuinely fractional, add it to ` +
				`FRACTIONAL_BY_DESIGN with its reason AND check what hashes it.\n` +
				hits.map((h) => `  ${file}:${h.line}  ${h.text}`).join('\n')
		).toEqual([]);
	});

	// CONTROL, and it needs to be here or the assertion above is satisfied by a detector that finds nothing. The
	// detector must see a bare number when there IS one, and must NOT flag a constrained one.
	it('CONTROL: the detector finds a bare number and passes a constrained one', () => {
		expect(unconstrainedNumbers('const a = z.number();')).toHaveLength(1);
		expect(unconstrainedNumbers('const a = z.number().int();')).toEqual([]);
		expect(
			unconstrainedNumbers('z.record(z.string(), z.number()), z.number().int()'),
			'and it scans EVERY occurrence on a line, not just the first'
		).toHaveLength(1);
	});

	// The count is derived from the files, not restated, so this cannot go stale the way a written number does.
	it('every emitted number IS constrained — the population is non-empty', () => {
		const constrained = GENERATED.map(
			(f) => (readFileSync(`${REPO_ROOT}${f}`, 'utf8').match(/z\.number\(\)\.int\(\)/g) ?? []).length
		);
		expect(
			constrained.every((n) => n > 0),
			`both generated files must actually contain constrained numbers, else the gate above passes ` +
				`vacuously (found ${constrained.join(', ')})`
		).toBe(true);
	});
});
