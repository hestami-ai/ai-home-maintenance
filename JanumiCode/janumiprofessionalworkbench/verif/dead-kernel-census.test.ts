// THE DEAD-KERNEL CENSUS, AS GATED DATA — the retirement of three prose lists that kept going stale.
//
// WHAT IT ASSERTS: the set of exported `rph-domain` functions that NO production file CALLS is exactly the set
// declared below, and every entry says which kind of dead it is and why. Wiring one reddens this file (delete its
// row). Adding a new uncalled kernel function reddens this file (justify it, or delete the function).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// The same facts lived in `docs/…/W1/evidence/hollow-kernel-triage.md` §4 and `docs/_working/dead-kernel-census.txt`,
// as hand-maintained prose. Between them they DRIFTED FOUR TIMES, each drift recorded in the documents themselves:
// `canResumeExecutionOnPwu` listed as deferred after it was wired; the M12 manifest certifying RPH-PWU-010 COVERED
// on the same stale reading; `bindingPermitsExecution` and `stepMayBecomeReady` listed as unenforced after both
// became ENFORCED; and the triage's own 2026-08-02 census finding its list "broadly accurate about the *world* and
// unreliable about *itself*". The triage then prescribed its own remedy — extend the enforcement register to the
// owning families, let the rows carry the deferrals, and retire the list — and recorded it as owed rather than done.
//
// THE PRECONDITION TURNED OUT NOT TO HOLD, which is why this file exists rather than a deletion. Measured
// 2026-08-03, with the register total over fifteen families: only 15 of the triage's 24 symbols are named by any
// register row. The register is total over RULES, and a kernel function that carries no ratified rule will never
// have a row — so retiring the list into the register alone would have DROPPED the rest on the floor. The two
// concerns are different: the register asks "is this RULE enforced", this asks "is this CODE reached".
//
// ── WHY "CALLED", NOT "MENTIONED" ────────────────────────────────────────────────────────────────────────────
// The derivation counts CALL SITES (`sym(`), not file mentions. A mention-based census — the algorithm the
// register's own `referencedOnlyBy` uses — reports a symbol as dead when its only use is a doc comment, and
// reports it as LIVE when a production file merely names it in prose. Both directions were observed here:
// `schemaLayerRuleIds` is called by `malformedSchemaMarkers` in its own file and a mention census called it dead;
// `classifyRefusal` is named in several production comments and called by none, and a mention census called it
// live. REG-F-016 is the same weakness biting a register row, one symbol further out.
//
// WHAT THIS CANNOT SEE, stated so the gate is not read as more than it is: reachability, not usefulness. A
// function called once from an unreachable branch counts as live here. And a symbol called only through dynamic
// dispatch would count as dead. Neither has been observed in this kernel; both are why each row still carries a
// reason a human wrote.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENFORCEMENT_REGISTER, type RegisteredRuleId } from '@janumipwb/rph-domain';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const KERNEL = 'packages/rph-domain/src';

type DeadKind =
	/** An analysis instrument the GATES call. Production calling it would mean the engine grading itself at runtime. */
	| 'GATE_HELPER'
	/** A live sibling path or a structural mechanism performs the same job; this implementation is superseded. */
	| 'DEAD_BY_DESIGN'
	/** Carries a ratified rule that the enforcement register discloses as enforced NOWHERE. `ruleId` is required. */
	| 'DISCLOSED'
	/** Belongs to a plane that does not exist yet; the triage deferred it to a named wave. */
	| 'DEFERRED'
	/** Not yet classified. A declared unknown, which is the honest alternative to a rationale nobody checked. */
	| 'UNTRIAGED';

interface DeadEntry {
	readonly kind: DeadKind;
	readonly why: string;
	readonly ruleId?: RegisteredRuleId;
}

/**
 * THE DECLARED CENSUS. Derived once, then justified by hand — the numbers are measured, the reasons are not.
 *
 * Where a reason comes from the hollow-kernel triage it is attributed, because that triage's classifications were
 * produced by an 8-agent adversarial pass with code-grounded evidence and re-verified on 2026-08-02. Inheriting
 * them is cheaper and more honest than re-deriving them badly here; what this file adds is that they can no
 * longer go stale without something turning red.
 */
