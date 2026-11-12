// ⭐⭐ `JAN-EXEC` Phase 7, package L10 — design D65 (`REG-D-154` (2); the lead's decision (b)) — THE VALUES PUBLISH'S CHECK GIVES A UNIT ARE
// THOSE THE UNIT IS GIVEN WHEN ITS STEP RUNS, PINNED AGAINST THE CODE THAT GIVES THEM.
//
// ⭑ WHY THIS FILE. PublishPwa now refuses a PWA with a type declaring MODEL whose prompt the step of its unit would refuse, decided by the
// code the step runs (`unitPromptRefusal`: `renderPromptTemplate` over `assembleStepContext`), given the subject a unit of the type is
// given. App code gives each of that subject's values, so the check builds them from the type, as that code does
// (`unitSubjectOfType`): the title, the type's name, and the description, its purpose, which instantiation copies onto the unit
// (`routes/undertakings/+page.server.ts`); and `{purpose}`, the type's purpose only when it is not empty, which the route sets beside the
// unit's own fields (`routes/undertakings/[id]/+page.server.ts`). ⛔ So the two must be held together HERE, against that code: a change
// to either that the check did not follow would let Publish pass a prompt the step then refuses — `REG-F-627` again — or refuse one it
// would run.
//
// ⭑ DRIVEN THROUGH THE PAGE'S OWN ACTIONS: the Undertaking created by its form's action (instantiation), and Begin & Execute posted as
// the page posts it, the agy executor's seam recording the instruction its producer was sent, on `begin-execute-try-count.test.ts`'s
// arrangement. ⛔ HERMETIC: agy's seam answers the fixture, Pi's opener refuses, devin's reviewer adapter refuses, PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the agy executor's seam was handed, call by call: its second argument is the turn its producer is sent. */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly file: string; readonly args: readonly string[] }[]
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async (file, args) => {
					seam.agy.push({ file, args });
					return { stdout: await actual.deterministicExecutionPrint(args[1] ?? '') };
				},
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	return {
		...actual,
		devinPrint: vi.fn(async () => {
			throw new Error('hermetic: no route test runs a real devin review');
		})
	};
});

import {
	assembleStepContext,
	markersIn,
	renderPromptTemplate,
	resolveInvocationSubject,
	unitPromptRefusal,
	unitSubjectOfType
} from '@janumipwb/rph-application';
import type { PromptTemplate } from '@janumipwb/rph-contracts';
import { getObjectOfType, listPwus } from '@janumipwb/rph-engine';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { actionEvent, beginExecute } from './begin-execute.testing.js';

/** D8's live-backend variables — each case sets only what it names. */
const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

beforeEach(() => {
	resetEngine('reference');
	seam.agy.length = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	// The agy executor, so its seam records the instruction (`begin-execute-try-count.test.ts`).
	vi.stubEnv('JPWB_EXECUTOR', 'agy');
	vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-x');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

interface ModelType {
	readonly name: string;
	readonly purpose: string;
	readonly templateText: string;
}

/**
 * A PWA a person authored, its one root type `type` — MODEL, its prompt ACTIVE — published; an Undertaking of it created through the
 * form's own action, which instantiates its unit: the type's id, its template, and the unit's id.
 */
async function unitOf(type: ModelType): Promise<{ typeId: string; template: PromptTemplate; unitId: string }> {
	const pwaId = mintUiId('pwa');
	const typeId = mintUiId('pwut');
	const template: PromptTemplate = {
		templateText: type.templateText,
		templateVersion: 1,
		declaredPlaceholders: markersIn(type.templateText),
		status: 'ACTIVE'
	};
	const steps: readonly [string, string, string, Record<string, unknown>][] = [
		[
			'CreatePwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{ pwaId, name: 'Unit Prompt PWA', description: 'A PWA whose root type a model runs.', domain: 'logistics', version: '0.1.0' }
		],
		[
			'DefinePwuType',
			'PWU_TYPE',
			typeId,
			{
				pwuTypeId: typeId,
				pwaId,
				pwuKind: 'ROUTE_ASSESSMENT',
				name: type.name,
				purpose: type.purpose,
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [],
				workDischarge: 'MODEL',
				promptTemplate: template
			}
		],
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: typeId }]
	];
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	const created = (await undertakings.create(
		actionEvent('create', { name: 'Unit Prompt Demo', pwaId, ...RISK }) as never
	)) as { created?: string; data?: { error?: string } };
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const unit = listPwus(getEngine(), created.created!).find((p) => p.state.pwuTypeId === typeId);
	expect(unit, 'arrangement: the unit was not instantiated').toBeDefined();
	return { typeId, template, unitId: unit!.id };
}

/** The unit's own fields, as the step reads them off its record (`resolveInvocationSubject`). */
const ownFields = (unitId: string) =>
	resolveInvocationSubject((id) => getObjectOfType(getEngine(), 'PROFESSIONAL_WORK_UNIT', id), unitId);

