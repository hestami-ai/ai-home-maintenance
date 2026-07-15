// Shared plain `agy --print` invocation (Google Antigravity / Gemini) + defensive JSON extraction. Matches the
// authorized invocation pattern — a pure-reasoning call, no tools/workspace, no permission bypass.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGY_BIN = process.env.JPWB_AGY_BIN ?? 'agy';
const JUDGE_MODEL = process.env.JPWB_JUDGE_MODEL; // optional pin; omit → agy default
export const AGY_MODEL_LABEL = JUDGE_MODEL ?? 'agy:default';

/** One non-interactive `agy --print "<prompt>"` call, returning stdout. */
export async function agyPrint(prompt: string): Promise<string> {
	const args = [
		'--print',
		prompt,
		'--print-timeout',
		'3m',
		...(JUDGE_MODEL ? ['--model', JUDGE_MODEL] : [])
	];
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
