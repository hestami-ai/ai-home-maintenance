// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the full authoring surface: edit the PWA's details, define / edit / remove PWU Types (with the rich fields —
// completionRule, permitted child types), and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED -> DEPRECATED -> RETIRED. A PUBLISHED PWA version is immutable
// (§11), so every authoring control disappears (and the engine rejects the command) once it is no longer DRAFT.
import { error, fail } from '@sveltejs/kit';
import {
	getObject,
	getObjectOfType,
	listAssurancePolicies,
	listPwuTypes,
	listUndertakings,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import type {
	BoundaryContract,
	CardinalityCode,
	ExecutionBoundary,
	PermittedChildRule
} from '@janumipwb/rph-authoring';
import type { AssessmentCriterion, PromptTemplate } from '@janumipwb/rph-contracts';
import { REVIEWER_RECOMMENDED_ESCALATION } from '@janumipwb/rph-assurance';
import {
	listOrDefault,
	policyEditPatch,
	readPolicyFields,
	successorPolicyPayload
} from './policy-fields';
import { lintComposition, policyPwuKinds } from '@janumipwb/rph-authoring';

const CARDINALITY_CODES: ReadonlySet<CardinalityCode> = new Set(['M1', 'M+', 'C1', 'C+']);
/** Clamp a form-supplied cardinality to a valid code (anything else -> M1, mandatory exactly one). */
function asCardinality(v: string): CardinalityCode {
	return CARDINALITY_CODES.has(v as CardinalityCode) ? (v as CardinalityCode) : 'M1';
}

// The 3 de minimis floor policies (guide §8.4) are LOCKED — always-apply, non-waivable, non-editable. The manager
// shows them read-only; the engine handlers reject any edit/suspend/supersede targeting them.
const FLOOR_POLICY_IDS: ReadonlySet<string> = new Set([
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
]);
import {
	dispatch,
	dispatchBatch,
	getEngine,
	loadConversation,
	mintUiId,
	type ConversationEntry,
	type UiCommandInput
} from '$lib/server/workbench';
import { markersIn } from '@janumipwb/rph-application';
import { loadReviewerAnswer, type ReviewerAnswerView } from '$lib/server/assurance/reviewer-answer';
import { getArtifactStore } from '$lib/server/workbench';
import {
	escalationRecommendationNote,
	floorBlockedHint,
	floorChipLabel,
	loadPwaFloor,
	type CriterionResultView,
	type CriterionTally,
	type FloorObservationView,
	type FloorPartView,
	type FloorPolicyView,
	type FloorView
} from '$lib/server/floor';
import { openDraftOn } from '$lib/server/open-drafts';
import { SESSION_CREDENTIAL } from '$lib/server/identity';
import { readRenderedRevision, refuse, STALE_FORM } from '$lib/server/optimistic-concurrency';
import {
	commitAuthoringTurn,
	discardAuthoringTurn,
	getPendingAuthoringTurn,
	resumeHintText,
	summarizeAuthoringTurn
} from '$lib/server/authoring-turn';
import type { Actions, PageServerLoad } from './$types';

/** The durable authoring transcript, mapped to the agent-log render shape the page consumes. */
type LogEntry = {
	kind: 'status' | 'text' | 'thinking' | 'tool' | 'toolend' | 'error';
	text: string;
	ok?: boolean;
};
function toLogEntry(e: ConversationEntry): LogEntry {
	switch (e.kind) {
		case 'message':
			return { kind: 'text', text: e.role === 'USER' ? `You: ${e.text}` : e.text };
		case 'thinking':
			return { kind: 'thinking', text: e.text };
		case 'tool_call':
			return { kind: 'tool', text: e.text };
		case 'tool_result':
			return { kind: 'toolend', text: e.text, ok: e.success };
		default:
			return { kind: 'error', text: e.text };
	}
}

/**
 * ⭐ `JAN-ESCREC` D3 (`REG-D-090`; the third fix round's re-verifier's finding [7], as the caller ruled) — WHAT A WAIVER WOULD
 * NAME ON A RECORDED FLOOR, ONE SELECTION FOR THE PAGE AND THE ACTION: the first policy that is not SATISFIED, and its first
 * observation that is a finding. `recordWaiver` records against it, and refuses where there is none; the load offers the
 * waiver form only where there is one (`hasWaiverTarget`). ⛔ ONE FUNCTION, NEVER TWO COPIES: the form was offered on
 * publication status alone, so beside a review whose only observation is the reviewer's recommendation — every ESCALATED
 * review, and an incomplete one its reviewer escalated — the page offered "Record accepted risk" and the action refused it.
 * `waiver-target-recommendation.test.ts` holds the load's answer to the action's outcome.
 */
function waiverTargetOf(floor: FloorView | undefined): {
	readonly blocking: FloorPolicyView | undefined;
	readonly finding: FloorObservationView | undefined;
} {
	const blocking = floor?.policies.find((p) => p.disposition !== 'SATISFIED');
	if (!blocking) return { blocking, finding: undefined };
	// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — NEVER THE REVIEWER'S RECOMMENDATION. A reasoning review carries
	// `REVIEWER_RECOMMENDED_ESCALATION` whenever its reviewer recommended ESCALATED: ALONE on the clean review rule (a)
	// escalates, and after the review's own observations elsewhere. It names no criterion and no deficiency, so a waiver
	// naming it as its `waivedCriterionId` would record accepted risk against a recommendation. This took
	// `observations[0]`; it now takes the first observation that is a finding, and a review that recorded none has no
	// target. ⭑ IMPORTED, never restated (`verif/validator-failure-codes-imported.test.ts`).
	const finding = blocking.observations.find((o) => o.code !== REVIEWER_RECOMMENDED_ESCALATION);
	return { blocking, finding };
}

/** ⭐ The review in parts, B5 — one type's own review, as the inspector shows it under that type (`typeReviewOf`). */
interface TypeReviewView {
	readonly typeId: string;
	readonly typeName: string;
	readonly semanticVersion: number;
	/** The part's disposition in the shown round; `MISSING` where the round holds no review of the type at this version. */
	readonly disposition: string;
	/** False for a `MISSING` part: the round holds no review of the type, so nothing below was recorded. */
	readonly reviewed: boolean;
	readonly criteria?: CriterionTally;
	/**
	 * ⭐ Package C's check (roadmap 9a.6, "criterion results") — each criterion the part's review recorded, by its id: its result,
	 * and what a test stipulated beside it. Absent for a `MISSING` part.
	 */
	readonly criterionResults?: readonly CriterionResultView[];
	/**
	 * The part's observations, save the reviewer's recommendation, which `escalationRecommended` says: each one's statement,
	 * ⭐ (package C's check) and its code — the criterion a finding faults, or an observation's own code where it faults none.
	 */
	readonly findings: readonly { readonly code: string; readonly statement: string }[];
	readonly escalationRecommended: boolean;
	/** The reviewer's answer of this part's review, joined to its subject and the round's token; absent where none is recorded. */
	readonly answer?: ReviewerAnswerView;
}

/**
 * ⭐⭐ The review in parts, B5 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D7; roadmap 9a.6) — ONE TYPE'S OWN REVIEW, AS THE
 * INSPECTOR SHOWS IT UNDER THAT TYPE: the part the shown round holds of it (`FloorView.parts`) — its disposition, or `MISSING`
 * where the round holds no review of the type at its stored version; its criteria, evaluated and stipulated ⭐ (package C's
 * check) and each one's own result; its findings, each observation its review recorded, with its code, save the reviewer's
 * recommendation, which is said beside them; and its reviewer's answer (`loadReviewerAnswer`). ⛔ Each from the type's own
 * part, whose observations carry the type their assessment was recorded under — never from the floor's Reasoning Review row,
 * which folds every part (`partsDisposition`), and never from the reviewer's prose, which may name any type.
 */
function typeReviewOf(part: FloorPartView, answer: ReviewerAnswerView | undefined): TypeReviewView {
	const recommendation = (o: FloorObservationView): boolean => o.code === REVIEWER_RECOMMENDED_ESCALATION;
	return {
		typeId: part.typeId,
		typeName: part.typeName,
		semanticVersion: part.semanticVersion,
		disposition: part.disposition,
		reviewed: part.disposition !== 'MISSING',
		...(part.criteria === undefined ? {} : { criteria: part.criteria }),
		...(part.criterionResults === undefined ? {} : { criterionResults: part.criterionResults }),
		findings: part.observations.filter((o) => !recommendation(o)).map((o) => ({ code: o.code, statement: o.statement })),
		escalationRecommended: part.observations.some(recommendation),
		...(answer === undefined ? {} : { answer })
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const canonicalEngine = getEngine();
	const candidate = getPendingAuthoringTurn(params.id);
	const engine = candidate?.engine ?? canonicalEngine;
	// TYPED, not merely existent (REG-F-201). A type-blind read here was WORSE than at the
	// Undertaking Workbench: publicationStatus exists only on PWAs, so line ~192's ?? 'DRAFT'
	// FABRICATED a draft status for any other object and unlocked the full authoring surface — more
	// editing surface on a non-PWA than on the real PWA, which is PUBLISHED and correctly shows none.
	const pwa = getObjectOfType(engine, 'PROFESSIONAL_WORK_ARCHITECTURE', params.id);
	if (!pwa) throw error(404, 'PWA not found');
	// ── THE REVISION FOR PER-4 COMES FROM CANONICAL, AND THE DISPLAY STATE MAY NOT ──────────────────────────
	// This loader is the only one in the app that can read from a FORK: with an agent candidate staged, `engine`
	// above is `candidate.engine`, a snapshot overlay whose revisions for the same aggregate ids are NOT
	// canonical's. Every action on this page dispatches through `dispatch()` -> `getEngine()`, i.e. CANONICAL.
	//
	// So a fork-sourced revision would be an expectation about a store the command never touches — which either
	// conflicts spuriously or, far worse, happens to match and protects nothing. The expectation must describe
	// THE STORE THE COMMAND WILL HIT, so it is read from `canonicalEngine` explicitly.
	//
	// This is NOT the re-fetched tautology REG-F-050 records: the read happens HERE, at render, and a canonical
	// write between this load and the submit still conflicts. What makes a revision meaningless is being read
	// at DISPATCH time, not being read from the store the dispatch targets.
	//
	// `undefined` is a safe outcome rather than a hole: the template then renders an empty value, the strict
	// parser returns null, and the action fails closed.
	const pwaRevision = canonicalEngine.loadObject(params.id)?.revision;
	// Conformance fixtures (§13/§21): Undertakings instantiated from this PWA that serve as reference fixtures.
	const fixtures = listUndertakings(canonicalEngine)
		.filter((u) => u.state.pwaId === params.id)
		.map((u) => ({
			id: u.id,
			name: String((u.state.name ?? u.id) as string),
			isReferenceFixture: u.id === SEED_UNDERTAKING
		}));
	const types = listPwuTypes(engine, params.id).map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string),
		purpose: String((t.state.purpose ?? '') as string),
		isRoot: Boolean(t.state.isRoot),
		completionRule: String((t.state.completionRule ?? '') as string),
		permittedChildTypeIds: Array.isArray(t.state.permittedChildTypeIds)
			? (t.state.permittedChildTypeIds as string[])
			: [],
		permittedChildren: Array.isArray(t.state.permittedChildren)
			? (t.state.permittedChildren as PermittedChildRule[])
			: [],
		requiredInputs: Array.isArray(t.state.requiredInputs)
			? (t.state.requiredInputs as string[])
			: [],
		requiredOutputs: Array.isArray(t.state.requiredOutputs)
			? (t.state.requiredOutputs as string[])
			: [],
		requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
			? (t.state.requiredAssurancePolicyIds as string[])
			: [],
		// STD-2/STD-3 (DWP-05): the resolved execution boundary (absent ⇒ INTERNAL) + the delegated contract, so the
		// form pre-fills, the inspector shows the boundary/leaf-kind, and the card rail (DWP-06) can condition itself.
		executionBoundary: (t.state.executionBoundary === 'DELEGATED_EXTERNAL'
			? 'DELEGATED_EXTERNAL'
			: 'INTERNAL') as ExecutionBoundary,
		boundaryContract: t.state.boundaryContract as BoundaryContract | undefined,
		// JAN-PROMPT — projected so the editor can SHOW the prompt, not merely accept one. A field the page
		// can write and cannot read back is the sponsor's original complaint with the arrow reversed.
		promptTemplate: t.state.promptTemplate as PromptTemplate | undefined,
		// ⭑ PROJECTED SO THE EDITOR CAN SHOW THE GAP. The whole point of JAN-DISCHARGE is that "nobody has
		// decided" stops being invisible; a field the page can write and cannot read back keeps it invisible.
		workDischarge: t.state.workDischarge as 'MODEL' | 'HUMAN' | 'UNDECLARED' | undefined
	}));
	// The engine's Assurance Policy library (real ASSURANCE_POLICY objects): the manager lists these, the PWU-type
	// picker offers the ACTIVE non-floor ones, and the rail resolves ids to names. Floor policies are flagged locked.
	const policies = listAssurancePolicies(engine).map((p) => ({
		id: p.id,
		// The revision this row was rendered from (JPWB-DOC-003 §9 PER-4). `listAssurancePolicies` goes straight
		// to `listByType` with NO `withinScope` (queries.ts:198-199), so the row reaches here with its revision
		// intact and this `.map()` was the only place it was dropped — the fourth loader with that shape.
		//
		// ⚠ THESE MAY BE FORK REVISIONS, and unlike the PWA above they are NOT re-read from canonical. See the
		// note on `pwaRevision`: with a candidate staged, `engine` is the authoring fork. The agent broker has
		// no command that mutates an EXISTING policy (its only policy command is `CreateAssurancePolicy`,
		// broker.ts:336), so a policy already in the base snapshot cannot drift inside the fork — its revision
		// is canonical's. A policy CREATED in the fork is the case this does not cover, and it is handled by
		// failing closed rather than by a revision: it does not exist in canonical at all, so the dispatch is
		// refused for non-existence before any revision is compared. Recorded because the refusal code is then
		// RPH_VALIDATION_SEMANTIC_FAILED, which is neither STALE_FORM nor a conflict — see the roadmap §5b.
		revision: p.revision,
		name: String((p.state.name ?? p.id) as string),
		purpose: String((p.state.purpose ?? '') as string),
		rationale: String((p.state.rationale ?? '') as string),
		version: String((p.state.version ?? '') as string),
		status: String((p.state.status ?? 'DRAFT') as string),
		// The three ratified ARRAYS. ⚠ THIS COMMENT USED TO SAY THEY ARE *"rendered for a comma-separated text
		// input"*, AND THAT SENTENCE IS HOW EG-04's DEFECT SURVIVED EIGHT WEEKS OF REVIEW. Two of the three are
		// rendered as single <select>s; `applicableObjectTypes` is rendered by NOTHING — `name="applicableObjectTypes"`
		// has never appeared in any .svelte file in this repository, and the client's `pf` model drops it. It is
		// projected here and read by no control, which is EG-05's subject; what EG-04 fixes is that saving the form
		// no longer WRITES BACK an empty scope for it.
		// Joined EXPLICITLY: `String(['A','B'])` also yields 'A, B'-ish, but only by accident of Array.toString —
		// it silently produces 'A,B' with no space and would quietly do something else for any non-array value.
		evaluatedClaimTypes: joinList(p.state.evaluatedClaimTypes),
		evaluatorRole: String((p.state.evaluatorRole ?? '') as string),
		independenceRequirement: String((p.state.independenceRequirement ?? '') as string),
		applicableObjectTypes: joinList(p.state.applicableObjectTypes),
		permittedControlActions: joinList(p.state.permittedControlActions),
		// `description` per DOC-004 §7 — this read `c.statement`, the invented field's name.
		//
		// This projection is LOSSY BY CONSTRUCTION and that is now handled, not claimed away: the textarea shows
		// one line per criterion, so §7's other seven fields (name, severity, criterionType, …) never reach the
		// form. `editPolicy` therefore hands the STORED criteria back to `readPolicyFields`, which reuses any
		// whose description is unchanged — otherwise a save silently destroyed the seeded `name` and reset every
		// `severityIfNotMet` to BLOCKING. (An earlier version of this comment called the round-trip "lossless";
		// adversarial review proved it was not — see policy-fields.ts / policy-round-trip.test.ts.)
		criteria: Array.isArray(p.state.criteria)
			? (p.state.criteria as Array<{ description?: unknown }>).map((c) =>
					String((c.description ?? '') as string)
				)
			: [],
		isFloor: FLOOR_POLICY_IDS.has(p.id),
		// ⭐ `REG-F-524` (`REG-D-121` Q18) — the PWU kinds the policy governs, read as the broker's policy view reads them,
		// so the picker shows the author the kinds a policy governs; undefined for a policy that names none.
		pwuKinds: policyPwuKinds(p.state)
	}));
	// ⭑⭑ JAN-EXECGOV EG-07c — `lint.ts`'s own header says *"The agent runs this on itself (the
	// review_composition tool) and fixes findings; A HUMAN CAN READ THE SAME LIST."* That last clause was
	// FALSE: measured, its only production caller was `agent/tools.ts`, so the advisory was authored for a
	// human and consumed only by the agent. That is `EG-06`'s dead help string with the arrow reversed — the
	// third such inversion this programme has found in two days. This makes the sentence true.
	//
	// ⚠ SAME FUNCTION, NOT A SECOND OPINION. The professional and the agent must read the SAME findings, or
	// the surface acquires a view of composition quality that the agent cannot see and cannot answer.
	const composition = lintComposition(
		types.map((t) => ({
			id: t.id,
			name: t.name,
			isRoot: t.isRoot,
			permittedChildTypeIds: t.permittedChildTypeIds,
			...(t.executionBoundary ? { executionBoundary: t.executionBoundary } : {}),
			...(t.requiredOutputs ? { requiredOutputs: t.requiredOutputs } : {}),
			// ⛔ CONDITIONAL, like every other discharge site: absent must stay absent, or "never asked"
			// becomes "asked and deferred" at the very surface that reports the difference.
			...(t.workDischarge ? { workDischarge: t.workDischarge } : {})
		}))
	);
	// The latest recorded assurance floor for this PWA (canonical ASSURANCE_ASSESSMENT/OBSERVATION).
	// The floor RECORDS as well as reads, so it needs a session. It gets the professional's, because the
	// floor is being run on their behalf — and `engine` here may be an authoring FORK, which is why the
	// credential is applied to that handle rather than reaching for the canonical one.
	const floor = loadPwaFloor(params.id, engine.as(SESSION_CREDENTIAL));
	return {
		composition,
		pwa: {
			id: params.id,
			// The canonical revision this page was rendered from (JPWB-DOC-003 §9 PER-4). See the note at the
			// `pwaRevision` read: it is deliberately NOT taken from `engine`, which may be an authoring fork.
			revision: pwaRevision,
			name: String((pwa.name ?? params.id) as string),
			description: String((pwa.description ?? '') as string),
			domain: String((pwa.domain ?? '') as string),
			version: String((pwa.version ?? '') as string),
			publicationStatus: String((pwa.publicationStatus ?? 'DRAFT') as string)
		},
		types,
		fixtures,
		policies,
		// §9.7: private chain-of-thought never enters a default or shared projection. New turns no longer record it
		// (the agent route drops it at the write boundary), and this filter keeps any pre-rule row out of the view.
		conversation: loadConversation(params.id, engine)
			.filter((e) => e.kind !== 'thinking')
			.map(toLogEntry),
		floor,
		// ⭐ `JAN-SELRES` D8 (`REG-F-462`), as revised in RS-3 — WHICH SENTENCE THE BLOCKED HINT READS (`floorBlockedHint`):
		// revise the graph; revising does not address it; or revise the graph for the floor's findings against it AND run
		// the review again; ⭐ or (`JAN-ESCREC` D3, `REG-D-090`) the review was escalated, is routed to a human whose review
		// this workbench cannot record yet (`REG-F-474`), and revising does not address it — which
		// `authoring-route-escalated-review.test.ts` holds to the fork too. Answered ONCE, here, over the floor above: the
		// one the panel shows. ⛔ THAT FLOOR, NOT
		// CANONICAL'S. In the product a failed, refused or incomplete review reaches this page only through a staged
		// candidate's FORK — the floor runs on an authoring turn (`agent/+server.ts`), and only a satisfied candidate is
		// accepted — so canonical holds no floor beside it (`authoring-route-substituted-reviewer.test.ts` holds this read
		// to the fork, for each of the three answers). The blocked hint renders from this answer and restates no code, no
		// action and no policy. It said "revise the graph and re-run" beside every unsatisfied floor, where the floor's own
		// guidance for a failed review says not to revise the PWA. `undefined` when no floor is recorded, and beside a
		// satisfied one.
		floorBlockedHint: floor === undefined ? undefined : floorBlockedHint(floor),
		// ⭐ `JAN-ESCREC` D3 (`REG-D-089`; the ER-1 app verifier's finding [7], and its re-verifier's [0]) — AND WHAT THE PANEL
		// SAYS WHEN THE REVIEWER ALSO RECOMMENDED ESCALATION (`escalationRecommendationNote`): WHICH of two informational
		// sentences — beside the findings, or with an incomplete review — never whether one. A boolean here once put "beside
		// the findings, which are addressed first" beside an incomplete review that had none. `undefined` where the hint
		// already routes the review to a human, beside a satisfied floor, where nothing recorded the recommendation, and when
		// no floor is recorded. Answered ONCE, here, over the same floor — the candidate's FORK beside a staged candidate,
		// which `authoring-route-escalated-review.test.ts` holds — keyed on the recommendation's imported code; the template
		// restates nothing.
		escalationRecommendationNote:
			floor === undefined ? undefined : escalationRecommendationNote(floor),
		// ⭐ `JAN-ESCREC` D3 — THE HEADER CHIP'S WORDS (`floorChipLabel`): the aggregate the read-back now passes through,
		// CONDITIONALLY_SATISFIED included, read without the contract's underscore (the ER-1 app verifier's finding [4]).
		// `undefined` when no floor is recorded, and the chip is not rendered then.
		floorChipLabel: floor === undefined ? undefined : floorChipLabel(floor),
		// ⭐ `JAN-ESCREC` D3 (`REG-D-090`; the third fix round's re-verifier's finding [7], as the caller ruled) — WHETHER THE
		// FLOOR ON SCREEN NAMES A FINDING A WAIVER COULD NAME (`waiverTargetOf`, the selection `recordWaiver` records
		// against), so the panel offers its form only beside one. ⚠ Over the floor the panel shows — the candidate's FORK
		// beside a staged one, where the action, which reads canonical, refuses while the draft is open (`DD-4`).
		hasWaiverTarget: waiverTargetOf(floor).finding !== undefined,
		// ⭑ MXREAD-03 — THE REVIEWER'S OWN ANSWER, READ BACK AND VERIFIED. `ASR-11` limb 3 keeps raw output
		// *"for diagnostics"*, and until this call the retention had no reader at all: the record named a
		// storageKey nothing ever resolved (`REG-F-245` (b′)). The bytes are re-hashed before they are shown,
		// so a verified answer is distinguishable from an unchecked one — the point of keeping a hash.
		//
		// ⛔ THE ANSWER ONLY. Volunteered reasoning is `PER-12` material behind `REG-Q-077`, and this view has
		// no field that could carry it: reads are authority-checked nowhere in this system, so the decision
		// cannot be left to a template.
		// ⭐⭐ `JAN-EXEC` P7-6 fix round C, C2 (`REG-F-433`; `REG-F-552`) — AND IT IS THE ANSWER OF THE REVIEW SHOWN ABOVE: joined
		// to `floor`'s own reasoning review by its floor-run token (`reasoningReviewRunToken`), and within that run the reply
		// the review CONCLUDED from (`loadReviewerAnswer`). ⛔ It was the subject's most recent run, so a DISCARDED turn's
		// answer stood beside canonical's floor (the turn's exchanges stay canonical; its assessments died with the fork).
		// ⛔ READ FROM CANONICAL, NOT `engine`: a turn's floor runs on the fork but drains its exchanges to canonical, and the
		// fork is a point-in-time snapshot holding none of them — so beside a staged candidate the page showed the run
		// BEFORE the turn (`pwa-reviewer-answer-join.test.ts` holds all three).
		reviewerAnswer: await loadReviewerAnswer(
			params.id,
			floor?.reasoningReviewRunToken,
			canonicalEngine.as(SESSION_CREDENTIAL),
			getArtifactStore()
		),
		// ⭐ The review in parts, B3 (`REG-D-125`; design D6, D7) — AND EACH TYPE'S, its part's answer: joined to the part's own
		// subject and the shown round's token, from CANONICAL as the one above is. ⚠ The PWA itself records no reviewer call
		// once its review is in parts, so the answer above is absent beside such a floor; ~~the panel renders these under each
		// type once the inspector shows the parts (roadmap 9a.6, B5)~~ ⭐⭐ B5 (roadmap 9a.6) — so each type's own review is read
		// here whole, its answer with it (`typeReviewOf`), one per part of the shown round in the export's order: the inspector
		// renders it under that type, and the floor panel lists them beside the PWA's policies.
		typeReviews: await Promise.all(
			(floor?.parts ?? []).map(async (part) =>
				typeReviewOf(
					part,
					await loadReviewerAnswer(
						part.typeId,
						floor?.reasoningReviewRunToken,
						canonicalEngine.as(SESSION_CREDENTIAL),
						getArtifactStore()
					)
				)
			)
		),
		// A pending fork is a PREVIEW. The graph/transcript/floor above read it, while this flag makes the authority
		// boundary explicit to the browser and supplies the exact hash required by the accept action.
		authoringTurn: candidate ? summarizeAuthoringTurn(candidate) : undefined,
		// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — THE RESUME BANNER'S SENTENCE, answered ONCE, here, from the same summary
		// (`resumeHintText`): it names an escalation as one, and says refining re-runs the same automated reviewer
		// (`REG-F-474`). The banner renders it in one interpolation and composes nothing (the ER-1 app verifier's finding
		// [6]: composed in the template, the escalated branch had no test). `undefined` with no staged candidate, and for
		// a status the page offers no resume for.
		resumeHint: candidate ? resumeHintText(summarizeAuthoringTurn(candidate)) : undefined
	};
};

