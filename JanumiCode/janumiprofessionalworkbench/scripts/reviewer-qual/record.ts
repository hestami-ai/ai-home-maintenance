// ⭐ `JAN-CRITREAD` J2-2 — THE REVIEWER-QUALIFICATION RECORD: what a line may say (DESIGN-what-the-tests-prove.md §5.4).
//
// Append-only NDJSON under `docs/tracking/reviewer-qualification/`, one JSON object per line, seven line kinds and no
// others. It is candidate engineering Evidence (`REG-Q-025`): never an `ASSURANCE_OBSERVATION`, never read by the
// product. J2-3's check reads it for coverage, reproduction and escalation (§5.6); the sequencing pin reads its RUN
// lines for `deployable` (`verif/reviewer-qualification-sequencing.test.ts`).
//
// ⛔ EVERY KEY SET IS CLOSED. A line carrying a field its kind does not declare is refused — which is what keeps a CALL
// from ever holding the raw reply or the reasoning beside its answer span (§5.3 retention), and a HELD_OUT line from
// holding case ids (§5.2). A reader never has to wonder what else a line might carry.
//
// ⚠ PURE, AND IMPORTING NOTHING AT RUNTIME. The CLI loads this before anything else (`run.ts`), and the check that
// J2-3 adds reads records with it; neither may pull the validator, a transport or a package in to do so.

/** Where the record lives, repo-relative. Its TOP-LEVEL `*.ndjson` files are the record. */
export const RECORD_DIR = 'docs/tracking/reviewer-qualification';
/** The line format's version, carried on every RUN line. */
export const RECORD_VERSION = 1;

/** §5.4's line kinds — CLOSED. */
export const RECORD_LINE_KINDS = [
	'RUN',
	'CALL',
	'ESCALATION',
	'RESCORED',
	'ACKNOWLEDGED',
	'SUPERSEDED',
	'HELD_OUT'
] as const;
export type RecordLineKind = (typeof RECORD_LINE_KINDS)[number];

/** The transports a run can name. `stub` is a HARNESS identity: a valid run, refused in a tracked record (§5.3). */
export const TRANSPORT_NAMES = ['agy', 'devin', 'ollama', 'stub'] as const;
export type TransportName = (typeof TRANSPORT_NAMES)[number];
/** The product can deploy only its own backing tools as the reviewer (§3.5: no local-model reviewer backend). */
export const DEPLOYABLE_TRANSPORTS: ReadonlySet<TransportName> = new Set<TransportName>([
	'agy',
	'devin'
]);
export const HARNESS_TRANSPORTS: ReadonlySet<TransportName> = new Set<TransportName>(['stub']);
/**
 * The agent and provider each real transport records — the validator's own identities for its backends
 * (`reasoning-review-validator.ts` defaults; `assurance/index.ts` for devin, whose provider is the broker). Any other
 * label under a real transport is a synthetic provider label, which §5.3 counts as a harness identity.
 */
export const TRANSPORT_IDENTITY: Readonly<
	Record<Exclude<TransportName, 'stub'>, { readonly agentId: string; readonly provider: string }>
> = {
	agy: { agentId: 'agy', provider: 'google' },
	devin: { agentId: 'devin', provider: 'devin' },
	ollama: { agentId: 'ollama', provider: 'ollama' }
};

/** Why a call returned no reply at all (§5.4): the bound cut it, or the transport refused it. */
export const TRANSPORT_FAILURE_CLASSES = ['TIMEOUT', 'REFUSAL'] as const;
export type TransportFailureClass = (typeof TRANSPORT_FAILURE_CLASSES)[number];

/**
 * ⭐ `REG-F-428`'s classes and their siblings — each a way a reply is decided SILENTLY by the product, detected
 * harness-side over the raw reply (`malformations.ts`) so "judged wrong" and "the product discarded what it said" stay
 * distinguishable (§5.1 (1)). Recorded as class names only: the bytes that showed them are not retained.
 */
export const MALFORMATION_CLASSES = [
	'NO_ANSWER_SPAN',
	'UNPARSEABLE',
	'FENCED',
	'PROSE_WRAPPED',
	'DUPLICATE_KEY',
	'NO_FINDINGS_ARRAY',
	'MALFORMED_FINDING',
	'UNDECLARED_CRITERION_ID',
	'DUPLICATE_CRITERION',
	'NON_BOOLEAN_FAILED',
	'MISSING_CRITERION',
	'UNKNOWN_RECOMMENDATION',
	/** A key the product does not read — at the top, in a finding, or inside a value it reads only as a type. The
	 *  product ignores it; the record does not retain it (§5.3), and says so here. */
	'UNREAD_KEY'
] as const;
export type MalformationClass = (typeof MALFORMATION_CLASSES)[number];

