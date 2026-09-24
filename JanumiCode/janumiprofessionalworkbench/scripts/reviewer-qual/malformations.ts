// ⭐ `JAN-CRITREAD` J2-2 — `REG-F-428`'s CLASSES, DETECTED HARNESS-SIDE OVER THE RAW REPLY (DESIGN §5.1 (1), §5.3).
//
// The product decides each of these SILENTLY: `JSON.parse` keeps the last of two duplicate keys, `Boolean()` turns a
// string `failed` into a fault, `coerceJudgement` drops an id the policy does not declare and turns an unknown
// recommendation into INCONCLUSIVE, the mapper keeps the last of two rows for one criterion and records a missing row
// as unjudged. None of it reaches the repair path, and nothing records that anything was discarded (`REG-F-428`). So
// the harness looks at the RAW reply — the only place a duplicate key still exists — and records the class names
// beside the outcome, keeping "the reviewer judged it wrong" apart from "the product discarded what it said".
//
// ⛔ ONLY THE NAMES ARE KEPT. The raw reply is seen here and nowhere else in the record; the bytes that showed a class
// never enter a tracked line (§5.3 retention).
import { splitAnswerSpan } from '../../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { MALFORMATION_CLASSES, projectJudgement, type MalformationClass } from './record.js';

/** The recommendation values `coerceJudgement` accepts; anything else is read as INCONCLUSIVE. */
const RECOMMENDATIONS: ReadonlySet<unknown> = new Set([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED'
]);
/** The fence `splitAnswerSpan` windows into — the same expression, so "fenced" means what the product unwrapped. */
const FENCE = /```(?:json)?([\s\S]*?)```/i;
const FENCE_DELIMITER = /```(?:json)?/gi;

/** The classes a raw reply shows, in `MALFORMATION_CLASSES` order. Empty means well formed and complete. */
export function detectMalformations(
	raw: string,
	criterionIds: ReadonlySet<string>
): MalformationClass[] {
	const found = new Set<MalformationClass>();
	const span = splitAnswerSpan(raw);
	if (!span.located) return ['NO_ANSWER_SPAN'];
	if (FENCE.test(raw)) found.add('FENCED');
	// Anything outside the span but its fence's own delimiters is prose the prompt asked the reviewer not to write.
	if ((span.prefix + span.suffix).replace(FENCE_DELIMITER, '').trim() !== '')
		found.add('PROSE_WRAPPED');
	let parsed: unknown;
	try {
		parsed = JSON.parse(span.answer);
	} catch {
		found.add('UNPARSEABLE');
		return ordered(found);
	}
	if (hasDuplicateKey(span.answer)) found.add('DUPLICATE_KEY');
	const judgement = parsed as Record<string, unknown>;
	if (Array.isArray(judgement.findings)) findingClasses(judgement.findings, criterionIds, found);
	else found.add('NO_FINDINGS_ARRAY');
	if (!RECOMMENDATIONS.has(judgement.recommendation)) found.add('UNKNOWN_RECOMMENDATION');
	// The retained form drops every key the product does not read; fewer keys in it means one was dropped.
	if (keyCount(projectJudgement(judgement)) < keyCount(judgement)) found.add('UNREAD_KEY');
	return ordered(found);
}

/** Every key in a parsed value, at any depth. */
const keyCount = (v: unknown): number => {
	if (Array.isArray(v)) return v.reduce((n: number, x) => n + keyCount(x), 0);
	if (typeof v !== 'object' || v === null) return 0;
	return Object.values(v).reduce((n: number, x) => n + 1 + keyCount(x), 0);
};

function findingClasses(
	findings: readonly unknown[],
	criterionIds: ReadonlySet<string>,
	found: Set<MalformationClass>
): void {
	const rows = new Map<string, number>();
	for (const f of findings) {
		const finding = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>;
		const id = finding.criterionId;
		if (typeof id !== 'string') found.add('MALFORMED_FINDING');
		else if (criterionIds.has(id)) rows.set(id, (rows.get(id) ?? 0) + 1);
		else found.add('UNDECLARED_CRITERION_ID');
		// Absent included: `Boolean(undefined)` reads a row with no verdict as clean.
		if (typeof finding.failed !== 'boolean') found.add('NON_BOOLEAN_FAILED');
	}
	if ([...rows.values()].some((n) => n > 1)) found.add('DUPLICATE_CRITERION');
	if ([...criterionIds].some((id) => !rows.has(id))) found.add('MISSING_CRITERION');
}

const ordered = (found: ReadonlySet<MalformationClass>): MalformationClass[] =>
	MALFORMATION_CLASSES.filter((k) => found.has(k));

/**
 * Does any object in this VALID JSON text repeat a key? `JSON.parse` cannot say — it keeps the last value — so this
 * walks the text. It assumes the text parsed, and so needs no error handling of its own.
 */
export function hasDuplicateKey(json: string): boolean {
	let i = 0;
	let duplicate = false;
	const ws = () => {
		while (i < json.length && ' \t\n\r'.includes(json[i]!)) i += 1;
	};
	const string = (): string => {
		const start = i;
		i += 1;
		while (json[i] !== '"') i += json[i] === '\\' ? 2 : 1;
		i += 1;
		return JSON.parse(json.slice(start, i)) as string;
	};
	const value = (): void => {
		ws();
		const c = json[i];
		if (c === '{') {
			i += 1;
			const keys = new Set<string>();
			ws();
			while (json[i] !== '}') {
				ws();
				const key = string();
				if (keys.has(key)) duplicate = true;
				keys.add(key);
				ws();
				i += 1; // ':'
				value();
				ws();
				if (json[i] === ',') i += 1;
				ws();
			}
			i += 1;
		} else if (c === '[') {
			i += 1;
			ws();
			while (json[i] !== ']') {
				value();
				ws();
				if (json[i] === ',') i += 1;
				ws();
			}
			i += 1;
		} else if (c === '"') string();
		else while (i < json.length && !',]} \t\n\r'.includes(json[i]!)) i += 1;
	};
	value();
	return duplicate;
}
