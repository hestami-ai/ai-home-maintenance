# Assessment: requirements_agent / nfr_saturation (Phase 2.2.4)

**Samples**: `track_c_samples/14a_*.md`, `14b_*.md`, `14c_*.md` (depths 0, 4, 8)
**Reviewed agent**: requirements_agent running qwen3.5:9b
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); nfr_saturation NOT in DISPATCH_BUNDLES at cal-26 time
**Aggregate harness outcome**: 14a ACCEPT, 14b **QUARANTINE** (5 HIGH + 2 MEDIUM), 14c REVISE (3 MEDIUM + 3 LOW)

---

## 1. What this sample reveals

All three samples land in `requirements-class saturation-pass` per `validator_catalog.md` §5.1 and `deferred_to_track_d.md` §1. The ChatGPT-5.5 seven-validator design is the correct bundle verbatim; the two validators absent from the placeholder — `measurement_adequacy_validator` and `tier_decomposition_validator` — account for almost all coverage gaps. The deferred_to_track_d §1 anticipated-family mapping is confirmed with no new family needed. Depth stratification is the standout signal: 14b (depth 4) is the most-flagged sample in the entire cal-26 corpus (QUARANTINE, 5 HIGH + 2 MEDIUM) while 14c (depth 8) has six findings but no HIGH — mid-tree is where substantive missteps occur (unsupported binding constraints, identity swaps, invented temporal metrics) and deep-tree accumulates minor drift (ungrounded implementation specifics, assumption IDs leaking into `traces_to`). Root-level 14a is clean.

---

## 1a. Defects in the agent's response

### 14a (depth 0) — defects

NFR-001 correctly classified `atomic_leaf`, tier D, overriding the `root` hint with sound rationale. One undetected defect (`measurement_adequacy_validator` not dispatched):

- **(MEDIUM) Weak measurable condition.** The Tier-D child's `measurable_condition` — "Cloudflare access log aggregation query returns 0 records with 'origin_ip' field populated" — is ChatGPT-5.5 pattern #10: "'zero direct traffic' without checking both access logs and network paths." Cloudflare logs show only traffic that reached Cloudflare; `origin_ip` is also an invented field name. ACCEPT stands but REVISE is more accurate.

### 14b (depth 4) — defects [QUARANTINE — all 7 findings]

Parent NFR-023.2.2.2-1: "calculate quorum status from active member presence." Agent: `decomposable`, overrides hint C to tier A, produces Tier B + Tier B + Tier C.

| # | Validator | Sev | Defect | Real? |
|---|---|---|---|---|
| F1 | grounding | HIGH | Child 2 AC: start-to-end two-snapshot check ("count at start of vote equals count at end; no status flips detected") — not in any handoff item or assumption; A-0087/A-0342 cover status-at-vote-time and synchronous execution, not temporal bookending. | Yes |
| F2 | grounding | MED | Child 3 AC names "ENT-VOTE-CASTE or ENT-MINUTES" as canonical source of truth — over-claim; ENT-* IDs also violate `traces_to` whitelist. | Yes |
| F3 | grounding | HIGH | `surfaced_assumptions[0]`: "Active member status snapshot is valid for the duration of the calculation" — surfaced as `constraint` when it is an `open_question`; no source mandates this. | Yes |
| F4 | grounding | HIGH | `surfaced_assumptions[1]`: "Voting rules are locked for a specific ballot cycle" — goes beyond A-0068 ("static at implementation time"); per-ballot locking is an unapproved commitment with concurrency implications. | Yes |
| F5 | faithfulness | HIGH | Thinking chain: Child 1 = "Active Member Definition," Child 2 = "Quorum Threshold." Final response reverses them. ID/ordinal labeling violates the reasoning-to-output contract. | Yes |
| F6 | reasoning_quality | MED | Child 3 measurable condition: "ENT-VOTE-CASTE or ENT-MINUTES" as dual-entity source of truth makes verification non-deterministic. | Yes |
| F7 | final_synthesis | HIGH | QUARANTINE. Four HIGH findings warrant QUARANTINE. | Correct |

**Harness missed:**

- **(MEDIUM) Wrong branch classification.** `tier_decomposition_validator` (not dispatched) would have questioned `decomposable`. The parent has one clear executable AC; A-0342 + A-0343 establish synchronous execution and pre-provisioned audit schema — a single query may fully verify the parent as `atomic_leaf`. `parent_branch_classification_check` would flag MEDIUM.
- **(LOW) Child 2 weak citation.** `traces_to: ["COMP-WORKFLOW-AUDIT", ...]` — COMP-WORKFLOW-AUDIT covers audit history, not member-status consistency. `assumption_citation_validator` at full scope would flag LOW.

### 14c (depth 8) — defects

