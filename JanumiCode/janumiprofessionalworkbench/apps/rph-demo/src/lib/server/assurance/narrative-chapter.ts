// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D76 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.30; `REG-D-166` (4); `REG-D-016`) — A CHAPTER OF
// THE LOOP'S NARRATIVE MEMORY: what it is given, how it is asked for, and the deterministic check it must pass.
//
// ⭑ WHAT IT IS GIVEN (D76): the records since the last chapter, EACH WITH ITS ID — the units and their states; the verdicts and their failed criteria
// with rationales; the observations; the Decisions (the ways back, their replacements); the stage's records (diagnoses, step-backs, tactic records) —
// and the previous chapter. The first chapter covers the Undertaking from its creation.
// ⭑ ITS FORM (the Constitution Discussion's narrative contract): one JSON object — the chapter's number, the records it covers, its statements (each
// its text and the ids it rests on), its open items and its known omissions, and the chapter before it.
// ⛔ ITS CHECK IS DETERMINISTIC AND THERE IS NO REPAIR CALL: it parses; each statement cites at least one id; every cited id is among the records it
// was given. A chapter that fails is recorded as failing, the failed limbs named, and the round goes on (`assurance-stage.ts`).
import type { EngineHandle } from '@janumipwb/rph-engine';
import { listByType } from '@janumipwb/rph-engine';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { oneJsonObject, stageJsonOf } from './assurance-stage-records.js';

