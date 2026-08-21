# DESIGN — W-3b: the invariant prose→code mapping

**Backlog item, verbatim:** *"W-3b: the 192 invariants' prose→code mapping — judgment work (lanes + refuters,
the REG-F-197 pattern), deliberately NOT done by grep in W-3. The canon 62 FAM-N invariants are the priority
slice."* Residue of the implementation ground-truth programme (W-0..W-5, REG-F-198).

**Authority:** none needed to MEASURE. This design authors an instrument and an audit method, not a contract
shape. Any register entry or code change the audit *proposes* is a separate act with its own authority.

---

## 1. The population, derived — and the two numbers reconciled

**62 is stated.** `DESIGN-implementation-ground-truth.md:127-129`: *"the **numbered successors live in canon**:
JPWB-DOC-003's 62 `**FAM-N · Title.**` invariants (ASR 19, PER 12, STA 8, OBJ 7, DEC 6, REL 4, LYR 3, AUT 2,
AGG 1; legacy INV-5 → STA-2)."* Re-derived exactly:
`grep -cE '^\*\*[A-Z]{3}-[0-9]+ · ' "docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md"` → **62**,
with the nine per-family sub-counts matching row for row.

**192 is NOT stated in prose anywhere** — a claim about a search that was run in both directions with a positive
control (the same command matched `62` and returned the DESIGN sentence, so the zero for `192` is the corpus, not
the grep). It is nonetheless a faithful count of a real committed roster:

```
grep -c '"id": "cap:invariant:' docs/tracking/census/w2-doc-capabilities.ndjson   → 192
  102  RPH-DOC-002 CDM        (14 "## X.Y … invariants" headings, unnumbered bullets)
+  62  canon JPWB-DOC-003     (the FAM-N catalog — the priority slice)
+  20  RPH-DOC-004 §39        (Core Assurance Invariants, ordinal 1-20)
+   8  RPH-DOC-007 §35        (Contract-Level Invariant Tests, §35.1-35.8)
= 192
```

**The 62 is a proper SUBSET of the 192**, so "priority slice" is literally a slice, not a second population.
**192 − 62 = 130 non-canon**, in source corpora CON-000 B1 admits for DETAIL only.

⚠ **NOT IN THE 192, and both absences are deliberate rather than oversights to be "fixed" here:** JPWB-SPEC-001's
14 surface invariants (`SPEC-001-INV-NN`) and CON-000's 12 axioms (`AX-N`). 192 + 14 + 12 = 218. **This audit
claims nothing about either.**

### 1.1 ⚠ FIVE ID COLLISIONS, AND TWO TURN ON ZERO-PADDING ALONE

A regex is the natural instrument here and it is the wrong one. Recorded so no lane invents its own matcher:

| # | collision | why it bites |
|---|---|---|
| C1 | `DEC-N` (DOC-003) vs `DEC-00N` (RPH conformance) **inside one file** | `enforcement-register.ts` holds both: `:1535` "DEC-2 unimplemented on the revise path" is DOC-003 DEC-2; `:3449` "at DEC-002's site" is RPH-DEC-002. 111 bare hits in that file, of which `DEC-002`×6 and `DEC-007`×2 are RPH shorthand. |
| C2 | `ASR-3` vs `RPH-ASR-003`, **off by ten** | RPH-ASR-003 is independence — whose DOC-003 counterpart is **ASR-13**, not ASR-3 (the unconditional floor). Naïve prefix-stripping maps it to the wrong invariant, silently. |
| C3 | `INV-5` vs `INV-05` **inside JPWB-SPEC-001** | `SPEC-001-INV-05` is a live surface invariant; bare `INV-5` in the same document is the RETIRED legacy label whose successor is STA-2. |
| C4 | `AX-N` uses `—` (em dash); `FAM-N` uses `·` (middle dot) | Already recorded at `verif/canon-provenance.ts:14-24` Trap 3: *"Requiring `- ID:` indexed 62 entries and silently dropped the 12-strong `- ID <text>` family (all of AX-*)."* One parser will not read both. |
| C5 | broad-family regex over canon returns **93 distinct**; the catalog holds **62** | Measured. The 31 extras are citations, retired labels, and other catalogs' ids. |

**CONSEQUENCE FOR THE DESIGN: every id must be resolved against the CATALOG, never against a regex over prose.**
The catalog is the roster in `w2-doc-capabilities.ndjson`, whose ids (`cap:invariant:inv-canon-agg-1`) are
already FAM-N-derived and already anchored to the defining line.

---

