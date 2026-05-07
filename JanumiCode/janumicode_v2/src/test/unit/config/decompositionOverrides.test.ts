/**
 * Regression: ConfigManager.setDecompositionOverrides applies a partial
 * patch to the `decomposition` block without disturbing other fields.
 *
 * Used by `--thin-slice` mode in `src/cli/runner.ts` to tighten depth
 * and fanout caps and limit root counts so a calibration run exercises
 * every prompt template end-to-end without saturating fully.
 *
 * Also verifies the two new thin-slice config fields default to 0
 * (no cap) so the override is opt-in and existing runs are unchanged.
 */

import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../../../lib/config/configManager';

describe('ConfigManager.setDecompositionOverrides', () => {
  it('defaults max_root_count_fr / max_root_count_nfr to 0 (no cap)', () => {
    const cm = new ConfigManager();
    const dec = cm.get().decomposition;
    expect(dec.max_root_count_fr).toBe(0);
    expect(dec.max_root_count_nfr).toBe(0);
  });

  it('applies a partial patch without clobbering unspecified fields', () => {
    const cm = new ConfigManager();
    const before = cm.get().decomposition;
    const originalBudgetCap = before.budget_cap;
    const originalComponentDepthCap = before.component_depth_cap;

    cm.setDecompositionOverrides({
      depth_cap: 2,
      fanout_cap: 1,
      max_root_count_fr: 2,
    });

    const after = cm.get().decomposition;
    expect(after.depth_cap).toBe(2);
    expect(after.fanout_cap).toBe(1);
    expect(after.max_root_count_fr).toBe(2);
    // Untouched fields keep their prior values.
    expect(after.budget_cap).toBe(originalBudgetCap);
    expect(after.component_depth_cap).toBe(originalComponentDepthCap);
    expect(after.max_root_count_nfr).toBe(0);
  });

  it('successive overrides accumulate (later wins on conflicts)', () => {
    const cm = new ConfigManager();
    cm.setDecompositionOverrides({ depth_cap: 5, fanout_cap: 3 });
    cm.setDecompositionOverrides({ depth_cap: 2 });
    const dec = cm.get().decomposition;
    expect(dec.depth_cap).toBe(2);   // overwritten
    expect(dec.fanout_cap).toBe(3);  // preserved from first call
  });

  it('flips reasoning_review_on_tier_c flags across all four trees', () => {
    const cm = new ConfigManager();
    // All four default to false in DEFAULT_CONFIG.
    const before = cm.get().decomposition;
    expect(before.reasoning_review_on_tier_c).toBe(false);
    expect(before.component_reasoning_review_on_tier_c).toBe(false);
    expect(before.task_reasoning_review_on_tier_c).toBe(false);
    expect(before.data_model_reasoning_review_on_tier_c).toBe(false);
    expect(before.test_reasoning_review_on_tier_c).toBe(false);

    cm.setDecompositionOverrides({
      reasoning_review_on_tier_c: true,
      component_reasoning_review_on_tier_c: true,
      task_reasoning_review_on_tier_c: true,
      data_model_reasoning_review_on_tier_c: true,
      test_reasoning_review_on_tier_c: true,
    });

    const after = cm.get().decomposition;
    expect(after.reasoning_review_on_tier_c).toBe(true);
    expect(after.component_reasoning_review_on_tier_c).toBe(true);
    expect(after.task_reasoning_review_on_tier_c).toBe(true);
    expect(after.data_model_reasoning_review_on_tier_c).toBe(true);
    expect(after.test_reasoning_review_on_tier_c).toBe(true);
  });
});
