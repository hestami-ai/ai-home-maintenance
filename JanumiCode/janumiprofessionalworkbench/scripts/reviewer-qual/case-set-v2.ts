// ⭐ `JAN-CRITREAD` J2-5 — REVIEWER-QUALIFICATION CASE SET, VERSION TWO (DESIGN-what-the-tests-prove.md §5.2;
// `REG-F-449`; the sponsor's ruling `REG-D-078`: *"1 - Fix flawed test case (REG-F-449) is approved"*).
//
// VERSION ONE, WITH ONE CORRECTION AND NOTHING ELSE. Version one's graph arm is built on one draft PWA, the structural
// review of a footbridge. Its geotechnical report, which records the soft clay layer 3 m down at the north abutment,
// reached the load analysis and the design, but NOT the structural-form options study nor the independent check. The
// frontier candidate rejected the "clean" case in 7 of its 8 evaluations, and 6 of the 7 rejections cite that routing
// (`REG-F-449`; the seventh, G-CLEAN-R3 #2, cites none of it). Version two corrects the ROUTING: the report reaches both.
// The account then says so in the fewest words that name the report's consumers, and claims nothing the graph does not
// show:
//   · the options study's sentence — it compares the forms against the geotechnical report as well as the survey;
//   · the check's sentence — it also consumes the geotechnical report;
//   · the soft-clay residual uncertainty — which names the types that consume the report. It is derived from the graph
//     by `clayUncertainty`, the rule version one's own wording already follows: the test holds the rule to every
//     version-one case that carries the sentence.
// ⚠ WHAT IT DOES NOT CORRECT. The record shows other grounds a reviewer rejected the clean case on: rail-specific inputs
// (track clearances, derailment loads), no type that designs the foundations, and whether a check that certifies the
// designer's calculations is independent without deriving in parallel. Version two adds no input, no type and no claim
// for any of them — so the account never says the check checks the foundations, which no type designs. They are left
// for the measurement.
//
// ⭐ WHICH CASES TAKE IT — EVERY GRAPH CASE BUILT ON THE DRAFT, decided by RELATIONSHIP, not by label. The planted
// cases G-RR-02..09 are the draft with one defect planted; built on the uncorrected draft they carried two, the plant
// and the routing gap. The frontier candidate filed that gap under RR-02, 04, 05, 06, 07, 08 and 09 in the clean case
// and its copies, and under RR-08 beside G-RR-04's own RR-04 in both repetitions (`runs.ndjson`) — so a planted case
// left uncorrected could have its planted criterion faulted for the gap and be scored as having found the plant. That
// is the very attribution `REG-F-450`'s pass bar turns on. Each planted case's own edits are applied to the corrected
// draft exactly as version one applied them to the uncorrected one. ⛔ NO NEW CUE: what the correction adds to a
// planted case is what it adds to the clean case, word for word, less the names of types the case lacks — it names,
// characterizes, softens or sharpens no plant. So where a type the correction names is absent — G-RR-02 drops the
// check, G-RR-05 the options study — nothing is routed to it, and the soft-clay sentence names only what consumes the
// report; and G-RR-07's check, the design team's own, is named as version one's account of that case already names it:
// "the independent check", its permit sentence's words. G-RR-01 models a concept study with no geotechnical report at
// all, and is version one's. So is every work-product case.
// ⚠ THE REACH BEYOND G-CLEAN AND ITS RENAMED COPIES IS THE AGENT'S JUDGEMENT under the sponsor's authorization of
// `REG-F-449`'s fix, flagged for sponsor confirmation: `REG-F-449`'s remedy text names the clean case and its copies.
//
// ⛔ A CHANGED CASE IS A NEW CASE ID (`cases.ts`). The check reads "content unchanged" as the case id (`check-core.ts`),
// so a corrected case kept under its version-one id would read, against every record that measured it under today's
// fingerprint, as a prompt that changed without the fingerprint moving: a non-reproduction, dischargeable only by
// striking the whole record. So `G-…` becomes `G2-…`, and every case that did not change keeps its id and its
// measurements.
// ⛔ ORACLE INTEGRITY (§5.2; `DOC-004:256`): this increment edits no prompt, criterion, budget or scoring, so the
// reviewer fingerprint does not move. What each case is EXPECTED to draw is in `oracles-v2.ts`, versioned separately.
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type { PwaGraphNode } from '@janumipwb/rph-projections';
import { CASE_SET_V1, RENAMES_V1 } from './case-set-v1.js';
import type { CaseSet, GraphCase, QualificationCase } from './cases.js';

