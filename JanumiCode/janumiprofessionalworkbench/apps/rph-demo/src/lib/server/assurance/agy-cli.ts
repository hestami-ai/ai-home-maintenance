// Shared plain `agy --print` invocation (Google Antigravity / Gemini) + defensive JSON extraction. Matches the
// authorized invocation pattern — a pure-reasoning call, no tools/workspace, no permission bypass.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * ⭐ `JAN-SELREV` SR-2 (D7) — the program override this module CAPTURED when it loaded: `undefined` when
 * `JPWB_AGY_BIN` was unset, `''` when it was set empty. Exported so the reviewer selector refuses what this module
 * will actually run — outside test mode, a set override refuses an agy review (`REG-F-441`). ⚠ Still honoured here, in
 * every mode: the harness's argv assertion is tested against a captured override, and the agy EXECUTOR
 * ~~(`agyPrintWithModel`) runs through this module too~~ ⭐ `JAN-MHX` MH-5: runs the program this captured, through its
 * CLI driver (`tools/agy-executor-driver.ts`) — ~~outside test mode that half is not refused (`REG-F-459`)~~
 * ⭐ `JAN-SELRES` RS-1 (D3): and outside test mode the EXECUTOR selector refuses it too, before dispatch
 * (`execution/executor-selection.ts`; `REG-F-459`). The refusal is the selectors'; this module still runs what it
 * captured, which is why the value to refuse is exported.
 */
export const AGY_BIN_OVERRIDE: string | undefined = process.env.JPWB_AGY_BIN;

const AGY_BIN = AGY_BIN_OVERRIDE ?? 'agy';

/**
 * Resolve the judge to a concrete model selection, or to NOTHING.
 *
 * ── ⭑ THERE IS NO APPLICATION DEFAULT, BY SPONSOR DIRECTION (2026-09-02) ────────────────────────────────────
 * "We won't be pinning judge model because that will be selected based on performance parameters that have yet
 * to be determined. Meaning that it will need to be configurable."
 *
 * The previous version pinned `'Gemini 3.5 Flash (High)'`. That label had ROTTED — the installed agy rejects it
 * outright (`REG-F-331`, measured: exit 1, stdout 0 bytes, stderr naming the valid labels), so every Reasoning
 * Review failed unless the override happened to be set. A pin expressed as a human-readable provider label rots
 * silently whenever the provider's catalogue moves, and nothing detects it.
 *
 * §8.4 requires the evaluator's "actual identities and lineage are recorded" and §14.6 the "allowed and
 * resolved provider/model/version". An application default that no longer exists satisfies neither — it is the
 * fictional identity `'agy:default'` in a better disguise. So the selection is now configuration-only and its
 * ABSENCE is a refusal rather than a fallback.
 *
 * Whitespace-only configuration is treated as absent so it cannot become an empty evaluator identity.
 */
export function resolveJudgeModel(configured = process.env.JPWB_JUDGE_MODEL): string | undefined {
	return configured?.trim() || undefined;
}

/**
 * The configured judge model, or a REFUSAL.
 *
 * Fails closed (§13.3) rather than substituting anything: an unconfigured judge has no identity to record, and
 * recording a placeholder is precisely what this module was written to stop.
 */
export function judgeModel(): string {
	const model = resolveJudgeModel();
	if (!model)
		throw new Error(
			'JPWB_JUDGE_MODEL is not set, and there is no application default: the judge model is selected on ' +
				'performance parameters and must be configured explicitly (sponsor direction, 2026-09-02). Set it to a ' +
				'label the installed agy recognises; its error output lists the available ones. ' +
				'Refusing rather than substituting, because an evaluator identity may not be a fiction (§8.4, §14.6).'
		);
	return model;
}

/**
 * agy takes the prompt ONLY as the value of its `--print`/`--prompt` string flag — it reads no stdin (an empty
 * `--print` errors "empty prompt", `-` is taken literally) and no file. So the whole prompt rides in argv, and on
 * Windows the entire command line is capped near 32,767 chars by CreateProcess — a longer prompt fails as
 * `spawn ENAMETOOLONG`. This ceiling keeps the prompt well under that, leaving room for the exe path, the other
 * flags, and Windows arg-escaping overhead (which inflates quote-heavy JSON). Callers that assemble large prompts
 * (the Reasoning Review) MUST budget to this; this is the fail-closed backstop that converts a would-be opaque
 * `ENAMETOOLONG` into a clear, classifiable error.
 */
export const MAX_AGY_PROMPT_CHARS = 28_000;

