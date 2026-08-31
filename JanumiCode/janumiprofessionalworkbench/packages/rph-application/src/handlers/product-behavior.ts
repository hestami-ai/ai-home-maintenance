// THE W7 PRODUCT-BEHAVIOR PLANE — the five acts that mint Actor, Capability, User Journey, Scenario and
// Requirement as governed objects (JAN-SLICE-SWP-05).
//
// ── WHAT THIS DISCHARGES, AND WHAT IT DOES NOT ───────────────────────────────────────────────────────────────
// ⚠ THIS IS THE DISCHARGE OF A RATIFIED DEFERRAL, NOT THE CLOSING OF A DEFECT, AND THE DISTINCTION IS THE WHOLE
// POINT. `FSM §30.2` defers the plane in terms — *"Initially represent these through typed fields or
// extensions… Promote them to universal first-class tables only after the Product Realization PWA
// implementation proves the need."* The condition is PROOF OF NEED, and a verification substrate keyed to
// capabilities and journeys is that proof: it cannot trace to objects that do not exist. Recording this as
// remediation would misdescribe a design maturing exactly as designed.
//
// ⚠⚠ AND THE DISCHARGE IS PARTIAL, WHICH THE ROADMAP DID NOT SAY. `§30.2`'s deferral list has SEVEN members,
// verbatim: *"stakeholder; actor; capability; journey; requirement; risk; architecture element."* This work
// package promotes FOUR of them. `stakeholder`, `risk` and `architecture element` REMAIN DEFERRED under the
// same unchanged condition, and SCENARIO — the fifth promoted here — IS NOT ON §30.2'S LIST AT ALL. Its
// warrant is separate and also ratified: ontology `§5.9` defines it, `§12` mandates its classes, and the
// Reference lists `SCENARIO` among `PRODUCT_BEHAVIOR_DEFINITION`'s `outputArtifactTypes`. Filed as `REG-F-302`
// so the register cannot be read as one deferral having carried all five promotions.
//
// ── WHY THIS IS NOT A PARALLEL REPRESENTATION (SL-W7-1) ──────────────────────────────────────────────────────
// The invariant is *"No parallel representation is introduced alongside the existing pwuKind"*, and the corpus
// settles it rather than this file asserting it. `USER_JOURNEY_DEFINITION` is a **pwuKind** — the WORK of
// defining a journey. `USER_JOURNEY` is the journey that work PRODUCES, and the Reference already lists it
// among that PWU's `outputArtifactTypes`. Ontology `§6`'s typed relationship `PWU Instance PRODUCES Artifact`
// is the edge between them, and Reference `§29.2` puts the object-versus-PWU decision to the implementation
// explicitly — *"The implementation must decide when defining one of these constitutes a separate PWU
// Instance"* — with a five-part rule for when. Work and product are different things; a pwuKind and an object
// type naming the same subject are not two representations of one thing. `verif/product-behavior-plane.test.ts`
// gates that, so the claim is checked rather than merely written here.
//
// ── AND WHY THE REFUSALS ARE THE FIVE THEY ARE ───────────────────────────────────────────────────────────────
// Each guard closes a case the SCHEMA ADMITS AND THE CORPUS FORBIDS, which is the only kind of guard worth
// writing: every required string is `z.string()`, so the empty string validates. Each refusal below names the
// sentence it enforces, and each is proved load-bearing by its own mutant in
// `packages/rph-engine/src/slices/e2e-008-product-behavior.slice.test.ts` — a guard with no mutant is an
// assertion nothing can fail.
//
// ⚠ WHAT IS DELIBERATELY *NOT* GUARDED, so that a later reader does not add it as an oversight-fix:
//   • NO REFERENTIAL-EXISTENCE CHECKS. `gen-objects.ts` states the repository's rule in its own words —
//     "id-reference fields are strings (id validity is enforced when the referenced object is created, per
//     docs §5)". A journey may name a capability id before that capability is minted. Adding an existence
//     check here would impose an ordering the corpus does not, which is `CON-000 AX-6`'s prohibition.
//   • NO EMPTY-ARRAY REFUSALS EXCEPT `steps`. `§12` requires the FIELD, not a non-empty value: a journey that
//     records no `decisions` is stating that it has none, which is how a producer says "none" without
//     fabricating content. `steps` is the exception and it is grounded, not stylistic — see `defineUserJourney`.
import type {
	DefineActorPayload,
	DefineCapabilityPayload,
	DefineRequirementPayload,
	DefineScenarioPayload,
	DefineUserJourneyPayload
} from '@janumipwb/rph-contracts';

