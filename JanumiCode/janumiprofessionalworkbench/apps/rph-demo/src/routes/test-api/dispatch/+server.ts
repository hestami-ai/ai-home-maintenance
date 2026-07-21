// TEST-MODE ONLY endpoint — the E2E harness POSTs a command sequence here to STAGE engine state a spec needs (e.g.
// an ACTIVE Execution Plan with a QUEUED step, which the reference seed drives all the way to SUCCEEDED and so never
// leaves actionable). It dispatches through the SAME command bus the UI uses — no back door around the invariants.
// 404s unless RPH_DEMO_MODE=test, so it does not exist in a normal / production boot.
import { error, json } from '@sveltejs/kit';
import { dispatch, isTestMode } from '$lib/server/workbench';
import type { RequestHandler } from './$types';

type Step = [commandType: string, aggType: string, aggId: string, payload: unknown];

export const POST: RequestHandler = async ({ request }) => {
	if (!isTestMode()) throw error(404, 'Not found');
	const body = (await request.json().catch(() => ({}))) as { steps?: Step[] };
	const steps = Array.isArray(body.steps) ? body.steps : [];
	const results = steps.map(([ct, agg, id, pl]) => {
		const r = dispatch(ct, agg, id, pl);
		return { commandType: ct, status: r.status, code: r.error?.code, message: r.error?.message };
	});
	const firstFailure = results.find((r) => r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE');
	return json({ ok: !firstFailure, results });
};
