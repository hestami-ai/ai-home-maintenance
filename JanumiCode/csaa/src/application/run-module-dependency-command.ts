import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createModuleDependencyProgressJsonlWriter } from './module-dependency-progress-jsonl.js';
import {
	moduleDependencyReportExitCode,
	runModuleDependencyReport
} from './run-module-dependency-report.js';

export interface RunModuleDependencyCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runModuleDependencyCommand(
	request: unknown,
	options: RunModuleDependencyCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createModuleDependencyProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = runModuleDependencyReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return moduleDependencyReportExitCode(outcome);
}
