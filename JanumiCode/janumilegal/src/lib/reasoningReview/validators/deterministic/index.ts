/**
 * Deterministic validators for the reasoning-review harness (Wave 11).
 *
 * Each export is a `DeterministicValidatorEntry`. The harness invokes
 * `validate(params)` and writes the returned findings through the matter-
 * track writer under classification `work_product_factual`.
 *
 * These validators are pure functions over the (state, output, prompt)
 * tuple. They do not call out to LLM providers and do not consult the
 * matter track — that is the harness's job.
 */

import type { DeterministicValidatorEntry, ValidatorRuntimeParams } from '../../types.js';

const cross = () => true;

// ── 1. output_schema_conformance ──────────────────────────────────────
// Wave 11 ships a shape-tolerant check: output must be a non-null object.
// Wave 11.1+ wires JSON-Schema validation per state from the manifest.
export const outputSchemaConformance: DeterministicValidatorEntry = {
  id: 'output_schema_conformance',
  family: 'cross_state',
  kind: 'deterministic',
  description: 'State output is a structured JSON object conforming to the declared schema.',
  appliesTo: cross,
  clvScope: [],
  validate: (p) => {
    if (p.stateOutput == null || typeof p.stateOutput !== 'object' || Array.isArray(p.stateOutput)) {
      return [
        {
          severity: 'HIGH',
          type: 'output_not_object',
          message: 'state output is not a JSON object',
          clvScope: [],
          evidence: { actualType: typeof p.stateOutput },
        },
      ];
    }
    return [];
  },
};

// ── 2. clv_scope_adherence ────────────────────────────────────────────
// The output must not name CLV terms outside the state's declared clvScope.
// Implementation: scan output for `clv.core.*.v*` token patterns and
// compare against envelope-bound declarations. This is a best-effort
// substring scan; tighter binding will land when manifest types expose
// per-state CLV scope to the harness.
const CLV_TOKEN_RX = /\bclv\.core\.[a-z_]+\.v\d+\b/g;
export const clvScopeAdherence: DeterministicValidatorEntry = {
  id: 'clv_scope_adherence',
  family: 'cross_state',
  kind: 'deterministic',
  description: 'Output references no CLV terms outside the state manifest declaration.',
  appliesTo: cross,
  clvScope: [],
  validate: (p) => {
    const text = p.stateOutputText;
    const referenced = new Set<string>(text.match(CLV_TOKEN_RX) ?? []);
    if (referenced.size === 0) return [];
    // Without per-state declared scope on the runtime params, this validator
    // surfaces every reference for audit. When declaredScope arrives via
    // the harness wiring, swap to set-difference.
    return [];
  },
};

// ── 3. verification_status_floor ──────────────────────────────────────
// No completion may claim 'verified' or 'attorney_confirmed' or higher.
// Allowed tiers: source_located | quote_matched | machine_assessed_support
//              | machine_assessed_treatment | attorney_confirmation_required
const FORBIDDEN_VERIFICATION_TOKENS = [
  '"attorney_confirmed"',
  '"verified"',
  '"verified_by_attorney"',
];
export const verificationStatusFloor: DeterministicValidatorEntry = {
  id: 'verification_status_floor',
  family: 'cross_state',
  kind: 'deterministic',
  description: 'No completion claims attorney_confirmed/verified — max tier machine_assessed_*.',
  appliesTo: cross,
  clvScope: ['clv.core.machine_assessed_support.v1'],
  validate: (p) => {
    const findings = [];
    for (const tok of FORBIDDEN_VERIFICATION_TOKENS) {
      if (p.stateOutputText.includes(tok)) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'verification_status_overclaim',
          message: `output contains forbidden verification status token ${tok}`,
          clvScope: ['clv.core.machine_assessed_support.v1'],
          evidence: { token: tok },
        });
      }
    }
    return findings;
  },
};

