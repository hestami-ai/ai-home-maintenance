# JAN-ENFCOV-DS-001 — Enforcement Coverage Design

*Design-first, **v0.1.0**, 2026-07-29. Scope: make the difference between a rule the engine ENFORCES and a rule
it merely CONTAINS CODE FOR into a gated, counted fact, so that a green build stops asserting coverage it does
not have. Commissioned by the sponsor after asking whether failing tests could surface the finding that **74% of
the kernel was dead in production** — the answer being no, and the reason being instructive. Awaiting design
confirmation before a roadmap is written.*

---

> ## ⛔ WITHDRAWN 2026-07-29, SAME DAY, BEFORE ANY CODE WAS WRITTEN
>
> **The code-side census this document proposes should NOT be built, and the alarm that motivated it was already
> answered.** An 8-agent adversarial pass refuted the premise, the measurement and the specification in turn. The
> document is kept because the reasons are worth more than the proposal was.
>
> **1 — The alarm was already triaged, by this repository, and found to overstate the gap by an order of
> magnitude.** `docs/Recursive Professional Harness/JAN-ROADMAP-001-v2/detailed-roadmaps/W1/evidence/hollow-kernel-triage.md`
> records an 8-agent triage of the same census: **55 dead → 5 genuine gaps**, 19 `DEAD_BY_DESIGN`
> (introspection / sibling-API / already-enforced-live), 24 `DEFER` to W2/W3. Its own headline reads *"the
> census's '55 dead' overstated the genuine W1 governance gap by an order of magnitude."* Every number in §3
> below, and the "74% dead" framing repeated throughout this session, quotes a **pre-triage** figure whose author
> had already qualified it. A second census would rediscover the same 55 and demand the same triage again.
>
> **2 — My own re-measurement (55.6%) was wrong in every component, and looked right by accident.** Denominator:
> 135 detected vs **296 real** exports — the regexes were blind to `export interface` (121), `export type` (41)
> and `export class` (1), and **two of the 135 were phantoms**: template-literal text inside
> `gen/gen-transitions.ts`, whose *real* definitions the `*.data.ts` filter had excluded. Numerator: ≥9 false LIVE
> (7 matched by **prose comments**, 2 by name collisions) and ≥14 false DEAD from transitive type reachability.
> The exemplar is exact — **`bindingPermitsExecution` was scored LIVE by the comment
> *"this layer no longer calls `bindingPermitsExecution` directly"***: the sentence documenting its removal is
> what marked it alive. And the original 75 landed within 8 of a corrected 83 **because two independent errors
> cancelled**, which is why it read as plausible.
>
> **3 — The census's positive arm would have certified the defect we just spent the day on.**
> `validateObligationConservation` **is** imported and called (`handlers/decomposition.ts:18, :210`), so any
> reachability census marks it `WIRED` — while its input is built from `obligationIds` that every surface path
> sets to `[]`. It is reached **and vacuous**. A census whose green arm certifies an open finding is not a weaker
> instrument than the register; it is one that would have argued against it.
>
> **What survives:** the vocabulary in §5, the tracker finding in §3.1 — which produced a real gate
> (`verif/tracker-deferrals.test.ts`, commit `9f91fcb6`) — and the open-work carry in §9. **What is superseded:**
> §3's measurements, §6's D2/D3/D4, and §8's questions. The residual worklist is not "114 rules and a census"; it
> is the triage's **five WIRE gaps plus its 24 W2/W3 deferrals**, which already exist, already have code-grounded
> write-paths, and already name their red-first tests.

## 1. What it is (one line)

Extend the existing `enforcement-register` from one rule family to the ratified catalog, and add the
complementary **code-side reachability census** it cannot perform, so every ratified rule carries an explicit
disposition and every kernel export carries an explicit reachability fact.

## 2. What it is NOT (guardrails)

- **NOT a set of failing tests.** This is the design's origin and its first rejected option — see §4. A
  permanently red gate is deleted or routed around; a skipped test rots in silence. Both are worse than the
  status quo, because they convert an unmeasured gap into an *ignored* one.
- **NOT a coverage percentage.** Line and branch coverage already exist and are ratcheted, and they are exactly
  what cannot answer this question: the register's own header records that a coverage model *"will always launder
  an unenforced rule into a green build, because the only vocabulary it has is degrees of covered."* A rule can be
  100% covered by unit tests and enforced nowhere.
- **NOT a claim that unwired code is a defect.** A kernel written ahead of its call site is legitimate and this
  repository does it deliberately. The defect is that the distinction is **invisible**, so nobody can tell a
  deliberate lead from an accidental orphan, and a milestone can be closed over the difference.
- **NOT a retroactive audit of milestones.** M9–M13 are marked ✅ and this design does not re-open them. It makes
  the residue those closures left behind countable going forward.
