// ⭐ `JAN-SELREV` SR-1 (D5) — A MODEL STEP IS REFUSED BEFORE PAID WORK WHEN THE REVIEWER'S CONFIGURATION IS INVALID.
//
// ⛔ WHAT WAS WRONG (`REG-F-457` G3, G5). `beginExecute` had no reviewer preflight: a misconfigured reviewer was found
// only when the work product reached its floor, AFTER the executor had been opened and paid for. And when the fault
// was devin's missing model, `createFloorRegistry` THREW at build, out of the step's try/finally — which has no catch —
// so the action failed with the plan started and the step RUNNING.
//
// ⭑ WHAT MUST HOLD. For a MODEL step, the selector is asked after the step's discharge is known and before the
// dispatch batch: on a refusal the action fails with the guidance, NOTHING is dispatched and the executor is never
// opened, so the work unit stays as it was. A TRANSFORMATION step runs no reviewer and is never refused.
//
// ⛔ HERMETIC. The refused arrangement names devin with no model, PATH finds no program, and the executor seam is
// spied rather than replaced — so the fixture executor is what would run, and nothing real can.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return { ...actual, getExecutionSession: vi.fn(actual.getExecutionSession) };
});

// ⭑ THE PREFLIGHT'S MODE, SWITCHABLE ALONE. `isTestMode()` answers a constant read at load (`workbench.ts`), so the
// server-mode limb below switches only what `beginExecute` hands the preflight. Nothing else moves with it: the fixture
// executor keys on its own load-time constant (`execution/model.ts`), and the reset and the id sequence on theirs.
vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return { ...actual, isTestMode: vi.fn(actual.isTestMode) };
});

import {
	getObject,
	listPwus,
	listPwuTypes,
	SEED_PWA,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, getEngine, isTestMode, mintUiId, resetEngine } from '../workbench.js';
import { getExecutionSession } from './model.js';

type ActionEvent = Parameters<typeof actions.beginExecute>[0];

const event = (action: string, fields: Readonly<Record<string, string>>): ActionEvent => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	return {
		request: new Request(`http://localhost/undertakings/${SEED_UNDERTAKING}?/${action}`, {
			method: 'POST',
			body: form
		}),
		params: { id: SEED_UNDERTAKING }
	} as unknown as ActionEvent;
};

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

/**
 * A work unit whose type SAYS a model does its work, with an armed prompt — the e2e's own arrangement, driven through
 * the same commands and the same Undertaking action: a PWA authored and published, then instantiated, so the work
 * unit belongs to the Undertaking bound to its type's PWA (`RPH-CON-009`).
 */
async function modelWorkUnit(): Promise<string> {
	const pwaId = mintUiId('pwa');
	const typeId = mintUiId('pwut');
	const steps: readonly [string, string, string, Record<string, unknown>][] = [
		[
			'CreatePwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{
				pwaId,
				name: 'Executable Operations PWA',
				description: 'A PWA whose root type is discharged by a model.',
				domain: 'logistics',
				version: '0.1.0'
			}
		],
		[
			'DefinePwuType',
			'PWU_TYPE',
			typeId,
			{
				pwuTypeId: typeId,
				pwaId,
				pwuKind: 'ROUTE_ASSESSMENT',
				name: 'Route Assessment',
				purpose: 'Assess the route',
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [],
				workDischarge: 'MODEL',
				promptTemplate: {
					templateText: 'Assess {subject}.',
					templateVersion: 1,
					declaredPlaceholders: ['subject'],
					status: 'ACTIVE'
				}
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
		event('create', { name: 'Execution Demo', pwaId, ...RISK }) as never
	)) as { created?: string; data?: { error?: string } };
	expect(
		created.created,
		`arrangement: the Undertaking — ${created.data?.error ?? ''}`
	).toBeDefined();
	const unit = listPwus(getEngine(), created.created!).find((p) => p.state.pwuTypeId === typeId);
	expect(unit, 'arrangement: the MODEL work unit was not instantiated').toBeDefined();
	return unit!.id;
}

/** A work unit of `pwuTypeId` in the seeded Undertaking, proposed through the page's own action. */
async function proposePwu(pwuTypeId: string, title: string): Promise<string> {
	const r = (await actions.proposePwu(event('proposePwu', { pwuTypeId, title, ...RISK }))) as {
		proposed?: string;
		data?: { error?: string };
	};
	expect(
		r.proposed,
		`arrangement: the work unit was not proposed — ${r.data?.error ?? ''}`
	).toBeDefined();
	return r.proposed!;
}

