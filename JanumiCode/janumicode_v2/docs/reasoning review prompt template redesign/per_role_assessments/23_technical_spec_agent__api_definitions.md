# Assessment: technical_spec_agent / api_definitions (Phase 5.2)

**Sample**: `track_c_samples/23_technical_spec_agent__api_definitions.md`
**Reviewed agent**: technical_spec_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); Phase 5 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 1 HIGH + 1 MEDIUM; **json_repair fired** (agent wrapped output in markdown fences)

---

## 1. What this sample reveals

Phase 5.2 tasks the agent with emitting API definitions for all 28 backlog components, given a bounded component list plus explicit Interface Contracts specifying per-component communication protocols (gRPC/Protobuf at CONTRACT-BACKEND-003, TUS/HTTPS at CONTRACT-SYNC-011, KMS API at CONTRACT-SECURITY-012). This is **discovery-class**: the agent has a finite source list (28 components + named interface contracts) and must extract conforming endpoint definitions. The correct protocol for each component is already stated upstream; the failure is a protocol-flattening fabrication, the discovery-class pattern of silently ignoring source constraints. The anticipated `deferred_to_track_d.md` §1 "requirements-class + synthesis-class" mapping is **revised to discovery-class** for Phase 5.2, consistent with sample 22.

Two distinct defect types appear. The first (json_repair) is a structural pre-defect: the agent emitted its JSON wrapped in markdown fences (````json ... ````), causing the harness to invoke json_repair before any validator ran. This is the **same pattern as Phase 6 task_skeleton** addressed in Tracks A+B; it indicates the JSON-discipline rule present in Phase 2 saturation prompts is absent from `technical_spec_agent` prompts. The second (fragile_coupling HIGH) is a genuine architectural-reasoning defect: the agent flattened all 28 components to uniform REST/HTTPS, ignoring the Interface Contracts that explicitly specify non-REST protocols for several components.

---

## 1a. Defects in the agent's response

- **(structural pre-defect — harness caught mechanically, not as a finding) Markdown fence wrapping.** The original invocation emitted ````json ... ```` fencing around the JSON payload, causing parse failure and triggering json_repair (`status: "recovered"`, 134695ms additional latency). The repair succeeded and downstream accepted the recovered output, but the discipline failure is real: the agent should emit a bare JSON object. The harness treated this as a structural infrastructure event, not a scored finding — which means the finding table does not record it. A deterministic `json_output_discipline_check` running before validators would catch this at near-zero cost and prevent the json_repair overhead.

- **(HIGH — reasoning_quality_validator, fragile_coupling) Uniform REST/HTTPS assumed for all 28 components, ignoring Interface Contracts.** The context includes explicit contracts specifying gRPC/Protobuf (CONTRACT-BACKEND-003), TUS/HTTPS upload protocol (CONTRACT-SYNC-011), and KMS API (CONTRACT-SECURITY-012). The agent explicitly acknowledged in its thinking chain that "CONTRACT-BACKEND-003: gRPC/Protobuf for backend" but then decided to "assume a REST/HTTPS wrapper." This is a documented reasoning failure: the agent chose to override an explicit upstream constraint based on a simplification assumption, without surfacing it as an open_question or assumption. The finding is correctly HIGH — all 28 component definitions are technically incorrect for non-REST components. Real finding.

- **(MEDIUM — final_synthesis)** REVISE correctly escalated on 1 HIGH. No independent defect.

- **(harness-missed, MEDIUM) Auth requirement uniformly "Bearer" without verifying per-component auth scheme.** Invariant API-001 requires an explicit auth requirement per endpoint. The agent correctly satisfies API-001's letter (all endpoints have `"auth_requirement": "Bearer"`) but the interface contracts specify varying auth schemes — KMS endpoint likely uses different credentials than Better-Auth JWT. The blanket `"Bearer"` is a specification fabrication for those components. A phase-specific `api_auth_contract_alignment_validator` would flag this.

- **(harness-missed, LOW) Component ID casing inconsistency.** The backlog list mixes casing: `COMP-FIN-TAX` and `COMP-FIN-TRX` (all-caps prefix) appear alongside `comp-audit-event-ingestion` (lowercase). The agent carried both conventions into the output. Cosmetic but worth noting for downstream parsing.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `json_output_discipline_check` | NOT dispatched (not in catalog) | Would have caught markdown fence wrapping before parse failure |
| `contract_schema_validator` | Yes (on repaired output) | Clean — api_definitions schema valid |
| `grounding_validator` | Yes | Clean — no unsupported endpoint values (only protocol assumption checked separately) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain's simplification decision is reflected in the response |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH — fragile_coupling (real finding) |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `interface_contract_alignment_validator` | NOT dispatched | Would catch protocol flattening per component |
| `api_auth_contract_alignment_validator` | NOT dispatched | Would catch blanket Bearer where contracts specify alternate schemes |

The placeholder bundle delivered one genuine HIGH finding. The bigger gap is upstream: json_repair was needed before any validator ran. A pre-validator discipline check would have surfaced the structural failure at zero LLM cost rather than 134-second recovery.

---

## 2. Validator implications (deltas vs current catalog)

**`json_output_discipline_check`** (deterministic, **family-level candidate**). Verify that the raw agent response begins with `{` and ends with `}` (or `[` and `]` for array-rooted schemas), with no surrounding markdown fences or prose preamble. Runs before any other validator — a failed check pre-empts the whole bundle (broken JSON defeats all downstream LLM validators). Severity: markdown-fenced JSON → HIGH (triggers repair overhead, structural contract violation); trailing prose after JSON → MEDIUM. This pattern has now appeared at Phase 5.2 (sample 23) and Phase 6 task_skeleton (documented in Tracks A+B). Cross-phase recurrence across two distinct roles (`technical_spec_agent`, task_skeleton role) makes this a **family-level concern**, not a Phase-5-role-specific outlier. Promotion to family-level is warranted. Proposed id: `json_output_discipline_check`.

**`interface_contract_alignment_validator`** (LLM, discovery-class). For Phase 5.2, verify that each component's endpoint definition uses the communication protocol specified in the matching Interface Contract from Phase 3.3. Parameterized by: (a) the contract list from prompt context, (b) each component's `component_id` matched to a contract by name. Severity: protocol mismatch contradicting explicit contract → HIGH; unresolved ambiguity not surfaced as assumption → MEDIUM. Would have confirmed all 28 definitions (or caught the gRPC/TUS components) rather than relying on broad-scope `reasoning_quality_validator`. Proposed id: `interface_contract_alignment_validator`.

**`ungrounded_operational_specifics`** (LLM, family-level — see sample 25 assessment for consolidation discussion). The auth-scheme fabrication (Bearer everywhere) is a Phase 5.2 instantiation of this family. The Pattern: agent emits a concrete operational value (auth scheme, endpoint URL, protocol name) where the source context is either silent or explicit in a different direction.

**Role-mapping note.** Consistent with sample 22: **discovery-class** for Phase 5.2. The bounded input (28 components + explicit interface contracts) fully specifies the output shape; the dominant failure is ignoring a source constraint, not a novelty or coverage gap. `deferred_to_track_d.md` §1 "requirements-class + synthesis-class" is **revised to discovery-class** for this sub-phase.
