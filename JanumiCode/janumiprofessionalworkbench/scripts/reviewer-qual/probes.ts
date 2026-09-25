// ⭐ `JAN-CRITREAD` J2-3 — THE FINGERPRINT PROBE SET (DESIGN-what-the-tests-prove.md §5.5).
//
// The reviewer fingerprint must move when anything that decides a verdict moves — including a branch of prompt
// assembly that no qualification case exercises. So it hashes the prompts of THESE inputs, chosen to reach every
// branch, and separate from the cases (which are data the sponsor confers; §5.2):
//   · each framing — the graph, the work product, and the process result with each observation kind and its absent
//     report (the process-result arm has no case in version one, `REG-D-072` D17);
//   · the rationale absent (the "NOT DECLARED" instruction fifteen of sixteen lane prompts carried) and present, with an
//     empty list inside it; narration present and absent; prior gaps present; a candidate subject hash;
//   · and, per framing, one probe with ONLY the content oversize and one with EVERY slice oversize at once. The content
//     budget is capped by three terms (`CONTENT_MIN`, `CONTENT_MAX`, the budget left after the scaffolding), and a
//     probe that is oversize in one input reaches only one of them.
//
// ⚠ A PROBE IS NEVER SENT TO A MODEL: only its prompt's hash is kept. Its ids and texts need none of the discipline a
// case needs (§5.2), only stability — a probe that changes moves every fingerprint, deliberately.
// ⭐ THE OVERSIZE LENGTHS ARE DERIVED FROM THE PRODUCT'S OWN BUDGET, so a probe stays oversize when a limit is raised.
import type { AssuranceSubject, ProfessionalRationaleSummary, ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion, ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { buildPwaGraphExport, type PwaGraphNode, type PwaMeta } from '@janumipwb/rph-projections';
import { REASONING_REVIEW_BUDGET } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { graphReviewInput, workProductReviewInput } from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';

export interface FingerprintProbe {
	readonly id: string;
	/** The branch of assembly the probe reaches — for the reader of a moved fingerprint. */
	readonly covers: string;
	/** The input under `criteria` — the fingerprint's own criteria, so a criteria change reaches the rubric. */
	readonly input: (criteria: readonly AssessmentCriterion[]) => ReasoningReviewInput;
}

/** Whom a probe is about. The validator does not read its subject; it is carried because `evaluate` requires one. */
export const PROBE_SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_01M4A7K2QH8X9Z3T5V6W1B0C7D',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'jpwb-fingerprint-probe-author',
		modelId: 'jpwb-fingerprint-probe-author',
		providerId: 'jpwb-fingerprint'
	}
};

/** `sentence` repeated past `limit` characters — an input the budget must cut. */
const over = (limit: number, sentence: string): string =>
	sentence.repeat(Math.ceil((limit + 500) / sentence.length));
const B = REASONING_REVIEW_BUDGET;

const PWA: PwaMeta = {
	id: 'pwa_01M4A7K2QH8X9Z3T5V6W1B0C7D',
	name: 'Retaining Wall Condition Survey',
	domain: 'civil-structural',
	version: '0.1.0',
	publicationStatus: 'DRAFT'
};
const node = (id: string, name: string, pwuKind: string, extra: Partial<PwaGraphNode> = {}): PwaGraphNode => ({
	id,
	name,
	pwuKind,
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	executionBoundary: 'INTERNAL',
	...extra
});
const ROOT_ID = 'pwut_01M4A7K9R2D5F8H1J4K7M0N3P6';
const INSPECT_ID = 'pwut_01M4A7KF3T6V9X2Z5B8D1G4J7K';
const NODES: readonly PwaGraphNode[] = [
	node(ROOT_ID, 'Condition Survey', 'SURVEY', {
		isRoot: true,
		permittedChildTypeIds: [INSPECT_ID],
		requiredOutputs: ['survey-report']
	}),
	node(INSPECT_ID, 'Visual Inspection', 'INSPECTION', { requiredInputs: ['survey-report'] })
];
/** The same graph, with one output name long enough that the export overruns every content budget. */
const OVERSIZE_NODES: readonly PwaGraphNode[] = [
	NODES[0]!,
	node(INSPECT_ID, 'Visual Inspection', 'INSPECTION', {
		requiredOutputs: [over(B.CONTENT_MAX, 'crack-width-and-displacement-record-per-panel-')]
	})
];

