// ⭐ `REG-F-507` remedies 1 and 2 (`REG-D-121` Q18; `DESIGN-phase-7-completion.md` §4a E2) — THE DESIGNER FORM'S PROMPT
// EXAMPLE RENDERS AGAINST A WORK UNIT, AND THE FORM FLAGS A MARKER NO WORK UNIT SUPPLIES.
//
// ⛔ The example was 'Assess {subject} against {criteria}, and report findings.': nothing supplies {criteria}, so a prompt
// modelled on it published and was refused only when its unit ran (`REG-F-508`). Read off the markup, as the form shows
// it, and rendered by the engine against a unit as instantiation builds it: its title the type's name, its description
// the type's purpose, and the type's purpose beside them (`routes/undertakings/+page.server.ts`, and the step's subject in
// `routes/undertakings/[id]/+page.server.ts`).
import { readFileSync } from 'node:fs';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY,
	markersIn,
	prepareModelInvocation,
	WORK_UNIT_MARKERS
} from '@janumipwb/rph-application';
import { describe, expect, it } from 'vitest';

const MARKUP = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

/** The prompt field, from its textarea to the end of the field: the example, the markers it echoes, and the flag. */
function promptField(): string {
	const start = MARKUP.indexOf('id="pwu-type-prompt"');
	if (start === -1) throw new Error('the prompt field could not be located');
	const end = MARKUP.indexOf('</div>', start);
	if (end === -1) throw new Error('the prompt field has no end after its textarea');
	return MARKUP.slice(start, end);
}

/** The prompt textarea's example, as the form shows it. */
function promptExample(): string {
	const example = /^id="pwu-type-prompt"[^>]*\splaceholder=\{'([^']*)'\}/.exec(promptField())?.[1];
	if (example === undefined) throw new Error('the prompt textarea carries no example');
	return example;
}

describe('⭐ REG-F-507 — the designer form’s prompt example and its marker check', () => {
	it('⭐ the example renders against a work unit, and uses only markers a work unit supplies', () => {
		const example = promptExample();
		const plan = prepareModelInvocation(
			{
				id: 'pwu_example',
				title: 'Route Assessment',
				description: 'Assess the delivery route.',
				purpose: 'Assess the delivery route.'
			},
			'pwutype_example',
			{
				templateText: example,
				templateVersion: 1,
				declaredPlaceholders: markersIn(example),
				status: 'ACTIVE'
			},
			{ policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY, alsoAssembles: [] }
		);
		expect(plan.ready ? 'renders' : plan.reason, 'the form’s example, rendered against a work unit').toBe('renders');
		expect(markersIn(example).length, 'an example with no marker shows none').toBeGreaterThan(0);
		expect(markersIn(example).filter((m) => !WORK_UNIT_MARKERS.includes(m))).toEqual([]);
	});

	it('⛔ the form flags each marker no work unit supplies, beside the markers it echoes, and names the ones a unit does', () => {
		const field = promptField();
		const echo = field.indexOf('data-testid="pwu-type-prompt-markers"');
		const flag = field.indexOf('data-testid="pwu-type-prompt-unsupplied"');
		expect([echo > -1, flag > echo], 'the flag follows the echoed markers').toEqual([true, true]);
		// ⭑ Computed from the markers the prompt uses, shown when one is unsupplied, naming each, then a unit's markers.
		expect(field).toContain('{@const unsupplied = markersNoWorkUnitSupplies(markers)}');
		const shown = field.lastIndexOf('{#if unsupplied.length}', flag);
		expect(shown > echo, 'the flag is shown only while a marker is unsupplied').toBe(true);
		const flagged = field.slice(flag);
		const each = flagged.indexOf("{unsupplied.map((m) => `{${m}}`).join(', ')}");
		expect([each > -1, flagged.indexOf('{WORK_UNIT_MARKER_LIST}') > each], 'the flag names each, then a unit’s markers').toEqual([
			true,
			true
		]);
	});
});