export const CALL_ROLES = ['initial', 'repair'] as const;
export type CallRole = (typeof CALL_ROLES)[number];
/** `CriterionOutcome` (`rph-assurance`), restated as data so a line can be checked without loading the package. */
export const CRITERION_OUTCOMES = [
	'MET',
	'PARTIALLY_MET',
	'NOT_MET',
	'NOT_APPLICABLE',
	'UNABLE_TO_DETERMINE'
] as const;
export type CriterionOutcomeName = (typeof CRITERION_OUTCOMES)[number];
/** `FloorPolicyOutcome['disposition']` — the five dispositions and the three boundary pseudo-values. */
export const SCORED_DISPOSITIONS = [
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED',
	'VALIDATOR_FAILED',
	'BOUNDARY_REJECTED',
	'MISSING'
] as const;
export type ScoredDisposition = (typeof SCORED_DISPOSITIONS)[number];
/** `FloorPolicyOutcome['resultClass']`. */
export const RESULT_CLASSES = [
	'VALID',
	'VALIDATOR_FAILED',
	'BOUNDARY_REJECTED',
	'MISSING'
] as const;
export type ResultClass = (typeof RESULT_CLASSES)[number];
/** The E-3 evidence grade of the evaluator identity (`ToolIdentityEvidence`). */
export const IDENTITY_EVIDENCE = ['PROVIDER_REPORTED', 'HOST_CONFIGURED'] as const;
/**
 * §5.1's material failures — the absolute four, then the transitions (evaluated only when a run repeats a candidate).
 * A HELD_OUT line carries a count for each and nothing else.
 */
export const MATERIAL_FAILURE_CLASSES = [
	'PLANTED_DEFECT_NOT_FAULTED',
	'CLEAN_NOT_SATISFIED',
	'VERDICT_CHANGES_WITH_NAME',
	'BOUNDEDNESS',
	'FAULT_LOST',
	'SATISFIED_LOST',
	'MALFORMATION_GAINED',
	'REPETITIONS_NOW_DISAGREE',
	'BOUND_NOW_EXCEEDED',
	'ANSWERED_NOW_UNDETERMINED'
] as const;
export type MaterialFailureClass = (typeof MATERIAL_FAILURE_CLASSES)[number];

// ── the lines ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Who the candidate is, and what it was served (§5.4 RUN). The bounds and argv live here, not in the fingerprint (§5.5). */
export interface CandidateIdentity {
	readonly transport: TransportName;
	readonly agentId: string;
	readonly provider: string;
	/** The model label the run asked for — for agy and devin, the `--model` the program was given. */
	readonly modelLabel: string;
	/** Ollama only: what the server says it served. Null where the transport cannot see it. */
	readonly servedModelDigest: string | null;
	readonly servedTemplateSha256: string | null;
	readonly servedModelfileSha256: string | null;
	/** Whether the served template injects the date (`REG-F-429`: verdicts moved across a day boundary). */
	readonly templateInjectsDate: boolean | null;
	readonly serverVersion: string | null;
	/**
	 * ⭐ `JAN-CRITREAD` J2-3 — Ollama only: the SERVER's UTC offset (`±HH:MM`), read from `/api/ps`'s `expires_at`
	 * when the run began (`REG-D-074`). A CALL's served clock is the `Date` header, which is GMT; this is what places it
	 * on the server's own calendar, where a template's `currentDate` is (`REG-F-429`), so the check can hold a run to
	 * one server-clock day (§5.3).
	 */
	readonly serverUtcOffset: string | null;
	readonly options: Readonly<Record<string, string | number | boolean>>;
	readonly bounds: {
		readonly wallClockMs: number;
		readonly promptChars: number | null;
		readonly printTimeout: string | null;
	};
	/** The argv the program is given, `<prompt>` standing for the prompt. Null where there is no program. */
	readonly argv: readonly string[] | null;
}
export interface RunLine {
	readonly kind: 'RUN';
	readonly recordVersion: number;
	readonly runId: string;
	readonly date: string;
	readonly commit: string;
	readonly reviewerFingerprint: string;
	readonly scoringDigest: string;
	readonly caseSetDigest: string;
	readonly caseSetVersion: number;
	readonly oracleVersion: number;
	readonly caseIds: readonly string[];
	readonly repetitions: number;
	readonly candidate: CandidateIdentity;
	/** The transport's, never the writer's: `DEPLOYABLE_TRANSPORTS.has(candidate.transport)`. */
	readonly deployable: boolean;
}
/** What came back from one model call, as far as a tracked record may keep it (§5.3). */
export type CallReply =
	/**
	 * A located answer span that parses as ONE JSON value, kept in its RETAINED FORM (`retainedAnswer`): only what the
	 * product reads of it, written one canonical way — never text outside JSON syntax, never a key the product ignores.
	 * `spanSha256` binds it to the span as it came back.
	 */
	| { readonly status: 'ANSWERED'; readonly answer: string; readonly spanSha256: string }
	/** A located span that is NOT one JSON value — prose or reasoning with braces around or inside it. None of its text
	 *  is kept: only its hash, and (on the CALL) the malformation classes that say why. The product's parse rejected it,
	 *  as it rejects the empty string, which is all a re-scoring needs. */
	| { readonly status: 'NOT_RETAINED'; readonly spanSha256: string }
	/** No span located: nothing is retained. `parses` is whether the product's parse ACCEPTED the reply anyway — a
	 *  bare JSON scalar or array is taken as a judgement with no findings — which is all a re-scoring needs. */
	| { readonly status: 'NO_ANSWER_SPAN'; readonly parses: boolean }
	/** No reply at all; carried as recorded, never re-scored. */
	| {
			readonly status: 'TRANSPORT_FAILURE';
			readonly failureClass: TransportFailureClass;
			readonly reason: string;
			readonly rescorable: false;
			/** True only when the transport refused the call itself, before the tool or server was touched (an
			 *  over-long prompt) — so nothing was served and no bound was reached. */
			readonly preContact: boolean;
	  };