/** The check's own rendering of `template` for a unit of the type: the text, or the refusal it would give. */
function checkRenders(typeId: string, type: ModelType, template: PromptTemplate): string {
	const outcome = renderPromptTemplate(template, assembleStepContext(unitSubjectOfType(typeId, type.name, type.purpose), template));
	return outcome.rendered ? outcome.text : `REFUSED: ${outcome.refusedBecause}`;
}

describe('⭐⭐ L10 (D65; the lead’s decision (b)) — the values Publish’s check gives a unit are those instantiation and the step give it', () => {
	it('⭐ a type with a purpose: its unit carries its name and purpose, and the step sends exactly the prompt the check renders, every marker a unit is given filled', async () => {
		const type: ModelType = {
			name: 'Route Assessment',
			purpose: 'Assess the route for the pilot',
			templateText: 'Assess {subject} ({title}) for {description}; deliver {purpose}.'
		};
		const { typeId, template, unitId } = await unitOf(type);
		const subject = unitSubjectOfType(typeId, type.name, type.purpose);
		expect([ownFields(unitId).title, ownFields(unitId).description], 'instantiation gave the unit other values than the check').toEqual([
			subject.title,
			subject.description
		]);
		const checked = checkRenders(typeId, type, template);
		expect(checked, 'the check’s own rendering').toBe(
			'Assess Route Assessment (Route Assessment) for Assess the route for the pilot; deliver Assess the route for the pilot.'
		);
		expect(unitPromptRefusal(typeId, type.name, { purpose: type.purpose, promptTemplate: template }), 'Publish’s check').toBeUndefined();
		await beginExecute(unitId);
		expect(seam.agy.length, 'arrangement: the step sent its producer no turn').toBeGreaterThan(0);
		expect(seam.agy[0]!.args[1], 'the step sent another prompt than the one the check rendered').toContain(checked);
	});

	it('⭐ a type with an EMPTY purpose: its unit’s description is empty and it is given no {purpose}; Begin & Execute stops it before its step, at its readiness', async () => {
		const type: ModelType = { name: 'Route Assessment', purpose: '', templateText: 'Assess {subject} ({title}): [{description}].' };
		const { typeId, template, unitId } = await unitOf(type);
		const subject = unitSubjectOfType(typeId, type.name, type.purpose);
		expect(subject, 'the check gave a unit of a type with no purpose a {purpose}').not.toHaveProperty('purpose');
		expect([ownFields(unitId).title, ownFields(unitId).description], 'instantiation gave the unit other values than the check').toEqual([
			subject.title,
			subject.description
		]);
		expect(checkRenders(typeId, type, template), 'the check’s own rendering').toBe('Assess Route Assessment (Route Assessment): [].');
		// ⚠ OBSERVED, NOT CHOSEN (2026-11-12, this package's Stage 2): with instantiation's values the step is never reached — Begin &
		// Execute's batch refuses the unit at MarkPwuReady, its description (the type's empty purpose) failing the shape readiness contract
		// (DOC-002 §9.1, "title and professional purpose"), so no turn is sent and the unit stays as it was. So the route's {purpose} rule
		// for an empty purpose is pinned from its source, below.
		const answered = await beginExecute(unitId);
		expect(answered.data?.error, 'the unit reached its step').toMatch(/^Execution failed: MarkPwuReady: .*professional purpose/);
		expect(seam.agy, 'the step sent its producer a turn').toEqual([]);
	});

	it('⭐ SOURCE CHECK — the route gives the step {purpose} only when the type’s purpose is not empty, at each place it builds a unit’s subject', () => {
		// ⚠ READ FROM THE SOURCE, because no published PWA can drive this arm: Publish refuses a type whose prompt uses {purpose} while
		// its purpose is empty, which is the case the arm decides. Every subject the route builds for a unit's step or its rebuilt
		// prompt spells the rule; the recovery's rebuild takes it from the route.
		const route = readFileSync(new URL('../../../routes/undertakings/[id]/+page.server.ts', import.meta.url), 'utf8');
		const recovery = readFileSync(new URL('./stopped-unit-recovery.ts', import.meta.url), 'utf8');
		const occurrences = (source: string, text: string) => source.split(text).length - 1;
		expect(occurrences(route, '...(typeFacts.purpose ? { purpose: typeFacts.purpose } : {})'), 'the route’s rule').toBe(3);
		expect(occurrences(route, '{ purpose: typeFacts.purpose }'), 'the route sets {purpose} by another rule too').toBe(3);
		expect(occurrences(recovery, '...(args.purpose ? { purpose: args.purpose } : {})'), 'the recovery’s rule').toBe(1);
		expect(occurrences(recovery, '{ purpose: args.purpose }'), 'the recovery sets {purpose} by another rule too').toBe(1);
	});
});
