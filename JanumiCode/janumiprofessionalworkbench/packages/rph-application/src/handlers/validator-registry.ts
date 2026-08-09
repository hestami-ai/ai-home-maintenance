// THE VALIDATOR REGISTRY — DOC-004 §35, and the last unreachable states in the system (REG-E-024(c)).
//
// ── WHAT WAS MISSING, AND WHY IT WAS NOT COSMETIC ────────────────────────────────────────────────────────────
// §35 ratifies `ValidatorRegistryEntry` and its three statuses — ACTIVE / DEGRADED / DISABLED — and specified NO
// transitions between them. The transitions vocab recorded that in one line: *"NO transition table specified in
// the doc."* Three declared states, `transitions: []`, no object type, no commands. REG-E-024(c) names the cost:
// **"the assurance system cannot record that one of its own validators is failing."**
//
// It is not bookkeeping the corpus merely permits. **§34.1 DEPENDS on this field**: a validator implementation
// failure *"produces … retry, ALTERNATE VALIDATOR IMPLEMENTATION, or escalation action"*, and an alternate cannot
// be chosen unless the runtime knows which implementations are available — which is also why §35's selection list
// names *availability*. The registry is the mechanism a ratified error-handling rule already relies on.
//
// The arrows are declared by the 2026-08-05 §0.3 authored clarification to §35; these are their triggers.
//
// ── WHY FIVE NAMED COMMANDS RATHER THAN ONE `SetValidatorStatus` ─────────────────────────────────────────────
// A single setter puts legality in a PAYLOAD FIELD: any status could be requested from any status, and the
// handler would have to re-derive which combinations are legal — a second copy of the machine. Named commands let
// `advanceStatus` consult the machine itself, so an illegal arrow is refused by the declaration rather than by a
// remembered `if`.
//
// ── AND DEGRADATION IS A GOVERNED ACT, NOT AN INFERENCE ──────────────────────────────────────────────────────
// §30's `ASSESSING → VALIDATOR_FAILED` records that an ASSESSMENT failed; `MarkValidatorDegraded` records that a
// VALIDATOR did. RPH-ASR-006 keeps those apart — *"the assessed work is not automatically rejected"* — and the
// same separation applies in reverse: one failed run is not, on its own, a ratified rule for condemning an
// implementation. No handler here degrades a validator as a side effect of an assessment; a caller does it
// deliberately, and `selectAssuranceEvaluator` is where the status acquires teeth.
import type { RegisterValidatorPayload } from '@janumipwb/rph-contracts';
import { advanceStatus, createObject, newEnvelope, type CommandHandler } from './kit.js';
import { fromStates } from './command-precondition.js';

const ENTRY = 'VALIDATOR_REGISTRY_ENTRY';
const MACHINE = 'ValidatorRegistryEntry.status';

/** RegisterValidator — create the entry in ACTIVE (the machine's declared initial state). */
export const registerValidator: CommandHandler = (ctx, command, payload) => {
	const p = payload as RegisterValidatorPayload;
	return createObject(ctx, command, {
		objectType: ENTRY,
		// JAN-PWUWP / REG-F-074 residue: traced from validator-registry.ts:51 (`status: 'ACTIVE'`, unconditional),
		// not from the machine's `initialState` — which happens to agree here, but is a fiction on four machines
		// (REG-F-071), so agreement is corroboration and never the source.
		// ⚠ THE LITERAL, NOT THE `MACHINE` CONST: the census requires `births[].machine` to be a string literal so
		// it can be read from the AST without evaluating the module. Using the const threw outright — a loud
		// failure, which is the right one; a reader that silently skipped it would have left this machine blind.
		births: [{ machine: 'ValidatorRegistryEntry.status', statusField: 'status', values: ['ACTIVE'] }],
		aggregateId: p.validatorId,
		state: {
			...newEnvelope(command, ENTRY, p.validatorId, { lifecycleStatus: 'ACTIVE' }),
			validatorId: p.validatorId,
			supportedPolicies: p.supportedPolicies,
			roleId: p.roleId,
			implementationType: p.implementationType,
			requiredCapabilities: p.requiredCapabilities,
			independenceAttributes: p.independenceAttributes,
			costClass: p.costClass,
			latencyClass: p.latencyClass,
			status: 'ACTIVE'
		},
		// The event records the RESULTING status, so a log-driven fold can see where the entry started. Omitting
		// it is how FAILED and post-retry QUEUED became unobservable in the execution machine (JAN-EXECREM F-25).
		eventPayload: {
			validatorId: p.validatorId,
			supportedPolicies: p.supportedPolicies,
			roleId: p.roleId,
			implementationType: p.implementationType,
			status: 'ACTIVE'
		},
		eventType: 'ValidatorRegistered'
	});
};

/** The four status arrows. Each names its source states, so the machine refuses the rest. */
const statusChange = (
	target: string,
	eventType: string,
	/** Non-empty by type, matching `fromStates` — a status arrow with no source state is not an arrow. */
	from: [string, ...string[]]
): CommandHandler => {
	return (ctx, command, payload) => {
		const p = payload as { validatorId: string; reason: string };
		return advanceStatus(ctx, command, {
			objectType: ENTRY,
			statusField: 'status',
			machine: MACHINE,
			target,
			eventType,
			precondition: fromStates(...from),
			setLifecycleStatus: true,
			// `reason` rides the event, not the snapshot: the entry's CURRENT status is the fact, and why it got
			// there is history. Putting it on the object would leave the last reason attached to a status it no
			// longer explains.
			eventPayload: () => ({ validatorId: p.validatorId, reason: p.reason, status: target })
		});
	};
};

/** ACTIVE -> DEGRADED. §34.1's missing half: the assessment says VALIDATOR_FAILED, this says which validator. */
export const markValidatorDegraded = statusChange('DEGRADED', 'ValidatorDegraded', ['ACTIVE']);

/** DEGRADED -> ACTIVE. Degradation must be recoverable or it is disablement under another name. */
export const restoreValidator = statusChange('ACTIVE', 'ValidatorRestored', ['DEGRADED']);

/** ACTIVE | DEGRADED -> DISABLED — §35's table gives this arrow two source states and one trigger. */
export const disableValidator = statusChange('DISABLED', 'ValidatorDisabled', ['ACTIVE', 'DEGRADED']);

/** DISABLED -> ACTIVE. Reinstatement asserts fitness, so it returns to ACTIVE rather than DEGRADED. */
export const enableValidator = statusChange('ACTIVE', 'ValidatorEnabled', ['DISABLED']);
