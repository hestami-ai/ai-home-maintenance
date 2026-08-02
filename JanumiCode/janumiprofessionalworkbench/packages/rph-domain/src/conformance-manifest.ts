// M12 conformance manifest — the coverage overlay over the full RPH-* rule catalog (Conformance Spec §3
// taxonomy: 7 layers, 125 rules, Properties P1–P8). This is the executable accounting that gates the suite:
// every rule in the catalog must map to a coverage status; a rule that resolves to `undefined` (UNACCOUNTED)
// fails the conformance test (the "CI fails on any single invariant violation" goal). The catalog itself is
// loaded from vocab/m12-conformance.json (the grounded source of truth) by conformance.test.ts.
//
// HONESTY RULE: a family is COVERED only when EVERY id in it is asserted; if only some ids are asserted the
// family is PARTIAL (with a note listing what is covered vs pending). This overlay was audited by the M12
// adversarial review, which downgraded several families that had been over-claimed as COVERED.
//
// SECOND HONESTY RULE — THE LAYER (JAN-EXECREM WP-16 / SM-6, DS-001 §4 item 2). "Is it tested?" is not the whole
// question. A rule whose ratified statement is "the command is rejected" is satisfied only by evidence at the
// COMMAND layer; a pure-predicate unit test proves the predicate computes the right answer and says nothing about
// whether anything ASKS it. This manifest certified RPH-PWU-010 COVERED on the strength of a call to a function
// that had, repo-wide, exactly two references — its own definition and that test. `enforcement-register.ts` adds
// the missing axis, and `enforcement-register.test.ts` gates it: a rule the register declares ENFORCED must cite a
// COMMAND-layer file here, and a rule the register discloses as enforced NOWHERE may not be certified COVERED at
// all. The RPH-EXE family below was downgraded by that gate on its first run.

export type CoverageStatus =
	| 'COVERED' // every rule in the family is asserted by a concrete unit test
	| 'PROPERTY' // asserted generatively by a P1–P8 property test (properties.test.ts)
	| 'PARTIAL' // the core rules are asserted; specific ids remain pending (documented in the note)
	| 'DEFERRED'; // legitimately not an M12-kernel concern (M13 replay/e2e, M14 UI, or out-of-0.1.x scope)

export interface Coverage {
	readonly status: CoverageStatus;
	readonly testFile?: string;
	readonly note?: string;
}

/** Per-id coverage for the individually-asserted numbered rules (from the audited M12 coverage map). Each cited
 *  file is a concrete test that actually asserts that id (conformance.test.ts checks each path exists). */
