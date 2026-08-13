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
	// The RPH-INT tranche (2026-08-02). ~~Three~~ FOUR of seven are ENFORCED and cite their probes; the other
	// ~~four~~ THREE are NOT_A_COMMAND_REFUSAL and carry no per-id row, because their statements describe what an
	// ACCEPTED command produces rather than anything a dispatch could be refused for.
	//
	// ⚠ RPH-INT-007 JOINED ON 2026-08-13 (REG-F-132) AND ITS ABSENCE UNTIL THEN WAS CORRECT. Its rule — "a
	// superseded intent cannot authorize new PWUs" — was NOT_A_COMMAND_REFUSAL because its ANTECEDENT was
	// command-unreachable: nothing could put an Intent into SUPERSEDED, so no dispatch could be refused for it.
	// `SupersedeIntent` (REG-F-131) made the arrangement dispatchable and the guard that had been waiting since
	// REG-F-129 finally has something to refuse. The cited probe DRIVES the supersession through the bus rather
	// than seeding the status, which is what lets this row cite a COMMAND-layer observation at all.
	'RPH-INT-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-INT-004': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-INT-005': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-INT-007': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
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
	// RPH-ASM-006 — the only ASM rule with a live kernel caller, cited per-id with its dispatch probe. Its five
	// siblings have no caller at all, which is why this is the family's only COMMAND-layer cite.
	'RPH-ASM-006': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// The four PROMOTION-GATE rows, cited per-id 2026-08-02 with their dispatch probes. BAS-003/004/006 share one
	// joined finding-code message; GOV-003 refuses at a later arm of the same handler with its own sentence.
	'RPH-BAS-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-BAS-004': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-BAS-006': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-GOV-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// The three CONSERVATION rows, cited per-id 2026-08-02 when their dispatch probes landed. All three refuse at
	// ONE site with ONE message and are distinguished by the finding code it carries — proved independent by a
	// mutant that deletes a single arm and reddens exactly one row. The family prefix rows still cite the kernel
	// test, which remains true and remains insufficient for an ENFORCED claim; that is the layer gate's whole point.
	'RPH-DEC-002': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-DEC-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-CNS-003': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// RPH-GOV-001 — re-cited from the PURE_KERNEL family file to the dispatch probe, because the register records
	// it ENFORCED and the layer gate requires COMMAND-layer evidence for that claim. The kernel test still stands
	// and still proves what it proved; it just does not prove enforcement.
	'RPH-GOV-001': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	// RPH-GOV-005 — waiver scope, cited per-id 2026-08-03 with its dispatch probe. THE CITE MOVED FOR A REASON WORTH
	// RECORDING: the natural home looked like floor-waiver-scope.test.ts, whose entire subject is this rule. That
	// file's two tests were arranging NOTHING — no floor policies seeded, so every assessment was refused — and both
	// passed because a PWA with no floor is refused publication anyway (REG-F-015). The dispatch probe is cited
	// instead, and the repaired scope file now carries the object/version/policy limbs with named predicted reds.
	'RPH-GOV-005': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PER-001': 'packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts',
	'RPH-PER-002': 'packages/rph-engine/src/engine.test.ts',
	'RPH-PER-007': 'packages/rph-engine/src/projection-rebuild.test.ts'
};

/** Prefix-level coverage. `testFile` may be a glob/multi-file description for by-concern families; the concrete
 *  single-file cites live in COVERED_BY_ID. */
