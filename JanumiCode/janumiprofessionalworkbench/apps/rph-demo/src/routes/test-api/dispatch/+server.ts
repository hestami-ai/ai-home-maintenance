// TEST-MODE ONLY endpoint — the E2E harness POSTs a command sequence here to STAGE engine state a spec needs (e.g.
// an ACTIVE Execution Plan with a QUEUED step, which the reference seed drives all the way to SUCCEEDED and so never
// leaves actionable). It dispatches through the SAME command bus the UI uses — no back door around the invariants.
//
// ⭐ 404s unless the process DECLARES the harness (`RPH_DEMO_MODE=test` or `JPWB_HARNESS=1`) — `JAN-EXEC` `R24`.
//
// ⛔ AND IT REFUSES A DURABLE STORE, WHICH `R24` DID NOT DO AND AN ADVERSARIAL REVIEW CAUGHT. The design's rule is
// *"read affordances compose with durability; destructive ones do not"*, and it classified `introspect` (read) and
// `reset` (destructive) and left THIS ONE — which is neither — unclassified: a write channel into the permanent,
// append-only record, moved into a newly reachable durable configuration with no guard, no test and no
// disclosure while its sibling in the same enumerated set got all four. It is a WRITE, so the rule applies.
//
// ⚠ THE GATED SUITE IS UNAFFECTED: it runs under `RPH_DEMO_MODE=test`, where `DB_PATH` is undefined by
// construction, so this refusal cannot fire for it. What it forecloses is a live lane SHORTCUTTING the surface —
// which is the one thing such a lane exists not to do.
import { error, json } from '@sveltejs/kit';
import { dispatch, harnessExposed, durableStateRefusal } from '$lib/server/workbench';
import type { RequestHandler } from './$types';

type Step = [commandType: string, aggType: string, aggId: string, payload: unknown];

export const POST: RequestHandler = async ({ request }) => {
	if (!harnessExposed()) throw error(404, 'Not found');
	const refusal = durableStateRefusal();
	if (refusal !== undefined) throw error(409, refusal);
	const body = (await request.json().catch(() => ({}))) as { steps?: Step[] };
	const steps = Array.isArray(body.steps) ? body.steps : [];
	// ⛔ A TEST CANNOT HAND-WRITE A STIPULATION PAST THE STAND-IN (`REG-D-071` Q5; `JAN-CRITREAD` J1-1d). In an engine
	// built for tests, `stipulated: 'MET'` beside an `UNABLE_TO_DETERMINE` row counts as met, so the only lawful
	// writer on the lane is the declared stand-in. ⚠ THE WHOLE REQUEST, BEFORE ANYTHING RUNS: this route dispatches
	// step by step with no transaction around the batch, so refusing one step would still land the steps around it
	// — a stipulated row refused, then a Complete admitted.
	const stipulating = steps.findIndex((step) => {
		const payload = Array.isArray(step) ? step[3] : undefined;
		return typeof payload === 'object' && payload !== null && 'stipulated' in payload;
	});
	if (stipulating >= 0)
		throw error(
			422,
			`/test-api/dispatch refused the whole request: step ${stipulating} (${String(steps[stipulating]?.[0])}) carries \`stipulated\`, which only the test-mode stand-in may write (REG-D-071 Q5). Nothing was dispatched.`
		);
	const results = steps.map(([ct, agg, id, pl]) => {
		const r = dispatch(ct, agg, id, pl);
		return { commandType: ct, status: r.status, code: r.error?.code, message: r.error?.message };
	});
	const hasFailure = results.some((r) => r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE');
	return json({ ok: !hasFailure, results });
};
