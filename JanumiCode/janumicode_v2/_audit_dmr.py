#!/usr/bin/env python3
"""DMR (Deep Memory Research) fidelity audit for one sub-phase (ts-120).

Usage: python _audit_dmr.py <db> <sub_phase_id>

Audits the chain: retrieval_brief -> query_decomposition -> Stage-7 LLM
call -> context_packet -> the active_constraints/detail injected into the
consuming agent's prompt. Temp throwaway (gitignored).
"""
import sqlite3, sys, json

sys.stdout.reconfigure(encoding="utf-8")
con = sqlite3.connect(sys.argv[1]); sp = sys.argv[2]

def one(rt):
    r = con.execute("SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type=? AND is_current_version=1 ORDER BY produced_at LIMIT 1", (sp, rt)).fetchone()
    return json.loads(r[0]) if r else None

print(f"===== DMR audit: {sp} =====")

# 1. retrieval_brief (INPUT)
brief = one('retrieval_brief_record')
if brief:
    print("\n[1] RETRIEVAL BRIEF (input):")
    print("  requesting_agent_role:", brief.get('requesting_agent_role'))
    print("  scope_tier:", brief.get('scope_tier'))
    print("  query (len %d):" % len(brief.get('query','')), repr(brief.get('query','')[:200]))
    print("  known_relevant_record_ids:", len(brief.get('known_relevant_record_ids') or []))

# 2. query_decomposition (STAGE 1)
qd = one('query_decomposition_record')
if qd:
    print("\n[2] QUERY DECOMPOSITION (Stage 1):")
    print("  topic_entities:", qd.get('topic_entities'))
    print("  decision_types_sought:", qd.get('decision_types_sought'))
    print("  authority_levels_included:", qd.get('authority_levels_included'))
    print("  sources_in_scope:", qd.get('sources_in_scope'))
    print("  known_conflict_zones:", qd.get('known_conflict_zones'))

# 3. dmr_pipeline (stage journal — kinds)
pipe = one('dmr_pipeline')
if pipe:
    print("\n[3] PIPELINE stages (status/kind):")
    for s in pipe.get('stages', []):
        print(f"    {s.get('stage')} {s.get('name'):28} kind={s.get('kind'):13} status={s.get('status')} :: {s.get('output_summary','')}")
    print("  completeness_status:", pipe.get('completeness_status'))

# 4. Stage-7 LLM call
inv = con.execute("SELECT content FROM governed_stream WHERE sub_phase_id=? AND record_type='agent_invocation' AND is_current_version=1", (sp,)).fetchall()
s7 = None
for (c,) in inv:
    d = json.loads(c)
    if 'Stage 7' in (d.get('label') or '') or 'Context Packet' in (d.get('label') or ''):
        s7 = d
print("\n[4] STAGE-7 SYNTHESIS LLM:", "present" if s7 else "ABSENT (deterministic fallback only)")
if s7:
    print("  label:", s7.get('label'), "| model:", s7.get('model'), "| status:", s7.get('status'))

# 5. context_packet (OUTPUT / findings)
cp = one('context_packet')
if cp:
    print("\n[5] CONTEXT PACKET (output):")
    print("  completeness_status:", cp.get('completeness_status'))
    mf = cp.get('material_findings', [])
    ac = cp.get('active_constraints', [])
    print(f"  material_findings: {len(mf)}")
    print(f"  active_constraints: {len(ac)}")
    cov = cp.get('coverage_assessment', {})
    print("  coverage confidence:", cov.get('confidence'), "| known_gaps:", cov.get('known_gaps'))
    dcs = cp.get('decision_context_summary', '')
    print("  decision_context_summary (len %d):" % len(dcs), repr(dcs[:260]))
    # citation check: do active_constraints cite source records?
    uncited = [c.get('id') for c in ac if not (c.get('source_record_ids'))]
    print("  active_constraints missing source_record_ids:", len(uncited))
    # authority floor check (spec: only auth>=6)
    below6 = [c.get('authority_level') for c in ac if (c.get('authority_level') or 0) < 6]
    print("  active_constraints below authority 6:", below6)
    # sample findings
    print("  top findings:", [(f.get('record_type'), round(f.get('materiality_score',0),2), (f.get('authority_level'))) for f in mf[:6]])