interface TypeFields {
	name: string;
	pwuKind: string;
	purpose: string;
	completionRule: string;
	isRoot: boolean;
	permittedChildTypeIds: string[];
	permittedChildren: PermittedChildRule[];
	requiredInputs: string[];
	requiredOutputs: string[];
	requiredAssurancePolicyIds: string[];
	executionBoundary: ExecutionBoundary;
	/** Present iff executionBoundary is DELEGATED_EXTERNAL (STD-3). */
	boundaryContract?: BoundaryContract;
	/** JAN-PROMPT / REG-D-058 — the runtime asset the type OWNS. Absent when the author wrote no prompt, which
	 *  is TRUE of every type that exists today and is a fact rather than a placeholder. */
	promptTemplate?: PromptTemplate;
	/** JAN-DISCHARGE — who does this work, said out loud. Absent means the author was never asked (a type
	 *  predating the question); 'UNDECLARED' means they were asked and deferred. Different facts, both kept. */
	workDischarge?: 'MODEL' | 'HUMAN' | 'UNDECLARED';
}

/** Render a stored ratified-array field into the comma-separated text input the policy form uses. */
function joinList(v: unknown): string {
	return Array.isArray(v) ? (v as unknown[]).map(String).join(', ') : String((v ?? '') as string);
}

