# RESOLUTION PACKAGE — §16 item 23, scoped to the PER-9 exchange record

**Tier:** design. **Nothing here is built.** Prepared 2026-09-03. Covers the three open items in dependency
order: **item 23** → **§31 durable adapter** → **`REG-Q-066`**. Every citation opened at HEAD.

---

## 1. Why the exchange record falls inside item 23

Item 23, verbatim in part (Guide `:2520`):

> *"Current contracts do not fully freeze material-boundary identity/classification, locked inherited policy
> assignment, **producing-Attempt/context and protected-transition binding**, conjunctive independence…"*

⭑ **"Producing-Attempt/context binding" is the exchange record's exact blocker**, and `PER-12` binds retained
reasoning to *"a typed Artifact of its producing Attempt"* — an anchor that does not exist on four of five
aggregates (`REG-D-053`). Three separate Guide clauses route here: `:1338`, `:1340`, `:1369`.

**What is blocked** (enumerated exhaustively in `DESIGN-durable-exchange-record.md` §2): no accepted contract
carries a durable per-try exchange record with **typed** relationships. The one untyped route —
`EvidenceObject.contentReference`, an open `z.record` — is exactly `PER-9`'s forbidden *"hide core
relationships in one generic JSON document."*

---

## 2. THE PROPOSAL — a typed event on the plane's existing aggregate. No new object, no new store.

**Shape:** a `RecordModelExchange` command and its `ModelExchangeRecorded` event, dispatched onto the
**aggregate the plane already has** — `ASSURANCE_ASSESSMENT` on the assurance plane, `AUTHORING_CONVERSATION`
on the authoring plane. Fields are **typed, one per PER-9 element**, with content **by reference**:

| Field | Element | Notes |
|---|---|---|
| `exchangeId`, `exchangeRole`, `predecessorExchangeId?` | the per-try chain | `initial \| retry \| reformat \| repair` |
| `materializedInputRef` | **E-1** | `{storageProvider, storageKey, contentHash, byteSize, purgeability, contentDurability}` |
| `answerSpanRef`, `volunteeredReasoningRef?` | **E-2, split** | two refs, two purgeability classes — the split `REG-D-053` and `REG-F-339` make lawful |
| `resolvedModel` | **E-3** | ⚠ **a NEW shape** — `ActorReference` has no `version`, and PER-9 requires *"provider, model, and version actually invoked"* |
| `truncation` | **E-4** | typed, not prose |
| `parseOutcome` | **E-5** | `accepted \| rejected \| quarantined \| repair-requested` |
| `redactionManifestRef?` | **E-6** | by reference |
| `promptTemplateFingerprint?` | index | ⚠ **never a substitute** — PER-9 says so outright |

### Why it satisfies every constraint that killed the alternatives

