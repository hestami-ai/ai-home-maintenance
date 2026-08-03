// The ENFORCEMENT REGISTER (JAN-EXECREM WP-16 / SM-6, gate (c)) — pure data plus the analysis primitives that
// read it. No behaviour, no I/O.
//
// WHY THIS EXISTS — AND WHY THE COVERAGE MANIFEST COULD NOT BE FIXED IN PLACE.
//
// DS-001 §4 item 2: "the conformance gate certified an unenforced rule." `conformance-manifest.ts` maps a rule to
// SOME test file and has no notion of LAYER — it cannot tell a pure-predicate unit test from an `Engine.dispatch`
// test. RPH-PWU-010's ratified statement is "a BASELINED PWU cannot resume execution"; its cited coverage was
// `packages/rph-domain/src/execution.test.ts`, a call to a pure function that had, repo-wide, exactly two
// references: its own definition and that test. The rule was ratified, certified COVERED, and enforced NOWHERE.
//
// A manifest row cannot express that, because it has only ONE axis — "is it tested?" — and the answer was
// truthfully yes. The missing axes are: WHERE is it enforced, at WHAT LAYER is the evidence, and — the one no
// coverage model has — IS IT ENFORCED AT ALL. A register with no way to say NOT ENFORCED will always launder an
// unenforced rule into a green build, because the only vocabulary it has is degrees of covered.
//
// So the register is a THREE-WAY disposition, and the third arm is the point:
//
//   ENFORCED               a named production site refuses, OBSERVED end-to-end through Engine.dispatch — never
//                          inferred from a unit test, which is the exact substitution that produced this family.
//   UNENFORCED_DISCLOSED   the statement IS a command refusal and NOTHING in production enforces it. Not a
//                          wish-list entry — a recorded, gated fact, backed by a call-site census the gate CHECKS (see
//                          `referencedOnlyBy`). Wiring the predicate changes the census and turns the gate RED,
//                          demanding the row be re-dispositioned to ENFORCED with a probe. The disclosure cannot
//                          quietly outlive the condition it discloses.
//   NOT_A_COMMAND_REFUSAL  the statement asserts an outcome, a permission, or a plane that does not exist. A
//                          declared silence with a reason, so it is distinguishable from an omission.
//
// SCOPE, DERIVED RATHER THAN CHOSEN, AND CURRENT AS OF 2026-08-03. The register is TOTAL over FIFTEEN families of
// the ratified catalog (`packages/rph-domain/vocab/m12-conformance.json`) — `RPH-EXE`, `RPH-EVD`, `RPH-ASR`,
// `RPH-INT`, `RPH-PWU`, `RPH-CON`, `RPH-PER`, `RPH-PRJ`, `RPH-TRC`, `RPH-CMP`, `RPH-DEC`, `RPH-CNS`, `RPH-ASM`,
// `RPH-BAS`, `RPH-GOV` — which is **112 of the catalog's 125 rules, and the CEILING of what this instrument can
// reach**. A new rule in any of the fifteen with no row is a FAILING TEST, not a discovery, and the families are
// listed as DATA in `enforcement-register.test.ts` (`TOTAL_OVER_FAMILIES`) rather than hard-coded in a filter, so a
// family cannot be silently dropped from the gate either. The number is derivable from this file and the catalog;
// it is not chosen.
//
// A FAMILY'S ABSENCE FROM THAT LIST IS ITSELF A CLAIM, and twice it has been a load-bearing one. RPH-PWU held 5,
// then 8, then 9 of its ten rules across three commits, and RPH-PER held 12 of 14 for one, each staying OUT of
// `TOTAL_OVER_FAMILIES` on purpose: the outstanding rows were UNENFORCED_DISCLOSED with OBSERVED_ADMISSION guards,
// and landing a disclosure without its observation is the one thing that arm may never do. "Not yet total" was
// gated rather than asserted.
//
// THE 13 RULES NOT DISPOSED, counted rather than gestured at, because a scope paragraph that goes stale is the
// exact drift this module exists to prevent — and this one HAS gone stale twice: once still listing
// RPH-PER/PRJ/TRC/CON as owed after all four had closed, and once still claiming 31 rules were in reach after four
// of the five families in that list had been taken total. NOTHING IN REACH REMAINS OWED.
//
//   OUT OF REACH BY CONSTRUCTION — 13 rules: `RPH-FIX` (6) and `RPH-E2E` (7), the fixture-replay and end-to-end
//   scenario families. Both are legitimately DEFERRED in the conformance manifest with named work packages. They
//   are the only two prefixes left in `DEFERRABLE_PREFIXES`, and after REG-F-013 that set is treated as the most
//   dangerous data in the manifest: an entry there does not weaken a claim, it deletes it.
//
//   THE CEILING IS NOT COMPLETION, and this is the sentence most likely to be misread now that the number has
//   stopped moving. The thirteen are out of reach BY THIS INSTRUMENT, which observes COMMAND REFUSALS through
//   `Engine.dispatch`. A fixture-replay rule is not thereby enforced — it is unobservable here, which is a fact
//   about the register and not about the rule. Reaching them needs a different instrument (a replay harness that
//   can assert over a recorded event log), not another row in this file. The same distinction the disclosure arm
//   exists to keep visible, applied to the register itself.
//
// WHAT "TOTAL OVER FIFTEEN FAMILIES" DOES NOT MEAN, stated because the number invites the wrong reading: it means
// every rule in those families has a DISPOSITION, not that every rule is enforced. Of the 112 rows, 29 are
// ENFORCED, 25 are UNENFORCED_DISCLOSED and 58 are NOT_A_COMMAND_REFUSAL — so barely a QUARTER of the disposed
// catalog is a refusal the engine actually performs, and a MAJORITY states outcomes, permissions, or planes that do
// not exist. Including all fourteen read-model rules. The register's value is that those are now written down and
// gated, not that they are closed; the honest headline is 29, not 112.
//
// EACH EXTENSION FOUND A DIFFERENT SHAPE, which is the argument for extending rather than generalising early:
// RPH-EXE's gaps were dead predicates; RPH-EVD's and RPH-ASR's were refusals implemented at NEITHER layer, which
// cost a widening of the UNENFORCED arm (see `UnenforcementGuard`); RPH-INT's and RPH-PWU's non-enforced rows are
// mostly rules that state what a SUCCESSFUL command PRODUCES, which no refusal probe can hold at all.
//
// THE HONEST LIMIT (DS-001 §8 item 5). A deliberate widening edited consistently across production, this register,
// and the probe map PASSES. That is intended: it converts a silent one-character change into a three-file,
// justification-bearing, reviewable one. What it cannot do is let an omission through in silence.
import { STATE_MACHINES } from './transitions.data.js';
import type { StepCommandSpec } from './step-command-spec.js';

/**
 * The layer at which a cited test observes a rule.
 *
 * THIS IS THE AXIS THE MANIFEST WAS MISSING. A rule whose ratified statement is "the command is rejected" is
 * satisfied only by evidence at `COMMAND` — a dispatch through the engine. `PURE_KERNEL` evidence proves the
 * predicate computes the right answer; it says nothing about whether anything ASKS the predicate.
 */
export type CoverageLayer =
	| 'SCHEMA' // rph-contracts — envelope/payload shape
	| 'PURE_KERNEL' // rph-domain, rph-assurance — predicates and machines, no I/O
	| 'COMMAND' // rph-application, rph-engine — Engine.dispatch, the running surface
	| 'READ_MODEL' // rph-projections — folds over the event stream
	| 'STORE' // rph-persistence — the adapter
	| 'SURFACE' // apps/* — the projection surface a professional drives, observed end to end
	| 'UNKNOWN'; // an unrecognised path: fail closed, never assume COMMAND

/**
 * Path prefix -> the layer its tests observe. Ordered longest-first is unnecessary: the prefixes are disjoint by
 * construction (one package or app each).
 *
 * `apps/` ADDED 2026-07-28 (JPWB-SPEC-001 FORK-19, roadmap S-3). Until then this table mapped `packages/` only, so
 * `layerOfTestFile` fail-closed EVERY app path to `UNKNOWN` and no surface-layer obligation could be recorded as
 * enforced at all. That was not a policy — SPEC-001's fourteen invariants are surface obligations, and the
 * register that exists to say where a rule is enforced could not express their layer.
 *
 * WIDENING WHAT IS RECOGNISED IS NOT WIDENING WHAT IS ASSUMED. The fail-closed default below stays `UNKNOWN`; this
 * adds one more prefix that is positively recognised, and nothing else.
 */
const LAYER_BY_PACKAGE: readonly (readonly [string, CoverageLayer])[] = [
	['packages/rph-contracts/', 'SCHEMA'],
	['packages/rph-domain/', 'PURE_KERNEL'],
	['packages/rph-assurance/', 'PURE_KERNEL'],
	['packages/rph-application/', 'COMMAND'],
	['packages/rph-engine/', 'COMMAND'],
	['packages/rph-projections/', 'READ_MODEL'],
	['packages/rph-persistence/', 'STORE'],
	['apps/rph-demo/', 'SURFACE']
];

/**
 * Classify a repo-relative test path by the layer it observes.
 *
 * FAIL-CLOSED: an unrecognised path is `UNKNOWN`, never `COMMAND`. A gate that guessed COMMAND for a path it did
 * not recognise would certify exactly the claims it exists to check, which is the failure this module is about.
 */
export function layerOfTestFile(testFile: string): CoverageLayer {
	const normalised = testFile.replaceAll('\\', '/');
	for (const [prefix, layer] of LAYER_BY_PACKAGE) if (normalised.startsWith(prefix)) return layer;
	return 'UNKNOWN';
}

/**
 * Whether the CANON carries a registered rule's statement — the axis that decides what survives retirement.
 *
 * WHY THIS EXISTS. Every rule in this register is ratified in the PRE-CANON corpus: the statements come from the
 * Executable Invariant and Conformance Test Specification (`m12-conformance.json`, `sourceRef` §12 for RPH-EXE and
 * §8 for RPH-PWU), and the runtime invariants behind several of them come from RPH-DOC-002 §22.1. **The Canon
 * Ratify Sheet Part 4 approves retiring that entire corpus** — everything under `docs/` except `canon/` — to an
 * archive outside the agent-visible tree, subject to four preconditions, the second of which is a
 * shape-survivorship audit motivated by REG-F-005: *the source schemas are the independent "expected" that made
 * the gap detectable; they retire only after a verified transplant*.
 *
 * So a rule this engine enforces can lose its only readable statement, and NOTHING would report it. The register
 * already refuses to let an unenforced rule be laundered into a green build; this is the same refusal aimed one
 * layer out, at the rule's TEXT rather than at its enforcement.
 *
 * WHAT THE GATE CHECKS AND WHAT IT DELIBERATELY DOES NOT. It checks that `canonAnchor` OCCURS in one of the six
 * canon artifacts (`docs/canon/JPWB-{CON-000,DOC-001..004,REG-005}`, sidecars excluded — a `.provenance.md`
 * records where text came from, and letting provenance satisfy a carriage claim would let the map impersonate the
 * territory). It does NOT check that the anchor MEANS the rule: that is a judgment, and a gate pretending to make
 * it would be the vacuous assertion this whole programme is about. What it buys is exact: a canon edit that
 * removes a carrier turns the build RED, and no rule can enter the register without disposing its carriage.
 *
 * THE DISCLOSED COST: anchors are substrings, so a canon edit that REWORDS a carrier without changing its meaning
 * also goes red. That is the right polarity — a reworded carrier deserves a human confirming it still carries —
 * but it is a real maintenance cost, recorded here rather than discovered later.
 *
 * A SECOND, SUBTLER COST, found 2026-08-02 while verifying the RPH-PER anchors and recorded because it is the kind
 * of thing that reads as a gate passing. `JPWB-REG-005` — the Decision and Divergence Register — is one of the six
 * artifacts, and a FINDING that quotes a canon rule in order to report the engine VIOLATING it thereby creates
 * carriage for that rule. Three of the RPH-PER anchors matched REG-005 as well as DOC-003 for exactly that reason
 * (REG-F-012 quotes PER-5 verbatim). That is not a bug — the text genuinely survives retirement either way — but
 * a row must cite the artifact that STATES the rule, never the one that merely reports it broken, or the register
 * would eventually record a rule as carried by nothing but the note saying it is unenforced.
 */
export type CanonCarriage =
	| {
			/** A canon sentence states this rule — in different words, perhaps, but the same rule. */
			readonly kind: 'CARRIED';
			readonly canonAnchor: string;
			readonly note: string;
	  }
	| {
			/**
			 * Canon states a strictly MORE GENERAL rule of which this is an instance, and names this subject
			 * nowhere. Kept distinct from CARRIED because the difference is exactly what a reader may conclude: a
			 * general rule survives retirement, the specific application does not, and silently upgrading one to the
			 * other is how a register comes to report carriage it does not have.
			 */
			readonly kind: 'CARRIED_BY_GENERAL_RULE';
			readonly canonAnchor: string;
			readonly note: string;
	  }
	| {
			/** Nothing in canon states or generalises it. Retirement loses the rule's only textual home. */
			readonly kind: 'NO_CANON_CARRIER';
			readonly why: string;
	  };

/** A rule a named production site refuses, proved by observing that refusal through `Engine.dispatch`. */
export interface EnforcedRule {
	readonly kind: 'ENFORCED';
	/**
	 * Carriage is declared on ALL THREE arms, not on a shared base, so the COMPILER refuses a row that omits it.
	 * Totality by type beats totality by test here: a test can be skipped, a missing required field cannot be.
	 */
	readonly canonCarriage: CanonCarriage;
	/** The production module that performs the refusal. Prose, checked by a reader, not by the gate. */
	readonly enforcedAt: string;
	/** The `error.code` the refusal carries. */
	readonly refusalCode: string;
	/**
	 * Where the refusal happens. Absent = `COMMAND` (a handler), which is every row written before 2026-08-02.
	 * `SCHEMA` means the contract boundary refused and the outcome is `VALIDATION_FAILED`; see `classifyRefusal`
	 * for why that is opt-in rather than universal.
	 */
	readonly refusalLayer?: RefusalLayer;
	/**
	 * The `CommandResult.status` that IS this refusal. Absent = `REJECTED`, which is every COMMAND-layer row
	 * written before 2026-08-02.
	 *
	 * OPT-IN, AND THE MIRROR OF `controlStatus` ON THE DISCLOSURE ARM — same hazard, same remedy. This engine has
	 * FOUR refusing statuses, not one: `kit.ts`'s `STATUS_FOR_CODE` maps `RPH_VALIDATION_SCHEMA_FAILED` ->
	 * VALIDATION_FAILED, `RPH_REVISION_CONFLICT` -> CONFLICT and `RPH_AUTHORITY_INSUFFICIENT` -> UNAUTHORIZED,
	 * with everything else falling through to REJECTED. A row whose refusal carries one of the mapped codes was
	 * therefore UNCLASSIFIABLE by the COMMAND arm, which read `REJECTED` alone and reported a real, working
	 * refusal as ADMITTED — the same structural blindness that made RPH-CON read as inexpressible until the SCHEMA
	 * arm named it, now found one layer over at RPH-PER-001.
	 *
	 * `VALIDATION_FAILED` IS DELIBERATELY NOT A MEMBER, and the omission is the load-bearing part. A COMMAND row
	 * may not opt into being satisfied by a boundary refusal: that is what `refusalLayer: 'SCHEMA'` is for, and it
	 * ALSO changes how the marker is matched (structured `issues` by equality, not prose by substring) because the
	 * boundary's message is a constant that discriminates nothing. Folding the two axes into one would let a row
	 * claim command-layer enforcement while a merely MALFORMED payload greened it — six fixture errors this
	 * programme surfaced precisely because VALIDATION_FAILED is not a pass.
	 *
	 * `UNAUTHORIZED` ADDED 2026-08-02, AND THE ADDITION IS THE DISCIPLINE WORKING RATHER THAN AN EXCEPTION TO IT.
	 * This comment previously read: "`UNAUTHORIZED` is real and reachable and is NOT a member, for the opposite
	 * reason: no registered rule refuses with `RPH_AUTHORITY_INSUFFICIENT`. An arm no row exercises is an arm no
	 * mutant can redden… It goes in when a row needs it, with the probe that proves it." RPH-GOV-001 is that row,
	 * and it arrived within the day. The member is added here TOGETHER with its row and its observation, never
	 * ahead of them — which is the whole point of the rule that kept it out.
	 *
	 * `VALIDATION_FAILED` remains excluded, permanently and for a different reason: it is not a missing member, it
	 * is the SCHEMA layer's, and reaching it requires `refusalLayer` because the marker must be matched
	 * structurally rather than as prose.
	 */
	readonly refusalStatus?: 'REJECTED' | 'CONFLICT' | 'UNAUTHORIZED';
	/**
	 * A substring of the refusal MESSAGE that only THIS refusal produces.
	 *
	 * At least 20 characters and distinct across the whole register, both gated. Distinctness is what stops two
	 * rows being satisfied by one refusal — the failure mode where a probe arranged for rule B trips rule A's
	 * earlier guard and the register records two greens for one enforcement site.
	 */
	readonly refusalMarker: string;
	/** What to break to make this row's probe go RED. Data, so a reader can re-run the red proof. */
	readonly declaredMutations: readonly string[];
}

/**
 * THE DISCLOSURE'S OWN GUARD — what must stay true for "nothing enforces this" to remain true.
 *
 * WIDENED 2026-08-01 (the RPH-EVD tranche), and the widening is a FINDING, not a convenience. The original single
 * shape — name the dead predicate, census its production references — has a precondition its archetype happened to
 * satisfy and that nothing checked: `capabilityAuthorized`'s census is ONE file, its own definition, so wiring it
 * into a handler necessarily changes the set and reddens the row.
 *
 * That precondition FAILS for every RPH-EVD row. Measured with the gate's own algorithm, the candidate symbols'
 * baseline censuses ALREADY CONTAIN THE HANDLER FILE (`producedBy` 5 files incl. handlers/assurance.ts;
 * `parentCompletionClaimId` 3 incl. handlers/decomposition.ts; `admittedScope` 3 incl. handlers/assurance.ts). A
 * census whose baseline already contains the file the wiring would land in CANNOT DETECT THAT WIRING. Filing those
 * rows under `DEAD_PREDICATE` would have produced a guard that cannot fail — this repository's most-repeated defect,
 * shipped green — and filing them under NOT_A_COMMAND_REFUSAL to make the old type compile would have been the TYPE
 * DRIVING THE FINDING, converting an unmeasured gap into a falsely measured one.
 *
 * So the second shape does not compute over TEXT at all. It OBSERVES the admission: dispatch the arrangement the
 * rule says must be refused and watch the engine ACCEPT it. That is the ENFORCED arm's own instrument, inverted —
 * and it is strictly stronger than a census, because it reddens on the BEHAVIOUR changing rather than on a symbol
 * moving. The day someone wires the guard, the acceptance probe fails and the row must be re-dispositioned.
 */
export type UnenforcementGuard =
	| {
			/** A kernel predicate implements the rule correctly and NOTHING asks it. */
			readonly kind: 'DEAD_PREDICATE';
			readonly deadPredicate: string;
			/**
			 * Every NON-TEST source file that references `deadPredicate`, repo-relative.
			 *
			 * The gate greps the tree and asserts this set exactly — so the day someone wires the predicate into a
			 * handler, this row goes RED and must be re-dispositioned as ENFORCED with a probe. A prose disclosure
			 * would instead sit here being quietly false.
			 *
			 * ONLY VALID WHEN THE BASELINE EXCLUDES THE WIRING SITE, which is gated below: a census already
			 * containing a handler file cannot detect the wiring it exists to detect.
			 */
			readonly referencedOnlyBy: readonly string[];
	  }
	| {
			/**
			 * No predicate implements the rule at all, and the gap is proved by OBSERVING the engine accept what the
			 * rule says it must refuse — through `Engine.dispatch`, with a control.
			 */
			readonly kind: 'OBSERVED_ADMISSION';
			/** The arrangement the ratified statement says must be REFUSED, and which is observed ACCEPTED. */
			readonly arrangement: string;
			/**
			 * THE CONTROL, and it is the mirror of the ENFORCED arm's. There, the control is the same command
			 * ACCEPTED before the arranging act, so a handler that refused everything could not pass. Here the
			 * hazard is the opposite — an acceptance that means nothing because the command is never refused for
			 * ANY reason, or because the arrangement never reached the site. So the control is a SIBLING DEFECT AT
			 * THE SAME SITE that IS refused: it proves the refusal machinery is alive and simply has no limb for
			 * this rule.
			 */
			readonly control: string;
			/** Why no kernel predicate can be named — the fact that forced this shape rather than DEAD_PREDICATE. */
			readonly whyNoPredicate: string;
			/**
			 * The status the CONTROL is expected to return. Absent = `REJECTED`, which is every row written before
			 * 2026-08-02.
			 *
			 * OPT-IN, FOR THE SAME REASON `RefusalLayer` IS. A control's job is to prove the site's refusal
			 * machinery is alive; when the disclosed gap is at the CONTRACT boundary, the alive machinery is the
			 * boundary and its refusals carry status `VALIDATION_FAILED`, not `REJECTED`. Widening the gate's
			 * assertion for every row would mean a COMMAND row whose control was merely MALFORMED — the commonest
			 * fixture error in this repository, six of them this programme — would silently satisfy it. So the row
			 * declares it, and only the declaring row's control may be a boundary refusal.
			 *
			 * `CONFLICT` is a third real value, discovered by running RPH-CON-003's probe: an optimistic-concurrency
			 * refusal carries its own `CommandResult` status rather than `REJECTED`. Three statuses mean "refused"
			 * in this engine, which is precisely why the expected one is declared per row instead of guessed.
			 */
			readonly controlStatus?: 'REJECTED' | 'VALIDATION_FAILED' | 'CONFLICT';
	  };

/** A rule whose statement IS a command refusal and which NOTHING in production enforces. */
export interface UnenforcedRule {
	readonly kind: 'UNENFORCED_DISCLOSED';
	readonly canonCarriage: CanonCarriage;
	readonly why: string;
	readonly guard: UnenforcementGuard;
}

/** A rule whose statement asserts an outcome, a permission, or a plane that does not exist. */
export interface NotACommandRefusal {
	readonly kind: 'NOT_A_COMMAND_REFUSAL';
	readonly canonCarriage: CanonCarriage;
	readonly why: string;
}

export type EnforcementDisposition = EnforcedRule | UnenforcedRule | NotACommandRefusal;

/** Every rule the register disposes. Total by type — a new id cannot be added without a disposition. */
export type RegisteredRuleId =
	| 'RPH-EXE-001'
	| 'RPH-EXE-002'
	| 'RPH-EXE-003'
	| 'RPH-EXE-004'
	| 'RPH-EXE-005'
	| 'RPH-EXE-006'
	| 'RPH-EXE-007'
	| 'RPH-EXE-008'
	| 'RPH-EXE-009'
	| 'RPH-PWU-009'
	| 'RPH-PWU-010'
	| 'RPH-EVD-001'
	| 'RPH-EVD-002'
	| 'RPH-EVD-003'
	| 'RPH-EVD-004'
	| 'RPH-EVD-005'
	| 'RPH-EVD-006'
	| 'RPH-EVD-007'
	| 'RPH-ASR-001'
	| 'RPH-ASR-002'
	| 'RPH-ASR-003'
	| 'RPH-ASR-004'
	| 'RPH-ASR-005'
	| 'RPH-ASR-006'
	| 'RPH-ASR-007'
	| 'RPH-ASR-008'
	| 'RPH-ASR-009'
	| 'RPH-ASR-010'
	| 'RPH-ASR-011'
	| 'RPH-ASR-012'
	| 'RPH-INT-001'
	| 'RPH-INT-002'
	| 'RPH-INT-003'
	| 'RPH-INT-004'
	| 'RPH-INT-005'
	| 'RPH-INT-006'
	| 'RPH-INT-007'
	| 'RPH-PWU-001'
	| 'RPH-PWU-002'
	| 'RPH-PWU-003'
	| 'RPH-PWU-004'
	| 'RPH-PWU-005'
	| 'RPH-PWU-006'
	| 'RPH-PWU-007'
	| 'RPH-PWU-008'
	| 'RPH-CON-001'
	| 'RPH-CON-002'
	| 'RPH-CON-003'
	| 'RPH-CON-004'
	| 'RPH-CON-005'
	| 'RPH-CON-006'
	| 'RPH-CON-007'
	| 'RPH-CON-008'
	// RPH-PER, CLOSED 2026-08-02. It landed at twelve of fourteen and stayed OUT of `TOTAL_OVER_FAMILIES` for one
	// commit, because RPH-PER-003 and RPH-PER-004 are UNENFORCED_DISCLOSED and landing a disclosure without its
	// observation is the one thing that arm may never do. Both now carry OBSERVED_ADMISSION probes, so the family
	// is total and the gate claims it — the same sequence RPH-PWU followed over three commits.
	| 'RPH-PER-001'
	| 'RPH-PER-002'
	| 'RPH-PER-003'
	| 'RPH-PER-004'
	| 'RPH-PER-005'
	| 'RPH-PER-006'
	| 'RPH-PER-007'
	| 'RPH-PER-008'
	| 'RPH-PER-009'
	| 'RPH-PER-010'
	| 'RPH-PER-011'
	| 'RPH-PER-012'
	| 'RPH-PER-013'
	| 'RPH-PER-014'
	// The three READ-MODEL families (conformance layer 6), closed 2026-08-02. All fourteen are
	// NOT_A_COMMAND_REFUSAL, and that uniformity is a finding about this register's REACH — see the family header.
	| 'RPH-PRJ-001'
	| 'RPH-PRJ-002'
	| 'RPH-PRJ-003'
	| 'RPH-PRJ-004'
	| 'RPH-PRJ-005'
	| 'RPH-TRC-001'
	| 'RPH-TRC-002'
	| 'RPH-TRC-003'
	| 'RPH-TRC-004'
	| 'RPH-TRC-005'
	| 'RPH-CMP-001'
	| 'RPH-CMP-002'
	| 'RPH-CMP-003'
	| 'RPH-CMP-004'
	// RPH-GOV, SIX OF SEVEN (2026-08-03). GOV-006 (DISCLOSED) still owes its observation, so the family stays OUT
	// of `TOTAL_OVER_FAMILIES`.
	| 'RPH-GOV-001'
	| 'RPH-GOV-002'
	| 'RPH-GOV-004'
	| 'RPH-GOV-007'
	// RPH-BAS, FOUR OF SEVEN (2026-08-02). BAS-003/004/006 are ENFORCED and owe dispatch probes.
	| 'RPH-BAS-001'
	| 'RPH-BAS-002'
	| 'RPH-BAS-005'
	| 'RPH-BAS-007'
	// RPH-ASM, FIVE OF SIX (2026-08-02). ASM-006 is ENFORCED and owes its dispatch probe.
	| 'RPH-ASM-001'
	| 'RPH-ASM-002'
	| 'RPH-ASM-003'
	| 'RPH-ASM-004'
	| 'RPH-ASM-005'
	// RPH-DEC five of seven and RPH-CNS three of four (2026-08-02). DEC-002/003 and CNS-003 are ENFORCED and owe
	// dispatch probes; DEC-005 is a disclosure owing its observation.
	| 'RPH-DEC-001'
	| 'RPH-DEC-004'
	| 'RPH-DEC-006'
	| 'RPH-DEC-007'
	| 'RPH-CNS-001'
	| 'RPH-CNS-002'
	| 'RPH-CNS-003'
	| 'RPH-CNS-004'
	| 'RPH-DEC-002'
	| 'RPH-DEC-003'
	| 'RPH-BAS-003'
	| 'RPH-BAS-004'
	| 'RPH-BAS-006'
	| 'RPH-GOV-003'
	| 'RPH-ASM-006'
	| 'RPH-DEC-005'
	| 'RPH-GOV-005'
	// RPH-GOV CLOSED 7/7 (2026-08-03) — the last rule in reach of this instrument.
	| 'RPH-GOV-006';

