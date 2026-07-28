> ## Reconciler's note — read this before the sheet
>
> **What the sponsor ruled (2026-07-28):** the `docs/Constitution Discussion/` documents are strongly related, were
> authored as orthogonal coverage of gaps the RPH corpus did not reach, and their standing outside the RPH
> authority ladder is an artifact of *how they were generated* rather than a judgement on their merit — so their
> status can be upgraded.
>
> **This sheet does not refuse that ruling. It prices it, one document at a time.** That distinction is the whole
> point: CON-000 B2 reserves conferral to the sponsor, REG-D-013 bars blanket ratification, and B3 routes
> precedence by concern — so the ruling takes effect through per-document acts rather than a folder-level one. What
> follows is the material those acts need; the checkbox column is where the ruling is actually exercised.
>
> **A methodological caveat I owe the reader, because it shaped the result.** I wrote the adversarial challengers
> with an explicit instruction to *default to refusing admission unless it was positively justified*. Eight
> admit-recommendations were challenged and eight were overturned. **A clean sweep in the direction the instrument
> was biased toward is evidence about the instrument as much as about the documents**, and it should be read that
> way. What survives the caveat is the part that does not depend on the challengers' prior: the **verified
> conflicts** in §3, each cited on both sides — and the fact that the register already anticipated this exact
> question. **REG-Q-047**'s safe default reads *"any adoption as conformance criteria requires a Decision"*; the
> sponsor's ruling is that Decision.
>
> **Verified by the reconciler, independently of the agents:** B1's SPEC-nnn and working-reference classes
> (`JPWB-CON-000:97`); REG-Q-047 verbatim; `organizationId` → **0 occurrences** across `packages/*/src` and
> `apps/rph-demo/src`, which is what makes JCUX §4's route root divergent from 100% of the built tree; the
> `DOC-004 §12.2 / JCPWA §36.4` co-citation at `governance.ts:330` and `waiver-rules.test.ts:3`; and DOC-002:248-249
> mapping `Endeavor` → **Undertaking** while forbidding a second competing root term without a Decision.
>
> **Recommendation in one line:** admit nothing as-is; take **Q9** and **Q10** now — both are independent of every
> other mark, and Q9 is a live mis-citation in the write path — and treat **JCUX/RIWS as commissioned source** for a
> screen-contract SPEC rather than as authority. That gives the ruling its full effect without making a v0.1.0 draft
> binding over working code it disagrees with.
>
> — prepared by the coding agent under the 2026-07-28 ruling; **confers nothing** (B2).

---

# JPWB Constitution-Discussion Set — Conferral Sheet (proposed)

On 2026-07-28 the sponsor ruled that the documents in `docs/Constitution Discussion/` — naming *JanumiCode UI Information Architecture and Screen Contract* as the exemplar — "are actually strongly related and were created as orthogonal documentation to address some of the gaps that the RPH documentation did not cover," and that "we can certainly upgrade / update their status even though they are outside the RPH authority ladder." This sheet takes that ruling as settled on **value and direction**, and does not relitigate it. What it does is convert that direction into the per-document material a conferral requires: for each of the twelve documents, its self-declared identity, the single concern it owns in B3 vocabulary, the canon artifact that already owns that concern, whether it agrees with the built code, a proposed slot, and — for every document a mark of ADMIT would reach — the exact list of things that become violations of working code on the day the mark is made. **This sheet confers nothing.** CON-000 B2 reserves conferral to the sponsor ("Ratification is a sponsor act; an agent's best-judgment resolution is a proposal logged for confirmation, not a conferral"), and B5 makes even the sponsor's own 2026-07-28 statement not-yet-effective until it lands as REG-005 entries ("A ruling made in conversation is not effective until it lands as a REG-005 entry and is merged into its governing artifact"). Every status word below is a proposal and every checkbox is empty.

---

## 1. The mechanism, and why no amendment is needed

CON-000 B1 (`docs/canon/JPWB-CON-000 Constitution.md:97`, read verbatim in preparing this sheet) already recognises two classes beyond the six artifacts: **the JPWB-SPEC-nnn series** — "one per subsystem, each individually ratified per REG-005, layer Semantic Model, settledness HYPOTHESIS, subordinate to JPWB-DOC-003 by concern" — and **program working references** — "design documents, roadmaps, and program-scoped specifications authored under a registered sponsor grant, each grant a REG-005 entry naming scope and standing, holding HYPOTHESIS-grade authority within their program's scope and subordinate to every canon artifact by concern." So nothing in the sponsor's ruling requires a constitutional amendment; it requires **ratification acts**. The one thing required per document is a REG-005 entry: for a SPEC, individual ratification plus REG-D-009's pairing with "enforced repository reference artifacts that cite the spec sections they implement"; for a working reference, a grant "naming scope and standing." Two standing bars constrain every row below. REG-D-013 forbids blanket ratification and bulk disposition (success is measured by guarantee-strength, never economy), so "admit the folder" is not an available answer and neither is "admit the document" without an itemized instrument. And B3 routes precedence **by concern** — a document restating a concern DOC-002, DOC-003 or DOC-004 already owns is not a SPEC candidate but either a conflict to file or historical material.

Two further constraints shaped every row. B7 (`CON-000:119`): "Asserted status must be performed status… A shape reference that no type check or conformance test enforces asserts a status nothing performs." And the operative precedent for what a working-reference grant costs: REG-D-017 → REG-D-018 (JAN-CSAA), a two-stage instrument with sixteen itemized dispositions W0-01..W0-16, a grant that **precedes** the authoring, and per-member adoption bound to an exact version and SHA-256 digest (`JPWB-REG-005:538-576`).

---

## 2. Dispositions — one row per document

