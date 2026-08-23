import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createGuardClassificationOverlayProgressJsonlWriter } from './guard-classification-overlay-progress-jsonl.js';
import {
	guardClassificationOverlayReportExitCode,
	runGuardClassificationOverlayReport
} from './run-guard-classification-overlay-report.js';

export interface RunGuardClassificationOverlayCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runGuardClassificationOverlayReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runGuardClassificationOverlayCommand(
	request: unknown,
	options: RunGuardClassificationOverlayCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createGuardClassificationOverlayProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runGuardClassificationOverlayReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	try {
		const exitCode = guardClassificationOverlayReportExitCode(outcome);
		await Promise.resolve(options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`));
		return exitCode;
	} catch {
		return 4;
	}
}
