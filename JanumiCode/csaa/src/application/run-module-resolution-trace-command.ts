import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createModuleResolutionTraceProgressJsonlWriter } from './module-resolution-trace-progress-jsonl.js';
import {
	moduleResolutionTraceReportExitCode,
	runModuleResolutionTraceReport
} from './run-module-resolution-trace-report.js';

export interface RunModuleResolutionTraceCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runModuleResolutionTraceCommand(
	request: unknown,
	options: RunModuleResolutionTraceCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createModuleResolutionTraceProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = runModuleResolutionTraceReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return moduleResolutionTraceReportExitCode(outcome);
}