**Adjudication of the adversarial review.** Eight of the twelve assessments recommended PROGRAM_WORKING_REFERENCE; all eight were challenged and overturned to NEEDS_SPONSOR_RULING. **I took the challenges in all eight cases**, and none of them is visibly weaker than the assessment it displaced. They converge on one argument I could not fault and independently confirmed: B1's working-reference class admits documents "authored **under** a registered sponsor grant," and the only instance of the class ever conferred (JAN-CSAA) establishes a grant that precedes authoring, names a bounded program perimeter, and adopts each member at an exact digest. Every document here predates the canon's operative act (REG-D-010, 2026-07-24), was authored under no grant, and belongs to no commissioned program. Each challenge additionally produced verified conflicts the assessment missed — several of them inside the residue the assessment had declared safe — and each showed that the proposed excision lists did not reach every locus of the clause they excised, which is itself a B7 failure against the grant. The four unchallenged rows stand as assessed. The result is that **this sheet proposes no admissions today**; it proposes ten rulings and two retirements. That is a deliberate outcome, not a stalemate: the sponsor's ruling is preserved intact, and the acts that would give it effect are put in front of the sponsor rather than performed on their behalf.

| Document | Self-declared id / status | Concern (B3 vocabulary) | Canon artifact owning that concern | Agrees with code? | Proposed slot | Sponsor mark |
|---|---|---|---|---|---|---|
| *(none proposed)* | — | — | — | — | **SPEC_CANDIDATE** | — |
| *(none proposed)* | — | — | — | — | **PROGRAM_WORKING_REFERENCE** | — |
| Canonical Professional Cognition Ontology | JAN-CPCO-001 @ 0.1.0 · **Draft** | Semantic structure and invariants, at whole-platform scope; also names canonical entity types | **DOC-003** (structure/state/invariants); **DOC-002** (naming) | **MIXED** — flat 14-state PWU lifecycle vs four axes; `Professional Endeavor` root absent from code | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Janumi Semantic Definition Language | JAN-JSDL-001 @ 0.1.0 · **Draft** | (a) source-language + toolchain design; (b) restatement of DOC-003's model, claimed as its **upstream** | **DOC-003** for (b); no owner for (a) | **MIXED** — single-axis `PwuLifecycle`, mandatory `cognitiveState`, `aggregateVersion` | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| JSDL Compiler Architecture and Bootstrap Implementation Spec | JAN-JSDLC-001 @ 0.1.0 · **Draft** | Build-time toolchain architecture; §53 agent instructions; §54 a rule-of-recognition claim | None for the toolchain; **DOC-004** for §53; **CON-000 B1** for §54 | **UNBUILT + CONFLICTS** — §19 rules fire against built transition tables; §34.2/§54 vs five working generators | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Janumi Execution Model (JEM) | JAN-JEM-001 @ 0.1.0 · **Draft** | Execution semantics + wire shapes; runtime mechanism | **DOC-003 §9** (PER-1..12); **the repository** (shapes); **DOC-001** (coordination) | **MIXED** — envelopes, error contract, statuses and RPH states all diverge from strict schemas | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Janumi Single-Node Runtime Profile | JAN-JSRP-001 @ 0.1.0 · **Draft** | Deployment and runtime topology; §82 agent contract | None for topology (AX-10 severs it); **DOC-004** for §82; **DOC-003** for §33 | **MIXED** — Postgres SHALL vs SQLite; two state columns vs four axes; table shapes | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| JanumiCode Professional Work Architecture Profile | JAN-JCPWA-001 @ 0.1.0 · **Draft** | Domain-product profile: PWU types, roles, requirements, release/ops, agent contract, UI | **DOC-002** (JanumiCode/PWA boundary); **DOC-003**; **DOC-004**; **the repository** | **MIXED** — §36.4 weaker than ASR-14 **and already cited in shipped code**; 48 rival messages | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Shape Engineering Handbook | JAN-SEH-001 @ 0.1.0 · **Draft** | The method by which a PWA is derived — 15 phases, roles, templates, maturity, conformance | **DOC-001 §5** (discipline boundaries); **DOC-002 §4** (the names); **DOC-004** | **MIXED** — §14.4/§26 field lists rejected by strict schemas; §46/§47 rival command spellings | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Canonical Projection Model | JAN-CPM-001 @ 0.1.0 · **Draft** | Projection derivation, identity, query, zoom, time, workspace composition, role views | **DOC-001 §3.4/§7** (doctrine); **DOC-003 PER-7/AUT-1** (authority); **DOC-002 §5** (naming) | **MIXED** — two-axis state as a *command guard*; §30 set omits Assurance and Baseline | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Reference Interaction and Workspace Specification | JAN-RIWS-001 @ 0.1.0 · **Draft** | Interaction-and-workspace shape of the JPWB projection surface | **DOC-001 §7** (doctrine); **DOC-003** (state meaning); **DOC-004** (§42) | **MIXED** — nine sites require cognitive state and none requires assurance; §15.4 unsatisfiable | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| JanumiCode UI Information Architecture and Screen Contract | JAN-JCUX-001 @ 0.1.0 · **Draft** | Enumerated shape of the JanumiCode product's projection surface (67 screens) | **DOC-001 §7** (doctrine); **the repository** (shapes); **RPH-DOC-010** (incumbent, unregistered) | **MIXED** — 6/6 built routes non-conformant; two-axis header at eight loci | NEEDS_SPONSOR_RULING | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Professional Work Unit Aggregate Specification | JAN-PWU-001 @ 0.1.0 · **Draft** | Semantic structure of the PWU aggregate — objects, state, transitions, invariants | **DOC-003** (verbatim its concern, at higher fidelity) | **CONFLICTS** — 2 axes vs 4; 4 of 16 lifecycle values survive; 1 of 43 command spellings | HISTORICAL | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |
| Janumi Semantic Definition Language (conceptual overview) | JAN-JSDL-002 @ 0.1.0 · **Superseded by JAN-JSDL-001** | Claims DOC-002+DOC-003+DOC-004+repository as one generated source | **DOC-003**, **DOC-002**, **the repository** | **UNBUILT** — states no checkable proposition | HISTORICAL | ☐ ADMIT ☐ AMEND ☐ REJECT ☐ DEFER |

