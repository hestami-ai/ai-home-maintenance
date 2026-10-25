// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b — REVIEWER-QUALIFICATION CASE SET, VERSION TEN (`REG-D-130`, `REG-D-131`,
// ⭐ `REG-D-132`; DESIGN-authoring-review-in-parts.md D3b, ⭐ D3b (8), and §5, case set v10; ROADMAP-undertaking-execution-
// sandbox.md §9a.9b, ⭐ its package J).
//
// VERSION NINE'S 41 NON-PART CASES AND ITS 16 SOFTWARE PART CASES, BYTE FOR BYTE, AND ITS 19 BRIDGE PART CASES ~~UNDER THEIR
// IDS~~ ⭐ UNDER NEW IDS (D3b (8), `REG-D-132`), CUT FROM THEIR SOURCES RESTATED AS A COMPETENT AUTHOR AUTHORS THEM ON TODAY'S
// SURFACE. Version nine's measurement left four clean bridge-leaf rejections, each faulting the bridge PWA's absence of
// assurance and three the absent prompt template too (`REG-F-572`), and the sponsor ruled them settled before P6 again
// (`REG-D-130` Q35). D3b restates the 13 bridge sources of version nine (`BRIDGE_GRAPHS_V9`) under ONE RULE:
//   · (1) WHO DOES THE WORK — the request gains the sentence that assigns the work to the practice's own engineers but the
//     independent check (`WHO_DOES_THE_WORK`), as `REG-D-122` lets the request's words decide; each INTERNAL type declares
//     `workDischarge` HUMAN, and the delegated check none, as the engine refuses a discharge on a delegated type. A HUMAN type
//     carries no prompt — the engine refuses an ACTIVE one on a type that declares no MODEL discharge — so its absent template
//     is the stored shape of HUMAN work, not a gap in it.
//   · (2) THE PRACTICE'S POLICIES — the bridge part cases are cut with the seeded library's 15 then the practice's six
//     (`PRACTICE_POLICIES`, `BRIDGE_POLICY_LIBRARY`), each ACTIVE, non-floor, version 1.0.0, scoped by kind as the seeded
//     catalog is. The workbench's own create surfaces cannot scope a policy by kind today (`REG-F-574`); the kernel's create
//     command can, and the seed uses it — the cases test holds the six to a view over an engine where that command made them.
//   · (3) DECLARED TREATMENT — each type declares the practice's policies its kind takes, and a kind no practice policy names
//     declares none: ~~G-RR-01's~~ G10-RR-01's concept study and its three children, and ~~G3-RR-04's~~ G10-RR-04's compliance
//     statement. The delegated check's firm also attests Check Independence in its boundary contract: the attestation is the
//     firm's claim, the declaration the practice's own review of the certificate it receives.
//   · (4) FOUR PURPOSES AND TWO HAND-OFFS — the survey names the soft clay the request says the preliminary investigation found;
//     the load analysis's scope stays as inclusive as the request's; the options study produces the options comparison, and the
//     permit submission submits it; the site survey reaches the load analysis and the member, connection and foundation design
//     (`RESTATED_PURPOSES_V10`, `OPTIONS_COMPARISON`, `SITE_SURVEY`).
//   · (5) THE TWINS — the same rule on every bridge source, each plant's words kept: ~~G3-RR-03's and G3-RR-04's~~ G10-RR-03's
//     and G10-RR-04's narrowed load scopes, ~~G3-RR-05's~~ G10-RR-05's missing options study and so its missing comparison,
//     ~~G3-RR-07's~~ G10-RR-07's INTERNAL self-check, which declares HUMAN and Check Independence and has no contract, and
//     version seven's accounts, as version nine kept them.
// ⛔ THE 35 PART CASES KEEP ~~THEIR IDS,~~ THEIR ORDER AND THEIR ORACLES: every expected verdict, faulted criterion, catcher and
// standing is as `REG-D-126` conferred it (`REG-D-129`). ⭐ The sponsor confirmed the restatement as proposed (`REG-D-131` Q36),
// recorded in `oracles-v10.ts` ⭐ under the new ids (`REG-D-132` Q38b). The 19 prompts are new, and owe a RUN; the 57 others are
// version nine's. The reviewer fingerprint is unmoved — the case set is outside its components — and the case set's digest
// moves.
// ⭐ D3b (8) (`REG-D-132`; `REG-F-575`) — AND THE 19 TAKE NEW IDS, THEIR CONTENT BYTE FOR BYTE. A case that changes gets a new id
// (`cases.ts`): kept under version nine's ids beside an unmoved fingerprint, the 19 read to the check as prompts that moved while
// the fingerprint did not, which no run of them discharges. Each bridge source takes its `G10-` id (`BRIDGE_IDS_V10`) and each
// part case its source's (`partCaseId`, as version eight named them); a prompt carries no case id, so the 19 prompts are the
// confirmed prototype's still. The 57 others, the 16 software part cases among them, keep their ids.
// ⛔ A CASE IS DATA: the policies, the sentence and every purpose below are literals, and no runtime import reaches a package
// (`cases.ts`). Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { AssurancePolicyView } from '@janumipwb/rph-authoring';
import type { PwaGraphNode } from '@janumipwb/rph-projections';
import type { CaseSet, GraphCase, PwaTypeCase } from './cases.js';
import { partCaseId } from './case-set-v8.js';
import { BRIDGE_GRAPHS_V9, CASE_SET_V9, SEEDED_POLICY_LIBRARY } from './case-set-v9.js';

