# DSPy for Prompt-Template Optimization — Design Memo

**Status:** Proposal (not yet implemented)
**Date:** 2026-06-04
**Author:** investigation + design
**Pilot target model:** `gpt-oss:20b` (the `requirements_agent` / `domain_interpreter` roles)
**Pilot target sub-phase:** `fr_saturation` (Phase 2.1a, requirements_agent) — revised from
`fr_bloom_skeleton` after inspecting the real trainset (see §6).
**Trainset source:** `test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-127`
(the only current-format run; `cal-*` calibration runs are stale).

---

## 1. Problem statement

Prompt-template correctness in JanumiCode v2 is currently maintained by **ad-hoc, manual
prompt engineering driven by regressions**. The workflow is:

1. Run a thin slice (`cal-NN`) end-to-end.
2. Observe a defect in the workspace DB (silent coverage loss, ID drift, malformed JSON,
   the create/submit bias, exemplar leakage, etc.).
3. Hand-edit a `.system.md` template — add a "MUST not SHOULD" clause, reorder exemplars,
   add a snake_case reminder — or add a downstream deterministic patch (normalizer,
   gatekeeper, JSON-repair layer).
4. Re-run, eyeball the DB, accept or iterate.

This is captured across the project memory index: `feedback_fix_prompt_not_matcher`,
`feedback_normalizer_case_dual_keys`, `project_json_repair_fallback_fix`,
`project_gatekeeper_self_reference_fix`, the `exemplarLeakageDetector` validator, and the
`cal-21`…`cal-27` calibration history. Each fix is bespoke, the evaluation is subjective
("looks better"), and improvements to one sub-phase risk silent regressions in another
because there is no held-out benchmark.

The structural gap: **we hand-author both the instruction wording and the few-shot
exemplars inside each prompt, with no optimizer and no objective score in the loop.**