Two administrative notes the marks depend on. The register already holds live entries over most of this material and, per REG-005 §1, an OPEN entry's recorded safe default **binds today**: REG-Q-047 (RIWS/JCUX corpus — "non-canonical design material… any adoption as conformance criteria requires a Decision", `JPWB-REG-005:411-414`), REG-Q-046 (SEH — and its third clause, quoted in full below), REG-Q-045 (Product-Realization content ceded to the seeded PWA), REG-Q-015 (CPCO/JSDL), REG-Q-016 (runtime topology), REG-Q-003 (state axes), REG-Q-035 (JCPWA's own decomposition text), REG-Q-049/REG-Q-050 (production-facing gates, deferred), REG-E-007 ("JSDL remains demoted", `:487`). Second: REG-Q-047's line citation `L27700-30230` covers JCUX only — RIWS originates at `docs/Constitution Discussion/retired/Janumi Constitution Discussion.md:8977` — so disposing of the pair should correct that citation rather than silently under-scope it.

---

## 3. Admission costs — what becomes a violation on the day each is admitted

No document is proposed for admission. This section therefore prices the mark itself: for each of the ten NEEDS_SPONSOR_RULING rows, what a ☑ ADMIT would make true. The load-order fact that makes these costs real rather than theoretical: **DOC-004 §2.1 places program working references at rung 5, above the repository at rung 6** — an implementing agent reads the admitted document *before* it opens the contract that contradicts it — and DOC-004 §3.3/§6.3 then require every applicable SHALL to be extracted into a requirement ledger and answered at completion, where "An unaccounted ledger entry is a concealed gap."

**Verification note.** Items marked **[V]** I verified myself in preparing this sheet, read-only, against the tree. Items marked **[R]** are reported by the assessment or the adversarial review and are not re-verified here; where the two disagreed I say so.

### JAN-JCPWA-001 — JanumiCode Professional Work Architecture Profile

- **A weakened waiver contract is already in the write path, and admission would ratify it. [V]** `packages/rph-application/src/handlers/governance.ts:330` and `:355` reject a waiver request with the message "(DOC-004 §12.2 / **JCPWA §36.4** — a waiver may not drop a control to nothing)", and the enforcing test carries the same citation at `packages/rph-application/src/handlers/waiver-rules.test.ts:3`. I confirmed all three occurrences. JCPWA §36.4 requires six waiver fields; DOC-003 ASR-14 requires the exact policy, criterion, finding, object **and semantic version**, and downstream impact — the bindings ASR-14's own WHY calls the difference between a waiver and "the universal solvent of every other invariant." Today this is a defect (an enforced guard sourcing authority from historical material, B1). On admission it becomes a sanctioned reading. **This one needs fixing regardless of any disposition** (see Q9).
- **A second, disjoint message registry. [R]** §71's 21 Commands and §70's 27 Events return zero hits each against `packages/rph-contracts/src/messages.ts`; the built vocabulary is `CaptureIntent / ProposePwu / MarkPwuReady / AdmitEvidence / ApproveDecision / PromoteBaseline`… Zero name overlap. REG-Q-006 and REG-Q-015 both carry binding safe defaults against exactly this.
- **The frame canon guards by name.** §1 and §78 model JanumiCode as one PWA; CON-000 AX-11 and DOC-002 §1's guard ("JanumiCode ≠ a single PWA. Prevents: the most common legacy conflation") forbid it, and REG-Q-002 names `JCPWA` as a stray draft name.
- **Five single-axis status chains** (§19.4, §34.2, §36.3, §41.2, §45.2) against four orthogonal axes at `packages/rph-contracts/src/objects.ts:423-426` **[V]** and AX-1. §34.2's `approved → merged → deployed` is the counterfeit DOC-003 ASR-17 names outright.
- **`Endeavor` throughout** vs DOC-002 §8's retirement to **Undertaking**; `endeavor` returns **0 occurrences** across `packages/**/src/**/*.ts` and `apps/rph-demo/src` **[V]**.
- **§29 weakens B7** from an absolute to a SHOULD, inside the corpus that defines it.

### JAN-CPCO-001 — Canonical Professional Cognition Ontology

- **A second whole-platform semantic model at the same settledness class.** §1 declares itself "the canonical semantic layer from which those implementation artifacts are derived" over DOC-003's identical object set. B3's tiebreak ("on conflict within a concern, the higher settledness class controls") cannot separate two HYPOTHESIS artifacts, so every disagreement lands as a residual SEMANTIC_CONFLICT — the dual-authority condition DOC-003 AUT-1 forbids by name.
- **§7.4's flat 14-value PWU lifecycle** folds `awaiting_evidence` / `awaiting_review` into work lifecycle — the exact collapse DOC-003 STA-1 forbids — against the four axes at `objects.ts:423-426` **[V]**. REG-Q-003's safe default already binds: "Persist only the state axes ratified in JPWB-DOC-003 and the repository contracts… Never map states by similar labels" (`JPWB-REG-005:185`) **[V]**.
- **§5.1 makes `Professional Endeavor` the root object** and §18.1 makes it a required entity; the code carries `UNDERTAKING` and zero `endeavor` **[V]**.
- **§12's INV-001..020 renumbering** re-enters after DOC-003 §1 retired legacy invariant numbering with the source corpus.

### JAN-JSDL-001 — Janumi Semantic Definition Language

- **The single-axis lifecycle is structurally incapable of the program's central axiom. [R]** §15/§30 declare one `PwuLifecycle` of 16 states; `packages/rph-contracts/schemas/objects/ProfessionalWorkUnit.json` puts all four axes in `required`, and the four schemas are declared at `packages/rph-contracts/src/enums.ts` **[V, four axes confirmed at `objects.ts:423-426`]**. One enum cannot hold execution and assurance independently, so admission would put **CON-000 AX-1 and DOC-003 STA-1 in violation by the canon's own act**, not merely leave the code non-conformant.
- **§30 `PWU_INV_003` makes `cognitiveState` mandatory and non-null**; `cognitiveState` returns **0 occurrences** across `packages/**/src/**/*.ts` and `apps/rph-demo/src` **[V]**, and DOC-003 §6 already ruled that model additive-only.
- **§1/§43 invert subordination**, asserting DOC-003's content is generated from JSDL — the opposite of B1's "subordinate to JPWB-DOC-003 by concern."
- **The five working generators become non-conformant** under §34.2/§6.14/§54, taking the 107 enforced schemas with them.
- REG-E-007's recorded default is "JSDL remains demoted" **[V, `JPWB-REG-005:487`]**, and REG-Q-015 requires the L11370-11435 attribution be settled "before corpus retirement" **[V, `:246`]**.

