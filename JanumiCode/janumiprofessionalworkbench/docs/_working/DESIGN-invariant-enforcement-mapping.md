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

---

## 10. ⚠ ADDENDUM (V-1, 126/307 limbs in) — THE LADDER MIXES TWO AXES, AND THE MEASUREMENT IS THAT ITS NAME BEAT ITS SPEC

**The specification in §3 was already right.** The table says `PARTIAL_DIVERGENT_FILED` requires *"the entry
id"* as its evidence. It does not say "some enforcement is partial"; it demands the filing be named. And yet:

> **five of 33 rows on that arm name no filing at all** — `limb:STA-4:5`, `limb:ASR-14:2`, `limb:DEC-6:3`,
> `limb:ASR-13:1`, `limb:ASR-17:3`.

Two of them contradict the arm in their own text. `ASR-13:1`'s `owed` opens *"A REG-F FINDING IS OWED IN TWO
PARTS, NEITHER RECORDED ANYWHERE TODAY"*. `ASR-17:3`'s says *"Nothing owed against this limb"* while its
evidence argues both conjuncts hold by construction. Neither row is on the arm its own prose describes.

### 10.1 Why this is not operator carelessness, which is the whole reason it belongs in the design

**All five were placed on the arm by REFUTERS, not by lanes** — and lanes and refuters are separately
prompted, adversarially posed, and never see each other's instructions. When both ends of a deliberately
independent pipeline make the *same* misreading, the defect is upstream of both. It is the ARM'S NAME.

An operator carries the label in their head for the whole of a row; the evidence table is read once at the
start. `PARTIAL_DIVERGENT_FILED` leads with `PARTIAL`, and the reading it invites — *"enforcement is
partial"* — is true of every row that landed there. The second claim, *"and the divergence is filed"*, is
the one that decides whether the row is a **resting state or a debt**, and it is the one the name buries.

This is the same shape as REG-F-113's *"prose about a status is not a status"*, one level up: **a label that
asserts two things will be read as asserting the more prominent one.**

### 10.2 The structural diagnosis: FILING IS AN ORTHOGONAL AXIS

The ladder encodes filing status inside exactly two of its nine arms — `PARTIAL_DIVERGENT_FILED` and
`DIVERGENT_UNFILED` — and nowhere else. But **any** enforcement verdict can carry an unfiled divergence. A
row can be `ENFORCED_MULTI_SITE` with one site's partiality recorded nowhere; `ENFORCED_BY_CONSTRUCTION`
with an ungated census nobody has filed; `UNENFORCED_DEAD_PREDICATE` with no finding raised. The audit has
produced instances of all three, and each had to smuggle the filing fact into `owed` as prose.

So the two arms are not two points on one ladder. They are **one enforcement verdict crossed with one filing
status**, flattened into a vocabulary that can only express the cross for a single enforcement value.

That also explains the second symptom, which looked unrelated until this: **eight rows carried `filed_as` on
a `DIVERGENT_UNFILED` verdict** — a field asserting the exact opposite of its own arm. The content was good
every time (each named a filing that EXISTS and does NOT cover the limb, which is exactly the near miss a
later reader needs so they do not close the row on it). Operators reached for a filing field because filing
is a real, separate thing they had observed; the vocabulary had nowhere to put it. Renamed
`near_miss_filing`, which keeps the content and stops the contradiction — but the rename treats the symptom.

### 10.3 The remedy, PROPOSED AND DELIBERATELY NOT PERFORMED

Separate the axes:

| axis | values |
|---|---|
| `verdict` — what the code does | the nine arms, minus the two filing-flavoured ones, plus a plain `PARTIAL` |
| `filing` — what the record says | `FILED` (names the entry) · `UNFILED` (names what is owed) · `NEAR_MISS` (a filing exists and does not cover this limb) · `NOT_APPLICABLE` (nothing divergent to file) |

`DIVERGENT_UNFILED`'s standing rule — *the population must be zero at programme close* — becomes
`filing = UNFILED` over ALL verdicts, which is **strictly stronger** than today: it catches the unfiled
partiality currently hiding inside four other arms.

**⚠ AND IT IS NOT DONE NOW, ON PURPOSE.** Re-cutting the vocabulary mid-audit re-opens every one of the 126
rows already scored: each would need its filing axis established, and for most of them nobody has looked —
which is precisely the claim-about-a-search this programme refuses to make (§4.1). Performing it under a
slice commit would also make the slice's own numbers unauditable against the ones before it. It is **V-4
work**, to be done once with the population complete, as a stated migration with its own before/after
counts.

### 10.4 What holds the line until then

- `verif/invariant-verdict-census.test.ts` pins the five unnamed-filing rows **as an explicit list**, not a
  count. A sixth reddens it; a fix shrinks it. They are pinned rather than reclassified because moving them
  to `DIVERGENT_UNFILED` would assert that no filing exists — a claim about a search nobody ran.
- The same gate refuses `filed_as` on any `DIVERGENT_UNFILED` row, and pins the `near_miss_filing` count.
- Lane and refuter prompts state the two-claim structure explicitly rather than relying on the arm name.

---

## 11. ⚠ ADDENDUM — A REFUTER OVERTURNS A SCALAR; THE ROW IS A NARRATIVE

The merge step replaces `verdict` and appends `refuter_correction`. **Every other field** — `evidence`,
`observed`, `census`, `owed`, `filed_as` — was authored by the LANE to argue the arm just removed, and stays
behind unmarked, still arguing the superseded case.

`limb:DEC-4:6` is the worst instance the audit has produced. Its arm says the engine ACCEPTS softening a
MANDATORY security constraint to ADVISORY without authority. Its own `owed` field opens *"FOUR THINGS, none
of them a live hole in the prohibition"* — true of the arm it used to carry. Its `observed` transcript shows
only refusals, because those are the ones the lane provoked. **A reader who reads the row rather than the
correction gets the opposite conclusion from the one the data holds.**

