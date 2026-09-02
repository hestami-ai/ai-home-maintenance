# `ICP-00` — re-disposition of the governed-stream findings at HEAD

- **Programme:** `JAN-ICP-DR-001` work package `ICP-00`. **Driven:** 2026-09-02, at HEAD `3c57ba71`.
- **Subject:** the 15 `governed-stream` findings of `HARMONIZATION-FINDINGS.md` (Appendix A, 2026-07-15), 5
  adjacent findings, and the 2 `PER-9` census limbs `REG-F-317` recorded as owed. **22 rows.**
- **Why:** the 32 REFUTED findings were re-checked at HEAD on 2026-08-23. **The 75 CONFIRMED ones never were.**

> ## ⚠ THE CONTROL, DECLARED BEFORE THE RESULT
> `ICP-00`'s exit criterion named **#65 and #26 as known-moved**: a sweep reporting "all still true" is
> indistinguishable from one that never ran. **Both came back moved, and six more with them — 9 of 22 changed.**
> The instrument discriminates.

---

## Result

| Disposition | Count |
|---|---:|
| **TRUE AT HEAD** — the defect stands | **12** |
| **PARTLY STALE** — the claim has moved and must be re-scoped | **5** |
| **FALSE AT HEAD** — fixed since filing | **3** |
| **TRUE AS FACT, REFUTED AS DEFECT** — the observation holds, the implied remedy is wrong | **1** |
| **STILL OWED** — census limbs, no filing exists | **1** (+1 counted under TRUE) |

**Net for the programme: the retention gap is real and mostly unfixed, but four of the six findings that made
it look CRITICAL/BLOCKING have moved.** The cluster's severity profile at filing was 1 CRITICAL + 6 BLOCKING;
at HEAD it is **0 CRITICAL and 4 BLOCKING**, because #10 (the only CRITICAL) is half-fixed and #27/#28 are
substantially fixed.

---

## TRUE AT HEAD (12)

| # | Site at HEAD | What was re-checked |
|---|---|---|
| **24** | `reasoning-review-validator.ts:175-176` | `const prompt = judgePrompt(input)` → `print(prompt)`. The materialized prompt is never persisted. **E-1.** |
| **25** | `reasoning-review-validator.ts:176-182` | `let raw = await print(prompt)` … `catch { raw = await print(...) }` — **the first try's answer is destroyed by reassignment**, exactly as filed. **E-2.** |
| **29** | `routes/pwa/[id]/agent/+server.ts:342` | `if (ev.kind !== 'done') send(ev)` forwards **every** event to the browser, `thinking` included. ⚠ **LATENT, not active:** `pi-agent.ts:123` sets `thinkingLevel: 'off'`, which Guide §9.7 REQUIRES (*"Never solicit it"*), so no trace normally arrives. **The path is unguarded; the harness config is what prevents it.** |
| **55** | `assurance/agy-cli.ts:40-44` | The one external-tool path records no operation id, idempotency key, attempt status or reconciliation method. ⚠ **One limb HAS landed:** the model is pinned (*"the model that actually judged is the model recorded"*). |
| **58** | `routes/pwa/[id]/agent/+server.ts:274-276` | `catch { }` still swallows a `recordConversation` failure. ⚠ Now carries a comment — but it justifies **not falling back to canonical persistence**, a different concern from the record loss the finding names. A comment is not handling. |
| **59** | `agent/transcript.ts:25` | `RECORDABLE = {message, tool_call, tool_result, error}` — `thinking` is dropped at the write boundary rather than redacted and retained. Verdict `BOTH`; see §6 of the design for why the code is locally right and globally wrong. |
| **60** | `apps/rph-demo/src` | **Zero** `redact` occurrences (non-test). Prompt content reaches an external process **in argv** and the transcript is persisted, with no redaction anywhere. **E-6.** |
| **61** | `reasoning-review-validator.ts:42-43` | `excerpt()` appends `…(truncated)` **into the prompt string**; the prompt is never persisted, and no `limitations` entry records truncation. So truncation is declared **only in an artifact that is thrown away**. **E-4.** |
| **62** | `reasoning-review-validator.ts:179` | Bare `catch { }`; the parse failure and the repair attempt are recorded nowhere. **E-5.** |
| **63** | `routes/pwa/[id]/agent/+server.ts:196-208` | All four limbs hold: args flattened to `` `${ev.tool}(${compactArgs(ev.args)})` ``, structured result reduced to a `summary` string, no start/end, no resource use, no authorization scope. |
| **68** | `enums.ts:619` | `AUTHORING_CONVERSATION` remains a discriminator §5.2 does not list. ⚠ **Now DISCLOSED** — the m3 note says *"UNRATIFIED-AUTHORED … Ratification pending."* Still true; no longer silent. |
| **`limb:PER-9:7`** | — | **0** occurrences of `promptTemplate|templateFingerprint|promptFingerprint` (non-test). **Positive control: `contentHash` returns 37**, so the instrument finds identity fields where they exist. No prompt or template identity is minted anywhere. **STILL OWED a filing.** |

---

## PARTLY STALE (5) — each must be re-scoped before it is worked

