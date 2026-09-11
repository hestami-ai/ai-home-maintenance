// JAN-CSAADEC `CD-02` — THE PROJECTION'S LITERAL KIND IS PINNED BEFORE ONE LINE CONSUMES IT.
//
// ⛔⛔ THIS FILE EXISTS TO STOP A CONTROL THAT CANNOT FAIL FROM BEING BUILT, AND THE MUTANT CAME FIRST.
//
// The Svelte bridge in `packages/csaa` projects `<input name="version" />` into TypeScript as
//
//     svelteHTML.createElement("input", {  "name":`version`, });
//
// A `NoSubstitutionTemplateLiteral`. NOT a `StringLiteral` — and `ts.SyntaxKind` prints that kind under its
// alias `FirstTemplateToken`, so a debug dump actively reinforces the wrong reading. A consumer written with
// `ts.isStringLiteral` therefore matches nothing at any static emitter site, finds ZERO keys, and reports a
// clean all-clear, because "no emitted key is missing a reader" is vacuously true of an empty set.
//
// `feedback_a_control_that_cannot_fail`: a control needs its OWN mutant, and three shipped green proving
// nothing. So the order here is not negotiable and is the content of the increment:
//
//   1. `M-1` is DRIVEN — `STRING_LITERAL_REFUTED_POLICY` is run over the whole application and shown to find 0.
//   2. The kind is PINNED by a fixture, so the fact is measured rather than inferred from that zero.
//   3. Only then does the working consumer's population get asserted.
//
// ── ⚠ AND THE PRECONDITION `M-1` SILENTLY DEPENDS ON, WHICH IS WHY `M-1b` IS HERE ────────────────────────────
//
// "It finds zero" is a property of a walk SCOPED TO MARKUP HOSTS, not of the projection. Measured on this tree:
// the same projected files carry NINE further `name:` PropertyAssignments outside any markup emitter — four
// `StringLiteral` (all of them `''`) and five `PropertyAccessExpression`. UNSCOPED, the refuted predicate does
// NOT return zero. `M-1b` drives that arrangement so the precondition is a measured row rather than an unstated
// assumption, and a green `M-1` cannot be recorded against a walk that was never scoped.
//
// ⚠ AND IT CORRECTS THE ROADMAP ON THE POINT THE MUTANT TURNS ON. `CD-02` predicted the unscoped census would
// "gain the four `''`/`PropertyAccessExpression` phantoms". Measured: four SITES, but they are all the same
// empty string, so the emitted-key SET gains exactly ONE member — `''` — and the five `PropertyAccessExpression`
// sites are not static at all, so they land in the DECLARED `other` list, not in the key set. Four sites, one
// key, five declarations. Recorded here because a mutant whose predicted red is stated in the wrong unit gets
// recorded as passing for the wrong reason.
//
// ⛔ WHAT THIS INCREMENT DOES NOT DO. It does not touch `verif/form-key-emitter-census.test.ts`. The incumbent
// gate keeps its regex and keeps running; the swap, its cross-validation and its fast-path tiering are `CD-03`.
// This file ships alone so it can be judged alone.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	emittedNamesFromProjection,
	markupHost,
	nameHostCensus,
	PINNED_PROVIDER_VERSIONS,
	projectSvelte,
	PROJECTION_POLICY,
	STRING_LITERAL_REFUTED_POLICY,
	svelteFiles,
	UNSCOPED_PROJECTION_POLICY,
	UNSCOPED_REFUTED_POLICY,
	type ProjectedSvelte
} from './name-projection.js';

/** The one route that carries both dynamic emitters, named once so the two tests that need it cannot drift. */
const DYNAMIC_ROUTE = 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte';

/**
 * A synthetic component covering the five initializer shapes, three of which have ZERO occurrences tree-wide.
 *
 * ⚠ A FIXTURE IS THE ONLY HONEST HOME FOR A PROSPECTIVE LIMB. `COMPONENT_PROPS`, `{name}` and `{...rest}` are
 * measured at zero in this application, so a tree-wide census cannot redden on them and coverage claimed from
 * one would be coverage claimed from nothing. They are exercised HERE and counted as prospective, which is the
 * correction this increment makes to the design's claim that the component-prop form "would have been LOST".
 */
const FIXTURE_PATH = 'apps/rph-demo/src/lib/__ProjectionKindFixture.svelte';
const FIXTURE_SOURCE = [
	'<script lang="ts">',
	"\timport X from './X.svelte';",
	"\tlet name = 'shorthand';",
	'\tlet rest: Record<string, unknown> = {};',
	"\tconst opts = { name: '' };",
	'</script>',
	'',
	'<input name="version" />',
	"<input name='singleQuoted' />",
	'<X name="componentProp" />',
	'<input {name} />',
	'<input {...rest} />',
	'<span>{opts.name}</span>'
].join('\n');