**⚠ AND THE OBVIOUS PROBE FOR IT IS A CONTROL THAT CANNOT FAIL.** The first check written asked whether an
admission transcript contains `ACCEPTED` and a driven-refusal transcript contains a refusal. It returned
**zero offenders across all 94 rows then present** — not because they were clean, but because every
transcript contains both words: the controls are in there too. That green meant nothing. The only signal
separating a live narrative from an orphaned one is whether the ARM MOVED.

**Remedy, PERFORMED:** rows record `superseded_verdict`, and the gate requires such a row to be `OVERTURNED`
with a genuinely different arm. **The marker is written by the MERGE step, not by a repair pass** — that
distinction is itself a finding: the first implementation repaired the existing rows and left the merge
alone, so the very next slice changed five more arms while the pinned count stayed at 10 and the gate passed.
A gate that counts a population must be fed by whatever CREATES that population, or it silently undercounts.

---

## 12. ⚠ ADDENDUM — THE SPLICED TRANSCRIPT, AND WHY ONLY ONE KIND OF REFUTER CATCHES IT

`limb:ASR-15:6` was filed `ENFORCED_BY_CONSTRUCTION` with a driven transcript. **The arm survived a properly
controlled re-drive. The transcript did not — it describes an observation that never happened.**

Its `observed` field reads, in one breath:

> `E BEFORE: rev=1 sv=1 status=ADMISSIBLE lifecycle=ADMISSIBLE bytes=780`
> `E AFTER an EFFECTIVE decision about it: rev=0 sv=1 status=PROPOSED contradicts=["clm_1"] bytes=769`
> **— IDENTICAL to before.**

`rev 1 → 0`, `ADMISSIBLE → PROPOSED`, `780 → 769` is not identical to anything. The two halves came from **two
different runs**: the setup and the control from `lane-ASR-15d.mjs`, the "unchanged" readings from
`lane-ASR-15c.mjs`, set side by side and read as one observation.

The consequence is not cosmetic. In the run where the decisive probe was actually driven, the invalidation it
depends on **had been REFUSED** — so its stated premise, *"an EFFECTIVE decision citing the now-INVALID
evidence"*, is false there. And that run's own CONTROL had failed: nothing in it demonstrated the probe could
see a change at all, so every *"unchanged"* it reported proved nothing on its own terms
(**§4** — a control that returns nothing is not a control).

### 12.1 This is not the census error one level over. It is worse in one specific way

A broken census (§EM-2) produces a number the command cannot produce — anyone re-running the quoted command
sees it. **A spliced transcript reproduces perfectly, line by line, as long as you run the script the row
names.** Both halves are real. Both were really observed. The defect is the JOIN, and the join exists only in
the row.

So the countermeasure is not "re-run the census". It is:

> **R2b — RE-RUN THE LANE'S OWN SCRIPT, NOT ONLY YOUR OWN RE-DERIVATION.** A refuter that writes a fresh probe
> and gets the same verdict has confirmed the CLAIM and has not touched the EVIDENCE. Run the file the row
> names, read its actual stdout, and check that every number the row quotes appears in ONE run of ONE script.

This refuter did exactly that — `grep -c "AdmitEvidence" lane-ASR-15c.mjs` → **0**, which is what proved the
`ADMISSIBLE` reading could not have come from that file — and it got there because the quoted numbers were
INTERNALLY INCONSISTENT. That tell will not always be present. The instruction has to stand without it.

### 12.2 Why the gate cannot pin this, stated so nobody assumes it does

A spliced transcript is well-formed text. It satisfies every mechanical check the gate has: the arm is in the
closed vocabulary, `confidence` is `DROVE_THE_ENGINE`, `observed` is far longer than 20 characters, the anchor
resolves exactly once. **There is no string property that separates two runs spliced from one run reported.**

What the audit has instead is the refutation stage, and this row is the argument for its cost: the splice was
invisible to the lane that wrote it, invisible to the merge, invisible to the gate, and visible only to an
adversary who opened the lane's files. **Every row not marked `HELD` or `OVERTURNED` — `UNREFUTED` stands at
30 — is a row where this class of defect would still be sitting.**

---

## 13. ⚠ ADDENDUM — THE OVERTURN RATE IS TWO NUMBERS, AND THEY MEAN OPPOSITE THINGS

Every slice has reported one figure: *N of M rows overturned*. That figure conflates two failures with
different consequences, and the data separates them for free — `superseded_verdict` is present **iff** the
refuter moved the arm.

| | what the refuter changed | what would have shipped |
|---|---|---|
| **ARM MOVED** | the verdict itself | a **wrong answer** about whether canon is enforced |
| **ARM KEPT** | the citation or the evidence | the **right answer** resting on evidence that does not support it |

Measured over the 251 rows, excluding V-0 (see §13.2):

```
slice         rows  overt   arm MOVED   arm KEPT
v1-sta          23      3         9%         4%
v1-objrel       19      3        16%         0%
v1-declyr       29      8        24%         3%
v1-asr          32     12        16%        22%
v1-perrel       44     16        23%        14%
v1-orphans      23      9        26%        13%
v2-a            25     12        28%        20%
v2-b            33     14        12%        30%

77 decomposable overturns = 44 arm moved (57%) + 33 arm kept (43%)
```

### 13.1 The 43% is the number this programme exists for

An arm-moved overturn is a caught mistake, and any careful second reader might catch it. **An arm-kept
overturn is a row that was RIGHT and would have shipped with a citation that does not support it** — the
enforcement claim true, the pointer to it false. That is REG-F-043's sentence exactly, the one §3 of this
design quotes as the reason the gate lands before the audit: *"A declaration and its enforcement that no
artifact connects are two facts, not one guarantee."*

