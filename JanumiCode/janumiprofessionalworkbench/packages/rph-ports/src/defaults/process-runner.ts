// SPIKE (spike/tool-execution) — the DEFAULT ProcessRunner, which refuses.
//
// ⛔⛔ THE DEFAULT CANNOT BE A NO-OP THAT SUCCEEDS, AND THIS IS THE ONE PLACE THE SPIKE WOULD NOT COMPROMISE.
// `defaults/logger.ts` may discard records because a discarded diagnostic asserts nothing. A runner that
// returned `{ ran: true, exitCode: 0, stdout: '' }` would ASSERT that a command ran and passed — and a test
// suite, an assurance policy, or a recorded step result reading that would be reading a fabrication. The
// library ships the seam, never a host's permission to execute; a host that wants a process supplies one.
//
// ⚠ AND `ran: false` IS WHY `ProcessRunOutcome` IS A UNION. Were the outcome a single shape with an optional
// error, this default would have to invent an exit code to fill the field.
import type { ProcessRunOutcome, ProcessRunRequest, ProcessRunner } from '../ports/process-runner.js';

export function createRefusingProcessRunner(): ProcessRunner {
	return {
		kind: 'REFUSING',
		async run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			return {
				ran: false,
				refusedBecause:
					`No process runner is wired on this host, so '${request.argv.join(' ')}' was not run. ` +
					`This is the library's default and it refuses on purpose: reporting exit code 0 for a command ` +
					`that never started would let a step, a test, or an assurance policy record a passing result ` +
					`nothing produced. Inject a ProcessRunner whose kind is REAL to execute commands.`
			};
		}
	};
}