/** ⭐ D3b (1) — the sentence each bridge request gains: who carries out the work (`REG-D-122`: the request's words decide). */
export const WHO_DOES_THE_WORK = 'The practice’s own engineers carry out all of the work except the independent check.';

/**
 * ⭐ D3b (2) — THE PRACTICE'S SIX POLICIES, as the authoring surface's policy view reads them (`rph-authoring`
 * `assurancePolicyViews`) over an engine where the kernel's create command made each with its kind conditions, and each was
 * activated: ACTIVE, non-floor, version 1.0.0, each governing the kinds it names. ⚠ Written out, not read: a case is data. The
 * cases test holds them to that view, value for value.
 * ⭑ The survey's is Site Investigation Adequacy, the site as well as the ground: a policy over the ground alone left the site
 * survey — which the options study, the load analysis and the design consume — under none (`d3b-facts.md`, round 6).
 */
export const PRACTICE_POLICIES: readonly AssurancePolicyView[] = [
	{
		id: 'pol_instruction_coverage',
		name: 'Instruction Coverage',
		purpose:
			'Determine whether the parts of an engagement together discharge every obligation of the client’s instruction and every requirement of the authorities that must approve the work.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['STRUCTURAL_REVIEW']
	},
	{
		id: 'pol_site_investigation',
		name: 'Site Investigation Adequacy',
		purpose:
			'Determine whether a site and ground investigation characterizes the site’s geometry, levels and the constraints of what it holds or adjoins, and the ground’s strata, groundwater and every hazard already known, well enough for the design decisions that rely on them.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['SITE_INVESTIGATION']
	},
	{
		id: 'pol_options_appraisal',
		name: 'Options Appraisal',
		purpose:
			'Determine whether each viable alternative was evaluated against stated criteria, and whether the alternative selected follows from that evaluation.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['OPTIONS_STUDY']
	},
	{
		id: 'pol_design_basis',
		name: 'Design Basis Compliance',
		purpose:
			'Determine whether an analysis or design applies every load case, combination and limit state its governing standards require, with the ground conditions the investigation established.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['LOAD_ANALYSIS', 'DETAILED_DESIGN']
	},
	{
		id: 'pol_check_independence',
		name: 'Check Independence',
		purpose:
			'Determine whether a design check is carried out by a party independent of the design, to the category the approving authority requires, and certifies what it checked.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['INDEPENDENT_CHECK']
	},
	{
		id: 'pol_submission_completeness',
		name: 'Submission Completeness',
		purpose:
			'Determine whether a submission to an approving authority holds every document and certification that authority requires, each in the state the authority accepts.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['PERMIT_SUBMISSION']
	}
];

/**
 * ⭐ D3b (2) — THE BRIDGE LIBRARY: the seeded library's 15, then the practice's six, in that order — the library the 19 bridge
 * part cases are cut with (`pwaTypeParts`). The 16 software part cases keep the seeded library alone.
 */
export const BRIDGE_POLICY_LIBRARY: readonly AssurancePolicyView[] = [...SEEDED_POLICY_LIBRARY, ...PRACTICE_POLICIES];

/** ⭐ D3b (3) — the practice's policies a type of `kind` takes, in the library's order: those whose kinds name it. */
const practiceTakes = (kind: string): string[] =>
	PRACTICE_POLICIES.filter((p) => p.pwuKinds?.includes(kind) === true).map((p) => p.id);

