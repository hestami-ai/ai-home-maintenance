import { canonicalSemanticJson } from '../semantic/canonical.js';
import { createGuardEnforcementLedgerProgressJsonlWriter } from './guard-enforcement-ledger-progress-jsonl.js';
import {
	guardEnforcementLedgerReportExitCode,
	runGuardEnforcementLedgerReport
} from './run-guard-enforcement-ledger-report.js';

export interface RunGuardEnforcementLedgerCommandOptions {
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
	/** @internal Portable command-test seam; the executable never supplies it. */
	readonly runReport?: typeof runGuardEnforcementLedgerReport;
	readonly writeProgress: (line: string) => unknown;
	readonly writeTerminal: (line: string) => unknown;
}

/** Parsed-request adapter shared by the executable and portable command tests. */
export async function runGuardEnforcementLedgerCommand(
	request: unknown,
	options: RunGuardEnforcementLedgerCommandOptions
): Promise<2 | 3 | 4> {
	const progressWriter = createGuardEnforcementLedgerProgressJsonlWriter({
		write: options.writeProgress
	});
	const outcome = await (options.runReport ?? runGuardEnforcementLedgerReport)(request, {
		onProgress: (event) => progressWriter.emit(event),
		repositoryRoot: options.repositoryRoot
	});
	options.writeTerminal(`${canonicalSemanticJson(outcome)}\n`);
	return guardEnforcementLedgerReportExitCode(outcome);
}