/** Split a comma/newline-separated artifact list from a form field into a clean string[]. */
function csv(v: FormDataEntryValue | null): string[] {
	return String((v ?? '') as string)
		.split(/[\n,;]/)
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Read the shared PWU-Type authoring fields from a form (used by both defineType and editType). Per-child
 *  cardinality is posted as `cardinality:<childId>` / `applicability:<childId>` alongside the child checkbox. */
function readTypeFields(form: FormData): TypeFields {
	// STD-2: resolve the execution boundary (absent/garbage ⇒ INTERNAL). The engine is the hard INV-1 gate, but the
	// write boundary enforces the symmetric coherence HERE so a client cannot post an incoherent shape: a
	// DELEGATED_EXTERNAL node is terminal (children cleared, contract assembled); an INTERNAL node carries no
	// contract (the form hides the opposite block, but the server must not trust the DOM).
	const executionBoundary: ExecutionBoundary =
		String((form.get('executionBoundary') ?? '') as string) === 'DELEGATED_EXTERNAL'
			? 'DELEGATED_EXTERNAL'
			: 'INTERNAL';
	const delegated = executionBoundary === 'DELEGATED_EXTERNAL';
	const permittedChildTypeIds = delegated
		? []
		: (form.getAll('permittedChildTypeIds') as string[]).map(String).filter(Boolean);
	const permittedChildren: PermittedChildRule[] = permittedChildTypeIds.map((typeId) => {
		const cardinality = asCardinality(String((form.get(`cardinality:${typeId}`) ?? '') as string));
		const note = String((form.get(`applicability:${typeId}`) ?? '') as string).trim();
		return { typeId, cardinality, ...(note ? { applicabilityNote: note } : {}) };
	});
	let boundaryContract: BoundaryContract | undefined;
	if (delegated) {
		const applicabilityNote = String(
			(form.get('boundaryApplicabilityNote') ?? '') as string
		).trim();
		boundaryContract = {
			counterpartyLabel: String((form.get('counterpartyLabel') ?? '') as string).trim(),
			attestedAssurancePolicyIds: (form.getAll('attestedAssurancePolicyIds') as string[])
				.map(String)
				.filter(Boolean),
			...(applicabilityNote ? { applicabilityNote } : {})
		};
	}
	// ⭑ JAN-PROMPT — PARSED HERE, IN THE READER BOTH ACTIONS SHARE. Reading it separately in `defineType` and
	// `editType` is how two paths drift: the sponsor's original complaint was a field with no screen, and a
	// field savable on create but not on edit is the same complaint with an extra step.
	//
	// ⚠ `declaredPlaceholders` IS DERIVED FROM THE TEXT, NOT ASKED FOR. Making an author list them by hand
	// creates exactly the drift the render guard exists to refuse — they would type `{subject}` and forget to
	// declare it, and the prompt would be unrenderable at the moment it mattered. The closed list is still
	// enforced downstream; this just stops the UI manufacturing violations.
	// ⭑ THE DECLARATION IS READ BEFORE THE TEMPLATE, because it decides whether a template means anything.
	// An empty posted value is ABSENT rather than UNDECLARED: the form always offers the question, so a blank
	// can only come from a client that did not render it, and inventing "deferred" on that basis would put an
	// answer in the professional's mouth.
	const rawDischarge = String((form.get('workDischarge') ?? '') as string).trim();
	const workDischarge =
		rawDischarge === 'MODEL' || rawDischarge === 'HUMAN' || rawDischarge === 'UNDECLARED'
			? rawDischarge
			: undefined;

	const templateText = String((form.get('promptTemplateText') ?? '') as string).trim();
	const promptTemplate: PromptTemplate | undefined = templateText
		? {
				templateText,
				templateVersion: Number(form.get('promptTemplateVersion') ?? 1) || 1,
				declaredPlaceholders: markersIn(templateText),
				...(String((form.get('promptOutputContract') ?? '') as string).trim()
					? { outputContract: String(form.get('promptOutputContract') as string).trim() }
					: {}),
				// ACTIVE only when the author says so. A DRAFT template is authored text, not an approved
				// instruction, and `renderPromptTemplate` refuses it.
				status: form.has('promptActive') ? 'ACTIVE' : 'DRAFT'
			}
		: undefined;
	return {
		...(workDischarge ? { workDischarge } : {}),
		promptTemplate,
		name: String((form.get('name') ?? '') as string).trim(),
		pwuKind: String((form.get('pwuKind') ?? '') as string)
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_|_$/g, ''),
		purpose: String((form.get('purpose') ?? '') as string).trim(),
		completionRule: String((form.get('completionRule') ?? '') as string).trim(),
		isRoot: form.has('isRoot'),
		permittedChildTypeIds,
		permittedChildren,
		requiredInputs: csv(form.get('requiredInputs')),
		requiredOutputs: csv(form.get('requiredOutputs')),
		requiredAssurancePolicyIds: (form.getAll('requiredAssurancePolicyIds') as string[])
			.map(String)
			.filter(Boolean),
		executionBoundary,
		boundaryContract
	};
}