[DSPy](https://github.com/stanfordnlp/dspy) is a framework for exactly this gap — it
treats instructions and few-shot demonstrations as *compiled* artifacts optimized against
a metric, rather than hand-written prose.

---

## 2. Current-state inventory (what exists today)

| Asset | Location | Relevance to DSPy |
|---|---|---|
| 115 prompt templates (~840 KB) | `prompts/**/*.system.md` | The artifacts to be optimized |
| `{{variable}}` interpolation | `src/lib/orchestrator/templateLoader.ts:288` | Maps to DSPy Signature input fields |
| Frontmatter `required_variables[]` | each template's YAML head | The Signature's declared inputs |
| Strict JSON output contracts + inline exemplars | each template body | The Signature output + hand-written demos DSPy would replace |
| Multi-provider LLM client | `src/lib/llm/llmCaller.ts`, `providers/{anthropic,google,llamacpp,ollama}.ts` | Production runtime; DSPy must call the *same* model |
| **~25 deterministic validators** | `src/lib/review/harness/validators/deterministic/` | **Ready-made objective metrics** |
| **~55 LLM-judge validators** | `src/lib/review/harness/validators/llm/` | Secondary (noisier, costlier) metrics |
| 3-layer JSON repair | `src/lib/llm/llmCaller.ts` (deterministic + LLM repair), `jsonRepairLLM.ts` | Symptom of prompt fragility DSPy would reduce |
| ~~Calibration workspace runs~~ (stale) | `test-and-evaluation/calibration-workspaces/cal-*` | Out of date — not usable |
| **Current-format thin-slice run** | `thin-slice-workspaces/thin-slice-workspace-127` | **The trainset source** (single TinyURL run, gpt-oss:20b) |
| Per-call materialized prompt + variables | `agent_invocation.content.prompt` in governed_stream | Trainset extraction surface (verified: full prompt persisted) |

**Model routing (relevant subset, from `configManager.ts` DEFAULT_CONFIG):**

- `domain_interpreter` → `llamacpp` / **`gpt-oss:20b`** (Phase 1 blooms)
- `requirements_agent` → `llamacpp` / **`gpt-oss:20b`** (Phase 2 FR/NFR)
- `orchestrator`, `reasoning_review`, `unsticking` → `gemini-2.5-flash`

The bulk of the structured-extraction fragility lives on the two `gpt-oss:20b` roles —
which is why it is the pilot model.

**Key insight:** we have already built the expensive half of an optimization loop — the
**evaluation signal** (the validator harness). What is missing is the **optimizer** that
consumes it.

---

## 3. What DSPy actually does (calibrated expectations)

DSPy is **not** a "make my prompt better" black box. It is a compiler with these parts:

- **Signature** — a typed declaration of input fields → output fields
  (e.g. `intent, journeys, entities, workflows, compliance, vocab → user_stories[], unreached_journeys[]`).
- **Module** — `dspy.Predict` / `dspy.ChainOfThought` wrapping a Signature.
- **Metric** — a Python function `(example, prediction) -> float` scoring an output.
- **Trainset** — a set of `dspy.Example` input cases (with optional gold labels).
- **Optimizer (teleprompter)** — searches over **instruction phrasings** and **few-shot
  demonstrations** to maximize the metric. Relevant optimizers:
  - `BootstrapFewShot` — selects/validates demos from the trainset.
  - `MIPROv2` — jointly proposes instruction candidates *and* bootstraps demos
    (the workhorse for instruction + demo optimization).
  - `BootstrapFinetune` — distills into weights (out of scope; we want prompt artifacts).

What DSPy optimizes maps directly onto our two worst pain categories:

| Our pain | DSPy lever |
|---|---|
| Hand-written inline exemplars that leak (`exemplarLeakageDetector`) | Bootstrapped demos, held structurally separate from the instruction, selected per-model |
| Hand-tuned instruction wording ("MUST not SHOULD", "FIRST-CLASS", "snake_case only") | MIPROv2 instruction-candidate search against the metric |
| Subjective "looks better" evaluation | The metric *is* the acceptance criterion; held-out score deltas replace eyeballing |
| Cross-sub-phase regressions | A persistent benchmark scores every prompt change |

**What DSPy will not do for us:**
- It will not fix genuinely under-specified context (missing upstream IDs are a pipeline
  bug, not a prompt bug).
- It will not transfer across models for free — an optimized prompt is **model-specific**.
- It will not run inside the Node orchestrator (it is Python).

---

## 4. Architecture: DSPy as an offline compiler, not a runtime dependency

DSPy is Python; JanumiCode is TypeScript/Node. DSPy therefore **never enters the
production hot path**. It is a build-time tool — like a linter or a codegen step — that
periodically re-compiles prompts and writes the results back into the repo.

```
                         OFFLINE (Python, run periodically)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  trainset.jsonl ──► dspy.Module(Signature)                           │
  │   (harvested        │                                                 │
  │    from governed    ▼                                                 │
  │    _stream)     MIPROv2 optimizer ──► metric (ported validators)      │
  │                     │                      │                          │
  │                     ▼                      ▼                          │
  │            optimized {instruction,    LM = LiteLLM → llamacpp/ollama  │
  │            demos[]}                    (SAME gpt-oss:20b as prod)      │
  └─────────────────────┬───────────────────────────────────────────────┘
                        │  export → dspy/candidates/ (STAGED, not prod)
                        ▼
            dspy/candidates/**/<sub_phase>.system.md  (skeleton + DSPy instruction + demos)
                        │  human reviews diff + score delta, merges 1-by-1
                        ▼
            prompts/**/<sub_phase>.system.md   (frontmatter & {{variable}} tail preserved)
                        │
                        ▼
                 PRODUCTION (Node, unchanged)
            templateLoader.render() → llmCaller.call() → validators
```

### 4.1 Export: two independent decisions, not one

Earlier drafts framed this as "Strategy A vs B," which conflated two *separate* choices.
They are independent axes:

**Axis 1 — how much of the prompt does DSPy's output replace?**

- *Splice* — take only DSPy's optimized **instruction text + bootstrapped demos** and drop
  them into the existing `.system.md` skeleton. Frontmatter, `{{variable}}` placeholders,
  `[JC:]` governance markers, and the JSON output contract all stay. Production runtime is
  untouched.
- *DSPy-owns* — DSPy's adapter formats the **entire** prompt; the template system is
  bypassed.

| | Splice | DSPy-owns |
|---|---|---|
| Production runtime | unchanged (`templateLoader` + `{{var}}` + AODD keep working) | needs a Python↔TS shim to render DSPy's format; AODD/traceability reworked |
| Fidelity | small translation gap (prod prompt not byte-identical to what DSPy scored) — *closed by re-scoring the rendered candidate, see §4.3 step 3* | exact ("what you measured is what you ship") |
| Human-editable after | yes — still a readable template | no — DSPy's machine format |
| Keeps `[JC:]` / JSON contract / governance | yes | must be re-implemented |

For this codebase (heavy template system, AODD instrumentation, governance markers)
**DSPy-owns is a non-starter** — the only thing it buys (exact fidelity) is recoverable
under splice by re-scoring the rendered file. **We use splice.**

**Axis 2 — how does the result get into the repo?**

- *Auto-write* — the pipeline overwrites `prompts/...` directly. Fast, but a
  metric-higher-yet-semantically-worse prompt lands silently. Risky across 115 hand-tuned
  templates.
- *Staged + human merge* — DSPy writes candidates to a separate `dspy/` directory; a human
  reviews the diff (with the score delta attached) and merges one template at a time. The
  metric scores structural grounding, not "does this read like our other prompts" — the
  human gate catches the rest.

**We use staged + human merge.** The recommended path is therefore **splice + staged
merge** — detailed as Strategy C below.

### 4.2 Strategy C (recommended) — splice into a staging dir, merge by hand, 1-by-1

DSPy's *native* output is not a `.system.md`; it is a compiled program (JSON: the chosen
instruction + the selected demos). So Strategy C needs a small **exporter** that renders
that JSON into a candidate `.system.md` using the existing template skeleton.

