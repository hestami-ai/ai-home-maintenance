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
export async function agyPrint(prompt: string): Promise<string> {
	if (prompt.length > MAX_AGY_PROMPT_CHARS)
		throw new Error(
			`agy prompt is ${prompt.length} chars, over the ${MAX_AGY_PROMPT_CHARS}-char command-line budget ` +
				`(agy accepts the prompt only as an argv value; a longer one fails as spawn ENAMETOOLONG). ` +
				`The caller must shorten it.`
		);
	const args = ['--print', prompt, '--print-timeout', '3m', '--model', judgeModel()];
	const { stdout } = await execFileAsync(AGY_BIN, args, {
		timeout: 240_000,
		maxBuffer: 16 * 1024 * 1024,
		windowsHide: true
	});
	return stdout;
}

/** Strip markdown fences and extract the outermost JSON object from a model reply. */
export function extractJson(raw: string): string {
	let s = raw.trim();
	const fence = /```(?:json)?([\s\S]*?)```/i.exec(s);
	if (fence) s = fence[1].trim();
	const first = s.indexOf('{');
	const last = s.lastIndexOf('}');
	if (first >= 0 && last > first) s = s.slice(first, last + 1);
	return s;
}
