/**
 * MirrorGenerator — deterministic template expansion for Mirror artifacts.
 * Based on JanumiCode Spec v2.3, §8.13.
 *
 * No LLM call required. Constructs annotated, human-readable representations
 * of agent output with inline annotations for:
 *   - System-Proposed Content ([SYSTEM-PROPOSED])
 *   - Prior Decision conflicts ([CONFLICTS WITH PRIOR DECISION])
 *   - Assumptions ([ASSUMPTION — surfaced for review])
 *   - Invariant Violations from prior retry
 */

// ── Types ───────────────────────────────────────────────────────────

export interface MirrorInput {
  /** The artifact being mirrored */
  artifactId: string;
  /** Artifact type */
  artifactType: string;
  /** Artifact content (structured JSON) */
  content: Record<string, unknown>;
  /** System-Proposed Content items */
  systemProposedItems?: SystemProposedItem[];
  /** Prior decision conflicts */
  priorDecisionConflicts?: PriorDecisionConflict[];
  /** Assumptions surfaced */
  assumptions?: Assumption[];
  /** Invariant violations from prior retry (if any) */
  priorInvariantViolations?: string[];
}

export interface SystemProposedItem {
  field: string;
  content: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface PriorDecisionConflict {
  candidateId: string;
  priorDecisionRecordId: string;
  priorDecisionAuthorityLevel: number;
  conflictDescription: string;
}

export interface Assumption {
  assumption: string;
  basis: string;
}

export interface MirrorOutput {
  /** Structured mirror data for the webview to render */
  mirrorId: string;
  artifactId: string;
  artifactType: string;
  /** Rendered fields with annotations */
  fields: MirrorField[];
  /** Metadata counts */
  systemProposedContentCount: number;
  priorDecisionConflictCount: number;
  assumptionCount: number;
  renderedFieldCount: number;
}

export interface MirrorField {
  label: string;
  value: unknown;
  /** Annotation type (null if no annotation) */
  annotation: 'system_proposed' | 'prior_decision_conflict' | 'assumption' | null;
  /** Annotation text */
  annotationText: string | null;
  /** For system-proposed items: approval controls needed */
  requiresApproval: boolean;
}

// ── MirrorGenerator ─────────────────────────────────────────────────

export class MirrorGenerator {
  private idCounter = 0;

  /**
   * Generate a Mirror from an artifact.
   */
  generate(input: MirrorInput): MirrorOutput {
    const fields: MirrorField[] = [];

    // Add invariant violation header if present
    if (input.priorInvariantViolations?.length) {
      fields.push({
        label: 'PRIOR INVARIANT VIOLATION — resolved in this version',
        value: input.priorInvariantViolations.join('\n'),
        annotation: null,
        annotationText: null,
        requiresApproval: false,
      });
    }

    // Render each top-level field from the artifact content
    for (const [key, value] of Object.entries(input.content)) {
      const field = this.renderField(key, value, input);
      fields.push(field);
    }

    // Add system-proposed items as separate annotated fields
    if (input.systemProposedItems) {
      for (const item of input.systemProposedItems) {
        fields.push({
          label: item.field,
          value: item.content,
          annotation: 'system_proposed',
          annotationText: 'SYSTEM-PROPOSED — requires explicit approval',
          requiresApproval: item.approvalStatus === 'pending',
        });
      }
    }

    // Add prior decision conflicts
    if (input.priorDecisionConflicts) {
      for (const conflict of input.priorDecisionConflicts) {
        fields.push({
          label: `Conflict: ${conflict.candidateId}`,
          value: conflict.conflictDescription,
          annotation: 'prior_decision_conflict',
          annotationText: `CONFLICTS WITH PRIOR DECISION (record: ${conflict.priorDecisionRecordId}, authority: ${conflict.priorDecisionAuthorityLevel}) — human resolution required`,
          requiresApproval: false,
        });
      }
    }

    // Add assumptions
    if (input.assumptions) {
      for (const assumption of input.assumptions) {
        fields.push({
          label: 'Assumption',
          value: `${assumption.assumption} (basis: ${assumption.basis})`,
          annotation: 'assumption',
          annotationText: 'ASSUMPTION — surfaced for review',
          requiresApproval: false,
        });
      }
    }

    return {
      mirrorId: `mirror-${++this.idCounter}`,
      artifactId: input.artifactId,
      artifactType: input.artifactType,
      fields,
      systemProposedContentCount: input.systemProposedItems?.length ?? 0,
      priorDecisionConflictCount: input.priorDecisionConflicts?.length ?? 0,
      assumptionCount: input.assumptions?.length ?? 0,
      renderedFieldCount: fields.length,
    };
  }

  /**
   * Render a single field from artifact content.
   */
  private renderField(
    key: string,
    value: unknown,
    _input: MirrorInput,
  ): MirrorField {
    return {
      label: this.formatFieldLabel(key),
      value: this.formatFieldValue(value),
      annotation: null,
      annotationText: null,
      requiresApproval: false,
    };
  }

  /**
   * Format a JSON key as a human-readable label.
   */
  private formatFieldLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Format a value for display.
   */
  private formatFieldValue(value: unknown): unknown {
    if (value === null || value === undefined) return '(not set)';
    if (typeof value === 'object') return value; // Let the webview render structured data
    return value;
  }

  // ── Assumption-row mirror (Wave 5b) ────────────────────────────

  /**
   * Generate an assumption-row mirror from extracted assumption items.
   * Used by Phase 1.3 for the bloom prune surface. The output shape gets
   * written into the `mirror_presented` record with
   * `content.kind === 'assumption_mirror'`.
   *
   * The MirrorCard detects this kind and renders the v1-style row layout
   * with per-row Accept / Reject / Defer / Edit buttons.
   */
  generateAssumptionMirror(input: {
    artifactId: string;
    artifactType: string;
    assumptions: import('../types/records').AssumptionItem[];
    steelMan?: string;
  }): {
    mirrorId: string;
    artifactId: string;
    artifactType: string;
    assumptions: import('../types/records').AssumptionItem[];
    steelMan?: string;
  } {
    return {
      mirrorId: `mirror-${++this.idCounter}`,
      artifactId: input.artifactId,
      artifactType: input.artifactType,
      assumptions: input.assumptions,
      steelMan: input.steelMan,
    };
  }
}