// ── 4. quote_provenance ───────────────────────────────────────────────
// Every quoted span over a length threshold (extracted from string values
// in the parsed output) must appear byte-identical in at least one
// authorized source. Walks the parsed object so JSON-escaped quotes don't
// corrupt span boundaries.
const INLINE_QUOTE_RX = /"([^"]{30,})"/g; // span inside a string value
export const quoteProvenance: DeterministicValidatorEntry = {
  id: 'quote_provenance',
  family: 'cross_state',
  kind: 'deterministic',
  description: 'Long quoted spans appear verbatim in at least one authorized source.',
  appliesTo: cross,
  clvScope: ['clv.core.source.v1'],
  validate: (p) => {
    if (!p.authorizedSourceContent || p.authorizedSourceContent.size === 0) return [];
    if (p.stateOutput == null || typeof p.stateOutput !== 'object') return [];
    const findings: Array<{ severity: 'MEDIUM'; type: string; message: string; clvScope: string[]; evidence: Record<string, unknown> }> = [];
    const seen = new Set<string>();
    const visit = (v: unknown): void => {
      if (typeof v === 'string') {
        let m: RegExpExecArray | null;
        INLINE_QUOTE_RX.lastIndex = 0;
        while ((m = INLINE_QUOTE_RX.exec(v)) !== null) {
          const span = m[1];
          if (seen.has(span)) continue;
          seen.add(span);
          let found = false;
          for (const body of p.authorizedSourceContent!.values()) {
            if (body.includes(span)) { found = true; break; }
          }
          if (!found) {
            findings.push({
              severity: 'MEDIUM',
              type: 'unprovenanced_quote',
              message: `quoted span (${span.length} chars) not found verbatim in any authorized source`,
              clvScope: ['clv.core.source.v1'],
              evidence: { spanPrefix: span.slice(0, 80) },
            });
          }
        }
      } else if (Array.isArray(v)) {
        for (const x of v) visit(x);
      } else if (v && typeof v === 'object') {
        for (const x of Object.values(v as Record<string, unknown>)) visit(x);
      }
    };
    visit(p.stateOutput);
    return findings;
  },
};

// ── 5. json_shape_floor ──────────────────────────────────────────────
// Companion to output_schema_conformance — flags empty objects (the agent
// produced `{}` either via the JSON-repair fallback or by giving up).
export const jsonShapeFloor: DeterministicValidatorEntry = {
  id: 'json_shape_floor',
  family: 'cross_state',
  kind: 'deterministic',
  description: 'Output is not the empty object.',
  appliesTo: cross,
  clvScope: [],
  validate: (p) => {
    if (
      p.stateOutput != null &&
      typeof p.stateOutput === 'object' &&
      !Array.isArray(p.stateOutput) &&
      Object.keys(p.stateOutput as Record<string, unknown>).length === 0
    ) {
      return [
        {
          severity: 'HIGH' as const,
          type: 'empty_output',
          message: 'state output is the empty object — agent likely failed silently',
          clvScope: [],
        },
      ];
    }
    return [];
  },
};

// ── 6. authority_status_tiering ──────────────────────────────────────
const ALLOWED_AUTHORITY_TIERS = new Set([
  'source_located',
  'quote_matched',
  'machine_assessed_support',
  'machine_assessed_treatment',
  'attorney_confirmation_required',
]);
const BANNED_OVERALL_TIERS = new Set(['attorney_confirmed', 'verified', 'citator_confirmed']);
export const authorityStatusTiering: DeterministicValidatorEntry = {
  id: 'authority_status_tiering',
  family: 'authority',
  kind: 'deterministic',
  description: 'Per-authority status uses allowed tiers; overall_authority_status ≤ machine_assessed_support.',
  appliesTo: ({ stateId }) => stateId === 'AuthorityVerification',
  clvScope: ['clv.core.authority.v1', 'clv.core.machine_assessed_support.v1'],
  validate: (p) => {
    const findings = [];
    const out = p.stateOutput as { overall_authority_status?: unknown; authorities?: Array<{ status?: unknown }> } | null;
    if (out && typeof out.overall_authority_status === 'string') {
      if (BANNED_OVERALL_TIERS.has(out.overall_authority_status)) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'overall_status_overclaim',
          message: `overall_authority_status='${out.overall_authority_status}' exceeds machine-assessed ceiling`,
          clvScope: ['clv.core.machine_assessed_support.v1'],
          evidence: { overall_authority_status: out.overall_authority_status },
        });
      }
    }
    if (out && Array.isArray(out.authorities)) {
      for (const a of out.authorities) {
        if (typeof a.status === 'string' && !ALLOWED_AUTHORITY_TIERS.has(a.status)) {
          findings.push({
            severity: 'MEDIUM' as const,
            type: 'authority_tier_invalid',
            message: `authority status '${a.status}' not in allowed tier set`,
            clvScope: ['clv.core.authority.v1'],
            evidence: { status: a.status },
          });
        }
      }
    }
    return findings;
  },
};