Nothing downstream would ever have found those 33. The verdict reads correct; the distribution reads correct;
the gate's anchor check passes, because a wrong anchor still resolves exactly once in the file it names. Only
an adversary who opens the cited site and asks *"does this predicate refuse THIS limb?"* sees it.

**And the split moves with the method, which is the operational point.** `v2-b` — the census-heavy tail —
inverts: 12% arm moved against 30% arm kept. Its lanes were mostly RIGHT about enforcement and wrong about
the commands they quoted. `v1-objrel` is the mirror: 16% moved, **0% kept**. A slice's two numbers say which
half of its lane brief was underweight, and a programme reporting only the sum cannot tell the difference
between "our judgment is off" and "our evidence discipline is off".

### 13.2 ⚠ V-0 CANNOT BE DECOMPOSED, AND SAYING SO IS THE POINT

V-0's 11 overturns are absent from the table because **its lane verdicts were never journaled in a
recoverable form** — 23 rows have no recoverable pre-refutation arm, so the split is unavailable, not zero.

This was nearly reported as `0%` arm-moved for V-0, which would have been a striking and entirely false
result. The mechanism was the audit's own recurring one: `superseded_verdict` had been backfilled from **two**
journals when eight existed, and a field present for part of a population was read as though it were total.
Re-running the backfill across every journal recovered two further rows (both `v1-sta`) and established that
V-0's are genuinely unrecoverable.

The general form, and it is now three-for-three in this programme: **a partial-coverage field reads exactly
like a measured zero.** The drive queue keyed by invariant (§ the partial-coverage gate), the merge that
marked only repaired rows, and this backfill are the same defect at three altitudes.

---

## 14. ⚠ ADDENDUM — THE SEARCH TOOL HIDES THE FILINGS, AND THAT INVALIDATES A METHOD RATHER THAN A ROW

Every "not filed" verdict in this census rests on a search of four corpora. **Two of those corpora are largely
invisible to the default search tool**, and the tool does not fail — it reports the match and withholds the
text:

```
$ Grep "on every peer both ran over an"  docs/canon/JPWB-REG-005 …md
909:[Omitted long matching line]
```

That line is 2046 characters. It is REG-F-029 review finding (e), CLOSED 2026-08-05, and it adjudicates —
by name, with a committed, green control test — the exact arrangement `limb:ASR-10:5` had been filed as an
**unrecorded divergence**. A reader scanning Grep output for "is this filed?" sees a line number and no
answer, and the absence of text reads as the absence of a filing.

### 14.1 The measurement, because the scale is the finding

| corpus | lines | over 1000 chars | share of the file's characters on those lines |
|---|---|---|---|
| `JPWB-REG-005 Decision and Divergence Register.md` | 4872 | 116 (2.4%) | **11.3%** |
| `verif/guard-enforcement-ledger.data.ts` | 392 | 58 (14.8%) | **67.9%** |
| `packages/rph-domain/src/enforcement-register.ts` | 4168 | 2 (0.0%) | 0.7% |

**Two thirds of the guard-enforcement ledger's content sits on lines the tool omits.** And the omission is
not random with respect to content: the longest entries are the most thoroughly reasoned ones — the findings
that quote canon, name the site, state the arrangement and record the control. **The tool hides exactly the
filings most likely to settle a question.**

### 14.2 Why this is worse than the error modes above it

EM-1 through EM-5 corrupt a ROW. This corrupts a METHOD. Every absence claim in this programme took the form
*"I searched the register and found nothing"* — and for any filing living on a long line, that sentence was
true of the search and false about the world. Three errors already recorded here have this as their
mechanism, and none was diagnosed as such at the time:

- `limb:AGG-1:2` claimed its violation was *"recorded ONLY in a working design document"*. REG-005:1316 states
  it **by name** — `⚠ SO withPwaVersionBump VIOLATES AGG-1 BY NAME` — counts its three call sites, and cites
  that working paper as its own analysis.
- `limb:PER-9:5` reported NONE FOUND from a search that never opened the corpus holding the finding.
- `limb:ASR-10:5` sat on `DIVERGENT_UNFILED` for nine slices over a CLOSED, test-pinned adjudication, found
  only when an agent searched **by site** and read the raw line.

### 14.3 The countermeasure, and it is not "search harder"

> **EM-7 — READ THE LINE, DO NOT TRUST THE MATCH.** When searching a filing corpus, use `grep` through Bash
> (which prints the full line) rather than the Grep tool, and when a hit lands on a long line, read it with
> `sed -n 'Np' <file>`. **Search by SITE — the file path, the symbol, the function name — as well as by
> invariant id.** A filing that governs your limb may never name it: the one that settled ASR-10:5 names a
> handler and a gate, and mentions no invariant at all.

⚠ AND EVERY ABSENCE CLAIM IN THIS CENSUS PREDATING THIS ADDENDUM IS SUSPECT TO EXACTLY THIS EXTENT. That is
stated rather than remediated: 52 rows still carry `DIVERGENT_UNFILED`, each asserting that nothing records
its divergence, and the V-4 filing pass must re-run each of those searches under EM-7 **before** drafting an
entry. Three of the twenty-two rows re-examined under this rule in V-4b turned out to be already filed — a
13.6% base rate on a population that had already been searched once.

---

## 15. ⚠ ADDENDUM — A RECONSTRUCTED SIGNAL CANNOT DISSENT, AND I TRUNCATED THE INPUT THAT PROVED IT

Three global readers clustered the 49 live divergences under three lenses — **mechanism** (what is broken in
the code), **remedy** (what one commit closes), **site** (what function it lives at) — returning 28, 36 and
35 clusters. A fourth agent reconciled them.

**Its input was truncated, and I did it.** The three lens outputs were embedded inline in the workflow script
under `slice(0, 60000)`. They total **141,583 characters**. Mechanism (38,815) arrived whole; the remedy lens
had 21,185 characters of room and was cut mid-cluster; **the site lens never arrived at all** — while the
brief told that agent, in plain words, that it was reconciling three lenses.

