# DESIGN — Corpus roles, precedence, and the absence rule

**Status:** DRAFT for sponsor decision. Authored 2026-08-09 by the build agent under the sponsor's explicit
instruction *"You may author the precedence design."* **This document decides nothing that canon reserves**; the
decisions it proposes are listed in §7 and are the sponsor's.

**Occasion:** REG-F-093. The sponsor asked whether the answers I had escalated as *"canon does not define this"*
might be in the RPH documents. Four of six were. This design addresses the mechanism that produced that, not the
six instances.

---

## 1. The problem, measured

I searched `docs/canon/` and recorded the result as a fact about **the corpus**. Costs, all on 2026-08-09 and all
independently verified before being written here:

| What I recorded | What was true |
|---|---|
| W-3 blocked: *"needs an authored total mapping with the lossy cases named"* | **REG-D-004** — already in the register, sponsor-participated — delegates shapes to the repository. The mapping was derivable from the machine: four dispositions with exactly one in-arrow each from `ASSESSING`; `INCONCLUSIVE`/`VALIDATOR_FAILED` are not axis values, and **REG-Q-011's safe default already said the axis does not advance**. |
| REG-F-083: *"`BLOCKED` is not in `terminalStates`, yet…"* | The ratified Canonical Domain Model contains the word **"terminal" zero times**. `terminalStates` is a repository shape; my headline was a fact about code. |
| REG-F-092: *"canon defines no fact for shape degradation"* | **STA-7** (JPWB-DOC-003 §6) names the triggers and routes them to the work axis, where `ReshapePwu`/`InvalidatePwu` already implement them. I read §6 for STA-1 **the same day** and did not read on. |
| Agent prompt: *"`docs/Constitution Discussion/` — LOWER AUTHORITY"* | `docs/canon/_extracts/` contains **`extract-condisc-*`**. It is a canon **source**. |

**The shape of the error is not carelessness.** `docs/canon/` is a *distillation*. Reading a summary, finding a
detail absent, and concluding the source is silent is a valid-looking inference that is wrong by construction —
and nothing in the corpus or my habits made it expensive to make.

## 2. What already exists — this design must not reinvent it

Verified present before proposing anything:

- **Per-section derivation is already recorded.** Every canon document has a `.provenance.md` sidecar mapping each
  section to its sources with line ranges, e.g. *"AGG-1: extract-doc002-a.md (RPH-DOC-002 L190-270);
  extract-doc009-b.md (Persistence Design L2455)"*. **52 extract files** mediate under `docs/canon/_extracts/`.
- **The RPH set declares its own internal order.** `docs/Recursive Professional Harness/README.md`: *"Read them in
  the authoritative order below rather than in generation order"*, plus a named naming/product-boundary authority.
- **Shapes are already delegated.** **REG-D-004**: *"The repository — generated contracts, schemas, migrations,
  conformance tests — is authoritative for exact shapes: wire envelopes, JSON schemas, enum spellings, ID
  prefixes, error codes."*