const COVERAGE_BY_PREFIX: Readonly<Record<string, Coverage>> = {
	// Fully COVERED — the M9/M10/M11 kernel families, every id asserted by name.
	// ── CORRECTED 2026-08-02 — THE OVERCLAIM GATE'S EIGHTH CATCH, AND THE FOURTH FAMILY IN A DAY ────────────
	//
	// Both rows read COVERED "by id" on a PURE_KERNEL file. The register disposed RPH-DEC-004
	// UNENFORCED_DISCLOSED and the gate rejected the pair. RPH-CNS is re-stated in the same edit — not because a
	// gate forced it, but because leaving it COVERED while three of its four rules are dispositioned
	// NOT_A_COMMAND_REFUSAL would be the same claim the gate just refused, one rule short of tripping it.
	//
	// WHAT THE CITED TESTS PROVE IS REAL, AND IS NOT ENFORCEMENT. decomposition.test.ts asserts the kernel
	// predicates return the right findings; they do. What no pure test can see is which of those predicates the
	// running engine ever asks, and with what. For RPH-CNS-001/002 the answer is sharper than "nothing asks":
	// the arm reads a field that the wire schema — a strictObject — does not carry and would refuse.
	'RPH-DEC': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'DEC-002/003 are ENFORCED in enforcement-register.ts at checkDecompositionConservation, distinguished by the finding code their shared refusal message carries (their dispatch probes are owed). DEC-004 is UNENFORCED_DISCLOSED with a dead-predicate census. DEC-005 is a disclosure owing its observation — nothing reads a recomposition contract before marking a decomposition VALID. DEC-001/006/007 are NOT_A_COMMAND_REFUSAL: a permission, an outcome cascade, and a property restatement that cannot be a second ENFORCED row because it would share DEC-002\'s only finding code and therefore its marker.'
	},
	'RPH-CNS': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'CNS-003 is ENFORCED (the INAPPLICABLE_WITHOUT_RATIONALE arm is reachable from dispatch — its probe is owed). CNS-001/002/004 are NOT_A_COMMAND_REFUSAL, and for a stronger reason than "unwired": their kernel arms read propagatedStrength and waiverExpired, and ConstraintPropagationSchema is a strictObject carrying NEITHER. No dispatch can express the arrangement, so the antecedents are unreachable rather than unguarded. The shape must be authored before the rules can be enforced.'
	},
	// ── CORRECTED 2026-08-02 — THE OVERCLAIM GATE'S SEVENTH CATCH, AND THE THIRD FAMILY IN A DAY ────────────
	//
	// This row read COVERED, "RPH-ASM-001..006 by id", on a PURE_KERNEL file. The register disposed RPH-ASM-002
	// and RPH-ASM-005 UNENFORCED_DISCLOSED — each with a dead-predicate census — and the gate rejected the pair.
	//
	// THE FAMILY-LEVEL FACT IS THE ONE WORTH CARRYING: FIVE of the six ASM rules have a dedicated kernel predicate
	// referenced by exactly one non-test file — its own definition module, rph-domain/src/decomposition.ts. Only
	// the authorize-new-work predicate behind ASM-006 has a live caller. The cited test file is honest and its
	// assertions hold; what it cannot see is that nothing in the running engine asks any of the other five. That
	// is DS-001 §4 item 2 at family scale rather than rule scale.
	//
	// THE PREDICATES ARE DELIBERATELY NOT NAMED HERE, for the second time in this file. Writing a dead predicate's
	// bare identifier into any production source — this manifest included — ADDS that file to the census the
	// enforcement register greps, and turns the row's own dead-predicate gate RED. It happened again on this
	// tranche. The register names them, once each, in the rows that disclose them; that is the only place a
	// census-bearing symbol belongs.
	'RPH-ASM': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'ASM-006 is ENFORCED in enforcement-register.ts (approveExecutionPlan refuses a plan authorizing work for a PWU whose assumption is expired, falsified or superseded; its dispatch probe is owed). ASM-002 and ASM-005 are UNENFORCED_DISCLOSED, each guarded by a dead-predicate census over a kernel function whose only non-test reference is its own definition. ASM-001/003/004 are NOT_A_COMMAND_REFUSAL: their triggering acts are not dispatchable, since only DetectAssumption and ExpireAssumption exist and the arrows into ACCEPTED/VERIFIED/FALSIFIED are authored but command-unreachable.'
	},
	// ── A LAYER OBSERVATION, RECORDED 2026-08-02 WHILE DISPOSITIONING RPH-GOV-001 ────────────────────────────
	//
	// This row says COVERED and cites a PURE_KERNEL file for all seven rules. The register's layer gate rejected
	// that the moment RPH-GOV-001 was recorded ENFORCED, which is the gate working — but the fact underneath is
	// worth more than the fix, so it is written here rather than only in a commit message.
	//
	// The cited test for RPH-GOV-001 reads, in full:
	//     authorizeDecisionEffective(decision({ status: 'PROPOSED', authorityHeld: false }))
	// It passes `authorityHeld` IN, as a hand-written boolean, and asserts the pure function returns the right
	// code. It never asks WHO COMPUTES `authorityHeld`, or whether anything does. That is DS-001 §4 item 2 in its
	// purest form: the predicate is correct, the test is honest, and the question of enforcement is assumed away
	// by the fixture. It is also exactly the question REG-F-014 turns out to answer badly — the handler computes
	// `authorityHeld` from a field the CALLER supplies about itself.
	//
	// RPH-BAS (same file) and RPH-ASM (decomposition.test.ts) are both COVERED on PURE_KERNEL evidence too, by id,
	// for 13 more rules. Their per-id status is NOT being changed here: what layer a test observes is a fact, but
	// whether each rule is enforced is a judgement the enforcement register makes one rule at a time, and 19 of
	// these 20 are not yet dispositioned. Recording the observation without pre-judging them is the honest half.
	// RE-STATED 2026-08-02, and the delay is itself worth recording. When GOV-001 landed, this row's NOTE was
	// corrected while its STATUS was deliberately left COVERED, on the stated grounds that "GOV-002..007 are under
	// investigation; this prefix row will be re-stated when they land". Five of the seven have now landed — and
	// the status had NOT moved, so three rules dispositioned NOT_A_COMMAND_REFUSAL were still being certified
	// COVERED by this row.
	//
	// NO GATE CAUGHT THAT. The overclaim gate only refuses a DISCLOSED rule certified COVERED, and arm-3 rules are
	// not disclosures. What surfaced it was the exact-count ratchet: adding three per-id cites should have moved
	// the number by three, the arithmetic did not reconcile, and chasing the discrepancy found this row. A ratchet
	// whose only job is "say why the number changed" caught a stale status that no dedicated gate was watching.
	'RPH-GOV': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'CLOSED 7/7 2026-08-03. GOV-001, GOV-003 and GOV-005 are ENFORCED and cited per-id to COMMAND-layer dispatch probes; GOV-001 carries a live bypass recorded as REG-F-014, GOV-003 the same shape on approval versions, and GOV-005 is enforced INVERSELY (nothing refuses "out of scope" — the floor gate refuses the publish, and the waiver\'s scope decides whether it does), with its object limb enforced by a filter rather than by the predicate that appears to enforce it. GOV-002/004/007 are NOT_A_COMMAND_REFUSAL — GOV-002 deliberately so, because it would otherwise share GOV-001\'s single refusal site and one mutant would redden both. GOV-006 is UNENFORCED_DISCLOSED and OBSERVED: canPromoteBaseline\'s findExpiredWaivers is called on every promotion but `requiredWaivers` is never supplied, and no field anywhere marks a waiver as required BY a promotion — so an expired waiver is invisible at promotion while the same expiry IS honoured at the publication floor. All seven were previously COVERED on PURE_KERNEL evidence.'
	},
	// ── CORRECTED 2026-08-02 — THE OVERCLAIM GATE'S SIXTH CATCH ─────────────────────────────────────────────
	//
	// This row read `status: 'COVERED'`, "RPH-BAS-002..007 by id". The enforcement register disposed RPH-BAS-002
	// UNENFORCED_DISCLOSED — nothing performs it — and the register's overclaim gate rejected the pair on the
	// commit that landed the disclosure. Same mechanism that caught RPH-PWU-010 (which motivated the register),
	// RPH-PWU-007, RPH-CON-004, RPH-PER-012 and RPH-GOV-001's layer.
	//
	// WHAT THE CITED TEST PROVES, and it is not nothing: `governance.test.ts` calls `canPromoteBaseline` directly
	// with DISTINCT candidate and reviewed arrays, so the kernel arm really does return BASELINE_VERSION_MISMATCH.
	// The predicate is correct. What no test asked is what the PRODUCTION CALL SITE hands it — one array, passed
	// as both arguments — so the arm cannot fire in any dispatch. A pure-function test cannot see that, which is
	// the whole thesis of DS-001 §4 item 2.
	'RPH-BAS': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'BAS-003/004/006 have live refusals and are dispositioned ENFORCED in enforcement-register.ts (their dispatch probes are owed). BAS-005/007 and BAS-001 are NOT_A_COMMAND_REFUSAL there — no command can mutate a baseline item set, the supersession postconditions are outcomes, and BAS-001 is a shape assertion whose kernel arm is SCHEMA-FORECLOSED. BAS-002 is UNENFORCED_DISCLOSED with an observed admission: `promoteBaseline` passes one array as BOTH `candidateItems` and `reviewedItems`, so `findVersionMismatches` compares each item to itself, and a promotion naming version 999 against a baseline frozen at 1 is ACCEPTED. The kernel unit test passes DISTINCT arrays and therefore cannot see it.'
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
	// REG-F-019, 2026-08-04. This read `status: 'DEFERRED'` with the note "field-service fixture replay
	// (expected-events.jsonl) — the M13 Reference Undertaking replay harness", describing as FUTURE WORK a harness
	// that exists (`packages/rph-engine/src/replay.ts`) and a fixture that exists
	// (`packages/rph-engine/fixtures/expected-events.jsonl`, 72 events) — and that have been running named,
	// PASSING checks for four of these six rules the whole time.
	//
	// AN UNDERCLAIM, WHICH IS THE DIRECTION NOTHING COULD SEE. REG-F-013 caught RPH-CMP here because its rationale
	// named a different concern; the enforcement register's overclaim gate catches a family that certifies MORE
	// than it proves. Nothing caught a family that certifies LESS, because an exempt family makes no claim to
	// check. `verif/deferral-honesty.test.ts` closes that direction by RUNNING the harness rather than reading its
	// note.
	'RPH-FIX': {
		status: 'COVERED',
		testFile: 'packages/rph-engine/src/replay.test.ts',
		note: 'ALL SIX ARE ASSERTED BY NAME, across TWO oracles because the rules are of two kinds. FOUR are properties of the §26 event SEQUENCE, in `runConformance` (packages/rph-engine/src/replay.ts), green in replay.test.ts: FIX-001 (contiguous seq — reference integrity), FIX-002 (every one of the 72 trace events resolves to a registered EVENTS contract), FIX-003a/b/c (both baselines promoted; the trace ends AUTHORITATIVE + PwuBaselined; a Behavior PWU SATISFIED but not baselined), FIX-006 (the deferred offline capability stays represented as a refined intent constraint). TWO are properties of the OBJECT GRAPH and are asserted in `runGraphConformance` (graph-conformance.ts) over the store `driveReferenceUndertaking` builds. FIX-004: every MANDATORY obligation sourced from the Architecture PWU is allocated to a child of its decomposition, or explicitly retained (DOC-003 §6 DEC-3 permits retention, and a bare "all allocated" reading would wrongly refuse it) — IT WOULD HAVE PASSED VACUOUSLY, since every PWU was proposed with `obligationIds: []`, so the drive now AUTHORS the three obligations corpus §25 Test 3 names as traceability targets and the check treats an empty population as a FAILURE. FIX-005: the corpus §25 chain, WALKED hop by hop — Constraint, Constraint->PWU (`constraintIds`), PWU->Artifact (`producingPwuId`), Artifact->Claim (`subjectObjectIds`), Claim->Assessment (`claimIds`) — because the rule says the fixture EXPOSES the trace, and five objects each existing separately would satisfy an existence check while exposing nothing. Each hop has its own mutant. Both were CLOSED 2026-08-04 (REG-F-019); recording the drive\'s first ever artifact exposed REG-F-020.'
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
 *
 * `RPH-FIX` REMOVED 2026-08-04 (REG-F-019), for the OPPOSITE reason and it is the more instructive one. RPH-CMP
 * was deferred on a bad rationale; RPH-FIX was deferred while FOUR of its six rules had named, running, GREEN
 * checks — the manifest claiming LESS than the repository proves. An overclaim is caught by the enforcement
 * register. An UNDERCLAIM was caught by nothing, for exactly the reason the paragraph above gives: an exempt
 * family makes no claim to check. `verif/deferral-honesty.test.ts` now closes that direction by RUNNING the
 * replay harness and refusing to let a rule with a passing check be certified DEFERRED.
 *
 * ONE ENTRY REMAINS, AND ITS DEFERRAL IS REAL — checked in both directions rather than assumed by association.
 * No `RPH-E2E` rule id appears in any check, any test, or any source file in this repository; the seven scenarios
 * are genuinely unbuilt. The asymmetry is the point: two families sat here under one sentence, and only one of
 * them belonged.
 */
export const DEFERRABLE_PREFIXES: ReadonlySet<string> = new Set(['RPH-E2E']);

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