const CENSUS: Readonly<Record<string, DeadEntry>> = {
	// ── GATE_HELPER (11) — the instruments this repository grades itself with ─────────────────────────────────
	// Every one is called by a gate test and by no handler, which is the CORRECT state: a production call would
	// mean the running engine consulting the conformance record about itself. They appear here because "dead in
	// production" is exactly what they should be, and a census that omitted them would be hiding its own tools.
	classifyRefusal: {
		kind: 'GATE_HELPER',
		why: 'The enforcement register\'s verdict function (KILLED / ADMITTED / WRONG_CODE / MASKED). Called by the two observation suites. It is also the clearest case for counting CALLS rather than mentions: several production comments name it, so a mention census reports it live.'
	},
	conflictStatusRuleIds: {
		kind: 'GATE_HELPER',
		why: 'Back-compat alias over rowsDeclaringRefusalStatus(\'CONFLICT\'), consumed by the register selftests.'
	},
	deadPredicateRuleIds: {
		kind: 'GATE_HELPER',
		why: 'Selects the rows guarded by a dead-predicate census, so the census gate can run per row.'
	},
	duplicateRefusalMarkers: {
		kind: 'GATE_HELPER',
		why: 'Marker distinctness — two rules sharing a refusal marker would let one mutant redden both.'
	},
	enforcedRuleIds: {
		kind: 'GATE_HELPER',
		why: 'The ENFORCED row set. Makes the WP-16 probe map TOTAL by type, which is what turns the register from a document into an instrument.'
	},
	layerOfTestFile: {
		kind: 'GATE_HELPER',
		why: 'Classifies a cited test file as KERNEL or COMMAND layer — the layer gate that refuses an ENFORCED claim resting on a pure-kernel test.'
	},
	malformedSchemaMarkers: {
		kind: 'GATE_HELPER',
		why: 'SCHEMA-layer markers must be `<issueCode>@<dottedPath>`; this finds ones that are not.'
	},
	observedAdmissionRuleIds: {
		kind: 'GATE_HELPER',
		why: 'The OBSERVED_ADMISSION row set, making the disclosure probe map total the same way enforcedRuleIds does for refusals.'
	},
	residualSourceStates: {
		kind: 'GATE_HELPER',
		why: 'The arrow census denominator: states the machine would admit into a command\'s target minus the states it declares. Widening a sourceStates set must be argued, not absorbed.'
	},
	shortRefusalMarkers: {
		kind: 'GATE_HELPER',
		why: 'Markers below MIN_REFUSAL_MARKER_LENGTH — a short marker matches too much and makes MASKED unreachable.'
	},
	citedConcreteTestFiles: {
		kind: 'GATE_HELPER',
		why: 'Every concrete test file the conformance manifest cites, so the gate can prove a COVERED claim points at a file that exists.'
	},
	stepCommandSpec: {
		kind: 'GATE_HELPER',
		why: 'Lookup over STEP_COMMAND_SPECS for the arrow-census suite. Handlers reach the specs through the record directly, not through this accessor.'
	},

	// ── DISCLOSED (4) — a ratified rule, enforced nowhere, and SAID SO in the register ────────────────────────
	// These are the only entries whose deadness is a defect the register already carries. Each `ruleId` is
	// cross-checked below against the register's own disposition, so this file cannot claim a disclosure the
	// register does not make.
	capabilityAuthorized: {
		kind: 'DISCLOSED',
		ruleId: 'RPH-EXE-004',
		why: 'Capability authorisation for a runtime binding. Its row records that wiring it would be the subject substitution the register exists to prevent, and carries an exit criterion rather than a date.'
	},
	classifyInterruptedAttempt: {
		kind: 'DISCLOSED',
		ruleId: 'RPH-PER-012',
		why: 'Classifies an interrupted execution attempt on recovery. No recovery path asks it.'
	},
	validateAssumptionReification: {
		kind: 'DISCLOSED',
		ruleId: 'RPH-ASM-002',
		why: 'Assumption reification. Blocked on an assumption-reification command surface that does not exist; recorded, not forced.'
	},
	blocksIrreversibleWork: {
		kind: 'DISCLOSED',
		ruleId: 'RPH-ASM-005',
		why: 'Whether an unresolved assumption blocks irreversible work. One of five dead predicates in a family whose Assumption.status has eight states and two commands.'
	},

	// ── DEAD_BY_DESIGN (12) — superseded, per the triage's §3 ─────────────────────────────────────────────────
	applyPresentationChange: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Presentation function. Triage §3: presentation/introspection helpers are not governance rules.'
	},
	isPresentationOnlyChange: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Presentation function, as above. The INV-6 semantic-version rule it relates to is enforced in the handlers by comparing raw payload fields.'
	},
	assertTransition: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Throwing wrapper over the transition check. Production uses the CommandResult-returning path (classifyTransition / canTransition) because a handler must refuse, never throw.'
	},
	initialStateOf: {
		kind: 'DEAD_BY_DESIGN',
		why: 'State-machine introspection. Handlers write their initial state through newEnvelope rather than asking the machine for it.'
	},
	isValidState: {
		kind: 'DEAD_BY_DESIGN',
		why: 'State-machine introspection; the transition check subsumes it — an invalid state cannot be a legal arrow source or target.'
	},

	machineNames: {
		kind: 'DEAD_BY_DESIGN',
		why: 'State-machine introspection over STATE_MACHINES, used by the transitions suite to iterate every machine.'
	},
	isTerminalStepState: {
		kind: 'DEAD_BY_DESIGN',
		why: 'One-line set membership beside isTerminalSuccessStepState, which IS live. The gate needs "terminal AND successful" for predecessor satisfaction; plain terminality has no caller. THE ONLY ENTRY IN THIS FILE WITH NO CONSUMER AT ALL — not even a test — so nothing anywhere would notice if it were wrong.'
	},
	assertBaselineItemSetImmutable: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Triage §3: superseded by structural enforcement — the Baseline freezes itemObjectVersions at CreateBaseline and no command rewrites them, so immutability is a property of the write path rather than a check.'
	},
	canSupersedeBaseline: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Triage §3: superseded by the live sibling path — supersession runs through the state machine\'s declared arrows.'
	},
	isEffectiveApproval: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Triage §3. RPH-GOV-002\'s row records this predicate as dead and explains why the ROW is arm 3 rather than a second ENFORCED claim: the effective-approval guard it duplicates is the one RPH-GOV-001 already claims, and two rows over one refusal site would let a single mutant redden both.'
	},
	waiverPreservesFindings: {
		kind: 'DEAD_BY_DESIGN',
		why: 'Triage §3. RPH-GOV-004\'s row records it dead — and records that the outcome it checks is not produced either: no command anywhere sets an AssuranceObservation.disposition to WAIVED.'
	},
	executionAloneSatisfiesAssurance: {
		kind: 'DEAD_BY_DESIGN',
		why: 'INV-5\'s negative form ("execution success is never assurance"). Enforced structurally instead: satisfaction reads the assurance axis directly, so there is no path on which execution success alone could be consulted.'
	},

	// ── DEFERRED (13) — a plane that does not exist yet, per the triage's §4 ──────────────────────────────────
	resolveIdempotency: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2 idempotency/recovery (WP-2-004/007). The bus implements replay directly — a duplicate key returns status DUPLICATE with the prior result — so this kernel form has no caller. REG-F-012 records the live gap in that bus path.'
	},
	attemptWouldDuplicateSideEffect: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2 recovery. Needs an attempt-level side-effect record the engine does not keep.'
	},
	mayReexecuteWithoutReconciliation: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2 recovery. Same missing attempt plane.'
	},
	assessDecisionRevocation: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2. RPH-GOV-007\'s row records something worse than deadness: it is a CONSTANT FUNCTION that ignores its argument and can never return half its own declared union, so its unit test cannot discriminate.'
	},
	assessAcceptance: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2. Acceptance assessment over a decomposition; no command surface produces its input.'
	},
	assessFalsification: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2. Falsification assessment; same missing surface as assessAcceptance.'
	},
	canStartStep: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3 execution harness (WP-3-005). The live start gate is canStartStepUnderPlan\'s wired sibling path; this bare form has no caller.'
	},
	canReuseBindingForNewAttempt: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3. Needs the attempt plane W2 defers.'
	},
	assessModelOutput: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3. JPWB hosts no tool or model invocation — the boundary RPH-EXE-004\'s row argues at length — so nothing produces model output to assess.'
	},
	selectControlAction: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3. Control-action selection belongs to a remediation controller that is not built.'
	},
	normalizeControlAction: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3. Normalises the legacy WAIVE action on ingest (REG-005 C-4); nothing ingests legacy actions.'
	},
	executionSuccessOutcome: {
		kind: 'DEFERRED',
		why: 'Triage §4, W3. Outcome classification for a completed step; the handler maps outcomes inline.'
	},
	impactedObjects: {
		kind: 'DEFERRED',
		why: 'Triage §4, W2/W3 traceability plane. Needs a TraceLink-minting command surface first — the plane W1 deliberately did not build (DEF-W1-002).'
	},

	// ── TRIAGED 2026-08-03 — this entry was UNTRIAGED for exactly one commit ──────────────────────────────────
	// It was carried as a declared unknown rather than given a rationale nobody checked, and the check changed
	// the answer twice. Kept as DEAD_BY_DESIGN rather than DISCLOSED because no register row names this symbol —
	// claiming otherwise would be this file inventing a disclosure, which the cross-check below exists to stop.
	controllerMarksPwuSatisfied: {
		kind: 'DEAD_BY_DESIGN',
		why: 'States the controller rule as a conjunction of three — execution SUCCEEDED, assurance SATISFIED, and openBlockingObservations === 0. Two limbs are enforced by other means: execution structurally (EXECUTING -> EVIDENCE_PENDING requires SUCCEEDED, and UNDER_ASSURANCE -> SATISFIED is the only arrow in) and assurance twice over (the cross-axis guard and satisfiesP1). The third has no reader and is INEXPRESSIBLE to the guard that would read it — PwuAxes has four fields and no observation count — but its subject matter is RPH-ASR-008 ("a critical open observation prevents aggregate assurance from being SATISFIED"), which the register already discloses UNENFORCED. The PWU-lifecycle admission is driven live in pwu.test.ts as a SECOND SITE for that row, with a canon-permitted BLOCKING control beside it. Reading ASR-10 as forbidding PWU-lifecycle satisfaction would be a subject substitution: its subject throughout is aggregate assurance.'
	}
};

