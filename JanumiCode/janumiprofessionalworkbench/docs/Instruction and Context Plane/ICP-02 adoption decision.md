# `ICP-02` — the exchange record: a field-by-field adoption decision against `ModelExchangeRecord`

- **Programme:** `JAN-ICP-DR-001` work package `ICP-02`, deliverable 1.
- **Governing:** `DOC-003 PER-9` (E-1..E-6, and `PER-9-a`: the TRY is the unit).
- **Source shape:** `JAN-CSAA-007 §…:1288-1308` `ModelExchangeRecord` — the same ratified obligation, already
  solved once in this repository (`REG-F-316`).

> ## ⚠ SCOPE, STATED BEFORE ANYTHING ELSE
> **CSAA is another agent's subsystem. This adopts the SHAPE and imports NOTHING.** Its types are
> CSAA-namespaced (`SchemaUrn` = `urn:janumi:csaa:schema:…`), its envelopes belong to its Package Manifest, and
> nothing here modifies a CSAA file. The reason to start from it is `REG-F-314`'s lesson: a design that
> re-derives a ratified obligation unaided produces a WEAKER set, and this document exists so each field is
> either taken or refused **with a written reason**.

---

## ⭑ THE FINDING THAT REORDERS THE WORK PACKAGE

**`ModelExchangeRecord` stores content BY REFERENCE, not inline** — `materializedInputArtifactRef`,
`rawOutputBeforeCoercionRef`, `inputRedactionManifestRef`. It is a record of **metadata plus pointers**.

That is not a detail; it is the two-plane architecture the design derived from `PER-12`/`PER-8` (`DESIGN` §4),
arrived at independently by whoever wrote CSAA-007. **The record is permanent; the content it points at is
purgeable.** So:

- ⚠ **THE ROADMAP'S GROUPING WAS WRONG AND IS CORRECTED HERE.** `ICP-03`'s entry says *"E-1/E-3/E-4/E-5 need no
  content store; E-2/E-6 do."* **E-1 is content.** The materialized input is the largest and most sensitive
  field in the record. It belongs with E-2, not with the metadata.
- **The honest split is by KIND, not by element number:**

| | Elements | Home | Blocked? |
|---|---|---|---|
| **Metadata** | E-3, E-4, E-5, `exchangeRole`, `predecessorExchangeRef`, disposition | the permanent record | **No** — buildable now |
| **Content** | E-1, E-2, E-6's manifest | a purgeable artifact, by reference | **Yes** — `ICP-03` / `DEF-W2-001` |

**So `ICP-02` builds the record and its references. The referents arrive with `ICP-03`.** A record whose
content refs are unresolved is not a hollow object: it is an accurate statement that a try occurred, what model
served it, and that its bytes are not yet retainable — which is precisely the *disclosed* omission `PER-9`
demands in place of the *silent* one the code performs today.

---

## The decision, field by field

