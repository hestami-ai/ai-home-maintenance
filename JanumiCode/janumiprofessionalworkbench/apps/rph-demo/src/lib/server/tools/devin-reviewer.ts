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
import type { ToolInvocationResult } from './backing-tool.js';

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
export async function devinPrint(prompt: string): Promise<string | ToolInvocationResult> {
	// ⚠ RESOLVED BEFORE THE DIRECTORY EXISTS. `assuranceModel()` REFUSES when unconfigured (`REG-F-331`), and
	// my first version of this line put it after `mkdtemp` and outside the `try` — so an unconfigured host
	// would leak a temp directory on every refusal. Resolving first means the refusal happens before anything
	// is created, and it reaches the caller unwrapped rather than dressed as "devin invocation failed".
	const configured = assuranceModel();
	const dir = await mkdtemp(join(tmpdir(), 'jpwb-devin-'));
	const promptPath = join(dir, 'prompt.txt');
	const exportPath = join(dir, 'export.json');
	try {
		await writeFile(promptPath, prompt, 'utf8');
		const { stdout } = await run(
			DEVIN_BIN,
			['--print', '--model', configured, '--prompt-file', promptPath, '--export', exportPath],
			{ timeout: 240_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
		);
		// ⭑⭑ THE READ HAPPENS HERE, AND THE PLACEMENT IS THE WHOLE FIX. `readReportedModel` was written with
		// `devinPrint` and could never be called by anyone: the `finally` below deletes `dir` before this
		// function returns, so the export it reads is gone by the time any caller holds the answer. It was not
		// an unused export — it was a function whose only possible caller was its own enclosing function.
		const reported = await readReportedModel(exportPath);
		// ⛔ NO REPORT MEANS THE WEAKER GRADE, NOT THE CONFIGURED VALUE DRESSED UP. An unreadable export is an
		// absence of evidence about the model; returning the bare string lets the caller record what the HOST
		// configured, graded `HOST_CONFIGURED`, which is the honest fact.
		if (!reported) return stdout;
		return {
			answerText: stdout,
			rawOutput: stdout,
			producer: {
				agentId: 'devin',
				modelId: reported,
				// Devin brokers many vendors, so the PROVIDER is the broker. Claiming `zhipu` for `glm-5-2`
				// would assert a relationship this host cannot see — the same reasoning `assurance/index.ts`
				// already records for the configured path.
				providerId: 'devin'
			},
			// ⭑ THE GRADE IS EARNED BY THE READ ABOVE, not by the tool's entry in `BACKING_TOOLS`. A catalog
			// declaration says what a tool CAN report; this says what it DID.
			identityEvidence: 'PROVIDER_REPORTED',
			// ⭐ R11 — `--print` IS A ONE-SHOT ANSWER, AND THAT IS THE WHOLE REASON. This adapter runs devin to
			// completion and reads its stdout plus an ATIF export; it mints no tool surface of its own and
			// watches no session, so anything devin did internally is devin's business and invisible here.
			// ⛔ Saying NONE_OBSERVED would claim this adapter looked. It did not look.
			observedToolCalls: {
				canObserve: false,
				reason:
					'The devin adapter runs `devin --print` to completion and reads its stdout and ATIF export. It ' +
					'mints no tool surface and watches no session, so it is not in a position to observe tool ' +
					'calls at all — neither its own (it has none) nor any the tool made internally. A reader must ' +
					'not read this record as evidence that no command ran.'
			}
		};
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
