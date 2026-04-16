// @vitest-environment happy-dom

/**
 * Regression tests for AgentInvocationCard visibility improvements.
 *
 * Pins the v1-parity behaviors: visible prompt, CLI command line, live
 * streamed output (stdout/stderr/response/thinking), and animated CSS
 * spinner. Without these, users have no way to see what the agent is
 * doing at any given moment.
 */

import { describe, it, expect } from 'vitest';
import AgentInvocationCard from '../../../../webview/components/AgentInvocationCard.svelte';
import {
  mountComponent,
  makeAgentInvocation,
  makeFakeRecord,
  $,
  $$,
} from '../../../helpers/svelteTestHelpers';
import { recordsStore, type SerializedRecord } from '../../../../webview/stores/records.svelte';
import { streamingStore } from '../../../../webview/stores/streaming.svelte';

function resetStore(): void {
  recordsStore.clear();
  streamingStore.reset();
}

function seed(records: SerializedRecord[]): void {
  recordsStore.clear();
  streamingStore.reset();
  for (const r of records) recordsStore.add(r);
}

function makeInvocation(overrides: Record<string, unknown>): SerializedRecord {
  const base = makeAgentInvocation({ status: 'running' });
  return {
    ...base,
    content: { ...base.content, ...overrides },
  };
}

/**
 * Streaming chunks no longer flow through governed_stream rows — they
 * land in the transient streamingStore via postMessage events. Tests
 * seed the store directly to exercise the live-render path.
 */
function streamChunk(invocationId: string, channel: 'response' | 'thinking' | 'stdout' | 'stderr', text: string): void {
  streamingStore.append(invocationId, channel, text);
}

describe('AgentInvocationCard — prompt + CLI visibility', () => {
  it('renders the prompt in a PROMPT section for LLM invocations', () => {
    resetStore();
    const record = makeInvocation({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: 'Classify this intent.',
      system: null,
    });
    seed([record]);
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const labels = $$(container, '.inv-section-label').map(el => el.textContent?.trim());
      expect(labels).toContain('PROMPT');
      const prompt = $(container, '.inv-code.inv-input');
      expect(prompt?.textContent).toContain('Classify this intent.');
    } finally {
      cleanup();
      resetStore();
    }
  });

  it('labels the prompt as STDIN and shows the command line for CLI invocations', () => {
    resetStore();
    const record = makeInvocation({
      provider: 'gemini_cli',
      model: 'gemini_cli',
      prompt: 'review the spec file',
      command_line: 'gemini --prompt "review the spec file" --format json',
      cwd: '/ws',
    });
    seed([record]);
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const labels = $$(container, '.inv-section-label').map(el => el.textContent?.trim());
      expect(labels).toContain('STDIN');
      expect(labels).toContain('CMD');
      const cmd = $$(container, '.inv-code').find(el => el.textContent?.includes('gemini --prompt'));
      expect(cmd).toBeTruthy();
      const cwd = $(container, '.inv-cwd');
      expect(cwd?.textContent).toContain('/ws');
      // Type badge flips to CLI when a command_line is present.
      expect($(container, '.inv-type-badge')?.textContent).toBe('CLI');
    } finally {
      cleanup();
      resetStore();
    }
  });

  it('renders the SYSTEM section only when a system prompt is present', () => {
    resetStore();
    const withSystem = makeInvocation({ prompt: 'p', system: 'You are helpful.' });
    const withoutSystem = makeInvocation({ prompt: 'p', system: null });

    const a = mountComponent(AgentInvocationCard, { record: withSystem });
    try {
      const labels = $$(a.container, '.inv-section-label').map(el => el.textContent?.trim());
      expect(labels).toContain('SYSTEM');
    } finally { a.cleanup(); }

    const b = mountComponent(AgentInvocationCard, { record: withoutSystem });
    try {
      const labels = $$(b.container, '.inv-section-label').map(el => el.textContent?.trim());
      expect(labels).not.toContain('SYSTEM');
    } finally { b.cleanup(); resetStore(); }
  });
});

