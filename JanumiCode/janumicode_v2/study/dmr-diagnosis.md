# DMR Failings — Diagnosis Report

**Source data:** thin-slice-5 run `883657ff` (DB: `thin-slice-workspace-5/.janumicode/test-harness/1778448716098.db`)
**Date:** 2026-05-11

## Observed symptoms (across 15 context packets, one per consuming sub-phase 2.x–8.x)

| symptom | every packet |
|---|---|
| `completeness_status` | `partial_low` |
| `active_constraints` | `[]` — zero across all 15 packets |
| `material_findings` count | 224–591 (looks healthy, but composition is wrong — see below) |
| `unavailable_sources` | `[]` |
| dominant `material_findings.record_type` | `agent_invocation`, `agent_output`, `reasoning_review_finding_record` |

Sample from packet for `fr_bloom_skeleton` (265 findings): 101 `agent_invocation` + 78 `agent_output` + 59 `reasoning_review_finding_record` + 10 `artifact_produced` + 7 `decision_trace`. The "memory" returned to downstream agents is mostly **conversation transcript and validator noise**, not extracted memory artifacts.

## Substrate state

```
governed_stream:  18,527 current records
  authority_level=2: 18,508  (agent_reasoning_step, agent_invocation, agent_output,
                              reasoning_review_*, artifact_produced, decomposition_nodes, …)
  authority_level=5:     19  (18 decision_trace + 1 raw_intent_received)
  authority_level=3,4,6,7: 0

governed_stream_fts:  18,876  (FTS5 index — populated)
governed_stream_vec:       0  (vector index — never populated)

memory_edge:  125
  derives_from: 123
  supersedes:     2
  (no `supports`, `contradicts`, `implements`, `invalidates`, …)

sub_artifact:  28  (Stage III "Architecture Canvas" registrations — sparse)
```

The substrate that DMR queries against has **no typed memory objects** in the design-doc sense — no `constraint`, `policy`, `claim`, `correction`, `requirement`, `risk` records. The governed stream is a near-flat log of agent invocations, outputs, reasoning steps, and validator findings.

## Root causes (in dependency order)

### 1. Missing typed-memory extraction layer ⭐ root cause

The design doc (`Deep Memory Research Agent.md`, §1.1, §1.10–§1.11) calls for an ingestion pipeline that extracts **typed memory objects** — `Constraint`, `Claim`, `Correction`, `Risk`, `Assumption`, etc. — from raw governed-stream records. These typed records are what DMR is meant to query.

`IngestionPipelineRunner` exists (`src/lib/orchestrator/ingestionPipelineRunner.ts`, 478 lines) but its Stages II–V emit only `memory_edge` rows (graph relations between existing records) and `sub_artifact` rows. **No stage produces typed memory objects.** There is no `constraint` record_type, no `claim` record_type — the record_type enum in `types/records.ts` doesn't define them.

Consequence: DMR has nothing to retrieve except raw conversation/process records, so it returns those. Every downstream agent reads a packet whose "findings" are 65–75 % agent dialogue and validator chatter.

### 2. Authority taxonomy is structurally one-dimensional

`GovernedStreamWriter.resolveAuthorityLevel()` (`governedStreamWriter.ts:427-459`) maps record_types to authority levels. The mapping has **no path** to levels 3, 4, 6, or 7:

- Level 2 (default): everything not in the human-action whitelist
- Level 5: human-action records (`mirror_approved`, `phase_gate_approved`, `decision_trace`, `raw_intent_received`, `narrative_memory`, …)
- Levels 3, 4, 6, 7: **unreachable** — no record_type maps to them

The DMR filter at `deepMemoryResearch.ts:763-770` requires `authorityLevel >= 6` for a finding to become an `ActiveConstraint`. That threshold is **above the ceiling** the writer can produce. `active_constraints: []` is therefore guaranteed for every packet, in every run, regardless of content.