/** The outcome as scored at run time, with the scoring digest it was scored under (§5.4 CALL). */
export interface ScoredOutcome {
	readonly scoringDigest: string;
	readonly disposition: ScoredDisposition;
	readonly resultClass: ResultClass;
	readonly independenceOk: boolean;
	readonly criteria: readonly (readonly [string, CriterionOutcomeName])[];
}
/** Per call, what the harness Ollama transport was served: the template's hash and the server's clock (`REG-F-429`). */
export interface ServedFacts {
	readonly templateSha256: string;
	readonly serverClock: string;
}
export interface CallEvaluator {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
	readonly identityEvidence: (typeof IDENTITY_EVIDENCE)[number];
}
export interface CallLine {
	readonly kind: 'CALL';
	readonly runId: string;
	readonly caseId: string;
	readonly repetition: number;
	readonly role: CallRole;
	/** sha256 of the prompt actually sent. */
	readonly promptSha256: string;
	readonly elapsedMs: number;
	readonly reply: CallReply;
	readonly malformations: readonly MalformationClass[];
	readonly served: ServedFacts | null;
	/** The resolved evaluator identity. */
	readonly evaluator: CallEvaluator;
	/** On the LAST call of an evaluation only; null on an initial call a repair followed. */
	readonly scored: ScoredOutcome | null;
}
export interface EscalationLine {
	readonly kind: 'ESCALATION';
	readonly runId: string;
	/** Exactly one of `caseIds` (a tracked run) and `heldOutCount` (a held-out run). */
	readonly caseIds?: readonly string[];
	readonly heldOutCount?: number;
	readonly finding: string;
	readonly note: string;
}
export interface RescoredLine {
	readonly kind: 'RESCORED';
	readonly rescoreId: string;
	readonly sourceRunId: string;
	readonly date: string;
	readonly commit: string;
	readonly reviewerFingerprint: string;
	readonly scoringDigest: string;
	readonly caseSetDigest: string;
	readonly caseId: string;
	readonly repetition: number;
	readonly scored: ScoredOutcome;
}
export interface AcknowledgedLine {
	readonly kind: 'ACKNOWLEDGED';
	readonly date: string;
	readonly reviewerFingerprint: string;
	/** Exactly one of `addedCaseIds` and `reason`. */
	readonly addedCaseIds?: readonly string[];
	readonly reason?: string;
}
export interface SupersededLine {
	readonly kind: 'SUPERSEDED';
	readonly date: string;
	/** The run id, or the rescore id, of the record struck. */
	readonly record: string;
	readonly finding: string;
	readonly note: string;
}
export interface HeldOutLine {
	readonly kind: 'HELD_OUT';
	readonly runId: string;
	readonly date: string;
	readonly reviewerFingerprint: string;
	readonly counts: Readonly<Record<MaterialFailureClass, number>>;
}
export type RecordLine =
	| RunLine
	| CallLine
	| EscalationLine
	| RescoredLine
	| AcknowledgedLine
	| SupersededLine
	| HeldOutLine;

/** The one serialization of a line: its JSON, then LF. */
export function serializeLine(line: RecordLine): string {
	return `${JSON.stringify(line)}\n`;
}

// ── retention: what of an answer a tracked line may keep (§5.3) ───────────────────────────────────────────────────

/**
 * ⭐ WHAT THE PRODUCT READS OF A PARSED ANSWER (`reasoning-review-validator.ts` `coerceJudgement`): three keys of the
 * judgement, four of each finding. Restated as data so a line can be checked without loading the validator.
 * ⚠ RESTATED, SO IT CAN DRIFT: a key `coerceJudgement` starts reading must be added here, or a replay would not see what
 * the run saw — which the runner's replay of every retention form is there to catch.
 */