/** Every non-test `.ts` under any package or app `src` tree. */
function productionSources(): string[] {
	const out: string[] = [];
	const walk = (abs: string, rel: string): void => {
		for (const entry of readdirSync(abs)) {
			const childAbs = `${abs}/${entry}`;
			const childRel = `${rel}/${entry}`;
			if (statSync(childAbs).isDirectory()) {
				if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
				walk(childAbs, childRel);
			} else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(childRel);
		}
	};
	for (const group of ['packages', 'apps']) {
		let names: string[];
		try {
			names = readdirSync(`${REPO_ROOT}${group}`);
		} catch {
			continue;
		}
		for (const pkg of names) {
			const src = `${REPO_ROOT}${group}/${pkg}/src`;
			try {
				if (!statSync(src).isDirectory()) continue;
			} catch {
				continue;
			}
			walk(src, `${group}/${pkg}/src`);
		}
	}
	return out;
}

/** Exported `export function` names declared in the kernel, mapped to their defining file. */
function kernelExports(files: readonly string[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const rel of files) {
		if (!rel.startsWith(KERNEL) || rel.endsWith('.data.ts') || rel.includes('/gen/')) continue;
		const text = readFileSync(`${REPO_ROOT}${rel}`, 'utf8');
		for (const m of text.matchAll(/^export function ([A-Za-z_$][\w$]*)/gm)) out.set(m[1]!, rel);
	}
	return out;
}

