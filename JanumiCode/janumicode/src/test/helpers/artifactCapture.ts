/**
 * Artifact Capture Wrapper — decorates a real RoleCLIProvider so every
 * invocation is recorded to disk under `test-output/artifacts/<scenario>/`.
 *
 * The wrapper is invoked by `WorkflowTestDriver` when `mode: 'real-capture'`
 * is set. It reads the active artifact context (set by `dialogueOrchestrator`
 * via `withArtifactContext`) to determine where to write each artifact.
 *
 * Output filename: `<phase>--<subPhase>--<callIdx>--<providerId>.json`
 * Each file is a `CapturedArtifact` (see below).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { Result } from '../../lib/types';
import type { RoleCLIProvider } from '../../lib/cli/roleCLIProvider';
import type {
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
} from '../../lib/cli/types';
import {
	getCurrentArtifactContext,
	consumeCallIndex,
} from '../../lib/diagnostics/artifactContext';
import { scenarioArtifactDir } from './scenarioCheckpoint';

export interface CapturedArtifact {
	scenario: string;
	phase: string;
	subPhase: string | null;
	callIndex: number;
	providerId: string;
	promptHash: string;
	promptPreview: string;
	requestOptionsRedacted: Omit<RoleCLIInvocationOptions, 'stdinContent' | 'signal'> & {
		stdinContentLength: number;
	};
	result: RoleCLIResult;
	capturedAt: string;
}

/** Build the artifact filename for a given (phase, subPhase, callIdx, providerId). */
export function artifactFilename(
	phase: string,
	subPhase: string | null,
	callIndex: number,
	providerId: string,
): string {
	const safe = (s: string) => s.replaceAll(/[^A-Za-z0-9_-]/g, '_');
	const sp = subPhase ? safe(subPhase) : 'NONE';
	const idx = String(callIndex).padStart(3, '0');
	return `${safe(phase)}--${sp}--${idx}--${safe(providerId)}.json`;
}

export function artifactPath(
	scenario: string,
	phase: string,
	subPhase: string | null,
	callIndex: number,
	providerId: string,
): string {
	return path.join(
		scenarioArtifactDir(scenario),
		artifactFilename(phase, subPhase, callIndex, providerId),
	);
}

/** SHA-256 hex digest of a UTF-8 string. Used as the prompt sanity check. */
export function hashPrompt(content: string): string {
	return createHash('sha256').update(content, 'utf8').digest('hex');
}

function redactOptions(opts: RoleCLIInvocationOptions): CapturedArtifact['requestOptionsRedacted'] {
	const { stdinContent, signal: _signal, ...rest } = opts;
	return {
		...rest,
		stdinContentLength: stdinContent.length,
	};
}

function writeArtifact(filePath: string, artifact: CapturedArtifact): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf8');
}

/**
 * Wrap a real `RoleCLIProvider` so every successful `invoke`/`invokeStreaming`
 * call is persisted as an artifact JSON file. When no artifact context is
 * active (i.e., not running inside `withArtifactContext`), the wrapper is a
 * pass-through and writes nothing.
 */
export function wrapProviderForCapture(real: RoleCLIProvider): RoleCLIProvider {
	const captureSuccess = (
		options: RoleCLIInvocationOptions,
		result: Result<RoleCLIResult>,
	): void => {
		if (!result.success) { return; }
		const ctx = getCurrentArtifactContext();
		if (!ctx) { return; }
		const callIdx = consumeCallIndex();
		if (callIdx === null) { return; }
		const filePath = artifactPath(
			ctx.scenario,
			ctx.phase,
			ctx.subPhase ?? null,
			callIdx,
			real.id,
		);
		const artifact: CapturedArtifact = {
			scenario: ctx.scenario,
			phase: ctx.phase,
			subPhase: ctx.subPhase ?? null,
			callIndex: callIdx,
			providerId: real.id,
			promptHash: hashPrompt(options.stdinContent),
			promptPreview: options.stdinContent.slice(0, 500),
			requestOptionsRedacted: redactOptions(options),
			result: result.value,
			capturedAt: new Date().toISOString(),
		};
		try {
			writeArtifact(filePath, artifact);
		} catch (err) {
			// Don't let artifact write failures break the test run.
			 
			console.warn(`[artifactCapture] failed to write ${filePath}:`, err);
		}
	};

	return {
		id: real.id,
		name: real.name,
		detect: () => real.detect(),
		getCommandPreview: (options) => real.getCommandPreview(options),
		invoke: async (options) => {
			const result = await real.invoke(options);
			captureSuccess(options, result);
			return result;
		},
		invokeStreaming: async (
			options: RoleCLIInvocationOptions,
			onEvent: (event: CLIActivityEvent) => void,
		) => {
			const result = await real.invokeStreaming(options, onEvent);
			captureSuccess(options, result);
			return result;
		},
	};
}
