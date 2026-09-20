// JAN-SLICE-SWP-04 — the subsumption gate: no working artifact may claim an item the Slice ledger now derives.
//
// ── WHY THIS GATE EXISTS, IN THE DESIGN'S OWN WORDS ──────────────────────────────────────────────────────────
// `SL-L4`, verbatim: *"JAN-SLICE MUST retire what it replaces. On each Slice's admission, every superseded
// roadmap or residual claim it covers MUST be struck in place — `~~old~~ **new**`, per the register's
// retire-by-striking idiom — and MUST NOT be deleted. **A JAN-SLICE that leaves the nineteen working roadmaps
// standing has become the twentieth**, and the programme SHALL be judged failed on that ground alone regardless
// of its test count."*
//
// The roadmap's own risk register (R-1) says the same thing about this work package specifically: it *"has no
// test forcing it and no feature to show"*, so it *"is the work package that will be skipped"* unless gated.
// This file is that gate. It exists because the obligation cannot enforce itself.
//
// ── WHAT COUNTS AS A SUPERSEDED CLAIM, STATED AS A PREDICATE RATHER THAN A JUDGEMENT ─────────────────────────
// A census artifact makes a LIVE claim about a ratified `RPH-E2E` rule when a line names that rule and is not
// struck. After `SWP-03` every one of those rules is asserted by a Slice, so any surviving hand-authored
// disposition of them is a second, unchecked answer to a question the ledger now derives — and the two can
// disagree with nothing to notice.
//
// ⚠ MENTIONING A RULE IS NOT THE OFFENCE; DISPOSING OF IT WITHOUT CITING THE DERIVATION IS. A line may name
// `RPH-E2E-006` freely — in a milestone's SCOPE column, in prose, in a design note. What it may not do is carry a
// STATUS for it (a ✅, a "delivered", a "deferred") while saying nothing about the Slice that now decides that
// status. So the predicate is: a line that names a rule AND carries a status marker MUST either be struck, or
// cite the ledger. That is narrow enough to be satisfiable by an honest edit and wide enough to catch the
// milestone rows that provoked this package.
//
// ── AND WHY THE CENSUS IS DERIVED FROM THE FILESYSTEM ────────────────────────────────────────────────────────
// A hand-written list of artifacts would rot the moment a twentieth roadmap appeared — which is the exact failure
// `SL-L4` is about. Worse, this programme has already made the hand-listing mistake in miniature three times in
// one session: a `RESIDUALS*.md` glob that missed `JAN-EXECREM-RESIDUALS.md`, a cancellation sweep that reported
// one hit where the concept net finds two, and an inventory pin that sat stale for two work packages. The census
// is globbed, and its non-emptiness is a CONTROL below.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Ratified rule ids the Slices now derive a disposition for. Derived, never listed. */
function derivedRuleIds(): string[] {
	const raw = readFileSync(`${ROOT}verif/slices/slice-ledger.baseline.json`, 'utf8');
	const rows = (JSON.parse(raw) as { rows?: { citedRules: string[] }[] }).rows ?? [];
	return [...new Set(rows.flatMap((r) => r.citedRules))].filter((id) => id.startsWith('RPH-E2E-'));
}

/**
 * The working-progress census: the artifacts `SL-L4` names.
 *
 * ⚠ CSAA's residual records are EXCLUDED BY NAME AND THE EXCLUSION IS DISCLOSED. `docs/ASTs and Code Analysis/`
 * holds `*Residual*` records belonging to another agent's programme; they make no claim about `RPH-E2E` and are
 * not this programme's to retire. Excluding them is a scoping decision, not an oversight — which is why it is
 * written here rather than achieved silently by a narrower glob.
 */
function census(): string[] {
	const working = readdirSync(`${ROOT}docs/_working`)
		.filter((f) => f.startsWith('ROADMAP-') && f.endsWith('.md'))
		.map((f) => `docs/_working/${f}`);
	return [
		...working,
		'docs/Command Precondition Legality/RESIDUALS.md',
		'docs/Execution Plan View Design and Implementation Planning/JAN-EXECREM-RESIDUALS.md',
		'docs/JPWB Implementation Roadmap and Tracker.md'
	];
}

/** A line carries a STATUS when it asserts a disposition rather than merely naming a subject. */
const STATUS_MARKER = /✅|❌|⚠️ done|\bDISCHARGED\b|\bDELIVERED\b|\bCOMPLETE\b|\bdeferred\b/i;

/** Struck text, the register's retire-by-striking idiom (`JPWB-REG-005:57`). */
const STRUCK = /~~/;

/** A line that points at the derivation is answerable to it, and is therefore not a second unchecked answer. */
const CITES_LEDGER = /JAN-SLICE|slice-ledger|LEDGER\.md|\.slice\.test\.ts|SWP-0[0-9]/;

interface Offence {
	readonly file: string;
	readonly line: number;
	readonly text: string;
}

function liveClaims(ruleIds: readonly string[]): Offence[] {
	const out: Offence[] = [];
	for (const rel of census()) {
		let text: string;
		try {
			text = readFileSync(`${ROOT}${rel}`, 'utf8');
		} catch {
			continue; // a census entry that has been renamed is caught by the control below, not silently skipped
		}
		text.split(/\r?\n/).forEach((line, i) => {
			if (!ruleIds.some((id) => line.includes(id))) return;
			if (!STATUS_MARKER.test(line)) return;
			if (STRUCK.test(line) || CITES_LEDGER.test(line)) return;
			out.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
		});
	}
	return out;
}

