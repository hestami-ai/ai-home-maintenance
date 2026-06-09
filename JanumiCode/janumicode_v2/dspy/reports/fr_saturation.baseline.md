# fr_saturation baseline — deterministic metric

Trainset: `dspy/trainsets/fr_saturation.trainset.jsonl` (40 examples, model = recorded gpt-oss:20b)

- **Mean score:** 0.845
- **Parse-ok:** 40/40

## Findings by validator (totals across all 40 examples)

| Validator | HIGH | MED | LOW | examples with ≥1 finding |
|---|---|---|---|---|
| `json_output_discipline_check` | 0 | 23 | 0 | 23/40 |
| `contract_schema_validator` | 0 | 0 | 0 | 0/40 |
| `parent_branch_classification_check` | 0 | 0 | 0 | 0/40 |
| `decomposition_fanout_discipline` | 0 | 0 | 0 | 0/40 |
| `traces_to_id_validity` | 0 | 0 | 0 | 0/40 |
| `citation_grounding_proxy` | 0 | 39 | 0 | 23/40 |

## Per-example scores (worst first)

| Score | Penalty | Parse | Example |
|---|---|---|---|
| 0.600 | 1.6 | ok | Phase fr_saturation Pass-1 — decomposition of US-010 (depth 0, hint root) |
| 0.600 | 1.6 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-3-1 (depth 2, hint C) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-1 — decomposition of US-002 (depth 0, hint root) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-2 — decomposition of US-010-3 (depth 1, hint B) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-2 — decomposition of US-010-5 (depth 1, hint B) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-3 (depth 2, hint A) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-3-3 (depth 2, hint C) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-3 — decomposition of US-006-3-400 (depth 2, hint B) |
| 0.700 | 1.2 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-1-3 (depth 3, hint C) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-1 — decomposition of US-001 (depth 0, hint root) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-1 — decomposition of US-003 (depth 0, hint root) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-1 — decomposition of US-006 (depth 0, hint root) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-2 — decomposition of US-006-3 (depth 1, hint A) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-2 (depth 2, hint A) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-3 — decomposition of US-006-3-404 (depth 2, hint B) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-1-4 (depth 3, hint C) |
| 0.800 | 0.8 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-2-4-1 (depth 3, hint B) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-1 — decomposition of US-005 (depth 0, hint root) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-1 — decomposition of US-007 (depth 0, hint root) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-2 — decomposition of US-006-1 (depth 1, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-2 — decomposition of US-006-2 (depth 1, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-2 — decomposition of US-006-4 (depth 1, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-2 — decomposition of US-010-1 (depth 1, hint B) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-2 — decomposition of US-010-4 (depth 1, hint B) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-1 (depth 2, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-4 (depth 2, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-6 (depth 2, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-2-4-2 (depth 3, hint C) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-1-1 (depth 3, hint C) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-1-2 (depth 3, hint C) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-2-2 (depth 3, hint C) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-5 — decomposition of US-010-3-1-3-2 (depth 4, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-5 — decomposition of US-010-3-1-3-3 (depth 4, hint A) |
| 0.900 | 0.4 | ok | Phase fr_saturation Pass-6 — decomposition of US-010-3-1-3-2-1 (depth 5, hint C) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-1 — decomposition of US-004 (depth 0, hint root) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-2 — decomposition of US-010-2 (depth 1, hint B) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-2-5 (depth 2, hint A) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-3 — decomposition of US-010-3-2 (depth 2, hint C) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-4 — decomposition of US-010-3-2-1 (depth 3, hint C) |
| 1.000 | 0.0 | ok | Phase fr_saturation Pass-5 — decomposition of US-010-3-1-3-1 (depth 4, hint A) |