const INTENT = 'Survey the condition of a 60 m masonry retaining wall and report defects by panel.';
const RATIONALE: ProfessionalRationaleSummary = {
	rationale: 'The survey is split into a desk study and a visual inspection, which reads the desk study.',
	assumptions: ['Access to the toe of the wall is available on the survey day.'],
	limitations: [],
	residualUncertainty: ['Drainage behind the wall is not observable without intrusive works.']
};
const OVERSIZE_RATIONALE: ProfessionalRationaleSummary = {
	rationale: over(B.RATIONALE_MAX, 'The survey is split into a desk study and a visual inspection. '),
	assumptions: ['Access to the toe of the wall is available.'],
	limitations: ['No intrusive investigation.'],
	residualUncertainty: ['Drainage is not observable.']
};
const NARRATION = 'Defined the survey root, then the inspection type that consumes its report.';
const OVERSIZE_NARRATION = over(B.NARRATION_MAX, 'Defined a type, then another that consumes its output. ');
const GAPS = ['The inspection did not name the panels it covers.'];
const OVERSIZE_GAPS = [over(B.PRIOR_MAX, 'The inspection did not name the panels it covers. ')];
const OVERSIZE_INTENT = over(B.USER_INTENT_MAX, 'Survey the condition of a masonry retaining wall. ');
/** The criteria, each description lengthened so the rendered rubric overruns `RUBRIC_MAX`. */
const oversizeCriteria = (criteria: readonly AssessmentCriterion[]): AssessmentCriterion[] =>
	criteria.map((c) => ({
		...c,
		description: `${c.description} ${over(Math.ceil(B.RUBRIC_MAX / Math.max(criteria.length, 1)), 'In full. ')}`
	}));

const ANSWER = 'Panels 1-12 surveyed; bulging at panels 4 and 9 exceeds 25 mm; weep holes blocked at 7.';
const OVERSIZE_ANSWER = over(B.CONTENT_MAX, 'Panel surveyed; bulging within tolerance; weep holes clear. ');
const PRODUCING_PROMPT = 'Write the condition survey summary for the retaining wall, panel by panel.';

const COMMAND_RESULT = 'exit 0\nstdout: 42 checks passed, 0 failed\nstderr: (empty)';
const OVERSIZE_COMMAND_RESULT = over(B.CONTENT_MAX, 'stdout: check passed; ');
const OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [
		{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' },
		{ ordinal: 2, nameProvenance: 'NOT_MINTED', outcome: 'FAILED' },
		{ ordinal: 3, nameProvenance: 'NOT_MINTED', toolName: 'write_file', outcome: 'REFUSED' }
	],
	observedCount: 40,
	recordedLimit: 3
};
/** A call list long enough that the scaffolding alone overruns the budget — the content falls to `CONTENT_MIN`. */
const OVERSIZE_OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: Array.from({ length: 400 }, (_, i) => ({
		ordinal: i + 1,
		nameProvenance: 'MINTED_BY_HOST' as const,
		toolName: 'run_command',
		outcome: 'COMPLETED' as const
	})),
	observedCount: 400,
	recordedLimit: 400
};
const processResult = (
	criteria: readonly AssessmentCriterion[],
	observedToolCalls: ObservedToolCallReport | undefined,
	extra: Partial<ReasoningReviewInput> = {}
): ReasoningReviewInput => ({
	criteria,
	framing: 'PROCESS_RESULT',
	prompt: 'Run the retaining-wall survey checks and report whether they pass.',
	content: COMMAND_RESULT,
	narration: 'Ran the survey checks.',
	...(observedToolCalls ? { observedToolCalls } : {}),
	...extra
});

