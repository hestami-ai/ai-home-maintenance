import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createStateMachineGraphProgressJsonlWriter } from './state-machine-graph-progress-jsonl.js';
import {
	stateMachineGraphReportExitCode,
	runStateMachineGraphReport
} from './run-state-machine-graph-report.js';

export interface RunStateMachineGraphCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runStateMachineGraphCommand(
	request: unknown,
	options: RunStateMachineGraphCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createStateMachineGraphProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = runStateMachineGraphReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return stateMachineGraphReportExitCode(outcome);
}
