import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createCommandDispatchTopologyProgressJsonlWriter } from './command-dispatch-topology-progress-jsonl.js';
import {
	commandDispatchTopologyReportExitCode,
	runCommandDispatchTopologyReport
} from './run-command-dispatch-topology-report.js';

export interface RunCommandDispatchTopologyCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runCommandDispatchTopologyReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runCommandDispatchTopologyCommand(
	request: unknown,
	options: RunCommandDispatchTopologyCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createCommandDispatchTopologyProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runCommandDispatchTopologyReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return commandDispatchTopologyReportExitCode(outcome);
}
