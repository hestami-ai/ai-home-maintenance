import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from '../e2e/support/harness';
import { shot, snapshotTruth, snapshotPwaGraph } from '../e2e/support/gallery';

// LIVE — the real Pi agent drafts a PWA from the sponsor's actual prompt. This is the realistic end-to-end run: it
// captures reviewable screenshots + the engine ground truth into the gallery, and asserts the STRUCTURE the agent
// produced (the composition-hierarchy steering: exactly one root, several types, and no flat "star" fan-out). Model
// output is non-deterministic, so structural expectations are lenient; the fan-out check is SOFT (reported, not a
// hard fail) so a regression is visible without making the live run brittle.
const PROMPT =
	'Draft a software engineering SDLC PWA that leverages aspects from V-model systems engineering approach, User-Centered Design and Jobs To Be Done methodologies.';

test.describe('LIVE — Pi drafts an SDLC PWA from an NL prompt', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('drafts a hierarchical SDLC PWA (real Pi agent)', async ({ page, request }) => {
		test.setTimeout(360_000);

		// Create + open a DRAFT PWA.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('ProdReal SDLC');
		await page.getByPlaceholder(/Domain/i).fill('Software Engineering');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /ProdReal SDLC/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		await shot(page, 'empty designer');

		// Enter the sponsor's prompt and send it to the live agent.
		await page.getByTestId('agent-input').fill(PROMPT);
		await shot(page, 'prompt entered');
		await page.getByRole('button', { name: 'Send' }).click();
		await shot(page, 'agent running');

		// The run persists its conversation on completion, so a recorded conversation is the reliable done-signal.
		await expect
			.poll(async () => (await introspect(request)).conversations.length, {
				timeout: 340_000,
				intervals: [3000]
			})
			.toBeGreaterThan(0);

		await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 15_000 });
		await shot(page, 'final graph');

		// Ground truth for review + the canonical graph export + structural report — the harness validates AGAINST the
		// report (queryable invariants), not the screenshot.
		const snap = await snapshotTruth(request, 'engine-truth');
		const { export: graph, report } = await snapshotPwaGraph(request, 'graph');
		console.log(
			`[live] valid=${report.valid} ${JSON.stringify(report.metrics)}\n` +
				report.invariants
					.map((i) => `  [${i.ok ? 'OK' : 'FAIL'}] ${i.name}: ${i.detail}`)
					.join('\n') +
				(report.findings.length ? '\n  findings:\n    ' + report.findings.join('\n    ') : '') +
				'\n  nodes:\n' +
				graph.nodes
					.map((n) => `    - ${n.name} [${n.pwuKind}]${n.isRoot ? ' (root)' : ''}`)
					.join('\n')
		);
		test.info().annotations.push({
			type: 'graph',
			description: `valid=${report.valid} nodes=${report.metrics.nodeCount} depth=${report.metrics.maxDepth} maxFanout=${report.metrics.maxFanout}`
		});

		// STRUCTURAL VALIDITY — the deterministic gate on "did the agent generate a well-formed PWA?".
		expect(
			report.valid,
			`PWA graph well-formed (failing invariants: ${
				report.invariants
					.filter((i) => !i.ok)
					.map((i) => i.name)
					.join(', ') || 'none'
			})`
		).toBe(true);
		expect(graph.nodes.length, 'the agent defined several PWU Types').toBeGreaterThan(2);
		expect(report.metrics.rootCount, 'exactly one root').toBe(1);
		expect(snap.conversations.length, 'the conversation is event-sourced').toBe(1);
	});
});
