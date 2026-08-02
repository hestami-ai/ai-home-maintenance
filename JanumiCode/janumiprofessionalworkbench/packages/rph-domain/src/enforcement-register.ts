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
// SCOPE, DERIVED RATHER THAN CHOSEN, AND CURRENT AS OF 2026-08-02. The register is TOTAL over five families of the
// ratified catalog (`packages/rph-domain/vocab/m12-conformance.json`): `RPH-EXE-*`, `RPH-EVD-*`, `RPH-ASR-*`,
// `RPH-INT-*` and `RPH-PWU-*` — 45 rules. A new rule in any of the five with no row is a FAILING TEST, not a
// discovery, and the families are listed as DATA in `enforcement-register.test.ts` (`TOTAL_OVER_FAMILIES`) rather
// than hard-coded in a filter, so a family cannot be silently dropped from the gate either.
//
// RPH-PWU CLOSED IN FOUR STEPS, AND ITS ABSENCE FROM THAT LIST WAS ITSELF A CLAIM. It held 5, then 8, then 9 of its
// ten rules across three commits while deliberately staying OUT of `TOTAL_OVER_FAMILIES`, because the outstanding
// rows were all UNENFORCED_DISCLOSED with OBSERVED_ADMISSION guards, and landing a disclosure without its
// observation is the one thing that arm may never do. "Not yet total" was gated rather than asserted.
//
// STILL OWED, recorded so the remaining gap cannot read as coverage: RPH-PER (the store layer), the read-model
// families RPH-PRJ and RPH-TRC, and the layer-1 contract family RPH-CON — whose rules are SCHEMA obligations this
// register's ENFORCED arm structurally cannot express, since `classifyRefusal` reads only `REJECTED` and a schema
// foreclosure surfaces as VALIDATION_FAILED (the RPH-EVD-003 finding, which cost a real correction to learn).
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
	 * `UNAUTHORIZED` is real and reachable and is NOT a member either, for the opposite reason: no registered rule
	 * refuses with `RPH_AUTHORITY_INSUFFICIENT`. An arm no row exercises is an arm no mutant can redden, which is
	 * this repository's most-repeated defect. It goes in when a row needs it, with the probe that proves it.
	 */
	readonly refusalStatus?: 'REJECTED' | 'CONFLICT';
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
	// RPH-PER, TWELVE OF FOURTEEN (2026-08-02). RPH-PER-003 and RPH-PER-004 are investigated and OWED: both are
	// UNENFORCED_DISCLOSED with OBSERVED_ADMISSION guards, and landing a disclosure without its observation is the
	// one thing that arm may never do. The family is therefore deliberately ABSENT from `TOTAL_OVER_FAMILIES`, and
	// that absence is a gated claim rather than a sentence — exactly as RPH-PWU was held out for three commits.
	| 'RPH-PER-001'
	| 'RPH-PER-002'
	| 'RPH-PER-005'
	| 'RPH-PER-006'
	| 'RPH-PER-007'
	| 'RPH-PER-008'
	| 'RPH-PER-009'
	| 'RPH-PER-010'
	| 'RPH-PER-011'
	| 'RPH-PER-012'
	| 'RPH-PER-013'
	| 'RPH-PER-014';

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
			'of a rule canon states absolutely, and the engine supplies nothing in its place.',
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
			'repository that reconstructs an aggregate from its own event stream), asserted in ' +
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
			'transaction of its own, so a bare overlay commit has no rollback boundary at all, and no test anywhere ' +
			'constructs that adapter.'
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
			'created" has no object to be about. Nor does the rule\'s premise hold as stated: no PWU state means ' +
			'"waiting for human approval" — the only modelled wait is ExecutionStep RUNNING->WAITING with a ' +
			'FREE-TEXT `waitReason` and no ratified wait-reason vocabulary, so nothing distinguishes a ' +
			'human-approval wait from any other. And the "extension" the rule names does not exist: this engine ' +
			'ships as a web host, not a VS Code extension. WHAT SURVIVES A RESTART, and it does so by construction ' +
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
			'presupposes "a valid raw validator result PERSISTED ... before authoritative disposition", and no such ' +
			'intermediate is ever written: `validatorResult` exists only as a field of the ' +
			'`CompleteAssuranceAssessment` COMMAND payload, and `parseCompletion` validates it and derives the ' +
			'disposition IN THE SAME DISPATCH that commits the terminal transition. The assessment is born directly ' +
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
		readonly refusalStatus?: 'REJECTED' | 'CONFLICT';
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
 * Rows whose refusal carries `CommandResult.status: 'CONFLICT'` rather than `REJECTED`.
 *
 * Exported so the gate can prove the declared-status arm is NOT VACUOUS. An opt-in widening that no row exercises
 * is a branch no mutant can redden — three of those shipped green in this repository before the discipline was
 * written down — so if the last CONFLICT row is ever re-dispositioned, the selftest fails and the arm goes with it.
 */
export function conflictStatusRuleIds(): RegisteredRuleId[] {
	return REGISTERED_RULE_IDS.filter((id) => {
		const row = ENFORCEMENT_REGISTER[id];
		return row.kind === 'ENFORCED' && row.refusalStatus === 'CONFLICT';
	});
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