## 2. ⚠ THE UNIT IS WRONG BEFORE ANY WORD IS CHOSEN: the row is a LIMB, not an invariant

**This is the single most important result of the trial run and it reshapes everything downstream.**

The 62 invariants carry **316 derived limbs** (mean 5.1; max `REL-1` = 14). A canon invariant is typically a
sentence with several independently-enforceable clauses, and the trial found them landing on *different verdicts
with different remedies*:

- **STA-4** *"Proposed work cannot execute; shaping work cannot be satisfied; … baselined work cannot re-enter
  execution."* Limb 8 is **ENFORCED** — driven: `StartExecutionStep` against a BASELINED PWU → REJECTED,
  `RPH_INVARIANT_VIOLATION`, refusal naming RPH-PWU-010. Limb 1 is **UNENFORCED** — proved by observed admission.
  **One invariant, two opposite verdicts.**
- **ASR-14** gave **four** verdicts with four different remedies (object-scope ENFORCED; version ENFORCED;
  criterion a dead predicate; tier has no field in the contract at all).
- **ASR-15** is enforced at the engine on two limbs and **only at a route action** on a third.

**A one-row-per-invariant table cannot represent any of that**, and would have to pick one verdict for STA-4 —
either laundering an unenforced limb green, or reporting an enforced limb as broken. Both are worse than no table.

⚠ **AND LIMB-SPLITTING IS ITSELF A JUDGMENT THAT MUST BE RECORDED, NOT PERFORMED SILENTLY.** REG-F-113 is the
precedent: *"prose about a status is not a status"* — two reasonable regexes over one file, at one moment, gave
**22 and 50**. Two W-3b lanes splitting the same 62 sentences will produce different limb counts and **neither
will be wrong**. So the limb split is an artifact in its own right: derived by a stated rule, committed BEFORE
verdicts are assigned, and pinned. A lane may not re-split.

---

## 3. The verdict ladder — nine arms, argued from what the trial actually hit

**The existing three-way register arm is right and insufficient.** `ENFORCED / UNENFORCED_DISCLOSED /
NOT_A_COMMAND_REFUSAL` was built for 112 ratified conformance rules already shaped as command refusals. The canon
62 are semantic law, and the trial hit four things none of the three arms can say. Each arm below names the
evidence that ALONE satisfies it:

| verdict | means | evidence REQUIRED |
|---|---|---|
| `ENFORCED_DRIVEN` | a named production site refuses, observed through `Engine.dispatch` | `enforcingSite` + `enforcingAnchor` (exactly once in that file) + `refusalMarker` (≥20 chars, distinct) + a CONTROL that ACCEPTS once the arrangement is removed |
| `ENFORCED_BY_CONSTRUCTION` | the violating act is inexpressible (type, port shape, single chokepoint) | a census with its exact command, its count, and a positive control — **plus whether that census is GATED** |
| `ENFORCED_MULTI_SITE` | enforced at N≥2 independent sites, none total | one anchor per site; naming one site certifies only its share |
| `ENFORCED_AT_SURFACE_ONLY` | a refusal exists strictly above the engine seam | the surface site AND the driven proof that the engine admits it |
| `PARTIAL_DIVERGENT_FILED` | enforced in part, gap recorded in a filed entry | the entry id |
| `DIVERGENT_UNFILED` | a live violation with no filed finding | the violating site; **this arm's population must be zero at programme close** |
| `UNENFORCED_OBSERVED_ADMISSION` | drove the forbidden arrangement and the engine ACCEPTED | the arrangement, the accepted result, AND a sibling-limb control at the same site that IS refused |
| `UNENFORCED_DEAD_PREDICATE` | a kernel predicate implements the limb and nothing calls it | `referencedOnlyBy`, gated, with the baseline census EXCLUDING the wiring site |
| `UNENFORCED_NO_SHAPE` | the field the limb needs does not exist in the contracts | the schema and the field name |

**Why `ENFORCED_AT_SURFACE_ONLY` is its own arm and is always a FINDING:** ASR-15's subject limb is refused at
`apps/rph-demo/src/routes/decisions/+page.server.ts:69-73` and nowhere on the write path — `ProposeDecision` with
`subjectObjectIds: []` was driven and **ACCEPTED**. The register already has the AXIS (`CoverageLayer` includes
`'SURFACE'`) but no verdict for it. Without this arm the row scores ENFORCED on a real, cited, mutant-covered fix
that lives above the seam.

**Why `ENFORCED_BY_CONSTRUCTION` records whether the census is GATED:** PER-3 and AGG-1 hold because `CommitInput`
takes one aggregate and one production call site reaches it. There is no refusal and there could not be one.
But PER-3's census is **not gated** — and *"true but unguarded"* is a different claim from *"enforced"*.

