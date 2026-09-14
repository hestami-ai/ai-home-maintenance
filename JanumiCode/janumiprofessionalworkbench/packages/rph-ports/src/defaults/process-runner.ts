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
import type {
	ProcessRunOutcome,
	ProcessRunRequest,
	ProcessRunner
} from '../ports/process-runner.js';

export function createRefusingProcessRunner(): ProcessRunner {
	return {
		// ⭑ DECLARED, so `planProcessRun` and any caller assembling evidence can tell what they are holding
		// BEFORE they write "the command ran" anywhere.
		kind: 'REFUSING',
		async run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			return {
				ran: false,
				// The refusal NAMES what was not run and WHY, because a refusal a reader cannot act on is the
				// silent omission `PER-9` forbids one layer up.
				refusedBecause:
					`No process runner is wired on this host, so '${request.argv.join(' ')}' was not run in '${request.cwd}'. ` +
					`This is the library's default and it refuses on purpose: reporting exit code 0 for a command that ` +
					`never started would let a step, a test, or an assurance policy record a passing result nothing ` +
					`produced. Inject a ProcessRunner whose kind is REAL to execute commands.`
			};
		}
	};
}
