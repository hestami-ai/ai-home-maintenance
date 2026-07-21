// Calibration harness (JAN-PRPWA-DS-001 SPEC-5 / D-5 / PB-2) — the "calibrate-peel-diff" scorer that grades an
// author-from-intent PWU-Type graph against the PROJECTED oracle for a domain. "Projected" means platform-peeled:
// JPWB platform substrate (the event ledger / Governed Stream, memory/Historian, loop control / Loop Detector, the
// deterministic backpressure gate, the tri-agent sandbox, the universal assurance floor) is STRIPPED, because a
// conformant author authors the WORK, not the platform (D-3). Therefore a platform OMISSION is a PASS, never a
// coverage gap (INV-3) — this scorer only flags platform substrate that was WRONGLY authored as a PWU Type, and a
// MISSING required work area as a real gap. Pure + browser-safe; reusable against a live-agent run for manual
// calibration as well as the committed deterministic fixtures (calibration.test.ts).
import type { PwaGraphNode } from './pwa-graph.js';
import { leafKind } from './leaf.js';

export interface ProjectedOracle {
	/** The authored work-area kinds a conformant author-from-intent run SHALL produce (domain content). */
	readonly requiredWorkAreaKinds: readonly string[];
	/** pwuKinds expected to be legitimate leaves (STD-1) — e.g. the ASPLE AFU (~200 LOC). */
	readonly expectedLeafKinds: readonly string[];
	/** Platform substrate that SHALL NOT appear as a PWU Type (D-3/INV-3). Absence is a pass; presence is a leak. */
	readonly forbiddenPlatformKinds: readonly string[];
}

/**
 * The PROJECTED ASPLE oracle (Fixture A target). Content authored (the 6 ASPLE phases + the AFU leaf + the CACA
 * constructive-critique REVIEW — an authored review PWU, distinct from the CACA verifier INFRASTRUCTURE, which is
 * platform); platform peeled (Governed Stream / Historian / Loop Detector / Backpressure Gate / Sandbox Engine /
 * Model Diversity Matrix). This is a TEST FIXTURE — not a governed R-12 domain template — and needs no activation.
 */
export const PROJECTED_APLE_ORACLE: ProjectedOracle = {
	requiredWorkAreaKinds: [
		'INTENT_JTBD',
		'UCD_EXPERIENCE',
		'SYSTEMS_VMODEL',
		'AGILE_FDD',
		'INTEGRATION_VV',
		'RELEASE_OPERATIONS',
		'CACA_REVIEW'
	],
	expectedLeafKinds: ['AFU'],
	forbiddenPlatformKinds: [
		'GOVERNED_STREAM',
		'HISTORIAN',
		'LOOP_DETECTOR',
		'BACKPRESSURE_GATE',
		'SANDBOX_ENGINE',
		'MODEL_DIVERSITY_MATRIX'
	]
};

export interface CalibrationScore {
	/** Required work-area kinds the authored graph is MISSING — real coverage gaps. */
	readonly missingWorkAreas: string[];
	/** Platform-substrate kinds WRONGLY authored as PWU Types — INV-3 violations. */
	readonly platformLeaks: string[];
	/** Type ids whose pwuKind is an expected-leaf kind but which are NOT legitimate leaves (STD-1). */
	readonly nonLeafExpectedLeaves: string[];
	/** True iff there are no gaps. A platform OMISSION never counts against conformance (INV-3). */
	readonly conformant: boolean;
}

/**
 * Score an authored PWU-Type graph against a projected oracle. Only PRESENT platform substrate is flagged (an
 * omission is correct, INV-3); a missing required work area is a real gap; an expected-leaf type that decomposed is
 * a leaf-KIND mismatch (via the shared leafKind classifier — no re-derivation, F-13).
 */
export function scoreAgainstOracle(
	nodes: readonly PwaGraphNode[],
	oracle: ProjectedOracle = PROJECTED_APLE_ORACLE
): CalibrationScore {
	const kinds = new Set(nodes.map((n) => n.pwuKind));
	const missingWorkAreas = oracle.requiredWorkAreaKinds.filter((k) => !kinds.has(k));
	const platformLeaks = oracle.forbiddenPlatformKinds.filter((k) => kinds.has(k));
	const expectedLeaf = new Set(oracle.expectedLeafKinds);
	const nonLeafExpectedLeaves = nodes
		.filter((n) => expectedLeaf.has(n.pwuKind) && leafKind(n) === 'NON_LEAF')
		.map((n) => n.id);
	return {
		missingWorkAreas,
		platformLeaks,
		nonLeafExpectedLeaves,
		conformant:
			missingWorkAreas.length === 0 &&
			platformLeaks.length === 0 &&
			nonLeafExpectedLeaves.length === 0
	};
}
