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
	/**
	 * Legitimate NON-leaf container kinds that are in-model but are neither an authored work area, an expected leaf,
	 * nor platform — e.g. the domain ROOT ('PRODUCT_REALIZATION') under which the work areas hang. Without this an
	 * author-from-intent root would be mis-classified out-of-model. Optional; defaults to none.
	 */
	readonly structuralKinds?: readonly string[];
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
	],
	// The Product-Realization root container — in-model, but neither a work area, a leaf, nor platform.
	structuralKinds: ['PRODUCT_REALIZATION']
};

export interface CalibrationScore {
	/** Required work-area kinds the authored graph is MISSING — real coverage gaps. */
	readonly missingWorkAreas: string[];
	/** Platform-substrate kinds WRONGLY authored as PWU Types — INV-3 violations. */
	readonly platformLeaks: string[];
	/** Type ids whose pwuKind is an expected-leaf kind but which are NOT legitimate leaves (STD-1). */
	readonly nonLeafExpectedLeaves: string[];
	/**
	 * Present pwuKinds classified in NONE of the oracle buckets (required / expected-leaf / forbidden-platform /
	 * structural) — the import-and-project "OUT-OF-MODEL" bucket (Fixture C / PB-4). For author-from-intent these
	 * should be empty; for an IMPORTED foreign decomposition they are the elements that fit no JPWB model slot and
	 * must be reconciled as an untrusted DRAFT (C-5), never accepted as gospel. Previously such kinds were silently
	 * dropped, so a foreign element read as "no finding".
	 */
	readonly outOfModelKinds: string[];
	/** True iff there are no gaps. A platform OMISSION never counts against conformance (INV-3). */
	readonly conformant: boolean;
}

/**
 * Score an authored (or imported-and-projected) PWU-Type graph against a projected oracle. Only PRESENT platform
 * substrate is flagged (an omission is correct, INV-3); a missing required work area is a real gap; an expected-leaf
 * type that decomposed is a leaf-KIND mismatch (via the shared leafKind classifier — no re-derivation, F-13); and a
 * kind matching no oracle bucket is OUT-OF-MODEL (the third import-and-project classification, PB-4). Structural
 * container kinds (e.g. the domain root) are declared in-model via `oracle.structuralKinds` and never counted.
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
	// A kind is IN-MODEL iff it is a required work area, an expected leaf, a (correctly-flagged-elsewhere) platform
	// kind, or a declared structural container. Anything else present is out-of-model.
	const inModel = new Set<string>([
		...oracle.requiredWorkAreaKinds,
		...oracle.expectedLeafKinds,
		...oracle.forbiddenPlatformKinds,
		...(oracle.structuralKinds ?? [])
	]);
	const outOfModelKinds = [...kinds].filter((k) => !inModel.has(k)).sort((a, b) => a.localeCompare(b));
	return {
		missingWorkAreas,
		platformLeaks,
		nonLeafExpectedLeaves,
		outOfModelKinds,
		conformant:
			missingWorkAreas.length === 0 &&
			platformLeaks.length === 0 &&
			nonLeafExpectedLeaves.length === 0 &&
			outOfModelKinds.length === 0
	};
}
