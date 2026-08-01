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
// SCOPE, DERIVED RATHER THAN CHOSEN. The register is TOTAL over every `RPH-EXE-*` and every `RPH-EVD-*` rule in the
// ratified catalog (`packages/rph-domain/vocab/m12-conformance.json`), plus the two `RPH-PWU-*` rules whose ratified
// statements are themselves about execution and which WP-12b wired into that same surface. A new rule in either
// family with no row is a FAILING TEST, not a discovery — the families are listed as DATA in
// `enforcement-register.test.ts` (`TOTAL_OVER_FAMILIES`) rather than hard-coded in a filter, so a family cannot be
// silently dropped from the gate either.
//
// RPH-EVD ADDED 2026-08-01. The original scope paragraph recorded the rest of taxonomy layer 3 as "follow-up work
// rather than faked here"; this is that follow-up discharged for the evidence family, and the remaining families
// (the Intent lifecycle, the PWU shape/baseline rules, and RPH-ASR) are still exactly that — recorded as owed, not
// quietly claimed. Extending the register cost a widening of the UNENFORCED arm (see `UnenforcementGuard`), because
// the evidence rules are not the shape the execution rules were: they are refusals this engine implements at
// NEITHER layer, where the archetype was a correct predicate nothing asked.
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
	| 'RPH-EVD-007';

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
			'appends no events — is RPH-PER-002, and is covered at the store layer.'
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
	'RPH-EVD-003': {
		kind: 'UNENFORCED_DISCLOSED',
		canonCarriage: {
			kind: 'CARRIED',
			canonAnchor: 'provenance is present; content or reference is available',
			note: 'JPWB-DOC-003 §7, the admissibility conditions. Canon carries BOTH halves of this rule; the engine forecloses one at the schema layer and leaves the other open, which is why the disclosure below is narrower than the ratified statement.'
		},
		why:
			'THE RULE HAS TWO HALVES AND THEY HAVE DIFFERENT ANSWERS — a distinction that only survives being ' +
			'dispatched, and that source-reading alone got wrong in both directions. (1) THE PRODUCING-ACTOR HALF IS ' +
			'SCHEMA-FORECLOSED, not unenforced: `ProposeEvidence.producedBy` is a required `ActorReferenceSchema` whose ' +
			'`actorId` and `displayName` are `.min(1)`, so evidence with no producing actor cannot be proposed at all ' +
			'(observed: VALIDATION_FAILED / RPH_VALIDATION_SCHEMA_FAILED, never reaching a handler). That is enforcement ' +
			'at the SCHEMA layer, and this register\'s ENFORCED arm cannot express it — `classifyRefusal` reads only ' +
			'`REJECTED`, so a schema foreclosure classifies as ADMITTED. (2) THE SOURCE HALF IS NOT ENFORCED. ' +
			'`ArtifactReferenceSchema` is `z.record(z.string(), z.unknown())`, so `contentReference: {}` — a source ' +
			'reference pointing at nothing — is schema-valid, and the admissibility guard\'s CONTENT_AVAILABLE limb is ' +
			'`contentReference === undefined || null`, which `{}` passes. AND THE PROVENANCE LIMB IS STRUCTURALLY ' +
			'UNFAILABLE: `newEnvelope` (packages/rph-application/src/handlers/kit.ts) sets `provenance` unconditionally ' +
			'on EVERY object, with a DEFAULTED `originType: \'USER_INPUT\'` and empty source arrays, so ' +
			'PROVENANCE_PRESENT null-checks a field the engine itself always populates and which names no producing ' +
			'actor. The actor is in `producedBy`, and `EvidenceForAdmissibility` ' +
			'(packages/rph-assurance/src/assurance-rules.ts) has no `producedBy` field, so the predicate cannot express ' +
			'the rule even in principle. A live guard limb that cannot fail is the same defect this programme keeps ' +
			'finding in tests, here in production.',
		guard: {
			kind: 'OBSERVED_ADMISSION',
			arrangement:
				'ProposeEvidence with `contentReference: {}` — a source reference naming nothing — then AdmitEvidence, which is ACCEPTED and advances the Evidence to ADMISSIBLE',
			control:
				"the byte-identical arrangement with `scope: ''` instead, which the SAME guard at the SAME site REFUSES with RPH_VALIDATION_SEMANTIC_FAILED — so the admission above is a missing limb of a live guard, not a dead guard",
			whyNoPredicate:
				'`evidenceAdmissibility` is NOT the dead predicate: it IS asked (the admitEvidence guard calls it) and ' +
				'it does NOT implement this rule (its input type has no `producedBy`, and CONTENT_AVAILABLE is a ' +
				'null-check). Naming it would make both clauses of `deadPredicate`\'s own contract false. And ' +
				'`producedBy`\'s production census already contains handlers/assurance.ts, so a census guard could not ' +
				'detect the wiring it would exist to detect.'
		}
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

/** What a dispatch returned, reduced to the three fields a verdict reads. */
export interface ObservedOutcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
}

/**
 * Classify an observed dispatch outcome against a declared (code, marker) pair.
 *
 * MARKER BEFORE CODE IS NOT ENOUGH, AND NEITHER IS CODE ALONE. `RPH_ILLEGAL_STATE_TRANSITION` is returned by the
 * machine, by four prechecks and by every source set in the system; a probe asserting only the code proves that
 * SOMETHING refused, which is exactly the vacuous negative DS-001 §4 names. The marker is what pins WHICH.
 */
export function classifyRefusal(
	observed: ObservedOutcome,
	expected: { readonly refusalCode: string; readonly refusalMarker: string }
): RefusalVerdict {
	if (observed.status !== 'REJECTED') return 'ADMITTED';
	if (observed.code !== expected.refusalCode) return 'WRONG_CODE';
	if (!(observed.message ?? '').includes(expected.refusalMarker)) return 'MASKED';
	return 'KILLED';
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
		return row.kind === 'ENFORCED' && row.refusalMarker.length < minLength;
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
