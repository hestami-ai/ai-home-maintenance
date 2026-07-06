export const meta = {
  name: 'p9-prompt-audit',
  description: 'Audit Phase-9 executor (9.1 leaf-codegen) prompts for materialization defects — extends the P1-8 prompt-materialization audit to the Execution phase.',
  phases: [
    { title: 'Audit', detail: 'one agent per distinct-task executor prompt, D1-D5/A/B/C rubric' },
    { title: 'Synthesize', detail: 'cluster findings into ranked P9 defect classes' },
  ],
};

const DIR = 'e:/Projects/hestami-ai/JanumiCode/janumicode_v2/scripts/prompt-audit';
const CALLS = `${DIR}/audit-out/p9/calls`;

const INTENT =
  'Phase 9.1 `executor_agent` — implement ONE atomic implementation task (a single SLICE of a component): ' +
  'write code satisfying THIS task’s Completion Criteria within its declared write-scope paths. ' +
  'The surrounding component context (ALL the component’s data models, user stories, test cases, evaluation methods) ' +
  'is provided ONLY so the slice stays consistent with the whole; the task must NOT implement the whole component. ' +
  'The bindings the prompt SHOULD carry, scoped to THIS task: the task + its completion criteria (the authoritative deliverable), ' +
  'the task’s OWN data-model + AC subset, the component contract/responsibilities, the write-scope + layout contract, and the active TECH-* constraints/tech-stack.';

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'prompt_chars', 'dimensions_assessed', 'findings', 'overall'],
  properties: {
    slug: { type: 'string' },
    prompt_chars: { type: 'number' },
    dimensions_assessed: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'severity', 'evidence', 'suggested_fix'],
        properties: {
          dimension: { type: 'string', description: 'code e.g. A1, D5, B1' },
          severity: { type: 'string', enum: ['low', 'med', 'high'] },
          evidence: { type: 'string', description: 'short verbatim quote from the prompt (<=240 chars)' },
          location: { type: 'string', description: 'prompt section/header where it occurs' },
          suggested_fix: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    overall: { type: 'string', description: 'one-line prompt-economy + materialization-fidelity summary' },
  },
};

let slugs = args;
if (typeof slugs === 'string') { try { slugs = JSON.parse(slugs); } catch { slugs = slugs.split(',').map((s) => s.trim()).filter(Boolean); } }
if (!Array.isArray(slugs)) slugs = [];
if (slugs.length === 0) { log('no slugs passed via args'); return { results: [] }; }
log(`P9 audit: ${slugs.length} executor prompts`);

phase('Audit');
const results = await parallel(slugs.map((slug) => async () => {
  const p = await agent(
    `You are auditing ONE materialized Phase-9 executor prompt from the JanumiCode v2 pipeline. ` +
    `First Read the audit rubric at ${DIR}/dimensions.json (use its rubric_markdown — the D1-D5/A1-A5/B1-B5/C1-C4 dimensions apply to P9 as well as P1-8). ` +
    `Then Read the call file ${CALLS}/${slug}.json — fields: prompt (the full materialized prompt actually sent to the executor), response (the model output; may be empty if the executor was wedged/queued — audit the PROMPT regardless), det (pre-computed deterministic flags: prompt_chars, injected_ids, unused_id_ratio, empty_sentinels, section_headers).\n\n` +
    `The agent role INTENT: ${INTENT}\n\n` +
    `Assess the PROMPT along every dimension. Focus especially on P9-relevant economy: A1 over-scoped (whole-component data models/stories/tests injected for a single-task slice), A4 dead context, D5 catalog over-injection (note: the executor USES models via code without citing their ids, so a high unused_id_ratio is a hint, not proof — judge whether the injected block was NEEDED for THIS task), D1 size; and fidelity: B1 missing binding (is the active TECH stack / layout contract / the task's OWN scoped AC+DM subset present?), B3 wrong-scope, B5 intent-prompt mismatch. Raise a finding only with a short verbatim quote. Return the structured verdict with slug='${slug}'.`,
    { schema: VERDICT, label: `audit:${slug}`, phase: 'Audit', effort: 'high' },
  );
  return p;
}));

const clean = results.filter(Boolean);
const allFindings = clean.flatMap((r) => (r.findings || []).map((f) => ({ ...f, slug: r.slug })));
const high = allFindings.filter((f) => f.severity === 'high');
const byDim = {};
for (const f of allFindings) (byDim[f.dimension] ||= []).push(f);

phase('Synthesize');
const synth = await agent(
  `You are synthesizing a Phase-9 prompt-materialization audit. Below are the per-prompt findings (JSON) from ${clean.length} distinct executor-task prompts. ` +
  `Cluster them into a ranked list of P9 DEFECT CLASSES (root-cause groups, like the P1-8 audit's PA-* items). For each class: a short title, the dimension(s), how many prompts exhibit it, severity, the concrete fix (prompt/producer change), and 1-2 evidence quotes. Rank by (severity x prevalence). Also give an overall verdict on whether the P9 executor prompt is economical + well-scoped, and the single highest-leverage fix.\n\n` +
  `FINDINGS:\n${JSON.stringify(allFindings, null, 1).slice(0, 60000)}\n\nDIMENSION TALLY: ${JSON.stringify(Object.fromEntries(Object.entries(byDim).map(([k, v]) => [k, v.length])))}`,
  { label: 'synthesize:p9', phase: 'Synthesize', effort: 'high' },
);

return {
  audited: clean.length,
  total_findings: allFindings.length,
  high_severity: high.length,
  dimension_tally: Object.fromEntries(Object.entries(byDim).map(([k, v]) => [k, v.length])),
  per_prompt: clean.map((r) => ({ slug: r.slug, prompt_chars: r.prompt_chars, n_findings: (r.findings || []).length, overall: r.overall })),
  synthesis: synth,
};
