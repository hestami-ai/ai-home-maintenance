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
import { categorizeCoherence } from '../../../review/findingSurfacing';

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
  // PD-7: this list is the COMPONENT's endpoints (component-scoped join), which
  // may exceed the one(s) THIS task implements — the executor was observed picking
  // the wrong contract (e.g. `POST /board-decisions` when the task was
  // `/decisions/{id}/approve`). Frame it as scoped context and hedge on count:
  // when more than one endpoint is present, tell the executor to implement only
  // the one(s) its task + completion criteria call for (mirrors the test-case hedge).
  if (packet.api_definitions.length > 0) {
    lines.push(packet.api_definitions.length > 1
      ? '## Component API Endpoints (context — implement ONLY the one(s) your task + completion criteria require; the rest belong to sibling tasks)'
      : '## API Endpoints You Implement');
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
      if (tc.property_spec) {
        const ps = tc.property_spec;
        lines.push(`PROPERTY TEST (${ps.property_kind}) — implement with the stack's property-based-testing library (fast-check / Hypothesis / proptest / gopter), not a single example:`);
        lines.push(`  Invariant (must hold for ALL inputs): ${ps.invariant}`);
        lines.push(`  Input domain to generate over: ${ps.input_domain}`);
        if (ps.generators && ps.generators.length > 0) lines.push(`  Suggested generators: ${ps.generators.join(', ')}`);
        if (ps.oracle) lines.push(`  Oracle: ${ps.oracle}`);
        if (ps.metamorphic_relation) lines.push(`  Metamorphic relation: ${ps.metamorphic_relation}`);
      }
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
      if (ec.property_spec) {
        const ps = ec.property_spec;
        lines.push(`  PROPERTY (${ps.property_kind}) — verify generatively with the stack's PBT library: assert "${ps.invariant}" for all inputs in {${ps.input_domain}}${ps.oracle ? ` (oracle: ${ps.oracle})` : ''}.`);
      }
    }
    lines.push('');
  }

  // ── Active technical constraints ───────────────────────────────
  // PD-11: an unresolved constraint reference is carried as a placeholder with an
  // EMPTY body (buildActiveConstraints, so the coherence verifier's P7 flags it) —
  // but rendering `- **TECH-BUN** (): ` under "apply without exception" tells the
  // executor to honor a rule with no content (dangling/ungrounded id). Split them:
  // present only RESOLVED constraints as binding; list unresolved ids separately as
  // an upstream gap the executor must NOT invent a rule for.
  if (packet.active_constraints.length > 0) {
    const resolved = packet.active_constraints.filter((c) => typeof c.text === 'string' && c.text.trim().length > 0);
    const unresolved = packet.active_constraints.filter((c) => !(typeof c.text === 'string' && c.text.trim().length > 0));
    if (resolved.length > 0) {
      lines.push('## Technical Constraints (apply without exception)');
      lines.push('');
      for (const c of resolved) {
        const tech = c.technology ? ` [${c.technology}]` : '';
        lines.push(`- **${c.id}**${tech} (${c.category}): ${c.text}`);
        if (c.rationale) lines.push(`  Rationale: ${c.rationale}`);
      }
      lines.push('');
    }
    if (unresolved.length > 0) {
      lines.push('## Unresolved constraint references (upstream gap — do NOT invent a rule for these; flagged for maintainers)');
      lines.push('');
      lines.push(unresolved.map((c) => `\`${c.id}\``).join(', '));
      lines.push('');
    }
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

  // ── Upstream coherence findings (un-suppressed; reverses ts-17).
  // The packet's coherence verifier already scoped these to THIS task. The
  // executor CAN act on several (author a missing test, don't trust an
  // invented id, implement an unmeasurable eval to the spec); the rest are
  // upstream gaps it can't fix but should be aware of. Categorized so the
  // prompt distinguishes "act on these" from "FYI".
  const coherenceCodes = [
    ...packet.coherence.blocking_failures,
    ...packet.coherence.advisory_findings,
  ];
  if (coherenceCodes.length > 0) {
    const { actionable, fyi } = categorizeCoherence(coherenceCodes);
    lines.push('## Upstream Coherence Findings (gaps in THIS task\'s inputs)');
    lines.push('');
    if (actionable.length > 0) {
      lines.push('Act on these:');
      for (const a of actionable) lines.push(`- ${a.line} → ${a.remedy}`);
      lines.push('');
    }
    if (fyi.length > 0) {
      lines.push('FYI (upstream gaps you can\'t directly fix — anticipate, honor the spec):');
      for (const f of fyi) lines.push(`- ${f}`);
      lines.push('');
    }
  }

  // ai_proposed root count — some upstream ids were not user-confirmed; honor
  // spec text when those refs conflict.
  if (packet.coherence.annotations.ai_proposed_root_count > 0) {
    lines.push('## Packet Coherence Notes');
    lines.push('');
    lines.push(`_${packet.coherence.annotations.ai_proposed_root_count} upstream id(s) trace to ai-proposed Phase 1 items. Honor the spec text where it conflicts with these._`);
    lines.push('');
  }

  return lines.join('\n');
}