const COVERED_BY_ID: Readonly<Record<string, string>> = {
	'RPH-CON-001': 'packages/rph-contracts/src/envelopes.test.ts',
	// 'RPH-CON-004' WAS CERTIFIED COVERED HERE, citing envelopes.test.ts. REMOVED 2026-08-02: the register
	// disposes it UNENFORCED_DISCLOSED — every timestamp field is typed `z.string()`, so a non-RFC-3339 value is
	// accepted AND PERSISTED VERBATIM — and the overclaim gate reddened on the first run. This is the SECOND
	// instance of the miscitation family REG-F-011 records for RPH-CON-001: an rph-contracts test asserting
	// something adjacent to the rule rather than the rule.
	'RPH-CON-008': 'packages/rph-contracts/src/messages.test.ts',
	// RE-CITED 2026-08-02 to the enforcement probe. RPH-CON-002 is the register's first SCHEMA-layer ENFORCED row,
	// and its evidence is a DISPATCH observing the boundary refuse — not a unit test of the schema in isolation.
	// The refusalLayer says WHERE in the pipeline the refusal happens; the cite still says where it is OBSERVED,
	// and observing it through Engine.dispatch is the stronger claim, which is this register's whole thesis.
	'RPH-CON-002': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PWU-005': 'packages/rph-domain/src/execution.test.ts',
	// 'RPH-PWU-007' WAS CERTIFIED COVERED HERE, citing `pwuGuards.test.ts` — "satisfiesP1: rejected assurance can't
	// satisfy". REMOVED 2026-08-02, and the removal is the DS-001 defect caught a second time by the instrument
	// built for it. That cite is PURE_KERNEL: `satisfiesP1` computes the right answer, and the running engine never
	// asks it for THIS rule's quantifier. The register disclosed RPH-PWU-007 as UNENFORCED with an observed
	// admission — a PWU whose own assurancePolicyIds names a policy whose assessment came back REJECTED reaches
	// workLifecycleState SATISFIED by citing a second, satisfied assessment — and the overclaim gate reddened on
	// the first run, exactly as it did for RPH-PWU-010 when the register was first built. The family stays PARTIAL.
	// ── COMMAND-layer citations (JAN-EXECREM WP-16). Each of these rules states that a COMMAND IS REJECTED, so its
	// evidence must be a dispatch through the engine. Before WP-12b wired it, PWU-010's cite here was
	// `rph-domain/src/execution.test.ts` — a pure-predicate call, for a rule enforced nowhere. PWU-009 is new: the
	// same production site refuses it, and the register gives it its own marker so one arrangement cannot green both.
	'RPH-PWU-009': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PWU-010': 'packages/rph-application/src/handlers/execrem-wp12-authority.test.ts',
	'RPH-EXE-001': 'packages/rph-application/src/handlers/execution-plan-activation-guard.test.ts',
	'RPH-EXE-002': 'packages/rph-application/src/handlers/execution-plan-supersede.test.ts',
	// JAN-EXEBIND WP-B1. Certified COVERED for four milestones on the strength of a pure-predicate unit test while
	// `startExecutionStep` never resolved a step's runtimeBindingId at all; now observed refusing through the bus.
	'RPH-EXE-003': 'packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts',
	// JAN-CAPBIND WP-3 (N-3). REQUIRED, not optional: without a per-id row `coverageFor` falls back to
	// COVERAGE_BY_PREFIX['RPH-EXE'], whose testFile is rph-domain/src/execution.test.ts — PURE_KERNEL — and the
	// layer gate correctly reddens, because a newly-ENFORCED rule would be citing pure-predicate evidence for a
	// command refusal. That is the F-28 substitution itself, and the gate caught it on the first run of this WP.
	'RPH-EXE-005': 'packages/rph-application/src/handlers/capbind-wp3-input-readiness.test.ts',
	'RPH-EXE-006': 'packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts',
	'RPH-EXE-008': 'packages/rph-application/src/handlers/execution-retry-cap.test.ts',
	// The RPH-EVD tranche (2026-08-01). REQUIRED per-id, for the reason recorded on RPH-EXE-005 above: without a
	// row here `coverageFor` falls back to COVERAGE_BY_PREFIX['RPH-EVD'], whose testFile is in rph-assurance —
	// PURE_KERNEL — and the layer gate correctly reddens a command refusal citing pure-predicate evidence. Only
	// EVD-007 appears: it is the only rule of the seven the register disposes as ENFORCED, and a per-id COVERED
	// row for any of the other six would collide with the register's "no disclosed rule is certified COVERED" gate.
	'RPH-EVD-007': 'packages/rph-application/src/handlers/evidence-admissibility-gate.test.ts',
	// ADDED 2026-08-02 when REG-F-008's remediation moved EVD-003 from disclosed to ENFORCED. It cites the
	// enforcement probe rather than the admissibility-gate test because that test's fixture is the SCOPE limb,
	// which is EVD-007; this rule's refusal is the CONTENT limb, and the two must not share their evidence.
	'RPH-EVD-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// The RPH-ASR tranche (2026-08-02). Same requirement, same reason: the ENFORCED rows must cite evidence at the
	// COMMAND layer or the register's layer gate reddens. Only TWO of the twelve qualify. The other ten carry no
	// per-id row — five are disclosed as unenforced (a COVERED row would collide with the register's overclaim
	// gate) and five are outcomes or read-model obligations no command refusal can carry.
	//
	// RPH-ASR-010 IS DELIBERATELY ABSENT. It was drafted ENFORCED with a cite to `pwa-publish-stale-floor.test.ts`,
	// and that test is real and green — but it drives the DE MINIMIS FLOOR's version binding on the PWA publish
	// path, whose subject is not this rule's. Citing it would have made the manifest report an assessment-path
	// guarantee on the strength of a publish-path refusal. The row is now UNENFORCED_DISCLOSED.
	'RPH-ASR-002': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-ASR-007': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// The RPH-INT tranche (2026-08-02). Three of seven are ENFORCED and cite their probes; the other four are
	// NOT_A_COMMAND_REFUSAL and carry no per-id row, because their statements describe what an ACCEPTED command
	// produces rather than anything a dispatch could be refused for.
	'RPH-INT-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-INT-004': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-INT-005': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// The RPH-PWU tranche, five of ten (2026-08-02). Only the two ENFORCED rows appear; the family is NOT yet
	// total in the register (RPH-PWU-003/007/008 are investigated and owed), which is why RPH-PWU is absent from
	// TOTAL_OVER_FAMILIES.
	'RPH-PWU-002': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PWU-004': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// ── THE RPH-PER CITES, ALL FOUR CORRECTED 2026-08-02 WHILE DISPOSITIONING THE FAMILY ─────────────────────
	//
	// Every one of the four was wrong, in four different ways, and none was caught by any gate that reads this
	// file — which is the DS-001 §4 item 2 thesis restated: a manifest row has ONE axis ("is it tested?") and the
	// answer was truthfully yes in all four cases.
	//
	//   001 — cited a STORE-layer test for a rule the register now disposes ENFORCED. The refusal a professional
	//         actually meets is at the COMMAND layer (`kit.ts`, on the CLIENT's declared expectedRevision); the
	//         store's own re-check is a second, deeper guard with a different message. Re-cited to the dispatch
	//         probe, which the register's layer gate REQUIRES for an ENFORCED row.
	//   002 — cited a test whose own title reads 'RPH-PER-002: rejects a new-aggregate commit when the aggregate
	//         already exists (REVISION_CONFLICT)'. That is a REVISION CONFLICT — RPH-PER-001's rule. The test says
	//         nothing about idempotency keys, prior results, or duplicate commands. The mislabel is in the test
	//         file itself and this manifest inherited it; both are corrected. Re-cited to `engine.test.ts`, which
	//         asserts the DUPLICATE status and the unchanged event count.
	//   007 — cited `work-projection.test.ts`, whose relevant test is TITLED '… — NOT RPH-PER-007; see
	//         projection-rebuild.test.ts'. It was retitled on 2026-07-17 precisely because its old form asserted
	//         the fold equals ITSELF and was 'actively CONCEALING a defect'; it names its own replacement in its
	//         own title, and the manifest kept pointing at it regardless.
	//   012 — REMOVED, not re-cited. It was an OVERCLAIM of the exact shape this register was built for: a
	//         PURE_KERNEL unit test over hand-built object literals, certifying a rule that is enforced NOWHERE.
	//         The interrupted-attempt classifier it exercises has two repo-wide references, its definition and
	//         that test. The rule is now UNENFORCED_DISCLOSED in the enforcement register, and the register's
	//         overclaim gate refuses to let a disclosed rule be certified COVERED.
	//
	//         THE CLASSIFIER IS DELIBERATELY NOT NAMED IN THIS COMMENT, and the reason is a finding in itself:
	//         writing the bare identifier here turned the register's own dead-predicate census RED, because the
	//         census greps PRODUCTION FILES and this is one. That is the gate behaving correctly — but the fix is
	//         to keep prose out of the census, not to widen the baseline to admit a doc comment. A census whose
	//         declared set includes a sentence about the symbol can no longer detect the wiring it exists to
	//         detect, which is the precondition the DEAD_PREDICATE arm already gates for handler files.
	'RPH-PER-001': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PER-002': 'packages/rph-engine/src/engine.test.ts',
	'RPH-PER-007': 'packages/rph-engine/src/projection-rebuild.test.ts'
};

