/**
 * Artifact Context — AsyncLocalStorage propagation for test artifact capture/replay.
 *
 * This module is part of the production bundle but does nothing at runtime unless
 * a test driver enters the storage via `withArtifactContext`. The orchestrator
 * checks `process.env.JANUMICODE_TEST_SCENARIO` and only enters the context when
 * the env var is set, so production runs incur a single env-var read per cycle
 * and never allocate storage.
 *
 * Consumers:
 * - The test capture wrapper (`src/test/helpers/artifactCapture.ts`) reads the
 *   current store to know where to write captured CLI invocations.
 * - The mock replay provider (`src/test/helpers/mockReplayCLIProvider.ts`) reads
 *   the current store to look up the recorded response.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface ArtifactContext {
	/** Scenario name (e.g., 'url-shortener') — names the on-disk artifact corpus. */
	scenario: string;
	/** Dialogue ID for the conversation being driven. */
	dialogueId: string;
	/** Current workflow phase (e.g., 'INTAKE', 'ARCHITECTURE'). */
	phase: string;
	/** Optional sub-phase (e.g., 'DECOMPOSING', 'PRODUCT_REVIEW'). */
	subPhase?: string;
	/**
	 * Monotonic counter of CLI invocations within the current (phase, subPhase)
	 * scope. Reset whenever phase or subPhase changes.
	 */
	callIndex: number;
}

export const artifactContext = new AsyncLocalStorage<ArtifactContext>();

/**
 * Run `fn` with the given artifact context active. Production code paths that
 * do not enter this wrapper see an empty store and behave normally.
 */
export function withArtifactContext<T>(
	ctx: ArtifactContext,
	fn: () => Promise<T>,
): Promise<T> {
	return artifactContext.run(ctx, fn);
}

/**
 * Mutate the current store's `callIndex` (post-increment style). Returns the
 * value that was current BEFORE the bump (i.e., the index to use for the call
 * just made). No-op when there is no active store.
 */
export function consumeCallIndex(): number | null {
	const store = artifactContext.getStore();
	if (!store) { return null; }
	const idx = store.callIndex;
	store.callIndex = idx + 1;
	return idx;
}

/**
 * Update the current store's phase / subPhase and reset the call index. Used
 * by the orchestrator when the workflow advances. No-op when there is no
 * active store.
 */
export function updatePhase(phase: string, subPhase?: string): void {
	const store = artifactContext.getStore();
	if (!store) { return; }
	if (store.phase === phase && store.subPhase === subPhase) { return; }
	store.phase = phase;
	store.subPhase = subPhase;
	store.callIndex = 0;
}

/**
 * Whether artifact capture/replay is currently active for the calling async
 * scope. Helpers should check this before constructing artifact paths.
 */
export function isArtifactContextActive(): boolean {
	return artifactContext.getStore() !== undefined;
}

/**
 * Read-only snapshot of the current store, or null if none. Returned object is
 * a copy — mutating it does not affect the live store.
 */
export function getCurrentArtifactContext(): Readonly<ArtifactContext> | null {
	const store = artifactContext.getStore();
	return store ? { ...store } : null;
}