export const ENFORCEMENT_REGISTER: Readonly<Record<RegisteredRuleId, EnforcementDisposition>> = {
	'RPH-EXE-001': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'A PWU has at most one active Execution Plan',
			note: 'JPWB-DOC-003 §6 STA-8 (Execution Plans are governed strategy) states the uniqueness rule directly.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — activateExecutionPlan / canActivatePlan',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the PWU already has an active plan; supersede it before activating another',
		declaredMutations: [
			'delete the `if (!check.ok)` arm in activateExecutionPlan',
			'make otherActivePlanExistsForPwu return false unconditionally'
		]
	},
	'RPH-EXE-002': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'a superseded plan spawns no new steps and no new execution attempts',
			note: 'JPWB-DOC-003 §6 STA-8. The canon sentence is broader than the rule (it covers attempts as well as steps), which is carriage, not a gap.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — stepAuthorityRefusal, reading STEP_COMMAND_SPECS.planLiveness (WP-12b)',
		refusalCode: 'RPH_ILLEGAL_STATE_TRANSITION',
		refusalMarker: 'a superseded or terminal plan mints no new success credit',
		declaredMutations: [
			"flip StartExecutionStep's planLiveness to CLEANUP_EXEMPT in step-command-spec.ts",
			'delete the planLiveness limb of stepAuthorityRefusal'
		]
	},
	'RPH-EXE-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Execution requires an approved plan and authorized Runtime Bindings',
			note: 'JPWB-DOC-003 §6 STA-8. Also the carrier for §22.1\'s "Revoked bindings cannot be used for new attempts": a REVOKED binding is not an authorized one, and the verdict\'s accept set is exactly AUTHORIZED | PARTIALLY_AUTHORIZED.'
		},
		// CLOSED BY JAN-EXEBIND WP-B1. This row read UNENFORCED_DISCLOSED for four commits: `bindingPermitsExecution`
		// was correct, unit-tested and asked by NOTHING, while the manifest certified the whole RPH-EXE family COVERED
		// "001..009 by id". `startExecutionStep` never resolved the step's runtimeBindingId at all, so a step started
		// freely against a REQUESTED, DENIED or REVOKED binding. The register found it; the fix got its own work
		// package rather than being smuggled into the gate that found it.
		// SITE CORRECTED BY JAN-REVREM RW-5. This read "in startExecutionStep's precheck" for four commits after
		// RW-0 MOVED the limb into `stepAuthorityRefusal` — the register documented a call site that no longer
		// existed, which is precisely the drift a register exists to prevent. DS-001 §6 C-1 predicted this exact
		// conflict and required it be fixed in the same commit; it was not.
		// SITE RE-STATED BY JAN-REVREM RW-6, IN THE SAME COMMIT AS THE MOVE. The DECISION now lives in
		// `rph-domain`'s `bindingAuthorityVerdict` so the read-model can consult the same declaration (MAJOR #5);
		// `bindingAuthorityRefusal` resolves the store and renders the verdict. Both halves are named, because
		// naming only one would leave a reader unable to find either the rule or its enforcement — and this row has
		// already documented a vanished call site once, for four commits, exactly as DS-001 §6 C-1 predicted.
		enforcedAt:
			'DECISION: packages/rph-domain/src/execution.ts — bindingAuthorityVerdict (the four checks and their order). ENFORCEMENT: packages/rph-application/src/handlers/execution.ts — bindingAuthorityRefusal, invoked from stepAuthorityRefusal on the `bindingAuthority` column (JAN-EXEBIND WP-B1, re-sited by JAN-REVREM RW-0, split by RW-6)',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		// The kernel's own label travels in the MESSAGE: `RPH_BINDING_NOT_AUTHORIZED` is not a member of the ratified
		// 15-value RphErrorCodeSchema, so it goes there or nowhere (the WP-11 discipline).
		refusalMarker: 'a step may only execute against an AUTHORIZED or PARTIALLY_AUTHORIZED binding',
		// MUTATIONS CORRECTED BY RW-5. Two of the three named acts no longer exist: the precheck call was moved, and
		// the §15.3 allowlist limb was WITHDRAWN. A `declaredMutations` entry that cannot be applied is worse than an
		// absent one — the field's whole contract is "what to break to make this row's probe go RED", so an
		// unapplicable entry is an untestable instruction wearing the authority of a checked record.
		declaredMutations: [
			'invert the accept set of bindingPermitsExecution',
			'flip StartExecutionStep.bindingAuthority to NOT_EXECUTING in step-command-spec.ts',
			'flip ResolveExecutionStepWait.bindingAuthority to NOT_EXECUTING — the two-arrows BLOCKER, re-expressed as one character of declaration',
			'delete the bindingAuthority limb from stepAuthorityRefusal',
			'delete the SCOPE check (boundStepId !== stepId) in bindingAuthorityVerdict — a binding then backs any step in the plan',
			// ADDED BY RW-6. The rule is now enforced at TWO layers and the second one is a filter, so it needs its own
			// act: deleting the read-model limb leaves the engine correct while the UI offers a click the engine
			// refuses. That is MAJOR #5 itself, and without this entry nothing in the register would say how to
			// reproduce it.
			'delete the bindingAuthority limb from planPermitsAffordance in rph-projections/src/execution-view.ts — the engine still refuses, but the UI offers Start again (MAJOR #5)'
		]
	},
	// ── REASON REWRITTEN 2026-07-26 (N-19). THE DISPOSITION IS UNCHANGED AND THAT IS DELIBERATE ────────────────
	//
	// This row is on its THIRD stated reason, and the first two were both falsified rather than merely refined —
	// which is itself the argument for keeping the row's PROSE under the same scrutiny as its fields. No gate reads
	// prose: `enforcement-register.test.ts` checks `coverageFor(id).status` and `.testFile`, never a sentence.
	//
	//   (1) until 2026-07-25: "enforcing it needs a runtime capability plane … that does not exist in this engine".
	//       FALSE. RUNTIME_BINDING is a first-class aggregate with a five-state ratified machine and four live
	//       commands, carrying BOTH requestedCapabilities and grantedCapabilities.
	//   (2) until 2026-07-26: "what does not exist is the IDENTITY of a capability … Source TBD". FALSE AS OF
	//       JAN-CAPBIND, which authored `CapabilityRequest`/`CapabilityGrant` as `{ capability: string }` under
	//       sponsor grant. The set-containment half became expressible and IS now enforced (N-4).
	//
	// (3) THE ACTUAL REASON, and it is a BOUNDARY, not a gap. The ratified statement's subject is AN OPERATION AT
	// OPERATION TIME ("network operations fail authorization"), and JPWB is never in the path of an operation: it
	// governs plans and does not host tool invocations. The corpus names a different enforcer — §33.4's Runtime
	// Authorization Service, and the Charter's allocation of tool execution and policy enforcement to the Platform.
	//
	// SO THE RULE DECOMPOSES INTO THREE TIERS, and conflating any two is the F-28 shape this register exists to
	// prevent:
	//   DECLARATION  granted ⊆ requested, monotone, outcome derived, step runs only on its own live binding
	//                — JPWB, and ENFORCED (grantedWithinRequest, grantIsMonotone, bindingAuthorityVerdict).
	//   ADMISSION    a step declares what it will need; is that granted? — NO SUBJECT EXISTS. No ratified
	//                step-level required-capability declaration. (Note: `requiredCapabilities` DOES exist on
	//                ValidatorContract/ValidatorRegistryEntry, so the concept is NOT absent from the corpus —
	//                only from ExecutionStep. Recorded because the opposite was nearly asserted.)
	//   OPERATION    this connect(), this path — PLATFORM, deferred to M5.
	//
	// R1 RULED 2026-07-26: DO NOT build a JPWB-side invocation ledger. It would be a RECORD, not a control — post
	// hoc, unable to compel disclosure, and blind to the BOUND (path/host is inexpressible under the §22.1
	// policy-by-reference ruling, so "file-system granted" is satisfied by reading /etc/shadow). Its intended
	// caller does not exist until M5. Standing it up now would mint a row claiming enforcement that prevents
	// nothing, which is precisely what this register was built to stop.
	//
	// EXIT CRITERION, so this is deferral and not drift: revisit when a broker/sandbox exists to call it, or when
	// the corpus ratifies a step-level required-capability declaration. Either makes a real guarantee available;
	// neither is available now.
	//
	// `capabilityAuthorized` therefore KEEPS no production caller BY DESIGN. Wiring it to clear the census would be
	// the substitution this register exists to prevent.
	'RPH-EXE-004': {
		kind: 'UNENFORCED_DISCLOSED',
		// THE ROW THAT RAISED V-4, AND THE ALARM WAS OVERSTATED — recorded because the correction matters more than
		// the finding. It was closed out as "§22.1's invariants have no canon carrier, so RPH-EXE-004 loses its only
		// textual home on retirement". That was written from RECALL rather than from a search of docs/canon/, which
		// is this lineage's recurring error pointed the other way: a claim about my search reported as a claim about
		// the world. Measured, §22.1's seven sentences are THREE carried, TWO carried only by a general rule, and
		// TWO carried nowhere — and this rule is one of the carried ones.
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'only runtime policy grants it',
			note: 'JPWB-DOC-001 §5 principle 3 (Capability is not Authority): "a PWA, plan, prompt, or agent may request a capability; only runtime policy grants it." That IS §22.1\'s request/grant distinction, in canon, and it survives retirement. What canon does NOT carry is the OPERATION tier below — which is consistent with the disposition here, since that tier is the Platform\'s.'
		},
		why:
			'A BOUNDARY, NOT A GAP — and the two reasons recorded here before 2026-07-26 were both FALSIFIED (see the ' +
			'comment above; neither was caught by a gate, because no gate reads prose). The ratified statement is ' +
			'about AN OPERATION AT OPERATION TIME, and JPWB is never in the path of an operation: it governs plans ' +
			'and hosts no tool invocation. The corpus names a different enforcer (§33.4 Runtime Authorization ' +
			'Service; the Charter allocates tool execution and policy enforcement to the Platform). The rule splits ' +
			'in three: DECLARATION (granted within requested, monotone, outcome derived, step runs only on its own ' +
			"live binding) is JPWB's and is ENFORCED; ADMISSION (a step declaring what it needs) has NO SUBJECT — " +
			'no ratified step-level required-capability declaration exists, though `requiredCapabilities` DOES exist ' +
			'on ValidatorContract, so the concept is not absent from the corpus, only from ExecutionStep; OPERATION ' +
			"is the Platform's and is deferred to M5. R1 (ruled 2026-07-26): a JPWB-side invocation ledger is NOT " +
			'built — it would be a record rather than a control, post hoc, unable to compel disclosure, blind to the ' +
			'bound, and its caller does not exist yet. EXIT: revisit when a broker exists to call it, or when a ' +
			'step-level capability declaration is ratified. capabilityAuthorized keeps no production caller BY ' +
			'DESIGN. SEPARATELY: the FIRST-authorization containment hole is N-4 and is CLOSED, deliberately not ' +
			'filed under this rule, whose statement is about operations.',
		guard: {
			kind: 'DEAD_PREDICATE',
			deadPredicate: 'capabilityAuthorized',
			referencedOnlyBy: ['packages/rph-domain/src/execution.ts']
		}
	},
	'RPH-EXE-005': {
		// CLOSED 2026-07-26 by JAN-CAPBIND WP-3, and the blocker recorded here was REAL rather than an excuse — which
		// is why it took an authoring to remove it. This row read UNENFORCED_DISCLOSED because `InputBinding` was
		// declared "NOT field-defined … Source TBD" in the ratified corpus, so `InputBindingSchema` was an opaque
		// record and "a step whose required input artifact is absent" HAD NOTHING TO QUANTIFY OVER: F-01's mechanism
		// one level up, a guard that cannot be non-vacuous while one of its inputs is unrepresentable. WP-0 authored
		// the shape under sponsor grant (`artifactId?`, `required?`), and only then did wiring become possible.
		//
		// ~~ESCALATED (JAN-EXEBIND-DS-001 §4-R3)~~ — the escalation was ANSWERED, not withdrawn. Struck rather than
		// deleted per the WP-17 standard, so a reader sees that the blocker existed and how it was cleared.
		//
		// The earlier reason named the unreachable NOT_READY/READY transition (F-27). That was true and SECONDARY:
		// the subject gap survives fixing the machine, and the machine gap does not survive fixing the subject. The
		// enforcement below is on the START and RESUME arrows, which are command-reachable, so F-27 never blocked it.
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'The nearest canon rule is JPWB-DOC-003 STA-5 (readiness is a substantive shape gate), whose list of ' +
				'admission requirements does include "required inputs, expected outputs" — but its SUBJECT is the PWU\'s ' +
				"shape readiness profile, a definitional obligation on the unit of work. This rule's subject is an " +
				'EXECUTION STEP at start time, and an input ARTIFACT that must RESOLVE. The two quantify over different ' +
				'objects, and accepting STA-5 as the carrier would be precisely the layer substitution this register ' +
				'exists to prevent — the same move as accepting a pure-predicate test for a command-layer rule. So the ' +
				"rule's only textual home is the pre-canon conformance specification (§12), and retirement loses it."
		},
		enforcedAt:
			'DECLARATION: packages/rph-domain/src/step-command-spec.ts — the `inputReadiness` column, total over the nine step commands. ENFORCEMENT: packages/rph-application/src/handlers/execution.ts — inputReadinessRefusal, invoked from stepAuthorityRefusal as the fourth declared limb for both arrows into RUNNING.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		// The kernel's own label travels in the MESSAGE: RPH_PRECONDITION_UNSATISFIED is not a member of the ratified
		// 15-value RphErrorCodeSchema (the WP-11 discipline, as with RPH_BINDING_NOT_AUTHORIZED).
		refusalMarker: 'the step is not ready and no model/tool invocation is performed',
		declaredMutations: [
			'flip StartExecutionStep.inputReadiness to NOT_CONSUMING in step-command-spec.ts',
			'flip ResolveExecutionStepWait.inputReadiness to NOT_CONSUMING — the two-arrows omission, re-expressed as one character of declaration',
			'delete the inputReadiness limb from stepAuthorityRefusal',
			'make inputReadinessRefusal pass `inputBindings.length > 0` to stepMayBecomeReady instead of resolving each artifact — the F-30 shape, a truthiness test standing in for a resolved fact',
			'drop the `required ?? true` fail-closed default so an unmarked input is treated as optional'
		]
	},
	'RPH-EXE-006': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor:
				'No semantic state may be inferred from null values, empty arrays, missing rows, absent output',
			note: 'JPWB-DOC-003 §4 OBJ-1 (semantic state is always explicit) forbids reading meaning out of ABSENT OUTPUT by name, which is exactly what "step success requires an explicit result" enforces. GENERAL rather than CARRIED because OBJ-1 never mentions steps or completion: the general rule survives retirement, the step-level application does not.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — completeExecutionStep / validateStepCompletion (WP-11)',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'step completion requires recorded output or an explicit no-output result',
		declaredMutations: [
			'restore `explicitNoOutput: !hasOutput` at the call site (the original tautology)',
			'delete the MISSING cell from validateStepCompletion'
		]
	},
	'RPH-EXE-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		// CARRIAGE AND ENFORCEMENT ARE INDEPENDENT AXES, and this row is the clearest demonstration: canon states the
		// rule more strongly than the pre-canon corpus did, while this engine still refuses nothing. "Ratified
		// somewhere readable" and "enforced here" are different questions, and conflating them is how a register comes
		// to report a guarantee that is only a sentence.
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Retries must never duplicate commits',
			note: 'JPWB-DOC-003 §9 PER-5 (idempotency at the business-effect level) names source-control commits explicitly, alongside external API mutations, baseline promotions, approval decisions and evidence records.'
		},
		why:
			'"produces no second commit" is a statement about an EXTERNAL side effect (a source-control commit) under ' +
			'a repeated idempotency key. No command is refused; the engine has no source-control plane to make one in. ' +
			'The adjacent guarantee this engine DOES make — a re-submitted idempotency key returns the prior result and ' +
			'appends no events — is RPH-PER-002. LAYER CORRECTED 2026-08-02: this sentence read "covered at the store ' +
			'layer" for six commits. The DECISION is at the COMMAND layer — `command-bus.ts` step 1, in ' +
			'packages/rph-application/ — and only the receipt LOOKUP (`getReceipt`) is the store\'s. A register whose ' +
			'entire subject is layer precision may not be loose about its own prose, and no gate reads prose. Found ' +
			'while dispositioning RPH-PER-002, which also found REG-F-012: canon PER-5 adds a third clause ("Reuse of ' +
			'a key with a different payload fails") that this engine violates — a DIFFERENT command reusing a key is ' +
			'silently swallowed and reported DUPLICATE.'
	},
	'RPH-EXE-008': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'Canon carries the CONSEQUENCE and not the RULE. JPWB-CON-000 AX-8 (fail closed; escalate rather than ' +
				'invent) and V1 (budget exhaustion is declared as what it is) both require an exhausted budget to be ' +
				"surfaced and escalated rather than papered over — which is this rule's SECOND clause, the tactic " +
				'selection. Its FIRST clause has no canon sentence at all: nothing in the six artifacts says a retry ' +
				'budget exists, that attempts are counted, or that a controller must stop issuing them. The cap itself ' +
				'(DEFAULT_RETRY_CAP) is a repository shape, correctly, but a repository shape needs a ratified rule to ' +
				'be a shape OF; that rule lives only in the pre-canon conformance specification (§12). On retirement ' +
				'the enforcement stands with nothing to cite.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — retryExecutionStep / retryDecision',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the controller must not retry again (RPH-EXE-008)',
		declaredMutations: [
			'remove the `attemptsMade >= maxAttempts` arm from the retry precheck',
			'count ExecutionStepRetried instead of ExecutionStepStarted in attemptsMadeForStep'
		]
	},
	'RPH-EXE-009': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Malformed output creates no authoritative object',
			note: 'JPWB-DOC-003 §9 PER-10 (untrusted until admitted) carries this rule AND §22.1\'s "Model output is treated as untrusted external input" verbatim — "Model output is untrusted external input; the system\'s own agents have no privileged bypass."'
		},
		why:
			'A disposition rule for a malformed MODEL result: retain the raw output, fail boundary validation, create no ' +
			'authoritative objects. Its subject is the validator boundary, not a command envelope, and its operative ' +
			'clause ("retry or an alternate strategy MAY be selected") is a permission. Nothing here is a refusal a ' +
			'dispatch could observe.'
	},
	'RPH-PWU-009': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'superseded work cannot execute',
			note: 'JPWB-DOC-003 §5 STA-4 (the illegal-transition set is absolute) states it as one of the named laundering paths.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — pwuOpennessRefusal / canResumeExecutionOnPwu (WP-12b)',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the PWU is SUPERSEDED, a terminal workLifecycleState',
		declaredMutations: [
			'narrow canResumeExecutionOnPwu back to the BASELINED literal (dropping the derived terminal set)',
			"flip StartExecutionStep's pwuOpenness to CLEANUP_EXEMPT"
		]
	},
	'RPH-PWU-010': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'baselined work cannot re-enter execution without a successor revision or successor PWU',
			note: 'JPWB-DOC-003 §5 STA-4, near-verbatim against the ratified statement — including the successor-revision-or-successor-PWU disjunction, which is the part an implementation is most tempted to drop.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/execution.ts — pwuOpennessRefusal / canResumeExecutionOnPwu (WP-12b)',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		// DELIBERATELY NOT the same string as RPH-PWU-009. Both rows are refused by the same production site, and a
		// shared marker would let one arrangement satisfy both — the register would report two enforced rules while
		// only one arrangement had ever been driven. The BASELINED limb carries its own ratified error code and its
		// own reason text, so the two probes are genuinely distinguishable at the observation point.
		refusalMarker: 'a baselined PWU requires a successor revision before new execution',
		declaredMutations: [
			'delete the BASELINED arm of canResumeExecutionOnPwu — the derived terminal-set arm then refuses with the OTHER reason string, which this marker does not match, so the probe reports MASKED',
			'delete the pwuOpenness limb of stepAuthorityRefusal'
		]
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-EVD FAMILY, added 2026-08-01.
	//
	// A DIFFERENT SHAPE FROM THE EXECUTION ROWS, and the difference is the reason `UnenforcementGuard` exists. The
	// execution family's disclosures were "a correct kernel predicate that nothing asks". The evidence family has
	// three rules this engine implements at NEITHER layer — no guard AND no predicate — and two of them are
	// observed being ADMITTED through a live `Engine.dispatch` rather than argued from a census.
	//
	// EVERY BEHAVIOURAL CLAIM BELOW WAS OBSERVED, NOT READ. Two claims that survived an adversarial review on the
	// strength of source-reading alone were FALSIFIED the moment they were dispatched: "evidence with no producing
	// actor is admitted" (it is VALIDATION_FAILED — `ActorReferenceSchema` requires `actorId`/`displayName`
	// `.min(1)`, so the antecedent is schema-foreclosed), and the same for the empty-actor arrangement generally.
	// What survived dispatch is narrower and sharper than what was argued, and it is what these rows record.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-EVD-001': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				"an agent's statement that work is done is inert until reified as a governed Claim",
			note: 'JPWB-DOC-003 §3 (OBJ-5, Claims mediate assertion) states the rule directly and in the same direction: inertness until reification, which is exactly "must become or reference a Claim Object before assurance can evaluate it."'
		},
		why:
			'The statement IS a refusal — "must ... before assurance can evaluate it" is a precondition on evaluation — ' +
			'and nothing performs it. The route that falsifies the tempting reading (that the command vocabulary makes ' +
			'an unreified assertion unrepresentable, so the rule is satisfied by construction) is RECOMPOSITION: ' +
			'`CompleteRecomposition` carries `parentCompletionClaimSupported: z.boolean().optional()` ' +
			'(packages/rph-contracts/src/messages.ts), which is an agent\'s completion judgement travelling as a ' +
			'CALLER-TYPED BOOLEAN. It is defaulted to `true` in packages/rph-application/src/handlers/decomposition.ts ' +
			'and consumed directly by `evaluateRecomposition` (packages/rph-domain/src/decomposition.ts) with no Claim ' +
			'Object mediating — while the sibling `parentCompletionClaimId`, which IS required on both ' +
			'`ProposeRecomposition` and `CompleteRecomposition`, is resolved by no handler and read for no decision. So ' +
			'assurance evaluates a completion assertion that references a Claim id it never loads, on the strength of a ' +
			'boolean the caller supplied. THE ADJACENT REFUSAL THAT IS NOT THIS ONE, recorded so it is not mistaken ' +
			'for it: `rejectUnbackedExecutionSuccess` (packages/rph-application/src/handlers/pwu.ts) refuses a declared ' +
			'`executionState=SUCCEEDED` without a cited EXECUTION_PLAN. That is a completion assertion being refused, ' +
			'but what it demands is a plan, not a Claim, and filing this rule there would be the subject substitution ' +
			'this register exists to prevent.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'CompleteRecomposition carrying `parentCompletionClaimSupported: true` and a `parentCompletionClaimId` that names no existing Claim aggregate — the agent\'s completion assertion reaching evaluation unreified',
			control:
				'the same CompleteRecomposition dispatched WITHOUT the arranging BeginRecomposition, which the same handler refuses — so the acceptance above is a missing limb, not a command that is never refused',
			whyNoPredicate:
				'No kernel predicate decides whether a completion assertion is reified; `evaluateRecomposition` takes the ' +
				'boolean as an input rather than deriving it. DEAD_PREDICATE is unavailable for a second and independent ' +
				'reason: `parentCompletionClaimId`\'s production census ALREADY CONTAINS handlers/decomposition.ts, so a ' +
				'census guard could not detect the very wiring it would exist to detect.'
		}
	},
	'RPH-EVD-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Claims are supported by admissible evidence through explicit relationships',
			note: 'JPWB-CON-000 §4. Canon carries the RULE (support requires admissible evidence) even though this engine has no command that could violate it — which is the carriage/enforcement independence RPH-EXE-007 already demonstrates in the other direction.'
		},
		why:
			'"Changing a claim ... to SUPPORTED is rejected" presupposes a command that CHANGES A CLAIM\'S STATUS, and ' +
			'no such command exists in the ratified vocabulary. `AssertClaim` is the only CLAIM-targeting command; its ' +
			'`z.strictObject` payload has no `status` field at all, and the handler hard-codes `OPEN` in both the ' +
			'persisted state and the emitted event. No handler anywhere drives the `Claim.status` machine — the ' +
			'machine and its transition labels exist in the domain data, but nothing dispatches into them. So there is ' +
			'no envelope for this refusal to attach to. This is NOT a disguised disclosure: the rule cannot be ' +
			'violated by any dispatch, because the illegal transition is unreachable rather than unguarded, and ' +
			'recording it as UNENFORCED_DISCLOSED would claim a gap that no arrangement can demonstrate.'
	},
	// RE-DISPOSITIONED 2026-08-02, UNENFORCED_DISCLOSED -> ENFORCED, BY THE DISCLOSURE'S OWN GUARD.
	//
	// THIS ROW IS THE MECHANISM'S PROOF, so the sequence is recorded rather than summarised. The row was landed
	// 2026-08-01 disclosing that `contentReference: {}` was admitted and that PROVENANCE_PRESENT was structurally
	// unfailable, guarded by an OBSERVED_ADMISSION probe. That gap was filed as REG-F-005's sibling, REG-F-008.
	// Remediating it — teaching `evidenceAdmissibility` to read the PRODUCING ACTOR and to reject a content
	// reference that references nothing — turned the acceptance probe RED, exactly as the guard's contract says it
	// must, with a failure message instructing the reader to re-disposition this row. That is what happened.
	//
	// The disclosure never had a chance to outlive the condition it disclosed. Compare RPH-EXE-004, whose census
	// guard has held a real deferral honest for months, and RPH-ASR-010, whose guard is still holding one now.
	'RPH-EVD-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'provenance is present; content or reference is available',
			note: 'JPWB-DOC-003 §7, the admissibility conditions. Canon carries BOTH halves, and BOTH are now enforced — the producing-actor half at the schema layer (ProposeEvidence.producedBy is a required ActorReferenceSchema with .min(1) ids) and the source half here, semantically.'
		},
		enforcedAt:
			'DECISION: packages/rph-assurance/src/assurance-rules.ts — evidenceAdmissibility, whose PROVENANCE_PRESENT limb now reads `producedBy` through `namesAnActor` and whose CONTENT_AVAILABLE limb uses `referencesContent`. ENFORCEMENT: packages/rph-application/src/handlers/assurance.ts — admitEvidence, whose advanceStatus `guard` passes `producedBy` and rejects on `!verdict.admissible`.',
		refusalCode: 'RPH_VALIDATION_SEMANTIC_FAILED',
		// DISTINCT FROM RPH-EVD-007's marker, and the distinction is the failed CONDITION NAME rather than the
		// prefix — the same discipline EVD-007's row already records. Both rules are refused by the same guard at
		// the same site, so a marker stopping at "failed" would let one arrangement green both rows.
		refusalMarker: 'is inadmissible (§8.11) — failed CONTENT_AVAILABLE',
		declaredMutations: [
			'restore `contentReference === undefined || null` in place of `referencesContent` — `{}` is admitted again and the probe reports ADMITTED',
			'make `referencesContent` return true for any non-null value, dropping the empty-record test',
			'restore the PROVENANCE_PRESENT limb to null-check `provenance` instead of `producedBy` — the limb becomes structurally unfailable again (REG-F-008), which the probe does NOT catch, because it arranges the CONTENT half; that asymmetry is why the row carries a second probe assertion on the provenance limb',
			'stop passing `producedBy: state.producedBy` at the admitEvidence call site — the predicate can no longer see the actor, the F-30 shape'
		]
	},
	'RPH-EVD-004': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'passing tests support only claims within their scope',
			note: 'JPWB-DOC-003 §7 states the scope constraint on evidential support directly, and in the same direction as the ratified statement.'
		},
		why:
			'The operative clause is a MANDATORY disjunction — "must be rejected or qualified as out of scope" — whose ' +
			'first disjunct is exactly what AdmitEvidence already performs for the sibling limbs of the same guard. The ' +
			'plane, the aggregate, the ratified status machine, the registered command and the refusal mechanism all ' +
			'exist; only this limb does not. NOTHING in production compares an evidence scope to a claim\'s breadth: ' +
			'`Evidence.scope` is read at exactly one production site, feeding `evidenceAdmissibility`, whose sole scope ' +
			'limb is `if (!e.scope) failed.push(\'SCOPE_STATED\')` — a non-empty-string test, i.e. "a scope is STATED", ' +
			'not "the scope is not EXCEEDED". `admittedScope` is written onto the EvidenceAdmitted payload and read by ' +
			'no production consumer repo-wide. The comparison is not unrepresentable, which is the argument that had ' +
			'to be tested and failed: `ClaimTypeSchema` contains `FITNESS`, the rule\'s own consequent noun. So a ' +
			'TEST_RESULT of scope "unit" offered for a FITNESS claim is accepted by every path in this engine, and it ' +
			'is neither rejected nor qualified.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				"a FITNESS claim asserted, then a TEST_RESULT with scope 'unit' proposed supporting it and admitted with `admittedScope: 'unit'` and that claim in `admittedClaimIds` — accepted, unqualified",
			control:
				"the same AdmitEvidence with `scope: ''`, refused by the same guard — the site is alive; the scope-BREADTH comparison is simply absent from it",
			whyNoPredicate:
				'No kernel predicate compares evidence scope to claim breadth. `evidenceAdmissibility` has a RELEVANT ' +
				'limb (`opts.claimId` set-membership), but membership is not breadth, and the call site deliberately ' +
				'does not pass `claimId` at all. `admittedScope`\'s census already contains handlers/assurance.ts.'
		}
	},
	'RPH-EVD-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'every dependent supported claim becomes contested, under review, or invalidated; dependent assessments become invalidated or review-required; baseline readiness is recalculated',
			note: 'JPWB-DOC-003 §7 carries all three consequents verbatim, in order. Carriage is total here even though enforcement is not the question — the rule states outcomes, and canon states the same outcomes.'
		},
		why:
			'The When-clause command is `InvalidateEvidence`, and that dispatch is deliberately ACCEPTED: the handler ' +
			'is a status advance with a precondition and NO guard, and it computes `classifyEvidenceInvalidation` only ' +
			'to populate `affectedClaimIds` on the emitted event (JAN-EXECREM WIRE #4). Everything after "makes / makes ' +
			'/ recalculates" is an OUTCOME of an accepted command, which is this arm by definition. The two state ' +
			'changes the first two clauses assert are moreover COMMAND-UNREACHABLE — there is no ContestClaim and no ' +
			'InvalidateAssuranceAssessment in the ratified vocabulary — and the third has no push recalculation ' +
			'anywhere. The adjacent refusal that IS enforced belongs to a different rule: PromoteBaseline refuses a ' +
			'baseline resting on invalidated evidence, which is the RPH-BAS family.'
	},
	'RPH-EVD-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Contradicting evidence remains attached and visible; the record never self-curates toward support.',
			note: 'JPWB-DOC-003 §7. Note this anchor and RPH-EVD-005\'s resolve to the SAME LINE of the same artifact — one canon sentence carrying two ratified rules — and the two anchors are distinct substrings of it, so neither claim is satisfied by the other\'s text.'
		},
		why:
			'What the rule forbids is a SILENT DISCARD, and no command\'s acceptance discards contradicting evidence, ' +
			'so there is nothing a dispatch could be arranged to refuse. The one real tension is that `AssertClaim` ' +
			'carries the subject noun `contradictingEvidenceIds` on its payload — but it routes through `createObject` ' +
			'with `expectedRevision: undefined`, which the storage adapter turns into a no-op for an existing ' +
			'aggregate, so a re-assertion cannot overwrite a claim\'s evidence links either. The rule is satisfied by ' +
			'the absence of any curating command rather than by a guard, and there is no arrangement that would ' +
			'demonstrate otherwise — which is what separates this from the three disclosures above, each of which is ' +
			'backed by an observed admission.'
	},
	'RPH-EVD-007': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'It becomes Evidence only through admission, which evaluates provenance, relevance, scope, and limitations.',
			note: 'JPWB-DOC-003 §3 carries the rule near-verbatim against the ratified statement, including the four-way evaluation list.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/assurance.ts — admitEvidence, whose advanceStatus `guard` calls `evidenceAdmissibility` and rejects on `!verdict.admissible`. DECISION: packages/rph-assurance/src/assurance-rules.ts — evidenceAdmissibility.',
		refusalCode: 'RPH_VALIDATION_SEMANTIC_FAILED',
		// THE FAILED-CONDITION NAME IS PART OF THE MARKER, DELIBERATELY. The message is built as
		// `... is inadmissible (§8.11) — failed ${verdict.failed.join(', ')}.`, so the prefix alone would be satisfied
		// by ANY admissibility failure — including the ones RPH-EVD-003 and RPH-EVD-004 disclose as UNENFORCED. A
		// marker that stopped at "failed" would let one arrangement green this row while the rule it actually
		// exercised was a different one, which is the masking hazard this field exists to close.
		refusalMarker: 'is inadmissible (§8.11) — failed SCOPE_STATED',
		declaredMutations: [
			'delete the `guard` from admitEvidence — the status advance then succeeds and the probe reports ADMITTED',
			"remove the `if (!e.scope) failed.push('SCOPE_STATED')` limb from evidenceAdmissibility",
			'stop passing `scope: state.scope` into the guard\'s evidenceAdmissibility call — the limb survives but can no longer see the field, the F-30 shape',
			'delete or rename the arranging ProposeEvidence so the aggregate is never created: `loadOrReject` then refuses with the SAME code RPH_VALIDATION_SEMANTIC_FAILED and the message "Aggregate <id> does not exist", so a code-only probe would report a false KILLED and only the marker reports MASKED (observed)'
		]
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-ASR FAMILY, added 2026-08-02. The assurance-assessment surface (§14).
	//
	// THE FAMILY'S CHARACTERISTIC SHAPE, and it is a third one distinct from both earlier tranches: several of
	// these rules name an ACTOR THAT WAS NEVER BUILT. RPH-ASR-004 says "the Assurance Service rejects the
	// recommendation"; REG-F-007 records that M7's PolicyRegistry and AssuranceService do not exist anywhere in the
	// repository. Where the rule's decision logic DOES exist it lives in `rph-assurance` and is reached only on the
	// DE MINIMIS FLOOR path, which folds a boundary rejection to INCONCLUSIVE rather than REJECTED. So the kernel
	// is neither dead nor wired to the command surface — a third state the DEAD_PREDICATE census cannot describe,
	// and every disclosure below therefore carries an OBSERVED_ADMISSION guard.
	//
	// THE OTHER RECURRING FINDING: the engine has NO REACTOR PLANE. `command-bus.ts` looks up a handler exactly
	// once per dispatch and no handler re-enters the table; the only event fan-out is a `void` subscriber. A rule
	// whose consequent is "…and then X is requested" therefore cannot be violated by any dispatch being ACCEPTED,
	// which is what puts RPH-ASR-001 in the third arm rather than the second.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-ASR-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'all-steps-succeeded leaves assurance unassessed until required policies complete',
			note: 'JPWB-DOC-003 §5 STA-2 (execution success never confers satisfaction) names the same junction and the same operative noun ("required policies"), but states the obligation NEGATIVELY and mentions no Architecture PWU, no Architecture Coverage, no profile, and no REQUEST. GENERAL rather than CARRIED because the general rule survives retirement of the pre-canon §14 corpus and this Architecture-specific application does not.'
		},
		why:
			'The consequent asserts a positive automatic EFFECT — "an Assurance Assessment is requested" — so no ' +
			'dispatch violates this rule by being ACCEPTED, and there is no arrangement the UNENFORCED arm could name ' +
			'as one that must be refused. THE PLANE THAT WOULD PERFORM IT DOES NOT EXIST: `command-bus.ts` resolves a ' +
			'handler exactly once per dispatch and no handler re-enters the table, and the only event fan-out is an ' +
			'`EventSubscriber = (event) => void` — a read-only observer with no dispatch capability. One command can ' +
			'never mint another; this engine has no reactor or process-manager plane at all. SEPARATELY, the rule\'s ' +
			'"profile" subject is ERASED AT THE ENGINE PORT: `ConformanceProfile` exists only as PWA ontology data, ' +
			'the engine types the array as `readonly unknown[]`, and the published-PWA seam hard-codes it empty. What ' +
			'the engine actually does with "required but unassessed" is a READ-MODEL row — `buildApplicablePolicies` ' +
			'joins the PwuType\'s requiredAssurancePolicyIds against the assessment view and reports `assessed: false` ' +
			'— and a read-model consequence is this arm by definition.'
	},
	'RPH-ASR-002': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'An evidence deficit yields an inconclusive disposition, never satisfaction',
			note: 'JPWB-DOC-003 §7 states the operative half directly: the missing trace matrix is an unmet mandatory evidence requirement, and the rule\'s "cannot become SATISFIED" is exactly canon\'s "never satisfaction".'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/assurance.ts — completeAssuranceAssessment, the GATE A block: the positive-disposition branch folds the received evidence set and refuses when a requirement carrying `requiredForDispositions` has nothing submitted against it.',
		refusalCode: 'RPH_VALIDATION_SEMANTIC_FAILED',
		refusalMarker: 'a positive disposition cannot stand with unmet mandatory evidence',
		declaredMutations: [
			'delete the GATE A block from completeAssuranceAssessment',
			'compute `unmet` against the policy\'s full requirement list instead of the `requiredForDispositions` subset — the gate then fires for every assessment and the CONTROL reddens instead, which is the over-refusal shape',
			'treat a requirement as satisfied when any evidence was submitted at all, rather than evidence submitted FOR that requirement'
		]
	},
	'RPH-ASR-003': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'the assessment cannot be satisfied, an independence violation is recorded as a first-class outcome, and another evaluator or a policy-permitted scoped waiver is required',
			note: 'JPWB-DOC-003 ASR-13 (independence is a verified runtime property) carries all three consequents verbatim and in order — and canon\'s own wording, "recorded as a first-class OUTCOME", is precisely why this is not a refusal. Note canon says another EVALUATOR and a POLICY-PERMITTED SCOPED waiver where the ratified statement says validator and waiver; the anchor is canon\'s wording, not the rule\'s.'
		},
		why:
			'THE RULE IS ENFORCED — AND NOT BY A REFUSAL, which is the distinction this arm exists to keep. ' +
			'`checkIndependence` IS asked from the command layer (completeAssuranceAssessment consults it), and when ' +
			'it fails the handler ADVANCES THE ASSESSMENT to the ratified INDEPENDENCE_VIOLATION state and emits the ' +
			'ratified AssuranceIndependenceViolated event. The dispatch is ACCEPTED; "evaluation is blocked" is ' +
			'realized as a terminal state the machine will not let reach SATISFIED, not as a rejected command. That ' +
			'is canon\'s own framing — "recorded as a first-class outcome" — and it is the RPH-EVD-005 shape: an ' +
			'accepted command whose consequents are outcomes. Recorded explicitly because the tempting move is to ' +
			'file this under DEAD_PREDICATE on the strength of the pure-kernel test of `checkIndependence`, which ' +
			'would be the exact substitution this register was built to stop, pointed the other way: the predicate ' +
			'has a live command-layer caller, so both clauses of `deadPredicate`\'s contract would be false.'
	},
	'RPH-ASR-004': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'A recommendation of satisfied with a mandatory criterion unmet is rejected.',
			note: 'JPWB-DOC-003 §6 carries the rule near-verbatim, including that the validator RECOMMENDS and something else DISPOSES.'
		},
		why:
			'The rule names an actor that does not exist. "The Assurance Service rejects the recommendation" is M7 ' +
			'scope, and REG-F-007 records that neither PolicyRegistry nor AssuranceService exists anywhere in this ' +
			'repository. The decision logic DOES exist — `classifyValidatorResult` and `mandatoryCriterionUnmet` in ' +
			'rph-assurance — but it is reached only on the DE MINIMIS FLOOR path, and that path folds a boundary ' +
			'rejection to INCONCLUSIVE, never to REJECTED, so it does not implement the ratified consequent even ' +
			'where it runs. At the command surface, completeAssuranceAssessment consults the policy for permitted ' +
			'control actions, forbidden open severities, escalation and mandatory evidence — and never compares the ' +
			'validator\'s recommendation against its own criterion results. A validator may therefore recommend ' +
			'SATISFIED with a BLOCKING criterion NOT_MET and be taken at its word, which is the precise thing the ' +
			'rule exists to forbid.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a policy whose single criterion is severityIfNotMet BLOCKING, activated, an assessment requested against it, then CompleteAssuranceAssessment carrying dispositionRecommendation SATISFIED while that criterion\'s result is NOT_MET — accepted',
			control:
				'the byte-identical completion with `subjectSemanticVersions: {}` while `subjectObjectIds` is unchanged, which the SAME handler refuses in `parseCompletion` — the site rejects malformed validator output and simply never compares the recommendation to the criteria',
			whyNoPredicate:
				'`classifyValidatorResult`, `dispositionFromFindings` and `mandatoryCriterionUnmet` all have a census ' +
				'confined to rph-assurance, so a DEAD_PREDICATE row would mechanically pass the command-layer ' +
				'precondition — and it would still be false, because all three ARE asked, on the floor path, from a ' +
				'live production surface the packages-only census cannot see. "Confined to the kernel" is not the same ' +
				'fact as "never asked", and only the second one licenses that guard.'
		}
	},
	'RPH-ASR-005': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Unable-to-determine is never treated as met.',
			note: 'JPWB-DOC-003 §7 states it as an absolute, with no policy override — which is what makes the engine\'s silence a gap rather than a configuration choice.'
		},
		why:
			'A mandatory criterion whose result is UNABLE_TO_DETERMINE does not prevent the assessment from being ' +
			'completed as SATISFIED. The engine derives mandatoriness correctly — BLOCKING severity marks a criterion ' +
			'mandatory in the kernel — but completeAssuranceAssessment never reads criterion RESULTS at all: its four ' +
			'gates read the policy\'s permitted control actions, its forbidden open severities, its escalation rules ' +
			'and its mandatory EVIDENCE requirements. None of them asks what the criteria came back as. So the ' +
			'distinction canon draws — that an undetermined mandatory criterion is not a met one — has no reader on ' +
			'the command path, and the disposition the validator recommends stands unexamined.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a policy with one BLOCKING criterion, activated and assessed, completed with dispositionRecommendation SATISFIED while that criterion\'s result is UNABLE_TO_DETERMINE — accepted',
			control:
				'the same completion with `subjectSemanticVersions: {}`, refused by `parseCompletion` at the same site with RPH_VALIDATOR_OUTPUT_INVALID',
			whyNoPredicate:
				'No predicate on the command path maps a criterion RESULT to a disposition constraint. The kernel ' +
				'helpers that could are floor-path only and fold to INCONCLUSIVE rather than blocking satisfaction, ' +
				'so naming one would fail both clauses of `deadPredicate`\'s contract exactly as RPH-ASR-004 records.'
		}
	},
	'RPH-ASR-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Infrastructure failure of a validator leaves assurance incomplete — it neither rejects nor satisfies the subject',
			note: 'JPWB-DOC-003 §8. Canon states the rule as a constraint on what a failure MEANS, not as a command that must be refused — which is the disposition below.'
		},
		why:
			'Both halves of the consequent are non-refusals. VALIDATOR_FAILED is an AssuranceAssessmentState, not an ' +
			'error code — the contracts say so explicitly — so "makes assessment state VALIDATOR_FAILED" is an ' +
			'accepted command reaching a state, the RPH-ASR-003 shape. The second half, "or returns it to ready for ' +
			'retry", is a PERMISSION, and a permission is never a refusal a dispatch could observe; that is the same ' +
			'reading that puts RPH-EXE-009 in this arm. The rule\'s protective clause — "the assessed work is not ' +
			'automatically rejected" — forbids an OVER-refusal, and the register has no arm for "nothing wrongly ' +
			'refuses this" because the absence of a refusal is not something a probe can distinguish from the absence ' +
			'of the arrangement. Recorded rather than left implicit, since this rule is the one most likely to be ' +
			'mistaken for a disclosure.'
	},
	'RPH-ASR-007': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Malformed or invalid validator output can never mutate authoritative state or create authoritative findings',
			note: 'JPWB-DOC-003 §8 carries the rule\'s operative consequent verbatim — no authoritative observations, no disposition change.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/assurance.ts — completeAssuranceAssessment, whose first statement calls `parseCompletion`; the refusing limb requires validatorResult.subjectSemanticVersions to name a version for every declared subject.',
		refusalCode: 'RPH_VALIDATOR_OUTPUT_INVALID',
		// THE TIER MATTERS, and choosing the wrong one would have made this row a duplicate of a schema behaviour.
		// LITERAL malformation is SCHEMA-FORECLOSED: ValidatorResultSchema is a strictObject and
		// dispositionRecommendation is a ratified enum, so garbage returns VALIDATION_FAILED and never reaches a
		// handler — which `classifyRefusal` would read as ADMITTED, not as enforcement. What survives to the command
		// layer is SEMANTIC malformation the schema cannot express: `z.record(z.string(), z.number())` cannot say
		// "one key per declared subject". That is the limb this row records.
		refusalMarker: 'validatorResult.subjectSemanticVersions must name a version for every subject',
		declaredMutations: [
			'delete the subjectSemanticVersions completeness check from parseCompletion',
			'compare COUNTS instead of membership — `Object.keys(...).length === subjectObjectIds.length` passes a result that versions the wrong subject',
			'return the parsed completion instead of the refusal when the check fails, so the assessment advances and observations are created — the exact consequent canon forbids'
		]
	},
	'RPH-ASR-008': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Open critical findings block satisfaction',
			note: 'JPWB-DOC-003 §7 states it unconditionally — "block", with no policy predicate — which is exactly the gap: the engine performs it only when a policy opts in.'
		},
		why:
			'THE ENGINE HAS NO DEFAULT, and that is the whole finding. A CRITICAL observation recorded OPEN against a ' +
			'live assessment does not by itself prevent that assessment from completing SATISFIED. The refusal ' +
			'machinery exists and works — completeAssuranceAssessment forecloses a positive disposition while an ' +
			'observation of a forbidden severity is OPEN — but it fires only when the POLICY declares ' +
			'`dispositionRules.forbiddenOpenSeverities`, and it skips entirely when that set is empty. Canon states ' +
			'the rule with no policy predicate at all. So every policy that simply omits the clause silently opts out ' +
			'of a rule canon states absolutely, and the engine supplies nothing in its place. ' +
			'A SECOND SITE, added 2026-08-03 and driven live in `packages/rph-application/src/handlers/pwu.test.ts`: ' +
			'the gap is not confined to assessment completion. A CRITICAL observation filed AFTER a satisfied ' +
			'assessment does not stop the PWU itself advancing to workLifecycleState SATISFIED — the satisfaction ' +
			'path reads no findings at any severity, and `PwuAxes` has no field that could carry one, so there the ' +
			'check is INEXPRESSIBLE rather than merely absent. That is the site the dead kernel predicate ' +
			'`controllerMarksPwuSatisfied` would have served; it states the rule as a three-limb conjunction and is ' +
			'called by nothing. RECORDED HERE RATHER THAN AS A NEW FINDING, deliberately: reading DOC-003 ASR-10\'s ' +
			'"open critical findings block satisfaction" as governing PWU workLifecycle would be a SUBJECT ' +
			'SUBSTITUTION — that rule is titled "Composition is strictest-wins" and its subject throughout is ' +
			'AGGREGATE ASSURANCE. One rule, two unenforced sites, one row.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a policy declaring NO dispositionRules, activated and assessed, a CRITICAL observation recorded OPEN against the assessment, then completion with dispositionRecommendation SATISFIED — accepted',
			control:
				'THE SAME arrangement with one field added to the policy — dispositionRules forbidding SATISFIED while a CRITICAL observation is OPEN — which IS refused. The strongest control available here: same site, same command, same CRITICAL observation, and the only delta is whether the policy declares the rule. It proves what is missing is the ENGINE\'S OWN DEFAULT, not the mechanism.',
			whyNoPredicate:
				'`dispositionFromFindings` implements the rule correctly and its census does exclude the command ' +
				'layer, so a DEAD_PREDICATE row would pass the precondition gate — and would still be false, because ' +
				'the predicate IS asked, on the floor path, from a live surface. This is the near miss the ' +
				'RPH-EVD-003 row warns about, and it is recorded here rather than taken.'
		}
	},
	'RPH-ASR-009': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'The condition remains visible in the assessment, the PWU assurance view, review packages, and baseline packages',
			note: 'JPWB-DOC-003 §7 carries all four surfaces verbatim — and all four are projections, which is the disposition.'
		},
		why:
			'Every one of the rule\'s four consequents is a VISIBILITY property of a projection: the assessment ' +
			'object, the PWU assurance view, the review package and the baseline package. Nothing here is a command ' +
			'envelope, and no dispatch can violate the rule by being accepted — a condition is either carried into ' +
			'the read models or it is not, and if it is not, the defect surfaces as a missing field in a projection ' +
			'rather than as an admitted command. No kernel predicate decides whether a condition is visible either: ' +
			'`dispositionFor` returns CONDITIONALLY_SATISFIED and `aggregateDisposition` propagates it, but neither ' +
			'has a visibility limb and no predicate anywhere takes a "surfaces" argument. Recorded as a read-model ' +
			'obligation, which is the register\'s third arm by definition — and note that if the projections DID drop ' +
			'the condition, the instrument that would catch it is a projection test, not this register.'
	},
	// RE-DISPOSITIONED 2026-08-02, BEFORE ANY PROBE WAS WRITTEN, and the direction matters: this row was drafted
	// ENFORCED against the PWA-publish floor gate and is recorded here as DISCLOSED instead. The change WIDENS the
	// admitted gap rather than dissolving one, which is the safe direction for a correction — but it was still
	// checked rather than assumed, because it also happens to make this row's probe far cheaper, and a
	// re-disposition that saves work is exactly the kind that needs its evidence stated.
	//
	// THE EVIDENCE. `RPH_SUBJECT_VERSION_MISMATCH` is a member of the ratified 15-value error enum — the code the
	// contracts mint FOR THIS RULE — and it appears in exactly one non-test production site: a pure-kernel
	// classifier in `rph-assurance/src/assurance-rules.ts` that returns it as a `reason` string. NO HANDLER EVER
	// REFUSES WITH IT. On the command layer `subjectSemanticVersions` is only ever written through
	// (requestAssuranceAssessment, the completion event payloads, the governance decisions) or checked for
	// COMPLETENESS (`parseCompletion`, which is RPH-ASR-007's limb and asks whether a version is NAMED, never
	// whether it MATCHES). The only production site that COMPARES a version is `floor-gate.ts`.
	//
	// WHY THE FLOOR GATE IS NOT THIS RULE. Its subject is a PWA at publication and the de minimis floor recorded
	// against it; this rule's subject is an assessment of a work unit at satisfaction time. Accepting it as the
	// enforcement site would be the same substitution the RPH-EXE-005 row records and rejects — a real refusal,
	// quantifying over a different object. The floor gate's version binding is genuinely enforced and genuinely
	// driven live by `pwa-authoring.test.ts`; it just is not this rule.
	'RPH-ASR-010': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'An assessment of version n never satisfies version n+1; a semantic change to the subject invalidates or forces review of prior assessments',
			note: 'JPWB-DOC-003 ASR-12 (assurance binds to exact versions and never floats) carries the rule near-verbatim. Canon says "forces REVIEW OF PRIOR ASSESSMENTS" where the ratified statement says re-assessment — a weaker second disjunct, quoted as canon has it.'
		},
		why:
			'An assessment may be completed carrying a subject semantic version that is NOT the version the subject ' +
			'is actually at, and nothing refuses it. The ratified error code for this exact failure, ' +
			'RPH_SUBJECT_VERSION_MISMATCH, is one of the fifteen the contracts mint and is returned by exactly one ' +
			'production symbol — a pure-kernel classifier in rph-assurance — as a `reason` string on a boundary ' +
			'rejection that the floor path then folds to INCONCLUSIVE. No handler refuses with it. The command layer ' +
			'either writes `subjectSemanticVersions` through unexamined or asks only whether a version is NAMED for ' +
			'every subject (`parseCompletion`, which is RPH-ASR-007 and is a COMPLETENESS check, not a MATCH check). ' +
			'The one site that compares a version is the de minimis floor gate on the PWA publish path — real ' +
			'enforcement over a different subject, and adopting it here would be the layer/subject substitution this ' +
			'register exists to prevent. So the rule\'s second clause — that a semantic change to the subject ' +
			'invalidates or forces review of prior assessments — has no reader at all: nothing recomputes, ' +
			'invalidates, or even flags a prior assessment when its subject moves.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'an assessment completed with a validatorResult binding the subject to a semantic version the subject is NOT at — a verdict on version n accepted as satisfying version n+1',
			control:
				'the same completion with `subjectSemanticVersions: {}`, refused by `parseCompletion` at the same site — the parse step reads the field and rejects it for being INCOMPLETE, which is precisely what shows the missing check is the MATCH, not the reading',
			whyNoPredicate:
				'The kernel classifier that returns RPH_SUBJECT_VERSION_MISMATCH is not dead — it is asked on the ' +
				'floor path — so naming it would fail `deadPredicate`\'s first clause. What is absent is a caller on ' +
				'the assessment path that knows the subject\'s CURRENT version to compare against, so there is no ' +
				'symbol whose census could witness the gap closing.'
		}
	},
	'RPH-ASR-011': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'both remain visible and the aggregate becomes contested, inconclusive, or escalated',
			note: 'JPWB-DOC-003 §7. The same canon line carries RPH-ASR-008 and RPH-ASR-012 through different substrings; each anchor is distinct, so no claim is satisfied by another\'s text.'
		},
		why:
			'All three consequents are outcomes of accepted commands, not refusals. "Both remain visible" is a ' +
			'property of the event log and the projections over it — nothing curates an assessment away, because no ' +
			'command exists that could. "The aggregate becomes contested/inconclusive/escalated" is a derived ' +
			'disposition, computed by `aggregateDisposition` in the kernel and surfaced by the assurance view. And ' +
			'"results are not averaged silently" forbids an IMPLEMENTATION TECHNIQUE rather than a command: there is ' +
			'no dispatch whose acceptance would constitute averaging, so there is no arrangement a probe could make. ' +
			'The rule is a constraint on how the aggregate is DERIVED, and the instrument that can hold it is a ' +
			'kernel property test over `aggregateDisposition`, not a refusal observed at the bus.'
	},
	'RPH-ASR-012': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Aggregate assurance preserves the strictest unresolved required disposition',
			note: 'JPWB-DOC-003 §7 states the composition rule directly, and "required" is the word that makes four-satisfied-one-rejected a rejection rather than a majority.'
		},
		why:
			'The kernel composes correctly and the command surface never asks it to. `aggregateDisposition` ' +
			'implements strictest-unresolved and is unit-proven, but a PWU\'s assuranceState is set by ChangePwuState, ' +
			'whose backing check — `rejectUnbackedDisposition` — asks only whether the cited assessments SUPPORT the ' +
			'asserted disposition. It never enumerates the PWU\'s REQUIRED policies, and never composes across them. ' +
			'So with five required policies, four SATISFIED and one REJECTED, asserting the aggregate SATISFIED while ' +
			'citing the four satisfied assessments is accepted: the controller selects its own evidence and the ' +
			'strictest unresolved disposition is simply not consulted. The composition rule and the backing rule are ' +
			'different questions, and only the second one has a reader.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'five required policies on one PWU, four assessments SATISFIED and one REJECTED, then ChangePwuState asserting assuranceState SATISFIED while citing only the four satisfied assessments — accepted',
			control:
				'the byte-identical ChangePwuState citing ONLY the REJECTED assessment, which `rejectUnbackedDisposition` refuses at the same site — the backing check is alive; it is the COMPOSITION across required policies that is absent',
			whyNoPredicate:
				'`aggregateDisposition` is not dead — it is unit-proven and reached on the floor path — so naming it ' +
				'would fail `deadPredicate`\'s first clause. What is missing is not a predicate but a CALLER: nothing ' +
				'on the command path assembles the required-policy set to compose over, so there is no symbol whose ' +
				'census could witness the gap closing.'
		}
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-INT FAMILY, added 2026-08-02 — the Intent lifecycle, which this register's scope paragraph has named
	// as owed since it was written.
	//
	// A THIRD CHARACTERISTIC SHAPE. The execution family's gaps were dead predicates; the evidence and assurance
	// families' were rules implemented at neither layer. This family is mostly ENFORCED — and its four non-enforced
	// rows are non-enforced for a reason the register has not carried before: their statements describe what a
	// SUCCESSFUL command PRODUCES ("accepting X sets status RAW, semantic version 1, revision 1, and emits Y").
	// There is no arrangement a probe could refuse, and none it could observe being admitted either, because the
	// rule is violated by a handler doing the wrong thing on a path that succeeds — which a projection test catches
	// and a refusal probe cannot.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-INT-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'The raw originating expression is preserved exactly; formalization is a later explicit act, never inference',
			note: 'JPWB-DOC-003 §2 carries both operative clauses of this rule verbatim — the exact preservation and the prohibition on inferring formalization.'
		},
		why:
			'Every clause states what an ACCEPTED CaptureIntent produces: the emitted event, the initial status, ' +
			'semantic version 1, revision 1, and the preserved expression. Nothing is refused, so the ENFORCED arm ' +
			'has no refusal to cite and the UNENFORCED arm has no arrangement to name. The one clause that reads as ' +
			'a prohibition — "infers no formalized objective automatically" — is a constraint on what the HANDLER may ' +
			'DO on the success path, not a command it must refuse: it would be violated by the handler writing a ' +
			'formalized objective it was not given, and no probe can arrange that because no command asks for the ' +
			'inference. The instrument that holds this rule is an assertion over the created state and the emitted ' +
			'event, which `intent.test.ts` already carries; a refusal probe would be the wrong shape of evidence.'
	},
	'RPH-INT-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'formalization is a later explicit act, never inference',
			note: 'JPWB-DOC-003 §2. GENERAL rather than CARRIED because canon states that formalization is explicit and never inferred, while this rule enumerates what the explicit act PERSISTS (desired outcomes, success conditions) and which status it lands in — specifics canon does not name.'
		},
		why:
			'The same shape as RPH-INT-001, and non-enforced for the same reason: "accepting FormalizeIntent sets ' +
			'status FORMALIZED, increments the semantic version, persists desired outcomes and success conditions, ' +
			'and emits IntentFormalized" describes a SUCCESSFUL dispatch in full. The only refusal in the vicinity ' +
			'belongs to a different rule — approveIntent\'s precondition refuses an out-of-state approval, which is ' +
			'RPH-INT-003 — and crediting it here would be a subject substitution. What could go wrong with this rule ' +
			'is a field silently dropped on the success path, which is the F-I shape; the instrument for that is a ' +
			'state-and-event assertion, not a refusal probe. ' +
			'AND IT HAS GONE WRONG — DISCOVERED WHILE BUILDING RPH-INT-003\'s PROBE, 2026-08-02, and filed as ' +
			'REG-F-009. The clause "increments semantic version" IS NOT PERFORMED: `formalizeIntent` does not set ' +
			'`bumpSemanticVersion`, so a FORMALIZED intent is still at v1; only `reviseIntent` bumps. The probe ' +
			'fixtures approved v2 on that assumption and had to be corrected to v1 against the running engine. The ' +
			'disposition is UNCHANGED and correct — no command is refused, and this register still has nothing to ' +
			'enforce here — but the row would be misleading if it recorded the arm without recording that the ' +
			'acceptance statement it declines to gate is one the engine does not fully honour.'
	},
	'RPH-INT-003': {
		kind: 'ENFORCED',
		// NO_CANON_CARRIER IS A RULING, not an omission, and it overrides what the investigation proposed. The
		// candidate anchor was JPWB-REG-005 REG-Q-007's *Safe default* clause — which does occur in a canon
		// artifact, so the carriage gate would have passed it. It is refused as carriage because REG-005 is the
		// Decision and Divergence REGISTER and that sentence is the safe default of an OPEN QUESTION whose own
		// merge target is DOC-003: it records what to do PENDING a ruling, and treating a pending default as a
		// ratified carrier would let an unresolved question impersonate canon. The gate cannot make that
		// distinction — it matches substrings — which is exactly why the judgment is recorded here in prose.
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'Canon carries no Intent status machine at all. JPWB-DOC-003 §6 consigns "All exact state ' +
				'enumerations and the closed transition/guard tables" to repository shapes, and its list of ' +
				'aggregates that DO carry explicit state sets — decompositions, recompositions, plans, runtime ' +
				'bindings, assessments, baselines — does not include Intent. STA-6 is the only canon rule whose ' +
				'scope names the intent lifecycle, and none of its four clauses constrains the ORDER of intent ' +
				'status transitions. Adopting STA-4 ("the illegal-transition set is absolute") would be a subject ' +
				'substitution: its nine enumerated laundering paths are all PWU work-lifecycle, plan or baseline. ' +
				"So this rule's only textual home is the pre-canon conformance specification (§7), and retirement " +
				'loses it.'
		},
		enforcedAt:
			'DECLARATION: packages/rph-application/src/handlers/intent.ts — approveIntent declares `precondition: fromStates(\'FORMALIZED\', \'REVISED\')`. MECHANISM: packages/rph-application/src/handlers/command-precondition.ts — the FROM_STATES arm of evaluatePrecondition, which mints the code and the message. INVOCATION: intent.ts — advanceIntent evaluates the precondition immediately after loadOrReject and BEFORE the precheck and BEFORE checkTransition.',
		refusalCode: 'RPH_ILLEGAL_STATE_TRANSITION',
		// THE TAIL IS THE MARKER, and it has to be. `RPH_ILLEGAL_STATE_TRANSITION` is produced by the machine, by
		// four prechecks, and by every source set in the system; a code-only probe would prove only that SOMETHING
		// refused. Widening the precondition to admit RAW makes `checkTransition` refuse the same arrangement with
		// the SAME code and a different message, so this marker is what distinguishes the site that actually ran.
		refusalMarker:
			'to be FORMALIZED or REVISED, but it is RAW. Re-issuing it would append a second IntentApproved',
		declaredMutations: [
			"widen the precondition to fromStates('RAW', 'FORMALIZED', 'REVISED') — the INT-004 precheck then fires instead (a RAW intent's desiredOutcomes is always [], since captureIntent hard-codes it and only FormalizeIntent writes outcomes), so the probe reports WRONG_CODE",
			'widen the precondition AND delete the INT-004 precheck limb — checkTransition then refuses RAW -> APPROVED with the SAME code and a different message, so a code-only probe reports a false KILLED and only the marker reports MASKED',
			'move the evaluatePrecondition block in advanceIntent to AFTER the precheck call — the INT-004 refusal wins on a RAW intent and the probe reports WRONG_CODE',
			"change the FROM_STATES arm's code in command-precondition.ts to RPH_VALIDATION_SEMANTIC_FAILED — WRONG_CODE, and it falsifies the ratified statement's own named code"
		]
	},
	'RPH-INT-004': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor:
				'is the authorized description of the problem, desired outcomes, users, constraints, non-goals, and s',
			note: 'JPWB-DOC-002 §5 (the Intent definition) makes desired outcomes constitutive of an AUTHORIZED intent. GENERAL rather than CARRIED because canon defines what an approved intent IS and never states the cardinality this rule enforces — "at least one" is the repository shape of canon\'s definition.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/intent.ts — approveIntent, the FIRST limb of its `precheck`, evaluated by the shared advanceIntent primitive after the precondition and before checkTransition.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'An approved intent must record at least one desired outcome (INT-004)',
		declaredMutations: [
			'delete the empty-outcomes arm from approveIntent’s precheck — the approval is accepted and the probe reports ADMITTED',
			'test `outcomes !== undefined` instead of `Array.isArray(outcomes) && outcomes.length > 0` — an empty array passes, which is the arrangement this row refuses',
			'reorder the precheck so the version-binding limb (RPH-INT-005) runs first — the probe then reports MASKED, since that limb carries its own marker'
		]
	},
	'RPH-INT-005': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'A decision approving version n never authorizes version n+1.',
			note: 'JPWB-DOC-003 §8 states the version-binding rule for DECISIONS generally; this rule is its Intent instance. GENERAL rather than CARRIED because canon names decisions and not intent approval specifically — the general rule survives retirement of the pre-canon §7 corpus, the Intent-specific application does not.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/intent.ts — approveIntent, the SECOND limb of its `precheck` (labelled W3-INC-1): the approval\'s `approvedSemanticVersion` must equal the intent\'s current semanticVersion.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		// DELIBERATELY NOT sharing RPH-INT-004's marker, and the two are refused by the SAME precheck in sequence —
		// the RPH-PWU-009/010 situation. INT-004 fires FIRST, so this row's probe must supply desired outcomes to
		// reach the limb it is about; an arrangement that omitted them would green this row on INT-004's refusal.
		refusalMarker: 'A stale or mismatched approval cannot govern this intent version',
		declaredMutations: [
			'delete the version-comparison arm from approveIntent’s precheck — a stale approval is accepted and the probe reports ADMITTED',
			'compare against the approval’s own `approvedSemanticVersion` instead of the intent’s current `semanticVersion` — the check becomes a tautology, the F-30 shape',
			'drop the `typeof currentVersion === \'number\'` fail-closed guard so an unversioned intent skips the comparison entirely'
		]
	},
	'RPH-INT-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor:
				'upstream semantic change, and post-recomposition sibling conflict route satisfied work into reshapin',
			note: 'JPWB-DOC-003 §5 states that an upstream semantic change routes satisfied work into reshaping — the consequence this rule enumerates in detail. GENERAL because canon names neither Intent revision specifically nor the six separate effects listed here.'
		},
		why:
			'Six consequents, and every one is an OUTCOME of an accepted ReviseIntent: the version increments, the ' +
			'event is emitted, impact analysis is requested, descendants are classified, the prior baseline stays ' +
			'immutable, prior approvals are marked review-required. No dispatch violates this rule by being ACCEPTED. ' +
			'Two of the six moreover have no plane to occur in — "requests impact analysis" and "classifies affected ' +
			'descendants" need the impact-analysis surface this engine does not have (`impactedObjects` has no ' +
			'production caller and awaits a TraceLink-minting command), which is the same blocker that keeps DOC-003 ' +
			'DEC-2 unimplemented on the revise path under REG-F-006. Filing this as a disclosure would claim a ' +
			'refusal gap where the truth is an absent capability recorded elsewhere.'
	},
	'RPH-INT-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'a superseded intent cannot authorize new PWUs',
			note: 'JPWB-DOC-003 §5 STA-6 states the rule verbatim. Carriage is total here even though enforcement is absent — the independence of the two axes, in the direction RPH-EXE-007 already demonstrates.'
		},
		why:
			'THE ANTECEDENT IS COMMAND-UNREACHABLE, which is an unusual reason for this arm and must be read as ' +
			'stated: this row does NOT mean ProposePwu is guarded. It is not. `proposePwu` loads the intent, checks ' +
			'that it EXISTS, then narrows it to `{ ontologyId, ontologyVersion }` and copies those two fields; it ' +
			'never reads `intentStatus`, so a superseded intent would sail through. But no dispatch sequence can put ' +
			'an Intent into SUPERSEDED: six INTENT commands are registered, none targets it, `SupersedeIntent` and ' +
			'`WithdrawIntent` occur nowhere in the repository, intent.ts is the only production writer of the ' +
			'aggregate, and the engine has no generic aggregate-mutation command. SUPERSEDED and WITHDRAWN are ' +
			'declared terminal states of the ratified machine and both are unreachable. So the ENFORCED arm is closed ' +
			'by the absent guard, and BOTH members of the UNENFORCED guard union are closed too: OBSERVED_ADMISSION ' +
			'has no dispatchable arrangement, and DEAD_PREDICATE has no honest subject — `INTENT_AT_LEAST_PROVISIONAL` ' +
			'is a trap that would PASS the census gate (its census is pwuGuards.ts alone, excluding the command ' +
			'layer) while being false on both clauses: it IS asked, from markPwuReady, and its subject is a ROOT PWU ' +
			'at readiness rather than any PWU at proposal, so a non-root PWU escapes it entirely. That is the ' +
			'RPH-EXE-005 substitution and the RPH-ASR-004/008 near miss taken together, and it is declined here ' +
			'deliberately rather than stumbled into. THE RESIDUE, stated because it is real: if SUPERSEDED ever ' +
			'becomes reachable, this rule becomes a live UNENFORCED_DISCLOSED row on the same day.'
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-PWU FAMILY — FIVE OF TEN, AND THE FAMILY IS DELIBERATELY NOT YET TOTAL (2026-08-02).
	//
	// `TOTAL_OVER_FAMILIES` does NOT list RPH-PWU, and that is a statement rather than an oversight. RPH-PWU-002
	// and RPH-PWU-004 are enforced and probed; RPH-PWU-001, -005 and -006 need no probe because nothing is refused;
	// RPH-PWU-009 and -010 have been rows since JAN-EXECREM. THE THREE THAT ARE MISSING — RPH-PWU-003, -007 and
	// -008 — are all investigated and all three are UNENFORCED_DISCLOSED with OBSERVED_ADMISSION guards whose
	// arrangements are long (a full PWA authoring-and-publish chain; a full execution-and-assurance chain; a full
	// drive to INVALIDATED followed by a baseline promotion). Landing a disclosure without its observation would be
	// the one thing this arm may never do, so they are recorded as owed instead.
	//
	// A TRAP THIS FAMILY CARRIES, worth naming because it nearly cost a false row. `proposePwu` refuses a named-but-
	// absent parent with a message ending "(PWU-003)" — the production code CLAIMS this rule id. It is not this
	// rule: the ratified statement is that a NON-ROOT PWU WITHOUT a parent (or independent authority) is rejected,
	// and that guard fires only when a parent IS named and does not resolve. A non-root PWU naming no parent at all
	// sails through, which is why RPH-PWU-003 is a disclosure and not an ENFORCED row citing that marker. A refusal
	// message naming a rule id is not evidence that the rule is enforced.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-PWU-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'At birth the axes initialize independently (proposed; not planned; unassessed; unknown).',
			note: 'JPWB-DOC-003 §5 carries all four initial axis values verbatim and in the same order as the ratified statement.'
		},
		why:
			'The RPH-INT-001 shape, in the PWU family: every clause states what an ACCEPTED ProposePwu produces — the ' +
			'four independent axis values it initializes and the event it emits. Nothing is refused, so there is no ' +
			'arrangement for a probe to observe being refused and none for a disclosure to observe being admitted. ' +
			'The failure mode is a handler writing the WRONG initial value on a path that succeeds, and the ' +
			'instrument for that is an assertion over created state and emitted event — which `pwu.test.ts` carries ' +
			'— not a refusal probe. Recorded rather than omitted so the family is legible: four of this register\'s ' +
			'rows are now in this arm for this same reason, and it is a property of how these rules are WRITTEN, not ' +
			'a gap in what the engine does.'
	},
	'RPH-PWU-002': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor:
				'All material work traces to originating intent or an explicitly declared exploratory purpose',
			note: 'JPWB-CON-000 §6 requires all material work to trace to an originating intent. GENERAL rather than CARRIED because canon states the traceability requirement and never says that the PROPOSAL command is the point of refusal — the general rule survives retirement of the pre-canon §8 corpus, this command-level application does not.'
		},
		enforcedAt:
			'packages/rph-application/src/handlers/pwu.ts — proposePwu, whose first act resolves the payload’s intentId against the store and refuses when it does not exist.',
		refusalCode: 'RPH_VALIDATION_SEMANTIC_FAILED',
		refusalMarker: 'ProposePwu requires an existing intent',
		declaredMutations: [
			'delete the `if (!intentObj)` refusal arm AND read the intent state as `intentObj?.state ?? {}` — the PWU is created citing an intent that does not exist and the probe reports ADMITTED. The optional chain is PART of the mutation: a bare deletion throws on the next line and would redden the probe by CRASHING rather than by admitting, which is a different result wearing the same colour',
			'resolve the intent with `ctx.store.loadObject(p.intentId) ?? {}` so a missing intent yields an empty object that passes the truthiness test — the F-30 shape, a guard that still runs and can no longer fail'
		]
	},
	'RPH-PWU-004': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'required inputs, expected outputs, at least one completion claim or verification criterion',
			note: 'JPWB-DOC-003 §5 STA-5 (readiness is a substantive shape gate) enumerates the admission requirements this rule names, including the expected-outputs limb the marker pins.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/pwuGuards.ts — checkPwuShapeReadiness, whose §9.1 limb fails when expectedOutputs is empty. ENFORCEMENT: packages/rph-application/src/handlers/pwu.ts — markPwuReady, which refuses when the readiness contract is unmet and names the unmet limbs in the message.',
		refusalCode: 'RPH_VALIDATION_SEMANTIC_FAILED',
		// THE UNMET LIMB IS PART OF THE MARKER. The message is built as `…contract (DOC-002 §9): ${unmet.join('; ')}`,
		// so the prefix alone would be satisfied by ANY readiness failure — including limbs this row does not
		// exercise. Pinning the limb is the same discipline RPH-EVD-003/007 use for the admissibility condition name.
		refusalMarker: 'shape readiness contract (DOC-002 §9): expected output (DOC-002 §9.1)',
		declaredMutations: [
			'delete the `if (!readiness.ok)` arm from markPwuReady — SHAPING -> READY then advances on transition legality alone and the probe reports ADMITTED',
			'remove the `expectedOutputs.length === 0` limb from checkPwuShapeReadiness — for this minimal-delta fixture the command is ACCEPTED; for a multi-limb fixture the refusal would survive with a different message, so the marker rather than the code is what reports it',
			'return `{ ok: true, unmet: [] }` from checkPwuShapeReadiness unconditionally — the predicate still runs and can no longer fail'
		]
	},
	'RPH-PWU-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Execution success moves work toward evidence and assurance, never directly to satisfaction.',
			note: 'JPWB-DOC-003 §5 STA-2 states the rule verbatim, in the same direction: success routes toward evidence, not to satisfaction.'
		},
		why:
			'The statement is a conjunction of OUTCOMES of an accepted transition — execution state becomes SUCCEEDED, ' +
			'lifecycle becomes EVIDENCE_PENDING — followed by two NEGATIVE clauses that assert what does NOT happen ' +
			'automatically. Nothing is refused. The negative clauses are the interesting half and they are still not ' +
			'refusals: "assurance state is not automatically SATISFIED" forbids the ENGINE from inferring a ' +
			'disposition, and a probe cannot arrange for an inference that no command requests. What DOES refuse a ' +
			'controller asserting satisfaction unbacked is `rejectUnbackedDisposition`, and that belongs to a ' +
			'different subject — the assertion, not the automatic inference — so crediting it here would be a subject ' +
			'substitution of exactly the kind the RPH-PWU-003 comment above records.'
	},
	'RPH-PWU-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A PWU may become satisfied only when execution succeeded, required evidence is admitted, and al',
			note: 'JPWB-DOC-003 §5 STA-3 states the satisfaction gate, and its "only when" form is what makes the reading below a judgment rather than a reading.'
		},
		why:
			'The ratified statement is PERMISSIVE — "the PWU MAY transition to SATISFIED" — and a permission is never ' +
			'a refusal a dispatch can observe, which is the same reading that puts RPH-EXE-009 in this arm. ' +
			'A DISCLOSED ALTERNATIVE, recorded because it is a real fork and not a formality: canon states the same ' +
			'rule in the "only when" form, which reads as a GATE, and under that reading the rule would be a ' +
			'refusal — the negative case being a PWU reaching SATISFIED with a condition unmet. That negative case is ' +
			'already carried by RPH-PWU-007, which IS dispositioned as a disclosure with an observed admission. So ' +
			'the two readings do not disagree about the engine\'s behaviour, only about which row records it, and ' +
			'recording it twice would let one arrangement green two rules — the duplicate-marker failure, one level ' +
			'up. If the sponsor rules that canon\'s "only when" governs, this row becomes a duplicate of RPH-PWU-007 ' +
			'rather than a new finding.'
	},
	'RPH-PWU-003': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'Canon states the PARENTAGE obligation nowhere. JPWB-DOC-003 §5 STA-5 governs a PWU\'s shape ' +
				'readiness and enumerates required inputs, expected outputs and verification criteria — it never ' +
				'mentions a parent, an authority, or the root/non-root distinction. The architecture-side rules ' +
				'(DOC-001 §5, the PWA composition invariants) govern the PWU TYPE graph, which is a different object: ' +
				'they say a non-root TYPE is reachable from the root type, not that a non-root INSTANCE must have a ' +
				'parent instance. Adopting either as the carrier would be the subject substitution this register ' +
				'records twice already (RPH-EXE-005 over STA-5, RPH-ASR-010 over the floor gate). So this rule\'s ' +
				'only textual home is the pre-canon conformance specification (§8), and retirement loses it.'
		},
		why:
			'A PWU Instance realizing a PWU Type the published architecture declares NON-ROOT is accepted with no ' +
			'parentage of any kind. `proposePwu` does police parentage — but only when a parent IS NAMED: it refuses ' +
			'a `parentWorkUnitId` that does not resolve. There is no arm for the parent being ABSENT, and no arm for ' +
			'the "independent authority" the ratified statement offers as the alternative — no field on ProposePwu ' +
			'carries one. THE REFUSAL THAT LOOKS LIKE THIS RULE AND IS NOT IT: that named-but-absent-parent guard ' +
			"ends its message \"(PWU-003)\", so production CLAIMS this rule id. It enforces the converse — a wrong " +
			'parent, not a missing one — and reading the id as evidence would have bought an ENFORCED row with a ' +
			'real marker, a real code and a passing probe, for a rule nothing enforces. That is why this row exists ' +
			'and why its control is that very refusal: the delta between the admitted arrangement and the refused ' +
			'control is WHETHER A PARENT IS NAMED AT ALL.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a published architecture whose CHILD type is declared isRoot:false and reachable from the root, an Undertaking bound to it, and a PWU Instance of that child type proposed with no parentWorkUnitId — accepted, and persisted with no parentage',
			control:
				'the same ProposePwu at the same site with ONE field ADDED — a parentWorkUnitId that resolves to nothing — which IS refused. The engine polices a parent that is WRONG while ignoring one that is ABSENT.',
			whyNoPredicate:
				'No kernel predicate decides whether a non-root instance has parentage. `INTENT_AT_LEAST_PROVISIONAL` ' +
				'and the rest of `checkPwuShapeReadiness` quantify over a ROOT PWU at MarkPwuReady, not any PWU at ' +
				'proposal, so a non-root instance escapes them entirely — and that predicate is asked from ' +
				'markPwuReady, so it fails `deadPredicate`\'s first clause as well. Naming it would be the ' +
				'RPH-EXE-005 substitution and the RPH-ASR-004/008 near miss at once.'
		}
	},
	'RPH-PWU-007': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Any rejected mandatory assessment blocks satisfaction.',
			note: 'JPWB-DOC-003 §7 states it as an absolute over ANY rejected mandatory assessment — the quantifier is the whole rule, and it is the quantifier the engine does not have.'
		},
		why:
			'THE ENGINE CHECKS THE ASSESSMENT IT WAS HANDED, NEVER THE SET. Reaching workLifecycleState SATISFIED ' +
			'does require a real backing assessment — `rejectUnbackedDisposition` refuses a controller asserting a ' +
			'disposition with nothing behind it, and the UNDER_ASSURANCE->SATISFIED cross-axis guard refuses the ' +
			'arrow unless assuranceState is SATISFIED. Both are live and both are probed. What neither does is ' +
			'quantify over the PWU\'s REQUIRED assessments: the controller supplies `supportingObjectIds`, the guard ' +
			'validates THOSE, and a second assessment sitting in REJECTED against a policy the PWU itself declares is ' +
			'never loaded. THE DECLARATION EXISTS AND IS INERT: `assurancePolicyIds` is a REQUIRED field on ' +
			'ProposePwu and is written to the aggregate (pwu.ts), and — measured — it is read by nothing anywhere for ' +
			'any decision. So the rule\'s word "required" has a home on the object and no reader. ADJACENT AND ' +
			'DISTINCT, recorded so the two are not merged: RPH-ASR-012 discloses the same missing quantifier on the ' +
			'ASSURANCE axis (aggregate disposition across required policies); this row is the WORK LIFECYCLE axis. ' +
			'Different rules, different ratified statements, different arrangements — but one underlying absence, and ' +
			'closing it would likely close both.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a PWU whose own assurancePolicyIds names a policy whose required assessment came back REJECTED, moved to workLifecycleState SATISFIED by citing a second, satisfied assessment — accepted, with the rejected one still reading REJECTED',
			control:
				'the byte-identical ChangePwuState with ONE field changed — assuranceState left at ASSESSING — which the same site refuses via the UNDER_ASSURANCE->SATISFIED cross-axis guard, proving the arrow’s owner is alive and simply never looks past the assessment it was handed',
			whyNoPredicate:
				'`satisfiesP1` and the cross-axis guard are both asked on this path, so neither is dead. The missing ' +
				'thing is not a predicate but a QUANTIFIER with nothing to quantify over at the call site: no handler ' +
				'assembles the PWU\'s required-assessment set, so there is no symbol whose census could witness the ' +
				'gap closing — the RPH-ASR-012 shape exactly.'
		}
	},
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE FIRST SCHEMA-LAYER ROW (2026-08-02), and the reason `RefusalLayer` exists.
	//
	// RPH-CON's obligations are enforced by the CONTRACT, not by a handler: `command-bus` validates the payload and
	// returns status VALIDATION_FAILED before any handler runs. `classifyRefusal`'s original arm read only
	// `REJECTED`, so it classified real, working enforcement as ADMITTED — which is why this register's scope
	// paragraph said RPH-CON was structurally inexpressible. It was not inexpressible; it was a second layer.
	//
	// THE FAMILY IS NOT TOTAL AND RPH-CON IS NOT IN `TOTAL_OVER_FAMILIES`. This is one row of eight, landed to prove
	// the arm against a real refusal rather than only against synthetic input. The other seven are uninvestigated.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-CON-002': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'CANON DELIBERATELY DELEGATES THIS, which makes it the one NO_CANON_CARRIER row whose subject does ' +
				'NOT die on retirement. JPWB-CON-000 B1 assigns "Exact shapes (wire envelopes, schemas, enum ' +
				'spellings, IDs, error codes)" to "the repository\'s generated contracts, schemas, migrations, and ' +
				'conformance tests", and names those artifacts SHAPE AUTHORITY in their own right. So no canon ' +
				'sentence states that an undeclared property is rejected, and none should: the ratified vocabulary ' +
				'generates a `z.strictObject`, and that schema IS the authority. Recorded as NO_CANON_CARRIER because ' +
				'the field means "no canon artifact carries this text" and that is true — but with the qualification ' +
				'that the retirement risk the other NO_CANON_CARRIER rows carry does not apply here, since the ' +
				'carrier is generated code that retirement does not touch.'
		},
		enforcedAt:
			'packages/rph-application/src/command-bus.ts — the payload validation step, which calls `validateAgainst` (packages/rph-contracts/src/validate.ts) against the generated `z.strictObject` payload schema and returns status VALIDATION_FAILED before any handler is routed to.',
		refusalCode: 'RPH_VALIDATION_SCHEMA_FAILED',
		refusalLayer: 'SCHEMA',
		// STRUCTURED, NOT PROSE. The boundary's message is the constant 'Schema validation failed' for every failure
		// in the system, so a message marker would discriminate nothing at all. This is `<issueCode>@<dottedPath>`
		// matched by EQUALITY against `error.details.issues`. The path is EMPTY because zod reports an undeclared
		// property at the object root — which is itself the claim, and why the match is equality rather than
		// substring: `unrecognized_keys@someField` is a different (nested) failure and must not green this row.
		refusalMarker: 'unrecognized_keys@',
		declaredMutations: [
			'regenerate the payload schemas with `z.object` instead of `z.strictObject` — the undeclared property is silently dropped, the command is ACCEPTED, and the probe reports ADMITTED',
			'have `validateAgainst` return `{ ok: true }` on `unrecognized_keys` while still failing other issues — the probe reports ADMITTED and no other row moves',
			'drop `details.issues` from the RphError built by `validateAgainst` — the boundary still refuses, but the row can no longer say WHICH field, and the probe reports MASKED. This is the mutation that shows the marker is doing work: a message-only assertion would still report KILLED.'
		]
	},
	'RPH-CON-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'The same delegation RPH-CON-002 records: JPWB-CON-000 B1 assigns "Exact shapes (wire envelopes, ' +
				'schemas, enum spellings, IDs, error codes)" to the repository\'s generated contracts and names them ' +
				'shape authority. No canon sentence says a well-formed envelope validates, and none should. As with ' +
				'RPH-CON-002 the usual retirement risk does not apply — the carrier is generated code.'
		},
		why:
			'THE PUREST ACCEPTANCE STATEMENT IN THE CATALOG: not "accepting X does Y" but simply "X is accepted", ' +
			'with no consequent at all. Its whole content is that well-formed input is not obstructed, so no ' +
			'arrangement can be refused and none can be observed being admitted. ARM 1 IS STRUCTURALLY UNBUILDABLE ' +
			'rather than merely unwarranted: `classifyRefusal` returns ADMITTED for status ACCEPTED in BOTH arms and ' +
			'only KILLED is a pass, so a row whose evidence IS an acceptance can never produce one. ' +
			'AND IT IS ALREADY THE REGISTER\'S POSITIVE CONTROL: every probe\'s control half — "the SAME command ' +
			'ACCEPTED before the arranging act" — is an instance of this rule, so it is continuously exercised ' +
			'without being a row. Minting an UNENFORCED row would make the disclosure set and the control set share ' +
			'an arrangement, one dispatch simultaneously proving a gap and proving the machinery alive. ' +
			'MEASURED RESIDUE, recorded so this row is never read as "the command envelope is validated" — IT IS ' +
			'NOT. The bus validates only `command.payload`; the envelope is checked against `DomainCommandSchema` ' +
			'nowhere. The rule therefore holds VACUOUSLY at the bus rather than because a command-schema check ' +
			'passed. That is REG-F-011, whose crash half is fixed and whose validation half is owed — and reading ' +
			'the contrapositive ("an incomplete envelope fails validation") as THIS rule would be the substitution ' +
			'RPH-EXE-005, RPH-ASR-010 and RPH-PWU-003 each decline.'
	},
	'RPH-CON-003': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Updates to existing aggregates declare the revision they believe current',
			note: 'JPWB-DOC-003 §9 PER-4 (optimistic concurrency; never last-write-wins) states the obligation directly, and states it of the CALLER — which is what makes an omitted declaration a gap rather than a default.'
		},
		why:
			'`loadOrReject` polices a revision that is WRONG and ignores one that is ABSENT — the RPH-PWU-003 delta, ' +
			'in the concurrency plane. A command updating an existing aggregate with `expectedRevision` omitted is ' +
			'accepted and the aggregate really moves. The ratified statement\'s escape clause makes it worse rather ' +
			'than better: "unless the command type is explicitly exempt" presupposes an exemption mechanism, and NO ' +
			'EXEMPTION MECHANISM OF ANY KIND EXISTS in the repository — so the rule is not partially enforced with a ' +
			'declared allowlist, it is enforced for no command and exempt for none. Last-write-wins is precisely ' +
			'what PER-4 forbids, and it is the default for every caller that simply omits the field.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'an INTENT created by CaptureIntent, then UPDATED by BeginIntentDiscovery with the envelope field `expectedRevision` OMITTED — accepted, and the aggregate really advances (revision 0 -> 1, RAW -> UNDER_DISCOVERY)',
			control:
				'the same update with ONE field ADDED — `expectedRevision: 99` against an aggregate at revision 1 — which `loadOrReject` DOES refuse with RPH_REVISION_CONFLICT. The engine polices a revision that is wrong while ignoring one that is absent.',
			whyNoPredicate:
				'The comparison is inline in `loadOrReject`, not a named predicate, and it IS asked on every update — ' +
				'so there is no dead symbol to census. What is absent is the arm for the field being undefined, and ' +
				'an absent arm has no name for a census to watch.',
			// An optimistic-concurrency refusal carries its OWN CommandResult status, not REJECTED. Discovered by
			// running this probe; declared rather than assumed.
			controlStatus: 'CONFLICT'
		}
	},
	'RPH-CON-004': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'NO_CANON_CARRIER',
			why:
				'CON-000 B1 delegates exact shapes — explicitly including "wire envelopes" and enum spellings — to ' +
				'the repository\'s generated contracts. No canon sentence states a timestamp format, and none should; ' +
				'the ratified vocabulary is where RFC-3339 would be expressed. As with the other RPH-CON rows the ' +
				'retirement risk does not apply, because the carrier would be generated code rather than prose.'
		},
		why:
			'The generated payload schemas type every timestamp as `z.string()` rather than an ISO datetime, so a ' +
			'caller-supplied timestamp is accepted in any shape and PERSISTED VERBATIM. Observed on two different ' +
			'commands and two different fields: `ProposeEvidence.capturedAt` accepts "definitely not a timestamp" ' +
			'(and `\'\'`), and `ProposeDecision.effectiveAt` accepts "whenever, honestly". This is not a boundary ' +
			'that refuses nothing — the SAME payload gate refuses a bad `evidenceType` at the same dispatch, which ' +
			'is this row\'s control. What is missing is the format constraint on the declared field, and the ' +
			'consequence reaches further than validation: an unparseable `capturedAt` is what freshness and ' +
			'staleness rules would have to compare against.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				"ProposeEvidence whose declared `capturedAt` is 'definitely not a timestamp' — accepted, and the value reads back verbatim from the store",
			control:
				"the byte-identical ProposeEvidence with `evidenceType: 'NOT_A_TYPE'` — refused by the SAME payload gate with RPH_VALIDATION_SCHEMA_FAILED and issue `invalid_value@evidenceType`. A DECLARED field, so it proves the gate is alive and constraining on this very schema.",
			whyNoPredicate:
				'There is no predicate: a format constraint is a SCHEMA fact, expressed by the generated type or not ' +
				'at all. Nothing could be dead, and nothing could be wired — which is why the guard is behavioural.',
			// The control is a BOUNDARY refusal, so it carries VALIDATION_FAILED rather than REJECTED. Declared
			// rather than assumed; see `controlStatus` for why that is opt-in.
			controlStatus: 'VALIDATION_FAILED'
		}
	},
	'RPH-CON-005': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Partial output — an unanswered mandatory criterion — is invalid output.',
			note: 'JPWB-DOC-003 §6 states it as an absolute. Note this anchor and RPH-CON-006/007\'s are distinct substrings of the SAME canon region — one passage carrying three ratified rules, as DOC-003 §7 does for RPH-EVD-005/006.'
		},
		why:
			'`completeAssuranceAssessment` never reads criterion RESULTS at all — the same absence RPH-ASR-004 and ' +
			'RPH-ASR-005 record from the disposition side, seen here from the COVERAGE side. A policy declaring five ' +
			'BLOCKING criteria is completed by a validator result answering four, and the assessment advances to ' +
			'SATISFIED with `completedAt` written. So a PARTIAL validator result mutates authoritative state, which ' +
			'is the precise consequent DOC-003 forbids. The rule names "the Assurance Service" as the rejecting ' +
			'actor and REG-F-007 records that no such component exists.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a policy with FIVE criteria all severityIfNotMet BLOCKING, assessed, then completed with claimResults answering only four of them and recommending SATISFIED — accepted, and the assessment really advances to SATISFIED',
			control:
				'the byte-adjacent completion with `subjectSemanticVersions: {}` while `subjectObjectIds` still names the subject, which `parseCompletion` refuses at the SAME site with RPH_VALIDATOR_OUTPUT_INVALID',
			whyNoPredicate:
				'`mandatoryCriterionUnmet` exists in rph-assurance and is reached only on the floor path, where it ' +
				'folds to INCONCLUSIVE rather than rejecting — so it fails both clauses of `deadPredicate`\'s ' +
				'contract, the RPH-ASR-004 finding restated for this rule.'
		}
	},
	'RPH-CON-006': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'rejects a validator result when identity, policy version, assessment identity, or subject semantic version mismatch',
			note: 'JPWB-DOC-003 §6. RPH-CON-007 cites the same sentence with its leading clause included; the two rules instantiate different items of the same enumeration (policy version here, subject semantic version there), which is why both anchors resolve to one passage.'
		},
		why:
			'THE CODE FOR THIS RULE EXISTS AND NO REFUSAL CARRIES IT. `RPH_POLICY_VERSION_MISMATCH` is one of the ' +
			'fifteen ratified error codes, and it occurs in exactly one non-test production file — ' +
			'`rph-assurance/src/assurance-rules.ts` — as a `reason` STRING on a boundary classification the floor ' +
			'path folds to INCONCLUSIVE. It is never an `error.code`. Observed: an assessment requested against a ' +
			'policy at version 1.2.0, completed by a validator result declaring 1.1.0, is ACCEPTED — and the emitted ' +
			'event records the ASSESSMENT\'s 1.2.0, erasing the version the validator actually claimed to judge. The ' +
			'record is not merely un-refused; it is silently corrected to look consistent. Filed system-wide as ' +
			'REG-F-010 group 2.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				"an assessment against a policy at version '1.2.0', completed by a validatorResult declaring policyVersion '1.1.0' — accepted, and the emitted event records the assessment's version rather than the validator's",
			control:
				'the byte-identical completion with `subjectSemanticVersions: {}`, refused by `parseCompletion` at the same site with RPH_VALIDATOR_OUTPUT_INVALID — the parse step reads the validator result and does refuse some of it',
			whyNoPredicate:
				'`classifyValidatorResult` computes the mismatch and returns it as a boundary `reason`; it is asked ' +
				'on the floor path, so it is not dead, and it does not produce a refusal, so it does not implement ' +
				'the rule. Both clauses of `deadPredicate`\'s contract fail.'
		}
	},
	'RPH-CON-007': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'The Assurance Service rejects a validator result when identity, policy version, assessment identity, or subject semantic version mismatch',
			note: 'JPWB-DOC-003 §6, the same sentence RPH-CON-006 cites — this row quotes it from the subject, including the actor the rule names and which REG-F-007 records as never built.'
		},
		why:
			'The subject-version twin of RPH-CON-006, and the same dead code: `RPH_SUBJECT_VERSION_MISMATCH` is ' +
			'ratified, occurs only as a kernel `reason` string, and is minted by no refusal anywhere. Observed: an ' +
			'assessment created to assess version 2 is completed by a validator result claiming version 1, is ' +
			'ACCEPTED, advances to SATISFIED, and the emitted event records the version the VALIDATOR claimed — ' +
			'overwriting the version the assessment was created to assess. ADJACENT AND DISTINCT, recorded so the ' +
			'rows are not merged: RPH-ASR-010 discloses that an assessment may bind a version the SUBJECT is not at ' +
			'(assessment vs world); this rule is the validator result contradicting the ASSESSMENT it answers ' +
			'(validator vs assessment). Same missing comparison, two different pairs of operands.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'an assessment requested with subjectSemanticVersions {pwu: 2}, completed by a validatorResult declaring {pwu: 1} — accepted, advancing to SATISFIED, with the event recording the validator’s version',
			control:
				'the byte-identical completion against a sibling assessment with `subjectSemanticVersions: {}` — which clears the boundary (z.record admits {}) and reaches the same handler’s same first statement, `parseCompletion`, which refuses',
			whyNoPredicate:
				'Same as RPH-CON-006: the kernel classifier computes the mismatch as a `reason` and is asked on the ' +
				'floor path. What is absent on the command path is any comparison of the validator’s declared ' +
				'versions against the assessment’s own — `parseCompletion` checks only that a version is NAMED.'
		}
	},
	'RPH-CON-008': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'No presentation contract may reference a Command capable of mutating PWU semantic state',
			note: 'JPWB-DOC-003 §2 states the separation directly and more broadly than the ratified statement, which enumerates four specific forbidden contents.'
		},
		why:
			'THE SUBJECT DOES NOT EXIST. The rule constrains what a presentation/canvas-layout command SCHEMA may ' +
			'contain, and this repository has no presentation command schema of any kind — the arrangement was ' +
			'attempted rather than assumed: dispatching `UpdateCanvasLayout` carrying a semantic version field, a ' +
			'lifecycle mutation, an assurance disposition and a baseline id returns "Unknown command type", and so ' +
			'does `MoveNode` with an EMPTY payload. A refusal insensitive to the rule\'s antecedent is not this rule ' +
			'being enforced, and the identical response to both is what closes the ENFORCED arm. The UNENFORCED arm ' +
			'is closed too: OBSERVED_ADMISSION needs the engine to ACCEPT what the rule forbids, and there is ' +
			'nothing to accept. This is a rule about a plane that does not exist — arm 3 by its own definition, and ' +
			'the RPH-EXE-007 shape. THE RESIDUE, stated because it is the whole risk: the day a presentation command ' +
			'IS authored, this becomes a live rule with a real subject, and nothing in this register would notice. ' +
			'The rule is satisfied by absence, which is not the same as being enforced.'
	},
	'RPH-PWU-008': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'invalidated work cannot be baselined',
			note: 'JPWB-DOC-003 §5 STA-4 names this as one of the enumerated laundering paths the illegal-transition set forecloses — stated absolutely, with no policy predicate.'
		},
		why:
			'THE PROMOTION PATH NEVER READS ITS ITEMS. `promoteBaseline` builds its candidate item set from the ' +
			'COMMAND PAYLOAD (`expectedItemObjectVersions`) and passes it to `canPromoteBaseline` as ' +
			'`{ objectId, semanticVersion, contentHash? }` — a shape with no lifecycle field to quantify over — and ' +
			'calls `ctx.store.loadObject` on no item at all. Measured: `workLifecycleState` and `lifecycleStatus` ' +
			'occur in both governance modules only as WRITES inside `newEnvelope` at object creation; the promotion ' +
			'path reads a PWU\'s state on no axis. So a PWU sitting in INVALIDATED is frozen into an AUTHORITATIVE ' +
			'baseline and the engine never asks. WHAT IS ENFORCED NEXT DOOR, recorded so the two are not confused: ' +
			'the same handler DOES refuse a promotion resting on invalidated EVIDENCE (RPH-BAS family), which is why ' +
			'this row\'s control is available at the same site — the machinery polices invalidation of one object ' +
			'type and not of the item it is promoting.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a PWU seeded into INVALIDATED, frozen into an APPROVED Baseline and promoted — accepted, and the baseline really becomes AUTHORITATIVE over that item',
			control:
				'the byte-identical promotion whose decision considered an Evidence that is then INVALIDATED, which the SAME handler refuses — same command, same site, same word "invalidated", one object type over',
			whyNoPredicate:
				'`canPromoteBaseline` is not dead — it is asked on this very path — so naming it would fail ' +
				'`deadPredicate`\'s first clause. And it could not implement the rule if it were: its item view has ' +
				'no lifecycle field, so the rule is inexpressible to it, which is the RPH-EVD-003 shape before that ' +
				'row was fixed. What is absent is a subject on the type, not a caller.'
		}
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-PER FAMILY, twelve of fourteen, added 2026-08-02.
	//
	// THE SHAPE THIS FAMILY FOUND IS **STATUS**, and it is the third structural blindness this register has had to
	// name. The COMMAND arm read `REJECTED` alone, and RPH-PER-001's refusal — a real one, at a named command-layer
	// site, with its own ratified error code — carries status `CONFLICT`. The register would have classified working
	// enforcement as ADMITTED, which is the exact error it exists to prevent, made by the instrument rather than by
	// the manifest. `refusalStatus` is the one opt-in field that fixes it, deliberately excluding VALIDATION_FAILED.
	//
	// AND THE FAMILY IS MOSTLY NOT REFUSALS AT ALL, which is why ten of these twelve rows are arm 3. §§18-20 of the
	// conformance specification are DURABILITY properties — replay equivalence, projection rebuild, outbox
	// atomicity, restart recovery. They state what the system PRESERVES, not what it refuses, and a refusal probe
	// cannot hold any of them. Recording that as a declared silence with a named enforcement site is the honest
	// disposition; inventing a fourth arm to make the register look more covering would not be.
	//
	// CARRIAGE IS THE STRONGEST OF ANY FAMILY SO FAR: canon has a dedicated twelve-rule persistence section
	// (JPWB-DOC-003 §9 PER-1..PER-12), and every one of these rows is CARRIED — several near-verbatim. That is
	// worth stating because the register's other families have needed CARRIED_BY_GENERAL_RULE and NO_CANON_CARRIER
	// repeatedly; here the pre-canon rule and the canon rule are usually the same sentence twice.
	//
	// TWO ROWS ARE OWED (RPH-PER-003, RPH-PER-004) and the family is therefore OUT of `TOTAL_OVER_FAMILIES`. Both
	// are cross-aggregate uniqueness disclosures needing OBSERVED_ADMISSION probes that drive the governance chain.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-PER-001': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Updates to existing aggregates declare the revision they believe current',
			note: 'JPWB-DOC-003 §9 PER-4 (Optimistic concurrency; never last-write-wins), which continues "On conflict, the command is rejected" — the ratified statement and the canon rule are the same rule twice. Cited to DOC-003 and NOT to REG-005, which also contains the phrase because REG-F-003 records this very verification.'
		},
		// THE FIRST ROW IN THE REGISTER WHOSE REFUSAL IS NOT `REJECTED`. Both halves are named because they are
		// different checks at different layers producing different messages, and only the first is what the
		// ratified statement describes: a CLIENT that declared a revision it had read.
		enforcedAt:
			'DECISION + ENFORCEMENT: packages/rph-application/src/handlers/kit.ts — the `command.expectedRevision !== existing.revision` arm of the load-for-update path, which returns `reject(command, RPH_REVISION_CONFLICT, …)`; `STATUS_FOR_CODE` in the same file maps that code to CommandResult status CONFLICT. THE SECOND, DEEPER GUARD, named so a reader is not surprised by it: `SqliteStorageAdapter.commit` re-checks the precondition inside the write transaction and returns `{ok:false, reason:"REVISION_CONFLICT"}`, which `commitState` maps to the same status with a DIFFERENT message. The store check closes the check/commit race the handler check cannot; the handler check is the one that sees the CLIENT\'s declared expectation, which is the rule\'s subject.',
		refusalCode: 'RPH_REVISION_CONFLICT',
		refusalStatus: 'CONFLICT',
		// DELIBERATELY THE CLAUSE THAT NAMES THE CLIENT'S EXPECTATION, not the shared 'Revision conflict on …'
		// prefix. The store's own conflict message is 'Revision conflict on X (actual revision N)' — byte-different
		// after the id — so a marker stopping at the prefix would let the deeper guard satisfy this row, and the
		// register would report the client-expectation check as enforced while only the store check had run.
		refusalMarker: 'command expected revision',
		// EACH ENTRY BELOW WAS APPLIED AND ITS VERDICT OBSERVED. The first one's stated outcome is a CORRECTION:
		// it read "the store still refuses, but with the OTHER message, so the probe reports MASKED" until the
		// mutant was actually run, and that was wrong for a reason worth keeping — see the entry.
		declaredMutations: [
			'delete the `command.expectedRevision !== existing.revision` arm in kit.ts — OBSERVED verdict ADMITTED, refused instead by the transition guard with RPH_ILLEGAL_STATE_TRANSITION. THE PREDICTION THAT FAILED, recorded because it is a fact about the two guards: the store\'s own conflict check CANNOT fire in a single-threaded probe, because `commitState` passes it the revision it JUST loaded, so expected always equals actual. The store check exists for a genuine concurrent race and is unreachable from a sequential arrangement — which means this row\'s enforcement rests on the handler arm ALONE, and the "second, deeper guard" named in `enforcedAt` is not a fallback the probe could ever observe.',
			'change the arm to `command.expectedRevision > existing.revision` so a STALE expectation passes and only a future one refuses',
			"drop `RPH_REVISION_CONFLICT` from STATUS_FOR_CODE in kit.ts — OBSERVED verdict ADMITTED. THIS IS THE MUTANT THAT PROVES `refusalStatus` IS LOAD-BEARING: the refusal still happens, still carries RPH_REVISION_CONFLICT, and still carries this row's exact marker text — only the STATUS changes, from CONFLICT to REJECTED. A register reading code and marker alone would have called it a kill.",
			'remove `refusalStatus` from this row — the COMMAND arm falls back to REJECTED and the probe reports ADMITTED, which is the pre-2026-08-02 behaviour and the whole reason the field exists'
		]
	},
	'RPH-PER-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Replaying a mutation with the same idempotency key returns the prior result',
			note: "JPWB-DOC-003 §9 PER-5 (Idempotency at the business-effect level), near-verbatim against the ratified statement. CANON STATES STRICTLY MORE THAN THIS RULE, and the surplus is violated: PER-5's third clause is \"Reuse of a key with a different payload fails\", a REFUSAL that nothing performs — see the `why` and REG-F-012. Cited to DOC-003, not to REG-005, which also carries the sentence only because REG-F-012 quotes it."
		},
		why:
			'THE STATEMENT IS AN OUTCOME AND THE OUTCOME IS PRODUCED, so neither the ENFORCED arm (which observes ' +
			'refusals) nor the UNENFORCED arm (which observes admissions of what must be refused) can hold it. ' +
			'Observed: a re-submitted idempotency key returns status DUPLICATE carrying the PRIOR receipt\'s ' +
			'`producedEventIds`, the event count is unchanged, and the aggregate does not advance. ENFORCED AT ' +
			'`packages/rph-application/src/command-bus.ts` — `dispatch` step 1, the `store.getReceipt` lookup — ' +
			'which is the COMMAND layer; only the receipt READ is the store\'s. (RPH-EXE-007\'s row said "the store ' +
			'layer" for six commits and is corrected in the same commit as this row.) THE PART CANON ADDS AND THIS ' +
			'ENGINE VIOLATES, recorded here because a reader of this row must not conclude PER-5 holds: a key reused ' +
			'for a DIFFERENT command is silently swallowed. Observed — a `CaptureIntent` for aggregate A accepted ' +
			'under key K, then a wholly different `CaptureIntent` for aggregate B reusing K, returns DUPLICATE and ' +
			'aggregate B IS NEVER CREATED, with the caller handed A\'s event id as its result. `command_receipts` ' +
			'stores `command_type`, `target_aggregate_id` AND `result_hash`, `getReceipt` returns all three, and ' +
			'step 1 compares none of them. That is REG-F-012, filed separately and DELIBERATELY NOT folded into ' +
			'this row: this rule\'s own statement holds, and letting a satisfied rule carry a disclosure about a ' +
			'neighbouring sentence is the subject substitution this register records four times over.'
	},
	// ── THE TWO ROWS THIS FAMILY WAS HELD OPEN FOR, LANDED 2026-08-02 WITH THEIR OBSERVATIONS ────────────────
	//
	// PER-003 AND PER-004 ARE THE SAME GAP ON TWO AGGREGATES, and the gap is a QUANTIFIER. Every duplicate defence
	// this engine has keys on ONE aggregate: the `fromStates` precondition reads the target's own status field;
	// the machine's illegal self-edge is same-aggregate by definition; the store's create conflict keys on the
	// aggregate id; the receipt keys on the idempotency key. All four answer "is THIS object being changed
	// twice?". Both rules ask a different question — "do TWO of these now exist over one subject?" — and nothing
	// anywhere forms that set.
	//
	// THE ARRANGEMENT IS NOT HYPOTHETICAL: it is what the demo surface does. `mintUiId` increments on every call,
	// so a repeated Propose mints a NEW Decision aggregate rather than colliding with the old one, and the
	// idempotency key is minted from a monotonic counter rather than derived from the submission — so neither the
	// same-aggregate guard nor the receipt lookup is reachable from a repeated browser POST. "A retried approval
	// request" is exactly the rule's own words for it.
	'RPH-PER-003': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'baseline promotions, approval decisions, or evidence records',
			note: 'JPWB-DOC-003 §9 PER-5, which names approval decisions in its list of business effects a retry must never duplicate. RPH-EXE-007 cites the opening clause of the same sentence for source-control commits; the sentence enumerates five effects and two rules instantiate different items of it.'
		},
		why:
			'THE SAME-AGGREGATE HALF IS ENFORCED AND IS NOT THE RULE. `ApproveDecision` and `GrantWaiver` both ' +
			'carry `fromStates(\'PROPOSED\')`, so re-approving an already-EFFECTIVE Decision is refused with ' +
			'RPH_ILLEGAL_STATE_TRANSITION — and that precondition is load-bearing rather than decorative, because ' +
			'the MACHINE would admit the re-issue: `Decision.status` declares `illegal: []`, so EFFECTIVE -> ' +
			'EFFECTIVE classifies NOOP and `checkTransition` lets a NOOP through. WHAT IS UNENFORCED is the rule as ' +
			'stated. `proposeDecision` takes its id straight from `command.targetAggregateId`, declares NO ' +
			'precondition at all, and consults no other Decision; `approveDecision`\'s precondition and guard both ' +
			'read ONLY the target aggregate\'s own state, and `ctx.store` is never touched inside the guard. The ' +
			'kernel cannot express the rule either: `authorizeDecisionEffective` takes a SINGLE `DecisionView` — ' +
			'there is no collection parameter in the signature, so uniqueness is inexpressible to it in principle, ' +
			'not merely unimplemented. THE CONTRAST CASE IN THIS SAME REPOSITORY, which is what makes this a gap ' +
			'rather than a design: `otherActivePlanExistsForPwu` is exactly the cross-aggregate uniqueness query ' +
			'this rule needs, written for RPH-EXE-001, and nothing analogous exists for decisions.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'two DISTINCT Decision aggregates proposed over the SAME subjectObjectIds, both APPROVAL, both approved — the second is ACCEPTED and both are EFFECTIVE, which is "two effective decisions" in the rule\'s own words',
			control:
				"a re-issued ApproveDecision on the FIRST decision, already EFFECTIVE, refused at the same site with RPH_ILLEGAL_STATE_TRANSITION — so the acceptance above is a missing quantifier, not a command that is never refused",
			whyNoPredicate:
				'No predicate could be named without lying about its shape. `authorizeDecisionEffective` is not ' +
				'dead — it is asked on this very path — so it fails `deadPredicate`\'s first clause; and its input ' +
				'is one `DecisionView` with no collection parameter, so it could not implement the rule if it were ' +
				'dead. What is absent is a QUERY over decisions, and a census cannot name a function nobody wrote.'
		}
	},
	'RPH-PER-004': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Retries must never duplicate commits, external API mutations, baseline promotions',
			note: 'JPWB-DOC-003 §9 PER-5. A LONGER span than RPH-PER-003 cites of the same sentence, deliberately: the two rules instantiate adjacent items of one enumeration, and identical anchors would leave a reader unable to tell which clause each row rests on.'
		},
		why:
			'THE SAME QUANTIFIER GAP AS RPH-PER-003, and the same-aggregate half is guarded MORE strongly here — ' +
			'which is worth recording because it is the difference a reader would otherwise assume away. Unlike ' +
			'`Decision.status`, `Baseline.status` DECLARES `AUTHORITATIVE -> AUTHORITATIVE` illegal, and ' +
			'`classifyTransition` consults the illegal table BEFORE the from===to shortcut, so a re-promotion of ' +
			'the same baseline is ILLEGAL_EXPLICIT at the machine layer rather than a NOOP. Two independent ' +
			'defences, both same-aggregate. THE RULE STILL FAILS: `createBaseline` takes its id from ' +
			'`command.targetAggregateId`, applies no precondition, reads the ITEMS\' versions and never asks ' +
			'whether another Baseline already freezes them; `canPromoteBaseline`\'s entire input describes ONE ' +
			'baseline (its only status field is the target\'s own) and its nine finding codes name no competing or ' +
			'already-authoritative sibling; and `listBaselines` filters by undertaking scope with no status ' +
			'selection, so two AUTHORITATIVE baselines over one item are both returned as rows. THE FIELD THAT ' +
			'WOULD HAVE CARRIED THE ANSWER IS RATIFIED AND DEAD: `ProfessionalWorkUnit.currentBaselineId` exists ' +
			'in the contract and its only production TypeScript reference is its own declaration — no handler ' +
			'writes it and none reads it. That is precisely the shape `activeExecutionPlanId` had before ' +
			'RPH-EXE-001 was enforced, and RPH-EXE-001 is the proof that this class of rule IS implementable here. ' +
			'ONE SHAPE TRAP FOR WHOEVER IMPLEMENTS THIS, learned the hard way: the wiring mutant written to redden ' +
			'this row FAILED TO KILL on its first run, because it read the baseline\'s items from `itemObjectIds` ' +
			'— the CreateBaseline PAYLOAD field — while the persisted aggregate carries `itemObjectVersions`, an ' +
			'array of `{objectId, semanticVersion}`. The check compiled, ran, and could never fire. A guard written ' +
			'against the payload field would be exactly as vacuous, and would pass its own tests.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'two DISTINCT Baseline aggregates created over the SAME itemObjectIds, each driven CANDIDATE -> UNDER_REVIEW -> APPROVED and promoted against the same effective promotion decision — the second is ACCEPTED and both are AUTHORITATIVE',
			control:
				'a re-issued PromoteBaseline on the FIRST baseline, already AUTHORITATIVE, refused at the same site with RPH_ILLEGAL_STATE_TRANSITION',
			whyNoPredicate:
				'`canPromoteBaseline` is asked on this path, so it is not dead; and its input type describes a ' +
				'single baseline, so it could not decide uniqueness if it were. The nearest DEAD symbol is the ' +
				'ratified field `currentBaselineId`, but a field is not a predicate: naming it under an arm whose ' +
				'contract is "a kernel predicate implements the rule correctly and nothing asks it" would claim a ' +
				'correct implementation that does not exist.'
		}
	},
	'RPH-PER-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Aggregate event history is gapless and strictly ordered',
			note: 'JPWB-DOC-003 §9 PER-4, final sentence. Canon states the gapless half as flatly as the ratified rule does; what neither states is which component refuses, and that is the whole content of this row.'
		},
		why:
			'THE ARRANGEMENT IS UNREACHABLE BY ANY DISPATCH, so this is arm 3 on the strength of a WRITE-PATH census ' +
			'rather than a subject that does not exist. `ctx.store.commit` has exactly ONE production caller ' +
			'repo-wide — `commitState` in packages/rph-application/src/handlers/kit.ts — which derives ' +
			'`newRevision` as `loaded.revision + 1` (or 0 on the create path) and sets the event\'s ' +
			'`aggregateRevision` to that same number. No handler chooses a revision; no command carries one. So no ' +
			'command can produce a gap or a duplicate, and an UNENFORCED_DISCLOSED row would be claiming a gap no ' +
			'arrangement can demonstrate — the RPH-EVD-002 reasoning. WHAT IS TRUE AT THE STORE, measured directly ' +
			'against the adapter because the rule names the event store as its enforcer and this register\'s ' +
			'instrument only reaches Engine.dispatch — and the two halves DIVERGE. DUPLICATE: refused, by the ' +
			'schema\'s `UNIQUE (aggregate_type, aggregate_id, aggregate_revision)` — but it THROWS a raw SqliteError ' +
			'out of `commit`, because `CommitResult` has exactly one failure reason (`REVISION_CONFLICT`) and no ' +
			'way to RETURN this one. That is REG-F-011\'s shape one layer deeper, and the envelope-identity fix does ' +
			'not cover it. GAP: ADMITTED — `commit` returned `{ok:true}` for an event whose `aggregateRevision` was ' +
			'99 on an aggregate at revision 0, leaving the stream [0, 99]. Nothing anywhere checks contiguity. Canon ' +
			'says gapless; the store permits a gap; only the derived write path makes it unreachable.'
	},
	'RPH-PER-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Materialized current state is a cache of this history, not a second authority',
			note: 'JPWB-DOC-003 §9 PER-2 (History is append-only and material change is event-backed). Canon states the EQUIVALENCE as a subordination — the materialized state is the cache, the history is the authority — which is the same claim the ratified rule makes as an equality.'
		},
		why:
			'A REPLAY-EQUIVALENCE PROPERTY, not a refusal: it asserts that two computations agree. No command is ' +
			'refused and none could be. IT IS GENUINELY PROVED, which is why this row also records where — ' +
			'`packages/rph-projections/src/pwu-replay.ts` (`replayPwuAxes`, the only production function in the ' +
			'repository that reconstructs an AGGREGATE\'S OWN STATE from its own event stream — the qualifier ' +
			'added the day this row landed, because an adversarial pass surfaced `buildConditionSubject` in ' +
			'rph-domain, which also folds ONE plan\'s events but produces a guard-evaluation subject rather than ' +
			'the aggregate, and `executionAttempts` in rph-projections, which folds Execution* events into ' +
			'per-attempt records. Neither reconstructs the object, but a reader deserves to find them here rather ' +
			'than conclude this row missed them), asserted in ' +
			'`packages/rph-engine/src/replay-equivalence.test.ts` against the live reference undertaking, comparing ' +
			'13 PWUs x 4 axes to the materialized objects and carrying a non-triviality control. TWO HONEST LIMITS. ' +
			'(1) The rule names "an Intent or PWU" and only the PWU half has a reducer; nothing reconstructs an ' +
			'INTENT. (2) The reducer rebuilds the four AXES, not the whole object. Also recorded: the conformance ' +
			'manifest lists 006 among the ids awaiting the M13 harness and gives it no per-id row, while the test ' +
			'asserts it by name — an UNDERclaim, the opposite of this register\'s usual finding, and left as it is ' +
			'because correcting a manifest row to claim coverage is a step that deserves its own scrutiny.'
	},
	'RPH-PER-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Rebuildability, not backup, is their durability guarantee',
			note: 'JPWB-DOC-003 §9 PER-7 (Projections are derived, disposable, and powerless). Canon carries the rebuild obligation; it does not name the three views, which is a difference of specificity rather than of rule.'
		},
		why:
			'A REBUILD PROPERTY, not a refusal. THE MANIFEST CITE WAS WRONG AND IS CORRECTED IN THIS COMMIT, and it ' +
			'is the sharpest miscitation this programme has found because the miscited file says so ITSELF. ' +
			'`conformance-manifest.ts` cited RPH-PER-007 to `packages/rph-projections/src/work-projection.test.ts`, ' +
			'whose relevant test is TITLED "the fold is pure (identical view every time) — NOT RPH-PER-007; see ' +
			'projection-rebuild.test.ts". Its comment records that the test previously DID claim the rule while ' +
			'asserting the fold equals ITSELF over a hand-authored two-event stream — "true of any pure function ' +
			'and of any broken one" — and that it was "actively CONCEALING a defect" (workProjector defaulted on ' +
			'every event but two, reporting every PWU as PROPOSED while the objects were BASELINED). The test was ' +
			'retitled 2026-07-17 and named its own replacement; the manifest kept pointing at it for six months. ' +
			'THE REAL COVERAGE is `packages/rph-engine/src/projection-rebuild.test.ts` against the live 251-event ' +
			'reference undertaking. THREE RESIDUES, recorded rather than smoothed: the "expected fixture ' +
			'projections" the rule compares against DO NOT EXIST (the test substitutes the materialized objects and ' +
			'says so); `buildAssuranceView` is not a `Projector<V>` at all, so the Assurance third of the rule is ' +
			'outside the framework the other two live in and has no rebuild-from-all-events test; and neither ' +
			'`workProjector` nor `compatibilityProjector` has any production consumer.'
	},
	'RPH-PER-008': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'atomically persist state, version history, events, outbox, and command receipt',
			note: 'JPWB-DOC-003 §9 PER-3 (One authoritative write path). Canon enumerates the five things that commit together, which is exactly the ratified rule plus the two the rule leaves implicit.'
		},
		why:
			'AN ATOMICITY PROPERTY OF THE STORE, not a refusal — nothing is rejected, and the rule\'s second clause ' +
			'("a transaction rollback leaves neither persisted") is a statement about a path no command can take. ' +
			'THE STRUCTURE HOLDS, by construction rather than by check: in `SqliteStorageAdapter.commit` the event ' +
			'INSERT and the outbox INSERT are in the SAME `for` loop body inside the SAME transaction callback, and ' +
			'the outbox row\'s `global_sequence` is `Number(info.lastInsertRowid)` read off the event insert\'s own ' +
			'return — so the outbox row is DATA-DEPENDENT on the event row and cannot precede it. There is exactly ' +
			'one `INSERT INTO outbox_messages` in the repository and it is inside that transaction; no relay, no ' +
			'post-commit write. THREE RESIDUES WORTH THE NEXT READER\'S ATTENTION, none of which this row\'s arm can ' +
			'hold: the schema declares NO foreign key from `outbox_messages.event_id` to `domain_events.event_id`, ' +
			'so nothing at the DDL level would prevent an orphan; the one rollback test is titled for the outbox and ' +
			'never queries it; and `SnapshotOverlayStorageAdapter.commit` — unlike the SQLite one — opens no ' +
			'transaction of its own, so a bare overlay commit has no rollback boundary at all. TWO CORRECTIONS TO ' +
			'THIS ROW, made the same day it landed, by an adversarial pass over its own supporting census. (1) The ' +
			'overlay is NOT untested: it is constructed only by `EngineHandle.fork()`, which is called three times ' +
			'in `packages/rph-engine/src/engine.test.ts` — a search for the CLASS NAME finds nothing, and the ' +
			'original claim was made from exactly that search. It has a production caller too ' +
			'(apps/rph-demo\'s authoring turn). What survives is narrower and still worth recording: no test ' +
			'exercises the overlay\'s ROLLBACK path, and its `commit` really does lack the self-wrapping boundary ' +
			'the SQLite adapter has. (2) "No post-commit write" was too strong — `markOutboxPublished` is a ' +
			'post-commit UPDATE of the outbox row\'s status, invoked from `drainOutbox`. The precise claim, and the ' +
			'one the rule needs, is that there is exactly one INSERT INTO outbox_messages and it is inside the ' +
			'commit transaction: no second APPENDER, so no orphan row can be created after the fact.'
	},
	'RPH-PER-009': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Projection lag can never alter an authoritative decision',
			note: 'JPWB-DOC-003 §9 PER-7, near-verbatim, and the neighbouring clause "canonical commands never validate against projections alone" carries the ratified rule\'s operative half.'
		},
		why:
			'A NEGATIVE STRUCTURAL PROPERTY — "commands continue to validate against canonical state" — which no ' +
			'refusal probe can observe: there is no command to dispatch whose acceptance or rejection would settle ' +
			'it. IT HOLDS, and the census that says so is worth recording because the answer was not obvious. ' +
			'Across all of packages/rph-application/src exactly ONE non-test file imports `@janumipwb/rph-projections` ' +
			'(`handlers/pwa-authoring.ts`) and the dependency edge is real, not accidental. What it imports is TWO ' +
			'PURE FUNCTIONS (`buildPwaGraphExport`, `analyzePwaGraph`) whose own module imports no store, no port ' +
			'and no adapter, fed from `ctx.store.readAllEvents()` and `ctx.store.loadObject()` — canonical state ' +
			'shaped INTO a projection-layer type, not read OUT of a projection. TWO STRUCTURAL FACTS MAKE THE ' +
			'MISTAKE HARD TO MAKE ELSEWHERE: `HandlerContext` carries only `store`, with no view handle, and the ' +
			'declarative-precondition surface is narrower still (`loadObject` and `readAggregateEvents` only). AND ' +
			'THE PREMISE IS CURRENTLY UNSATISFIABLE ANYWAY: the schema declares five tables and none is a ' +
			'projection, so nothing is persisted that a restart could leave stale — projections are in-memory folds ' +
			'rebuilt per request. That last fact is why this row is a declared silence rather than a verification: ' +
			'the rule holds today for a reason (no persisted projections) that a future caching layer would remove.'
	},
	'RPH-PER-010': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'evolution uses upcasters at read time, never event rewriting',
			note: 'JPWB-DOC-003 §9 PER-2. Canon states the upcaster obligation directly and adds the prohibition the ratified rule states as "without rewriting the event".'
		},
		why:
			'THE ANTECEDENT CANNOT ARISE IN THIS ENGINE, which is a stronger statement than "no upcaster exists" and ' +
			'is the reason this is arm 3 rather than a disclosure. `DomainEvent` carries exactly one version field, ' +
			'`eventSchemaVersion`, required; it is WRITTEN at exactly one site (`makeEvent` in kit.ts) as a ' +
			'hard-coded literal `1`, never parameterised and never derived from the event type; and it is READ ' +
			'NOWHERE — no comparison, no branch, no switch, anywhere in packages/ or apps/. So every event this ' +
			'engine can mint is version 1, and "a persisted version-1 event" is the only kind the store can contain. ' +
			'There is no version-2 event to upcast FROM. Recording this as UNENFORCED_DISCLOSED would claim a gap ' +
			'that no arrangement can demonstrate. THE ADJACENCY THAT MUST NOT BE MISTAKEN FOR COVERAGE: ' +
			'`SCHEMA_VERSION` / `PRAGMA user_version` in rph-persistence IS real, fail-closed migration machinery — ' +
			'for the DATABASE SCHEMA, not the event payload; its own comment says "a forward migration is required ' +
			'and none is registered yet". THE RESIDUE: the load path is `JSON.parse` plus an unchecked ' +
			'`as DomainEvent` with no re-validation, and the `StorageAdapter` port declares no hook where an ' +
			'upcaster could ever be injected — so the day a version-2 event is minted, this rule becomes live with ' +
			'nowhere to implement it, and nothing in this register would notice.'
	},
	'RPH-PER-011': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Read projections may be rebuilt, delayed, optimized, and independently versioned',
			note: 'JPWB-DOC-003 §9 PER-7. The canon sentence carries the rule\'s premise (projections lag and are rebuilt) rather than its restart clause; PER-6\'s "Professional correctness never depends on in-memory state" carries the durability half.'
		},
		why:
			'A RECOVERY PROPERTY, not a refusal. IT IS ALSO VACUOUS TODAY, and saying so is the whole value of the ' +
			'row: the rule\'s premise is "the projection update is interrupted", and there is no persisted ' +
			'projection to interrupt — the schema declares five tables and none is a read model, ' +
			'`IncrementalProjection`\'s checkpoint is an in-process integer, and the demo surfaces re-fold the whole ' +
			'event log on every request. WHAT DOES EXIST is the outbox recovery path (`Engine.recoverOutbox`), and ' +
			'its census is recorded because it is not what the rule is about and could be mistaken for it: exactly ' +
			'ONE production caller (`openWorkbench` in apps/rph-demo), invoked once per server process. TWO ' +
			'STRUCTURAL FACTS ABOUT THAT PATH, stated because they bound what "eventually updated" can mean here: ' +
			'nothing in production ever registers an event SUBSCRIBER, and `drainOutbox` marks every pending row ' +
			'PUBLISHED after the subscriber loop whether or not any subscriber exists. There is also no timer, ' +
			'poller or scheduled task anywhere that would drain the outbox after startup. Nothing is lost today ' +
			'because nothing consumes the delivery; that is a property of the current wiring, not a guarantee.'
	},
	// ── THE DS-001 DEFECT, FOUND FOR THE FOURTH TIME BY THE REGISTER'S OWN GATES ─────────────────────────────
	//
	// `conformance-manifest.ts` cites RPH-PER-012's coverage as `packages/rph-domain/src/execution.test.ts` — a
	// PURE_KERNEL unit test that builds `InterruptedAttemptView` object literals BY HAND and asserts the return
	// value of `classifyInterruptedAttempt`. No engine, no store, no restart, no dispatch. That is RPH-PWU-010's
	// sin exactly: a ratified rule, certified COVERED, cited to a pure-predicate test, enforced nowhere. It joins
	// RPH-PWU-010 (which motivated this register), RPH-PWU-007 and RPH-CON-004.
	//
	// AND THE MANIFEST'S PREFIX NOTE SAYS THE QUIET PART: it lists "restart-classification asserted (…012)". The
	// CLASSIFICATION is asserted. Whether anything ever CLASSIFIES is a different question, and the manifest has
	// no axis on which to ask it — which is the sentence this whole module exists to make checkable.
	'RPH-PER-012': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'the attempt enters reconciliation: classify',
			note: 'JPWB-DOC-003 §9 PER-6 (Uncertain external effects are reconciled, never blindly retried), which is STRONGER than the ratified rule: it enumerates the five classifications ("not started / observably running / succeeded-unrecorded / failed / uncertain") and names restarts explicitly. Canon is emphatic about a rule this engine implements only as a dead type alias.'
		},
		why:
			'THE PREDICATES ARE CORRECT, UNIT-TESTED, AND ASKED BY NOTHING — the archetype this register was built ' +
			'for. `classifyInterruptedAttempt` and `mayReexecuteWithoutReconciliation` each have exactly TWO ' +
			'repo-wide references: their own definition and their own test. `ReconciliationClass` has ONE. The ' +
			'single restart-recovery entry point in the engine seam is `recoverOutbox`, whose subject is outbox ' +
			'DELIVERY of already-committed events; it never inspects, classifies or gates an ExecutionAttempt, and ' +
			'the one startup path in the one host is three statements that touch no attempt. WHY WIRING IT IS NOT ' +
			'A SMALL FIX, recorded so this disclosure is not read as scheduling: (1) there is NO ExecutionAttempt ' +
			'state machine among the 27 in the ratified transition data, and neither PWU.executionState nor ' +
			'ExecutionStep.stepState has a RECONCILING/UNCERTAIN/IN_DOUBT member — so there is no state to move the ' +
			'attempt INTO; (2) the Attempt is a PROJECTION rather than a typed object (Fork A withheld the contract ' +
			'object), with an untyped `state: string` closed to RUNNING/WAITING/SUCCEEDED/FAILED/CANCELLED and no ' +
			'field a reconciliation state could be written to; (3) `classifyInterruptedAttempt` requires ' +
			'`externalOperationId` and `externalStatus`, and NEITHER FIELD EXISTS on any event payload, object ' +
			'schema or store column — so even a wired call site would have no persisted source to populate its ' +
			'input. That third fact is the RPH-EXE-005 shape before JAN-CAPBIND: a guard that cannot be non-vacuous ' +
			'while one of its inputs is unrepresentable. FOUR NEAR-MISSES, named so they are not mistaken for ' +
			'wiring: `recoverOutbox`\'s docblock phrase "restart recovery avoids duplicate external side effects" ' +
			'(subject is the outbox); the ratified error code `RPH_EXTERNAL_OPERATION_UNCERTAIN`, which exists for ' +
			'exactly this condition and has two repo-wide references, both its own declaration (REG-F-010\'s ' +
			'census, corroborated independently); the `RETRYING` state and the FAILED->QUEUED retry arrow, whose ' +
			'machine entry carries `guarded: []`; and the authoring turn\'s COMMIT_FAILED state, where the doctrine ' +
			'IS realised — by offering no retry arrow — but for an in-memory surface candidate, not an attempt.',
		guard: {
			kind: 'DEAD_PREDICATE',
			deadPredicate: 'classifyInterruptedAttempt',
			referencedOnlyBy: ['packages/rph-domain/src/execution.ts']
		}
	},
	'RPH-PER-013': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'Professional correctness never depends on in-memory state',
			note: 'JPWB-DOC-003 §9 PER-6. GENERAL rather than CARRIED because canon states the durability principle and never mentions a pending decision, a review request, or a restarting extension: the general rule survives retirement, this specific application does not.'
		},
		why:
			'A SURVIVAL PROPERTY ("the pending decision remains available"), not a refusal — and its second clause ' +
			'quantifies over a SUBJECT THAT DOES NOT EXIST. There is no ReviewRequest, HumanReview, review-task or ' +
			'approval-request entity, field, type or command anywhere in the repository; a pending human decision ' +
			'IS a DECISION aggregate whose `status` is the string PROPOSED, and "no duplicate review request is ' +
			'created" has no object to be about. The rule\'s premise is also weaker than it reads. CORRECTED THE ' +
			'DAY THIS ROW LANDED, by an adversarial pass: this sentence said "no PWU state means waiting for human ' +
			'approval", which is FALSE as written — `PWU.executionState` has a WAITING member (RUNNING->WAITING on ' +
			'ExecutionStepWaiting), and the PWU carries four state axes, not one. The original claim was made from ' +
			'reading `WorkLifecycleStateSchema` alone, which is a claim about a search reported as a claim about ' +
			'the world. WHAT IS ACTUALLY TRUE, and it still empties the rule\'s second clause: no state ' +
			'DISTINGUISHES a human-approval wait from any other, because the wait carries a FREE-TEXT `waitReason` ' +
			'against no ratified vocabulary. And the "extension" the rule names does not exist as a package: this ' +
			'engine ships as a web host. WHAT SURVIVES A RESTART, and it does so by construction ' +
			'rather than by a recovery path: the Decision is a row in the durable store, and the two duplicate ' +
			'defences — `fromStates(\'PROPOSED\')` on the approval commands and the `command_receipts` idempotency ' +
			'lookup — are both store-backed, so neither depends on process memory. That is the rule\'s intent ' +
			'satisfied by a different mechanism than the rule describes, which is precisely why it is recorded as a ' +
			'declared silence rather than certified.'
	},
	'RPH-PER-014': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: "When an external operation's completion is uncertain — including across restarts",
			note: 'JPWB-DOC-003 §9 PER-6. GENERAL because canon\'s subject is an external OPERATION and an Attempt; it nowhere mentions an Assurance Service, a raw validator result, or a disposition boundary. The idempotent-resumption half is carried by PER-5.'
		},
		why:
			'THE PREMISE HAS NO REFERENT IN THIS ENGINE, so there is no interrupted state to resume from. The rule ' +
			'presupposes "a valid raw validator result PERSISTED ... before authoritative disposition", and the RAW ' +
			'RESULT is never written: `validatorResult` exists only as a field of the ' +
			'`CompleteAssuranceAssessment` COMMAND payload, and `parseCompletion` validates it and derives the ' +
			'disposition IN THE SAME DISPATCH that commits the terminal transition. NARROWED THE DAY THIS ROW ' +
			'LANDED, by an adversarial pass, because "no such intermediate is ever written" was too strong: the ' +
			'engine\'s assurance driver dispatches `RecordAssuranceObservation` — a validator-DERIVED aggregate, ' +
			'durably committed — BEFORE `CompleteAssuranceAssessment`. So something validator-derived does survive ' +
			'a restart in that window. What does not is the raw §20 ValidatorResult itself, which is the rule\'s ' +
			'actual subject, and the state that would mark the window: every one of the fifteen ' +
			'`AssuranceAssessmentState` members was enumerated and none means "validator result in hand, ' +
			'disposition not yet authoritative". The assessment is born directly ' +
			'in ASSESSING, and `AssuranceAssessmentState` has no member meaning "validator result in hand, ' +
			'disposition not yet authoritative" — VALIDATOR_FAILED is a terminal disposition, not a pending one. ' +
			'The validator\'s content rides the EVENT, never a pre-disposition object. Nor is there a separately ' +
			'restartable Assurance Service: the path runs in-process. So validation and disposition are ONE atomic ' +
			'act, and the window the rule describes does not exist to be interrupted. WHAT WOULD SERVE IF IT DID: ' +
			'the durable `command_receipts` idempotency check plus `fromStates(\'ASSESSING\')` on the completion. ' +
			'ONE CAVEAT ON THAT, recorded because it bounds the resumption claim: the engine\'s own assurance ' +
			'driver builds its idempotency key from a prefix documented as "unique per recording run", so a ' +
			'restarted run mints FRESH keys and the receipt lookup would not fire — resumption would rest on the ' +
			'state precondition alone.'
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE THREE READ-MODEL FAMILIES — RPH-PRJ, RPH-TRC, RPH-CMP — closed 2026-08-02.
	//
	// ALL FOURTEEN ARE NOT_A_COMMAND_REFUSAL, AND THAT UNIFORMITY IS THE FINDING. Every previous family produced a
	// mix, and a family that comes out entirely arm 3 should be read first as a failure of investigation. It was
	// tested as one: the five load-bearing absences behind these dispositions were sent to adversarial refuters
	// whose instruction was to FIND the thing, with this register and the manifest explicitly excluded from their
	// evidence so my own in-flight edits could not be mistaken for finds. What came back is recorded on the rows.
	//
	// THE REASON THE FAMILY IS UNIFORM IS STRUCTURAL, and it splits in two:
	//
	//   (a) NINE rules have NO DISPATCHABLE SUBJECT. There is no presentation command in this engine (no position,
	//       layout, viewport, or ordering payload anywhere in the 84 commands), no phase/milestone setter and no
	//       persisted phase field, no traceability-validation command, and the ratified `TraceLinkSchema` is minted
	//       by nothing. A rule whose antecedent no dispatch can produce cannot be UNENFORCED_DISCLOSED, because
	//       that arm demands an arrangement the engine ACCEPTS — the RPH-EVD-002 reasoning, applied nine times.
	//
	//   (b) FIVE rules ARE performed, at a layer this instrument cannot observe. RPH-PRJ-002's no-green rule runs
	//       end to end — a PURE_KERNEL predicate, a READ_MODEL flag, a SURFACE that gates the green marker on it —
	//       and RPH-TRC-005's invalidation cascade has a live command-layer caller. Neither is a REFUSAL. This is
	//       the honest boundary of the whole register, and it is worth stating plainly: `LAYER_BY_PACKAGE` can NAME
	//       the surface (it gained `apps/` for SPEC-001), but `classifyRefusal` observes `CommandResult` and a
	//       rendering rule produces none. The register can say WHERE such a rule lives; it cannot certify it. A
	//       fourth arm that let it try would be the vacuous certification this module exists to refuse.
	//
	// CARRIAGE IS EXCELLENT AND ARRIVED FROM TWO ARTIFACTS. DOC-003's LYR/REL/STA blocks carry twelve of the
	// fourteen, several verbatim (REL-3 and REL-4 read almost word-for-word against RPH-TRC-004 and RPH-TRC-003).
	// The RPH-CMP family's carrier is in DOC-002 §8's retired-terminology table instead — one line that carries all
	// four rules at once.
	//
	// REG-F-013 WAS FOUND HERE: `RPH-CMP` was exempt from the conformance gate via `DEFERRABLE_PREFIXES` on a note
	// describing dual-run migration apparatus — a different concern — and stale regardless, since the compatibility
	// projection was built in W2-INC-3. That is the one manifest defect this register's overclaim gate is
	// structurally blind to: a deferred family makes no claim, so there is nothing to catch it over-claiming.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-PRJ-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'never summarized into one status field, one progress bar, or one boolean',
			note: 'JPWB-DOC-003 §5 STA-1 (The four axes never collapse). Canon states the prohibition on collapsing; the ratified rule states the display obligation that follows from it. Same rule, opposite polarity.'
		},
		why:
			'A DISPLAY OBLIGATION — "must display all three states distinctly in Work View". Nothing is refused, and ' +
			'the subject is a view, not a command. THE INDEPENDENCE IT DEPENDS ON IS REAL AND IS ENFORCED ELSEWHERE: ' +
			'the four axes are separate fields on the PWU with separate machines, and the cross-axis guard is ' +
			'RPH-PWU territory, not this rule\'s. What this rule adds is that the SURFACE must not re-collapse what ' +
			'the model keeps apart — an obligation on rendering, which `classifyRefusal` cannot observe because ' +
			'rendering returns no `CommandResult`.'
	},
	'RPH-PRJ-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'all-steps-succeeded leaves assurance unassessed until required policies complete',
			note: 'JPWB-DOC-003 §5 STA-2 (Execution success never confers satisfaction; successor of legacy INV-5). A DIFFERENT span of STA-2 than the RPH-PWU rows cite, deliberately: this rule is about what may be SHOWN, and this clause is the one about the gap between all-steps-succeeded and assurance.'
		},
		why:
			'THE CLEAREST CASE OF A RULE THIS REGISTER CAN LOCATE BUT NOT CERTIFY, and it is recorded at length ' +
			'because the temptation to file it as ENFORCED is real. The rule IS performed, end to end, by a chain ' +
			'this row names so a reader can check it: the decision is `isQualifiedSuccess` in ' +
			'`packages/rph-projections/src/work-projection.ts` (true ONLY when execution SUCCEEDED **and** assurance ' +
			'SATISFIED); it becomes the `qualifiedSuccess` field on the graph node in ' +
			'`packages/rph-projections/src/graph-view.ts`; and `apps/rph-demo/src/lib/toFlow.ts` gates the green ' +
			'marker on that field in three places. One rule, one predicate, three layers, no duplication. BUT NO ' +
			'COMMAND IS REFUSED. The rule\'s subject is what the UI may SHOW, and `classifyRefusal` reads a ' +
			'`CommandResult` — a renderer produces none. Filing it ENFORCED would mean the register certifying a ' +
			'guarantee it never observed, which is DS-001 item 2 committed deliberately rather than by accident. ' +
			'THE STATE-LEVEL SIBLING IS A DIFFERENT RULE, and an adversarial pass on this row forced it to be named ' +
			'precisely rather than gestured at: `WORK_LIFECYCLE_CROSS_AXIS_GUARDS` in ' +
			'`packages/rph-domain/src/pwuGuards.ts` holds `UNDER_ASSURANCE->SATISFIED` conditional on ' +
			'`assuranceState === SATISFIED`, and `rejectIllegalWorkLifecycleMove` in ' +
			'`packages/rph-application/src/handlers/pwu.ts` performs the refusal on `ChangePwuState` with ' +
			'RPH_INVARIANT_VIOLATION. So the STATE combination IS refused, at the command layer, by a named site — ' +
			'and that belongs to the RPH-PWU rows. This rule is about the INDICATOR. Conflating them would let one ' +
			'arrangement green two rules, which is the failure the marker-distinctness gate exists to stop one ' +
			'level down. THE DISPLAY HALF WAS RE-VERIFIED at the same time and holds: `styleFor` in `toFlow.ts` ' +
			'selects the success background only on `qualifiedSuccess`, an AMBER background when execution ' +
			'SUCCEEDED without it — its comment calls that "the visible exec≠assurance gap" — and `labelFor` gates ' +
			'the ✓ on the same flag.'
	},
	'RPH-PRJ-003': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'Identity is opaque and immutable',
			note: 'JPWB-DOC-003 §4 OBJ-3. GENERAL because canon states that an object has one stable identity — which is WHY selection can be consistent across views — but says nothing about views, selection, or a UI at all. The general rule survives retirement; this application does not.'
		},
		why:
			'A CROSS-VIEW UI CONSISTENCY PROPERTY ("selecting a PWU in Work View selects the same underlying object ' +
			'in Execution, Assurance and Traceability Views"). No command exists whose acceptance or refusal could ' +
			'settle it. The manifest routes this to the M14 surface, correctly. Recorded rather than omitted so the ' +
			'silence is declared: the property is UNTESTED at any layer today, and a register that simply left the ' +
			'rule out would read the same as one that had checked.'
	},
	'RPH-PRJ-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'No presentation operation may change semantic state or increment a semantic version',
			note: 'JPWB-DOC-003 §2 LYR-3 (Presentation is meaning-inert), which states the rule more strongly than the ratified statement and adds "Layout has its own revision plane" — the plane this repository does not have.'
		},
		why:
			'THE SUBJECT DOES NOT EXIST, and this row is RPH-CON-008\'s twin: that rule forbids a presentation ' +
			'CONTRACT from referencing a mutating command, this one constrains what a presentation OPERATION may ' +
			'do, and neither has anything to quantify over. Searched as a concept, not a spelling — position, ' +
			'layout, canvas, viewport, collapse, ordering — across the command vocabulary, the generated schemas ' +
			'and the command/event vocab JSON: no presentation command exists among the 84, and no ' +
			'`presentationRevision` field exists anywhere, so canon\'s "Layout has its own revision plane" describes ' +
			'a plane this repository has not built. THE PWA DESIGNER DOES RENDER A NODE GRAPH, which is exactly why ' +
			'this was checked rather than assumed; its layout is computed client-side and never persisted. THE ' +
			'RESIDUE IS THE SAME AS RPH-CON-008\'s: the day layout IS persisted, this rule becomes live with a real ' +
			'subject and nothing here would notice. It is satisfied by absence, which is not the same as enforced.'
	},
	'RPH-PRJ-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'they are never authoritative write targets',
			note: 'JPWB-DOC-003 §9 PER-7 (Projections are derived, disposable, and powerless). GENERAL: canon says a projection must not become an authority, which entails that a displayed count must match the canonical one; it never mentions observations, severities, or counts.'
		},
		why:
			'AN AGREEMENT PROPERTY between a rendered count and canonical state. Nothing is refused. It is also the ' +
			'rule in this family most likely to be quietly violated, and that is worth recording: an agreement ' +
			'property fails SILENTLY — a wrong count renders exactly as convincingly as a right one — whereas every ' +
			'refusal rule in this register fails loudly by definition. The manifest routes it to the M14 surface.'
	},
	'RPH-TRC-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Every authoritative baseline exhibits the unbroken typed chain',
			note: 'JPWB-DOC-003 §4 REL-4 (The traceability spine is continuous), which then lists the chain in the same order as the ratified statement: originating expression → approved Intent → work (PWU) → Artifact → Claim → Evidence → Assurance Assessment → Decision → Baseline.'
		},
		why:
			'AN EXISTENCE PROPERTY over a graph ("a typed path MUST EXIST"), not a refusal. The links it quantifies ' +
			'over are DERIVED: `packages/rph-projections/src/traceability-view.ts` builds them per request from ' +
			'event payloads via `linksFor`, so the spine is a computed view rather than stored edges, and there is ' +
			'no command that could break it directly. WHAT WOULD MAKE THIS A REFUSAL is a promotion gate that ' +
			'checked the chain before making a baseline authoritative; `canPromoteBaseline` carries nine finding ' +
			'codes and none of them is about the trace spine. That is a real gap, but it belongs to whichever rule ' +
			'states the promotion precondition — filing it here would be the subject substitution this register ' +
			'records repeatedly.'
	},
	'RPH-TRC-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'constraint, propagation, and assumption (authority and premises made portable)',
			note: 'JPWB-DOC-003 §4 REL-1, which names constraint propagation as one of the stable relation families. GENERAL because it establishes that the relation TYPE exists, not that a trace must exist for each mandatory constraint — the specific obligation this rule states.'
		},
		why:
			'AN EXISTENCE PROPERTY like RPH-TRC-001, over constraint-propagation paths. Nothing refuses. THE ' +
			'ADJACENT RULE THAT IS ENFORCED, named so this row is not read as a gap in constraint handling: ' +
			'exhaustive constraint disposition at decomposition is DEC-4, and `reviseDecomposition` now applies ' +
			'`constraintPropagations` under a kernel check (REG-F-006). What is unproved is the TRACE — that a ' +
			'path exists from each mandatory constraint to the child PWUs and artifacts it binds — which is a ' +
			'property of the derived link graph, not a command outcome.'
	},
	'RPH-TRC-003': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'An artifact with no producing PWU fails validation',
			note: 'JPWB-DOC-003 §4 REL-4, final sentence — near-verbatim against the ratified statement, and the strongest single carriage in this family.'
		},
		why:
			'CANON STATES A REFUSAL AND THERE IS NO VALIDATOR TO PERFORM IT — but the missing thing is a whole ' +
			'PLANE, not a guard, which is why this is arm 3 rather than a disclosure. "Traceability validation" ' +
			'names a pass that does not exist: no command validates a trace graph, and searched as a concept ' +
			'(validate, orphan, unsupported, dangling, unreachable) nothing performs it. UNENFORCED_DISCLOSED needs ' +
			'an arrangement the engine ACCEPTS, and there is no dispatch whose acceptance would demonstrate this ' +
			'gap — the RPH-CON-008 shape. THE NEAR-MISS, named so it is not mistaken for coverage: baseline ' +
			'promotion IS a gate that could plausibly carry this check, and `canPromoteBaseline`\'s nine finding ' +
			'codes do not include it. Adopting promotion as this rule\'s enforcement site would substitute a ' +
			'governance act for a validation pass. THE CONCRETE FORM OF THE GAP, found by an adversarial pass and ' +
			'kept because a future implementer needs the exact site: `recordArtifact` ' +
			'(packages/rph-application/src/handlers/artifact.ts) is 76 lines containing NO `reject`, NO ' +
			'`precondition` and NO `guard` at all. It builds `producerIds` by filtering out absent/empty values from ' +
			'`producingPwuId` and `producingExecutionAttemptId`, so BOTH may be absent, `producerIds` is `[]`, and ' +
			'that empty array is written straight to `sourceObjectIds`. An unsupported artifact is not merely ' +
			'undetected later — it is minted freely now. WHY THAT STILL IS NOT A DISCLOSURE, and the second reason ' +
			'is a structural limit of the arm worth recording: (1) the rule\'s subject is a validation pass, and ' +
			'filing it against the minting command would assert that `RecordArtifact` should have refused, which is ' +
			'not what the rule says; (2) OBSERVED_ADMISSION requires a CONTROL — a sibling defect at the SAME SITE ' +
			'that IS refused, proving the refusal machinery is alive — and a handler that refuses nothing for any ' +
			'reason cannot host one. A site with no refusals is a site where the disclosure arm has nothing to ' +
			'measure against. THE RESIDUE: canon carries this rule at full strength, so retirement of the pre-canon ' +
			'corpus does NOT retire the obligation — it will still be stated, and still be performed by nothing.'
	},
	'RPH-TRC-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A trace link is never silently rewritten; a correction creates a superseding link and preserves the old one',
			note: 'JPWB-DOC-003 §4 REL-3 (Trace links are immutable; corrections supersede) — verbatim against the ratified statement in both clauses.'
		},
		why:
			'THE OBJECT THIS RULE PROTECTS IS NEVER CREATED. `TraceLinkSchema` is a ratified contract object, and ' +
			'its only production reference in the repository is its own declaration in ' +
			'`packages/rph-contracts/src/objects.ts` — no command mints one, no handler reads one, no table stores ' +
			'one. THE TYPE A READER WILL FIND FIRST IS A DIFFERENT TYPE: `rph-projections`\' `TraceLink` is a ' +
			'separate interface built per request from event payloads, and it is recomputed rather than stored, so ' +
			'"never silently rewritten" is vacuously true of it — there is nothing to rewrite. Immutability holds ' +
			'because nothing is mutable, which is not the same as being enforced. THIS IS AN INSTANCE OF REG-F-001 ' +
			'(the governed-objects layer as a projection of code) rather than a new finding, and it is exactly what ' +
			'DOC-003 OBJ-7 forbids by name: "A governed object that nothing consults is a defect, not ' +
			'documentation." It is also the concrete blocker recorded under REG-F-006 for DEC-2, whose impact ' +
			'analysis needs a TraceLink-minting surface that does not exist.'
	},
	'RPH-TRC-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Invalidated source objects may invalidate downstream trace claims',
			note: 'JPWB-DOC-003 §4 REL-3, final sentence. The mechanism half is carried more strongly still by ASR-8: "every dependent supported claim becomes contested, under review, or invalidated".'
		},
		why:
			'A DOWNSTREAM-INDICATION property ("traceability indicates that the claim support is no longer valid"), ' +
			'not a refusal — nothing is rejected when evidence is invalidated; a cascade is computed. UNLIKE THE ' +
			'REST OF THIS FAMILY IT IS GENUINELY WIRED, and the census is recorded because the same census is what ' +
			'condemns its neighbours: `classifyEvidenceInvalidation` (rph-domain) has a production caller in ' +
			'`packages/rph-application/src/handlers/assurance.ts`, and `impactedObjects` has one in ' +
			'`handlers/decomposition.ts`. Contrast `validateLinkDirectionality` and `TRACE_DIRECTIONALITY` in the ' +
			'same kernel module, whose only reference is their own definition file — correct, unit-tested link ' +
			'machinery that nothing asks. That dead pair is deliberately NOT filed as this row\'s guard: it ' +
			'implements link DIRECTIONALITY, which no ratified RPH-TRC rule states, and attaching a dead predicate ' +
			'to a rule it does not implement is the substitution this register exists to prevent.'
	},
	'RPH-CMP-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Derived compatibility milestone where legacy support requires it; never ontology',
			note: 'JPWB-DOC-002 §8 (Retired and compatibility terminology), the `phase` row. ONE canon line carries all four RPH-CMP rules — derivation, non-authority, and non-storage — which is why every row in this family cites it. Canon\'s carrier for this family is in the VOCABULARY, not the invariant catalog.'
		},
		why:
			'A DERIVATION property ("derives compatibility milestone INTAKE = COMPLETE"). Nothing is refused. THE ' +
			'MECHANISM EXISTS: `packages/rph-projections/src/compatibility-view.ts` (`compatibilityProjector`, ' +
			'`milestoneForKind`) folds the milestone from events, built in W2-INC-3 / WP-2-006. WHAT IS NOT BUILT ' +
			'is the derivation this rule actually states: the current map is PWU KIND -> milestone, a stable ' +
			'lookup, while the rule conditions the milestone on an approved Intent Baseline and COMPLETED PWUs. ' +
			'The projector\'s own header discloses exactly this and names the successor work package (W5 ' +
			'WP-5-003, "Compatibility Milestone Derivation"). So the row records a real, named, honest deferral — ' +
			'which is what made REG-F-013 visible: the manifest had deferred this family for a DIFFERENT and wrong ' +
			'reason while a legitimate one was written in the source file all along.'
	},
	'RPH-CMP-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'A compatibility kind label on an instance is a descriptive discriminator only',
			note: 'JPWB-DOC-002 §3, which continues "it never confers type identity" — the non-authority this rule states. Cited to a DIFFERENT DOC-002 passage than its three siblings so a reader can tell which sentence this row rests on.'
		},
		why:
			'THE SUBJECT DOES NOT EXIST — verified adversarially rather than by one grep, because "no command can ' +
			'set X" is precisely the claim that is easy to make and hard to justify. The complete handler registry ' +
			'was read end to end (73 registered command types); none names a phase, milestone, or compatibility ' +
			'anything. There is no persisted phase column or field in the store schema, the contracts, or the ' +
			'application layer. THE NEAREST THING BY SHAPE IS `ChangePwuState`, which drives the PWU LIFECYCLE ' +
			'axis — a different field, and adopting it would be the axis substitution STA-1 forbids. A SECOND ' +
			'NEAR-MISS worth naming: `ontology.data.ts` holds a `compatibilityPhaseMapping` literal whose entries ' +
			'carry a field spelled `phase`. It is ONTOLOGY DATA — a static kind->label map, not a settable field on ' +
			'any aggregate. The rule is satisfied by construction: the phase is derived, so there is no "changing ' +
			'the field directly" for a command to do.'
	},
	'RPH-CMP-003': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Derived compatibility milestone where legacy support requires it; never ontology',
			note: 'JPWB-DOC-002 §8. "Never ontology" is the load-bearing half for THIS rule: a milestone reading ARCHITECTURE = COMPLETE while the root PWU is incomplete is only coherent if the milestone is a projection and not a lifecycle state.'
		},
		why:
			'A DERIVATION property, and the one that best shows WHY the family must not be authoritative: it ' +
			'requires the compatibility view and the PWU\'s own state to DISAGREE — ARCHITECTURE complete while the ' +
			'root Product Realization PWU is not — without that disagreement being a defect. Nothing is refused; ' +
			'what the rule constrains is what a derived label may say. As with RPH-CMP-001 the current derivation ' +
			'is the W2 baseline kind->milestone map, and the axis-sensitive rules this statement needs are W5 ' +
			'WP-5-003.'
	},
	'RPH-CMP-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'never ontology',
			note: 'JPWB-DOC-002 §8. A SHORT anchor deliberately: this rule\'s whole content is the non-storage clause ("is not stored as the semantic lifecycle state"), and "never ontology" is the exact phrase canon uses for it. Kept distinct from CMP-001/003\'s longer span of the same line so the three rows do not read as one claim made three times.'
		},
		why:
			'A PERMISSION plus a non-storage constraint — "MAY be shown when a replan control action is active", ' +
			'"is not stored as the semantic lifecycle state". A permission cannot be refused, which puts this row ' +
			'in the same class as RPH-EXE-009\'s "retry or an alternate strategy MAY be selected". The non-storage ' +
			'half is satisfied by construction for the same reason as RPH-CMP-002: the whole compatibility view is ' +
			'an in-memory fold with no persisted column, so there is nowhere for a milestone to be stored AS ' +
			'lifecycle state even if something tried. THE REPLAN CONTROL ACTION the rule conditions on is the part ' +
			'with no subject: `REPLAN` exists as a `DecisionType` and in the ontology\'s phase mapping, but nothing ' +
			'derives a milestone FROM an active control action — the projector keys on PWU kind alone.'
	},

	// ── READ THIS BEFORE READING THE DISPOSITION ────────────────────────────────────────────────────────────────
	//
	// ~~RPH-GOV-001 IS RECORDED **ENFORCED**, AND THE REFUSAL IT NAMES CAN BE BYPASSED.~~ THE BYPASS IS CLOSED
	// (2026-08-03). Struck rather than rewritten, because the claim was true for four commits and a reader who
	// finds it should see what was believed and how it was cleared.
	//
	// WHAT WAS OBSERVED, by dispatch, no human actor anywhere in the sequence — and what happens NOW:
	//   ProposeDecision issued by an AGENT, payload `authority` naming a HUMAN  -> ~~ACCEPTED~~ **REFUSED**
	//   ApproveDecision on that decision, issued by the SAME AGENT              -> ~~ACCEPTED~~ (unreachable)
	//   final state: ~~status EFFECTIVE, authority { actorType: 'HUMAN' }~~ (no Decision is created)
	// The governed record asserted a human decided when none had. Filed as REG-F-014; the first of its five
	// instances is fixed, the other four stand — see `RPH-GOV-003`'s integrity caveat for the second.
	//
	// WHY ENFORCED AND NOT UNENFORCED_DISCLOSED. The disclosure arm's contract is "the statement IS a command
	// refusal and NOTHING in production enforces it". Something does: `makeDecisionEffective`'s guard refuses with
	// the rule's OWN ratified error code, at status UNAUTHORIZED, and the refusal is observable end to end. The
	// arrangement the rule most naturally describes — an agent acting on its own declared authority — IS refused.
	// Recording that as "nothing enforces it" would be false in the other direction, and would make the register's
	// disclosure arm mean two different things.
	//
	// WHAT WAS ACTUALLY WRONG WAS THE FIELD'S PROVENANCE, NOT THE CHECK'S ABSENCE. The guard reads
	// `state.authority.actorType`, which `proposeDecision` copied from the CALLER'S PAYLOAD with no reference to
	// `command.issuedBy`. So the check fired exactly when the caller DECLARED an insufficient authority and could
	// not fire when it declared a sufficient one: it stopped the agent that said what it was, not the agent that
	// did not. The sibling handler `requestWaiver` set `authority: command.issuedBy` and was never forgeable this
	// way — two governance handlers, one field, two provenance models, twenty lines apart. `proposeDecision` now
	// REFUSES the disagreement rather than adopting `requestWaiver`'s silent bind, so the ratified `authority`
	// field keeps its meaning: the caller must state it, and what it states must be true.
	//
	// THE HONEST SUMMARY, AND ITS REMAINING LIMIT. The rule is enforced against the arrangement it names, and the
	// enforcement now rests on the ISSUER rather than on a fact the actor supplies about itself — but only up to
	// the boundary this engine has: there is no authentication layer, so `command.issuedBy` is caller-supplied
	// too. Binding the two makes authority CONSISTENT, not VERIFIABLE. It removes the ability to name one actor
	// while acting as another; it cannot establish who is acting. That needs the platform tier the Charter
	// allocates elsewhere — the same boundary RPH-EXE-004's row argues.
	'RPH-GOV-001': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'An agent may recommend a decision but cannot exercise authority unless delegated',
			note: 'JPWB-DOC-003 §8 ASR-15 (Authority is positional, attributable, and version-bound), which also states "Authority is checked *before* effect" — satisfied here, the guard runs ahead of any DecisionEffective — and "an approval whose actor … cannot be identified is not authority", which is the clause REG-F-014 reports unmet.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — authorizeDecisionEffective, whose doc comment names this rule by id. ENFORCEMENT: packages/rph-application/src/handlers/governance.ts — the `guard` inside makeDecisionEffective, shared by ApproveDecision and GrantWaiver, which computes `authorityHeld` from the DECISION\'s recorded `authority.actorType` (HUMAN or SYSTEM) and rejects otherwise. THE SUBJECT IS THE RECORDED AUTHORITY, NOT THE ISSUER of the command — see the comment above. ~~`command.issuedBy` is consulted by NO decision handler.~~ CORRECTED 2026-08-03: that clause was imprecise when written (`requestWaiver`, which creates a DECISION, has always set `authority: command.issuedBy`) and is now false outright — `proposeDecision` refuses when the declared authority is not the issuer (REG-F-014). This guard is still the one that reads the RECORDED authority; what changed is that the recorded authority can no longer name an actor the issuer is not.',
		refusalCode: 'RPH_AUTHORITY_INSUFFICIENT',
		refusalStatus: 'UNAUTHORIZED',
		// THE FIRST ROW IN THE REGISTER AT THIS STATUS. `kit.ts`'s STATUS_FOR_CODE has mapped
		// RPH_AUTHORITY_INSUFFICIENT -> UNAUTHORIZED all along; until this row no registered rule refused with it,
		// which is exactly why the arm was left out of `refusalStatus` when CONFLICT was added — "it goes in when a
		// row needs it, with the probe that proves it". It needed it the same day.
		refusalMarker: 'actor lacks sufficient authority to make this decision effective',
		declaredMutations: [
			'widen `authorityHeld` in makeDecisionEffective to accept any actorType — the probe reports ADMITTED',
			'delete the `if (!check.ok)` arm of the guard — the transition-legality limb of authorizeDecisionEffective still refuses, but with a DIFFERENT reason string, so the probe reports MASKED rather than ADMITTED',
			"drop `RPH_AUTHORITY_INSUFFICIENT` from STATUS_FOR_CODE in kit.ts — the refusal becomes REJECTED and this row's declared UNAUTHORIZED no longer matches, so the probe reports ADMITTED",
			'~~NO MUTATION IS NEEDED TO DEMONSTRATE THE BYPASS — it is live: propose the decision from an AGENT while naming a HUMAN in `authority`, and both commands are ACCEPTED.~~ CLOSED 2026-08-03 (REG-F-014). Struck rather than deleted so a reader sees the claim existed and how it was cleared. `proposeDecision` now REFUSES when the declared `authority` is not the issuing actor, so that sequence stops at the first command. The bypass is therefore a MUTATION again rather than a live fact: neutralise that guard and `decision-authority-provenance.test.ts` reddens on three tests while both its controls stay green. Surveyed before changing behaviour — of 139 ProposeDecision dispatches in the suite, 137 already agreed, and the two that did not were this very scenario written benignly (including THIS row\'s own probe, which now issues as the agent it names).'
		]
	},
	'RPH-GOV-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'no effective governance decision exists until an authorized actor decides',
			note: 'JPWB-DOC-003 §8 ASR-15, whose preceding clause ("An agent may recommend a decision but cannot exercise authority unless delegated") is RPH-GOV-001\'s anchor. The two rules are the two halves of one canon sentence, which is exactly why they must not share an enforcement claim — see the `why`.'
		},
		why:
			'AN OUTCOME ASSERTION — "creates NO effective governance decision until an authorized actor approves it" ' +
			'— and both of its limbs hold, neither by a refusal. Limb 1: `proposeDecision` writes the literal ' +
			'`status: \'PROPOSED\'` into both the state and the emitted event, and applies no authority check at ' +
			'all, so an agent MAY propose — which is what the rule permits, not what it forbids. Limb 2 is guarded ' +
			'by the refusal RPH-GOV-001 already claims. THAT IS THE REASON THIS ROW IS ARM 3 AND NOT A SECOND ' +
			'ENFORCED ROW, and it is the marker-distinctness hazard one level up: filing it ENFORCED would give two ' +
			'rules ONE refusal site, so a single mutant would redden both and the register would report two ' +
			'enforced rules where one arrangement had ever been driven. RPH-PWU-009/010 share a site and are ' +
			'distinguishable only because they carry genuinely different reason strings; here there is one string. ' +
			'ALSO RECORDED: the rule\'s own dedicated kernel predicate `isEffectiveApproval` is DEAD — its only ' +
			'reference outside tests is its own definition. It is not named as this row\'s guard because arm 3 has ' +
			'no guard, but a reader looking for why the rule feels unenforced should find it here rather than ' +
			'conclude the census missed it.'
	},
	'RPH-GOV-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'It does not erase a finding, make invalid evidence valid, declare a rejected claim true',
			note: 'JPWB-DOC-003 §8 ASR-14 (A waiver accepts risk; it never rewrites truth). Canon states the prohibitions; the ratified rule states the positive outcome the same act must produce.'
		},
		why:
			'AN OUTCOME ASSERTION about what granting a waiver PRODUCES — finding still visible, disposition ' +
			'WAIVED, rationale and authority recorded, evidence unchanged. Nothing is refused. AND THE OUTCOME IS ' +
			'NOT PRODUCED EITHER, which is the part worth recording rather than leaving as a silence: `GrantWaiver` ' +
			'advances the DECISION aggregate to EFFECTIVE and emits `WaiverGranted`, and NO command anywhere sets ' +
			'an `AssuranceObservation.disposition` to WAIVED — so the rule\'s second limb names a state transition ' +
			'no dispatch performs. Of the other three limbs: "finding stays visible" is satisfied VACUOUSLY ' +
			'(nothing deletes observations, so nothing can fail it); "records rationale and authority" is met at ' +
			'the SCHEMA layer, since `RequestWaiverPayloadSchema` requires `rationale`, so its violation surfaces ' +
			'as VALIDATION_FAILED rather than as this rule; and "leaves evidence unchanged" has no guard at all. ' +
			'The dedicated kernel predicate `waiverPreservesFindings` is DEAD — definition only, no non-test ' +
			'reference — which is the same shape as RPH-GOV-002\'s and RPH-GOV-007\'s and is why this family needed ' +
			'a census rather than a reading.'
	},
	// ENFORCED INVERSELY, and the shape is worth naming because it is the first of its kind in this register. Every
	// other ENFORCED row points at a guard that refuses when the rule is VIOLATED. Nothing refuses "this waiver is
	// out of scope". The floor gate refuses the PUBLISH, and the waiver's scope decides whether that refusal happens
	// at all — so the rule is enforced by a check that PERMITS narrowly rather than one that refuses. The probe is
	// built accordingly: both runs grant the SAME waiver and differ only in WHEN, so the version it pins is the only
	// variable and the refusal is attributable to scope rather than to the floor being unsatisfied.
	//
	// THREE LIMBS, THREE DIFFERENT MECHANISMS, and the census matters more here than usual because the predicate
	// that LOOKS like it enforces all three does not.
	//
	//   CRITERION — `waiverCovers`' waivedCriterionId conjunct. Genuinely decides, genuinely observed:
	//               pwa-authoring.test.ts has a control that publishes and a discriminator that does not.
	//   VERSION   — `waiverCovers`' subjectSemanticVersion conjunct. Genuinely decides. Had NO command-layer reader
	//               until this row's probe; neutralising it reddened only the rph-domain kernel unit test.
	//   OBJECT    — NOT `waiverCovers`. Its subjectObjectId conjunct is a TAUTOLOGY at the only production call
	//               site: `effectiveFloorWaivers` builds the view with `subjectObjectId: subjectId`, the very value
	//               it is compared against, so the conjunct compares a thing with itself. The limb is enforced
	//               instead by that function's `subjectObjectIds.includes(subjectId)` filter and, REDUNDANTLY, by
	//               the `?? -1` version fallback beside it — a waiver that does not name this subject carries no
	//               version entry for it. Either alone suffices, which is why NEITHER is independently killable.
	//
	// THE FIRST READING OF THAT LAST POINT WAS WRONG AND IS RECORDED AS WRONG. Deleting the subject filter leaves
	// the entire suite green, which reads as an unguarded bypass — a waiver over another PWA discharging this one's
	// floor. It is not: the version fallback fail-closes first. The correction was proved by a COMBINED mutant
	// (filter -> false AND `?? -1` -> `?? 2`), which does redden the object test. A finding that dissolves needs
	// more evidence than the finding did, and single-line green was not evidence of a hole — only of redundancy.
	'RPH-GOV-005': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'apply to another criterion, another object, or a future semantic version unless explicitly renewed',
			note: 'JPWB-DOC-003 §8 ASR-14 (A waiver accepts risk; it never rewrites truth) — the same sentence RPH-GOV-004 anchors on, at a different clause. Canon forbids bleeding to "a FUTURE semantic version"; production compares versions with strict equality, so it also refuses a waiver pinned to a LATER version than the floor. Stronger than the anchor, and recorded as such rather than read back as agreement.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — waiverCovers (criterion + version; its object conjunct is a tautology at the call site, see above). ENFORCEMENT: packages/rph-application/src/handlers/floor-gate.ts — waiverDischargesFloorPolicy, which filters by waivedPolicyId, requires an OPEN finding to exist, and demands EVERY open finding be individually covered; and effectiveFloorWaivers, which scopes by subject. THE REFUSAL ITSELF is pwaFloorGate in packages/rph-application/src/handlers/pwa-authoring.ts, reached because the waiver did NOT discharge.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the de minimis assurance floor is not SATISFIED for PWA',
		declaredMutations: [
			"neutralise `waiverCovers`' subjectSemanticVersion conjunct (`=== ` -> `true`) — this probe reports ADMITTED, because the v1 waiver then discharges the v2 floor and the publish is accepted",
			"neutralise `waiverCovers`' waivedCriterionId conjunct — this probe still refuses (its criterion matches), but pwa-authoring.test.ts's no-bleeding test reddens; the two limbs are independently killable, which is what makes the criterion cite and this row distinct claims",
			'drop `w.waivedPolicyId === policyId` from waiverDischargesFloorPolicy\'s filter — floor-waiver-scope.test.ts\'s cross-policy test reddens; this probe does not, since it never crosses policies',
			"NEITHER OBJECT-LIMB LINE IS INDEPENDENTLY KILLABLE, recorded so a reader re-running these does not read green as absence of enforcement: `subjectObjectIds.includes(subjectId)` -> `false` alone, and `?? -1` -> a matching version alone, each leave the whole suite green. TOGETHER they redden floor-waiver-scope.test.ts's object test. Redundant enforcement, not a hole.",
			"NO MUTATION IS NEEDED TO SHOW WHAT THIS ROW'S CITE USED TO REST ON — floor-waiver-scope.test.ts, the file named for this rule, passed for months while seeding no floor policies, arranging no assessments, and never once reaching waiverCovers. See REG-F-015."
		]
	},
	'RPH-GOV-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'revoking a decision triggers impact analysis — dependent baselines and planning cannot keep standing on it silently',
			note: 'JPWB-DOC-003 §8 ASR-15. Canon carries the rule at full strength, including the "silently" that is the whole point, so retirement of the pre-canon corpus does not retire the obligation.'
		},
		why:
			'A CASCADE OUTCOME ON A PLANE THAT DOES NOT EXIST. All three limbs — the Baseline becoming ' +
			'review-required or revoked, downstream planning being impacted, impact analysis being initiated — ' +
			'assert consequences of a SUCCESSFUL `RevokeDecision`, so no dispatch could be rejected for violating ' +
			'them, and the impact-analysis plane they need is the same one REG-F-006 records as blocking DEC-2. ' +
			'`revokeDecision` advances the Decision to REVOKED and does nothing else; nothing cascades. THE PART ' +
			'THAT IS WORSE THAN DEAD, and the reason this row is longer than its disposition warrants: the rule\'s ' +
			'dedicated kernel predicate `assessDecisionRevocation` is not merely uncalled outside its own test — it ' +
			'is a CONSTANT FUNCTION. It ignores its `DecisionView` argument entirely and can never return the ' +
			'`REVOKED` half of its own declared `RevocationOutcome` union. Its unit test therefore cannot ' +
			'discriminate: no input distinguishes a pass from a failure, so the test proves the function returns ' +
			'what it always returns. That is a control that cannot fail, in the kernel, under a rule id — the ' +
			'defect this repository has shipped three times and the reason every gate in this register carries a ' +
			'named predicted red.'
	},
	'RPH-BAS-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'exact item identities, semantic versions, and content hashes where applicable',
			note: 'JPWB-DOC-003 §8 ASR-16 (Baseline promotion is a governance event with exact identity), verbatim against the ratified statement including its "where applicable" hedge on hashes.'
		},
		why:
			'A SHAPE ASSERTION about what a candidate baseline CONTAINS, not a refusal — and each of its three ' +
			'limbs fails differently, which is why the census returned UNCLEAR and why the row spells them out. ' +
			'(1) OBJECT ID and (2) SEMANTIC VERSION are guaranteed at the SCHEMA layer, not by any domain check: ' +
			'`PromoteBaselinePayloadSchema` types `semanticVersion: z.number()` as required and the bus validates ' +
			'the payload before the handler runs. The consequence is that the kernel arm written FOR this rule — ' +
			'`findMissingItemVersions`, which fires only when a version is `undefined` or `null` — is fed data the ' +
			'schema has already forced to be a number. MISSING_ITEM_VERSION cannot appear in any dispatch result. ' +
			'It is not a dead predicate (it is called) but a SCHEMA-FORECLOSED one, the RPH-EVD-003 shape: a guard ' +
			'whose antecedent a stricter layer has already made unreachable. (3) CONTENT HASH is checked nowhere ' +
			'on the candidate side at all. THE SHARP FACT, and it is the opposite of what the rule asks for: ' +
			'`createBaseline` builds each item as `{ objectId, semanticVersion: obj?.semanticVersion ?? 1 }`, so ' +
			'when the store cannot load the item object the baseline records VERSION 1 — INVENTED, not identified. ' +
			'A rule whose entire subject is "identifies exact versions" is implemented by a default. That is ' +
			'canon OBJ-1 ("No semantic state may be inferred from null values, empty arrays, missing rows") ' +
			'inverted, and it is recorded here rather than filed because no command is refused by it: the invented ' +
			'version is written on the ACCEPT path.'
	},
	// ── RPH-BAS-002 — THE CHECK COMPARES A THING WITH ITSELF ────────────────────────────────────────────────
	//
	// `findVersionMismatches` is correct: it maps the reviewed items by id and, for each candidate, refuses when
	// the version or hash differs. The production call site is:
	//
	//     canPromoteBaseline({ …, candidateItems, reviewedItems: candidateItems, … })
	//
	// The SAME array, passed as both arguments. So `r` IS `item` for every element and all three disjuncts are
	// false by identity. The only payload that could produce a finding is one carrying two entries with the same
	// `objectId` and different versions — i.e. a self-inconsistent payload, never a promoted-vs-reviewed drift.
	//
	// THIS IS THE SHAPE THE RPH-PER-007 TEST WAS RETITLED FOR — "asserted the fold equals ITSELF … true of any
	// pure function and of any broken one". There it was a test. Here it is production.
	'RPH-BAS-002': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'the promoted version exactly matching the reviewed version',
			note: 'JPWB-DOC-003 §8 ASR-16. Canon states the requirement as one of promotion\'s preconditions; the ratified rule names the error code that must carry its refusal.'
		},
		why:
			'THE STATEMENT IS A COMMAND REFUSAL NAMING ITS OWN ERROR CODE ("fails with ' +
			'RPH_BASELINE_VERSION_MISMATCH"), and nothing performs it, on two independent grounds. FIRST, THE ARM ' +
			'CANNOT FIRE: `promoteBaseline` passes one array as BOTH `candidateItems` and `reviewedItems`, so ' +
			'`findVersionMismatches` compares each item to itself. SECOND, THE CODE IS CARRIED NOWHERE: ' +
			'`RPH_BASELINE_VERSION_MISMATCH` is one of the fifteen ratified error codes and its only non-test ' +
			'occurrences are its own declaration in `errors.ts` and a kernel finding-code string — it is never an ' +
			'`error.code` on any CommandResult. That is REG-F-010\'s census, hitting a rule that names the code in ' +
			'its own ratified text. OBSERVED, not argued: a baseline froze `semanticVersion: 1`, and a promotion ' +
			'naming `semanticVersion: 999` for the same object was ACCEPTED and the baseline became AUTHORITATIVE.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'PromoteBaseline whose expectedItemObjectVersions names semanticVersion 999 for an item the baseline froze at 1 — ACCEPTED, and the baseline really becomes AUTHORITATIVE',
			control:
				'the same PromoteBaseline against a baseline still in CANDIDATE (never submitted or approved), refused at the same site with RPH_ILLEGAL_STATE_TRANSITION — so the acceptance is a missing comparison, not a command that is never refused',
			whyNoPredicate:
				'`findVersionMismatches` is NOT dead — it is called on this very dispatch, so naming it would fail ' +
				'`deadPredicate`\'s first clause. What is defective is the ARGUMENT it is given. A census over the ' +
				'symbol would stay green forever while the rule went unenforced, which is precisely the case the ' +
				'OBSERVED_ADMISSION arm was added for.'
		}
	},
	'RPH-BAS-005': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'An authoritative baseline is immutable — change creates a successor with a supersession trace',
			note: 'JPWB-DOC-003 §8 ASR-16, near-verbatim against the ratified statement.'
		},
		why:
			'NO DISPATCHABLE COMMAND CAN CHANGE A BASELINE\'S ITEM SET. The command vocabulary holds exactly five ' +
			'baseline commands (Create, SubmitForReview, Approve, Promote, Supersede) and `itemObjectVersions` is ' +
			'written at exactly one site, inside `createBaseline`, on the create path. There is no Edit, Revise, ' +
			'Amend or AddItem command of any spelling. So immutability holds by the ABSENCE OF A MUTATOR, not by a ' +
			'guard, and there is nothing for a refusal to refuse. THE PREDICATE WRITTEN FOR THE RULE IS DEAD — ' +
			'`assertBaselineItemSetImmutable` and its sibling `canSupersedeBaseline` have no non-test reference — ' +
			'AND THE TEST FILE ALREADY SAID SO: `properties.test.ts` carries the comment "(Item-set byte-stability ' +
			'under a mutating command is an M13 integration property once the baseline command handlers exist — ' +
			'see OPEN-QUESTIONS.)", written BEFORE those handlers landed and never revisited. The handlers landed; ' +
			'the note did not move. That is the drift this register exists to make visible, sitting inside the ' +
			'evidence for the rule.'
	},
	'RPH-BAS-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'change creates a successor with a supersession trace',
			note: 'JPWB-DOC-003 §8 ASR-16. A SHORTER span than RPH-BAS-005 cites of the same sentence, deliberately: BAS-005 rests on the immutability clause and this rule on the trace clause, and identical anchors would leave a reader unable to tell which half each row is about.'
		},
		why:
			'THREE POST-CONDITIONS of a SUCCESSFUL supersession — Baseline 1 stays queryable, a supersession trace ' +
			'exists, prior evidence and decision stay intact — so no dispatch can be refused for violating them. ' +
			'(a) QUERYABLE HOLDS, as a read-model property: `listBaselines` applies no status filter, so SUPERSEDED ' +
			'rows are returned — deliberately unlike `listPwas`/`listPwuTypes`, which do filter tombstoned rows. ' +
			'(b) THE TRACE IS THE FINDING, and it was OBSERVED. `supersedeBaseline` supplies neither `mutate` nor ' +
			'`eventPayload`, so `supersedingBaselineId` is written to NO object field — `BaselineObjectSchema` has ' +
			'none to hold it — and the emitted event carries the RAW COMMAND PAYLOAD. Dispatched, the persisted ' +
			'`BaselineSuperseded` payload is `{ supersedingBaselineId }` and OMITS `status`, which its own ' +
			'`BaselineSupersededPayloadSchema` — a `z.strictObject` — declares REQUIRED, as does the vocabulary ' +
			'entry the schema is generated from. The trace exists only as an event field that violates the shape ' +
			'this repository authored for it. WHY NOTHING CATCHES THAT, stated fairly because the gate is not at ' +
			'fault: the event gate (`kit.ts` step d2) checks payloads against `RATIFIED_EVENT_PAYLOADS`, which ' +
			'holds 16 of the 132 registered events, and `BaselineSuperseded` is not among them BY DESIGN — its ' +
			'vocabulary entry reads "UNRATIFIED-AUTHORED … Do NOT treat this sourceSection as proof the shape is ' +
			'ratified", and the gate\'s own test asserts that authored shapes are deliberately NOT enforced. So ' +
			'116 authored strict schemas go unchecked, which is the DISCLOSED COST of that scope rather than a ' +
			'defect in it — and this row is one place where the cost is now known to have been paid.'
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// THE RPH-ASM FAMILY — FIVE DEAD PREDICATES OUT OF SIX RULES.
	//
	// Measured, not asserted: `requiresReification`, `validateAssumptionReification`, `assessAcceptance`,
	// `assessFalsification` and `blocksIrreversibleWork` are ALL referenced by exactly one non-test file — their
	// own definition module, `rph-domain/src/decomposition.ts`. Only `canAuthorizeNewWork` (RPH-ASM-006) has live
	// callers. A whole family of correct, unit-tested kernel predicates, each written FOR the rule it does not
	// enforce, is the archetype this register was built around, and it has never appeared this densely.
	//
	// AND THE VOCABULARY IS HALF-BUILT IN A PARTICULAR WAY. `Assumption.status` declares eight states with
	// transitions and guard prose, but only TWO commands exist — `DetectAssumption` and `ExpireAssumption`. The
	// arrows into ACCEPTED, VERIFIED, UNDER_VERIFICATION and FALSIFIED are authored and command-unreachable, which
	// is the RPH-EVD-002 shape (the `Claim.status` machine nothing dispatches into) repeated on a second aggregate.
	// That is why three of these rows are arm 3 rather than disclosures: their triggering ACT cannot be dispatched,
	// so no arrangement can demonstrate a gap.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-ASM-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'must become a first-class Assumption Object before dependent work reaches readiness',
			note: 'JPWB-DOC-003 §4 OBJ-4 (Material assumptions are reified). Canon adds the readiness deadline the ratified rule leaves implicit.'
		},
		why:
			'AN OUTCOME ASSERTION — a material premise "causes Assumption Disclosure to CREATE an Assumption ' +
			'Object". A creating command exists (`DetectAssumption`), and it contains no reject, no precondition ' +
			'and no guard, so nothing about it can be refused. WHAT IS ABSENT IS THE CAUSAL LINK THE RULE NAMES: ' +
			'no production site derives an Assumption from model or validator output. The rule\'s subject is a ' +
			'DETECTION that happens upstream of any command, and this engine has no detector — an Assumption exists ' +
			'exactly when a caller dispatches `DetectAssumption` about one. TWO FACTS THAT BOUND THE OUTCOME, ' +
			'recorded because they make the reification thinner than it reads: the `affectedObjectIds` link is ' +
			'taken verbatim from the payload and never checked for resolvability, and nothing validates that ' +
			'`CompleteExecutionStep`\'s `detectedAssumptionIds` resolve to existing ASSUMPTION aggregates. The ' +
			'kernel predicate written for the rule, `requiresReification`, has no caller outside its own module.'
	},
	// ── RPH-ASM-002 — the one ASM disclosure whose predicate is BOTH correct and completely unasked ──────────
	//
	// `validateAssumptionReification` declares `readonly ok: boolean` with the comment
	// "false => the assessment must be REJECTED or remain INCOMPLETE (RPH-ASM-002)". It is implemented, it is
	// unit-tested, and `completeAssuranceAssessment` never calls it — a whole-file grep of `assurance.ts` for
	// "assumption" returns hits only in the header comment and in the `// ---- Assumption ----` section holding
	// detectAssumption/expireAssumption. Zero hits inside the assessment handlers, across four gates (permitted
	// control actions, INV-8 independence, escalation, foreclosure).
	'RPH-ASM-002': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'A material assumption detected anywhere — including inside model prose',
			note: 'JPWB-DOC-003 §4 OBJ-4. "Including inside model prose" is the clause this rule turns on — the assumption may not REMAIN in prose, which is exactly what the ratified statement forbids. A different span of OBJ-4 than RPH-ASM-001 cites, so a reader can tell which clause each row rests on.'
		},
		why:
			'THE STATEMENT IS A COMMAND REFUSAL ("causes the assessment result to be REJECTED or left INCOMPLETE"), ' +
			'the command exists (`CompleteAssuranceAssessment`), the kernel predicate that decides it exists and is ' +
			'correct, and NOTHING CALLS IT. `validateAssumptionReification` has exactly one non-test reference: its ' +
			'own definition. THE ARRANGEMENT IS REACHABLE, which is what makes this a disclosure rather than an ' +
			'unreachable-antecedent arm-3 row: an adversarial pass established that a validator CAN carry a ' +
			'material assumption to the handler, because four of `ValidatorResultSchema`\'s sixteen fields — ' +
			'`claimResults`, `evidenceRejected`, `observations`, and the control-action recommendations — are ' +
			'`z.record(z.string(), z.unknown())` rather than strict objects. The top-level schema is strict; those ' +
			'nested arrays are not. So the "assessment completes with a material assumption only in prose" ' +
			'antecedent is dispatchable, and the assessment completes.',
		guard: {
			kind: 'DEAD_PREDICATE',
			deadPredicate: 'validateAssumptionReification',
			referencedOnlyBy: ['packages/rph-domain/src/decomposition.ts']
		}
	},
	'RPH-ASM-003': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Human acceptance yields ACCEPTED status, never VERIFIED',
			note: 'JPWB-DOC-003 §4 OBJ-4, verbatim against the ratified statement — the strongest single carriage in this family, for the rule with the least to enforce it.'
		},
		why:
			'THE ACT IS NOT DISPATCHABLE. There is no `AcceptAssumption` command in the registry, so no ' +
			'CommandResult can carry or violate this rule. Dispatching the name would be refused by the bus with ' +
			'"No handler registered for command type" — a ROUTING refusal identical for every unknown string, ' +
			'naming no rule, and adopting it as this rule\'s enforcement would be the vacuous negative DS-001 §4 ' +
			'describes. THE MACHINE IS AUTHORED AND WOULD BE READY: `Assumption.status` declares BOTH in-arrows to ' +
			'ACCEPTED (from DISCLOSED and from UNDER_VERIFICATION), each carrying the guard prose "ACCEPTED is NOT ' +
			'equivalent to VERIFIED (§12.2)", and a separate arrow to VERIFIED. The distinction the rule protects ' +
			'is written into the ratified transition data and nothing can reach it. `assessAcceptance`, the ' +
			'predicate written for this rule, has no caller outside its own module.'
	},
	'RPH-ASM-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'falsification triggers impact analysis',
			note: 'JPWB-DOC-003 §4 OBJ-4; the downstream half is carried by STA-7 (Invalidation is first-class and satisfaction is revocable), which names reshaping and invalidation as the routes falsified assumptions take.'
		},
		why:
			'A FIVE-LIMB OUTCOME CASCADE whose TRIGGERING ACT is not dispatchable: no `FalsifyAssumption` command ' +
			'exists, and no handler emits `AssumptionFalsified`. Nothing can be refused. THE PART WORTH RECORDING ' +
			'IS THAT THE CONSEQUENT IS REACHABLE BY ASSERTION, WITHOUT THE ANTECEDENT. `ReshapePwu` — whose own doc ' +
			'comment reads "EXECUTING|UNDER_ASSURANCE -> RESHAPING (material assumption falsified / blocking ' +
			'finding)" — takes a free-text `reason` and an OPTIONAL `triggeringObjectId`, and never loads, ' +
			'resolves, or status-checks the object that id names. So the exact transition this rule names as the ' +
			'consequence of falsification can be driven by a caller asserting it, while the assumption itself ' +
			'cannot be falsified at all. That is the REG-F-014 shape a third time — a caller-supplied fact taken ' +
			'as true where the engine could have resolved it — and it is why that finding\'s remediation is a ' +
			'survey rather than a patch. `assessFalsification` has no caller outside its own module.'
	},
	// ── RPH-ASM-005 — THE PREDICATE WITH ZERO CALLERS ANYWHERE, INCLUDING ITS OWN MODULE ─────────────────────
	//
	// `blocksIrreversibleWork` is three lines and correct:
	//     if (a.materiality !== 'CRITICAL') return false;
	//     return a.status !== 'VERIFIED' && a.status !== 'ACCEPTED';
	// Its doc comment names RPH-ASM-005. Nothing in the repository calls it — not even its own module, which is
	// stricter than the census the DEAD_PREDICATE arm requires.
	//
	// THE ONE ASSUMPTION CONSULTATION IN THE ENTIRE EXECUTION PLANE is `assumptionsAuthorizeNewWork`, and it asks
	// `canAuthorizeNewWork` (RPH-ASM-006) instead — a STATUS-ONLY test that is MATERIALITY-BLIND. So the engine
	// looks at assumptions exactly once, on the plan-approval arrow, and asks the other rule's question.
	'RPH-ASM-005': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A critical assumption must be verified or explicitly accepted by authority before dependent irreversible work proceeds',
			note: 'JPWB-DOC-003 §4 OBJ-4, verbatim against the ratified statement including the authorized-acceptance escape.'
		},
		why:
			'THE STATEMENT IS A REFUSAL ("BLOCKS an irreversible execution step"), its predicate is written ' +
			'correctly and named for the rule, and NOTHING references it. Two facts the rule needs are both ' +
			'unread at the step level: `materiality === CRITICAL` on the assumption, and irreversibility on the ' +
			'step — no execution-step command reads assumptions at all, nor reads `WorkRiskProfile.irreversibility` ' +
			'as a gate, and no site emits the seeded finding code UNASSESSED_CRITICAL_ASSUMPTION. THE ADJACENT ' +
			'WIRING THAT IS NOT THIS RULE, named so it is not mistaken for it: `assumptionsAuthorizeNewWork` fires ' +
			'on PLAN APPROVAL, not on a step, and asks a materiality-blind status question — that is RPH-ASM-006, ' +
			'and adopting it here would be the subject substitution this register records repeatedly. The ' +
			'handler\'s own comment concedes the scope: "the first live wiring of the assumption-impact half of ' +
			'WP-3-008 (the falsification transition + reshape/reassessment loop remain)".',
		guard: {
			kind: 'DEAD_PREDICATE',
			deadPredicate: 'blocksIrreversibleWork',
			referencedOnlyBy: ['packages/rph-domain/src/decomposition.ts']
		}
	},

	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	// RPH-DEC AND RPH-CNS — ONE REFUSAL SITE, FOUR RULES, AND THE MARKER IS THE FINDING CODE.
	//
	// `checkDecompositionConservation` produces ONE message for every conservation failure:
	//   "<act>: the decomposition does not conserve its parent's obligations/constraints
	//    (§35.1 / RPH-DEC-002/007 / RPH-CNS-001..004): <parts>"
	// — and `<parts>` interpolates each finding as `CODE(id)`. So four rules share a site, and the only thing that
	// distinguishes them at the observation point is which finding code lands in the message. That is exactly what
	// `refusalMarker` is for, and it is why DEC-002, DEC-003 and CNS-003 can each be ENFORCED here while DEC-007
	// cannot: DEC-007 restates DEC-002's equation and the obligation findings have exactly ONE code
	// (`MISSING_OBLIGATION_ALLOCATION`, declared as a single string literal on the finding type). Two ENFORCED rows
	// would share one marker, which the distinctness gate forbids and which is precisely the failure it exists to
	// prevent — the same reasoning that put RPH-GOV-002 in arm 3.
	//
	// AND THE CNS PAIR FAILED FOR A REASON THE CENSUS DID NOT REACH. The suggested disposition for RPH-CNS-001/002
	// was UNENFORCED_DISCLOSED on the grounds that `propagatedStrength` is never populated. Checked one layer
	// further: `ConstraintPropagationSchema` is a `z.strictObject` with SEVEN fields and NO `propagatedStrength`
	// among them. The field exists only on the KERNEL's own record type. So the arm does not read an unpopulated
	// field — it reads a field THE WIRE CANNOT CARRY, and no dispatch can express the arrangement. That makes them
	// arm 3 (the RPH-EVD-002 shape), not disclosures: an OBSERVED_ADMISSION needs an arrangement the engine
	// accepts, and there is none to send.
	// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
	'RPH-DEC-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A decomposition is incomplete until it explains how child results will establish the parent claim',
			note: 'JPWB-DOC-003 §6 DEC-2 (Decomposition is a Claim with a mandatory contract), whose enumeration covers all three of this rule\'s limbs — obligation allocation, constraint disposition, and a recomposition strategy.'
		},
		why:
			'GRAMMATICALLY A PERMISSION — a decomposition meeting three conditions "MAY become VALID" — which no ' +
			'refusal probe can hold, the same class as RPH-EXE-009\'s "retry or an alternate strategy MAY be ' +
			'selected". ITS THREE LIMBS ARE NOT EQUALLY REAL, and that is the content of this row. Limbs 1 and 2 ' +
			'(obligation allocation, constraint propagation/retention) ARE gated before the VALID advance, and are ' +
			'recorded as RPH-DEC-002 and RPH-DEC-003. Limb 3 — "and has a recomposition contract" — is read ' +
			'NOWHERE: `recompositionContractId` is written onto the contract, echoed into the event, and never ' +
			'loaded, compared or required. That gap is RPH-DEC-005\'s. THE COMPOSITION THAT WOULD HAVE JOINED ALL ' +
			'THREE IS DEAD: `rph-domain`\'s own decomposition validator is called by no non-test file — the handler ' +
			'calls the two leaf predicates directly and skips it — so its three exclusive finding codes ' +
			'(MISSING_RECOMPOSITION_CONTRACT, CHILD_DOES_NOT_TRACE_TO_PARENT, CHILD_INTENT_DIVERGENCE) can never ' +
			'appear in any CommandResult. A NAME COLLISION MAKES THIS EASY TO GET WRONG, recorded so the next ' +
			'reader does not: the APPLICATION handler exports a symbol of the same name, so a census over the ' +
			'identifier returns four files and looks wired. The two functions are different, and only the dead one ' +
			'implements this rule.'
	},
	'RPH-DEC-004': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A child PWU introducing work beyond parent intent without authorization is a divergence',
			note: 'JPWB-DOC-003 §6 DEC-5 (Children cannot enlarge scope), which continues "the decomposition is rejected or routed to human decision" — the ratified rule\'s disjunction, verbatim.'
		},
		why:
			'THE STATEMENT IS A COMMAND REFUSAL ("emits CHILD_INTENT_DIVERGENCE and is rejected or requires a human ' +
			'decision") and NO production site computes, receives or refuses child intent divergence. The only ' +
			'implementation is the dead domain composition; the live handler never calls it, so the finding code ' +
			'cannot reach a CommandResult. THREE SUPPORTING ABSENCES, each checked: `intentMappings` — the ' +
			'ProposeDecomposition field that would carry the parent-to-child intent mapping the rule needs — is ' +
			'stored and echoed but never read; the seeded POL-DECOMPOSITION-COVERAGE policy lists ' +
			'CHILD_INTENT_DIVERGENCE among its finding types and nothing consumes those types except a seeder; and ' +
			'ProposeDecomposition stores `childWorkUnitIds` without checking that any child exists or names the ' +
			'parent. THE GUARD NAMES THE INPUT, NOT THE COMPOSITION, deliberately: a census over the composition ' +
			'would return four files because the application handler shares its name, and would look wired while ' +
			'the rule went unenforced.',
		// RE-GUARDED 2026-08-03, from DEAD_PREDICATE to OBSERVED_ADMISSION, because THE CENSUS COULD NOT SEE THE
		// EVENT IT EXISTED TO DETECT (REG-F-016). It censused `intentDivergentChildIds` — an INPUT FIELD of the
		// dead composition, named instead of the composition to dodge the collision the `why` above describes. The
		// dodge worked and cost the guard its sensitivity: WIRING THE COMPOSITION DOES NOT MAKE THE FIELD APPEAR
		// ANYWHERE NEW, so the census still returns one file and this row would stay green through the exact
		// change that closes the rule. Demonstrated rather than reasoned: `validateDecomposition` was wired into
		// `handlers/decomposition.ts`, compiling and running, and all 2078 tests stayed green.
		//
		// THE REGISTER'S OWN "GUARD THAT CANNOT FAIL" GATE DID NOT CATCH IT, which is the part worth keeping. That
		// gate checks the baseline set excludes the file the wiring would land in — and it passed here, correctly,
		// because the baseline is a kernel file and no handler was in it. The wiring event this row faces is not
		// "a handler mentions the symbol" but "a handler calls the FUNCTION THAT READS it", and a census over a
		// symbol cannot see one symbol away. RPH-DEC-005 hit the same collision one row down and answered it
		// correctly by guarding with behaviour; this row now does the same.
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'a decomposition whose child is proposed under a DIFFERENT intent and whose intentMappings declares it serves that foreign intent, marked VALID — accepted with no divergence finding of any kind',
			control:
				'the identical decomposition, declaring the same divergence, but leaving a mandatory parent obligation unallocated — REFUSED at the same site by the conservation arm, which proves the validate path is live and simply has no limb for intent divergence',
			whyNoPredicate:
				'A census is the wrong instrument for this rule, and the reason generalises. The only implementation ' +
				'is `rph-domain`\'s `validateDecomposition`, whose bare identifier is shared by an application ' +
				'handler — so a census over IT returns four files and looks wired. Censusing the input field it ' +
				'reads instead dodges the collision but is BLIND TO THE WIRING, because the field does not move ' +
				'when the composition gains a caller. Behaviour is sensitive to both: this row now reddens when the ' +
				'rule starts being enforced, whatever symbol carries it.'
		}
	},
	'RPH-DEC-006': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: '"All children completed, therefore parent satisfied" is always invalid',
			note: 'JPWB-DOC-003 §6 DEC-6 (Recomposition is a judged act, never a sum), verbatim on the inference the rule forbids.'
		},
		why:
			'AN OUTCOME ASSERTION — recomposition "LEAVES the parent not satisfied, SETS recomposition state ' +
			'CONFLICTED, and EMITS a conflict observation". Nothing is refused; `CompleteRecomposition` is ' +
			'ACCEPTED. ONE OF THE THREE LIMBS IS GENUINELY PERFORMED: the contract really does land in CONFLICTED, ' +
			'routed by the kernel\'s outcome map. THE OTHER TWO ARE NOT. Nothing writes to the parent PWU from the ' +
			'recomposition path at all — the kernel computes `parentSatisfied` and the handler DISCARDS it — and no ' +
			'ASSURANCE_OBSERVATION object is minted; the only emission is a domain event whose payload is not an ' +
			'observation. AND THE CONFLICT IS CALLER-SUPPLIED: `detectedConflicts` comes straight from the payload, ' +
			'so the "incompatible tenant-identity models" the rule names has no engine-side detector. Only child ' +
			'ACCEPTABILITY is derived. That is REG-F-014\'s shape a fourth time, on the input that decides whether ' +
			'a recomposition conflicts at all.'
	},
	'RPH-DEC-007': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'Mandatory parent obligations = allocated to children + retained by parent + already satisfied',
			note: 'JPWB-DOC-003 §6 DEC-3 (Obligation conservation), the equation itself. A DIFFERENT span from RPH-DEC-002\'s anchor of the same rule, so a reader can tell the equation from its consequence.'
		},
		why:
			'A PROPERTY RESTATEMENT OF RPH-DEC-002, and arm 3 for a structural reason rather than a gap. Its own ' +
			'ratified text begins "Property:" and ends "(Equivalent to Property P2.)", and the conformance ' +
			'manifest carries properties in a separate map. The equation IS enforced — at DEC-002\'s site, by ' +
			'DEC-002\'s predicate, producing DEC-002\'s finding code, in a message that names RPH-DEC-007 by id. ' +
			'THAT IS EXACTLY WHY IT CANNOT BE A SECOND ENFORCED ROW: the obligation finding type declares ONE code ' +
			'literal, so both rules would carry the identical marker, one mutant would redden both, and the ' +
			'register would report two enforced rules where one arrangement had ever been driven. The ' +
			'distinctness gate forbids it and exists for this case. Same reasoning as RPH-GOV-002. TWO LIMITS ON ' +
			'THE EQUATION worth recording where they will be found: the "authorized waivers" term is sourced only ' +
			'from an OBLIGATION whose own status string is WAIVED — no Decision or waiver object is consulted, so ' +
			'"authorized" is unchecked; and the P2 property test hard-codes `strength: MANDATORY` for every ' +
			'generated obligation, so the CONDITIONAL/ADVISORY exclusion branch is never generated and is covered ' +
			'only by the deterministic tests.'
	},
	'RPH-CNS-001': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'propagated (retaining authority and strength)',
			note: 'JPWB-DOC-003 §6 DEC-4 (Constraint exhaustive disposition), the first of the five dispositions it permits — retention of strength is the clause this rule protects.'
		},
		why:
			'THE ARRANGEMENT CANNOT BE EXPRESSED ON THE WIRE. The kernel arm is written and correct — one line ' +
			'producing CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY when a propagated strength is non-MANDATORY without ' +
			'an authority decision — and it reads `propagatedStrength`, a field that exists ONLY on the kernel\'s ' +
			'own record type. `ConstraintPropagationSchema`, the wire shape both ProposeDecomposition and ' +
			'ReviseDecomposition carry, is a `z.strictObject` of seven fields and `propagatedStrength` is not among ' +
			'them; being strict, it would REFUSE the field if a caller sent it. So no dispatch can weaken a ' +
			'propagated constraint, the antecedent is unreachable, and an OBSERVED_ADMISSION has nothing to ' +
			'arrange — the RPH-EVD-002 shape. RECORDED BECAUSE THE OPPOSITE READING IS AVAILABLE AND WRONG: an ' +
			'investigation proposed UNENFORCED_DISCLOSED on the grounds that the field is never populated, which ' +
			'is true and is not the reason. "Never populated" invites wiring; "not on the wire" says the shape ' +
			'must be authored first. THE RESIDUE: the day the field is added to the schema, this rule becomes live ' +
			'with a correct kernel arm already waiting, and nothing here would notice.'
	},
	'RPH-CNS-002': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'a model proposing to soften a mandatory constraint to advisory is rejected without authority',
			note: 'JPWB-DOC-003 §6 DEC-4, verbatim against the ratified statement — canon and the pre-canon rule are the same sentence twice.'
		},
		why:
			'THE SAME UNREACHABLE ARM AS RPH-CNS-001 — the two are decided by ONE line of kernel code, and the ' +
			'comment above it says so: "RPH-CNS-001: propagation preserves strength. RPH-CNS-002: weakening ' +
			'requires authority." Everything recorded on that row about the wire schema applies here. WHAT IS ' +
			'SHARPER HERE is the rule\'s narrower subject: a mandatory SECURITY constraint. `constraintType` IS ' +
			'carried on both the command payload and the object, and NO production file branches on it — the gate ' +
			'keys on strength MANDATORY and a live status only. So even were the strength field wired, the ' +
			'security-specific reading would still be unenforced, and the two gaps would need separate fixes. ' +
			'NOTE ALSO that this row is arm 3 while its canon carrier is one of the most emphatic sentences in ' +
			'DOC-003 — carriage and enforcement are independent axes, which RPH-EXE-007 records in the same ' +
			'direction.'
	},
	'RPH-CNS-004': {
		kind: 'NOT_A_COMMAND_REFUSAL',
		canonCarriage: {
			kind: 'CARRIED_BY_GENERAL_RULE',
			canonAnchor: 'waived through authority',
			note: 'JPWB-DOC-003 §6 DEC-4 lists waiver as one of the five permitted constraint dispositions but says nothing about expiry; ASR-14\'s "Expired waivers stop waiving" carries the expiry half and is RPH-GOV-006\'s anchor. GENERAL because no canon sentence joins constraint disposition to waiver expiry, which is this rule\'s actual subject.'
		},
		why:
			'A THREE-LIMB OUTCOME CASCADE on an act that cannot be dispatched. (1) "the waiver becomes expired" — ' +
			'no command expires a waiver and no handler emits WaiverExpired; expiry is COMPUTED, not recorded, and ' +
			'in exactly one place: the floor gate resolves `expiresAt <= now` against the command\'s own `issuedAt` ' +
			'(deliberately, so replay stays deterministic — the kernel is clock-free by design). (2) "affected ' +
			'work becomes review-required" — no such effect exists anywhere. (3) "baseline promotion is blocked" — ' +
			'that is RPH-GOV-006, which is a disclosure, and filing it here as well would let one gap green two ' +
			'rows. THE CONSTRAINT-SIDE ARM IS UNREACHABLE FOR THE SAME REASON AS RPH-CNS-001/002: the kernel\'s ' +
			'WAIVED_EXPIRED branch reads `waiverExpired`, and `ConstraintPropagationSchema` has no such field, so ' +
			'no dispatch can assert it. The engine therefore knows how to expire a waiver at ONE gate, and the ' +
			'constraint and promotion planes cannot ask.'
	},

	// ── THE THREE ENFORCED CONSERVATION ROWS — ONE SITE, ONE MESSAGE, THREE FINDING CODES ────────────────────
	//
	// All three refuse at `checkDecompositionConservation` with `RPH_INVARIANT_VIOLATION` and the SAME sentence.
	// What distinguishes them at the observation point is the finding code interpolated into `<parts>`, so each
	// row's `refusalMarker` IS its finding code. That is the marker doing precisely the job it was added for: the
	// distinctness gate proves the three strings differ, and the three probes prove the three ARRANGEMENTS produce
	// their own code and not a sibling's.
	'RPH-DEC-002': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'an unallocated mandatory obligation invalidates the decomposition and blocks child execution',
			note: 'JPWB-DOC-003 §6 DEC-3 (Obligation conservation), verbatim against the ratified statement — including the second limb, which this engine does NOT perform (see declaredMutations and the residual below).'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/decomposition.ts — validateObligationConservation, the P2 equation. ENFORCEMENT: packages/rph-application/src/handlers/decomposition.ts — checkDecompositionConservation, wired at TWO call sites: the ValidateDecomposition guard (for every disposition except INVALID) and the ReviseDecomposition precheck.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'MISSING_OBLIGATION_ALLOCATION(',
		declaredMutations: [
			'drop the `strength !== MANDATORY` filter in validateObligationConservation so ADVISORY obligations gate too — the probe still kills, but decomposition-conservation.test.ts\'s ADVISORY case reddens, which is where that mutant belongs',
			'make checkDecompositionConservation return null unconditionally — the probe reports ADMITTED',
			"remove the guard from the ValidateDecomposition site (`mapping.target === 'INVALID' ? undefined : …`) — ADMITTED",
			'THE LIMB NO MUTATION CAN REACH, recorded as a residual rather than a mutant: the ratified statement\'s second half — "and BLOCKS CHILD EXECUTION" — has no production site at all. No execution, PWU, assurance or governance handler ever loads a DECOMPOSITION_CONTRACT or consults its status. This row is ENFORCED on limb one only.',
			'ALSO NOT WHAT THE RULE SAYS: the rule\'s stated effect is that the decomposition BECOMES INVALID. The engine REFUSES the ValidateDecomposition command instead, leaving the contract in UNDER_REVIEW. Refusing the transition is the stronger act and the register records it as enforcement — but a reader looking for an INVALID contract will not find one.'
		]
	},
	'RPH-DEC-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'No silent omission; no unauthorized weakening',
			note: 'JPWB-DOC-003 §6 DEC-4 (Constraint exhaustive disposition). The "no silent omission" half is this rule; "no unauthorized weakening" is RPH-CNS-002, which is arm 3 because its arrangement cannot be put on the wire.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/decomposition.ts — validateConstraintPropagation, whose module-private collectConstraintFindings emits SILENT_CONSTRAINT_DROP for every relevant child a mandatory, applicable constraint leaves undispositioned. ENFORCEMENT: the same two call sites as RPH-DEC-002.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'SILENT_CONSTRAINT_DROP(',
		declaredMutations: [
			'delete the per-relevant-child coverage loop in collectConstraintFindings — the probe reports ADMITTED',
			"drop the `c.strength !== 'MANDATORY' || !c.applicable` early return so every constraint gates — the probe still kills; the ADVISORY control is what reddens",
			'THE SCOPE THE RULE NAMES AND THE GATE DOES NOT: the ratified statement is about a "mandatory parent SECURITY constraint". No production site keys on `constraintType` at all — the gate keys on strength plus a live status. A security-specific reading is unenforced, and `constraintType` IS carried on both the payload and the object, so the narrowing is available and simply not taken.'
		]
	},
	'RPH-CNS-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'marked inapplicable with rationale',
			note: 'JPWB-DOC-003 §6 DEC-4, the third of the five permitted dispositions. Canon requires the rationale in the same breath as the disposition, which is exactly what this rule refuses without.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/decomposition.ts — checkConstraintDisposition, the INAPPLICABLE arm. ENFORCEMENT: packages/rph-application/src/handlers/decomposition.ts — checkDecompositionConservation, via buildConstraintInput, which is the ONE constraint-input builder that drops nothing: it maps `disposition`, `rationale` AND `authorityDecisionId`, the three fields this arm reads. That is why this rule is enforced while its three CNS siblings are not — their arms read fields the wire cannot carry.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'INAPPLICABLE_WITHOUT_RATIONALE(',
		declaredMutations: [
			'delete the INAPPLICABLE arm of checkConstraintDisposition — the probe reports ADMITTED',
			'stop mapping `rationale` in buildConstraintInput — the arm can no longer see it, so EVERY inapplicable disposition refuses and the probe\'s CONTROL reddens instead: the over-refusal failure, which is why this row\'s control is a byte-adjacent record that differs only by carrying a rationale',
			'THE ALTERNATIVE THE RULE ALLOWS AND THE KERNEL DOES NOT: the ratified statement permits "an authority OR POLICY BASIS". The arm accepts only an `authorityDecisionId`; there is no policy-basis representation. And that id is never resolved to a real Decision — any non-empty string satisfies it, which is the REG-F-014 shape on a fifth field.'
		]
	},

	// ── THE FOUR PROMOTION-GATE ROWS — ONE SITE AGAIN, AND THE MARKER IS AGAIN THE FINDING CODE ──────────────
	//
	// `promoteBaseline`'s guard joins every `canPromoteBaseline` finding into one message:
	//   "Cannot promote baseline <id>: <CODE, CODE, …>"
	// so BAS-003, BAS-004 and BAS-006 are separated exactly as the conservation trio are — by the code each
	// arrangement produces. RPH-GOV-003 refuses at the SAME handler but at a LATER, separate arm with its own
	// sentence, which is why its marker is prose rather than a code.
	//
	// THE GATE'S OWN HISTORY IS THE REASON TO TRUST ONLY THE OBSERVED ONES. Its header records that
	// `promoteBaseline` once passed `openObservations: []` — a hard-coded empty list — so the RPH-BAS-003 arm
	// iterated nothing and no observation ever blocked a promotion. That was found and repaired. Its neighbour
	// `requiredWaivers`, one argument along in the same call, is still never supplied — RPH-GOV-006.
	'RPH-BAS-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'no unresolved blocking or critical finding except through a policy-permitted scoped waiver',
			note: 'JPWB-DOC-003 §8 ASR-16. Canon states the general form; the ratified rule instantiates it with tenant isolation, which the engine does NOT key on — see declaredMutations.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — canPromoteBaseline, the OPEN_BLOCKING_FINDING arm. ENFORCEMENT: packages/rph-application/src/handlers/governance.ts — promoteBaseline\'s guard, fed by observationsAgainstBaselineItems, which walks the event log for ASSURANCE_OBSERVATION objects whose subjectObjectIds intersect the baseline\'s OWN frozen item set and maps severity/disposition through BLOCKING_SEVERITIES and UNSETTLED_DISPOSITIONS.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'OPEN_BLOCKING_FINDING',
		declaredMutations: [
			'restore `openObservations: []` at the promoteBaseline call site — the arm iterates nothing and the probe reports ADMITTED. This is not hypothetical: the file\'s own header records that this WAS the code, and that no observation ever blocked a promotion until it was repaired.',
			'delete BLOCKING from BLOCKING_SEVERITIES so only CRITICAL gates',
			'drop OPEN from UNSETTLED_DISPOSITIONS — an open finding then reads as settled',
			'THE RULE\'S OWN NARROWING IS UNENFORCED: it names an "open blocking TENANT-ISOLATION finding", and no production code keys on tenant isolation, or on any finding category. The gate is severity-and-disposition only, so the general rule is enforced and the specific one is not.'
		]
	},
	// THE NEIGHBOUR ARGUMENT, DISCLOSED. RPH-BAS-003's row above records that `promoteBaseline` once passed
	// `openObservations: []` and no observation ever blocked a promotion. `requiredWaivers` is the argument beside
	// it in the same call, and it is not passed at all — so `findExpiredWaivers` walks `[]` on every promotion the
	// system can make. Same call, same shape, one repaired and one not.
	//
	// WHY THIS IS NOT A DEAD_PREDICATE CENSUS, since the arm looks exactly like one. `findExpiredWaivers` is CALLED
	// — once per promotion, from `canPromoteBaseline` — so it fails `deadPredicate`'s first clause, the same reason
	// RPH-ASR-010 is guarded by observation. What is missing is an ARGUMENT, and an absent argument has no symbol to
	// grep for. This is the third distinct shape of "unenforced" the register has had to hold: a dead predicate, a
	// rule implemented at neither layer, and now a live predicate starved of its input.
	//
	// AND THE GAP IS WIDER THAN THE MISSING ARGUMENT, which is the part worth recording rather than filing as a
	// one-line wiring task. NOTHING IN THIS SYSTEM MARKS A WAIVER AS REQUIRED BY A PROMOTION — no field, no link, no
	// derivation. A waiver names `waivedFindingIds`; the promotion gate reads observations BY SUBJECT and never
	// consults a waiver at all. So a waiver cannot become "required", cannot therefore become an expired required
	// waiver, and the rule's antecedent is unreachable BY CONSTRUCTION rather than merely unchecked. Supplying
	// `requiredWaivers` from the handler would not close this rule; it would first need something to supply.
	//
	// THE CONSEQUENCE, stated plainly because it is the operative fact for a reader deciding what to trust: an
	// expired waiver has NO effect on baseline promotion. It has one on the FLOOR path, where `waiverStillDischarges`
	// reads `expired` and an expired waiver stops discharging (RPH-GOV-005's neighbourhood) — so the same expiry
	// that is honoured at publication is invisible at promotion. Canon ASR-14 states both halves in one sentence.
	'RPH-GOV-006': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'Expired waivers stop waiving — an expired required waiver blocks promotion',
			note: 'JPWB-DOC-003 §8 ASR-14 (A waiver accepts risk; it never rewrites truth), verbatim and at full strength — canon names PROMOTION specifically, so this is not a rule the corpus states only in general form. The first clause is honoured on the floor path; the second, which is this rule, is honoured nowhere.'
		},
		why:
			'`canPromoteBaseline` carries a correct arm for this rule — `findExpiredWaivers` emits ' +
			'EXPIRED_REQUIRED_WAIVER for any `requiredWaivers` entry whose `expired` is true — and it is asked on ' +
			'every promotion. But `promoteBaseline`, the sole production caller, builds that input with SIX fields ' +
			'and `requiredWaivers` is not among them, so the loop runs over `[]` every time and the code is ' +
			'unreachable in production. THE ABSENCE IS STRUCTURAL, NOT A MISSING LINE: nothing anywhere marks a ' +
			'waiver as REQUIRED BY a promotion — the waiver names findings, the gate reads observations by subject, ' +
			'and no field or derivation joins them — so the rule\'s antecedent cannot arise. Observed: a promotion ' +
			'over an item covered by a waiver whose expiresAt is a month past the command\'s issuedAt is ACCEPTED, ' +
			'with no finding of any kind. The same expiry IS honoured at the publication floor, where ' +
			'`waiverStillDischarges` reads it — so an expired waiver stops waiving at one protected transition and ' +
			'not at the other.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'PromoteBaseline over an item covered by an EFFECTIVE waiver whose expiresAt (2026-07-01) is a month before the command\'s issuedAt (2026-08-01) — ACCEPTED, and the baseline becomes AUTHORITATIVE',
			control:
				'the identical promotion, with the identical expired waiver, plus an OPEN BLOCKING observation over the same baselined item — REFUSED with OPEN_BLOCKING_FINDING at the same gate. The expired waiver is present in BOTH runs precisely because it is not the variable: the control shows the gate reads this item set and refuses, and that the waiver contributes nothing either way.',
			whyNoPredicate:
				'`findExpiredWaivers` is not dead — `canPromoteBaseline` calls it on every promotion — so naming ' +
				'it would fail the census\'s first clause, the same reason RPH-ASR-010 is guarded by observation. ' +
				'What is absent is the ARGUMENT `requiredWaivers`, and an absent argument has no symbol whose ' +
				'reference set a grep could watch. A behavioural guard is also strictly the right instrument here: ' +
				'it reddens the day a promotion starts refusing an expired waiver, whether that comes from wiring ' +
				'the existing arm or from building the waiver-to-promotion link the rule actually presupposes.'
		}
	},
	'RPH-BAS-004': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'required claims, admitted evidence, assessments, and dispositions',
			note: 'JPWB-DOC-003 §8 ASR-16, the promotion precondition this rule instantiates for assessments.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — canPromoteBaseline\'s findAssessmentDefects, which emits REQUIRED_ASSESSMENT_INCOMPLETE for an assessment still ASSESSING or REQUESTED and REQUIRED_ASSESSMENT_NOT_SATISFIED for one that completed without SATISFIED/WAIVED. ENFORCEMENT: promoteBaseline\'s guard.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'REQUIRED_ASSESSMENT_NOT_SATISFIED',
		declaredMutations: [
			'make findAssessmentDefects return [] — the probe reports ADMITTED',
			'add REJECTED to the satisfied set so a rejected assessment authorizes promotion',
			'THE ANTECEDENT IS SATISFIED BY THE CALLER, NOT THE SYSTEM. The rule says "when Baseline Promotion REQUIRES Architecture Coverage, Intent Preservation and Assumption Disclosure" — the required set is whatever the PromoteBaseline payload lists in `requiredAssessmentIds`. A promotion listing NONE passes this arm vacuously. No code requires any particular assessment trio, so the rule is enforced over a set the promoter chooses.',
			'AND THE TWO CODES ARE NOT REACHED AS THE NAIVE READING SUGGESTS: an assessment id that loads NOTHING falls to the default disposition INCONCLUSIVE, so `complete` is true and the refusal carries NOT_SATISFIED rather than INCOMPLETE. Both land in the same joined message, so the distinction is invisible in the CommandResult — which is why this marker names the code the probe actually produces.'
		]
	},
	'RPH-BAS-006': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor:
				'A commit may exist without promotion; promotion is a separate governance event over exact versions',
			note: 'JPWB-DOC-003 §8 ASR-17 (A repository commit is never a baseline), which carries the rule\'s antecedent; ASR-16 carries the consequent (promotion needs effective authority).'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — canPromoteBaseline\'s NO_EFFECTIVE_PROMOTION_DECISION arm, fed from the STORE: the payload names a decision id, the handler loads it and reads its real status, decisionType and authority. ENFORCEMENT: promoteBaseline\'s guard, with the precondition fromStates(\'APPROVED\') and the machine\'s declared illegal UNDER_REVIEW -> AUTHORITATIVE as independent second and third defences.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'NO_EFFECTIVE_PROMOTION_DECISION',
		declaredMutations: [
			'make the promotionDecision input a constant `{status: "EFFECTIVE"}` instead of loading the object — the probe reports ADMITTED, and this is the BAS-002 defect shape (a gate fed a constant rather than stored state) on the neighbouring input',
			'accept a PROPOSED decision as effective in canPromoteBaseline',
			'THE ANTECEDENT NAMES A PLANE THAT DOES NOT EXIST: "committing source or architecture artifacts to version control". No command in the registry commits anything to version control, so nothing can trip the rule from that direction. This row is ENFORCED on the CONSEQUENT — no baseline becomes authoritative without a promotion decision — which is the half a dispatch can reach.'
		]
	},
	'RPH-GOV-003': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'A decision approving version n never authorizes version n+1',
			note: 'JPWB-DOC-003 §8 ASR-15, verbatim against the ratified statement.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/governance.ts — decisionAuthorizesVersions. ENFORCEMENT: packages/rph-application/src/handlers/governance.ts — promoteBaseline\'s guard, at a LATER arm than canPromoteBaseline: the gate first proves the decision is EFFECTIVE, then this proves it is still CURRENT. Its own comment records that the kernel was previously unreachable and a stale-version approval promoted to AUTHORITATIVE.',
		// THE GENERIC CODE IS A RECORDED DECISION, NOT AN OVERSIGHT (REG-F-010 group 3 / REG-E-022, 2026-08-03).
		// Its sibling refusal one arm away — the invalidated-evidence promotion — moved off this generic code the
		// same day, because `RPH_EVIDENCE_INVALIDATED` names that condition exactly. NO ratified code names this
		// one. `RPH_SUBJECT_VERSION_MISMATCH` is the obvious candidate and is deliberately not taken: it is the
		// code RPH-ASR-010's ratified statement claims for a DIFFERENT subject, and that row is disclosed on the
		// recorded census that no handler refuses with it — a census adopting it here would make untrue while
		// NOTHING went red, since that row is guarded by observation rather than by a grep. Held for the sponsor.
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		// PROSE, not a finding code, because this arm has its own sentence rather than joining canPromoteBaseline's
		// code list — which is also why it is distinguishable from the three BAS rows at the same handler.
		refusalMarker: 'STALE_DECISION_VERSION',
		declaredMutations: [
			'delete the decisionAuthorizesVersions arm — the probe reports ADMITTED, restoring the exact defect the comment says W1 WIRE-4 fixed',
			'compare against the DECISION\'s recorded versions only, ignoring the subject\'s current version — the arm can never fire',
			'THE INTEGRITY CAVEAT, and it is REG-F-014\'s second instance: the versions this arm compares against are CALLER-SUPPLIED at approval time. `proposeDecision` PINS them from the store, and `approveDecision`\'s extraMutate then OVERWRITES that pin with the payload. So the binding this rule enforces is exact against a number the approver chose. The refusal is real; what it is exact ABOUT is not verified.',
			'THIS ROW\'S OWN PROBE IS BUILT ON THAT DEFECT (REG-F-017, 2026-08-03), and the row says so rather than letting the reader assume the arrangement is honest. `promotionProbe(\'stale-version\')` makes the decision bind v2 while the subject sits at v1 by having the approver STATE v2 — the caller-supplied-fact bug, used as a fixture device. Measured: of 132 ApproveDecision dispatches in the suite, 13 diverge from the store, and 2 of those are this probe and its sibling test.',
			'AND THE HONEST ARRANGEMENT IS UNREACHABLE FOR THIS SUBJECT. Censused every semantic-version write: only INTENT, DECOMPOSITION_CONTRACT and PROFESSIONAL_WORK_ARCHITECTURE can ever move their semanticVersion. A PWU\'s is 1 at creation and no command changes it — so over a PWU subject the rule\'s antecedent (the subject moving on after approval) CANNOT BE PRODUCED, which is why the forgery was needed to produce it. Closing the forgery requires re-basing this probe onto a subject that versions, and this probe is shared by four rules (RPH-BAS-003/004/006 and this one). Sequenced as its own increment; see REG-F-017.'
		]
	},
	// ── THE ONE LIVE WIRING IN A FAMILY OF FIVE DEAD PREDICATES ──────────────────────────────────────────────
	//
	// RPH-ASM-006 is the only ASM rule with a kernel predicate anything asks. `canAuthorizeNewWork` has real
	// callers; its five siblings have none. It is also the only assumption consultation in the entire execution
	// plane — one call, on the plan-approval arrow — and the handler's own comment concedes the scope: "the first
	// live wiring of the assumption-impact half of WP-3-008 (the falsification transition + reshape/reassessment
	// loop remain)".
	'RPH-ASM-006': {
		kind: 'ENFORCED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'expired assumptions stop authorizing work',
			note: 'JPWB-DOC-003 §4 OBJ-4, verbatim. The ratified rule names plan approval as the act; canon states the principle over "work" generally, which is broader and is not enforced beyond this one arrow.'
		},
		enforcedAt:
			'DECISION: packages/rph-domain/src/decomposition.ts — canAuthorizeNewWork, which refuses EXPIRED, FALSIFIED and SUPERSEDED. ENFORCEMENT: packages/rph-application/src/handlers/execution.ts — approveExecutionPlan\'s guard, via assumptionsAuthorizeNewWork, which loads the plan\'s PWU, walks its assumptionIds, and returns the first dead one. The precondition fromStates(\'UNDER_REVIEW\') is sited AHEAD of the guard, which the handler\'s comment records as correcting a latent mask: a wrong-state plan whose PWU also had a dead assumption used to refuse with this rule\'s code instead of the state code.',
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'cannot authorize new work (RPH-ASM-006)',
		declaredMutations: [
			'widen canAuthorizeNewWork to accept EXPIRED — the probe reports ADMITTED',
			'delete the guard from approveExecutionPlan — ADMITTED',
			'drop the `a?.objectType !== ASSUMPTION` skip in assumptionsAuthorizeNewWork so an unresolvable id gates — the probe still kills; what reddens is any fixture naming a non-existent assumption, and the skip is a DELIBERATE fail-open the handler comments as "unknown status → not gatable (sound)"',
			'TWO STATUSES THE PREDICATE REFUSES AND NO COMMAND CAN REACH: FALSIFIED and SUPERSEDED. Only DetectAssumption and ExpireAssumption exist, so EXPIRED is the sole reachable arm of the three. This row is enforced on one third of its own predicate.',
			'AND THE SET IT WALKS IS WRITE-ONCE: only ProposePwu writes `assumptionIds`, so an Assumption created later by DetectAssumption can never become gatable on an already-proposed PWU. The rule holds for assumptions declared at proposal time and for no others.'
		]
	},
	// ── RPH-DEC-005 — THE THIRD LIMB OF THE DECOMPOSITION CONTRACT, GATED NOWHERE ────────────────────────────
	//
	// RPH-DEC-001 names three conditions for a decomposition to become VALID. Two are enforced (RPH-DEC-002,
	// RPH-DEC-003). The third — "has a recomposition contract" — is read by nothing: `recompositionContractId` is
	// written onto the contract by ProposeDecomposition, echoed into the event, and never loaded, compared or
	// required by any guard or precondition. The ValidateDecomposition guard runs `checkDecompositionConservation`
	// and nothing else, and that function builds obligation and constraint inputs only.
	//
	// THE PRODUCER OF THE FINDING IS THE DEAD DOMAIN COMPOSITION, which is also RPH-DEC-004's producer — so
	// MISSING_RECOMPOSITION_CONTRACT can no more reach a CommandResult than CHILD_INTENT_DIVERGENCE can. This row
	// is guarded by OBSERVATION rather than a census for the reason RPH-DEC-004's row records: a census over that
	// symbol returns four files, because the application handler exports a function of the same name.
	'RPH-DEC-005': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'and a recomposition strategy',
			note: 'JPWB-DOC-003 §6 DEC-2, the last item of the mandatory contract\'s enumeration, immediately followed by "A decomposition is incomplete until it explains how child results will establish the parent claim" — which is RPH-DEC-001\'s anchor. The two rules are the enumeration and its consequence.'
		},
		why:
			'"CANNOT BECOME VALID" IS A REFUSAL OF THE VALID TRANSITION, and no production site performs it. Nothing ' +
			'requires, reads or resolves a recomposition contract before a decomposition is marked VALID; the ' +
			'carrier field is write-only. NOR IS THE LINK ENFORCED IN THE OTHER DIRECTION: `ProposeRecomposition` ' +
			'takes a parent and required children and never references the decomposition contract that should have ' +
			'named it, so the two objects are related by a string nothing checks. THE RULE\'S OWN QUALIFIER IS ALSO ' +
			'UNDEFINED — "a MATERIAL parent" has no field, predicate or classifier on the command plane deciding ' +
			'materiality, so even a wired gate would have to invent the scope. A NEAR-MISS THAT LOOKS LIKE ' +
			'COVERAGE, named so it is not mistaken for it: the handler file cites "§14.1 / RPH-DEC-005/006" over ' +
			'`completeRecomposition` — but that handler evaluates an ALREADY-EXISTING recomposition contract. It ' +
			'cannot check that a decomposition HAS one, which is the entire content of this rule.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'ValidateDecomposition -> VALID on a decomposition proposed with NO recompositionContractId at all — accepted, and the contract really advances to VALID',
			control:
				'the byte-adjacent decomposition that also omits the recomposition contract but leaves a MANDATORY parent obligation unallocated, refused at the SAME guard with MISSING_OBLIGATION_ALLOCATION — so the acceptance is a missing limb of a live gate, not a gate that never refuses',
			whyNoPredicate:
				'The only producer of MISSING_RECOMPOSITION_CONTRACT is the domain decomposition composition, and a ' +
				'census over its identifier returns FOUR files because the application handler exports a function ' +
				'of the same name. The guard would look wired while the rule went unenforced — the same collision ' +
				'RPH-DEC-004 records, which is why that row names a different symbol and this one observes instead.'
		}
	}
};

