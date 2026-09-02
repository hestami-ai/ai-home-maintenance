# DECISION PACKAGE — `REG-Q-066`: does ASR-11's "raw output is retained for diagnostics" name a plane this engine can write to?

**Prepared:** 2026-09-02 · **For:** sponsor ruling · **Question status:** OPEN since 2026-08-23, sponsor-reserved.
**Nothing in this package has been built.** `REG-Q-066` closes with *"Do not write the field before the ruling"*,
and that instruction was already violated once today (`REG-F-330`) and then reverted.

---

## 1. What the question asks, in one sentence

`JPWB-DOC-003` §8.4 **ASR-11 limb 3** says *"raw output is retained for diagnostics."* **PER-12** says volunteered
model reasoning is *"never logged, never projected"* and is retained only *"as a typed Artifact bound to its
producing Attempt."* When a model validator returns a malformed blob, **the blob is both things at once** — and the
question is which rule governs it.

Its three options: (1) it IS PER-12 material, so limb 3 is blocked behind the staged Attempt decisions; (2) it is
NOT, so it is ordinary content and this becomes a buildable FINDING; (3) it DEPENDS on the validator.

---

## 2. What has changed since filing — and a correction to my own first reading

I ran a decision package over this question. **Its headline was wrong, and I am recording that before its useful
half**, because the error is the exact class this register keeps recording: a re-reading that makes a blocker
vanish needs more verification than the blocker did.

> **The package reported:** *"'no shape in the RPH engine can hold it' is NO LONGER TRUE — a lawful carrier landed
> ten days after the question was filed."*

**That is not what option 1 claims, and the carrier does not answer it.** Verified at HEAD:

| Claim | Verified | Result |
|---|---|---|
| A carrier for the BYTES landed | `packages/rph-ports/src/ports/artifact-store.ts`, commit `c8fcb368`, **2026-09-02** | **TRUE — but I authored it today, this session, under `REG-D-049`.** Citing it as independent corroboration would be circular. |
| Option 1's blocker was "nowhere to put bytes" | `REG-Q-066` option 1, verbatim | **FALSE.** Its blocker is *"no `EXECUTION_ATTEMPT` object type, store row, or table exists"* — nothing to **bind to**, not nowhere to **put**. |
| That blocker still stands | `grep -rn EXECUTION_ATTEMPT` over `packages/ apps/` minus `node_modules`/`dist` → **1 hit**, `packages/rph-contracts/src/ids.ts:33`, an id **prefix**. Object registry enumerated: **13 types, none an Attempt.** No `execution_attempts` table. The two staged decisions (`HARMONIZATION-LOG.md:4142`) remain unratified. | **STANDS.** |

**So the ArtifactStore closes a blocker the question never named and leaves standing the one it did.** What it
genuinely changes is narrower and still real: it makes **option 2** buildable today, because ordinary content needs
no Attempt binding.

### 2a. And the carrier is UNWIRED, which bounds every claim below

`createInMemoryArtifactStore` has **zero non-test call sites repo-wide** (11 hits: 1 definition, 1 `.d.ts`, 9 in
two test files). **In the running app nothing is retained and no exchange record is collected.** My `ICP-02`
capture path is presently inert in production. That is a real gap in what I delivered, and it is disclosed here
rather than left for the next reader to find.

---

## 3. A third blocker neither the question nor I anticipated

`ArtifactContentInput.purgeability` admits **one value per stored object**:

```ts
export type Purgeability = 'PURGEABLE_AT_EXPIRY' | 'RETAINED_BY_PARTICIPATION';
```

Raw model output is **mixed**. The prose span is volunteered reasoning — `PURGEABLE_AT_EXPIRY` under PER-12, which
says outright it *"participates in no execution, assurance, governance, Baseline, or traceability, so Section
10.1's no-hard-delete rule does not reach it."* The JSON span is the judge's answer, which **did** participate in
assurance — `RETAINED_BY_PARTICIPATION` under PER-8. **One object cannot carry both classes**, so even option 2
fails as a whole-blob write. This is a design consequence of the port, not a defect in it: the binary is PER-8's
participation predicate, and a mixed blob has no single answer to it.

---

## 4. The controlling clause — and it resolves the hard case without a ruling

Guide **§9.7 L1340**, verbatim:

