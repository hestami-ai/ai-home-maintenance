# DESIGN — the backing agent tool suite (Pi as executor, Devin as assurance)

**Status:** design, pre-roadmap. **Sponsor direction (2026-09-05):** *"We will use Pi CLI for the executor or PWU
executing agent backing tool; and we will use Devin CLI as another agent tool for the assurance policies backing
tool. Devin CLI has not been incorporated into the supported agent tools suite just yet and so will need to be."*

---

## 1. What was measured, before anything was proposed

### 1.1 A correction I have to make first

Earlier in this programme I reported, as part of `REG-F-356`, that *"with the LIVE reviewer configured, producer
and reviewer would be the same model."* That statement was **too broad**, and the way I got it wrong is worth
recording because it is the failure mode this repository keeps catching.

I searched for `piPrint` and `pi-cli` — **nouns I coined** — and got zero hits, and concluded Pi was absent.
The obligation-shaped search (`\bPi\b`) returns **56 hits across 18 files**, including a complete
`apps/rph-demo/src/lib/server/agent/pi-agent.ts` and a declared dependency
`@earendil-works/pi-coding-agent@0.80.6`. Pi is not new here. It is the **live authoring agent**, integrated as
an **in-process SDK**, not a CLI subprocess.

⭑ What is actually true is narrower and sharper:

| Path | Producer | Reviewer | Independent? |
|---|---|---|---|
| **Authoring** (chat that builds a PWA) | Pi / Codex | agy / Gemini | ⚠ different vendor **by intent**, but unprovable — see below |
| **Execution** (the PWU model invocation, JAN-EXECRUN) | `agyPrint` | `agyPrint` | ❌ **same tool, same model** |

⚠ The authoring row is deliberately *not* a tick. `REG-F-318` records a half-fixed CRITICAL: at HEAD the
**evaluator's** `ActorReference` carries `modelId`/`providerId` (`record-assurance.ts:41-50`) but **the
producer's does not survive** — it is collapsed to a boolean at the floor. So provider independence cannot be
*claimed* on the authoring plane, whatever the deployment actually does. ⭑ The **execution** plane differs, and
that is why this work belongs there: `REG-F-354` records that the producing exchange **does** record the
resolved identity. This design therefore lands `PROVIDER_REPORTED` where it can actually be evidenced.

The authoring path already got this right, and says so at
`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:2`:

> *"It is a DIFFERENT vendor than the Pi/Codex executor (model/provider independence)"*

The **execution** path — built recently — reused the judge model as a stopgap, and
`apps/rph-demo/src/lib/server/execution/model.ts:14-17` says so in its own words: *"This increment reuses the
host's configured judge model."* That reuse is the collision. The sponsor's direction repairs it by aligning the
execution path with a decision the codebase had already made.

### 1.2 Pi, driven rather than read about

Everything below was obtained by running the tool, not by reading its docs.

| Fact | Evidence |
|---|---|
| `pi` installed; `agy` installed; **`devin` NOT on PATH** | `command -v` |
| `--print` non-interactive, clean stdout | returned exactly `PONG` |
| ⭑ **reads STDIN** | `echo … \| pi --print` → `STDINOK` |
| `--mode json` reports `provider`, `model`, `api`, `responseId`, `usage`, `cost`, `stopReason` | NDJSON `message_end` |
| ⭑ `thinking` and `text` are **separate typed content blocks** | same stream |
| Auth: `openai-codex` **ready**; `anthropic`/`google` **not_ready** | `pi auth check` |
| Failure output carries **no prompt** | canary `SECRET-PROMPT-CANARY-12345` absent from stderr |

⚠ The canary test exercised **one** failure mode (unknown model). It is evidence, not proof, and §4.6 treats
diagnostic safety as a per-call **measurement** rather than a per-tool assumption.

### 1.3 The state of the repository

Each of these was verified with a control search that finds a thing which *does* exist.