### JAN-JSDLC-001 — JSDL Compiler Architecture

- **§54 is a rule-of-recognition claim** ("No generator may bypass the validated semantic model… the compiler therefore becomes the enforcement boundary"), which B1 vests in the repository's generated contracts and B3 reserves to CON-000. Subordination cannot cure this: it can only render §54 inert, and an inert clause asserting the compiler *is* the enforcement boundary is B7 vacuity.
- **All five generators are non-conformant on day one** under §34.2 ("Generators SHALL not… alter lifecycle semantics") and §6.14 ("consume the canonical IR only"); `gen-transitions.ts` by documented design expands umbrella from-states and lifts cross-axis rules out — i.e. does the semantic work §34.2 forbids. Blast radius: the 107 schemas plus the emitted transition tables, i.e. the repository's designated shape authority.
- **§18-§20 have no cross-axis concept**, while the built kernel's load-bearing element is exactly cross-axis: `packages/rph-domain/src/pwuGuards.ts` (`CROSS_AXIS_RULES`, `satisfiesP1`) is where INV-5/P1 is enforced **[R]**. The generic same-axis lifecycle model §19 assumes is the one the repo already recorded as unable to carry the axiom.
- **§19/§19.1 fire against the built machines. [R, not re-verified]** Reported: `ExecutionStep.stepState` declares FAILED terminal and then transitions FAILED→QUEUED for retry; two machines have no initial state; 18 of 27 contain unreachable states, worst case `PWU.assuranceState` where SATISFIED is unreachable from `NOT_REQUIRED`. Under B6's docs-win presumption the *tables* would be the losing party — an 18-item divergence backlog against the kernel created by a records decision. (These same checks have real diagnostic value; see Q8.)
- **A 100-item backlog and a self-commission** (§50, §51, §52, §55) enter the registry for a program with zero authorized packages.

### JAN-JEM-001 — Janumi Execution Model

- **JEM-conformant commands and events are actively rejected, not merely unimplemented.** §5's 16-field command envelope vs the 12-field `z.strictObject` at `packages/rph-contracts/src/envelopes.ts:72-87`, and §17.1's 18-field event envelope vs the 13-field `DomainEventSchema` **[R]**. `expectedVersion`, `tenantId`, `organizationId`, `professionalContext`, `originatingProjection` return zero hits (`organizationId` **[V]** 0 across packages+apps). Because the schemas are strict, a conforming producer fails at the boundary.
- **§41's 10-field error contract** vs the 7-field `RphErrorSchema`; **§57.1's lowercase statuses** vs `CommandResultStatusSchema` at `packages/rph-contracts/src/enums.ts:234-242` (6 SCREAMING_SNAKE values) **[V]**; **§40's 8 failure taxa** vs `RphErrorCategorySchema` at `:672-684` (10 values, including `ASSURANCE` and `EXECUTION`, which JEM has no taxon for) **[V]**; **§22.1's 16 RPH states** vs `HarnessStatusSchema` at `:463-474` (9 values) **[V]**.
- **§25.5 is sponsor-overruled text.** "The runtime SHALL not require storage of private model chain-of-thought" vs DOC-003 PER-12 as ruled at REG-D-015 (retain-but-never-forward). The register already names this sentence as the divergence source.
- **§56 declares the shipped runtime non-conformant** ("A runtime profile is JEM-conformant only if…" incl. durable Process Instances) against the five tables in `packages/rph-persistence/src/schema.ts` **[R]**.
- The Coding Agent Guide already demoted JEM and forbade implementing its alternative lifecycle; `docs/canon/_design-brief.md:158` instructed "verify and preserve the demotion" **[R]**. Admission reverses three recorded acts with no superseding entry.

### JAN-JSRP-001 — Janumi Single-Node Runtime Profile

- **§10.1's two state columns** (`lifecycle_state`, `validity_state`) against four ratified axes **[V]** — an AX-1 (CONSTITUTIONAL, level 0) breach, and REG-Q-003's "Never map states by similar labels" trips precisely because `lifecycle_state` reads as a plausible alias.
- **§7's "PostgreSQL SHALL serve as the initial authoritative transactional store"** against `better-sqlite3` as the only DB dependency; `packages/rph-persistence/src/schema.ts:1-6` already frames the relationship correctly as a deliberate re-expression **[R]**. As written, §7 makes the shipped persistence layer non-conformant by fiat.
- **Table and enum shapes.** §13.1's nine lowercase command statuses vs `CommandReceiptStatusSchema = z.enum(['PROCESSING','ACCEPTED','REJECTED'])` at `enums.ts:230` **[V]**; §16.2's five lowercase outbox states vs the two the adapter writes **[R]**; §15.1/§16.1's required columns absent from `domain_events` / `outbox_messages` **[R]**.
- **§17.1/§20/§21/§22 are the parallel scheduler REG-Q-016's safe default forbids** ("do not build a parallel scheduler", `JPWB-REG-005:250`) **[V]**.
- **§§44-52, 53-59, 72-77 reopen sponsor-deferred ground by the forbidden route.** REG-Q-049/REG-Q-050: "Not yet applicable — JPWB is pre-production. Becomes mandatory at the first production-facing slice; adoption is by assurance-policy authoring under the REG-D-012 pattern… **never by ad-hoc CI accretion**" (`JPWB-REG-005:424`, `:430`) **[V]**. There is no Dockerfile, compose file or deployment manifest in the tree to satisfy them with **[R]**.
- **§82's twenty coding-agent SHALLs and §82.20's rival divergence route** (document deviations as Architecture Decisions) compete with DOC-004 §8 and REG-005 as the recording venue — two authorities on the one concern where a wrong answer corrupts every subsequent finding.
- **Twelve P0 `MUST`s are pre-armed. [R]** `docs/Constitution Discussion/janumi_self_instantiating_normative_implementation_roadmap_v0.3/control/requirement-register.csv` already derives `JAN-REQ-OPS-001..012` from JSRP sections, each with a named verifying test, each `UNASSESSED`. REG-D-011's intake would inherit all twelve.