export const JUDGEMENT_READ_KEYS = ['findings', 'recommendation', 'residualUncertainty'] as const;
export const FINDING_READ_KEYS = ['criterionId', 'failed', 'statement', 'severity'] as const;

/** JSON cannot write ±Infinity (`1e400` parses to it); ±Number.MAX_VALUE keeps its type and truthiness — all the product
 *  reads of a number. */
const writable = (v: unknown): unknown =>
	typeof v === 'number' && !Number.isFinite(v) ? Math.sign(v) * Number.MAX_VALUE : v;
/** A value the product only TYPE-TESTS: its type is kept, its content emptied. */
function emptied(v: unknown): unknown {
	if (typeof v === 'string') return '';
	if (Array.isArray(v)) return [];
	if (isObject(v)) return {};
	return writable(v);
}
/** A value the product reads as a SCALAR: kept when it is one; a container there is read only as a type. */
const scalar = (v: unknown): unknown =>
	Array.isArray(v) || isObject(v) ? emptied(v) : writable(v);
const pick = (
	o: Record<string, unknown>,
	keys: readonly string[],
	read: (v: unknown) => unknown
): Record<string, unknown> =>
	Object.fromEntries(keys.filter((k) => Object.hasOwn(o, k)).map((k) => [k, read(o[k])]));
const finding = (v: unknown): unknown =>
	isObject(v) ? pick(v, FINDING_READ_KEYS, scalar) : emptied(v);
const listOf =
	(item: (v: unknown) => unknown) =>
	(v: unknown): unknown =>
		Array.isArray(v) ? v.map(item) : emptied(v);
const READ: Readonly<Record<(typeof JUDGEMENT_READ_KEYS)[number], (v: unknown) => unknown>> = {
	findings: listOf(finding),
	recommendation: scalar,
	residualUncertainty: listOf(scalar)
};

/**
 * ⭐ A PARSED ANSWER, REDUCED TO WHAT THE PRODUCT READS — the product's parse of it is unchanged, so a replay scores what
 * the run scored; and a key the product never reads (a `reasoning`, a `thinking`, a note inside `failed`) is gone.
 */
export function projectJudgement(parsed: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		JUDGEMENT_READ_KEYS.filter((k) => Object.hasOwn(parsed, k)).map((k) => [k, READ[k](parsed[k])])
	);
}

/** A backtick, escaped: `extractJson` windows into whatever lies between two ``` fences, so none may reach a retained
 *  answer that a replay feeds back through it. */
const BACKTICK = '\\u' + '0060';
/** ⭐ THE RETAINED FORM of a parsed answer — its projection's JSON, backticks escaped: the one way a line keeps an answer. */
export function retainedAnswer(parsed: Record<string, unknown>): string {
	return JSON.stringify(projectJudgement(parsed)).replaceAll('`', BACKTICK);
}

// ── validation: a small closed-shape checker ───────────────────────────────────────────────────────────────────

type Check = (value: unknown, at: string) => string[];
const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const FINDING = /^REG-F-\d{3,}$/;

// ── the server's calendar (§5.3; `REG-F-429`) ───────────────────────────────────────────────────────────────────

/**
 * ⭐ `JAN-CRITREAD` J2-3 — A UTC OFFSET A SERVER CAN ACTUALLY KEEP, as `/api/ps` writes one (`Z` normalised to
 * `+00:00`): from −12:00 to +14:00, the minutes 00, 30 or 45. `-00:00` is refused — RFC 3339 spells an UNKNOWN offset
 * that way, and an unknown offset is what the field exists to rule out. Minutes east of UTC, or undefined.
 */
