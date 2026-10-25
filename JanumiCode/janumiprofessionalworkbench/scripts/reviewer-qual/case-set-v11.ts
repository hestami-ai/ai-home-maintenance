// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b, package K — REVIEWER-QUALIFICATION CASE SET, VERSION ELEVEN (`REG-D-133`;
// DESIGN-authoring-review-in-parts.md D3d and §5, case set v11; ROADMAP-undertaking-execution-sandbox.md §9a.9b, its package K).
//
// VERSION TEN'S 57 NON-BRIDGE CASES AND 12 OF ITS 19 BRIDGE PART CASES, BYTE FOR BYTE AND UNDER THEIR IDS, AND ITS 7 OTHER BRIDGE
// PART CASES UNDER NEW IDS, CUT FROM THEIR SOURCES RESTATED BY D3d: THE OPTIONS STUDY'S PURPOSE STATES ITS COMPARISON CRITERIA.
// Version ten's measurement left one clean rejection, `G10-CLEAN.T03` #2, the options study, REJECTED on RR-01 alone for its
// HUMAN instruction stating no comparison criteria (`k-facts.md`), and the sponsor chose to state the criteria the request makes
// essential in its purpose, as a new case version, before P6 again (`REG-D-133` Q39). D3d restates version ten's bridge sources
// (`BRIDGE_GRAPHS_V10`) by ONE CHANGE (`OPTIONS_STUDY_PURPOSE`): the options study's purpose, version ten's, becomes one that
// judges each form by criteria the comparison states, naming three the request gives — the clearance over the two-track rail
// line, the response to pedestrian-induced vibration and the foundations on the soft clay layer 3 m below ground on the north
// abutment — in each bridge source that holds the options study, and nowhere else.
//   · ⚠ 11 OF THE 13 HOLD ONE, not the 12 the design, the register and the roadmap count ("`G10-RR-05` holds none"):
//     `G10-RR-05`'s plant removes the options study, and `G10-RR-01`'s concept study substitutes four other kinds for the whole
//     structural review — its plant — so neither holds one. Each of the 11 is restated under a new id (`BRIDGE_IDS_V11`, `G11-`).
//   · ⛔ ONLY THE PART CASES WHOSE PROMPTS MOVE TAKE NEW IDS. The purpose reaches the options study's own part and the roots whose
//     children include it: 7 part cases (`MOVED_V11`, as D3d lists them). Each is cut from its source restated, under the
//     source's new id, and named by it as version eight named part cases (`partCaseId`), so `G10-CLEAN.T03` is cut as
//     `G11-CLEAN.T03`. The other 12 bridge part cases send version ten's prompts, so they are version ten's cases, byte for
//     byte, cut from the sources version ten cut them from: their measurements stand (D3d).
// ⛔ THE 35 PART CASES KEEP THEIR ORDER AND THEIR ORACLES: every expected verdict, faulted criterion, catcher and standing is as
// `REG-D-126` conferred it (`REG-D-129`), carried to the 7 new ids (`oracles-v11.ts`). The 7 prompts are new, and owe a RUN; the
// 69 others are version ten's. The reviewer fingerprint is unmoved — the case set is outside its components — and the case
// set's digest moves.
// ⛔ A CASE IS DATA: the purposes and the ids below are literals, and no runtime import reaches a package (`cases.ts`). Generated
// into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { CaseSet, GraphCase, PwaTypeCase, QualificationCase } from './cases.js';
import { partCaseId } from './case-set-v8.js';
import { BRIDGE_GRAPHS_V10, BRIDGE_POLICY_LIBRARY, CASE_SET_V10 } from './case-set-v10.js';

/**
 * ⭐ D3d — THE OPTIONS STUDY'S PURPOSE, version ten's and what it becomes in version eleven, written out as D3d states them
 * (`REG-D-133` Q39: "State the comparison criteria the request makes essential in its purpose"). The three criteria it names
 * are the request's: the two-track rail line the bridge crosses, the pedestrian-induced vibration its load analysis must cover,
 * and the soft clay layer the preliminary site investigation found.
 */
export const OPTIONS_STUDY_PURPOSE: { readonly v10: string; readonly v11: string } = {
	v10:
		'Compare the viable structural forms for the bridge against the site survey and the geotechnical report, and select ' +
		'one, producing the options comparison and the selected form.',
	v11:
		'Compare the viable structural forms for the bridge against the site survey and the geotechnical report, judging each ' +
		'by criteria the comparison states, among them its clearance over the two-track rail line, its response to ' +
		'pedestrian-induced vibration and its foundations on the soft clay layer 3 m below ground on the north abutment, and ' +
		'select one, producing the options comparison and the selected form.'
};

/**
 * ⭐ D3d — THE SOURCES RESTATED, AND THEIR NEW IDS: each bridge source of version ten that holds the options study, by its
 * version-ten id, and the id it takes restated, in version ten's order. Written out: a case is data. ⚠ Eleven, as the sources
 * hold the study: `G10-RR-01` and `G10-RR-05` hold none, so D3d restates neither.
 */