const eventCount = () => getEngine().readAllEvents().length;

beforeEach(() => {
	resetEngine('reference');
	vi.mocked(getExecutionSession).mockClear();
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of [
		'JPWB_ASSURANCE_TOOL',
		'JPWB_ASSURANCE_MODEL',
		'JPWB_JUDGE_MODEL',
		'JPWB_EXECUTOR'
	])
		vi.stubEnv(v, undefined);
	// ⭑ THE REFUSED CONFIGURATION, unless a case says otherwise: the selected tool named, its model not — `REG-F-457`
	// G3's own arrangement.
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
});
afterEach(() => {
	vi.unstubAllEnvs();
	// Back to the real answer — a `vi.fn(impl)` resets to `impl`.
	vi.mocked(isTestMode).mockReset();
});

describe('⭐ D5 — beginExecute asks the reviewer selector before it dispatches a MODEL step', () => {
	const REFUSED: readonly { readonly tool: string; readonly names: string }[] = [
		{ tool: 'devin', names: "'devin' has no model: JPWB_ASSURANCE_MODEL is not set" },
		{
			tool: 'pi',
			names: "The reviewing tool 'pi' (JPWB_ASSURANCE_TOOL) declares the ASSURANCE role"
		}
	];
	for (const c of REFUSED)
		it(`⛔ a refused reviewer (${c.tool}) refuses the model step: the guidance is returned, nothing is dispatched, the executor is never opened`, async () => {
			vi.stubEnv('JPWB_ASSURANCE_TOOL', c.tool);
			const pwuId = await modelWorkUnit();
			const before = eventCount();

			const result = (await actions.beginExecute(event('beginExecute', { pwuId }))) as {
				status?: number;
				data?: { error?: string };
			};

			expect(
				result.data?.error ?? '',
				'the step was not refused with the reviewer guidance'
			).toContain(c.names);
			expect(result.data?.error).toContain('REG-D-084');
			expect(result.status).toBe(400);
			expect(eventCount(), 'a refused step dispatched something').toBe(before);
			expect(
				vi.mocked(getExecutionSession),
				'the executor was opened for a refused step'
			).not.toHaveBeenCalled();
			expect(getObject(getEngine(), pwuId)?.workLifecycleState).toBe('PROPOSED');
		});

	it('⛔ OUTSIDE TEST MODE an unset tool refuses the model step — the preflight is asked in the mode the host runs in', async () => {
		// ⛔ THE MUTANT: hand the preflight `testMode: true` whatever the host's mode. In test mode it is the same call,
		// so only a server-mode answer tells the two apart: there an unset tool is a refusal, never the stand-in (D2).
		vi.stubEnv('JPWB_ASSURANCE_TOOL', undefined);
		const pwuId = await modelWorkUnit();
		const before = eventCount();
		vi.mocked(isTestMode).mockReturnValue(false);

		const result = (await actions.beginExecute(event('beginExecute', { pwuId }))) as {
			status?: number;
			data?: { error?: string };
		};

		expect(
			result.data?.error ?? '',
			'the server-mode step was not refused for its unset tool'
		).toContain('JPWB_ASSURANCE_TOOL is not set');
		expect(result.data?.error).toContain('REG-D-084');
		expect(result.status).toBe(400);
		expect(eventCount(), 'a refused step dispatched something').toBe(before);
		expect(
			vi.mocked(getExecutionSession),
			'the executor was opened for a refused step'
		).not.toHaveBeenCalled();
		expect(getObject(getEngine(), pwuId)?.workLifecycleState).toBe('PROPOSED');
	});

	it('⭑ CONTROL — a TRANSFORMATION step runs no reviewer and is never refused, under the same configuration', async () => {
		const architecture = listPwuTypes(getEngine(), SEED_PWA).find(
			(t) => t.state.name === 'Architecture Definition'
		);
		expect(architecture, 'arrangement: the seeded TRANSFORMATION type').toBeDefined();
		const pwuId = await proposePwu(architecture!.id, 'Arch Work');

		const result = (await actions.beginExecute(event('beginExecute', { pwuId }))) as {
			data?: { error?: string };
		};

		expect(result.data?.error, 'a TRANSFORMATION step was refused').toBeUndefined();
		expect(getObject(getEngine(), pwuId)?.executionState).toBe('SUCCEEDED');
		expect(vi.mocked(getExecutionSession)).not.toHaveBeenCalled();
	});
});
