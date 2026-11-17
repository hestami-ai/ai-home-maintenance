// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D77 with its amendment and D87 (§12.31, §12.41; `REG-D-166` (4); `REG-D-167` (2); `REG-D-170`) — HOLISTIC
// FEEDBACK: WHAT EACH SUCCESSOR'S FIRST TURN, AND D71's RE-RUN IN PLACE, CARRY AFTER THE INSTRUCTION; AND THE TACTIC RECORD.
//
// ⭑ THE PARTS, IN ORDER (D77; the lead's ruling on reading 17). Every successor: the narrative so far, chapter by chapter, each statement with the
// records it rests on (a chapter that failed its check named, its statements left out). The faulty unit's successor, then: the round's failed
// criteria (D71's form); the diagnosis and, beside it, its guidance — advice that changes nothing of a unit's definition, outputs or criteria (D87);
// the step-back where one is recorded; the two parts package L17b2 fills (the Historian's judgment, a `RESHAPE_PWU` recommendation's reason), rendered
// only when handed in; and the request to write its tactic record. Each other successor: the line that it is redone because a unit its work used was
// replaced. D71's re-run in place: the same parts after its findings, the failed criteria not repeated. A part with nothing recorded is left out whole.
// ⭑ THE FAULTY UNIT'S SUCCESSOR (the lead's ruling on reading 16): L17a's act records no target, so it is derived from the record — among the units
// the act's Decision made, the one none of whose recorded dependencies and none of whose children is another of them, the reach's start. Where the
// tree gives none or several, every successor is told as another is, and the turn says the faulty unit could not be told.
// ⭑ THE TACTIC RECORD (D77, as the lead ruled it, option D): the faulty unit's successor (and D71's re-run) is asked to write
// `.jpwb/tactic/<slug>--<unit id>.json`; after the try that writes it, before that try's deliverable view is taken, the host reads it, records it,
// and overwrites it with a notice; every deliverable view leaves the folder out (`deliverable-view.ts`). A record not written by the step's end, or
// not one JSON object, is a finding, recorded, and the step goes on.
import { acceptedWorkFile } from '@janumipwb/rph-application';
import { listPwus, type EngineHandle } from '@janumipwb/rph-engine';
import type { ArtifactStore, Workspace } from '@janumipwb/rph-ports';
import {
	oneJsonObject,
	recordStagePart,
	STAGE_PART,
	stageJsonOf,
	stageRecordsIn,
	type StageRecordDeps
} from '../assurance/assurance-stage-records.js';
import { FEEDBACK_HEADING } from './executor-session.js';
import { rejectingVerdictFindings } from './rejected-rerun.js';
import type { TurnFeedback } from './run-model-step.js';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** A chapter as a turn shows it. */
export interface ChapterForTurn {
	readonly id: string;
	readonly failing: boolean;
	readonly statements: readonly { readonly text: string; readonly cites: readonly string[] }[];
}

/** A diagnosis as a turn shows it (D74, D87). */
export interface DiagnosisForTurn {
	readonly id: string;
	readonly hypotheses: readonly { readonly candidate: string | null; readonly statement: string }[];
	readonly named: string | null;
	readonly confidence: string;
	readonly guidance: string;
}

/** A step-back as a turn shows it (D75). */
export interface StepBackForTurn {
	readonly id: string;
	readonly questions: readonly { readonly reconsider: string; readonly question: string }[];
	readonly facts: readonly { readonly fact: string; readonly source: string }[];
}

/** Whose turn it is. */
export type FeedbackFor =
	| { readonly kind: 'FAULTY_SUCCESSOR'; readonly failedCriteria: readonly { readonly code: string; readonly statement: string }[]; readonly tacticRecordPath: string }
	| { readonly kind: 'OTHER_SUCCESSOR'; readonly replaced: { readonly title: string; readonly unitId: string } | undefined; readonly decisionId: string }
	| { readonly kind: 'RERUN_IN_PLACE'; readonly tacticRecordPath: string };