> *"Volunteered reasoning material in that exchange is governed by the rule above, not by this record; **where it
> arrives inline with the answer, separate it at retention so that only the answer span binds under Section 8.4.
> Where the spans cannot be separated losslessly**, or accepted contracts cannot represent these records
> losslessly, **block the capability and resolve Section 16 item 23.**"*

So the corpus already prescribes the outcome in **both** directions. The only question is which side a given blob
falls on — and that is decidable in code, not by taxonomy.

**`extractJson` (`agy-cli.ts:120-128`) is the de-facto separator, and it is lossy in exactly one direction.** It
computes span boundaries (a fence match, then `indexOf('{')` / `lastIndexOf('}')`) and **returns the answer span
while discarding the prose entirely** — it never returns the complement. The complement *is* computable from the
same offsets for a well-formed blob. It is **not** computable for a malformed one: interleaved prose between braces,
or a second fence, is swallowed by `slice(first, last + 1)`, so the "answer span" is itself mixed.

⭑ **And the malformed case is `REG-Q-066`'s entire subject** — *"the malformed output that CAUSED the refusal is
unrecoverable."* By §9.7 L1340 that case is already answered: **block, and resolve item 23.**

---

## 5. ⚠ A corpus tension the question did not surface, and it is the real residue

§9.7 **L1340** provides for planes with no Execution Plan:

> *"Where no Execution Plan exists—PWA authoring is the current example—the identical recording obligation binds to
> the plane's own governed-stream record, **not to an Execution Attempt**."*

But that carve-out redirects **the exchange record only**. The same sentence sends reasoning elsewhere — *"governed
by the rule above, not by this record"* — and **L1338's rule binds it to "a typed Artifact of its producing
Attempt."**

**So on the assurance and authoring planes the reasoning Artifact has a mandatory anchor with no referent.** The
field exists (`ArtifactObjectSchema.producingExecutionAttemptId`, `objects.ts:623`) and is `z.string().optional()`;
what does not exist is any Attempt for it to name. This is **unsatisfiable by construction on these planes, not by
omission** — which is why no amount of building discharges it, and why the merge target `REG-Q-066` already names
(**corpus**, not repository) is the right one.

---

## 6. RECOMMENDATION — rule narrower than the question asks

The question offers a three-way plane assignment. **I recommend option 3, re-cut**: the split is not *by validator
identity* but *by whether a lossless span separation exists*, which the code can decide per-blob.

| Case | Content | Disposition | Buildable today? |
|---|---|---|---|
| Deterministic validator; infrastructure failure | No model-volunteered material at all | Ordinary content · `RETAINED_BY_PARTICIPATION` | **YES** — no Attempt, no ruling needed |
| Model validator, **separable** blob | Two spans, offsets computable | Prose → typed Artifact `PURGEABLE_AT_EXPIRY`; answer span → the existing §19.3 contract | **Blocked only by §5** (no Attempt to bind the prose to) |
| Model validator, **non-separable** blob | Mixed, offsets untrustworthy | **§9.7 L1340: block the capability, resolve item 23** | **Already answered by the corpus** |

**What this buys:** ASR-11 limb 3 is dischargeable *today* for the deterministic and infrastructure cases — which
is the majority of the floor — without touching the chain-of-thought hazard that sank item 23's `rawOutput` field.

**The residual sponsor question is then a yes/no, not a three-way:**

> **Does ASR-11 limb 3 count as satisfied when "raw output is retained for diagnostics" holds for the separable and
> non-model cases, while the non-separable model case is BLOCKED under §9.7 L1340 rather than retained?**

If **yes** — I build the two unblocked rows and file limb 3 as discharged-with-a-declared-block.
If **no** — limb 3 is blocked behind item 23 in full, and the row should say so, so it stops reading as a buildable
gap.

Either answer also needs the §5 tension merged into the corpus, because it governs every future reasoning Artifact
on a plane without an Execution Plan — not just this limb.

---

## 7. What I am NOT doing without the ruling

- **No `rawOutput` field**, in any shape, anywhere. That remedy has been wrong once and I re-broke it once today.
- **No write of E-2** through `exchange-capture.ts`; it stays blocked with `PENDING_CONTENT_PLANE`.
- **No second purgeability class** invented to paper over §3's cardinality.

**What I will do without a ruling, because it is unblocked and already owed:** wire `ArtifactStore` to a real call
site so §2a stops being true, and give `verif/agy-stderr-unbound.test.ts` the shape-probing companion `REG-F-333`
records as owed.
