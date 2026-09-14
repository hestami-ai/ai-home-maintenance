// SPIKE (spike/tool-execution) — the capability-to-tool translation. ⭑ THIS IS THE SEAM THE SPIKE EXISTS FOR.
//
// ── ⛔ GRANT NOTHING THAT WAS NOT GRANTED, AND THE MECHANISM IS ABSENCE, NOT REFUSAL ─────────────────────────
// An ungranted tool is NOT minted. The model is never told it exists, so there is no call to intercept and no
// refusal path to get wrong. `pi-agent.ts` already proves the shape works with `noTools: 'builtin'`: the tool
// list IS the privilege boundary. A capability check inside a tool that was handed to the model anyway is a
// weaker arrangement — it depends on the check, and it advertises the privilege.
//
// ── ⭑ THE PREDICATE IS THE KERNEL'S, NOT A SECOND ONE WRITTEN HERE ──────────────────────────────────────────
// `capabilityAuthorized` (rph-domain) is EXACT MEMBERSHIP — `granted.includes(required)`. Using it means this
// gate and `stepCapabilityRefusal` cannot drift apart, and a granted `file` does not authorize `file-system`.
//
// ── ⚠ ONE CAPABILITY NAME IS ADOPTED AND ONE IS COINED, AND THE DIFFERENCE IS DISCLOSED ──────────────────────
//   · `file-system` — ADOPTED. RPH-EXE-004 (ratified, `m12-conformance.json`) names it verbatim: *"a binding
//     requests file-system and network access but only file-system is granted"*.
//   · `process-execution` — ⛔ COINED BY THIS SPIKE, AND IT IS NOT RATIFIED. The corpus names no capability for
//     running a process. `CapabilityRequest.capability` is `z.string()` with no enum, and `RuntimeBinding
//     .sandboxPolicy` — where a runtime BOUND would belong — is recorded DEFERRED TO THE PLATFORM POLICY PLANE
//     (`m1-object-fields.json`). So this name is a spike placeholder that a ruling must settle; it is NOT
//     inferable from the corpus, and reusing `file-system` for it would be worse, because starting a process is
//     a strictly larger privilege than writing a file and collapsing them makes the grant unable to say so.
import { capabilityAuthorized } from '@janumipwb/rph-domain';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';
import type { ParamSpec, ToolRunResult } from '../agent/types.js';

/** Writing into the work unit's workspace. ADOPTED from RPH-EXE-004. */
export const CAP_FILE_SYSTEM = 'file-system';
/** Starting a process in it. ⛔ COINED BY THIS SPIKE — see the header. */
export const CAP_PROCESS_EXECUTION = 'process-execution';

/**
 * An execution-side tool.
 *
 * ⚠ `run` IS ASYNC, AND `AuthoringToolDescriptor.run` IS NOT. That is a real difference rather than a
 * preference: spawning a process and awaiting its exit cannot be expressed synchronously, so the authoring
 * descriptor could not carry these tools without being widened. Kept as its own type for the spike so the
 * authoring seam and its tests are untouched — see the report.
 */
export interface ExecutionToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly parameters: ParamSpec;
	/** The capability that had to be granted for this tool to exist at all. */
	readonly requiresCapability: string;
	run(args: Record<string, unknown>): Promise<ToolRunResult>;
}

export interface SandboxToolInput {
	/** The capabilities the binding CURRENTLY grants, read from the store — never the request. */
	readonly granted: readonly string[];
	readonly workspace: Workspace;
	readonly runner: ProcessRunner;
	/** ⛔ THE HOST'S BOUND, NOT THE MODEL'S. A model that could choose its own timeout could choose none. */
	readonly commandTimeoutMs: number;
}

/** What was minted, and — just as importantly — what was withheld and why. */
export interface SandboxToolGrant {
	readonly tools: readonly ExecutionToolDescriptor[];
	readonly withheld: readonly { readonly tool: string; readonly because: string }[];
}

const WRITE_FILE_PARAMS: ParamSpec = {
	path: { type: 'string', description: 'Path relative to the workspace root.', required: true },
	contents: { type: 'string', description: 'The UTF-8 text to write.', required: true }
};

const RUN_COMMAND_PARAMS: ParamSpec = {
	argv: {
		type: 'string[]',
		description: 'The program followed by its arguments. No shell is used, so shell syntax will not work.',
		required: true
	}
};

