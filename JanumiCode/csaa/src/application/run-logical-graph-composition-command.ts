import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createLogicalGraphCompositionProgressJsonlWriter } from './logical-graph-composition-progress-jsonl.js';
import {
	logicalGraphCompositionReportExitCode,
	runLogicalGraphCompositionReport
} from './run-logical-graph-composition-report.js';

export interface RunLogicalGraphCompositionCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runLogicalGraphCompositionReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runLogicalGraphCompositionCommand(
	request: unknown,
	options: RunLogicalGraphCompositionCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createLogicalGraphCompositionProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runLogicalGraphCompositionReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	try {
		const exitCode = logicalGraphCompositionReportExitCode(outcome);
		await Promise.resolve(options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`));
		return exitCode;
	} catch {
		return 4;
	}
}