/** The exec seam. Injectable ONLY so the sanitisation boundary is reachable in the gate — as an inline call it
 *  could be exercised only by driving a real agy, so the regression that reintroduces the leak would be silent.
 *  ~~⭐ `JAN-SELRES` RS-1 (D4) — and so the agy EXECUTOR's argv is: `getExecutionSession` passes it through, which is
 *  how the gate sees which model the executor asked agy to run.~~ ⭐ `JAN-MHX` MH-5: the agy executor no longer calls
 *  through here; it is a CLI executor, whose argv its driver's test pins. */
export type AgyExec = (
	file: string,
	args: readonly string[],
	options: { timeout: number; maxBuffer: number; windowsHide: boolean }
) => Promise<{ stdout: string }>;

/**
 * ⭐ `JAN-SELRES` RS-1 (D2) — WHOSE PROMPT AN agy CALL CARRIES, and so where its failure is written. It decides what
 * the sanitised failure SAYS and nothing else: the argv, the bounds and the catch are ONE implementation ~~for both~~.
 *   · `JUDGE` — the Reasoning Review's prompt (`agyPrint`). Its failure becomes a projected
 *     `VALIDATOR_EXECUTION_FAILED` observation, and that text is pinned byte for byte (`agy-cli.test.ts`, the
 *     qualification harness), so it is unchanged.
 *   · ~~`EXECUTOR` — a work unit's instruction (`agyPrintWithModel`, which the agy executor calls). Its failure is
 *     written into the EXECUTION exchange record and the step's failure reason (`runModelInvocationStep`), and the
 *     execution plane has no sanitiser of its own — so the executor's leak would be the judge's, one plane over
 *     (`PER-12`).~~ ⭐ `JAN-MHX` MH-5 — RETIRED with `agyPrintWithModel`, its only caller: the agy executor is a CLI
 *     executor now, whose failure is a code and a checked excerpt (`tools/cli-executor-session.ts`, D19a).
 */
type AgyCallRole = 'JUDGE';

/** What the withheld diagnostic carried, and where the message would have been written — per role, for a true text. */
const WITHHELD_FROM: Record<AgyCallRole, { readonly prompt: string; readonly record: string }> = {
	JUDGE: {
		prompt: 'entire judge prompt',
		record: 'verbatim into a projected VALIDATOR_EXECUTION_FAILED observation'
	}
	// ~~`EXECUTOR: { prompt: 'entire work-unit instruction', record: "verbatim into the EXECUTION exchange record and the
	// step's failure reason" }`~~ ⭐ `JAN-MHX` MH-5 — retired with its role (above).
};

/** ⛔ Fails closed above the command-line budget (`MAX_AGY_PROMPT_CHARS`), before anything is spawned. */
function refuseOverBudget(prompt: string): void {
	if (prompt.length > MAX_AGY_PROMPT_CHARS)
		throw new Error(
			`agy prompt is ${prompt.length} chars, over the ${MAX_AGY_PROMPT_CHARS}-char command-line budget ` +
				`(agy accepts the prompt only as an argv value; a longer one fails as spawn ENAMETOOLONG). ` +
				`The caller must shorten it.`
		);
}

/**
 * ⭐ `JAN-SELRES` RS-1 (D2) — THE ONE IMPLEMENTATION: one non-interactive `agy --print "<prompt>"` call with the model
 * it is HANDED pinned as `--model`, returning stdout. ~~Both callers reach agy only through here~~ ⭐ `JAN-MHX` MH-5: its
 * one caller is `agyPrint`, so the argv, the bounds and the sanitising catch cannot drift apart — a second copy of the
 * catch is a second place for the leak.
 */
