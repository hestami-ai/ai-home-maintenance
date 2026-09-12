import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createReadWriteAccessProgressJsonlWriter } from './read-write-access-progress-jsonl.js';
import {
	readWriteAccessReportExitCode,
	runReadWriteAccessReport
} from './run-read-write-access-report.js';

export interface RunReadWriteAccessCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runReadWriteAccessCommand(
	request: unknown,
	options: RunReadWriteAccessCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createReadWriteAccessProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = runReadWriteAccessReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return readWriteAccessReportExitCode(outcome);
}
