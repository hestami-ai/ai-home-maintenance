import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from '../e2e/support/harness';
import { shot, snapshotTruth, snapshotPwaGraph } from '../e2e/support/gallery';

// LIVE — the FULL virtuous cycle with BOTH real models. The Pi/Codex agent (EXECUTOR) drafts a PWA from the sponsor's
// prompt; the in-product loop then has the agy/Gemini judge (ASSUROR — a DIFFERENT vendor, exec != assurance) score its
// faithfulness; a non-faithful verdict AUTO-REFINES (Pi re-runs against the gaps) and a still-unfaithful result
// ESCALATES to the human-in-the-loop. Non-deterministic + network + long (up to two Pi turns + two agy calls), so the
// assertions are lenient and the value is in the captured artifacts + the assessment history logged for review.
const PROMPT =
	'Draft a software engineering SDLC PWA that leverages aspects from V-model systems engineering approach, User-Centered Design and Jobs To Be Done methodologies.';

type Row = { state: Record<string, unknown> };
/** A TERMINAL assessment ends the loop: escalated to the human, or recorded-and-faithful. */
function terminal(rows: Row[]): Row | undefined {
	return rows.find(
		(a) =>
			a.state.status === 'ESCALATED' ||
			(a.state.status === 'RECORDED' && a.state.verdict === 'FAITHFUL')
	);
}

test.describe('LIVE — full assess/refine/escalate loop (Pi executor + agy judge)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('Pi drafts, agy judges, Pi refines, then it resolves or escalates', async ({
		page,
		request
	}) => {
		test.setTimeout(1_200_000);

		// Create + open a DRAFT PWA.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('SDLC faithfulness');
		await page.getByPlaceholder(/Domain/i).fill('Software Engineering');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /SDLC faithfulness/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
		await shot(page, 'empty designer');

		// Send the sponsor's prompt to the live agent — this starts the whole loop over one long SSE turn.
		await page.getByTestId('agent-input').fill(PROMPT);
		await page.getByRole('button', { name: 'Send' }).click();
		await shot(page, 'agent running');

		// Done-signal: the route persists the conversation in its `finally`, i.e. AFTER the whole loop (build + assess +
		// optional refine + re-assess + escalate) has run, however it ended. So a recorded conversation reliably marks
		// the end of the full SSE turn. The window is generous — up to two real Pi turns plus two agy judgements.
		await expect
			.poll(async () => (await introspect(request)).conversations.length, {
				timeout: 1_080_000,
				intervals: [5000]
			})
			.toBeGreaterThan(0);

		// Capture ground truth (incl. the assessments) + the canonical graph report for review.
		const snap = await snapshotTruth(request, 'engine-truth');
		const { report } = await snapshotPwaGraph(request, 'graph');
		const assessments = snap.authoringAssessments.map((a) => a.state);
		expect(
			assessments.length,
			'the loop recorded at least one faithfulness assessment'
		).toBeGreaterThanOrEqual(1);
		const last = assessments[assessments.length - 1];
		const reachedTerminal = Boolean(terminal(snap.authoringAssessments));
		console.log(
			`[live-loop] ${assessments.length} assessment(s); reachedTerminal=${reachedTerminal}; FINAL verdict=${last.verdict} status=${last.status} ` +
				`overall=${last.overallScore}% assessor=${JSON.stringify(last.assessor)} valid=${report.valid} nodes=${report.metrics.nodeCount}\n` +
				assessments
					.map(
						(a, i) =>
							`  #${i + 1} iter=${a.iteration} ${a.verdict} ${a.overallScore}% [${a.status}]` +
							(Array.isArray(a.gaps) && a.gaps.length
								? `\n       gaps: ${(a.gaps as string[]).join(' | ')}`
								: '')
					)
					.join('\n')
		);
		test.info().annotations.push({
			type: 'loop',
			description: `${assessments.length} pass(es); final ${last.verdict} ${last.overallScore}% [${last.status}]`
		});
		await shot(page, 'final — assurance panel');

		// The assessment was produced by the REAL agy (Gemini) judge — a DIFFERENT vendor than the Pi/Codex executor.
		expect(
			String((last.assessor as { providerId?: string })?.providerId ?? ''),
			'assessor vendor is agy/Gemini (separation of duties)'
		).toBe('google');
		expect(['FAITHFUL', 'PARTIAL', 'POOR']).toContain(String(last.verdict));
		// The in-product assurance surface is live.
		await expect(page.getByTestId('assurance-chip')).toBeVisible();
		// The executor built a real graph.
		expect(report.metrics.nodeCount, 'the agent defined several PWU Types').toBeGreaterThan(2);
	});
});