```
prompts/                                  ← PRODUCTION (loaded by templateLoader, untouched)
  .../fr_saturation/functional_requirements_decomposition.product.system.md

dspy/
  programs/    fr_saturation.compiled.json    ← DSPy raw output (instruction + demos)
  candidates/  .../fr_saturation/...system.md ← exporter renders "the after" into the skeleton
  reports/     fr_saturation.eval.md          ← baseline vs optimized score, per validator
```

Workflow, one template at a time:

1. **Optimize** → `dspy/programs/<sub_phase>.compiled.json`.
2. **Export** → `dspy/candidates/.../<sub_phase>.system.md` (skeleton + DSPy instruction/demos).
3. **Re-score the candidate** through the metric CLI (§5). This closes the splice fidelity
   gap: confirm the *rendered file* — not just DSPy's internal program — still beats
   baseline. Result lands in `dspy/reports/`.
4. **Human review** — `diff prompts/.../X.system.md dspy/candidates/.../X.system.md`, read
   the score delta.
5. **Merge or reject** — accept: copy the candidate over the production file, commit.
   Reject: adjust the seed instruction or metric weights and re-run.

DSPy stages into `dspy/`; a human merges back into `prompts/` deliberately, each diff
carrying a measured score so the merge decision is evidence-based, not a guess.

### 4.3 Provider parity (critical)

DSPy must call the **same model that runs in production** or the optimization will not
transfer. For the pilot that is `gpt-oss:20b` via `llamacpp`/`ollama`. DSPy reaches this
through LiteLLM's OpenAI-compatible / Ollama endpoint support:

```python
import dspy
lm = dspy.LM("ollama/gpt-oss:20b", api_base="http://localhost:11434",
             temperature=0.5)   # match requirements_agent temperature
dspy.configure(lm=lm)
```

Because the optimized artifact is model-specific, the compiled prompt must be
**re-compiled when the role's model changes** (e.g. the documented qwen3.5:9b→gpt-oss:20b
bake-off would have triggered a re-compile). This should be a tracked, scriptable step.