/** Prefix-level coverage. `testFile` may be a glob/multi-file description for by-concern families; the concrete
 *  single-file cites live in COVERED_BY_ID. */
const COVERAGE_BY_PREFIX: Readonly<Record<string, Coverage>> = {
	// Fully COVERED — the M9/M10/M11 kernel families, every id asserted by name.
	'RPH-DEC': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-DEC-001..007 by id'
	},
	'RPH-CNS': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-CNS-001..004 by id (004 also in governance.test.ts)'
	},
	'RPH-ASM': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-ASM-001..006 by id'
	},
	'RPH-GOV': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'RPH-GOV-001..007 by id'
	},
	'RPH-BAS': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'RPH-BAS-002..007 by id; BAS-001 via the item-shape happy path'
	},

	// PARTIAL — core asserted, specific ids pending (audited by the M12 review; honest split).
	'RPH-EXE': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/execution.test.ts',
		// DOWNGRADED from COVERED by WP-16's layer gate, and the downgrade is the finding. "RPH-EXE-001..009 by id"
		// was true of the PREDICATES and false of the ENGINE: ~~EXE-003 (binding not authorized),~~ ~~EXE-005
		// (preconditions before READY)~~ and EXE-004 (granted != requested capability) were implemented as correct,
		// unit-tested kernel functions with NO production caller — the same shape as PWU-010 before WP-12b, and in
		// the same family. They are disclosed in `enforcement-register.ts` with a checked call-site census rather
		// than fixed here: wiring a new refusal is a behaviour change owing its own kill test.
		//
		// EXE-005 STRUCK 2026-07-26: CLOSED by JAN-CAPBIND WP-3 (the `inputReadiness` column, enforced at both
		// arrows into RUNNING) and mirrored in the read-model by N-21. Struck rather than deleted, per the same
		// standard as EXE-003 below, so a reader sees the claim existed and when it stopped being true.
		//
		// EXE-003 STRUCK 2026-07-26 (finding N-13). It was CLOSED by JAN-EXEBIND WP-B1 and re-sited by JAN-REVREM
		// RW-0/RW-3/RW-6, so this comment had been asserting for several commits that a rule with a live production
		// caller has none — while `COVERED_BY_ID` forty lines above certifies it at the COMMAND layer, the `note`
		// immediately below lists it among the command-layer assertions, and
		// `ENFORCEMENT_REGISTER['RPH-EXE-003'].kind === 'ENFORCED'` carries no `referencedOnlyBy` census at all
		// (that field exists only on `UnenforcedRule`). Three records inside one object literal disagreeing about one
		// rule, in the artefact whose over-claiming produced this defect family — and §7 of the residuals register
		// already had to correct three artefacts disagreeing about RPH-PWU-010 in exactly this way.
		//
		// NO GATE CATCHES THIS, and that is the durable part: `enforcement-register.test.ts` asserts
		// `coverageFor(id).status` and `.testFile`, so it reads the STRUCTURED rows and never the PROSE beside them.
		// A comment cannot be type-checked, which is precisely why a stale one outlives the condition it describes.
		// Found by a fresh adversarial review re-deriving what an earlier review's lost MINOR findings might have
		// been (ruling R13) — not by the gate that certifies this file.
		note:
			'EXE-001/002/003/005/006/008 asserted BY ID AT THE COMMAND LAYER (see COVERED_BY_ID); EXE-007/009 are ' +
			'not command refusals (dispositioned in enforcement-register.ts); EXE-004 remains UNENFORCED. THIS NOTE ' +
			'WAS STALE TWICE and was corrected 2026-07-26 (N-19): it claimed EXE-005 unenforced after JAN-CAPBIND ' +
			'WP-3 closed it, and gave BOTH rules a reason — "their subjects are declared Source TBD, so the rules ' +
			'have nothing to quantify over" — that JAN-CAPBIND falsified by authoring InputBinding, ' +
			'CapabilityRequest and CapabilityGrant under sponsor grant. The real disposition of EXE-004 is a ' +
			'BOUNDARY, ' +
			'not a corpus gap: its statement is about an OPERATION AT OPERATION TIME, and this engine is never in ' +
			'the path of an operation; the corpus names the Runtime Authorization Service (§33.4) as the enforcer. ' +
			'Its decidable DECLARATION half (granted within requested) is enforced; the OPERATION half is the ' +
			'Platform. See enforcement-register.ts for the three-tier account and the R1 ruling.'
	},
	'RPH-CON': {
		status: 'PARTIAL',
		testFile: 'packages/rph-contracts/src/*.test.ts',
		note: 'CON-001/002/004/008 by id; schema/enum/hash/id fidelity by concern; CON-003/005/006/007 pending explicit assertions'
	},
	'RPH-INT': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/{transitions,binding}.test.ts',
		// NOTE CORRECTED 2026-08-02 by the enforcement-register RPH-INT tranche. The old text listed
		// "INT-004/005/006/007 … pending an Intent-aggregate test", which was stale in both directions: INT-004 and
		// INT-005 are ENFORCED and now cited by id above (both refused by approveIntent's precheck, in that order),
		// while INT-006 and INT-007 are not pending a test at all — the register disposes them as
		// NOT_A_COMMAND_REFUSAL, INT-006 because its six consequents are outcomes (two of which need an
		// impact-analysis plane that does not exist) and INT-007 because its antecedent is command-unreachable.
		note: 'INT-003/004/005 ENFORCED and cited by id above; INT-001/002/006/007 are NOT_A_COMMAND_REFUSAL in enforcement-register.ts (INT-001/002 describe what an accepted command produces; INT-006 enumerates outcomes; INT-007 has a command-unreachable antecedent). The enforcement question is answered in the register, not by this row.'
	},
	'RPH-PWU': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/pwuGuards.test.ts',
		note: 'four-axis guards + P1/INV-5 + PWU-005/007/010 (by id); the command guards PWU-002/003/004 pending (rph-application)'
	},
	'RPH-ASR': {
		status: 'PARTIAL',
		testFile: 'packages/rph-assurance/src/assurance-rules.test.ts',
		note: 'disposition ladder / strictest-unresolved / independence / waiver / validator classification asserted (by Inv-N/§ labels); ASR-001 (request on EVIDENCE_PENDING) and ASR-009 (condition visibility) pending'
	},
	'RPH-EVD': {
		status: 'PARTIAL',
		testFile: 'packages/rph-assurance/src/assurance-rules.test.ts',
		// NOTE CORRECTED 2026-08-01 by the enforcement-register RPH-EVD tranche, and the old text was wrong in both
		// directions — which is why the register exists. It claimed "EVD-003/004 asserted" on the strength of a
		// PURE_KERNEL predicate test; both are now dispositioned UNENFORCED_DISCLOSED and OBSERVED being admitted
		// through a live dispatch. It also claimed "the EVD-005 cascade pending", which JAN-EXECREM WIRE #4 had
		// already closed to the extent the rule permits (the impact is recorded on the event; the state changes the
		// rule names are command-unreachable). Per-family status stays PARTIAL: only EVD-007 is enforced.
		note: 'EVD-007 (admission evaluates the evidence) ENFORCED and cited by id above; EVD-001/003/004 are dispositioned UNENFORCED_DISCLOSED in enforcement-register.ts with observed admissions; EVD-002/005/006 are NOT_A_COMMAND_REFUSAL there. The kernel predicate is asserted here; the enforcement question is answered in the register, not by this row.'
	},
	'RPH-TRC': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/traceability.test.ts',
		note: 'directionality + invalidation cascade + graph queries asserted; TRC-002 (constraint-propagation path) and TRC-003 (unsupported-object detection) pending'
	},
	'RPH-PRJ': {
		status: 'PARTIAL',
		testFile: 'packages/rph-projections/src/work-projection.test.ts',
		note: 'PRJ-001/002 (no-green-without-assurance + fold/rebuild) asserted; PRJ-003/005 → M14 UI surface; PRJ-004 = Property P8'
	},
	'RPH-PER': {
		status: 'PARTIAL',
		testFile: 'rph-persistence + rph-domain',
		note: 'idempotency/concurrency/replay-equivalence/restart-classification asserted (001/002/007/012); remaining restart-scenario conformance (011/013/014, 003-006/008-010) completes with the M13 replay harness'
	},

	// ── REG-F-013, CORRECTED 2026-08-02 ──────────────────────────────────────────────────────────────────────
	//
	// This row read `status: 'DEFERRED'` with the note "dual-run/shadow comparison classification — migration
	// apparatus, explicitly OUT of 0.1.x (D2) / MP scope", and `RPH-CMP` sat in `DEFERRABLE_PREFIXES` — the set
	// whose entire job is that nothing else sneaks into DEFERRED. Four ratified rules were exempted from the gate
	// by name, and BOTH halves of the reason were wrong.
	//
	// THE FAMILY IS NOT WHAT THE NOTE SAID. RPH-CMP-001..004 are compatibility MILESTONE rules (INTAKE = COMPLETE
	// derivation, phase is non-authoritative, ARCHITECTURE = COMPLETE while the root PWU is not, REPLAN derived
	// from a control action). None is about dual-run, shadow comparison, or migration. The conformance catalog's
	// own layer table puts RPH-CMP in layer 6 and calls it "the non-authoritative compatibility projection".
	// D2 IS REAL and correctly recorded elsewhere — the roadmap drops RPH-DOC-009 §21-29 "Persistence, Migration,
	// Dual-Run, Cutover" under it — but those dropped sections and these §22 rules are different subjects.
	//
	// AND IT WAS STALE ANYWAY. The roadmap separately tagged the M5 Compatibility projection "conceptual only
	// (D2)", which is the likelier origin. It stopped being conceptual in W2-INC-3 (WP-2-006):
	// `packages/rph-projections/src/compatibility-view.ts` is a real Projector<V> folded from events, with
	// `CompatibilityMilestone` a ratified contract enum.
	//
	// WHY THIS MATTERED MORE THAN THE FOUR MISCITES FOUND THE SAME DAY: a wrong `testFile` leaves the rule inside
	// the gate, where the enforcement register can catch the overclaim — which is how RPH-PWU-010, RPH-PWU-007,
	// RPH-CON-004 and RPH-PER-012 were all found. A DEFERRABLE_PREFIXES entry removes the family from the question,
	// so there is no claim left to over-. It is the one manifest defect the overclaim gate is structurally blind to.
	'RPH-CMP': {
		status: 'PARTIAL',
		testFile: 'packages/rph-projections/src/traceability-compatibility.test.ts',
		note: 'The BASELINE kind -> milestone derivation is built and folded from events (compatibility-view.ts, W2-INC-3/WP-2-006), so CMP-001/003 have a real mechanism asserted; CMP-002/004 are dispositioned NOT_A_COMMAND_REFUSAL in enforcement-register.ts (no command can set a phase — there is no such field or command anywhere). GENUINELY OUTSTANDING, with a named work package rather than a mistaken one: W5 WP-5-003 "Compatibility Milestone Derivation", the VERSIONED rules that advance a milestone as a PWU progresses through its four axes. That is what a legitimate deferral looks like (REG-F-013).'
	},
	'RPH-FIX': {
		status: 'DEFERRED',
		note: 'field-service fixture replay (expected-events.jsonl) — the M13 Reference Undertaking replay harness'
	},
	'RPH-E2E': {
		status: 'DEFERRED',
		note: 'full end-to-end scenarios — the M13 Reference Undertaking replay + M14 surface'
	}
};

