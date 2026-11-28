// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73 with D86 and D89's inputs for the Historian (`DESIGN-data-flow-order-and-deliverable-review.md` §12.27,
// §12.40, §12.43; `REG-D-166` (2), (3), (6); `REG-D-167` (3); `REG-D-173` (5); the lead's rulings 2, 5, 6, 8 to 11, 16, 17, 19 and 22 on L17b2's Stage 0,
// §7 (Q1) and §9) — THE HISTORIAN'S PART OF THE ASSURANCE STAGE: third in the stage, and again where it is asked once more (ruling 7).
//
// ⭑ WHEN IT CANNOT RUN (ruling 6, 16; §7): recorded `not-run`, with why, and nothing called or recorded of it — the selected reviewer refused, a replay,
// agy, or the stand-in with no ~~`historianExec`~~ ⭐ `historianSpawn` (L17b6, D94: a test's seam, as `writerPrint` is the writer's); its time bound unset; the shared workspace unresolved,
// or not read whole through the port; devin at a version other than the one its tools were measured at; ⭐ (the lead's §27, item 7) two of its record
// files of one name, its folder then not written; ⭐ (r26 (2); r27, r27a) two of its workspace files that land on one name in its copy — case not told
// apart, before its folder is made, or as the volume reads names, at the copy's write (`HistorianCopyRefusal`).
// ⭑ WHAT IT IS SHOWN (D73, D86; ruling 9): its prompt (`historianPrompt`) and a fresh folder (`writeHistorianFolder`) — `records/`, each named by its record's
// id: every REJECTED declared verdict over a unit of the Undertaking (this round's and earlier ones'), each earlier round's Historian assessment, every
// stage record of the Undertaking but this round's own Historian records, each way back's Decision, each unit with its states, and the recorded
// conversations of the rejected unit and of each candidate — the Hypothesizer's very files (D89); `records/INDEX.md`; and `workspace/`, the shared
// workspace read through the port.
// ⭑ WHAT IS RECORDED (D73; rulings 5, 10, 11, 17, 19, 22): its exchange — the ASSURANCE plane, its role's own (`HISTORIAN_INVOKER`), the policy, over the
// round — ~~its session export stored and pointed at from its tool observation~~ ⭐ (L17b6, D94; the lead's §39, Q2, Q11) its reply joined as its raw
// output, the answer's span handed in as REG-D-204's rule finds it, its tool observation `NOT_OBSERVABLE` saying where the calls read from devin's
// notices are kept, and nothing stored in the export's place; then, its answer read from its last message, ONE batch: the §30 drive with its reviewer as
// evaluator, one `RecordCriterionResult` per criterion of the stored rubric, an observation per failed criterion at the policy's severity, the recurrence
// as `KNOWN_FAILURE_RECURRENCE` citing the earlier records it names in `evidenceIds`, each cited record it was not given (`HISTORIAN_RECORD_NOT_GIVEN`)
// and each finding of ~~its export~~ ⭐ its notices (`historianToolCallsOf`) MATERIAL, and the completion under `HISTORIAN_VALIDATOR_ID` with the verdict computed from those
// rows and findings as every declared review's is (`declaredVerdict`; never the reviewer's recommendation, `REG-F-523`), its recommended action in
// `recommendedControlActions` (Gate B holds it to the policy's list), and the rejected unit's executor as `producer`, so `DIFFERENT_AGENT` is checked.
// One batch: refused anywhere — Gate B's words among the reasons — nothing of the assessment is left (ruling 5; §5). Then its stage record,
// `historical-assessment`: its answer ⭐ (L17b6, §39, Q3: and the words around it, its working remarks, its requests and its session's facts), its tool
// calls with their paths, its exchange and its assessment; `recorded`, or `failing` where its call failed,
// its answer was not read, or its assessment was refused. ⛔ It is never folded into the unit's own assurance: no hop is made, and the kernel's index
// leaves out an assessment completed under its validator id (ruling 18).
// ⛔ IT NEVER THROWS: whatever it throws, whatever the value, is its part's failure, said through the one describer (`describedThrow`).
// ⭑ ⭐ D84 (`REG-D-189`) — WHAT IT IS SHOWN IS ONE FUNCTION, `historianInputOf`, which the part and D84's measurement driver both call, so the folder the
// driver shows the sponsor is built from the same reading as the folder the part's call runs in.
import { reasoningReviewResultFromJudgement, type FloorCriterion } from '@janumipwb/rph-assurance';
import type { ActorReference, AssessmentCriterion, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { driveAssessmentToAssessing, listByType, listPwus, type EngineHandle } from '@janumipwb/rph-engine';
import type { ArtifactStore, Workspace } from '@janumipwb/rph-ports';
import { describedThrow } from '../described-throw.js';
import { firstMexIs } from '../execution/dropped-replies.js';
import { governedToolCallReport } from '../tools/observed-tool-calls.js';
import {
	devinHistorianCall,
	HistorianCopyRefusal,
	historianCallBound,
	historianToolCallsOf,
	historianWorkspaceFiles,
	recordNameClash,
	workspaceCopyClash,
	writeHistorianFolder,
	type HistorianCallOutcome,
	// ⭐ L17b6 (D94) — ~~`type HistorianExec,`~~: the Historian's program is its ACP child's spawn.
	type HistorianRecordFile,
	type HistorianSpawn,
	type HistorianVersionOf
} from '../tools/devin-historian.js';
import {
	STAGE_PART,
	stageBytesOf,
	stageJsonOf,
	stageRecordsIn,
	type StagePart,
	type StagePartStatus,
	type StageRecord,
	type StageStep
} from './assurance-stage-records.js';
import { HISTORIAN_INVOKER, HISTORIAN_POLICY_ID, KNOWN_FAILURE_RECURRENCE, REPLAY_RUNS_NO_STAGE } from './assurance-stage-roles.js';
import { declaredVerdict, evidenceCeiling, type AssessmentDisposition } from './declared-policy-signoff.js';
import { captureTry, createExchangeSink } from './exchange-capture.js';
import { recordExchanges } from './exchange-recorder.js';
import { HISTORIAN_VALIDATOR_ID, historianPrompt, readHistorianAnswer, type HistorianAnswer } from './historian.js';
import { refusalMessage, selectReviewer } from './reviewer-selection.js';

/** ⭐ Ruling 10 (as §6.3 has it) — the finding on the Historian's assessment for a record its recurrence cites and it was not given. */
export const HISTORIAN_RECORD_NOT_GIVEN = 'HISTORIAN_RECORD_NOT_GIVEN';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** What the Historian's part needs of the stage's dependencies. */
export interface HistorianPartDeps {
	readonly engine: EngineHandle;
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	readonly runSteps: (steps: readonly StageStep[]) => string | null;
	/** ⭐ The batch its assessment is issued in, under the reviewer's credential, where the caller hands one (the page's); else `runSteps`. */
	readonly runReviewerSteps?: (steps: readonly StageStep[]) => string | null;
	readonly dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => { status: string };
	readonly testMode: boolean;
	/**
	 * ⭐ Ruling 6 — a test's seam: the Historian's program, as `writerPrint` is the writer's transport; never over a refused selection or a replay. ⭐ L17b6
	 * (D94) — ~~`readonly historianExec?: HistorianExec;`~~: its ACP child's spawn.
	 */
	readonly historianSpawn?: HistorianSpawn;
	readonly historianVersionOf?: HistorianVersionOf;
}

/** One part's outcome, as the stage returns it. */
export interface HistorianPartOutcome {
	readonly part: StagePart;
	readonly status: StagePartStatus;
	readonly artifactId?: string;
	readonly why?: string;
}

/** The stage's recorder of one part: its record, and the outcome the stage returns (`assurance-stage.ts`). */
export type RecordStagePart = (
	part: StagePart,
	status: StagePartStatus,
	bytes: string,
	limitations: readonly string[],
	producedBy?: ActorReference,
	extra?: { readonly named?: string | null; readonly assessmentId?: string }
) => Promise<HistorianPartOutcome>;

/** What the stage hands its Historian part: the round, what the stage already read of it, and its recorder. */
export interface HistorianPartContext {
	readonly deps: HistorianPartDeps;
	readonly record: RecordStagePart;
	readonly pwuId: string;
	readonly unitTitle: string;
	readonly undertakingId: string;
	readonly roundId: string;
	readonly roundVersion: number;
	/** The shared workspace, or why it could not be resolved (`sharedWorkspaceOf`). */
	readonly shared: { readonly ok: true; readonly workspace: Pick<Workspace, 'list' | 'readFile'> } | { readonly ok: false; readonly why: string };
	/** The narrative so far, chapter by chapter (`chaptersOf`). */
	readonly narrative: readonly {
		readonly id: string;
		readonly failing: boolean;
		readonly statements: readonly { readonly text: string; readonly cites: readonly string[] }[];
	}[];
	/** This sign-off's rejecting verdicts' failed criteria, in D71's form (`rejectingVerdictFindings`). */
	readonly failedCriteria: readonly { readonly code: string; readonly statement: string }[];
	/** This sign-off's rejecting verdicts, by their assessment ids, in the selection's order: the round's, its first the round's id. */
	readonly rejectingVerdictIds: readonly string[];
	/** The recorded conversations of the rejected unit and of each candidate, as the Hypothesizer is given them (`recordFilesOf`). */
	readonly conversations: {
		readonly files: readonly { readonly path: string; readonly text: string }[];
		readonly named: readonly { readonly unitId: string; readonly title: string; readonly file: string }[];
	};
}

/** The stored Historian's policy, as its prompt, its rows and its verdict read it: never a constant (`ASR-4`). */
interface StoredPolicy {
	readonly policyId: string;
	readonly version: string;
	readonly name: string;
	readonly purpose: string;
	readonly criteria: readonly AssessmentCriterion[];
	readonly permittedControlActions: readonly string[];
	readonly evidenceCeiling: Exclude<AssessmentDisposition, 'REJECTED'>;
	readonly recurrenceSeverity: string;
}

/** ⭐ D73 — the Historian's policy as the store holds it, or undefined where it holds none. */
function storedPolicyOf(engine: EngineHandle): StoredPolicy | undefined {
	const s = engine.loadObject(HISTORIAN_POLICY_ID)?.state as Record<string, unknown> | undefined;
	if (s === undefined) return undefined;
	const annotations = (s.findingAnnotations ?? {}) as Record<string, { defaultSeverity?: unknown } | undefined>;
	return {
		policyId: HISTORIAN_POLICY_ID,
		version: str(s.version) || '1.0.0',
		name: str(s.name) || HISTORIAN_POLICY_ID,
		purpose: str(s.purpose),
		criteria: Array.isArray(s.criteria) ? (s.criteria as AssessmentCriterion[]) : [],
		permittedControlActions: strings(s.permittedControlActions),
		evidenceCeiling: evidenceCeiling(
			(Array.isArray(s.requiredEvidence) ? s.requiredEvidence : []) as ReadonlyArray<{ requiredForDispositions?: string; cardinality?: string }>
		),
		// ⭐ The recurrence's severity is the policy's own: its annotation's, else its failure severity (the catalog's §22.5).
		recurrenceSeverity: str(annotations[KNOWN_FAILURE_RECURRENCE]?.defaultSeverity) || str(s.failureSeverity) || 'MATERIAL'
	};
}

/** Who answers as the Historian: the selected reviewer, devin, or a test's seam; or why none can (ruling 6). */
function historianRunnerOf(
	deps: HistorianPartDeps
):
	| { readonly ok: true; readonly model: string; readonly providerId: string; readonly given: { readonly spawn?: HistorianSpawn; readonly versionOf?: HistorianVersionOf } }
	| { readonly ok: false; readonly why: string } {
	const selected = selectReviewer({ testMode: deps.testMode });
	if (selected.kind === 'REFUSED') return { ok: false, why: `the Historian runs on the selected reviewer, and none can run: ${refusalMessage(selected)}` };
	if (selected.kind === 'REPLAY') return { ok: false, why: REPLAY_RUNS_NO_STAGE };
	// ⭐ L17b6 (D94) — ~~`deps.historianExec`~~ and ~~`given: { exec: deps.historianExec, … }`~~: the seam is the ACP child's spawn.
	if (deps.historianSpawn !== undefined)
		return {
			ok: true,
			model: selected.kind === 'DEVIN' ? selected.modelId : 'injected-historian',
			providerId: selected.kind === 'DEVIN' ? 'devin' : 'test',
			given: { spawn: deps.historianSpawn, ...(deps.historianVersionOf === undefined ? {} : { versionOf: deps.historianVersionOf }) }
		};
	if (selected.kind === 'DEVIN') return { ok: true, model: selected.modelId, providerId: 'devin', given: {} };
	return {
		ok: false,
		why: `the Historian is a devin session with read-only tools (design D86), and the selected reviewer is ${selected.kind === 'AGY' ? 'agy' : 'the stand-in'}`
	};
}

/** One criterion result an assessment recorded: its last per criterion. */
interface CriterionRow {
	readonly criterionId: string;
	readonly result: string;
	readonly rationale: string;
}

/**
 * The event log, read ONCE for the Historian's records (§26.5 (1)): each assessment's criterion results, in the order recorded, its last per
 * criterion; and each completed assessment's recommended actions and validator id.
 */
function scanOf(engine: EngineHandle): {
	readonly rows: ReadonlyMap<string, readonly CriterionRow[]>;
	readonly completed: ReadonlyMap<string, { readonly recommendedControlActions: unknown; readonly validatorId: string }>;
} {
	const byAssessment = new Map<string, Map<string, CriterionRow>>();
	const completed = new Map<string, { recommendedControlActions: unknown; validatorId: string }>();
	for (const e of engine.readAllEvents()) {
		if (e.eventType === 'AssuranceCriterionEvaluated') {
			const p = (e.payload ?? {}) as { criterionId?: unknown; result?: unknown; rationale?: unknown };
			if (typeof p.criterionId !== 'string') continue;
			const of = byAssessment.get(e.aggregateId) ?? new Map<string, CriterionRow>();
			of.set(p.criterionId, { criterionId: p.criterionId, result: str(p.result), rationale: str(p.rationale) });
			byAssessment.set(e.aggregateId, of);
		} else if (e.eventType === 'AssuranceAssessmentCompleted') {
			const p = (e.payload ?? {}) as { recommendedControlActions?: unknown; validatorId?: unknown };
			completed.set(e.aggregateId, { recommendedControlActions: p.recommendedControlActions ?? [], validatorId: str(p.validatorId) });
		}
	}
	return { rows: new Map([...byAssessment].map(([id, of]) => [id, [...of.values()]] as const)), completed };
}

/** ⭐ D71's form — the criteria an assessment recorded neither MET nor NOT_APPLICABLE, in the order recorded, each with its rationale. */
function failedCriteriaOf(rows: readonly CriterionRow[]): { code: string; statement: string }[] {
	return rows
		.filter((r) => r.result !== 'MET' && r.result !== 'NOT_APPLICABLE')
		.map((r) => ({
			code: r.criterionId,
			statement: r.rationale.trim() === '' ? `Criterion ${r.criterionId} was answered ${r.result}, with no rationale recorded.` : r.rationale
		}));
}

/** A record file's JSON text, two-space indented. */
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** ⭐ D86, ruling 9 — the Historian's `records/`: each file named by its record's id, with what it is; and the ids it is given. */
async function historianRecordsOf(
	ctx: HistorianPartContext,
	rejectingIds: ReadonlySet<string>
): Promise<{
	readonly files: HistorianRecordFile[];
	readonly givenIds: ReadonlySet<string>;
	readonly earlierRounds: readonly { readonly roundId: string; readonly failedCriteria: readonly { code: string; statement: string }[] }[];
}> {
	const { engine, store } = ctx.deps;
	const units = listPwus(engine, ctx.undertakingId);
	const unitIds = new Set(units.map((u) => u.id));
	const titleOf = (id: string): string => str((engine.loadObject(id)?.state as { title?: unknown } | undefined)?.title) || id;
	const { rows, completed } = scanOf(engine);
	const allStage = stageRecordsIn(engine);
	const stage = allStage.filter((r) => r.undertakingId === ctx.undertakingId || unitIds.has(r.unitId));
	const earlierHistorians = new Map(
		stage.filter((r) => r.part === STAGE_PART.HISTORIAN && r.roundId !== ctx.roundId && r.assessmentId !== undefined).map((r) => [r.assessmentId!, r.roundId])
	);
	const observations = listByType(engine, 'ASSURANCE_OBSERVATION');
	const files: HistorianRecordFile[] = [];
	const assessmentFile = (id: string, what: string): HistorianRecordFile => {
		const s = (engine.loadObject(id)?.state ?? {}) as Record<string, unknown>;
		return {
			file: `${id}.json`,
			what,
			text: json({
				assessmentId: id,
				policyId: str(s.assurancePolicyId),
				state: str(s.assessmentState),
				subjects: strings(s.subjectObjectIds).map((u) => ({ id: u, title: titleOf(u) })),
				criteria: rows.get(id) ?? [],
				observations: observations
					.filter((o) => o.state.assessmentId === id)
					.map((o) => ({
						observationId: o.id,
						findingCode: str(o.state.findingCode),
						severity: str(o.state.severity),
						disposition: str(o.state.disposition),
						statement: str(o.state.statement),
						evidenceIds: strings(o.state.evidenceIds)
					})),
				recommendedControlActions: completed.get(id)?.recommendedControlActions ?? []
			})
		};
	};
	// The assessments: every REJECTED one over a unit of the Undertaking — this round's rejecting verdicts first — and each earlier round's Historian's.
	const assessments = listByType(engine, 'ASSURANCE_ASSESSMENT').filter((a) => strings(a.state.subjectObjectIds).some((u) => unitIds.has(u)));
	const verdictWhat = (a: { id: string; state: Record<string, unknown> }, when: string): string =>
		`${when} under ${str(a.state.assurancePolicyId)} over ${strings(a.state.subjectObjectIds)
			.map((u) => `"${titleOf(u)}" (${u})`)
			.join(', ')}, ${str(a.state.assessmentState)}, with its criteria results and its findings`;
	for (const a of assessments.filter((x) => rejectingIds.has(x.id))) files.push(assessmentFile(a.id, verdictWhat(a, 'a rejecting verdict of this round')));
	for (const a of assessments.filter((x) => !rejectingIds.has(x.id))) {
		const round = earlierHistorians.get(a.id);
		if (round !== undefined)
			files.push(assessmentFile(a.id, `the Historian's assessment of an earlier round (${round}), ${str(a.state.assessmentState)}, with its criteria results, its findings and the action it recommended`));
		else if (str(a.state.assessmentState) === 'REJECTED' && completed.get(a.id)?.validatorId !== HISTORIAN_VALIDATOR_ID)
			files.push(assessmentFile(a.id, verdictWhat(a, 'an earlier rejecting verdict')));
	}
	// The stage records: each of the Undertaking's, but this round's own Historian records (a re-ask is shown what the first ask was shown).
	for (const r of stage.filter((x) => !(x.part === STAGE_PART.HISTORIAN && x.roundId === ctx.roundId))) files.push(await stageRecordFile(store, r, titleOf));
	// The ways back: each of the person's REPLAN Decisions over a unit of the Undertaking.
	for (const d of listByType(engine, 'DECISION').filter((x) => x.state.decisionType === 'REPLAN' && strings(x.state.subjectObjectIds).some((u) => unitIds.has(u))))
		files.push({
			file: `${d.id}.json`,
			what: `a way back: the person's Decision ${str(d.state.selectedOption)} (${str(d.state.status)})`,
			text: json({
				decisionId: d.id,
				decisionType: str(d.state.decisionType),
				selectedOption: str(d.state.selectedOption),
				status: str(d.state.status),
				subjects: strings(d.state.subjectObjectIds),
				rationale: str(d.state.rationale)
			})
		});
	// The units, each with its type and its three states, its parent, its dependencies and its successor.
	for (const u of units) {
		const type = (engine.loadObject(str(u.state.pwuTypeId))?.state ?? {}) as Record<string, unknown>;
		files.push({
			file: `${u.id}.json`,
			what: `the work unit "${str(u.state.title) || u.id}": its type, its three states, its parent, its dependencies and its successor`,
			text: json({
				unitId: u.id,
				title: str(u.state.title),
				type: { id: str(u.state.pwuTypeId), name: str(type.name), kind: str(type.pwuKind) },
				lifecycle: str(u.state.workLifecycleState),
				execution: str(u.state.executionState),
				assurance: str(u.state.assuranceState),
				parent: str(u.state.parentWorkUnitId) || null,
				dependencies: strings(u.state.dependencyIds),
				successor: str(u.state.supersedingWorkUnitId) || null
			})
		});
	}
	const givenIds = new Set(files.map((f) => f.file.replace(/\.json$/, '')));
	// ⭐ D89 — the recorded conversations of the rejected unit and of each candidate: the Hypothesizer's very files, at their names.
	for (const n of ctx.conversations.named) {
		const text = ctx.conversations.files.find((f) => f.path === n.file)?.text;
		if (text === undefined) continue;
		files.push({
			file: n.file.slice(n.file.lastIndexOf('/') + 1),
			what: `the recorded conversation of "${n.title}" (${n.unitId}), as the Governed Stream recorded it`,
			text
		});
	}
	// ⭐ D73 — each earlier round of the Undertaking, by its opening verdict (each round the stage ran for), with its failed criteria.
	const rounds: string[] = [];
	for (const r of allStage)
		if (r.part === STAGE_PART.CHAPTER && r.undertakingId === ctx.undertakingId && r.roundId !== ctx.roundId && !rounds.includes(r.roundId)) rounds.push(r.roundId);
	return { files, givenIds, earlierRounds: rounds.map((id) => ({ roundId: id, failedCriteria: failedCriteriaOf(rows.get(id) ?? []) })) };
}

/** One stage record as a record file: its part, round, unit and status, the host's findings on it, and its content read back against its hash. */
async function stageRecordFile(store: ArtifactStore, r: StageRecord, titleOf: (id: string) => string): Promise<HistorianRecordFile> {
	const parsed = await stageJsonOf(store, r);
	const bytes = parsed === undefined ? await stageBytesOf(store, r) : undefined;
	const what: Readonly<Record<string, string>> = {
		[STAGE_PART.CHAPTER]: `the narrative's chapter written at round ${r.roundId}`,
		[STAGE_PART.DIAGNOSIS]: `the Hypothesizer's diagnosis of round ${r.roundId}`,
		[STAGE_PART.STEP_BACK]: `the Unsticking Agent's step-back of round ${r.roundId}`,
		[STAGE_PART.HISTORIAN]: `the Historian's record of an earlier round (${r.roundId})`,
		[STAGE_PART.TACTIC]: `the tactic record "${titleOf(r.unitId)}" (${r.unitId}) wrote, after round ${r.roundId}`,
		[STAGE_PART.TACTIC_FINDING]: `the host's finding on a tactic record of "${titleOf(r.unitId)}" (${r.unitId}), after round ${r.roundId}`
	};
	return {
		file: `${r.artifactId}.json`,
		what: `${what[r.part] ?? `the assurance stage's ${r.part} of round ${r.roundId}`}, ${r.status}`,
		text: json({
			artifactId: r.artifactId,
			part: r.part,
			round: r.roundId,
			unitId: r.unitId,
			status: r.status,
			hostFindings: r.limitations,
			...(parsed !== undefined
				? { content: parsed }
				: bytes !== undefined
					? { content: bytes }
					: { content: null, unreadable: 'its bytes could not be read back whole against their recorded hash' })
		})
	};
}

// ⭐ L17b6 (D94; the lead's §39, Q12) — ~~`function reportedModelOf(exportText: string | undefined): string | undefined { … steps[].extra.generation_model …
// }`~~, the model devin reported in its export: no export is written over ACP. The model is the label devin's session ran the turn under
// (`HistorianSession.modelLabel`), its model and thought level recorded beside.

/**
 * ⭐ Ruling 11 — what the Historian's adapter can see of its tool calls as they are made: ~~nothing; and where what its export shows of them is kept~~ ⭐
 * (L17b6, D94; the lead's §39, Q11) only what devin's own notices say of them; and where they are kept. Still `NOT_OBSERVABLE`: devin's tools are not the
 * workbench's, and nothing is stored in the export's place. ⭐ ~~'The Historian’s devin session runs to completion with read-only tools, and this
 * adapter watches no session, so it cannot observe its tool calls as they are made. Each tool call its session export records — …'~~
 */
const historianToolObservation = (roundId: string): string =>
	'The Historian’s devin session runs over devin’s ACP server, and this adapter reads each tool call from devin’s own notices as the session gives ' +
	'them; it mints none of devin’s tools, so it cannot vouch for what a tool did. Each call devin announced — its name, its kind, its paths, whether ' +
	'each is inside the Historian’s folder, whether it is allowed and its last status — and each permission request the workbench answered is kept ' +
	`in the historical-assessment record of the round (${roundId}). A reader must not read this record as evidence that no tool ran.`;

/**
 * ⭐ L17b6 (D94; the lead's §39, Q2) — the answer's span in the whole reply: the last message ends the reply, and the answer sits in it after the words
 * before it. Everything before the answer is the prefix (the working remarks and those words), everything after it the suffix. Undefined where the reply
 * does not end with the last message, so the capture splits as it does for every other caller.
 */
function spanInReply(reply: string, lastMessage: string, before: string, answer: string): { prefix: string; answer: string; suffix: string } | undefined {
	if (!reply.endsWith(lastMessage)) return undefined;
	const start = reply.length - lastMessage.length + before.length;
	if (reply.slice(start, start + answer.length) !== answer) return undefined;
	return { prefix: reply.slice(0, start), answer, suffix: reply.slice(start + answer.length) };
}

/** ⭐ L17b6 (D94; the lead's §39, Q3) — the session's facts the record keeps: its model and thought level, its stop, the cancel, the delete, the stop. */
function sessionFactsOf(s: Extract<HistorianCallOutcome, { readonly ran: true }>['session']): Record<string, unknown> {
	return {
		...(s.model === undefined ? {} : { model: s.model }),
		...(s.thoughtLevel === undefined ? {} : { thoughtLevel: s.thoughtLevel }),
		...(s.modelLabel === undefined ? {} : { modelLabel: s.modelLabel }),
		...(s.stopReason === undefined ? {} : { stopReason: s.stopReason }),
		cancelled: s.cancelled,
		...(s.turnEndedAfterCancel === undefined ? {} : { turnEndedAfterCancel: s.turnEndedAfterCancel }),
		deleted: s.deleted,
		stoppedBy: s.stoppedBy,
		unknownRequests: s.unknownRequests,
		unreadLines: s.unreadLines
	};
}

/** ⭐ Ruling 11 — record the Historian's one exchange; its aggregate id, or why it could not be recorded. */
async function recordHistorianExchange(
	ctx: HistorianPartContext,
	x: {
		readonly prompt: string;
		readonly call: Exclude<HistorianCallOutcome, { readonly ran: false }>;
		readonly read: ReturnType<typeof readHistorianAnswer> | undefined;
		readonly model: { readonly modelId: string; readonly providerId: string };
		readonly requestedAt: string;
		readonly respondedAt: string;
		readonly runToken: string;
	}
): Promise<{ readonly exchangeId: string | null; readonly failure?: string }> {
	const { deps } = ctx;
	const sink = createExchangeSink();
	// ⭐ L17b6 (D94) — ~~`x.call.stdout`~~: the reply joined, every message chunk in order, as print mode printed it.
	const raw = x.call.failure === undefined ? x.call.session.reply : '';
	const arrived = raw.trim() !== '';
	// ⭐ L17b6 (D94; the lead's §39, Q2) — the answer's span as REG-D-204's rule found it in the last message, which ends the reply: handed to the capture.
	const answerSpan =
		x.call.failure === undefined && x.read?.ok === true ? spanInReply(raw, x.call.lastMessage, x.read.aroundAnswer.before, x.read.answerText) : undefined;
	let parseOutcome: { readonly outcome: 'PARSED' | 'JSON_PARSE_FAILED' | 'NOT_ATTEMPTED' | 'EMPTY_RESPONSE'; readonly detail: string };
	if (x.call.failure !== undefined) parseOutcome = { outcome: 'NOT_ATTEMPTED', detail: x.call.failure };
	else if (!arrived) parseOutcome = { outcome: 'EMPTY_RESPONSE', detail: 'the Historian returned no answer' };
	else if (x.read?.ok === true) parseOutcome = { outcome: 'PARSED', detail: 'read as the Historian’s answer (design D73)' };
	else parseOutcome = { outcome: 'JSON_PARSE_FAILED', detail: x.read?.ok === false ? x.read.why : 'the Historian’s answer was not read' };
	await captureTry({
		store: deps.store,
		sink,
		tenantPrefix: deps.tenantPrefix,
		exchangeId: deps.newId('exch'),
		role: 'initial',
		model: x.model,
		prompt: x.prompt,
		rawOutput: raw,
		disposition: arrived ? 'accepted' : 'no-response',
		attemptOrdinal: 1,
		requestedAt: x.requestedAt,
		respondedAt: x.respondedAt,
		parseOutcome,
		workProductDerivation: { relation: 'NO_WORK_PRODUCT_EXPECTED', reason: 'The Historian’s assessment of the loop (design D73): a judgment of the record, never work product.' },
		observedToolCalls: governedToolCallReport({ canObserve: false, reason: historianToolObservation(ctx.roundId) }),
		// ⭐ Ruling 11 — ~~its export kept, as `exchange-capture.ts` keeps one: stored where the observation's reason points at it.~~
		// ~~`...(x.call.sessionExport === undefined ? {} : { toolSessionExport: x.call.sessionExport })`~~ ⭐ L17b6 (§39, Q11): nothing in the export's place.
		...(answerSpan === undefined ? {} : { answerSpan })
	});
	const mex = deps.newId('mex');
	const recorded = recordExchanges(deps.dispatchExchange, sink.drain(), {
		runToken: x.runToken,
		plane: 'ASSURANCE',
		invokerId: HISTORIAN_INVOKER,
		assurancePolicyId: HISTORIAN_POLICY_ID,
		subjectObjectId: ctx.roundId,
		subjectObjectType: 'ASSURANCE_ASSESSMENT',
		subjectSemanticVersion: ctx.roundVersion,
		newId: firstMexIs(mex, deps.newId)
	});
	return recorded.recorded === 1 ? { exchangeId: mex } : { exchangeId: null, failure: recorded.failures.join('; ') || 'no exchange was recorded' };
}

/** One finding the Historian's assessment records, beside its failed criteria. */
interface AssessmentFinding {
	readonly code: string;
	readonly severity: string;
	readonly statement: string;
	readonly evidenceIds?: readonly string[];
}

/**
 * ⭐⭐ D73; rulings 5, 10, 22 — THE HISTORIAN'S ASSESSMENT, AS ONE BATCH (see the header): the §30 drive, a result per criterion, its findings, and the
 * completion under its own validator id, the verdict computed from the rows and the findings, its recommended action, and the producer.
 */
function assessmentSteps(a: {
	readonly assessmentId: string;
	readonly policy: StoredPolicy;
	readonly pwuId: string;
	readonly unitVersion: number;
	readonly evaluator: ActorReference;
	readonly producer: ActorReference | undefined;
	readonly rows: readonly FloorCriterion[];
	readonly findings: readonly AssessmentFinding[];
	readonly disposition: AssessmentDisposition;
	readonly answer: HistorianAnswer;
	readonly mintId: (prefix: string) => string;
}): StageStep[] {
	const steps: StageStep[] = [];
	const versions = { [a.pwuId]: a.unitVersion };
	driveAssessmentToAssessing((commandType, aggregateType, aggregateId, payload) => steps.push([commandType, aggregateType, aggregateId, payload as Record<string, unknown>]), {
		assessmentId: a.assessmentId,
		assurancePolicyId: a.policy.policyId,
		policyVersion: a.policy.version,
		subjectObjectIds: [a.pwuId],
		subjectSemanticVersions: versions,
		claimIds: [],
		evaluator: a.evaluator
	});
	for (const row of a.rows)
		steps.push(['RecordCriterionResult', 'ASSURANCE_ASSESSMENT', a.assessmentId, { criterionId: row.criterionId, result: row.outcome, ...(row.rationale ? { rationale: row.rationale } : {}) }]);
	for (const f of a.findings)
		steps.push([
			'RecordAssuranceObservation',
			'ASSURANCE_OBSERVATION',
			a.mintId('obs'),
			{ assessmentId: a.assessmentId, observationType: 'FINDING', findingCode: f.code, severity: f.severity, statement: f.statement, ...(f.evidenceIds === undefined ? {} : { evidenceIds: [...f.evidenceIds] }) }
		]);
	const recommended = a.answer.recommendedControlAction;
	steps.push([
		'CompleteAssuranceAssessment',
		'ASSURANCE_ASSESSMENT',
		a.assessmentId,
		{
			validatorResult: {
				validatorId: HISTORIAN_VALIDATOR_ID,
				validatorVersion: '1',
				policyId: a.policy.policyId,
				policyVersion: a.policy.version,
				assessmentId: a.assessmentId,
				subjectObjectIds: [a.pwuId],
				subjectSemanticVersions: versions,
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: a.findings.map((f) => ({ findingCode: f.code, severity: f.severity, statement: f.statement, subjectObjectIds: [a.pwuId] })),
				dispositionRecommendation: a.disposition,
				// ⭐ Ruling 19, 22 — the one action it recommends, as given; Gate B refuses one outside the policy's list, naming it.
				recommendedControlActions: recommended === null ? [] : [{ action: recommended.action, reason: recommended.reason }],
				residualUncertainty: [
					...(a.answer.judgement.residualUncertainty ?? []),
					...(a.answer.judgement.recommendation === a.disposition
						? []
						: [`The Historian recommended ${a.answer.judgement.recommendation}; the verdict, ${a.disposition}, is computed from its criterion answers and its findings (REG-F-523; design D73).`])
				],
				limitations: [],
				executionProvenance: { evaluator: a.evaluator }
			},
			// ⭐ D73 — the rejected unit's executor, so `DIFFERENT_AGENT` is checked against it (`assurance-rules.ts`).
			...(a.producer === undefined ? {} : { producer: a.producer })
		}
	]);
	return steps;
}

/**
 * ⭐⭐ THE HISTORIAN'S PART (see the header): one ask, recorded as its part; never throws.
 */
export async function historianPart(ctx: HistorianPartContext): Promise<HistorianPartOutcome> {
	try {
		return await historianAsk(ctx);
	} catch (e) {
		const why = `the Historian failed: ${describedThrow(e)}`;
		return ctx.record(STAGE_PART.HISTORIAN, 'failing', JSON.stringify({ failed: why }), [why]);
	}
}

/** ⭐ D84 — what the Historian is shown, or why it is not run: who runs it, its bound, its copy of the workspace, its policy, its records, its prompt. */
export type HistorianInput =
	| { readonly ok: false; readonly why: string }
	| {
			readonly ok: true;
			readonly runner: Extract<ReturnType<typeof historianRunnerOf>, { readonly ok: true }>;
			readonly bound: Extract<ReturnType<typeof historianCallBound>, { readonly ok: true }>;
			readonly copied: Extract<Awaited<ReturnType<typeof historianWorkspaceFiles>>, { readonly ok: true }>;
			readonly policy: StoredPolicy;
			readonly records: Awaited<ReturnType<typeof historianRecordsOf>>;
			readonly prompt: string;
	  };

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (`REG-D-189`; `d84/d84-facts.md` §3.1; the lead's rulings r1) — THE HISTORIAN'S INPUT, ONE DEFINITION: who runs
 * it, its time bound, the workspace read through the port, its stored policy, its records, the two name checks and its prompt, read as its part reads
 * them before its folder is written. Its part (`historianAsk`) and D84's driver both call this. ⛔ It writes and calls nothing: where a check refuses,
 * it says why, and the part records the Historian not run in those words.
 */
export async function historianInputOf(ctx: HistorianPartContext): Promise<HistorianInput> {
	const { deps } = ctx;
	const { engine } = deps;
	const notRun = (why: string): HistorianInput => ({ ok: false, why });
	const runner = historianRunnerOf(deps);
	if (!runner.ok) return notRun(runner.why);
	const bound = historianCallBound(process.env);
	if (!bound.ok) return notRun(bound.why);
	if (!ctx.shared.ok) return notRun(ctx.shared.why);
	const copied = await historianWorkspaceFiles(ctx.shared.workspace);
	if (!copied.ok) return notRun(copied.why);
	const policy = storedPolicyOf(engine);
	if (policy === undefined) return notRun(`the store holds no ${HISTORIAN_POLICY_ID}: the Historian has no rubric to judge the loop by (design D73)`);

	// ── What it is shown (D73, D86; ruling 9).
	const records = await historianRecordsOf(ctx, new Set([ctx.roundId, ...ctx.rejectingVerdictIds]));
	// ⭐ L17b2 addendum (the lead's §27, item 7) — two of its record files of one name: its folder is not written, and it is not run, naming the name.
	const clash = recordNameClash(records.files);
	if (clash !== undefined) return notRun(clash);
	// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A02; the lead's r26 (2)) — and two of the workspace's files that land
	// on one name in its copy, case not told apart: the same, both paths named.
	const copyClash = workspaceCopyClash(copied.files);
	if (copyClash !== undefined) return notRun(copyClash);
	const prompt = historianPrompt({
		rejectedUnit: { id: ctx.pwuId, title: ctx.unitTitle },
		policy,
		failedCriteria: ctx.failedCriteria,
		earlierRounds: records.earlierRounds,
		narrative: ctx.narrative,
		records: records.files.map((f) => ({ file: f.file, what: f.what }))
	});
	return { ok: true, runner, bound, copied, policy, records, prompt };
}

/** One ask: who runs it, its bound, its copy, its folder and its call; its exchange; its assessment; its record. */
async function historianAsk(ctx: HistorianPartContext): Promise<HistorianPartOutcome> {
	const { deps } = ctx;
	const { engine } = deps;
	const notRun = (why: string): Promise<HistorianPartOutcome> => ctx.record(STAGE_PART.HISTORIAN, 'not-run', JSON.stringify({ notRun: why }), [why]);
	// ⭐ D84 — what it is shown, read by the one definition D84's driver shows it by (`historianInputOf`); each check's words as they were here.
	const input = await historianInputOf(ctx);
	if (!input.ok) return notRun(input.why);
	const { runner, bound, copied, policy, records, prompt } = input;
	let folder: Awaited<ReturnType<typeof writeHistorianFolder>>;
	try {
		folder = await writeHistorianFolder({ prompt, records: records.files, workspaceFiles: copied.files });
	} catch (e) {
		// ⭐ L17b2 (the lead's r27, r27a (A)) — a workspace file that lands on a name its copy already holds, found only at its write (an 8.3 short name):
		// the same refusal as the case pair above, so the same status — the Historian not run, in the writer's words. Every other write error stays failing.
		if (e instanceof HistorianCopyRefusal) return notRun(e.message);
		const why = `its folder could not be written: ${describedThrow(e)}`;
		return ctx.record(STAGE_PART.HISTORIAN, 'failing', JSON.stringify({ failed: why }), [why]);
	}

	// ── Its call (D86; rulings 2 (A), 8, 16).
	const requestedAt = deps.now();
	const call = await devinHistorianCall({ folder, model: runner.model, boundMs: bound.ms }, runner.given);
	const respondedAt = deps.now();
	const kept = call.folderNotRemoved === undefined ? [] : [`its folder was not removed: ${call.folderNotRemoved}`];
	if (!call.ran) {
		const why = call.why;
		return ctx.record(STAGE_PART.HISTORIAN, 'not-run', JSON.stringify({ notRun: why }), [why, ...kept]);
	}
	// ⭐ L17b6 (D94; `REG-D-204`) — ~~`readHistorianAnswer(call.stdout, …)`~~: the answer is read from the last message, the text after the last tool call.
	const read = call.failure === undefined ? readHistorianAnswer(call.lastMessage, { criteria: policy.criteria, givenRecordIds: records.givenIds }) : undefined;
	// ⭐ L17b6 — ~~`historianToolCallsOf(call.sessionExport, folder.folder)`~~: each call read from devin's notices; the export is not read.
	// ⭐ L17b6 round 4 (the lead's §45.3) — ~~`historianToolCallsOf(call.session.notices, folder.folder)`~~: and the count of devin's lines that were not
	// JSON objects, as the session's own calls are read (`sessionOf`), so the record's toolCalls and the session's calls agree.
	const tools = historianToolCallsOf(call.session.notices, folder.folder, call.session.unreadLines);
	// ⭐ L17b6 (§39, Q12) — ~~`reportedModelOf(call.sessionExport) ?? runner.model`~~: the label devin's session ran the turn under.
	const modelId = call.session.modelLabel ?? runner.model;
	const runToken = deps.newId('stagerun');

	// ── Its exchange (ruling 11).
	const exchange = await recordHistorianExchange(ctx, {
		prompt,
		call,
		read,
		model: { modelId, providerId: runner.providerId },
		requestedAt,
		respondedAt,
		runToken
	});
	const notes = [...kept, ...(exchange.failure === undefined ? [] : [`its exchange could not be recorded: ${exchange.failure}`])];
	const historian: ActorReference = { actorId: `model:${modelId}`, actorType: 'AGENT', displayName: 'Historian' };
	// ⭐ L17b6 (D94; the lead's §39, Q3) — what the record keeps of the call besides its answer: its working remarks, each request the workbench answered,
	// and the session's facts it read — never devin's raw messages (§39, item 10).
	const callFacts = {
		workingRemarks: call.session.workingRemarks,
		requests: call.session.requests,
		session: sessionFactsOf(call.session)
	};
	const failing = (why: string): Promise<HistorianPartOutcome> =>
		ctx.record(
			STAGE_PART.HISTORIAN,
			'failing',
			// ⭐ L17b6 (§39, Q3) — ~~`answer: call.failure === undefined ? call.stdout : ''`~~: the last message whole, in the answer's place.
			JSON.stringify({
				failed: why,
				lastMessage: call.failure === undefined ? call.lastMessage : '',
				toolCalls: tools.calls,
				...callFacts,
				exchangeId: exchange.exchangeId,
				assessmentId: null
			}),
			[why, ...notes]
		);
	if (call.failure !== undefined) return failing(`the Historian's call failed: ${call.failure}`);
	if (read === undefined || !read.ok) return failing(`its answer was not read: ${read?.ok === false ? read.why : 'no answer'}`);

	// ── Its assessment, in one batch (D73; rulings 5, 10, 17, 22).
	const unitVersion = Number(engine.loadObject(ctx.pwuId)?.semanticVersion ?? 1);
	const evaluatorIdentity = { actorType: 'AGENT', agentId: 'devin', modelId, providerId: runner.providerId };
	const evaluator: ActorReference = {
		actorId: 'devin',
		actorType: 'AGENT',
		displayName: `devin (${modelId})`,
		modelId,
		providerId: runner.providerId,
		executionInstanceId: runToken
	};
	const result = reasoningReviewResultFromJudgement(
		{ subjectId: ctx.pwuId, objectType: 'PROFESSIONAL_WORK_UNIT', semanticVersion: unitVersion, isAiProduced: true, producer: {} },
		evaluatorIdentity,
		HISTORIAN_VALIDATOR_ID,
		read.answer.judgement,
		policy.criteria
	);
	const findings: AssessmentFinding[] = [
		...result.observations.map((o) => ({ code: o.code, severity: o.severity, statement: o.statement })),
		...(read.answer.recurrence === null
			? []
			: [
					{
						code: KNOWN_FAILURE_RECURRENCE,
						severity: policy.recurrenceSeverity,
						statement: read.answer.recurrence.statement.trim() || 'The Historian finds this round’s failure an earlier round’s coming back, and gave no statement of it.',
						evidenceIds: read.answer.recurrence.earlierRecords
					}
				]),
		...read.answer.findings.map((statement) => ({ code: HISTORIAN_RECORD_NOT_GIVEN, severity: 'MATERIAL', statement })),
		...tools.findings.map((f) => ({ code: f.code, severity: f.severity, statement: f.statement }))
	];
	const { rows, disposition } = declaredVerdict(
		{ criteria: policy.criteria, evidenceCeiling: policy.evidenceCeiling },
		{
			policyId: policy.policyId,
			validatorId: HISTORIAN_VALIDATOR_ID,
			evaluator: evaluatorIdentity,
			criteria: result.criteria,
			observations: findings.map((f) => ({ code: f.code, severity: f.severity as never, statement: f.statement, open: true })),
			recommendation: read.answer.judgement.recommendation,
			residualUncertainty: read.answer.judgement.residualUncertainty ?? [],
			limitations: []
		},
		engine.admitStipulatedAnswers === true
	);
	const producer = (engine.loadObject(ctx.roundId)?.state as { producer?: ActorReference } | undefined)?.producer;
	const assessmentId = deps.newId('asm');
	const refused = (deps.runReviewerSteps ?? deps.runSteps)(
		assessmentSteps({ assessmentId, policy, pwuId: ctx.pwuId, unitVersion, evaluator, producer, rows, findings, disposition, answer: read.answer, mintId: deps.newId })
	);
	if (refused !== null) return failing(`its assessment was refused, and nothing of it is recorded: ${refused}`);

	// ── Its record (ruling 5): its answer, its tool calls with their paths, its exchange and its assessment.
	return ctx.record(
		STAGE_PART.HISTORIAN,
		'recorded',
		// ⭐ L17b6 (D94; §39, Q3) — ~~`{ answer: call.stdout, toolCalls: tools.calls, exchangeId: exchange.exchangeId, assessmentId }`~~: its answer, the one
		// object as it stood, and the words around it beside it; its working remarks; each request; the session's facts.
		JSON.stringify({ answer: read.answerText, aroundAnswer: read.aroundAnswer, toolCalls: tools.calls, ...callFacts, exchangeId: exchange.exchangeId, assessmentId }),
		[
			...notes,
			...(producer === undefined
				? ['the round’s opening verdict names no producer, so the Historian’s independence from the rejected unit’s executor was not checked']
				: [])
		],
		historian,
		{ assessmentId }
	);
}
