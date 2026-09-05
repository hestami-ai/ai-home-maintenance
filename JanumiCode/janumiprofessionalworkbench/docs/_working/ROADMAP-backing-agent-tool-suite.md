# ROADMAP — `JAN-TOOLSUITE`: the executor and the reviewer become different tools

**Design:** `DESIGN-backing-agent-tool-suite.md` · **Date:** 2026-09-05

⭑ **The one-sentence goal:** the execution producer stops borrowing the assurance judge, so producer and reviewer
can differ — and the record says *which* tool answered, on the tool's own evidence.

⚠ **Order matters here.** `TS-02` is the only unit that fixes the actual defect; everything after it makes the
record honest about the fix. If the sequence has to stop early, stop after `TS-02`, not before.

---

### `TS-01` — the suite exists

A host registry of `BackingTool` declarations (`toolId`, `role`, `reports{identity,version,reasoning,diagnostics}`,
`invoke`). ⛔ **Not a ratified enum** — of 100 closed enums none names a vendor, and `PER-2` would make a
deployment fact permanent.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| registry returns a tool for an unknown `toolId` | the unknown-tool refusal test |
| a tool declaring `role: ASSURANCE` is selectable as an executor | the role-mismatch test |
| **CONTROL** | a correctly-declared tool IS selectable — else "refuse everything" passes the two above |

---

### `TS-02` — ⭑ the executor gets its own configuration (THE FIX)

`JPWB_EXECUTOR` / `JPWB_EXECUTOR_MODEL`, replacing the execution path's borrowing of `JPWB_ASSESSOR` /
`JPWB_JUDGE_MODEL`. Refuses when unset — **no application default**, per `REG-D-052`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| fall back to `JPWB_JUDGE_MODEL` when `JPWB_EXECUTOR_MODEL` is unset | the **collision** test: producer and reviewer must resolve to different identities |
| supply any default model label | the refusal test (`REG-F-331`: a pinned label rotted and every review failed) |
| **CONTROL** | with both configured to the *same* value, `checkIndependence` still REFUSES — proving the test reads identity, not env-var names |

⚠ The control matters more than usual: an arrangement where two different env vars happen to hold two different
strings would pass a naive test without ever proving the *independence check* saw them.

---

### `TS-03` — the Pi executor adapter

Reuses the **existing** `@earendil-works/pi-coding-agent` integration and the **existing** `ProducerIdentity`
(`agentId`/`modelId`/`providerId`). ⛔ Nothing about `agyPrint` changes — CSAA statically pins its name and its
`execFileAsync` call.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| rename or restructure `agyPrint` | the CSAA layout detector (`LAYOUT_UNRECOGNIZED` / `CONFLICTING`) |
| adapter returns a hardcoded provider/model instead of the reported one | the reported-identity test |
| **CONTROL** | the `agy` adapter still works unchanged, declaring `HOST_CONFIGURED` |

---

### `TS-04` — `PROVIDER_REPORTED` becomes reachable

The E-3 evidence arm is driven by the tool's **declaration**, not by a name check.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| always write `HOST_CONFIGURED` | the Pi identity-evidence test |
| always write `PROVIDER_REPORTED` | the **agy** test — agy confirms nothing, and grading its assertion as confirmation is the fabricated-measurement defect |
| write the model **label** into `resolvedModelVersion` | the version test: the arm stays `UNREPORTED` (`PER-9` forbids the substitution) |
| keep the old rationale verbatim | the rationale test — *"agy --print reports no model version"* is **false about Pi** |
| omit `providerId` from the producer `ActorRef` | the **populated-identity** test (see below) |

⛔ **`providerId` must be populated on the producer `ActorRef`.** Today `work-product-floor.ts:119-123` sets
`agentId` and `modelId` and **no `providerId`**, and `differs()` fails closed on absence — so any provider-based
check is a *permanent block* rather than a strict one. This is the unit where the `ProducerIdentity` reuse stops
being tidiness and becomes load-bearing.