### 15.1 It noticed, and that is the only reason this is a redo rather than a corruption

Its first paragraph is the one to keep: it refused to *"average two lenses and call it three"*, said exactly
what it had received, rebuilt a substitute site signal by extracting `file:line` references from the rows
themselves, and treated each row's own `shares_filing_with` as a fourth declaration. Then it labelled its
confidence accordingly and returned 36 clusters.

Re-run against the full input read **from disk**, the count came back **36 again** — and a *different
partition*: 27 clusters identical, **six groupings changed**, four ratification flags flipped.

### 15.2 ⚠ THE FINDING: A SUBSTITUTE BUILT FROM THE EVIDENCE YOU HAVE AGREES WITH IT BY CONSTRUCTION

Three clusters the first synthesis labelled `ALL_THREE_AGREE` dissolve under the full input. **All three are
cases where the DERIVED site map co-located rows that the REAL site lens separates.**

That is not bad luck. A site map extracted from the rows' own prose can only co-locate what that prose
co-locates — it is a *function of the other signals*, so it cannot contradict them. It agrees by
construction, it agrees in the same vocabulary, and it therefore reads as corroboration. **The disclosure was
honest and the instrument was still systematically optimistic**, in the one direction that matters: toward
agreement.

The generalisation, which applies well beyond this programme:

> **A reconstructed proxy for a missing signal is not a weak version of that signal. It is a restatement of
> the signals you already have, wearing the missing one's name.** Where the real signal would have dissented,
> the proxy concurs — and the confidence vocabulary does not change, so nothing downstream can tell.

The countermeasure is not "label the proxy more cautiously". The first agent *did* label it, in its own
`agreement` field, and the labels still said `ALL_THREE_AGREE`. The countermeasure is to **go and get the
missing signal**, and to treat a proxy's concurrence as carrying no information at all.

### 15.3 The mechanical lesson: pass by reference

This is the **fifth** truncation in this programme — after the OBJ-3 lane payload cut mid-field (two rows
left unrefuted for four slices), `PER-10:3`'s `refuter_correction` cut mid-sentence (a citation dropped on an
argument nobody could finish reading), and two partial-coverage fields read as measured zeros.

**A silent truncation of an agent's input is invisible to that agent**, and produces confident output over a
population it does not know it is missing. Inline embedding with a character cap is the mechanism every time.

> **EM-8 — HAND AN AGENT A PATH, NOT A PAYLOAD.** Write the artifact to disk and tell the agent to read it.
> That is already how lanes receive the census, the limb split and the register; it should be how every
> stage receives the stage before it. Where a payload must be inline, assert its full length in the prompt so
> the agent can detect the cut itself.

⚠ AND THE CAUSE HERE WAS VERIFIED RATHER THAN ASSUMED, which is why it can be stated this precisely: every
remedy cluster behind a changed grouping — C17, C20, C21, C24, C25, C30, C34, C35, C36 — sits **past the
cut**, as does the remedy lens's entire `reasoning` block, because the schema serialises `clusters` before
`reasoning`. The truncation did not remove a random 58%; it removed the *tail* of the second signal and the
*whole* of the third, which is precisely the part a reconciliation exists to weigh.

---

## 16. ⚠ ADDENDUM (V-5) — WHAT THE SPLIT AXIS FOUND, AND TWO ARMS THAT ARE STILL DOING DOUBLE DUTY

Splitting `verdict` from `filing` exposed **48 rows whose filing status nobody had ever established** — they
sat on UNENFORCED arms, where the old ladder could say nothing about filing at all. They were marked
`NOT_ESTABLISHED` rather than `UNFILED`, because `UNFILED` asserts that no filing exists and that is a claim
about a search nobody had run.

**Running the search was worth it, and the numbers say why defaulting would have been wrong:**

| outcome | rows | |
|---|---|---|
| **FILED** | 7 | already recorded — 14.6%, against measured base rates of 13.6% and 5.8% on the two earlier populations |
| **NEAR_MISS** | 21 | a filing exists and does NOT cover the limb |
| **UNFILED** | 18 | searched, nothing covers it; each owes a register entry |
| **NOT_APPLICABLE** | 2 | not a divergence at all |

**Had these been defaulted to `UNFILED` at migration time, 30 of the 48 would have been wrong** — and the 21
NEAR_MISS rows are the ones that would have hurt most, because each names a filing a later reader WILL find
and would close the row on.

### 16.1 A stated exception to the driven-arm rule, because the rule's premise fails on one limb

`UNENFORCED_OBSERVED_ADMISSION` requires that the forbidden arrangement was **driven through
`Engine.dispatch` and accepted**. V-5 flagged that `limb:PER-3:2` carries that arm on a probe that called
`StorageAdapter.commit` directly — no engine call happened.

The flag was right and the arm still stands, for a reason worth stating rather than applying silently:
**this limb's subject is bypassing the bus.** It forbids exactly the arrangement a dispatch cannot express.
Requiring a dispatch would make the limb **unfalsifiable by construction** — the shape §4 exists to refuse.
What was performed and observed *is* the arrangement the limb names: a public, app-importable,
credential-free `commit` producing a PUBLISHED aggregate with **zero events** and a receipt naming an
unregistered command type.

> **The rule assumes the forbidden act travels through the engine. For a limb about going around the engine,
> that assumption cannot hold, and the rule does not apply.** Recorded on the row as `arm_exception` so no
> later reader takes this as the driven-arm rule being waived generally.

### 16.2 ⚠ `UNENFORCED_NO_SHAPE` IS THE NEXT `PARTIAL_DIVERGENT_FILED`

§10 found one arm carrying two claims and advertising one. Here is the second, found the same way — by an
operator saying so unprompted while using it:

