# DESIGN — `JAN-CRITREAD` L3: `recordCriterionResult`, the ratified command nobody built

**Rules:** `RPH-CON-005`, `RPH-ASR-004`, `RPH-ASR-005` · **Date:** 2026-09-20
**Findings:** `REG-F-420`, `REG-F-421` (its predecessors), `REG-F-422` (this pass)
**Status:** design only, nothing implemented

---

## 0. ⛔⛔ Four design calls opened this pass. Twelve reviewers refuted all four.

This design is written **after** an adversarial panel (four calls × three lenses, each instructed to refute)
returned **12 refutations and no survivals**. Every finding below was verified against the corpus before it was
accepted. What follows is the corrected position, not the one I started with.

| call as I stated it | verdict |
|---|---|
| modeled on `recordAssuranceObservation` **and** `submitEvidenceForAssessment`, taking no arrow | ⛔ incoherent — they are structurally opposite, and one of them takes an arrow |
| the payload is derived; **only the event name is authored** | ⛔ **inverted** — the event name is RATIFIED; the payload is what is authored |
| criterion results fold from the event stream, no object change | ⚠ survives in direction, but the gate's comparand is unsettled |
| the floor dispatching it **unblocks `CR-02`** | ⛔ false — `CR-02` reads a different channel, and there are four exposed sites, not one |

---

## 1. The subject: three ratified names, none of them built

| piece | where it is ratified | built? |
|---|---|---|
| **command** `recordCriterionResult` | §32 Assurance Commands, catalog `:1843` | ⛔ no |
| **event** `AssuranceCriterionEvaluated` | §31 Assurance Events, catalog `:1774`, inside the fence `text id="yl7ymv"` | ⛔ no |
| **binding** command → event | §26.5 clarification, catalog `:1813-1816` | ⛔ n/a |
| **leaf shape** `CriterionResult` | §20.1 → `objects.ts:238` | ⚠ declared, referenced by nothing |

The §26.5 note binds them as a set, verbatim:

> *"This §31 list adds the **assurance-assessment-internal lifecycle** events — … **`AssuranceCriterionEvaluated`**
> … — the fine steps that drive the §30 state machine … and are **produced by the §32 commands**
> (`submitEvidenceForAssessment`, `selectAssuranceEvaluator`, `beginAssuranceAssessment`,
> **`recordCriterionResult`**)."*

Six events, four commands. The other three pair off unambiguously, so the pairing
`recordCriterionResult → AssuranceCriterionEvaluated` is **forced**, not chosen. ⚠ Recorded honestly: the
binding sentence is an *authored clarification under the §0.3 grant*, while the event NAME is inside the
ratified fence. The name is canon; the pairing is a ratified clarification of canon.

### 1.1 The census, derived — and it took three attempts

§32 names **14** commands. **11 are present** (8 exact + 3 under governance-plane aliases —
`RequestWaiver`/`GrantWaiver`/`DenyWaiver`, a naming difference `REG-Q-030` already ruled on). **3 are
missing:** `recordCriterionResult`, `invalidateAssuranceAssessment`, `expireAssuranceWaiver`.

⛔ **MY FIRST TWO CENSUSES WERE BOTH WRONG, AND THE SECOND PASSED ITS CONTROLS.** Pass 1 matched quoted
registry keys and reported all 14 unbuilt — the control (`completeAssuranceAssessment`) caught it. Pass 2
matched unquoted keys and reported **6** unbuilt — and *both* controls passed, because they happen to match
exactly while the waiver family does not. ⭑ A control proves an instrument **discriminates**, not that it
measures what you named it after.

⚠ The three are not alike. `invalidateAssuranceAssessment` has two declared arrows
(`transitions.data.ts:1786,1794`) and its vocabulary absence is already registered
(`enforcement-register.ts:1011`). `recordCriterionResult` has no arrow and **three references in the whole
repository, all of them `completeAssuranceAssessment` noting its own absence** — `assurance.ts:2038`:
*"Criterion results ARE still dropped at the boundary: `recordCriterionResult` was never built."*

---

## 2. ⛔⛔ The event name is RATIFIED, and I nearly minted a divergence from it

I derived an event-naming rule across **21 handlers** — `<verb><Noun>` → `<Noun><VerbPast>`, exceptionless —
and concluded the name was `CriterionResultRecorded`, free and derived rather than authored.

**§31 ratifies `AssuranceCriterionEvaluated`.** My name would have put a second, divergent event into a
governed stream whose vocabulary canon already fixes.