/** ⭐ D77 — the tactic record's path: `.jpwb/tactic/<slug>--<unit id>.json`, the slug `acceptedWorkFile`'s. */
export function tacticRecordPath(title: string, unitId: string): string {
	return acceptedWorkFile(title, unitId).replace(/^\.jpwb\/accepted\//, '.jpwb/tactic/').replace(/\.txt$/, '.json');
}

/** ⭐ D77 — the request to write the tactic record. */
export function tacticRecordRequest(path: string): string {
	return [
		`Your tactic record: before you finish, write ONE JSON object to ${path} with these fields — "priorTactic" (how the earlier attempt went about`,
		'this work), "whatItProduced", "whyChange" (why you change your approach), "newTactic", "expectedImprovement" — and, where you judge that the',
		'fault lies in another unit’s work, "faultElsewhere": { "unit": "<its id>", "why": "<why>" }. The host reads it when your step ends and records it;',
		'it is not part of your deliverable, and no review of your work is shown it.'
	].join('\n');
}

/**
 * ⭐⭐ D77 — RENDER THE FEEDBACK, its parts in order (see the header), or `undefined` where there is nothing to carry; `crossUnit` true where it
 * carries another unit's findings or the stage's records, which the turn declares as findings at THIS_UNDERTAKING (`REG-D-170`).
 */
export function successorFeedback(input: {
	readonly for: FeedbackFor;
	readonly chapters: readonly ChapterForTurn[];
	readonly diagnosis?: DiagnosisForTurn;
	readonly stepBack?: StepBackForTurn;
	/** Package L17b2's slots: absent, nothing is rendered, byte for byte. */
	readonly historianJudgment?: string;
	readonly reshapeReason?: string;
}): TurnFeedback | undefined {
	const lines: string[] = [];
	let crossUnit = false;
	const narrative = input.chapters.flatMap((c) =>
		c.failing
			? [`Chapter ${c.id} failed its check, so its statements are left out: judge from the records.`]
			: [`Chapter ${c.id}:`, ...c.statements.map((s) => `- ${s.text} [${s.cites.join(', ')}]`)]
	);
	if (narrative.length > 0) {
		lines.push('', 'The loop so far — the narrative memory of this Undertaking, chapter by chapter, each statement with the records it rests on:', ...narrative);
		crossUnit = true;
	}
	if (input.for.kind === 'OTHER_SUCCESSOR') {
		const r = input.for.replaced;
		lines.push(
			'',
			r === undefined
				? `This unit is redone because units its work used were replaced, under the person’s Decision ${input.for.decisionId}; which of them held the fault the record does not say.`
				: `This unit is redone because a unit its work used was replaced: "${r.title}" (${r.unitId}), under the person’s Decision ${input.for.decisionId}.`
		);
		return { text: [FEEDBACK_HEADING, ...lines].join('\n'), crossUnit };
	}
	if (input.for.kind === 'FAULTY_SUCCESSOR' && input.for.failedCriteria.length > 0) {
		lines.push('', 'The criteria the review that rejected the work found not met, each with its rationale:', ...input.for.failedCriteria.map((f) => `- ${f.code}: ${f.statement}`));
		crossUnit = true;
	}
	if (input.diagnosis !== undefined) {
		const d = input.diagnosis;
		lines.push(
			'',
			`The diagnosis (${d.id}) — advice, not a verdict:`,
			...d.hypotheses.map((h) => `- ${h.statement}${h.candidate ? ` (points to ${h.candidate})` : ''}`),
			d.named === null ? 'It could not tell which unit’s work holds the fault.' : `It names ${d.named} as the unit whose work most likely holds the fault.`,
			...(d.confidence ? [`How sure it is: ${d.confidence}`] : []),
			...(d.guidance
				? ['', 'Its guidance on how you might proceed — advice only, which changes nothing of this unit’s definition, its outputs or its criteria:', d.guidance]
				: [])
		);
		crossUnit = true;
	}
	if (input.stepBack !== undefined) {
		const s = input.stepBack;
		lines.push(
			'',
			`The step-back (${s.id}) — questions and facts to help you reconsider, never what to do:`,
			...s.questions.map((q) => `- (${q.reconsider}) ${q.question}`),
			...s.facts.map((f) => `- Fact: ${f.fact} (source: ${f.source})`)
		);
		crossUnit = true;
	}
	if (input.historianJudgment !== undefined) {
		lines.push('', 'The Historian’s judgment of the loop:', input.historianJudgment);
		crossUnit = true;
	}
	if (input.reshapeReason !== undefined) {
		lines.push('', 'Why the Historian recommends reshaping how this unit’s work is done — feedback only; the unit’s definition does not change:', input.reshapeReason);
		crossUnit = true;
	}
	if (lines.length === 0) return undefined;
	lines.push('', tacticRecordRequest(input.for.tacticRecordPath));
	return { text: [FEEDBACK_HEADING, ...lines].join('\n'), crossUnit };
}

/** ⭐ The stage's records of a round as a turn shows them: the Undertaking's chapters so far, and the round's diagnosis and step-back that stand. */
export async function stagePartsForTurn(
	engine: EngineHandle,
	store: ArtifactStore,
	undertakingId: string,
	roundId: string
): Promise<{ readonly ran: boolean; readonly chapters: ChapterForTurn[]; readonly diagnosis?: DiagnosisForTurn; readonly stepBack?: StepBackForTurn }> {
	const all = stageRecordsIn(engine);
	const chapters: ChapterForTurn[] = [];
	for (const r of all.filter((x) => x.part === STAGE_PART.CHAPTER && x.undertakingId === undertakingId)) {
		const json = r.status === 'recorded' ? await stageJsonOf(store, r) : undefined;
		const statements = (Array.isArray(json?.statements) ? json.statements : []).map((s) => {
			const o = (typeof s === 'object' && s !== null ? s : {}) as { text?: unknown; cites?: unknown };
			return { text: str(o.text), cites: strings(o.cites) };
		});
		chapters.push({ id: r.artifactId, failing: json === undefined, statements });
	}
	const ofRound = all.filter((x) => x.roundId === roundId);
	const ran = ofRound.some((x) => x.part === STAGE_PART.CHAPTER);
	let diagnosis: DiagnosisForTurn | undefined;
	const dRec = ofRound.find((x) => x.part === STAGE_PART.DIAGNOSIS && x.status === 'recorded');
	const dJson = dRec ? await stageJsonOf(store, dRec) : undefined;
	if (dRec && dJson)
		diagnosis = {
			id: dRec.artifactId,
			hypotheses: (Array.isArray(dJson.hypotheses) ? dJson.hypotheses : []).map((h) => {
				const o = (typeof h === 'object' && h !== null ? h : {}) as { candidate?: unknown; statement?: unknown };
				return { candidate: typeof o.candidate === 'string' ? o.candidate : null, statement: str(o.statement) };
			}),
			named: typeof dJson.named === 'string' && dJson.named !== '' ? dJson.named : null,
			confidence: str(dJson.confidence),
			guidance: str(dJson.guidance)
		};
	let stepBack: StepBackForTurn | undefined;
	const sRec = ofRound.find((x) => x.part === STAGE_PART.STEP_BACK && x.status === 'recorded');
	const sJson = sRec ? await stageJsonOf(store, sRec) : undefined;
	if (sRec && sJson) {
		const items = (v: unknown): Record<string, unknown>[] =>
			(Array.isArray(v) ? v : []).map((x) => (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}));
		stepBack = {
			id: sRec.artifactId,
			questions: items(sJson.questions).map((q) => ({ reconsider: str(q.reconsider), question: str(q.question) })),
			facts: items(sJson.facts).map((f) => ({ fact: str(f.fact), source: str(f.source) }))
		};
	}
	return { ran, chapters, ...(diagnosis ? { diagnosis } : {}), ...(stepBack ? { stepBack } : {}) };
}

