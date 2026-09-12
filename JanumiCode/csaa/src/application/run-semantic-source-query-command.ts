import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createSemanticSourceQueryProgressJsonlWriter } from './semantic-source-query-progress-jsonl.js';
import {
	runSemanticSourceQueryReport,
	semanticSourceQueryReportExitCode
} from './run-semantic-source-query-report.js';

export interface RunSemanticSourceQueryCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runSemanticSourceQueryReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runSemanticSourceQueryCommand(
	request: unknown,
	options: RunSemanticSourceQueryCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createSemanticSourceQueryProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runSemanticSourceQueryReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	try {
		const exitCode = semanticSourceQueryReportExitCode(outcome);
		await Promise.resolve(options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`));
		return exitCode;
	} catch {
		return 4;
	}
}
