# DESIGN — resolving a retained exchange: what may be read back, and by whom

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-04 · **Programme:** `JAN-MXREAD`
**Follows:** `REG-D-056` (retention authorised), `REG-D-057` (the split made reversible)
**Answers to:** `REG-F-244` remedy 3 (OPEN), `REG-F-245` (b′) (OPEN)

---

## 1. The gap, measured rather than recalled

`ASR-11` limb 3 (`JPWB-DOC-003:285`): *"raw output is retained for diagnostics."* As of `415d3920` the
retention half is done and the diagnostic half does not exist.

**The record is write-only.** `grep -rn "MODEL_EXCHANGE" --include=*.ts apps packages verif`, minus
`node_modules`, `dist/` and tests: every hit is a write site (`floor.ts:391`, `exchange-recorder.ts`,
`handlers/model-exchange.ts`), a contract declaration, or a comment. **No hit reads one back.**
*Positive control, same instrument:* `MODEL_EXCHANGE` resolves at a live **write** site, so the instrument
sees this record fine — the absence is on the read side only.

**The content plane is equally unread.** `ArtifactStore` exposes `put`, `get`, `stat`, `purge`
(`packages/rph-ports/src/ports/artifact-store.ts:96-107`). Outside tests and the adapters themselves,
production calls exactly one of them: `put`, at `exchange-capture.ts`. `REG-F-245` (b′) states the
consequence: *"The system records WHERE an artifact's content lives and never once resolves it."*

So a `MODEL_EXCHANGE` today asserts: *bytes live at this key, hashing to this, this many, in a store of this
declared durability* — **and nothing has ever checked any part of that claim.**

⚠ The record already names why that matters, at `agent/exchange-record.ts`: the record plane can be durable
while the content plane is not, *"so the record still LOOKS intact"*. An unverified claim and a true one are
byte-identical to a reader.

---

## 2. What is BLOCKED, verified three ways rather than inherited

`REG-F-244` remedy 3 says the diagnostic read surface *"must be filed as a question before it is built"* and
sequences it behind `REG-Q-056`. **A recorded remedy is a hypothesis** — this programme has had three wrong in
one day — so it was re-measured at HEAD:

1. **`REG-Q-056` is still OPEN.** `JPWB-REG-005:11685`, *"**Date:** 2026-08-22 · **Type:** QUESTION ·
   **Status:** OPEN"*.
2. **The four columns genuinely have no ratified values.** `handlers/artifact.ts:16-19`: *"DOC-009 types
   artifactType, status, securityClassification and retentionClass as bare `text not null` with no CHECK
   constraint, and no enum for them exists anywhere in the corpus."*
3. **A committed green test exists to stop exactly this.** `handlers/artifact.test.ts:123-136`, its own
   comment: *"This test exists to LOCK the absence of invented enums: if someone later narrows these to a
   made-up enum, this fails and sends them to the corpus first."*

**And a fourth fact, found here and not in any entry, which makes the block substantive rather than
procedural:**

> ⭑ **READS ARE NOT AUTHORITY-CHECKED AT ALL.** `packages/rph-engine/src/engine.ts:195` is
> `loadObject: (id) => store.loadObject(id)` — the credential is threaded through `dispatch` and **not**
> through reads. Every governed object in this system is readable by anything holding a handle.
>
> So a surface returning volunteered reasoning would be **the first read in the repository that anyone would
> need permission for**, and there is no read-authority mechanism to hang it on. `PER-12` restricts that
> material specifically (*"never logged, never projected, never Evidence"*); shipping it through an ungated
> read would not be a policy gap, it would be a disclosure.

**Conclusion: the block is real.** It is not, however, as wide as "no read path may be built" — §3.

---

## 3. The line the ratified vocabulary already draws

The blocked question is *who may see volunteered reasoning*. It is not *may anything ever be read*. Two
distinctions are already sponsor-ruled and need nothing new:

| | Answer span | Volunteered reasoning |
|---|---|---|
| Retention class (`REG-D-050`) | `RETAINED_BY_PARTICIPATION` | `PURGEABLE_AT_EXPIRY` |
| Participated in a recorded judgement? | **Yes** — it is what the assessment rests on | **No** — `PER-8`'s NON-EXAMPLE names it |
| Restricted by `PER-12`? | No | **Yes** |
| Readable without an access model? | **Yes** — §3.1 | ⛔ **No** — needs the ruling |

### 3.1 Why the answer half needs no new authority

`REG-D-050` (sponsor, verbatim): *"The intention is for the governed stream to be fully auditable and
**reconstructable**."* The answer span is the material a recorded Assessment concluded from. Making it
readable is that ruling performed, not a new permission — and the retention class that says which half it is
was ratified in the same breath. **No value is invented: `Purgeability` is an existing generated enum.**

