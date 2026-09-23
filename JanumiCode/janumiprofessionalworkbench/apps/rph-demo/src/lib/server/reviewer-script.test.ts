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
	return { wb, registry, post, seededPwa };
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