---

## 5. The metric — turning validators into a score

Our deterministic validators are near-perfect DSPy metrics: cheap, objective, no LLM call.
For the `fr_saturation` pilot, the metric is a weighted composite of the validators that
already gate the recursive FR-decomposition pass:

| Validator (TS source) | What it checks | Metric contribution |
|---|---|---|
| `jsonOutputDisciplineCheck` | Parseable, snake_case, no fences | Hard gate (0 if fails) |
| `decompositionFanoutDiscipline` | Tier-appropriate fan-out, no over/under-decomposition | Penalty outside tier band |
| `tracesToIdValidity` | child `traces_to` references only real parent/upstream IDs | Fraction valid refs |
| `frTracePollutionCheck` | No invented / cross-namespace IDs | Penalty for pollution |
| `responsibilityAtomicity` | Each leaf FR is a single, atomic responsibility | Fraction atomic |
| `storyStructuralCompleteness` | Each child has id/role/action/outcome/priority/≥1 AC | Fraction well-formed |
| `acCountDiscipline` | AC count within band | Fraction compliant |

Composite (illustrative):

```
score = parse_ok                                  # {0,1} hard gate
      * ( 0.35 * fanout_discipline
        + 0.25 * trace_validity_pct
        + 0.20 * responsibility_atomicity_pct
        + 0.20 * structural_completeness_pct )
```

(For the `fr_bloom_skeleton` pass the primary term would instead be journey-coverage %, but
that pass yields only ~1 example per run — see §6 — so it is not the pilot.)

These are **deterministic** — no judge LLM in the optimization loop, so the search is fast
and cheap. The ~55 LLM-judge validators (`acceptanceCriteriaMeasurability`,
`groundingValidator`, etc.) can be layered in later as secondary terms, but they add cost
and variance and should not gate the first pilot.

**Porting effort:** these validators are TypeScript. The Python metric either (a)
reimplements the deterministic logic in Python (a few hundred lines — they are pure
structural checks), or (b) shells out to a small Node CLI that runs the real validators
over a candidate output and returns a JSON score. Option (b) guarantees the optimization
metric is *identical* to the production gate and avoids drift — **recommended**.

---

## 6. The trainset — what `thin-slice-workspace-127` actually yields

The `cal-*` calibration runs are stale. The nearest current-format run is
**`thin-slice-workspace-127`** — a single end-to-end run on `gpt-oss:20b` (ollama) for
`orchestrator` / `domain_interpreter` / `requirements_agent`, matching the pilot model.
Its governed_stream DB (`.janumicode/test-harness/1780496036464.db`, ~1.9 GB) holds
**663 `agent_invocation` records**, each with the full materialized prompt in
`content.prompt` (verified — `fr_saturation` prompts are ~25 KB and self-contained).

**Per-sub-phase invocation yield from this one run** (selected, with agent role):

| Sub-phase | Agent role | Model | Invocations |
|---|---|---|---|
| `9.1` (execution) | executor_agent | gpt-oss:20b (goose) | 164 |
| `test_case_saturation` | test_design_agent | (default) | 65 |
| `task_saturation` | implementation_planner | (default) | 64 |
| **`fr_saturation`** | **requirements_agent** | **gpt-oss:20b** | **40** |
| `component_saturation` | domain_interpreter | gpt-oss:20b | 31 |
| `data_model_saturation` | technical_spec_agent | (default) | 27 |
| `nfr_saturation` | requirements_agent | gpt-oss:20b | 17 |
| `fr_bloom_enrichment` | requirements_agent | gpt-oss:20b | 10 |
| `nfr_bloom_enrichment` | requirements_agent | gpt-oss:20b | 10 |
| `fr_bloom_skeleton` / `*_bloom` / `*_skeleton` | various | various | **~1 each** |

**Two structural facts this exposes:**