// ── the bridge cases, restated by D3b (`REG-D-130`) ─────────────────────────────────────────────────────────────────────────
/** ⭐ D3b (4) — the options study's comparison: a deliverable it produces, and the permit submission submits. */
const OPTIONS_COMPARISON = 'options-comparison';
/** ⭐ D3b (4) — the site survey, routed to the work that needs the site's exposure, the clearance over the tracks, the site's
 *  levels and the tracks' positions: the load analysis, and the member, connection and foundation design. */
const SITE_SURVEY = 'site-survey';
/** ⭐ D3b (4) — the kinds the site survey is routed to. */
const NEEDS_THE_SITE: ReadonlySet<string> = new Set(['LOAD_ANALYSIS', 'DETAILED_DESIGN']);

/**
 * ⭐ D3b (4) — THE PURPOSES RESTATED: each purpose of version nine D3b changes, written out with what it becomes, applied wherever
 * a bridge source's type carries that purpose, and nowhere else — so ~~G3-CLEAN's~~ G10-CLEAN's, its renamed copies', and each
 * twin's that keeps ~~G3-CLEAN's~~ G10-CLEAN's, while a plant's own words (~~G3-RR-03's~~ G10-RR-03's "for the static pedestrian
 * load only", ~~G3-RR-04's~~ G10-RR-04's "for pedestrian and wind loading") are not here and stay. ⚠ The permit submission's two
 * submit the options comparison, so they apply only where the source holds an options study to produce it (`withTheStudy`):
 * ~~G3-RR-05's~~ G10-RR-05's permit keeps version nine's purpose, as its twin compares no options. Descriptive and used:
 * `restatedV10` reads it, and the cases test holds each row to a type of a restated source that carries it. ⚠ Held there, never refused here: a refusal at import would fail the cases test before any of its
 * limbs is asked, so a mutation of version nine's cases would be killed by the crash, its limb unattributed (`ARP-F-M14`).
 */
export const RESTATED_PURPOSES_V10: readonly {
	readonly v9: string;
	readonly v10: string;
	readonly withTheStudy?: true;
}[] = [
	// The survey: its engineers' instruction names the hazard the request says the preliminary investigation found.
	{
		v9: 'Survey the site of the crossing and investigate its ground, producing the site survey and the geotechnical report.',
		v10:
			'Survey the site of the crossing and investigate its ground, including the soft clay layer 3 m below ground on the ' +
			'north abutment that the preliminary site investigation found, producing the site survey and the geotechnical report.'
	},
	// The options study: it produces the comparison, a deliverable, beside the form it selects.
	{
		v9: 'Compare the viable structural forms for the bridge against the site survey and the geotechnical report, and select one.',
		v10:
			'Compare the viable structural forms for the bridge against the site survey and the geotechnical report, and select ' +
			'one, producing the options comparison and the selected form.'
	},
	// The load analysis: the request's "including" list kept as emphasis, never as the whole of the Eurocodes' actions —
	// ~~G3-CLEAN's~~ G10-CLEAN's, and ~~G3-RR-05's~~ G10-RR-05's of its cable-stayed deck, its plant.
	{
		v9:
			'Analyse the selected structural form to the Eurocodes for pedestrian, wind and pedestrian-induced vibration loading, ' +
			'with the foundation stiffness the geotechnical report gives in its dynamic model, producing the load model.',
		v10:
			'Analyse the selected structural form to the Eurocodes for every action they require of a footbridge over the railway, ' +
			'including pedestrian, wind and pedestrian-induced vibration loading, with the foundation stiffness the geotechnical ' +
			'report gives in its dynamic model, producing the load model.'
	},
	{
		v9:
			'Analyse the cable-stayed deck to the Eurocodes for pedestrian, wind and pedestrian-induced vibration loading, with the ' +
			'foundation stiffness the geotechnical report gives in its dynamic model, producing the load model.',
		v10:
			'Analyse the cable-stayed deck to the Eurocodes for every action they require of a footbridge over the railway, ' +
			'including pedestrian, wind and pedestrian-induced vibration loading, with the foundation stiffness the geotechnical ' +
			'report gives in its dynamic model, producing the load model.'
	},
	// The permit submission: it submits the comparison — ~~G3-CLEAN's~~ G10-CLEAN's, and ~~G3-RR-02's~~ G10-RR-02's in its own
	// list, its plant.
	{
		v9:
			'Make the permit submission to the rail authority once the independent check has certified the design, with the ' +
			'geotechnical report and the design calculations.',
		v10:
			'Make the permit submission to the rail authority once the independent check has certified the design, with the ' +
			'options comparison, the geotechnical report and the design calculations.',
		withTheStudy: true
	},
	{
		v9:
			'Make the permit submission to the rail authority once the design is complete, with the design calculations, the ' +
			'drawings and the geotechnical report.',
		v10:
			'Make the permit submission to the rail authority once the design is complete, with the options comparison, the design ' +
			'calculations, the drawings and the geotechnical report.',
		withTheStudy: true
	}
];

