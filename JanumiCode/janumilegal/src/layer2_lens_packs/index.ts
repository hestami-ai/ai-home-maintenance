/**
 * Layer 2 — MVP lens packs registry.
 */

import type { LensPhaseManifest } from '../lib/orchestrator/types.js';
import { familyLawProductionManifest, FAMILY_LAW_AGENTS } from './familyLawProduction/manifest.js';
import { legalResearchMemoManifest } from './legalResearchMemo/manifest.js';
import { clientAdviceDraftManifest } from './clientAdviceDraft/manifest.js';
import { courtFilingDraftManifest } from './courtFilingDraft/manifest.js';
import { redlineManifest } from './redline/manifest.js';
import { directLegalConclusionManifest } from './directLegalConclusion/manifest.js';
import { authorityVerificationManifest } from './authorityVerification/manifest.js';
import { SHARED_AGENTS } from './sharedAgents.js';

export const MVP_LENS_MANIFESTS: readonly LensPhaseManifest[] = [
  familyLawProductionManifest,
  legalResearchMemoManifest,
  clientAdviceDraftManifest,
  courtFilingDraftManifest,
  redlineManifest,
  directLegalConclusionManifest,
  authorityVerificationManifest,
];

export {
  familyLawProductionManifest,
  legalResearchMemoManifest,
  clientAdviceDraftManifest,
  courtFilingDraftManifest,
  redlineManifest,
  directLegalConclusionManifest,
  authorityVerificationManifest,
  FAMILY_LAW_AGENTS,
  SHARED_AGENTS,
};
