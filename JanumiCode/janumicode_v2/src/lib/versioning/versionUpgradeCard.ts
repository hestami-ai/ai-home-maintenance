/**
 * Version Upgrade Card — presented to human at Phase Gate when version changes.
 * Based on JanumiCode Spec v2.3, §13.4.
 */

import type { SchemaGap, CompatibilityCheckResult } from './schemaCompatibilityCheck';

export interface VersionUpgradeCard {
  previousSha: string;
  newSha: string;
  schemaGaps: SchemaGap[];
  breakingChanges: SchemaGap[];
  newInvariants: string[];
  recommendation: 'proceed' | 'rollback_to_boundary' | 'pause_and_resolve';
}

export function buildVersionUpgradeCard(
  previousSha: string,
  newSha: string,
  checkResult: CompatibilityCheckResult,
): VersionUpgradeCard {
  const breakingChanges = checkResult.gaps.filter(g => g.isBreaking);

  let recommendation: VersionUpgradeCard['recommendation'];
  if (breakingChanges.length > 0) {
    recommendation = 'pause_and_resolve';
  } else if (checkResult.gaps.length > 0) {
    recommendation = 'proceed'; // Non-breaking gaps can proceed
  } else {
    recommendation = 'proceed';
  }

  return {
    previousSha,
    newSha,
    schemaGaps: checkResult.gaps,
    breakingChanges,
    newInvariants: checkResult.newInvariantsAdded,
    recommendation,
  };
}