- On most rows it means **"canon requires X and the model has no field for it"** — a divergence, which owes a
  filing.
- On `limb:PER-11:2` and `limb:PER-12:2` it means **"the clause has no subject matter for a guard at all"** —
  a sentence stating a fact about the world rather than forbidding an arrangement. Nothing is owed.

Those two readings of one word are what made this look like a 48-row divergence population when two of its
rows are not divergences. The two are pinned by name in the gate, each required to state why — an exception
that does not say why is a hole with a name on it.

**The split is deferred, deliberately.** Re-cutting a second arm one commit after the first would re-open
rows nobody has re-read, which is the same reason §10's migration waited for the population to be complete.

### 16.3 The pattern, now three-for-three

Every one of these was found by an operator USING the vocabulary, never by a reader auditing it:

1. `PARTIAL_DIVERGENT_FILED` — partial **and** filed; five rows dropped the second half (§10).
2. `ENFORCED_AT_SURFACE_ONLY` — carries a pejorative that is wrong for a limb about display (`limb:ASR-9:8`).
3. `UNENFORCED_NO_SHAPE` — no field for a required thing **vs** no enforceable subject at all.

> **A closed vocabulary is a design artifact and it can be wrong, and the people who find out are the ones
> forced to choose a word for a case it did not anticipate.** The countermeasure is not a better vocabulary up
> front — it is making the operator's discomfort a first-class output. All three of these arrived through a
> free-text field (`armDoubt`, `owed`, a merge note) that existed for exactly that.

---

## 17. ⚠ ADDENDUM (V-6) — THE CLOSE CONDITION WAS SATISFIABLE WITH HALF THE DEBT OUTSTANDING

`ROADMAP-invariant-enforcement-mapping.md` sets this programme's close:

> *"`DIVERGENT_UNFILED` must be zero"* becomes *"`filing = UNFILED` must be zero across ALL verdicts"*

V-6 filed the 18 `UNFILED` rows as **REG-F-234..245 / REG-Q-058..062**, and that sentence is now true.
**It does not close the programme, and finding out why is this wave's real result.**

### 17.1 `NEAR_MISS` is the fourth two-claim value, and it is the one that sat on the close condition

A row owes a register entry exactly when **a search has been run and nothing covering the limb was
found**. `UNFILED` is that outcome when the search returned nothing. `NEAR_MISS` is the *same outcome*
when the search returned something that **does not cover it**. Whether a decoy turned up is a fact about
the corpus, not about the debt.

| | rows | |
|---|---|---|
| `UNFILED` | 18 → **0** | filed by V-6 |
| `NEAR_MISS` | **21** | searched, and what was found does not cover it |
| **owes a filing** | **39**, of which 18 discharged | |

**16 of the 21 say so in their own `owed`, verbatim** — *"A FILING IS OWED AND NOTHING RECORDS IT
TODAY"* (`ASR-11:3`), *"A REG-F FINDING IS OWED"* (`PER-12:4`, `PER-4:3`), *"NOT FILED today, checked
both directions"* (`ASR-16:6`). The `near_miss_filing` fields say it in the other direction, in section
headings the V-5 agents wrote unprompted: **"WHY IT DOES NOT COVER THIS LIMB"** (11 rows), **"WHAT
REMAINS OWED"**, **"WHAT THE ENTRY THAT FINALLY FILES THIS MUST SAY"**.

### 17.2 ⚠ THE FIVE THAT DENY IT ARE EXACTLY THE ORPHANED ONES, AND THE SEPARATION IS PERFECT

Six `NEAR_MISS` rows carried an `owed` authored for an arm they no longer hold. **All six were authored
for an `ENFORCED_*` arm; all six now hold an `UNENFORCED_*` arm.**

| row | `owed` written for | now holds | its `owed` opened |
|---|---|---|---|
| `PER-3:2`  | ENFORCED_BY_CONSTRUCTION | UNENFORCED_OBSERVED_ADMISSION | *(empty)* |
| `OBJ-3:2`  | ENFORCED_DRIVEN          | UNENFORCED_OBSERVED_ADMISSION | "Nothing for this row's arm" |
| `DEC-4:2`  | ENFORCED_BY_CONSTRUCTION | UNENFORCED_OBSERVED_ADMISSION | "none of them a refusal gap" |
| `DEC-4:6`  | ENFORCED_BY_CONSTRUCTION | UNENFORCED_OBSERVED_ADMISSION | "none of them a live hole" |
| `ASR-9:5`  | ENFORCED_BY_CONSTRUCTION | UNENFORCED_NO_SHAPE           | "NOTHING IS OWED AS A DEFECT" |
| `ASR-19:3` | ENFORCED_MULTI_SITE      | UNENFORCED_NO_SHAPE           | "A REG-F finding on a LATENT lever" |

**Every non-stale `NEAR_MISS` row affirms that a filing is owed — 15 of 15. Every denial comes from a
stale row — 5 of 6.** The denials were never judgments about the limb. They are §11 measured on a
population instead of a row: *a refuter overturns a scalar, and every field authored for the old scalar
survives, reading exactly like a field authored for the new one.*

### 17.3 The reading was confirmed blind, with a working negative control

§17.2 is a reading of prose, so it was re-established without prose. Eight rows went to eight agents
**with `owed`, `filing` and `near_miss_filing` stripped out** — no conclusion about filing was visible,
and the controls were unlabelled.

- **negative control** `limb:STA-4:8` (ENFORCED_DRIVEN / NOT_APPLICABLE) → **owes nothing** ✅
- **positive control** `limb:ASR-11:3` (non-stale NEAR_MISS) → **owes an entry** ✅
- **all six orphaned rows → owes an entry**, five at HIGH confidence, **each finding the stale narrative
  on its own and saying so unprompted**

The negative control returning `false` is what makes the six mean anything: an adjudicator that answers
"owed" to everything produces the same six. Their re-authored `owed` fields are now on the rows, with
the superseded text preserved in `owed_superseded` rather than deleted.

