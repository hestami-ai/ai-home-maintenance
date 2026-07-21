import { describe, expect, it } from 'vitest';
import { analyzePwaGraph, buildPwaGraphExport, type PwaGraphNode } from './pwa-graph.js';
import { leafKind } from './leaf.js';
import { PROJECTED_APLE_ORACLE, scoreAgainstOracle } from './calibration.js';

// JAN-PRPWA-DS-001 SPEC-5 / PB-2 (DWP-07): the calibrate-peel-diff harness. Fixture A grades an author-from-intent
// ASPLE graph against the PROJECTED oracle (platform peeled, INV-3); Fixture B exercises delegation across three
// boundary placements (STD-1-D / STD-2 / STD-3). Deterministic (the CI regression path); the SAME scorer is
// pointable at a live-agent authoring run for manual calibration (the live path is the EP-TST-8 evaluation set).

const META = {
	id: 'pwa_cal',
	name: 'Calibration',
	domain: 'software',
	version: '0.1.0',
	publicationStatus: 'DRAFT'
};

function gnode(
	id: string,
	pwuKind: string,
	isRoot: boolean,
	children: string[] = []
): PwaGraphNode {
	return {
		id,
		name: id,
		pwuKind,
		isRoot,
		permittedChildTypeIds: children,
		requiredInputs: [],
		requiredOutputs: []
	};
}

const delegated = (id: string, pwuKind: string): PwaGraphNode => ({
	...gnode(id, pwuKind, false),
	executionBoundary: 'DELEGATED_EXTERNAL'
});

const byId = (nodes: PwaGraphNode[], id: string) => nodes.find((n) => n.id === id)!;
const report = (nodes: PwaGraphNode[]) => analyzePwaGraph(buildPwaGraphExport(META, nodes));

describe('Fixture A — author-from-intent (projected ASPLE), scored vs the projected oracle', () => {
	// A conformant author-from-intent output: the 6 ASPLE phases + the CACA constructive-critique review + an AFU
	// leaf under the V-Model phase. NO platform substrate — the Governed Stream, Historian, Loop Detector, sandbox,
	// backpressure gate, and model-diversity matrix are JPWB platform and are correctly OMITTED (D-3 / INV-3).
	const conformantAple = (): PwaGraphNode[] => [
		gnode('root', 'PRODUCT_REALIZATION', true, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'caca']),
		gnode('p1', 'INTENT_JTBD', false),
		gnode('p2', 'UCD_EXPERIENCE', false),
		gnode('p3', 'SYSTEMS_VMODEL', false, ['afu']),
		gnode('afu', 'AFU', false),
		gnode('p4', 'AGILE_FDD', false),
		gnode('p5', 'INTEGRATION_VV', false),
		gnode('p6', 'RELEASE_OPERATIONS', false),
		gnode('caca', 'CACA_REVIEW', false)
	];

	it('a conformant projected-ASPLE authoring scores clean (no gaps, no platform leaks); the AFU is a leaf', () => {
		const nodes = conformantAple();
		const score = scoreAgainstOracle(nodes);
		expect(score.conformant, JSON.stringify(score)).toBe(true);
		expect(score.missingWorkAreas).toEqual([]);
		expect(score.platformLeaks).toEqual([]);
		expect(leafKind(byId(nodes, 'afu'))).toBe('IRREDUCIBLE');
	});

	it('INV-3: OMITTING platform substrate is a PASS — the peeled platform is never a coverage gap', () => {
		// The conformant graph contains none of the forbidden platform kinds, yet scores fully conformant.
		const score = scoreAgainstOracle(conformantAple());
		expect(PROJECTED_APLE_ORACLE.forbiddenPlatformKinds.length).toBeGreaterThan(0);
		expect(score.platformLeaks).toEqual([]);
		expect(score.conformant).toBe(true);
	});

	it('INV-3: AUTHORING platform substrate as a PWU Type is flagged (platform ≠ content discrimination)', () => {
		const withLeak = [...conformantAple(), gnode('gs', 'GOVERNED_STREAM', false)];
		const score = scoreAgainstOracle(withLeak);
		expect(score.platformLeaks).toContain('GOVERNED_STREAM');
		expect(score.conformant).toBe(false);
	});

	it('flags a MISSING required work area as a real coverage gap', () => {
		const missingVv = conformantAple().filter((n) => n.pwuKind !== 'INTEGRATION_VV');
		const score = scoreAgainstOracle(missingVv);
		expect(score.missingWorkAreas).toContain('INTEGRATION_VV');
		expect(score.conformant).toBe(false);
	});

	it('flags an expected-leaf kind (AFU) that was wrongly decomposed', () => {
		const nodes = conformantAple();
		// Give the AFU a child — it is no longer a legitimate leaf.
		const mutated = nodes.map((n) =>
			n.id === 'afu' ? { ...n, permittedChildTypeIds: ['sub'] } : n
		);
		mutated.push(gnode('sub', 'SUB', false));
		expect(scoreAgainstOracle(mutated).nonLeafExpectedLeaves).toContain('afu');
	});
});

