// ⭐⭐ THE LANE CONTROL'S LAST WORD (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md` §4.8; `REG-D-072` D8).
//
// The server checks every segment of the event log between reset marks — at each reset, and here, once, for the last
// one — and KEEPS what it finds. This teardown asks for all of it and FAILS THE RUN if anything was kept.
//
// ⛔ WHY THE RUN AND NOT ONLY THE TEST. `retries: 1` (`playwright.config.ts`) turns a test that fails once and passes on
// retry into exit 0, so a violation charged only to the test that produced it would vanish with the retry. And a floor
// can complete after its test's own check has run; only the next reset, or this call, reads it. A per-test fixture
// alone could see neither. ⭑ Measured by hand (J1-3): a scratch spec that forges a pass on its first attempt only
// reports `1 flaky` either way — and exits 1 with this teardown, 0 with its verdict disabled.
//
// ⚠ THE DEFAULT LANE ONLY. The live lanes use `global-teardown.ts` alone: the live-execution lane runs a REAL reviewer
// (not test mode, so the route is 404 there), and the live authoring lane registers no stipulation.
import { request, type FullConfig } from '@playwright/test';

/** One violation the server kept, as `/test-api/lane-control` answers it. */
export interface KeptViolation {
	readonly limb: number;
	readonly where: string;
	readonly assessmentId: string;
	readonly segment: number;
	readonly attributedTo: readonly string[];
	readonly seenAt: string;
	readonly reason: string;
}

/**
 * ⭐ THE RUN'S VERDICT from the server's final report: the message to fail the run with, or `undefined` for a clean
 * lane. EVERY kept violation counts — whichever segment it arose in, and whoever saw it first. Pure, so
 * `verif/lane-control-teardown.test.ts` holds it without a browser.
 */
export function laneRunVerdict(report: {
	readonly marks: readonly unknown[];
	readonly violations: readonly KeptViolation[];
}): string | undefined {
	const { marks, violations } = report;
	if (violations.length === 0) return undefined;
	return (
		`LANE CONTROL (JAN-CRITREAD J1-3; DESIGN-what-the-tests-prove.md §4.8): ${violations.length} reasoning-review ` +
		`pass(es) the lane may not rest on, kept across ${marks.length} segment(s) — the run fails whatever the ` +
		`tests reported:\n` +
		violations
			.map(
				(v) =>
					`  · limb ${v.limb} · segment ${v.segment} · ${v.where} · ${v.assessmentId} (seen at ${v.seenAt}; ` +
					`${v.attributedTo.join(' | ') || 'no test announced'}): ${v.reason}`
			)
			.join('\n')
	);
}

export default async function laneControlTeardown(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0]?.use.baseURL;
	if (!baseURL)
		throw new Error(
			'LANE CONTROL: no baseURL is configured, so the final check cannot be asked for.'
		);
	const ctx = await request.newContext({ baseURL });
	try {
		// ⛔ FAIL CLOSED: a final call that cannot be made is not a clean lane.
		const res = await ctx.post('/test-api/lane-control', { data: { final: true } });
		if (!res.ok())
			throw new Error(
				`LANE CONTROL: the final check answered ${res.status()}: ${await res.text()}`
			);
		const report = (await res.json()) as {
			marks: unknown[];
			violations: KeptViolation[];
		};
		const verdict = laneRunVerdict(report);
		if (verdict !== undefined) throw new Error(verdict);
		console.log(`\n[lane control] ${report.marks.length} segment(s) checked; nothing kept.\n`);
	} finally {
		await ctx.dispose();
	}
}
