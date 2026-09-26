// ⭐ `JAN-CRITREAD` J2-7 — REVIEWER-QUALIFICATION CASE SET, VERSION THREE (DESIGN-what-the-tests-prove.md §5.2;
// `REG-F-453`; the sponsor's ruling `REG-D-081`: *"I agree with your recommendation. Proceed."* — case set v3 with the
// first two objections only, the foundation responsibility and the permit's inputs, and nothing else).
//
// VERSION TWO, WITH TWO CHANGES AND NOTHING ELSE. On version two the frontier candidate rejected the corrected clean
// graph case on grounds version two did not change (`REG-F-453`): the draft's design type is scoped to the members and
// joints ("Steelwork Design (members and joints)") while its own account says the soft clay may need piled
// foundations, so nobody designs the foundations; and the permit submission receives neither the geotechnical report
// nor the design calculations. Version three answers exactly those two:
//   (1) THE FOUNDATIONS. The design type's scope takes in the foundations: its NAME says so, and its sentence in the
//       account says it designs "the members, connections and foundations". It already consumes the geotechnical report
//       (and the load model), and its outputs — the design calculations and drawings — already reach the independent
//       check. ⭐ WHY THIS AND NOT A FOUNDATION-DESIGN TYPE: it is the smallest graph change that makes a design
//       responsibility cover the foundations. A separate type would add a type, an id, a deliverable, an edge to the
//       check and to the root, a sentence and a narration count — engineering content the ruling does not ask for —
//       and it would leave the planted cases RR-06 and RR-08, whose defects the draft already places in the design's
//       sentence (the pad foundations chosen at both abutments; the ground called benign), with the foundation
//       decision in a type that no longer owns the foundations: a second defect beside each plant. Scoped this way,
//       the type that decides the foundations in those plants is the type that designs them.
//   (2) THE PERMIT. The permit submission takes the geotechnical report and the design calculations as inputs, after its
//       own, wherever it lacks them; the account's permit sentence says so in the fewest words.
// Each account gains ONLY those words: the design's new name where the account quotes it, the scope phrase, and the
// permit sentence's end. ⚠ WHAT IT DOES NOT SAY. The soft-clay residual uncertainty is version two's, word for word: its
// causal clause ("the geotechnical report will decide, which is why … consume it") is true of the four types whose work
// the pile decision bears on; the permit receives the report to submit it, and naming it there would claim a reason the
// graph does not show. The check's sentence is version two's: its "design calculations" are the design type's, now
// foundations included, and nothing more is claimed for it. ⛔ NOT DONE, by the ruling (`REG-D-081`): no
// options-comparison artifact, and nothing for the Eurocode or "surface-level" readings.
//
// ⭐ WHICH CASES TAKE THEM — version two's twelve (`REG-D-079`, confirmed by `REG-D-080`), decided by the same
// RELATIONSHIP: every graph case built on the draft, the planted ones included, each keeping its plant as its only
// defect. ⛔ NO NEW CUE: what a change adds to a planted case is what it adds to the clean case, word for word, less
// what the case lacks — a sentence the plant rewrote in its own words is not restated. So:
//   · the design's name and scope phrase move in every case whose account has them — every planted case but G2-RR-09,
//     whose account describes no type, including G2-RR-06 and G2-RR-08, whose design sentences carry their plants
//     AFTER the scope phrase the clean case shares, and keep them byte for byte;
//   · the permit sentence's end moves wherever it is the clean draft's — not in G2-RR-02, whose permit sentence is its
//     plant's own ("consumes the design calculations and drawings, so the submission is made once the design is
//     complete"), nor in G2-RR-09. G2-RR-02's permit already consumes the design calculations (its plant routes the
//     design straight to it), so it gains the report alone.
// Every other case — G-RR-01, which has no geotechnical report, and the thirteen work-product cases — is version two's,
// under its own id.
//
// ⛔ A CHANGED CASE IS A NEW CASE ID (`cases.ts`): `G2-…` becomes `G3-…`, so no record that measured a version-two case
// under today's fingerprint reads as a prompt that moved without the fingerprint moving.
// ⛔ ORACLE INTEGRITY (§5.2; `DOC-004:256`): this increment edits no prompt, criterion, budget or scoring, so the reviewer
// fingerprint does not move. What each case is EXPECTED to draw is in `oracles-v3.ts`, versioned separately.
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type { PwaGraphNode } from '@janumipwb/rph-projections';
import { CASE_SET_V2, RENAMES_V2 } from './case-set-v2.js';
import type { CaseSet, GraphCase, QualificationCase } from './cases.js';

