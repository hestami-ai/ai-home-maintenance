# RULING — RPH-DOC-003 §25–§35 and RPH-DOC-004 §15–§26 are ONE catalog, and they COMPOSE

**Status:** authored 2026-07-16 under the §0.3 grant, at the sponsor's direction ("synthesize and author a
solution"). **Derived from the two documents' own structure — not borrowed from the Coding Agent Guide.**
**Supersedes** the Increment-18 position that this was unresolvable and required a sponsor ruling.

---

## The question

I found (Increment 18, `e778b983`) that the assurance policy catalog is ratified **twice**: RPH-DOC-004 §15–§26
("Assurance Policy Catalog and Validator Contract", twelve policies) and RPH-DOC-003 §25–§35 ("Professional
Ontology and Assurance Policy Specification", eleven of the same policies) — with content in each that the other
lacks. I reported it as unresolvable, because the only tiebreaker on disk is the Coding Agent Guide's §17 source
map, and §16 item 1 says *"This guide is itself proposed."* Adjudicating two **ratified** documents with a
**proposed** one is the borrowed-authority error corrected in C1.

That framing was wrong — not because the guide is usable, but because **the question is not "which wins."**

## The finding: they were never in conflict

I looked for a contradiction across all twelve policies and **there is not one**. What is there is a near-exact
complementarity, and it is far too structured to be accidental.

### 1. DOC-004 dangles a term that only DOC-003 defines

DOC-004 uses "blocking" as a **load-bearing term it never defines**:

| policy | DOC-004 | DOC-003 |
|---|---|---|
| POL-INTENT-FIDELITY | §15.9: *"SATISFIED only when: **no blocking fidelity finding remains**; …"* — and §15 never says which findings block | §25 **Blocking conditions**: 4 of them |
| POL-BASELINE-PROMOTION | uses "blocking" **nine times**; never defines it | §35 **Blocking conditions**: 7 of them |
| POL-DECOMPOSITION-COVERAGE | §19.7: *"Any missing mandatory obligation or child intent divergence is blocking."* | §29 **Blocking conditions**: 4 — a strict **superset** of §19.7 |
| POL-ASSUMPTION-DISCLOSURE | silent | §27: *"A critical assumption governs irreversible or high-impact work without verification or authorized acceptance."* |

**A contract that says "no blocking finding remains" and never enumerates blocking findings is not a rival
catalog — it is half of one.** DOC-003 supplies **17 blocking conditions** DOC-004 never states.

### 2. Where both speak, they agree — verbatim

The **only** policy for which both documents state blocking conditions is Intent Preservation:

- DOC-004 §23.6 — *"Any material unauthorized divergence from approved intent."*
- DOC-003 §32 — *"Material divergence without authorized intent revision."*

The same rule. And for Decomposition Coverage, DOC-004 §19.7 is a strict **subset** of DOC-003 §29. **Zero
contradictions across twelve policies.**

### 3. The one exception proves the rule

**POL-CONSTRAINT-PROPAGATION is the only policy DOC-004 supplies its own `Blocking conditions` subsection for
(§20.5) — and it is the only policy DOC-003 has no section for at all.** DOC-004 added a twelfth policy, so it
had to state that policy's blocking conditions itself. Everywhere DOC-003 already stated them, DOC-004 refers to
them and moves on.

That is not two authors disagreeing. That is one author writing a contract on top of a specification.

### 4. Their finding lists are different *kinds*, not rival enumerations

DOC-003's are titled **"Common findings"** and **"Common shape failures"** — the document's own word, prose,
illustrative. DOC-004's are titled **"Findings"** and enumerate backticked `CODE`s. That DOC-003 mentions "false
precision" and DOC-004 does not is not a conflict: one is illustrating, the other is enumerating a contract.

DOC-003's structure confirms the register throughout — its subsection vocabulary is ad hoc across the eleven
sections ("Evaluates", "Questions", "Critical checks", "Evaluation dimensions", "Possible outcomes",
"Observations"), while DOC-004's twelve are regular and machine-targetable. **DOC-003 specifies. DOC-004
contracts.**

---

## The ruling

> **RPH-DOC-003 §25–§35 and RPH-DOC-004 §15–§26 are one catalog expressed at two levels. They compose:**
>
> 1. **DOC-004 governs structure and every field it states** — the twelve policies, the finding `CODE`s, the
>    criterion ids/names (§15.6, §19.5), claims, evidence, dispositions, control actions, and its own blocking
>    conditions (§18.7, §19.7, §20.5, §21.6, §23.6, §26.6).
> 2. **DOC-003's `Blocking conditions` stand.** They are ratified text and they are the referent of DOC-004's
>    otherwise dangling "blocking finding" references. **They decide severity.**
> 3. **DOC-003's "Common findings" / "Common shape failures" are illustrative** (its own word) and do **not**
>    extend DOC-004's `CODE` list.
> 4. **Where both state a rule, they agree.** If a future edit makes them disagree, that is a defect in the
>    corpus, and it must fail the build rather than be silently reconciled — see the conformance test.

**Nothing ratified is discarded, and no document needs editing.** This is the reading under which every sentence
in both documents is true and does work. The alternative — "DOC-004 supersedes" — would delete 17 ratified
blocking conditions and leave §15.9's "no blocking fidelity finding remains" and §26's nine uses of "blocking"
pointing at nothing.

## What it changes

- **Severity is substantially ratified after all.** The earlier authoring rounds swung to MATERIAL on the
  explicit argument that "§15 declares no blocking condition for any code" — DOC-003 §25 declares four. Round 1's
  over-blocking instinct was closer to right than round 2's correction; both were reasoning from half the corpus.
- **`MISSING_USER_CONSTRAINT`** ("mandatory constraint omitted"), **`FALSELY_CLOSED_AMBIGUITY`** ("major
  ambiguity hidden"), **`INFERRED_NEED_PRESENTED_AS_FACT`** ("inferred solution presented as user requirement"),
  **`SOLUTION_SUBSTITUTION`** ("formalized objective contradicts user expression") are **BLOCKING by ratified
  text** — not by my judgement.
- **`doc004-conformance.test.ts` must widen to both documents**, and must assert the non-contradiction that this
  ruling rests on. A ruling whose premise is not checked is a prose claim, and this program has learned what
  those are worth.

## What remains genuinely open (narrowed, not eliminated)

The **96 codes with no ratified severity** still need one. The ruling supplies the blocking cases; it does not
supply the rest, and no reading of the corpus will. Those stay `AUTHORED`, labelled, with a machine-checked
guarantee that a `RATIFIED_*` claim's words really are in a ratified document.

## Provenance of this ruling

Found by an adversarial refuter citing DOC-003 §29 — a document three authoring rounds had never opened for
policy content, because **I** scoped them to DOC-004. Recorded in [[project_jpwb_catalog_double_ratified]] and
HARMONIZATION-LOG PART 3c/PART 4.
