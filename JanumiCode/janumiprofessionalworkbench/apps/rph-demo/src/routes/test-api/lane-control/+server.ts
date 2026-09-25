// TEST-MODE ONLY endpoint — THE LANE CONTROL's three calls (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md`
// §4.8; `REG-D-072` D8). The check itself is the server's, and so is what it keeps; a spec only says when.
//
// POST `{ announce: '<test>' }` — the harness's automatic fixture names the test now running, at its setup;
// POST `{ check: '<test>' }`    — after the test: check the open segment, keep what is found, and answer what THIS test
//                                 is the first to see (its per-test attribution);
// POST `{ final: true }`        — from `globalTeardown`: close the last segment and answer EVERYTHING kept, across
//                                 every reset and retry of the run. The teardown fails the run if it is not empty.
//
// ⛔ GATED ON `isTestMode()`, NOT `harnessExposed()`, like `/test-api/reviewer-script`: the live-execution lane exposes the
// harness and runs a REAL reviewer, whose passes are exactly what this control would refuse. ⭑ The live AUTHORING lane
// is test mode, and no config of it calls here: its `globalTeardown` is the gallery's alone.
import { error, json } from '@sveltejs/kit';
import { getEngine, isTestMode } from '$lib/server/workbench';
import { announceLaneTest, laneControlReport } from '$lib/server/lane-control';
import { checkLaneNow, closeLaneNow } from '$lib/server/lane-control-host';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!isTestMode()) throw error(404, 'Not found');
	const body = (await request.json().catch(() => ({}))) as {
		announce?: unknown;
		check?: unknown;
		final?: unknown;
	};
	// ⭑ The boot mark is taken when the engine first opens; asking for it here makes sure it exists before a test is named.
	getEngine();
	if (typeof body.announce === 'string' && body.announce !== '') {
		announceLaneTest(body.announce);
		return json({ announced: body.announce });
	}
	if (typeof body.check === 'string' && body.check !== '')
		return json({ violations: checkLaneNow(body.check) });
	if (body.final === true) {
		closeLaneNow('final');
		return json(laneControlReport());
	}
	throw error(
		422,
		'the lane control answers `{ announce: <test> }`, `{ check: <test> }` or `{ final: true }`'
	);
};