describe('Fixture B — bloodwork trio (delegation across three boundary placements)', () => {
	// The healthcare "get bloodwork" example: ONE macro job, three different accountability boundaries. The leaf
	// KIND of "analysis" turns entirely on where the organizational boundary falls — the calibration this whole wave
	// exists to get right (STD-1-D / STD-2 / STD-3 / R-10).

	it('small office: it draws the sample but DELEGATES analysis to an external lab (a delegated leaf)', () => {
		const nodes = [
			gnode('root', 'GET_BLOODWORK', true, ['draw', 'analyze']),
			gnode('draw', 'SAMPLE_DRAW', false),
			delegated('analyze', 'LAB_ANALYSIS')
		];
		expect(leafKind(byId(nodes, 'draw'))).toBe('IRREDUCIBLE');
		expect(leafKind(byId(nodes, 'analyze'))).toBe('DELEGATED');
		const r = report(nodes);
		expect(r.metrics.delegatedLeaves).toBe(1);
		// INV-2: the delegated analysis' assurance is the counterparty attestation, never our Reasoning Review.
		expect(r.delegatedAssurance[0]!.nodeId).toBe('analyze');
		expect(r.delegatedAssurance[0]!.reasoningReview).toBe('SUBSTITUTED_BY_ATTESTATION');
		expect(r.valid).toBe(true); // the boundary never changes structural validity
	});

	it('large integrated hospital: it runs its OWN lab, so analysis is INTERNAL and decomposes (a non-leaf)', () => {
		const nodes = [
			gnode('root', 'GET_BLOODWORK', true, ['draw', 'analyze']),
			gnode('draw', 'SAMPLE_DRAW', false),
			gnode('analyze', 'LAB_ANALYSIS', false, ['assay', 'qc']),
			gnode('assay', 'ASSAY_RUN', false),
			gnode('qc', 'QUALITY_CONTROL', false)
		];
		expect(leafKind(byId(nodes, 'analyze'))).toBe('NON_LEAF');
		expect(leafKind(byId(nodes, 'assay'))).toBe('IRREDUCIBLE');
		expect(report(nodes).metrics.delegatedLeaves).toBe(0);
	});

	it('referral clinic: it neither draws nor analyzes — the WHOLE job is referred out (one delegated leaf)', () => {
		const nodes = [
			gnode('root', 'GET_BLOODWORK', true, ['referral']),
			delegated('referral', 'EXTERNAL_REFERRAL')
		];
		expect(leafKind(byId(nodes, 'referral'))).toBe('DELEGATED');
		const r = report(nodes);
		expect(r.metrics.delegatedLeaves).toBe(1);
		expect(r.delegatedAssurance[0]!.reasoningReview).toBe('SUBSTITUTED_BY_ATTESTATION');
	});
});

describe('Fixture C — import-and-project (PB-4/R-8): platform-satisfied / author-as-PWU / out-of-model', () => {
	// Enterprise robustness: a foreign decomposition imported from another tool is PROJECTED onto the JPWB model, and
	// the SAME projected scorer (Fixture A) is the reconciliation lens. Each foreign element lands in exactly one
	// bucket — a platform kind wrongly carried in (OMIT it, INV-3), a MISSING required work area (AUTHOR it), or an
	// OUT-OF-MODEL kind that fits no slot and must be reconciled as an untrusted DRAFT (C-5), never gospel. Only the
	// calibration limb is built here; the full import PLAYBOOK/UI stays deferred (R-8/PB-4, §11). This fixture also
	// pins the closed gap: an unknown kind used to be silently dropped, so a foreign element read as "no finding".

	// A clean import: the ASPLE structure with platform correctly peeled — projects conformant, nothing out-of-model.
	const cleanImport = (): PwaGraphNode[] => [
		gnode('root', 'PRODUCT_REALIZATION', true, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'caca']),
		gnode('p1', 'INTENT_JTBD', false),
		gnode('p2', 'UCD_EXPERIENCE', false),
		gnode('p3', 'SYSTEMS_VMODEL', false, ['afu']),
		gnode('afu', 'AFU', false),
		gnode('p4', 'AGILE_FDD', false),
		gnode('p5', 'INTEGRATION_VV', false),
		gnode('p6', 'RELEASE_OPERATIONS', false),
		gnode('caca', 'CACA_REVIEW', false)
	];

	it('a clean import projects conformant — the structural root is in-model, nothing is out-of-model', () => {
		const score = scoreAgainstOracle(cleanImport());
		expect(score.conformant, JSON.stringify(score)).toBe(true);
		expect(score.outOfModelKinds).toEqual([]);
	});

	it('classifies a mixed foreign import into all three buckets at once (platform / missing / out-of-model)', () => {
		const imported = cleanImport()
			// author-as-PWU: the import is MISSING a required work area.
			.filter((n) => n.pwuKind !== 'INTEGRATION_VV')
			.concat([
				// platform-satisfied but wrongly carried in as a node → platform leak (omit on projection).
				gnode('gs', 'GOVERNED_STREAM', false),
				// out-of-model: a foreign tool artifact that fits no JPWB slot → reconcile as untrusted DRAFT.
				gnode('gantt', 'GANTT_SCHEDULE', false)
			]);
		const score = scoreAgainstOracle(imported);
		expect(score.platformLeaks).toContain('GOVERNED_STREAM'); // omit
		expect(score.missingWorkAreas).toContain('INTEGRATION_VV'); // author
		expect(score.outOfModelKinds).toContain('GANTT_SCHEDULE'); // reconcile
		// The platform kind is NOT also counted out-of-model — each element lands in exactly one bucket.
		expect(score.outOfModelKinds).not.toContain('GOVERNED_STREAM');
		expect(score.conformant).toBe(false);
	});

	it('an out-of-model foreign kind is FLAGGED, not silently dropped (the pre-fix gap)', () => {
		const score = scoreAgainstOracle(cleanImport().concat([gnode('foreign', 'LEGACY_WORK_ITEM', false)]));
		// Before the out-of-model arm, an unknown kind produced no missing/leak/non-leaf finding, so the graph read as
		// fully conformant — a foreign element passing as "no finding". Now it is surfaced for reconciliation.
		expect(score.outOfModelKinds).toEqual(['LEGACY_WORK_ITEM']);
		expect(score.conformant).toBe(false);
	});
});
