// S-4 of ROADMAP-decision-subject-scope — THE CENSUS THAT WOULD HAVE CAUGHT REG-F-102.
//
// ── WHAT WENT WRONG, AND WHY NO EXISTING CONTROL SAW IT ───────────────────────────────────────────────────────
// `authorityBasis` loaded ANY object by id and accepted it as a governance authority on `state.status ===
// 'EFFECTIVE'` alone — no `objectType`, no parse. An ARTIFACT recorded with a caller-supplied
// `status: 'EFFECTIVE'` (the only object schema whose status is a free-text `z.string()`) therefore authorized
// dropping a MANDATORY constraint. Driven before the repair: ACCEPTED.
//
// ⚠ IT WAS INVISIBLE TO EVERY CENSUS WE HAD, BY CONSTRUCTION. A gate census rooted at `subjectObjectIds` cannot
// find a gate whose defect IS the absence of that field, and the register's own scope-oriented searches key on
// the presence of a scope conjunct. **The weakest gate is invisible to a search shaped like the strong ones.**
// So this control roots at what ESTABLISHES authority instead: the pairing of a store lookup with an
// effectiveness test.
//
// ── THE RULE ──────────────────────────────────────────────────────────────────────────────────────────────────
// A site that loads an object by id and then treats `status === 'EFFECTIVE'` as authority MUST also establish
// WHAT IT LOADED — an `objectType` check or a schema parse — in the same neighbourhood. Establishing the type by
// a TYPED PARAMETER (`DecisionView`) or by a TYPED QUERY (`listDecisions`) is equally fine and is why those sites
// do not appear here: they never call `loadObject`.
//
// ⚠ THE DETECTOR IS A WINDOW, NOT A PARSER, AND THAT IS DISCLOSED RATHER THAN HIDDEN. It scans the lines
// following each `loadObject(` for an effectiveness test, and requires type establishment within the same
// window. A parser over TypeScript ASTs would be exact; a window is approximate in one direction only — it can
// MISS a pairing spread further apart than the window, and it cannot invent one. Its catch is proved below
// against the real pre-fix text rather than asserted.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROOTS = ['packages', 'apps/rph-demo/src'];
const WINDOW = 14;

/**
 * ⚠ MEMOIZED — REG-F-116, the fifth verif file found carrying this. Four tests in this file call `sources()`, and
 * each call walked `packages` + `apps/rph-demo/src` and `readFileSync`'d **every** production `.ts` in them. The
 * corpus grew sharply when `packages/csaa` landed, so the same whole-tree read now happens four times over a much
 * larger tree.
 *
 * MEASURED: this file's CONTROL costs ~1059ms in isolation and **5082ms with a second vitest running — over the
 * 5000ms default, so it FAILS.** A tipped test inside a mutation CONTROL's whole-suite run becomes a verdict about
 * an unrelated mutation, which is the defect REG-F-116 exists for.
 */
let sourcesCache: { path: string; text: string }[] | undefined;
function sources(): { path: string; text: string }[] {
	sourcesCache ??= readSources();
	return sourcesCache;
}

function readSources(): { path: string; text: string }[] {
	const out: { path: string; text: string }[] = [];
	const walk = (abs: string, rel: string): void => {
		for (const entry of readdirSync(abs)) {
			if (['node_modules', 'dist', '.svelte-kit', 'build', 'vocab', 'schemas'].includes(entry)) continue;
			const childAbs = `${abs}/${entry}`;
			const childRel = rel === '' ? entry : `${rel}/${entry}`;
			if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
			else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
				out.push({ path: childRel, text: readFileSync(childAbs, 'utf8') });
		}
	};
	for (const root of ROOTS) walk(`${REPO_ROOT}${root}`, root);
	return out;
}

