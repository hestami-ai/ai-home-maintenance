// ⭐ `/test-api/reviewer-script` AND THE REGISTRY BEHIND IT (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md`
// §4.5; `REG-D-072` D6, D7).
//
// A spec declares, per PWA and per arm, that it stipulates the remainder CLEAN. Each property of that declaration is
// a test here: it is test-mode only; it answers one PWA the engine actually holds, on one arm; it never survives a
// reset (ids restart at every reset, so a surviving registration would answer a LATER test's PWA); and the
// work-product arm finds its PWA through the chain artifact → work unit → undertaking, failing closed on any
// missing link.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

async function load(mode: string, harness = '') {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', mode);
	vi.stubEnv('JPWB_HARNESS', harness);
	vi.stubEnv('JPWB_DEMO_DB', '');
	// ⭑ A BARE BOOT and one PWA created here: the reference workbench costs seconds to seed, and under a loaded
	// package run that alone tripped the 5 s default.
	vi.stubEnv('JPWB_SEED', 'bare');
	const wb = await import('./workbench.js');
	const registry = await import('./stipulations.js');
	const route = await import('../../routes/test-api/reviewer-script/+server.js');
	const post = (body: unknown) =>
		route.POST({
			request: new Request('http://localhost/test-api/reviewer-script', { method: 'POST', body: JSON.stringify(body) })
		} as never);
	/** A PWA the current engine holds — created here, then read back from the store rather than assumed. */
	const seededPwa = () => {
		const pwaId = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5R00';
		if (wb.getEngine().loadObject(pwaId) === undefined)
			expect(
				wb
					.getEngine()
					.as(SESSION_CREDENTIAL)
					.dispatch({
						commandId: 'setup-pwa',
						commandType: 'CreatePwa',
						commandSchemaVersion: 1,
						targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
						targetAggregateId: pwaId,
						issuedAt: '2026-09-23T09:00:00Z',
						correlationId: 'setup',
						idempotencyKey: `setup-pwa-${Math.random()}`,
						payload: { pwaId, name: 'Registered', description: 'A DRAFT PWA.', domain: 'software', version: '1.0.0' }
					}).status,
				'arrangement: the PWA exists'
			).toBe('ACCEPTED');
		expect(wb.getEngine().loadObject(pwaId)?.objectType).toBe('PROFESSIONAL_WORK_ARCHITECTURE');
		return pwaId;
	};
	/** ⭐ B6 — a PWA of its own with two types, or one more type of a PWA: a part a registration may name. */
	const seededType = (pwaId: string, typeId: string) => {
		if (wb.getEngine().loadObject(pwaId) === undefined)
			expect(
				wb.getEngine().as(SESSION_CREDENTIAL).dispatch({
					commandId: `setup-${pwaId}`,
					commandType: 'CreatePwa',
					commandSchemaVersion: 1,
					targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
					targetAggregateId: pwaId,
					issuedAt: '2026-09-23T09:00:00Z',
					correlationId: 'setup',
					idempotencyKey: `setup-pwa-${Math.random()}`,
					payload: { pwaId, name: 'Another', description: 'A DRAFT PWA.', domain: 'software', version: '1.0.0' }
				}).status,
				'arrangement: the PWA exists'
			).toBe('ACCEPTED');
		expect(
			wb.getEngine().as(SESSION_CREDENTIAL).dispatch({
				commandId: `setup-${typeId}`,
				commandType: 'DefinePwuType',
				commandSchemaVersion: 1,
				targetAggregateType: 'PWU_TYPE',
				targetAggregateId: typeId,
				issuedAt: '2026-09-23T09:00:00Z',
				correlationId: 'setup',
				idempotencyKey: `setup-type-${Math.random()}`,
				payload: {
					pwuTypeId: typeId,
					pwaId,
					pwuKind: 'PLAN',
					name: typeId,
					purpose: 'a part',
					isRoot: false,
					permittedChildTypeIds: [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: []
				}
			}).status,
			`arrangement: the type ${typeId} exists`
		).toBe('ACCEPTED');
		return typeId;
	};
	return { wb, registry, post, seededPwa, seededType };
}

describe('⭐ /test-api/reviewer-script registers a stipulation — in test mode, for a PWA that exists, on one arm', () => {
	it('⭐ registers a clean remainder for a seeded PWA and echoes it', async () => {
		const { registry, post, seededPwa } = await load('test');
		const pwaId = seededPwa();
		const res = (await post({ pwaId, framing: 'PWA_GRAPH', remaining: 'CLEAN' })) as Response;
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ registered: { pwaId, framing: 'PWA_GRAPH', remaining: 'CLEAN' } });
		expect(registry.stipulationFor(pwaId, 'PWA_GRAPH')).toBe('CLEAN');
	});

	it('⛔ a registration answers ONLY the arm it names', async () => {
		// THE MUTANT: key the registry by PWA alone — a graph-arm registration would then stipulate the work product too.
		const { registry, post, seededPwa } = await load('test');
		const pwaId = seededPwa();
		await post({ pwaId, framing: 'PWA_GRAPH', remaining: 'CLEAN' });
		expect(registry.stipulationFor(pwaId, 'WORK_PRODUCT')).toBeUndefined();
	});

	it('⭐ the review in parts, B2 (REG-D-125) — the part arm, PWA_TYPE, is accepted, and answers its own arm alone', async () => {
		// THE MUTANT: leave the part arm out of the table the route checks a registration's arm against.
		const { registry, post, seededPwa } = await load('test');
		const pwaId = seededPwa();
		const res = (await Promise.resolve(post({ pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' })).catch((refused: unknown) => refused)) as Response;
		expect(res.status, 'accepted, not refused with a 422').toBe(200);
		expect(await res.json()).toEqual({ registered: { pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' } });
		expect([registry.stipulationFor(pwaId, 'PWA_TYPE'), registry.stipulationFor(pwaId, 'PWA_GRAPH')]).toEqual(['CLEAN', undefined]);
	});

	it('⛔ refuses a PWA the engine does not hold, a process-result arm, and any remainder but CLEAN — each a 422', async () => {
		const { post, seededPwa } = await load('test');
		const pwaId = seededPwa();
		await expect(post({ pwaId: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5ZZZ', framing: 'PWA_GRAPH', remaining: 'CLEAN' })).rejects.toMatchObject({ status: 422 });
		await expect(post({ pwaId, framing: 'PROCESS_RESULT', remaining: 'CLEAN' })).rejects.toMatchObject({ status: 422 });
		await expect(post({ pwaId, framing: 'PWA_GRAPH', remaining: 'FAULT' })).rejects.toMatchObject({ status: 422 });
	});

	it('⛔ answers 404 on a server that exposes the harness but is NOT test mode — the live-execution lane', async () => {
		// PREDICTED RED FIRST: a copy of the existing /test-api routes gates on `harnessExposed()`, which is true here.
		// THE MUTANT: gate on `harnessExposed()`.
		const { post } = await load('server', '1');
		await expect(post({ pwaId: 'pwa_any', framing: 'PWA_GRAPH', remaining: 'CLEAN' })).rejects.toMatchObject({ status: 404 });
	});

	it('⛔ a registration never survives a reset — ids restart, so it would answer a LATER test’s PWA', async () => {
		// THE MUTANT: keep the registry across resets.
		const { wb, registry, post, seededPwa } = await load('test');
		const pwaId = seededPwa();
		await post({ pwaId, framing: 'PWA_GRAPH', remaining: 'CLEAN' });
		wb.resetEngine('bare');
		expect(registry.stipulationFor(pwaId, 'PWA_GRAPH')).toBeUndefined();
		expect(registry.registeredStipulations()).toEqual([]);
	});
});

// ⭐⭐ The review in parts, B6 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D10; roadmap 9a.7) — THE PART ARM'S TWO SCOPES.
// The authoring floor reviews each type of a PWA as a part, and asks about each with its PWA (`floor.ts`). A registration
// for the PWA answers every part of it; one naming a type answers that part alone, and is asked before the PWA's; a named
// type must belong to the named PWA; and a reset discards both.
describe('⭐⭐ B6 — a registration answers a PWA’s parts, or one part, and the part’s is asked first', () => {
	const A = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R0A';
	const B = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R0B';

	it('⭐ RED — a PWA’s registration on the part arm answers each of its parts; a part’s own answers that part alone', async () => {
		// PREDICTED RED BEFORE B6: the lookup took no part, so no registration could name one.
		const { registry, post, seededPwa, seededType } = await load('test');
		const pwaId = seededPwa();
		seededType(pwaId, A);
		seededType(pwaId, B);
		const res = (await post({ pwaId, framing: 'PWA_TYPE', typeId: A, remaining: 'CLEAN' })) as Response;
		expect(await res.json()).toEqual({ registered: { pwaId, framing: 'PWA_TYPE', typeId: A, remaining: 'CLEAN' } });
		expect([registry.stipulationFor(pwaId, 'PWA_TYPE', A), registry.stipulationFor(pwaId, 'PWA_TYPE', B)]).toEqual([
			'CLEAN',
			undefined
		]);
		expect(registry.stipulationFor(pwaId, 'PWA_TYPE'), 'a part’s registration answers for the whole PWA').toBeUndefined();
		await post({ pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		expect([registry.stipulationFor(pwaId, 'PWA_TYPE', A), registry.stipulationFor(pwaId, 'PWA_TYPE', B)]).toEqual([
			'CLEAN',
			'CLEAN'
		]);
	});

	it('⭐ the part’s registration is asked before its PWA’s, and the PWA’s answers the rest — both kept side by side', async () => {
		const { registry, post, seededPwa, seededType } = await load('test');
		const pwaId = seededPwa();
		seededType(pwaId, A);
		seededType(pwaId, B);
		await post({ pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		await post({ pwaId, framing: 'PWA_TYPE', typeId: A, remaining: 'CLEAN' });
		expect(registry.registeredStipulations(), 'one registration replaced the other').toHaveLength(2);
		const all = registry.registeredStipulations();
		expect(registry.registrationFor(all, pwaId, 'PWA_TYPE', A)?.typeId, 'the PWA’s was asked first').toBe(A);
		expect(registry.registrationFor(all, pwaId, 'PWA_TYPE', B)?.typeId, 'B has no registration of its own').toBeUndefined();
		expect(registry.registrationFor(all, pwaId, 'PWA_TYPE', B)).toEqual({ pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		// ⭑ And a part's registration never answers another arm.
		expect(registry.registrationFor(all, pwaId, 'PWA_GRAPH', A)).toBeUndefined();
	});

	it('⛔ a named type must be a type the named PWA holds, on the part arm — each refusal a 422 naming why', async () => {
		const { registry, post, seededPwa, seededType } = await load('test');
		const pwaId = seededPwa();
		seededType(pwaId, A);
		const other = seededType('pwa_01ARZ3NDEKTSV4RRFFQ69G5R01', 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R0C');
		const refused = async (body: unknown) =>
			(await Promise.resolve(post(body)).catch((e: unknown) => e)) as { status?: number; body?: { message?: string } };
		const ofAnother = await refused({ pwaId, framing: 'PWA_TYPE', typeId: other, remaining: 'CLEAN' });
		expect([ofAnother.status, ofAnother.body?.message]).toEqual([
			422,
			`the current engine holds no PWU Type ${other} of PWA ${pwaId}: a part's registration names a type of the PWA it names`
		]);
		const unknown = await refused({ pwaId, framing: 'PWA_TYPE', typeId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZZZ', remaining: 'CLEAN' });
		expect(unknown.status).toBe(422);
		const onTheGraph = await refused({ pwaId, framing: 'PWA_GRAPH', typeId: A, remaining: 'CLEAN' });
		expect([onTheGraph.status, onTheGraph.body?.message]).toEqual([
			422,
			'a stipulation names a type (`typeId`) only on the part arm, PWA_TYPE, not on PWA_GRAPH'
		]);
		const empty = await refused({ pwaId, framing: 'PWA_TYPE', typeId: '', remaining: 'CLEAN' });
		expect(empty.status).toBe(422);
		expect(registry.registeredStipulations(), 'a refused registration was kept').toEqual([]);
		// CONTROL — the type the PWA holds is accepted.
		const ok = (await post({ pwaId, framing: 'PWA_TYPE', typeId: A, remaining: 'CLEAN' })) as Response;
		expect(ok.status).toBe(200);
	});

	it('⛔ a reset discards both scopes', async () => {
		const { wb, registry, post, seededPwa, seededType } = await load('test');
		const pwaId = seededPwa();
		seededType(pwaId, A);
		await post({ pwaId, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		await post({ pwaId, framing: 'PWA_TYPE', typeId: A, remaining: 'CLEAN' });
		expect(registry.registeredStipulations(), 'arrangement: both scopes registered').toHaveLength(2);
		wb.resetEngine('bare');
		expect(registry.registeredStipulations()).toEqual([]);
		expect(registry.stipulationFor(pwaId, 'PWA_TYPE', A)).toBeUndefined();
	});
});

describe('⭐ the work-product arm finds its PWA: artifact → work unit → undertaking → PWA', () => {
	const engineOf = (objects: Record<string, { objectType: string; state: Record<string, unknown> }>) => ({
		loadObject: (id: string) => {
			const o = objects[id];
			return o ? { objectType: o.objectType, revision: 1, semanticVersion: 1, state: o.state } : undefined;
		}
	});
	const CHAIN = {
		art_1: { objectType: 'ARTIFACT', state: { producingPwuId: 'pwu_1' } },
		pwu_1: { objectType: 'PROFESSIONAL_WORK_UNIT', state: { undertakingId: 'und_1' } },
		und_1: { objectType: 'UNDERTAKING', state: { pwaId: 'pwa_1' } }
	};

	it('⭐ follows the chain to the PWA', async () => {
		const { registry } = await load('test');
		expect(registry.workProductPwaOf(engineOf(CHAIN), 'art_1')).toBe('pwa_1');
	});

	it('⛔ any missing link means NO PWA — and never a throw (a throw is VALIDATOR_FAILED, which blocks externally)', async () => {
		const { registry } = await load('test');
		const { pwu_1: _p, ...noUnit } = CHAIN;
		const { und_1: _u, ...noUndertaking } = CHAIN;
		expect(registry.workProductPwaOf(engineOf(noUnit), 'art_1')).toBeUndefined();
		expect(registry.workProductPwaOf(engineOf(noUndertaking), 'art_1')).toBeUndefined();
		expect(
			registry.workProductPwaOf(engineOf({ art_1: { objectType: 'ARTIFACT', state: {} } }), 'art_1'),
			'an artifact with no producing work unit'
		).toBeUndefined();
		expect(registry.workProductPwaOf(engineOf({}), 'art_missing')).toBeUndefined();
	});
});