1. **Recursive sub-phases are trainset-rich; once-per-run passes are trainset-poor.**
   The saturation/enrichment passes fire one LLM call *per node* (per FR, per component,
   per task), so a single run yields 10–65 examples each. The skeleton/bloom passes emit
   everything in **one** call, so they yield **~1 example per run**. This is why the pilot
   moves from `fr_bloom_skeleton` (1 example) to **`fr_saturation` (40 examples)** — same
   agent role, same `gpt-oss:20b` model, but enough examples to optimize against.

2. **Single-domain.** Every current-format thin-slice run (126, 127, 131, …) is the **same
   product — TinyURL**. There is *no* cross-domain diversity in the available
   current-format data. A trainset drawn only from run 127 is 40 *TinyURL* FR
   decompositions. DSPy will happily optimize instructions and demos that overfit
   TinyURL-flavored requirements. See §9 for the mitigation.

**Extraction harness (TS-side, new):** a script that opens a thin-slice workspace DB,
selects `agent_invocation` rows for the target sub-phase + agent role, pulls
`content.prompt` (the rendered input) and the paired `agent_output` (`derived_from_record_ids`),
and emits `trainset.jsonl`. For `fr_saturation` each example is one parent-FR decomposition
with its full upstream context already inlined in the prompt.

This extraction harness is **independently valuable**: even without DSPy, it converts the
validator suite into a *regression benchmark* — run any prompt edit against the held-out
set and get a number, instead of eyeballing a thin-slice DB. **Build it first.**

---

## 7. Pilot plan (`fr_saturation` on `gpt-oss:20b`)

Chosen because (a) it yields **40 examples from the single available run** (the recursive
per-FR decomposition fires once per node), (b) it runs on the pilot model
(`requirements_agent` → `gpt-oss:20b`), and (c) its success is deterministically checkable
(fan-out discipline, ID traceability, responsibility atomicity, JSON discipline). The
`fr_bloom_skeleton` pass was the original candidate but yields only ~1 example per run, so
it cannot anchor an optimization until more current-format runs exist.

1. **Build the trainset exporter** (TS) → `trainset.jsonl` from
   `thin-slice-workspace-127/.janumicode/test-harness/1780496036464.db`, selecting
   `agent_invocation` rows where `sub_phase_id='fr_saturation'` and
   `produced_by_agent_role='requirements_agent'`, paired with their `agent_output`.
2. **Expose the metric** — a Node CLI `score-fr-saturation <candidate.json> <example.json>`
   that runs the real deterministic validators (§5) and returns a 0–1 score; call it from
   the Python metric. (Or reimplement in Python if the shell-out is too slow for the search.)
3. **Define the Signature** in Python mirroring the template's I/O (parent FR + upstream
   context → child FR decomposition).
4. **Wire DSPy to `gpt-oss:20b`** via LiteLLM/Ollama at the production temperature
   (run 127 used `temperature: 1` for `requirements_agent` — match it).
5. **Baseline** — score the *current* prompt on a held-out split of the 40. This is the
   number to beat.
6. **Compile with MIPROv2** (instruction + bootstrapped demos).
7. **Evaluate** optimized vs. baseline on the held-out split; report per-validator deltas.
8. **Export (Strategy C, §4.2)** — render the compiled program into a candidate
   `.system.md` under `dspy/candidates/`, re-score the rendered file, then review the diff
   + score delta and merge into `prompts/` by hand. Frontmatter / `{{variable}}` / JSON
   contract preserved.
9. **Confirm in production** — run a real thin slice with the merged template; verify the
   governed_stream validators agree with the offline score.

**Success criterion:** a meaningful, held-out improvement in fan-out discipline and
trace-validity over the hand-tuned baseline, with no JSON-discipline regression.

**Caveat carried from §6/§9:** the 40 examples are all TinyURL. A within-domain win here
proves the *mechanism* but not cross-domain transfer — treat the pilot as a mechanics proof,
and gate any production adoption on the multi-domain trainset in §9.

---

## 8. Where DSPy fits — and where it doesn't

