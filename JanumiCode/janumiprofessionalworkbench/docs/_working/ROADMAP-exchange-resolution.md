# ROADMAP — `JAN-MXREAD`: resolving a retained exchange

**Design:** `DESIGN-exchange-resolution.md` · **Date:** 2026-09-04
**Rule carried from the design:** Layer 1 and Layer 2a **ship together or neither ships** (design §5).

---

## Stages

### `MXREAD-01` — the verdict vocabulary and the resolver

Add `packages/rph-application/src/exchange-resolution.ts` (application tier: it knows the contracts and the
port, and neither the demo app nor the engine is the right home for a rule about record-vs-content agreement).

- `RetentionVerdict` = `NOT_CLAIMED | VERIFIED | HASH_MISMATCH | PURGED | UNRESOLVABLE`.
- `verifyExchangeContent(state, store) → RetentionReport` over the four content refs
  (`materializedInputRef`, `rawOutputBeforeCoercionRef`, `answerSpanRef`, `volunteeredReasoningRef`).
- Re-hash the bytes; never return them.
- `UNRESOLVABLE` carries `distinguishable: boolean` off `contentDurability`, and the report's own text says
  which case it cannot tell apart on a `PROCESS_LOCAL` store.

**Exit:** the resolver compiles, is exported, and every verdict is reachable in test.

**Predicted reds, named before green is trusted:**

| Mutant | Must redden |
|---|---|
| compare `stat().contentHash` to the record instead of re-hashing | the `HASH_MISMATCH` test — and **only** it |
| report `UNRESOLVABLE` unqualified on a process-local store | the distinguishability test |
| treat a purge tombstone as `UNRESOLVABLE` | the `PURGED` test |

⚠ The first mutant is the one that matters: it is the version that *looks* like verification. If it does not
redden, the test is comparing two copies of one claim and the layer is ceremony.

### `MXREAD-02` — reading the participating half

`readAnswerSpan(state, store)` in the same module. Refuses unless the **stored metadata** reports
`RETAINED_BY_PARTICIPATION`, and calls `verifyExchangeContent` first — returning bytes that failed
verification is worse than returning none.

**Exit:** returns the exact bytes for a participating span; refuses a purgeable one with a stated reason.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| gate on the field NAME rather than the stored class | a fixture whose reasoning ref is passed as the answer — must still refuse |
| skip verification and return bytes | the tampered-store test |
| return the reasoning span too | the `PER-12` refusal test |

### `MXREAD-03` — the consumer, so Layer 1 is not hollow

Wire `readAnswerSpan` where a reader actually is. **Exit:** a production call site exists — not a test — and
`grep` for the export shows a non-test caller, with a positive control from the same module.

⚠ If no honest call site exists, **02 and 03 do not ship** and the design's §5 rule bites. That outcome is a
result, not a failure: it would mean the read path genuinely has no consumer until `REG-Q-077` is answered,
and shipping it anyway would be the hollow layer this repository keeps recording.

### `MXREAD-04` — file `REG-Q-077`, and the honesty items

- `REG-Q-077` per design §6, with its recommendation.
- ⭑ **`limb:ASR-11:3` does NOT move**, and the ledger row says why in advance — the failure mode
  `REG-F-347` filed.
- `REG-F-245` (b′)'s ground is narrowed by this work (`storageKey` now has a resolver); annotate, do not
  overturn — the `REG-F-348` pattern, applied deliberately this time rather than discovered afterwards.
- Re-run `REG-F-348`'s derivation: *what did this change make exist, and who is on record saying it does
  not?* **Run it, do not recall it** — it under-ran by two the last time.

---

## Gates

`bun run check-types` · `bun run lint` · vitest across every project but CSAA (**260 files / 2183 baseline**;
any new count must be explained by the tests added).

## Boundaries carried from the design

No new vocabulary · no read-authority mechanism · no new command or event · `artifact.test.ts:123-136` stays
green **and unedited** · no CSAA.
