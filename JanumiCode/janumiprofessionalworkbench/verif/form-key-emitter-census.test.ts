// THE FORM-KEY CENSUS — every key a server action reads is a key some control can post.
//
// ⛔⛔ THE DEFECT THIS EXISTS FOR, MEASURED RATHER THAN IMAGINED. `policy-fields.ts` read
// `form.get('applicableObjectTypes')` and NO control anywhere emitted it — `name="applicableObjectTypes"` has
// never appeared in any `.svelte` file in this repository's history. The reader was written on 2026-07-15
// (`691aa014`) for a control that was never built, and `+page.server.ts` still projected the stored value into
// the form model under a comment describing *"a comma-separated text input"* that did not exist.
//
// ⚠ A MISSING CONTROL DOES NOT FAIL. IT SILENTLY WRITES THE READER'S DEFAULT. That is the whole reason this is
// a gate and not a point fix, and whether the default is harmless turns on something no reviewer thinks about:
// `csvList(null)` returned `[]`, `[]` is TRUTHY, so `f.x || DEFAULT` was dead and `f.x ? {…} : {}` always fired.
// Driven against the engine before the fix, a RENAME moved a policy from `NOT_APPLICABLE` to `REQUIRED` for an
// object type it never claimed — `governance.ts` guards its `NOT_APPLICABLE` limb on `objectTypes.length > 0`,
// so an empty condition set does not narrow, it WIDENS. Both commands were ACCEPTED.
//
// ⭑ AND THE TWO SURVIVORS LAND ON OPPOSITE SIDES OF THAT LINE, which is why the declaration below demands a
// reason rather than a name: `version` defaults to `''`, which is FALSY, so its `||` rescues it and the only
// cost is a feature nobody can reach; `applicableObjectTypes` defaulted to `[]`, which is not.
//
// ── ⚠ WHAT THIS GATE CANNOT SEE, STATED FIRST BECAUSE IT IS WHERE A CENSUS GOES WRONG ────────────────────────
// A key read through a computed expression is invisible to a static reader — and the derivation that first found
// these two was blind to FIVE such idioms in this application, and was right anyway ONLY BECAUSE each blind spot
// paired a missed reader with a missed emitter. That is cancellation, not method, and a census that is correct
// by luck is the instrument failing exactly like its subject.
//
// So every unanalysable read is DECLARED below with its reason, in the recorded-fail-open shape `SPEC-001-NF-32`
// requires of an ungated offer — *"offered AND marked ungated, naming the unevaluated limbs, and never offered
// unmarked"*. A new one fails this gate and has to be looked at. It is NOT silently skipped, because a silent
// skip is the defect one level up.
//
// ⛔ IT ALSO CANNOT SEE whether an emitted control is REACHABLE — a control behind a condition no professional
// can satisfy posts nothing, and this gate counts it as emitted. That limb belongs to the e2e suite.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = 'apps/rph-demo/src';
const SKIP = new Set(['node_modules', 'dist', '.svelte-kit', 'e2e-results', 'build']);

function sources(ext: string, exclude?: (name: string) => boolean): { path: string; text: string }[] {
	const out: { path: string; text: string }[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name.endsWith(ext) && !exclude?.(entry.name))
				out.push({ path: p.replaceAll('\\', '/'), text: readFileSync(p, 'utf8') });
		}
	};
	walk(APP);
	return out;
}

/** A variable that holds a `FormData`: awaited from `.formData()`, or declared as one in a signature. */
const RECEIVER = /(?:const|let|var)\s+(\w+)\s*=\s*await\s+\w+\.formData\(\)|(\w+)\s*:\s*FormData/g;

/** `x.get(…)` / `.getAll(…)` / `.has(…)` — whitespace-collapsed first, so a reader split across lines is seen. */
const ACCESS = /\b(\w+)\s*\.\s*(?:get|getAll|has)\s*\(\s*([^)]*?)\s*\)/g;

const STRING_LITERAL = /^'([^']*)'$|^"([^"]*)"$/;

export interface FormKeyReads {
	/** Keys named by a string literal — the analysable population. */
	readonly literal: Map<string, string[]>;
	/** Reads whose key is computed, as `path :: expression`. Each must be DECLARED. */
	readonly unanalysable: string[];
}

/**
 * The form keys a module reads.
 *
 * ⚠ IT SCOPES `ACCESS` TO KNOWN `FormData` RECEIVERS RATHER THAN MATCHING EVERY `.get(`, because a `Map.get`
 * and a `FormData.get` are the same three characters and a census that conflates them measures nothing. The
 * cost is that a `FormData` reached some other way is invisible — which is why the unanalysable list is
 * asserted rather than merely collected.
 */