import { createObject, newEnvelope, reject, type CommandHandler } from './kit.js';

const ACTOR = 'ACTOR';
const CAPABILITY = 'CAPABILITY';
const USER_JOURNEY = 'USER_JOURNEY';
const SCENARIO = 'SCENARIO';
const REQUIREMENT = 'REQUIREMENT';

/**
 * The envelope's platform field, not a professional lifecycle.
 *
 * ⚠ `lifecycleStatus` IS MANDATORY ON EVERY `ObjectEnvelope`, so these objects carry one whether or not the
 * domain has an opinion — and for definitional records it does not. `'OPEN'` mirrors `CLAIM`, `DEFERRAL` and
 * `ASSURANCE_OBSERVATION`, which use it for "recorded and outstanding". Nothing here may be read as ratifying a
 * lifecycle for these five: the ontology defines each in a sentence and gives none of them a state machine.
 *
 * ⚠⚠ AND IT IS NOT `RequirementObject.lifecycle`. `§13` lists `lifecycle` as a REQUIRED PROPERTY of a
 * requirement — a professional fact about the requirement's own standing, whose members `§13` does not
 * enumerate, which is why that field is a string. The two are different fields on different planes and
 * conflating them would put a platform constant where a professional judgement belongs.
 */
const RECORDED = 'OPEN';

/**
 * DefineActor — mint an ACTOR, a product-domain participant in a journey.
 *
 * ⚠ THIS IS NOT `ActorReference`, AND THE COLLISION IS IN THE WORD ONLY. `ActorReference` (`envelopes.ts`,
 * `DOC-007 §6`) is the ACTING PARTY that operates the harness — who issued a command, who created an object.
 * `ACTOR` is a participant *inside the modelled product*: the Reference's own catalogue is "Business Owner,
 * Office Administrator, Dispatcher, Field Technician, Customer, External Payment Provider, External Accounting
 * System, Notification Provider". A dispatcher is not a user of this workbench.
 *
 * They share the ratified `ActorType` enum and nothing else — and that REUSE IS DELIBERATE. Minting a second
 * actor-type enum is exactly the parallel representation `SL-W7-1` forbids, and the ratified members already
 * cover the catalogue exactly: five `HUMAN` and three `EXTERNAL_SYSTEM`.
 */
export const defineActor: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefineActorPayload;

	// Ontology `§5.4` defines an actor as "A human or system participant that performs actions within a user
	// journey" — a participant with no name identifies no one, and the Reference's catalogue is a list of names.
	if (p.name.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'An actor must be named — ontology §5.4 defines an actor as a participant that performs actions within a journey, and an unnamed participant identifies no one'
		);
	}
	return createObject(ctx, command, {
		objectType: ACTOR,
		aggregateId: p.actorId,
		state: {
			...newEnvelope(command, ACTOR, p.actorId, { lifecycleStatus: RECORDED }),
			name: p.name,
			actorType: p.actorType
		},
		eventType: 'ActorDefined',
		eventPayload: { actorId: p.actorId, name: p.name, actorType: p.actorType }
	});
};

/**
 * DefineCapability — mint a CAPABILITY, "an ability the product must provide" (`§5.6`).
 *
 * `refinedByRequirementIds` carries ontology `§6`'s typed relationship `Capability REFINED_BY Requirement`, and
 * an EMPTY list is legitimate: a capability that no requirement has refined yet is the ordinary state of one
 * just catalogued. The inverse edge is NOT stored on the requirement — `§13`'s "source intent or journey" is
 * intent or journey, not capability — so the two are different edges rather than two copies of one.
 */
