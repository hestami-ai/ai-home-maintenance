/**
 * Mock Replay CLI Provider — implements `RoleCLIProvider` by reading
 * previously-captured artifacts from disk instead of invoking a real CLI.
 *
 * Register one instance per real provider id you want to mock (e.g., one for
 * `claude-code`, one for `gemini-cli`, one for `codex-cli`). The instance's
 * `id` must match the id used when the artifact was captured, since the
 * artifact filename includes it.
 *
 * Replay activates only inside an `withArtifactContext` scope (i.e., when
 * `JANUMICODE_TEST_SCENARIO` is set). Outside that scope, calls throw — replay
 * mode is meaningless without context, and silent fall-through would mask
 * test bugs.
 */

import * as fs from 'node:fs';
import type { Result } from '../../lib/types';
import { CodedError } from '../../lib/types';
import type { RoleCLIProvider } from '../../lib/cli/roleCLIProvider';
import type {
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
	CLIProviderInfo,
} from '../../lib/cli/types';
import {
	getCurrentArtifactContext,
	consumeCallIndex,
} from '../../lib/diagnostics/artifactContext';
import {
	artifactPath,
	hashPrompt,
	type CapturedArtifact,
} from './artifactCapture';

export class MockReplayCLIProvider implements RoleCLIProvider {
	readonly id: string;
	readonly name: string;

	constructor(providerId: string) {
		this.id = providerId;
		this.name = `Mock Replay (${providerId})`;
	}

	async detect(): Promise<Result<CLIProviderInfo>> {
		return {
			success: true,
			value: {
				id: this.id,
				name: this.name,
				available: true,
				version: 'mock-replay',
				requiresApiKey: false,
				apiKeyConfigured: true,
			},
		};
	}

	async invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
		return this.replay(options);
	}

	async invokeStreaming(
		options: RoleCLIInvocationOptions,
		onEvent: (event: CLIActivityEvent) => void,
	): Promise<Result<RoleCLIResult>> {
		const result = this.replay(options);
		if (result.success) {
			// Emit a single synthetic text event so streaming consumers receive
			// at least one update before the final result resolves.
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'text' as CLIActivityEvent['eventType'],
				summary: '[mock-replay] full response',
				detail: result.value.response,
				status: 'success',
			});
		}
		return result;
	}

	getCommandPreview(_options: RoleCLIInvocationOptions): Result<string> {
		return { success: true, value: `[mock-replay:${this.id}]` };
	}

	private replay(options: RoleCLIInvocationOptions): Result<RoleCLIResult> {
		const ctx = getCurrentArtifactContext();
		if (!ctx) {
			return {
				success: false,
				error: new CodedError(
					'REPLAY_NO_CONTEXT',
					'MockReplayCLIProvider invoked outside an artifact context. ' +
						'Replay mode requires the orchestrator to enter withArtifactContext, ' +
						'which happens when JANUMICODE_TEST_SCENARIO is set.',
				),
			};
		}

		const callIdx = consumeCallIndex();
		if (callIdx === null) {
			return {
				success: false,
				error: new CodedError('REPLAY_NO_CALL_INDEX', 'Failed to consume callIndex'),
			};
		}

		const filePath = artifactPath(
			ctx.scenario,
			ctx.phase,
			ctx.subPhase ?? null,
			callIdx,
			this.id,
		);

		if (!fs.existsSync(filePath)) {
			return {
				success: false,
				error: new CodedError(
					'REPLAY_ARTIFACT_MISSING',
					`No captured artifact at ${filePath}. ` +
						`Run the capture pass first, or recapture if the workflow shape has changed.`,
				),
			};
		}

		let artifact: CapturedArtifact;
		try {
			artifact = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CapturedArtifact;
		} catch (err) {
			return {
				success: false,
				error: new CodedError(
					'REPLAY_ARTIFACT_PARSE_FAILED',
					`Failed to parse artifact ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
				),
			};
		}

		// Sanity check: warn (don't fail) on prompt drift so cosmetic prompt
		// edits don't break replay tests but developers see the drift.
		const expectedHash = hashPrompt(options.stdinContent);
		if (expectedHash !== artifact.promptHash) {
			 
			console.warn(
				`[mock-replay] prompt hash drift at ${filePath}\n` +
					`  expected: ${artifact.promptHash}\n` +
					`  actual:   ${expectedHash}\n` +
					`  → returning recorded response anyway. Recapture if the change is semantic.`,
			);
		}

		return { success: true, value: artifact.result };
	}
}
