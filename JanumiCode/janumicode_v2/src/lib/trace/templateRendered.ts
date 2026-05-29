/**
 * Helper that emits an AODD `prompt.template_rendered` event capturing
 * the per-variable substitution table from a template render.
 *
 * This is the seam that closes the "the final string is captured but
 * we can't see where the bytes came from" gap. With the rendered
 * provenance attached as metadata, walk-back can answer "why is the
 * {{active_constraints}} block empty?" — the variable was present in
 * the substitution but its value was empty (caller-side bug, not
 * template-side).
 *
 * Previously this helper also wrote a `template_rendered` row to
 * `transforms.jsonl`; that legacy stream has been retired (see
 * docs/design/aodd-parity-matrix.md). The AODD event below is now the
 * sole source.
 */

import type { PromptTemplate } from '../orchestrator/templateLoader';
import { emit as aoddEmit } from '../aodd';

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

  const templateKey = getTemplateKey(template);
  // template_source_sha is not yet captured here; design memo §12 open
  // question 7 (prompt-template provenance) lands in a later phase.
  aoddEmit(
    'prompt.template_rendered',
    {
      template_key: templateKey,
      template_source_sha: 'unknown',
    },
    {
      metadata: {
        variable_count: Object.keys(variables).length,
        empty_variable_count: emptyVarCount,
        missing_variable_count: missing.length,
        total_variable_bytes: totalVarChars,
        rendered_size: rendered.length,
        body_size: template.body.length,
        provenance,
        missing_variables: missing,
      },
    },
  );
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
