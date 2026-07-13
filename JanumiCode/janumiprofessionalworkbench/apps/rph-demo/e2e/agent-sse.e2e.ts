import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// A2 — the authoring agent loop over the SSE relay, driven by the DETERMINISTIC mock agent (RPH_DEMO_MODE=test
// forces 'mock', so the gate never hits the network). Proves the whole server path: POST an instruction ->
// createAuthoringAgent -> the agent calls the broker's tools -> real DefinePwuType commands commit -> normalized
// events stream back as SSE. The engine's ground truth confirms the graph the agent built. A JSON "plan" makes the
// run precise and reproducible; this is the exact contract the Pi agent maps onto live.
test.describe('PWA Designer — authoring agent (mock) over SSE', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('an agent instruction builds the PWU Type graph and streams tool events', async ({
		page,
		request
	}) => {
		// Create a DRAFT PWA to author.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Agent PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await expect(page.getByRole('link', { name: /Agent PWA/ })).toBeVisible();

		const before = await introspect(request);
		expect(before.pwas).toHaveLength(1);
		const pwaId = before.pwas[0]!.id;

		// Drive the agent with a precise plan: root from template + a child + wire the permits edge.
		const plan = {
			plan: [
				{ tool: 'get_pwa' },
				{
					tool: 'define_from_template',
					args: { templateKey: 'product-realization', isRoot: true }
				},
				{ tool: 'define_from_template', args: { templateKey: 'architecture' } },
				{ tool: 'list_pwu_types' }
			]
		};
		const res = await request.post(`/pwa/${pwaId}/agent`, {
			data: { instruction: JSON.stringify(plan) }
		});
		expect(res.ok(), 'agent SSE endpoint responds').toBeTruthy();
		expect(res.headers()['content-type']).toContain('text/event-stream');

		// The stream carries normalized events: successful tool calls and a terminal done.
		const body = await res.text();
		expect(body).toContain('"kind":"tool_start"');
		expect(body).toContain('"kind":"tool_end"');
		expect(body).toContain('"ok":true');
		expect(body).toContain('"kind":"done"');

		// TRUTH: the engine actually recorded the two PWU Types the agent proposed (not just streamed text).
		const after = introspectNames(await introspect(request));
		expect(after).toContain('Product Realization');
		expect(after).toContain('Architecture Definition');
	});

	test('the agent refuses to author a non-DRAFT PWA (governance: published is immutable)', async ({
		page,
		request
	}) => {
		// Author + publish a PWA so it is no longer DRAFT.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Locked PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Locked PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Root');
		await page.locator('input[name="pwuKind"]').fill('ROOT');
		await page.getByLabel(/Root type/i).check();
		await page.getByRole('button', { name: 'Add type' }).click();
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		const snap = await introspect(request);
		const pwaId = snap.pwas[0]!.id;
		expect(snap.pwas[0]!.state.publicationStatus).toBe('PUBLISHED');

		const res = await request.post(`/pwa/${pwaId}/agent`, {
			data: {
				instruction: JSON.stringify({
					plan: [{ tool: 'define_pwu_type', args: { name: 'X', pwuKind: 'X' } }]
				})
			}
		});
		const body = await res.text();
		expect(body).toContain('"kind":"error"');
		expect(body).toMatch(/not DRAFT|immutable/i);

		// TRUTH: still exactly the one pre-publish root — the agent changed nothing.
		const after = await introspect(request);
		expect(after.pwuTypes.filter((t) => t.state.status !== 'REMOVED')).toHaveLength(1);
	});
});

function introspectNames(snap: { pwuTypes: { state: Record<string, unknown> }[] }): string[] {
	return snap.pwuTypes.map((t) => String(t.state.name));
}
