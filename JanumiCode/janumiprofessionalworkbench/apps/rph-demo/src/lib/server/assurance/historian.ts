// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73 with D86 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.27, §12.40; `REG-D-166` (2), (3), (6);
// `REG-D-167` (3); the lead's rulings 2, 9, 10, 19 and 22 on L17b2's Stage 0) — THE HISTORIAN'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ ITS PROMPT (`historianPrompt`): built here, over the STORED rubric, outside the reasoning-review validator — so the validator's framings and probes,
// and the reviewer fingerprint that hashes them, are unchanged (D73, D78). It holds the policy's criteria in the policy's own words; this sign-off's
// failed criteria and each earlier round's; the narrative memory so far; the folder's layout, `records/INDEX.md` first (D86); the request to check each
// claim against the copies, citing the file; and the answer's form, the policy's permitted actions named from the policy itself. ⛔ Not the reviewer's
// NO-TOOLS preamble: the Historian has read-only tools (D86).
// ⭑ ITS READER (`readHistorianAnswer`): the declared review's parse first, unchanged — `extractJson`, then `coerceJudgement` — and then the Historian's
// two fields (ruling 19): `recurrence` `{ recurs, statement, earlierRecords }`, read only where `recurs` is `true`, its earlier records held to the ids
// the Historian was given — one outside them left out and named (ruling 10); and `recommendedControlAction` `{ action, reason } | null`, passed through
// as given — an action that is not a string as its JSON — so Gate B, not this reader, refuses an action outside the policy's list (ruling 22).
// ⛔ THE VERDICT IS NOT THE READER'S: the stage records each criterion's result and computes the verdict from them, as every declared review's is, never
// from the reviewer's recommendation (`REG-F-523`; `declaredVerdict`).
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { extractJson } from './agy-cli.js';
import { coerceJudgement, type CoercedJudgement } from './reasoning-review-validator.js';

/** ⭐ Ruling 18 — the validator id the Historian's assessments complete under: the kernel's one definition, whose index leaves them out. */
export { HISTORIAN_VALIDATOR_ID } from '@janumipwb/rph-application';

/** ⭐ D73, ruling 19 — the answer's form, as the Historian is asked for it: the declared review's answer, then the two fields of its own. */
export const HISTORIAN_ANSWER_FORM =
	'{ "findings": [{ "criterionId": "<a criterion id above>", "failed": <true where the record shows it not met, else false>, "statement": "<what the ' +
	'record shows, citing the file>" }], "recommendation": "<SATISFIED, CONDITIONALLY_SATISFIED, INCONCLUSIVE or REJECTED>", "residualUncertainty": ' +
	'["<what you could not settle>"], "recurrence": { "recurs": <true or false>, "statement": "<how this round’s failure is an earlier round’s coming ' +
	'back, or why it is not>", "earlierRecords": ["<the id of each earlier record it rests on, as records/INDEX.md names it>"] }, ' +
	'"recommendedControlAction": <null for none, or { "action": "<one of the permitted actions named above>", "reason": "<why>" }> }';

/** What the Historian's prompt is built from (D73: what it is shown; D86: its folder). */
export interface HistorianPromptInput {
	readonly rejectedUnit: { readonly id: string; readonly title: string };
	/** The STORED policy: its id, name, purpose, criteria and permitted control actions. */
	readonly policy: {
		readonly policyId: string;
		readonly name: string;
		readonly purpose: string;
		readonly criteria: readonly AssessmentCriterion[];
		readonly permittedControlActions: readonly string[];
	};
	/** This sign-off's rejecting verdicts' failed criteria, in D71's form. */
	readonly failedCriteria: readonly { readonly code: string; readonly statement: string }[];
	/** Each earlier round, by its opening verdict, with its failed criteria. */
	readonly earlierRounds: readonly {
		readonly roundId: string;
		readonly failedCriteria: readonly { readonly code: string; readonly statement: string }[];
	}[];
	/** The narrative memory so far, chapter by chapter (D76). */
	readonly narrative: readonly {
		readonly id: string;
		readonly failing: boolean;
		readonly statements: readonly { readonly text: string; readonly cites: readonly string[] }[];
	}[];
	/** The files under `records/`, each with what it is: the lines of its index (D86; ruling 9). */
	readonly records: readonly { readonly file: string; readonly what: string }[];
}