/** Every disposed rule id. */
export const REGISTERED_RULE_IDS = Object.keys(ENFORCEMENT_REGISTER) as readonly RegisteredRuleId[];

/** The rule ids the register claims are ENFORCED — the set the probe map must be total over. */
export function enforcedRuleIds(): RegisteredRuleId[] {
	return REGISTERED_RULE_IDS.filter((id) => ENFORCEMENT_REGISTER[id].kind === 'ENFORCED');
}

/** The rule ids disclosed as enforced NOWHERE. */
export function unenforcedRuleIds(): RegisteredRuleId[] {
	return REGISTERED_RULE_IDS.filter(
		(id) => ENFORCEMENT_REGISTER[id].kind === 'UNENFORCED_DISCLOSED'
	);
}

/** Disclosed rules whose guard is a named dead predicate — the ids the census gate is total over. */
export function deadPredicateRuleIds(): RegisteredRuleId[] {
	return unenforcedRuleIds().filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'UNENFORCED_DISCLOSED' && row.guard.kind === 'DEAD_PREDICATE';
	});
}

/**
 * Disclosed rules whose guard is an OBSERVED ADMISSION — the ids the acceptance-probe map must be total over.
 *
 * These are the rows whose disclosure is settled by dispatching, not by grepping, and the probe map that observes
 * them lives beside the enforcement probes in `rph-application` (this package may not drive commands).
 */