### 17.4 ⚠ A DECOY THAT CONCLUDES THE OPPOSITE IS A STRONGER REFUSAL THAN SILENCE

Every one of the eight rows had at least one near miss; four had **three**. They are not vague
neighbours — several are the single best hit a search returns:

- **`PER-3:2` → REG-F-222**, the only entry in any corpus that measures `StorageAdapter.commit`, which
  says verbatim: *"the chokepoint conjunct **HOLDS** and is deliberately **not filed**."*
- **`DEC-4:6` → `enforcement-register.ts:3589`** (RPH-CNS-002), whose `canonAnchor` **is this limb
  quoted verbatim** — and which concludes the opposite.
- **`ASR-19:3` →** a **docblock at the adjacent site, naming this invariant's own canon line.**
- **`PER-3:2` → `docs/_working/HARMONIZATION-FINDINGS.md:119`**, the exact site claim, filed under the
  heading **`## Refuted (32) — recorded so they are not re-raised`** and struck. ⚠ **At HEAD the gap is
  live** — `package.json:18` runs `depcruise packages`, and neither `apps/` rule in
  `.dependency-cruiser.cjs` constrains what `apps/` imports. That corpus carries an affirmative record
  that a real gap is not a gap. **The general form is the question: how many of the 32 are true at
  HEAD?** Derive it over all 32; hand-checking the two that surfaced is the defect one level up.

> **A missing filing invites a search. A filing that does not cover the limb ends one. A filing that
> records the limb as REFUTED ends every future one, and does it with the corpus's own authority.**

### 17.5 ⚠ AND THE GATE BUILT TO CATCH THIS COULD NOT SEE IT — DERIVED, NOT NOTICED

`verif/invariant-verdict-census.test.ts` carries an assertion named *"a live divergence whose owed was
written for an ENFORCED arm is named"*. It is this defect's detector. **It asserted `[]` and was green
while all six rows satisfied it in substance.**

It filtered `verdict === 'DIVERGENT'`. Before the ladder split that filter meant *"every row that can
owe a filing"*, because filing was a suffix on two arms and unsayable everywhere else. After the split,
`filing` is the axis that says who owes a filing, and `DIVERGENT` names 49 of 229.

**DERIVED over the file rather than noticed: 8 of its 36 assertions filter on `verdict === 'DIVERGENT'`.**
Each was complete when written; each silently narrowed the day the axes split. Three were the general
form and are re-keyed to `OWES_A_FILING = {UNFILED, NEAR_MISS}`; the cluster assertions are genuinely
scoped to the V-4e population and stay.

**The narrowing was demonstrated, not argued.** With a data mutant in place — one row re-orphaned
exactly the way a refuter overturn does it — **the pre-V-6 filter passes GREEN** and the re-keyed filter
fails naming `limb:DEC-4:2`. That is the measurement: not "the old filter looks too narrow", but "the
old filter is green on the defect it exists to catch".

### 17.6 The pattern, now four-for-four — and the cheaper instrument

`PARTIAL_DIVERGENT_FILED` (partial **and** filed) · `ENFORCED_AT_SURFACE_ONLY` (a pejorative wrong for a
limb about display) · `UNENFORCED_NO_SHAPE` (no field **vs** no subject) · **`NEAR_MISS` (a decoy **vs**
a filing)**.

The first three were found by an operator forced to choose a word for a case the vocabulary did not
anticipate, and §16.3 concluded the countermeasure was to make that discomfort a first-class output.
**That is still right and it is not the whole answer, because this one was found differently: by asking
what the close condition would actually be satisfied by.**

> **A vocabulary defect that touches the close condition is not found by an operator using the word —
> the operator has no reason to look at the close condition. It is found by reading the close condition
> against the data and asking whether the sentence and the intent still name the same set.** That check
> is one query. It should have run at the migration, and it would have found this three commits sooner.

### 17.7 ⚠ THE GENERAL FORM WAS RUN, AND THE ANSWER IS 15 OF 32

§17.4 ended by naming the question rather than the item: *"how many of the 32 are true at HEAD? Derive it
over all 32; hand-checking the two that surfaced is the defect one level up."* It was derived, all 32, each
at the site with a positive control.

| disposition | n | |
|---|---|---|
| ⚠ **TRUE AT HEAD** | **15** | the claim is accurate today — **13 of them owe a register entry** |
| REFUTED — FALSE at HEAD | 13 | rightly struck; the reason is now recorded |
| OUT OF SCOPE | 4 | accurate, but describes something JPWB does not attempt |

**The defect was not "the refutations are wrong."** 17 of 32 are sound — and several are sound for reasons
written at length *elsewhere in the repository and never carried back*: #2's lives at
`handlers/kit.ts:212-222`; #14's is **mandated** by `JPWB-DOC-003 §6:173` and `REG-Q-003`'s safe default,
so representing the axis would *breach* canon; #25 was carried into canon as `REG-Q-001` and CLOSED
2026-08-09.

> **The defect is that none of the 32 recorded a reason, so no reader could separate the sound ones from
> the live ones without redoing all 32 — which is exactly what the heading existed to prevent.** A sound
> refutation with an unwritten reason and a wrong refutation are, from outside, the same artifact.

### 17.8 ⚠ TWO OF MY OWN SPOT-CHECKS WERE WRONG, BOTH BY NAMED ERROR MODES

The sweep was launched off a 6-item hand sample. **The sweep contradicted two of those six**, and both
failures are ones this programme puts in every lane prompt:

- **#30** — called FALSE by reading `gate:fast`, which does run `e2e`. But the claim says *the CI gate*,
  and CI here is `.github/workflows/ci.yml`: six steps — build, check-types, lint, boundary, format:check,
  test — and it stops. `gate:fast` is a local script. **The wrong referent**, and `REG-005:4587`
  (REG-F-196) had already enumerated those six steps and used "CI" for exactly that file.