| # | What changed | What survives |
|---|---|---|
| **10** ⭑ | ⚠ **THE EVALUATOR'S RESOLVED MODEL *IS* NOW PERSISTED.** `record-assurance.ts:41-50` `identityToActorReference` populates `modelId`, `providerId`, `executionInstanceId`, carried at `:205` as `executionProvenance: { evaluator: … }`. | **The PRODUCER's is not.** `floor.ts:248-250` reduces it to a boolean — `hasProducer: producer.agentId.length > 0 && (producer.modelId.length > 0 \|\| producer.providerId.length > 0)` — **checking the values and discarding them.** So E-3 holds for the judge and fails for the authoring agent. **This was the cluster's only CRITICAL.** |
| **26** | An Execution Attempt **read-model** exists (`rph-projections/src/execution-attempts.ts`, Fork A, ruled 2026-07-21), **and** a domain kernel (`rph-domain/src/execution.ts`: `InterruptedAttemptView`, `classifyInterruptedAttempt`, attempt counting, attempt-level idempotency). | **All three carriers hold ZERO of E-1..E-6.** The §10.4 shape landed; the exchange did not, and cannot arrive by projection because the folded events never carried it. |
| **27** | **Four of five limbs fixed.** `validatorResult` is now DOC-007 §20's shape carrying `validatorId`, `evidenceConsideredIds`, `evidenceRejected`, `limitations`, `residualUncertainty`, and the evaluator via `executionProvenance`. | **`claimResults: []`** — per-criterion results still dropped, ⚠ **DISCLOSED with a reason** (§20 routes them only through claims, and the floor evaluates criteria, not claims; inventing a claim id was refused). |
| **28** | **"never fills them" is FALSE.** `assurance.ts:2314-2316` fills `evidenceConsideredIds` / `residualUncertainty` / `recommendedControlActions` from `validatorResult` at completion. | Still initialized empty at creation (`:1386-1390`). The defect is now "empty until completion", not "empty forever". |
| **52** | Same as #26 — attempts are now derivable as a read-model. | Content still lands only in the event payload, never on step state. |

---

## FALSE AT HEAD (3) — fixed since filing

| # | Evidence |
|---|---|
| **56** | `floor.ts:448` `independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION')` — **derived, not fabricated.** ⚠ **VACUITY CHECKED:** `recording.ts:114-121` pushes that observation when `!po.independenceOk`, so the population is reachable and the derivation is not a control that cannot fail. |
| **57** | `floor.ts:339` `correlationId: opts.candidateSubjectHash` — one assignment, and it is the subject hash, not a per-path constant. It now correlates the floor Assessment to the turn's subject. |
| **65** | `objects.ts:614-626` — `ArtifactObjectSchema` carries the full 11-field storage shape (`storageProvider`, `storageKey`, `contentHash`, `byteSize`, `retentionClass`, …). No longer envelope-only. **This is what makes `PER-12`'s "typed Artifact" home constructible.** |

---

## TRUE AS FACT, REFUTED AS DEFECT (1)

**#46 — *"The authoring agent's runs are recorded as conversation entries, not as Attempts rooted in an Execution
Plan."*** The **observation is TRUE at HEAD.** The **implied defect is REFUTED by ratified text.**

Guide §9.7 L1340, verbatim: *"Where no Execution Plan exists—PWA authoring is the current example—the identical
recording obligation binds to the plane's own governed-stream record, **not to an Execution Attempt**."*

⚠ **So acting on #46 as written would have been a defect.** Giving authoring an Execution Plan to satisfy it is
exactly what `HARMONIZATION-LOG` C5 identifies as over-reach, and what the staged design §3.4 settled as a
category error. **What #46 correctly implies is that `ConversationEntry` must carry the exchange** — which is
`ICP-02`, not an Attempt migration. Recorded because *"a finding's recorded remedy is a hypothesis"*, and this
one was wrong.

---

## STILL OWED — census limbs

- **`limb:PER-9:7`** — counted TRUE above. No prompt/template identity surface. Owes a REG-F filing.
- **`limb:PER-9:10`** — **TRUE AT HEAD.** `rph-ports/src/ports/logger.ts:7` states *"MUST NOT carry secrets /
  PII / raw payloads"* and **nothing enforces it: `grep -l Logger verif/*.ts` returns 0 gates.**
  ⚠ **AND I CITED THAT LINE AS CORROBORATION** for the log/record split — in this session's reporting, not in
  the design record, which does not quote it — **without noticing the line is itself unenforced.** A prose
  constraint offered as if it were a control. Owes a REG-F filing.

---

## What this does to the programme

1. **`ICP-01` and `ICP-02` are unchanged in necessity.** E-1, E-2, E-4, E-5 are absent on every carrier, and
   E-6 has no implementation at all.
2. **E-3 must be re-scoped.** The design record says the resolved provider/model/version is uncarried. **That is
   now only true of the PRODUCER.** `ICP-02` should carry the evaluator's existing `ActorReference` pattern
   across to the producer rather than invent a shape — the same "adopt, don't derive" move as `ModelExchangeRecord`.
3. **The severity headline drops.** 1 CRITICAL + 6 BLOCKING at filing → **0 CRITICAL + 4 BLOCKING** at HEAD.
   The programme is real but smaller than the 2026-07-15 numbers imply, and any document quoting those numbers
   without this sweep overstates it.
4. **#46 must not be worked as filed.**
