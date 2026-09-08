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
import { ASSURANCE_POLICY_FIELDS } from '@janumipwb/rph-authoring/catalog';

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
