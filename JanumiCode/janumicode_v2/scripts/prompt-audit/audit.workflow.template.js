export const meta = {
  name: 'prompt-materialization-audit',
  description: 'Audit P1-8 core-agent materialized prompts for bloat + materialization-fidelity gaps (one full-rubric sub-agent per call)',
  phases: [{ title: 'Audit', detail: 'one sub-agent per core LLM call; reads its call file, applies the A/B/C + D rubric, writes its verdict' }],
}
/*__INJECTED_DATA__*/
// AUDIT_OUT_DIR, RUBRIC_MARKDOWN, ROLE_INTENTS, TARGETS are injected above by gen-workflow.js.
const DIMS = ['D1','D2','D3','D4','D5','A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4']

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug','overall_intent_fulfilment','prompt_economy_score','dimensions_assessed','findings','deterministic_review','one_line'],
  properties: {
    slug: { type: 'string' },
    overall_intent_fulfilment: { type: 'integer', minimum: 1, maximum: 5, description: 'does the PROMPT equip the model to fulfil the role intent: 1 starved/contradictory .. 5 fully equipped' },
    prompt_economy_score: { type: 'integer', minimum: 1, maximum: 5, description: '1 grossly bloated .. 5 lean/appropriately scoped' },
    dimensions_assessed: { type: 'array', items: { type: 'string', enum: DIMS }, description: 'EVERY dimension code you evaluated (proves coverage)' },
    findings: {
      type: 'array',
      description: 'only severity>=low items',
      items: {
        type: 'object', additionalProperties: false,
        required: ['dimension','severity','evidence','suggested_fix'],
        properties: {
          dimension: { type: 'string', enum: DIMS },
          severity: { type: 'string', enum: ['low','med','high'] },
          evidence: { type: 'string', description: 'short verbatim quote + where (<=240 chars)' },
          suggested_fix: { type: 'string' },
          confidence: { type: 'string', enum: ['low','med','high'] },
        },
      },
    },
    deterministic_review: {
      type: 'array',
      description: 'adjudicate each D-flag that fired on this call (from meta.det)',
      items: {
        type: 'object', additionalProperties: false,
        required: ['code','verdict'],
        properties: {
          code: { type: 'string', enum: ['D1','D2','D3','D4','D5'] },
          verdict: { type: 'string', enum: ['confirmed_defect','benign','structural'] },
          note: { type: 'string' },
        },
      },
    },
    notable_strengths: { type: 'array', items: { type: 'string' } },
    one_line: { type: 'string' },
  },
}

function buildPrompt(t) {
  const intent = ROLE_INTENTS[t.sub_phase] || { intent: '(no intent on file for this sub_phase)', required_inputs: [] }
  const callPath = `${AUDIT_OUT_DIR}/calls/${t.id}.json`
  const resultPath = `${AUDIT_OUT_DIR}/results/${t.slug}.json`
  return [
    RUBRIC_MARKDOWN,
    '',
    '## The call under audit',
    `- slug: ${t.slug}`,
    `- phase ${t.phase} · sub_phase ${t.sub_phase} · agent role ${t.role}`,
    `- ROLE INTENT: ${intent.intent}`,
    `- required_inputs (what a correct prompt for this call SHOULD carry): ${(intent.required_inputs || []).join(', ') || '(unspecified)'}`,
    '',
    '## Procedure (do exactly this)',
    `1. Read the call file: ${callPath}`,
    '   Shape: { meta (incl. meta.det = the deterministic D1-D5 results for this call), system, prompt, thinking, response }.',
    '   The prompt/response/thinking may be middle-elided (a "…[N chars elided]…" marker) — judge from what is present; do not penalize the elision itself.',
    '2. Apply the rubric. Inspect meta.det to see which deterministic flags fired and adjudicate EACH fired flag in deterministic_review (confirmed_defect | benign | structural).',
    '3. Raise findings ONLY where you have a verbatim evidence quote and severity>=low. Be conservative; saturation roles legitimately carry single-node ancestor/sibling context.',
    `4. Write the verdict JSON object (exactly matching the required schema, slug="${t.slug}") to: ${resultPath}`,
    '5. Return that same verdict object.',
  ].join('\n')
}

phase('Audit')

const verdicts = await parallel(
  TARGETS.map((t) => () =>
    agent(buildPrompt(t), { label: t.slug, phase: 'Audit', schema: VERDICT_SCHEMA })
      .then((v) => (v ? { ...v, _role: t.role, _sub_phase: t.sub_phase, _phase: t.phase } : null))
      .catch(() => null)
  )
)

// ---- aggregate (small return; full per-call verdicts are on disk in results/) ----
const ok = verdicts.filter(Boolean)
const failed = verdicts.length - ok.length

const byRole = {}
const dimSev = {}
const detConfirmed = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 }
const detBenign = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 }
const highFindings = []

for (const v of ok) {
  byRole[v._role] = (byRole[v._role] || 0) + 1
  for (const f of v.findings || []) {
    dimSev[f.dimension] ||= { low: 0, med: 0, high: 0 }
    dimSev[f.dimension][f.severity] = (dimSev[f.dimension][f.severity] || 0) + 1
    if (f.severity === 'high') highFindings.push({ slug: v.slug, role: v._role, sub_phase: v._sub_phase, dimension: f.dimension, evidence: (f.evidence || '').slice(0, 180), fix: (f.suggested_fix || '').slice(0, 160) })
  }
  for (const d of v.deterministic_review || []) {
    if (d.verdict === 'confirmed_defect') detConfirmed[d.code] = (detConfirmed[d.code] || 0) + 1
    else detBenign[d.code] = (detBenign[d.code] || 0) + 1
  }
}

const dimRank = Object.entries(dimSev)
  .map(([d, s]) => ({ dimension: d, weighted: s.high * 4 + s.med * 2 + s.low, ...s }))
  .sort((a, b) => b.weighted - a.weighted)

log(`audited ${ok.length}/${verdicts.length} (${failed} failed); ${highFindings.length} high-severity findings`)

return {
  audited: ok.length,
  failed,
  by_role: byRole,
  dimension_ranking: dimRank,
  deterministic_confirmed: detConfirmed,
  deterministic_benign: detBenign,
  high_findings_sample: highFindings.slice(0, 30),
  high_findings_total: highFindings.length,
  results_dir: `${AUDIT_OUT_DIR}/results`,
}