function projectFixture(): ProjectedSvelte {
	return projectSvelte(FIXTURE_PATH, new TextEncoder().encode(FIXTURE_SOURCE));
}

/** The `name` initializer of the first `svelteHTML.createElement` attribute object in a projection. */
function firstElementNameInitializer(projected: ProjectedSvelte): ts.Expression {
	let found: ts.Expression | undefined;
	const visit = (node: ts.Node): void => {
		if (found !== undefined) return;
		if (
			ts.isPropertyAssignment(node) &&
			!ts.isComputedPropertyName(node.name) &&
			node.name.text === 'name' &&
			markupHost(node) === 'ELEMENT'
		) {
			found = node.initializer;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(projected.sourceFile);
	if (found === undefined)
		throw new Error(
			'The fixture projected no ELEMENT-hosted `name` attribute at all. Every kind assertion below would ' +
				'then be vacuous, which is the failure this throw exists to distinguish from a wrong kind.'
		);
	return found;
}

let app: ProjectedSvelte[] = [];

beforeAll(() => {
	app = svelteFiles().map((path) => projectSvelte(path));
}, 120_000);

describe('CD-02 — the projected literal kind', () => {
	// ⭑⭑ THE PIN. `M-1` is refuted HERE, at the AST, before any census number is consulted — because a census
	// number that reads zero is exactly what a broken consumer produces, and the two are indistinguishable
	// without this assertion.
	it('projects a static name= as NoSubstitutionTemplateLiteral and NOT as StringLiteral', () => {
		const initializer = firstElementNameInitializer(projectFixture());
		expect(ts.isNoSubstitutionTemplateLiteral(initializer)).toBe(true);
		expect(ts.isStringLiteral(initializer)).toBe(false);
		// The alias that makes the mistake attractive, pinned so a reader of a dump is not misled by it.
		expect(ts.SyntaxKind[initializer.kind]).toBe('FirstTemplateToken');
		expect((initializer as ts.NoSubstitutionTemplateLiteral).text).toBe('version');
	});

	// ⛔ CONTROL — `feedback_a_control_that_fails_like_its_subject`. Without this, a broken or mis-bundled `ts`
	// import returns `false` for the subject AND for the control, and that reads as agreement. The predicate must
	// be shown to be capable of returning TRUE in the same test, on a node whose kind is not in question.
	it('CONTROL — ts.isStringLiteral is a working predicate, not one that always returns false', () => {
		const handBuilt = ts.factory.createStringLiteral('version');
		expect(ts.isStringLiteral(handBuilt)).toBe(true);
		expect(ts.isNoSubstitutionTemplateLiteral(handBuilt)).toBe(false);
	});

	// ⛔ CONTROL — a projection that does not parse makes every kind assertion vacuous, and a kind assertion
	// cannot tell "no such node" from "wrong kind". This is what makes the pin above mean something.
	it('CONTROL — the fixture projection parses with zero diagnostics', () => {
		expect(projectFixture().parseDiagnosticCount).toBe(0);
	});

	it('CONTROL — every application file projects with zero parse diagnostics', () => {
		expect(app.map((p) => `${p.path} :: ${p.parseDiagnosticCount}`).filter((r) => !r.endsWith(':: 0'))).toEqual(
			[]
		);
		// Anti-vacuity: eleven authored components today. A floor, not the count — see the note at the census.
		expect(app.length).toBeGreaterThanOrEqual(5);
	});
});

describe('CD-02 — M-1: the refuted predicate, DRIVEN rather than warned about', () => {
	// ⭑ THE MUTANT, RUN. A consumer written with `ts.isStringLiteral` finds ZERO keys across the whole
	// application while the correct one finds a full population. The contrast is the assertion: either half
	// alone is a number nobody can interpret.
	it('M-1 — ts.isStringLiteral recovers ZERO static names where the projection predicate recovers a population', () => {
		const refuted = emittedNamesFromProjection(app, STRING_LITERAL_REFUTED_POLICY);
		const working = emittedNamesFromProjection(app, PROJECTION_POLICY);
		expect(refuted.staticNames.size).toBe(0);
		expect(working.staticNames.size).toBeGreaterThan(0);
		// ⚠ AND THE ZERO IS NOT A SILENT ZERO. The refuted predicate does not merely miss the keys; every site it
		// fails to read falls through to the DECLARED `other` list. A consumer that dropped unrecognised kinds
		// instead of declaring them would report the same clean zero with nothing to look at.
		expect(refuted.other.length).toBeGreaterThan(working.other.length);
	});

	// ⭑⭑ M-1b — THE PRECONDITION MADE FALSIFIABLE. `M-1`'s zero holds only under host scoping. Unscoped, the
	// same refuted predicate reaches the script-block object literals and returns a NON-empty set: one key, the
	// empty string, from four sites. Four sites, one key — the unit correction recorded in this file's header.
	it('M-1b — unscoped, the refuted predicate returns phantoms rather than zero', () => {
		const unscoped = emittedNamesFromProjection(app, UNSCOPED_REFUTED_POLICY);
		expect([...unscoped.staticNames]).toEqual(['']);
		// The population that makes the scoping load-bearing, measured 2026-09-09: 4 StringLiteral (all `''`) and
		// 5 PropertyAccessExpression sites outside markup.
		expect(nameHostCensus(app).NOT_MARKUP).toBeGreaterThanOrEqual(1);
	});

	// ⭑ M-1b's OTHER HALF, and it is the one that reddens against a SOURCE mutation of the working consumer.
	// Dropping the host scoping does NOT change the correct predicate's key set on today's tree — measured, both
	// 51 — so a census-count assertion could not catch it. What it changes is the DECLARED list, which gains the
	// nine non-markup sites. That is the assertion that has to carry the mutant.
	it('M-1b — dropping host scoping leaves the key set intact and CORRUPTS the declared list', () => {
		const scoped = emittedNamesFromProjection(app, PROJECTION_POLICY);
		const unscoped = emittedNamesFromProjection(app, UNSCOPED_PROJECTION_POLICY);
		expect([...unscoped.staticNames].sort()).toEqual([...scoped.staticNames].sort());
		expect(unscoped.other.length).toBeGreaterThan(scoped.other.length);
		expect(unscoped.other.filter((row) => row.includes(':: StringLiteral ::')).length).toBe(4);
		expect(unscoped.other.filter((row) => row.includes(':: PropertyAccessExpression ::')).length).toBe(5);
	});

	// ⛔ CONTROL — the scoping is not a blanket rejection. The two hosts a template can emit from are both
	// recognised, and `COMPONENT_PROPS` is disclosed at ZERO tree-wide rather than counted as coverage.
	it('CONTROL — both markup hosts are recognised, and COMPONENT_PROPS is prospective at zero', () => {
		const hosts = nameHostCensus(app);
		expect(hosts.ELEMENT).toBeGreaterThanOrEqual(20);
		expect(hosts.COMPONENT_PROPS).toBe(0);
		// So the prospective limb is exercised where it CAN redden: a fixture.
		const fixtureHosts = nameHostCensus([projectFixture()]);
		expect(fixtureHosts.COMPONENT_PROPS).toBe(1);
		expect(fixtureHosts.ELEMENT).toBeGreaterThanOrEqual(3);
	});
});

describe('CD-02 — the minimum viable consumer', () => {
	// ⚠ A FLOOR, NOT THE COUNT, AND THE TWO ARE DELIBERATELY SEPARABLE — `feedback_an_arrangement_that_trips_two
	// _guards`. The measured population is 51 static keys. A floor set at 51 (or at "the pinned length") would
	// fire on the SAME arrangement as any content assertion, and the control would then be indistinguishable from
	// its subject on the mutant that matters. This floor answers a different question — has the population
	// COLLAPSED? — and is set well below any plausible edit so that `M-1`'s zero trips it ALONE.
	it('recovers a static-name population that has not collapsed', () => {
		const names = emittedNamesFromProjection(app, PROJECTION_POLICY);
		expect(names.staticNames.size).toBeGreaterThanOrEqual(20);
		// Named keys, so "51 of something" cannot pass for "51 form keys".
		expect(names.staticNames.has('permittedChildTypeIds')).toBe(true);
		expect(names.staticNames.has('pwuTypeId')).toBe(true);
	});

	// ⭑⭑ THE CAPABILITY THE INCUMBENT REGEX DOES NOT HAVE, ASSERTED AS AST DATA.
	it('reads a dynamic emitter head as AST data', () => {
		const names = emittedNamesFromProjection(app, PROJECTION_POLICY);
		expect(names.dynamicHeads).toEqual(['applicability:', 'cardinality:']);
		expect(names.dynamic).toEqual([
			`${DYNAMIC_ROUTE} :: \`applicability:\${t.id}\``,
			`${DYNAMIC_ROUTE} :: \`cardinality:\${t.id}\``
		]);
	});

	// ⛔ THE DEFECT THE SWAP EXISTS TO FIX, SHOWN RATHER THAN ASSERTED — and shown to be INVISIBLE to the
	// incumbent's own control. `/name=\{([^}]*)\}/g`: the `[^}]*` stops at the FIRST `}`, which is the one
	// closing `${…}`, so the capture is TRUNCATED. The incumbent census asserts `toMatch(/cardinality:/)` on that
	// capture — and the truncated string still matches. A control that passes on both a correct capture and a
	// mangled one cannot distinguish them, which is why this is a method change and not a tidy-up.
	//
	// ⚠ THIS TEST READS THE INCUMBENT'S REGEX; IT DOES NOT WIRE THE BRIDGE INTO THE INCUMBENT GATE. That is
	// `CD-03`, and it carries the cross-validation this file deliberately does not claim.
	it('the incumbent regex truncates the same emitter the projection reads exactly', () => {
		const authored = readFileSync(DYNAMIC_ROUTE, 'utf8');
		const captures = [...authored.matchAll(/name=\{([^}]*)\}/g)].map((m) => m[1]!.trim());
		expect(captures).toContain('`cardinality:${t.id');
		expect(captures).not.toContain('`cardinality:${t.id}`');
		// The incumbent's control passes on the mangled capture. Its passing proves nothing about the capture.
		expect(captures.some((c) => /cardinality:/.test(c))).toBe(true);
		// The projection, on the same emitter, yields the head as a value with no closing brace in it at all.
		expect(emittedNamesFromProjection(app, PROJECTION_POLICY).dynamicHeads).toContain('cardinality:');
	});

	// ⚠ AN UNRECOGNISED INITIALIZER KIND IS DECLARED, NEVER DROPPED — `arrow-command-census.ts` records shipping
	// exactly the opposite once, where an unreadable shape contributed zero arrows instead of all of them. These
	// two sites are real emitters whose key is a function call; this increment does not resolve them, it REFUSES
	// to pretend they are absent.
	it('declares the initializer kinds it cannot resolve', () => {
		const names = emittedNamesFromProjection(app, PROJECTION_POLICY);
		expect(names.other).toEqual([
			'apps/rph-demo/src/routes/undertakings/+page.svelte :: CallExpression :: riskFieldName(d.field)',
			'apps/rph-demo/src/routes/undertakings/[id]/+page.svelte :: CallExpression :: riskFieldName(d.field)'
		]);
	});

	// The fixture-only limbs. Prospective at zero tree-wide, so a fixture is the only place they can redden.
	it('FIXTURE — component props, shorthand and spread are recognised rather than silently skipped', () => {
		const names = emittedNamesFromProjection([projectFixture()], PROJECTION_POLICY);
		expect([...names.staticNames].sort()).toEqual(['componentProp', 'singleQuoted', 'version']);
		expect(names.unanalysable).toEqual([
			`${FIXTURE_PATH} :: {...rest}`,
			`${FIXTURE_PATH} :: {name}`
		]);
	});

	// ⚠ THE UNANALYSABLE LIST IS ASSERTED, NOT MERELY COLLECTED. Every row on this tree is svelte2tsx's own
	// `__sveltets_2_empty({…})` wrapper around `data-*` attributes — a projection idiom, not an authored one, and
	// none of them carries a `name`. A genuinely opaque spread appearing here is a finding and must be looked at.
	it('every unanalysable row on this tree is the projection wrapper, not an authored opaque spread', () => {
		const names = emittedNamesFromProjection(app, PROJECTION_POLICY);
		expect(names.unanalysable.filter((row) => !row.includes('__sveltets_2_empty('))).toEqual([]);
		expect(names.unanalysable.length).toBeGreaterThanOrEqual(1);
	});
});

describe('CD-02 — the provider contract', () => {
	// ⭑ `M-11` IS COVERED BY EVERY PROJECTION IN THIS FILE, and it is worth saying where. The bridge's
	// `assertProviderVersions` THROWS `VERSION_MISMATCH` before transforming anything, so a bump of svelte,
	// svelte2tsx or typescript makes every test above fail with a NAMED refusal rather than producing a silently
	// different projection that still yields a plausible number. That named refusal is the strongest argument for
	// importing this bridge instead of hand-rolling an equivalent, and it is the reason the pins are asserted here
	// rather than left implicit in a successful run.
	it('pins the provider versions the projection contract is defined against', () => {
		expect(PINNED_PROVIDER_VERSIONS).toEqual({
			svelte: '5.56.4',
			svelte2tsx: '0.7.57',
			typescript: '5.9.3'
		});
		// The runtime half: this only passes because `assertProviderVersions` did not refuse.
		expect(ts.version).toBe(PINNED_PROVIDER_VERSIONS.typescript);
	});
});
