// The de minimis floor Validator registry for this host — the deployment-time capability binding (§8.9 layer 2).
// Two deterministic Validators + a Reasoning-Review Validator (agy/Gemini in dev/prod, the deterministic structural
// mock under E2E; JPWB_ASSESSOR forces a backend). The registry is an in-process seam, not a persisted contract.
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	schemaInvariantValidatorInstance,
	type ValidatorRegistry
} from '@janumipwb/rph-assurance';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { ExchangeSink } from './exchange-capture.js';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';

export function createFloorRegistry(opts: {
	testMode: boolean;
	/** MXR-05: where the retained bytes go, and where the per-try records are collected.
	 *  ⚠ BOTH OR NEITHER. `captureTry` refuses a store supplied without a sink, because bytes retained with no
	 *  record referencing them are the orphan REG-F-336 C-2 forbids. */
	artifacts?: ArtifactStore;
	exchanges?: ExchangeSink;
	/**
	 * The model call, injectable.
	 *
	 * ⭑ WITHOUT THIS SEAM THE WIRING ABOVE IS UNTESTABLE. In test mode the registry builds the deterministic
	 * MOCK reviewer, which never captures anything, so an end-to-end assertion here would observe zero
	 * exchange records and prove nothing. The only alternative is spawning a real `agy`, which means the
	 * regression that silently unwires retention would never redden a gate. This is the same reasoning that
	 * justified `AgyExec` in `REG-F-333`.
	 */
	print?: AgyPrint;
	clock?: () => string;
}): ValidatorRegistry {
	// Fail closed (§8.4): no local instruction, env var, or planner optimization may suppress the Reasoning
	// Review floor. JPWB_ASSESSOR selects a backend only INSIDE test mode — outside it the real Validator is the
	// only option. Previously `JPWB_ASSESSOR=mock` swapped in the content-blind mock in ANY environment while the
	// floor still recorded SATISFIED.
	const forced = opts.testMode ? process.env.JPWB_ASSESSOR : undefined;
	const useMock = opts.testMode && forced !== 'agy';
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	registry.register(
		useMock
			? createMockReasoningReviewValidator()
			: createAgyReasoningReviewValidator({
					...(opts.artifacts ? { artifacts: opts.artifacts } : {}),
					...(opts.exchanges ? { exchanges: opts.exchanges } : {}),
					...(opts.print ? { print: opts.print } : {}),
					...(opts.clock ? { clock: opts.clock } : {})
				})
	);
	return registry;
}

export { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
export { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