⚠ It does **not** follow that the floor should then require `DIFFERENT_PROVIDER`. Design §4.5: the rungs are
**orthogonal**, and swapping would stop checking the model. Populate the field; leave the policy alone.

---

### `TS-05` — ⛔ the reasoning split, and the independence violation it prevents

Pi emits `thinking`; agy never did. `PER-12`: volunteered reasoning in an evaluator's context **is a
hidden-context independence violation (ASR-13)**.

⚠ **Red test first.** The survey found ASR-13's *"shared hidden context"* and *"shared prompt lineage"*
dimensions have **zero representation in code** — so this separation is the *only* thing standing between the
executor's reasoning and the reviewer's context.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| pass `rawOutput` to the reviewer instead of the answer span | the **leak** test — the reviewer's context must not contain the reasoning bytes |
| retain reasoning as `RETAINED_BY_PARTICIPATION` | the purgeability test (`PER-12` says `PURGEABLE_AT_EXPIRY`) |
| drop reasoning silently when present | the declared-omission test (`REG-D-057`: a cut is recorded with enough structure to undo) |
| **CONTROL** | a tool declaring `reasoning: NONE` records an **observed absence**, not a blocked split |

---

### `TS-06` — sanitisation as a measurement, not a declaration

The seam checks the outgoing diagnostic **for the prompt it just sent** and withholds on a hit.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| trust `diagnostics: PROMPT_FREE` and skip the check | the lying-tool test: a tool declaring PROMPT_FREE that echoes the prompt must still be withheld |
| withhold unconditionally | the retention test — a genuinely clean diagnostic must survive, or the fix destroys the diagnostics it was meant to save |

⭑ This closes a hole the survey found independently: the Validator wraps **no** call to `print(...)`, so an
injected backend's raw rejection reaches the floor runner and is projected today.

---

### `TS-07` — Devin: declared, unbound, refusing specifically

Registered with `bound: false`. Selecting it refuses, naming what is missing.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| selecting Devin silently falls back to another tool | the refusal test — a silent substitution is the fiction `REG-D-052` forbids |
| the refusal is generic | the message test: it must name *Devin* and *what is unmeasured* |

⚠ **No adapter is written against a guessed contract.** `devin` is not on PATH and its non-interactive shape is
unknown; the `agy` docblock records what guessing costs.

---

### `TS-08` — the end-to-end

**Exit:** ⭑ a model-executed work unit runs on Pi, is reviewed by a *different* tool, and completes — with
`checkIndependence` satisfied **on recorded identity**, not on configuration.

⚠ The refusal path stays asserted: a second case configures both roles to one tool and shows the review
`INDEPENDENCE_VIOLATION`. Without it, "independence satisfied" is unfalsifiable.

---

### `TS-09` — the two stale claims

Repair both sites in `DESIGN-backing-agent-tool-suite.md` §8. ⭑ Not a follow-up: `REG-F-356` corrected the claim
and left the prose live, and this increment would otherwise inherit it a second time.

---

### `TS-10` — filings

`REG-F-357` (finding). Numbering re-derived at the point of writing: highest defined are `REG-D-059`,
`REG-Q-078`, `REG-F-356`, `REG-E-033`. `REG-F-356` is the file's **last heading** (`:31608`, file 31669 lines),
so an append moves **no** line citation.

Must record, explicitly:
- the **corrected absence claim** (`piPrint` was a coined noun; `\bPi\b` returns 56 hits) — §1.1;
- the **explicit deferral** of `ModelSelectionPolicy` (`REG-D-048` requires answer-or-defer);
- that `REG-Q-069` / `REG-F-270` are **not** annexed;
- that `REG-Q-077` (may volunteered reasoning be read back?) becomes **live** — Pi produces some.

Roadmap ratchet `verif/slice-subsumption.test.ts:229`: **26 → 27**, warrant stated.

---

## Gates

check-types · lint · vitest (**276 files / 2320 baseline**) · playwright.

⛔ **CSAA is not in scope** and must be **unchanged** — verified, not assumed: its suite runs and its
`agyPrint` layout detector still resolves.