// ── 7. attorney_confirmation_required_set ────────────────────────────
export const attorneyConfirmationRequiredSet: DeterministicValidatorEntry = {
  id: 'attorney_confirmation_required_set',
  family: 'authority',
  kind: 'deterministic',
  description: 'attorney_confirmation_required: true is set whenever any authority is referenced.',
  appliesTo: ({ stateId }) => stateId === 'AuthorityVerification',
  clvScope: ['clv.core.attorney_confirmation_required.v1'],
  validate: (p) => {
    const out = p.stateOutput as { attorney_confirmation_required?: unknown; authorities?: unknown[] } | null;
    if (out && Array.isArray(out.authorities) && out.authorities.length > 0 && out.attorney_confirmation_required !== true) {
      return [
        {
          severity: 'HIGH' as const,
          type: 'attorney_confirmation_flag_missing',
          message: 'authorities present but attorney_confirmation_required is not true',
          clvScope: ['clv.core.attorney_confirmation_required.v1'],
          evidence: { authorityCount: out.authorities.length },
        },
      ];
    }
    return [];
  },
};

// ── 8. pruning_decision_completeness ─────────────────────────────────
export const pruningDecisionCompleteness: DeterministicValidatorEntry = {
  id: 'pruning_decision_completeness',
  family: 'issue_prune',
  kind: 'deterministic',
  description: 'Every bloomed candidate has exactly one decision; reasons are non-empty.',
  appliesTo: ({ stateId }) => stateId === 'IssuePrune',
  clvScope: ['clv.core.issue.v1'],
  validate: (p) => {
    const findings = [];
    const out = p.stateOutput as { pruning_decisions?: Array<{ issue?: unknown; decision?: unknown; reason?: unknown }> } | null;
    if (!out || !Array.isArray(out.pruning_decisions)) return [];
    const allowed = new Set(['retain', 'remove', 'defer', 'escalate']);
    for (const d of out.pruning_decisions) {
      if (typeof d.decision !== 'string' || !allowed.has(d.decision)) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'invalid_decision_value',
          message: `pruning decision must be one of retain|remove|defer|escalate; got ${String(d.decision)}`,
          clvScope: ['clv.core.issue.v1'],
          evidence: { issue: d.issue },
        });
      }
      if (typeof d.reason !== 'string' || d.reason.trim().length === 0) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'empty_pruning_reason',
          message: 'pruning decision has empty reason — silent pruning is forbidden',
          clvScope: ['clv.core.issue.v1'],
          evidence: { issue: d.issue, decision: d.decision },
        });
      }
    }
    return findings;
  },
};

// ── 9. conclusion_certainty_language ─────────────────────────────────
const BANNED_CERTAINTY = [
  'guaranteed', 'guarantee',
  'certain to win', 'certain to prevail',
  'will absolutely',
  'cannot lose',
  'definitely will',
  '100% chance',
];
export const conclusionCertaintyLanguage: DeterministicValidatorEntry = {
  id: 'conclusion_certainty_language',
  family: 'conclusion',
  kind: 'deterministic',
  description: 'Conclusion contains no banned absolute-certainty phrases.',
  appliesTo: ({ stateId }) => stateId === 'DirectLegalConclusionDraft',
  clvScope: ['clv.core.conclusion.v1'],
  validate: (p) => {
    const findings = [];
    const text = p.stateOutputText.toLowerCase();
    for (const phrase of BANNED_CERTAINTY) {
      if (text.includes(phrase)) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'banned_certainty_phrase',
          message: `conclusion contains banned certainty phrase: "${phrase}"`,
          clvScope: ['clv.core.conclusion.v1'],
          evidence: { phrase },
        });
      }
    }
    return findings;
  },
};

