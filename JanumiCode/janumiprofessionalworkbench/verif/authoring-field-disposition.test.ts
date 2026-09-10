// THE AUTHORING FIELD DISPOSITION — every control on the policy form says what it does, INCLUDING the ones that
// do nothing.
//
// ⭑ THE SPONSOR'S OWN CASE: *"the human user may use the UI to make manual changes as well."* A setting a person
// edits and nothing consults is a fiction presented as control. Measured across the eight controls of the
// Assurance Policy form: three of them — `rationale`, `evaluatedClaimTypes`, `evaluatorRole` — are stored,
// patchable, and consulted by nothing that this surface can reach.
//
// ⛔ THE REMEDY IS DISCLOSURE, NOT WIRING. Removing the controls would lose the author's intent, and wiring them
// would invent governance the corpus declined to make — `evaluationMethod`'s absent reader is already filed as
// `REG-F-243`, OPEN, so wiring here would re-file a finding this register has answered.
//
// ── ⚠⚠ WHY THE DISPOSITION IS DECLARED AND NOT DERIVED, WHICH IS THE DESIGN DECISION ─────────────────────────
// The obvious gate derives "is it consulted?" by looking for the field name inside a conditional. That gate is
// ALREADY DEFEATED AT HEAD, and this was measured rather than feared: `EG-04`'s own `policyEditPatch` added
// `if (f.evaluatorRole)` and `if (f.evaluatedClaimTypes !== undefined)` — presence guards, not consultations.
// A name-in-a-conditional derivation reports BOTH unread fields as consulted, so **the commit that fixed their
// sibling would have silenced the gate for them**. An instrument a refactor can satisfy is not an instrument.
//
// ⭑ So the disposition is declared by a human and made FALSIFIABLE instead: a `consulted` claim must name a file
// and QUOTE the reader, and this gate fails if that quote is not in that file. A quote rather than a line number
// because this register already records that line citations rot while the text they point at moves.
//
// ⛔ WHAT IT CANNOT SEE, STATED RATHER THAN CLAIMED AWAY: whether a named reader is MEANINGFUL. A quote that
// resolves proves the value is touched somewhere, not that touching it matters. That judgment is in the
// declaration's own prose, where a reader can disagree with it — which is the point of quoting rather than
// counting.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSURANCE_POLICY_FIELDS, PWU_TYPE_HELP } from '@janumipwb/rph-authoring/catalog';

/** `PWU_TYPE_HELP` is `as const`, so indexing it by a `string` is a type error. Widened ONCE, here, rather
 *  than casting at six call sites — and deliberately NOT `any`: a missing key must read as `undefined` so the
 *  control below can catch a rename, not be silently allowed through. */
const HELP: Readonly<Record<string, string | undefined>> = PWU_TYPE_HELP;

const MARKUP_PATH = 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte';
const MARKUP = readFileSync(MARKUP_PATH, 'utf8');

/**
 * The control names the Assurance Policy form posts, derived from the markup.
 *
 * ⚠ DERIVED FROM THE FORM REGION, NOT FROM THE WHOLE FILE. The page holds several forms; taking every `name=`
 * would fold the PWU Type form's thirty controls into this census and make the population pin meaningless. The
 * region is bounded by the policy form's own action, and the CONTROL below fails if that bound stops matching.
 */