### JAN-SEH-001 — Shape Engineering Handbook

- **A stop-work clause is in force and has already been breached.** REG-Q-046's safe default, quoted in full: "Treat the Shape Engineering Handbook content as historical evidence only; adopt any portion into JPWB-DOC-001 via a Decision; **PWA-authoring work beyond the existing seeded ontology stops for that Decision**" (`JPWB-REG-005:408`) **[V]** — the third clause was dropped in the assessment. The repository has shipped `packages/rph-authoring/`, `packages/rph-application/src/handlers/pwa-authoring.ts`, `apps/rph-demo/src/routes/pwa/[id]/` and seven governed PWA commands in its teeth. A grant that closes REG-Q-046 silently launders that breach, which B7 forbids ("never quietly documented around").
- **Every PWA the workbench can author fails conformance immediately.** §4's 18 SHALL-outputs, §28's 12 conformance points, §42's PWA-001..025 and §49's 14-point test against a built PWA object of six id-lists — including the seeded Product Realization PWA canon holds up as the existence proof **[R]**.
- **§14.4's twelve mandatory PWU-type fields** vs the strict `PwuTypeSchema`: six have no counterpart and are rejected at the boundary; `applicableCognitiveStates` would make a cognitive-state set a mandatory per-type field against DOC-003 §6 **[R]**. §4 item 11 makes a "Professional Cognition Lifecycle Profile" a mandatory *deliverable* — a rival lifecycle, in no proposed exclusion.
- **§26's decision-record template manufactures non-authority**: it omits subject identity, subject semantic version, decision type and effective time, all of which DOC-003 ASR-15 requires, and names the field `selectedApproach` where the built strict `DecisionObjectSchema` names it `selectedOption` **[R]**.
- **§46/§47 mint rival spellings for governed acts** (`CreatePwuType` vs `DefinePwuType`, `ApprovePwaRelease` vs `PublishPwa`, `SupersedePwaVersion` vs `Deprecate/RetirePwa`) while the paired event `PwuTypeDefined` agrees — the signature of drift, not of an alternative design **[R]**.
- **§17.4's eleven "canonical workspace classes"** dissolve DOC-001 §7.1's Assurance/Governance separation, which DOC-001 calls "deliberate and load-bearing."
- **The excision list does not reach its own target. [R]** Fourteen JSDL loci and four CPCO loci fall outside the proposed exclusions — including the document's own `**Produces:**` header at line 10, §40's review battery, §41's `├── jsdl/` layout and §54's meta-RPH — six of them inside the ten sections the assessment called the case for admission.
- **A rival rule of recognition travels with it. [V]** `docs/Constitution Discussion/README.md:705-721` ranks "1. Constitution 2. CPCO 3. Shape Engineering Handbook 4. Professional Work Architecture 5. JSDL…" and states "Higher documents govern lower documents." I read it verbatim. Rung 1 is not JPWB-CON-000. This is document-rank precedence against B3's precedence-by-concern.

### JAN-CPM-001 — Canonical Projection Model

- **Cognitive state as a command-eligibility guard.** §11.1's Command Region "Displays only commands valid for: current lifecycle state; current cognitive state…" **[R]** — that is not "projection/focus metadata," which is the outer bound REG-Q-003's binding safe default allows **[V]**. `cognitiveState` is 0 across packages+apps **[V]**.
- **§30's Minimum Viable Projection Set omits Assurance and Baseline entirely** — reported: the words "assurance," "baseline" and "waiver" occur zero times in the document's 2,326 lines **[R]** — against DOC-001 §7.1's five contexts, `packages/rph-projections/src/assurance-view.ts`, and the built `/decisions` and `/baselines` routes **[V, routes confirmed]**. Conforming to §30 deletes the assurance projection the code already performs.
- **§10.8 enumerates nine Reconciliation states** in prose — a state enumeration B3 reserves to the repository, and one no enum in the tree carries.
- **Ten of thirteen §10 command spellings return zero hits**, including `RejectDecision` where the registry spells it `RevokeDecision` **[R]**.
- **§32's twenty coding-agent SHALLs** land on DOC-004's concern; **§19's twelve-verb grammar** re-installs the pre-restructuring grammar against DOC-001 §7.5's nine primary plus seven explicitly-HYPOTHESIS supporting verbs.
- **§35 commissions RIWS as "the next required document,"** reactivating the corpus REG-Q-047's safe default demoted.

### JAN-RIWS-001 — Reference Interaction and Workspace Specification

