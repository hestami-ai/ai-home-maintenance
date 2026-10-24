// TEST-MODE ONLY endpoint — a spec declares that it STIPULATES a clean remainder for one PWA and one arm
// (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md` §4.5; `REG-D-071`).
//
// POST `{ pwaId, framing: 'PWA_GRAPH' | 'WORK_PRODUCT' | 'DECLARED_POLICY' | 'PWA_TYPE', remaining: 'CLEAN' }` (⭐ E2: `DECLARED_POLICY`
// stipulates each declared policy's criteria for the declared stand-in, `declared-policy-review.ts`; ⭐ the review in parts, B2:
// `PWA_TYPE` is accepted, and answers nothing until the authoring floor hands the stand-in a part). The declared stand-in reviewer then
// answers every criterion the structural checker could not judge on that arm with a CLEAN answer recorded as NOT
// JUDGED (`UNABLE_TO_DETERMINE` + `stipulated: 'MET'`). A test that registers nothing gets the review it gets today:
// INCONCLUSIVE.
//
// ⛔ GATED ON `isTestMode()`, NOT `harnessExposed()` — so it answers 404 on the durable live-execution server, which
// exposes the harness but is not test mode. (`REG-D-072` D7: the design's second limb, "refuses a durable store",
// had no path to red — test mode is in-memory by construction — and the Engine already refuses an admitting engine
// over a durable store.)
//
// ⭑ It answers on the live AUTHORING lane, which is test mode; none of that lane's specs registers anything, and
// the sequencing pin (`verif/reviewer-qualification-sequencing.test.ts`) watches `e2e-live/` for the first one that does.
import { error, json } from '@sveltejs/kit';
import { getEngine, isTestMode } from '$lib/server/workbench';
import { registerStipulation, StipulationRefused } from '$lib/server/stipulations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!isTestMode()) throw error(404, 'Not found');
	const body = (await request.json().catch(() => ({}))) as unknown;
	try {
		return json({ registered: registerStipulation(getEngine(), body) });
	} catch (e) {
		if (e instanceof StipulationRefused) throw error(422, e.message);
		throw e;
	}
};