/** The deliverables the permit gains, as the draft names them. */
const REPORT = 'geotechnical-report';
const CALCULATIONS = 'design-calculations';

/**
 * (1) THE FOUNDATIONS — the design type's name in version two → in version three: the clean draft's (which every planted
 * case carries) and each renamed copy's, each the same name with the foundations taken into its scope.
 */
const DESIGN_NAME: ReadonlyMap<string, string> = new Map([
	['Member and Connection Design', 'Member, Connection and Foundation Design'],
	['Element and Joint Design', 'Element, Joint and Foundation Design'],
	['Steelwork Design (members and joints)', 'Steelwork and Foundation Design (members, joints and foundations)'],
	['Structural Element Design', 'Structural Element and Foundation Design']
]);
/** …and the design's scope in its sentence, after its name, as each version writes it. */
const SCOPE_V2 = ' designs the members and connections from the load model';
const SCOPE_V3 = ' designs the members, connections and foundations from the load model';

/** (2) THE PERMIT — the inputs it gains, in the ruling's order, wherever it lacks them. */
const PERMIT_GAINS: readonly string[] = [REPORT, CALCULATIONS];
/** …and the end of the clean draft's permit sentence, as each version writes it. */
const PERMIT_V2 = 'so the submission cannot be made before the independent check exists.';
const PERMIT_V3 =
	'so the submission cannot be made before the independent check exists; it also consumes the geotechnical report ' +
	'and the design calculations.';

/**
 * Whether a graph case is built on the draft: its graph carries the draft's geotechnical report — version two's own
 * test, and its twelve. ⚠ A boolean, never a type guard: G-RR-01 is a graph case it answers false for.
 */
const builtOnTheDraft = (c: GraphCase): boolean => c.input.nodes.some((n) => n.requiredOutputs.includes(REPORT));

/** The new id of a case version three changes: `G2-…` → `G3-…`. */
function changedId(id: string): string {
	if (!id.startsWith('G2-')) throw new Error(`${id}: a case version three changes is one version two corrected, id G2-…`);
	return `G3-${id.slice(3)}`;
}

/** The one node of `kind` in the case's graph — every case built on the draft has one design and one permit. */
function theOne(c: GraphCase, kind: string): PwaGraphNode {
	const found = c.input.nodes.filter((n) => n.pwuKind === kind);
	if (found.length !== 1) throw new Error(`${c.id}: the draft has one ${kind}, not ${found.length}`);
	return found[0]!;
}

/** The design's name in version three. */
function designNameV3(c: GraphCase, v2Name: string): string {
	const v3 = DESIGN_NAME.get(v2Name);
	if (v3 === undefined) throw new Error(`${c.id}: no version-three name for the design "${v2Name}"`);
	return v3;
}

/** `text` with `from` replaced by `to` where it occurs — at most once, or the case is not the one this was written for. */
function replaceOnce(text: string, from: string, to: string, caseId: string): string {
	const n = text.split(from).length - 1;
	if (n > 1) throw new Error(`${caseId}: the account says "${from}" ${n} times`);
	return n === 1 ? text.replace(from, () => to) : text;
}

/** The case's account — every graph case built on the draft carries one. */
function accountOf(c: GraphCase): ProfessionalRationaleSummary {
	if (!c.input.rationale) throw new Error(`${c.id}: a graph case built on the draft carries its account`);
	return c.input.rationale;
}

/**
 * (1) THE FOUNDATIONS, in the graph and in the account, and nothing else: the design type's name extended to the
 * foundations, the account's quotation of it, and its scope phrase restated.
 */
