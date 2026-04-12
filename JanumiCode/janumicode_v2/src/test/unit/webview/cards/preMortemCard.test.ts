// @vitest-environment happy-dom

/**
 * PreMortemCard — structural tests for the severity-graded risk card.
 */

import { describe, it, expect } from 'vitest';
import PreMortemCard from '../../../../webview/components/PreMortemCard.svelte';
import { mountComponent, makeMirrorPresented, $, $$ } from '../../../helpers/svelteTestHelpers';

describe('PreMortemCard', () => {
  function makePreMortem(risks: Array<Record<string, unknown>> = []) {
    return makeMirrorPresented({
      kind: 'pre_mortem',
      risks: risks.length > 0 ? risks : [
        { id: 'r1', assumption: 'Auth may fail', severity: 'critical', failureScenario: 'Users locked out', status: 'pending' },
        { id: 'r2', assumption: 'Perf may degrade', severity: 'medium', failureScenario: 'Slow response', mitigation: 'Add caching', status: 'pending' },
      ],
    });
  }

  it('renders the header with warning icon', () => {
    const record = makePreMortem();
    const { container, cleanup } = mountComponent(PreMortemCard, { record });
    try {
      expect($(container, '.pm-header')).toBeTruthy();
      expect($(container, '.pm-title')?.textContent).toContain('Pre-Mortem');
    } finally {
      cleanup();
    }
  });

  it('renders risk rows with severity badges', () => {
    const record = makePreMortem();
    const { container, cleanup } = mountComponent(PreMortemCard, { record });
    try {
      const rows = $$(container, '.pm-risk-row');
      expect(rows.length).toBe(2);

      const badges = $$(container, '.severity-badge');
      expect(badges[0].textContent).toBe('CRITICAL');
      expect(badges[0].classList.contains('severity-critical')).toBe(true);
      expect(badges[1].textContent).toBe('MEDIUM');
    } finally {
      cleanup();
    }
  });

  it('shows failure scenario for each risk', () => {
    const record = makePreMortem();
    const { container, cleanup } = mountComponent(PreMortemCard, { record });
    try {
      const failures = $$(container, '.pm-failure');
      expect(failures.length).toBe(2);
      expect(failures[0].textContent).toContain('Users locked out');
    } finally {
      cleanup();
    }
  });

  it('shows mitigation when present', () => {
    const record = makePreMortem();
    const { container, cleanup } = mountComponent(PreMortemCard, { record });
    try {
      const mitigations = $$(container, '.pm-mitigation');
      expect(mitigations.length).toBe(1);
      expect(mitigations[0].textContent).toContain('Add caching');
    } finally {
      cleanup();
    }
  });

  it('renders Accept Risk and Unacceptable buttons per row', () => {
    const record = makePreMortem();
    const { container, cleanup } = mountComponent(PreMortemCard, { record });
    try {
      const actionGroups = $$(container, '.pm-actions');
      expect(actionGroups.length).toBe(2);

      const buttons = $$(container, '.pm-actions .mmp-btn');
      expect(buttons.length).toBe(4); // 2 per row
      expect(buttons[0].textContent).toContain('Accept Risk');
      expect(buttons[1].textContent).toContain('Unacceptable');
    } finally {
      cleanup();
    }
  });
});