const EFFECTIVENESS = /['"]EFFECTIVE['"]/;
const ESTABLISHES_TYPE = /objectType|Schema\.safeParse|aggregateType/;

/** Sites where a store lookup is paired with an effectiveness test but nothing establishes what was loaded. */
export function unestablishedAuthoritySites(files: { path: string; text: string }[]): string[] {
	const offenders: string[] = [];
	for (const { path, text } of files) {
		const lines = text.split('\n');
		lines.forEach((line, i) => {
			if (!line.includes('loadObject(')) return;
			const window = lines.slice(i, i + WINDOW);
			// Comments are prose ABOUT the code — a header explaining REG-F-102 must not read as a violation of
			// it, and equally must not be able to satisfy the type requirement.
			const code = window.filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
			if (!EFFECTIVENESS.test(code)) return;
			if (ESTABLISHES_TYPE.test(code)) return;
			offenders.push(`${path}:${i + 1}`);
		});
	}
	return offenders;
}

describe('authority resolution census (S-4) — an EFFECTIVE status is not an authority until the object is known', () => {
	it('no site treats a loaded object as authority without establishing what it is', () => {
		expect(
			unestablishedAuthoritySites(sources()),
			'A store lookup paired with an EFFECTIVE test, and nothing establishing the object type. This is ' +
				'REG-F-102: ARTIFACT is the only object schema with a free-text `status`, so an EFFECTIVE string is ' +
				'mintable in one command. Establish the type (objectType check or schema parse) as the §5.2 ' +
				'resolvers do — `resolveAbandonAuthorization` calls naming an Artifact "a category error, not a ' +
				'scope failure".'
		).toEqual([]);
	});

	// CONTROL 1 — THE DETECTOR CATCHES THE REAL DEFECT. Verbatim pre-fix `authorityBasis`, kept as a fixture so
	// this control cannot rot when the live code moves. Without it, an empty offender list above would be equally
	// consistent with a detector that never matches anything.
	it('CONTROL — the detector catches REG-F-102 exactly as it shipped', () => {
		const preFix = [
			'	const authorityBasis = (id: string | undefined): string | undefined => {',
			'		if (!id) return undefined;',
			'		const decision = ctx.store.loadObject(id)?.state as',
			'			| { status?: string; decisionType?: string }',
			'			| undefined;',
			"		return decision?.status === 'EFFECTIVE' ? id : undefined;",
			'	};'
		].join('\n');
		expect(
			unestablishedAuthoritySites([{ path: 'fixture/pre-fix-authorityBasis.ts', text: preFix }])
		).toEqual(['fixture/pre-fix-authorityBasis.ts:3']);
	});

	// CONTROL 2 — IT DOES NOT FLAG THE REPAIR. A detector that flagged the fixed shape too would be noise, and
	// the offender list above would be empty only because someone silenced it.
	it('CONTROL — the detector does NOT flag the repaired shape', () => {
		const fixed = [
			'	const authorityBasis = (id: string | undefined): string | undefined => {',
			'		if (!id) return undefined;',
			'		const stored = ctx.store.loadObject(id);',
			"		if (stored?.objectType !== 'DECISION') return undefined;",
			'		const parsed = DecisionObjectSchema.safeParse(stored.state);',
			"		return parsed.success && parsed.data.status === 'EFFECTIVE' ? id : undefined;",
			'	};'
		].join('\n');
		expect(unestablishedAuthoritySites([{ path: 'fixture/fixed.ts', text: fixed }])).toEqual([]);
	});

	// CONTROL 3 — THE WALK READS A REAL POPULATION. Without it, a broken `sources()` returning nothing would make
	// the census pass while measuring the empty set — the vacuity this repository has recorded five times.
	it('CONTROL — the walk reaches the files it claims to scan', () => {
		const files = sources();
		// 157 measured 2026-08-10. The floor is set well below it rather than at it: this control exists to catch
		// a WALK THAT BROKE (an excluded directory swallowing the tree, a rename), not to police file count.
		expect(files.length, 'production TypeScript sources scanned').toBeGreaterThan(120);
		expect(
			files.some((f) => f.path.endsWith('handlers/decomposition.ts')),
			'the file REG-F-102 was found in must be inside the scanned set'
		).toBe(true);
		expect(
			files.filter((f) => f.text.includes('loadObject(')).length,
			'sites using the store lookup this census is about'
		).toBeGreaterThan(5);
	});
});