- **The defect is an omission, and omissions cannot be excised.** Every required-information block — §9.1, §9.2, §12.2, §20.3, §33.3, §36.2, §38.4, §41-A, §43 (nine sites, reported) **[R]** — mandates Lifecycle + Cognitive and **never** requires execution or assurance state. A surface built to §12.2 satisfies RIWS and violates DOC-003 STA-1's SCOPE clause, which binds "every projection that renders it: execution success and assurance satisfaction must remain visually distinct." The built page already renders three axes as separate columns (`apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:196-200`) **[R]**.
- **§15.4 is an unsatisfiable SHALL over a closed canon enum.** It requires evidence to be classified Supports / Contradicts / **Qualifies** / **Inconclusive For**; `TraceRelationSchema` at `packages/rph-contracts/src/enums.ts:732-751` is a closed 17-value set with neither **[V, location and closure confirmed]**, and DOC-003 REL-1 makes the *membership* of that vocabulary canon-governed. Conformance would require amending a superior artifact.
- **§26.4's six error classes have no assurance and no execution class** against `RphErrorCategorySchema` (`enums.ts:672-684`) **[V]**, six of whose codes are mapped to `ASSURANCE` **[R]**. Independence violations would have to be presented as "Validation Failure" — the AX-1 collapse at the error surface.
- **§11.1's ten projections omit Assurance and Baseline** against the built seven-tab selector **[R]**.
- **§22.5's attention dispositions** drop `superseded` and the review condition and add `Not Applicable` / `Duplicate` — dismissal-shaped values with no canon meaning, against DOC-003 §3's fixed vocabulary and "Persists across restart until explicit disposition."
- **§5.3's PWA selector** lists JanumiCode / JanumiScience / JanumiLegal / JanumiConstruction as PWAs against DOC-002 §1's guard and AX-11.
- **Ground the assessment called safely unbuilt is built. [R]** Breadcrumbs (`pwa/[id]/+page.svelte:844`), a collapsible inspector (`:1210-1230`), zoom controls, a projection selector and an agent chat with a persisted `AuthoringConversation` all exist. They do not become unbuilt obligations; they become **instantly divergent surfaces** — §7's six breadcrumb SHALLs, §10.3's "critical conditions SHALL not be hidden solely because a panel is collapsed," §35.3's pre-execution disclosure list.
- **The dependency closure imports the retired PCLC and CPCO by normative reference** (§5.3, §23.4).

### JAN-JCUX-001 — JanumiCode UI Information Architecture and Screen Contract

- **100% of the built route surface goes divergent.** §4 roots every route at `/{organizationId}/`; the built tree is `/`, `/undertakings`, `/undertakings/[id]`, `/pwa/[id]`, `/decisions`, `/baselines` **[V]**, and `organizationId` returns **0 occurrences** across packages and apps **[V]**. Divergent on both the missing segment and the path names (`/endeavors` vs `/undertakings`).
- **The two-axis header survives excision-by-ID. [R]** Striking §7 SCREEN-INV-003 leaves the rule operative at §5.5 (L224), §13 (L636), §14 (L680), §55 (L2299 `CognitiveStateBadge`), §56 (L2339), §76 (L2827) and, if §75 is not also struck, §75.5 (L2802). §13 offers **Cognitive State as a filterable field**, which cannot be implemented without persisting exactly what DOC-002 §8 forbids persisting — an implementable instruction to build the prohibited machine.
- **One word, two concerns. [V]** §6.2 lists `conflicted` as a transient UI command state; `RecompositionContractStatusSchema` at `packages/rph-contracts/src/enums.ts:617-627` binds `CONFLICTED` to a governed recomposition outcome. I confirmed the enum. A spinner and an AX-4 recomposition failure would share a term.
- **36 named components against 11 authored `.svelte` files. [V — I enumerated them]** None of `AppShell`, `GlobalHeader`, `CognitiveBreadcrumb`, `ContextInspector` exists.
- **§57-§60's endpoint and envelope shapes** (`GET /projections/…`, `POST /commands/create-pwu`) against 64 in-process PascalCase commands and a single dispatch route; `/commands/` returns zero hits **[R]**.
- **§20's "Canonical Structure"** drops Claim, Evidence, Assurance Assessment, Decision and Baseline from the traceability spine DOC-003 REL-4 fixes — the entire assurance leg, under the word "Canonical."
- **A 62-obligation ledger attaches to every future UI change. [R]** 62 SHALL-bearing lines, zero mapped to any implementation site or verifying test, against DOC-004 §3.3 and §6.3.
- **Three competing top-level navigations become two declared authorities.** JCUX §3's eleven destinations, RPH-DOC-010 §5's five, DOC-001 §7.1's five contexts — and the code's **four** (`apps/rph-demo/src/routes/+layout.svelte:59-64`: PWA Library, Undertakings, Decisions, Baselines) **[V — correcting both assessments, which said five]**. DOC-003 AUT-1: "authority must be designed and declared."

---

## 4. What each admitted SPEC must be paired with

**No document on this sheet is proposed for the JPWB-SPEC-nnn tier, and the reason is uniform:** REG-D-009 requires a SPEC be "paired with enforced repository reference artifacts that cite the spec sections they implement," and B1 adds that "a shape reference that no type check or conformance test enforces asserts a status nothing performs (B7)." For all twelve documents that pairing count is **zero** — a conferral today would breach B7 on the day it was signed.

**What the pairing looks like when it is real, verified in preparing this sheet.** `packages/rph-application/src/handlers/dwp05-precondition-coverage.test.ts:2` cites `JAN-CMDPRE-SPEC-001 §5` **[V]**, and `JAN-PRPWA-DS-001` is cited by section across more than twenty enforced artifacts and tests — `packages/rph-contracts/src/enums.ts:426` (`STD-2 / R-9` on `executionBoundary`), `packages/rph-application/src/handlers/pwa-authoring.ts:234, 439, 659` (INV-1/STD-3), `packages/rph-authoring/src/lint.ts:12`, `broker.ts:66, 68`, `packages/rph-projections/src/{pwa-graph,leaf,calibration}.ts`, plus their test suites **[V]**. That is the REG-D-009 shape, exercised, working.

**A verified anomaly the sponsor should see, because it bears directly on Q10 and on how realistic any future pairing is.** Neither `JAN-PRPWA-DS-001` nor `JAN-CMDPRE-SPEC-001` appears anywhere in `docs/canon/` — 0 occurrences across all six artifacts and every provenance sidecar; the only hits in the canon tree are in the non-canonical working file `docs/canon/_test/cycles/` **[V]**. That file records why B1's working-reference class exists at all: finding F8, "Sponsor-granted program working references (e.g. JAN-CMDPRE-SPEC-001) have no recognized class, no register record, no load-order discovery path," and refinement S-07, which created the class to fix it **[V, `cycle-000-report.md:38, 99`]**. The class was built for authorities granted to a **program of construction** — and it has never been used for the two that provoked it. The only registered grant to date is JAN-CSAA (REG-D-017/REG-D-018).

