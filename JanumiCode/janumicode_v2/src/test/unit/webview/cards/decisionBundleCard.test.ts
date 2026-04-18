// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import DecisionBundleCard from '../../../../webview/components/DecisionBundleCard.svelte';
import { mountComponent, makeFakeRecord } from '../../../helpers/svelteTestHelpers';

describe('DecisionBundleCard', () => {
  it('renders Phase 1 intent bloom bundles with interpretation-assumption mirror + candidate menu', () => {
    const record = makeFakeRecord({
      record_type: 'decision_bundle_presented',
      content: {
        surface_id: 'surface-1',
        title: 'Review candidate interpretations of your intent',
        summary: 'I identified 2 plausible interpretation(s) of your intent.',
        mirror: {
          kind: 'intent_bloom_mirror',
          items: [
            {
              id: 'lens-assumption',
              text: "I'm interpreting this as a **product** intent.",
              rationale: 'Strong product framing in the raw intent.',
              category: 'lens',
            },
            {
              id: 'scope-framing',
              text: 'Scope framing: single_product, production_grade',
              category: 'scope',
            },
          ],
        },
        menu: {
          question: 'Select the candidate interpretations to keep for synthesis:',
          context: '2 candidates were generated from your intent.',
          multi_select: true,
          allow_free_text: false,
          options: [
            {
              id: 'c1',
              label: 'Home-Entry MVP',
              description: 'An implementation strategy focusing on Pillar 1 first.',
              recommended: true,
            },
            {
              id: 'c2',
              label: 'Full 3-pillar build',
              description: 'Deliver all pillars simultaneously.',
            },
          ],
        },
      },
    });

    const { container, cleanup } = mountComponent(DecisionBundleCard, { record });
    try {
      expect(container.querySelector('.bundle-card')).toBeTruthy();
      // New progress label + section heading
      expect(container.textContent).toContain('0/2 interpretation assumptions reviewed');
      expect(container.textContent).toContain('Interpretation Assumptions');
      // Category chips rendered
      expect(container.querySelector('.category-lens')).toBeTruthy();
      expect(container.querySelector('.category-scope')).toBeTruthy();
      // Lens row text
      expect(container.textContent).toContain("I'm interpreting this as a **product** intent.");
      // Candidate concepts now live in the menu section
      expect(container.textContent).toContain('Home-Entry MVP');
      expect(container.textContent).toContain('Full 3-pillar build');
      expect(container.textContent).toContain('Recommended');
    } finally {
      cleanup();
    }
  });
});
