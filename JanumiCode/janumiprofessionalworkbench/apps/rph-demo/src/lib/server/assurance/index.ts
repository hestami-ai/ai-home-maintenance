// The de minimis floor Validator registry for this host — the deployment-time capability binding (§8.9 layer 2).
// Two deterministic Validators + a Reasoning-Review Validator: the reviewer `reviewer-selection.ts` selects — the tool
// JPWB_ASSURANCE_TOOL names with its configured model outside test mode, where an unconfigured reviewer is REFUSED and
// that refusal recorded (`JAN-SELREV` SR-1); the DECLARED STAND-IN under test mode unless a tool is named — the
// structural checker plus the test's stipulated remainder, `JAN-CRITREAD` J1-2. The registry is an in-process seam,
// not a persisted contract.
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	identityProvenanceValidatorInstance,
	schemaInvariantValidatorInstance,
	type Identity,
	type Validator,
	type ValidatorRegistry
} from '@janumipwb/rph-assurance';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { ExchangeSink } from './exchange-capture.js';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';
import {
	createStandinReasoningReviewValidator,
	STANDIN_VALIDATOR_ID,
	type StipulationLookup
} from './standin-reasoning-review-validator.js';
import {
	createModelDeclaredPolicyReviewer,
	createStandinDeclaredPolicyReviewer,
	createUnconfiguredDeclaredPolicyReviewer,
	type DeclaredPolicyReviewer,
	type DeclaredStipulationLookup
} from './declared-policy-review.js';
import { judgeModel } from './agy-cli.js';
import { assuranceModel, devinPrint, type DevinExec } from '../tools/devin-reviewer.js';
import { refusalMessage, selectReviewer } from './reviewer-selection.js';

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
	 * ⭑ WITHOUT THIS SEAM THE WIRING ABOVE IS UNTESTABLE. In test mode the registry builds the ~~deterministic
	 * MOCK reviewer~~ declared stand-in (⭑ `JAN-SELREV` SR-3: the mock's successor since `JAN-CRITREAD` J1-2), which
	 * never captures anything, so an end-to-end assertion here would observe zero
	 * exchange records and prove nothing. The only alternative is spawning a real ~~`agy`~~ reviewer program — agy,
	 * or devin, whose program has its own seam below — which means the
	 * regression that silently unwires retention would never redden a gate. This is the same reasoning that
	 * justified `AgyExec` in `REG-F-333`.
	 */
	print?: AgyPrint;
	/**
	 * ⭐ `JAN-SELREV` SR-1 — the devin PROGRAM, injectable at its exec seam, so the devin branch is reached with nothing
	 * injected but the program. Every real-path test injects `print`, which wins, so until this seam existed no test had
	 * ever reached the branch the selected reviewer (`REG-D-084`) runs on.
	 */
	devinExec?: DevinExec;
	clock?: () => string;
	/**
	 * ⭐ `JAN-CRITREAD` J1-2 — the host's answer to "did the test register a stipulation for this subject, on this
	 * arm?", handed to the declared stand-in. The floor callers supply it because they know what their subject IS
	 * (a PWA, a work product); absent, nothing is ever stipulated — the stand-in then answers only what the checker
	 * judged, and the review is INCONCLUSIVE, as it was under the mock.
	 */
	stipulations?: StipulationLookup;
}): ValidatorRegistry {
	// Fail closed (§8.4): no local instruction, env var, or planner optimization may suppress the Reasoning
	// Review floor.
	// ⭐ `JAN-SELREV` SR-1 (D3) — THE REVIEWER IS THE SELECTOR'S ANSWER, the same answer both preflights act on, so the
	// three can no longer disagree (`REG-F-443`). A real reviewer is selected by NAMING a tool — symmetric with the
	// executor (⭐ `JAN-SELRES` D1: `execution/executor-selection.ts`, which `beginExecute` asks before dispatch) — and
	// the retired `JPWB_ASSESSOR='agy'` sentinel stays retired.
	//
	// ⛔ FAIL-CLOSED IS UNCHANGED AND IS THE POINT OF THE `opts.testMode` INPUT. A stand-in may be selected ONLY
	// inside test mode; outside it the real Validator is the only option, because `JPWB_ASSESSOR=mock` once
	// swapped in the content-blind mock in ANY environment while the floor still recorded SATISFIED.
	const selection = selectReviewer({ testMode: opts.testMode });
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	if (selection.kind === 'STAND_IN')
		registry.register(
			// ⭐ THE DECLARED STAND-IN (§4.1): the structural checker's real answers, plus a CLEAN remainder only
			// where the test registered one — recorded as NOT JUDGED, and counted only by an admitting engine.
			createStandinReasoningReviewValidator({ stipulationFor: opts.stipulations ?? (() => undefined) })
		);
	else if (selection.kind === 'REFUSED')
		// ⛔ D4 — A MISCONFIGURATION IS RECORDED, NEVER THROWN, AND NEVER AS agy's WORK. The refusal's own validator
		// id says what the record is; its `evaluate` throws the guidance, which the floor runner records as
		// `VALIDATOR_EXECUTION_FAILED` (`validators.ts`), so the floor fails closed with the reason on its face.
		// ⚠ AN INJECTED `print` DOES NOT OUTRANK IT: `print` stands in for a program, never for a configuration.
		registry.register(unconfiguredReviewer(refusalMessage(selection)));
	else
		registry.register(
			createAgyReasoningReviewValidator({
				...(opts.artifacts ? { artifacts: opts.artifacts } : {}),
				...(opts.exchanges ? { exchanges: opts.exchanges } : {}),
				...(opts.clock ? { clock: opts.clock } : {}),
				// ⚠ AN EXPLICITLY INJECTED `print` STILL WINS over the configured tool. It is the seam the gate uses to
				// exercise this wiring without spawning anything, and a tool selection that overrode it would make the
				// retention assertions untestable — the reason `AgyPrint` was made injectable at all.
				...(opts.print
					? { print: opts.print }
					: selection.kind === 'DEVIN'
						? {
								print: (prompt: string) => devinPrint(prompt, opts.devinExec),
								agentId: 'devin',
								// ⭑ D4 — RESOLVED WHEN THE REVIEW RUNS, NEVER HERE. The validator calls it inside
								// `evaluate`, when `devinPrint` reads the same variable for devin's argv — so the model
								// recorded and the model run are read together, and a model gone by then is a recorded
								// failure rather than a throw out of this build.
								modelId: assuranceModel,
								// Devin brokers many vendors, so the PROVIDER is the broker, not the model family.
								// Claiming `zhipu` for a GLM model would assert a relationship this host cannot see.
								providerId: 'devin',
								// ⭐ `JAN-SELREV` SR-2 (D6) — devin REPORTS the model that answered, and a model other than
								// the one configured fails the review: the selected reviewer (`REG-D-084`) is the model
								// qualified, so a substitute's review is not its review. Set HERE ONLY — the fingerprint and
								// the qualification runner build the validator without it (`reasoning-review-validator.ts`).
								requireReportedModel: true
							}
						: {})
			})
		);
	return registry;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3); `DESIGN-phase-7-completion.md` B1) — THE DECLARED-POLICY
 * REVIEWER, SELECTED AS THE FLOOR'S REVIEWER IS: the same selector (`selectReviewer`), so the floor and the declared reviews
 * of one host can never be judged by two different reviewers, nor one of them refused while the other runs.
 *   · STAND_IN (test mode, no tool named) — the declared stand-in, answering only where a test registered a
 *     `DECLARED_POLICY` stipulation for the unit's PWA (`declared-policy-review.ts`).
 *   · REFUSED — a reviewer that runs nothing and answers every review with the refusal: recorded, never thrown.
 *   · DEVIN / AGY — the product's own reasoning-review validator: THE INSTANCE `createFloorRegistry` builds (the same
 *     transport, the same capture, the same `requireReportedModel` on the devin branch, so its retry bound is devin's),
 *     run in the `DECLARED_POLICY` framing. ⭑ One review per (unit, policy) pair is one evaluation of this validator.
 * ⚠ THE SAME OPTIONS AS `createFloorRegistry`'s, AND ITS RULE FOR THEM: an injected `print` wins over the configured tool
 * (the seam the gate exercises the wiring through), and never over a refused configuration.
 */
