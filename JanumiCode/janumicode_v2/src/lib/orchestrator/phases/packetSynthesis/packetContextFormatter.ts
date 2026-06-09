/**
 * Render an `ImplementationPacketContent` as a markdown context block
 * for the executor agent's stdin. This is the structural ts-16 fix:
 * the executor receives user stories, ACs, component contract, data
 * models, API definitions, test cases, eval criteria, technical
 * constraints, and compliance items — all the upstream context it
 * needs to implement the task without inventing.
 *
 * Pure function: takes a packet, returns a markdown string. No side
 * effects. Unit-testable from any test that constructs a packet by hand.
 *
 * See docs/design/implementation-packet-synthesis.md §6.
 */

import type { ImplementationPacketContent } from '../../../types/records';

export function formatPacketAsExecutorContext(packet: ImplementationPacketContent): string {
  const lines: string[] = [];
  lines.push('# Implementation Packet Context');
  lines.push('');
  lines.push('Your authoritative deliverable is the **Implementation Task** and its **Completion Criteria** (in the GOVERNING CONSTRAINTS section below) — that is exactly what you must build and what you will be judged on.');
  lines.push('');
  lines.push('The sections below are the surrounding **component context**: the user stories, test cases, and evaluation methods for the *whole component* this task belongs to. Your task implements ONE slice of this component, not all of it. Use this context to stay consistent with the component — do NOT attempt to satisfy every story, test, or evaluation listed here in this single task, and do NOT invent ACs, tests, components, APIs, or constraints beyond what is given.');
  lines.push('');

  // ── User Stories ────────────────────────────────────────────────
  if (packet.user_stories.length > 0) {
    lines.push('## Component Context — User Stories');
    lines.push('');
    for (const us of packet.user_stories) {
      lines.push(`### ${us.id} — As a ${us.role || '(no role)'}, I want to ${us.action || '(no action)'}, so that ${us.outcome || '(no outcome)'}.`);
      lines.push(`Priority: ${us.priority || 'medium'}`);
      lines.push('');
      if (us.acceptance_criteria.length > 0) {
        lines.push('**Acceptance criteria for this story (component-level — your task may satisfy only the subset within its scope):**');
        for (const ac of us.acceptance_criteria) {
          lines.push(`- **${ac.id}** — ${ac.description}`);
          if (ac.measurable_condition) {
            lines.push(`  Measurable: ${ac.measurable_condition}`);
          }
        }
        lines.push('');
      }
    }
  }

  // ── NFRs ────────────────────────────────────────────────────────
  if (packet.nfrs.length > 0) {
    lines.push('## Non-Functional Requirements That Apply');
    lines.push('');
    for (const n of packet.nfrs) {
      lines.push(`- **${n.id}** (${n.category}): ${n.description}`);
      if (n.threshold) lines.push(`  Threshold: ${n.threshold}`);
      if (n.measurement_method) lines.push(`  Measurement: ${n.measurement_method}`);
      if (n.measurable_condition) lines.push(`  Measurable: ${n.measurable_condition}`);
    }
    lines.push('');
  }

  // ── Component contract ─────────────────────────────────────────
  if (packet.component.id) {
    lines.push('## Component Contract');
    lines.push('');
    lines.push(`Component: \`${packet.component.id}\` — ${packet.component.name || '(no name)'}`);
    if (packet.component.domain_id) lines.push(`Domain: \`${packet.component.domain_id}\``);
    if (packet.component.responsibilities.length > 0) {
      lines.push('');
      lines.push('Responsibilities:');
      for (const r of packet.component.responsibilities) {
        lines.push(`- ${r.id ? `\`${r.id}\`: ` : ''}${r.description || r.statement || ''}`);
      }
    }
    if (packet.component.dependencies.length > 0) {
      lines.push('');
      lines.push('Component dependencies:');
      for (const d of packet.component.dependencies) {
        lines.push(`- \`${d.component_id}\` (${d.kind})`);
      }
    }
    lines.push('');
  }

  // ── Data models ────────────────────────────────────────────────
  if (packet.data_models.length > 0) {
    lines.push('## Data Models You May Read/Write');
    lines.push('');
    for (const dm of packet.data_models) {
      lines.push(`### ${dm.id} — ${dm.name || '(no name)'}`);
      if (dm.fields.length > 0) {
        lines.push('Fields:');
        for (const f of dm.fields) {
          const c = f.constraints ? ` _(${f.constraints})_` : '';
          lines.push(`- \`${f.name}\`: \`${f.type}\`${c}`);
        }
        lines.push('');
      }
    }
  }

  // ── API endpoints ──────────────────────────────────────────────
  if (packet.api_definitions.length > 0) {
    lines.push('## API Endpoints You Implement');
    lines.push('');
    for (const api of packet.api_definitions) {
      lines.push(`### ${api.id} — \`${api.method} ${api.path}\``);
      if (api.description) lines.push(api.description);
      if (api.request_shape) {
        lines.push('Request shape:');
        lines.push('```json');
        lines.push(JSON.stringify(api.request_shape, null, 2));
        lines.push('```');
      }
      if (api.response_shape) {
        lines.push('Response shape:');
        lines.push('```json');
        lines.push(JSON.stringify(api.response_shape, null, 2));
        lines.push('```');
      }
      if (api.error_codes && api.error_codes.length > 0) {
        lines.push(`Error codes: ${api.error_codes.join(', ')}`);
      }
      lines.push('');
    }
  }

  // ── Test cases ──────────────────────────────────────────────────
  if (packet.test_cases.length > 0) {
    lines.push('## Component Test Cases (context — may belong to sibling tasks; your gate is the Completion Criteria, not these)');
    lines.push('');
    for (const tc of packet.test_cases) {
      const refs = tc.acceptance_criterion_ids.join(', ');
      lines.push(`### ${tc.test_case_id} (${tc.type}) — verifies ${refs}`);
      if (tc.preconditions.length > 0) {
        lines.push('Preconditions:');
        for (const p of tc.preconditions) lines.push(`- ${p}`);
      }
      lines.push(`Expected outcome: ${tc.expected_outcome}`);
      lines.push('');
    }
  }

  // ── Evaluation criteria ────────────────────────────────────────
  if (packet.evaluation_criteria.length > 0) {
    lines.push('## How This Component Is Evaluated (context — these are component/system-level methods, not your task\'s unit of work)');
    lines.push('');
    for (const ec of packet.evaluation_criteria) {
      lines.push(`- Target \`${ec.target_id}\` (${ec.kind})`);
      lines.push(`  Method: ${ec.evaluation_method}`);
      lines.push(`  Success: ${ec.success_condition}`);
    }
    lines.push('');
  }

  // ── Active technical constraints ───────────────────────────────
  if (packet.active_constraints.length > 0) {
    lines.push('## Technical Constraints (apply without exception)');
    lines.push('');
    for (const c of packet.active_constraints) {
      const tech = c.technology ? ` [${c.technology}]` : '';
      lines.push(`- **${c.id}**${tech} (${c.category}): ${c.text}`);
      if (c.rationale) lines.push(`  Rationale: ${c.rationale}`);
    }
    lines.push('');
  }

  // ── Compliance / V&V / Quality items ──────────────────────────
  if (packet.compliance_items.length > 0) {
    lines.push('## Compliance / V&V / Quality Items That Apply');
    lines.push('');
    for (const c of packet.compliance_items) {
      lines.push(`- **${c.id}** (${c.kind}): ${c.description}`);
      if (c.measurable_condition) lines.push(`  Measurable: ${c.measurable_condition}`);
    }
    lines.push('');
  }

  // ── Coherence summary (executor-actionable only)
  // Advisory findings (A1_TASK_OUTSIDE_COMPONENT_BOUNDARY etc.) are
  // verifier signals for telemetry, not directions the executor can act
  // on. They remain on the packet record itself for downstream audit;
  // we suppress them from the executor stdin to keep the prompt tight.
  // Issue #7 from the ts-17 prompt review.
  //
  // ai_proposed root count IS actionable — it tells the executor that
  // some upstream ids were not user-confirmed, and to honor spec text
  // when those refs conflict. Keep that note.
  if (packet.coherence.annotations.ai_proposed_root_count > 0) {
    lines.push('## Packet Coherence Notes');
    lines.push('');
    lines.push(`_${packet.coherence.annotations.ai_proposed_root_count} upstream id(s) trace to ai-proposed Phase 1 items. Honor the spec text where it conflicts with these._`);
    lines.push('');
  }

  return lines.join('\n');
}