export function observedAdmissionRuleIds(): RegisteredRuleId[] {
	return unenforcedRuleIds().filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'UNENFORCED_DISCLOSED' && row.guard.kind === 'OBSERVED_ADMISSION';
	});
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// The analysis primitives.
//
// These are what the gates COMPUTE WITH, so a bug in one of them silently weakens every gate that uses it — a
// `classifyRefusal` that returned KILLED for everything would turn the whole register green. They are therefore
// pure, exported, and SELFTESTED against literal synthetic input in `enforcement-register.test.ts`: each is fed a
// hand-written failing case and asserted to REPORT FAILURE. The recursion terminates here, at functions with no
// dependencies to mock.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** What a probe observed, relative to what its row declared. Only KILLED is a pass. */
export type RefusalVerdict =
	| 'KILLED' // refused, with the declared code AND the declared marker — this site is what refused
	| 'WRONG_CODE' // refused, but by a check that reports a different code
	| 'MASKED' // refused with the right code but a different message — another guard produced it
	| 'ADMITTED'; // not refused at all

/** What a dispatch returned, reduced to the fields a verdict reads. */
export interface ObservedOutcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
	/**
	 * The structured schema issues, when the boundary refused (`error.details.issues`), each reduced to its
	 * `code` and dotted `path`. Read ONLY by the SCHEMA arm — see `classifyRefusal`.
	 */
	readonly issues?: readonly { readonly path: string; readonly code: string }[];
}

