// SPIKE (spike/tool-execution) — ProcessRunner port: running a command on behalf of an execution step.
//
// ⭑ THE OUTCOME IS A UNION, NOT A RESULT WITH AN ERROR FIELD, AND THAT IS THE WHOLE POINT. `exitCode: 0` from
// a runner that did not run anything is indistinguishable, downstream, from a command that ran and succeeded —
// which is precisely the fabricated-capability defect this repository keeps recording. A runner that will not
// run says `ran: false` and gives a reason, and nothing can read an exit code off it.
//
// ⚠ `timedOut` IS SEPARATE FROM `exitCode`, because §36.2 has a `TIMEOUT` failure class distinct from
// `TOOL_FAILURE`, and a killed process's exit code on Windows is not reliably distinguishable from a program
// that chose to exit non-zero. The runner observed the kill; the caller must not have to infer it.

export interface ProcessRunRequest {
	/** Program plus arguments. ⛔ NOT A SHELL STRING — no shell is involved, so no quoting rules apply. */
	readonly argv: readonly string[];
	/** ⛔ ABSOLUTE, and the host must have derived it from a `Workspace.directoryPath`. */
	readonly cwd: string;
	readonly timeoutMs: number;
}

export type ProcessRunOutcome =
	| {
			readonly ran: true;
			/** `null` when the process was terminated by a signal rather than exiting. */
			readonly exitCode: number | null;
			readonly timedOut: boolean;
			readonly stdout: string;
			readonly stderr: string;
			readonly durationMs: number;
	  }
	| { readonly ran: false; readonly refusedBecause: string };

export interface ProcessRunner {
	/**
	 * Whether this runner can actually start a process.
	 *
	 * ⭑ DECLARED, MIRRORING `ArtifactStore.durability`. A caller assembling a step's evidence is entitled to
	 * know it was talking to the refusing default before it writes "the command ran" anywhere.
	 */
	readonly kind: 'REAL' | 'REFUSING';
	run(request: ProcessRunRequest): Promise<ProcessRunOutcome>;
}
