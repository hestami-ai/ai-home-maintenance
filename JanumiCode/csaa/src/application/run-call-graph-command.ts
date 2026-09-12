import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createCallGraphProgressJsonlWriter } from './call-graph-progress-jsonl.js';
import { callGraphReportExitCode, runCallGraphReport } from './run-call-graph-report.js';

export interface RunCallGraphCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runCallGraphCommand(
	request: unknown,
	options: RunCallGraphCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createCallGraphProgressJsonlWriter({ write: options.writeProgress });
	const outcome = runCallGraphReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return callGraphReportExitCode(outcome);
}