/**
 * Mint the tools this step's grant authorizes — and only those.
 *
 * ⭑ THE WITHHELD LIST IS RETURNED, NOT LOGGED. A step's record should be able to say WHICH privilege it did
 * not have; discovering that from the absence of a tool call is an inference, and `PER-9` is explicit that
 * record-plane omission is not legal.
 */
export function grantedSandboxTools(input: SandboxToolInput): SandboxToolGrant {
	const tools: ExecutionToolDescriptor[] = [];
	const withheld: { tool: string; because: string }[] = [];

	const authorized = (capability: string, toolName: string): boolean => {
		const verdict = capabilityAuthorized({
			grantedCapabilities: input.granted,
			requiredCapability: capability
		});
		if (verdict.ok) return true;
		withheld.push({
			tool: toolName,
			because:
				`the runtime binding does not grant '${capability}' (${verdict.errorCode}: ${verdict.reason}), ` +
				`so the tool was not offered to the model at all. §22.1: requested capability is not granted capability.`
		});
		return false;
	};

	if (authorized(CAP_FILE_SYSTEM, 'write_file'))
		tools.push({
			name: 'write_file',
			description:
				"Write a UTF-8 text file into this work unit's workspace. The path is relative to the workspace root; paths that escape it are refused.",
			parameters: WRITE_FILE_PARAMS,
			requiresCapability: CAP_FILE_SYSTEM,
			run: async (args) => {
				const path = String(args.path ?? '');
				const contents = String(args.contents ?? '');
				const outcome = await input.workspace.writeFile(path, contents);
				if (!outcome.written) return { ok: false, summary: outcome.refusedBecause };
				return {
					ok: true,
					summary: `Wrote ${outcome.byteSize} bytes to ${outcome.path}.`,
					data: { path: outcome.path, byteSize: outcome.byteSize }
				};
			}
		});

	if (authorized(CAP_PROCESS_EXECUTION, 'run_command'))
		tools.push({
			name: 'run_command',
			description:
				"Run a command inside this work unit's workspace and return its exit code, stdout and stderr. No shell is used: give the program and its arguments as separate entries.",
			parameters: RUN_COMMAND_PARAMS,
			requiresCapability: CAP_PROCESS_EXECUTION,
			run: async (args) => {
				const argv = Array.isArray(args.argv) ? args.argv.map((a) => String(a)) : [];
				// ⛔ THE WORKSPACE MUST BE REAL. An in-memory workspace has no directory, and a runner given some
				// other cwd would execute OUTSIDE the sandbox — the one failure this seam must never have. It is
				// checked here rather than trusted, because `materialization` is exactly the fact that decides it.
				const cwd = input.workspace.directoryPath;
				if (input.workspace.materialization !== 'FILESYSTEM' || cwd === undefined)
					return {
						ok: false,
						summary:
							`This work unit's workspace is ${input.workspace.materialization} and has no directory on disk, ` +
							`so there is nowhere to run a command. Nothing was run. (A host that wires a real process ` +
							`runner must also wire a FILESYSTEM workspace; running in any other directory would put the ` +
							`command outside the sandbox.)`
					};
				const outcome = await input.runner.run({ argv, cwd, timeoutMs: input.commandTimeoutMs });
				if (!outcome.ran) return { ok: false, summary: outcome.refusedBecause };
				const head = outcome.timedOut
					? `The command was killed after ${input.commandTimeoutMs}ms.`
					: `exitCode=${outcome.exitCode}`;
				return {
					// ⚠ `ok` REPORTS WHETHER THE TOOL WORKED, NOT WHETHER THE COMMAND PASSED. A failing test suite
					// is a successful tool call returning exit code 1, and the model must be able to read that as a
					// result to act on rather than as a broken tool.
					ok: true,
					summary: `${head} (${outcome.durationMs}ms)\nstdout:\n${outcome.stdout}\nstderr:\n${outcome.stderr}`,
					data: {
						exitCode: outcome.exitCode,
						timedOut: outcome.timedOut,
						durationMs: outcome.durationMs,
						stdout: outcome.stdout,
						stderr: outcome.stderr
					}
				};
			}
		});

	return { tools, withheld };
}
