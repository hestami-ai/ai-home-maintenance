// ⭐ THE LANE CONTROL, WIRED TO THIS HOST (`JAN-CRITREAD` J1-3; `REG-D-072` D8) — the canonical engine, every staged
// authoring candidate and the stipulation registry, handed to the pure check in `lane-control.ts`.
//
// ⚠ A SEPARATE MODULE FOR ONE REASON: `workbench.ts` takes the marks, so `lane-control.ts` must not import it — and
// the sources need both the workbench and the authoring turns.
import { listPwas } from '@janumipwb/rph-engine';
import { getEngine } from './workbench.js';
import { getPendingAuthoringTurn } from './authoring-turn.js';
import { registeredStipulations } from './stipulations.js';
import {
	checkLaneAfterTest,
	closeLaneSegment,
	laneSources,
	type LaneViolation
} from './lane-control.js';

/** The open segment's sources, read NOW: canonical after the mark, and every candidate still staged. */
function sourcesNow() {
	const canonical = getEngine();
	const candidates = listPwas(canonical).flatMap((pwa) => {
		const turn = getPendingAuthoringTurn(pwa.id);
		return turn ? [{ pwaId: pwa.id, engine: turn.engine }] : [];
	});
	return laneSources(canonical, candidates);
}

/** The fixture's after-test check: what THIS test is the first to see. */
export function checkLaneNow(test: string): LaneViolation[] {
	return checkLaneAfterTest(sourcesNow(), registeredStipulations(), test);
}

/**
 * ⛔ CLOSE THE OPEN SEGMENT — called by `/test-api/reset` BEFORE it discards a single candidate or the registry, and
 * by the final call. What it finds is KEPT.
 */
export function closeLaneNow(closedBy: 'reset' | 'final'): LaneViolation[] {
	return closeLaneSegment(sourcesNow(), registeredStipulations(), closedBy);
}
