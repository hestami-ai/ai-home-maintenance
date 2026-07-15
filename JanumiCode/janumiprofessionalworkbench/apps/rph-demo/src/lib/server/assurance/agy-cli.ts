// Shared plain `agy --print` invocation (Google Antigravity / Gemini) + defensive JSON extraction. Matches the
// authorized invocation pattern — a pure-reasoning call, no tools/workspace, no permission bypass.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGY_BIN = process.env.JPWB_AGY_BIN ?? 'agy';

/**
 * The judge model, PINNED. §8.4 requires the evaluator's "actual identities and lineage are recorded", and §14.6
 * requires recording "allowed and resolved provider/model/version". Unpinned, agy selects its own model and never
 * tells us which — so the recorded evaluator identity was the literal `'agy:default'`, which is not the name of
 * any model. That is not a weak record; it is a false one, and it made the floor's independence comparison a
 * string test against a placeholder that no real model id can ever equal.
 *
 * Fail closed rather than record a fiction (§13.3: "Fail closed on missing identity, tenant, policy, schema, or
 * authority context"). §8.4 is explicit that an independence-invalid review "cannot satisfy assurance or permit
 * its protected transition" — so refusing to run is the correct outcome, not a degradation.
 */
export function judgeModel(): string {
	const pinned = process.env.JPWB_JUDGE_MODEL;
	if (!pinned) {
		throw new Error(
			'JPWB_JUDGE_MODEL is required. The Reasoning Review evaluator’s model must be pinned so its actual identity can be recorded (§8.4, §14.6); unpinned, agy chooses its own model and the recorded evaluator identity would be a placeholder rather than the model that actually judged. Set JPWB_JUDGE_MODEL to the agy model id.'
		);
	}
	return pinned;
}

/** One non-interactive `agy --print "<prompt>"` call, returning stdout. Always pins the model, so the model that
 *  actually judged is the model recorded. */
export async function agyPrint(prompt: string): Promise<string> {
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
