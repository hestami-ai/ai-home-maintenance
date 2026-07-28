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
// SCOPE, DERIVED RATHER THAN CHOSEN. The register is TOTAL over every `RPH-EXE-*` rule in the ratified catalog
// (`packages/rph-domain/vocab/m12-conformance.json`) — the id family the execution command surface owns — plus the
// two `RPH-PWU-*` rules whose ratified statements are themselves about execution and which WP-12b wired into that
// same surface. A new RPH-EXE rule with no row is a FAILING TEST, not a discovery. The rest of taxonomy layer 3
// (the Intent lifecycle and the PWU shape/baseline rules) is governed by other command surfaces this remediation
// never touched; extending the register to them is recorded as follow-up work rather than faked here.
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

/** A rule whose statement IS a command refusal and which NOTHING in production enforces. */
export interface UnenforcedRule {
	readonly kind: 'UNENFORCED_DISCLOSED';
	readonly canonCarriage: CanonCarriage;
	readonly why: string;
	/** The kernel predicate that implements the rule correctly but is never asked. */
	readonly deadPredicate: string;
	/**
	 * Every NON-TEST source file that references `deadPredicate`, repo-relative.
	 *
	 * THE DISCLOSURE'S OWN GUARD. The gate greps the tree and asserts this set exactly — so the day someone wires
	 * the predicate into a handler, this row goes RED and must be re-dispositioned as ENFORCED with a probe. A
	 * prose disclosure would instead sit here being quietly false.
	 */
	readonly referencedOnlyBy: readonly string[];
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
	| 'RPH-PWU-010';

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
		deadPredicate: 'capabilityAuthorized',
		referencedOnlyBy: ['packages/rph-domain/src/execution.ts']
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
