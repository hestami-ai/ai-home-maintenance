// JAN-TOOLSUITE TS-07 — the Devin ASSURANCE adapter: the tool that reviews a work product.
//
// ⭑ IT EXISTS SO THE REVIEWER CAN BE A DIFFERENT VENDOR FROM THE PRODUCER. With one tool serving both roles,
// `checkIndependence('DIFFERENT_MODEL', …)` compared a string with itself and could only refuse — the state
// `REG-F-356` recorded. Producer on Pi (`openai-codex`) and reviewer on Devin (`glm-5-2`) differ on RECORDED
// evidence, which is the first time that has been true on this path.
//
// ⚠ EVERY FLAG BELOW WAS MEASURED BY DRIVING `devin 3000.6.14`, not read from documentation.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';

const run = promisify(execFile);

const DEVIN_BIN = process.env.JPWB_DEVIN_BIN ?? 'devin';

/**
 * The reviewing model. ⛔ Configured, never pinned (`REG-D-052`); absence is a refusal (`REG-F-331`).
 */
export function resolveAssuranceModel(
	configured = process.env.JPWB_ASSURANCE_MODEL
): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

export function assuranceModel(): string {
	const model = resolveAssuranceModel();
	if (!model)
		throw new Error(
			'JPWB_ASSURANCE_MODEL is not set, and there is no application default: the reviewing model is ' +
				'selected on assurance-quality grounds and must be configured explicitly (REG-D-052). ' +
				'Run `devin models list` to see what this account offers. ' +
				'⚠ It must differ from JPWB_EXECUTOR_MODEL, or the reasoning review is refused for ' +
				'non-independence (ASR-13) — which is the check working, not a fault.'
		);
	return model;
}

/**
 * One non-interactive Devin call, returning stdout.
 *
 * ⭑ THE PROMPT GOES IN A FILE, NOT IN ARGV, and that is the whole reason this adapter is simpler than `agy`'s.
 * `agyPrint` must DESTROY its failure diagnostic because `execFile` rejects with `Command failed: <full argv>`
 * and agy's argv carries the entire prompt — a string that would otherwise be written verbatim into a projected
 * `VALIDATOR_EXECUTION_FAILED` observation (finding #60). With `--prompt-file` the argv holds a path, so the
 * diagnostic is safe to retain and there is no command-line length ceiling to budget against either.
 *
 * ⛔ AND SAFETY IS STILL MEASURED, NOT ASSUMED. The catch below CHECKS the outgoing diagnostic for the prompt
 * rather than trusting the `PROMPT_FREE` declaration. A declaration that is wrong then fails safe, which is the
 * difference between a claim and a control.
 *
 * ⚠ NO `--respect-workspace-trust false`. Print mode fails in an untrusted directory and that flag is a trust
 * BYPASS. It proved unnecessary — the probe succeeded without it — so an untrusted-directory failure surfaces
 * as a refusal to be fixed by trusting the directory, never by disabling the check.
 */
export async function devinPrint(prompt: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'jpwb-devin-'));
	const promptPath = join(dir, 'prompt.txt');
	const exportPath = join(dir, 'export.json');
	try {
		await writeFile(promptPath, prompt, 'utf8');
		const { stdout } = await run(
			DEVIN_BIN,
			['--print', '--model', assuranceModel(), '--prompt-file', promptPath, '--export', exportPath],
			{ timeout: 240_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
		);
		return stdout;
	} catch (e) {
		const raw = e instanceof Error ? e.message : String(e);
		// ⭑ THE MEASUREMENT. If the prompt somehow reached the diagnostic anyway, withhold it — PER-12 forbids
		// projecting it and this codebase has no redaction. Otherwise the diagnostic is genuinely useful and
		// destroying it would repeat agy's disclosed loss for no reason.
		throw new Error(
			diagnosticCarriesPrompt(raw, prompt)
				? 'devin invocation failed. Its diagnostic is WITHHELD: it was measured to contain the prompt, ' +
					'which may not reach the record plane (PER-12), and no redaction exists here.'
				: `devin invocation failed: ${raw}`
		);
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	}
}

/**
 * The model Devin ACTUALLY ran, read back from its ATIF export.
 *
 * ⭑ THIS IS WHY DEVIN GRADES `PROVIDER_REPORTED`. The export carries `agent.model_name` and, per step,
 * `extra.generation_model` — the exact id (`"glm-5-2"`). Reading it back means the record states the model that
 * answered rather than the model we asked for, and those can differ.
 */
export async function readReportedModel(exportPath: string): Promise<string | undefined> {
	try {
		const parsed = JSON.parse(await readFile(exportPath, 'utf8')) as {
			steps?: Array<{ extra?: { generation_model?: unknown } }>;
		};
		const reported = parsed.steps
			?.map((s) => s.extra?.generation_model)
			.filter((m): m is string => typeof m === 'string' && m.length > 0)
			.at(-1);
		return reported;
	} catch {
		// ⚠ An unreadable export is an ABSENCE OF EVIDENCE about the model, not evidence of a different one.
		// Returning undefined lets the caller fall back to HOST_CONFIGURED, which is the honest weaker grade.
		return undefined;
	}
}
