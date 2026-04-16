/**
 * Layer B test helpers — mount Svelte 5 components in happy-dom and assert
 * on rendered DOM. Used by `src/test/unit/webview/cards/*.test.ts`.
 *
 * Each test file that imports from this helper MUST include
 * `// @vitest-environment happy-dom` at the top, otherwise the imports
 * for `mount` and `unmount` from `svelte` will fail to find a window.
 *
 * Each helper test should call:
 *
 *   const { container, cleanup } = mountComponent(MyCard, { record: fakeR });
 *   expect(container.querySelector('.foo')).toBeTruthy();
 *   cleanup();
 *
 * Always call cleanup() in a try/finally so happy-dom doesn't leak DOM
 * nodes across tests.
 */

import { mount, unmount, type Component } from 'svelte';
import type { SerializedRecord } from '../../lib/events/eventBus';
import type { AuthorityLevel, AgentRole, RecordType } from '../../lib/types/records';

export interface MountedComponent {
  container: HTMLElement;
  /** Reference to the mounted component instance, if you need it. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  cleanup(): void;
}

export function mountComponent<P extends Record<string, unknown>>(
  Component: Component<P>,
  props: P,
): MountedComponent {
  const container = document.createElement('div');
  document.body.appendChild(container);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = mount(Component as any, { target: container, props });
  return {
    container,
    instance,
    cleanup() {
      try { unmount(instance); } catch { /* component may already be unmounted */ }
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}

// ── Fake record builders ──────────────────────────────────────────────

const ISO_2026_04_11_T_1430 = '2026-04-11T14:30:00.000Z';

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeFakeRecord(overrides: Partial<SerializedRecord> = {}): SerializedRecord {
  return {
    id: overrides.id ?? nextId('rec'),
    record_type: (overrides.record_type ?? 'artifact_produced') as RecordType,
    phase_id: overrides.phase_id ?? '1',
    sub_phase_id: overrides.sub_phase_id ?? null,
    produced_by_agent_role: (overrides.produced_by_agent_role ?? null) as AgentRole | null,
    produced_at: overrides.produced_at ?? ISO_2026_04_11_T_1430,
    authority_level: (overrides.authority_level ?? 2) as AuthorityLevel,
    quarantined: overrides.quarantined ?? false,
    derived_from_record_ids: overrides.derived_from_record_ids ?? [],
    content: overrides.content ?? {},
  };
}

export function makeAgentInvocation(opts: {
  id?: string;
  provider?: string;
  model?: string;
  status?: 'running' | 'success' | 'error';
  label?: string;
  phaseId?: string;
  subPhaseId?: string;
} = {}): SerializedRecord {
  return makeFakeRecord({
    id: opts.id ?? nextId('inv'),
    record_type: 'agent_invocation',
    phase_id: opts.phaseId ?? '1',
    sub_phase_id: opts.subPhaseId ?? '1.0',
    produced_by_agent_role: 'orchestrator',
    content: {
      provider: opts.provider ?? 'ollama',
      model: opts.model ?? 'qwen3.5:9b',
      status: opts.status ?? 'running',
      label: opts.label ?? 'Intent Quality Check',
      started_at: ISO_2026_04_11_T_1430,
    },
  });
}

export function makeAgentOutput(opts: {
  parentInvocationId: string;
  text?: string;
  status?: 'success' | 'error';
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}): SerializedRecord {
  return makeFakeRecord({
    record_type: 'agent_output',
    derived_from_record_ids: [opts.parentInvocationId],
    content: {
      text: opts.text ?? 'Quality check passed.',
      status: opts.status ?? 'success',
      duration_ms: opts.durationMs ?? 1200,
      input_tokens: opts.inputTokens ?? 250,
      output_tokens: opts.outputTokens ?? 80,
      ...(opts.errorMessage ? { error_message: opts.errorMessage } : {}),
    },
  });
}

export function makeToolCall(opts: {
  parentInvocationId: string;
  toolName?: string;
  params?: Record<string, unknown>;
}): SerializedRecord {
  return makeFakeRecord({
    record_type: 'tool_call',
    derived_from_record_ids: [opts.parentInvocationId],
    content: {
      tool_name: opts.toolName ?? 'bash',
      parameters: opts.params ?? { command: 'ls -la' },
    },
  });
}

export function makeMirrorPresented(opts: {
  kind?: 'assumption_mirror' | 'intent_bloom_mirror' | 'pre_mortem' | 'intent_statement_mirror';
  artifactId?: string;
  artifactType?: string;
  fields?: Array<Record<string, unknown>>;
  assumptions?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
  steelMan?: string;
} = {}): SerializedRecord {
  return makeFakeRecord({
    record_type: 'mirror_presented',
    sub_phase_id: '1.3',
    content: {
      kind: opts.kind ?? 'assumption_mirror',
      mirror_id: 'mirror-001',
      artifact_id: opts.artifactId ?? 'art-001',
      artifact_type: opts.artifactType ?? 'intent_bloom',
      fields: opts.fields,
      assumptions: opts.assumptions,
      risks: opts.risks,
      steelMan: opts.steelMan,
    },
  });
}

export function makePhaseGateEvaluation(opts: {
  phaseId?: string;
  hasUnresolvedWarnings?: boolean;
  hasUnapprovedProposals?: boolean;
  hasHighSeverityFlaws?: boolean;
} = {}): SerializedRecord {
  return makeFakeRecord({
    record_type: 'phase_gate_evaluation',
    phase_id: opts.phaseId ?? '1',
    content: {
      kind: 'phase_gate',
      phase_id: opts.phaseId ?? '1',
      has_unresolved_warnings: opts.hasUnresolvedWarnings ?? false,
      has_unapproved_proposals: opts.hasUnapprovedProposals ?? false,
      has_high_severity_flaws: opts.hasHighSeverityFlaws ?? false,
    },
  });
}

// ── Query helpers ──────────────────────────────────────────────────

/** Query selectors with TypeScript narrowing for the common HTMLElement case. */
export function $(container: HTMLElement, selector: string): HTMLElement | null {
  return container.querySelector(selector) as HTMLElement | null;
}

export function $$(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

/** Click an element and wait one microtask for Svelte's reactivity to settle. */
export async function click(el: HTMLElement | null): Promise<void> {
  if (!el) throw new Error('Cannot click null element');
  el.click();
  await new Promise((r) => setTimeout(r, 0));
}

/**
 * Wait one microtask for Svelte's reactivity to flush. Use after mutating
 * a $state value or after firing an event listener.
 */
export async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}