export function formKeyReads(files: readonly { path: string; text: string }[]): FormKeyReads {
	const literal = new Map<string, string[]>();
	const unanalysable: string[] = [];
	for (const { path, text } of files) {
		const receivers = new Set<string>();
		for (const m of text.matchAll(RECEIVER)) receivers.add((m[1] ?? m[2])!);
		if (receivers.size === 0) continue;
		for (const m of text.replace(/\s+/g, ' ').matchAll(ACCESS)) {
			if (!receivers.has(m[1]!)) continue;
			const arg = m[2]!.trim();
			const lit = STRING_LITERAL.exec(arg);
			if (lit) {
				const key = lit[1] ?? lit[2]!;
				literal.set(key, [...(literal.get(key) ?? []), path]);
			} else unanalysable.push(`${path} :: ${arg}`);
		}
	}
	return { literal, unanalysable };
}

/** Every `name="…"` a template posts, plus the computed ones it cannot resolve. */
export function emittedNames(files: readonly { path: string; text: string }[]): {
	literal: Set<string>;
	dynamic: string[];
} {
	const literal = new Set<string>();
	const dynamic: string[] = [];
	for (const { path, text } of files) {
		for (const m of text.matchAll(/name="([^"]+)"/g)) literal.add(m[1]!);
		for (const m of text.matchAll(/name=\{([^}]*)\}/g)) dynamic.push(`${path} :: ${m[1]!.trim()}`);
	}
	return { literal, dynamic };
}

/**
 * ⛔ A READER WITH NO CONTROL, DECLARED — with what makes its absence safe, not merely that it is known.
 *
 * A bare allowlist would let the next one in by name. Each entry states the DEFAULT the reader falls to and the
 * test that holds it there, because "we know about it" is not a property of the code and cannot redden.
 */
const READERS_WITH_NO_CONTROL: Readonly<Record<string, string>> = {
	applicableObjectTypes:
		'No control has ever existed for it (EG-04). The read is KEPT rather than deleted, because deleting it ' +
		'would silently discard the value on the day a control is added — the same class of defect one step ' +
		'later. Its absence is now SAFE and asserted: `csvList` returns `undefined` for a key the form did not ' +
		'carry, `policyEditPatch` omits the field, and `reconcileApplicability` takes its "scope untouched by ' +
		'this edit" limb. Held by policy-round-trip.test.ts, which asserts the applicability OUTCOME, not the field.',
	version:
		'The `?/newPolicyVersion` form posts only `policyId` and `expectedRevision`, so an author-chosen version ' +
		'is unreachable. SAFE for a different reason, and the difference is the point: the default is `\'\'`, ' +
		'which is FALSY, so `requested || bumpVersion(prev)` rescues it and the successor is auto-bumped. ' +
		'An unreachable feature, not a wrong write. Disclosure is EG-05.'
};

/**
 * ⛔ READS THIS GATE CANNOT ANALYSE, DECLARED — the recorded fail-open.
 *
 * Each is a key computed at runtime. They are listed with the emitter they pair with, so the pairing is a claim
 * a reader can check rather than an assumption the gate makes silently.
 */
const UNANALYSABLE_READS: Readonly<Record<string, string>> = {
	'apps/rph-demo/src/lib/server/optimistic-concurrency.ts :: EXPECTED_REVISION_FIELD':
		'A module const holding the PER-4 revision field name; emitted as a literal hidden input by every form ' +
		'that declares a rendered revision.',
	'apps/rph-demo/src/routes/pwa/[id]/+page.server.ts :: `cardinality:${typeId}`':
		'Per-child cardinality, one key per permitted child type. Emitted dynamically at the matching ' +
		'`name={`cardinality:${t.id}`}` in that route.',
	'apps/rph-demo/src/routes/pwa/[id]/+page.server.ts :: `applicability:${typeId}`':
		'Per-child applicability note, paired with `name={`applicability:${t.id}`}` in that route.',
	'apps/rph-demo/src/routes/undertakings/+page.server.ts :: field':
		'`parseRiskProfile` reads through a CALLBACK, keying on `riskFieldName(field)`; the emitter is the ' +
		'matching `name={riskFieldName(d.field)}`.',
	'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts :: field':
		'The same risk-profile callback on the workbench surface, paired with the same dynamic emitter. Listed '+
		'separately rather than folded into the row above, because two routes reading through one helper is two '+
		'places a control can go missing.',
	'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts :: k':
		'A local `(f: FormData, k: string)` reader; its keys are literals at the CALL sites, which this gate ' +
		'does not follow.'
};

const TS = sources('.ts', (n) => n.endsWith('.test.ts'));
const SVELTE = sources('.svelte');
const READS = formKeyReads(TS);
const EMITTED = emittedNames(SVELTE);