/** One record a chapter is given: its id, and a line saying what it is. */
export interface ChapterRecord {
	readonly id: string;
	readonly text: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** ⭐ The independent review's defect 6 — how much of one stage record's content, and of the host's findings on it, a chapter's writer is given. */
export const STAGE_RECORD_BOUND = 2000;

/** `text`, cut at `STAGE_RECORD_BOUND` characters and said to be cut. */
function bounded(text: string): string {
	return text.length > STAGE_RECORD_BOUND ? `${text.slice(0, STAGE_RECORD_BOUND)}… (cut at ${STAGE_RECORD_BOUND} characters)` : text;
}

/**
 * ⭐ D76 — THE RECORDS SINCE THE LAST CHAPTER, EACH WITH ITS ID: every object of the Undertaking an event after `afterEvent` (an index into the event
 * log; -1 for the Undertaking's whole history) touched — its units, the assessments and observations over them, the Decisions naming them, and the
 * stage's records and tactic records of its rounds — each once, in the order it was last touched, as its state stands now. ⭐ The independent review's
 * defect 6 — a stage record or a tactic record is given WITH ITS CONTENT, read from the content plane and re-hashed (`stageJsonOf`), and the host's
 * findings on it, each bounded (`STAGE_RECORD_BOUND`): an earlier round's diagnosis, step-back and tactic, which the chapter before was written
 * before, reach the next chapter as what they say — never as their labels alone.
 */
export async function chapterRecordsOf(
	engine: EngineHandle,
	store: ArtifactStore,
	undertakingId: string,
	afterEvent: number
): Promise<ChapterRecord[]> {
	const units = new Map(
		listByType(engine, 'PROFESSIONAL_WORK_UNIT')
			.filter((u) => u.state.undertakingId === undertakingId)
			.map((u) => [u.id, u.state] as const)
	);
	const ofUndertaking = (ids: readonly string[]): boolean => ids.some((id) => units.has(id));
	const titleOf = (id: string): string => str(units.get(id)?.title) || id;
	const touched: string[] = [];
	engine.readAllEvents().forEach((e, i) => {
		if (i <= afterEvent) return;
		const at = touched.indexOf(e.aggregateId);
		if (at >= 0) touched.splice(at, 1);
		touched.push(e.aggregateId);
	});
	const failedCriteria = criterionResults(engine);
	const records: ChapterRecord[] = [];
	for (const id of touched) {
		const unit = units.get(id);
		if (unit !== undefined) {
			const successor = str(unit.supersedingWorkUnitId);
			records.push({
				id,
				text:
					`work unit "${str(unit.title)}": lifecycle ${str(unit.workLifecycleState)}, execution ${str(unit.executionState)}, ` +
					`assurance ${str(unit.assuranceState)}${successor ? `, superseded by ${successor}` : ''}`
			});
			continue;
		}
		const row = engine.loadObject(id);
		const state = (row?.state ?? {}) as Record<string, unknown>;
		const type = str(state.objectType);
		if (type === 'ASSURANCE_ASSESSMENT' && ofUndertaking(strings(state.subjectObjectIds))) {
			const failed = (failedCriteria.get(id) ?? []).map((c) => `${c.criterionId} ${c.result}${c.rationale ? ` — ${c.rationale}` : ''}`);
			records.push({
				id,
				text:
					`assessment under ${str(state.assurancePolicyId)} of ${strings(state.subjectObjectIds).map((s) => `"${titleOf(s)}" (${s})`).join(', ')}: ` +
					`${str(state.assessmentState)}${failed.length > 0 ? `; criteria not met: ${failed.join('; ')}` : ''}`
			});
		} else if (type === 'ASSURANCE_OBSERVATION' && ofUndertaking(strings(state.subjectObjectIds))) {
			records.push({
				id,
				text: `observation ${str(state.findingCode)} (${str(state.severity)}, ${str(state.disposition)}) on assessment ${str(state.assessmentId)}: ${str(state.statement)}`
			});
		} else if (type === 'DECISION' && ofUndertaking(strings(state.subjectObjectIds))) {
			records.push({
				id,
				text:
					`decision ${str(state.decisionType)} (${str(state.selectedOption)}), ${str(state.status)}, naming ${strings(state.subjectObjectIds).join(', ')}: ` +
					str(state.rationale)
			});
		} else if (type === 'EVIDENCE') {
			const ref = (state.contentReference ?? {}) as Record<string, unknown>;
			const stage = (ref as { stage?: Record<string, unknown> }).stage;
			if (stage !== undefined && stage.undertakingId === undertakingId && stage.part !== 'narrative-chapter') {
				const json = await stageJsonOf(store, { storageKey: str(ref.storageKey), contentHash: str(ref.contentHash) });
				const findings = strings(state.limitations);
				records.push({
					id: str(ref.artifactId) || id,
					text:
						`the assurance stage's ${str(stage.part)} of round ${str(stage.round)} for ${str(stage.unitId)}: ${str(stage.status)}` +
						(json === undefined ? '; its content could not be read back whole' : `; it reads: ${bounded(JSON.stringify(json))}`) +
						(findings.length > 0 ? `; the host's findings on it: ${bounded(findings.join('; '))}` : '')
				});
			}
		}
	}
	return records;
}

/** Each assessment's criterion results not MET or NOT_APPLICABLE, from its `AssuranceCriterionEvaluated` events, the last of each criterion's. */
function criterionResults(engine: EngineHandle): Map<string, { criterionId: string; result: string; rationale: string }[]> {
	const last = new Map<string, Map<string, { result: string; rationale: string }>>();
	for (const e of engine.readAllEvents()) {
		if (e.eventType !== 'AssuranceCriterionEvaluated') continue;
		const p = (e.payload ?? {}) as { criterionId?: unknown; result?: unknown; rationale?: unknown };
		if (typeof p.criterionId !== 'string') continue;
		const of = last.get(e.aggregateId) ?? new Map();
		of.set(p.criterionId, { result: str(p.result), rationale: str(p.rationale) });
		last.set(e.aggregateId, of);
	}
	const out = new Map<string, { criterionId: string; result: string; rationale: string }[]>();
	for (const [assessmentId, results] of last)
		out.set(
			assessmentId,
			[...results]
				.filter(([, r]) => r.result !== 'MET' && r.result !== 'NOT_APPLICABLE')
				.map(([criterionId, r]) => ({ criterionId, ...r }))
		);
	return out;
}

/** One statement of a chapter, as it is read back for a successor's turn (D77) and the next chapter. */
export interface ChapterStatement {
	readonly text: string;
	readonly cites: readonly string[];
}

/** ⭐ D76 — the chapter's JSON form, as the writer is asked for it. */
export const CHAPTER_FORM =
	'{ "chapter": <its number>, "covers": [<the id of every record it covers>], "statements": [{ "text": "<one statement>", ' +
	'"cites": [<the ids of the records it rests on>] }], "openItems": ["<what is still open>"], "knownOmissions": ["<what it leaves out, and why>"], ' +
	'"previousChapter": <the previous chapter’s id, or null> }';

/** ⭐ D76 — THE WRITER'S PROMPT: the discipline, the previous chapter, the records each with its id, and the form. */
export function narrativeChapterPrompt(c: {
	readonly number: number;
	readonly undertaking: { readonly objective: string; readonly intendedOutputProduct: string };
	readonly previous: { readonly id: string; readonly statements: readonly ChapterStatement[]; readonly failing: boolean } | undefined;
	readonly records: readonly ChapterRecord[];
}): string {
	const previous =
		c.previous === undefined
			? ['There is no previous chapter: this one covers the Undertaking from its creation.']
			: c.previous.failing
				? [`The previous chapter (${c.previous.id}) failed its check, so it is not given here: write from the records.`]
				: [`The previous chapter (${c.previous.id}):`, ...c.previous.statements.map((s) => `- ${s.text} [${s.cites.join(', ')}]`)];
	return [
		`You are writing chapter ${c.number} of the narrative memory of a professional work Undertaking: an interpretive account of how its work reached`,
		'its present state, written from the record and never in place of it. You are not the worker and not the judge of the work.',
		'',
		`The Undertaking's objective: ${c.undertaking.objective}`,
		`Its intended output: ${c.undertaking.intendedOutputProduct}`,
		'',
		'Write it with this discipline: keep qualifiers; keep competing viewpoints apart; never imply a position was stable if it changed; cite every',
		'statement by the ids of the records it rests on; state your uncertainty, and what you leave out. Never invent a rationale the records do not hold.',
		'',
		...previous,
		'',
		'The records since the previous chapter, each with its id:',
		...(c.records.length > 0 ? c.records.map((r) => `- [${r.id}] ${r.text}`) : ['- (none)']),
		'',
		'Reply with ONE JSON object and nothing else, in this form:',
		CHAPTER_FORM,
		'Every statement must cite at least one id, and only ids from the records above.'
	].join('\n');
}

/** ⭐ D76 — a chapter as its writer answered it, in its JSON form (`CHAPTER_FORM`). */
export interface ReadChapter {
	readonly chapter: number | null;
	readonly covers: readonly string[];
	readonly statements: readonly ChapterStatement[];
	readonly openItems: readonly string[];
	readonly knownOmissions: readonly string[];
	readonly previousChapter: string | null;
}

/**
 * ⭐ D76 — THE ANSWER'S READER: one JSON object holding a list of statements, read into its form; or why it is not one. ⭑ It reads, and judges
 * nothing of what the statements cite: that is the check's (`checkNarrativeChapter`).
 */
export function readNarrativeChapter(answer: string): { readonly ok: true; readonly chapter: ReadChapter } | { readonly ok: false; readonly why: string } {
	const parsed = oneJsonObject(answer);
	if (!parsed.ok) return { ok: false, why: parsed.why };
	const v = parsed.value;
	if (!Array.isArray(v.statements)) return { ok: false, why: 'it holds no list of statements' };
	return {
		ok: true,
		chapter: {
			chapter: typeof v.chapter === 'number' ? v.chapter : null,
			covers: strings(v.covers),
			statements: v.statements.map((s) => {
				const o = (typeof s === 'object' && s !== null ? s : {}) as { text?: unknown; cites?: unknown };
				return { text: str(o.text), cites: strings(o.cites) };
			}),
			openItems: strings(v.openItems),
			knownOmissions: strings(v.knownOmissions),
			previousChapter: typeof v.previousChapter === 'string' ? v.previousChapter : null
		}
	};
}

/** A chapter as checked: its statements; the failed limbs of its check, if any. */
export interface CheckedChapter {
	readonly statements: readonly ChapterStatement[];
	readonly failures: readonly string[];
}

/**
 * ⭐⭐ D76 — THE CHECK: it parses as one JSON object with a list of statements (`readNarrativeChapter`); each statement cites at least one id; every
 * cited id is among the records it was given. ⛔ Deterministic, and every failed limb named — never a repair.
 */
export function checkNarrativeChapter(answer: string, givenIds: ReadonlySet<string>): CheckedChapter {
	const read = readNarrativeChapter(answer);
	if (!read.ok) return { statements: [], failures: [read.why] };
	const statements = read.chapter.statements;
	const failures: string[] = [];
	statements.forEach((s, i) => {
		if (s.cites.length === 0) failures.push(`statement ${i + 1} cites no record`);
		for (const id of s.cites) if (!givenIds.has(id)) failures.push(`statement ${i + 1} cites ${id}, which is not among the records it was given`);
	});
	return { statements, failures };
}

/**
 * ⭐ D76 (the lead's ruling on reading 13) — THE STAND-IN WRITER, reachable only where the selected reviewer is itself the stand-in (test mode, no
 * reviewer tool named), as `deterministicExecutionPrint` is for the executor: one statement per record given, citing it. ⛔ Never a named tool's.
 */
export function standInChapter(number: number, records: readonly ChapterRecord[], previousId: string | null): string {
	return JSON.stringify({
		chapter: number,
		covers: records.map((r) => r.id),
		statements: records.map((r) => ({ text: r.text, cites: [r.id] })),
		openItems: [],
		knownOmissions: ['This chapter was written by the stand-in writer, which restates each record and interprets nothing.'],
		previousChapter: previousId
	});
}