| # | `ModelExchangeRecord` field | Decision | Reason |
|---|---|---|---|
| 1 | `invocationRef` | **DEFER** | JPWB has no "invocation" object. The parent is the PWU/turn, and binding it needs the authoring-plane record ratified first (deliverable 3). Deferring a REF is cheap; inventing a parent object is not. |
| 2 | `exchangeRole` (`initial`/`retry`/`reformat`/`repair`) | **ADOPT VERBATIM** | This IS `PER-9-a`. Without it a repair collapses into its original, which is the defect at `reasoning-review-validator.ts:180`. The four members are taken unchanged — a narrower set would silently re-merge cases the corpus separates. |
| 3 | `predecessorExchangeRef` (0..1, required unless initial) | **ADOPT** | It is what makes *"Repair never rewrites predecessor raw output"* **checkable** rather than aspirational: the predecessor is named, so overwriting it is detectable. |
| 4 | `purpose` | **DEFER** | JPWB's purpose is carried by the PWU/policy the try serves; adding a free-text purpose here would be a second, unreconciled statement of it. |
| 5 | provider/adapter/method/config refs | **PARTIAL — provider only** | Provider is available (`onPayload`'s `model.provider`). Adapter/method/config are CSAA's analyzer plumbing with no JPWB counterpart. |
| 6 | `resolvedModelIdentity` — closed union of exact identity **or `unreported`/`unresolvable` with rationale** | **ADOPT THE UNION, REALIZED ON `ActorReference`** | ⭑ The union's SECOND ARM is the load-bearing half and the easiest to drop: `PER-12` says availability is *"provider- and configuration-dependent"*, so "no identity" must be **statable** rather than absent. JPWB already has the positive arm — `ActorReference` carries `modelId`/`providerId`/`executionInstanceId`, and `record-assurance.ts:41-50` already populates it for the evaluator (`ICP-00`, finding `#10`). **Reuse it; do not mint a second identity shape one line from the ratified one.** |
| 7 | `promptTemplateRef` | **DEFER, WITH A NAMED CARRIER** | `limb:PER-9:7` (`REG-F-319`): no prompt or template identity is minted anywhere. The ref has nothing to point at until instruction templates exist (`ICP-05` / `REG-D-048`). Deferred, not dropped. |
| 8 | `promptTemplateFingerprint` (a `DigestDescriptor`) | **ADOPT — the primitive already exists** | `rph-contracts/src/hash.ts` `contentHash()` returns `sha256:<hex>` over `canonicalJson`, which is `DigestDescriptor`'s `{algorithm: "sha256", representation: "jcs-json"}` in JPWB's own notation. ⚠ **AND ITS ROLE IS INDEX, NEVER SUBSTITUTE** — `PER-9`: *"A prompt or template fingerprint identifies that record; it never substitutes for it."* This is the field `REG-F-314`'s manifest tried to make the whole record. |
| 9 | `materializedInputArtifactRef` (E-1) | **ADOPT AS A REF; REFERENT BLOCKED** | `ICP-01` makes the bytes obtainable; `ICP-03` makes them storable. The ref is present and unresolved until then — a *disclosed* gap. |
| 10 | `inputRedactionManifestRef` (E-6) | **ADOPT AS A REF; REFERENT BLOCKED** | Finding `#60`: no redaction exists anywhere. The ref records that redaction is OWED for this exchange. |
| 11 | `rawOutputBeforeCoercionRef` (E-2) | **ADOPT AS A REF; REFERENT BLOCKED** | ⚠ **AND ITS CAPTURE POINT IS STILL UNSOLVED.** `ICP-01` established that `onResponse` fires *"before its body stream is consumed"* — HTTP-level, not the decoded answer. E-2 needs its own seam, and this record's ref is what that seam will fill. |
| 12 | `transportMetadataRef` | **DEFER** | 0..1 in the source. Nothing consumes it in JPWB. |
| 13 | `truncationState` (`none-declared`/`declared`/`detected`/`unknown`) (E-4) | **ADOPT VERBATIM** | ⭑ Finding `#61` is exactly this: `excerpt()` writes `…(truncated)` **into the prompt string**, which is never persisted — so truncation is declared only in the artifact that is thrown away. A typed state on the record fixes the *category*, not just the instance. **`unknown` is the member that must not be dropped**: it is how an unobtainable answer is stated rather than guessed. |
| 14 | `omittedRegions` (0..*, exact role/reason/known-bound) | **ADOPT, MINIMAL** | The other half of E-4. Kept minimal (role + reason) because `known-bound state` presumes CSAA's bounded-region machinery. |
| 15 | parse / validation / disposition (`accepted-for-normalization`/`rejected`/`quarantined`/`repair-requested`) (E-5) | **ADOPT, RENAMED MEMBER** | `accepted-for-normalization` is CSAA's normalization pipeline; JPWB's equivalent is `accepted`. The other three are taken verbatim — `repair-requested` in particular, because it is what a repair's PREDECESSOR records, and finding `#62`'s bare `catch` currently records nothing. |
| 16 | observations and controls (resource/time, diagnostics, information controls, limitations) | **DEFER** | JPWB carries limitations on the Assessment already (`ICP-00` found `#27` now passes them through). A second home would be the "two restatements" defect. |
| 17 | Envelope variants (`ScopedModelExchangeRecord` / `SubjectModelExchangeRecord`) | **REJECT** | These bind CSAA's `ScopedObservationEnvelope` / `SubjectOccurrenceEnvelope` and its Package Manifest discriminator. JPWB has `ObjectEnvelope`. Taking them would import CSAA's identity model wholesale. |

**Adopted 9 · Deferred 5 (each with a named carrier) · Partial 1 · Rejected 1 · Renamed member 1.**

---

## What this makes checkable

The three tests `ICP-02` owes, and what each would catch **today**:

1. **A repair produces TWO records.** Today `reasoning-review-validator.ts:176-182` runs two `print()` calls and
   produces zero records. `exchangeRole` + `predecessorExchangeRef` make "two" the only representable answer.
2. **The predecessor's raw output survives.** Today `raw = await print(...)` overwrites it. With
   `predecessorExchangeRef`, the first try is a named record whose ref cannot be silently rewritten.
3. **A fingerprint does not satisfy the record.** `promptTemplateFingerprint` is present AND
   `materializedInputArtifactRef` is required-but-unresolved — so a fingerprint-only record is representable as
   *incomplete*, which is exactly the disclosure `PER-9` requires and `REG-F-314`'s manifest could not express.

---

## ⚠ What this document does NOT do

- It does not persist anything. The record is assembled in memory; persistence is `ICP-03`.
- It does not ratify `AUTHORING_CONVERSATION`'s shape (deliverable 3) — that is a ratification act, and it
  should carry the adopted fields rather than precede them.
- It does not solve E-2's capture point. `ICP-01` narrowed it; nothing here widens it.