- **#27** — called FALSE by `grep 'rph-controller'` returning zero. The name exists only as a **regex
  alternation branch**, `^packages/rph-(…|controller|…)/`, so the literal string never appears anywhere.
  **A negative search with no positive control** — EM-2, the error mode this repository has recorded more
  than any other. `grep -c 'controller'` returns **4**; `grep -c 'authoring'` returns **0**, and
  `rph-authoring` is the package that transitively drags `better-sqlite3` into a browser bundle.

**Both were committed while calling the check cheap.** A cheap check is exactly where a control gets
skipped, and the two rows it got wrong were the two rows the whole sweep was launched to generalise.

### 17.9 THE REPAIR HAD TO NOT MOVE A LINE, AND THAT WAS ONLY FOUND BY LOOKING

The first repair rewrote the section in place, pushing all 32 items down ~30 lines. **Eleven citations
point into that region** — `invariant-verdicts.ndjson` at `:92 :104 :110 :119`, `docs/_working` at
`:110 :119 :120` (one written by §17.4 the same day), and **`JPWB-REG-005` at `:108` and `:110`.**

`REG-005`'s own `changeProcedure` is *"Append-only after ratification. Entries are never destructively
edited."* **Those two citations could not have been repaired afterwards.** The restructure would have left
two permanently dead pointers in ratified canon — the defect class the V-6 verifiers caught nine of, this
time authored by the repair rather than found by it.

> **An append-only artifact makes every line number it cites into a contract with the cited file.** The
> repair keeps lines 1-120 byte-identical except the heading, which is replaced by exactly one line, and
> appends every disposition after item 32 keyed by ITEM NUMBER — a reference that survives the next edit.

---

## 18. ⚠ ADDENDUM (V-7) — THE READING THAT DECIDED 21 LIMBS WAS TESTED, AND A RULE DOES NOT APPLY ITSELF

§17 argued that `NEAR_MISS` is `UNFILED` with a decoy attached, not a weaker `FILED`. **That argument
decided whether 21 limbs were debt or done, so it was put at risk rather than assumed.**

Every V-7 drafter was told, in the brief, that finding a limb ALREADY COVERED was a **win**; was handed
the prior reader's decoy enumeration as an **input rather than an authority**; and was required to open
each named filing at its line and read what it closes.

> **Not one of the 21 was covered.** The alternative reading was tested 21 times and failed 21 times.

That is the measurement §17 was owed. It also settles, retrospectively, the V-5 decision to spend a search
on `NOT_ESTABLISHED` rather than default it: the population that search created has now been fully
adjudicated and every row in it was real.

### 18.1 The decoys are worse than §17.4 could show, because one of them is FALSE

`limb:ASR-14:3`'s nearest filing is `RPH-GOV-006` (`enforcement-register.ts:3748`), whose `canonAnchor`
is **this limb quoted word for word**. Its aside — that canon's first clause *"is honoured on the floor
path"* — **went false on 2026-08-20**, when REG-F-202 deleted that consumer; `waiverStillDischarges` has
had zero production callers since, and `verif/dead-kernel-census.test.ts:88` says so in the repository's
own words. **The decoy is not merely narrower than the row. It is wrong in the direction that hides the
gap**, which upgrades the finding from *"one path missed it"* to *"the clause is enforced nowhere."*

Its drafter also found a **sixth decoy the census row had missed, and the most seductive of all**:
`REG-F-216`'s remedy (3) proposes making `resolveWaiverAuthorization` read `decision.waiver` *"as an eighth
ordered check"* — **this entry's exact function, at the exact ordinal this entry needs.** A reader who sees
REG-F-216 land will believe the row is fixed. It is not: that remedy is an **existence** predicate, and a
fully-detailed waiver carrying a decades-past `expiresAt` passes it. **Existence is not currency.**

> **The most dangerous decoy is not an adjacent entry. It is a landed remedy that touches your site.**

### 18.2 Three limbs whose halves have different fates — and the merge that would have lost one

`limb:OBJ-3:2`, `limb:ASR-16:6` and `limb:ASR-19:3` are each closed by a **FINDING and a QUESTION**: a code
defect right to fix under any reading, and a canon adjudication where writing a guard for the reading the
engine already implements would ratify the narrower one by accident.

**`filed_entry` is a single field, and the naive merge takes the last write.** That is worse than not
filing: a later reader closes the FINDING, sees the row point at it, and marks the limb discharged while
the ratification question is open. Both ordinals are now on the row with a stated reason, and a gate holds
the pairing — its mutant, dropping one split pointer, reddens two assertions and names the limb.

### 18.3 ⚠ A RULE YOU HAVE JUST DERIVED DOES NOT APPLY ITSELF TO THE CODE YOU WRITE WHILE DERIVING IT

§17.5 records that `verdict === 'DIVERGENT'` was a predicate **correct when written and silently wider the
day the vocabulary moved**, that 8 of 36 assertions had it, and that the fix is to re-key to a named
predicate. It was written, and committed, alongside a **new** assertion reading:

```ts
return m[1] === 'F' ? n >= 234 : n >= 58;   // "limbs closed by the V-6 batch"
```

**An open-ended ordinal range.** The moment V-7's entries landed it counted them too and reported **39**
where it means **18**. Same defect, same commit, eleven lines below the section documenting it.

> **Deriving a general form does not immunise the code you are writing while you derive it.** The habit
> that produces the defect is *"this bound is obviously right today"*, and that habit is not suspended by
> having just written down why it fails. The countermeasure is mechanical, not cognitive: **when a
> collection is a BATCH, pin both ends** — the next batch is the falsifier, and it always arrives.

### 18.4 Where the census stands

