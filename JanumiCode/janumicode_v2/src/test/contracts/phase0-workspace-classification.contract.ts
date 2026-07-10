/**
 * Contract for Phase 0.1 — workspace_classification
 * (artifact kind: `workspace_classification`).
 *
 * Classifies the run as greenfield / brownfield / probe / etc.
 * Phase 9's executor depends on this for write-scope determination.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export type WorkspaceClassValue = 'greenfield' | 'brownfield' | 'probe' | 'extension' | 'unknown';

export interface WorkspaceClassificationArtifact {
  kind: 'workspace_classification';
  /**
   * The actual persisted field name is `workspace_type`. Older drafts
   * called this `classification`; for back-compat the contract accepts
   * either. See pickClassification() below.
   */
  workspace_type?: WorkspaceClassValue | (string & {});
  classification?: WorkspaceClassValue | (string & {});
  rationale?: string;
  detected_artifacts?: string[];
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_CLASSIFICATIONS = new Set<string>(['greenfield', 'brownfield', 'probe', 'extension', 'unknown']);

/**
 * Read the classification value from either field name. The canonical
 * field is `workspace_type` (what the orchestrator actually persists);
 * `classification` is accepted for backward compatibility with older
 * fixtures that pre-date the rename. Returns undefined when neither
 * is present so the C-0.1.1 clause can fail cleanly.
 */
function pickClassification(a: WorkspaceClassificationArtifact): string | undefined {
  if (typeof a.workspace_type === 'string' && a.workspace_type.length > 0) return a.workspace_type;
  if (typeof a.classification === 'string' && a.classification.length > 0) return a.classification;
  return undefined;
}

export const phase0WorkspaceClassificationContract: ContractSuite<WorkspaceClassificationArtifact> = {
  boundaryId: '0.1_workspace_classification',
  phaseId: '0',
  subPhaseId: 'workspace_classification',
  producerArtifactKind: 'workspace_classification',
  description:
    'Phase 0 workspace classification — exactly one recognized class declared with rationale.',
  clauses: [
    {
      id: 'C-0.1.1',
      description: 'workspace_type (or classification) is a non-empty string.',
      severity: 'blocking',
      check: (a) => {
        const value = pickClassification(a);
        if (!value || value.trim().length === 0) {
          return { message: 'workspace_type / classification is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-0.1.2',
      description: 'workspace_type (or classification) is one of the recognized values.',
      severity: 'blocking',
      check: (a) => {
        const value = pickClassification(a);
        if (!value) return true;  // C-0.1.1 caught it
        if (!VALID_CLASSIFICATIONS.has(value)) {
          return { message: `unknown workspace_type: "${value}"`, details: { valid: [...VALID_CLASSIFICATIONS] } };
        }
        return true;
      },
    },
    {
      id: 'C-0.1.3',
      description: 'rationale is recorded.',
      severity: 'advisory',
      check: (a) => {
        if (!a.rationale || a.rationale.trim().length === 0) {
          return { message: 'rationale is missing or empty' };
        }
        return true;
      },
    },
  ],
};