/**
 * THE LAYER AT WHICH A ROW'S REFUSAL HAPPENS. Absent means `COMMAND`, so every row written before 2026-08-02 is
 * unchanged and no existing probe shifts meaning.
 *
 * WHY THIS EXISTS. `RPH-CON-*` states obligations the CONTRACT enforces — "a payload with an undeclared property
 * fails validation", "a non-RFC-3339 timestamp fails schema validation" — and those refusals never reach a handler:
 * `command-bus` returns status `VALIDATION_FAILED`, not `REJECTED`. The COMMAND arm therefore classified real,
 * working enforcement as ADMITTED, which is why the register's scope paragraph recorded RPH-CON as structurally
 * inexpressible. It is not inexpressible; it is a second layer, and this names it.
 *
 * THE DANGER THIS DESIGN EXISTS TO AVOID, stated because the obvious implementation is catastrophic. If
 * `classifyRefusal` simply accepted `VALIDATION_FAILED` as a refusal, EVERY row in the register would become
 * satisfiable by a MALFORMED PAYLOAD — a probe whose fixture had a typo would report KILLED instead of failing.
 * Six fixture errors this programme caught (a lowercase Crockford tag, an ActorReference in an AuthorityReference's
 * place, a missing shapeReadinessAssessmentId, …) surfaced precisely BECAUSE VALIDATION_FAILED is not a pass. So
 * the widening is OPT-IN PER ROW: a row must declare `refusalLayer: 'SCHEMA'`, and only that row's probe may be
 * satisfied by a boundary refusal.
 */
