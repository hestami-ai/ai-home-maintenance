# Janumi Gate G0 Execution Package

**Package version:** 0.2  
**Status:** Execution-ready normative draft  
**Governing roadmap:** `JAN-RMAP-001` v0.1  
**Gate:** `G0 — Normative Baseline and Reconciliation Control`

## Purpose

This package turns G0 into an executable, evidence-bearing repository assessment. G0 establishes:

1. the controlled normative target corpus;
2. the implementation that presently exists;
3. the current conformance status of all 157 `JAN-REQ-*` obligations;
4. every material code/document/test/runtime discrepancy;
5. the narrowest justified semantic subset that may enter G1.

G0 is a reconnaissance, governance, and reconciliation increment. It is not a feature-development increment.

## Immediate sequence

```text
G0.0  Preserve repository identity and assessment context
  ↓
G0.1  Materialize and consolidate the normative source corpus
  ↓
G0.2  Inventory the present implementation
  ↓
G0.3  Construct the evidence-grounded current-state architecture
  ↓
G0.4  Assess all 157 requirements
  ↓
G0.5  Classify discrepancies, deviations, deferrals, and reconciliations
  ↓
G0.6  Conduct independent review
  ↓
G0.7  Record G0 acceptance and bounded G1 authorization
```

G0.1 and G0.2 may proceed in parallel after G0.0.

## Package contents

| Artifact | Purpose |
|---|---|
| `01-JAN-G0-EXEC-001-*` | Normative execution specification, phases, write boundary, and exit conditions. |
| `02-JAN-G0-INVENTORY-001-*` | Current-implementation inventory model and evidence rules. |
| `03-JAN-G0-ASSESS-001-*` | Three-pass requirement assessment and conformance criteria. |
| `04-JAN-G0-REPORT-001-*` | Human-readable baseline report template. |
| `05-JAN-G0-REG-001-*` | Discrepancy, deviation, deferral, and reconciliation governance. |
| `06-JAN-G0-EVID-001-*` | Evidence package and exit-gate proof contract. |
| `07-JAN-G0-DEC-001-*` | Formal G0 acceptance decision template. |
| `08-JAN-G1-AUTH-001-*` | Procedure for deriving—not automatically authorizing—the first G1 increment. |
| `agent-prompts/` | Primary assessment and independent-review prompts. |
| `tools/` | Read-only standard-library repository inventory utility. |
| `templates/` | Prefilled 157-requirement assessment register and blank working registers. |
| `machine/` | JSON Schemas, G0 work plan, G0 requirement subset, and package dependencies. |
| `MANIFEST.json` | SHA-256 integrity manifest. |

## Quick start

1. Put the normative source corpus, roadmap package, and this package under repository change control or provide controlled paths.
2. Create a dedicated G0 branch or worktree.
3. Run the read-only inventory utility:

```bash
python tools/g0_repository_inventory.py \
  --repo /path/to/janumi/repository \
  --output docs/implementation-baseline/evidence/repository-inventory
```

4. Give the primary coding agent:

- the normative corpus;
- the roadmap package;
- this G0 package;
- the repository root;
- `agent-prompts/JAN-G0-AGENT-001-Primary-Assessment-Prompt.md`.

5. Give a separate reviewer `agent-prompts/JAN-G0-REVIEW-001-Independent-Review-Prompt.md`.
6. Record acceptance using `07-JAN-G0-DEC-001-*`.

## Required repository outputs

```text
docs/implementation-baseline/
├── 00-G0-Baseline-Assessment-Report.md
├── 01-Current-State-Architecture.md
├── 02-Normative-Source-Consolidation-Report.md
├── 03-G0-Gate-Acceptance-Decision.md
├── 04-Independent-Review-Report.md
├── registers/
│   ├── implementation-inventory.csv
│   ├── requirement-assessment.csv
│   ├── discrepancy-register.csv
│   ├── deviation-register.csv
│   ├── deferral-register.csv
│   └── evidence-index.csv
└── evidence/
    ├── repository-inventory/
    ├── commands/
    ├── tests/
    ├── screenshots/
    ├── schemas/
    ├── runtime/
    └── source-baseline/
```

## G0 write boundary

Automated agents may create or modify only:

```text
docs/architecture/normative/
docs/implementation-baseline/
tools/g0/
```

unless an authorized human expands that boundary. Product code, migrations, dependencies, generated runtime contracts, and deployment behavior shall not be changed merely to make the baseline appear conformant.

## G0 completion meaning

G0 completion means the current system is **known, evidenced, and governed**. It does not mean the system already conforms to the full Janumi target architecture.

Only a recorded `ACCEPT G0` or bounded `CONDITIONALLY ACCEPT G0` decision may authorize a specific G1 capability increment.