export const defineCapability: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefineCapabilityPayload;

	// `§5.6` is six words — "An ability the product must provide" — and an empty statement names no ability.
	if (p.statement.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A capability must state the ability it provides — ontology §5.6 defines a capability as "an ability the product must provide", and an empty statement provides none'
		);
	}
	return createObject(ctx, command, {
		objectType: CAPABILITY,
		aggregateId: p.capabilityId,
		state: {
			...newEnvelope(command, CAPABILITY, p.capabilityId, {
				lifecycleStatus: RECORDED,
				sourceObjectIds: [...p.refinedByRequirementIds]
			}),
			statement: p.statement,
			refinedByRequirementIds: p.refinedByRequirementIds
		},
		eventType: 'CapabilityDefined',
		eventPayload: {
			capabilityId: p.capabilityId,
			statement: p.statement,
			refinedByRequirementIds: p.refinedByRequirementIds
		}
	});
};

/**
 * DefineUserJourney — mint a USER_JOURNEY carrying `§12`'s fifteen required fields.
 *
 * ⚠ THE FIFTEEN ARE THE CORPUS'S OWN LIST, IN ITS ORDER, NEITHER EXTENDED NOR TRIMMED. That is why the payload
 * is wide: `§12` says "Required fields" and names fifteen, so fifteen is what a journey carries.
 */
export const defineUserJourney: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefineUserJourneyPayload;

	// `§12` required field 1 is "journey identity"; the envelope's id is the machine identity and this is the
	// named one ("Request to Completed Job" in the Reference).
	if (p.journeyIdentity.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A journey must carry its identity — ontology §12 names "journey identity" as the first of fifteen required fields'
		);
	}
	// ⚠ THE ONE EMPTY-ARRAY REFUSAL, AND IT IS GROUNDED RATHER THAN STYLISTIC. `§5.8` defines a user journey as
	// "A structured representation of how an actor seeks an outcome ACROSS INTERACTIONS with the product and
	// surrounding systems". A journey with zero steps represents no interactions, so it is not an under-filled
	// journey — it is not a journey. Every OTHER array here may legitimately be empty, which is how a producer
	// states "this journey records no decisions" without inventing any.
	if (p.steps.length === 0) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A journey must record at least one step — ontology §5.8 defines a journey as how an actor seeks an outcome ACROSS INTERACTIONS, and a journey with no steps represents no interactions'
		);
	}
	return createObject(ctx, command, {
		objectType: USER_JOURNEY,
		aggregateId: p.journeyId,
		state: {
			...newEnvelope(command, USER_JOURNEY, p.journeyId, {
				lifecycleStatus: RECORDED,
				// The journey is ABOUT its actors and the capabilities it realizes, so both reach traceability
				// through the envelope's own source links rather than a bespoke projection.
				sourceObjectIds: [p.primaryActorId, ...p.supportingActorIds, ...p.requiredCapabilityIds]
			}),
			journeyIdentity: p.journeyIdentity,
			originatingOutcome: p.originatingOutcome,
			primaryActorId: p.primaryActorId,
			supportingActorIds: p.supportingActorIds,
			trigger: p.trigger,
			preconditions: p.preconditions,
			steps: p.steps,
			decisions: p.decisions,
			alternatePaths: p.alternatePaths,
			exceptionalPaths: p.exceptionalPaths,
			completionCondition: p.completionCondition,
			failureCondition: p.failureCondition,
			affectedEntityIds: p.affectedEntityIds,
			requiredCapabilityIds: p.requiredCapabilityIds,
			evidenceOfSuccess: p.evidenceOfSuccess
		},
		eventType: 'UserJourneyDefined',
		eventPayload: { ...p }
	});
};