/** ⭐ THE PROBE SET, in a fixed order — the order, like each prompt, is part of what is hashed. */
export const FINGERPRINT_PROBES: readonly FingerprintProbe[] = [
	// ── the graph arm, through the builder the authoring floor uses ──
	{
		id: 'G-BARE',
		covers: 'graph framing; rationale NOT DECLARED; narration absent; no prior gaps; no subject hash',
		input: (criteria) =>
			graphReviewInput({ criteria, prompt: INTENT, graph: buildPwaGraphExport(PWA, NODES) })
	},
	{
		id: 'G-DECLARED',
		covers: 'graph framing; rationale declared, with an empty list; narration; a candidate subject hash',
		input: (criteria) =>
			graphReviewInput({
				criteria,
				prompt: INTENT,
				graph: buildPwaGraphExport(PWA, NODES),
				candidateSubjectHash: 'a3f1c9e07b52d846',
				rationale: RATIONALE,
				narration: NARRATION
			})
	},
	{
		id: 'G-PRIOR',
		covers: 'graph framing; prior gaps present',
		input: (criteria) =>
			graphReviewInput({ criteria, prompt: INTENT, graph: buildPwaGraphExport(PWA, NODES), priorGaps: GAPS })
	},
	{
		id: 'G-OVERSIZE-CONTENT',
		covers: 'graph framing; only the content oversize',
		input: (criteria) =>
			graphReviewInput({ criteria, prompt: INTENT, graph: buildPwaGraphExport(PWA, OVERSIZE_NODES) })
	},
	{
		id: 'G-OVERSIZE-ALL',
		covers: 'graph framing; every slice oversize at once — intent, rubric, prior, rationale, narration, content',
		input: (criteria) =>
			graphReviewInput({
				criteria: oversizeCriteria(criteria),
				prompt: OVERSIZE_INTENT,
				graph: buildPwaGraphExport(PWA, OVERSIZE_NODES),
				rationale: OVERSIZE_RATIONALE,
				narration: OVERSIZE_NARRATION,
				priorGaps: OVERSIZE_GAPS
			})
	},
	// ── the work-product arm, through the builder the work-product floor uses ──
	{
		id: 'W-BARE',
		covers: 'work-product framing; rationale NOT DECLARED; no prior gaps',
		input: (criteria) => workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: ANSWER })
	},
	{
		id: 'W-DECLARED-PRIOR',
		covers: 'work-product framing; rationale declared; prior gaps present',
		input: (criteria) =>
			workProductReviewInput({
				criteria,
				producingPrompt: PRODUCING_PROMPT,
				answer: ANSWER,
				rationale: RATIONALE,
				priorGaps: GAPS
			})
	},
	{
		id: 'W-OVERSIZE-CONTENT',
		covers: 'work-product framing; only the content oversize',
		input: (criteria) =>
			workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: OVERSIZE_ANSWER })
	},
	{
		id: 'W-OVERSIZE-ALL',
		covers: 'work-product framing; every slice oversize at once — instruction, rubric, prior, rationale, content',
		input: (criteria) =>
			workProductReviewInput({
				criteria: oversizeCriteria(criteria),
				producingPrompt: OVERSIZE_INTENT,
				answer: OVERSIZE_ANSWER,
				rationale: OVERSIZE_RATIONALE,
				priorGaps: OVERSIZE_GAPS
			})
	},
	// ── the process-result arm: no builder is factored for it (`REG-D-072` D17), so its input is literal ──
	{
		id: 'P-ABSENT-REPORT',
		covers: 'process-result framing; the host reported nothing about tool calls',
		input: (criteria) => processResult(criteria, undefined)
	},
	{
		id: 'P-NOT-OBSERVABLE',
		covers: 'process-result framing; NOT_OBSERVABLE, with a reason',
		input: (criteria) =>
			processResult(criteria, { observation: 'NOT_OBSERVABLE', reason: 'the adapter ran the session headless' })
	},
	{
		id: 'P-NOT-OBSERVABLE-BARE',
		covers: 'process-result framing; NOT_OBSERVABLE, with no reason',
		input: (criteria) => processResult(criteria, { observation: 'NOT_OBSERVABLE' })
	},
	{
		id: 'P-NONE-OBSERVED',
		covers: 'process-result framing; NONE_OBSERVED',
		input: (criteria) => processResult(criteria, { observation: 'NONE_OBSERVED' })
	},
	{
		id: 'P-OBSERVED',
		covers: 'process-result framing; OBSERVED — a minted name, an unnamed call, an unminted name, a declared cut',
		input: (criteria) =>
			processResult(criteria, OBSERVED, { rationale: RATIONALE, prior: { gaps: GAPS }, narration: '' })
	},
	{
		id: 'P-OVERSIZE-CONTENT',
		covers: 'process-result framing; only the content oversize',
		input: (criteria) => processResult(criteria, { observation: 'NONE_OBSERVED' }, { content: OVERSIZE_COMMAND_RESULT })
	},
	{
		id: 'P-OVERSIZE-ALL',
		covers: 'process-result framing; every slice oversize, and a call list that leaves the content CONTENT_MIN',
		input: (criteria) =>
			processResult(oversizeCriteria(criteria), OVERSIZE_OBSERVED, {
				prompt: OVERSIZE_INTENT,
				content: OVERSIZE_COMMAND_RESULT,
				rationale: OVERSIZE_RATIONALE,
				narration: OVERSIZE_NARRATION,
				prior: { gaps: OVERSIZE_GAPS }
			})
	},
	// ── the output example, when a policy declares no criterion ──
	{
		id: 'NO-CRITERIA',
		covers: 'the output example with no criterion to name (CRITERION-ID)',
		input: () => graphReviewInput({ criteria: [], prompt: INTENT, graph: buildPwaGraphExport(PWA, NODES) })
	}
];
