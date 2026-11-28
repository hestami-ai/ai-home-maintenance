// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73 with D86 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.27, §12.40; `REG-D-166` (2), (3), (6);
// `REG-D-167` (3); the lead's rulings 2, 9, 10, 19 and 22 on L17b2's Stage 0) — THE HISTORIAN'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ ITS PROMPT (`historianPrompt`): built here, over the STORED rubric, outside the reasoning-review validator — so the validator's framings and probes,
// and the reviewer fingerprint that hashes them, are unchanged (D73, D78). It holds the policy's criteria in the policy's own words; this sign-off's
// failed criteria and each earlier round's; the narrative memory so far; the folder's layout, `records/INDEX.md` first (D86); the request to check each
// claim against the copies, citing the file; and the answer's form, the policy's permitted actions named from the policy itself. ⛔ Not the reviewer's
// NO-TOOLS preamble: the Historian has read-only tools (D86).
// ⭑ ITS READER (`readHistorianAnswer`): ~~the declared review's parse first, unchanged — `extractJson`, then `coerceJudgement` —~~ ⭐ (L17b6, design D94;
// `REG-D-204`; the lead's §39, Q1) the one JSON object in the Historian's last message (`theOneJsonObjectIn`), the words around it kept beside it, then
// the declared parse's `coerceJudgement`, unchanged — and then the Historian's two fields (ruling 19): `recurrence` `{ recurs, statement, earlierRecords }`, read only where `recurs` is `true`, its earlier records held to the ids
// the Historian was given — one outside them left out and named (ruling 10); and `recommendedControlAction` `{ action, reason } | null`, passed through
// as given — an action that is not a string as its JSON — so Gate B, not this reader, refuses an action outside the policy's list (ruling 22).
// ⛔ THE VERDICT IS NOT THE READER'S: the stage records each criterion's result and computes the verdict from them, as every declared review's is, never
// from the reviewer's recommendation (`REG-F-523`; `declaredVerdict`).
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
// ⭐ L17b6 (D94; `REG-D-204`) — ~~`import { extractJson } from './agy-cli.js';`~~: the answer is found by `theOneJsonObjectIn`, below.
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

/** ⭐ L17b6 — one top-level span of a text: where it starts and ends, and whether it closed. */
interface TopLevelSpan {
	readonly start: number;
	readonly end: number;
	readonly closed: boolean;
}

/**
 * ⭐ L17b6 — the span a `{` or `[` at `start` opens: JSON's strings honoured inside it, its openers and closers counted by type. ⭐ L17b6 round 3 (the
 * lead's §43.3, rule H) — where a strict JSON value that starts there would end: in JSON's strings and brackets a value starting at `start` closes at
 * its span's end, so `JSON.parse` of the span decides whether one does (`theOneJsonObjectIn`).
 */
function spanFrom(text: string, start: number): TopLevelSpan {
	const stack: string[] = [];
	let inString = false;
	let escaped = false;
	for (let j = start; j < text.length; j++) {
		const c = text[j]!;
		if (inString) {
			if (escaped) escaped = false;
			else if (c === '\\') escaped = true;
			else if (c === '"') inString = false;
		} else if (c === '"') inString = true;
		else if (c === '{' || c === '[') stack.push(c);
		else if (c === '}' || c === ']') {
			// A closer of the wrong type ends the span, unclosed: words.
			if (stack.at(-1) !== (c === '}' ? '{' : '[')) return { start, end: j + 1, closed: false };
			stack.pop();
			if (stack.length === 0) return { start, end: j + 1, closed: true };
		}
	}
	return { start, end: text.length, closed: false };
}

// ⭐ L17b6 round 3 (the lead's §43.3, rule H) — ~~`/** ⭐ L17b6 — a span's text as a JSON object, or undefined where it is not one. */ function
// objectOf(text: string): Record<string, unknown> | undefined {`~~ … ~~`return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as
// Record<string, unknown>) : undefined;`~~ … ~~`}`~~: a list that parses is a value too, whose brackets are no words, so a span is read as any JSON value
// (`jsonOf`), and the object among them told apart after.
/** ⭐ L17b6 round 3 — what a span is where `JSON.parse` refuses it. */
const NOT_JSON = Symbol('not JSON');

