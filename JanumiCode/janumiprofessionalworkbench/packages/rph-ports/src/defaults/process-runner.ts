// The DEFAULT ProcessRunner, which REFUSES.
//
// ⛔⛔ THE DEFAULT CANNOT BE A NO-OP THAT SUCCEEDS, AND THIS IS THE ONE PLACE THE SEAM MAKES NO COMPROMISE.
// `defaults/logger.ts` may discard records, because a discarded diagnostic asserts nothing. A runner returning
// `{ ran: true, exitCode: 0, stdout: '' }` would ASSERT that a command ran and passed — and a test result, an
// assurance policy, or a recorded step outcome reading that would be reading a fabrication indistinguishable
// from the real thing. The library ships the SEAM, never a host's permission to execute.
//
// ⭑ AND IT IS STRUCTURALLY UNABLE TO INVENT ONE. The refusing arm of `ProcessRunOutcome` carries no `exitCode`
// field at all, so this default could not report a passing command even by mistake — which is a stronger
// guarantee than remembering not to. That is the whole argument for the union, made concrete in the one
// implementation that would otherwise have to fill the field.
import {
	programFileName,
	workspaceDirectoryName,
	type ProcessRunOutcome,
	type ProcessRunRequest,
	type ProcessRunner
} from '../ports/process-runner.js';

export function createRefusingProcessRunner(): ProcessRunner {
	return {
		// ⭑ DECLARED, so `planProcessRun` and any caller assembling evidence can tell what they are holding
		// BEFORE they write "the command ran" anywhere.
		kind: 'REFUSING',
		async run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			// ⛔ THE WORKSPACE'S DIRECTORY NAME, NEVER THE HOST'S ABSOLUTE PATH. `cwd` is the workspace's own
			// `directoryPath`, and this refusal is a `refusedBecause` — which the port defines as "a fact a step
			// can record", i.e. a string that travels into a governed record and into a model's context. The
			// host's filesystem layout belongs in neither. `filesystem-workspace.ts` states the same rule for its
			// own wrapped errors ("the message carries the host's absolute path, which belongs in nothing a step
			// records") and this was the one other place in the seam that was still leaking one.
			// ⭑ THE DERIVATION MOVED TO THE PORT IN PHASE 2b, and the move is the point: this rule was stated in
			// one implementation, and Phase 2b adds the second one. An invariant that makes the seam lawful
			// belongs with the interface, so the other adapter cannot quietly implement a weaker one.
			const workspaceDirectory = workspaceDirectoryName(request.cwd);
			// ⛔⛔ THE PROGRAM'S FILE NAME, NEVER THE ARGV — AND THIS ADAPTER WAS STILL LEAKING IT AFTER THE OTHER
			// ONE WAS FIXED, WHICH IS THE DEFECT THIS REPOSITORY FILES MOST OFTEN: A RULE STATED GENERALLY AND
			// IMPLEMENTED ONCE. Phase 2b's adversarial pass drove `B5` through `child-process-runner.ts` — an
			// absolute program path put *"'C:\Program Files\nodejs\nope-missing.exe --flag'"*, and under bun the
			// operating user's name, into a `refusedBecause` the port defines as travelling into a governed record
			// AND a model's context. The brief named that adapter. THIS one had the identical interpolation, and
			// the comment three lines below had already recorded the identical lesson about the `cwd` without
			// anyone applying it to the ARGV standing beside it.
			// ⭑ `programFileName` IS THE PORT'S ANSWER, exported for exactly the reason `workspaceDirectoryName`
			// is: an invariant that makes the seam lawful belongs with the interface, so neither adapter can
			// quietly implement a weaker one. ⚠ AND AN EMPTY ARGV NAMES NO PROGRAM RATHER THAN AN EMPTY ONE —
			// `RULE 6`, NO DEFAULT THAT FABRICATES, at the one place a fallback would have put `''` into a record
			// as though it were a command's name.
			const program = request.argv[0] ?? '';
			const named = program === '' ? 'no command' : `'${programFileName(program)}'`;
			return {
				ran: false,
				// The refusal NAMES what was not run and WHY, because a refusal a reader cannot act on is the
				// silent omission `PER-9` forbids one layer up.
				refusedBecause:
					`No process runner is wired on this host, so ${named} was not run in the ` +
					`workspace directory '${workspaceDirectory}'. This is the library's default and it refuses on ` +
					`purpose: reporting exit code 0 for a command that never started would let a step, a test, or an ` +
					`assurance policy record a passing result nothing produced. Inject a ProcessRunner whose kind is ` +
					`REAL to execute commands.`
			};
		}
	};
}
