// The de minimis floor Validator registry for this host — the deployment-time capability binding (§8.9 layer 2).
// Two deterministic Validators + a Reasoning-Review Validator (agy/Gemini in dev/prod, the deterministic structural
// mock under E2E; JPWB_ASSESSOR forces a backend). The registry is an in-process seam, not a persisted contract.
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	schemaInvariantValidatorInstance,
	type ValidatorRegistry
} from '@janumipwb/rph-assurance';
import { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';

export function createFloorRegistry(opts: { testMode: boolean }): ValidatorRegistry {
	const forced = process.env.JPWB_ASSESSOR;
	const useMock = forced === 'mock' || (forced !== 'agy' && opts.testMode);
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	registry.register(
		useMock ? createMockReasoningReviewValidator() : createAgyReasoningReviewValidator()
	);
	return registry;
}

export { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
export { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
