// ⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — ON THE AUTHORING PLANE, A CLEAN REVIEW WHOSE REVIEWER RECOMMENDS ESCALATED
// IS AN EXTERNAL BLOCK ROUTED TO A HUMAN, AND THE PAGE SAYS SO.
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-escalation-recommendation.md` §2 G5). Until `JAN-ESCREC` no review the product ran could
// escalate (`REG-F-473`): a reviewer that answered every criterion clean and recommended ESCALATED was recorded SATISFIED,
// and its candidate staged as assured. Rule (a) now escalates that review (`rph-assurance` D1) and records the
// recommendation (D2); this file holds the ROUTE to what the operator is then shown — the staged candidate
// BLOCKED_EXTERNAL with the classifier's ESCALATE_REVIEW guidance, the classifier's ACTION carried on the turn's summary
// for the resume banner to key on (never the guidance's prose), and the blocked hint's fourth answer, ROUTE_TO_HUMAN, on
// the floor the panel shows — the candidate's FORK, where an escalated review is recorded (an escalated candidate never
// commits, so canonical holds none).
//
// ⭑ AND BESIDE A GRAPH DEFECT, THE SAME REPLY ESCALATES NOTHING (`REG-D-090`: *"nothing else already blocks"* is read across
// the floor): the review stays SATISFIED, the recommendation is recorded beside it, and the page says to revise.
//
// ⭑ THE PRODUCTION COMPOSITION, END TO END, on `authoring-route-substituted-reviewer.test.ts`'s arrangement: the route is
// POSTed in-process in test mode, the deterministic mock agent authors a JSON plan, and the floor runs the product's own
// devin branch (`JPWB_ASSURANCE_TOOL=devin` with a model). Only devin's PROGRAM is replaced: `devinPrint` is the real
// adapter handed an exec seam that writes the ATIF export naming the CONFIGURED model, and answers the reply below.
//
// ⛔ HERMETIC. The exec seam starts nothing and PATH finds no program, so no case can reach a real devin; the agent is the
// mock (test mode, `JPWB_AGENT` unset) — and ALWAYS the mock: its factory is wrapped below to return it whatever mode the
// route asks for, so the one case that names `JPWB_AGENT=pi` (to reach auto-refinement) never loads Pi; and the module that
// imports Pi's SDK is mocked to throw, so a wrapper that stopped applying would fail closed rather than load it.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What devin's exec seam was handed, and what it answers. Hoisted: the mock factory runs first. */
const seam = vi.hoisted(() => ({
	calls: [] as { readonly file: string; readonly args: readonly string[] }[],
	/** Every review prompt devin was handed, in order — a re-review's carries the prior run's gaps. */
	prompts: [] as string[],
	answer: ''
}));

/** What the authoring agent was run on, and how its run is shaped. Hoisted: the mock factory runs first. */
const agentSeam = vi.hoisted(() => ({
	/** Every instruction the agent was run on, in order: the operator's, then any auto-refinement directive. */
	instructions: [] as string[],
	/** When set, the run never declares its producer — its `producer` event is withheld — so the floor cannot run. */
	withholdProducer: false
}));

// ⭑ THE REAL ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — so the reported model is read back from the export exactly as
// `readReportedModel` reads a real one, and `execFile` is never reached.
vi.mock('./tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.calls.push({ file, args: [...args] });
				seam.prompts.push(prompt);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-devin-model' } }] }),
						'utf8'
					);
				return { stdout: seam.answer };
			})
		)
	};
});

// ⭑ THE DETERMINISTIC MOCK AGENT, WHATEVER MODE THE ROUTE ASKS FOR, ITS RUN OBSERVED. A case that names `JPWB_AGENT=pi` —
// the one mode that auto-refines (`runFloorAfterTurn`: `mode !== 'mock'`) — so runs the refinement pass on the mock and
// never loads Pi; a case may withhold the run's `producer` event, so the producer never resolves. Every other case runs
// the mock exactly as the route would (test mode, `JPWB_AGENT` unset): the wrapper forwards every event and every call.
vi.mock('./agent/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agent/index.js')>();
	return {
		...actual,
		createAuthoringAgent: vi.fn(
			async (
				broker: Parameters<typeof actual.createAuthoringAgent>[0]
			): Promise<AuthoringAgent> => {
				const mock = await actual.createAuthoringAgent(broker, 'mock');
				return {
					run: (instruction, emit, signal) => {
						agentSeam.instructions.push(instruction);
						return mock.run(
							instruction,
							agentSeam.withholdProducer
								? (event) => {
										if (event.kind !== 'producer') emit(event);
									}
								: emit,
							signal
						);
					},
					rationale: () => mock.rationale(),
					materializedInputs: () => mock.materializedInputs()
				};
			}
		)
	};
});

// ⛔ AND IF THAT WRAPPER EVER STOPS APPLYING, THE CASE FAILS CLOSED AND PI IS NEVER LOADED (the ER-1 app re-verifier's finding
// [7]). The one case naming `JPWB_AGENT=pi` would then reach the real factory, whose live path dynamic-imports
// `./pi-agent.js` (`agent/index.ts`) — the ONLY module that imports Pi's SDK — before any assertion could redden. Every
// import of that module in this file's graph resolves to this mock, which throws instead: the import rejects with vitest's
// "error when mocking a module", this error as its cause (driven, with the wrapper removed and a second guard on the SDK
// itself that was never reached). The execution-plane tests guard their equivalent with an `openPi` that throws.
vi.mock('./agent/pi-agent.js', () => {
	throw new Error('hermetic: no route test loads Pi');
});

import type { AuthoringAgent } from './agent/index.js';
import { listByType } from '@janumipwb/rph-engine';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { missingCriterionRepairInstruction } from './assurance/reasoning-review-validator.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	getPendingAuthoringTurn,
	markAuthoringTurnExternalBlock,
	markAuthoringTurnRevisionRequired,
	markAuthoringTurnValid,
	resumeAuthoringTurn,
	summarizeAuthoringTurn,
	type AuthoringTurnSummary
} from './authoring-turn.js';
import {
	loadPwaFloor,
	type EscalationRecommendationNote,
	type FloorBlockedHint,
	type FloorView
} from './floor.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
type LoadEvent = Parameters<typeof load>[0];
interface StreamedEvent {
	readonly kind: string;
	readonly text?: string;
}

const CONFIGURED = 'fixture-devin-model';
/** The classifier's ESCALATE_REVIEW guidance, verbatim (`lib/server/floor.ts`) — UNCHANGED by `JAN-ESCREC` (D3). */
const ESCALATE_REVIEW_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review was escalated. Route the recorded review to the governed human or alternate independent-review path, then rerun assurance; an automatic subject edit cannot substitute for the escalation.';
/** `REG-D-090`'s observation: the code as a literal — the RECORDED word — and the statement byte for byte. */
const RECOMMENDATION_CODE = 'REVIEWER_RECOMMENDED_ESCALATION';
const RECOMMENDATION_STATEMENT =
	"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";

/** devin's reply: EVERY criterion answered and none failed, recommending ESCALATED — the clean arm rule (a) escalates. */
const ESCALATED_CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	})),
	recommendation: 'ESCALATED',
	residualUncertainty: []
});

/** The first sentence of the recommendation's statement — what any carrier of it would hold, truncated or not. */
const RECOMMENDATION_FIRST_SENTENCE = "The reviewing model's recommendation was ESCALATED.";

/** devin's reply with the FIRST criterion failed and the rest unfailed, recommending ESCALATED: REJECTED, the escalation
 *  recorded beside the finding (`REG-D-089`: *"If a criterion failed, the outcome stays REJECTED"*). */
const FAULT = 'The graph substitutes an easier problem.';
const ESCALATED_BESIDE_A_FAULT = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
		criterionId: c.id,
		failed: i === 0,
		statement: i === 0 ? FAULT : 'evaluated; the failure class is absent'
	})),
	recommendation: 'ESCALATED',
	residualUncertainty: []
});

/** devin's reply with the LAST criterion left UNANSWERED, the rest unfailed, recommending ESCALATED: a VALID reply that is
 *  INCONCLUSIVE — an unanswered mandatory criterion is invalid output (ASR-2), so rule (a) escalates nothing (D1) — with the
 *  recommendation recorded beside it (D2). The ER-1 app re-verifier's probe P6. */
const ESCALATED_SKIPPED_ROW = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.slice(0, -1).map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	})),
	recommendation: 'ESCALATED',
	residualUncertainty: []
});

/** The classifier's guidance for an INCOMPLETE review, verbatim (`lib/server/floor.ts`). */
const INCOMPLETE_REVIEW_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.';

/** What the route records when the run never declared its producer, so no review ran (`agent/+server.ts`), verbatim. */
const FLOOR_NOT_RUN =
	'⚖ Assurance floor not run — the producing model/provider never resolved, so reviewer independence cannot be established. PublishPwa remains blocked; retry the producing run or repair its model/provider configuration before rerunning assurance.';

/** A JSON plan the mock agent runs verbatim (`agent/mock-agent.ts`). ONE root: the graph is well formed. */
const ROOT_ONLY_PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: { types: [{ tempKey: 'plan', name: 'Plan', pwuKind: 'PLAN', isRoot: true }] }
		}
	]
});

/** TWO roots: the schema/invariant policy REJECTS the graph (`PWA_GRAPH_NOT_WELL_FORMED`) — a block revising answers. */
const TWO_ROOTS_PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{ tempKey: 'a', name: 'Plan A', pwuKind: 'PLAN', isRoot: true },
					{ tempKey: 'b', name: 'Plan B', pwuKind: 'PLAN', isRoot: true }
				]
			}
		}
	]
});

/** A DRAFT PWA to author — the only kind the route opens a turn on. */
function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Escalated review fixture',
		description: 'A DRAFT PWA whose reviewer recommends escalation.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

/** POST the route in-process and read its whole Server-Sent Event stream. */
async function postInstruction(pwaId: string, instruction: string): Promise<StreamedEvent[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction })
		})
	} as unknown as RouteEvent);
	const body = await response.text();
	return body
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as StreamedEvent);
}

/** What the page's load hands the panel and the banner, read in-process as the browser's request reads it. */
async function loadThePage(pwaId: string): Promise<{
	floor?: FloorView;
	floorBlockedHint?: FloorBlockedHint;
	escalationRecommendationNote?: EscalationRecommendationNote;
	authoringTurn?: AuthoringTurnSummary;
	resumeHint?: string;
}> {
	return (await load({ params: { id: pwaId } } as unknown as LoadEvent)) as {
		floor?: FloorView;
		floorBlockedHint?: FloorBlockedHint;
		escalationRecommendationNote?: EscalationRecommendationNote;
		authoringTurn?: AuthoringTurnSummary;
		resumeHint?: string;
	};
}

const policyOn = (floor: FloorView | undefined, policyId: string) =>
	floor?.policies.find((p) => p.policyId === policyId);

/** The recommendation as RECORDED on the turn's fork — read from the ASSURANCE_OBSERVATION object, not the view. */
function recordedRecommendations(pwaId: string): Record<string, unknown>[] {
	const turn = getPendingAuthoringTurn(pwaId);
	expect(turn, 'arrangement: no staged candidate to read the record from').toBeDefined();
	return listByType(turn!.engine, 'ASSURANCE_OBSERVATION')
		.map((o) => o.state as Record<string, unknown>)
		.filter((s) => s.findingCode === RECOMMENDATION_CODE);
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.calls.length = 0;
	seam.prompts.length = 0;
	seam.answer = ESCALATED_CLEAN;
	agentSeam.instructions.length = 0;
	agentSeam.withholdProducer = false;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
	// ⭑ THE SELECTED REVIEWER, NAMED — test mode admits it, so the floor runs devin's branch, not the stand-in.
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', CONFIGURED);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐ JAN-ESCREC D3 — the authoring route and the page answer a clean review the reviewer escalates', () => {
	it('⛔ a WELL-FORMED graph: the candidate is BLOCKED_EXTERNAL with the ESCALATE_REVIEW guidance, its summary carries the action, and the page routes the review to a human', async () => {
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(seam.calls[0]!.args.slice(0, 3)).toEqual(['--print', '--model', CONFIGURED]);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn, 'the escalated turn left no staged candidate').toBeDefined();
		expect(turn!.status, 'an escalated review was not held as an external block').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(turn!.detail).toBe(ESCALATE_REVIEW_GUIDANCE);
		expect(
			events.filter((e) => e.kind === 'status').map((e) => e.text),
			'the operator was not shown the escalation’s guidance'
		).toContain(`⚠ ${ESCALATE_REVIEW_GUIDANCE}`);

		expect(
			loadPwaFloor(pwaId),
			'arrangement: canonical holds a floor, so this case could not tell the fork from canonical'
		).toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.schema-invariant')?.disposition,
			'arrangement: the schema/invariant policy did not pass the graph'
		).toBe('SATISFIED');
		expect(
			policyOn(data.floor, 'floor.identity-provenance')?.disposition,
			'arrangement: the identity/provenance policy did not pass the graph'
		).toBe('SATISFIED');
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'the fork’s review did not conclude ESCALATED'
		).toBe('ESCALATED');
		// ⭐ THE BANNER'S DATA: the classifier's ACTION, on the summary the page renders the banner from.
		expect(data.authoringTurn?.status).toBe('BLOCKED_EXTERNAL');
		expect(
			data.authoringTurn?.remediationAction,
			'the banner cannot tell an escalation from a review that reached no verdict'
		).toBe('ESCALATE_REVIEW');
		// ⭐ AND THE BANNER ITSELF, WHOLE, as the load hands it to the page (`resumeHintText`; the ER-1 app verifier's finding
		// [6]): the escalation named, and that refining re-runs the same automated reviewer (`REG-F-474`).
		expect(data.resumeHint, 'the banner did not name the escalation').toBe(
			`The reviewer recommended escalation to a human reviewer — ${ESCALATE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate, and refining re-runs the same automated reviewer), or Discard.`
		);
		expect(data.floorBlockedHint, 'the page did not route the escalated review to a human').toBe(
			'ROUTE_TO_HUMAN'
		);
		// ⛔ AND SAID ONCE: the hint names the escalation, so the panel's line beside the findings is not said.
		expect(
			data.escalationRecommendationNote,
			'the escalation was said twice: by the hint and again beside it'
		).toBeUndefined();
		// ⛔ NOT A FINDING: the panel's "Reasoning-review findings" list does not carry the recommendation.
		expect(data.floor?.reasoningGaps).toEqual([]);

		// ⭐ THE RECORD (D2), read from the OBJECT on the turn's fork.
		const recorded = recordedRecommendations(pwaId);
		expect(recorded, 'the reviewer’s recommendation was not recorded').toHaveLength(1);
		expect(recorded[0]).toMatchObject({
			findingCode: RECOMMENDATION_CODE,
			observationType: 'RECOMMENDATION',
			severity: 'INFORMATIONAL',
			statement: RECOMMENDATION_STATEMENT
		});
	});

	it('⭑ a graph with TWO ROOTS: the same reply escalates nothing — the review stays SATISFIED, the recommendation is recorded beside it, and the page says to revise', async () => {
		// `REG-D-090`: *"nothing else already blocks"* is read across the floor, so a graph defect is revised first.
		const pwaId = draftPwa();

		await postInstruction(pwaId, TWO_ROOTS_PLAN);

		// ⭐ The review in parts, B3 (`REG-D-125`) — one call per part: each root is a type, reviewed as a part; and each
		// part's clean review stays SATISFIED, the graph defect being "something else" that already blocks (`composeParts`).
		expect(seam.calls.length, 'arrangement: the devin branch reviewed each of the two types').toBe(2);
		expect(
			getPendingAuthoringTurn(pwaId)?.status,
			'a graph defect beside the recommendation was not staged for revision'
		).toBe('REVISION_REQUIRED');
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.schema-invariant')?.disposition,
			'arrangement: the schema/invariant policy did not reject the two roots'
		).toBe('REJECTED');
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'the review was escalated past a graph defect'
		).toBe('SATISFIED');
		expect(data.floorBlockedHint).toBe('REVISE');
		// ⭐ AND THE PANEL SAYS THE ESCALATION WAS RECOMMENDED, beside the graph's findings, which are addressed first.
		expect(
			data.escalationRecommendationNote,
			'the recommendation kept beside a graph defect was said nowhere on the page'
		).toBe('BESIDE_FINDINGS');
		const recorded = recordedRecommendations(pwaId);
		expect(
			recorded,
			'the recommendation was not recorded beside each part’s SATISFIED review'
		).toHaveLength(2);
		expect(recorded[0]).toMatchObject({
			findingCode: RECOMMENDATION_CODE,
			observationType: 'RECOMMENDATION',
			severity: 'INFORMATIONAL',
			statement: RECOMMENDATION_STATEMENT
		});
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-089`; the ER-1 app re-verifier's findings [0] and [3]) — ON A STAGED CANDIDATE'S FORK, THE PAGE
// SAYS THE REVIEWER ALSO RECOMMENDED ESCALATION, IN THE SENTENCE TRUE OF THE FLOOR THE PANEL SHOWS.
//
// ⛔ THE PRODUCT'S PATH, AND NO TEST READ IT. In the product a review its reviewer also escalated reaches the page only
// through a staged candidate's FORK (only a satisfied candidate is accepted), and every browser case stages its review on
// canonical. So the load's answer over the fork was unpinned: answered over CANONICAL's floor (`ER1-V151`, `RS3-M20`'s
// shape), the line was never said beside a staged candidate, and every test stayed green.
// ⭑ WHAT MUST HOLD. Over the fork — canonical holds no floor here, asserted — the load answers `BESIDE_FINDINGS` beside a
// REJECTED review (the graph-defect case above too), `WITH_AN_INCOMPLETE_REVIEW` beside a review that left a criterion
// unanswered (the re-verifier's probe P6, where the page said "beside the findings" beside none), and nothing where the
// hint already routes the review to a human (the first case above).
describe('⭐ JAN-ESCREC D3 — over the fork, the load answers which sentence the panel says beside the findings', () => {
	it('⭐ a REJECTED review its reviewer also escalated, staged for revision: BESIDE_FINDINGS, over the FORK’s floor', async () => {
		seam.answer = ESCALATED_BESIDE_A_FAULT;
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(
			getPendingAuthoringTurn(pwaId)?.status,
			'arrangement: the rejected candidate was not staged for revision'
		).toBe('REVISION_REQUIRED');
		expect(
			loadPwaFloor(pwaId),
			'arrangement: canonical holds a floor, so this case could not tell the fork from canonical'
		).toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'arrangement: the fork’s review did not conclude REJECTED'
		).toBe('REJECTED');
		expect(data.floorBlockedHint, 'arrangement: the hint does not say to revise').toBe('REVISE');
		expect(data.floor?.reasoningGaps, 'arrangement: the finding is not the one listed').toEqual([
			FAULT
		]);
		expect(
			data.escalationRecommendationNote,
			'the recommendation recorded beside the rejection was not said beside the findings on the staged candidate’s page'
		).toBe('BESIDE_FINDINGS');
		expect(
			recordedRecommendations(pwaId),
			'arrangement: the recommendation was not recorded on the fork'
		).toHaveLength(1);
	});

	it('⭐ a criterion left UNANSWERED, the reviewer recommending ESCALATED: an incomplete review, and WITH_AN_INCOMPLETE_REVIEW — never "beside the findings"', async () => {
		seam.answer = ESCALATED_SKIPPED_ROW;
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		// ⭐ Package L — D13 (`REG-D-135` (3); design D13): ~~1~~ 2 — a reply that faults nothing and leaves a declared criterion
		// without a row draws ONE criterion repair, naming that criterion; this seam answers it alike, so the review stays
		// INCOMPLETE, the first judgement standing. ⭑ The second call is that repair, so a review run again still shows.
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate, with its criterion repair (D13)').toBe(2);
		expect(seam.prompts[1], 'arrangement: the second call is not the review’s criterion repair').toBe(
			`${seam.prompts[0]}\n\n${missingCriterionRepairInstruction([SEEDED_REASONING_REVIEW_CRITERIA.at(-1)!.id])}`
		);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(
			turn?.status,
			'arrangement: the incomplete review was not held as an external block'
		).toBe('BLOCKED_EXTERNAL');
		expect(
			summarizeAuthoringTurn(turn!).remediationAction,
			'arrangement: the block is not the incomplete review’s'
		).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(
			loadPwaFloor(pwaId),
			'arrangement: canonical holds a floor, so this case could not tell the fork from canonical'
		).toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'arrangement: the fork’s review is not INCONCLUSIVE'
		).toBe('INCONCLUSIVE');
		expect(
			data.floorBlockedHint,
			'arrangement: the hint does not say revising does not address it'
		).toBe('NOT_BY_REVISION');
		// ⛔ NO FINDING AT ALL — which is why "recorded beside the findings, which are addressed first" was false here.
		expect(data.floor?.reasoningGaps).toEqual([]);
		expect(
			data.escalationRecommendationNote,
			'the line beside an incomplete review said something that is not true of it'
		).toBe('WITH_AN_INCOMPLETE_REVIEW');
		// ⭑ The banner frames it as a review that reached no usable verdict — it was not escalated (D1) — whole.
		expect(data.resumeHint).toBe(
			`The review did not produce a usable verdict — ${INCOMPLETE_REVIEW_GUIDANCE} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
		expect(
			recordedRecommendations(pwaId),
			'arrangement: the recommendation was not recorded beside the incomplete review'
		).toHaveLength(1);
	});
});

// ⭐ `JAN-ESCREC` D3 — WHAT AN UNCLASSIFIED BLOCK CARRIES, AND WHAT THE PRODUCER IS SENT, THROUGH THE ROUTE ITSELF.
//
// ⛔ TWO PATHS NO CASE ABOVE REACHES. (1) An external block the floor's classifier never answered — the producer never
// resolved, the graph could not be loaded, or the floor threw — carries no action; the summary's docblock promises it,
// and nothing drove one through the route (the ER-1 app verifier's finding [3], its mutant `ER1-V54`: such a block
// defaulted to ESCALATE_REVIEW and survived every test). (2) Auto-refinement runs only off the mock agent (`mode !==
// 'mock'`), so the recommendation's exclusion from what the producer is SENT was held at the classifier and on the
// execution plane, never through this route (part B's problem 2; the verifier's probe `ER1-VP2`, landed here).
describe('⭐ JAN-ESCREC D3 — through the route: an unclassified block names no escalation, and the producer is never sent the recommendation', () => {
	it('⛔ the run never declares its producer, so the floor never runs: BLOCKED_EXTERNAL with NO action, and the banner names no escalation', async () => {
		agentSeam.withholdProducer = true;
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(
			seam.calls,
			'arrangement: a review ran, so the floor was not the one that never ran'
		).toEqual([]);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn?.status, 'arrangement: the unrun floor was not held as an external block').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(turn!.detail, 'arrangement: the block is not the floor that never ran').toBe(
			FLOOR_NOT_RUN
		);
		expect(
			summarizeAuthoringTurn(turn!).remediationAction,
			'an external block nothing classified carries an action'
		).toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(data.authoringTurn?.remediationAction).toBeUndefined();
		expect(data.resumeHint, 'the banner framed a floor that never ran as an escalation').toBe(
			`The review did not produce a usable verdict — ${FLOOR_NOT_RUN} This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
	});

	it('⛔ a REJECTED review its reviewer also escalated, auto-refined: the producer is sent the finding and never the recommendation, and so is the re-review', async () => {
		// ⭑ `JPWB_AGENT=pi` asks for the live agent, the one mode that refines; the observed mock above stands in for it, so
		// Pi is never loaded. The mock answers the free-text directive with its canned script: what it builds is not this
		// case's question — what it was SENT is.
		vi.stubEnv('JPWB_AGENT', 'pi');
		seam.answer = ESCALATED_BESIDE_A_FAULT;
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(agentSeam.instructions, 'arrangement: no auto-refinement pass ran').toHaveLength(2);
		const directive = agentSeam.instructions[1]!;
		expect(directive, 'arrangement: the refinement directive did not carry the finding').toContain(
			FAULT
		);
		expect(
			directive,
			'the recommendation’s code was sent to the producer as a finding'
		).not.toContain(RECOMMENDATION_CODE);
		expect(directive, 'the recommendation was sent to the producer as a finding').not.toContain(
			RECOMMENDATION_FIRST_SENTENCE
		);
		// ⭐ The review in parts, B4 (`REG-D-125`; design D8) — the refined candidate's WHOLE part inventory is reviewed again:
		// one prompt for the first round's one type, then one per type of the refined candidate, the first its first.
		const refined = listByType(getPendingAuthoringTurn(pwaId)!.engine, 'PWU_TYPE').filter(
			(t) => t.state.pwaId === pwaId && t.state.status !== 'REMOVED'
		).length;
		expect(refined, 'arrangement: the refinement added types').toBeGreaterThan(1);
		expect(seam.prompts, 'arrangement: the refined candidate was not reviewed again, part by part').toHaveLength(
			1 + refined
		);
		expect(
			seam.prompts[1],
			'arrangement: the re-review was not given the finding as a prior gap'
		).toContain(FAULT);
		// ⭐ B4 — and only the part the finding was about is given it: another type's review is shown none of its findings.
		for (const other of seam.prompts.slice(2))
			expect(other, 'another type’s re-review was given this type’s finding').not.toContain(FAULT);
		for (const prompt of seam.prompts.slice(1))
			expect(prompt, 'the re-review was given the recommendation as a prior gap').not.toContain(
				RECOMMENDATION_FIRST_SENTENCE
			);
		// ⭑ RECORDED, ONLY NOT SENT BACK: each review on the fork carries the recommendation beside its finding (D2) — one
		// per part of each round.
		expect(
			recordedRecommendations(pwaId),
			'arrangement: the recommendation was not recorded'
		).toHaveLength(1 + refined);
	});
});

// ⭐ `JAN-ESCREC` D3 — THE SUMMARY'S ACTION IS THE CURRENT BLOCK'S. A turn blocked on an escalation and then resumed is no
// longer blocked on it: the next run's stop says its own cause, and a banner keyed on a stale ESCALATE_REVIEW would name an
// escalation the turn no longer has. The turn's own machinery, driven directly: no reviewer runs.
describe('⭐ JAN-ESCREC D3 — the summary carries the action of the block the turn is IN', () => {
	it('⛔ a resumed turn forgets the action it was blocked on: resumed, and then stopped for revision, it carries none', () => {
		const pwaId = draftPwa();
		const turn = beginAuthoringTurn(pwaId);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		markAuthoringTurnValid(turn);
		markAuthoringTurnExternalBlock(turn, ESCALATE_REVIEW_GUIDANCE, 'ESCALATE_REVIEW');
		expect(
			summarizeAuthoringTurn(turn),
			'arrangement: the block did not carry its action'
		).toMatchObject({ status: 'BLOCKED_EXTERNAL', remediationAction: 'ESCALATE_REVIEW' });

		const resumed = resumeAuthoringTurn(pwaId);
		expect(resumed?.status, 'arrangement: the turn did not resume').toBe('ASSURING');
		expect(
			summarizeAuthoringTurn(resumed!).remediationAction,
			'a resumed turn still carried the escalation it was blocked on'
		).toBeUndefined();
		markAuthoringTurnRevisionRequired(
			resumed!,
			'The candidate did not satisfy the authoring assurance floor.'
		);
		expect(summarizeAuthoringTurn(resumed!)).toMatchObject({ status: 'REVISION_REQUIRED' });
		expect(summarizeAuthoringTurn(resumed!).remediationAction).toBeUndefined();
	});
});