/** ⭐ A successor's place in the replacement that made it, read from the record. */
export interface SuccessorRound {
	readonly predecessor: { readonly id: string; readonly title: string };
	readonly decisionId: string;
	readonly rejectedUnitId: string;
	readonly roundId: string | undefined;
	/** The faulty unit's successor, derived (see the header); undefined where the tree does not tell. */
	readonly faultyId: string | undefined;
	/** The unit the faulty successor replaced. */
	readonly faultyPredecessor: { readonly id: string; readonly title: string } | undefined;
}

/** ⭐⭐ D77 + reading 16 — A SUCCESSOR'S ROUND: its predecessor, the Decision that superseded it, the round, and which successor is the faulty unit's. */
export function successorRoundOf(engine: EngineHandle, pwuId: string): SuccessorRound | undefined {
	const undertakingId = str((engine.loadObject(pwuId)?.state as { undertakingId?: unknown } | undefined)?.undertakingId);
	const units = listPwus(engine, undertakingId);
	const predecessor = units.find((u) => u.state.supersedingWorkUnitId === pwuId);
	if (predecessor === undefined) return undefined;
	const events = engine.readAllEvents();
	const superseded = events.filter((e) => e.eventType === 'PwuSuperseded');
	const decisionId = str(
		((superseded.filter((e) => e.aggregateId === predecessor.id).at(-1)?.payload ?? {}) as { supersessionDecisionId?: unknown }).supersessionDecisionId
	);
	const subjects = strings((engine.loadObject(decisionId)?.state as { subjectObjectIds?: unknown } | undefined)?.subjectObjectIds);
	const verdicts = subjects.filter((id) => (engine.loadObject(id)?.state as { objectType?: unknown } | undefined)?.objectType === 'ASSURANCE_ASSESSMENT');
	const madeBy = superseded
		.filter((e) => str((e.payload as { supersessionDecisionId?: unknown } | undefined)?.supersessionDecisionId) === decisionId)
		.map((e) => ({ old: e.aggregateId, new: str((e.payload as { supersedingWorkUnitId?: unknown }).supersedingWorkUnitId) }));
	const successors = new Set(madeBy.map((m) => m.new));
	const starts = [...successors].filter((s) => {
		const st = (engine.loadObject(s)?.state ?? {}) as { dependencyIds?: unknown };
		const children = units.filter((u) => u.state.parentWorkUnitId === s).map((u) => u.id);
		return !strings(st.dependencyIds).some((d) => d !== s && successors.has(d)) && !children.some((c) => successors.has(c));
	});
	const faultyId = starts.length === 1 ? starts[0] : undefined;
	const faultyOld = faultyId === undefined ? undefined : madeBy.find((m) => m.new === faultyId)?.old;
	const titleOf = (id: string): string => str((engine.loadObject(id)?.state as { title?: unknown } | undefined)?.title) || id;
	return {
		predecessor: { id: predecessor.id, title: str(predecessor.state.title) || predecessor.id },
		decisionId,
		rejectedUnitId: subjects[0] ?? '',
		roundId: verdicts[0],
		faultyId,
		faultyPredecessor: faultyOld === undefined ? undefined : { id: faultyOld, title: titleOf(faultyOld) }
	};
}