- **NOT a single register.** Rule-side and code-side are two censuses answering two different questions (§6 D2).
  Merging them would produce one number that answers neither.

## 3. The measured problem

Three independent measurements, all present in the repository today:

| Measurement | Value | Source |
|---|---|---|
| Ratified rules carrying an enforcement disposition | **11 of 125 — 8.8%** | `enforcement-register.ts` vs `m12-conformance.json` `ruleCountsByPrefix._total` |
| Kernel LIVE in production at the time of measurement | **19 of 74 — 26%** | the harmonization programme's LIVE/DEAD census |
| Generated contract shapes that are permissive stubs | **34 placeholders** | `gen-objects.ts`; audited in `docs/_working/AUDIT-placeholder-helpers.md` |

For the 114 rules with no row, the repository **cannot say** whether they are enforced. A green build asserts
nothing about them, and — this is the operative point — *it looks exactly like a green build that does.*

### 3.1 How the gap accumulated, which is not by neglect

`JPWB Implementation Roadmap and Tracker.md` shows kernel-to-command wiring deferred forward four times, with
every station marked complete:

- **M9** ✅ *"kernel + adversarial-reviewed; commands/BINDINGS wiring → M10/M11"*
- **M10** ✅ *"executable kernel + adversarial-reviewed; command handlers → M11/M13"*
- **M11** ✅ *"execution kernel + adversarial-reviewed; … command handlers … → M13"*
- **M13** ✅ core *"… live-command-drive handlers deferred"*

No station is dishonest. Each names its successor. The failure is that **the chain terminates without a holder**,
and nothing in the build notices — a deferral that names its successor four times without ever landing is, at a
glance, indistinguishable from a plan. F-I (REG-005 REG-F-006) is one instance of exactly this: the M9 obligation
conservation kernel exists, `validateDecomposition` calls it, and the revise path — bound by the same ratified
DOC-003 rules — was never wired.

## 4. Why "add failing tests" is the wrong instrument

The sponsor's instinct is right about the *goal* — make the gap overt — and the mechanism is where it fails.

**A permanently failing test has no stable meaning.** Red means "something is wrong now"; a red that is expected
trains readers to ignore red, and the first time it blocks someone it is deleted or skipped. The repository has
already paid for the general form of this: `passWithNoTests` let a runner that observed *nothing* exit 0 for four
work packages.

**What is wanted is the inverse.** A test that **passes by asserting the gap exists**, and turns **red when the
gap changes in either direction** — closed *or* widened. That instrument already exists here, and its third
disposition arm is the whole idea:

> `UNENFORCED_DISCLOSED` — *"the statement IS a command refusal and NOTHING in production enforces it. Not a
> wish-list entry — a recorded, gated fact, backed by a call-site census the gate CHECKS. **Wiring the predicate
> changes the census and turns the gate RED**, demanding the row be re-dispositioned to ENFORCED with a probe.
> **The disclosure cannot quietly outlive the condition it discloses.**"*

Two properties make it work, and both must be preserved by any extension:

1. **The disclosure is census-backed, not asserted.** A row claiming "nothing enforces this" names the sites that
   reference the predicate, and the gate re-derives that list. The row cannot drift from the code.
2. **Totality by type.** `RegisteredRuleId` is a union; a rule with no row is a **compile error**, not a
   discovery. New gaps cannot enter silently — only deliberately, in a reviewable diff.

## 5. Vocabulary — three failure modes that must not be conflated

"Placeholder" is a term of art in this repository already, and it names only the first of these. Each has a
different repair, so a single word covering all three would make the register unusable.

| Term | What it is | Where | Repair |
|---|---|---|---|
| **Placeholder** | a generated contract stub — `z.record`, "any object" — where the ratified corpus schematizes no shape | `rph-contracts` | schematize the shape, or record that the corpus does not |
| **Unwired kernel** | implemented, reviewed logic with **no production call site**. This is the 74% | `rph-domain`, `rph-assurance` | wire it to a command, or record why it leads |
| **Declared-not-performed** | a command or field **accepted** and never applied. F-I is the worked example | `rph-application` | refuse it (cheap, no ratification) or implement it |

Proposed collective term for what the register measures: **enforcement coverage** — deliberately not "dead code",
which prejudges a lead as an orphan.

## 6. Design decisions

**D1 — Extend the register family by family, not wholesale.** 114 rows each need a real disposition backed by
evidence at the `COMMAND` layer. A row asserted without that evidence is worse than no row: it converts an
unmeasured gap into a *falsely measured* one, and the register's value is entirely in its rows being trustworthy.
Sequencing also keeps each increment reviewable.

**D2 — Two censuses, deliberately separate.** The register is **rule-side**: for each ratified rule, is it
enforced? The proposed new census is **code-side**: for each kernel export, is it reached from production? They
are not substitutes — a rule can be enforced by code no census would flag, and code can be reached without
enforcing any rule. Reporting one number for both would hide exactly the cases that matter.

