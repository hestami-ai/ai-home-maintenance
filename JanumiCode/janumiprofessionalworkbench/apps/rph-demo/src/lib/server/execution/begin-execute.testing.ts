// ⭐ `JAN-SELRES` RS-1 (D4) — THE ARRANGEMENT THE EXECUTOR'S ROUTE TESTS SHARE: a MODEL work unit reached through the
// page's own actions, and a work unit of a type the caller names.
//
// ⭑ RESTATED FROM `begin-execute-reviewer-preflight.test.ts`, whose own copy is left where it is: that file is the
// reviewer's instrument and its ledger victims (`SR1-M17`, `M18`, `M37`) name it. Two executor test files need the same
// arrangement — the refusals in server mode, and the program override, which needs a process of its own — so they share
// this one rather than each restating it.
//
// ⚠ IT IMPORTS THE ROUTE, SO IT MUST BE IMPORTED AFTER THE CALLER'S `vi.mock`s ARE REGISTERED — which vitest's hoisting
// does for every static import of a test file.
import { getObject, listPwus, SEED_UNDERTAKING } from '@janumipwb/rph-engine';
import { expect } from 'vitest';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { dispatch, getEngine, mintUiId } from '../workbench.js';

type ActionEvent = Parameters<typeof actions.beginExecute>[0];

/** The page action's event, as SvelteKit hands it: a form POST to the seeded Undertaking. */
export const actionEvent = (
	action: string,
	fields: Readonly<Record<string, string>>
): ActionEvent => {
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
 * A work unit whose type SAYS a model does its work, with an armed prompt: a PWA authored and published, then
 * instantiated, so the work unit belongs to the Undertaking bound to its type's PWA (`RPH-CON-009`).
 */
export async function modelWorkUnit(): Promise<string> {
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
		actionEvent('create', { name: 'Execution Demo', pwaId, ...RISK }) as never
	)) as { created?: string; data?: { error?: string } };
	expect(
		created.created,
		`arrangement: the Undertaking — ${created.data?.error ?? ''}`
	).toBeDefined();
	const unit = listPwus(getEngine(), created.created!).find((p) => p.state.pwuTypeId === typeId);
	expect(unit, 'arrangement: the MODEL work unit was not instantiated').toBeDefined();
	return unit!.id;
}

/**
 * A work unit of `pwuTypeId` in the seeded Undertaking, proposed through the page's own action.
 *
 * ⚠ THE CALLER NAMES THE TYPE. This module is not a `.test.ts` file, so `scripts/export-guard.ts` counts what it imports
 * as PRODUCTION-consumed: the seeded PWA's id, which only the TRANSFORMATION control needs, is read there instead.
 */
export async function proposeWorkUnit(pwuTypeId: string, title: string): Promise<string> {
	const r = (await actions.proposePwu(
		actionEvent('proposePwu', { pwuTypeId, title, ...RISK })
	)) as {
		proposed?: string;
		data?: { error?: string };
	};
	expect(
		r.proposed,
		`arrangement: the work unit was not proposed — ${r.data?.error ?? ''}`
	).toBeDefined();
	return r.proposed!;
}

/** `beginExecute` on `pwuId`, as the page posts it. */
export async function beginExecute(
	pwuId: string
): Promise<{ readonly status?: number; readonly data?: { readonly error?: string } }> {
	return (await actions.beginExecute(actionEvent('beginExecute', { pwuId }))) as {
		status?: number;
		data?: { error?: string };
	};
}

/** How many events the engine holds — a refused step must leave it unchanged. */
export const eventCount = (): number => getEngine().readAllEvents().length;

/** The work unit's lifecycle state — a refused step must leave it PROPOSED. */
export const lifecycleOf = (pwuId: string): unknown =>
	getObject(getEngine(), pwuId)?.workLifecycleState;