describe('AgentInvocationCard — live streaming chunks', () => {
  it('renders streamed response text in order', () => {
    resetStore();
    const record = makeInvocation({ prompt: 'greet' });
    seed([record]);
    streamChunk(record.id, 'response', 'Hello');
    streamChunk(record.id, 'response', ', ');
    streamChunk(record.id, 'response', 'world');
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const stream = $(container, '.inv-stream:not(.inv-stderr)');
      expect(stream?.textContent).toBe('Hello, world');
    } finally {
      cleanup();
      resetStore();
    }
  });

  it('renders stdout and stderr chunks as separate sections for CLI invocations', () => {
    resetStore();
    const record = makeInvocation({
      provider: 'gemini_cli',
      prompt: 'do a thing',
      command_line: 'gemini --prompt "do a thing"',
    });
    seed([record]);
    streamChunk(record.id, 'stdout', 'line-1\n');
    streamChunk(record.id, 'stdout', 'line-2\n');
    streamChunk(record.id, 'stderr', 'warn: low memory\n');
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const labels = $$(container, '.inv-section-label').map(el => el.textContent?.trim());
      expect(labels).toContain('STDOUT');
      expect(labels).toContain('STDERR');
      const stderr = $(container, '.inv-stream.inv-stderr');
      expect(stderr?.textContent).toContain('warn: low memory');
    } finally {
      cleanup();
      resetStore();
    }
  });

  it('hides the live-stream section once the final agent_output has landed', () => {
    // The final agent_output is authoritative. Transient chunks remain in
    // the streamingStore but the card stops rendering the live response
    // once the canonical text is in the RESPONSE section.
    resetStore();
    const record = makeInvocation({ prompt: 'p', status: 'success' });
    const output = makeFakeRecord({
      record_type: 'agent_output',
      derived_from_record_ids: [record.id],
      content: {
        text: 'Final response.',
        status: 'success',
        duration_ms: 100,
      },
    });
    seed([record, output]);
    streamChunk(record.id, 'response', 'Final ');
    streamChunk(record.id, 'response', 'response.');
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      // The RESPONSE section is present…
      const response = $$(container, '.output-text');
      expect(response.length).toBeGreaterThan(0);
      // …and the live .inv-stream stops being rendered for the response
      // channel once agent_output exists.
      expect($(container, '.inv-stream')).toBeNull();
    } finally {
      cleanup();
      resetStore();
    }
  });
});

describe('AgentInvocationCard — collapsibility defaults', () => {
  it('renders PROMPT, SYSTEM, and THINKING as collapsed <details> with a +/- toggle', () => {
    resetStore();
    const record = makeInvocation({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: 'Classify this intent.',
      system: 'You are an analyst.',
    });
    seed([record]);
    streamChunk(record.id, 'thinking', 'Considering options…');
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const sections = $$(container, 'details.inv-collapsible');
      // PROMPT, SYSTEM, THINKING — all should be <details> blocks. The
      // RESPONSE block only appears once agent_output lands, so don't
      // expect it here.
      const labels = sections
        .map(d => $(d, '.inv-section-label')?.textContent?.trim())
        .filter(Boolean);
      expect(labels).toContain('PROMPT');
      expect(labels).toContain('SYSTEM');
      expect(labels).toContain('THINKING');
      // None should be open by default — the regression we're guarding
      // against is the old behavior that auto-opened PROMPT while running
      // (and rendered THINKING as a non-collapsible div).
      for (const d of sections) {
        expect((d as HTMLDetailsElement).open).toBe(false);
        // Each summary must carry a +/- toggle icon, otherwise the user
        // can't see it's collapsible at a glance.
        const icon = $(d, 'summary .inv-toggle-icon');
        expect(icon).toBeTruthy();
      }
    } finally {
      cleanup();
      resetStore();
    }
  });

  it('marks <pre> code blocks as user-selectable so Ctrl-C works in the webview', () => {
    // The webview disables text selection on most chrome to make it feel
    // like a tool panel, but the prompt/thinking/output blocks are the
    // one place users genuinely need to copy from. This pins the
    // selectable rule on .inv-code so a future global "select: none"
    // sweep can't silently re-break it.
    resetStore();
    const record = makeInvocation({ prompt: 'p' });
    seed([record]);
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      // The <pre> lives inside a closed <details>, so reach into it
      // directly via querySelector and check the computed style.
      const pre = container.querySelector('.inv-code');
      expect(pre).toBeTruthy();
      if (!pre) return;
      const style = globalThis.getComputedStyle(pre);
      const userSelect = style.getPropertyValue('user-select')
        || style.getPropertyValue('-webkit-user-select');
      // happy-dom's CSS support is partial — the property may come back
      // as 'text' or as an empty string when the engine doesn't track
      // the rule. Accept either, but never 'none'.
      expect(userSelect).not.toBe('none');
    } finally {
      cleanup();
      resetStore();
    }
  });
});

describe('AgentInvocationCard — animated CSS spinner', () => {
  it('renders .inv-spinner while running (not the old ⏳ emoji)', () => {
    const record = makeAgentInvocation({ status: 'running' });
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      expect($(container, '.inv-spinner')).toBeTruthy();
      // No emoji fallback — if the spinner silently disappeared we'd be
      // back to the old "idle-looking running card" UX bug.
      expect($(container, '.inv-status')?.textContent).not.toContain('⏳');
    } finally {
      cleanup();
    }
  });

  it('renders ✓ when success and ✗ when error', () => {
    const success = mountComponent(AgentInvocationCard, { record: makeAgentInvocation({ status: 'success' }) });
    try {
      expect($(success.container, '.inv-check')).toBeTruthy();
      expect($(success.container, '.inv-spinner')).toBeNull();
    } finally { success.cleanup(); }

    const error = mountComponent(AgentInvocationCard, { record: makeAgentInvocation({ status: 'error' }) });
    try {
      expect($(error.container, '.inv-fail')).toBeTruthy();
      expect($(error.container, '.inv-spinner')).toBeNull();
    } finally { error.cleanup(); }
  });
});