- **No agent-tool suite exists.** No registry, enum, catalog, or allowlist of permitted backing tools, in code or
  in canon. ⭑ Of the **100 closed enums** in the ratified contracts, **not one names a tool, agent, provider, CLI
  or vendor.** So "the supported agent tools suite" the sponsor refers to is a thing to be **created**, not
  extended.
- **No register entry has ever ruled on admitting a backing *tool*** — only on the *model* it runs. The
  admission rationale for `agy` lives in code comments and a harness README, never in the register.
- **The execution producer has no configuration of its own.** There is no `JPWB_EXECUTOR`; it reads the
  *assurance* switch `JPWB_ASSESSOR` and the *assurance* model `JPWB_JUDGE_MODEL`. **This is the collision, in
  one line.**
- `JPWB_JUDGE_MODEL` is **unset** and there is no `.env`. Nothing is live today.
- **`Devin` appears nowhere in the repository** — no prior art, no ruling, no deferral.

### 1.4 Four ratified slots that were built for this and have never been reachable

| Slot | State today | Control |
|---|---|---|
| `ExchangeIdentityFact.evidence = 'PROVIDER_REPORTED'` | **zero producers** — only in `dist/*.d.ts` and the enum | `HOST_CONFIGURED` has 26 uses |
| `IndependenceRequirement.DIFFERENT_PROVIDER` | **enum-only**; no policy selects it, no test exercises it | `DIFFERENT_MODEL` is selected and tested |
| `ActorRef.providerId` — *"DOC-007 §6 addition (for validator-independence resolution)"* | declared | — |
| `ProducerIdentity {agentId, modelId, providerId}` — *"the ACTUAL producer… not a role label"* | exists, used by the **authoring** path only | `agent/types.ts:8-14` |

⭑ This is the fifth time in this programme the system has turned out to be designed for the thing being asked
for and never used that way. The work is mostly **reaching slots that already exist**, not adding vocabulary.

---

## 2. What this design does NOT do, and why

- ⛔ **It does not pin a model.** `REG-D-052` is a sponsor ruling that the judge model is *configured, not
  pinned*, with **no application default**, and that its absence is a **refusal**. `REG-F-331` is the measured
  reason: a hardcoded label rotted, the installed `agy` rejected it, and **every** Reasoning Review failed. This
  design adds configuration keys and refusals, never a default label.
- ⛔ **It does not add a vendor name to any ratified enum.** None of the 100 closed enums names a vendor, and
  adding one would make a deployment fact permanent under `PER-2`. The suite is an **in-process host registry**,
  the same status `createFloorRegistry` already declares for itself: *"an in-process seam, not a persisted
  contract."*
- ⛔ **It does not rename or restructure `agyPrint`.** CSAA statically analyses for a function named exactly
  `agyPrint` calling `execFileAsync`
  (`packages/csaa/src/providers/runtime/project-hybrid-static-prerequisites.ts:919`), and returns
  `LAYOUT_UNRECOGNIZED` / `CONFLICTING` if that shape changes. Per standing instruction CSAA belongs to its own
  agent; this design leaves that function untouched and adds alongside it.
- ⛔ **It does not record an `EXTERNAL_TOOL_ATTEMPT`.** That is CSAA finding **#55** — an external tool invoked
  through `execFileAsync` without a recorded attempt. It is adjacent and it is CSAA's. §7 notes it.
- ⛔ **It does not put a tool name on `PWU_TYPE`.** `REG-F-353` already refused a fourth `workDischarge` member
  (`⛔ NO EXTERNAL_PARTY MEMBER … a second way to say one thing is how restated vocabulary comes to disagree`),
  and forbids inventing a new `PWU_TYPE` field to name a backing tool without arguing against that. Which tool
  runs a step is **deployment configuration**, not a property of the work-unit type. `workDischarge: MODEL` says
  *a model does this work*; it does not, and must not, say *which vendor*.
