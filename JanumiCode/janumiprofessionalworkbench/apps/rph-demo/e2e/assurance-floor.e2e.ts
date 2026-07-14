import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, type ObjectRow } from './support/harness';

// The de minimis assurance floor (guide §8.4), driven by the DETERMINISTIC mock Reasoning-Review Validator
// (RPH_DEMO_MODE=test forces the offline mock — no network). Proves the whole rebuilt loop over the real stack:
// an authoring turn RUNS the floor, RECORDS it as canonical ASSURANCE_ASSESSMENT objects, the panel renders the
// disposition, and the PublishPwa gate ENFORCES it — a dead-end graph is CONDITIONALLY_SATISFIED and cannot publish
// until a governance WAIVER is recorded. The mock judges structure: a clean graph → SATISFIED; a produced-but-
// unconsumed output → CONDITIONALLY_SATISFIED (RR-04 proxy-satisfaction / dead-end).
test.describe('Assurance floor (mock) — runs, records, gates, and can be waived', () => {
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

		// TRUTH: three floor assessments recorded for the subject, all SATISFIED.
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

	test('a dead-end output blocks publish until a governance waiver is recorded', async ({
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
		expect(body).toContain('PublishPwa is blocked');

		// TRUTH: schema + provenance pass; the independent reasoning review is REJECTED (a mandatory criterion unmet).
		const floor = floorFor(await introspect(request), pwaId);
		expect(floor.get('floor.schema-invariant')).toBe('SATISFIED');
		expect(floor.get('floor.reasoning-review')).toBe('REJECTED');

		// Drive to VALIDATED, then Publish is BLOCKED by the floor (stays VALIDATED).
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();
		await expect
			.poll(async () => (await introspect(request)).pwas[0]!.state.publicationStatus)
			.toBe('VALIDATED');

		// Record a governance WAIVER (auditable human override) via the panel; it becomes EFFECTIVE.
		await page.getByPlaceholder(/Waiver rationale/i).fill('Accepted residual risk for the pilot.');
		await page.getByRole('button', { name: /Record waiver/i }).click();
		await expect
			.poll(
				async () =>
					(await introspect(request)).decisions.filter(
						(d) => d.state.decisionType === 'WAIVER' && d.state.status === 'EFFECTIVE'
					).length
			)
			.toBe(1);

		// With the waiver in force the gate permits publication.
		await page.getByRole('button', { name: /^Publish$/ }).click();
		await expect
			.poll(async () => (await introspect(request)).pwas[0]!.state.publicationStatus)
			.toBe('PUBLISHED');
	});
});