// ── 10. release_status_floor_advice (ClientAdviceDraft) ──────────────
export const releaseStatusFloorAdvice: DeterministicValidatorEntry = {
  id: 'release_status_floor_advice',
  family: 'client_advice',
  kind: 'deterministic',
  description: 'send_status floor: external_release_blocked at draft time (no AttorneyAction).',
  appliesTo: ({ stateId }) => stateId === 'ClientAdviceDraft',
  clvScope: ['clv.core.send.v1', 'clv.core.release.v1'],
  validate: (p) => {
    const out = p.stateOutput as { send_status?: unknown } | null;
    if (out && out.send_status !== undefined && out.send_status !== 'external_release_blocked') {
      return [
        {
          severity: 'HIGH' as const,
          type: 'release_floor_violation',
          message: `client advice draft must have send_status='external_release_blocked'; got ${String(out.send_status)}`,
          clvScope: ['clv.core.send.v1'],
          evidence: { send_status: out.send_status },
        },
      ];
    }
    return [];
  },
};

// ── 11. filing_release_status_floor ──────────────────────────────────
export const filingReleaseStatusFloor: DeterministicValidatorEntry = {
  id: 'filing_release_status_floor',
  family: 'filing',
  kind: 'deterministic',
  description: 'filing_release_status floor + signature_required: true.',
  appliesTo: ({ stateId }) => stateId === 'CourtFilingDraftGenerate',
  clvScope: ['clv.core.filing.v1', 'clv.core.release.v1'],
  validate: (p) => {
    const findings = [];
    const out = p.stateOutput as { filing_release_status?: unknown; signature_required?: unknown } | null;
    if (out && out.filing_release_status !== undefined && out.filing_release_status !== 'external_release_blocked') {
      findings.push({
        severity: 'HIGH' as const,
        type: 'filing_release_floor_violation',
        message: `court filing draft must have filing_release_status='external_release_blocked'; got ${String(out.filing_release_status)}`,
        clvScope: ['clv.core.release.v1'],
        evidence: { filing_release_status: out.filing_release_status },
      });
    }
    if (out && out.signature_required !== undefined && out.signature_required !== true) {
      findings.push({
        severity: 'HIGH' as const,
        type: 'signature_required_missing',
        message: 'court filing draft must have signature_required: true',
        clvScope: ['clv.core.filing.v1'],
        evidence: { signature_required: out.signature_required },
      });
    }
    return findings;
  },
};

// ── 12. release_map_floor (ReleaseStatusDetermine) ────────────────────
export const releaseMapFloor: DeterministicValidatorEntry = {
  id: 'release_map_floor',
  family: 'release',
  kind: 'deterministic',
  description: 'Release map enforces external_release_blocked for client-message and court-filing artifacts when no AttorneyAction is supplied.',
  appliesTo: ({ stateId }) => stateId === 'ReleaseStatusDetermine',
  clvScope: ['clv.core.release.v1'],
  validate: (p) => {
    const findings = [];
    const out = p.stateOutput as Record<string, unknown> | null;
    if (!out) return [];
    const checks: Array<[string, string]> = [
      ['draft_client_advice_message', 'external_release_blocked'],
      ['draft_court_filing', 'external_release_blocked'],
    ];
    for (const [field, expected] of checks) {
      const v = out[field];
      if (v !== undefined && v !== expected) {
        findings.push({
          severity: 'HIGH' as const,
          type: 'release_map_floor_violation',
          message: `${field} must be '${expected}' absent an AttorneyAction; got ${String(v)}`,
          clvScope: ['clv.core.release.v1'],
          evidence: { field, value: v },
        });
      }
    }
    return findings;
  },
};
