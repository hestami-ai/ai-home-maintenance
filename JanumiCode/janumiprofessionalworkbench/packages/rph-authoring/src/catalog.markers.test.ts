// ⭐ `REG-F-507` remedies 1 and 2 (`REG-D-121` Q18; `DESIGN-phase-7-completion.md` §4a E2) — THE HELP BOTH AUTHORS READ
// NAMES THE MARKERS A WORK UNIT SUPPLIES, read from the engine's one render map, and the designer form's check names
// each marker a prompt uses that no work unit supplies.
//
// ⛔ The help said *"Use {placeholder} markers for values supplied at run time"* and named none, so each author learned
// the vocabulary from a step refused at render, after the PWA could no longer change (`REG-F-508`).
import { markersIn, WORK_UNIT_MARKERS } from '@janumipwb/rph-application';
import { describe, expect, it } from 'vitest';
import { markersNoWorkUnitSupplies, PWU_TYPE_HELP, WORK_UNIT_MARKER_LIST } from './catalog.js';

describe('⭐ REG-F-507 — the shared help names the markers a work unit supplies', () => {
	it('⭐ the prompt help names {subject}, {title}, {description} and {purpose}, the render map’s, and no other marker', () => {
		expect(markersIn(PWU_TYPE_HELP.promptTemplateText), 'the markers the help names').toEqual([
			'subject',
			'title',
			'description',
			'purpose'
		]);
		expect(markersIn(PWU_TYPE_HELP.promptTemplateText), 'read from the render map').toEqual([
			...WORK_UNIT_MARKERS
		]);
		expect(WORK_UNIT_MARKER_LIST).toBe('{subject}, {title}, {description} and {purpose}');
	});

	it('⛔ the form’s check names each marker no work unit supplies, {criteria} and {statement} among them', () => {
		expect(markersNoWorkUnitSupplies(['subject', 'criteria', 'purpose', 'statement'])).toEqual([
			'criteria',
			'statement'
		]);
		// ⭑ CONTROL — every marker a work unit supplies passes.
		expect(markersNoWorkUnitSupplies(WORK_UNIT_MARKERS)).toEqual([]);
	});
});
