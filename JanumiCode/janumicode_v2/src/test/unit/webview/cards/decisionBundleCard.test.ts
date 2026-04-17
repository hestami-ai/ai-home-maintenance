// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import DecisionBundleCard from '../../../../webview/components/DecisionBundleCard.svelte';
import { mountComponent, makeFakeRecord } from '../../../helpers/svelteTestHelpers';

describe('DecisionBundleCard', () => {
  it('renders Phase 1 intent bloom bundles as candidate-review surfaces with supporting detail', () => {
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
              id: 'c1',
              text: 'Home-Entry MVP',
              rationale: 'An implementation strategy focusing on Pillar 1 first.',
              description: 'An implementation strategy focusing on Pillar 1 first.',
              who_it_serves: 'Homeowners and small landlords',
              problem_it_solves: 'Reduces repair coordination burden',
              constraints: ['Must remain within Phase 1 boundaries'],
              open_questions: ['Is vendor discovery included in MVP?'],
              supporting_assumptions: [
                {
                  text: 'Pillar 1 can ship independently.',
                  rationale: 'The phasing section lists Home first.',
                },
              ],
            },
          ],
        },
      },
    });

    const { container, cleanup } = mountComponent(DecisionBundleCard, { record });
    try {
      expect(container.querySelector('.bundle-card')).toBeTruthy();
      expect(container.textContent).toContain('0/1 interpretations reviewed');
      expect(container.textContent).toContain('Candidate Interpretations');
      expect(container.textContent).toContain('Home-Entry MVP');
      expect(container.textContent).toContain('Who it serves: Homeowners and small landlords');
      expect(container.textContent).toContain('Problem it solves: Reduces repair coordination burden');
      expect(container.textContent).toContain('Constraints');
      expect(container.textContent).toContain('Open questions');
      expect(container.textContent).toContain('Supporting assumptions');
      expect(container.textContent).toContain('Pillar 1 can ship independently.');
    } finally {
      cleanup();
    }
  });
});