| Constraint | How |
|---|---|
| `PER-9` — no *"generic JSON document"* | Every core relationship is **its own typed field**. Nothing is a bag. |
| `PER-9` — no *"universal stream-record type"* | Scoped to **bounded model/agent tries**, not to every material act. |
| `PER-9` — no *"duplicate event authority"* | Goes through the **normal command→event pipeline**. No side door. |
| §9.7:1338 — *"adds no dedicated reasoning store"* | Bytes live in the **existing `ArtifactStore` port** (`REG-D-049`) — a seam, not a store. The event carries **refs**. |
| `PER-12` — *"never projected"* | ⭑ **Event-only, no PWO.** `governedIdsByType` (`packages/rph-engine/src/queries.ts:321-329`) buckets by `aggregateType`/`aggregateId`, so an event on an aggregate that **already exists** adds **no catalog entry** — verified by reading. The Decision Center picker never sees it, **structurally**, with no filter to fail and no green control to fight (`REG-D-053`'s H-3). |
| §16 item 21 — no *"raw-CoT store"* | Reasoning is a **purgeable ref**, never inline, never a store of its own. |
| `PER-8` / `PER-12` purgeability | The **record** is permanent; the **content** is per-class purgeable. Purging leaves a tombstone and the record stays explicable. **This is the two-plane architecture doing its job.** |

---

## 3. ⚠ What this costs, stated before it is asked for

1. **§10.1:1369 is the thing being overridden.** *"These are information requirements, **not permission to add
   tables, fields, objects, or Events**."* ⭑ **This proposal adds an Event. That is precisely the permission
   item 23 exists to grant, and it cannot be taken silently.**
2. **`PER-2`: persisted event schemas are PERMANENT** — *"evolution uses upcasters at read time, never event
   rewriting."* ⚠ **The shape must be right the first time, or carry upcasters forever.** This is the strongest
   argument for ratifying a shape rather than shipping one and iterating.
3. **Item 23's own instruction is a conjunction:** *"Evolve policy registry, schemas, persistence, projections,
   fixtures, and conformance tests **together** before claiming support."* A contracts-only change would not
   discharge it.
4. **`E-3` needs a new resolved-identity shape.** `ActorReferenceSchema` (`envelopes.ts:23-31`) has seven
   fields and **no version**; `+version` and `+modelVersion` both refuse. Reusing it would silently drop a
   `PER-9` element.

---

## 4. §31 DURABLE ADAPTER — blocked behind the consumer, and the reason is worth stating

`REG-F-342` records that the adapter *"must land WITH the record consumer, not after it."* The consumer needs
§2's shape. **So the adapter is downstream of item 23, not independent.**

> ### ⚠ AND `GATE-1` IS NECESSARY BUT NOT SUFFICIENT — DISCLOSED RATHER THAN LEFT TO BE FOUND
> `captureTry` now refuses a store supplied **without a sink** (`REG-F-341` H-1). ⭑ **It checks that a sink
> EXISTS, not that the sink is DURABLE.** The only sink is `createExchangeSink()`, a JS array. So supplying a
> durable store **with** that sink passes the gate and still produces **durable content whose record dies at
> end of run** — the plain orphan, one step further along. **Landing the §31 adapter before the consumer would
> walk straight through the gate I just added.** That is why the ordering is a rule and not a preference.

---

## 5. `REG-Q-066` — prepared, deliberately not answered

It remains **OPEN and sponsor-reserved**, and this package **does not ask for it yet**. After item 23:

- The **separation primitive** exists (`splitAnswerSpan`, `REG-F-339`).
- The **anchor** exists (`REG-D-053`).
- The **carrier** would exist (§2).
- Then `REG-Q-066` becomes a live, actionable question about whether the `E-2` field may be written — and a
  ruling would change something.

**Ruling it today still changes nothing, or creates the orphan** `REG-F-336` C-2 forbids. That assessment is
unchanged by this package; the package is what would make a ruling useful.

---

## 6. THE ASK

**One ratification**, scoped as narrowly as the obligation allows:

> Resolve §16 item 23 **for the exchange-record limb only** — licensing one typed command/event pair recording
> a bounded model try onto the plane's existing aggregate, with content by reference and no new Professional
> Work Object — and accept that this overrides §10.1's *"not permission to add… Events"* for that limb, under
> `PER-2`'s permanence.

**Not asked, and deliberately out of scope:** the generalized `AssurancePlan`, coverage topology, conjunctive
independence, and every other limb item 23 names. Those are separate and this package takes no position on
them.

**If ratified**, the build order is item 23's own conjunction — registry, schemas, persistence, projections,
fixtures and conformance tests together — then the §31 adapter **with** the consumer, then `REG-Q-066`.

**If refused**, the honest consequence: `ASR-11` limb 3 and `PER-9`'s durable-exchange-record clause stay
unmet, `ICP-02` stays inert, and the register should say **blocked pending item 23** rather than reading as a
buildable gap — which is itself worth having, and is the outcome `REG-F-341` already recommends over a
premature `REG-Q-066` ruling.