export type RefusalLayer = 'COMMAND' | 'SCHEMA';

/**
 * Classify an observed dispatch outcome against a declared (code, marker) pair.
 *
 * MARKER BEFORE CODE IS NOT ENOUGH, AND NEITHER IS CODE ALONE. `RPH_ILLEGAL_STATE_TRANSITION` is returned by the
 * machine, by four prechecks and by every source set in the system; a probe asserting only the code proves that
 * SOMETHING refused, which is exactly the vacuous negative DS-001 §4 names. The marker is what pins WHICH.
 */
export function classifyRefusal(
	observed: ObservedOutcome,
	expected: {
		readonly refusalCode: string;
		readonly refusalMarker: string;
		readonly refusalLayer?: RefusalLayer;
		readonly refusalStatus?: 'REJECTED' | 'CONFLICT' | 'UNAUTHORIZED';
	}
): RefusalVerdict {
	// ── THE SCHEMA ARM (2026-08-02) ──────────────────────────────────────────────────────────────────────────
	//
	// Opt-in only. A row without `refusalLayer: 'SCHEMA'` falls through to the COMMAND arm exactly as before, so a
	// malformed payload in ANY other probe still fails loudly instead of counting as a kill.
	//
	// THE MARKER IS A STRUCTURED PAIR, NOT PROSE, because the boundary's message is the CONSTANT
	// 'Schema validation failed' for every failure in the system — it discriminates nothing. What does discriminate
	// is `error.details.issues[]`, so a SCHEMA row's marker is `<issueCode>@<dottedPath>`: `unrecognized_keys@` for
	// an undeclared property (zod reports those at the object root, so the path is empty), `invalid_type@issuedAt`
	// for a mistyped field. Distinctness across rows is gated the same way COMMAND markers are.
	//
	// A MATCHED PATH IS NECESSARY AND NOT SUFFICIENT, which is why the SCHEMA rows' probes carry the same control
	// discipline as every other row and lean on it harder: a sloppy payload failing on three fields would match a
	// declared path among them. The CONTROL — the byte-identical payload with ONLY that field corrected, ACCEPTED —
	// is what pins the refusal to the field the rule is about.
	if (expected.refusalLayer === 'SCHEMA') {
		if (observed.status === 'ACCEPTED') return 'ADMITTED';
		// Something refused, but not the boundary — a semantic guard caught it first. That is the wrong site for a
		// row claiming schema enforcement, and it is exactly what a mis-declared layer looks like.
		if (observed.status !== 'VALIDATION_FAILED') return 'WRONG_CODE';
		if (observed.code !== expected.refusalCode) return 'WRONG_CODE';
		const matched = (observed.issues ?? []).some(
			(i) => `${i.code}@${i.path}` === expected.refusalMarker
		);
		return matched ? 'KILLED' : 'MASKED';
	}

	// ── THE COMMAND ARM, now reading a DECLARED status (2026-08-02, the RPH-PER tranche) ─────────────────────
	//
	// The default is `REJECTED`, so every row written before this line is byte-identical in behaviour. What a row
	// may now do is declare `refusalStatus: 'CONFLICT'` — because an optimistic-concurrency refusal really is a
	// refusal, really is performed by a named command-layer site, and really does carry its own status. Before
	// this, RPH-PER-001 would have been classified ADMITTED by a register whose whole purpose is to not do that.
	//
	// STILL EXACTLY ONE STATUS PER ROW, never a set. A gate that accepted "any non-ACCEPTED status" would let the
	// commonest fixture error in this repository — a malformed payload returning VALIDATION_FAILED — satisfy a row
	// about an invariant it never reached. The row names the one status its site produces, and the mutants named
	// in `declaredMutations` are what prove it names the right one.
	if (observed.status !== (expected.refusalStatus ?? 'REJECTED')) return 'ADMITTED';
	if (observed.code !== expected.refusalCode) return 'WRONG_CODE';
	if (!(observed.message ?? '').includes(expected.refusalMarker)) return 'MASKED';
	return 'KILLED';
}

