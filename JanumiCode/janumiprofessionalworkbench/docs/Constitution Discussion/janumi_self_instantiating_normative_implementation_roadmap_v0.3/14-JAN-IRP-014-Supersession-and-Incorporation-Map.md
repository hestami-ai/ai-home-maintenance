# JAN-IRP-014 — Supersession and Incorporation Map

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Preserve and reposition the earlier roadmap and G0 artifacts within the self-instantiating implementation program.

## 1. Governing principle

Earlier work shall not be discarded merely because the program architecture changed. Useful obligations, templates, tools, and evidence controls are incorporated at the correct layer, while superseded execution assumptions are retired explicitly.

## 2. Prior package: Janumi Normative Implementation Roadmap v0.1

| Prior artifact | New disposition | Incorporated into |
|---|---|---|
| `JAN-SRC-001 — Normative Source Baseline` | Retained as provisional P0 input; subject to source audit | `JAN-IRP-003`, `baseline/` |
| `JAN-REQ-001 — Normative Requirement Register` | Retained with stable IDs; first-gate mapping treated as legacy and remapped to capabilities | `JAN-IRP-003`, `control/` |
| `JAN-RMAP-001 — Normative Implementation Roadmap` | Superseded as master execution sequence; capability content incorporated | `JAN-IRP-002`, `JAN-IRP-008`, `JAN-IRP-009` |
| `JAN-CONF-001 — Conformance and Evidence Matrix` | Retained as provisional control projection | `JAN-IRP-006`, `JAN-IRP-010`, `baseline/` |
| `JAN-INC-001 — Increment Template` | Superseded by machine-readable increment authorization and P7 contract | `JAN-IRP-009`, `templates/` |
| `JAN-DEV-001 — Deviation Template` | Incorporated and expanded | `JAN-IRP-011`, `templates/` |
| `JAN-GATE-001 — Gate Evidence Checklist` | Incorporated and expanded | `JAN-IRP-010`, `templates/` |

## 3. Prior package: Janumi G0 Execution Package v0.2

| Prior artifact | New disposition | Incorporated into |
|---|---|---|
| G0 execution specification | Split across P1–P4; no longer an external prerequisite | `JAN-IRP-002`, `004`, `005`, `006` |
| Implementation inventory schema | Incorporated into repository evidence acquisition | `JAN-IRP-004`, schemas/templates |
| Conformance assessment procedure | Incorporated | `JAN-IRP-006` |
| Discrepancy/deviation/reconciliation control | Incorporated and generalized | `JAN-IRP-006`, `JAN-IRP-011` |
| Evidence and exit-gate contract | Incorporated and generalized | `JAN-IRP-010` |
| G0 acceptance template | Superseded by generic phase/increment gate decision | schemas/templates |
| G1 derivation procedure | Superseded by repository-specific roadmap instantiation | `JAN-IRP-009` |
| Primary and review prompts | Replaced by phase-specific prompts | `agent-prompts/` |
| Repository inventory utility | Retained and renamed as a P1 helper | `tools/repository_evidence_inventory.py` |
| Requirement templates | Retained and aligned with new schemas | `templates/`, `control/` |

## 4. Conceptual correction

The superseded sequence was:

```text
Repository assessment as prerequisite
→ roadmap
→ implementation
```

The accepted sequence is:

```text
Canonical implementation program
→ repository intake and reconstruction as program phases
→ reconciliation and transition architecture
→ repository-specific roadmap instance
→ implementation
```

## 5. Legacy gate mapping

The prior `G0–G9` gates are preserved in requirement records as historical mapping. Their implementation outcomes map approximately as follows:

| Legacy gate | New structure |
|---|---|
| `G0` | Program phases `P0–P4` |
| `G1` | Capabilities `C1–C2` |
| `G2` | Capability `C3` |
| `G3` | Capability `C4` |
| `G4` | Capability `C5` |
| `G5` | Capabilities `C6–C7` |
| `G6` | Capability `C8` |
| `G7` | Capability `C9` |
| `G8` | Capability `C10` |
| `G9` | Capability `C11` and program phases `P8–P9` |

This mapping is approximate because repository investigation may show that obligations are already implemented, require different packaging, or span several increments.

## 6. Supersession rule

After formal adoption of this corpus:

- prior master-roadmap and G0 execution documents shall be marked `SUPERSEDED` or `INCORPORATED`;
- stable requirement IDs and valid control records remain active;
- no prior evidence or decision shall be deleted;
- new program instances shall use `JAN-IRP-000–015`;
- active legacy execution may continue only under an explicit transition decision.

## 7. No-loss verification

Before archiving prior packages, verify:

- all 157 requirement IDs are retained;
- all discrepancy classifications are retained;
- inventory tooling is retained;
- increment, deviation, and gate fields are represented in new schemas;
- prior package hashes and locations are recorded;
- no accepted decision loses its rationale or evidence.
