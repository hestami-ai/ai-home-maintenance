import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createDeclarationContextProgressJsonlWriter } from './declaration-context-progress-jsonl.js';
import {
	declarationContextReportExitCode,
	runDeclarationContextReport
} from './run-declaration-context-report.js';

export interface RunDeclarationContextCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export function runDeclarationContextCommand(
	request: unknown,
	options: RunDeclarationContextCommandOptions
): 2 | 3 | 4 {
	const progressWriter = createDeclarationContextProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = runDeclarationContextReport(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return declarationContextReportExitCode(outcome);
}
