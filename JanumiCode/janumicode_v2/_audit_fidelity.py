#!/usr/bin/env python3
"""Schema-fidelity audit helper for the ts-112 audit-pause run.

Usage: python _audit_fidelity.py <db> <sub_phase_id>

Dumps, for a sub-phase:
  - record_type counts
  - whether json_repair fired (json_repair_record content + repair AODD)
  - the prompt's declared output schema (the ```json ...``` block, or REQUIRED OUTPUT region)
  - the raw response text (head/tail) and whether it looks like clean JSON
  - the persisted artifact record(s) top-level shape

This is a temp throwaway (gitignored path); delete at run end.
"""
import sys, json, sqlite3, re

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

db, sp = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db)


def rows(sp, rt):
    return [json.loads(r[0]) for r in con.execute(
        "SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type=? AND is_current_version=1",
        (sp, rt)).fetchall()]


print(f"===== SUB-PHASE: {sp} =====")
print("--- record_type counts ---")
for rt, n in con.execute(
        "SELECT record_type, COUNT(*) FROM governed_stream WHERE sub_phase_id=? AND is_current_version=1 GROUP BY record_type",
        (sp,)).fetchall():
    print(f"  {rt}: {n}")

# json_repair
reps = rows(sp, 'json_repair_record')
print(f"--- json_repair_record: {len(reps)} ---")
for r in reps:
    print("  ", json.dumps(r)[:800])

# prompt schema region
invs = rows(sp, 'agent_invocation')
for k, inv in enumerate(invs):
    p = inv.get('prompt', '') or ''
    label = inv.get('label')
    print(f"--- agent_invocation[{k}] label={label} prompt_len={len(p)} ---")
    m = re.search(r'```json\s*(.*?)```', p, re.S)
    if m:
        print("  DECLARED OUTPUT SCHEMA (```json block):")
        print("   " + m.group(1).strip()[:1400].replace("\n", "\n   "))
    else:
        i = p.upper().find('REQUIRED OUTPUT')
        if i < 0:
            i = p.upper().find('OUTPUT FORMAT')
        if i >= 0:
            print("  OUTPUT-FORMAT region (no fenced block):")
            print("   " + p[i:i + 1200].replace("\n", "\n   "))
        else:
            print("  (no explicit output-schema block found in prompt)")

# raw responses
outs = rows(sp, 'agent_output')
for k, out in enumerate(outs):
    txt = out.get('text') or ''
    print(f"--- agent_output[{k}] status={out.get('status')} text_len={len(txt)} ---")
    t = txt.strip()
    clean = (t.startswith('{') or t.startswith('[')) and (t.endswith('}') or t.endswith(']'))
    print(f"  looks_like_clean_json={clean}")
    try:
        pj = json.loads(t)
        print("  RAW RESPONSE parses. top-level:",
              list(pj.keys()) if isinstance(pj, dict) else f"array[{len(pj)}]")
    except Exception as e:
        print("  RAW RESPONSE does NOT parse as-is:", str(e)[:120])
        print("  head:", t[:200].replace("\n", "\\n"))
        print("  tail:", t[-200:].replace("\n", "\\n"))

# persisted artifacts (everything that's not invocation/output/repair)
SKIP = {'agent_invocation', 'agent_output', 'json_repair_record'}
arts = con.execute(
    "SELECT record_type, content FROM governed_stream WHERE sub_phase_id=? AND is_current_version=1 AND record_type NOT IN ('agent_invocation','agent_output','json_repair_record')",
    (sp,)).fetchall()
print(f"--- persisted artifacts: {len(arts)} ---")
for rt, c in arts:
    try:
        obj = json.loads(c)
    except Exception:
        print(f"  {rt}: <unparseable content>"); continue
    if isinstance(obj, dict):
        keys = list(obj.keys())
        # show count of any list-valued fields (item counts matter for drop detection)
        counts = {k: len(v) for k, v in obj.items() if isinstance(v, list)}
        print(f"  {rt}: keys={keys} list_counts={counts}")
    else:
        print(f"  {rt}: type={type(obj).__name__}")