/**
 * DefineScenario — mint a SCENARIO, "a concrete instance or variation of a journey" (`§5.9`).
 *
 * ⚠ `scenarioClass` IS THE RATIFIED EIGHT THE SLICE PROGRAMME ALREADY DERIVES, and that is the point rather
 * than a coincidence. `SCENARIO_CLASSES` in `@janumipwb/rph-contracts/slice` is re-derived from the ontology
 * sentence by `verif/slice-scenario-classes.test.ts`; `verif/product-behavior-plane.test.ts` asserts this enum
 * is that same set under the repository's UPPER_SNAKE convention. A ninth ratified class reddens BOTH rather
 * than letting one drift past the other in silence.
 */
export const defineScenario: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefineScenarioPayload;

	// `§5.9` — "A concrete instance or variation OF A JOURNEY". A scenario belonging to no journey is not a
	// scenario; it is a loose path with nothing to be a variation of.
	if (p.journeyId.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A scenario must name the journey it varies — ontology §5.9 defines a scenario as a concrete instance or variation OF A JOURNEY'
		);
	}
	return createObject(ctx, command, {
		objectType: SCENARIO,
		aggregateId: p.scenarioId,
		state: {
			...newEnvelope(command, SCENARIO, p.scenarioId, {
				lifecycleStatus: RECORDED,
				sourceObjectIds: [p.journeyId]
			}),
			statement: p.statement,
			journeyId: p.journeyId,
			scenarioClass: p.scenarioClass
		},
		eventType: 'ScenarioDefined',
		eventPayload: {
			scenarioId: p.scenarioId,
			statement: p.statement,
			journeyId: p.journeyId,
			scenarioClass: p.scenarioClass
		}
	});
};

/**
 * DefineRequirement — mint a REQUIREMENT carrying `§13`'s eleven required properties plus its ratified type.
 *
 * ⚠ `applicability` IS A STRING AND THE CHOICE IS DISCLOSED RATHER THAN DEFAULTED. This repository has a
 * ratified `ApplicabilityExpression` grammar (`DOC-007 §18`) that assurance policies use, and reaching for it
 * here would be an INFERENCE: `§13` names the property and specifies no grammar for it. Typing it as the policy
 * expression would import a semantics the corpus does not assign to requirements.
 *
 * ⚠ `lifecycle` and `conflictStatus` are STRINGS, NOT ENUMS, for the same reason `DEFERRAL` has no status
 * field: `§13` lists both as required properties and enumerates the members of NEITHER. Inventing the members
 * is what `SL-7` forbids.
 */
export const defineRequirement: CommandHandler = (ctx, command, payload) => {
	const p = payload as DefineRequirementPayload;

	// `§13` required property 1 is the statement, and the section's own quality rules turn on it — a requirement
	// is required to be "necessary, bounded, traceable, internally consistent, verifiable". An empty statement
	// can be none of those things.
	if (p.statement.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A requirement must state the obligation it imposes — ontology §13 makes the statement its first required property, and its quality rules require a requirement to be verifiable'
		);
	}
	return createObject(ctx, command, {
		objectType: REQUIREMENT,
		aggregateId: p.requirementId,
		state: {
			...newEnvelope(command, REQUIREMENT, p.requirementId, {
				lifecycleStatus: RECORDED,
				// `§13` required property 4 — "source intent or journey" — is the traceability edge that makes a
				// requirement answerable to what produced it, so it reaches the envelope's source links.
				sourceObjectIds: [...p.sourceObjectIds]
			}),
			statement: p.statement,
			rationale: p.rationale,
			authority: p.authority,
			sourceObjectIds: p.sourceObjectIds,
			priority: p.priority,
			applicability: p.applicability,
			verificationMethod: p.verificationMethod,
			affectedArtifactIds: p.affectedArtifactIds,
			dependencyIds: p.dependencyIds,
			conflictStatus: p.conflictStatus,
			lifecycle: p.lifecycle,
			requirementType: p.requirementType
		},
		eventType: 'RequirementDefined',
		eventPayload: { ...p }
	});
};
