// Shared plain `agy --print` invocation (Google Antigravity / Gemini) + defensive JSON extraction. Matches the
// authorized invocation pattern — a pure-reasoning call, no tools/workspace, no permission bypass.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGY_BIN = process.env.JPWB_AGY_BIN ?? 'agy';

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

/** One non-interactive `agy --print "<prompt>"` call, returning stdout. Always pins the model, so the model that
 *  actually judged is the model recorded. Fails closed if the prompt exceeds the command-line budget. */
/** The exec seam. Injectable ONLY so the sanitisation boundary is reachable in the gate — as an inline call it
 *  could be exercised only by driving a real agy, so the regression that reintroduces the leak would be silent. */
export type AgyExec = (
	file: string,
	args: readonly string[],
	options: { timeout: number; maxBuffer: number; windowsHide: boolean }
) => Promise<{ stdout: string }>;

export async function agyPrint(
	prompt: string,
	exec: AgyExec = execFileAsync as unknown as AgyExec
): Promise<string> {
	if (prompt.length > MAX_AGY_PROMPT_CHARS)
		throw new Error(
			`agy prompt is ${prompt.length} chars, over the ${MAX_AGY_PROMPT_CHARS}-char command-line budget ` +
				`(agy accepts the prompt only as an argv value; a longer one fails as spawn ENAMETOOLONG). ` +
				`The caller must shorten it.`
		);
	const args = ['--print', prompt, '--print-timeout', '3m', '--model', judgeModel()];
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
		// THE ENTIRE PROMPT. That error is caught in rph-assurance's floor runner and written VERBATIM into a
		// `VALIDATOR_EXECUTION_FAILED` observation `statement`, which is dispatched through
		// `RecordAssuranceObservation` and PROJECTED onto the assurance view.
		//
		// So rethrowing puts the whole materialized judge prompt — graph export, rubric, the producer's declared
		// rationale and narration — into a permanent, projected record with no redaction (finding #60).
		// `PER-12`: never logged, never projected. `PER-9`: retention is "subject to recorded redaction".
		//
		// ⚠ AND THE DIAGNOSTIC IS DELIBERATELY LOST RATHER THAN RELOCATED. Its lawful home is the exchange
		// record's E-5 (`REG-F-326`), which is not wired yet, or the LOG plane, where `PER-9` says redaction is
		// legal — and this codebase has no redaction at all. Until one exists, a DISCLOSED loss beats an
		// unlawful retention. The classification below is what a caller needs to act; the content is what it
		// may not carry.
		const code = (e as { code?: unknown })?.code;
		throw new Error(
			`agy invocation failed${typeof code === 'number' ? ` (exit ${code})` : ''}. ` +
				'Its diagnostic is WITHHELD from the record plane: execFile embeds the full argv — which carries the ' +
				'entire judge prompt — and the full stderr into its error message, and that message is written ' +
				'verbatim into a projected VALIDATOR_EXECUTION_FAILED observation. PER-12 forbids that content ' +
				'being logged or projected and no redaction exists here (finding #60). Diagnose from the agy ' +
				'process directly; the durable home for this outcome is the exchange record E-5 (REG-F-326).'
		);
	}
}

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

export function splitAnswerSpan(raw: string): AnswerSpan {
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
 * ⚠ BEHAVIOUR DELIBERATELY UNCHANGED. Every caller feeds this straight to `JSON.parse`, and its THROW is what
 * drives the repair path — so this is left byte-identical and `splitAnswerSpan` is added beside it rather than
 * replacing it. The equivalence (`located` ⇒ `splitAnswerSpan(raw).answer === extractJson(raw)`) is pinned by
 * test, so the two cannot drift apart silently.
 */
export function extractJson(raw: string): string {
	let s = raw.trim();
	const fence = /```(?:json)?([\s\S]*?)```/i.exec(s);
	if (fence) s = fence[1].trim();
	const first = s.indexOf('{');
	const last = s.lastIndexOf('}');
	if (first >= 0 && last > first) s = s.slice(first, last + 1);
	return s;
}
