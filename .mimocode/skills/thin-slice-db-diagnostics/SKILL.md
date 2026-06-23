---
name: thin-slice-db-diagnostics
description: Diagnose thin-slice calibration runs by querying governed_stream SQLite DBs. Use when analyzing run results, finding failures, inspecting prompts/outputs, or comparing across slices.
---

# Thin-Slice DB Diagnostics

Query the governed_stream SQLite DB produced by JanumiCode v2 thin-slice runs to diagnose issues, inspect outputs, and compare across slices.

## Locating the DB

Thin-slice workspace DBs live at:
```
JanumiCode/janumicode_v2/test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-<N>/.janumicode/test-harness/<timestamp>.db
```

Resume DBs use the pattern `resume-<timestamp>.db` in the same directory.

To find the latest DB for a given workspace:
```bash
ls -t test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-<N>/.janumicode/test-harness/*.db | head -1
```

## governed_stream Schema

All records live in a single `governed_stream` table. Key columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT | Primary key |
| `record_type` | TEXT | e.g. `agent_invocation`, `agent_output`, `artifact_produced`, `scope_prune_decision`, `task_decomposition_node`, `json_repair_record` |
| `sub_phase_id` | TEXT | e.g. `business_domains_bloom`, `vv_requirements_discovery`, `task_skeleton` |
| `phase_id` | TEXT | Phase number as string (`'1'` through `'10'`) |
| `is_current_version` | INTEGER | 1 = latest version of this record |
| `content` | TEXT | JSON string — the record payload |
| `workflow_run_id` | TEXT | Ties records to a specific run |
| `produced_at` | INTEGER | Timestamp ms |
| `produced_by_record_id` | TEXT | Links outputs to their invocation |

`agent_invocation` records contain `prompt`, `system`, `provider`, `model`, `label`, `temperature`, `max_tokens`.
`agent_output` records contain `text`, `thinking`, `status`, `duration_ms`.
`artifact_produced` records contain the synthesized artifact JSON (shape varies by sub-phase).

## Common Diagnostic Queries

### Run overview
```sql
SELECT phase_id, sub_phase_id, record_type, COUNT(*) n
FROM governed_stream WHERE is_current_version=1
GROUP BY phase_id, sub_phase_id, record_type
ORDER BY phase_id, sub_phase_id;
```

### Find failures
```sql
SELECT sub_phase_id, record_type, json_extract(content, '$.status') status
FROM governed_stream
WHERE is_current_version=1 AND json_extract(content, '$.status') NOT IN ('success', 'completed')
  AND record_type IN ('agent_output', 'task_test_result');
```

### Task decomposition status
```sql
SELECT json_extract(content, '$.status') s, COUNT(*) n
FROM governed_stream WHERE record_type='task_decomposition_node'
GROUP BY s;
```

### Scope prune decisions (kept vs dropped)
```sql
SELECT sub_phase_id,
       json_extract(content, '$.skipped') skipped,
       json_array_length(json_extract(content, '$.kept_ids')) kept,
       json_array_length(json_extract(content, '$.dropped')) dropped
FROM governed_stream WHERE record_type='scope_prune_decision';
```

### JSON repair records (indicates malformed LLM output)
```sql
SELECT sub_phase_id, produced_at
FROM governed_stream WHERE record_type='json_repair_record'
ORDER BY produced_at;
```

### Test results
```sql
SELECT json_extract(content, '$.test_name') name,
       json_extract(content, '$.passed') passed,
       json_extract(content, '$.duration_ms') ms
FROM governed_stream WHERE record_type='task_test_result';
```

### Cross-slice comparison (Node.js pattern)
```javascript
const Database = require('better-sqlite3');
const fs = require('fs');

function sliceSummary(wsNum) {
  const dir = `test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-${wsNum}/.janumicode/test-harness`;
  const f = fs.readdirSync(dir).find(x => x.endsWith('.db'));
  if (!f) return null;
  const db = new Database(`${dir}/${f}`, { readonly: true });
  const cnt = (rt) => db.prepare('SELECT COUNT(*) n FROM governed_stream WHERE record_type=? AND is_current_version=1').get(rt).n;
  const tdn = db.prepare("SELECT json_extract(content,'$.status') s, COUNT(*) n FROM governed_stream WHERE record_type='task_decomposition_node' GROUP BY s").all();
  const summary = { slice: wsNum, invocations: cnt('agent_invocation'), outputs: cnt('agent_output'), repairs: cnt('json_repair_record'), tdn: {} };
  for (const r of tdn) summary.tdn[r.s] = r.n;
  db.close();
  return summary;
}
```

### Inspect a specific sub-phase invocation prompt
```python
import json, sqlite3, sys
db_path = sys.argv[1]
sub_phase = sys.argv[2]  # e.g. 'business_domains_bloom'
con = sqlite3.connect(db_path)
rows = con.execute(
    "SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type='agent_invocation' AND is_current_version=1",
    (sub_phase,)
).fetchall()
for r in rows:
    inv = json.loads(r[0])
    print(f"label={inv.get('label')}  model={inv.get('provider')}/{inv.get('model')}  prompt_len={len(inv.get('prompt',''))}")
con.close()
```

### Extract thinking chains for a sub-phase
```python
import json, sqlite3, sys
db_path = sys.argv[1]
sub_phase = sys.argv[2]
con = sqlite3.connect(db_path)
rows = con.execute(
    "SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type='agent_output' AND is_current_version=1",
    (sub_phase,)
).fetchall()
for r in rows:
    out = json.loads(r[0])
    th = out.get('thinking', '')
    print(f"thinking length: {len(th) if th else 0}")
    if th:
        print(th[:2000])
con.close()
```

## Interpreting Results

- **`json_repair_record`** count > 0 for a sub-phase means the LLM output was malformed and needed repair. High repair rates indicate the prompt template may be too complex for the model.
- **`scope_prune_decision` with many dropped** items may indicate the gatekeeper is over-pruning or the bloom is overshooting.
- **`task_decomposition_node` with status != `atomic`** remaining means decomposition didn't terminate — check depth/fanout caps.
- **`agent_output.status` = `error`** or missing outputs indicate the LLM call failed.
- **Thinking chains** longer than ~4K tokens on a 9B model often correlate with degraded output quality.
- **Cross-slice comparison**: if slice N has 2x the repairs of slice N-1 after a prompt change, the change likely regressed.