async function agyCall(
	prompt: string,
	model: string,
	role: AgyCallRole,
	exec: AgyExec
): Promise<string> {
	const args = ['--print', prompt, '--print-timeout', '3m', '--model', model];
	try {
		const { stdout } = await exec(AGY_BIN, args, {
			timeout: 240_000,
			maxBuffer: 16 * 1024 * 1024,
			windowsHide: true
		});
		return stdout;
	} catch (e) {
		// ⛔ SANITISE THE FAILURE. DO NOT RETHROW.
		//
		// Node's execFile rejection message is `Command failed: <full argv>\n<full stderr>` — and argv carries
		// THE ENTIRE PROMPT. For the JUDGE, that error is caught in rph-assurance's floor runner and written
		// VERBATIM into a `VALIDATOR_EXECUTION_FAILED` observation `statement`, which is dispatched through
		// `RecordAssuranceObservation` and PROJECTED onto the assurance view. ~~For the EXECUTOR it is written into
		// the EXECUTION exchange record's parse outcome and the step's `FailExecutionStep` reason — both permanent.~~
		// ⭐ `JAN-MHX` MH-5: the executor no longer calls through here.
		//
		// So rethrowing puts the whole materialized prompt — for the judge the graph export, rubric, the producer's
		// declared rationale and narration; for the executor the rendered instruction and the repair findings — into
		// a permanent record with no redaction (finding #60). `PER-12`: never logged, never projected. `PER-9`:
		// retention is "subject to recorded redaction".
		//
		// ⚠ AND THE DIAGNOSTIC IS DELIBERATELY LOST RATHER THAN RELOCATED. Its lawful home is the exchange
		// record's E-5 (`REG-F-326`), which is not wired yet, or the LOG plane, where `PER-9` says redaction is
		// legal — and this codebase has no redaction at all. Until one exists, a DISCLOSED loss beats an
		// unlawful retention. The classification below is what a caller needs to act; the content is what it
		// may not carry. ⭑ The ROLE changes only which prompt and which record the sentence names, so each is true.
		const code = (e as { code?: unknown })?.code;
		const withheld = WITHHELD_FROM[role];
		throw new Error(
			`agy invocation failed${typeof code === 'number' ? ` (exit ${code})` : ''}. ` +
				'Its diagnostic is WITHHELD from the record plane: execFile embeds the full argv — which carries the ' +
				`${withheld.prompt} — and the full stderr into its error message, and that message is written ` +
				`${withheld.record}. PER-12 forbids that content ` +
				'being logged or projected and no redaction exists here (finding #60). Diagnose from the agy ' +
				'process directly; the durable home for this outcome is the exchange record E-5 (REG-F-326).'
		);
	}
}

/**
 * One non-interactive `agy --print "<prompt>"` call for the JUDGE, returning stdout. Always pins the JUDGE model
 * (`judgeModel()`), so the model that actually judged is the model recorded. Fails closed if the prompt exceeds the
 * command-line budget.
 *
 * ⚠ ITS REFUSAL ORDER IS PINNED, AND UNCHANGED BY `JAN-SELRES` D2: the budget first, then the judge model, then the
 * call — an over-budget prompt is refused before an unset judge model is asked about (`agy-cli.test.ts`), and the
 * qualification harness asserts the argv byte for byte (`scripts/reviewer-qual/transports.ts`).
 */
export async function agyPrint(
	prompt: string,
	exec: AgyExec = execFileAsync as unknown as AgyExec
): Promise<string> {
	refuseOverBudget(prompt);
	return agyCall(prompt, judgeModel(), 'JUDGE', exec);
}

// ~~`export async function agyPrintWithModel(prompt, model, exec)`~~ ⭐ `JAN-MHX` MH-5 (`DESIGN-multi-harness-executor.md`
// D30) — GONE, STRUCK IN PLACE: one agy call running the model it was HANDED, the agy EXECUTOR's, which `JAN-SELRES` RS-1
// (D2; `REG-F-458` remedy (a)) wrote so the model named, run and recorded were one read. Its only caller was the text-only
// agy executor, which `execution/model.ts` retired: agy executes as a CLI now (`tools/agy-executor-driver.ts`), handed
// the selection's model by its opener, so `REG-F-458`'s one read holds there.

/**
 * The answer span and everything around it, VERBATIM.
 *
 * ⭑ WHY THE COMPLEMENT IS RETURNED RATHER THAN DISCARDED. Guide §9.7 (`:1340`): *"where it arrives inline with
 * the answer, separate it at retention so that only the answer span binds under Section 8.4."* `extractJson`
 * already DERIVES that boundary — it locates the fence and both brace offsets — and then throws the complement
 * away, so the one operation the corpus mandates was computed and dropped on every call. `REG-D-053` makes the
 * split the forward path; this is its prerequisite.
 *
 * ⚠ OFFSETS ARE ABSOLUTE AGAINST `raw`, WHICH IS THE WHOLE DIFFICULTY. The legacy path trims twice, and a
 * trimmed offset cannot address the original bytes — so a split built on it would silently drop the whitespace
 * between the spans and be lossy in exactly the way `PER-9` forbids. When `located`, this holds exactly:
 *
 *     prefix + answer + suffix === raw
 */
export interface AnswerSpan {
	readonly prefix: string;
	readonly answer: string;
	readonly suffix: string;
	/** ⚠ When FALSE no `{…}` span was found: `answer` is the legacy best-effort string, `prefix`/`suffix` are
	 *  empty, and the reconstruction identity does NOT hold. Never retain a split from an unlocated result. */
	readonly located: boolean;
}