⚠ **This does not reconstruct the reply.** The whole reply is answer + reasoning, and the reasoning half is
behind the block. So §3.1 delivers *reproducibility of the judgement*, not `ASR-11` limb 3's diagnosis of a
malformed reply. **Naming that boundary is the point of this section**, because conflating the two is how this
programme over-claimed limb 3 once already (`REG-F-346`).

---

## 4. Design

Two layers. The first is a precondition for the second and is independently correct.

### Layer 1 — `verifyExchangeContent(record, store) → RetentionReport`

Per content ref, resolve the key and report. ⭑ **Bytes are read internally to re-hash and never cross the
return boundary**, so this layer discloses nothing and needs no access model at any point.

| Verdict | Meaning |
|---|---|
| `NOT_CLAIMED` | the ref is `PENDING_CONTENT_PLANE`; carries its stated reason |
| `VERIFIED` | present, and the **recomputed** hash and byte length match what the record claims |
| `HASH_MISMATCH` | present, and different. ⭑ The record's promise is falsified — the strongest signal here |
| `PURGED` | a tombstone: lawful, disclosed absence of `PURGEABLE_AT_EXPIRY` content |
| `UNRESOLVABLE` | no row |

⚠ **`UNRESOLVABLE` must be qualified by `contentDurability` and the report must say so.** On a `DURABLE`
store an absent row means never written. On `PROCESS_LOCAL` it is **indistinguishable** from "held and lost at
restart" — the in-memory store already says this in its own purge refusal, and a report that flattened the two
would assert an absence it cannot observe. Same defect this repository has recorded twice.

⭑ **Re-hashing rather than trusting `stat`.** `stat` returns the hash recorded *at put time*; comparing it to
the record's copy compares two transcriptions of one claim. Reading the bytes and recomputing is the only
version that can fail — the difference between a check and a ceremony.

### Layer 2a — reading the participating half

`readAnswerSpan(record, store) → string | AbsenceReason`. Gated on `purgeability === 'RETAINED_BY_PARTICIPATION'`
**read off the stored metadata, not off the field name** — so the guard turns on the ratified classification
rather than on a convention about which field holds what.

### Layer 2b — reading volunteered reasoning, and reassembly ⛔ BLOCKED

Needs the access model. Filed as a question with a recommendation (§6), not built.

---

## 5. The consumer problem, stated because it is the likeliest way this goes wrong

This repository's recorded pattern is a layer that is built, gated and never called —
`project_jpwb_hollow_governed_layer`, and 74% of the kernel dead in production before `JAN-HARMONIZATION`.
**Layer 1's natural consumers are Layer 2b (blocked) and the purge scheduler (`REG-F-245`, separate work).**
Built alone, its only consumer would be its own gate — which is the defect, not a step toward avoiding it.

⭑ **So Layer 2a is not optional garnish; it is what stops Layer 1 being hollow.** Layer 2a calls Layer 1
before returning anything: a read that cannot say whether the bytes it returned are the bytes the record
claims is exactly the unverifiable reference `PER-9` exists to prevent. **They ship together or neither
ships.**

---

## 6. What must be asked, and what will be recommended

**`REG-Q-077` — may volunteered reasoning be read back, and under what authority?** The narrow shape,
carrying its own recommendation so one line settles it:

- **The recommendation will be: not yet, and not because it is hard.** Reads are ungated (§2); adding the
  first authority-bearing read is a larger act than this programme should take unilaterally, and `PER-12`'s
  material is the worst possible first case to get wrong.
- **What is proposed instead:** Layer 1 + Layer 2a now; Layer 2b when the access model exists, sequenced
  behind `REG-Q-056` exactly as `REG-F-244` directs.
- ⚠ **What the question must disclose:** with 2b unbuilt, `ASR-11` limb 3's *diagnostic* purpose stays unmet
  even where retention is met. **The limb does not move on this work** — recorded here in advance so the
  roadmap cannot quietly claim it.

---

## 7. Boundaries

1. **No new vocabulary.** Nothing narrows `artifactType`, `status`, `securityClassification` or
   `retentionClass`. `handlers/artifact.test.ts:123-136` must stay green **unedited** — it is the instrument.
2. **No read-authority mechanism.** Not invented, not stubbed, not approximated by a comment.
3. **No new command or event.** Layers 1 and 2a are reads; §16 item 23's conjunction is not re-opened.
4. **The limb does not move.** `limb:ASR-11:3` stays `PARTIAL` on this work, for the reason in §6.
5. **No CSAA.** Standing instruction: only what we break.