export const BRIDGE_IDS_V11: readonly { readonly v10: string; readonly v11: string }[] = [
	{ v10: 'G10-CLEAN', v11: 'G11-CLEAN' },
	{ v10: 'G10-CLEAN-R1', v11: 'G11-CLEAN-R1' },
	{ v10: 'G10-CLEAN-R2', v11: 'G11-CLEAN-R2' },
	{ v10: 'G10-CLEAN-R3', v11: 'G11-CLEAN-R3' },
	{ v10: 'G10-RR-02', v11: 'G11-RR-02' },
	{ v10: 'G10-RR-03', v11: 'G11-RR-03' },
	{ v10: 'G10-RR-04', v11: 'G11-RR-04' },
	{ v10: 'G10-RR-06', v11: 'G11-RR-06' },
	{ v10: 'G10-RR-07', v11: 'G11-RR-07' },
	{ v10: 'G10-RR-08', v11: 'G11-RR-08' },
	{ v10: 'G10-RR-09', v11: 'G11-RR-09' }
];

/**
 * ⭐ D3d — THE 7 PART CASES WHOSE PROMPTS THE PURPOSE REACHES, by their version-ten ids, as D3d lists them: the options study
 * itself, the four clean roots, and the two planted roots whose children include it. Each is cut from its source restated
 * (`carried`). Written out: a case is data, and the cases test holds the list to the prompts that move.
 */
export const MOVED_V11: readonly string[] = [
	'G10-CLEAN.T03',
	'G10-CLEAN.T01',
	'G10-CLEAN-R1.T01',
	'G10-CLEAN-R2.T01',
	'G10-CLEAN-R3.T01',
	'G10-RR-02.T01',
	'G10-RR-09.T01'
];

/** ⭐ D3d — a bridge source of version ten restated: under its new id, the options study's purpose version eleven's. */
function restatedV11(source: GraphCase, id: string): GraphCase {
	return {
		...source,
		id,
		input: {
			...source.input,
			nodes: source.input.nodes.map((n) =>
				n.pwuKind === 'OPTIONS_STUDY' && n.purpose === OPTIONS_STUDY_PURPOSE.v10 ? { ...n, purpose: OPTIONS_STUDY_PURPOSE.v11 } : n
			)
		}
	};
}

/**
 * ⭐ THE BRIDGE SOURCES RESTATED BY D3d: the 11 of version ten that hold the options study, in its order, each under its new id.
 * ⚠ Held to their sources in the cases test, never refused here: a refusal at import would fail the cases test before any of
 * its limbs is asked (`ARP-F-M14`).
 */
export const BRIDGE_GRAPHS_V11: readonly GraphCase[] = BRIDGE_IDS_V11.flatMap(({ v10, v11 }) => {
	const source = BRIDGE_GRAPHS_V10.find((c) => c.id === v10);
	return source === undefined ? [] : [restatedV11(source, v11)];
});

/** ⭐ D3d — version eleven's restated sources, each by the version-ten id the part cases it is to carry name. */
const RESTATED: ReadonlyMap<string, GraphCase> = new Map(
	BRIDGE_IDS_V11.flatMap(({ v10, v11 }) => {
		const source = BRIDGE_GRAPHS_V11.find((c) => c.id === v11);
		return source === undefined ? [] : [[v10, source] as const];
	})
);

/**
 * One of version ten's cases, carried: a case D3d's purpose does not reach, byte for byte; one of the 7 it reaches under its
 * arm and subject, its input its source's as D3d restates it, its type, and the bridge library it is cut with — under its new
 * id, cut from its source under the source's new id: that id, then the type's place in the source, as version eight named its
 * part cases (`partCaseId`).
 */
function carried(c: QualificationCase): QualificationCase {
	if (c.arm !== 'PWA_TYPE' || !MOVED_V11.includes(c.id)) return c;
	const source = RESTATED.get(c.sourceCaseId);
	return source === undefined
		? c
		: ({
				...c,
				id: partCaseId(source, c.input.typeId),
				sourceCaseId: source.id,
				input: { typeId: c.input.typeId, ...source.input, policyLibrary: BRIDGE_POLICY_LIBRARY }
			} satisfies PwaTypeCase);
}

export const CASE_SET_V11: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v11.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version eleven (JAN-EXEC Phase 7, the review in parts, B8b, package K; ' +
		'REG-D-133): version ten’s 41 non-part cases, unchanged and under their ids, then its 35 PWA_TYPE part cases in its ' +
		'order — the 16 cut from G7-CLEAN, its planted twins and the 3-level pair, and 12 of the 19 cut from the bridge cases, ' +
		'unchanged and under their ids; and the other 7, the options study’s part and the roots whose children include it, ' +
		'each under a new id (a case that changes gets a new id), cut from its source restated by design D3d and renamed with ' +
		'it — G10-CLEAN and its three renamed copies as G11-CLEAN and its copies, G10-RR-02 and G10-RR-09 as G11-RR-02 and ' +
		'G11-RR-09, and each part case under its source’s new id, as G11-CLEAN.T03. In the restatement the options study’s ' +
		'purpose states the comparison criteria the request makes essential — the clearance over the two-track rail line, the ' +
		'response to pedestrian-induced vibration and the foundations on the soft clay layer 3 m below ground on the north ' +
		'abutment — in each of the 11 bridge sources that hold the options study, each under a G11- id; nothing else ' +
		'changes. Oracles are versioned separately, in ../oracles/. Oracle integrity: no increment that edits the reviewer’s ' +
		'prompt, criteria or scoring edits these cases.',
	caseSetVersion: 11,
	cases: CASE_SET_V10.cases.map(carried)
};