/** ⭐⭐ D77 — A SUCCESSOR'S FEEDBACK, read from the record: none for a unit that replaces no other. */
export async function feedbackForSuccessor(
	engine: EngineHandle,
	store: ArtifactStore,
	pwuId: string
): Promise<{ readonly round: SuccessorRound; readonly feedback: TurnFeedback | undefined; readonly tacticRecordPath?: string } | undefined> {
	const round = successorRoundOf(engine, pwuId);
	if (round === undefined) return undefined;
	const unit = (engine.loadObject(pwuId)?.state ?? {}) as { title?: unknown; undertakingId?: unknown };
	const parts =
		round.roundId === undefined
			? { ran: false, chapters: [] as ChapterForTurn[] }
			: await stagePartsForTurn(engine, store, str(unit.undertakingId), round.roundId);
	if (round.faultyId === pwuId) {
		const path = tacticRecordPath(str(unit.title), pwuId);
		const feedback = successorFeedback({
			for: { kind: 'FAULTY_SUCCESSOR', failedCriteria: rejectingVerdictFindings(engine, round.rejectedUnitId).findings, tacticRecordPath: path },
			chapters: parts.chapters,
			...('diagnosis' in parts && parts.diagnosis ? { diagnosis: parts.diagnosis } : {}),
			...('stepBack' in parts && parts.stepBack ? { stepBack: parts.stepBack } : {})
		});
		return { round, feedback, ...(feedback === undefined ? {} : { tacticRecordPath: path }) };
	}
	return {
		round,
		feedback: successorFeedback({
			for: {
				kind: 'OTHER_SUCCESSOR',
				replaced: round.faultyPredecessor && { title: round.faultyPredecessor.title, unitId: round.faultyPredecessor.id },
				decisionId: round.decisionId
			},
			chapters: parts.chapters
		})
	};
}