---

## 4. ⚠ THE THREE WAYS THIS AUDIT WILL LIE, AND THE COUNTERMEASURE FOR EACH

### 4.1 It is a census, and a censusing reader is not an enforcing one

REG-F-043 is the proof that this repository has already shipped exactly such a table — 152 guard rows under an
honest *"not evaluated"* label — and had three passes of its own programme read it as enforcement anyway.

**COUNTERMEASURE:** the artifact's every ENFORCED-family row carries the evidence that would let a reader falsify
it, and the summary line states the DRIVEN fraction rather than the ENFORCED fraction. **The header must say, in
its own voice, that producing this table changes enforcement by nothing.**

### 4.2 Reading gives the wrong answer roughly a third of the time — MEASURED, twice, independently

- REG-F-197's refutation stage **overturned 5 of 14** actionable verdicts (**36%**), every one for a method
  failure its design doc had named in advance.
- This trial: of 9 invariants, **6 required a drive**, and **in 3 of those 6 — STA-4, ASR-14, ASR-15 — reading
  alone would have given the WRONG verdict.**

The mechanism is identical in all three: **the enforcing site EXISTS, cites the invariant by name in its own
refusal text, and refuses — for a DIFFERENT limb of the same sentence.** No amount of careful reading finds this;
only driving the specific limb does.

**COUNTERMEASURE — the drive requirement, stated as a rule rather than an aspiration:** a limb may be scored
`ENFORCED_DRIVEN` or `UNENFORCED_OBSERVED_ADMISSION` **only** from an executed dispatch. A limb settled by reading
is capped at a `READ_ONLY` confidence marker and is **not eligible** for either arm. Approximately **35-40% of
the 62 (≈22-25) MUST be driven**; that set is derivable today as the intersection of register-anchored (37) and
production-cited (40).

### 4.3 A single instrument deriving BOTH halves makes the gate unfalsifiable

`DESIGN-declare-the-spine.md:83-96` records this as *"a control that cannot fail — authored, again, inside a
fix"*. W-3b's natural design is: derive the 62 ids from DOC-003, derive the enforcement sites from the code, join
them, and assert coverage. If one instrument does both, total coverage is true BY CONSTRUCTION.

**COUNTERMEASURE:** the **roster** is derived mechanically (from the committed census) and the **verdicts** are
authored by hand with evidence. The gate compares two independently-produced artifacts. It must be possible for
the gate to fail; §7 names the mutation that must make it fail.

---

## 5. Where the verdicts live — the tracker, and no new store

**The hole is already declared in code.** `scripts/tracker/measure.ts:23-27`, verbatim:

> *"⚠ What this deliberately does NOT measure: the 192 invariants (prose→code mapping is judgment work — a
> lane-and-refuter program, not a grep) and OBSERVED/DRIVEN tiers … Absence of a verdict here is the honest
> state, visible in `tracker:query unverified`."*

**And nothing gates it.** `grep -rn 'cap:invariant' verif/` → **0 matches** (positive control: "invariant"
appears in `verif/` four times). Meanwhile every other capability sub-kind is 100% verdicted — `cap:rule` 125/125,
`cap:command` 105/105, `cap:event` 96/96, `cap:machine` 27/27, `cap:query` 14/14, `cap:policy` 12/12,
`cap:surface` 8/8 — with `cap:invariant` 0/192 and `cap:projection` 0/8 the only holes.

**The tracker needs no schema change.** Its ids are namespaced strings with no type constraint, the 192 items are
already present with FAM-N-derived ids and defining-line anchors, and verdicts arrive as authored NDJSON records
in `docs/tracking/census/`. The other three instruments **forbid** FAM-N by shape, each with a running test that
would redden:

