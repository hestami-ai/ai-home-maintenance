import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ObjectEnvelopeSchema } from './envelopes.js';
import { buildContractRegistry, schemaId, validateAgainst } from './validate.js';

describe('validate', () => {
	it('returns the typed value on success', () => {
		const r = validateAgainst(
			z.strictObject({ a: z.string() }),
			{ a: 'x' },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.a).toBe('x');
	});

	it('yields RPH_VALIDATION_SCHEMA_FAILED with structured issues on failure', () => {
		const r = validateAgainst(
			z.strictObject({ a: z.string() }),
			{ a: 1, b: 2 },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
			expect(r.error.correlationId).toBe('c1');
			const issues = (r.error.details as { issues: unknown[] }).issues;
			expect(issues.length).toBeGreaterThan(0);
		}
	});

	it('registry validates by id and rejects unknown ids', () => {
		const reg = buildContractRegistry();
		const envId = schemaId('object', 'ObjectEnvelope');
		expect(reg.has(envId)).toBe(true);
		expect(reg.get(envId)).toBe(ObjectEnvelopeSchema);
		const bad = reg.validate('urn:janumi:rph:schema:object:Nope:1', {}, { correlationId: 'c1' });
		expect(bad.ok).toBe(false);
	});

	it('registers envelope + enum + object + command + event schemas', () => {
		// 8 envelope/primitive + 72 enums + 21 objects + 65 commands + 117 events = 283
		// (+3 objects PROFESSIONAL_WORK_ARCHITECTURE / PWU_TYPE / UNDERTAKING; +8 PWA-authoring commands +8 events —
		// the RPH-DOC-010 PWA-authoring context; then +3 DRAFT-authoring commands EditPwa/EditPwuType/RemovePwuType
		// +3 events; then +1 DeletePwa command +1 PwaDeleted event — PWA discard/soft-delete; then +1
		// AUTHORING_CONVERSATION object +1 AppendConversationEntries command +1 ConversationEntriesAppended event —
		// the durable event-sourced authoring conversation, governed-stream precursor; then +1 CreateAssurancePolicy
		// command +1 AssurancePolicyCreated event — the assurance-floor policy create path (guide §8.9). The
		// authoring-plane AUTHORING_ASSESSMENT object + its 3 faithfulness commands/events were RETIRED in favor of
		// the canonical de minimis assurance floor (recorded ASSURANCE_ASSESSMENT/OBSERVATION); see OPEN-QUESTIONS)
		// then +1 CardinalityCode enum — per-child composition cardinality (M1/M+/C1/C+) for the PWA Work
		// Architecture View (§11.7.2); the PermittedChildRule helper is a sub-type, not a registry entry.
		// then +4 assurance-policy lifecycle commands (Edit/Supersede/Suspend/Activate AssurancePolicy) +4 events —
		// full authorable policy lifecycle for the PWA Designer's policy manager (§8.9/§17; floor policies locked).
		// then +1 RecordArtifact command +1 ArtifactRecorded event — the Artifact lifecycle. ARTIFACT was already
		// one of the 21 registered objects, but as a bare envelope with zero fields, and NOTHING could create one
		// while DOC-007 §16.1/§16.2 both carry `outputArtifactIds`. Fields transcribed from DOC-009 §18.1 (the
		// ratified `create table artifacts`); the command/event are authored under the 2026-07-16 grant.
		// then +1 AssuranceIndependenceViolated event (Increment I2) — the ratified §30 ASSESSING→INDEPENDENCE_VIOLATION
		// arrow made reachable when completeAssuranceAssessment's independence check fails; payload authored under §0.3
		// (CompleteAssuranceAssessment gained a `producer` FIELD, not a new command, so no command was added).
		// then +1 SubmitEvidenceForAssessment command +1 AssuranceEvidenceReceived event (Increment Q) — the §32
		// evidence sub-lifecycle that makes §38 "missing evidence" a real required−received fold. Ratified NAMES
		// (DOC-004 §32/§31); schemas authored under §0.3 (§31 L1770: "ratified names ... schematized nowhere").
		// then +2 AssertObligation/AssertConstraint commands +2 ObligationAsserted/ConstraintAsserted events —
		// the first-class Obligation/Constraint object plane (JAN-ROADMAP-001 W1 gate G1 condition C1: WP-1-005's
		// "material obligations SHALL become first-class traceable objects"); then +1 ProposeRecomposition command
		// +1 RecompositionProposed event — the RecompositionContract mint (WIRE-3a). The RecompositionConflict
		// helper is a sub-type, not a registry entry. (+6 → 303.)
		// then +1 ExpireAssumption command (W3-INC-2 / WP-3-008) — instantiates the Assumption expiry transition so
		// the kernel canAuthorizeNewWork (RPH-ASM-006) becomes reachable at ApproveExecutionPlan. The AssumptionExpired
		// event already existed (no new event). (+1 → 304.)
		// then +4 for JAN-IRP capability C7 (durable RPH coordination object): +1 HarnessStatus enum, +1
		// RecursiveProfessionalHarness object (22nd object type), +1 ProposeHarness command, +1 HarnessProposed
		// event. (RECURSIVE_PROFESSIONAL_HARNESS is a new VALUE on the existing ProfessionalWorkObjectType enum, not
		// a new enum entry.) (+4 → 308.)
		// then +1 ExecutionBoundary enum (JAN-PRPWA-DS-001 STD-2 / DWP-02) — the INTERNAL/DELEGATED_EXTERNAL boundary
		// annotation on PwuType. The BoundaryContract sub-type (STD-3) is a helper, NOT a registry entry (like
		// RecompositionConflict above); the two new PwuType fields + two command-payload fields add no schemas. (+1 → 309.)
		// then +4 for JAN-EXECPLAN-DR-002 DWP-01 (plan-terminal lifecycle, Tier 3 / 3A): +2 commands
		// (CompleteExecutionPlan, FailExecutionPlan) + +2 events (ExecutionPlanCompleted, ExecutionPlanFailed) —
		// AUTHORED under the standing 2026-07-16 execution grant (states + §20.1 condition ratified; shapes not). (+4 → 313.)
		// then +1 for DWP-02 (supersession): +1 command SupersedeExecutionPlan (REUSES the existing
		// ExecutionPlanSuperseded event — no new event). (+1 → 314.)
		// then +2 for JAN-EXECPLAN-DR-003 3C-iii (step interpreter): +2 commands (SkipExecutionStep,
		// CancelExecutionStep). Their events (ExecutionStepSkipped / ExecutionStepCancelled) PRE-EXISTED, and the
		// optional `reason` field added to ExecutionStepCancelled is a field on an existing event — neither adds a
		// registry id. (+2 → 316.)
		// then +1 for JAN-EXECPLAN-DR-004 DWP-01 (Tier 3C-ii): +1 enum TransitionType. ExecutionTransition changed from
		// an opaque placeholder (z.record) to a full strictObject helper (same schema id, no delta); conditionExpression
		// stays opaque z.unknown (the grammar is hand-authored in rph-domain, not vocab-generated). (+1 → 317.)
		// then +2 for JAN-EXECPLAN-DR-004 DWP-03 (BRANCH/prune): +1 command PruneExecutionStep + +1 event
		// ExecutionStepPruned (a system prune of a not-taken branch arm to SKIPPED). (+2 → 319.)
		// DR-004 DWP-04 (Tier 3C-ii): EnterExecutionStepWait + ResolveExecutionStepWait commands and the MINTED
		// ExecutionStepWaitResolved event — the WAITING state and its RUNNING resume become reachable and replayable
		// (ExecutionStepWaiting already existed with no command able to emit it). (+3 → 322.)
		expect(buildContractRegistry().ids()).toHaveLength(322);
	});
});
