import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createCommandHandlerGraphProgressJsonlWriter } from './command-handler-graph-progress-jsonl.js';
import {
	commandHandlerGraphReportExitCode,
	runCommandHandlerGraphReport
} from './run-command-handler-graph-report.js';

export interface RunCommandHandlerGraphCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runCommandHandlerGraphReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runCommandHandlerGraphCommand(
	request: unknown,
	options: RunCommandHandlerGraphCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createCommandHandlerGraphProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runCommandHandlerGraphReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return commandHandlerGraphReportExitCode(outcome);
}
