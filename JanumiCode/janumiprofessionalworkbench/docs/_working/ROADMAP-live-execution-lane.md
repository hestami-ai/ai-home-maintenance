# ROADMAP — `JAN-LIVEEXEC`: a work unit runs on a real model, reviewed by a different one

**Design:** `DESIGN-live-execution-lane.md` · **Date:** 2026-09-05

⭑ **Exit:** a professional presses Execute, **Pi** produces a work product, **Devin/GLM-5.2** reviews it, and a
human can read what the reviewer actually said.

⚠ **`LE-01` and `LE-02` are the ones that must be right.** They are defect fixes, they belong in the
deterministic gate, and they carry mutants. `LE-03`–`LE-05` are the lane itself and are non-deterministic by
construction — they may never gate.

---

### `LE-01` — the executor stops borrowing the ASSURANCE switch

`execution/model.ts` still reads `JPWB_ASSESSOR` to decide fixture-vs-live. Replace with: live exactly when
`JPWB_EXECUTOR` is configured.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep reading `JPWB_ASSESSOR` | the new test: `JPWB_EXECUTOR` set + `JPWB_ASSESSOR` unset must select a real tool |
| return the fixture whenever `TEST_MODE` | the same test |
| return a real tool when **nothing** is configured | the fixture test — the gate must not spawn a subprocess |
| **CONTROL** | in test mode with `JPWB_EXECUTOR` unset, the deterministic fixture is still returned — else every gate run starts calling models |

⛔ **Fail-closed is checked, not assumed:** outside test mode there must still be exactly one option and it must
be the real call. A test asserts that a mock is unreachable outside test mode.

---

### `LE-02` — the reviewer's switch, symmetric; and its work-product framing

Real reviewer when `JPWB_ASSURANCE_TOOL` is explicitly set. Retires the `'agy'`-means-real sentinel on both
sides. ⚠ Updates `floor-recording.test.ts`, which sets `JPWB_ASSESSOR='agy'` — my change, my repair.

Then `judgePrompt` describes its subject correctly: a **work product** for an `ARTIFACT`, a **graph export**
for a PWA.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| describe an ARTIFACT as *"a canonical graph export"* | the framing test — the reviewer must not be misdescribed to |
| use one framing for both | the PWA test (the graph framing must survive untouched) |
| invent a second rubric for work products | the criteria test — ids come **from the policy** (`ASR-4`, `REG-F-353`) |
| drop rationale/narration for execution subjects | the §9.7 test — *presence or absence is never a signal*; they render `(none recorded)` |
| **CONTROL** | the existing reviewer specs pass unedited |

---

### `LE-03` — the lane's configuration

`playwright.live.exec.config.ts` (or the existing live config extended): `RPH_DEMO_MODE=test` for the harness,
plus `JPWB_EXECUTOR=pi`, `JPWB_EXECUTOR_MODEL`, `JPWB_ASSURANCE_TOOL=devin`, `JPWB_ASSURANCE_MODEL=glm-5-2`. ⭑ *2026-09-26 (`REG-D-084`; `JAN-SELREV` `SR-3`):* the reviewing model is configuration, and the sponsor-selected value is `glm-5-3-flash-max`. GLM-5.2 was the model when this lane was built. The lane's required variables now follow the tool (`e2e-live-exec/lane-config.ts`; `REG-F-461`).

⛔ **No model label is pinned in the config** (`REG-D-052`; `REG-F-331` measured what pinning costs). The
config reads them from the environment and the run **refuses** with the existing message when unset.

---

### `LE-04` — the live spec

Mirrors `e2e/execution-model-invocation.e2e.ts` — author a type with a real prompt template, arm it, publish,
instantiate, Execute — but against real tools.

**Asserted HARD** (independent of model quality): an exchange on the `EXECUTION` plane; the producer identity
is the **executing** model; ⭑ producer and reviewer **differ**; both grade `PROVIDER_REPORTED`; a work product
is retained and the reviewer received the **answer**, never reasoning.

**Reported SOFTLY:** the disposition and its observations, printed for a human.

⛔ **The spec must NOT require SATISFIED.** That would assert that one vendor approves of another's work on one
prompt — and the cheapest way to make it pass is to weaken the reviewer, which is the rubber stamp this floor
exists to prevent.

---

### `LE-05` — read the result

Run it. Record what the reviewer actually said, and whether the work product honoured the template's
`outputContract`. ⭑ **This is the deliverable** — the lane exists to produce an observation, not a green tick.

---

## Gates

check-types · lint · vitest · playwright (deterministic). ⚠ The live lane is **opt-in and never in the gate**:
it hits the network, costs money, and is non-deterministic — a flaky gate makes every other failure
unattributable.
