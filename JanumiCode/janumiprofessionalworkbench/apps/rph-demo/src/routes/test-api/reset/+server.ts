// HARNESS-ONLY endpoint — the E2E harness POSTs here to reset the engine to a known state between specs, so each
// spec runs isolated. Body: { "seed": "reference" | "empty" } (defaults to "reference").
//
// ⭐ 404s unless the process DECLARES the harness (`RPH_DEMO_MODE=test` or `JPWB_HARNESS=1`) — `JAN-EXEC` `R24`.
// The older claim here, *"404s unless RPH_DEMO_MODE=test, so it does not exist in a normal / production boot"*,
// stopped being true when the harness question gained its own declaration, and a doc line that states the
// wrong predicate is how the next reader reasons about a guard that is not there.
//
// ⛔ AND IT REFUSES A DURABLE STORE BEFORE IT TOUCHES ANYTHING. `clearAuthoringTurns()` below is destructive and
// irreversible — it closes every in-flight authoring turn and nothing records that the work existed — so asking
// the question after it would be a refusal that had already destroyed what it was refusing to risk.
import { error, json } from '@sveltejs/kit';
import { resetEngine, harnessExposed, durableStateRefusal, isTestMode } from '$lib/server/workbench';
import { clearAuthoringTurns } from '$lib/server/authoring-turn';
import { closeLaneNow } from '$lib/server/lane-control-host';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!harnessExposed()) throw error(404, 'Not found');
	// ⭐ BEFORE ANYTHING MUTATES, AND AS AN HTTP REFUSAL THE CALLER CAN READ. `resetEngine`'s own throw is a bare
	// `Error`, which SvelteKit renders as a 500 `{"message":"Internal Error"}` — so the reasoning written for the
	// operator never reached them. 409 CONFLICT, because the request is well-formed and the PROCESS's state is
	// what makes it impossible.
	const refusal = durableStateRefusal();
	if (refusal !== undefined) throw error(409, refusal);
	const body = (await request.json().catch(() => ({}))) as { seed?: string };
	// Derived from the union rather than a chain of ternaries, so a new mode reaches the endpoint by existing and
	// an unknown value still falls back to the safe default instead of silently seeding nothing.
	const MODES = ['reference', 'empty', 'bare'] as const;
	const seed = MODES.find((m) => m === body.seed) ?? 'reference';
	// ⭐ THE LANE CONTROL CLOSES THE SEGMENT FIRST (`JAN-CRITREAD` J1-3; `REG-D-072` D8) — before a single staged
	// candidate is discarded and before the registry dies with the engine, so a floor that completed after its test's
	// own check is still read, and kept. Test mode only: the live-execution lane exposes the harness, runs a REAL
	// reviewer, and is not this lane.
	if (isTestMode()) closeLaneNow('reset');
	clearAuthoringTurns();
	resetEngine(seed);
	return json({ ok: true, seed });
};
