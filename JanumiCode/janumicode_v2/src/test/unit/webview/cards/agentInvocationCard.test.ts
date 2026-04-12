// @vitest-environment happy-dom

/**
 * AgentInvocationCard — structural + interaction tests.
 */

import { describe, it, expect } from 'vitest';
import AgentInvocationCard from '../../../../webview/components/AgentInvocationCard.svelte';
import { mountComponent, makeAgentInvocation, $, $$ } from '../../../helpers/svelteTestHelpers';

describe('AgentInvocationCard', () => {
  it('renders header with label, type badge, and status icon', () => {
    const record = makeAgentInvocation({ label: 'Phase 1.0 — Quality Check', status: 'running' });
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      expect($(container, '.inv-header')).toBeTruthy();
      expect($(container, '.inv-label')?.textContent).toContain('Quality Check');
      expect($(container, '.inv-type-badge')?.textContent).toBe('API');
      expect($(container, '.inv-status')?.textContent).toContain('⏳');
    } finally {
      cleanup();
    }
  });

  it('defaults to expanded (not collapsed)', () => {
    const record = makeAgentInvocation();
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      expect($(container, '.inv-body')).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('shows model info in the body', () => {
    const record = makeAgentInvocation({ model: 'qwen3.5:9b', provider: 'ollama' });
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      expect($(container, '.inv-model')?.textContent).toContain('qwen3.5:9b');
      expect($(container, '.inv-provider')?.textContent).toContain('ollama');
    } finally {
      cleanup();
    }
  });

  it('shows timestamp with title attribute for ISO tooltip', () => {
    const record = makeAgentInvocation();
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const time = $(container, '.inv-time');
      expect(time).toBeTruthy();
      expect(time?.getAttribute('title')).toBe(record.produced_at);
    } finally {
      cleanup();
    }
  });

  it('does not show retry button when status is running', () => {
    const record = makeAgentInvocation({ status: 'running' });
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      expect($(container, '.retry-btn')).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('has data-record-id and data-phase-id attributes', () => {
    const record = makeAgentInvocation({ phaseId: '1' });
    const { container, cleanup } = mountComponent(AgentInvocationCard, { record });
    try {
      const card = $(container, '.invocation-card');
      expect(card?.getAttribute('data-record-id')).toBe(record.id);
      expect(card?.getAttribute('data-phase-id')).toBe('1');
    } finally {
      cleanup();
    }
  });
});