/** ⭐⭐ D77 — D71's RE-RUN IN PLACE: the same feedback after its findings, where the round's stage ran; none, byte for byte as before, where it did not. */
export async function feedbackForRerun(
	engine: EngineHandle,
	store: ArtifactStore,
	pwuId: string,
	roundId: string
): Promise<{ readonly feedback: TurnFeedback; readonly tacticRecordPath: string } | undefined> {
	const unit = (engine.loadObject(pwuId)?.state ?? {}) as { title?: unknown; undertakingId?: unknown };
	const parts = await stagePartsForTurn(engine, store, str(unit.undertakingId), roundId);
	if (!parts.ran) return undefined;
	const path = tacticRecordPath(str(unit.title), pwuId);
	const feedback = successorFeedback({
		for: { kind: 'RERUN_IN_PLACE', tacticRecordPath: path },
		chapters: parts.chapters,
		...(parts.diagnosis ? { diagnosis: parts.diagnosis } : {}),
		...(parts.stepBack ? { stepBack: parts.stepBack } : {})
	});
	return feedback === undefined ? undefined : { feedback, tacticRecordPath: path };
}

/** ⭐ D77, option D — the notice a tactic record is overwritten with once the host has taken it. */
export function tacticRecordNotice(artifactId: string): string {
	return `{"notice":"The tactic record written here was taken by the workbench after the try that wrote it, before that try's work was reviewed, and recorded as artifact ${artifactId}. It is not part of the deliverable, and no review of the work is shown it (design D77)."}\n`;
}

/** What a take recorded: the part, whether it is on the record, its artifact, a finding's statement, and what went wrong with the take itself. */
export interface TacticTake {
	readonly part: 'tactic-record' | 'tactic-record-finding';
	/** ⭐ The independent review's defect 7 — whether the take is on the record: false where the store refused its batch, which is then no take. */
	readonly recorded: boolean;
	readonly artifactId?: string;
	/** A finding's statement: no record written while the step ran, or one that is not one JSON object. */
	readonly why?: string;
	/** ⭐ The independent review's defect 7 — what went wrong with the take itself: its record refused, or its notice not written. Said on the page. */
	readonly failure?: string;
}

/** A tactic record to take: where, for which unit and round, and the file as the step found it. */
export interface TacticToTake {
	readonly workspace: Pick<Workspace, 'readFile' | 'writeFile'>;
	readonly path: string;
	readonly unitId: string;
	readonly undertakingId: string;
	readonly roundId: string;
	readonly attemptKey: string;
	readonly producerModelId: string;
	/** The file's text when the step began (`undefined`: none): a record is one the step wrote since, never an earlier step's notice. */
	readonly atStart: string | undefined;
	/** The step's end: a record not written while it ran is then a finding. */
	readonly stepEnded: boolean;
}