- ⛔ **It does not annex `REG-Q-069` or `REG-F-270`.** The three-rung conformance ladder
  (LIGHTWEIGHT/STANDARD/HIGH_ASSURANCE → `DIFFERENT_INVOCATION`/`DIFFERENT_AGENT`/`DIFFERENT_MODEL`) is **unread
  dead data** — the profile selector is a bare `z.string()` and no site joins them. So this design may **not**
  argue "a HIGH_ASSURANCE deployment selects a stricter rung"; it does not. `REG-Q-069` carved the
  `minIndependence` conjunct out and assigned it to `REG-F-270`, and filing it a third time is forbidden.

### 2.1 The warrant, and its fence

⭑ **`REG-D-058` / `ASR-4` is what makes this legal at all**: *"prompts, models, and deterministic checks are
runtime assets of the policy, never the policy itself."* Swapping the backing tool or model therefore **does not
re-open recorded assurance**, and a tool change is **not** a policy change.

⚠ **But the fence is explicit and this design honours it**: `ASR-4` speaks to *meaning* and says nothing about
*reproducibility*. The template and identity a run used stay **pinned by that run's exchange record**, and a
later tool change **cannot reach backwards**. Historic assessments keep the producer identity they were made
against.

### 2.2 `ModelSelectionPolicy` — an EXPLICIT deferral

`REG-D-048` requires that a roadmap introducing a tool selector **answer or defer `ModelSelectionPolicy`'s shape
explicitly**, because the ontology still records it as *"NOT field-defined. Source TBD."*

⛔ **This design DEFERS it, and states the deferral rather than leaving it implied.** Grounds: the field has no
shape anywhere in the corpus, **no reader**, **no command that can set it**, and the demo **never creates a
`RUNTIME_BINDING` at all** — so populating it would be authoring vocabulary for a slot nothing can write and
nothing can read. Host configuration (§4.1) is the honest home for a deployment fact today. When
`RUNTIME_BINDING` gets a lifecycle and an editor, this is the first thing that should move into it.

- ⛔ **It does not bind Devin.** See §5.

---

## 3. The shape: a tool declares what it can report, and is believed only that far

The suite is **not** a list of names. A name would let a tool be trusted for facts it never supplies — which is
exactly the fabricated-measurement defect this repository records repeatedly.

A backing tool is admitted as a **capability declaration plus an adapter**:

```
BackingTool {
  toolId          'pi' | 'agy' | 'devin'      (host-local string, NOT a ratified enum)
  role            EXECUTION | ASSURANCE       (a tool may declare both)
  reports: {
    identity      'PROVIDER_REPORTED' | 'HOST_CONFIGURED'   ← drives the E-3 evidence arm
    version       boolean
    reasoning     'STRUCTURAL' | 'INLINE' | 'NONE'          ← drives the §9.7 split
    diagnostics   'PROMPT_FREE' | 'PROMPT_BEARING'          ← drives sanitisation
  }
  invoke(request) => ToolInvocationResult
}
```

⭑ **The declaration is what the recorder reads.** It never asks "is this Pi?"; it asks "does this tool report its
own identity?" That keeps the record honest for a tool nobody has written yet, and it is what lets Devin be
declared before it is measured.

### 3.1 The result type, and why the current seam cannot carry it

The producer seam today is `print: (prompt: string) => Promise<string>` — a bare string. It cannot carry
provider, model, `responseId`, usage, or a separated reasoning span, so **`PROVIDER_REPORTED` is unreachable
through it by construction**. That is why the slot has never had a producer.

```
ToolInvocationResult {
  answerText            // E-2 answer half        → RETAINED_BY_PARTICIPATION
  volunteeredReasoning? // E-2 reasoning half     → PURGEABLE_AT_EXPIRY (PER-12)
  rawOutput             // E-2 whole              → for the blocked path only
  producer: ProducerIdentity   // agentId / modelId / providerId  (REUSED, not invented)
  identityEvidence      // 'PROVIDER_REPORTED' | 'HOST_CONFIGURED'
  diagnostics?
}
```

