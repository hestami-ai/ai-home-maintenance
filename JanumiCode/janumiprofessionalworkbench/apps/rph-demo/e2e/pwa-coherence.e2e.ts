import { test, expect } from '@playwright/test';
import { resetEngine, gotoHydrated } from './support/harness';
import { snapshotPwaGraph } from './support/gallery';

// The DEBUGGING HARNESS, deterministic path. It reproduces — via the mock agent + a recorded scaffold_graph plan —
// the exact pathology the sponsor observed authoring the ASHRAE data-center-lifecycle PWA: a level-2 "phase" branch
// that EMITS a data-flow artifact ("owners-project-requirements") which none of its level-3 sub-phases produce or
// feed. Such a graph is STRUCTURALLY well-formed (single root, acyclic, connected) so it commits today — yet it is
// not COHERENT. This test proves the analyzer's conservation layer now catches that: report.valid stays true (the
// gate is unchanged) while report.coherent is false, with the ungrounded branch named. The readable coherence
// report (<label>.report.md) is written into the gallery for a human/agent to read.
test.describe('PWA coherence — artifact-flow conservation (ASHRAE-shaped)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	async function openDraft(page: import('@playwright/test').Page, name: string) {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill(name);
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: new RegExp(name) });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
	}

	test('a structurally-valid graph with an ungrounded phase branch is caught as NOT coherent', async ({
		page,
		request
	}) => {
		await openDraft(page, 'ASHRAE Lifecycle Coherence');
		await page.getByTestId('agent-input').fill(
			JSON.stringify({
				plan: [
					{
						tool: 'scaffold_graph',
						args: {
							types: [
								{
									tempKey: 'root',
									name: 'Data Center Full Lifecycle',
									pwuKind: 'DATA_CENTER_LIFECYCLE',
									isRoot: true,
									childTempKeys: ['planning', 'design']
								},
								// The ungrounded phase: it emits owners-project-requirements, but its sub-phases produce
								// business-case / site-feasibility and it consumes neither — nothing in its subtree grounds
								// the output. (Those sub-phase outputs ARE consumed downstream by design's detailed leaf,
								// so nothing is a dead-end and the graph still commits — isolating the conservation gap.)
								{
									tempKey: 'planning',
									name: 'Planning, Feasibility & Owner Requirements',
									pwuKind: 'PLANNING_AND_REQUIREMENTS',
									childTempKeys: ['strategic', 'opr'],
									requiredOutputs: ['owners-project-requirements']
								},
								{
									tempKey: 'strategic',
									name: 'Strategic Need & Investment Case',
									pwuKind: 'STRATEGIC_PLANNING',
									requiredOutputs: ['business-case']
								},
								{
									tempKey: 'opr',
									name: 'Site, Climate & Resource Feasibility',
									pwuKind: 'SITE_FEASIBILITY',
									requiredOutputs: ['site-feasibility']
								},
								// The design phase consumes the owner requirements; it declares no outputs, so it is not
								// grounding-checked (only planning carries the conservation gap).
								{
									tempKey: 'design',
									name: 'Integrated Design & Delivery',
									pwuKind: 'DESIGN_AND_DELIVERY',
									childTempKeys: ['detailed'],
									requiredInputs: ['owners-project-requirements']
								},
								// The terminal leaf consumes every upstream artifact and produces none (no dead-ends).
								{
									tempKey: 'detailed',
									name: 'Basis of Design & Detailed Design',
									pwuKind: 'INTEGRATED_DESIGN',
									requiredInputs: [
										'owners-project-requirements',
										'business-case',
										'site-feasibility'
									]
								}
							]
						}
					}
				]
			})
		);
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('READY_TO_COMMIT');
		await page.getByRole('button', { name: 'Accept exact candidate' }).click();

		const { report } = await snapshotPwaGraph(request, 'ashrae-coherence');

		// Structural validity is unaffected — the graph is well-formed and DID commit (the gate keys on `valid`).
		expect(report.valid, JSON.stringify(report.invariants)).toBe(true);

		// ...but the conservation layer catches the ungrounded phase branch: NOT coherent.
		expect(report.coherent).toBe(false);
		expect(report.metrics.ungroundedBranches).toBe(1);
		expect(
			report.conservation.some((c) => /ungrounded branch: "Planning, Feasibility & Owner Requirements"/.test(c)),
			JSON.stringify(report.conservation)
		).toBe(true);
		// The owners-project-requirements hand-off crosses from the planning subtree to the design subtree.
		expect(report.metrics.crossSubtreeFlows).toBeGreaterThan(0);
	});
});
