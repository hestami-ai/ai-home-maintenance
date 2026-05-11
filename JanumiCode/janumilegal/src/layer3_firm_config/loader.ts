/**
 * Layer 3 firm config loader.
 *
 * Per docs/janumilegal_product_description_evolution.md §11.2 — the
 * "second-firm test" should onboard a firm via Layer 3 only.
 */

import { JurisdictionScopedCitatorProvider } from '../lib/authority/citator.js';
import type { CitatorProvider } from '../lib/authority/citator.js';
import type { FirmConfig } from './types.js';
import { synthMdConfig } from './firm_synthetic_md/config.js';
import { synthVaConfig } from './firm_synthetic_va/config.js';

export const FIRM_CONFIG_REGISTRY: Readonly<Record<string, FirmConfig>> = {
  [synthMdConfig.firmId]: synthMdConfig,
  [synthVaConfig.firmId]: synthVaConfig,
};

export function loadFirmConfig(firmId: string): FirmConfig | undefined {
  return FIRM_CONFIG_REGISTRY[firmId];
}

/** Materialize a CitatorProvider from a firm config's citator scope + seed. */
export function citatorFromConfig(cfg: FirmConfig): CitatorProvider {
  return new JurisdictionScopedCitatorProvider({
    providerName: `firm_${cfg.firmId}_citator_v1`,
    jurisdictions: cfg.citatorJurisdictionScope,
    initialMap: (cfg.citatorSeed ?? []).map((s) => [s.authorityId, s.treatment] as const),
  });
}