/** Validate only policy references newly introduced by an authoring operation. Existing references may be retained
 *  or explicitly removed even when a policy later becomes SUSPENDED/SUPERSEDED; otherwise an unrelated edit would
 *  silently strip the historical declaration. */
function policyReferenceError(
	requestedPolicyIds: readonly string[],
	existingPolicyIds: readonly string[] = []
): string | undefined {
	const existing = new Set(existingPolicyIds);
	const policies = new Map(listAssurancePolicies(getEngine()).map((p) => [p.id, p.state]));
	for (const policyId of requestedPolicyIds) {
		if (existing.has(policyId)) continue;
		if (FLOOR_POLICY_IDS.has(policyId)) {
			return `The locked floor policy ${policyId} always applies and must not be referenced explicitly.`;
		}
		const policy = policies.get(policyId);
		if (!policy) return `Assurance Policy ${policyId} does not exist.`;
		const status = String((policy.status ?? 'DRAFT') as string);
		if (status !== 'ACTIVE') {
			return `Assurance Policy ${String((policy.name ?? policyId) as string)} is ${status}; only ACTIVE policies may be newly referenced.`;
		}
	}
	return undefined;
}

/** Bump a semantic version string's minor (1.2.3 -> 1.3.0); falls back to a `-v2` suffix for non-semver. */
function bumpVersion(v: string): string {
	const parts = v.split('.').map((n) => Number.parseInt(n, 10));
	if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
		return `${parts[0]}.${parts[1] + 1}.0`;
	}
	return `${v}-v2`;
}

