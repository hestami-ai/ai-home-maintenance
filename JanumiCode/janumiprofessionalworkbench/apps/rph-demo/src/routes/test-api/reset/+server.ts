// TEST-MODE ONLY endpoint — the E2E harness POSTs here to reset the engine to a known state between specs, so each
// spec runs isolated. Body: { "seed": "reference" | "empty" } (defaults to "reference"). 404s unless
// RPH_DEMO_MODE=test, so it does not exist in a normal / production boot.
import { error, json } from '@sveltejs/kit';
import { resetEngine, isTestMode } from '$lib/server/workbench';
import { clearAuthoringTurns } from '$lib/server/authoring-turn';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!isTestMode()) throw error(404, 'Not found');
	const body = (await request.json().catch(() => ({}))) as { seed?: string };
	// Derived from the union rather than a chain of ternaries, so a new mode reaches the endpoint by existing and
	// an unknown value still falls back to the safe default instead of silently seeding nothing.
	const MODES = ['reference', 'empty', 'bare'] as const;
	const seed = MODES.find((m) => m === body.seed) ?? 'reference';
	clearAuthoringTurns();
	resetEngine(seed);
	return json({ ok: true, seed });
};
