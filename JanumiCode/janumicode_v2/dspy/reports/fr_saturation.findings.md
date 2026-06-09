# fr_saturation pilot — baseline findings (real data, workspace-127, gpt-oss:20b)

Trainset: 40 per-FR decomposition calls harvested from
`thin-slice-workspace-127`. Metric: deterministic subset of the production review
bundle for `(requirements_agent, fr_saturation)`. **Mean score 0.723, parse-ok 40/40.**

## What the deterministic validators actually found

| Validator | Findings | Verdict |
|---|---|---|
| `traces_to_id_validity` | 88 (MEDIUM) | **100% false positives** — validator bug (see below). Model traces are clean. |
| `json_output_discipline_check` | 23 (MEDIUM), all `trailing_prose` | **Real defect** — model emits text after the closing `}` on 23/40 outputs. |
| `contract_schema_validator` | 0 | clean |
| `parent_branch_classification_check` | 0 | clean |
| `decomposition_fanout_discipline` | 0 | clean |

## Finding 1 — `traces_to_id_validity` has a known-id regex gap (validator bug)

`collectKnownIds()` in
`src/lib/review/harness/validators/deterministic/tracesToIdValidity.ts` extracts valid
ids from the prompt with:

```
/\b((FR|NFR|US|COMP|ENT|SR|SYS)-[A-Z0-9._-]+)\b/g
```

This omits **`UJ-`, `WF-`, `VV-`, `TECH-`, `QA-`** — yet the `fr_saturation` prompt's
own handoff context and traceability rules use `UJ-*` / `WF-*` as the primary trace
targets. Result: every user-journey / workflow trace is flagged "fabricated namespace,"
**in production too.**

Quantified: of **103** `traces_to` references across the 40 examples, **0** are
genuinely unresolvable (not present anywhere in the prompt). All 88 flagged findings are
regex-gap artifacts. The model's trace grounding is actually correct.

→ This is the regression-benchmark payoff the harness promised — it surfaced a real
validator bug on its first run, independent of DSPy.

**Recommended fix:** extend the prefix set to the documented id namespaces
(`UJ|WF|VV|TECH|QA|VOC|OPEN|Q` in addition to the current ones). Small, well-evidenced,
but it changes production validator behavior → should be a separate reviewed change.

## Finding 2 — deterministic-only headroom is narrow on this model/sub-phase

After discounting the false positives, the only real deterministic defect is
**`trailing_prose` (23/40 = 58%)** — the model appends commentary after the JSON despite
the "no prose after the JSON" rule. Everything else (schema, classification, fanout,
traces) is already clean.

This is a real, DSPy-addressable target, but it is **one narrow defect class**. The
richer defects we found by hand earlier — ungrounded ACs, NFR-threshold misattribution,
empty `citations: []` — are caught by the **LLM-judge** validators in the same bundle
(`grounding_validator`, `assumption_citation_validator`, `tier_assignment_audit`), which
are deferred from this first deterministic metric.

## Implication for the pilot

To demonstrate the *kind* of improvement discussed in the design memo (grounding,
citations, threshold scoping), the metric needs the **LLM-judge layer**. A
deterministic-only pilot can still prove the end-to-end mechanism, but its only real
lever here is trailing-prose suppression.

## Finding 3 — judge-in-the-loop is impractical on this hardware (measured)

LLM-judge layer proven to work headless (reuses the real review templates + parser via
`runLLMValidator` over ollama). But throughput on the single GPU:

| Judge model | 1 example, 2 judges | Caught the defect? |
|---|---|---|
| qwen3.5:9b | 256 s | yes (uncited `surfaced_assumptions[0]`) |
| nemotron-3-nano:4b | 55 s | no (too weak) |

A useful judge is ~128 s/call; MIPROv2 does many evaluations × examples, plus gpt-oss↔judge
VRAM swap thrashing → days, not hours. The fast judge is too weak to be useful.

**Adopted architecture (cheap proxy in loop, oracle for final eval):**
- Inner optimization loop: the fast deterministic metric, augmented with a deterministic
  **citation/rationale-completeness** term (the `assumption_citation_validator` finding is
  deterministically checkable — empty `citations[]` / missing rationale on
  `surfaced_assumptions`). Zero LLM cost, gives DSPy a grounding-adjacent lever.
- Final evaluation: the REAL LLM judges (`grounding_validator` +
  `assumption_citation_validator`, qwen3.5:9b) run ONCE on baseline vs optimized over the
  held-out set — confirms grounding/citation improved without being in the hot loop.

## Finding 4 — first real MIPRO+judges run: NO gain, noise-dominated (2026-06-05)

Config: MIPROv2 light, judges in-loop (grounding + assumption_citation @ qwen3.5:9b),
gpt-oss:20b @ temp 1.0, 18 train / 10 val, 10 trials.

**Result: baseline 76.5 → optimized 69.0 (re-eval). No improvement.**

The noise floor is the story. The *same* program re-evaluated on the *same* 10-example
val swung wildly:
- baseline default program: 76.5 (initial) → 68.5 (Trial 1)
- MIPRO-selected winner:    86.75 (Trial 6) → 69.0 (final re-eval)

