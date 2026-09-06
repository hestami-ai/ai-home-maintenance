# ROADMAP — `JAN-EXECSESS`: one producer session per work unit

**Design:** `DESIGN-producer-session-per-work-unit.md` · **Date:** 2026-09-06

⭑ **Exit:** a live repair try in which the producer's reply shows it knows what it produced before — because the
history is its own, not because we pasted it back.

---

### `ES-01` — the seam becomes a session, not a call

`print: (prompt) => Promise<…>` is one-shot by construction. It becomes a producer **session** with `turn()` and
`dispose()`; the one-shot adapters (`agy`, the deterministic fixture) implement it as a session whose every turn
is independent, which is what they honestly are.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| open a new session per turn | the continuity test — turn 2 must reach a producer that saw turn 1 |
| never dispose | the lifetime test: a session must be released when the unit stops being worked on |
| make the fixture stateful | the fixture is one-shot BY NATURE and must keep saying so, or the gate stops modelling the deployed shape |

⚠ **The fixture and `agy` are NOT retrofitted with memory.** They have none; declaring one would be the
fabricated-capability defect. They implement the session interface with independent turns and **say so**.

---

### `ES-02` — findings are a TURN, not a splice

Remove the prompt-splice added in `JAN-EXECLOOP`; send the findings as the next turn.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep re-rendering the template on retry | the turn test — try 2 must not be handed the original instruction again |
| send prose instead of the structured findings | the structure test (`classifyFloorRemediation` reads codes *"never prose"*) |
| tell the producer HOW to fix it | unchanged from `JAN-EXECLOOP` — that is the harness doing the professional work |

---

### `ES-03` — ⛔ E-1 records the COMPOSITE, not the turn

Install `createMaterializedInputRecorder()` on the execution session, as the authoring path already does.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| record the turn text as E-1 | the composite test: with a held session the model saw a CONVERSATION, and a record naming only the turn understates *"the exact bytes presented to the model"* |
| install it before the session exists | the hook is on `session.agent`, which is why the authoring path installs it AFTER creation |

⭑ This is the unit that stops the change from silently degrading the record, and it is the reason it is not a
follow-up.

---

### `ES-04` — one exchange record per try, still

A shared session must not merge tries. `PER-9`: *"each retry, reformat, and repair request included."*

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| one exchange for the whole loop | the per-try test |
| reuse one artifact id across tries | CSAA-007 — *"repair never rewrites predecessor raw output"* |

---

### `ES-05` — run it live

⭑ **The deliverable.** Does the producer's second turn show it knows what it produced? Report the text, and do
not require any particular outcome.

⚠ A repair that succeeds is the interesting case; a stall is equally informative. Neither is the pass condition.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
