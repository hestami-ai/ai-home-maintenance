// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 to D76 with D85 and D87 (`REG-D-166` (3), (4), (5); `REG-D-167` (2), (4); the lead's ruling (B) on the
// stage's trigger) — THE ASSURANCE STAGE AT A REJECTED SIGN-OFF: what the page offers, and what one press does.
//
// ⭑ THE OFFER (`assuranceStageOffer`). On a unit in D71's rejected state — UNDER_ASSURANCE, its execution SUCCEEDED and its assurance REJECTED, a
// governing declared policy's latest verdict over it REJECTED — whose ROUND has no stage record yet; the round is named by its opening verdict, the
// first rejecting one in the sign-off's selection order (the lead's ruling on reading 2). Once per round; no rationale: it records no Decision and
// moves no state. ⛔ The sign-off is byte for byte as it was, and in package L17b1 the way back stays offered whether or not the stage has run.
// ⭑ ONE PRESS (`runAssuranceStage`), in the brief's order: the narrative's chapter (D76), then the Hypothesizer (D74, D87), then — only on an open
// `KNOWN_FAILURE_RECURRENCE` observation recorded on the round — the Unsticking Agent (D75). Each part recorded (`assurance-stage-records.ts`), a part
// that fails recorded as failing, refused or not run, with why, and the stage going on. The Historian's assessment (D73, D86) is package L17b2's.
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { listByType, listExecutionPlans, listPwus, type EngineHandle } from '@janumipwb/rph-engine';
import { replacementCandidates } from '@janumipwb/rph-projections';
import { acceptedWorkFile } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { agyPrintWithModel } from './agy-cli.js';
import { captureTry, createExchangeSink } from './exchange-capture.js';
import { recordExchanges } from './exchange-recorder.js';
// ⭐ The lead's ruling (k) on the review's fifth re-check — the one describer of a thrown value, which cannot throw: the narrative writer's failure and
// the shared workspace's describe through it, so each is its part's, whatever value is thrown.
import { describedThrow } from '../described-throw.js';
import { refusalMessage, selectReviewer } from './reviewer-selection.js';
import { assuranceModel, devinPrint } from '../tools/devin-reviewer.js';
import { isToolInvocationResult, type ToolInvocationResult } from '../tools/backing-tool.js';
import { governedToolCallReport } from '../tools/observed-tool-calls.js';
import { admittedViewRef, readDeliverableView } from '../execution/deliverable-view.js';
import type { ExecutorSelection } from '../execution/executor-selection.js';
import type { ExecutorSessionPlace, ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { rejectingVerdictFindings } from '../execution/rejected-rerun.js';
import { reachUnitsOf } from '../execution/send-back.js';
import type { UndertakingSandbox } from '../execution/workspace-host.js';
import {
	recordStagePart,
	STAGE_PART,
	stageJsonOf,
	stageRecordsIn,
	type StagePart,
	type StagePartStatus,
	type StageStep
} from './assurance-stage-records.js';
import { readDiagnosis, hypothesizerPrompt, type HypothesizerCandidate } from './hypothesizer.js';
import {
	chapterRecordsOf,
	checkNarrativeChapter,
	narrativeChapterPrompt,
	standInChapter,
	type ChapterStatement
} from './narrative-chapter.js';
import { runStageHelper } from './stage-helper-run.js';
import { readStepBack, unstickingPrompt } from './unsticking-agent.js';
import { NARRATIVE_WRITER_INVOKER } from './assurance-stage-roles.js';
import { recordFilePath, recordRowsOf, renderUnitConversation, unitConversationOf } from '../execution/earlier-attempt-record.js';

/** ⭐ D76 — the policy the writer's ASSURANCE-plane exchange names: its chapter is that policy's optional evidence `EV-22-02`, "Narrative memories". */
export const HISTORIAN_POLICY_ID = 'pol_historical_consistency';
/** ⭐ D75 — the finding the Historian records when the same problem comes back (the catalog's §22.5). */
export const KNOWN_FAILURE_RECURRENCE = 'KNOWN_FAILURE_RECURRENCE';
/** ⭐ Why a replay runs none of the stage's roles (design D76). */
export const REPLAY_RUNS_NO_STAGE = 'a replay does not replay the assurance stage: its roles’ answers are not recorded for it (design D76)';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** ⭐ What the page offers: the round, by its opening verdict, and the rejecting verdicts. */
export interface AssuranceStageOffer {
	readonly roundId: string;
	readonly rejected: readonly { readonly policyId: string; readonly assessmentId: string }[];
}

/** ⭐⭐ THE OFFER, read from the record (see the header). */
export function assuranceStageOffer(engine: EngineHandle, pwuId: string): AssuranceStageOffer | { readonly refusedBecause: string } {
	const unit = engine.loadObject(pwuId)?.state as { workLifecycleState?: unknown; executionState?: unknown; assuranceState?: unknown } | undefined;
	if (unit?.workLifecycleState !== 'UNDER_ASSURANCE' || unit.executionState !== 'SUCCEEDED' || unit.assuranceState !== 'REJECTED')
		return {
			refusedBecause:
				`the unit is ${str(unit?.workLifecycleState) || 'unknown'} with its execution ${str(unit?.executionState) || 'unknown'} and its assurance ` +
				`${str(unit?.assuranceState) || 'unknown'}; the assurance stage runs on a unit its declared reviews rejected at its sign-off (UNDER_ASSURANCE, ` +
				'SUCCEEDED, REJECTED) (REG-D-166 (3); design D74 to D76)'
		};
	const { rejected } = rejectingVerdictFindings(engine, pwuId);
	if (rejected.length === 0)
		return {
			refusedBecause:
				'no governing declared policy of this unit holds a REJECTED verdict over it, so there is no rejection for the assurance stage to answer (REG-D-166 (3))'
		};
	const roundId = rejected[0]!.assessmentId;
	const ran = stageRecordsIn(engine).find((r) => r.roundId === roundId && r.part === STAGE_PART.CHAPTER);
	if (ran !== undefined)
		return { refusedBecause: `the assurance stage has run for this round (${roundId}): its chapter is ${ran.artifactId}, and a round has one stage` };
	return { roundId, rejected: rejected.map((v) => ({ policyId: v.policyId, assessmentId: v.assessmentId })) };
}

/** What a press needs from its caller. */
export interface AssuranceStageDeps {
	readonly engine: EngineHandle;
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	readonly runSteps: (steps: readonly StageStep[]) => string | null;
	readonly dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => { status: string };
	readonly testMode: boolean;
	/** The executor's selection, which the helpers run on. */
	readonly executor: ExecutorSelection;
	/** The Undertaking's sandbox: its shared workspace, which the helpers copy. */
	readonly sandboxOf: (undertakingId: string) => UndertakingSandbox;
	/** `<D>.sessions`, or undefined. */
	readonly sessionsRoot: string | undefined;
	/** ⭐ Reading 13's seam: a transport in place of the selected reviewer's — never over a refused selection or a replay. */
	readonly writerPrint?: (prompt: string) => Promise<string | ToolInvocationResult>;
	readonly openPi?: (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace) => Promise<ProducerSession>;
}

/** One part's outcome. */
export interface StagePartOutcome {
	readonly part: StagePart;
	readonly status: StagePartStatus;
	readonly artifactId?: string;
	readonly why?: string;
}

export interface AssuranceStageOutcome {
	readonly roundId: string;
	readonly parts: readonly StagePartOutcome[];
}

/** The index of the first event of `aggregateId` in the log, or -1. */
function firstEventOf(engine: EngineHandle, aggregateId: string): number {
	return engine.readAllEvents().findIndex((e) => e.aggregateId === aggregateId);
}

/** ⭐ D76 — the Undertaking's chapters so far, in order, each read back: its artifact, whether it failed its check, and its statements. */
async function chaptersOf(
	engine: EngineHandle,
	store: ArtifactStore,
	undertakingId: string
): Promise<{ readonly id: string; readonly failing: boolean; readonly statements: readonly ChapterStatement[] }[]> {
	const out: { id: string; failing: boolean; statements: ChapterStatement[] }[] = [];
	for (const r of stageRecordsIn(engine).filter((x) => x.part === STAGE_PART.CHAPTER && x.undertakingId === undertakingId)) {
		const json = r.status === 'recorded' ? await stageJsonOf(store, r) : undefined;
		const statements = (Array.isArray(json?.statements) ? json.statements : []).map((s) => {
			const o = (typeof s === 'object' && s !== null ? s : {}) as { text?: unknown; cites?: unknown };
			return { text: str(o.text), cites: Array.isArray(o.cites) ? o.cites.filter((c): c is string => typeof c === 'string') : [] };
		});
		out.push({ id: r.artifactId, failing: r.status !== 'recorded' || json === undefined, statements });
	}
	return out;
}

/** The writer's call: the selected reviewer's own transport, once (D76), or why none ran. */
async function writeChapter(
	prompt: string,
	standIn: () => string,
	deps: AssuranceStageDeps
): Promise<
	| { readonly ran: false; readonly why: string }
	| { readonly ran: true; readonly answer: string; readonly raw: string; readonly producer: { modelId: string; providerId: string }; readonly failure?: string; readonly recorded: boolean; readonly observation?: ToolInvocationResult['observedToolCalls'] }
> {
	const selected = selectReviewer({ testMode: deps.testMode });
	if (selected.kind === 'REFUSED') return { ran: false, why: `the narrative writer runs on the selected reviewer, and none can run: ${refusalMessage(selected)}` };
	if (selected.kind === 'REPLAY') return { ran: false, why: REPLAY_RUNS_NO_STAGE };
	// ⛔ Reading 13 — the stand-in writer only where the selected reviewer is the stand-in; and no exchange, since nothing was called.
	if (deps.writerPrint === undefined && selected.kind === 'STAND_IN') {
		const answer = standIn();
		return { ran: true, answer, raw: answer, producer: { modelId: 'stand-in-writer', providerId: 'workbench' }, recorded: false };
	}
	let configured: { modelId: string; providerId: string };
	if (selected.kind === 'DEVIN') configured = { modelId: assuranceModel(), providerId: 'devin' };
	else if (selected.kind === 'AGY') configured = { modelId: selected.modelId, providerId: 'google' };
	else configured = { modelId: 'injected-writer', providerId: 'test' };
	try {
		let returned: string | ToolInvocationResult;
		if (deps.writerPrint !== undefined) returned = await deps.writerPrint(prompt);
		else if (selected.kind === 'DEVIN') returned = await devinPrint(prompt);
		else returned = await agyPrintWithModel(prompt, configured.modelId);
		if (isToolInvocationResult(returned))
			return {
				ran: true,
				answer: returned.answer.arrived ? returned.answer.text : '',
				raw: returned.rawOutput,
				producer: { modelId: returned.producer.modelId, providerId: returned.producer.providerId },
				recorded: true,
				observation: returned.observedToolCalls
			};
		return { ran: true, answer: returned, raw: returned, producer: configured, recorded: true };
	} catch (e) {
		return { ran: true, answer: '', raw: '', producer: configured, failure: describedThrow(e), recorded: true };
	}
}

/**
 * ⭐ D74 — THE FILES A UNIT'S RECORDED WORK CHANGED: the view its last successful completion admitted (`admittedViewRef`, `readDeliverableView`), each
 * path with its change; none where no completion points at a view or the view cannot be read back whole.
 */
async function changedFilesOf(engine: EngineHandle, store: ArtifactStore, pwuId: string): Promise<string[]> {
	const plans = new Set(listExecutionPlans(engine).filter((p) => p.state.workUnitId === pwuId).map((p) => p.id));
	const last = engine
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
		.at(-1);
	const at = admittedViewRef(((last?.payload ?? {}) as { structuredResult?: unknown }).structuredResult, []);
	if (!at.ok || at.ref === undefined) return [];
	const read = await readDeliverableView(store, at.ref);
	return read.ok ? read.view.deliverable.files.map((f) => `${f.path} (${f.change})`) : [];
}

/** ⭐ D74 — the candidates: the rejected unit and the units whose work its work used (D72), each as the Hypothesizer is shown it. */
async function candidatesOf(engine: EngineHandle, store: ArtifactStore, pwuId: string, undertakingId: string): Promise<HypothesizerCandidate[]> {
	const ids = [pwuId, ...replacementCandidates(reachUnitsOf(engine, undertakingId), pwuId)];
	const accepted = new Set(['SATISFIED', 'RECOMPOSED', 'BASELINED']);
	const out: HypothesizerCandidate[] = [];
	for (const id of ids) {
		const unit = (engine.loadObject(id)?.state ?? {}) as Record<string, unknown>;
		const type = (engine.loadObject(str(unit.pwuTypeId))?.state ?? {}) as Record<string, unknown>;
		out.push({
			id,
			title: str(unit.title) || id,
			purpose: str(type.purpose),
			completionRule: str(type.completionRule),
			...(accepted.has(str(unit.workLifecycleState)) ? { acceptedWorkFile: acceptedWorkFile(str(unit.title), id) } : {}),
			changedFiles: await changedFilesOf(engine, store, id)
		});
	}
	return out;
}

/** ⭐ D75 — the round's open recurrences: open `KNOWN_FAILURE_RECURRENCE` observations over the unit, recorded after the round's opening verdict. */
export function openRecurrencesOf(
	engine: EngineHandle,
	pwuId: string,
	roundId: string
): { readonly id: string; readonly statement: string }[] {
	const events = engine.readAllEvents();
	const roundAt = events.findLastIndex((e) => e.aggregateId === roundId && e.eventType === 'AssuranceAssessmentCompleted');
	return listByType(engine, 'ASSURANCE_OBSERVATION')
		.filter((o) => o.state.findingCode === KNOWN_FAILURE_RECURRENCE && o.state.disposition === 'OPEN')
		.filter((o) => Array.isArray(o.state.subjectObjectIds) && o.state.subjectObjectIds.includes(pwuId))
		.filter((o) => events.findIndex((e) => e.aggregateId === o.id) > roundAt)
		.map((o) => ({ id: o.id, statement: str(o.state.statement) }));
}

/** ⭐ The independent review's defect 5 — the rounds whose stage a press of this process is running now (`runAssuranceStage`). */
const STAGES_RUNNING = new Set<string>();

/** ⭐ The independent review's defect 5 — why a second press of a round is refused while its stage runs. */
export function stageRunningRefusal(roundId: string): string {
	return `the assurance stage of this round (${roundId}) is running now: one press per round at a time, and this one is refused rather than run beside it`;
}

/**
 * ⭐⭐ ONE PRESS OF THE ASSURANCE STAGE (see the header). ⛔ Refused, before anything runs or is recorded, where the offer refuses. ⭐ The independent
 * review's defect 5 — AND WHILE A PRESS OF THE SAME ROUND RUNS: the offer reads only a recorded chapter, and a press awaits its writer before it
 * records one, so two presses at once would both pass it, run two stages, and the second would remove the first's live copy as a leftover. The round
 * is held from the offer's check — in the same turn of this process's event loop, before any await — to the press's end. ⚠ This process's hold
 * alone: one server serves one store.
 */
export async function runAssuranceStage(
	pwuId: string,
	deps: AssuranceStageDeps
): Promise<AssuranceStageOutcome | { readonly refusedBecause: string }> {
	const offer = assuranceStageOffer(deps.engine, pwuId);
	if ('refusedBecause' in offer) return offer;
	if (STAGES_RUNNING.has(offer.roundId)) return { refusedBecause: stageRunningRefusal(offer.roundId) };
	STAGES_RUNNING.add(offer.roundId);
	try {
		return await stageOfRound(pwuId, offer, deps);
	} finally {
		STAGES_RUNNING.delete(offer.roundId);
	}
}


/** One press's parts, in order, for the round its offer named (`runAssuranceStage`). */
async function stageOfRound(pwuId: string, offer: AssuranceStageOffer, deps: AssuranceStageDeps): Promise<AssuranceStageOutcome> {
	const { engine, store } = deps;
	const unit = (engine.loadObject(pwuId)?.state ?? {}) as Record<string, unknown>;
	const undertakingId = str(unit.undertakingId);
	const undertaking = (engine.loadObject(undertakingId)?.state ?? {}) as Record<string, unknown>;
	const roundId = offer.roundId;
	const roundVersion = Number(engine.loadObject(roundId)?.semanticVersion ?? 1);
	const parts: StagePartOutcome[] = [];
	const writer = { actorId: 'agent:assurance-stage', actorType: 'AGENT' as const, displayName: 'Assurance stage' };
	const record = async (part: StagePart, status: StagePartStatus, bytes: string, limitations: readonly string[], producedBy = writer): Promise<StagePartOutcome> => {
		const done = await recordStagePart(deps, { part, roundId, undertakingId, unitId: pwuId, bytes, status, producedBy, limitations });
		if ('refusedBecause' in done) return { part, status, why: `its record was refused: ${done.refusedBecause}` };
		return { part, status, artifactId: done.artifactId, ...(limitations.length > 0 ? { why: limitations.join('; ') } : {}) };
	};
	/**
	 * ⭐ The independent review's defect 4 — A HELPER THAT DID NOT RUN: recorded FAILING where it failed (`failed`, its why the error), NOT RUN where a
	 * rule kept it from running (another executor, no directory to copy); the stage goes on either way.
	 */
	const helperNotRun = async (
		part: StagePart,
		helper: { readonly why: string; readonly limitations: readonly string[]; readonly failed?: true }
	): Promise<StagePartOutcome> =>
		helper.failed === true
			? record(part, 'failing', JSON.stringify({ failed: helper.why }), [helper.why, ...helper.limitations])
			: record(part, 'not-run', JSON.stringify({ notRun: helper.why }), [helper.why, ...helper.limitations]);

	// ── 1. THE CHAPTER (D76): first, from the records since the last chapter.
	const before = stageRecordsIn(engine).filter((r) => r.part === STAGE_PART.CHAPTER && r.undertakingId === undertakingId);
	const previousRecord = before.at(-1);
	const records = await chapterRecordsOf(engine, store, undertakingId, previousRecord ? firstEventOf(engine, previousRecord.artifactId) : -1);
	const previousChapters = await chaptersOf(engine, store, undertakingId);
	const previous = previousChapters.at(-1);
	const number = before.length + 1;
	const prompt = narrativeChapterPrompt({
		number,
		undertaking: { objective: str(undertaking.objective), intendedOutputProduct: str(undertaking.intendedOutputProduct) },
		previous,
		records
	});
	const written = await writeChapter(prompt, () => standInChapter(number, records, previous?.id ?? null), deps);
	if (!written.ran) parts.push(await record(STAGE_PART.CHAPTER, 'not-run', JSON.stringify({ notRun: written.why }), [written.why]));
	else {
		if (written.recorded) {
			const sink = createExchangeSink();
			const arrived = written.answer.trim() !== '';
			const checked = checkNarrativeChapter(written.answer, new Set(records.map((r) => r.id)));
			await captureTry({
				store,
				sink,
				tenantPrefix: deps.tenantPrefix,
				exchangeId: deps.newId('exch'),
				role: 'initial',
				model: written.producer,
				prompt,
				rawOutput: written.raw,
				disposition: arrived ? 'accepted' : 'no-response',
				attemptOrdinal: 1,
				requestedAt: deps.now(),
				respondedAt: deps.now(),
				parseOutcome: arrived
					? { outcome: checked.failures.length === 0 ? 'PARSED' : 'JSON_PARSE_FAILED', detail: checked.failures.join('; ') || 'the chapter passed its check' }
					: { outcome: written.failure ? 'NOT_ATTEMPTED' : 'EMPTY_RESPONSE', detail: written.failure ?? 'the writer returned no answer' },
				workProductDerivation: { relation: 'NO_WORK_PRODUCT_EXPECTED', reason: 'A narrative chapter of the loop (design D76): an account of the record, never work product.' },
				observedToolCalls: governedToolCallReport(
					written.observation ?? { canObserve: false, reason: 'The narrative writer’s transport reports nothing about tool calls.' }
				)
			});
			recordExchanges(deps.dispatchExchange, sink.drain(), {
				runToken: deps.newId('stagerun'),
				plane: 'ASSURANCE',
				invokerId: NARRATIVE_WRITER_INVOKER,
				assurancePolicyId: HISTORIAN_POLICY_ID,
				subjectObjectId: roundId,
				subjectObjectType: 'ASSURANCE_ASSESSMENT',
				subjectSemanticVersion: roundVersion,
				newId: deps.newId
			});
		}
		const checked = checkNarrativeChapter(written.answer, new Set(records.map((r) => r.id)));
		const failures = written.failure !== undefined ? [`the writer's call failed: ${written.failure}`] : checked.failures;
		parts.push(
			await record(STAGE_PART.CHAPTER, failures.length === 0 ? 'recorded' : 'failing', written.answer || JSON.stringify({ noAnswer: true }), failures, {
				actorId: `model:${written.producer.modelId}`,
				actorType: 'AGENT',
				displayName: 'Narrative writer'
			})
		);
	}

	// ── 2. THE HYPOTHESIZER (D74, D87): in a copy of the shared workspace, its hashes compared.
	const executor = deps.executor;
	const narrative = await chaptersOf(engine, store, undertakingId);
	const candidates = await candidatesOf(engine, store, pwuId, undertakingId);
	const candidateIds = new Set(candidates.map((c) => c.id));
	const { findings } = rejectingVerdictFindings(engine, pwuId);
	const shared = sharedWorkspaceOf(deps, undertakingId);
	if (executor.kind === 'REFUSED')
		parts.push(await record(STAGE_PART.DIAGNOSIS, 'not-run', JSON.stringify({ notRun: executor.reason }), [`no executor can run: ${executor.reason}`]));
	else if (!shared.ok) parts.push(await record(STAGE_PART.DIAGNOSIS, 'not-run', JSON.stringify({ notRun: shared.why }), [shared.why]));
	else {
		// ⭐ The independent review's defect 4, and its re-check (E) — a helper's failure anywhere, its session's close included, is returned as that
		// part's (`runStageHelper`), and the stage goes on.
		const hypothesizerRecords = await recordFilesOf(engine, store, deps.tenantPrefix, candidates.map((c) => c.id));
		const helper = await runStageHelper(
			{
				role: 'hypothesizer',
				roundId,
				roundVersion,
				undertakingId,
				shared: shared.workspace,
				executor,
				prompt: hypothesizerPrompt({ rejectedUnit: { id: pwuId, title: str(unit.title) }, failedCriteria: findings, candidates, narrative, recordFiles: hypothesizerRecords.named }),
				// ⭐ Package L17b3 (D89; `REG-D-173` (5)) — the recorded conversations of the rejected unit and of each candidate, in its copy.
				recordFiles: hypothesizerRecords.files,
				parse: (a) => {
					const r = readDiagnosis(a, candidateIds, []);
					return r.ok ? { outcome: 'PARSED', detail: 'read as a diagnosis' } : { outcome: 'JSON_PARSE_FAILED', detail: r.why };
				}
			},
			{ ...deps, openPi: deps.openPi }
		);
		if (!helper.ran) parts.push(await helperNotRun(STAGE_PART.DIAGNOSIS, helper));
		else {
			const read = readDiagnosis(helper.answer, candidateIds, helper.capturedArgv);
			const limitations = [...helper.limitations];
			let status: StagePartStatus = 'recorded';
			if (helper.sharedChanged.length > 0) {
				status = 'refused';
				limitations.push(`the shared workspace changed while it ran (${helper.sharedChanged.join(', ')}), so its diagnosis is refused (design D74)`);
			}
			if (!read.ok) {
				status = status === 'refused' ? status : 'failing';
				limitations.push(`its answer was not read: ${read.why}`);
			} else {
				if (read.diagnosis.refusedBecause !== undefined) {
					status = 'refused';
					limitations.push(`its diagnosis is refused: ${read.diagnosis.refusedBecause}`);
				}
				limitations.push(...read.diagnosis.findings);
			}
			parts.push(
				await record(STAGE_PART.DIAGNOSIS, status, helper.answer || JSON.stringify({ noAnswer: true }), limitations, {
					actorId: `model:${helper.producer.modelId}`,
					actorType: 'AGENT',
					displayName: 'Hypothesizer'
				})
			);
		}
	}

	// ── 3. THE UNSTICKING AGENT (D75): when, and only when, the round has an open recurrence.
	const recurrence = openRecurrencesOf(engine, pwuId, roundId);
	if (recurrence.length === 0) parts.push({ part: STAGE_PART.STEP_BACK, status: 'not-run', why: 'the round has no open KNOWN_FAILURE_RECURRENCE observation (design D75)' });
	else if (executor.kind === 'REFUSED')
		parts.push(await record(STAGE_PART.STEP_BACK, 'not-run', JSON.stringify({ notRun: executor.reason }), [`no executor can run: ${executor.reason}`]));
	else if (!shared.ok) parts.push(await record(STAGE_PART.STEP_BACK, 'not-run', JSON.stringify({ notRun: shared.why }), [shared.why]));
	else {
		const earlier = await earlierRoundsOf(engine, store, undertakingId, roundId);
		// ⭐ Package L17b3 (D89; `REG-D-173` (5)) — the recorded conversations of the rejected unit and of each unit the recurrence names (its subjects).
		const unstickingRecords = await recordFilesOf(engine, store, deps.tenantPrefix, [pwuId, ...recurrenceSubjectsOf(engine, recurrence)]);
		const helper = await runStageHelper(
			{
				role: 'unsticking',
				roundId,
				roundVersion,
				undertakingId,
				shared: shared.workspace,
				executor,
				prompt: unstickingPrompt({
					rejectedUnit: { id: pwuId, title: str(unit.title) },
					recurrence,
					narrative: await chaptersOf(engine, store, undertakingId),
					earlier,
					recordFiles: unstickingRecords.named
				}),
				recordFiles: unstickingRecords.files,
				parse: (a) => {
					const r = readStepBack(a);
					return r.ok ? { outcome: 'PARSED', detail: 'read as a step-back' } : { outcome: 'JSON_PARSE_FAILED', detail: r.why };
				}
			},
			deps
		);
		if (!helper.ran) parts.push(await helperNotRun(STAGE_PART.STEP_BACK, helper));
		else {
			const read = readStepBack(helper.answer);
			const limitations = [...helper.limitations];
			let status: StagePartStatus = 'recorded';
			if (helper.sharedChanged.length > 0) {
				status = 'refused';
				limitations.push(`the shared workspace changed while it ran (${helper.sharedChanged.join(', ')}), so its step-back is refused (design D75)`);
			}
			if (!read.ok) {
				status = status === 'refused' ? status : 'failing';
				limitations.push(`its answer was not read: ${read.why}`);
			}
			parts.push(
				await record(STAGE_PART.STEP_BACK, status, helper.answer || JSON.stringify({ noAnswer: true }), limitations, {
					actorId: `model:${helper.producer.modelId}`,
					actorType: 'AGENT',
					displayName: 'Unsticking Agent'
				})
			);
		}
	}
	return { roundId, parts };
}

/** The Undertaking's shared workspace, which the helpers copy, or why it cannot be had: a resolution that throws is the stage's finding, never a 500. */
function sharedWorkspaceOf(
	deps: AssuranceStageDeps,
	undertakingId: string
): { readonly ok: true; readonly workspace: UndertakingSandbox['workspace'] } | { readonly ok: false; readonly why: string } {
	try {
		return { ok: true, workspace: deps.sandboxOf(undertakingId).workspace };
	} catch (e) {
		return { ok: false, why: `the Undertaking's shared workspace could not be resolved: ${describedThrow(e)}` };
	}
}

/** ⭐ D75 — the earlier rounds' diagnoses and tactic records of the Undertaking, as the Unsticking Agent is shown them. */
async function earlierRoundsOf(
	engine: EngineHandle,
	store: ArtifactStore,
	undertakingId: string,
	roundId: string
): Promise<{ id: string; kind: string; text: string }[]> {
	const unitIds = new Set(listPwus(engine, undertakingId).map((u) => u.id));
	const out: { id: string; kind: string; text: string }[] = [];
	for (const r of stageRecordsIn(engine)) {
		if (r.roundId === roundId) continue;
		const ofThisUndertaking = r.undertakingId === undertakingId || unitIds.has(r.unitId);
		if (!ofThisUndertaking || (r.part !== STAGE_PART.DIAGNOSIS && r.part !== STAGE_PART.TACTIC)) continue;
		const json = await stageJsonOf(store, r);
		out.push({ id: r.artifactId, kind: r.part, text: json === undefined ? `(${r.status}, unreadable)` : JSON.stringify(json).slice(0, 2000) });
	}
	return out;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173` (5); the lead's ruling §10.1 (2)) — THE RECORDED CONVERSATIONS A HELPER JUDGES FROM:
 * each of `unitIds` that left an executor exchange, rendered from the record by the one renderer (its parts joined by a blank line, their headings
 * kept), as the files written into the helper's copy and the lines its prompt names them by; a unit that left none has no file.
 */
async function recordFilesOf(
	engine: EngineHandle,
	store: ArtifactStore,
	tenantPrefix: string,
	unitIds: readonly string[]
): Promise<{
	readonly files: readonly { readonly path: string; readonly text: string }[];
	readonly named: readonly { readonly unitId: string; readonly title: string; readonly file: string }[];
}> {
	const rows = recordRowsOf(engine);
	const files: { path: string; text: string }[] = [];
	const named: { unitId: string; title: string; file: string }[] = [];
	for (const unitId of [...new Set(unitIds)]) {
		const conversation = await unitConversationOf(rows, store, tenantPrefix, unitId);
		if (conversation.exchanges.length === 0) continue;
		const file = recordFilePath(conversation.title, unitId);
		files.push({ path: file, text: renderUnitConversation(conversation).join('\n\n') });
		named.push({ unitId, title: conversation.title, file });
	}
	return { files, named };
}

/** ⭐ Package L17b3 (D89; §10.1 (2)) — the units a round's recurrences name: their observations' subjects, read structurally, each once, in order. */
function recurrenceSubjectsOf(engine: EngineHandle, recurrence: readonly { readonly id: string }[]): string[] {
	return recurrence.flatMap((r) => {
		const subjects = (engine.loadObject(r.id)?.state as { subjectObjectIds?: unknown } | undefined)?.subjectObjectIds;
		return Array.isArray(subjects) ? subjects.filter((s): s is string => typeof s === 'string') : [];
	});
}