/**
 * Every non-default member of `refusalStatus`, as DATA.
 *
 * `REJECTED` is excluded because it is the DEFAULT — rows that omit the field get it, so it can never be vacuous
 * and requiring a row to declare it explicitly would prove nothing.
 */
export const DECLARABLE_REFUSAL_STATUSES = ['CONFLICT', 'UNAUTHORIZED'] as const;

/**
 * Rows declaring a given non-default refusal status.
 *
 * Exported so the gate can prove the declared-status arm is NOT VACUOUS, and the gate iterates
 * `DECLARABLE_REFUSAL_STATUSES` rather than naming one — so a FUTURE member added without a row that exercises it
 * fails immediately, instead of sitting as a branch no mutant can redden. Three such branches shipped green in this
 * repository before the discipline was written down; `UNAUTHORIZED` was deliberately kept OUT of the union for one
 * commit for exactly this reason, and entered it the day RPH-GOV-001 needed it.
 */
export function rowsDeclaringRefusalStatus(
	status: (typeof DECLARABLE_REFUSAL_STATUSES)[number]
): RegisteredRuleId[] {
	return REGISTERED_RULE_IDS.filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'ENFORCED' && row.refusalStatus === status;
	});
}

/** Back-compat alias for the CONFLICT selftest, which predates the generalised form. */
export function conflictStatusRuleIds(): RegisteredRuleId[] {
	return rowsDeclaringRefusalStatus('CONFLICT');
}