/** The deliverable the correction routes, as the draft's site investigation names it. */
const REPORT = 'geotechnical-report';
/** The types the correction routes it to, by kind — a kind no rename or plant changes. */
const ROUTED_TO: ReadonlySet<string> = new Set(['OPTIONS_STUDY', 'INDEPENDENT_CHECK']);

/** The options study's sentence after its name, as version one wrote it and as version two does. */
const FORM_V1 = ' compares the viable structural forms against the site survey and selects one.';
const FORM_V2 =
	' compares the viable structural forms against the site survey and the geotechnical report, and selects one.';
/** The end of the check's sentence (the delegated check's and G-RR-07's self-check's alike), as each version writes it. */
const CHECK_V1 = 'it certifies the design calculations and drawings.';
const CHECK_V2 =
	'it certifies the design calculations and drawings, and also consumes the geotechnical report.';
const CLAY_PREFIX =
	'The soft clay layer 3 m below the north abutment may require piled foundations; the geotechnical report will ' +
	'decide, which is why ';

/** What the account calls a type that consumes the report. */
function consumerName(n: PwaGraphNode): string {
	switch (n.pwuKind) {
		case 'OPTIONS_STUDY':
			return 'the options study';
		case 'LOAD_ANALYSIS':
			return 'the load analysis';
		case 'DETAILED_DESIGN':
			return 'the design';
		case 'INDEPENDENT_CHECK':
			// By its kind, whatever its boundary: G-RR-07's check, the design team's own, is "the independent check" in
			// version one's own account of that case (its permit sentence) — a name taken from the case, not a new cue.
			return 'the independent check';
		default:
			throw new Error(`the account has no name for a ${n.pwuKind} that consumes the ${REPORT}`);
	}
}

/**
 * ⭐ THE SOFT-CLAY RESIDUAL UNCERTAINTY OF A GRAPH: it names every type that consumes the report, in listing order. On
 * version one's graphs this is version one's sentence word for word — the rule is the one it was already written by.
 */
export function clayUncertainty(nodes: readonly PwaGraphNode[]): string {
	const names = nodes.filter((n) => n.requiredInputs.includes(REPORT)).map(consumerName);
	if (names.length < 2) throw new Error(`the soft-clay sentence names at least two consumers of the ${REPORT}, not ${names.length}`);
	const last = names.at(-1)!;
	const list = names.length === 2 ? `${names[0]} and ${last} both` : `${names.slice(0, -1).join(', ')} and ${last} all`;
	return `${CLAY_PREFIX}${list} consume it.`;
}

/**
 * Whether a graph case is built on the draft: its graph carries the draft's geotechnical report. ⚠ A boolean, never a
 * type guard: G-RR-01 is a graph case it answers false for, and a guard's false branch would type it as something else.
 */
const builtOnTheDraft = (c: GraphCase): boolean =>
	c.input.nodes.some((n) => n.requiredOutputs.includes(REPORT));

/** The new id of a corrected case: `G-…` → `G2-…`, the graph arm's second draft. */
function correctedId(id: string): string {
	if (!id.startsWith('G-')) throw new Error(`${id}: a corrected case is a graph case, id G-…`);
	return `G2-${id.slice(2)}`;
}

/** The report routed to the options study and the check, wherever the graph has them, as their last input. */
function routeTheReport(c: GraphCase): PwaGraphNode[] {
	return c.input.nodes.map((n) => {
		if (!ROUTED_TO.has(n.pwuKind)) return n;
		if (n.requiredInputs.includes(REPORT)) throw new Error(`${c.id}: ${n.name} already consumes the ${REPORT}`);
		return { ...n, requiredInputs: [...n.requiredInputs, REPORT] };
	});
}