/** One row of the PWU-Type query, named so the version-migration helpers below can take it by type. */
type PwuTypeRow = ReturnType<typeof listPwuTypes>[number];

/** Every live PWU Type that declares `policyId`, together with the subset whose owning PWA is still DRAFT.
 *  Only the DRAFT-owned ones may have their reference migrated; the rest stay pinned to the historical id.
 *  The query is workspace-wide (no pwaId), so these rows were never rendered by the policy manager. */
function collectPolicyReferences(policyId: string) {
	const referencingTypes = listPwuTypes(getEngine()).filter(
		(t) =>
			Array.isArray(t.state.requiredAssurancePolicyIds) &&
			(t.state.requiredAssurancePolicyIds as string[]).includes(policyId)
	);
	const draftReferences = referencingTypes.filter((type) => {
		const ownerId = String((type.state.pwaId ?? '') as string);
		const owner = ownerId ? getObject(getEngine(), ownerId) : undefined;
		return owner?.publicationStatus === 'DRAFT';
	});
	return { referencingTypes, draftReferences };
}

/** Repoint each DRAFT-owned reference from the predecessor policy to its successor, leaving that type's other
 *  declared policy ids exactly as they were. */
function migrateReferenceCommands(
	draftReferences: readonly PwuTypeRow[],
	policyId: string,
	successorId: string
): UiCommandInput[] {
	return draftReferences.map((type) => {
		const declared = type.state.requiredAssurancePolicyIds as string[];
		return {
			commandType: 'EditPwuType',
			targetAggregateType: 'PWU_TYPE',
			targetAggregateId: type.id,
			payload: {
				pwuTypeId: type.id,
				requiredAssurancePolicyIds: declared.map((id) => (id === policyId ? successorId : id))
			}
		};
	});
}

