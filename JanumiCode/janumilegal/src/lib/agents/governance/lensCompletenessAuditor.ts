/**
 * Lens Completeness Auditor (Tier 12).
 *
 * Per docs/janumilegal_product_description.md §Tier 12 #52.
 *
 * Audits whether an activation has run all required states of its lens.
 * Analogous to JanumiCode v2's V-model completeness review. Wave 4 ships
 * deterministic logic; Wave 6+ may add LLM-backed reasoning.
 */

import { randomUUID } from 'node:crypto';
import type { Scope } from '../../database/types.js';
import type { ActivationDal } from '../../database/activationDal.js';
import type { ManifestDal } from '../../database/manifestDal.js';
import { summarize, type GovernanceFinding, type GovernanceReport } from './types.js';

export const LENS_COMPLETENESS_AUDITOR_ID = 'lens_completeness_auditor.v1';

export class LensCompletenessAuditor {
  constructor(
    private readonly manifestDal: ManifestDal,
    private readonly activationDal: ActivationDal,
  ) {}

  audit(args: { scope: Scope; activationId: string }): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    const activation = this.activationDal.getActivation(args.scope, args.activationId);
    if (!activation) {
      findings.push({
        findingId: randomUUID(),
        agentId: LENS_COMPLETENESS_AUDITOR_ID,
        severity: 'block',
        category: 'activation_missing',
        message: `activation ${args.activationId} not found for scope`,
      });
      return finalize(findings);
    }
    const manifest = this.manifestDal.get(activation.lensId, activation.lensVersion);
    if (!manifest) {
      findings.push({
        findingId: randomUUID(),
        agentId: LENS_COMPLETENESS_AUDITOR_ID,
        severity: 'block',
        category: 'manifest_missing',
        message: `manifest for ${activation.lensId}@${activation.lensVersion} not in catalog`,
      });
      return finalize(findings);
    }
    const completed = new Set(this.activationDal.listCompletedStates(args.scope, args.activationId));
    for (const state of manifest.states) {
      if (state.required && !completed.has(state.stateId)) {
        findings.push({
          findingId: randomUUID(),
          agentId: LENS_COMPLETENESS_AUDITOR_ID,
          severity: 'block',
          category: 'required_state_missing',
          message: `required state '${state.stateId}' has no recorded output`,
          subject: { kind: 'state', id: state.stateId },
        });
      }
    }
    return finalize(findings);
  }
}

function finalize(findings: readonly GovernanceFinding[]): GovernanceReport {
  return {
    reportId: randomUUID(),
    producedBy: LENS_COMPLETENESS_AUDITOR_ID,
    producedAt: new Date().toISOString(),
    findings,
    summary: summarize(findings),
  };
}