⚠ The existing `AgyPrint` type and `agyPrint` function are **unchanged**. `agy` becomes one adapter whose
declaration says `identity: HOST_CONFIGURED`, `reasoning: INLINE`, `diagnostics: PROMPT_BEARING` — which is
precisely what it is, and its existing behaviour follows from that declaration rather than from special-casing.

---

## 4. What each part buys, stated as an obligation

### 4.1 The producer/reviewer collision (the actual defect)

Give the execution producer its **own** configuration — `JPWB_EXECUTOR` and `JPWB_EXECUTOR_MODEL` — instead of
borrowing the assurance ones. Refuse when unset, per `REG-D-052`. ⭑ This single change is what makes producer and
reviewer *capable* of differing; everything else records that they do.

### 4.2 `PROVIDER_REPORTED` becomes reachable

For `agy`, provider and model are `HOST_CONFIGURED` — the host asserts them and the tool never confirms. Pi
**reports them back**. Recording that as `PROVIDER_REPORTED` raises the evidence grade of E-3 from *asserted* to
*confirmed*.

⚠ **But not the version.** Pi reports a model **label** (`gpt-5.4-mini`), not a version string. The
`resolvedModelVersion` arm stays `UNREPORTED` — with a **corrected rationale**, because the existing one
(*"agy --print reports no model version"*) would be false about Pi. Writing a label into a version field is the
substitution `PER-9` forbids.

### 4.3 The §9.7 split becomes structural, and prevents an independence violation

Today the answer/reasoning split is a **heuristic text scan** (`splitAnswerSpan` locating a JSON object in a
blob). Pi's JSON mode makes it **structural**: `thinking` and `text` arrive as distinct typed blocks.

⚠⚠ **This is a safety requirement, not a tidiness one.** `PER-12` (DOC-003:381):

> *"never an input to any tier of assurance policy… **its presence in an evaluator's context is a hidden-context
> independence violation (ASR-13)**"*

Pi emits reasoning; `agy` never did. So the moment Pi becomes the executor, passing raw output to the reviewer
would manufacture an independence violation. The reviewer must continue to receive **only** the answer span.

⛔ And the survey found there is **no check for this**: ASR-13's dimensions *"shared hidden context"* and
*"shared prompt lineage"* have **zero representation in code**. The separation is therefore the only thing
standing between the executor's reasoning and the reviewer's context, which makes it a **red-test-first** item.

### 4.4 The prompt ceiling and the destroyed diagnostic

`MAX_AGY_PROMPT_CHARS = 28_000` exists **only** because agy takes the prompt in argv. The same fact forces every
agy failure diagnostic to be **destroyed**: `execFile` rejects with `Command failed: <full argv>`, which carries
the entire prompt, and that string would be written verbatim into a projected `VALIDATOR_EXECUTION_FAILED`
observation.

A stdin-fed tool has neither problem: no ceiling, and argv carries no prompt.

⚠ The survey found a real hole here: **sanitisation is not enforced at the seam.** The Validator wraps no call
to `print(...)`, so an injected backend's raw rejection reaches the floor runner and is projected. Any new
adapter would inherit that. §4.6 closes it.

### 4.5 A second, ORTHOGONAL independence rung becomes available

⚠⚠ **I had this wrong in an earlier draft and the correction matters.** I described `DIFFERENT_PROVIDER` as a
*stronger* rung than `DIFFERENT_MODEL`. It is not. `checkIndependence` (`assurance-rules.ts:185-216`) is a **flat
switch of single-dimension equality tests, not a ladder**: each arm compares exactly one `Identity` field and
**no rung implies any other**.

```
case 'DIFFERENT_MODEL':    return differs('modelId')     // does NOT check provider
case 'DIFFERENT_PROVIDER': return differs('providerId')  // does NOT check model
```

⛔ So **swapping** the floor from `DIFFERENT_MODEL` to `DIFFERENT_PROVIDER` would **stop checking the model
altogether**. Two providers serving the same model id would pass. That is a weakening wearing the costume of a
strengthening — precisely the trade `REG-D-013` says to refuse.

