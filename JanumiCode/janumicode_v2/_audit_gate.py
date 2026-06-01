#!/usr/bin/env python3
"""Gatekeeper-aware fidelity audit for one sub-phase (ts-120 audit run).

Usage: python _audit_gate.py <db> <sub_phase_id>

Verifies the chain: raw LLM response -> json-repair (if any) -> persisted
artifact -> gatekeeper prune consistency. Prints a compact PASS/FLAG report.
Temp throwaway (gitignored path); delete at run end.
"""
import sqlite3, sys, json

sys.stdout.reconfigure(encoding="utf-8")
con = sqlite3.connect(sys.argv[1]); sp = sys.argv[2]

def rows(rt):
    return [json.loads(c) for (c,) in con.execute(
        "SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type=? AND is_current_version=1",
        (sp, rt))]

rt_counts = {r: con.execute(
    "SELECT COUNT(*) FROM governed_stream WHERE sub_phase_id=? AND record_type=? AND is_current_version=1",
    (sp, r)).fetchone()[0]
    for (r,) in con.execute("SELECT DISTINCT record_type FROM governed_stream WHERE sub_phase_id=? AND is_current_version=1", (sp,))}

print(f"===== {sp} =====")
print("record types:", rt_counts)
flags = []

# 1) json-repair fired?
repair = rt_counts.get('json_repair_record', 0)
print(f"json_repair_record: {repair}")

# 2) each agent_output parses?
def loads_lenient(t):
    """Strip a leading/trailing markdown fence before parsing (the real
    parser does this via parseJsonWithRecovery)."""
    s = t.strip()
    if s.startswith('```'):
        s = s.split('\n', 1)[1] if '\n' in s else s
        if s.rstrip().endswith('```'):
            s = s.rstrip()[:-3]
    return json.loads(s)

outs = rows('agent_output')
parsed_outs = []
for i, o in enumerate(outs):
    try:
        p = loads_lenient(o['text']); parsed_outs.append(p)
        print(f"  output[{i}] parses, keys={list(p.keys())} status={o.get('status')} retries={o.get('retry_attempts')} fallback={o.get('used_fallback')}")
    except Exception as e:
        parsed_outs.append(None); flags.append(f"output[{i}] PARSE FAIL: {e}")
        print(f"  output[{i}] PARSE FAIL: {e}")

# 3) gatekeeper consistency
gate = next((p for p in parsed_outs if p and 'kept_ids' in p), None)
art = rows('artifact_produced')
if gate:
    kept = set(gate['kept_ids'])
    dropped = set(d.get('id') if isinstance(d, dict) else d for d in gate['dropped'])
    print(f"  gatekeeper kept={len(kept)} dropped={len(dropped)}")
    # bloom total = kept ∪ dropped check against the non-gate output
    bloom = next((p for p in parsed_outs if p and 'kept_ids' not in p), None)
    if bloom:
        bloom_ids = []
        for k, v in bloom.items():
            if isinstance(v, list):
                bloom_ids += [it.get('id') for it in v if isinstance(it, dict) and 'id' in it]
        bloom_ids = set(bloom_ids)
        if bloom_ids and bloom_ids != (kept | dropped):
            flags.append(f"bloom ids ({len(bloom_ids)}) != kept∪dropped ({len(kept|dropped)})")
        else:
            print(f"  bloom == kept∪dropped: {bloom_ids == (kept|dropped)} (bloom {len(bloom_ids)})")
    if art:
        acc = []
        for k, v in art[0].items():
            if isinstance(v, list):
                acc += [it.get('id') for it in v if isinstance(it, dict) and 'id' in it]
        acc = set(acc)
        if acc != kept:
            flags.append(f"artifact accepted ({len(acc)}) != kept_ids ({len(kept)}): extra={acc-kept} missing={kept-acc}")
        else:
            print(f"  artifact accepted == kept_ids: True ({len(acc)})")
        if not dropped.isdisjoint(acc):
            flags.append(f"dropped ids present in artifact: {dropped & acc}")
else:
    # non-gatekeeper sub-phase: raw-vs-artifact count fidelity
    if parsed_outs and parsed_outs[0] and art:
        r = parsed_outs[0]; a = art[0]
        for k in r:
            if isinstance(r[k], list):
                ak = [x for x in a if x.lower().replace('_', '') == k.lower().replace('_', '')]
                ac = len(a[ak[0]]) if ak else None
                if ac is not None and ac != len(r[k]):
                    flags.append(f"list {k}: raw={len(r[k])} art={ac}")

print("\nRESULT:", "PASS (clean)" if not flags else "FLAG: " + " | ".join(flags))