Per document, if the sponsor commissions a SPEC rather than admitting a draft:

| Candidate ground | What exists today | What would have to be built first | Realistic now? |
|---|---|---|---|
| Projection / workbench surface (RIWS + JCUX + CPM as sources) | `apps/rph-demo/e2e` (30+ Playwright suites), four of which already cite RPH-DOC-010 sections in the REG-D-009 style **[R]** | Per-section citations in those suites; a screen-contract conformance fixture; a state-axis rendering test proving execution and assurance stay visually distinct (STA-1) | **Yes** — the mechanism exists and is exercised; it has simply never been pointed at these documents |
| Product Realization content (JCPWA §14/§19-21/§50) | The seeded PWA (`packages/rph-engine/src/seed-workbench.ts`, `packages/rph-product-realization-pwa/src/ontology.data.ts` with three enforcing suites) **[R]** | Nothing new for the ceded content — REG-Q-045 already routes it to the seed; new projection artifacts for §55's Product Realization Map | Partly — but this is cession to a **shape** artifact, not admission of a document |
| Execution / persistence (JEM) | `envelopes.ts`, `errors.ts`, `schema.ts`, the outbox and receipt tests — all citing **RPH-DOC-007 / DOC-009** instead **[R]** | Re-sourcing 117 existing citations, or a migration Decision | **No** — the ground is occupied by an enforced rival |
| Runtime topology (JSRP) | Nothing — no Dockerfile, compose file, or deployment manifest in the tree **[R]** | An entire deployment-artifact plane before any obligation could be cited | **No** — the pairing could not be met even in principle today |
| Compiler / generation (JSDLC + JSDL-001) | Five canon-grounded generators and 107 enforced schemas, generated from vocab JSON **[R]** | Re-expressing the pipeline in JSDL and regenerating — gated by REG-Q-015's "maps them losslessly and supplies migrations and conformance" | **No** — but §19/§19.1's *checks* can be built as repository conformance tests with no conferral at all (Q8) |
| Shape Engineering method (SEH) | Nothing citing it; `packages/rph-authoring/src/lint.ts` is the nearest surface and it cites `JAN-PRPWA-DS-001`, with advisory-only severities **[R]** | A PWA-completeness gate over §4's outputs, a maturity assessment over §29, a review-battery fixture over §40 — all from scratch | **No** |

---

## 5. Questions only the sponsor can settle

**Q1 — Which ladder did the 2026-07-28 ruling mean?**
The folder runs its own manifest (JAN-DOCS-001) with an independent status ladder — `docs/Constitution Discussion/README.md:52` (Draft/Proposed/Normative/Deprecated/Superseded) and `:640` "Only a document with `Status: Normative` is binding" — and that README is itself Draft and outside B1's registry, so under B1 it is historical material and B2 gives its ladder no conferring power. "Upgrade / update their status" reads onto that ladder as naturally as onto B1's registry, and the two differ materially: Draft→Normative there creates a side-canon binding on coding agents *outside* the registry; a B1 act creates subordinate authority *inside* it.
*Options:* (a) B1 registry only; (b) JAN-DOCS-001 ladder; (c) both.
*Recommended default:* **(a)**, with the ruling also disclaiming `README.md:705-721`'s nine-rung "Source of Truth" ladder **[V]** — a document-rank rule of recognition that REG-005 records was deliberately designed out ("REG-D-002/D-005/D-006 and the rule of recognition replace document-level authority claims entirely").

**Q2 — REG-E-007: is the L11370-11435 JSDL-pivot turn a sponsor commissioning ruling?**
Its recorded default is "recorded as probable-sponsor, unratified; JSDL remains demoted" (`JPWB-REG-005:487`) **[V]**, and REG-Q-015 states the attribution must be confirmed or disclaimed **before corpus retirement**, after which it becomes unfalsifiable (`:246`) **[V]**.
*Options:* confirm / disclaim / defer.
*Recommended default:* **disclaim** — the demotion stands. This is the one question with a closing window, and it gates JSDL-001, JSDLC and (by normative reference) JSRP.

**Q3 — REG-Q-015: does CPCO's and JSDL's standing change?**
Safe default in force: "Use CPCO as doctrine, projection, or declared extension only. Do not add canonical tables, discriminators, Commands, or JSDL-generated contracts until a Decision maps them losslessly and supplies migrations and conformance" (`:245`) **[V]**.
*Recommended default:* **safe default stands**; if CPCO is to live, as a bounded grant excluding §7.4 (PWU lifecycle), §8.5, §5.1 (Endeavor as root), §2's loop-as-lifecycle and §18.1's required-entity list — never as a whole-platform semantic layer.

**Q4 — The information architecture: which model is the workbench's navigation?**
Five statements are live: DOC-001 §7.1's five contexts (authority model); RIWS §6.1's ten destinations; JCUX §3's eleven; RPH-DOC-010 §5's five; and the code's **four** (`+layout.svelte:59-64`) **[V]**. DOC-003 AUT-1 forbids leaving this undeclared.
*Options:* (a) DOC-001 §7.1's five contexts are the authority model only, and any rail is a permitted projection over it; (b) they are the navigation model, and every rival rail is non-conformant; (c) commission a Decision that fixes one rail.
*Recommended default:* **(a)**, recorded in REG-005, with the note that the built four-destination rail lacks the Assurance and Governance contexts DOC-001 calls "deliberate and load-bearing" — which is a divergence to file, not a defect to hide.

**Q5 — REG-Q-016: DBOS versus custom PostgreSQL workers.**
Safe default: "do not build a parallel scheduler" (`:250`) **[V]**; JSRP §17.1/§20/§21/§22 is that scheduler.
*Options:* (a) safe default continues to control build decisions, JSRP is design input only; (b) reopen as a decision brief and rule before any runtime work.
*Recommended default:* **(a)** — it costs nothing today and preserves (b) for when a runtime program is actually commissioned.