⭐ **THE MISS IS THE INSTRUCTIVE PART.** §31 sits at catalog line **1763**. §32 — which I read, quoted, and
built the census on — sits at line **1836**. The ratified event list was **73 lines above the ratified command
list in a file I had open**. And the fence I failed to read contains `AssuranceObservationRecorded`, the very
name my 21-case rule was derived from. ⚠ The derivation was sound; the corpus was wrong. Rigor applied to the
wrong corpus reads exactly like rigor applied to the right one, which is why it survives review.

⭑ This is the **third** instance of one error class in this programme —
`REG-F-420` (grepped a coined noun, missed six dispatchers), `REG-F-421` (took a fixture's shape for the
repository's), and this. All three: *derived confidently from the wrong corpus.*

---

## 3. The template is `submitEvidenceForAssessment`. It is **not** `recordAssuranceObservation`.

I named both as "structural siblings". They are structurally **opposite**:

| | `submitEvidenceForAssessment` | `recordAssuranceObservation` |
|---|---|---|
| target aggregate | `ASSURANCE_ASSESSMENT` | `ASSURANCE_OBSERVATION` (a **mint**) |
| state window | `['EVIDENCE_PENDING','READY','ASSESSING']` | ⛔ none — only "the assessment exists" |
| moves the machine? | ⭑ **yes** — `EVIDENCE_PENDING → READY` | no |
| reaches the assessment? | yes | ⛔ **never writes it** |

⛔ **AND MY CALL DENIED THE ARROW THAT EXISTS.** `assurance.ts:1570-1575` computes `advancesToReady` and writes
`assessmentState: 'READY'`; `transitions.data.ts:1697` names the command verbatim as that arrow's trigger.

⚠ **`recordAssuranceObservation` IS THE WRONG TEMPLATE ON ITS OWN RECORD.** It mints a standalone object
carrying an `assessmentId` back-reference and never touches the assessment aggregate;
`AssuranceAssessment.observationIds` is set `[]` at creation (`assurance.ts:1390`) and only ever read back.
The panel names four open findings against it (`REG-F-213`, `REG-F-227`, `REG-F-259`, `REG-Q-072`).

⭐ **SO THE SHAPE IS `submitEvidenceForAssessment`'s, MINUS THE ARROW:** target `ASSURANCE_ASSESSMENT`, commit
**no state delta** beyond the envelope bump, and let the fact live on the event — the pattern that handler
states in its own words: *"The assessment SNAPSHOT is otherwise unchanged beyond the envelope bump — the
received-evidence fact lives on the EVENT."* Criterion results are recorded **within** `ASSESSING`, so no arrow
is taken; §31's note places these events on the chain that *ends* at `ASSESSING`.

---

## 4. What is ratified, and what this design must author

| piece | status |
|---|---|
| command name, event name, their binding, the §20.1 leaf shape | ⭐ **RATIFIED** — §1 |
| the **event payload** | ⛔ **AUTHORED** — no §21 contract for `AssuranceCriterionEvaluated` |
| the **accumulation site** the completion gate reads | ⛔ **OPEN** — §6 |

⭑ So the call was exactly **inverted**: I said the payload was derived and the name authored. The name is
canon; the payload is the authoring task — and it is the `Source TBD` class, which has its own route and is
**not** a licence to pick silently.

---

## 5. ⛔ The fabrication problem, measured rather than assumed

Ratified `CriterionResultSchema` (`objects.ts:238`) requires **all four** of
`criterionId`, `result`, `rationale`, `evidenceIds`. What the floor actually has:

| ratified field | `FloorCriterion` (`floor.ts:90`) |
|---|---|
| `criterionId` | ✅ present |
| `result` | ✅ `outcome`, same enum — a rename |
| `rationale` | ⚠ **optional, and populated only on FAILURE** — `validators.ts:322`: `...(f?.statement ? { rationale: f.statement } : {})` |
| `evidenceIds` | ⛔ **absent entirely** |

⛔ **THE OBVIOUS FIX IS A TRAP.** `floor-policies.ts` declares a `rationale` per criterion
(*"Floor step 1 (§8.4): a candidate that fails its contract cannot be admitted."*). That is the policy's reason
for **having** the criterion, not the assessment's reason for its **outcome**. Substituting one for the other
is the conflation this repository refuses, and it would read as a judgement nobody made.

⭐ **THE HONEST ROUTE EXISTS AND IS LOCAL.** `floor.ts:182-241` constructs each criterion with the deciding
fact in scope — `outcome: facts.schemaValid ? 'MET' : 'NOT_MET'`. A rationale that **reports what was
measured** is derived, not invented, and it is available at the only site that knows it.

⚠ `evidenceIds: []` for a structural floor criterion is **true, not empty-by-default**: the deterministic floor
examines the subject directly and considers no evidence objects. ⛔ But `[]` and "not asked" are
indistinguishable downstream, which is `REG-D-059`'s manufacture-from-silence shape — so this needs a decision,
not a default.

---

## 6. ⛔⛔ THIS DOES NOT UNBLOCK `CR-02`, AND CLAIMING IT DID WAS THE FOURTH REFUTED CALL

`CR-02`'s gate, as `REG-F-420` blocked it, reads **`validatorResult.claimResults`**. Dispatching N
`recordCriterionResult` commands does not change `claimResults: []` at `record-assurance.ts:183`. Under the
gate as specified, the floor is refused exactly as before.

⛔ **AND THE EXPOSURE IS FOUR SITES, NOT ONE.** Derived:

| production site | disposition | exposed? |
|---|---|---|
| `record-assurance.ts:165` | floor-computed, reaches SATISFIED | ⛔ yes |
| `reference-undertaking.ts:655` | **`SATISFIED` hardcoded, floor policy** | ⛔ yes — and it builds its `validatorResult` **inline, never touching `record-assurance.ts`** |
| `reference-undertaking.ts:1162` | caller's | ⛔ yes when positive |
| `declared-policy-signoff.ts:196` | caller's | ⛔ yes when positive |
| `+page.server.ts:1967` | SATISFIED | ✅ no — demo policy's only criterion is `MATERIAL` |
| `+page.server.ts:2073` | REJECTED | ✅ no — negative |

⭑ So `CR-02` needs its **subject** changed — to fold criterion results from the assessment's event log, the way
Gate A folds `AssuranceEvidenceReceived` — **and** every exposed producer wired. Those are two obligations, and
fusing them into one sentence is what made the fourth call false. **They are sequenced, not simultaneous.**

---

## 7. ⚠ The constraint that would have broken the build on the first commit

`packages/rph-contracts/src/messages.ts` is a **GENERATED FILE**:

> `// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:messages`.`
> `// Source: vocab/m3-commands-events.json`

`gen:check` is **step 3 of the 13-step `gate:fast`**; it re-runs every generator and compares. A hand edit fails
the gate at step 3. ⭐ So the command, its payload schema, the event, and their registry rows are all authored in
**one JSON file** and emitted — which is also why this increment is smaller than it looks.

⚠ And `command-dispatch-census` **refuses a declared command that nothing drives**
(`ROADMAP-assessment-lifecycle-restoration.md`), so the declaration and at least one driver must land in the
**same commit**.

---

## 8. `REG-F-209`, answered as an existing exposure rather than a new one

`recordCriterionResult` must validate its `criterionId` against the policy's declared criteria — fail closed,
exactly as `submitEvidenceForAssessment` validates `satisfiesRequirementId` against declared `requiredEvidence`
(`assurance.ts:1526-1534`). That loads the policy **fresh from the store**, and `EDITABLE_PATCH_FIELDS` contains
both `'criteria'` and `'requiredEvidence'` while `editAssurancePolicy` commits
`newSemanticVersion: loaded.semanticVersion` (`:400`).

⭐ **SO THE EXPOSURE IS NOT NEW — IT IS THE ONE THIS SITE ALREADY CARRIES FOR EVIDENCE.** `REG-F-209` (OPEN)
governs both. This design **discloses and cites** it; it does not repair it, and it must not be read as having
done so.

---

## 10. ⭐⭐ `CB-01` DECIDED — and canon classifies the whole question, five lines above the §32 list

§5 posed the payload as a choice between inventing a `rationale` and relaxing a ratified required field. **Both options were wrong, because the premise was.** The event payload was never §20.1's shape.

### 10.1 Canon's own classification of this exact condition-set

Catalog `:1828-1829`, verbatim:

> *“Both events are ratified **names** here but **schematized nowhere** in the corpus (DOC-007 omits them), and the §32 commands that would emit them are **not yet built**. **So it is a schema-and-wiring task, *not* a ratification decision.**”*

Canon says this of `AssuranceEvidenceRequired` and `AssuranceEvidenceReceived`. ⚠ Applying it to a third event is an INFERENCE, not a quotation — so state the inference: the three conditions hold **identically** for `AssuranceCriterionEvaluated`.

| condition | `AssuranceCriterionEvaluated` | how measured |
|---|---|---|
| ratified NAME in §31 | ✅ | catalog `:1774`, inside the fence |
| schematized nowhere in DOC-007 | ✅ | **0** hits in the Contract Package — control `AssuranceObservationRecorded` → **2** |
| its §32 command not built | ✅ | `REG-F-422`'s census |

⭐ **AND THE INFERENCE HAS A BUILT PRECEDENT, WHICH IS STRONGER THAN THE INFERENCE.** `AssuranceEvidenceReceived` was authored and shipped on exactly this basis. Its vocabulary entry records the convention verbatim: *“**UNRATIFIED-AUTHORED (2026-07-18, sponsor grant)**: DOC-004 §31 ratifies this event NAME; DOC-007 schematizes no interface for it … Fields **AUTHORED to source the §38 ‘missing evidence’ satisfaction side** … **Cited for the NAME only**.”*

⚠ **ONE DRIFT, RECORDED RATHER THAN COPIED.** That entry cites the licensing sentence as *“§31 L1783-1785”*; the sentence is now at **`:1828`** and L1783-1785 lands on the waiver events. The citation rotted with the document. This design cites the **phrase**, not the line — the repository's own rule (*never infer a § from a line number; quote byte-exact*), applied to the precedent I am following.

### 10.2 ⛔ THE DECISION: the payload is a RECEIPT, not a copy of §20.1

The sibling's payload is **not** the ratified `Evidence` object shape. It is `{assessmentId, evidenceId, satisfiesRequirementId, evidenceType?}` — the assessment, the thing, the **declared item it answers**, and one optional descriptor. ⭑ Transposed one axis over:

| field | required | why |
|---|---|---|
| `assessmentId` | ✅ | id-ref; mirrors the sibling exactly |
| `criterionId` | ✅ | id-ref — the `AssessmentCriterion` evaluated. Occupies `satisfiesRequirementId`'s role: **the declared item this answers** |
| `result` | ✅ | the ratified `CriterionResultOutcome` (`enums.ts:323`) — derived from canon, never restated |
| `rationale` | ⭑ **optional** | carried when the evaluator produced one, exactly as `evidenceType?` is. `validators.ts:322` supplies it on failure |

⛔ **AND `evidenceIds` IS EXCLUDED ON PRINCIPLE, NOT OMITTED.** No ratified consumer asks for it — §38's fourteen required view items do not include criterion results at all. Including it would force `[]` on every floor criterion, and `[]` is indistinguishable downstream from *not asked*, which is `REG-D-059`'s manufacture-from-silence shape. ⭑ A field nothing reads, carrying a value that cannot be told from silence, is two of this repository's recorded defects in one.

### 10.3 The discipline this follows, stated so the next author inherits it

⭐ **FIELDS ARE AUTHORED TO SOURCE A NAMED RATIFIED CONSUMER — never to mirror a domain type.** The sibling's fields exist to source §38's *“missing evidence”*. These exist to source `RPH-CON-005`'s coverage question (*which mandatory criteria were answered?*) and `RPH-ASR-005`'s disposition question (*did any come back undetermined?*). Both need exactly `criterionId` and `result`.

⭑ **WHAT THIS DISSOLVES.** §5's fabrication problem does not arise: nothing invents a `rationale` for a MET criterion, and nothing manufactures an `evidenceIds`. ⚠ §5 is left standing unedited — its measurements are correct and its trap (reusing `floor-policies.ts`'s per-criterion rationale) is still live for anyone who later widens this payload.

⚠ **WHAT THIS DOES *NOT* DECIDE.** §20.1's `CriterionResult` remains the shape a **validator result** carries, and remains referenced by nothing. This increment gives it no reader. That is `CR-02`'s question, and it stays open.

---

## 9. Exit

`recordCriterionResult` is dispatchable, emits the ratified `AssuranceCriterionEvaluated`, refuses a
`criterionId` the governing policy does not declare, and commits no state delta. Its payload is authored through
the `Source TBD` route with the §20.1 leaf as its basis, and the `rationale`/`evidenceIds` question in §5 is
**decided rather than defaulted**. ⛔ `CR-02` remains blocked: unblocking it is a *separate* increment that
changes the gate's subject and wires four producers.