/** A type's purpose under D3b (4): its row's, where it carries a restated purpose and the row applies, else version nine's. */
function purposeOf(sourceId: string, n: PwaGraphNode, withTheStudy: boolean): string {
	if (n.purpose === undefined) throw new Error(`${sourceId}: ${n.name} carries no purpose to restate`);
	const row = RESTATED_PURPOSES_V10.find((r) => r.v9 === n.purpose && (r.withTheStudy !== true || withTheStudy));
	return row === undefined ? n.purpose : row.v10;
}

/** A type's inputs under D3b (4): the site survey for the work that needs the site; the comparison for the permit, if made. */
function inputsOf(sourceId: string, n: PwaGraphNode, withTheStudy: boolean): readonly string[] {
	if (NEEDS_THE_SITE.has(n.pwuKind)) {
		if (n.requiredInputs.includes(SITE_SURVEY)) throw new Error(`${sourceId}: ${n.name} already consumes the ${SITE_SURVEY}`);
		return [...n.requiredInputs, SITE_SURVEY];
	}
	return n.pwuKind === 'PERMIT_SUBMISSION' && withTheStudy ? [...n.requiredInputs, OPTIONS_COMPARISON] : n.requiredInputs;
}

/**
 * A bridge type as D3b restates it (decisions 1–4), each key where `buildPwaExport` writes it: who does its work, after its
 * boundary — HUMAN, an INTERNAL type's, and none on the delegated check; the practice's policies its kind takes; its purpose
 * and hand-offs; and, delegated, its firm's contract attesting what it declares.
 */
function asAuthored(sourceId: string, n: PwaGraphNode, withTheStudy: boolean): PwaGraphNode {
	const declared = practiceTakes(n.pwuKind);
	return {
		id: n.id,
		name: n.name,
		pwuKind: n.pwuKind,
		isRoot: n.isRoot,
		permittedChildTypeIds: n.permittedChildTypeIds,
		requiredInputs: inputsOf(sourceId, n, withTheStudy),
		requiredOutputs: n.pwuKind === 'OPTIONS_STUDY' ? [OPTIONS_COMPARISON, ...n.requiredOutputs] : n.requiredOutputs,
		executionBoundary: n.executionBoundary,
		...(n.executionBoundary === 'DELEGATED_EXTERNAL' ? {} : { workDischarge: 'HUMAN' as const }),
		purpose: purposeOf(sourceId, n, withTheStudy),
		requiredAssurancePolicyIds: declared,
		permittedChildren: n.permittedChildren,
		completionRule: n.completionRule,
		...(n.boundaryContract === undefined
			? {}
			: { boundaryContract: { ...n.boundaryContract, attestedAssurancePolicyIds: declared } })
	};
}

/**
 * ⭐ D3b (8) — THE NEW IDS (`REG-D-132`): each bridge source D3b restates, by its version-nine id, and the id it takes in version
 * ten — `G3-CLEAN` and its three renamed copies, `G-RR-01`, and `G3-RR-02` to `G3-RR-09`, each as `G10-` — in version nine's
 * order; its part cases take its new id (`carried`). Written out, as the ruling lists them: a case is data.
 */
export const BRIDGE_IDS_V10: readonly { readonly v9: string; readonly v10: string }[] = [
	{ v9: 'G3-CLEAN', v10: 'G10-CLEAN' },
	{ v9: 'G3-CLEAN-R1', v10: 'G10-CLEAN-R1' },
	{ v9: 'G3-CLEAN-R2', v10: 'G10-CLEAN-R2' },
	{ v9: 'G3-CLEAN-R3', v10: 'G10-CLEAN-R3' },
	{ v9: 'G-RR-01', v10: 'G10-RR-01' },
	{ v9: 'G3-RR-02', v10: 'G10-RR-02' },
	{ v9: 'G3-RR-03', v10: 'G10-RR-03' },
	{ v9: 'G3-RR-04', v10: 'G10-RR-04' },
	{ v9: 'G3-RR-05', v10: 'G10-RR-05' },
	{ v9: 'G3-RR-06', v10: 'G10-RR-06' },
	{ v9: 'G3-RR-07', v10: 'G10-RR-07' },
	{ v9: 'G3-RR-08', v10: 'G10-RR-08' },
	{ v9: 'G3-RR-09', v10: 'G10-RR-09' }
];

