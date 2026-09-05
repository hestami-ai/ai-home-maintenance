// The de minimis floor Validator registry for this host — the deployment-time capability binding (§8.9 layer 2).
// Two deterministic Validators + a Reasoning-Review Validator (agy/Gemini in dev/prod, the deterministic structural
// mock under E2E; setting JPWB_ASSURANCE_TOOL forces a real backend and names which one). The registry is an
// in-process seam, not a persisted contract.
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
import { assuranceModel, devinPrint } from '../tools/devin-reviewer.js';

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
	// Review floor.
	// ⭑ SYMMETRIC WITH THE EXECUTOR (`execution/model.ts`): the REAL reviewer is selected when a reviewing tool
	// has been EXPLICITLY configured. That retires the `JPWB_ASSESSOR='agy'`-means-real sentinel, in which the
	// value `'agy'` had quietly stopped meaning *agy* and started meaning *not the mock* — so forcing a real
	// review while selecting Devin required writing `assessor=agy` and `assurance tool=devin` together, a
	// configuration that reads as a contradiction.
	//
	// ⛔ FAIL-CLOSED IS UNCHANGED AND IS THE POINT OF THE `opts.testMode` CONJUNCT. A mock may be selected ONLY
	// inside test mode; outside it the real Validator is the only option, because `JPWB_ASSESSOR=mock` once
	// swapped in the content-blind mock in ANY environment while the floor still recorded SATISFIED.
	const useMock = opts.testMode && !process.env.JPWB_ASSURANCE_TOOL;
	// ⭑ WHICH REAL TOOL REVIEWS IS A DIFFERENT QUESTION FROM WHETHER A REAL TOOL REVIEWS, and neither can
	// suppress the floor — the worst a tool selection can do is REFUSE. It defaults to `agy` when the real
	// path is reached without a named tool, so existing deployments are unchanged.
	const assuranceTool = (process.env.JPWB_ASSURANCE_TOOL ?? 'agy').trim();
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	registry.register(
		useMock
			? createMockReasoningReviewValidator()
			: createAgyReasoningReviewValidator({
					...(opts.artifacts ? { artifacts: opts.artifacts } : {}),
					...(opts.exchanges ? { exchanges: opts.exchanges } : {}),
					...(opts.clock ? { clock: opts.clock } : {}),
					// ⚠ AN EXPLICITLY INJECTED `print` STILL WINS. It is the seam the gate uses to exercise this
					// wiring without spawning anything, and a tool selection that overrode it would make the
					// retention assertions untestable — the reason `AgyPrint` was made injectable at all.
					...(opts.print
						? { print: opts.print }
						: assuranceTool === 'devin'
							? {
									print: devinPrint,
									agentId: 'devin',
									modelId: assuranceModel(),
									// Devin brokers many vendors, so the PROVIDER is the broker, not the model family.
									// Claiming `zhipu` for `glm-5-2` would assert a relationship this host cannot see.
									providerId: 'devin'
								}
							: {})
				})
	);
	return registry;
}

export { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
export { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