/**
 * ⭐ D87 — what each control action the design gives a meaning to does, said only where the policy permits it: `RESHAPE_PWU`'s reason reaches the next
 * worker and the way back is offered; `REQUEST_HUMAN_DECISION` offers none.
 */
const ACTION_MEANING: Readonly<Record<string, string>> = {
	RESHAPE_PWU:
		'where how this unit’s work is done should change: your reason reaches the next worker as feedback, and the unit’s definition, outputs and ' +
		'criteria do not change',
	REQUEST_HUMAN_DECISION: 'where the loop is not getting any better and a person must decide: no way back is then offered, and the sponsor decides'
};

/** The failed criteria as lines, or a line saying none is recorded. */
const criteriaLines = (failed: readonly { readonly code: string; readonly statement: string }[]): string[] =>
	failed.length > 0 ? failed.map((f) => `- ${f.code}: ${f.statement}`) : ['- (none recorded)'];

/** ⭐⭐ D73 + D86 — THE HISTORIAN'S PROMPT (see the header). */
export function historianPrompt(h: HistorianPromptInput): string {
	const narrative = h.narrative.flatMap((c) =>
		c.failing
			? [`Chapter ${c.id} failed its check, so its statements are left out: judge from the records.`]
			: [`Chapter ${c.id}:`, ...c.statements.map((s) => `- ${s.text} [${s.cites.join(', ')}]`)]
	);
	const permitted = h.policy.permittedControlActions;
	return [
		`You are the Historian of the assurance stage of a professional work Undertaking. The declared reviews of "${h.rejectedUnit.title}" (${h.rejectedUnit.id})`,
		`rejected its work at its sign-off. You judge the loop, not the work, under the policy "${h.policy.name}" (${h.policy.policyId}).`,
		`Its purpose: ${h.policy.purpose}`,
		'The question you answer is whether this situation is getting any better over the rounds, not how many rounds there have been. Historical',
		'difference is not failure.',
		'',
		'The policy’s criteria, in its own words — judge each:',
		...h.policy.criteria.map((c) => `- ${c.id}: ${c.description}`),
		'',
		'The criteria this sign-off’s rejecting reviews found not met, each with its review’s rationale:',
		...criteriaLines(h.failedCriteria),
		'',
		'Each earlier round’s, by its opening verdict:',
		...(h.earlierRounds.length > 0 ? h.earlierRounds.flatMap((r) => [`Round ${r.roundId}:`, ...criteriaLines(r.failedCriteria)]) : ['- (no earlier round)']),
		'',
		'The narrative memory of the Undertaking so far, chapter by chapter, each statement with the records it rests on:',
		...(narrative.length > 0 ? narrative : ['- (none written)']),
		'',
		'Your folder holds copies — of the round’s records and of the Undertaking’s shared workspace — and nothing you do in it changes the work:',
		'- records/INDEX.md — the index of your records: read it first. It names each file under records/ and what it is, and each file of the',
		'  workspace that is not copied.',
		...h.records.map((r) => `- records/${r.file} — ${r.what}`),
		'- workspace/ — a copy of the Undertaking’s shared workspace at this sign-off: its files as the workspace lists them, each at its path. A file',
		'  whose bytes the copy could not reproduce is not copied, and records/INDEX.md names it.',
		'Your tools read and search, and only inside this folder.',
		'Check each claim you make against these copies, and cite the file it rests on.',
		'',
		'Beside the criteria, two answers of your own:',
		'- recurrence: whether this round’s failure is an earlier round’s coming back — the same problem, whether or not the work knew of it — naming',
		'  the earlier records it rests on by their ids.',
		`- recommendedControlAction: one of the control actions this policy permits, with your reason — or null, for none. It permits ${permitted.length > 0 ? permitted.join(', ') : 'none'}:`,
		...permitted.map((a) => `  - ${a}${ACTION_MEANING[a] === undefined ? '' : `: ${ACTION_MEANING[a]}`}`),
		'',
		'Reply with ONE JSON object and nothing else, in this form:',
		HISTORIAN_ANSWER_FORM
	].join('\n');
}

