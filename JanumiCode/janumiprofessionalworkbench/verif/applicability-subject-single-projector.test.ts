// JAN-APPLSUBJ AS-02 — the applicability subject is built in ONE place.
//
// ⭑⭑ THE DEFECT WAS THE DUPLICATION, NOT THE FIELD. `riskProfile` was dropped at BOTH production call sites,
// independently — `handlers/assurance.ts` and `governing-policies.ts` each hand-built `{objectType, pwuKind?,
// tags?}` from a type that had grown past it. One dropped field is a slip; the same field dropped twice is a
// structure, and the structure is that every future addition to `ApplicabilitySubject` starts life missing at
// every caller.
//
// ⚠ WHAT THIS GATE CAN AND CANNOT SEE, stated rather than claimed away. It asserts that every production caller
// of `policyApplicability` also reaches for the shared projector. It CANNOT prove the projector's result is what
// gets passed, and it cannot see a call site nobody has written yet. It catches the shape that actually
// occurred — a caller assembling the subject itself — and that is the whole of its claim.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['packages', 'apps'];
const SKIP = new Set(['node_modules', 'dist', '.svelte-kit', 'e2e-results', 'build']);

function productionSources(): { path: string; text: string }[] {
	const out: { path: string; text: string }[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
				out.push({ path: p.replaceAll('\\', '/'), text: readFileSync(p, 'utf8') });
		}
	};
	for (const r of ROOTS) walk(r);
	return out;
}

const SOURCES = productionSources();

/** ⭑ DERIVED, never hand-listed — a fixed list of call sites is the defect one level up. */
const CALLERS = SOURCES.filter(
	(f) => /\bpolicyApplicability\s*\(/.test(f.text) && !f.path.endsWith('rph-domain/src/governance.ts')
);

describe('AS-02 — one projector builds the applicability subject', () => {
	it('⭑ CONTROL — the derivation found the callers it must be judging', () => {
		// ⛔ WITHOUT THIS THE GATE PASSES VACUOUSLY the moment a rename or a moved file empties the list: "for
		// each of nothing, assert anything" is green. Both known callers are named, so a broken derivation reads
		// as broken rather than as a clean tree.
		expect(SOURCES.length).toBeGreaterThan(100);
		const paths = CALLERS.map((c) => c.path);
		expect(paths).toContain('packages/rph-application/src/handlers/assurance.ts');
		expect(paths).toContain('packages/rph-engine/src/governing-policies.ts');
	});

	it('⛔ every production caller reaches for the shared projector', () => {
		// THE MUTANT that reddens this: revert either call site to an inline `{ objectType, pwuKind, tags }`
		// literal — which is precisely the state at the commit before this test existed, at BOTH sites.
		const handRolled = CALLERS.filter((c) => !/\bapplicabilitySubjectFrom\b/.test(c.text)).map(
			(c) => c.path
		);
		expect(
			handRolled,
			'a caller that assembles the applicability subject itself will silently omit every field the ' +
				'rule can ask about but this caller has not heard of — which is how riskProfile came to be ' +
				'dropped at two sites independently. Use applicabilitySubjectFrom.'
		).toEqual([]);
	});

	it('⭑ the projector itself lives in the kernel that owns the type', () => {
		// Placement is load-bearing: `rph-assurance` may not be imported by `rph-domain` (cycle), so the
		// projection has to sit beside `ApplicabilitySubject` for BOTH callers to reach it without a new edge.
		const kernel = SOURCES.find((f) => f.path.endsWith('rph-domain/src/governance.ts'));
		expect(kernel, 'the kernel source must be readable for this assertion to mean anything').toBeDefined();
		expect(kernel!.text).toMatch(/export function applicabilitySubjectFrom\b/);
	});
});