→ noise band ~±10–18 pts on a 10-example, LLM-judged, temp-1.0 metric. Real headroom is a
few pts. Noise ≫ signal, so MIPRO "won" on a lucky 10-example draw (Trial 6 = 86.75) that
collapsed on re-eval. The exported candidate re-scored BELOW baseline → correctly REJECTED
at the Strategy-C human-review gate.

The pipeline (harvest → metric → judges → MIPRO → compile → export → staged candidate)
works end-to-end. The blocker is eval design, not plumbing.

**Prerequisites before any re-run (in priority order):**
1. Cut variance: task temp ~0.3; larger val (all 40 / k-fold); average 2–3 judge passes/example.
2. Scope the metric to what saturation controls (don't charge inherited/mirrored parent ACs;
   enforce grounding at the producer phase fr_bloom_enrichment instead). See Finding on
   inherited penalties.
3. Only then re-attempt optimization. Until noise band << headroom, no optimizer can work.

## Finding 5 — metric scoping (inherited vs saturation-owned), measured 2026-06-05

Audited both judges over 5 recorded outputs (US-001..005, all atomic_leaf):
- US-002: 2× `assumption_citation_validator` on `surfaced_assumptions` → **OWNED** (saturation authored these; fixable here).
- US-004: 1× `grounding_validator` HIGH `unsupported_threshold` on `children[0].acceptance_criteria[2]` (the audit-log 2s) → **INHERITED** (atomic_leaf mirrors the parent AC; the threshold came from upstream bloom).
- US-001/003/005: clean.

So inherited ≈ 1/3 of findings (NOT the majority — earlier "biggest factor" was overstated). Owned (surfaced-assumption citations) is the larger, genuinely-optimizable share.

**Scoping rule implemented** (`isInheritedFinding`, SCOPE_INHERITED=1 default): drop
`grounding_validator` findings on `children[*].acceptance_criteria[*]` when
`parent_branch_classification == atomic_leaf` (mirrored = inherited). Keep everything
else (assumption_citation on surfaced_assumptions; grounding on new decomposable children).
This charges the prompt only for what it controls; inherited grounding belongs at the
producer (fr_bloom_enrichment).

## Finding 6 — run #2 (de-noised + scoped): REAL, reproducible +2.3 (2026-06-07)

Config: MIPRO light, judges in-loop (3 passes, cached, temp 0), task temp 0.3,
SCOPE_INHERITED on, 16 train / 16 val.

**Result: baseline 85.47 → optimized 87.76 (+2.29).** Trustworthy this time:
- De-noising VALIDATED: re-eval of the default program scored 85.5 == initial baseline 85.5
  (run #1 swung 76.5→68.5). The winner held: best-so-far 87.76 == final re-eval 87.76
  (run #1 collapsed 86.75→69.0). Cache made the metric reproducible.
- Scoping raised the baseline 76.5→85.5 (removed the inherited grounding penalty — i.e.
  run #1 was docking ~9 pts for things the prompt can't control).
- Trial spread now reflects REAL instruction quality, not noise (Trial 3 = 53.6 is a
  genuinely bad rewrite; most rewrites HURT).

**The +2.3 came from the 3 bootstrapped DEMOS, not an instruction rewrite** — the winning
program kept the original ~11k-char instruction. Instruction-rewrite candidates mostly
scored below baseline.

Interpretation: with a fair, stable metric, gpt-oss is already ~85% on what fr_saturation
controls; few-shot demos add a small real lift; instruction rewording does not help here.
Held-out confirmation (8 unseen examples) pending to check the +2.3 generalizes.

## Finding 7 — held-out confirms NO generalizable gain → DO NOT MERGE (2026-06-07)

| | val (16) | held-out (8 unseen) |
|---|---|---|
| baseline (seed) | 85.47 | 84.90 |
| optimized (seed + 3 demos) | 87.76 | 83.85 |
| delta | +2.29 | **−1.05** |

The val-set +2.3 was OVERFIT — the bootstrapped demos scored well on the 16 optimized
examples but do not transfer to 8 unseen (same-domain) examples. Held-out delta is
slightly negative (within noise). **Verdict: reject the candidate; no merge.**

Note the metric is now stable across sets (baseline 85.47 val ≈ 84.90 held-out), so this
is a trustworthy negative, not noise — the held-out gate caught an overfit that the val
score alone would have shipped.

CONCLUSION (pilot complete): for fr_saturation / gpt-oss:20b on a single-domain (TinyURL)
trainset, DSPy finds NO generalizable prompt improvement. The prompt is already ~85% on
what it controls; demo-bootstrapping overfits; instruction rewrites hurt. The #1 design
risk (single-domain data) is now empirically confirmed: generalizable optimization needs
MULTI-DOMAIN trainset data. The pipeline + de-noised+scoped+held-out methodology is sound
and reusable; the harness already delivered a real win (the tracesToIdValidity bug fix).