/** ⭐ Ruling 19 — a recurrence the Historian recorded: this round's failure an earlier one's coming back, and the earlier records it names. */
export interface HistorianRecurrence {
	readonly recurs: true;
	readonly statement: string;
	/** Only ids the Historian was given (ruling 10). */
	readonly earlierRecords: readonly string[];
}

/** ⭐ Ruling 19 — the control action it recommends, passed through as given (ruling 22: Gate B refuses one outside the policy's list). */
export interface HistorianRecommendation {
	readonly action: string;
	readonly reason: string;
}

/** ⭐ The Historian's answer as read: the declared review's judgement, and its two fields; and the reader's findings on it (ruling 10). */
export interface HistorianAnswer {
	readonly judgement: CoercedJudgement;
	readonly recurrence: HistorianRecurrence | null;
	readonly recommendedControlAction: HistorianRecommendation | null;
	/** Each statement of a finding the reader makes on the answer: a cited record the Historian was not given (ruling 10). */
	readonly findings: readonly string[];
}

/** A value as the reader carries it where a string is asked for and something else is given: its JSON, or its string where it has none. */
function asText(v: unknown): string {
	if (typeof v === 'string') return v;
	try {
		return JSON.stringify(v) ?? String(v);
	} catch {
		return String(v);
	}
}

/** ⭐ Ruling 10 — the statement of a cited record the Historian was not given, which is left out of the recurrence's records. */
export const notGivenStatement = (id: string): string =>
	`the recurrence cites ${id}, which is not among the records the Historian was given, so it is left out (design D73)`;

/** ⭐ Ruling 19 — the recurrence, read only where `recurs` is `true`; its earlier records held to those given, each other one named in `findings`. */
function recurrenceOf(v: unknown, given: ReadonlySet<string>, findings: string[]): HistorianRecurrence | null {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
	const r = v as { recurs?: unknown; statement?: unknown; earlierRecords?: unknown };
	if (r.recurs !== true) return null;
	const kept: string[] = [];
	for (const id of Array.isArray(r.earlierRecords) ? r.earlierRecords : []) {
		if (typeof id === 'string' && given.has(id)) {
			if (!kept.includes(id)) kept.push(id);
		} else findings.push(notGivenStatement(asText(id)));
	}
	return { recurs: true, statement: typeof r.statement === 'string' ? r.statement : '', earlierRecords: kept };
}

/**
 * ⭐ Ruling 19, ruling 22 — the recommended action: `null` where the field is null or absent; otherwise `{ action, reason }` as given — an action that is
 * not a string, and a value that is not the field's form at all, carried as its JSON — so Gate B names whatever was recommended, as it names any other.
 */
function recommendationOf(v: unknown): HistorianRecommendation | null {
	if (v === null || v === undefined) return null;
	if (typeof v !== 'object' || Array.isArray(v)) return { action: asText(v), reason: '' };
	const o = v as { action?: unknown; reason?: unknown };
	return { action: asText(o.action), reason: typeof o.reason === 'string' ? o.reason : '' };
}

/**
 * ⭐⭐ D73 + ruling 19 — READ THE HISTORIAN'S ANSWER (see the header): `{ ok: false, why }` where the text does not parse as JSON; otherwise the declared
 * judgement as `coerceJudgement` reads it, byte for byte the declared reader's, and the two fields.
 */
export function readHistorianAnswer(
	text: string,
	given: { readonly criteria: readonly AssessmentCriterion[]; readonly givenRecordIds: ReadonlySet<string> }
): { readonly ok: true; readonly answer: HistorianAnswer } | { readonly ok: false; readonly why: string } {
	let value: unknown;
	try {
		value = JSON.parse(extractJson(text));
	} catch (e) {
		return { ok: false, why: `the answer does not parse as JSON: ${e instanceof Error ? e.message : asText(e)}` };
	}
	const judgement = coerceJudgement(value, { criteria: given.criteria });
	const o = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
	const findings: string[] = [];
	const recurrence = recurrenceOf(o.recurrence, given.givenRecordIds, findings);
	return { ok: true, answer: { judgement, recurrence, recommendedControlAction: recommendationOf(o.recommendedControlAction), findings } };
}