describe('EG-04 — every form key a server action reads is one a control can post', () => {
	it('⭑ CONTROL — the derivation found a real population on both sides', () => {
		// ⛔ WITHOUT THIS THE GATE IS VACUOUS the moment a rename empties either side: "for each of nothing,
		// assert anything" is green, and this repository has already had a census instrument report a clean tree
		// while reading the wrong file. The thresholds are floors, not counts, so ordinary growth does not churn.
		expect(READS.literal.size, 'literal form-key reads').toBeGreaterThan(30);
		expect(EMITTED.literal.size, 'literal name= emitters').toBeGreaterThan(30);
		expect(TS.length).toBeGreaterThan(50);
	});

	it('⭑⭑ CONTROL — the derivation SEES the dynamic emitters it declares, rather than being blind to them', () => {
		// ⚠ THE FAILURE THIS GUARDS IS THE ONE THAT ACTUALLY HAPPENED. The first derivation of this census was
		// blind to computed keys on BOTH sides, and was right only because each blind spot paired a missed reader
		// with a missed emitter. If `name={…}` stopped being detected, the pairing claims below would become
		// unfalsifiable while the gate stayed green.
		expect(EMITTED.dynamic.length, 'computed name= emitters').toBeGreaterThan(0);
		expect(EMITTED.dynamic.join('\n')).toMatch(/riskFieldName/);
		expect(EMITTED.dynamic.join('\n')).toMatch(/cardinality:/);
	});

	it('⛔ a key read by a server action but posted by no control must be DECLARED, with a reason', () => {
		// THE MUTANT: add `form.get('newThing')` to any route action and write no control for it. That is
		// precisely what happened on 2026-07-15 and stood for eight weeks.
		//
		// ⚠ IT IS `toEqual`, NOT A FILTER. `derived.filter(k => !KNOWN.has(k))` would let a new one in the moment
		// it was added to the record; equality makes the record the TARGET, so the population cannot grow without
		// a human editing this file — the same discipline as the route-action census.
		const missing = [...READS.literal.keys()].filter((k) => !EMITTED.literal.has(k)).sort();
		expect(
			missing,
			`these form keys are read but no control posts them. A missing control does not fail — it silently ` +
				`writes the reader's default, and whether that is harmless depends on whether the default is falsy. ` +
				`Add the control, or declare it in READERS_WITH_NO_CONTROL with what makes its absence SAFE.`
		).toEqual(Object.keys(READERS_WITH_NO_CONTROL).sort());
	});

	it('⛔ every read this gate cannot analyse is declared with the emitter it pairs with', () => {
		// THE MUTANT: introduce a sixth computed-key idiom. Silently skipping it is how a census becomes correct
		// by cancellation, so an undeclared one is a finding rather than a gap.
		expect(
			READS.unanalysable.sort(),
			'a computed form key this census cannot follow. Declare it in UNANALYSABLE_READS naming the emitter ' +
				'it pairs with, or make the key a literal.'
		).toEqual(Object.keys(UNANALYSABLE_READS).sort());
	});

	it('⭑ CONTROL — a declaration must say WHY, so the record cannot decay into a bare allowlist', () => {
		// ⛔ Without this, "declared" degrades to "named", and the next reader with no control is admitted by
		// someone adding a word to a list. Every entry must carry a reason a reader can disagree with.
		for (const [k, why] of Object.entries({ ...READERS_WITH_NO_CONTROL, ...UNANALYSABLE_READS }))
			expect(why.length, `${k} needs a stated reason, not a name`).toBeGreaterThan(60);
	});
});

describe('EG-04 — the extractor is exercised against sources whose answer is known', () => {
	// ⚠ A SILENT UNDERCOUNT IN A CENSUS IS WORSE THAN NO CENSUS, and this extractor's own history is the reason:
	// its first form missed five idioms at once. Each case below is a shape that occurs in the real tree.
	const from = (text: string) => formKeyReads([{ path: 'x.ts', text }]);

	it('finds a literal read through an awaited formData()', () => {
		expect([...from("const form = await request.formData(); form.get('alpha');").literal.keys()]).toEqual([
			'alpha'
		]);
	});

	it('finds a literal read through a FormData PARAMETER, not just a local', () => {
		expect([...from("function r(f: FormData) { return f.get('beta'); }").literal.keys()]).toEqual(['beta']);
	});

	it('⭑ finds a read SPLIT ACROSS LINES — the shape that occurs in the decisions route', () => {
		// `const ids = form\n\t.getAll('subjectObjectIds')`. A line-anchored regex misses it entirely.
		expect(
			[...from("const form = await request.formData();\nconst ids = form\n\t.getAll('gamma');").literal.keys()]
		).toEqual(['gamma']);
	});

	it('⭑ REPORTS a computed key rather than dropping it', () => {
		const out = from('function r(f: FormData, k: string) { return f.get(k); }');
		expect([...out.literal.keys()]).toEqual([]);
		expect(out.unanalysable).toEqual(['x.ts :: k']);
	});

	it('⭑ REPORTS a template-literal key rather than dropping it', () => {
		const out = from('function r(f: FormData, id: string) { return f.get(`cardinality:${id}`); }');
		expect(out.unanalysable).toHaveLength(1);
		expect(out.unanalysable[0]).toMatch(/cardinality/);
	});

	it('⛔ does NOT count a Map lookup as a form read — the conflation that would measure nothing', () => {
		const out = from("const form = await request.formData(); const m = new Map(); m.get('delta');");
		expect([...out.literal.keys()]).toEqual([]);
		expect(out.unanalysable).toEqual([]);
	});

	it('⭑ CONTROL — a module with no FormData at all contributes nothing', () => {
		expect(from("const m = new Map(); m.get('epsilon');").literal.size).toBe(0);
	});
});