function theFoundations(c: GraphCase): GraphCase {
	const r = accountOf(c);
	const v2Name = theOne(c, 'DETAILED_DESIGN').name;
	const v3Name = designNameV3(c, v2Name);
	const quoted = `“${v2Name}”`;
	// The design's name is quoted in the account alone — never in an assumption, limitation, uncertainty or narration.
	for (const other of [...r.assumptions, ...r.limitations, ...r.residualUncertainty, c.input.narration ?? ''])
		if (other.includes(v2Name)) throw new Error(`${c.id}: "${v2Name}" is named outside the account`);
	// The scope phrase is the design's own, so it is restated only where the account names the design before it.
	if (r.rationale.includes(SCOPE_V2) && !r.rationale.includes(`${quoted}${SCOPE_V2}`))
		throw new Error(`${c.id}: the account's scope phrase does not follow the design's name`);
	const rationale = replaceOnce(replaceOnce(r.rationale, quoted, `“${v3Name}”`, c.id), SCOPE_V2, SCOPE_V3, c.id);
	const nodes = c.input.nodes.map((n) => (n.pwuKind === 'DETAILED_DESIGN' ? { ...n, name: v3Name } : n));
	return { ...c, input: { ...c.input, nodes, rationale: { ...r, rationale } } };
}

/**
 * (2) THE PERMIT, in the graph and in the account, and nothing else: the inputs it lacks of the report and the
 * calculations, after its own, and the clean draft's permit sentence's end restated.
 */
function thePermit(c: GraphCase): GraphCase {
	const r = accountOf(c);
	const permit = theOne(c, 'PERMIT_SUBMISSION');
	const gains = PERMIT_GAINS.filter((d) => !permit.requiredInputs.includes(d));
	if (!gains.includes(REPORT)) throw new Error(`${c.id}: ${permit.name} already consumes the ${REPORT}`);
	const nodes = c.input.nodes.map((n) => (n === permit ? { ...n, requiredInputs: [...n.requiredInputs, ...gains] } : n));
	const rationale = replaceOnce(r.rationale, PERMIT_V2, PERMIT_V3, c.id);
	return { ...c, input: { ...c.input, nodes, rationale: { ...r, rationale } } };
}

/** A version-two case version three changes — the two changes, under its new id, and otherwise exactly version two's. */
function changed(c: GraphCase): GraphCase {
	const both = thePermit(theFoundations(c));
	return { ...both, id: changedId(c.id) };
}

/** A version-two case as version three holds it: changed when it is a graph case built on the draft, else itself. */
const inVersionThree = (c: QualificationCase): QualificationCase =>
	c.arm === 'PWA_GRAPH' && builtOnTheDraft(c) ? changed(c) : c;

/** ⭐ The cases version three changes, by version-two id → version-three id, in version two's order. */
export const CHANGED_IN_V3: ReadonlyMap<string, string> = new Map(
	CASE_SET_V2.cases.flatMap((c) =>
		c.arm === 'PWA_GRAPH' && builtOnTheDraft(c) ? [[c.id, changedId(c.id)] as const] : []
	)
);

/** The id a version-two case carries in version three. */
export const v3CaseId = (v2Id: string): string => CHANGED_IN_V3.get(v2Id) ?? v2Id;

export const CASE_SET_V3: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v3.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version three (JAN-CRITREAD J2-7; REG-F-453; REG-D-081; ' +
		'DESIGN-what-the-tests-prove.md §5.2): version two, with two changes in every graph case built on the draft — ' +
		'the design type’s scope and name take in the foundations, and the permit submission also receives the ' +
		'geotechnical report and the design calculations — and the account’s words for them. A changed case carries ' +
		'a new id (G2-… → G3-…); every other case is version two’s, unchanged. Oracles are versioned separately, in ' +
		'../oracles/. Oracle integrity: no increment that edits the reviewer’s prompt, criteria or scoring edits these ' +
		'cases.',
	caseSetVersion: 3,
	cases: CASE_SET_V2.cases.map(inVersionThree)
};

/** Version two's names, with the design's extended to the foundations — the same substitution for a clean case and its copy. */
const v3Name = (name: string): string => DESIGN_NAME.get(name) ?? name;

/** For the tests that hold a renamed copy to "names, and nothing else": version two's names, as version three holds them. */
export const RENAMES_V3: Readonly<Record<string, { readonly from: readonly string[]; readonly to: readonly string[] }>> =
	Object.fromEntries(
		Object.entries(RENAMES_V2).map(([id, { from, to }]) => [v3CaseId(id), { from: from.map(v3Name), to: to.map(v3Name) }])
	);
