# DESIGN — ASR-8's cascade, and the tier the corpus names that does not exist

**Grounding:** 12 agents, 2.0M tokens, measure-then-refute. **Supersedes my own blocker.**

---

## 0. ⚠ The blocker I recorded twice was false, and its only source was my own commit messages

`b40220bd` and `d48446b6` both say a cascade is impossible *"because a commit writes ONE aggregate."*
Measured:

- **True of `CommitInput`.** It carries singular `aggregateId` / `objectType` / `expectedRevision`, and
  the adapter writes exactly one object row.
- **False of a DISPATCH.** `CommitInput.events` is `DomainEvent[]` and the insert loop writes each
  event's *own* `aggregateId` with **no check** that it matches. `alsoEvents` already exploits this.
- **And a shipped handler already writes two aggregates in one command.** `withPwaVersionBump`
  (`pwa-authoring.ts:182`, three call sites) wraps two `commitState` calls in `ctx.store.transaction`,
  deriving the second commit's ids as `${commandId}#pwa-version`. It has a passing test.
- **It is ratified nowhere.** The nearest written statement is my own, in
  `DESIGN-validator-health.md:71` — *"Every command in this engine targets one aggregate"* — which is
  false of the repository it describes.

**So I blocked an increment on a constraint I had authored, cited from a commit message, and never
measured.** Third time this week an authored claim of mine acquired the standing of a rule; the
difference here is that it stopped work rather than licensing it.

## 1. But a ratified rule reaches a stricter verdict, and I had not cited it

**JPWB-DOC-003 §4 AGG-1**, byte-exact:

> **AGG-1 · Cross-aggregate change flows through Commands and Events.** One aggregate never directly
> mutates another's internal state. Cross-aggregate flows use Commands, Events, durable processes,
> compensation, and reconciliation — **not direct table mutation, and not one broad transaction
> constructed to simulate workflow atomicity.**
> **WHY:** direct cross-aggregate mutation destroys the invariant-enforcement point; **simulated
> atomicity hides partial failure instead of representing it.**

**RPH-DOC-009 §30.2** *Cross-aggregate Execution Workflow*, byte-exact:

> Do not update several aggregates in one broad transaction merely to simulate Execution Workflow
> atomicity. Use: **domain event; saga/controller; compensating actions; explicit intermediate states.**

**The corpus names the mechanism.** It is not a design question — it is a capability question.

## 2. What that disqualifies, and what it exposes

| candidate | verdict |
|---|---|
| **B** — invalidation handler writes the claims | **DISQUALIFIED by AGG-1** ("never directly mutates another's internal state") |
| **C1** — two commits in one `ctx.store.transaction` (the `withPwaVersionBump` shape) | **DISQUALIFIED by AGG-1 BY NAME** — "not one broad transaction constructed to simulate workflow atomicity" |
| **C2** — a bare follow-on command | **fully skippable.** A caller invalidates evidence, never issues the follow-on, and a SUPPORTED claim keeps resting on invalidated evidence — the *"record self-curating toward support"* ASR-8's last sentence forbids. Nothing records the omission. |
| **C3** — caller-assembled atomic batch (`dispatchBatch`) | **relocates the skip.** Atomicity binds the commands *submitted*, not the ones *omitted*; a one-element batch is legal. |
| **D** — derive contestation at read time | forbidden as the *sole* answer: PER-7 makes projections *"never authoritative write targets"*, and ASR-8 says the claim **becomes** contested — a state, not a view. |
| **saga/controller** (§30.2) | **the ratified answer, and it does not exist in this repository.** |

**⚠ AND `withPwaVersionBump` VIOLATES AGG-1.** Three production call sites, shipped, adversarially
reviewed, with a passing test — using precisely the mechanism AGG-1 names and forbids. Filed
separately; it is not this design's to fix, and it is the reason C1 must not be reached for by
precedent.

## 3. The fork underneath all of it: the aggregate map does not match the runtime

**JPWB-DOC-003 §4 names five principal aggregates, with Claim OWNED by Assurance** (*"rooted at an
Assurance Assessment: claims, evidence references…"*) and Evidence merely **referenced** (*"never
mutated through the containing aggregate"*).

**The runtime has ~30 aggregate roots, one per object type.**

Under the ratified map, an Evidence → Claim cascade is **INTRA-aggregate and AGG-1 does not bite at
all.** Under the runtime's map it is cross-aggregate and needs a saga. **The same rule gives opposite
answers depending on which map is real, and nothing in the repository decides.** That is the
foundational question, and it is a sponsor question — not something to settle inside an increment
about evidence invalidation.

## 4. What to do

**Do not build the cascade.** The ratified mechanism is a tier that does not exist, and the
alternatives are each disqualified by ratified text or defeated by skippability. Building C2 would
close REG-F-044's last increment while leaving the hole — the failure mode REG-D-024 recorded in
advance.

**Two things that are honest and available now, neither of which is the cascade:**

1. **Harden the deciding reads.** `invalidatedEvidenceUnderminingPromotion` already exists in the
   promotion path and already implements part of ASR-8 at the consumption side. Extending that
   derivation to the readers that matter means a stale stored status cannot mislead a decision, even
   though it does not make the status itself correct. **This is mitigation, not ASR-8**, and must be
   labelled as such wherever it lands.
2. **Record the gap where a reader will hit it** — `invalidateEvidence` computes `affectedClaimIds`
   and acts on none of them; that silence should be a comment, not an absence.

**Two ratification requests, filed rather than assumed:**

- **The saga/controller tier** (§30.2 names four mechanisms and the repository has none).
- **Which aggregate map is authoritative** — the ratified five, or the runtime's thirty. Until that
  is settled, whether ASR-8's cascade is even cross-aggregate is undecided.