function policyFormControls(): string[] {
	const start = MARKUP.indexOf('?/editPolicy');
	if (start === -1) throw new Error('the policy form action could not be located');
	const end = MARKUP.indexOf('</form>', start);
	if (end === -1) throw new Error('the policy form has no closing tag after its action');
	const region = MARKUP.slice(start, end);
	return [...new Set([...region.matchAll(/name="([^"]+)"/g)].map((m) => m[1]!))]
		.filter((n) => n !== 'policyId' && n !== 'expectedRevision') // subject identity + PER-4 plumbing
		.sort();
}

const CONTROLS = policyFormControls();

describe('EG-05 — every policy control declares what it does', () => {
	it('⭑ CONTROL — the form region was found and holds a plausible set of controls', () => {
		// ⛔ WITHOUT THIS the derivation can silently return `[]` after a markup change, and "every one of nothing
		// is declared" is green. This gate's whole population lives or dies on that `indexOf`.
		expect(CONTROLS.length, `controls derived from ${MARKUP_PATH}`).toBeGreaterThanOrEqual(8);
		expect(CONTROLS).toContain('criteria');
		expect(CONTROLS).toContain('evaluatorRole');
	});

	it('⛔ the declaration covers EXACTLY the controls the form posts', () => {
		// THE MUTANT: add a control to the policy form and declare nothing for it. ⚠ `toEqual`, not a filter —
		// the declaration is the TARGET, so the population cannot grow without a human editing it.
		expect(
			Object.keys(ASSURANCE_POLICY_FIELDS).sort(),
			'a control with no declared disposition, or a declaration for a control that no longer exists'
		).toEqual(CONTROLS);
	});

	it('⛔⛔ a `consulted` claim must RESOLVE — it names a file and quotes the reader', () => {
		// ⭑ THIS IS WHAT STOPS A DISCLOSURE BEING SILENCED BY FLIPPING A BOOLEAN. THE MUTANT: declare
		// `evaluatorRole` consulted with a plausible-looking quote; the quote is not in the file and this reddens.
		const broken: string[] = [];
		for (const [field, d] of Object.entries(ASSURANCE_POLICY_FIELDS)) {
			if (!d.consulted) continue;
			let text: string;
			try {
				text = readFileSync(d.consulted.file, 'utf8');
			} catch {
				broken.push(`${field}: named file does not exist — ${d.consulted.file}`);
				continue;
			}
			if (!text.includes(d.consulted.quote))
				broken.push(`${field}: the quote is not in ${d.consulted.file} — ${d.consulted.quote}`);
		}
		expect(broken, 'a consulted-reader claim that does not resolve').toEqual([]);
	});

	it('⛔ an UNCONSULTED field must disclose that, in the text a professional reads', () => {
		// THE MUTANT: soften a disclosure to ordinary help text. The point of the field is the admission, so the
		// admission is what is asserted — not merely that some string exists.
		const undisclosed = Object.entries(ASSURANCE_POLICY_FIELDS)
			.filter(([, d]) => d.consulted === null)
			.filter(([, d]) => !/\bNOT\b|not read by|not currently used/.test(d.help))
			.map(([f]) => f);
		expect(
			undisclosed,
			'this field is consulted by nothing and its help text does not say so — the fiction EG-05 exists to end'
		).toEqual([]);
	});

	it('⛔⛔ every declared help string is actually RENDERED — a disclosure nobody sees discloses nothing', () => {
		// ⚠ THE FAILURE THIS GUARDS IS THE ONE THIS PROGRAMME KEEPS RECORDING: content authored, validated, and
		// terminated at the surface boundary. THE MUTANT: delete a `{@render fhead(...)}` while leaving the
		// declaration intact. The unit-level assertions above all stay green.
		const unrendered = Object.keys(ASSURANCE_POLICY_FIELDS).filter(
			(f) => !MARKUP.includes(`ASSURANCE_POLICY_FIELDS.${f}.help`)
		);
		expect(
			unrendered,
			`declared but never rendered in ${MARKUP_PATH} — the value would exist and reach no professional`
		).toEqual([]);
	});

	it('⭑⭑ CONTROL — consulted fields carry NO disclosure, so this is not "label everything"', () => {
		// ⛔ WITHOUT THIS the gate is satisfiable by declaring every field unconsulted and disclaiming all eight,
		// which would be worse than saying nothing: a professional told that nothing works stops reading. Two
		// fields on this same form ARE enforced, and their help says so.
		const consulted = Object.entries(ASSURANCE_POLICY_FIELDS).filter(([, d]) => d.consulted !== null);
		expect(consulted.length, 'the form must retain fields that genuinely govern').toBeGreaterThanOrEqual(4);
		for (const [field, d] of consulted)
			expect(d.help, `${field} is consulted and must not disclaim itself`).not.toMatch(
				/not read by|not currently used/
			);
	});

	it('⭑ CONTROL — the three measured unconsulted fields are the ones disclosed', () => {
		// Pins the MEASUREMENT, so quietly re-declaring one as consulted to remove its note is a visible edit
		// here as well as at the quote check.
		expect(
			Object.entries(ASSURANCE_POLICY_FIELDS)
				.filter(([, d]) => d.consulted === null)
				.map(([f]) => f)
				.sort()
		).toEqual(['evaluatedClaimTypes', 'evaluatorRole', 'rationale']);
	});
});

// ── ⭑⭑ JAN-EXECGOV EG-06 — THE PWU TYPE FORM'S HELP MUST NOT CLAIM GOVERNANCE THAT DOES NOT EXIST ────────────
//
// `EG-05` handled a form with BARE LABELS. This is the opposite and harder case: the PWU Type form already had
// help, single-sourced and rendered — and measurement (four adjudication lanes, each attacked by a skeptic)
// found FIVE of its twenty strings claiming a guarantee the code does not make.
//
// ⛔ A FIELD WITH NO EXPLANATION LEAVES A PROFESSIONAL UNCERTAIN; A FIELD WITH A FALSE ONE LEAVES THEM CONFIDENT
// AND WRONG. The worst was `completionRule` — *"When an Instance of this type is DONE … (no green without
// assurance)"* — where nothing evaluates the field and *"no green without assurance"* is a REAL guarantee, made
// by `requireGoverningPolicies` and the locked floor and keyed on other fields entirely. A true guarantee
// attached to an inert textbox is a reason to trust it.
//
// ⚠⚠ AND THE ADMISSION CHECK IS A REGEX OVER PROSE, WHICH A FRAGMENT CAN SATISFY — MEASURED, NOT SUPPOSED.
// The first two mutants written against it SURVIVED: each replaced only the TAIL of a help string, leaving
// the admission phrase standing earlier in the same entry, so the text matched while the sentence had
// stopped being true. Re-aimed at the WHOLE entry — which is what "restore the original" actually means —
// both went red. The limitation is real and stated: this pins that an admission is PRESENT, not that the
// surrounding sentence is coherent. A human reads the string; this stops it vanishing.
//
// ⚠ WHAT THIS GATE DOES AND DOES NOT DO. It pins the ADMISSIONS: a field measured as unenforced must keep saying
// so. It does NOT re-derive "is this consulted?" — that judgment came from an adversarial adjudication and lives
// in `REG-F-371`, and a static test cannot redo it. The full per-control disposition declaration for this form,
// in the shape `ASSURANCE_POLICY_FIELDS` already uses, is `EG-07` and is deliberately not folded in here.
describe('EG-06 — the PWU Type form admits what it does not enforce', () => {
	/** Fields measured unenforced, each with the admission its help must carry. Struck through would be silent. */
	const MUST_ADMIT: Readonly<Record<string, RegExp>> = {
		// Nothing evaluates it: all production sites are schema, assignment, presence guard or stored default.
		completionRule: /not evaluated|no gate reads it/i,
		// Two admissions on ONE key, because one control is described by one string. `permittedChildTypeIds`
		// had its own entry and it was rendered by NOTHING — deleted, and its admission folded here.
		// ZERO occurrences in rph-domain/src, handlers/pwu.ts and handlers/decomposition.ts; and four
		// cardinality codes are declared while only the mandatory/conditional split is enforced.
		permittedChildren: /NOT AN ALLOW-LIST[\s\S]*upper bound is NOT enforced/i,
		// Beyond the id-validity check it changes no outcome.
		attestedAssurancePolicyIds: /CHANGES NO OUTCOME|nothing at Undertaking or assessment time reads/i,
		// No matcher exists; `work-product-floor.ts` says so itself.
		promptOutputContract: /nothing compares the answer back against it|not machine-checked/i
	};

	it('⛔⛔ every field measured UNENFORCED still says so in the text a professional reads', () => {
		// THE MUTANT: restore any of the five original strings. Each asserted a guarantee that does not exist, and
		// `completionRule`'s borrowed a real one from a different field.
		const silent = Object.entries(MUST_ADMIT)
			.filter(([field, admission]) => !admission.test(HELP[field] ?? ''))
			.map(([f]) => f);
		expect(
			silent,
			'this field was measured as unenforced and its help no longer admits it — the fiction EG-06 exists to end'
		).toEqual([]);
	});

	it('⭑ CONTROL — every named field EXISTS in the help map, so a rename cannot empty this gate', () => {
		// ⛔ Without this, renaming a key makes `HELP[field]` undefined; the regex would fail and read as
		// a missing admission rather than as a broken gate. Worse, deleting a key AND its entry here would pass.
		for (const field of Object.keys(MUST_ADMIT))
			expect(HELP[field], `${field} is not a key of PWU_TYPE_HELP`).toBeTypeOf('string');
	});

	it('⭑⭑ CONTROL — the ENFORCED fields do NOT disclaim themselves, so this is not "disclaim everything"', () => {
		// ⛔ THE FAILURE THIS GUARDS IS REAL AND IT IS THE OPPOSITE ONE. 15 of the 20 controls ARE consulted; a
		// professional told that nothing works stops reading the notes, and the two fields that genuinely gate
		// publication (`isRoot`) and policy selection (`pwuKind`) would lose their reader with them.
		const DISCLAIMER = /not evaluated|no gate reads it|changes no outcome|not an allow-list/i;
		for (const field of ['name', 'pwuKind', 'purpose', 'isRoot', 'requiredAssurancePolicyIds'])
			expect(DISCLAIMER.test(HELP[field] ?? ''), `${field} is consulted and must not disclaim itself`).toBe(
				false
			);
	});

	it('⛔ the PWU Type form single-sources ALL its help — no form carries two vocabularies for one thing', () => {
		// ⚠ MEASURED, NOT FEARED: three of these fifteen were INLINE LITERALS in the markup while their twelve
		// siblings came from the catalog — and those three were exactly the ones the agent's tool schema cannot
		// see, so the two authors of one object were reading different words. THE MUTANT: inline any help string
		// back into an `{@render fhead(...)}` call.
		const start = MARKUP.indexOf("action={editing ? '?/editType' : '?/defineType'}");
		expect(start, 'the PWU Type form action could not be located').toBeGreaterThan(-1);
		const region = MARKUP.slice(start, MARKUP.indexOf('</form>', start));
		const calls = [...region.matchAll(/\{@render fhead\(\s*([^)]*?)\)\}/gs)].map((m) => m[1]!);
		expect(calls.length, 'the region yielded no fhead calls — the derivation broke').toBeGreaterThanOrEqual(12);
		const inline = calls
			.map((c) => c.split(/,(?![^(]*\))/)[1]?.trim() ?? '')
			.filter((arg) => arg.startsWith("'") || arg.startsWith('"') || arg.startsWith('`'));
		expect(
			inline,
			'this help string is written inline in the markup instead of PWU_TYPE_HELP. One form, one vocabulary — ' +
				'and only the catalog is reachable by the authoring agent.'
		).toEqual([]);
	});

	it('⛔⛔ no help string is read by NOBODY — the e2e found one, so the gate now derives it', () => {
		// ⚠ THIS LIMB EXISTS BECAUSE THE UNIT TESTS COULD NOT SEE IT. `permittedChildTypeIds` was authored,
		// rendered by no form, named by no tool schema — and EG-06 CORRECTED IT before noticing, so a false
		// governance claim was replaced by a true sentence nobody could read. The e2e assertion that a person can
		// SEE the text is what failed; this is that failure made cheap and general.
		//
		// ⭑ THE POSITIVE CONTROL IS BUILT IN: twelve of the thirteen remaining keys are used by BOTH consumers, so
		// a derivation that stopped resolving either one would empty the "used" set and redden loudly rather than
		// reporting a clean map.
		const tools = readFileSync('apps/rph-demo/src/lib/server/agent/tools.ts', 'utf8');
		// ⚠ `\\b` and `\\.`, not `\b`/`\.`: inside a TEMPLATE LITERAL those are a backspace character and a
		// literal dot-escape, so the first version of this line built a RegExp matching nothing and the CONTROL
		// below caught it — reporting "no key is used by both" rather than "no key is unread".
		const usedByAgent = (k: string) => new RegExp(`\\bhelp\\.${k}\\b`).test(tools);
		const renderedInForm = (k: string) => MARKUP.includes(`PWU_TYPE_HELP.${k}`);
		const keys = Object.keys(HELP);

		expect(keys.length, 'PWU_TYPE_HELP is empty — the import or the map broke').toBeGreaterThan(10);
		expect(
			keys.filter((k) => renderedInForm(k) && usedByAgent(k)).length,
			'CONTROL: neither consumer resolves, so "read by nobody" would be true of everything'
		).toBeGreaterThanOrEqual(10);

		expect(
			keys.filter((k) => !renderedInForm(k) && !usedByAgent(k)),
			'this help string is rendered by no form and named by no tool schema. Authored content that reaches ' +
				'no reader is the shape this programme keeps recording — render it, give it to the agent, or delete it.'
		).toEqual([]);
	});

	it('⛔⛔ EG-07e — no help string is read by ONE author and not the other', () => {
		// Re-derived rather than shared with the limb above, so each failure names ITSELF. When both assertions
		// lived in one `it`, every mutant reported the NOBODY test's name — a failure message that points at the
		// wrong defect costs more than the two file reads it saves.
		const tools = readFileSync('apps/rph-demo/src/lib/server/agent/tools.ts', 'utf8');
		const usedByAgent = (k: string) => new RegExp(`\\bhelp\\.${k}\\b`).test(tools);
		const renderedInForm = (k: string) => MARKUP.includes(`PWU_TYPE_HELP.${k}`);
		const keys = Object.keys(HELP);

		// ⭑ THE SAME POSITIVE CONTROL THE LIMB ABOVE CARRIES, and it is not ceremony: the first version of that
		// regex used `\b` inside a template literal — a BACKSPACE character — and matched nothing, which would
		// make every key look form-only and this assertion scream about all seventeen.
		expect(
			keys.filter((k) => renderedInForm(k) && usedByAgent(k)).length,
			'CONTROL: neither consumer resolves, so the asymmetry below would be true of everything'
		).toBeGreaterThanOrEqual(10);

		// ⭑⭑ JAN-EXECGOV EG-07e — THE ASYMMETRY the NOBODY limb above already computed and threw away.
		// "Read by nobody" is the loud failure; "read by ONE of the two authors" is the quiet one, and it is the
		// defect this whole EG-07 series is about: a PWU Type has TWO authors, a human at this form and an agent
		// holding a tool schema, and a field only one of them can read is a field they will describe differently
		// to each other. Measured before this limb landed: 15 of 17 keys were read by both, and the two that were
		// not are exactly the two the design named — `permittedChildren` (form only) and `promptActive` (agent
		// only), one asymmetric in each direction.
		//
		// ⛔ SYMMETRIC ON PURPOSE, and `!==` is what makes it so. `renderedInForm && !usedByAgent` would catch
		// only the human-favouring direction and go green forever on agent-only drift — which is the direction
		// `promptActive` actually drifted, so a one-sided limb would have shipped green over a live defect.
		//
		// ⛔ AND IT LANDS WITH NO EXEMPTION LIST. Both offenders were repaired in the same increment rather than
		// grandfathered: an exemption granted on a gate's first day is how a gate rots, and this repository has
		// three by-name allowlists it can only ever shrink to prove the point.
		expect(
			keys.filter((k) => renderedInForm(k) !== usedByAgent(k)),
			'one author of a PWU Type can read this help and the other cannot — the form renders it and the tool ' +
				'schema does not, or the reverse. Give it to BOTH authors or to neither; two authors of one object ' +
				'reading different words about the same field is the defect EG-07 exists to close.'
		).toEqual([]);
	});
});
