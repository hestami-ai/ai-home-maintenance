// @vitest-environment happy-dom

/**
 * Timestamp display — date+time visible, ISO tooltip on hover.
 */

import { describe, it, expect } from 'vitest';
import Card from '../../../../webview/components/Card.svelte';
import { mountComponent, makeFakeRecord, $, click } from '../../../helpers/svelteTestHelpers';

describe('Card timestamp display', () => {
  it('shows date + time (not just time)', async () => {
    const record = makeFakeRecord({
      record_type: 'artifact_produced',
      produced_at: '2026-04-11T14:32:45.000Z',
      content: { text: 'test' },
    });
    const { container, cleanup } = mountComponent(Card, { record });
    try {
      // The generic card starts collapsed. Expand it to see the timestamp.
      const header = $(container, '.card-header');
      await click(header);

      const timestamp = $(container, '.timestamp');
      expect(timestamp).toBeTruthy();
      const text = timestamp?.textContent ?? '';

      // Must contain the date portion (2026-04-11 or locale-variant like 04/11/2026)
      expect(text).toMatch(/2026/);
      // Must also contain some time portion
      expect(text.length).toBeGreaterThan(10); // date alone is ~10 chars; date+time is 19+
    } finally {
      cleanup();
    }
  });

  it('has ISO timestamp as title attribute for tooltip', async () => {
    const iso = '2026-04-11T14:32:45.000Z';
    const record = makeFakeRecord({
      record_type: 'artifact_produced',
      produced_at: iso,
      content: { text: 'test' },
    });
    const { container, cleanup } = mountComponent(Card, { record });
    try {
      const header = $(container, '.card-header');
      await click(header);

      const timestamp = $(container, '.timestamp');
      expect(timestamp?.getAttribute('title')).toBe(iso);
    } finally {
      cleanup();
    }
  });
});