/**
 * ⭐ `REG-F-557` AS1 — IS THE WHOLE TEXT, TRIMMED, ONE JSON OBJECT? Not an array, not a string, not `null`: the answer
 * both readers locate is an object, so only an object may be taken whole.
 *
 * ⛔ WHY THE WHOLE TEXT IS ASKED FIRST. Both readers looked for a fence ANYWHERE in the text and took what was inside
 * it as the answer. A work product that is one JSON object, whose document strings hold markdown code blocks, was
 * read as its first code block: in P2 that refused six valid work products as `SCHEMA_INVALID` and stopped three of
 * the four phases; in the first measured run a fenced TypeScript type held a brace pair, and the floor passed that
 * fragment. A text that parses as one object has no fence AROUND it — any fence in it is INSIDE one of its strings.
 * ⭑ Exported so the qualification harness asks the product's own question (`malformations.ts`, AS3).
 */
export function isWholeJsonObject(raw: string): boolean {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.trim());
	} catch {
		return false;
	}
	return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
}

export function splitAnswerSpan(raw: string): AnswerSpan {
	// ⭐ `REG-F-557` AS1 — THE WHOLE TEXT FIRST: when it is one JSON object, that object is the answer, and the
	// whitespace around it is the prefix and suffix, so `prefix + answer + suffix === raw` still holds. The offset is
	// measured against `raw`, never the trimmed text — the `REG-F-339` difficulty, unchanged.
	if (isWholeJsonObject(raw)) {
		const whole = raw.trim();
		const start = raw.length - raw.trimStart().length;
		return { prefix: raw.slice(0, start), answer: whole, suffix: raw.slice(start + whole.length), located: true };
	}
	// Only otherwise today's path: the first fence, then the outermost braces.
	// The `d` flag yields match INDICES, so the fence body's position in `raw` is read off the match rather
	// than recomputed by searching for the captured text — which would pick the wrong occurrence whenever the
	// body also appears in the opening delimiter's vicinity.
	const fence = /```(?:json)?([\s\S]*?)```/di.exec(raw);
	const at = fence?.indices?.[1];
	const from = at ? at[0] : 0;
	const to = at ? at[1] : raw.length;
	const windowed = raw.slice(from, to);
	const first = windowed.indexOf('{');
	const last = windowed.lastIndexOf('}');
	if (first < 0 || last <= first)
		return { prefix: '', answer: extractJson(raw), suffix: '', located: false };
	const start = from + first;
	const end = from + last + 1;
	return { prefix: raw.slice(0, start), answer: raw.slice(start, end), suffix: raw.slice(end), located: true };
}

/**
 * Strip markdown fences and extract the outermost JSON object from a model reply.
 *
 * ~~⚠ BEHAVIOUR DELIBERATELY UNCHANGED. Every caller feeds this straight to `JSON.parse`, and its THROW is what
 * drives the repair path — so this is left byte-identical and `splitAnswerSpan` is added beside it rather than
 * replacing it.~~ ⭐ `REG-F-557` AS1 — STRUCK, BECAUSE IT CHANGED, AND ONLY WHERE THE OLD PATH COULD NOT BE RIGHT. Its
 * behaviour changes only when the whole trimmed text is one JSON object: that object is returned. There the old path
 * could only return the same object (no fence in it, so its outermost braces) or a fragment of it (what lay between
 * its first two fences, which in valid JSON stand only inside its strings). ⚠ SO THE REPAIR PATH MOVES TOO, AND ONLY
 * THERE: such a fragment either threw — a repair asked of a reply that had answered — or parsed as some other value.
 * Every text that is not one JSON object takes the old path unchanged and throws exactly as it did. The equivalence
 * (`located` ⇒ `splitAnswerSpan(raw).answer === extractJson(raw)`) is still pinned by test (`REG-F-339`), so the two
 * cannot drift apart silently.
 */
export function extractJson(raw: string): string {
	let s = raw.trim();
	if (isWholeJsonObject(s)) return s;
	const fence = /```(?:json)?([\s\S]*?)```/i.exec(s);
	// `!` only: the group always participates when the fence matches. It lets this module typecheck under the
	// repository's base config (`noUncheckedIndexedAccess`), which the reviewer-qualification harness compiles it
	// with (`JAN-CRITREAD` J2-1); the emitted code is unchanged.
	if (fence) s = fence[1]!.trim();
	const first = s.indexOf('{');
	const last = s.lastIndexOf('}');
	if (first >= 0 && last > first) s = s.slice(first, last + 1);
	return s;
}
