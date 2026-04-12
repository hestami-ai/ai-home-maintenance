// @vitest-environment happy-dom

/**
 * MenuCard — structural tests for the v1-style option-card layout.
 */

import { describe, it, expect } from 'vitest';
import MenuCard from '../../../../webview/components/MenuCard.svelte';
import { mountComponent, makeMenuPresented, $, $$ } from '../../../helpers/svelteTestHelpers';

describe('MenuCard', () => {
  it('renders the question text and header', () => {
    const record = makeMenuPresented({ question: 'Which approach?' });
    const { container, cleanup } = mountComponent(MenuCard, { record });
    try {
      expect($(container, '.menu-question')?.textContent).toContain('Which approach?');
      expect($(container, '.menu-header')).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('renders option cards with labels', () => {
    const record = makeMenuPresented({
      options: [
        { id: 'a', label: 'Option A', description: 'First choice' },
        { id: 'b', label: 'Option B', description: 'Second choice' },
      ],
    });
    const { container, cleanup } = mountComponent(MenuCard, { record });
    try {
      const options = $$(container, '.option-card');
      expect(options.length).toBe(2);
      expect(options[0].textContent).toContain('Option A');
      expect(options[0].textContent).toContain('First choice');
    } finally {
      cleanup();
    }
  });

  it('shows recommended badge on recommended options', () => {
    const record = makeMenuPresented({
      options: [
        { id: 'a', label: 'Best', recommended: true },
        { id: 'b', label: 'Other' },
      ],
    });
    const { container, cleanup } = mountComponent(MenuCard, { record });
    try {
      expect($(container, '.option-recommended-badge')).toBeTruthy();
      expect($(container, '.option-recommended-badge')?.textContent).toContain('Recommended');
    } finally {
      cleanup();
    }
  });

  it('shows tradeoffs when present', () => {
    const record = makeMenuPresented({
      options: [
        { id: 'a', label: 'A', tradeoffs: 'Slower but safer' },
      ],
    });
    const { container, cleanup } = mountComponent(MenuCard, { record });
    try {
      expect($(container, '.option-tradeoffs')?.textContent).toContain('Slower but safer');
    } finally {
      cleanup();
    }
  });

  it('renders context section when present', () => {
    const record = makeMenuPresented({ question: 'Pick one' });
    // Add context via content override
    const withContext = {
      ...record,
      content: { ...record.content, context: 'Based on the analysis above...' },
    };
    const { container, cleanup } = mountComponent(MenuCard, { record: withContext });
    try {
      expect($(container, '.menu-context')?.textContent).toContain('Based on the analysis');
    } finally {
      cleanup();
    }
  });

  it('shows submit button with count for multi-select', () => {
    const record = makeMenuPresented({
      multiSelect: true,
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    const { container, cleanup } = mountComponent(MenuCard, { record });
    try {
      const submit = $(container, '.btn-submit');
      expect(submit).toBeTruthy();
      expect(submit?.textContent).toContain('0 selected');
    } finally {
      cleanup();
    }
  });
});