/**
 * The families that may legitimately be DEFERRED (integration/e2e). The gate asserts nothing else sneaks into
 * DEFERRED.
 *
 * `RPH-CMP` REMOVED 2026-08-02 (REG-F-013). It was exempted here on a rationale naming a different concern
 * (DOC-009's dropped dual-run/migration sections) and stale regardless (the compatibility projection was built in
 * W2-INC-3). THIS SET IS THE MOST DANGEROUS DATA IN THE FILE, and the removal is the occasion to say so: an entry
 * here does not weaken a claim, it DELETES the claim, and the enforcement register's overclaim gate — which has
 * caught four bad certifications — cannot see a family that certifies nothing. Everything else in this module
 * fails LOUDLY when wrong; a wrong entry here fails silently, forever.
 */
export const DEFERRABLE_PREFIXES: ReadonlySet<string> = new Set(['RPH-FIX', 'RPH-E2E']);

/** Properties P1–P8 are all asserted generatively in properties.test.ts. */
export const PROPERTY_COVERAGE: Readonly<Record<string, string>> = {
	P1: 'packages/rph-domain/src/properties.test.ts',
	P2: 'packages/rph-domain/src/properties.test.ts',
	P3: 'packages/rph-domain/src/properties.test.ts',
	P4: 'packages/rph-domain/src/properties.test.ts',
	P5: 'packages/rph-domain/src/properties.test.ts',
	P6: 'packages/rph-domain/src/properties.test.ts',
	P7: 'packages/rph-domain/src/properties.test.ts',
	P8: 'packages/rph-domain/src/properties.test.ts'
};

