# DESIGN — the live execution lane

**Status:** design, pre-roadmap. **Sponsor direction (2026-09-05):** *"Proceed with the live execution lane."*

---

## 1. What has never happened

`JAN-TOOLSUITE` built the chain and proved it against gates. But **a work unit has never once run on a real model
reviewed by a real, different model.** Every green so far is against a deterministic fixture
(`deterministicExecutionPrint`) and an offline reviewer that judges *structure only* and records that limitation
on every pass it issues.

That is precisely the sponsor's original diagnosis, still unclosed at the only level that counts:

> *"a PWU is an agent with a prompt template and relevant context … none of that existed in reality. So a PWA
> actually could not truly run and do real work."*

⭑ It now can. Nobody has watched it.

## 2. The lane already exists

`playwright.live.config.ts` runs the **real Pi agent** against genuine prompts — its own port, its own dir
(`e2e-live/`), no retries, 360s timeouts, and the sponsor's own ASHRAE data-centre prompt in
`e2e-live/ashrae-datacenter-pwa.live.ts`. It boots in `RPH_DEMO_MODE=test` so the harness (reset / introspect /
stable ids) survives — *"only the AGENT is real."*

⚠ It covers **authoring** (`JPWB_AGENT=pi`). Extending it to **execution** is a new spec and four env vars, not
a new mechanism. This is the sixth time in this programme the system turned out to be built for the thing being
asked for.

---

## 3. ⛔ Two defects found by trying to use it

### 3.1 The executor's mock-vs-real switch is STILL the assurance env var

`JAN-TOOLSUITE` gave the executor its own **model** (`JPWB_EXECUTOR_MODEL`) and its own **tool**
(`JPWB_EXECUTOR`) — and left this untouched at `execution/model.ts`:

```ts
const forced = TEST_MODE ? process.env.JPWB_ASSESSOR : undefined;
if (TEST_MODE && forced !== 'agy') return deterministicExecutionPrint;
```

⭑⭑ **That is the same defect one layer over.** To run the executor live you must set the **ASSURANCE** switch to
the literal string `'agy'` — while also setting `JPWB_ASSURANCE_TOOL=devin`, so the configuration reads as a
contradiction: *"assessor = agy"* and *"assurance tool = devin"* at once. The value `'agy'` has quietly stopped
meaning *agy* and started meaning *not the mock*.

**The fix removes the borrowed switch rather than renaming it.** The executor is live exactly when it has been
configured:

```ts
if (TEST_MODE && !resolveExecutorToolId()) return deterministicExecutionPrint;
```

⚠ **Fail-closed is preserved and must be checked, not assumed.** The rule `createFloorRegistry` records is that
a mock may be selected **only inside test mode** — because `JPWB_ASSESSOR=mock` once swapped in a content-blind
mock in *any* environment while the floor still recorded SATISFIED. Outside test mode there is still exactly one
option and it is the real call; the new condition only decides which way **inside** test mode.

### 3.2 The reviewer's mock-vs-real switch has the same wart

`createFloorRegistry` reads `useMock = testMode && forced !== 'agy'`. Same fix, symmetric: the real reviewer is
selected when a reviewing tool has been **explicitly configured** (`JPWB_ASSURANCE_TOOL` present), which retires
the `'agy'`-means-real sentinel on both sides at once.

⚠ This breaks `floor-recording.test.ts`, which sets `JPWB_ASSESSOR = 'agy'` to force the real reviewer. That is
**my** change breaking it, so it is mine to update — one line, and the updated form says what it means.

---

## 4. The live reviewer's work-product prompt

`judgePrompt` currently tells the reviewer:

> *"The artifact (a canonical graph export / serialized subject) to review:"*

⛔ **Graph-shaped language, for a subject that is now sometimes a work product.** A reviewer told it is looking
at a canonical graph export, and handed a JSON assessment of a delivery route, has been misdescribed to — and a
review conducted on a false description of its subject is worse than no review, because it is recorded as one.

**The fix is a subject-appropriate framing, selected on `subject.objectType`** — the same routing the offline
arm already does (`REG-F-355`). Two framings, one rubric: the criteria still come **from the policy**, because
`ASR-4` holds that policy meaning is stable across validator replacement, and inventing a second rubric here
would be the restated-vocabulary defect `REG-F-353` names.

⚠ **Rationale and narration still render unconditionally**, even though an executing model declares neither.
§9.7's rule is that *presence or absence is never a signal* — so the sections render `(none recorded)` rather
than disappearing, exactly as they do today. Removing them for execution subjects would encode the producer's
silence into the reviewer's input shape.

---

## 5. What the lane asserts, and what it must NOT

⭑ **Structure hard, quality soft** — the convention the existing live specs already follow, stated in
`ashrae-datacenter-pwa.live.ts`: the coherence verdict is *"reported SOFTLY: model output is non-deterministic,
so an ungrounded branch must be made VISIBLE in the log/annotation rather than turned into a brittle live
failure."*

**Asserted hard** (facts that do not depend on model quality):

| | |
|---|---|
| A model was invoked on behalf of the step | an exchange record exists on the `EXECUTION` plane |
| The producer identity is the **executing** model | not the reviewing one — the defect `JAN-TOOLSUITE` fixed |
| ⭑ Producer and reviewer **differ** | `differs('modelId')` on two real vendors — the first real independence verdict this system has ever produced |
| ⭑ Both grade `PROVIDER_REPORTED` | the first time that ratified value is written by live tools rather than a fixture |
| A work product was retained | and the reviewer received the **answer**, never volunteered reasoning (`PER-12`) |

**Reported softly:** whether the review SATISFIED. ⛔ A live spec that *required* SATISFIED would be asserting
that GLM-5.2 approves of GPT's work — a fact about two vendors on one prompt, not about this system. And the
failure mode is worse than flakiness: the cheapest way to make such a test pass is to weaken the reviewer, which
is the rubber stamp this floor exists to prevent.

⭑ **The disposition is REPORTED, not asserted** — printed with its observations, so a human reads what the
reviewer actually said. That is the point of the run.

---

## 6. What this lane can tell us that no gate can

- **Is GLM-5.2 a competent reviewer of professional work?** Nothing so far can answer this: the offline arm
  checks that a work product parses, is non-empty, and is not a restatement of its prompt.
- **Does the executor's minimal system prompt produce a conforming work product?** `outputContract` is free
  text and `schemaValid` means *parseable*, so only a live run shows whether a real model honours it.
- **Does independence hold in production, or only in a fixture?** The offline reviewer has a fixed identity;
  two real vendors are the actual test.

---

## 7. Not in scope

- ⛔ **`REG-D-059`'s feedback loop.** It needs real findings, which this lane produces — but looping needs the
  loop bound, and building both at once means neither gets a red test of its own.
- ⛔ **Machine-checkable `outputContract`.** A vocabulary question, not a wiring one.
- ⛔ **CSAA's 27 failures.** Not ours; the zero-intersection evidence is recorded in `REG-F-357`.