/** ⭐ D3b (8) — a bridge source's version-ten id, by its version-nine one. */
function v10IdOf(v9: string): string {
	const row = BRIDGE_IDS_V10.find((r) => r.v9 === v9);
	if (row === undefined) throw new Error(`${v9} is no bridge source D3b restates`);
	return row.v10;
}

/**
 * A bridge source of version nine, restated by D3b's one rule (decision 5): its request, and each of its types as authored —
 * ⭐ under its new id (D3b (8)).
 */
function restatedV10(source: GraphCase): GraphCase {
	const id = v10IdOf(source.id);
	const withTheStudy = source.input.nodes.some((n) => n.pwuKind === 'OPTIONS_STUDY');
	return {
		...source,
		id,
		input: {
			...source.input,
			prompt: `${source.input.prompt} ${WHO_DOES_THE_WORK}`,
			nodes: source.input.nodes.map((n) => asAuthored(id, n, withTheStudy))
		}
	};
}

/**
 * ⭐ THE BRIDGE SOURCES, RESTATED BY D3b: ~~G3-CLEAN~~ G10-CLEAN, its three renamed copies, and its nine planted twins, in version
 * nine's order — ⭐ each under its new id (D3b (8)).
 */
export const BRIDGE_GRAPHS_V10: readonly GraphCase[] = BRIDGE_GRAPHS_V9.map(restatedV10);

// ── the part cases ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** ⭐ D3b (8) — version ten's bridge sources, each by the version-nine id the part cases it carries name. */
const BRIDGES: ReadonlyMap<string, GraphCase> = new Map(
	BRIDGE_IDS_V10.map((r) => [r.v9, BRIDGE_GRAPHS_V10.find((c) => c.id === r.v10)!])
);

/**
 * One of version nine's part cases, carried: a software one byte for byte; a bridge one under ~~its id,~~ its arm~~, source~~ and
 * subject, its input its source's as D3b restates it, its type, and the bridge library its part is cut with — ⭐ and under its
 * new id, cut from its source under the source's new id (D3b (8)): that id, then the type's place in the source, as version
 * eight named its part cases (`partCaseId`), so `G3-CLEAN.T03` is carried as `G10-CLEAN.T03`.
 */
function carried(c: PwaTypeCase): PwaTypeCase {
	const bridge = BRIDGES.get(c.sourceCaseId);
	return bridge === undefined
		? c
		: {
				...c,
				id: partCaseId(bridge, c.input.typeId),
				sourceCaseId: bridge.id,
				input: { typeId: c.input.typeId, ...bridge.input, policyLibrary: BRIDGE_POLICY_LIBRARY }
			};
}

const PART_CASES_V10: readonly PwaTypeCase[] = CASE_SET_V9.cases
	.filter((c): c is PwaTypeCase => c.arm === 'PWA_TYPE')
	.map(carried);

export const CASE_SET_V10: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v10.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version ten (JAN-EXEC Phase 7, the review in parts, B8b; REG-D-130, ' +
		'REG-D-131, REG-D-132): version nine’s 41 non-part cases, unchanged and under their ids, then its 35 PWA_TYPE part ' +
		'cases in its order — the 16 cut from G7-CLEAN, its planted twins and the 3-level pair unchanged and under their ids, ' +
		'each cut with the policy library the workbench seeds; and the 19 cut from the bridge cases, each under a new id (design ' +
		'D3b (8): a case that changes gets a new id), cut from its source restated as a competent author authors it on today’s ' +
		'surface (design D3b) and renamed with it — G3-CLEAN and its three renamed copies as G10-CLEAN and its copies, G-RR-01 ' +
		'and G3-RR-02 to G3-RR-09 as G10-RR-01 to G10-RR-09, and each part case under its source’s new id, as G10-CLEAN.T03. In ' +
		'the restatement the request assigns the work to the practice’s own engineers but the independent check; each INTERNAL ' +
		'type declares HUMAN discharge and the delegated check none; each type declares the practice’s policies its kind takes, ' +
		'and the checking firm attests Check Independence; four purposes and two hand-offs change; each planted twin is ' +
		'G10-CLEAN but where its plant is; and each is cut with the seeded library and the practice’s six kind-scoped ' +
		'policies, which it carries. Oracles are versioned separately, in ../oracles/. Oracle integrity: no increment that ' +
		'edits the reviewer’s prompt, criteria or scoring edits these cases.',
	caseSetVersion: 10,
	cases: [...CASE_SET_V9.cases.filter((c) => c.arm !== 'PWA_TYPE'), ...PART_CASES_V10]
};