/** Symbols with NO call site in any production file other than their own declaration. */
function uncalledKernelExports(): string[] {
	const files = productionSources();
	const texts = new Map(files.map((rel) => [rel, readFileSync(`${REPO_ROOT}${rel}`, 'utf8')]));
	const exports = kernelExports(files);
	const uncalled: string[] = [];
	for (const [sym, home] of exports) {
		const declaration = `export function ${sym}`;
		const call = new RegExp(`\\b${sym}\\s*\\(`, 'g');
		let calls = 0;
		for (const [rel, text] of texts) {
			for (const m of text.matchAll(call)) {
				// the declaration itself is not a call site
				if (rel === home && text.startsWith(declaration, m.index - 'export function '.length))
					continue;
				calls += 1;
			}
		}
		if (calls === 0) uncalled.push(sym);
	}
	return uncalled.sort((a, b) => a.localeCompare(b));
}

describe('the dead-kernel census is DATA, not prose', () => {
	it('the uncalled kernel exports are EXACTLY the declared census', () => {
		const measured = uncalledKernelExports();
		const declared = Object.keys(CENSUS).sort((a, b) => a.localeCompare(b));
		// Both directions, reported separately, because the two failures mean opposite things and a reader
		// looking at a diff of two long arrays cannot tell which happened.
		const undeclared = measured.filter((s) => !(s in CENSUS));
		expect(
			undeclared,
			'NEW UNCALLED KERNEL EXPORT(S). Either wire them, delete them, or add a row saying which kind of dead ' +
				'they are and why — an unexplained dead kernel function is how the hollow-kernel census got to 55.'
		).toEqual([]);
		const wired = declared.filter((s) => !measured.includes(s));
		expect(
			wired,
			'DECLARED DEAD BUT NOW CALLED — this is the good failure, and the one the prose lists could never ' +
				'produce: the symbol has acquired a production call site. Delete its row here, and check whether a ' +
				'register row or conformance claim about the same rule is now stale too (REG-F-016).'
		).toEqual([]);
		expect(measured).toEqual(declared);
	});

	it('every entry says which kind of dead it is, and why', () => {
		for (const [sym, entry] of Object.entries(CENSUS)) {
			expect(entry.why.length, `${sym} needs a reason`).toBeGreaterThan(30);
			if (entry.kind === 'DISCLOSED')
				expect(entry.ruleId, `${sym} is DISCLOSED and must name its rule`).toBeDefined();
			else expect(entry.ruleId, `${sym} is ${entry.kind} and must not name a rule`).toBeUndefined();
		}
	});

	// The cross-check that stops this file inventing a disclosure. A DISCLOSED entry is a claim ABOUT THE
	// REGISTER, so the register is asked rather than trusted — the same reason the register's own rows carry
	// grep-checked call sites rather than sentences.
	it('every DISCLOSED entry names a rule the register really discloses, guarded by THIS symbol', () => {
		for (const [sym, entry] of Object.entries(CENSUS)) {
			if (entry.kind !== 'DISCLOSED') continue;
			const row = ENFORCEMENT_REGISTER[entry.ruleId!];
			expect(row, `${entry.ruleId} is not a registered rule`).toBeDefined();
			expect(row.kind, `${entry.ruleId} (cited by ${sym}) is not UNENFORCED_DISCLOSED`).toBe(
				'UNENFORCED_DISCLOSED'
			);
			if (row.kind !== 'UNENFORCED_DISCLOSED') continue;
			expect(
				row.guard.kind === 'DEAD_PREDICATE' ? row.guard.deadPredicate : undefined,
				`${entry.ruleId} does not census ${sym} — this file would be claiming a disclosure the register does not make`
			).toBe(sym);
		}
	});

	// THE CONTROL. Every assertion above is satisfied by a derivation that returns nothing, or everything: an
	// empty result makes `undeclared` empty, and the census is short enough that a broken regex could plausibly
	// return the whole export set. So the derivation is asked a question with a known answer in BOTH directions.
	it('CONTROL: the derivation discriminates — a wired kernel function is not reported dead', () => {
		const measured = uncalledKernelExports();
		expect(measured.length, 'the derivation found nothing at all').toBeGreaterThan(0);
		for (const live of [
			'waiverCovers', // called by floor-gate.ts
			'canPromoteBaseline', // called by handlers/governance.ts
			'decisionAuthorizesVersions', // called by handlers/governance.ts
			'validateObligationConservation' // called by handlers/decomposition.ts
		])
			expect(measured, `${live} has a production call site and must not be reported dead`).not.toContain(
				live
			);
		// and a function reached ONLY from inside its own module still counts as live — the false positive that a
		// mention-based census produces, and the reason this one counts calls.
		expect(
			measured,
			'schemaLayerRuleIds is called by malformedSchemaMarkers in its own file'
		).not.toContain('schemaLayerRuleIds');
	});
});