export function createDeclaredPolicyReviewer(opts: {
	testMode: boolean;
	artifacts?: ArtifactStore;
	exchanges?: ExchangeSink;
	print?: AgyPrint;
	devinExec?: DevinExec;
	clock?: () => string;
	stipulations?: DeclaredStipulationLookup;
}): DeclaredPolicyReviewer {
	// ⭐ THE FLOOR'S OWN REVIEWER INSTANCE, NOT A SECOND CONSTRUCTION OF IT: the registry builds it — its transport, its
	// capture, devin's `requireReportedModel` and so its retry bound — and the declared review runs that very validator in
	// the `DECLARED_POLICY` framing. ⛔ A second copy of the construction would be a second thing to keep in step.
	const { stipulations, ...registryOpts } = opts;
	const validator = createFloorRegistry(registryOpts).get(FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	if (validator.validatorId === STANDIN_VALIDATOR_ID)
		return createStandinDeclaredPolicyReviewer({ stipulationFor: stipulations ?? (() => undefined) });
	// ⚠ WHO ANSWERS A CALL THAT THREW: the identity the host configured, ungraded — what the validator records it under too.
	const tool = selectReviewer({ testMode: opts.testMode }).kind === 'DEVIN' && !opts.print ? 'devin' : 'agy';
	const configured = (): Identity => {
		try {
			return tool === 'devin'
				? { actorType: 'AGENT', agentId: 'devin', modelId: assuranceModel(), providerId: 'devin' }
				: { actorType: 'AGENT', agentId: 'agy', modelId: judgeModel(), providerId: 'google' };
		} catch {
			// ⛔ A model no longer configured: the review's failure says so; the record names the tool alone.
			return { actorType: 'AGENT', agentId: tool };
		}
	};
	// ⛔ A REFUSED SELECTION's validator runs nothing and throws the refusal: answered as a failure, under its own id.
	if (validator.validatorId === UNCONFIGURED_REVIEWER_ID)
		return createUnconfiguredDeclaredPolicyReviewer(validator);
	return createModelDeclaredPolicyReviewer(validator, configured);
}

/** The validator a REFUSED selection registers: it runs nothing, and fails with the refusal. */
function unconfiguredReviewer(message: string): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: UNCONFIGURED_REVIEWER_ID,
		evaluate: () => Promise.reject(new Error(message))
	};
}

/** The id a refused reviewer is recorded under — never `agy.reasoning-review`, since nothing reviewed. */
export const UNCONFIGURED_REVIEWER_ID = 'reasoning-review.unconfigured';

export { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
export { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
export { createStandinReasoningReviewValidator } from './standin-reasoning-review-validator.js';