/**
 * Surface a rolled-back policy-versioning batch.
 *
 * `refuse` rather than a bare fail(400): a rejected element carries its own CommandResult, and a per-command
 * revision conflict surfaces there as status CONFLICT (only `dispatchBatchGuarded` reports a batch-level
 * `guardConflict`). Forwarding it unconditionally as 400 would erase the one distinction this wiring exists
 * to make.
 */
function refuseBatch(batch: ReturnType<typeof dispatchBatch>) {
	const rejected = batch.failedIndex === undefined ? undefined : batch.results[batch.failedIndex];
	if (rejected) return refuse(rejected);
	return fail(400, { error: 'Policy versioning was rejected and rolled back.' });
}

/**
 * Advance the PWA publication FSM and surface any engine rejection to the form.
 *
 * `expectedRevision` is REQUIRED, not optional. Every caller updates an existing PWA — none of the five
 * lifecycle acts is a creation — so PER-4 applies to all of them and an optional parameter would be an
 * invitation to omit it silently at one call site. Making it required puts the enforcement in the type checker
 * rather than in a reviewer, which is the same lesson `withinScope`'s mandatory scope argument records
 * (packages/rph-engine/src/queries.ts:60-72) after an optional one was duly omitted four times over.
 */
function advancePwa(
	commandType: string,
	pwaId: string,
	payload: Record<string, unknown>,
	expectedRevision: number
) {
	const r = dispatch(
		commandType,
		'PROFESSIONAL_WORK_ARCHITECTURE',
		pwaId,
		payload,
		expectedRevision
	);
	// `refuse` rather than a bare fail(400): this dropped `r.error.code`, so a CONFLICT was indistinguishable
	// from a state-machine refusal — and once a revision is declared, telling those two apart is the only
	// evidence the surface can offer about why the act did not happen.
	if (r.status !== 'ACCEPTED') return refuse(r);
	return { advanced: commandType };
}