/** The rule-id prefix, e.g. "RPH-DEC-003" -> "RPH-DEC", "RPH-E2E-001" -> "RPH-E2E" (prefix may contain a digit). */
export function prefixOf(ruleId: string): string {
	const m = /^(RPH-[A-Z0-9]+)-\d+$/.exec(ruleId);
	return m ? m[1]! : ruleId;
}

/**
 * Resolve the coverage of a single RPH-* rule id. Per-id coverage wins; otherwise the family's prefix status
 * applies. A rule that resolves to `undefined` is UNACCOUNTED — the conformance gate fails on it.
 */
export function coverageFor(ruleId: string): Coverage | undefined {
	if (COVERED_BY_ID[ruleId]) return { status: 'COVERED', testFile: COVERED_BY_ID[ruleId] };
	return COVERAGE_BY_PREFIX[prefixOf(ruleId)];
}

/** Every concrete single-file test path the manifest cites (for the gate's on-disk existence check). Glob/multi
 *  descriptions are excluded — only real *.test.ts paths. */
export function citedConcreteTestFiles(): string[] {
	const files = new Set<string>();
	for (const f of Object.values(COVERED_BY_ID)) files.add(f);
	for (const c of Object.values(COVERAGE_BY_PREFIX))
		if (c.testFile && c.testFile.endsWith('.test.ts') && !/[*{}]/.test(c.testFile))
			files.add(c.testFile);
	return [...files];
}