(In thin-slice mode `narrative_memory` records also never appear because the human review step that triggers them is skipped — but even with a full bloom/prune run, the highest level any record reaches is 5.)

### 3. Vector index never populated

`governed_stream_vec` has 0 rows alongside 18,876 FTS rows. The async embedding indexer is either disabled, not started, or silently failing. `DeepMemoryResearchAgent.searchVector()` (`deepMemoryResearch.ts:948-999`) joins against this table and returns empty silently on a `try/catch`. The `detectGaps()` check at line 720-738 detects this (vec/records < 0.5 → `knownGaps` non-empty) and demotes `completenessStatus` to `partial_low` — that's why every packet is `partial_low`.

### 4. FTS harvest has no record_type filter (noise gate)

`searchFTS()` at line 909-946 selects from `governed_stream_fts JOIN governed_stream` with no `record_type` constraint. So `agent_invocation` content (which contains the agent's prompt text — by construction full of query-relevant terms) and `agent_output` content (the response text — also semantically similar) dominate the candidate pool. These records describe *what an agent was asked* and *what it said*, not memory worth retrieving.

A correct retrieval would either (a) exclude `agent_invocation`, `agent_output`, `agent_reasoning_step`, and `reasoning_review_*` from FTS results, or (b) prefer typed-memory record types when available, falling back to others only by explicit request.

### 5. `harvestByAuthority` uses `Math.min`, not range membership

`deepMemoryResearch.ts:1006-1007`:
```ts
const minLevel = Math.min(...authorityLevels);
if (minLevel < 5) return []; // Only auto-include governing records
```

If the query decomposer requests any authority level below 5 (e.g. `[3, 4, 5, 6, 7]` for a broad sweep), the function returns empty. Currently the decomposer asks for `[5, 6, 7]` so the guard passes, but it's a fragile invariant. The intended logic is probably "harvest records at any of the requested levels ≥ 5," not "harvest only when the minimum requested level is ≥ 5."

## Why the cascade looks the way it does in thin-slice-5

1. Decomposer requests `[5, 6, 7]` → only authority-5 records eligible.
2. Only 19 records are level 5 system-wide (18 decision_trace + 1 raw_intent_received). Few of them are semantically related to any given query.
3. FTS pulls 100–500 records of all types, dominated by agent_invocation / agent_output. None of these are level 5+.
4. Vector index empty → no semantic recall.
5. `active_constraints` filter (`≥ 6`) sees 0 candidates → empty.
6. `detectGaps` flags vector coverage → `partial_low`.
7. Downstream agent receives a packet of 200–500 conversation transcripts labelled "material findings," 0 constraints, `partial_low` completeness. It then writes its sub-phase output essentially without grounded context.
8. Validators downstream (`grounding_validator`, `source_item_enumeration_completeness`, `assumption_citation_validator`) fire HIGH because they correctly detect that the agent's output isn't attestable against the (empty) constraint set or the (noisy) findings.

This is why I said earlier the validators are mostly catching symptoms of DMR-rot.

## Spec vs. implementation (added after reading v2.3 §3.1 + §8.12)

The v2.3 spec is **explicit** about what should exist; the implementation has skipped large parts of it. Layer C in my original remediation list was wrong — the spec does **not** call for new typed-memory record types (`constraint`/`claim`/`policy`). It calls for:

**§3.1 Authority Level Taxonomy — 7 levels, all with assignment rules:**

| Level | Spec assignment rule | Currently produced? |
|---|---|---|
| 1 — Exploratory | Bloom Sub-Phase output before Mirror interaction; System-Proposed Content | ❌ Never assigned |
| 2 — Agent-Asserted | Default | ✅ Default |
| 3 — Human-Acknowledged | Human proceeded past Mirror without editing | ❌ Never assigned |
| 4 — Human-Edited | `mirror_edited` record | ✅ Implemented (but mirror_edited never fires in thin-slice mode) |
| 5 — Human-Approved | `decision_trace`, `mirror_approved`, `phase_gate_approved`, etc. | ✅ Implemented |
| 6 — Phase-Gate-Certified | **Any artifact whose ID appears in a `phase_gate_approved` record** | ❌ Never assigned — this is the missing elevation step |
| 7 — Constitutional | Design Invariants from §1.5 — hardcoded, not derived | ❌ Never loaded |

The `active_constraints >= 6` threshold in `DeepMemoryResearchAgent` is the **spec-correct** filter (§3.1 says "active constraints from the Context Packet at Authority Level 6+", confirmed at line 1617). What's missing is the writer's **phase-gate elevation step** that promotes certified artifacts from 2 to 6.

**§8.12 Ingestion Pipeline — five stages, current implementation:**

| Stage | Spec | Implementation |
|---|---|---|
| I — Type Classification + Authority | Per §3.1 taxonomy at write time | Partial (writer assigns 2 or 5 only) |
| II — Deterministic Edge Assertion | `phase_gate_approved → validates`, `mirror_edited → corrects`, `artifact_produced → derives_from`, `decision_trace.prior_decision_override → supersedes` | Implemented — produces 125 edges in this run (123 derives_from, 2 supersedes) |
| III — **Relationship Extraction (LLM call)** | "Given the new record's content and a summary of related records retrieved via FTS5, identify candidate relationships. Output: proposed `memory_edge` records with `edge_type`, `target_record_id`, `confidence`. Written as `memory_edge_proposed` records with `authority_level: 2`." | ❌ **Stubbed.** File comment: "Stages III-V stubbed." |
| IV — Supersession Detection (deterministic + LLM escalation) | Detects subject conflicts; auto-asserts `supersedes`; escalates ambiguous | ❌ Stubbed |
| V — Open Question Resolution Check | Detects `answers` edges from new records to prior `raises` edges | ❌ Stubbed |

**Critical re-read:** Stage III emits *more memory_edges*, not new typed records. The "typed memory objects" idea from the design doc (`Constraint`, `Claim`, `Policy` record types) **did not graduate into the v2.3 spec**. The spec's substrate model is "governed stream records + memory_edge graph between them" — not "typed memory objects layer." This means my original Layer C (build typed-memory extraction) was outside spec.

The spec **also** confirms (§8.4, line 2127–2129) that DMR's Context Packet relies on `active_constraints` being populated; the materiality formula at line 2168 weights `authority_level / 7` at 0.20. Both assume the full 7-level taxonomy is in use.

---

## Revised remediation — three layers, all spec-aligned

### Layer A — DMR code fixes (mechanical)

Pure consumer-side fixes; no substrate changes.

1. **Filter `searchFTS` by record_type.** Exclude conversation/process noise: `agent_invocation`, `agent_output`, `agent_reasoning_step`, `reasoning_review_finding_record`, `reasoning_review_harness_record`, `json_repair_record`. Preferred policy: an explicit allow-list of "memory-bearing" record types (`artifact_produced`, `decision_trace`, `raw_intent_received`, `narrative_memory`, `product_description_handoff`, `phase_gate_approved`, `mirror_approved`, decomposition nodes, ADRs).
2. **Fix `harvestByAuthority` `Math.min` short-circuit** (`deepMemoryResearch.ts:1006-1007`) — replace with "harvest records at any requested level ≥ 5" semantics.
3. **Diagnose & fix vec indexer.** Find why `governed_stream_vec` has 0 rows. Likely candidates: async indexer that didn't start, embedding provider misconfigured, dimension/model mismatch, schema-create-only-on-init missed. Once populated, `detectGaps` stops flagging vector coverage → `partial_low` rises to `complete`.

**Effort:** ~4–6 hours. Reduces noise but `active_constraints` will still be 0 until Layer B's level-6 elevation lands.

### Layer B — Writer-side authority assignment (spec-implementation gap)

Implement the §3.1 assignment rules that are missing.

4. **Level 6 elevation on phase gate approval.** When a `phase_gate_approved` record is written, the writer should set `authority_level = 6` on every artifact ID it references. This is the single most important fix — it's what `active_constraints` is designed to consume. In thin-slice mode all gates auto-pass, so this **will** populate constraint material immediately.
5. **Level 1 assignment for bloom output before mirror.** Bloom Sub-Phase artifacts (which the spec explicitly calls out — `business_domains_bloom`, `user_journey_bloom`, `entities_bloom`, etc.) should write at level 1, not 2. Level 1 is "exploratory candidate space before any human interaction." Currently they're indistinguishable from agent-asserted output.
6. **Level 7 constitutional invariants** loaded at workspace init from §1.5. Hardcoded set; the writer would seed them on init. These are governing across all runs.
7. **Level 3 — Human-Acknowledged** (proceeded past Mirror without editing). Not relevant in thin-slice mode (no human in loop) but should be wired for real runs.

**Effort:** ~1–2 days. Touches `governedStreamWriter.ts` (`resolveAuthorityLevel` + a new `elevateArtifactsOnPhaseGate` step) and possibly one Phase-1 orchestrator path. After this, level 6 will be populated, `active_constraints` will return real records, and DMR's materiality formula (line 2168 weights `authority_level/7` at 0.20) becomes meaningful.

### Layer C — Ingestion Pipeline Stages III–V (spec §8.12)

Build the LLM-driven relationship extraction the spec calls for.

8. **Stage III — Relationship Extraction LLM pass.** Per spec: one LLM call per new record; given the record content and an FTS5 summary of related records, emit proposed `memory_edge` records (`edge_type`, `target_record_id`, `confidence`) as `memory_edge_proposed` governed-stream records with `authority_level: 2`. Currently the file says "Stages III-V stubbed."
9. **Stage IV — Supersession Detection.** Deterministic where edges exist; LLM-escalated where ambiguous. Currently 2 supersedes edges in a 18,527-record run — almost certainly an underaccrual.
10. **Stage V — Open Question Resolution Check.** Deterministic: detect `answers` edges from new records to prior `raises` edges.

**Effort:** ~3–5 days. One LLM call per new record is non-trivial cost — 18,527 records × ~1k tokens × $... — though spec is unambiguous that this is the intended cost. Once landed, the `memory_edge` graph populates from 125 to thousands of edges, and DMR Stage 4 (relationship expansion) starts producing meaningful context expansion.

**Important:** Layer C does **not** add new record_types. The spec's substrate model is "governed-stream records + memory_edges between them," not the design-doc's "typed memory objects." DMR queries existing records, ranked by graph proximity to high-authority records — not a separate `constraint` table.

## Recommendation

**A is necessary; B is the highest-leverage; C closes the spec gap.**

If forced to pick one for immediate impact: **Layer B first** (then A inline since they touch adjacent code). Reason: without level-6 records, every DMR packet ships with empty `active_constraints` regardless of what A fixes. With B alone (no A), the constraints will be present but the noise around them will still dominate `material_findings`. **A+B together** is the right minimum to get an interpretable thin-slice re-run.

**C can come second** — it improves DMR Stage 4 (relationship expansion) and Stage 5 (supersession analysis), but those operate on top of the authority-filtered candidate set that B + A produces. Without B + A, C just produces more edges between noise records.

**Suggested order:**
1. **A + B together** (~2 days). Land them in one commit cycle. Re-run thin-slice. Measure: `active_constraints` count per packet, `material_findings` noise share, `completeness_status` distribution.
2. **C** (~1 week) if A+B results show DMR is producing useful context but graph expansion (Stage 4) is empty.
3. **Thin-slice validator-trustworthiness study** only after A+B re-run produces an interpretable substrate.

## Outstanding decision

Confirm scope: A+B now, C deferred? Or all three? Or A+B+C as a single thread? (A+B is roughly 2 days; A+B+C is roughly 1.5 weeks plus LLM spend for re-running thin-slice with Stage III firing per record.)
