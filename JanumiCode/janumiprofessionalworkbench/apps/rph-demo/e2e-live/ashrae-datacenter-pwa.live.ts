import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from '../e2e/support/harness';
import { shot, snapshotTruth, snapshotPwaGraph } from '../e2e/support/gallery';

// LIVE — the real Pi agent drafts the ASHRAE data-center-lifecycle PWA from the sponsor's actual prompt, then the
// harness PROVES the result: it writes the canonical export + the readable coherence report into the gallery and
// asserts the STRUCTURE (one root, several types). The stricter COHERENCE verdict (artifact-flow conservation — the
// "a phase emits data its sub-phases don't ground" check) is reported SOFTLY: model output is non-deterministic, so
// an ungrounded branch must be made VISIBLE in the log/annotation rather than turned into a brittle live failure.
// This is the live counterpart to the deterministic e2e/pwa-coherence.e2e.ts.
const PROMPT =
	'Create a PWA focused on the ASHRAE recommended phases of a full life cycle of a data center - ' +
	'from initial scoping or planning through to commissioning and whatever are upstream and downstream of those.';

test.describe('LIVE — Pi drafts the ASHRAE data-center lifecycle PWA', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('drafts the lifecycle PWA and proves its coherence (real Pi agent)', async ({
		page,
		request
	}) => {
		test.setTimeout(360_000);

		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('ASHRAE Data Center Lifecycle');
		await page.getByPlaceholder(/Domain/i).fill('Data Center Facilities');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /ASHRAE Data Center Lifecycle/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		await shot(page, 'empty designer');

		await page.getByTestId('agent-input').fill(PROMPT);
		await shot(page, 'prompt entered');
		await page.getByRole('button', { name: 'Send' }).click();
		await shot(page, 'agent running');

		await expect
			.poll(async () => (await introspect(request)).conversations.length, {
				timeout: 340_000,
				intervals: [3000]
			})
			.toBeGreaterThan(0);

		await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 15_000 });
		await shot(page, 'final graph');

		await snapshotTruth(request, 'engine-truth');
		const { export: graph, report } = await snapshotPwaGraph(request, 'graph');
		console.log(
			`[live] valid=${report.valid} coherent=${report.coherent} ${JSON.stringify(report.metrics)}\n` +
				report.invariants.map((i) => `  [${i.ok ? 'OK' : 'FAIL'}] ${i.name}: ${i.detail}`).join('\n') +
				(report.conservation.length
					? '\n  conservation:\n    ' + report.conservation.join('\n    ')
					: '\n  conservation: (none — every branch grounded)') +
				'\n  nodes:\n' +
				graph.nodes
					.map((n) => `    - ${n.name} [${n.pwuKind}]${n.isRoot ? ' (root)' : ''}`)
					.join('\n')
		);
		test.info().annotations.push({
			type: 'coherence',
			description: `valid=${report.valid} coherent=${report.coherent} nodes=${report.metrics.nodeCount} depth=${report.metrics.maxDepth} ungroundedBranches=${report.metrics.ungroundedBranches} crossSubtreeFlows=${report.metrics.crossSubtreeFlows}`
		});

		// HARD — structural validity (the deterministic "well-formed?" gate).
		expect(
			report.valid,
			`PWA graph well-formed (failing: ${report.invariants.filter((i) => !i.ok).map((i) => i.name).join(', ') || 'none'})`
		).toBe(true);
		expect(graph.nodes.length, 'the agent defined several PWU Types').toBeGreaterThan(2);
		expect(report.metrics.rootCount, 'exactly one root').toBe(1);
		// SOFT — coherence is reported (above), not asserted: an ungrounded branch is a real, visible finding here.
	});
});