export const actions: Actions = {
	// Explicit human acceptance of the exact assured preview. The manager performs the revision/event-position guard,
	// command replay, and resultant-state postconditions in one canonical transaction.
	acceptAgentCandidate: async ({ request, params }) => {
		const turn = getPendingAuthoringTurn(params.id);
		if (!turn) return fail(404, { error: 'No staged agent candidate exists.' });
		const acceptedHash = String(
			((await request.formData()).get('candidateHash') ?? '') as string
		).trim();
		try {
			const result = commitAuthoringTurn(turn, acceptedHash);
			if (!result.ok) return fail(409, { error: result.detail, candidateStatus: result.status });
			return { acceptedCandidate: result.candidateHash };
		} catch (error_) {
			return fail(409, {
				error: error_ instanceof Error ? error_.message : String(error_)
			});
		}
	},

	// Pre-commit rollback is discard of the overlay, not Event deletion or semantic compensation.
	discardAgentCandidate: ({ params }) => {
		try {
			if (!discardAuthoringTurn(params.id)) {
				return fail(404, { error: 'No staged agent candidate exists.' });
			}
			return { discardedCandidate: true };
		} catch (error_) {
			return fail(409, {
				error: error_ instanceof Error ? error_.message : String(error_)
			});
		}
	},

	// Edit the DRAFT PWA's own details (name/description/domain).
	editDetails: async ({ request, params }) => {
		const form = await request.formData();
		const name = String((form.get('name') ?? '') as string).trim();
		if (!name) return fail(400, { error: 'A PWA name is required.' });
		const r = dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', params.id, {
			pwaId: params.id,
			name,
			description: String((form.get('description') ?? '') as string).trim(),
			domain: String((form.get('domain') ?? '') as string).trim()
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedPwa: params.id };
	},

	// Define a reusable PWU Type on this (DRAFT) PWA — with the full field set (kind/purpose/root/completion/children).
	defineType: async ({ request, params }) => {
		const f = readTypeFields(await request.formData());
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const policyError = policyReferenceError(f.requiredAssurancePolicyIds);
		if (policyError) return fail(400, { error: policyError });
		// R-10 (D-C Option 1 parity): attested policy ids obey the same ACTIVE/non-floor rule as declared ones.
		if (f.boundaryContract) {
			const attestError = policyReferenceError(f.boundaryContract.attestedAssurancePolicyIds);
			if (attestError) return fail(400, { error: attestError });
		}
		const id = mintUiId('pwut');
		const r = dispatch('DefinePwuType', 'PWU_TYPE', id, {
			pwuTypeId: id,
			pwaId: params.id,
			pwuKind: f.pwuKind,
			name: f.name,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			permittedChildren: f.permittedChildren,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs,
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds,
			executionBoundary: f.executionBoundary,
			...(f.boundaryContract ? { boundaryContract: f.boundaryContract } : {}),
			...(f.promptTemplate ? { promptTemplate: f.promptTemplate } : {}),
			...(f.workDischarge ? { workDischarge: f.workDischarge } : {})
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},

	// Edit an existing PWU Type in place (DRAFT PWA only — the engine enforces this).
	editType: async ({ request, params }) => {
		const form = await request.formData();
		const pwuTypeId = String((form.get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const stored = getObject(getEngine(), pwuTypeId);
		if (stored?.pwaId !== params.id) return fail(400, { error: 'PWU Type not found on this PWA.' });
		const f = readTypeFields(form);
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const existingPolicyIds = Array.isArray(stored.requiredAssurancePolicyIds)
			? (stored.requiredAssurancePolicyIds as string[])
			: [];
		const policyError = policyReferenceError(f.requiredAssurancePolicyIds, existingPolicyIds);
		if (policyError) return fail(400, { error: policyError });
		// R-10: validate attested ids, retaining the type's pre-existing attested declarations (an unrelated edit
		// must not re-reject a since-deactivated attested policy).
		if (f.boundaryContract) {
			const existingAttested =
				(stored.boundaryContract as { attestedAssurancePolicyIds?: string[] } | undefined)
					?.attestedAssurancePolicyIds ?? [];
			const attestError = policyReferenceError(
				f.boundaryContract.attestedAssurancePolicyIds,
				existingAttested
			);
			if (attestError) return fail(400, { error: attestError });
		}
		const r = dispatch('EditPwuType', 'PWU_TYPE', pwuTypeId, {
			pwuTypeId,
			name: f.name,
			pwuKind: f.pwuKind,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			permittedChildren: f.permittedChildren,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs,
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds,
			executionBoundary: f.executionBoundary,
			...(f.boundaryContract ? { boundaryContract: f.boundaryContract } : {}),
			...(f.promptTemplate ? { promptTemplate: f.promptTemplate } : {}),
			...(f.workDischarge ? { workDischarge: f.workDischarge } : {})
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedType: pwuTypeId };
	},

	// Remove a PWU Type (DRAFT only). Referential integrity + the DRAFT guard are enforced by the engine
	// (RemovePwuType) — this just surfaces any rejection.
	removeType: async ({ request }) => {
		const pwuTypeId = String(((await request.formData()).get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const r = dispatch('RemovePwuType', 'PWU_TYPE', pwuTypeId, { pwuTypeId });
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { removedType: pwuTypeId };
	},

	// ── THE FIVE PUBLICATION-LIFECYCLE ACTS ─────────────────────────────────────────────────────────────────
	// Each updates the PWA aggregate itself, so PER-4 binds all five. They took no `request` at all before this
	// and their forms posted ZERO fields — not even an id, because `params.id` supplied the subject. Declaring
	// the revision is therefore the first thing any of them has ever had to read from the submission.
	submitForReview: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('SubmitPwaForReview', params.id, {}, expectedRevision);
	},
	validate: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('ValidatePwa', params.id, {}, expectedRevision);
	},
	// Publish requires a declared root PWU Type (which must have been defined while DRAFT); resolve it server-side.
	publish: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		// ⚠ `root` NAMES A DIFFERENT AGGREGATE AND CONTRIBUTES NO REVISION. It is a PAYLOAD field; the subject
		// of PublishPwa is the PWA. Declaring the root type's revision here would be the subject-identity error
		// PER-4 wiring exists to avoid — an expectation about an object the command does not target.
		const root = listPwuTypes(getEngine(), params.id).find((t) => t.state.isRoot === true);
		if (!root) return fail(400, { error: 'Define a root PWU Type before publishing.' });
		return advancePwa('PublishPwa', params.id, { rootPwuTypeId: root.id }, expectedRevision);
	},
	// Continue the publication FSM past PUBLISHED: PUBLISHED -> DEPRECATED -> RETIRED.
	deprecate: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('DeprecatePwa', params.id, {}, expectedRevision);
	},
	retire: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('RetirePwa', params.id, {}, expectedRevision);
	},

	// Record + grant an auditable governance WAIVER naming the blocking floor policy and the finding it accepts.
	//
	// ⚠ THIS DOES NOT UNBLOCK PUBLISHING, and this docblock used to say it did — "so a non-SATISFIED PWA can
	// PUBLISH — the alternative to revising the graph and re-running the floor" — which is the exact reach ASR-3
	// (JPWB-DOC-003 §Semantic Model, ratified) removed: the de minimis floor is UNCONDITIONAL. `floorGateBlock`
	// consults no waiver, so PublishPwa refuses identically before and after this action succeeds. There is ONE
	// route past the floor and it is revision. This docblock is why the surface above it said what it said, so it
	// is corrected here rather than only in the markup (REG-F-202).
	//
	// It is KEPT, not withdrawn, and that was the sponsor's ruling read carefully: ASR-14 — "a waiver accepts risk;
	// it never rewrites truth" — narrows a waiver's REACH, not its RECORDABILITY. Refusing to record one would be
	// over-refusal. The act mints a real EFFECTIVE WAIVER Decision; what changed is that the surface must not
	// present it as clearing anything.
	recordWaiver: async ({ request, params }) => {
		const rationale = String(((await request.formData()).get('rationale') ?? '') as string).trim();
		if (!rationale) return fail(400, { error: 'A waiver rationale is required.' });
		// ⛔ REFUSED WHILE A DRAFT ON THIS PWA IS OPEN (`JAN-CRITREAD` `DD-4`, `REG-D-070` §5.6). The page renders the
		// DRAFT's floor, but a waiver acts on the CANONICAL floor below — so the professional would be waiving a
		// finding they are not looking at. Read AFTER the form, synchronously with the dispatches below.
		const draft = openDraftOn(params.id);
		if (draft)
			return fail(409, {
				error: `PWA ${params.id} has an open authoring draft (${draft}); the floor on screen is the draft's, not the one a waiver would act on. Accept or discard the draft first.`
			});
		// A waiver must name the EXACT policy and criterion it discharges (DOC-004 §12.2; RPH-GOV-005 forbids
		// bleeding to another criterion). It used to send a free-text scope of "de minimis assurance floor", which
		// the gate honored as a blanket bypass of the WHOLE floor — including a REJECTED independent review. So we
		// derive the target from the RECORDED floor: the blocking policy and the open finding it actually failed on — the
		// one selection the load offers the form by (`waiverTargetOf`), never a second copy of it.
		const { blocking, finding } = waiverTargetOf(loadPwaFloor(params.id));
		if (!blocking) return fail(400, { error: 'Nothing to waive: the floor is not blocking.' });
		if (!finding)
			return fail(400, {
				error: `Cannot waive ${blocking.policyId}: no open finding is recorded for it, and a waiver must name the finding it waives (DOC-004 §12.2).`
			});
		const waiverId = mintUiId('dec');
		const req = dispatch('RequestWaiver', 'DECISION', waiverId, {
			subjectObjectIds: [params.id],
			scope: finding.code,
			rationale,
			duration: 'until superseded',
			affectedObjectIds: [params.id],
			waivedPolicyId: blocking.policyId,
			waivedCriterionId: finding.code,
			// FloorView surfaces an observation's code/severity/statement but not its id — so the finding is named
			// by criterion, not by id, here. Surfacing observation ids through the view is a follow-on.
			waivedFindingIds: [],
			compensatingControls: [],
			reviewConditions: []
		});
		if (req.status !== 'ACCEPTED') return fail(400, { error: req.error?.message ?? req.status });
		const grant = dispatch('GrantWaiver', 'DECISION', waiverId, {
			waiverDecisionId: waiverId,
			duration: 'until superseded'
		});
		if (grant.status !== 'ACCEPTED')
			return fail(400, { error: grant.error?.message ?? grant.status });
		return { waived: waiverId };
	},

	// ── Assurance Policy library management (workbench-wide; not gated by this PWA's draft status) ──────────────
	// Create a new authorable Assurance Policy (DRAFT). The 3 de minimis floor policies are locked and seeded, not
	// created here; a regular policy must be deliberately activated before a PWU Type can declare it.
	createPolicy: async ({ request }) => {
		const f = readPolicyFields(await request.formData());
		if (!f.name) return fail(400, { error: 'A policy name is required.' });
		const id = mintUiId('pol');
		const r = dispatch('CreateAssurancePolicy', 'ASSURANCE_POLICY', id, {
			policyId: id,
			version: '1.0.0',
			name: f.name,
			purpose: f.purpose || f.name,
			rationale: f.rationale || 'Authored in the PWA Designer.',
			// ⛔ ALL THREE OF THESE FALLBACKS WERE DEAD AND TYPE-WRONG. `csvList` returned `string[]`, `[]` is
			// TRUTHY, so `||` never fired — and had it fired it would have sent a STRING to a `z.array(...)` field
			// and been rejected. The dead branch is why every UI-created policy was born with an EMPTY scope, which
			// `governance.ts` reads as applying to EVERYTHING. `listOrDefault` is the same intent, correctly typed.
			applicableObjectTypes: listOrDefault(f.applicableObjectTypes, 'PROFESSIONAL_WORK_UNIT'),
			evaluatedClaimTypes: listOrDefault(f.evaluatedClaimTypes, 'CORRECTNESS'),
			criteria: f.criteria,
			evaluatorRole: f.evaluatorRole || 'reviewer',
			independenceRequirement: f.independenceRequirement || 'DIFFERENT_AGENT',
			findingDefinitions: [],
			permittedControlActions: listOrDefault(f.permittedControlActions, 'ESCALATE')
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { createdPolicy: id };
	},

	// Edit a non-floor, non-superseded policy's content in place (same version).
	editPolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		// Pass the STORED criteria so an unchanged line keeps its id, name and severity. Without this the edit
		// re-mints every criterion from its description and silently destroys both — see readPolicyFields.
		//
		// ⚠ AND THE REVISION IS WHAT MAKES THIS READ SAFE, which is a stronger reason than PER-4's letter. These
		// stored criteria are fetched HERE, after the page was rendered: if the policy changed in between, the
		// edit would merge the professional's form against criteria they never saw. Declaring the rendered
		// revision converts that silent merge into a refusal.
		const stored = getObject(getEngine(), policyId);
		const priorCriteria = Array.isArray(stored?.criteria)
			? (stored.criteria as AssessmentCriterion[])
			: [];
		const f = readPolicyFields(form, priorCriteria);
		const r = dispatch(
			'EditAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{
				policyId,
				// ⛔⛔ ONE GUARD, IN ONE PLACE. This was eight inline spreads holding TWO spellings of one rule three
				// lines apart — `f.applicableObjectTypes ? …` beside `f.criteria.length ? …`. A truthiness test on an
				// ARRAY is never a guard, so the first always patched. See `policyEditPatch`.
				...policyEditPatch(f)
			},
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { editedPolicy: policyId };
	},

	// Promote a new version atomically: create + activate a content-preserving successor, migrate references owned by
	// DRAFT PWAs, then supersede the predecessor. Immutable published definitions remain pinned to the historical
	// policy id; changing them here would rewrite a published PWA, while blocking on them would deadlock policy
	// evolution because their references can never be edited away. Plain policy creation remains DRAFT-first.
	newPolicyVersion: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const prev = getObject(getEngine(), policyId);
		if (!prev) return fail(400, { error: 'Policy not found.' });
		if (FLOOR_POLICY_IDS.has(policyId))
			return fail(400, { error: 'Floor policies cannot be versioned.' });
		const previousStatus = String((prev.status ?? '') as string);
		if (previousStatus !== 'ACTIVE' && previousStatus !== 'SUSPENDED')
			return fail(400, { error: 'Only active or suspended policies can be versioned.' });
		const requested = String((form.get('version') ?? '') as string).trim();
		const newVersion = requested || bumpVersion(String((prev.version ?? '1.0.0') as string));
		const { referencingTypes, draftReferences } = collectPolicyReferences(policyId);
		// ⭑ A PWA WITH AN OPEN AUTHORING DRAFT IS SKIPPED, AND SAID SO (`JAN-CRITREAD` `DD-4`, `REG-D-070` Q4). Refusing
		// the whole action would let one professional's draft block another's act on a DIFFERENT PWA — the interference
		// `REG-D-069` removes. A skipped type keeps the predecessor, as a published PWA's does; a draft that newly
		// referenced the policy is refused at acceptance, naming it.
		const ownerOf = (type: PwuTypeRow) => String((type.state.pwaId ?? '') as string);
		const skippedForOpenDrafts = [
			...new Set(draftReferences.map(ownerOf).filter((pwaId) => openDraftOn(pwaId) !== undefined))
		];
		const migrating = draftReferences.filter((type) => !skippedForOpenDrafts.includes(ownerOf(type)));
		const successorId = mintUiId('pol');
		const commands: UiCommandInput[] = [
			{
				commandType: 'CreateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: successorPolicyPayload(prev, successorId, newVersion)
			},
			{
				commandType: 'ActivateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: { policyId: successorId }
			},
			...migrateReferenceCommands(migrating, policyId, successorId),
			{
				commandType: 'SupersedeAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: policyId,
				payload: { policyId, supersededByPolicyId: successorId },
				// ── THE ONLY PAGE-DERIVABLE EXPECTATION IN THIS BATCH, and it protects far more than itself ──
				// Element 0 MINTS `successorId`, so it did not exist at render and PER-4's NON-EXAMPLE exempts
				// it. Element 1 activates that same brand-new id. Elements 2..n-1 target PWU_TYPEs the policy
				// manager never rendered (`draftReferences` derives from a workspace-wide `listPwuTypes` with no
				// pwaId). This LAST element is the first and only touch of `policyId`, which IS a rendered row.
				//
				// AND BECAUSE `dispatchBatch` RUNS ONE STORE TRANSACTION (command-bus.ts:334-353), a conflict
				// here rolls back element 0 too. That matters: the successor's entire content — name, purpose,
				// rationale, criteria, all six rule arrays — is copied from a `getObject` read taken AFTER the
				// page was rendered. Without this the successor could be minted from a predecessor the
				// professional never saw. One expectation, transitively guarding the whole copy.
				expectedRevision
			}
		];
		const batch = dispatchBatch(commands);
		if (!batch.ok) return refuseBatch(batch);
		return {
			newVersion: successorId,
			migratedReferences: migrating.length,
			pinnedHistoricalReferences: referencingTypes.length - draftReferences.length,
			skippedForOpenDrafts
		};
	},

	// ⚠ THE FORMDATA IS HOISTED, not read inline as `(await request.formData()).get(...)`. Both of these read it
	// twice now (id and revision), and consuming the stream inside an expression made that impossible to add
	// without noticing — which is why the inline shape is worth removing rather than working around.
	suspendPolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'SuspendAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{ policyId },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { suspendedPolicy: policyId };
	},

	// ⚠ THIS IS THE ACT THE E2E DRIVES FIRST, AND IT IS THE ONE A NAIVE PARSER WOULD LET THROUGH. A policy is
	// born DRAFT at revision 0 (`createObject` commits `newRevision: alsoEvents.length`, kit.ts:563) and
	// `policy-manager.e2e.ts` activates it a few lines after creating it. `Number('')` is also 0, so a form that
	// round-tripped nothing would MATCH here and be accepted; only the later suspend (revision 1) would fail.
	// `readRenderedRevision` rejects the empty string for exactly this reason — never a local `Number(raw)`.
	activatePolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'ActivateAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{ policyId },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { activatedPolicy: policyId };
	}
};