**D3 — The code-side census must exclude tests from "reached".** The 74% finding exists *because* unit tests
reach everything. A predicate exercised only by its own test is the definition of unwired. The census therefore
counts references from production paths only, and — per the register's existing `COMMAND`-layer rule —
observation through `Engine.dispatch` is what promotes a row to ENFORCED.

**D4 — First family: `RPH-DEC` (7 rules).** Small enough to complete honestly; we hold fresh, verified evidence
from REG-F-006; and it converts F-I from a prose finding into a gated row that **goes red the day someone wires
the conservation kernel into the revise path** — which is the property the whole design is for.

**D5 — A row may say "unenforced" but never "unknown".** The disposition vocabulary has no escape hatch. If the
author cannot determine enforcement, that is a blocking question, not a row.

## 7. Anti-goals and non-examples

- **Non-example of a good row:** *"RPH-DEC-002 — enforced, see `decomposition.test.ts`."* A unit test proves the
  predicate computes; it says nothing about whether anything **asks** it. That substitution is the exact defect
  that produced the RPH-EXE family's original finding.
- **Non-example of a good census result:** *"0 unreached exports."* If the census reports nothing on first run,
  suspect the census. It is measuring a repository that has already recorded 74% dead.
- **Anti-goal: a number that only goes up.** The register's purpose is not to demonstrate progress. A family
  whose honest disposition is mostly `UNENFORCED_DISCLOSED` is a **successful** increment.

## 8. Open questions for the sponsor

1. **Family order after `RPH-DEC`.** Proposed by consequence: `RPH-ASR` (12, assurance), `RPH-GOV` (7,
   governance), `RPH-BAS` (7, baseline) — the families where an unenforced rule is most costly. Confirm or re-order.
2. **Whether the code-side census gates or reports** on first landing. Recommendation: report-only for one
   increment, then gate on a ratchet, so the initial number is discovered rather than negotiated.
3. **Whether `RPH-PER`/`RPH-E2E`/`RPH-FIX` (27 rules) belong in a command-enforcement register at all**, or need
   a different disposition vocabulary. They may be the `NOT_A_COMMAND_REFUSAL` arm wholesale.

---

## 9. What this pivot does NOT address — carried forward, not closed

Recorded here because this design is a **pivot**, and a pivot that does not name what it displaces is how open
work is lost. Each item's authoritative record is cited; this list is a pointer, never a second authority.

| Open item | State | Authority |
|---|---|---|
| **S-2's unbound obligations** — re-measured 2026-07-29: **397 of 770 in scope (48.4% bound)** | OPEN. W-3/W-4/W-5 made a portion bindable; **that binding pass was never run.** `bun run spec:obligations` | `JPWB-SPEC-001` §12; `JPWB-SPEC-001-DR-001` S-2 |
| **JPWB-SPEC-001 ratification** | Gated on S-2 reaching zero; a sponsor act regardless (CON-000 B2) | `JPWB-SPEC-001` §12.3 |
| **F-I — DOC-003 revision obligations unimplemented** | OPEN **and unscheduled**. The M9 kernel exists; the revise path is a second call site no milestone holds. *This design's D4 makes it visible; it does not implement it.* | `JPWB-REG-005` REG-F-006 |
| **`ValidateDecomposition` passes vacuously** | OPEN. Its conservation guard reads the parent's `obligationIds`/`constraintIds`; every surface path sets both `[]` | `JPWB-SPEC-001-DR-002` §W-3 |
| **SPEC-001 recorded-not-repaired** — 11 §11.4 citation slips; 12 carriage obligations; two fixture ids with no §10 body (`SPEC-001-NF-76`, `-NF-77`); five fixture namespaces; five unbound disclosure codes | OPEN, itemized | `JPWB-SPEC-001` §12.5 |
| **Two §§1–10 corrections owed** — §3.7's "thirty e2e specs" (measured 28) and §2.8.4's claim that DOC-003 carries no Question object (contradicted by `JPWB-DOC-003:84`) | OPEN | `JPWB-SPEC-001` §12.5 |
| **Help / "Rosetta" system** | Does not exist anywhere in the repository. Unstarted **design** work, not backlog | `JPWB-SPEC-001-DR-002` F-H |
| **Canon Ratify Sheet R1** and canon retirement preconditions | OPEN (pre-dates this session) | `JPWB Canon Ratify Sheet (R1).md` |
| **JAN-EXECREM residuals** — its own post-build adversarial review is owed | OPEN (pre-dates this session) | `JAN-EXECREM-RESIDUALS.md` |

**The S-2 pass is the one most at risk of being lost**, because it is the only item whose enabling work is
already done: W-3, W-4 and W-5 created the artifacts a large share of those 397 obligations need to cite, and
nothing has cited them. Its cost falls the longer it waits only in the sense that the evidence is fresh now.