⭑ The honest options are therefore: **keep `DIFFERENT_MODEL`** (recommended for this increment), or **require
both**, which is a *conjunction that does not exist* — there is no ordering, ranking, or "at least as strong as"
comparator over the eight values anywhere in the repository, and building one is a canon question because canon's
**four** ASR-13 stages do not linearize the code's **eight** enum values.

⚠ Two further constraints found with it:

1. **`differs()` fails closed on absence** — it requires the field present on **both** sides. Selecting a rung
   whose field is unpopulated designs a *permanent block*, not a strict check.
2. ⛔ **The work-product producer sets `modelId` but no `providerId`** (`work-product-floor.ts:119-123`). So
   `DIFFERENT_PROVIDER` is **unreachable on this path today** regardless of policy. Populating `providerId` on
   the producer `ActorRef` is a prerequisite, and this design does it in `TS-04` — which is also what makes the
   `ProducerIdentity` reuse load-bearing rather than tidy.
3. The enum is a **closed generated wire contract** (`urn:janumi:rph:schema:enum:IndependenceRequirement:1`).
   Adding a ninth rung is a contract-version change, not a code edit.

### 4.6 Sanitisation as a measurement

Rather than trusting a tool's `diagnostics: PROMPT_FREE` declaration, the seam **checks the outgoing diagnostic
for the prompt it just sent** and withholds on a hit. A declaration that is wrong then fails safe, and the
canary result in §1.2 becomes a test rather than an assumption.

---

## 5. Devin: MEASURED, and the reviewer is GLM-5.2

