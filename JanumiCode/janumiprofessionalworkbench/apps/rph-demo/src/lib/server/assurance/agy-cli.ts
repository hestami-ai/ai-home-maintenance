// Shared plain `agy --print` invocation (Google Antigravity / Gemini) + defensive JSON extraction. Matches the
// authorized invocation pattern — a pure-reasoning call, no tools/workspace, no permission bypass.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGY_BIN = process.env.JPWB_AGY_BIN ?? 'agy';
export const DEFAULT_JUDGE_MODEL = 'Gemini 3.5 Flash (High)';

/**
 * Resolve the judge to a concrete, application-owned model selection. §8.4 requires the evaluator's "actual
 * identities and lineage are recorded", and §14.6 requires recording "allowed and resolved
 * provider/model/version". An explicit environment override wins; otherwise the application pins the known agy
 * model label above. This is materially different from allowing agy to choose an unnamed dynamic default and then
 * recording the fictional identity `'agy:default'`.
 *
 * Whitespace-only configuration is treated as absent so it cannot become an empty evaluator identity.
 */
export function resolveJudgeModel(configured = process.env.JPWB_JUDGE_MODEL): string {
	return configured?.trim() || DEFAULT_JUDGE_MODEL;
}

export function judgeModel(): string {
	return resolveJudgeModel();
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