/** ⭐ L17b6 round 3 (rule H) — a span's text as the JSON value `JSON.parse` reads, of any kind, or `NOT_JSON` where it refuses the text. */
function jsonOf(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return NOT_JSON;
	}
}

/** ⭐ L17b6 round 3 — the why of a bracket of the words that does not close: rule H's cost (the lead's §43.3; the sponsor's answer, §43.11). */
const STRAY_BRACKET_COST = 'and a bracket in its words that does not close gets the answer refused (REG-D-204)';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (`REG-D-204`, the sponsor's *"Last message's one JSON"*, kept after `REG-F-690`'s correction; the
 * lead's §39, Q1) — THE ONE JSON OBJECT IN A TEXT, AND THE WORDS AROUND IT. ~~The text is scanned once: · outside any span, a `{` or `[` opens one; a
 * `"` is a word there, and a `}` or `]` closes nothing; · inside a span, JSON's strings are honoured (`\` escapes), and openers and closers are counted
 * by type; it ends where its depth is 0; · the answer is the one top-level span that parses as an object; the text before it and after it are the words
 * around it. So nothing nested is ever a candidate: an object inside a list, or inside a brace text that does not parse, is no object.~~ ⭐ RESTATED
 * (L17b6 round 3; the lead's §43.3, finding 1 — rule H, the sponsor's answer, §43.11): round 2's scan went on at the end of a span that did not parse,
 * so a `[` that never closed hid what followed it, and a span opened at a quoted `{` read the answer out of step and picked a fragment of it. Now:
 *   · THE VALUES: the text is scanned from its start; at each `{` or `[` outside a value already found, one strict JSON value is tried from there (what
 *     `JSON.parse` accepts, over the span `spanFrom` finds). Where one parses, it is a value, and the scan goes on after it; where none does, the scan
 *     goes on at the next character, never at the span's end;
 *   · THE WORDS: the text outside the values. Their brackets are counted by type, and quotes are not read there. A `{` or `[` of theirs that never closes,
 *     or a `}` or `]` that closes nothing they opened, means the text is not read;
 *   · ENCLOSED: an object value that stands inside brackets of the words is not read, nor the text: it is inside a text that is not JSON;
 *   · THE ONE OBJECT: the answer is the one value that is an object, and the words before and after it are recorded beside it. None, or more than one,
 *     is not read, as before; each refusal says which.
 * ⚠ ITS KNOWN COST, NAMED: ~~(the lead's §39, Q1): a span that never closes runs to the end of the text, so a lone `{` in the words before the answer
 * swallows it, and the answer is not read~~ ⭐ (§43.3; told to the sponsor, §43.11) a bracket of the words that does not close — a stray `{`, `[`, `}`
 * or `]`, before the answer or after it — gets the answer refused (held by `historian.test.ts`). ⚠ A try that fails may scan to the text's end, so the
 * time grows with the words' unclosed brackets times the text's length: a last message is a model's reply (probe 3's, 5,087 characters). ⛔ Not
 * `oneJsonObject` (`assurance-stage-records.ts`), the helpers' rule — the whole answer, a whole-answer fence allowed — which stays unchanged.
 */
export function theOneJsonObjectIn(
	text: string
): { readonly ok: true; readonly before: string; readonly answer: string; readonly after: string; readonly value: Record<string, unknown> } | { readonly ok: false; readonly why: string } {
	// ⭐ L17b6 round 3 (rule H) — ~~`const objects: { readonly span: TopLevelSpan; readonly value: Record<string, unknown> }[] = [];`~~ ~~`let i = 0;`~~
	// ~~`while (i < text.length) {`~~ ~~`if (text[i] !== '{' && text[i] !== '[') {`~~ ~~`i += 1;`~~ ~~`continue;`~~ ~~`}`~~ ~~`const span = spanFrom(text,
	// i);`~~ ~~`const value = span.closed ? objectOf(text.slice(span.start, span.end)) : undefined;`~~ ~~`if (value !== undefined) objects.push({ span,
	// value });`~~ ~~`i = span.end;`~~ ~~`}`~~: one scan of the values and the words, as above.
	const opened: string[] = [];
	const objects: { readonly start: number; readonly end: number; readonly value: Record<string, unknown>; readonly enclosed: boolean }[] = [];
	for (let i = 0; i < text.length; ) {
		const c = text[i]!;
		if (c === '{' || c === '[') {
			const span = spanFrom(text, i);
			const value = span.closed ? jsonOf(text.slice(i, span.end)) : NOT_JSON;
			if (value !== NOT_JSON) {
				if (typeof value === 'object' && value !== null && !Array.isArray(value))
					objects.push({ start: i, end: span.end, value: value as Record<string, unknown>, enclosed: opened.length > 0 });
				i = span.end;
				continue;
			}
			// No value starts here: the bracket is the words', and the scan goes on at the next character.
			opened.push(c);
		} else if (c === '}' || c === ']') {
			if (opened.pop() !== (c === '}' ? '{' : '[')) return { ok: false, why: `the answer’s words hold a ${c} that closes nothing they opened, ${STRAY_BRACKET_COST}` };
		}
		i += 1;
	}
	if (opened.length > 0) return { ok: false, why: `the answer’s words hold a ${opened.at(-1)!} that never closes, ${STRAY_BRACKET_COST}` };
	if (objects.some((o) => o.enclosed)) return { ok: false, why: 'the answer’s JSON object stands inside brackets of its words, a text that is not JSON, so it is not read (REG-D-204)' };
	if (objects.length !== 1)
		return {
			ok: false,
			why:
				objects.length === 0
					? 'the answer holds no JSON object, and the Historian answers with one (REG-D-204)'
					: `the answer holds ${objects.length} JSON objects, and the Historian answers with one alone (REG-D-204)`
		};
	// ⭐ L17b6 round 3 — ~~`const { span, value } = objects[0]!;`~~ ~~`return { ok: true, before: text.slice(0, span.start), answer: text.slice(span.start,
	// span.end), after: text.slice(span.end), value };`~~: the object's own bounds.
	const { start, end, value } = objects[0]!;
	return { ok: true, before: text.slice(0, start), answer: text.slice(start, end), after: text.slice(end), value };
}

/**
 * ⭐⭐ D73 + ruling 19 — READ THE HISTORIAN'S ANSWER (see the header): `{ ok: false, why }` where ~~the text does not parse as JSON~~ ⭐ (L17b6, D94;
 * `REG-D-204`) the text, its last message, holds no JSON object or more than one (`theOneJsonObjectIn`) ⭐ — or (L17b6 round 3, rule H) words whose
 * brackets do not close, or its object inside brackets of its words; otherwise the declared judgement as
 * `coerceJudgement` reads it, byte for byte the declared reader's, and the two fields — ⭐ with the object's text as it stood (`answerText`) and the
 * words around it (`aroundAnswer`), recorded beside it.
 */
export function readHistorianAnswer(
	text: string,
	given: { readonly criteria: readonly AssessmentCriterion[]; readonly givenRecordIds: ReadonlySet<string> }
):
	| { readonly ok: true; readonly answer: HistorianAnswer; readonly answerText: string; readonly aroundAnswer: { readonly before: string; readonly after: string } }
	| { readonly ok: false; readonly why: string } {
	// ⭐ L17b6 (D94; `REG-D-204`) — ~~`value = JSON.parse(extractJson(text));`~~ and its catch, ~~`the answer does not parse as JSON: …`~~: `extractJson`
	// took the span from the first `{` to the last `}` of the whole reply, and got 4 of 9 forms wrong (`REG-F-690`, as corrected).
	const one = theOneJsonObjectIn(text);
	if (!one.ok) return { ok: false, why: one.why };
	const value = one.value;
	const judgement = coerceJudgement(value, { criteria: given.criteria });
	const o = value;
	const findings: string[] = [];
	const recurrence = recurrenceOf(o.recurrence, given.givenRecordIds, findings);
	return {
		ok: true,
		answer: { judgement, recurrence, recommendedControlAction: recommendationOf(o.recommendedControlAction), findings },
		answerText: one.answer,
		aroundAnswer: { before: one.before, after: one.after }
	};
}