describe('SL-L4 — no working artifact claims an item the Slice ledger now derives', () => {
	it('CONTROL — the census is non-empty and every entry is readable', () => {
		// Without this the whole gate is vacuous: an empty census yields no offences and passes while measuring
		// nothing. The roadmap counted ~19 working roadmaps; fewer than that means the glob has drifted or files
		// were DELETED, which `SL-L4` forbids outright.
		const files = census();
		expect(files.length, 'the census must not be empty').toBeGreaterThanOrEqual(20);
		const unreadable = files.filter((rel) => {
			try {
				readFileSync(`${ROOT}${rel}`, 'utf8');
				return false;
			} catch {
				return true;
			}
		});
		expect(
			unreadable,
			`these census artifacts could not be read — SL-L4 forbids DELETING them, so a missing file is a finding, not a pass: ${unreadable.join(', ')}`
		).toEqual([]);
	});

	it('CONTROL — the ledger really yields the rules whose claims are being subsumed', () => {
		// The offence predicate is driven by `derivedRuleIds()`. If that returned nothing, `liveClaims` would find
		// nothing and this gate would go green over an unswept repository — the instrument failing exactly like
		// its subject, which this programme has already had happen once (the mutant driver reported all 41 inert
		// while reading one stale file).
		expect(
			derivedRuleIds().length,
			'the Slice ledger must yield the RPH-E2E rules whose dispositions it now derives'
		).toBeGreaterThan(0);
	});

	// ⚠⚠ THE ANTI-ACCUMULATION RATCHET, AND IT IS THE LIMB THAT MOST DIRECTLY EXPRESSES SL-L4. The obligation's
	// sharpest sentence is not about striking at all — it is *"A JAN-SLICE that leaves the nineteen working
	// roadmaps standing has become the twentieth"*. Striking claims is necessary; NOT ADDING A TWENTIETH is what
	// distinguishes this programme from its nineteen predecessors, and it is checkable where the striking is not.
	//
	// JAN-SLICE's own roadmap deliberately lives at `docs/Journey Slice Verification/`, NOT in `docs/_working/`,
	// precisely so that admitting it did not grow this population. That was a decision, and this is where it is
	// enforced rather than merely intended.
	//
	// ⚠ THIS PIN IS A RATCHET, NOT A PROHIBITION. A twentieth working roadmap may be legitimate — but it must be a
	// DELIBERATE act that edits this number and says why, not a file that appears and is noticed by nobody. That
	// is the whole content of finding F-7 ("the progress substrate is stale and multiplying"): nineteen of these
	// grew around a tracker whose own progress line had been wrong by a factor of 17 for seven weeks.
	it('the working-roadmap population has not grown — subsumption, not accumulation (SL-L4)', () => {
		const working = readdirSync(`${ROOT}docs/_working`).filter(
			(f) => f.startsWith('ROADMAP-') && f.endsWith('.md')
		);
		expect(
			working.length,
			`the working-roadmap population changed. SL-L4 makes ADDING one the failure mode this programme exists to end — if a twentieth is genuinely warranted, edit this number and record why. Present: ${working.sort().join(', ')}`
			// 19 -> 20 (2026-09-03): `ROADMAP-JAN-MXR-model-exchange-record.md`. ⚠ SL-L4 makes adding one the
			// failure mode this programme exists to end, so the warrant is stated rather than assumed: it
			// sequences work a SPONSOR RULING licensed on the day it was written (`REG-D-055`, resolving Guide
			// §16 item 23 for the exchange-record limb), and item 23's own instruction is a CONJUNCTION —
			// "registry, schemas, persistence, projections, fixtures, and conformance tests together" — which
			// is precisely the thing a roadmap exists to hold and a register entry cannot.
			// ⭑ IT SUBSUMES RATHER THAN ACCUMULATES, which is what SL-L4 actually asks: it absorbs the open
			// limbs of `JAN-ICP`'s `ICP-02`/`ICP-03` (the durable exchange record and the content/retention
			// seam), and it is bounded by an exit criterion that retires it rather than leaving it standing.
			//
			// 20 -> 21 (2026-09-04): `ROADMAP-exchange-resolution.md` (`JAN-MXREAD`). ⚠ THE WARRANT, STATED
			// RATHER THAN ASSUMED, and it is a different KIND from the twentieth. This one exists because its
			// design reaches a conclusion a register entry cannot enforce: `REG-F-244` remedy 3 blocks the
			// diagnostic read surface behind `REG-Q-056`, and the buildable remainder is a PAIR — a resolution
			// layer and its reader — with the rule "they ship together or neither ships". ⭑ That rule is the
			// whole point: shipped alone the resolution layer would be the hollow governed layer this
			// repository has recorded against itself repeatedly, and a rule binding two stages across one
			// commit is exactly what a roadmap holds and an entry does not.
			// ⭑ IT SUBSUMES: it closes the read half of `REG-F-245` (b′) — *"the system records WHERE an
			// artifact's content lives and never once resolves it"* — rather than opening a new front, and its
			// exit criterion (a non-test caller, verified with a positive control) retires it.
			//
			// 21 -> 22 (2026-09-04): `ROADMAP-prompt-template-and-context.md` (`JAN-PROMPT`). ⚠ THE WARRANT IS
			// THE SPONSOR'S OWN DIAGNOSIS, not a programme's convenience: *"a PWU is an agent with a prompt
			// template and relevant context … none of that existed in reality. So a PWA actually could not truly
			// run and do real work."* Measured and correct — every object definition searched for a
			// prompt/template/context field returned TWO hits and neither was a template. `REG-D-058` (sponsor)
			// then ruled the ownership axis, and item-23-style discipline applies: schema, handler, render guard,
			// surface and conformance move together or the field is a governed thing with no screen — which is
			// the defect being fixed, so shipping it that way would be self-refuting.
			// ⭑ IT SUBSUMES: canon already ratifies most of the hard half (DEC-1 puts rendering at the STEP,
			// ASR-4 makes a prompt a runtime asset rather than meaning, DEC-4 governs context assembly
			// exhaustively), so this roadmap builds CARRIERS for existing rules rather than opening a front —
			// and its exit criterion is a browser spec that reads a stored prompt back.
			//
			// 22 -> 23 (2026-09-05): `ROADMAP-model-invocation-step.md` (`JAN-EXECRUN`). ⭑ THE WARRANT IS A
			// REFUTATION, which is why it is a roadmap and not a ticket. An audit of this repository reported
			// that the system *"governs plans and hosts no tool invocation"* and recommended the sponsor rule on
			// whether that boundary still holds. Searched at HEAD, the corpus says the OPPOSITE: Guide `:1137`
			// defines an Execution Step AS *"model/tool invocation, retrieval, transformation…"*, and
			// `StepTypeSchema`'s FIRST member is `MODEL_INVOCATION`. `"hosts no"`, `"platform layer"`,
			// `"no tool invocation"` → 0 across DOC-003, the Guide and the register (control: `"execution"` →
			// 26 / 118). The caller was unbuilt, never forbidden — and a paraphrase would have cost a sponsor
			// round-trip.
			// ⭑ IT SUBSUMES: it is the CALLER `DESIGN-prompt-template-and-context.md` §4 named as owed by a
			// separate increment, and it writes to the `EXECUTION` plane that `REG-D-055` created and nothing
			// has ever used. Its exit criterion is a work unit that runs.
			//
			// 23 -> 24 (2026-09-05): `ROADMAP-work-discharge-declaration.md` (`JAN-DISCHARGE`). ⭑ THE WARRANT IS
			// A DEFECT THE PREVIOUS ROADMAP CREATED, which is why it is separate rather than folded in.
			// `JAN-EXECRUN` made "a model does this work" sayable, and thereby made ONE SILENCE stand for three
			// different facts: a person does it, a model does it, or nobody has decided. A professional could
			// not tell an unfinished type from a deliberately human one — the same shape as "a reader cannot
			// tell 'purged on schedule' from 'never stored' from 'lost'", arriving on the authoring plane.
			// ⭑ IT SUBSUMES: it makes the execute button read a DECLARATION instead of sniffing whether a
			// prompt happens to be armed, and its exit criterion is a visible open question rather than an
			// invisible gap.
			//
			// 24 -> 25 (2026-09-05): `ROADMAP-reasoning-review-over-work-products.md` (`JAN-EXECREVIEW`). ⭑ THE
			// WARRANT IS THAT `REG-F-352` LEFT THE FLOOR ABLE TO REFUSE AND UNABLE TO SATISFY: a model-executed
			// work unit could run, produce a work product, and never complete. A roadmap rather than a ticket
			// because the design's own §4 records a SCOPE JUDGEMENT — the deterministic facts are hours and the
			// reviewer is the part that decides whether "assured" means anything, so the two must not be
			// conflated by whoever picks this up.
			// ⭑ IT SUBSUMES: it reuses the floor validators, the remediation classifier and the recording plan
			// unchanged — three things measured subject-agnostic — and adds no second classifier. Its exit
			// criterion is a floor that RUNS over an artifact and says WHY it blocks.
			//
			// 25 -> 26 (2026-09-05): `ROADMAP-work-product-reviewer.md` (`JAN-WPREVIEW`). ⭑ THE LAST PIECE, and
			// a roadmap rather than a ticket because its design exists to FORBID a shortcut its own predecessor
			// named: `REG-F-355`'s e2e records the mutant as *"teach the offline reviewer to pass any parseable
			// work product, at which point 'assured' would mean a JSON parse."* A stage list that did not carry
			// that constraint would invite exactly it.
			// ⭑ IT SUBSUMES AND TERMINATES: it adds one arm to an existing validator (no second validator, no
			// new policy, no invented criterion ids — both are read from the policy), and its exit criterion is
			// a model-executed work unit reaching COMPLETED with its output assured. That closes the chain
			// REG-D-058 opened, so nothing follows it in this line.
			//
			// 26 -> 27 (2026-09-05): `ROADMAP-backing-agent-tool-suite.md` (`JAN-TOOLSUITE`). ⚠ AND IT REOPENS
			// THE LINE THE ENTRY ABOVE CALLED TERMINATED, which is the honest reading rather than a
			// contradiction: `JAN-WPREVIEW` closed the chain `REG-D-058` opened — a work unit runs, is reviewed,
			// completes — while leaving the review NON-INDEPENDENT, because the executor read the ASSURANCE
			// model `JPWB_JUDGE_MODEL` and producer and reviewer were the same model BY CONSTRUCTION.
			// ⭑ A ROADMAP RATHER THAN A TICKET FOR THE USUAL REASON: its design exists to FORBID shortcuts the
			// register already names. `REG-D-052` forbids an application-default model (`REG-F-331`: a pinned
			// label rotted and every review failed); `REG-F-353` forbids naming a tool on `PWU_TYPE`; and
			// `REG-D-048` requires `ModelSelectionPolicy` be answered or DEFERRED EXPLICITLY. A stage list that
			// did not carry those would invite all three.
			// ⭑ IT SUBSUMES: no new policy, no new ratified enum member (of the 100 closed enums NOT ONE names
			// a tool or vendor, and `PER-2` would make a deployment fact permanent), and no change to `agyPrint`
			// — it reaches two ratified slots that had never been reachable, `evidence: PROVIDER_REPORTED` and
			// `ActorRef.providerId` on the producer.
			//
			// 27 -> 28 (2026-09-05): `ROADMAP-live-execution-lane.md` (`JAN-LIVEEXEC`). ⭑ A ROADMAP BECAUSE ITS
			// FIRST TWO UNITS ARE DEFECT FIXES WITH MUTANTS, not lane plumbing: the executor's mock-vs-real
			// switch was still the ASSURANCE env var, and the reviewer was told every subject was "a canonical
			// graph export" — false of a work product, and a review conducted on a false account of its own
			// subject is worse than none because it is RECORDED as one.
			// ⭑ IT SUBSUMES AND TERMINATES A LINE THE GATES COULD NOT REACH: it added no policy and no vocabulary,
			// and its exit is an OBSERVATION rather than a green tick — the lane exists to say whether the
			// reviewer is any good, which no deterministic gate can answer.
			//
			// 28 -> 29 (2026-09-05): `ROADMAP-execution-rationale.md` (`JAN-EXECRAT`). ⚠ FILED ON A SPONSOR
			// RULING (`REG-D-060`) that arrived from a LIVE run, not from planning: GLM-5.2 rejected a real work
			// product for omitting the §9.7 rationale, and the rejection landed on an incoherence this programme
			// had introduced — an executor prompt that said *"do not explain your reasoning."*
			// ⭑ A roadmap rather than a ticket because its design exists to FORBID two shortcuts the register
			// already names: `REG-D-058` forbids putting the requirement in the TYPE's template (it is owned by
			// the type), and §9.7 forbids SYNTHESIZING a rationale when none was declared — *"a contract
			// shortfall to record, never an absence to infer from."* A stage list without those invites both.
			//
			// ⚠ AND THE 28th WAS ADDED WITHOUT THIS RATCHET BEING RUN. `JAN-LIVEEXEC` was gated on check-types,
			// lint, vitest and playwright — not on `verif` — so it landed red here and stayed red until the next
			// slice happened to run the full gate. The full gate is all five, and running four of them is how a
			// ratchet dies quietly.
			//
			// 29 -> 30 (2026-09-05): `ROADMAP-execution-feedback-loop.md` (`JAN-EXECLOOP`). ⭑ NOT A NEW LINE —
			// it is the increment `REG-D-059` LICENSED AND LEFT OPEN, and that entry named both the gap and the
			// order: *"three of the four parts exist … What is missing is the LOOP — a bound greater than one,
			// and the classification that decides when to stop"*, to be built *"after the reasoning review over
			// work products"*, which landed in `REG-F-355`/`356`. Filing it as a roadmap rather than a ticket is
			// what the ruling asked for.
			// ⭑ IT SUBSUMES: no new policy, no new vocabulary, and THREE STATES rather than the sibling
			// monitor's four — `SCOPE_BLIND` keys on tool-call history and a JPWB execution step invokes no
			// tools, so porting it would ship a check that CANNOT FAIL.
			//
			// 30 -> 31 (2026-09-06): `ROADMAP-producer-session-per-work-unit.md` (`JAN-EXECSESS`). ⭑ IT CLOSES A
			// GAP THE PREVIOUS SLICE NAMED AND DID NOT FIX: `JAN-EXECLOOP` put the loop's state on the producer
			// — correctly — but delivered it as a PROMPT SPLICE into a fresh ephemeral session, so the producer
			// could not reason about how it had responded. The sponsor supplied the mechanism from JanumiCode v2:
			// *"the CLI session wasn't closed or released until the phase or sub-phase completed."*
			// ⭑ IT SUBSUMES: no new policy and no new vocabulary — the seam changes SHAPE (one-shot call to
			// turn-taking session) because a one-shot call has nowhere for a second turn to land, and the two
			// memoryless tools declare `retainsHistory: false` rather than being retrofitted with a capability
			// they do not have.
			//
			// 31 -> 32 (2026-09-06): `ROADMAP-context-assembly-policy.md` (`JAN-CTXPOL`, roadmap `ICP-04`). ⭑ IT IS
			// A ROADMAP THAT STARTS BLOCKED, AND THAT IS ITS POINT. The corpus declares `contextAssemblyPolicyId`
			// (Canonical Domain Model :1329; Persistence :889) and NEVER defines the object it names — a bare
			// service list is the closest it comes. Minting `CONTEXT_ASSEMBLY_POLICY` is therefore a RATIFICATION
			// act, and every unit is gated on the sponsor grant rather than started and then paused.
			// ⭑ IT SUBSUMES: the `fate` vocabulary is `DEC-4`'s five, ADOPTED not derived, and volunteered
			// reasoning gets NO element kind because `REG-Q-077` is open — the slot must not exist before the
			// permission.
			//
			// 32 -> 33 (2026-09-06): `ROADMAP-assurance-reported-identity.md` (`JAN-ASRIDENT`). ⭑ NOT A NEW LINE
			// — it DISCHARGES the item this register left standing open in its own last paragraph: *"the reviewer
			// still records `HOST_CONFIGURED` while the suite declares Devin `PROVIDER_REPORTED`:
			// `readReportedModel` … is never called, because the assurance seam still returns a bare string
			// exactly as the execution seam did before `TS-04`."* A named, dated, already-recorded debt, paid.
			// ⭑ IT SUBSUMES: no new policy, no new vocabulary, and NO NEW TYPE — `ToolInvocationResult` and
			// `isToolInvocationResult` already exist for the execution seam, and this is their SECOND consumer.
			// The obligation is `ASR-4` (`DOC-003:253`, *"whose actual identities and lineage are recorded"*) and
			// `PER-9` (`:369`, *"actually invoked"*), both ratified before this slice.
			// ⚠ AND IT DELIBERATELY DOES NOT TAKE `materializedInput` for the assurance plane: the ATIF export
			// carries the model, not the composed input, so claiming an E-1 composite from it would be a
			// fabricated measurement.
			//
			// 33 -> 34 (2026-09-06): `ROADMAP-output-contract-reaches-the-work.md` (`JAN-OUTCONTRACT`). ⭑ NOT A
			// NEW LINE — it keeps a promise this system ALREADY MAKES IN WRITING to every model it invokes.
			// `EXECUTION_CONTRACT_PROMPT` opens *"You will be given an instruction that states the work and the
			// exact output it requires"*, and `PromptTemplate.outputContract` — the field where a professional
			// declares exactly that — was authored through the PWA Designer, stored on the type, and read by NO
			// code on ANY path. CONTROL that this is a field left off a working conveyor rather than a missing
			// capability: `expectedOutputs` travels the same route and arrives.
			// ⭑ IT SUBSUMES: no new vocabulary, no new field, and — after measurement — HALF THE ROADMAP WAS
			// WITHDRAWN. `OC-02` was drafted as a second `ReasoningReviewInput.outputContract`; tracing the chain
			// showed the reviewer ALREADY receives the contract inside the instruction it is handed, so the
			// field would have been `REG-F-353`'s *"a second way to say one thing"* — with a concrete
			// disagreement available, since nothing would say which of the two wins.
			//
			// 34 -> 35 (2026-09-07): `ROADMAP-applicability-subject-projection.md` (`JAN-APPLSUBJ`). ⭑ NOT A NEW
			// LINE — it repairs the SUPPLY to a reader that already works. `RISK_AT_LEAST` resolves
			// `$.riskProfile` and is correct; both production callers hand-built `{objectType, pwuKind?, tags?}`
			// and dropped the field INDEPENDENTLY, so the operator read `false` for every subject — including
			// PWUs, where `riskProfile` is REQUIRED and stored.
			// ⭑ IT SUBSUMES: no vocabulary, no new field, no ratified meaning changed, and a NET SIMPLIFICATION —
			// two inline projections collapse into one `applicabilitySubjectFrom` beside the type it produces, so
			// the next field added to `ApplicabilitySubject` reaches every caller or none.
			// ⚠ AND ITS SCOPE IS SMALLER THAN THE TRIAGE THAT SURFACED IT CLAIMED. *"Every risk-gated policy is
			// silently excluded"* is NOT established: `RISK_AT_LEAST` occurs in production nowhere, seeded
			// policies carry no `expression`, and the HIGH_ASSURANCE "risk gate" is PROSE inside an
			// `appliesToRisk` description string. A primed trap pinned before it is stepped in — not live
			// suppression.
			// ⛔ AND `riskConditions` IS NOT WIRED: the kernel already discloses it as an ACTIVATION condition
			// (§5.3), not a SCOPE condition, and its element type is *"NAMED by §5.1 and DEFINED NOWHERE in the
			// corpus"*.
			//
			// 35 -> 36 (2026-09-07): `ROADMAP-disposition-rule-independence.md` (`JAN-DISPIND`). ⭑ NOT A NEW LINE
			// — it discharges an item `limb:ASR-2:6` records as OWED in terms: *"The
			// `DispositionRule.requiredIndependence` hole is NOT filed and is owed a REG-F finding: a policy may
			// demand independence for a specific disposition and no code reads the field, so the demand is
			// inert."* The observation was already DRIVEN at that row's `L4e`.
			// ⭑ IT SUBSUMES: no vocabulary, no new field, no new gate — the demand joins the independence check
			// that already exists, matched by the same predicate Gate C uses so two gates cannot select different
			// rules from one array.
			// ⛔ AND IT CORRECTS THE RECORDED REMEDY. That row said *"take the STRONGEST of the policy-level
			// requirement and any matched rule's demand"*; there is no strongest. `checkIndependence` is a flat
			// switch of SINGLE-DIMENSION equality tests — the same fact `REG-F-357` recorded when it refuted
			// *"DIFFERENT_PROVIDER is a stronger rung"* — so ranking two orthogonal demands DROPS one. They are
			// CONJOINED, and a mutant implementing "strongest" reddens two tests.
			// ⚠ IT DOES NOT CLOSE THE `producer`-OMISSION DODGE, which is DELIBERATE, REASONED AND PINNED
			// (`assurance-independence.test.ts:298`, *"the chosen gate"*). Overturning it turns on whether
			// UNVERIFIED counts as NOT SATISFIED under §8.4 — a sponsor question, with both readings recorded.
			//
			// 36 -> 37 (2026-09-08): `ROADMAP-execution-governance-layer.md` (`JAN-EXECGOV`). ⭑ ADDED AT SPONSOR
			// DIRECTION — *"This needs to be addressed holistically and systemically … and not just a point fix
			// while the wider issue remains unaddressed."* Four slices this week each wired ONE unread carrier;
			// this measures the whole layer (142 declared fields across four surfaces, plus canon) so the next
			// move is chosen rather than stumbled into.
			// ⭑⭑ AND ITS PRINCIPAL FINDING IS A RESTRAINT, WHICH IS WHY IT SUBSUMES RATHER THAN ACCUMULATES.
			// Exactly ONE ratified rule is unmet — `STA-8`, *"Execution requires an approved plan and authorized
			// Runtime Bindings"*, against ZERO production dispatches of `RequestRuntimeBinding` (control:
			// `ApproveExecutionPlan` → 4). Everything else in the layer is DELIBERATELY OPEN: `modelSelectionPolicy`
			// is configuration by `REG-D-052`, its shape is an explicit `REG-D-048` deferral, declared-vs-resolved
			// model identity is NOT a rule canon makes, and the activation-condition carriers are a disclosed
			// deferral with types the corpus never defines. Wiring those would be an implementer inventing
			// governance — so this roadmap's larger half is a list of what NOT to build.
			// ⛔ ITS BUILD UNITS ARE GATED on sponsor decision `G-1`: minting a RUNTIME_BINDING requires naming a
			// capability, capabilities are free strings the corpus never defines, and naming one is a ratification
			// act the schema will not stop.
			//
			// 37 -> 38 (2026-09-09): `ROADMAP-csaa-decoupling.md` (`JAN-CSAADEC`). ⭑ ADDED AT SPONSOR DIRECTION —
			// *"I'm going to look to decoupling CSAA from the build process because it is currently not providing
			// any (overt) value but generates a lot of recurrent build related updates"*, then narrowed: *"by
			// decoupling CSAA, I didn't mean deleting it, in part or in whole. Rather just removing the coupling
			// to the test suite running"*.
			// ⭑⭑ IT SUBSUMES BECAUSE IT IS A SUBTRACTION, NOT A LINE OF WORK. No vocabulary, no new field, no new
			// governed object, no new gate over the product. Its whole effect is to stop 185 CSAA test files being
			// obliged to run on every product commit, and to move three — `inventory/inventory.test.ts`,
			// `subject/subject.test.ts`, `providers/runtime/project-hybrid-static-prerequisites.test.ts` — into a
			// lane that is not the default gate. Those three assert over the LIVE WORKBENCH TREE; nothing else in
			// the package does.
			// ⛔ AND IT EXISTS PARTLY TO REPAIR A BREACH OF THIS REPOSITORY'S OWN SEQUENCE. `CD-01`/`CD-02` landed
			// in `4e0df056` with no design document, no roadmap and no register entry — delegated sub-agents went
			// from a conversational brief straight to code. The roadmap records them as LANDED-BEFORE-DOCUMENTED
			// rather than back-dating them into order, so a roadmap that regularises existing work is the opposite
			// of an accumulated one.
			// ⚠ AND THE HONEST NOTE, BECAUSE THIS ASSERTION IS THE SAME CLASS OF INSTRUMENT THE PROGRAMME IS
			// DECOUPLING: `SL-L4` is a hard-coded population count over the repository, exactly like the CSAA pins.
			// The difference is not the shape, it is the reliance — this one caught the addition on the first run
			// and its message named the remedy, while the CSAA pins drifted through six consecutive programmes
			// unnoticed. A pin is gate material when someone reads it; `CD-00b` measured that nobody read those.
			//
			// 38 -> 39 (2026-09-11): `ROADMAP-csaa-extraction.md`, `JAN-CSAAEXT`. RECORDED, NOT FOLDED, because
			// this assertion's whole point is that adding a roadmap must be argued for rather than absorbed.
			// ⭑ IT IS SUBSUMPTION, NOT ACCUMULATION, AND THE TEST IS THAT SOMETHING IS RETIRED BY IT.
			// `ROADMAP-csaa-decoupling.md` — one entry above it in this very list — already carries a WITHDRAWN
			// banner (`REG-F-381`, commit `1e626500`): its mechanism excluded three CSAA test files into a
			// separate vitest config and was reverted whole. `JAN-CSAAEXT` is not a second attempt at that
			// programme; it is the programme that DISSOLVES it, because the sponsor's ruling that CSAA is not
			// part of JPWB retires the premise `JAN-CSAADEC` was fighting on. The withdrawn roadmap stays on
			// disk per the repository's retire-by-striking rule, so the COUNT rises while the live population
			// does not — which is exactly the case this comment block exists to distinguish.
			// ⚠ AND THE NOTE ABOVE NOW HAS A SECOND CONFIRMATION, WHICH IS WHY IT IS WORTH KEEPING. This
			// addition was ALSO caught on the first unfiltered run, and its message named the remedy again. Two
			// for two on reliance; the CSAA pins are still nought for six.
			//
			// 39 -> 40 (2026-09-12): `ROADMAP-per-file-coverage-floor.md` (`JAN-PFCOV`). ⛔ IT IS ADDED ALREADY
			// STRUCK, AND THAT IS THE WHOLE WARRANT. It was superseded before a single step was built, and it is
			// retained rather than deleted for the reason `ROADMAP-csaa-decoupling.md` was: the repository retires
			// by striking, so **the COUNT rises while the live population does not** — the exact case the comment
			// block above exists to distinguish. Its `S1`-`S5` are carried into `JAN-PFA` Phase 1 unchanged, so
			// nothing it planned is lost and nothing it planned is pending twice.
			//
			// 40 -> 41 (2026-09-12): `ROADMAP-per-file-assurance-floor.md` (`JAN-PFA`). ⭑ IT SUBSUMES ITS OWN
			// PREDECESSOR, which is why the pair lands together rather than the first being quietly dropped.
			// `JAN-PFCOV` ratcheted ONE instrument; measurement then established that coverage and the mutation
			// ledger are aimed at NEARLY DISJOINT populations — 1,439 of the 1,663 branches in unmutated files are
			// COVERED — so a coverage-only roadmap could never have reached them. One design, three phases, so the
			// mutation half cannot quietly drop once the coverage half lands and the headline number improves.
			// ⚠ THE RELIANCE NOTE IS NOW THREE FOR THREE, AND THE THIRD CATCH WAS THE AUTHOR'S OWN. This pin
			// reddened on an untracked working draft that no commit had ever seen — i.e. it caught an addition
			// during the drafting of the very programme that is arguing about assurance floors. A pin is gate
			// material when someone reads it; this one keeps being read because it keeps being right.
			//
			// 41 -> 42 (2026-09-14): `ROADMAP-undertaking-execution-sandbox.md` (`JAN-EXEC`). ⭑ THE SUBSUMPTION
			// QUESTION WAS ASKED OF FIVE CANDIDATES BEFORE THIS NUMBER MOVED, because four of them are execution
			// roadmaps and the honest default was that one should absorb it.
			//   · `JAN-EXECGOV` (execution governance layer) is the closest and the answer is COMPLEMENT, not
			//     duplicate: it AUTHORIZES what a step may do (`RUNTIME_BINDING`, `STA-8`, the capability grant);
			//     this AUTHORISES NOTHING and instead gives the step HANDS (a workspace port, a process runner,
			//     the evidence join). Its `EG-01`-`EG-05` are landed, so folding new scope into a finished
			//     roadmap would hide pending work inside a completed one - the failure this pin exists to catch,
			//     wearing the opposite costume.
			//   · `live-execution-lane`, `model-invocation-step`, `execution-feedback-loop` and
			//     `backing-agent-tool-suite` brought the live lane into being - Pi produces, Devin reviews. NONE
			//     gives the producer filesystem or process access. MEASURED, not assumed: the execution session
			//     is opened `noTools: 'builtin', customTools: []`, and a live probe asking it to write a file and
			//     run a command returned `NO_TOOLS_AVAILABLE` with the file absent from disk.
			// ⭐ AND ONE THING THE CHECK ITSELF PRODUCED, WHICH IS THE ARGUMENT FOR KEEPING IT: asking the question
			// found that `JAN-EXECGOV`'s `G-1` grant - *"one capability per step type that a model invocation
			// actually needs, named in the vocabulary with its note"* - ALREADY COVERS naming the process-execution
			// capability. The new roadmap had it filed as ratification OWED. It is instead an application of a
			// grant already made, and only this pin's question surfaced that.
			//
			// 42 -> 43 (2026-09-20): `ROADMAP-no-answer-is-not-an-answer.md` (`JAN-NOANS`). ⭑ THE SUBSUMPTION
			// QUESTION WAS ASKED OF THE FOUR NEAREST, and three of them are closer than anything was last time
			// — this touches `run-model-step.ts`, the adapters, and the exchange record's own vocabulary.
			//   · `JAN-EXECRUN` (model invocation step) OWNS the file the third arm lands in, and the answer is
			//     still COMPLEMENT: its `XR-01`-`XR-04` build a step that RUNS a model and records the try. This
			//     one is about what the record may SAY when no model ran. Its stages are landed, so folding
			//     pending work into it would hide that work inside a completed roadmap — the failure this pin
			//     exists to catch, which `41 -> 42` already had to refuse once.
			//   · `JAN-MXR` (the durable exchange record) is the one that MINTED `EMPTY_RESPONSE` and
			//     `NO_RESPONSE`, so it has the best claim of the four. ⛔ AND THAT IS PRECISELY WHY IT MUST NOT
			//     ABSORB THIS. `JAN-MXR` shipped the members; `REG-F-410` is that NOTHING COULD REACH THEM for
			//     the six months since. Filing the reachability defect inside the roadmap that declared the
			//     vocabulary complete would put the evidence of a gap inside the document whose completion
			//     claim the gap refutes.
			//   · `JAN-TOOLSUITE` (the backing tools) owns the two adapters that must change, and `JAN-LIVEEXEC`
			//     owns the lane that MEASURED the defect. Both are landed; both are the same completed-roadmap
			//     objection.
			// ⭐ AND ASKING PRODUCED SOMETHING AGAIN, WHICH IS THE ARGUMENT FOR THE PIN. `JAN-TOOLSUITE`'s own
			// `TS-04` widened the seam from `print: (prompt) => Promise<string>` to a result that could REPORT
			// WHO ANSWERED — and it widened every field EXCEPT the answer, which stayed a bare `string`. So the
			// shape `REG-F-410` turns on is a residue of a widening that was already performed once, for the
			// same reason, on the same interface. That belongs in this roadmap's argument and was not in it.
			//
			// 43 -> 44 (2026-09-20): `ROADMAP-the-cast-that-disabled-its-own-gate.md` (`JAN-ASSERTED`). ⭑ TWO
			// CANDIDATES ARE CLOSER THAN ANY PREVIOUS PAIR, and both had to be refused on the SAME ground.
			//   · `JAN-PROMPT` owns the rule this programme restores — sponsor default #2 of 2026-09-04 under
			//     `REG-D-058`: *“A missing declared placeholder at render time is a REFUSAL, not a disclosed
			//     gap.”* It is the closest claim anything has had. ⛔ REFUSED because it is LANDED, and folding
			//     pending work into a completed roadmap is the failure this pin exists to catch — the objection
			//     `41 -> 42` and `42 -> 43` each had to make once already.
			//   · `JAN-OUTCONTRACT` owns `outputContract`, the channel that makes `R29` cost nothing: the
			//     producer is still told what output is required after `{expectedOutputs}` stops being supplied.
			//     Also landed; same objection.
			// ⭐⭐ AND ASKING PRODUCED THE FACT THAT REFRAMED THE WHOLE PROGRAMME, which is now the third time
			// running. `AS-03` reads as new policy — *“stop supplying a placeholder”* — and it is not: the
			// sponsor RATIFIED that refusal two weeks ago, `prompt-render.ts` implements it, and
			// `execution-invocation.test.ts:79-86` pins it GREEN. A `?? []` in a route turned ABSENT into
			// PRESENT-BUT-EMPTY and made all three unreachable at the only production call site. ⭑ The design
			// said “mint a rule” until this question was asked; it now says “restore one”, which is a different
			// programme with a different burden of proof.
			//
			// 44 -> 45 (2026-09-20): `ROADMAP-the-fixtures-a-ruling-orphaned.md` (`JAN-ORPHANED`). ⭑ THE NEAREST
			// CANDIDATE IS THE RULING THAT CAUSED IT, WHICH IS A NEW SHAPE FOR THIS PIN.
			//   · `JAN-EXEC` Phase 7c carries `R26`, the ruling that re-meant these fixtures. ⛔ REFUSED, and not
			//     on the usual “already landed” ground: Phase 7c is still OPEN. The reason is different and
			//     stronger — a ruling's own programme is the WORST place to record the collateral that ruling
			//     caused, because the entry that says *“this was the right call”* would also be the entry that
			//     says what it broke, and a reader auditing the cost would have to take the ruling's word for it.
			//   · `JAN-PFA` owns the ratchets and `JAN-VERIF` the mutation ledger; `OR-04` touches a ledger entry
			//     but only to annotate an entry whose predicted red was unobservable. Neither owns the fixtures.
			// ⭐ AND ASKING PRODUCED THE FRAMING AGAIN: this programme is not “fix eleven red tests”. It is
			// *a ruling changed what an arrangement MEANT, and nothing re-read the arrangements* — the `R26` commit
			// touched seven files and no fixture among them. That is a general hazard about rulings, not a local
			// defect about tests, and it belongs in its own entry where the next ruling's author will find it.
			//
			// 45 -> 46 (2026-09-20): `ROADMAP-the-criterion-results-nobody-reads.md` (`JAN-CRITREAD`). ⭑ THE
			// SUBSUMPTION QUESTION HAS A DIFFERENT SHAPE AGAIN: the nearest claimant is not a roadmap but the
			// ENFORCEMENT REGISTER, which already carries all three rules as rows.
			//   · `RPH-ASR-004`/`005`/`CON-005` are registered `UNENFORCED_DISCLOSED` with driven admissions. ⛔ A
			//     register ROW is a disposition, not a plan: it records that a rule is unenforced and why, and it
			//     has no place to sequence the work, name predicted reds, or bound a partial remedy. Folding the
			//     plan into the row would put a roadmap inside an append-only ledger.
			//   · `JAN-EXEC` Phase 7c carries `R26`, which closed the FLOOR limb of exactly this defect. Refused for
			//     `REG-D-066`'s reason, now measured a second time: the ruling's own programme is the worst place to
			//     record what the ruling did NOT reach.
			// ⭐ AND ASKING PRODUCED THE DECOMPOSITION THAT IS THIS DESIGN'S WHOLE VALUE. Asking *which roadmap
			// already owns this* forced reading all three rows together — and the three turn out to be ONE absence
			// seen from three sides, of which only the floor-path third needs a ratification. I had costed it as a
			// single contract change plus a ruling; it is three limbs and two of them need neither.
			// 
			// 46 -> 47 (2026-09-20): `ROADMAP-the-command-nobody-built.md` (`JAN-CRITREAD` L3). ⭑ THE
			// NEAREST CLAIMANT IS A ROADMAP THAT IS ALREADY COMPLETE, AND CHECKING WHY IT DID NOT COVER THIS IS
			// WHAT MADE THE SCOPE HONEST.
			//   · `ROADMAP-assessment-lifecycle-restoration.md` is the real candidate: its DESIGN names
			//     `recordCriterionResult` by name as one of the unbuilt §32 commands, cites its §32 line, and
			//     settles two questions this work inherits rather than re-deriving — that §32 carries *“no
			//     exhaustiveness clause and no rule that each listed command be its own dispatch”*, and what the
			//     dispatch multiplier costs. ⛔ But it is **COMPLETE** (`REG-F-021` closed, 2026-08-05) and its
			//     ROADMAP mentions the command **zero** times: its scope was the three skipped STATES, and
			//     `recordCriterionResult` takes no arrow. It built the two ARROW commands and stopped.
			//   · `ROADMAP-claim-assessment.md` — **zero** mentions; its design names the command only as an
			//     example of §32 repairing §34.2's omissions, never as work.
			//   · `ROADMAP-the-criterion-results-nobody-reads.md` is where this came FROM, and cannot hold it:
			//     `REG-F-421` reframed its `CR-06` from *request a ruling* to *build a ratified command*,
			//     and a four-increment build does not fit one line item of a roadmap whose other items are
			//     **blocked on it**. Folding it back would hide a blocker inside its own dependent.
			// 
			// ⭐ AND ASKING PRODUCED THE CORRECTION THAT MATTERS MOST. Reading the complete roadmap to rule it
			// out is what surfaced that this work had a settled corpus basis I was about to re-derive — and, one
			// step on, that §31 ratifies `AssuranceCriterionEvaluated` 73 lines above the §32 command list I
			// had read, while I was deriving a divergent event name from 21 handlers (`REG-F-422`). ⚠ The
			// subsumption question keeps paying for a reason its own text does not claim: it forces reading a
			// NEIGHBOURING artifact end to end, and the answer is usually next to the thing you missed.
		).toBe(47);
	});

	it('no census artifact carries a live, uncited status for a rule the ledger derives', () => {
		const offences = liveClaims(derivedRuleIds());
		expect(
			offences.map((o) => `${o.file}:${o.line} — ${o.text}`),
			'these lines carry a STATUS for a rule the Slice ledger now derives, and are neither struck nor citing the derivation. Strike them in place (`- ~~old~~ **new**`) citing the Slice — SL-L4 forbids deleting them'
		).toEqual([]);
	});

	it('CONTROL — a planted claim reddens the gate', () => {
		// ⚠ THE CONTROL IS SYNTHETIC AND IN-MEMORY, NOT A FILE EDIT. Planting a real line in a real census artifact
		// would leave the repository dirty if this test threw between plant and cleanup, and a control that can
		// corrupt its subject is worse than no control. This drives the PREDICATE over a fabricated line instead,
		// which is what `liveClaims` actually decides on.
		const ruleId = derivedRuleIds()[0]!;
		const planted = `| **M99** | some milestone | ${ruleId} | ✅ delivered |`;
		expect(
			STATUS_MARKER.test(planted) && !STRUCK.test(planted) && !CITES_LEDGER.test(planted),
			'a line naming a derived rule with a ✅ and no citation MUST be an offence, or the gate cannot catch the milestone rows that provoked this work package'
		).toBe(true);
		// And the three escapes must each be sufficient on their own, or a compliant edit could not clear the gate.
		expect(STRUCK.test(`~~${planted}~~`), 'striking must clear it').toBe(true);
		expect(
			CITES_LEDGER.test(`${planted} see e2e-006-restart-mid-execution.slice.test.ts`),
			'citing the Slice must clear it'
		).toBe(true);
		expect(
			STATUS_MARKER.test(`| **M99** | some milestone | ${ruleId} | scope only |`),
			'a line that merely NAMES the rule without a status marker must not be an offence'
		).toBe(false);
	});
});
