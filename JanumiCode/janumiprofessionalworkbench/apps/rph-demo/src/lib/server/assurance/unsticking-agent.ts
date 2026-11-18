// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D75 (§12.29; `REG-D-166` (3), (6)) — THE UNSTICKING AGENT'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ RUN WHEN, AND ONLY WHEN, THE ROUND HAS AN OPEN `KNOWN_FAILURE_RECURRENCE` OBSERVATION (`assurance-stage.ts`): the same problem coming back, as the
// Historian judges it (package L17b2 makes the Historian record it). The legacy specification's §8.6: *"The Unsticking Agent never tells the stuck
// agent what to do. It asks questions and provides context that help the stuck agent deduce the path forward itself."* — in two modes, questions
// for the worker and facts it finds in the workspace and the history. One exchange per recurrence, on the Hypothesizer's harness, in a copy.
import { oneJsonObject } from './assurance-stage-records.js';
import type { ChapterStatement } from './narrative-chapter.js';

/** ⭐ D75 — the answer's JSON form. */
export const STEP_BACK_FORM =
	'{ "questions": [{ "reconsider": "<what it asks the worker to reconsider>", "question": "<the question>" }], ' +
	'"facts": [{ "fact": "<a fact found in the workspace or the history>", "source": "<where: a file path or a record id>" }] }';

/** ⭐ D75 — THE UNSTICKING AGENT'S PROMPT: the recurrence in the Historian's words, the narrative so far, the earlier rounds' diagnoses and tactic records. */
export function unstickingPrompt(u: {
	readonly rejectedUnit: { readonly id: string; readonly title: string };
	readonly recurrence: readonly { readonly id: string; readonly statement: string }[];
	readonly narrative: readonly { readonly id: string; readonly failing: boolean; readonly statements: readonly ChapterStatement[] }[];
	readonly earlier: readonly { readonly id: string; readonly kind: string; readonly text: string }[];
	/** ⭐⭐ Package L17b3 — design D89 (`REG-D-173` (5)) — the recorded conversations written into the helper's copy, each named here. */
	readonly recordFiles: readonly { readonly unitId: string; readonly title: string; readonly file: string }[];
}): string {
	const narrative = u.narrative.flatMap((c) =>
		c.failing
			? [`Chapter ${c.id} failed its check and is left out.`]
			: [`Chapter ${c.id}:`, ...c.statements.map((s) => `- ${s.text} [${s.cites.join(', ')}]`)]
	);
	return [
		`You are the Unsticking Agent of the assurance stage of a professional work Undertaking. The work of "${u.rejectedUnit.title}"`,
		`(${u.rejectedUnit.id}) was rejected again, and the Historian judges that the same problem is coming back:`,
		...u.recurrence.map((r) => `- [${r.id}] ${r.statement}`),
		'',
		'You never tell the worker what to do. You ask questions that help it take a step back and reconsider, and you give facts you find — in the',
		'Undertaking’s workspace (a COPY: run_command runs there, and the copy is discarded after your answer; change nothing outside it) and in the',
		'history below — each with its source.',
		'',
		'The narrative memory so far:',
		...(narrative.length > 0 ? narrative : ['- (none written)']),
		'',
		'The earlier rounds’ diagnoses and tactic records:',
		...(u.earlier.length > 0 ? u.earlier.map((e) => `- [${e.id}] ${e.kind}: ${e.text}`) : ['- (none)']),
		'',
		'The recorded conversations of these units’ work, as the Governed Stream recorded them, each a file in your copy of the workspace:',
		...(u.recordFiles.length > 0 ? u.recordFiles.map((r) => `- ${r.unitId} "${r.title}": ${r.file}`) : ['- (none recorded)']),
		'',
		'Reply with ONE JSON object and nothing else, in this form:',
		STEP_BACK_FORM
	].join('\n');
}

/** A step-back as read. */
export interface ReadStepBack {
	readonly questions: readonly { readonly reconsider: string; readonly question: string }[];
	readonly facts: readonly { readonly fact: string; readonly source: string }[];
}

/** ⭐ D75 — READ THE ANSWER: its JSON form; `undefined` with why when it does not parse. */
export function readStepBack(answer: string): { readonly ok: true; readonly stepBack: ReadStepBack } | { readonly ok: false; readonly why: string } {
	const parsed = oneJsonObject(answer);
	if (!parsed.ok) return { ok: false, why: parsed.why };
	const items = (v: unknown): Record<string, unknown>[] =>
		(Array.isArray(v) ? v : []).map((x) => (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}));
	const s = (v: unknown): string => (typeof v === 'string' ? v : '');
	return {
		ok: true,
		stepBack: {
			questions: items(parsed.value.questions).map((q) => ({ reconsider: s(q.reconsider), question: s(q.question) })),
			facts: items(parsed.value.facts).map((f) => ({ fact: s(f.fact), source: s(f.source) }))
		}
	};
}