/** Rows whose refusal is at the contract boundary rather than a handler. */
export function schemaLayerRuleIds(): RegisteredRuleId[] {
	return REGISTERED_RULE_IDS.filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'ENFORCED' && row.refusalLayer === 'SCHEMA';
	});
}

/** Rule ids sharing a refusal marker with another row (must be empty — see `EnforcedRule.refusalMarker`). */
export function duplicateRefusalMarkers(): string[] {
	const seen = new Map<string, string>();
	const clashes: string[] = [];
	for (const id of REGISTERED_RULE_IDS) {
		const row = ENFORCEMENT_REGISTER[id];
		if (row.kind !== 'ENFORCED') continue;
		const prior = seen.get(row.refusalMarker);
		if (prior) clashes.push(`${prior} and ${id} share the marker "${row.refusalMarker}"`);
		else seen.set(row.refusalMarker, id);
	}
	return clashes;
}

/** The minimum marker length. Short enough to be quotable, long enough that no unrelated message contains it. */
export const MIN_REFUSAL_MARKER_LENGTH = 20;

/** Rule ids whose marker is too short to be a reliable discriminator. */
export function shortRefusalMarkers(minLength = MIN_REFUSAL_MARKER_LENGTH): string[] {
	return REGISTERED_RULE_IDS.filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		if (row.kind !== 'ENFORCED') return false;
		// SCHEMA rows are EXEMPT FROM THE LENGTH RULE, and the exemption is principled rather than convenient. The
		// minimum exists because a free-text message fragment needs length to be distinctive — `is inadmissible`
		// would match refusals it has nothing to do with. A SCHEMA marker is not prose: it is the structured pair
		// `<issueCode>@<dottedPath>`, matched by EQUALITY against the boundary's own reported issues, so
		// `unrecognized_keys@` discriminates exactly and is 19 characters. Length would measure the wrong thing.
		// DISTINCTNESS IS NOT EXEMPTED — `duplicateRefusalMarkers` still covers every ENFORCED row, which is the
		// property that actually stops one arrangement greening two rules.
		if (row.refusalLayer === 'SCHEMA') return false;
		return row.refusalMarker.length < minLength;
	});
}

/** SCHEMA rows whose marker is not the structured `<issueCode>@<dottedPath>` pair the arm matches on. */
export function malformedSchemaMarkers(): string[] {
	return schemaLayerRuleIds().filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'ENFORCED' && !row.refusalMarker.includes('@');
	});
}

const STEP_MACHINE_NAME = 'ExecutionStep.stepState';

/**
 * The RESIDUAL source states of a step command: states the MACHINE would admit into the command's target, minus
 * the states the command DECLARES it drives from.
 *
 * THIS IS THE ARROW CENSUS'S DENOMINATOR, and deriving it is the whole point. WP-9 hand-picked six cases from
 * this set and reasoned about each; enumerating it makes the set itself the contract, so WIDENING a `sourceStates`
 * array silently shrinks the residual set and a row goes missing from the census — a failing test rather than a
 * quieter guard.
 *
 * The self-edge (target -> target) is INCLUDED when the machine has no explicit arrow for it, because
 * `checkTransition` classifies `from === to` as a NOOP and admits it: a re-issue is the residual case for every
 * command whose declared sources are exactly the machine's in-arrows (F-14/F-19 were precisely that).
 */
export function residualSourceStates(spec: StepCommandSpec): string[] {
	const machine = STATE_MACHINES[STEP_MACHINE_NAME];
	if (!machine) return [];
	const admissible = new Set<string>(
		machine.transitions.filter((t) => t.to === spec.target).map((t) => t.from)
	);
	// The NOOP self-edge the machine does not list but `checkTransition` admits.
	admissible.add(spec.target);
	const declared = new Set<string>(spec.sourceStates);
	return machine.states.filter((s) => admissible.has(s) && !declared.has(s));
}