**Strong fit — structured-extraction sub-phases (Phases 1–7 blooms/saturations).**
Output correctness is deterministically checkable; this is where ad-hoc patching is most
acute and an optimizer with an objective metric pays off fastest. After the pilot, the
same shape extends to `entities_bloom`, `user_journey_bloom`, `nfr_bloom_skeleton`,
`fr_saturation`, `component_skeleton`, `data_model_skeleton`, etc.

**Weak fit — synthesis / narrative / Phase 9 execution.** "Correct" is fuzzy; the only
available metrics are the noisy LLM-judge validators. DSPy can still help but the signal is
weaker and the loop is costlier. Defer.

**Not a fit — pipeline-integrity problems.** ID-namespace drift across phases, missing
upstream context, and packet-fill gaps (`project_packet_fill_id_namespace_gap`) are data-
flow bugs. DSPy optimizes a single call against its inputs; it cannot fix inputs that are
wrong before the call.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Optimized prompt is model-specific | Treat re-compile as a tracked step on any role-model change; store the compile model in the template frontmatter |
| Metric drift (Python re-impl ≠ TS validator) | Shell out to the real Node validators (Strategy in §5b) |
| **Single-domain trainset (all current runs are TinyURL)** | **Primary risk.** Use run 127 to prove the mechanism within-domain, but before any production adoption, generate 3–5 *new* current-format thin-slice runs on distinct intents (e.g. HOA, comms, finance — the old `cal` domains) and pool their `fr_saturation` examples. Do **not** naively mix the ~50 older thin-slice workspaces: they predate current ID/schema conventions and would teach the optimizer exactly the drift the validators now reject. |
| Recursive sub-phases rich, skeleton/bloom passes poor (~1 ex/run) | Pilot the recursive passes first (`fr_saturation`, `component_saturation`); for skeleton/bloom passes, accumulate examples across multiple runs before optimizing |
| DSPy adapter format ≠ our template system | Strategy C (§4.2): splice instruction+demos into the skeleton, stage in `dspy/`, human-merge; production runtime unchanged |
| A metric-higher-but-semantically-worse prompt landing silently | Staged + human merge (never auto-write); every diff carries a re-scored delta |
| Optimization overfits the trainset | Always score on a held-out split; keep a frozen regression benchmark; cross-domain split once multi-domain data exists |
| LLM-judge metrics add cost/variance | Pilot uses deterministic metrics only; judges are a later, optional term |
| Local-model throughput limits search | MIPROv2 minibatching; cache the LM; run offline/overnight |

---

## 10. Recommendation & sequencing

1. **Build the trainset-exporter + metric-CLI harness first**, against
   `thin-slice-workspace-127`. It is independently valuable (turns the validator suite into
   a prompt regression benchmark) and is the prerequisite for any DSPy work.
   Highest-confidence, lowest-risk step.
2. **Run the `fr_saturation` / `gpt-oss:20b` pilot** end-to-end on run 127's 40 examples as
   a *mechanism proof*; report held-out per-validator deltas.
3. **Generate a multi-domain trainset** — 3–5 new current-format thin-slice runs on
   distinct intents — before trusting any optimized prompt in production. This is the gate
   between "the loop works" and "ship the optimized prompt."
4. **If the multi-domain pilot wins, expand** to the other recursive saturation sub-phases
   (`component_saturation`, `nfr_saturation`, `*_bloom_enrichment`), one at a time, each
   with its own metric composed from the relevant validators.
5. **Keep DSPy offline, merge by hand (Strategy C, §4.2).** Production stays TypeScript;
   DSPy stages candidate `.system.md` files under `dspy/`, and a human reviews each diff +
   re-scored delta and merges into `prompts/` one template at a time. Never auto-write.
   DSPy is a build-time optimizer, never a runtime dependency.

The biggest lift is the harness (step 1), not DSPy itself — and that harness pays for
itself even if DSPy is never adopted. The biggest *risk* is single-domain data (step 3),
not the DSPy mechanics.
