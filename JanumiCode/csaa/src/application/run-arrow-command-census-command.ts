import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createArrowCommandCensusProgressJsonlWriter } from './arrow-command-census-progress-jsonl.js';
import {
	arrowCommandCensusReportExitCode,
	runArrowCommandCensusReport
} from './run-arrow-command-census-report.js';

export interface RunArrowCommandCensusCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runArrowCommandCensusReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runArrowCommandCensusCommand(
	request: unknown,
	options: RunArrowCommandCensusCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createArrowCommandCensusProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runArrowCommandCensusReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return arrowCommandCensusReportExitCode(outcome);
}
