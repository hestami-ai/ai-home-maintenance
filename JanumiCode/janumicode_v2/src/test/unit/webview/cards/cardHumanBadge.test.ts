// @vitest-environment happy-dom

/**
 * Regression test: user-authored records display a "Human" role badge.
 *
 * Matches v1's `role-human` styling. Without this, every card in the
 * stream looks agent-produced and the user can't tell at a glance which
 * records represent their own intent, approvals, or selections.
 */

import { describe, it, expect } from 'vitest';
import Card from '../../../../webview/components/Card.svelte';
import { mountComponent, makeFakeRecord, $ } from '../../../helpers/svelteTestHelpers';
import { recordsStore } from '../../../../webview/stores/records.svelte';

const HUMAN_RECORD_TYPES = [
  'raw_intent_received',
  'open_query_received',
  'mirror_approved',
  'mirror_rejected',
  'mirror_edited',
  'phase_gate_approved',
  'phase_gate_rejected',
  'decision_trace',
  'rollback_authorized',
] as const;

describe('Card — Human role badge', () => {
  it.each(HUMAN_RECORD_TYPES)('renders "Human" badge on %s', (recordType) => {
    recordsStore.clear();
    const record = makeFakeRecord({
      record_type: recordType,
      content: { text: 'user content' },
    });
    recordsStore.add(record);
    const { container, cleanup } = mountComponent(Card, { record });
    try {
      const badge = $(container, '.role-badge.role-human');
      expect(badge?.textContent).toBe('Human');
    } finally {
      cleanup();
      recordsStore.clear();
    }
  });

  it('does NOT render Human badge on agent-produced records', () => {
    recordsStore.clear();
    // artifact_produced is agent-authored — its role badge shows the agent name.
    const record = makeFakeRecord({
      record_type: 'artifact_produced',
      produced_by_agent_role: 'requirements_agent',
      content: { kind: 'functional_requirements' },
    });
    recordsStore.add(record);
    const { container, cleanup } = mountComponent(Card, { record });
    try {
      expect($(container, '.role-badge.role-human')).toBeNull();
      // The generic role badge is still present with the agent's name.
      const generic = $(container, '.role-badge');
      expect(generic?.textContent).toContain('Requirements Agent');
    } finally {
      cleanup();
      recordsStore.clear();
    }
  });
});
