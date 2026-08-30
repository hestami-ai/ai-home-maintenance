// DEFERRAL — the act that records deferred scope as a governed fact (JAN-SLICE-SWP-02a).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────────
// `JPWB-DOC-003 §8.4` ASR-9 limb 10: *"deferred scope stays represented — as assumption, constraint, residual
// condition, baseline scope statement, or future obligation — never silently deleted."*
//
// `REG-Q-067` asked whether that limb binds the ENGINE or the PROFESSIONAL, because both halves failed by
// opposite mechanisms: the five CARRIERS are real and mintable, but there was no such thing as a DEFERRAL for
// any of them to carry — `grep -c -i defer` over the contracts returned 0/0/0, and none of the 105 registered
// commands deferred anything. Meanwhile "never silently deleted" was VACUOUSLY true, because scope could not be
// changed at all. `REG-D-046` Ruling 2 settled it: **the limb binds the engine.** This is that ruling built.
//
// ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠ IT IS NOT `IntentConstraintRefined`. That ratified event exists, its declared purpose IS a deferral staying
// represented, the corpus's worked example carries it at §26 seq 53 labelled "Offline scope", and
// `replay.ts:139-143` asserts it — and NOTHING EMITS IT. Wiring it would move a shrink-only deficiency pin
// 12 -> 11 and produce the fixture's event WITHOUT producing this fact: its payload is exactly
// `{intentId, constraintId, refinement}`, with no postponement marker, no carrier link and no scope name.
// **Emitting it must never be reported as discharging `REG-Q-067`.**
//
// ⚠ AND IT IS NOT A PRECONDITION ON ANYTHING. Reading A says the engine must REPRESENT deferral; it does not say
// any command must refuse without one. The seven ratified `RPH-INT` rules state three preconditions on
// `ApproveIntent` and none concerns deferral. A guard here would forbid flows canon permits — `CON-000 AX-6`'s
// prohibition, and the hazard `REG-Q-067` was filed to prevent.
import type { DeferScopePayload } from '@janumipwb/rph-contracts';

import { createObject, newEnvelope, reject, type CommandHandler } from './kit.js';

const DEFERRAL = 'DEFERRAL';

/**
 * DeferScope — mint a DEFERRAL recording that named scope left this unit's work and must be carried.
 *
 * ⚠ THE CARRIER LIST IS PLURAL BECAUSE THE CORPUS IS CONJUNCTIVE. `RPH-FIX-006`, verbatim: *"as an assumption or
 * constraint, a residual condition, a baseline scope statement, **and** a future implementation obligation where
 * applicable."* The `SWP-02a` roadmap said "the carrier object", singular; that was narrower than the corpus it
 * was written to serve, and the corpus governs.
 *
 * ⚠ `revisitCondition` IS REQUIRED, AND ITS GROUND IS DISCLOSED RATHER THAN ASSUMED (`REG-F-296`). It is what
 * encodes "postponed rather than abandoned" without a status field that merely restates the object's own type.
 * It rests on `DOC-003 §3` — *"deferred with an explicit review condition"*, the only one of five dispositions
 * carrying a mandatory qualifier. That meaning was **authored by the finalizer**, flagged NEW, referred to the
 * sponsor as `REG-E-021`, and then DEFERRED to its safe default by `REG-D-010`. It stands as drafted, not
 * confirmed. If `REG-E-021` is ever confirmed otherwise, the requiredness of this field is what moves.
 */
export const deferScope: CommandHandler = (ctx, command, payload) => {
	const p = payload as DeferScopePayload;

	// ⚠ THE SCHEMA ADMITS WHAT THE RULE FORBIDS, AND THE HANDLER IS WHERE THAT IS CLOSED. `revisitCondition` is
	// `z.string()` and `carrierObjectIds` is `z.array(z.string())`, so an EMPTY condition and an EMPTY carrier
	// list both validate. Both were driven and both were ACCEPTED before these guards existed — the tests in
	// `deferral.test.ts` were written asserting refusals that did not happen, which is how they were found.
	//
	// A deferral with no revisit condition is scope that left the work with no stated way back: that is an
	// abandonment, and ASR-9 limb 10 forbids scope going silently. A deferral naming no carrier is not
	// REPRESENTED anywhere, which is the limb's first half failing outright.
	if (p.revisitCondition.trim() === '') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A deferral must state the condition under which the scope returns — deferred scope with no revisit condition is an abandonment, not a deferral (DOC-003 §3; ASR-9 limb 10)'
		);
	}
	if (p.carrierObjectIds.length === 0) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A deferral must name at least one carrier that holds it — ASR-9 limb 10 requires deferred scope to STAY REPRESENTED as an assumption, constraint, residual condition, baseline scope statement or future obligation'
		);
	}
	if (p.subjectObjectIds.length === 0) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			'A deferral must name the work it left — REG-D-046 Ruling 2 requires a record that NAMED SCOPE was moved out of THIS unit’s work'
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, DEFERRAL, p.deferralId, {
			// ⚠ THE ENVELOPE'S PLATFORM FIELD, NOT A PROFESSIONAL LIFECYCLE. `lifecycleStatus` is mandatory on
			// every ObjectEnvelope, so a deferral gets one whether or not the domain has an opinion. `'OPEN'`
			// mirrors CLAIM and ASSURANCE_OBSERVATION, which use it for "recorded and outstanding".
			//
			// It does NOT mean a deferral lifecycle exists. A `status` field and its machine were considered and
			// left UNBUILT because neither is traced to the professional corpus — they remain sponsor proposals
			// in the SWP-02a brief. Nothing here may be read as ratifying a DEFERRED -> DISCHARGED progression;
			// inferring one from this constant would be the AX-6 error the whole REG-Q-067 question was about.
			lifecycleStatus: 'OPEN',
			// The deferral is ABOUT the unit whose work the scope left, and it is CARRIED by the objects named.
			// Both go on the envelope's source links so traceability reaches it without a bespoke projection.
			sourceObjectIds: [...p.subjectObjectIds, ...p.carrierObjectIds]
		}),
		statement: p.statement,
		subjectObjectIds: p.subjectObjectIds,
		carrierObjectIds: p.carrierObjectIds,
		revisitCondition: p.revisitCondition,
		rationale: p.rationale,
		authority: p.authority
	};
	return createObject(ctx, command, {
		objectType: DEFERRAL,
		aggregateId: p.deferralId,
		state,
		eventType: 'ScopeDeferred',
		eventPayload: {
			deferralId: p.deferralId,
			statement: p.statement,
			subjectObjectIds: p.subjectObjectIds,
			carrierObjectIds: p.carrierObjectIds,
			revisitCondition: p.revisitCondition,
			rationale: p.rationale,
			authority: p.authority
		}
	});
};