/**
 * ⭐⭐ D77, AS THE LEAD RULED IT — TAKE THE TACTIC RECORD, after a try's turn and BEFORE ITS DELIVERABLE VIEW IS TAKEN, once per step: written since the
 * step began and one JSON object, recorded as a `tactic-record`; written and not one, a `tactic-record-finding` holding the host's statement and the
 * text — a finding, never a refusal; then the file overwritten with a notice (`tacticRecordNotice`), so neither the floor nor a declared review is shown
 * it (the view leaves `.jpwb/tactic/` out besides). ⭑ Not written yet: nothing, `undefined`, until the step's end, when it is a finding. ⚠ A record the
 * store refuses leaves the file as the model wrote it — its bytes are then held nowhere else — and the view's guard alone keeps it from the reviews.
 */
export async function takeTacticRecord(deps: StageRecordDeps, t: TacticToTake): Promise<TacticTake | undefined> {
	const text = await t.workspace.readFile(t.path);
	const written = text !== undefined && text !== t.atStart;
	if (!written && !t.stepEnded) return undefined;
	const read = written ? oneJsonObject(text) : undefined;
	const ok = read?.ok === true;
	let why = '';
	if (!written) why = `no tactic record was written at ${t.path} while this step ran`;
	else if (read !== undefined && !read.ok) why = `the tactic record at ${t.path} was not read: ${read.why}`;
	const part = ok ? STAGE_PART.TACTIC : STAGE_PART.TACTIC_FINDING;
	const done = await recordStagePart(deps, {
		part,
		roundId: t.roundId,
		undertakingId: t.undertakingId,
		unitId: t.unitId,
		bytes: ok && written ? text : JSON.stringify({ path: t.path, finding: why, ...(written ? { text } : {}) }),
		status: ok ? 'recorded' : 'failing',
		producedBy: ok
			? { actorId: `model:${t.producerModelId}`, actorType: 'AGENT', displayName: 'Execution model' }
			: { actorId: 'agent:workbench-host', actorType: 'AGENT', displayName: 'Workbench host' },
		limitations: ok ? [] : [why],
		attemptKey: t.attemptKey
	});
	// ⭐ The independent review's defect 7 — A RECORD THE STORE REFUSES IS NO TAKE: said, and the file left as the model wrote it, for the step's end to
	// take again; the view's guard keeps it from the reviews meanwhile.
	if ('refusedBecause' in done) return { part, recorded: false, ...(why ? { why } : {}), failure: `its record was refused: ${done.refusedBecause}` };
	if (written) {
		const notice = await t.workspace.writeFile(t.path, tacticRecordNotice(done.artifactId));
		if (!notice.written) {
			// ⭐ The independent review's defect 7 — A NOTICE NOT WRITTEN leaves the record in the workspace: said, and recorded beside the record as a
			// finding naming it, so the record's own entry is not the only trace of a file still in place.
			const unwritten = `the notice could not be written: ${notice.refusedBecause}`;
			const noted = await recordStagePart(deps, {
				part: STAGE_PART.TACTIC_FINDING,
				roundId: t.roundId,
				undertakingId: t.undertakingId,
				unitId: t.unitId,
				bytes: JSON.stringify({ path: t.path, finding: unwritten, recordedAs: done.artifactId }),
				status: 'failing',
				producedBy: { actorId: 'agent:workbench-host', actorType: 'AGENT', displayName: 'Workbench host' },
				limitations: [unwritten],
				attemptKey: t.attemptKey
			});
			// ⭐ The review's re-check (C) — AND A FINDING THE STORE REFUSES joins the take's failure, so the page says that too.
			const failure = 'refusedBecause' in noted ? `${unwritten}; and the finding that says so could not be recorded: ${noted.refusedBecause}` : unwritten;
			return { part, recorded: true, artifactId: done.artifactId, ...(why ? { why } : {}), failure };
		}
	}
	return { part, recorded: true, artifactId: done.artifactId, ...(why ? { why } : {}) };
}
