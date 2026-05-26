/**
 * Helper that emits a `template_rendered` transformation step capturing
 * the per-variable substitution table from a template render.
 *
 * This is the seam that closes the "prompt_materialized only stores the
 * final string, not where its bytes came from" gap. With this step in
 * place, walk-back can answer "why is the {{active_constraints}} block
 * empty?" by reading the variables map: the variable was present in
 * the substitution but its value was an empty string (caller-side bug,
 * not template-side).
 *
 * Payload format on disk (off-DB):
 *   {
 *     template_key,
 *     template_metadata: { required_variables, ... },
 *     variables: {
 *       active_constraints: { value, size_chars, lines, empty: false },
 *       prior_records:      { value, size_chars, lines, empty: false },
 *       intent_summary:     { value: "",  size_chars: 0, lines: 0, empty: true }, // ← obvious drop
 *       ...
 *     },
 *     missing_variables: ['ud_required_variable'],
 *     rendered_size: 24831,
 *     body_size: 3245
 *   }
 *
 * The variable values are captured verbatim — they're typically already
 * stringified by the caller, and the whole point is to inspect exactly
 * what went into the final prompt.
 */

import type { PromptTemplate } from '../orchestrator/templateLoader';
import { emitTransformationStep } from './emit';

interface VariableProvenance {
  value: string;
  size_chars: number;
  lines: number;
  empty: boolean;
}

export function emitTemplateRendered(
  template: PromptTemplate,
  variables: Record<string, string>,
  rendered: string,
  missing: string[],
): void {
  const provenance: Record<string, VariableProvenance> = {};
  let totalVarChars = 0;
  let emptyVarCount = 0;

  for (const [key, value] of Object.entries(variables)) {
    const v = String(value);
    const size_chars = v.length;
    const empty = size_chars === 0;
    if (empty) emptyVarCount++;
    totalVarChars += size_chars;
    provenance[key] = {
      value: v,
      size_chars,
      lines: v === '' ? 0 : v.split('\n').length,
      empty,
    };
  }

  emitTransformationStep({
    step_type: 'template_rendered',
    payload: {
      template_key: getTemplateKey(template),
      template_metadata: template.metadata,
      variables: provenance,
      missing_variables: missing,
      rendered_size: rendered.length,
      body_size: template.body.length,
      // The fully rendered text is intentionally NOT included here —
      // it's already captured by the downstream prompt_materialized
      // step inside LLMCaller.call(). Avoiding the duplicate keeps
      // per-call disk footprint smaller. To get the final prompt,
      // open the prompt_materialized payload sibling file.
    },
    metadata: {
      template_key: getTemplateKey(template),
      variable_count: Object.keys(variables).length,
      empty_variable_count: emptyVarCount,
      missing_variable_count: missing.length,
      total_variable_bytes: totalVarChars,
      rendered_size: rendered.length,
    },
  });
}

function getTemplateKey(t: PromptTemplate): string {
  // PromptTemplate stores its identifier through metadata; fall back
  // to a coarse description if metadata doesn't have a single canonical
  // key field. The exact field name depends on how templateLoader
  // shapes metadata — robust to either case.
  const meta = t.metadata as unknown as Record<string, unknown>;
  if (typeof meta.template_key === 'string') return meta.template_key;
  if (typeof meta.sub_phase_id === 'string' && typeof meta.agent_role === 'string') {
    return `${meta.agent_role}/${meta.sub_phase_id}`;
  }
  return '(unknown)';
}
