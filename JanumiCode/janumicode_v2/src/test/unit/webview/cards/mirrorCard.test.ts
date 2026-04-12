// @vitest-environment happy-dom

/**
 * MirrorCard — structural + interaction tests for both assumption-mirror
 * and field-based mirror modes.
 */

import { describe, it, expect } from 'vitest';
import MirrorCard from '../../../../webview/components/MirrorCard.svelte';
import { mountComponent, makeMirrorPresented, $, $$ } from '../../../helpers/svelteTestHelpers';

describe('MirrorCard — assumption-mirror mode', () => {
  it('renders assumption rows with category and source badges', () => {
    const record = makeMirrorPresented({
      kind: 'assumption_mirror',
      assumptions: [
        { id: 'a1', text: 'No multi-user', category: 'scope', source: 'ai_proposed', status: 'pending' },
        { id: 'a2', text: 'Local storage', category: 'tech', source: 'domain_standard', status: 'pending' },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      const rows = $$(container, '.assumption-row');
      expect(rows.length).toBe(2);

      const badges = $$(container, '.mmp-category-badge');
      expect(badges.length).toBeGreaterThanOrEqual(2);
      expect(badges[0].textContent).toContain('scope');

      const sourceBadges = $$(container, '.badge-source');
      expect(sourceBadges.length).toBeGreaterThanOrEqual(2);
      expect(sourceBadges[0].textContent).toBe('AI');
      expect(sourceBadges[1].textContent).toBe('STD');
    } finally {
      cleanup();
    }
  });

  it('renders per-row Accept/Reject/Defer/Edit buttons', () => {
    const record = makeMirrorPresented({
      kind: 'assumption_mirror',
      assumptions: [
        { id: 'a1', text: 'Test assumption', category: 'test', source: 'ai_proposed', status: 'pending' },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      const buttons = $$(container, '.assumption-actions .mmp-btn');
      expect(buttons.length).toBe(4);
      expect(buttons.map(b => b.textContent?.trim())).toEqual(
        expect.arrayContaining(['✓ Accept', '✗ Reject', '⏳ Defer', '✏ Edit']),
      );
    } finally {
      cleanup();
    }
  });

  it('renders the steel-man preamble when present', () => {
    const record = makeMirrorPresented({
      kind: 'assumption_mirror',
      steelMan: 'I identified 3 candidate interpretations.',
      assumptions: [
        { id: 'a1', text: 'Test', category: 'test', source: 'ai_proposed', status: 'pending' },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      const steelMan = $(container, '.mirror-steelman');
      expect(steelMan).toBeTruthy();
      expect(steelMan?.textContent).toContain('3 candidate interpretations');
    } finally {
      cleanup();
    }
  });

  it('renders progress counter and submit bar', () => {
    const record = makeMirrorPresented({
      kind: 'assumption_mirror',
      assumptions: [
        { id: 'a1', text: 'A1', category: 'c', source: 'ai_proposed', status: 'pending' },
        { id: 'a2', text: 'A2', category: 'c', source: 'ai_proposed', status: 'pending' },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      const counter = $(container, '.progress-counter');
      expect(counter?.textContent).toContain('0/2');

      const bulkBtns = $$(container, '.bulk-btn');
      expect(bulkBtns.length).toBe(3); // Accept All, Reject All, Defer All
    } finally {
      cleanup();
    }
  });
});

describe('MirrorCard — field-based mode', () => {
  it('renders MirrorField[] when kind is not assumption_mirror', () => {
    const record = makeMirrorPresented({
      kind: 'intent_statement_mirror',
      fields: [
        { label: 'Product Name', value: 'CLI Todo', annotation: null, annotationText: null, requiresApproval: false },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      expect($(container, '.mirror-fields')).toBeTruthy();
      expect($(container, '.field-label')?.textContent).toContain('Product Name');
      expect($(container, '.mirror-assumptions')).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('renders annotated fields with badges', () => {
    const record = makeMirrorPresented({
      kind: 'intent_statement_mirror',
      fields: [
        { label: 'Database', value: 'PostgreSQL', annotation: 'system_proposed', annotationText: 'System-proposed', requiresApproval: true },
      ],
    });
    const { container, cleanup } = mountComponent(MirrorCard, { record });
    try {
      expect($(container, '.badge-system')).toBeTruthy();
      expect($(container, '.btn-approve-small')).toBeTruthy(); // per-field proposal approval
    } finally {
      cleanup();
    }
  });
});