**Q6 — REG-Q-046's stop-work clause: what happens to the PWA-authoring work already shipped?**
The clause is in force (`:408`) **[V]** and `packages/rph-authoring/`, `pwa-authoring.ts`, `/pwa/[id]` and seven governed PWA commands were built under it.
*Options:* (a) file the breach as a B7/B5 divergence finding, then dispose of REG-Q-046 on the record; (b) ratify the shipped work retrospectively in the same act; (c) leave both unaddressed.
*Recommended default:* **(a) then (b) in one instrument** — B7 forbids (c) ("never quietly documented around").

**Q7 — Is there a program, and what is its perimeter?**
B1 admits working references "authored under a registered sponsor grant… within their program's scope." No program covers any of these ten documents.
*Options:* (a) no program — the documents remain historical evidence under their current safe defaults; (b) commission one bounded program (recommended perimeter: **the JanumiCode projection/workbench surface**, the ground where the sponsor's premise verifiably holds); (c) commission several.
*Recommended default:* **(b), one program, after a decision brief** — and REG-D-017's shape: a grant that precedes authoring, an itemized instrument, per-member exact-version/digest adoption. (c) reproduces inside the working-reference tier the dual-authority defect B3 exists to prevent — a live example is that JAN-PRPWA and JAN-JCPWA would otherwise both claim the Product-Realization concern.

**Q8 — Vehicle: bounded grant over a corrected residue, or commissioned JPWB-SPEC-nnn using these as source?**
REG-D-009's sequencing is decision brief → sponsor rules forks → SPEC commissioned → reference artifacts → implementation; REG-D-018 shows adoption at an exact digest after review.
*Recommended default:* **commission**, with RIWS as principal source, RPH-DOC-010 as incumbent-behaviour source, and JCUX/CPM as screen-level input. Two things can start immediately at zero governance cost and should: point existing e2e suites at the commissioned spec's sections as they are written, and build JSDLC §19/§19.1's lifecycle checks as **repository conformance tests** over `packages/rph-domain/vocab/m2-transitions.json` — that captures the compiler document's real value (reachability and terminal-state defects in the built machines) while transferring authority *to* the code, as B6 and REG-D-009's SPEC-lifecycle clause direct.

**Q9 — The `JCPWA §36.4` citation in the write path.**
`packages/rph-application/src/handlers/governance.ts:330, :355` and `packages/rph-application/src/handlers/waiver-rules.test.ts:3` cite a document B1 classes as historical material as co-authority for a waiver guard **[V — I read all three]**.
*Options:* (a) re-source to DOC-004 §12.2 alone and file the finding; (b) retain pending disposition.
*Recommended default:* **(a), now** — it is independent of every other mark on this sheet, and until it is done any grant touching JCPWA ratifies a waiver contract weaker than ASR-14 by accident.

**Q10 — The two unregistered program authorities.**
`JAN-PRPWA-DS-001` and `JAN-CMDPRE-SPEC-001` are cited by name and section across shipped enforced artifacts, and appear **nowhere** in the canon (`docs/canon/` returns 0 outside `_test/cycles`) **[V]**. This is finding F8 exactly, still open, and it is the gap S-07 created B1's newest class to close.
*Options:* (a) file two retrospective REG-005 grants naming scope and standing; (b) strip the citations; (c) leave as is.
*Recommended default:* **(a)** — it is the correct first use of the class, it costs two entries, and it makes the class's real bar visible before any of the ten documents on this sheet is measured against it.

**Q11 — REG-Q-047's scope and the RIWS/JCUX pair.**
The entry names both documents but cites only `L27700-30230` (JCUX); RIWS originates at `retired/Janumi Constitution Discussion.md:8977` **[R]**. JCUX also declares `Depends on: … RIWS v0.1`, so the pair cannot be disposed of singly.
*Recommended default:* dispose of them **jointly**, correct the citation in the same act, and state whether REG-Q-047's safe default is displaced or preserved.

**Q12 — Confirm the two proposed retirements.**
JAN-PWU-001 (its content is DOC-003's mature descendant; the two genuine residuals — §22.2 observation-variance classification, §26.4 temporary-incoherence record — should enter as a REG-005 finding proposing a DOC-003 amendment, not as a document) and JAN-JSDL-002 (self-declared **Superseded by JAN-JSDL-001**, a strict subset of its successor, and stating no checkable proposition).
*Recommended default:* **REJECT both for admission, retain as historical evidence**, with JAN-JSDL-002's disposition following whatever JAN-JSDL-001 receives under Q2/Q3.

---

**Scope of verification.** Read-only throughout; no build, test, lint, type-check or e2e run. Verified directly in preparing this sheet: CON-000 B1-B8 verbatim (`:95-121`); REG-005 entries D-013, D-017, D-018, Q-003, Q-015, Q-016, Q-035, Q-046, Q-047, Q-049, Q-050, Q-052, E-007; the four state axes (`packages/rph-contracts/src/objects.ts:423-426`); six enum declarations (`packages/rph-contracts/src/enums.ts:230, 234, 463, 617, 672, 732`); the three `JCPWA §36.4` citations; the built nav rail (`apps/rph-demo/src/routes/+layout.svelte:59-64`); the 11 `.svelte` files and 6 route pages under `apps/rph-demo/src`; the `JAN-PRPWA-DS-001` / `JAN-CMDPRE-SPEC-001` citation set and their zero presence in `docs/canon`; `cycle-000-report.md:38, 99` (F8/S-07); `docs/Constitution Discussion/README.md:705-721`. Zero-occurrence claims I ran myself, untruncated, over `packages/**/src/**/*.ts` and `apps/rph-demo/src`: `jsdl`, `endeavor`, `cognitiveState`/`cognitive_state`, `organizationId` — all 0. Every other factual claim is attributed **[R]** to the assessment or adversarial review that produced it and is offered as their claim about their search, not as an independent finding of this sheet.