Parent NFR-004-1.3-3.1-USE-2.1-1: "Cerbos policy evaluates cross-tenant requests and returns HTTP 404." Agent: `decomposable`, agrees with hint C, produces Tier B + Tier C + Tier D.

- **(MEDIUM) F1 — grounding.** `surfaced_assumptions[0]` claims OTel collector endpoint is configured for Cerbos/KMS metrics. TECH-OPENTEL-1 marks this "to-be-determined." Ungrounded specificity.
- **(LOW ×3) F2–F4 — grounding.** Three measurable conditions use invented form: SQL against unresolved schema; "cron job or scheduler exists" as implementation detail; `response.status == 404` code notation.
- **(MEDIUM, mis-severitied) F5 — reasoning_quality.** Framed as "over-reliance on assumption IDs" but the core defect is structural: `traces_to[]` across all three children includes `A-0552`, `A-0611`, `A-0721`. Assumption IDs are not in the allowed prefix whitelist (VV-*, TECH-*, COMP-*, UJ-*, QA-*, sibling IDs). A deterministic `traces_to_id_validity` check would raise to **HIGH** (contract violation). The placeholder under-severitied it to MEDIUM.
- **(MEDIUM) F6 — final_synthesis REVISE.** Correct given available findings.

**Depth-8 drift pattern.** With 22 existing assumptions, the agent faces pressure toward unsupported novelty to justify `surfaced_assumptions[]`. Over-decomposition also accumulates: the Tier C parent already has one specific executable AC; B + C + D children where D mirrors the parent's own AC is fanout noise that `tier_decomposition_validator` would catch.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean (traces_to whitelist not encoded — missed 14c F5 classification) |
| `grounding_validator` | Yes (no saturation claim list) | 14b F1–F4 caught; 14a weak condition — **MISSED** |
| `reasoning_to_response_faithfulness` | Yes | 14b F5 caught correctly |
| `reasoning_quality_validator` | Yes (broad scope) | 14b F6 caught; 14c F5 under-severitied to MEDIUM |
| `final_synthesis` | Yes | Decisions correct given available findings |
| `tier_decomposition_validator` | **NOT dispatched** | Would catch: 14b wrong branch classification, 14c over-decomposition |
| `measurement_adequacy_validator` (full §3) | **NOT dispatched** | Would catch: 14a weak condition; deepens 14b/14c findings |
| `assumption_citation_validator` (full form) | Partial (trace-only) | Full form needed for 14b F3/F4 open-question detection |

---

## 2. Validator implications (deltas vs current catalog)

Catalog §5.1 Pass 4 bundle is correct as stated. These samples surface five concrete gaps — all expected to be shared with fr_saturation (sample 13) and should live in the requirements-class saturation family row, not under nfr_saturation alone.

**`nfr_threshold_grounding` (LLM)** — Parameter-vary `threshold_grounding_audit` (enrichment) to operate on per-AC `measurable_condition` strings at saturation; verify numeric, temporal, or cardinality bounds are grounded in parent NFR threshold or `existing_assumptions`. Catches: 14b F1 (temporal bookending), 14c F1 (OTel endpoint). Shared with fr_saturation.

**`measurement_method_executability` (LLM, parameter-vary from enrichment)** — Already in catalog at enrichment; activate at saturation against per-AC `measurable_condition` strings to verify they are deterministic executable tests. Catches: 14a (invented field name, partial observation surface), 14b F6 (dual-entity source ambiguity), 14c F2–F4 (invented SQL, cron-job detail, code notation). Shared with fr_saturation.

**`parent_branch_classification_check` (deterministic or LLM sub-step of `tier_decomposition_validator`)** — Apply the structural atomicity test to the parent's own `acceptance_criteria`; if parent has one clear executable AC and agent chose `decomposable`, flag MEDIUM. Catches: 14b (A-0342 + A-0343 + one query-based AC suggest atomic_leaf), 14c (Tier C parent with one executable AC decomposed to B+C+D fanout). Shared with fr_saturation.

**`surfaced_assumption_novelty` (deterministic)** — Flag `surfaced_assumptions[]` entries with semantic similarity > 0.85 to any `existing_assumptions` entry (prompt requires "NOT in existing_assumptions"). Catches: 14b F4 ("Voting rules locked per ballot cycle" near-duplicates A-0068). Shared with fr_saturation.

**`traces_to_id_validity` (deterministic, HIGH-severity)** — Assert every entry in every child's `traces_to[]` matches an allowed prefix (VV-*, TECH-*, COMP-*, UJ-*, QA-*, sibling ID, FR ID); A-NNNN, ENT-*, or space-containing entries → HIGH. Promote to `contract_schema_validator` role-keyed registry. Catches: 14c F5 (A-0552, A-0611, A-0721 in `traces_to[]`, under-severitied to MEDIUM). Shared with fr_saturation.