| | |
|---|---|
| filing axis | **`FILED` 229 · `NOT_APPLICABLE` 78** — the only two values left |
| register | **77 entries**: REG-F-203..262, REG-Q-053..069 |
| verification | **all three batches: 32/36, then 10/10, then 16/16 AMENDED.** No entry has ever survived it unchanged |

**Still open, and none of it is filing debt:** 37 stale `owed` fields (all on FILED or NOT_APPLICABLE rows,
where a stale `owed` misleads a reader but cannot misdirect a filing); the `UNENFORCED_NO_SHAPE` split
(§16.2, deferred twice); 11 recorded arm doubts; and the 13 register entries owed by
`HARMONIZATION-FINDINGS.md`'s re-dispositioned *"Refuted (32)"* (§17.7), tracked in `BACKLOG.md`.

---

## 19. ⚠ ADDENDUM — THE THIRD ORPHANED FIELD, AND THE FIRST ONE A GATE CAN SEE

§16.2 deferred splitting `UNENFORCED_NO_SHAPE` twice, for a stated reason: *"re-cutting a second arm one
commit after the first would re-open rows nobody has re-read."* **That condition has lapsed** — V-6 and V-7
filed every row on the arm that owed a filing, each drafted and adversarially verified. Going back to the
split found something better than the split.

### 19.1 The arm's defining field is empty on five rows, and the five are not a random five

`UNENFORCED_NO_SHAPE` asserts that canon requires something the model has no field for. `missing_shape` is
where the row says **which** — it is the arm's whole content. Without it the verdict is a word.

| | rows | `missing_shape` empty |
|---|---|---|
| refutation **HELD** (a refuter left the row here) | 14 | **0** |
| refutation **OVERTURNED** (a refuter moved the row here) | 12 | **5** |

**Zero of fourteen against five of twelve.** `LYR-3:1`, `AUT-2:1`, `LYR-1:1`, `ASR-19:3`, `ASR-9:5` — each
superseding an `ENFORCED_*` or `PARTIAL` verdict.

**The mechanism is the same one §11 records, one field further in.** `missing_shape` is authored by the
LANE, for the arm the LANE assigned. When a refuter changes the arm, the field the *new* arm requires was
never written, and nothing notices — the row simply carries a verdict it cannot substantiate.

⚠ **And the field is not exclusive to this arm** — 49 rows on other arms carry a `missing_shape`. So the
five empties are not *"the field belongs elsewhere"*. They are the arm's own claim, unstated.

### 19.2 ⚠ THIS IS THE THIRD FIELD, AND THE FIRST ONE THAT IS MECHANICALLY DETECTABLE

1. **`owed`** (§11, §17.2) — six `NEAR_MISS` rows carried an `owed` written for an `ENFORCED_*` arm, five of
   them *denying anything was owed*. Found by a **blind adjudication with a negative control**.
2. **`evidence`** — `DEC-4:2`'s pillar (2) was **affirmatively false** for the arm the row ended on, quoting
   a drive that proved the superseded verdict. Found by an agent reading it whole.
3. **`missing_shape`** — found by **asking whether the field was there.**

> **Prose authored for a dead verdict reads exactly like prose authored for the live one — that is why the
> first two needed a blind reader. But an ARM WHOSE DEFINING FIELD IS EMPTY can be found by a query.**

The generalisation is cheap and worth stating: **for every arm, name the field that carries its content,
and gate that the field is present.** An arm whose content is optional is a word, and a word cannot be
falsified. This is `feedback_check_the_instrument_itself` applied to the vocabulary rather than the gate.

### 19.3 Pinned as a shrink-only debt, with three mutants because it has three assertions

The five are **pinned, not fixed**: authoring a `missing_shape` needs the site evidence, and stamping the
field to clear a gate is the REG-F-043 failure this repository has already recorded. The list may only
shrink; a sixth reddens it.

Each of the block's three assertions has **its own** mutant, because a control that only fires when the main
assertion passes proves nothing (`feedback_a_control_that_cannot_fail`):

| assertion | mutant | what it reports |
|---|---|---|
| the pinned list of five | empty a sixth row's field | *expected 5, got 6* |
| — same — | empty **all 26** (vacuity) | *expected 5, got 26* |
| **no HELD row is silent** | empty a HELD row **and add it to the pinned list**, so the list still matches | *"a HELD row on this arm has no excuse for silence"* |
| **21 rows do state their shape** | the same mutant | *expected 20 to be 21* |

⚠ **The third mutant took two attempts, and the first attempt is the lesson.** I emptied `limb:PER-9:6`
believing it was HELD without checking; it is OVERTURNED, so `heldSilent` correctly stayed empty and only
the count control fired. **A control exercised by the wrong mutant looks exercised.** Re-run against
`limb:LYR-3:3`, verified HELD by assertion inside the mutant script itself, it fires with its own message.

### 19.4 The split itself is still owed, and the criterion is now sharper

The two meanings §16.2 identified are still both live on the arm, and the filing axis separates them **by
accident rather than by construction**: the two "no enforceable subject" rows (`PER-11:2`, `PER-12:2`) are
`NOT_APPLICABLE` and the other 24 are `FILED`. That works only while nobody wrongly files one of them, and
`verdict` is supposed to state what the code does **independently of what the record says**.

⚠ **But `missing_shape` does not separate them either, and that is worth recording before the next attempt:**
`PER-11:2`'s reads *"There is no field, command or event that could carry the forbidden arrangement,
**because the limb has no forbidden arrangement**"* — the no-subject claim, stated in the field meant for
the other one. `PER-12:2`'s reads like an ordinary shape census. **The decisive text is in `evidence`, which
opens "THIS LIMB ASSERTS A FACT ABOUT THE WORLD" on both.** A future split should key on that, and should
DERIVE its population over all 26 rather than inherit V-5's hand-picked pair — hand-listing an exception
set is the defect one level up, and this programme has already measured it once as *"said 2, was 8"*.