export function utcOffsetMinutes(offset: string): number | undefined {
	const m = /^([+-])(\d{2}):(00|30|45)$/.exec(offset);
	if (!m || offset === '-00:00') return undefined;
	const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
	return minutes >= -12 * 60 && minutes <= 14 * 60 ? minutes : undefined;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** An HTTP `Date` header (IMF-fixdate, always GMT) as epoch milliseconds, or undefined. */
function httpDate(value: string): number | undefined {
	const m = /^[A-Z][a-z]{2}, (\d{2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(value);
	const month = m ? MONTHS.indexOf(m[2]!) : -1;
	if (!m || month < 0) return undefined;
	return Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
}

/**
 * ⭐ THE SERVER'S OWN CALENDAR DATE (`YYYY-MM-DD`) for a served clock — the `Date` header a CALL records, which is GMT,
 * shifted by the offset its run recorded — or undefined when either cannot be read. Where a template's `currentDate`
 * lives (`REG-F-429`). ONE function, so the runner that stops a run at the server's midnight and the check that
 * discards a run straddling it cannot disagree about where midnight is.
 */
export function serverDayOf(serverClock: string, offset: string): string | undefined {
	const ms = httpDate(serverClock);
	const minutes = utcOffsetMinutes(offset);
	if (ms === undefined || minutes === undefined) return undefined;
	return new Date(ms + minutes * 60_000).toISOString().slice(0, 10);
}

const str =
	(pattern?: RegExp, what = 'a string'): Check =>
	(v, at) =>
		typeof v === 'string' && v.length > 0 && (!pattern || pattern.test(v))
			? []
			: [`${at}: not ${what}`];
const int =
	(min: number): Check =>
	(v, at) =>
		Number.isInteger(v) && (v as number) >= min ? [] : [`${at}: not an integer ≥ ${min}`];
const bool: Check = (v, at) => (typeof v === 'boolean' ? [] : [`${at}: not a boolean`]);
const oneOf =
	(values: readonly string[]): Check =>
	(v, at) =>
		typeof v === 'string' && values.includes(v)
			? []
			: [`${at}: ${JSON.stringify(v)} is not one of ${values.join(', ')}`];
const nullable =
	(c: Check): Check =>
	(v, at) =>
		v === null ? [] : c(v, at);
const arrayOf =
	(c: Check, min = 0): Check =>
	(v, at) =>
		Array.isArray(v)
			? [
					...(v.length < min ? [`${at}: fewer than ${min} entries`] : []),
					...v.flatMap((x, i) => c(x, `${at}[${i}]`))
				]
			: [`${at}: not an array`];
/**
 * A closed object: every key checked, none missing, none extra. `optional` keys may be absent.
 * ⛔ OWN PROPERTIES ONLY, ON BOTH SIDES. `key in fields` asks the prototype chain too, so every name an object inherits
 * — `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `__proto__` — passed as "declared" and was
 * never checked; and JSON.parse makes `"__proto__"` an OWN key of the line, so it can carry text as well as any.
 */
const shape =
	(fields: Readonly<Record<string, Check>>, optional: readonly string[] = []): Check =>
	(v, at) => {
		if (!isObject(v)) return [`${at}: not an object`];
		const problems: string[] = [];
		for (const key of Object.keys(v))
			if (!Object.hasOwn(fields, key)) problems.push(`${at}: unexpected key "${key}"`);
		for (const [key, check] of Object.entries(fields)) {
			if (!Object.hasOwn(v, key)) {
				if (!optional.includes(key)) problems.push(`${at}: missing key "${key}"`);
				continue;
			}
			problems.push(...check(v[key], `${at}.${key}`));
		}
		return problems;
	};
/** Exactly one of two optional keys is present — as an OWN key, like every key set here. */
const exactlyOne =
	(a: string, b: string): Check =>
	(v, at) =>
		isObject(v) && Object.hasOwn(v, a) !== Object.hasOwn(v, b)
			? []
			: [`${at}: exactly one of "${a}" and "${b}"`];
const all =
	(...checks: Check[]): Check =>
	(v, at) =>
		checks.flatMap((c) => c(v, at));

const scored: Check = shape({
	scoringDigest: str(SHA256, 'a sha256'),
	disposition: oneOf(SCORED_DISPOSITIONS),
	resultClass: oneOf(RESULT_CLASSES),
	independenceOk: bool,
	criteria: arrayOf((v, at) =>
		Array.isArray(v) && v.length === 2
			? [...str()(v[0], `${at}[0]`), ...oneOf(CRITERION_OUTCOMES)(v[1], `${at}[1]`)]
			: [`${at}: not a [criterionId, outcome] pair`]
	)
});

/**
 * ⛔ RETENTION, ENFORCED BY THE LINE (§5.3: reasoning, in its own field or inline, never enters a tracked record). A
 * located span runs from the first `{` to the last `}` of its window, so "begins with `{`, ends with `}`" admits any
 * reasoning with a brace on each side of it. An answer is admitted only as the RETAINED FORM of one JSON object — it
 * parses, and `retainedAnswer` writes it back byte for byte — so it holds nothing outside JSON syntax, and no key the
 * product does not read.
 */
const retainedForm: Check = (v, at) => {
	if (typeof v !== 'string') return [`${at}: not a string`];
	let parsed: unknown;
	try {
		parsed = JSON.parse(v);
	} catch {
		return [
			`${at}: not an answer span that parses as one JSON value — text outside JSON syntax is never retained (§5.3)`
		];
	}
	if (!isObject(parsed)) return [`${at}: not an answer span — one JSON value, but not an object`];
	return retainedAnswer(parsed) === v
		? []
		: [
				`${at}: not an answer span in its retained form — it carries what the product does not read, or is not ` +
					'written the one canonical way (§5.3)'
			];
};

const reply: Check = (v, at) => {
	if (!isObject(v)) return [`${at}: not an object`];
	switch (v.status) {
		case 'ANSWERED':
			return shape({ status: str(), answer: retainedForm, spanSha256: str(SHA256, 'a sha256') })(
				v,
				at
			);
		case 'NOT_RETAINED':
			return shape({ status: str(), spanSha256: str(SHA256, 'a sha256') })(v, at);
		case 'NO_ANSWER_SPAN':
			return shape({ status: str(), parses: bool })(v, at);
		case 'TRANSPORT_FAILURE':
			return shape({
				status: str(),
				failureClass: oneOf(TRANSPORT_FAILURE_CLASSES),
				reason: str(),
				rescorable: (x, a) =>
					x === false ? [] : [`${a}: a transport failure is never re-scorable`],
				preContact: (x, a) => {
					if (typeof x !== 'boolean') return [`${a}: not a boolean`];
					return x && v.failureClass !== 'REFUSAL'
						? [`${a}: a call refused before contact reached no bound — it is a REFUSAL`]
						: [];
				}
			})(v, at);
		default:
			return [
				`${at}.status: ${JSON.stringify(v.status)} is not ANSWERED, NOT_RETAINED, NO_ANSWER_SPAN or TRANSPORT_FAILURE`
			];
	}
};

const candidate: Check = (v, at) => {
	const base = shape({
		transport: oneOf(TRANSPORT_NAMES),
		agentId: str(),
		provider: str(),
		modelLabel: str(),
		servedModelDigest: nullable(str(SHA256, 'a sha256')),
		servedTemplateSha256: nullable(str(SHA256, 'a sha256')),
		servedModelfileSha256: nullable(str(SHA256, 'a sha256')),
		templateInjectsDate: nullable(bool),
		serverVersion: nullable(str()),
		serverUtcOffset: nullable((o, a) =>
			typeof o === 'string' && utcOffsetMinutes(o) !== undefined
				? []
				: [`${a}: not a UTC offset (±HH:MM, from -12:00 to +14:00, minutes 00, 30 or 45)`]
		),
		options: (o, a) =>
			isObject(o)
				? Object.entries(o).flatMap(([k, x]) =>
						['string', 'number', 'boolean'].includes(typeof x)
							? []
							: [`${a}.${k}: not a string, number or boolean`]
					)
				: [`${a}: not an object`],
		bounds: shape({
			wallClockMs: int(1),
			promptChars: nullable(int(1)),
			printTimeout: nullable(str())
		}),
		argv: nullable(arrayOf(str()))
	})(v, at);
	if (base.length > 0 || !isObject(v)) return base;
	const transport = v.transport as TransportName;
	if (transport === 'stub') return [];
	const problems: string[] = [];
	const expected = TRANSPORT_IDENTITY[transport];
	if (v.agentId !== expected.agentId)
		problems.push(
			`${at}.agentId: ${JSON.stringify(v.agentId)} is not ${transport}’s agent "${expected.agentId}"`
		);
	if (v.provider !== expected.provider)
		problems.push(
			`${at}.provider: ${JSON.stringify(v.provider)} is not ${transport}’s provider "${expected.provider}"`
		);
	// ⭐ A real Ollama model is admitted only WITH what it was served (§5.3); the product's tools serve nothing we can see.
	for (const key of [
		'servedModelDigest',
		'servedTemplateSha256',
		'servedModelfileSha256',
		'templateInjectsDate',
		'serverVersion',
		'serverUtcOffset'
	]) {
		if (transport === 'ollama' && v[key] === null)
			problems.push(`${at}.${key}: an ollama candidate records what it was served`);
		if (transport !== 'ollama' && v[key] !== null)
			problems.push(`${at}.${key}: ${transport} is served nothing a run can see`);
	}
	return problems;
};

const LINE_SHAPES: Readonly<Record<RecordLineKind, Check>> = {
	RUN: all(
		shape({
			kind: str(),
			recordVersion: (v, at) => (v === RECORD_VERSION ? [] : [`${at}: not ${RECORD_VERSION}`]),
			runId: str(ID, 'an id'),
			date: str(ISO_UTC, 'an ISO-8601 UTC time'),
			commit: str(COMMIT, 'a 40-hex commit'),
			reviewerFingerprint: str(SHA256, 'a sha256'),
			scoringDigest: str(SHA256, 'a sha256'),
			caseSetDigest: str(SHA256, 'a sha256'),
			caseSetVersion: int(1),
			oracleVersion: int(1),
			caseIds: arrayOf(str(ID, 'an id'), 1),
			repetitions: int(1),
			candidate,
			deployable: bool
		}),
		(v, at) => {
			if (!isObject(v) || !isObject(v.candidate) || typeof v.deployable !== 'boolean') return [];
			const transport = v.candidate.transport as TransportName;
			const deployable = DEPLOYABLE_TRANSPORTS.has(transport);
			return v.deployable === deployable
				? []
				: [
						`${at}.deployable: ${v.deployable}, but transport "${transport}" is ${deployable ? '' : 'not '}deployable`
					];
		}
	),
	CALL: shape({
		kind: str(),
		runId: str(ID, 'an id'),
		caseId: str(ID, 'an id'),
		repetition: int(1),
		role: oneOf(CALL_ROLES),
		promptSha256: str(SHA256, 'a sha256'),
		elapsedMs: int(0),
		reply,
		malformations: arrayOf(oneOf(MALFORMATION_CLASSES)),
		served: nullable(shape({ templateSha256: str(SHA256, 'a sha256'), serverClock: str() })),
		evaluator: shape({
			agentId: str(),
			modelId: str(),
			providerId: str(),
			identityEvidence: oneOf(IDENTITY_EVIDENCE)
		}),
		scored: nullable(scored)
	}),
	ESCALATION: all(
		shape(
			{
				kind: str(),
				runId: str(ID, 'an id'),
				caseIds: arrayOf(str(ID, 'an id'), 1),
				heldOutCount: int(1),
				finding: str(FINDING, 'a register finding (REG-F-NNN)'),
				note: str()
			},
			['caseIds', 'heldOutCount']
		),
		exactlyOne('caseIds', 'heldOutCount')
	),
	RESCORED: shape({
		kind: str(),
		rescoreId: str(ID, 'an id'),
		sourceRunId: str(ID, 'an id'),
		date: str(ISO_UTC, 'an ISO-8601 UTC time'),
		commit: str(COMMIT, 'a 40-hex commit'),
		reviewerFingerprint: str(SHA256, 'a sha256'),
		scoringDigest: str(SHA256, 'a sha256'),
		caseSetDigest: str(SHA256, 'a sha256'),
		caseId: str(ID, 'an id'),
		repetition: int(1),
		scored
	}),
	ACKNOWLEDGED: all(
		shape(
			{
				kind: str(),
				date: str(ISO_UTC, 'an ISO-8601 UTC time'),
				reviewerFingerprint: str(SHA256, 'a sha256'),
				addedCaseIds: arrayOf(str(ID, 'an id'), 1),
				reason: str()
			},
			['addedCaseIds', 'reason']
		),
		exactlyOne('addedCaseIds', 'reason')
	),
	SUPERSEDED: shape({
		kind: str(),
		date: str(ISO_UTC, 'an ISO-8601 UTC time'),
		record: str(ID, 'an id'),
		finding: str(FINDING, 'a register finding (REG-F-NNN)'),
		note: str()
	}),
	HELD_OUT: shape({
		kind: str(),
		runId: str(ID, 'an id'),
		date: str(ISO_UTC, 'an ISO-8601 UTC time'),
		reviewerFingerprint: str(SHA256, 'a sha256'),
		counts: shape(Object.fromEntries(MATERIAL_FAILURE_CLASSES.map((k) => [k, int(0)])))
	})
};

/** Everything wrong with one line on its own. Empty means it is a line of the record. */
export function lineProblems(value: unknown): string[] {
	if (!isObject(value)) return ['not a JSON object'];
	const kind = value.kind;
	if (typeof kind !== 'string' || !(RECORD_LINE_KINDS as readonly string[]).includes(kind))
		return [`kind ${JSON.stringify(kind)} is not one of ${RECORD_LINE_KINDS.join(', ')}`];
	return LINE_SHAPES[kind as RecordLineKind](value, kind);
}

/** One evaluation's calls so far, keyed `${runId}|${caseId}|${repetition}` — an id cannot hold a `|`. */
interface Evaluation {
	readonly label: string;
	roles: CallRole[];
	scoredAt: number[];
	lastLine: number;
}

/**
 * Everything wrong with a record file: its text, each line, and how the lines hang together. `tracked` applies what a
 * COMMITTED record owes besides — no harness identity (§5.3).
 */
export function recordProblems(text: string, opts: { readonly tracked: boolean }): string[] {
	const problems: string[] = [];
	if (text.charCodeAt(0) === 0xfeff) problems.push('a BOM');
	if (text.includes('\r')) problems.push('a CR — the record is LF only');
	if (text === '') return problems;
	if (!text.endsWith('\n')) problems.push('no final newline');
	const runs = new Map<string, RunLine>();
	const evaluations = new Map<string, Evaluation>();
	const rows = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
	for (const [i, row] of rows.entries()) {
		const n = i + 1;
		if (row.trim() === '') {
			problems.push(`line ${n}: blank`);
			continue;
		}
		let value: unknown;
		try {
			value = JSON.parse(row);
		} catch {
			problems.push(`line ${n}: not JSON`);
			continue;
		}
		const own = lineProblems(value);
		if (own.length > 0) {
			problems.push(...own.map((p) => `line ${n}: ${p}`));
			continue;
		}
		const line = value as RecordLine;
		if (line.kind === 'RUN') problems.push(...runProblems(line, n, runs, opts.tracked));
		else if (line.kind === 'CALL') problems.push(...callProblems(line, n, runs, evaluations));
	}
	for (const e of evaluations.values())
		if (e.scoredAt.at(-1) !== e.lastLine)
			problems.push(`${e.label}: its last call carries no scored outcome`);
	return problems;
}

function runProblems(
	line: RunLine,
	n: number,
	runs: Map<string, RunLine>,
	tracked: boolean
): string[] {
	const problems: string[] = [];
	if (runs.has(line.runId)) problems.push(`line ${n}: RUN ${line.runId} is declared twice`);
	runs.set(line.runId, line);
	if (tracked && HARNESS_TRANSPORTS.has(line.candidate.transport))
		problems.push(
			`line ${n}: RUN ${line.runId} carries a harness identity (transport "${line.candidate.transport}"), ` +
				'which a tracked record refuses (§5.3)'
		);
	return problems;
}

/** A CALL against its run, and against the calls of its evaluation before it: initial, then at most one repair,
 *  scored once — on the last. */
function callProblems(
	line: CallLine,
	n: number,
	runs: ReadonlyMap<string, RunLine>,
	evaluations: Map<string, Evaluation>
): string[] {
	const run = runs.get(line.runId);
	if (!run) return [`line ${n}: CALL names run ${line.runId}, which no earlier RUN line declares`];
	const label = `${line.caseId}#${line.repetition}`;
	const at = `line ${n}: CALL ${label} ${line.role}`;
	const problems: string[] = [];
	if (!run.caseIds.includes(line.caseId))
		problems.push(`${at}: ${line.caseId} is not one of its run’s cases`);
	if (line.repetition > run.repetitions)
		problems.push(`${at}: repetition ${line.repetition} is beyond its run’s ${run.repetitions}`);
	problems.push(...servedProblems(line, run, at));
	if (line.scored && line.scored.scoringDigest !== run.scoringDigest)
		problems.push(`${at} is scored under a digest that is not its run’s`);
	const key = `${line.runId}|${line.caseId}|${line.repetition}`;
	const e = evaluations.get(key) ?? { label, roles: [], scoredAt: [], lastLine: 0 };
	evaluations.set(key, e);
	if (e.roles.length === 0) {
		if (line.role !== 'initial') problems.push(`${at} does not follow an initial call`);
	} else if (e.roles.length === 1 && line.role === 'repair') {
		if (e.scoredAt.length > 0)
			problems.push(
				`line ${e.scoredAt[0]}: CALL ${label} initial is scored, but a later call follows it`
			);
	} else problems.push(`${at}: the evaluation already has ${e.roles.join(' and ')}`);
	e.roles.push(line.role);
	e.lastLine = n;
	if (line.scored) e.scoredAt.push(n);
	return problems;
}

/**
 * ⛔ SERVED FACTS: an ollama run's CALL carries what the server served it (`REG-F-429`), EXCEPT a transport failure the
 * transport made before the server was touched — nothing was served — and nowhere else. No other transport can see any.
 */
function servedProblems(line: CallLine, run: RunLine, at: string): string[] {
	const preContact = line.reply.status === 'TRANSPORT_FAILURE' && line.reply.preContact;
	if (run.candidate.transport !== 'ollama')
		return line.served === null
			? []
			: [`${at} carries served facts its ${run.candidate.transport} run cannot observe`];
	if (line.served === null && !preContact)
		return [`${at} carries no served facts, but its run is ollama`];
	if (line.served !== null && preContact)
		return [`${at} was refused before the server was touched, yet carries served facts`];
	return [];
}

/** The run ids a record declares in its RUN lines. Call it on a record `recordProblems` found valid. */
export function declaredRunIds(text: string): Set<string> {
	const ids = new Set<string>();
	for (const row of text.split('\n')) {
		if (row.trim() === '') continue;
		const line = JSON.parse(row) as { kind?: unknown; runId?: unknown };
		if (line.kind === 'RUN' && typeof line.runId === 'string') ids.add(line.runId);
	}
	return ids;
}

/**
 * ⛔ APPEND-ONLY: each version of a record file, oldest first, must be the one before it with lines appended — a byte
 * prefix. Records are struck by a SUPERSEDED line, never edited or deleted (§5.4).
 */
export function appendOnlyProblems(versions: readonly string[]): string[] {
	const problems: string[] = [];
	for (let i = 1; i < versions.length; i++) {
		const before = versions[i - 1]!;
		const after = versions[i]!;
		if (!after.startsWith(before))
			problems.push(`version ${i + 1} is not version ${i} with lines appended`);
	}
	return problems;
}
