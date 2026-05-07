# Assessment: architecture_agent / adr_capture (Phase 4.3)

**Sample**: `track_c_samples/20_architecture_agent__adr_capture.md`
**Reviewed agent**: architecture_agent running qwen3.5:9b
**Note**: adr_capture sub-phase was NOT in the original Phase 4 sub-phase list at cal-26 time; it appears as an emergent addition and warrants explicit registration in `phaseManifest.ts` and `harness_design.md` §2.1 before Track D dispatch rows are added.
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle; architecture_agent / Phase 4 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: QUARANTINE — 4 HIGH + 1 MEDIUM + 1 LOW
**Rendering bug (follow-up)**: `decision_rationale` reads "3 HIGH findings" but `findings_count_by_severity` shows H=4. The fourth HIGH was added by `final_synthesis` after the rationale string was pre-frozen. Minor harness rendering bug — the rationale string should be populated from `findings_count_by_severity` at synthesis time.

---

## 1. What this sample reveals

Phase 4.3 tasks the agent with capturing ADRs for every significant architectural choice made during Phases 4.1–4.2. The dominant defect class is new: the agent introduced unsupported technical thresholds (SHA-256, Haversine/Vincenty, server-priority merge logic) that were not mandated upstream — the inverse of Phase 3's omission failures. The structural shape is hybrid: **discovery-class** (enumerate decisions from bounded upstream inputs) plus **synthesis-class** (each ADR synthesizes rationale, alternatives, consequences). The `deferred_to_track_d.md` §1 "possibly a new decision-class family" prediction is **partially supported**: ADR generation has a decision-class character, but the dominant validator need is a new `mandated_threshold_inheritance` sub-type (grounding check on technical commitments). The defect class is structurally similar to Phase 3.3's `implementation_commitment_grounding` (assessment 17) but more severe — here the agent introduces commitments rather than over-committing on provided ones.

adr_capture is a new emergent sub-phase. Recommend verifying the prompt and schema that generated this output before promoting it to a canonical Phase 4 stage.

---

## 1a. Defects in the agent's response

All four HIGH findings explicitly documented per QUARANTINE protocol:

- **(HIGH-1 — grounding_validator) SHA-256 invented for audit log integrity.** ADR-001: "Implement cryptographic checksumming (SHA-256) for all log entries." The component model references `IntegrityHash` (generic cryptographic checksum) and `WORMComplianceTag`. No upstream source mandates SHA-256 by name. Fix: remove algorithm name; reference "cryptographic checksumming" per component vocabulary.

- **(HIGH-2 — grounding_validator) Haversine/Vincenty invented for geospatial filtering.** ADR-007: "Perform distance calculations using Haversine or Vincenty formulas." The component model specifies `GeodesicRadius` calculation; no upstream source mandates a specific formula. `EXT-SYS-004` lists a Geospatial Mapping Provider but specifies no algorithm. Fix: reference "geodesic distance calculation" per the vocabulary; remove formula names.

- **(HIGH-3 — grounding_validator) Server-priority conflict resolution invented.** ADR-005: "deterministic merge strategy based on last-modified timestamp with server priority for critical fields." The component model specifies `ConflictResolutionStrategy` as a term but mandates no merge semantics. Fix: reference "a deterministic merge strategy based on defined conflict resolution rules" without specifying the algorithm.

- **(HIGH-4 — final_synthesis) QUARANTINE decision.** Correctly escalated on three unsupported technical thresholds. Fourth HIGH in findings_count; note the pre-frozen rationale rendering bug above.

- **(MEDIUM — grounding_validator, fabricated_entity) S3-compatible storage over-committed.** ADR-006 specifies "S3-compatible" storage. Upstream commits to `TECH-SEAWEEDFS-1` (SeaweedFS) specifically — the S3 compatibility abstraction was not mandated. MEDIUM rather than HIGH because SeaweedFS does have S3-compatible APIs; the generalization is partially supported.

- **(LOW — reasoning_quality_validator, unjustified_leap) All ADRs set to "accepted."** ADR lifecycle standard: begin at "proposed." The thinking chain explicitly deliberated this and chose "accepted" without governance rationale. Real finding.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — architectural_decisions schema valid |
| `grounding_validator` | Yes | 3 HIGH (unsupported thresholds), 1 MEDIUM (fabricated entity) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain aligned with ADR content |
| `reasoning_quality_validator` | Yes (broad scope) | LOW (real finding — premature acceptance status) |
| `final_synthesis` | Yes | HIGH — QUARANTINE correct |
| `mandated_threshold_inheritance` | NOT dispatched | Would catch all three HIGH threshold inventions with bidirectional source-vs-claim comparison |
| `adr_status_discipline_validator` | NOT dispatched | Would enforce "proposed" default unless governance rationale present |

No false positives. The placeholder bundle performed correctly; the main precision gap is the missing bidirectional threshold check (invented vs dropped).

---

## 2. Validator implications (deltas vs current catalog)

**`mandated_threshold_inheritance`** (LLM, new sub-type; closest family: discovery-class). Parameterized by: (a) thresholds mandated by upstream TECH-* constraints and SR text, (b) thresholds introduced in ADR decision/rationale fields. Bidirectional: (1) each introduced threshold must trace to an upstream source — unsupported → HIGH; (2) each upstream-mandated threshold must appear in at least one ADR — silently dropped → HIGH; (3) partially supported threshold (source says "checksum," agent says "SHA-256") → MEDIUM. Would have caught all three HIGH findings. Proposed id: `mandated_threshold_inheritance`.

**`adr_status_discipline_validator`** (deterministic, decision-class thin layer). Checks each ADR's `status` field defaults to "proposed" unless the body contains explicit acceptance rationale. Severity: all ADRs accepted without rationale → LOW; individual ADR accepted without rationale → MEDIUM. Would have caught the LOW finding.

**`architecture_agent` role-mapping.** `deferred_to_track_d.md` §1 "possibly a new decision-class family" prediction is **partially supported**: adr_capture warrants a hybrid bundle — discovery-class grounding validators (`grounding_validator` + new `mandated_threshold_inheritance`) + synthesis-class coverage validators (alternatives-present check, already in grounding_validator scope) + thin decision-class layer (`adr_status_discipline_validator`). Full revised mapping for architecture_agent across Phase 4: discovery-class at 4.1 and 4.3; bloom-class at 4.2; decision-class thin layer at 4.3 only.