/** `text` with `from` replaced by `to` where it occurs — at most once, or the case is not the one this was written for. */
function replaceOnce(text: string, from: string, to: string, caseId: string): string {
	const n = text.split(from).length - 1;
	if (n > 1) throw new Error(`${caseId}: the account says "${from}" ${n} times`);
	return n === 1 ? text.replace(from, () => to) : text;
}

/** The account, true of the corrected graph: the two routing sentences and the soft-clay uncertainty restated. */
function correctTheAccount(c: GraphCase, nodes: readonly PwaGraphNode[]): ProfessionalRationaleSummary {
	const r = c.input.rationale;
	if (!r) throw new Error(`${c.id}: a graph case built on the draft carries its account`);
	const has = (kind: string) => nodes.some((n) => n.pwuKind === kind);
	if (r.rationale.includes(FORM_V1) && !has('OPTIONS_STUDY'))
		throw new Error(`${c.id}: the account describes an options study the graph lacks`);
	if (r.rationale.includes(CHECK_V1) && !has('INDEPENDENT_CHECK'))
		throw new Error(`${c.id}: the account describes a check the graph lacks`);
	const rationale = replaceOnce(replaceOnce(r.rationale, FORM_V1, FORM_V2, c.id), CHECK_V1, CHECK_V2, c.id);
	const residualUncertainty = r.residualUncertainty.map((u) => {
		if (!u.startsWith(CLAY_PREFIX)) return u;
		if (u !== clayUncertainty(c.input.nodes))
			throw new Error(`${c.id}: version one's soft-clay sentence does not name the types that consume the ${REPORT}`);
		return clayUncertainty(nodes);
	});
	return { ...r, rationale, residualUncertainty };
}

/** A graph case built on the draft, corrected — under its new id, and otherwise exactly version one's. */
function corrected(c: GraphCase): GraphCase {
	const nodes = routeTheReport(c);
	return { ...c, id: correctedId(c.id), input: { ...c.input, nodes, rationale: correctTheAccount(c, nodes) } };
}

/** A version-one case as version two holds it: corrected when it is a graph case built on the draft, else itself. */
const inVersionTwo = (c: QualificationCase): QualificationCase =>
	c.arm === 'PWA_GRAPH' && builtOnTheDraft(c) ? corrected(c) : c;

/** ⭐ The cases version two corrects, by version-one id → version-two id, in version one's order. */
export const CORRECTED_IN_V2: ReadonlyMap<string, string> = new Map(
	CASE_SET_V1.cases.flatMap((c) =>
		c.arm === 'PWA_GRAPH' && builtOnTheDraft(c) ? [[c.id, correctedId(c.id)] as const] : []
	)
);

/** The id a version-one case carries in version two. */
export const v2CaseId = (v1Id: string): string => CORRECTED_IN_V2.get(v1Id) ?? v1Id;

export const CASE_SET_V2: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v2.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version two (JAN-CRITREAD J2-5; REG-F-449; REG-D-078; ' +
		'DESIGN-what-the-tests-prove.md §5.2): version one, with the geotechnical report routed to the ' +
		'structural-form options study and to the independent check in every graph case built on the draft, and ' +
		'the account sentences about that routing restated. A corrected case carries a new id (G-… → G2-…); every ' +
		'other case is version one’s, unchanged. Oracles are versioned separately, in ../oracles/. Oracle integrity: ' +
		'no increment that edits the reviewer’s prompt, criteria or scoring edits these cases.',
	caseSetVersion: 2,
	cases: CASE_SET_V1.cases.map(inVersionTwo)
};

/** For the tests that hold a renamed copy to "names, and nothing else": version one's names, under version two's ids. */
export const RENAMES_V2: Readonly<Record<string, { readonly from: readonly string[]; readonly to: readonly string[] }>> =
	Object.fromEntries(Object.entries(RENAMES_V1).map(([id, names]) => [v2CaseId(id), names]));
