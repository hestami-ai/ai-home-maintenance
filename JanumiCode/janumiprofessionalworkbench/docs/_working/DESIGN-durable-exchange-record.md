# DESIGN — the PER-9 durable exchange record: is there a lawful carrier, and what does a `REG-Q-066` ruling actually unblock?

**Tier:** design. **Nothing here is to be built.** Prepared 2026-09-03, verified first-hand at HEAD; every line
number was located with `grep -n` and then opened with `sed -n`.

---

## 1. The obligation

`PER-9` (`JPWB-DOC-003:369`), verbatim in part:

> *"Every bounded model or agent try — each retry, reformat, and repair request included — is its own **durable
> exchange record** capturing the exact materialized input presented to the model, the returned output before
> schema coercion or repair, the resolved provider, model, and version actually invoked, declared truncation or
> omission, and the parse/validation/repair outcome, subject to recorded redaction. A prompt or template
> fingerprint identifies that record; it never substitutes for it."*

Six elements: **E-1** materialized input · **E-2** raw pre-coercion output · **E-3** resolved
provider/model/**version** · **E-4** declared truncation/omission · **E-5** parse/validation/repair outcome ·
**E-6** recorded redaction. Plus the per-try chain: `exchangeId`, `exchangeRole`, `predecessorExchangeId`.

**What exists today:** an app-local `ExchangeRecord` (`apps/rph-demo/src/lib/server/agent/exchange-record.ts`)
built by `exchange-capture.ts`. `createExchangeSink()` accumulates them in a JS array and `drain()` has **no
production caller**. Records vanish at end of run.

---

## 2. ⭑ The carrier enumeration — exhaustive, so the next reader does not re-derive it

Durability was established structurally, not assumed. The SQLite schema has exactly **four** columns that
retain caller-supplied JSON: `professional_work_objects.state`, `professional_work_object_versions.state`,
`domain_events.payload`, `outbox_messages.payload`. **So only object states and event payloads are durable.**
⚠ **Command payloads are NOT** — `command_receipts` stores `payload_hash`, never the payload
(`packages/rph-persistence/src/schema.ts:119-131`), which removes `ValidatorResult` from the carrier set
entirely.

| Candidate | Accepts? | Durable? | Lawful? | Why |
|---|---|---|---|---|
| `ValidatorResultSchema` | ✗ | — | — | `z.strictObject`; and command payloads are not persisted at all |
| `CompleteAssuranceAssessment` | ✗ | — | — | `z.strictObject`, rejects added keys (`REG-F-327`) |
| `ConversationEntrySchema` | ✗ | ✓ | — | Four fields — `role`, `kind`, `text`, `success?`. Holds no element |
| `ExecutionProvenanceSchema` | ✗ | ✓ | — | Four optional reference fields; holds no element |
| `ExtensionPayload.data` (`z.record`) | ✓ | — | — | ⚠ **The declared *"ONLY forward-compatible extensibility channel"* is UNREACHABLE**: `extensions[]` lives only on `objectEnvelopeShape`, and **0 of 265** payload schemas in `messages.ts` spread it |
| `ExecutionStepSucceeded.structuredResult` | ✓ | ✓ | ✗ | `z.unknown()`. But fires **only on success**, so a `rejected`/`repair-requested` try emits nothing — and neither plane at issue has an Execution Plan |
| `AssuranceAssessment.confidence` (`z.record`) | ✓ | ✓ | ✗ | Unreachable — appears once, on a payload nothing dispatches |
| **`EvidenceObject.contentReference`** | **✓** | **✓** | **✗** | ⭑ **The real near-miss.** `ArtifactReferenceSchema = z.record(z.string(), z.unknown())` — open dictionary on a durable PWO, wired end to end through `ProposeEvidence` into **both** object state and event payload. **Accepts an entire exchange record. Driven.** |

### Why the near-miss still fails

Every limb was driven against a passing control:

- **E-1 and E-2 cannot both be typed** — there is exactly one content slot; adding a second key → `unrecognized_keys`.
- ⭑ **E-3 is unsatisfiable ANYWHERE in the accepted surface.** `ActorReferenceSchema` is the only place model
  identity exists and it has **no `version` field**; `+version` and `+modelVersion` both → `unrecognized_keys`.
  PER-9 requires *"the resolved provider, model, and **version** actually invoked."*
- **E-5 hits a closed enum** whose domain is admissibility, not parse outcome
  (`PROPOSED|ADMISSIBLE|REJECTED|SUPERSEDED|INVALIDATED`).
- **E-4 and E-6 have no field**; `limitations` is free-text, which collapses structured truncation into prose.
- **The chain fields are refused** — `exchangeId`/`exchangeRole`/`predecessorExchangeId` → `unrecognized_keys`.

**The only surviving route is stuffing the whole record into `contentReference`** — and that is precisely what
`PER-9` forbids by name.

---

## 3. ⚠ The block is correct; the warrant on record is not

Guide §9.7's second trigger reads *"accepted contracts cannot represent these records losslessly."* **A
`z.record(z.string(), z.unknown())` represents anything losslessly — so that trigger does not fire on its own
terms.** The block stands on ratified canon instead:

> `PER-9`, `DOC-003:369`: *"It is not a monolithic record table: **do not implement a universal stream-record
> type, duplicate event authority, or hide core relationships in one generic JSON document.** Every material
> act in the stream retains identity, scope, actor and provenance, correlation and causation, exact
> input/subject/context/policy/evidence/output references, the time dimensions PER-11 requires, and
> status/supersession relations."*

Every one of those enumerated relationships would live **inside the bag**. Three reasons the re-file is not
cosmetic:

1. **Authority tier.** `PER-9` is ratified canon; the Guide is self-declared *"Proposed consolidated baseline"*
   and holds DETAIL authority only under `CON-000` B1.
2. **It avoids repeating a recorded error.** `HARMONIZATION-LOG.md:199-205`: *"I manufactured the blocker I
   reported… The §9.7 sentence I invoked to justify blocking the capability is a sentence I wrote."*
3. ⭑ **It survives refutation.** A reader who finds `contentReference` — one `grep` away — dissolves the §9.7
   warrant instantly. **The `PER-9` warrant is not dissolvable by finding an open field; finding one is what
   triggers it.**

---

## 4. What actually blocks `E-2` — four independent warrants

| # | Warrant | Owned by |
|---|---|---|
| i | The reasoning half's referencing record has **no typed carrier** | **§16 item 23** |
| ii | The answer half's `ARTIFACT` write needs four unratified vocabulary values | `REG-Q-056` (OPEN) |
| iii | ⚠ **The record consumer cannot be written where the bytes are written** — `CommandHandler` is **synchronous** (`kit.ts:36-40`), `ArtifactStore` is **async** (`artifact-store.ts:78-89`) | **nothing — architectural, unowned** |
| iv | Writing the `E-2` field itself | `REG-Q-066` (OPEN, sponsor-reserved) |

⭑ **Findings (i) and (iv) are the same finding seen from two planes.** `REG-D-053` forecloses `ARTIFACT` for
reasoning by design, so the referencing record must be *"the plane's own governed-stream record"* — **which is
the thing §2 proves has no carrier.**

---

## 5. RECOMMENDATION — resolve §16 item 23 first; do not ask for `REG-Q-066` yet

This is a **sequencing fact, not a preference.** `REG-Q-066` governs whether `E-2` may be **written**. Item 23
governs whether there is anywhere to write the **record that would reference it**.

A `REG-Q-066` ruling delivered into today's state produces one of exactly two outcomes: **nothing changes**
(three other blockers remain), or **someone acts on it and creates the orphan** `REG-F-336` C-2 forbids in
terms. Item 23 is not a workaround — it is the sentence the corpus itself points at from **three** independent
places (§9.7:1338, §9.7:1340, §10.1:1369), and its own text already names *"producing-Attempt/context and
protected-transition binding"* as unfrozen.

**Sequence:** item 23 ratified → `REG-Q-066` (the `E-2` field) → `REG-Q-056` (answer-half vocabulary) → the
sync/async consumer seam → the §31 durable adapter. ⚠ **The last two are owned by no open question today and
need owners.**

**Do-nothing forfeits:** `ASR-11` limb 3 stays unmet, `ICP-02` stays inert, and every model try continues to
leave no durable trace — while the register reads as though one sponsor sentence would fix it.

---

## 6. Hazards

- **H-1 — the orphan armed on a one-line change. ✅ NOW GATED.** `captureTry` refuses when a store is supplied
  without a sink. Predicted red observed first; `Q1` (remove the guard) is single-victim.
- **H-2 — the INVERSE orphan, ungated.** The demo's **record** plane is durable (`SqliteStorageAdapter`) while
  the **content** plane is not (`createInMemoryArtifactStore` is the only implementation). Wire `ARTIFACT` for
  the answer half and, after one restart, a durable PWO names a `storageKey` whose store answer is
  **byte-indistinguishable from one never stored** — the port's own doctrine names this defect. **The owed §31
  adapter must land WITH the record consumer, not after it.**
- **H-3 — projection exposure, closed by ruling only.** An `ARTIFACT` PWO is projected by construction.
  `REG-D-053` closes this structurally by minting no reasoning PWO. **Any design that mints one re-arms it and
  must fight a green committed control.**

---

## 7. What must be corrected in the record

`REG-F-340` (filed 2026-09-03, ✅ CLOSED) states: *"Both technical prerequisites for `E-2` now exist… What
remains is PROCEDURAL."* **PARTLY RIGHT, and wrong in the direction that costs most.**

⭑ **The enumeration is a hand-listed two-item set standing in for a derived one** — this project's
most-recorded defect class. It never asks *"is there a durable record to reference the bytes?"* — **the third
prerequisite `REG-F-336` C-2 itself established one day earlier, in the same register, by the same author.**

> **CORRECTED.** *"What remains is procedural"* is true of the **`E-2` field** and false of **`E-2`
> retention**. Retaining `E-2` lawfully is blocked by three further prerequisites, none procedural: **(a)** no
> typed carrier for the durable per-try record that must reference the bytes (item 23 — warranted by
> `PER-9:369`, not by Guide §9.7's second trigger, which `EvidenceObject.contentReference` refutes on its own
> terms); **(b)** the record consumer cannot be written from a command handler, and no open question owns it;
> **(c)** both planes are in-memory at HEAD, so a complete wire still would not survive restart. **Sequence
> item 23 first.**