- **M0 is the ancestor of this document, and its limits are already recorded.** `JPWB Reconciliation Ratify Sheet
  (M0)` (2026-07-10) states an authority precedence in its preamble — *"domain invariants > reference-fixture
  convenience · assurance/authority (DOC-004) > legacy phase behavior · latest serialized contract (DOC-007)
  governs envelopes/ids/errors/TraceRelation · canonical semantics > DB/UI convenience"*. **It is INTRA-corpus**
  (reconciling drift among RPH-DOC-001..009) and **predates canon by two weeks** (REG-D-010, 2026-07-24), so it
  cannot speak to canon-vs-source. Its standing is already open under **REG-Q-026** (*"ratified by the party whose
  work it gates"*), which also records that **"the sheet retires with the corpus"** and carries its eleven items
  forward self-contained. The register states it is *"the ENTRY-DISCIPLINE precedent — the model this register
  imitates"*, and CON-000's clause B2 is grounded in *"the M0 precedent tension"*.

**So M0 is not wrong and not merely stale — it answered a different question, and its retirement was planned.**

## 3. What is genuinely absent

**Inter-corpus precedence.** Searched with positive controls; no artifact states which governs when
`docs/canon/` and a source corpus disagree, nor what canon's silence on a detail means. That single gap produced
every row in §1.

## 4. Design — roles, not liveness

The sponsor proposed marking the RPH corpus *"active or some such operative state"*. **The intent is right; the
axis is wrong.** Active-vs-dormant would create two co-equal authorities with no conflict rule, replacing an
unstated precedence with an unstated tie. Classify by **role**:

| Role | Members | Governs | Ratified? |
|---|---|---|---|
| **DISTILLATION** | `docs/canon/` (CON-000, DOC-001..004, SPEC-001, REG-005) | Principle, invariant, doctrine | Yes — REG-D-010; Ratify Sheet R1 open |
| **SOURCE OF RECORD** | `docs/Recursive Professional Harness/`, `docs/Constitution Discussion/`, the Coding Agent Guide | Detail: state values, field shapes, transition matrices, worked scenarios | No — and it does not need to be to be authoritative for detail |
| **DELEGATED SHAPE** | the repository (generated contracts, schemas, conformance tests) | Exact shapes | Yes — REG-D-004 |
| **PROGRAM REFERENCE** | `JAN-CMDPRE-SPEC-001`, JAN-EXECPLAN/EXECREM working papers | Deep analysis; cites, never confers | No — self-labelled *"v0.1.0 DRAFT … not canon"* |
| **RETIRING** | `JPWB Reconciliation Ratify Sheet (M0)` | Historical; §C carried into REG-Q-026 | Build-agent self-ratified; open per REG-Q-026 |

## 5. Precedence — resolved BY QUESTION TYPE, not by a linear ranking

A single ordering is what makes this hard; the honest model is that authority depends on **what is being asked**.

1. **Principle / invariant / doctrine** → **DISTILLATION governs.** Canon passed a ratification act; the sources
   did not.
2. **Detail** — a state's meaning, a matrix, a scenario, a field's semantics → **SOURCE OF RECORD governs.** Canon
   is silent here *by design*, because distillation drops detail. **Canon's silence on a detail is not evidence.**
3. **Exact shape** — enum spelling, error code, wire envelope, id prefix → **REPOSITORY governs** (REG-D-004).
4. **Program reference** never confers authority; it may only *cite*. Where it defers (e.g. JAN-CMDPRE-SPEC-001 §7
   defers guard MEANINGS to DOC-003 §6-§8), follow the pointer — that is how STA-7 was eventually found.
5. **⚠ Canon contradicting its own source on a principle is a FINDING, not a resolution.** Canon wins operationally
   so work is not blocked, and the contradiction is registered — because canon was *derived from* that source, so a
   conflict means the distillation lost something or the source is stale. **Silently preferring canon would erase
   the evidence.** (§7 D-1: the sponsor may rule otherwise.)

## 6. The absence rule — the load-bearing clause

> **An absence recorded against `docs/canon/` alone is not a finding.** Before a "not defined / unspecified /
> canon is silent" claim may block an increment or be escalated, it must state (a) that the SOURCE OF RECORD
> corpora were searched, (b) which documents, and (c) a **positive control** — a term known to be present in each
> searched file, with its hit count.

The positive-control clause is not ceremony. Four instrument failures on 2026-08-09 each produced a false zero
indistinguishable from a real one: a probe that ran a string method on objects and returned 0 for *every* machine
including healthy ones; a mutant that never applied because `\n` met a CRLF file; a provenance reader that read an
array as a map and returned `OTHER` for all 27; and two corpus searches against `docs/canon/JPWB-DOC-002` — a
**311-line stub** containing zero occurrences of `ControlAction`, `workLifecycleState`, `SATISFIED` or `7.5`,
while the `DOC-002 §7.5` the code cites lives in the RPH Canonical Domain Model.

## 7. Decisions this design does NOT make — for the sponsor

- ~~**D-1 · Does canon outrank its own source on a PRINCIPLE conflict?** Recommendation: **yes, operationally, and
  register the conflict**. Ruling otherwise makes canon advisory, which contradicts REG-D-010.~~
  **SUPERSEDED SAME DAY BY REG-F-094 — THE QUESTION WAS ALREADY DECIDED AND I DID NOT FIND IT.** **REG-D-006** /
  **CON-000 B8** already rule that retired sources *"have no authority and must not be consulted as authority"*, so
  "canon outranks" is the RATIFIED position, not my proposal; the sponsor's inclination is a **reversal**, which
  must be recorded as one. The rule was never fully executed (16 + 13 top-level source docs remain agent-visible
  beside populated `retired/` folders), and canon's own sidecars cite documents inside `retired/` — **so B8 as
  written makes canon unauditable and must be amended whichever way D-1 is ruled.** Revised recommendation:
  **divergence must be TRACEABLE** — canon governs only where its divergence carries a ratifying act (the
  `PER-12`/REG-D-015 model); a silent divergence makes the canon clause defective, not governing. Measured basis:
  87 clauses audited — 49 FAITHFUL, 23 LOSSY, 10 UNSOURCED, 5 DIVERGENT, and the unratified divergences all
  **weaken prohibitions** (`ASR-14`, `ASR-16`).
- **D-2 · Do the SOURCE OF RECORD corpora need ratification?** Recommendation: **no.** They are authoritative for
  detail as source material; ratifying 60+ exploratory documents would be a large act for little gain. But this is
  a governance question, not a build one.
- **D-3 · Formal retirement of M0.** REG-Q-026 says it *"retires with the corpus"*. Recommendation: retire by
  striking with a pointer, never deletion — its precedence preamble and its role as the register's model are
  historically load-bearing.
- **D-4 · Where the precedence statement LIVES.** Recommendation: **CON-000 or DOC-004**, so it is ratifiable and
  binding on agents. Placing it in `_working/` would leave it exactly as dismissible as the corpus it describes.

## 8. Enforcement — a roadmap, not prose

Prose rots; this session has three same-day instances of a written rule failing to bind. A separate roadmap will
sequence:

- **P-1** State §4–§6 in a ratifiable canon location (D-4), with M0 struck and pointed forward (D-3).
- **P-2** Make the derivation reachable at the point of use — the sidecars already hold canon§ → source lines;
  that mapping should be **queryable**, so an agent standing on a canon section can ask what it was distilled from
  rather than having to know the sidecar exists.
- **P-3** Gate the absence rule: a control asserting that register entries claiming an absence name their searched
  sources. Its own mutant must be a fabricated absence entry that the control catches.

## 9. What this design does not claim

- It does not claim the six escalated questions are resolved — REG-F-093 records four reframed, two still owed.
- It does not claim M0 is wrong. M0 answered intra-RPH drift correctly and predates the layer that created this gap.
- It does not claim the corpus is disorganised. The derivation model is **more** rigorous than I assumed; the defect
  is that it is not reachable at the moment the wrong inference is cheap.
- It does not resolve whether the source corpora contain further answers to currently-open questions. The 12-agent
  sweep covered six; **the rest of the register has not been re-examined under the absence rule.**
