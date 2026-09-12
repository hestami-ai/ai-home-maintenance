import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createCommandEventContractOverlayProgressJsonlWriter } from './command-event-contract-overlay-progress-jsonl.js';
import {
	commandEventContractOverlayReportExitCode,
	runCommandEventContractOverlayReport
} from './run-command-event-contract-overlay-report.js';

export interface RunCommandEventContractOverlayCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runCommandEventContractOverlayReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runCommandEventContractOverlayCommand(
	request: unknown,
	options: RunCommandEventContractOverlayCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createCommandEventContractOverlayProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runCommandEventContractOverlayReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	try {
		const exitCode = commandEventContractOverlayReportExitCode(outcome);
		await Promise.resolve(options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`));
		return exitCode;
	} catch {
		return 4;
	}
}