- `enforcement-register.ts` — `RegisteredRuleId` is a **closed union of 112 RPH literals**, cross-checked against
  the ratified catalog by `enforcement-register.test.ts:235-238` (*"disposes no rule the catalog does not
  ratify"*). A FAM-N row is a "fictional id" by that gate's own definition.
- `conformance-manifest.ts` — no NOT-ENFORCED arm at all; extending it recommits DS-001 §4 item 2.
- `guard-enforcement-ledger` — its key space is DERIVED from `STATE_MACHINES` guard texts; a row keyed `STA-4`
  names no arrow and lands in `stale`.

**So: verdicts go to a new census journal, `docs/tracking/census/w3b-invariant-verdicts.ndjson`, keyed on the
existing `cap:invariant:*` ids, plus a `verif/` gate that makes the hole non-silent.**

---

## 6. Method — lanes and refuters, with the one check REG-F-202 says to add

The REG-F-197 pattern, reconstructed: **six lanes in parallel, one per document; every lane returns its own
enumeration rule so the population is checkable; refutation is a SEPARATE, LATER stage by independent agents given
the item + its anchor + the claimed verdict.**

⚠ **AND ITS "CAP AT 14" WAS A MISCHARACTERISATION WORTH INHERITING CORRECTLY.** It was not a budget-limited
sample — it was **three whole lanes refuted and three whole lanes not**. So "36% overturn" is the error rate of
*refuted lanes*, and the unrefuted lanes have an **unmeasured** rate, not a 36% one.

⚠⚠ **THE CHECK THAT MUST BE ADDED, AND IT IS THREE WEEKS OLD:** REG-F-202 is the recorded case of **this exact
workflow's refuter half silently failing to launch**, with the synthesis agent then producing a confident,
well-cited sweep under ZERO adversarial pressure. Over 62 invariants that is 62 unrefuted hypotheses shipped as
findings. **Therefore: the refuter stage must report a COUNT of refuters that returned, and the artifact must
carry that count. A refutation stage that cannot prove it ran did not run.**

**Refuter targeting, sized by where the errors actually were:** the trial's three reading-errors were all
`ENFORCED`-family verdicts that were true of a *different limb*. REG-F-197 refuted only ACTIONABLE verdicts and
left its 163 ENFORCED rows unattacked, with its own errata disclosing reasons to doubt them. **W-3b refutes
ENFORCED-family rows too, and every refuter is asked the limb question specifically: *does the cited site refuse
THIS limb, or a sibling?***

---

## 7. What makes this instrument able to fail

Per §4.3, a coverage gate that cannot redden is worthless. Named in advance:

1. **`verif/invariant-verdict-census.test.ts`** pins, from the committed roster: the population (192 items; 62
   canon), the verdicted count, and the per-arm distribution. Adding an invariant to the corpus without a verdict
   reddens; changing a verdict without changing the count reddens the distribution.
2. **The roster and the verdicts are separate files with separate authors** (§4.3), so the join can be empty.
3. **Every `ENFORCED_DRIVEN` row's `enforcingAnchor` must resolve EXACTLY ONCE in its cited file** — the C-0b
   mechanism, which REG-F-081 added after six enforcing sites rotted into doc comments in two days.
4. **The predicted red, named before the green is trusted:** a mutant that deletes the `enforcingAnchor`
   uniqueness check must redden the census test **and nothing else**. A mutant that flips one row's verdict from
   `ENFORCED_DRIVEN` to `UNENFORCED_OBSERVED_ADMISSION` must redden the distribution pin.

---

## 8. What this audit does NOT claim, stated before it runs

- **Nothing about enforcement CHANGES.** The deliverable is a measurement. Any wiring it recommends is separate
  work with its own authority.
- **Nothing about JPWB-SPEC-001's 14 surface invariants or CON-000's 12 axioms** (§1).
- **Nothing about the 130 non-canon invariants** until the canon 62 are complete.
- **No claim of a defect rate on ENFORCED rows** unless refuters actually attacked a sample of them (§6).
- ⚠ **And DOC-003 is HYPOTHESIS tier**, ratified wholesale-interim with clause-level dispositions still OPEN, and
  REG-D-034 makes canon's authority over a principle **derivative and conditional** — it governs where it
  faithfully distils the source its provenance cites. **So an "unenforced" verdict is not automatically a defect
  in the code; it may be a clause whose disposition is still open.** Each such row states which it is, or says it
  cannot tell.

---

## 9. Cost, measured rather than estimated

The trial cost **~45 min mean** over 9 invariants (20-35 min settled by census+reading; 25-40 min driven reusing a
standing arrangement; 45-75 min driven needing a new multi-command arrangement). ⚠ **The nine were chosen to span
the range and the reusable rig was front-loaded; the tail is worse.** The tail — LYR-1/2/3, REL-1..4, AUT-1/2,
ASR-18/19, PER-11 — is architectural statements with zero citation census and no arrangement to drive, costing
reading and judgment, which is slower per unit of certainty than a probe.

**Projection at limb granularity (316 limbs): ~1.0-1.3 hours per invariant → 65-80 hours for the 62, plus
refutation.** This is a multi-wave programme, not an increment. The roadmap sequences it so that **each wave lands
a complete, gated, honest partial** rather than an 80-hour bet.
