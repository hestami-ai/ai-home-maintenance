import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
	acceptAgentCandidate,
	resetEngine,
	introspect,
	gotoHydrated,
	type ObjectRow
} from './support/harness';

// The de minimis assurance floor (guide §8.4), driven by the DETERMINISTIC mock Reasoning-Review Validator
// (RPH_DEMO_MODE=test forces the offline mock — no network). Proves the whole rebuilt loop over the real stack:
// an authoring turn RUNS the floor inside its isolated candidate. A satisfied exact candidate can be accepted and
// atomically records the floor with the graph; a rejected candidate remains preview-only and is safely discarded.
test.describe('Assurance floor (mock) — staged binding and guarded admission', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	async function createDraft(
		page: Page,
		request: APIRequestContext,
		name: string
	): Promise<string> {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill(name);
		await page.getByRole('button', { name: 'Create draft' }).click();
		await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
		return (await introspect(request)).pwas[0]!.id;
	}

	async function scaffold(
		request: APIRequestContext,
		pwaId: string,
		types: Record<string, unknown>[]
	): Promise<string> {
		const res = await request.post(`/pwa/${pwaId}/agent`, {
			data: { instruction: JSON.stringify({ plan: [{ tool: 'scaffold_graph', args: { types } }] }) }
		});
		expect(res.ok(), 'agent SSE endpoint responds').toBeTruthy();
		return await res.text();
	}

	const floorFor = (snap: { assessments: ObjectRow[] }, pwaId: string) =>
		new Map(
			snap.assessments
				.filter(
					(a) =>
						(a.state.subjectObjectIds as string[] | undefined)?.includes(pwaId) &&
						String(a.state.assurancePolicyId).startsWith('floor.')
				)
				.map((a) => [String(a.state.assurancePolicyId), String(a.state.assessmentState)])
		);

	test('a clean graph yields a SATISFIED floor, recorded canonically, and publishes', async ({
		page,
		request
	}) => {
		const pwaId = await createDraft(page, request, 'Floor Happy');
		const body = await scaffold(request, pwaId, [
			{
				tempKey: 'root',
				name: 'Product Realization',
				pwuKind: 'PRODUCT_REALIZATION',
				isRoot: true,
				childTempKeys: ['arch']
			},
			{ tempKey: 'arch', name: 'Architecture Definition', pwuKind: 'ARCHITECTURE' }
		]);
		expect(body).toContain('Assurance floor SATISFIED');
		expect((await introspect(request)).assessments).toEqual([]);
		await acceptAgentCandidate(request, pwaId, body);

		// TRUTH after exact acceptance: three floor assessments commit with the graph, all SATISFIED.
		const floor = floorFor(await introspect(request), pwaId);
		expect(floor.get('floor.schema-invariant')).toBe('SATISFIED');
		expect(floor.get('floor.identity-provenance')).toBe('SATISFIED');
		expect(floor.get('floor.reasoning-review')).toBe('SATISFIED');

		// The panel renders the disposition read back from the canonical objects.
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).toContainText('SATISFIED');

		// A SATISFIED floor lets PublishPwa through the gate.
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();
		await expect
			.poll(async () => (await introspect(request)).pwas[0]!.state.publicationStatus)
			.toBe('PUBLISHED');
	});

	test('a rejected dead-end candidate never mutates canonical state and can be discarded', async ({
		page,
		request
	}) => {
		const pwaId = await createDraft(page, request, 'Floor Blocked');
		const body = await scaffold(request, pwaId, [
			{
				tempKey: 'root',
				name: 'Product Realization',
				pwuKind: 'PRODUCT_REALIZATION',
				isRoot: true,
				childTempKeys: ['arch']
			},
			{
				tempKey: 'arch',
				name: 'Architecture Definition',
				pwuKind: 'ARCHITECTURE',
				requiredOutputs: ['architecture-baseline']
			}
		]);
		// The dead-end output fails the mandatory RR-04 criterion → the reasoning review is REJECTED, so publish blocks.
		expect(body).toContain('Assurance floor REJECTED');
		expect(body).toContain('PublishPwa remains blocked');

		// All graph/floor/transcript Commands are still isolated; canonical truth has none of them.
		const canonical = await introspect(request);
		expect(canonical.pwuTypes).toEqual([]);
		expect(canonical.assessments).toEqual([]);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('REVISION_REQUIRED');
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.getByRole('button', { name: 'Accept exact candidate' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Discard candidate' }).click();
		await expect(page.getByTestId('authoring-candidate-banner')).toBeHidden();
		expect((await introspect(request)).pwuTypes).toEqual([]);
		expect((await introspect(request)).assessments).toEqual([]);
	});
});