⚠ **A correction, and it was mine.** I reported Devin *"not installed"* on the strength of `command -v devin`
returning nothing in Git Bash. The sponsor was right: it **is** installed. `devin.exe` sits at
`C:\Users\mchen\AppData\Local\devin\cli\bin\`, and that directory **is in the registry `Path`** — it is simply
the one entry **missing from this session's process environment**, which started before it was added.

⭑ The diagnostic that settled it is worth keeping: comparing the **registry** `Path` against the **process**
`Path` returned exactly one difference, and it was the Devin entry. Checking a single shell's `PATH` and calling
a tool absent is the same error as searching for a coined noun — the instrument was stale, not the fact.

**Sponsor direction (2026-09-05):** *"Use GLM-5.2 with Devin."*

### 5.1 The measured contract — `devin 3000.6.14`

| Fact | Value |
|---|---|
| Non-interactive | `-p` / `--print [<PROMPT>]`, clean stdout (returned exactly `PONG`), exit 0 |
| ⭑ Prompt off argv | `--prompt-file <FILE>` — stronger than stdin: the prompt never touches argv |
| Model | `--model <MODEL>` (env `DEVIN_MODEL`); `devin models list` enumerates 46 families |
| ⭑ Structured record | `--export <PATH>` → **ATIF-v1.7** JSON |
| ⭑ Reports its own model | `agent.model_name: "GLM-5.2 High"` **and** per-step `extra.generation_model: "glm-5-2"` |
| Usage | `final_metrics.{total_prompt_tokens, total_completion_tokens, total_cached_tokens, total_steps}` |
| ⭑ Volunteered reasoning | **NONE** — `thinking` / `reasoning` / `thought` appear nowhere in the export |
| Backend | `agent.extra.backend: "Windsurf"`, `permission_mode: "Normal"` |

**Chosen model:** `glm-5-2` (GLM-5.2 High, 200K context, **Free**). ⭑ Free matters for a reviewer that runs on
every work product. `glm-5-2-none` ("No Thinking") and 1M-context variants exist if wanted later.

### 5.2 Why this pairing is a good one

| Role | Tool | Model | Volunteered reasoning |
|---|---|---|---|
| Producer | Pi (SDK) | `gpt-5.x` via `openai-codex` | **emits it** → split, retained `PURGEABLE_AT_EXPIRY` |
| Reviewer | Devin | `glm-5-2` | **emits none** → recorded as an *observed absence* |

`differs('modelId')`: `gpt-5.x` ≠ `glm-5-2`. ⭑ **`DIFFERENT_MODEL` is satisfied on recorded evidence** — the
first time on this path. Both tools report their own identity, so **both** sides record `PROVIDER_REPORTED`
rather than `HOST_CONFIGURED`.

### 5.3 ⚠ Two hazards the measurement exposed

1. ⛔ **Devin injects ambient context into the reviewer.** The export's system steps carry
   `<rules type="always-on">` loaded from `C:\Users\mchen\.codeium\windsurf\memories\global_rules…` and an
   `<available_skills>` block. **The reviewer's context is therefore not only the reviewer's prompt.** ASR-13
   names *"shared hidden context"* as one of its eight dimensions, and if the producing side ever loads the same
   ambient rules, that is a shared-context violation nothing currently detects. The adapter must suppress
   ambient context where it can (`--config` override) and **disclose** what it cannot.
2. ⚠ **Print mode fails in an untrusted directory.** The help states it plainly, and the fix flag
   (`--respect-workspace-trust false`) is a trust bypass. ⭑ It proved unnecessary — the repository directory is
   already trusted and the call succeeded without it — so the adapter **must not** pass that flag, and an
   untrusted-directory failure must surface as a refusal to be fixed by trusting the directory, never bypassed.

### 5.4 What still holds from the original position

The discipline that would have applied to an unmeasured tool stays available for the *next* one: a tool is
admitted by **declaration plus measurement**, and an unmeasured adapter refuses rather than approximates. Devin
has now been measured, so it is **bound**. Nothing here was guessed.

---

## 6. Sponsor questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Change the reasoning-review floor from `DIFFERENT_MODEL` to `DIFFERENT_PROVIDER`? | ⛔ **No — it would stop checking the model** (§4.5). Keep `DIFFERENT_MODEL`. If both are wanted, that is a **conjunction that does not exist** and is a canon question, not a policy edit. ⚠ And never as "a profile selects it": `REG-Q-069` records the profile ladder is unread dead data, and `REG-F-270` owns that conjunct. |
| Q2 | Devin | ✅ **SETTLED** — installed, measured (§5.1), bound. Reviewer model `glm-5-2` per sponsor. |
| Q3 | Which Pi model executes work units? | **Do not pin one** (`REG-D-052`). Configure `JPWB_EXECUTOR_MODEL`; refuse when unset. |
| Q4 | Pi **SDK** or Pi **CLI**? | ✅ **SETTLED — SDK, as a practical try** (sponsor, 2026-09-05), with the reservation in §6.1 recorded rather than dismissed. |

### 6.1 ⚠ The sponsor's reservation about the SDK, recorded not waved away

> *"I'm concerned because there are some differences between what's available through the SDK and what's
> available through the CLI. E.g., I don't think the SDK approach provides methods to know if / when the context
> window is about to need compression. There were some other tradeoffs as well. But let's give it a practical
> try."*

⭑ **This is a real risk and it has a bounded blast radius here**, which is why "a practical try" is a sound call
rather than a gamble:

- The execution producer runs **one bounded turn per execution step** — render a prompt, get a work product back.
  It is not a long-running conversation, so compaction pressure is structurally unlikely on *this* path. The
  **authoring** agent is the long conversation, and it already uses the SDK today.
- ⛔ **But "unlikely" is not "measured", and a silent compaction would be the worst failure mode available**: it
  would truncate the materialized input (`PER-9` E-1) *after* the record claimed what was sent. So the adapter
  **records the token accounting it can see** and treats a missing signal as an **`UNREPORTED` measurement**, not
  as "no compaction happened".
- **The fallback is cheap.** The Pi CLI's `--mode json` stream carries per-message `usage` (input / output /
  cacheRead / cacheWrite / totalTokens). If the SDK proves blind to compaction, the adapter swaps to the CLI
  behind the same `BackingTool` declaration — which is precisely what the suite abstraction is for. ⭑ Nothing
  else in the design moves.

### 6.2 ⭑ The reservation, checked — the SDK DOES expose the signal

The concern was specific and checkable, so it was checked rather than deferred. **`@earendil-works/pi-coding-agent@0.80.6`
re-exports these from its package root** (`exports["."] → dist/index.d.ts`, verified — not merely present in
`dist/`):

| Public export | What it gives |
|---|---|
| ⭑ `shouldCompact(contextTokens, contextWindow, settings): boolean` | *"Check if compaction should trigger based on context usage."* — **precisely the "is it about to need compression" signal** |
| `calculateContextTokens(usage): number` | total context tokens from a `Usage` |
| `getLastAssistantUsage(entries): Usage \| undefined` | the live usage to feed the above |
| `estimateTokens(message): number` | conservative per-message estimate |
| `compact()`, `DEFAULT_COMPACTION_SETTINGS`, `CompactionResult` | the compaction operation and its result |

⭑ **And they are pure functions** — the module says so: *"Pure functions for compaction logic. The session
manager handles I/O."* So the adapter can call `shouldCompact` purely to **observe and record**, without
surrendering control of when compaction happens. That is a better shape than a CLI status line, which would have
to be parsed out of a stream.

⚠ One precision: `estimateContextTokens` (the richer `{tokens, usageTokens, trailingTokens, lastUsageIndex}`
estimate) is **internal** — it is not in the root re-export list. The four public functions above are sufficient.

**Resolution:** the reservation does not hold for this SDK version. It was a reasonable prior — it is simply not
what `0.80.6` ships. The CLI fallback in §6.1 stays documented as the escape hatch, unexercised.

---

## 7. Adjacent, noted, not taken

- **CSAA finding #55** — an external tool invoked via `execFileAsync` with no recorded attempt (8 required
  fields: `attemptId, commandIdentity, environmentIdentity, exitOutcome, inputProvenance, outputValidation,
  subjectIdentity, timeBound`). Pi's JSON output happens to supply all eight. CSAA is out of scope by standing
  instruction; recorded here so it is not rediscovered.
- **`REG-Q-077`** — may volunteered reasoning be read back, and under whose authority? Currently theoretical
  because nothing produces any. **Pi will produce it**, so the question becomes live on the day this lands.
- **`modelSelectionPolicy`** — required on `RUNTIME_BINDING`, no field shape anywhere in the corpus, no reader,
  no command that can set it, and no `RUNTIME_BINDING` is ever created by the demo. Giving it meaning is a
  larger piece than this one; this design deliberately does **not** invent its vocabulary.
- **`REG-Q-056` is a false lead** for this work — it concerns an ARTIFACT `status` vocabulary, not model or
  provider selection.

---

## 8. Two stale claims this change MUST repair, not inherit

`REG-F-356` corrected a wrong independence claim in prose but **left the prose uncorrected at HEAD**. Both sites
below are live today, and both become *differently* wrong the moment Pi becomes the executor. Repairing them is
part of this increment, not a follow-up — leaving them is the stale-prose class `DOC-004 §10 item 8` governs and
`REG-F-284` censused.

| # | Site | What it says now | Why it is wrong |
|---|---|---|---|
| 1 | `docs/_working/DESIGN-reasoning-review-over-work-products.md:60` | *"In the demo today the producer and the reviewer are the same configured judge model. That satisfies…"* | Wrong **twice**: the policy requires `DIFFERENT_MODEL`, not separate invocation — so sameness does not "satisfy" anything, it **refuses**. |
| 2 | `apps/rph-demo/src/lib/server/execution/work-product-floor.ts:88-91` | *"the producing model and the reviewing model are THE SAME CONFIGURED JUDGE, so this satisfies the weakest rung and nothing more"* | Same error, in code this time — and it is a docblock I wrote. After this change the sentence is also factually false about the deployment. |

⭑ The repair is not cosmetic. Both sentences tell a future reader that a same-model deployment is *acceptable at
a lower rung*. It is not: `checkIndependence('DIFFERENT_MODEL', …)` refuses it outright, and `REG-F-356` is the
entry that discovered this by being refused.
