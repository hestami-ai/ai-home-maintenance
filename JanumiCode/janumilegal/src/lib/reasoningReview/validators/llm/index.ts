/**
 * LLM validators for the reasoning-review harness (Wave 11).
 *
 * Each export is an `LlmValidatorEntry`. Validators with `invoke` defined
 * are calibration-ready; those marked *Stub* are registered with template
 * paths but no invoke function — the harness records `validator_unavailable`
 * for them until the prompt template is authored and validated against
 * gold matters in calibration.
 *
 * Pattern: validator builds an LLM prompt that includes the relevant slice
 * of the state output + assembled prompt context, calls the reviewer
 * provider via `deps.provider.invoke()`, parses a tolerant JSON response,
 * maps each issue to a finding (`severity`, `type`, `message`).
 *
 * Decorrelation: deps.provider is the reviewer model, NEVER the primary
 * agent's model — invariant enforced at agent factory time.
 */

import type { LlmValidatorEntry, ValidatorRuntimeParams, LlmValidatorInvokeDeps, Severity } from '../../types.js';
import { cacheKeyForScope, type LLMRequest } from '../../../llm/provider.js';

// ── shared helpers ────────────────────────────────────────────────────

function reviewerCacheKey(p: ValidatorRuntimeParams, suffix: string): string {
  return cacheKeyForScope(p.envelope) + '_review_' + suffix;
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch {
    const i = cleaned.indexOf('{');
    if (i < 0) return undefined;
    let depth = 0;
    for (let k = i; k < cleaned.length; k++) {
      if (cleaned[k] === '{') depth++;
      else if (cleaned[k] === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(i, k + 1)); } catch { return undefined; }
        }
      }
    }
    return undefined;
  }
}

function clipForPrompt(s: string, maxChars = 6000): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + `\n…[clipped ${s.length - maxChars} chars]`;
}

interface ReviewerIssue {
  severity?: string;
  type?: string;
  message?: string;
  evidence?: Record<string, unknown>;
}

function coerceSeverity(raw: unknown): Severity {
  const s = String(raw).toUpperCase();
  if (s === 'HIGH' || s === 'MEDIUM' || s === 'LOW') return s;
  return 'MEDIUM';
}

function mapIssues(issues: ReviewerIssue[] | undefined, clvScope: readonly string[]): Array<Omit<import('../../types.js').ValidatorFinding, 'findingId' | 'classification' | 'validatorId'>> {
  if (!Array.isArray(issues)) return [];
  return issues.map((i) => ({
    severity: coerceSeverity(i.severity),
    type: i.type || 'unspecified',
    message: i.message || '',
    clvScope,
    evidence: i.evidence,
  }));
}

const cross = () => true;

// ── grounding_validator ───────────────────────────────────────────────
const GROUNDING_PROMPT = `You are an independent legal-reasoning reviewer.

You will receive:
  1. The state output produced by the primary agent.
  2. The authorized source content the primary agent had access to.
  3. The state ID and CLV scope.

Determine whether every assertion in the state output traces to either:
  - an authorized source the agent could see, OR
  - a clearly-labeled assumption / inference.

Flag every assertion that is NOT grounded.

Return ONLY a JSON object of the form:
  { "issues": [ { "severity": "HIGH"|"MEDIUM"|"LOW", "type": "ungrounded_assertion", "message": "<which assertion>", "evidence": { "assertion": "<text>" } } ] }

If everything is grounded, return { "issues": [] }.

Do NOT emit prose. Do NOT emit markdown fences.`;

export const groundingValidator: LlmValidatorEntry = {
  id: 'grounding_validator',
  family: 'cross_state',
  kind: 'llm',
  description: 'Every assertion in the output traces to an authorized source or a declared assumption.',
  appliesTo: cross,
  clvScope: ['clv.core.source.v1', 'clv.core.fact.v1'],
  templateId: 'review.grounding_validator',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const sources = Array.from(p.authorizedSourceContent ?? new Map<string, string>())
      .map(([id, body]) => `## Source: ${id}\n${clipForPrompt(body, 2000)}`)
      .join('\n\n') || '(no authorized sources visible)';
    const userText = [
      `## State: ${p.stateId}`,
      `## CLV scope: ${p.envelope.lensId}@${p.envelope.lensVersion}`,
      '',
      '## State output (the artifact under review)',
      '```json',
      clipForPrompt(p.stateOutputText, 4000),
      '```',
      '',
      '## Authorized sources',
      sources,
    ].join('\n');
    const req: LLMRequest = {
      system: GROUNDING_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'grounding'),
      temperature: 0.1,
    };
    const resp = await deps.provider.invoke(req);
    const parsed = parseJsonLoose(resp.content) as { issues?: ReviewerIssue[] } | undefined;
    return mapIssues(parsed?.issues, ['clv.core.source.v1', 'clv.core.fact.v1']);
  },
};

// ── reasoning_to_response_faithfulness ────────────────────────────────
const FAITHFULNESS_PROMPT = `You are an independent legal-reasoning reviewer.

The state output should be self-consistent: any reasoning trace it includes
must SUPPORT the conclusions, not contradict or omit them.

Flag:
  - logical contradictions between trace and conclusion
  - conclusion stated without any supporting reasoning visible
  - reasoning that points one way but conclusion goes the other

Return ONLY a JSON object: { "issues": [...] } with severity, type, message
fields. type values: "trace_contradicts_conclusion" | "conclusion_without_reasoning" | "reasoning_unaddressed".

No prose. No fences.`;

export const reasoningToResponseFaithfulness: LlmValidatorEntry = {
  id: 'reasoning_to_response_faithfulness',
  family: 'cross_state',
  kind: 'llm',
  description: 'Stated reasoning does not contradict or omit conclusions.',
  appliesTo: cross,
  clvScope: ['clv.core.conclusion.v1'],
  templateId: 'review.reasoning_to_response_faithfulness',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const userText = [
      `## State: ${p.stateId}`,
      '',
      '## State output',
      '```json',
      clipForPrompt(p.stateOutputText, 4000),
      '```',
    ].join('\n');
    const resp = await deps.provider.invoke({
      system: FAITHFULNESS_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'faithfulness'),
      temperature: 0.1,
    });
    const parsed = parseJsonLoose(resp.content) as { issues?: ReviewerIssue[] } | undefined;
    return mapIssues(parsed?.issues, ['clv.core.conclusion.v1']);
  },
};

// ── fact_classification_discipline ────────────────────────────────────
const FACT_CLASSIFICATION_PROMPT = `You are reviewing a fact-extraction output.

Rules:
  - "document_supported_facts" entries MUST cite a specific authorized source
  - "client_reported_facts" entries are statements by the client; these MUST NOT be silently upgraded to document_supported without quoted text
  - allegations from a client narrative MUST NOT appear in document_supported_facts
  - the "unknown_facts" bucket should mention facts the issue analysis would need

Flag any violation. Return ONLY: { "issues": [...] } with severity, type, message.
type values: "client_report_misclassified" | "missing_source_citation" | "allegation_treated_as_fact" | "unknown_facts_thin".

No prose. No fences.`;

export const factClassificationDiscipline: LlmValidatorEntry = {
  id: 'fact_classification_discipline',
  family: 'fact_extraction',
  kind: 'llm',
  description: 'Fact extraction respects document-supported / client-reported / unknown buckets.',
  appliesTo: ({ stateId }) => stateId === 'FactExtraction',
  clvScope: ['clv.core.fact.v1', 'clv.core.allegation.v1'],
  templateId: 'review.fact_classification_discipline',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const userText = [
      `## Fact-extraction output`,
      '```json',
      clipForPrompt(p.stateOutputText, 4000),
      '```',
    ].join('\n');
    const resp = await deps.provider.invoke({
      system: FACT_CLASSIFICATION_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'fact_classification'),
      temperature: 0.1,
    });
    const parsed = parseJsonLoose(resp.content) as { issues?: ReviewerIssue[] } | undefined;
    return mapIssues(parsed?.issues, ['clv.core.fact.v1', 'clv.core.allegation.v1']);
  },
};

// ── authority_citation_grounding ──────────────────────────────────────
const CITATION_GROUNDING_PROMPT = `You are reviewing authority citations.

The retrieved authority set is provided. Every cited authority in the output
MUST appear in the retrieved set. Fabricated citations (e.g., a case name
plus a fake reporter citation) are HIGH severity.

Return ONLY: { "issues": [...] } with severity, type, message. type values:
"fabricated_citation" | "citation_not_in_retrieved_set" | "citation_format_invalid".

No prose. No fences.`;

export const authorityCitationGrounding: LlmValidatorEntry = {
  id: 'authority_citation_grounding',
  family: 'authority',
  kind: 'llm',
  description: 'Cited authorities appear in the activation retrieval set; no fabricated citations.',
  appliesTo: ({ stateId }) =>
    stateId === 'AuthorityVerification' ||
    stateId === 'DirectLegalConclusionDraft' ||
    stateId === 'CourtFilingDraftGenerate',
  clvScope: ['clv.core.authority.v1'],
  templateId: 'review.authority_citation_grounding',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const userText = [
      `## State: ${p.stateId}`,
      '',
      '## Output under review',
      '```json',
      clipForPrompt(p.stateOutputText, 4000),
      '```',
      '',
      '## Note',
      'Without a retrieved-authority set in scope, you should still flag any citation that looks fabricated by formatting (e.g., implausible reporter, fake docket number) or by content (a holding that contradicts well-known law).',
    ].join('\n');
    const resp = await deps.provider.invoke({
      system: CITATION_GROUNDING_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'authority_citation'),
      temperature: 0.1,
    });
    const parsed = parseJsonLoose(resp.content) as { issues?: ReviewerIssue[] } | undefined;
    return mapIssues(parsed?.issues, ['clv.core.authority.v1']);
  },
};

// ── seed_coverage_pass1 ───────────────────────────────────────────────
const SEED_COVERAGE_PROMPT = `You are reviewing an issue-bloom output for seed-coverage discipline (Proposal C, pass 1).

Pass 1 (SEED COVERAGE) requires that every lens-defined seed domain produces
a candidate or an explicit non-applicability attestation. Surface any seed
domain that is silently absent.

For Family Law custody/visitation enforcement matters, seed domains include:
  - enforcement
  - contempt
  - make-up visitation
  - support-arrears defense
  - best interests / child refusal
  - modification of custody
  - emergency relief
  - evidence sufficiency
  - separate-proceeding coordination

Return ONLY: { "issues": [...] } with severity, type, message. type values:
"seed_domain_absent" | "domain_collapsed_with_other".

No prose. No fences.`;

export const seedCoveragePass1: LlmValidatorEntry = {
  id: 'seed_coverage_pass1',
  family: 'issue_bloom',
  kind: 'llm',
  description: 'Pass-1 candidates cover every lens-defined seed domain or attest non-applicability.',
  appliesTo: ({ stateId }) => stateId === 'IssueBloom',
  clvScope: ['clv.core.issue.v1'],
  templateId: 'review.seed_coverage_pass1',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const userText = [
      `## Issue-bloom output`,
      '```json',
      clipForPrompt(p.stateOutputText, 4000),
      '```',
    ].join('\n');
    const resp = await deps.provider.invoke({
      system: SEED_COVERAGE_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'seed_coverage'),
      temperature: 0.1,
    });
    const parsed = parseJsonLoose(resp.content) as { issues?: ReviewerIssue[] } | undefined;
    return mapIssues(parsed?.issues, ['clv.core.issue.v1']);
  },
};

// ── final_synthesis ───────────────────────────────────────────────────
const FINAL_SYNTHESIS_PROMPT = `You are the final reviewer for a single lens state.

You will receive:
  - the state ID and agent ID
  - the state's structured output
  - findings already produced by upstream validators

Your job: emit a single decision in { "decision": "pass" | "escalate" | "block",
"rationale": "<one sentence>" }.

Decision rules:
  - HIGH severity findings → escalate or block (block when the finding
    indicates a hard release-floor or fabricated content; escalate otherwise)
  - MEDIUM severity findings → escalate
  - only LOW or no findings → pass
  - upstream validator_unavailable LOW findings do NOT count as substantive

Return ONLY: { "decision": "...", "rationale": "..." }
No prose. No fences.`;

export const finalSynthesis: LlmValidatorEntry = {
  id: 'final_synthesis',
  family: 'final_synthesis',
  kind: 'llm',
  description: 'Collates upstream findings; emits decision pass | escalate | block.',
  appliesTo: () => true,
  clvScope: [],
  templateId: 'review.final_synthesis',
  templateVersion: 'v1',
  invoke: async (p, deps) => {
    const upstream = (p.upstreamFindings ?? []).map((f) => ({
      validator: f.validatorId,
      severity: f.severity,
      type: f.type,
      message: f.message,
      unavailable: f.unavailable === true,
    }));
    const userText = [
      `## State: ${p.stateId}`,
      `## Agent: ${p.agentId}`,
      '',
      '## State output',
      '```json',
      clipForPrompt(p.stateOutputText, 3000),
      '```',
      '',
      '## Upstream validator findings',
      '```json',
      JSON.stringify(upstream, null, 2),
      '```',
    ].join('\n');
    const resp = await deps.provider.invoke({
      system: FINAL_SYNTHESIS_PROMPT,
      messages: [{ role: 'user', content: userText }],
      cacheNamespace: reviewerCacheKey(p, 'final_synthesis'),
      temperature: 0.1,
    });
    const parsed = parseJsonLoose(resp.content) as { decision?: string; rationale?: string } | undefined;
    const decision = parsed?.decision === 'pass' || parsed?.decision === 'escalate' || parsed?.decision === 'block'
      ? parsed.decision
      : 'escalate';
    const sev: Severity = decision === 'block' ? 'HIGH' : decision === 'escalate' ? 'MEDIUM' : 'LOW';
    return [
      {
        severity: sev,
        type: 'final_synthesis_decision',
        message: parsed?.rationale ?? `decision=${decision}`,
        clvScope: [],
        evidence: { decision, rationale: parsed?.rationale },
      },
    ];
  },
};

// ── stubs (registered, no invoke; surface as validator_unavailable) ───

const stub = (id: string, family: import('../../types.js').ValidatorFamily, description: string, applies: (a: { stateId: string; output: unknown }) => boolean, clvScope: readonly string[]): LlmValidatorEntry => ({
  id, family, kind: 'llm', description, appliesTo: applies, clvScope,
  templateId: `review.${id}`, templateVersion: 'v1',
  // no invoke — harness records validator_unavailable until calibration tunes the prompt
});

export const divergencePass2Stub = stub(
  'divergence_pass2', 'issue_bloom',
  'At least one off-seed candidate or attestation that the matter does not admit divergence.',
  ({ stateId }) => stateId === 'IssueBloom',
  ['clv.core.issue.v1'],
);

export const dampeningPass3Stub = stub(
  'dampening_pass3', 'issue_bloom',
  'Pass-3 introduces no new domains; refinement only.',
  ({ stateId }) => stateId === 'IssueBloom',
  ['clv.core.issue.v1'],
);

export const pruningRationaleSubstanceStub = stub(
  'pruning_rationale_substance', 'issue_prune',
  '"remove" decisions have affirmative basis; "defer" decisions name the artifact set that re-activates them.',
  ({ stateId }) => stateId === 'IssuePrune',
  ['clv.core.issue.v1', 'clv.core.work_product.v1'],
);

export const conclusionAdverseConsiderationStub = stub(
  'conclusion_adverse_consideration', 'conclusion',
  'Conclusion lists at least one adverse consideration and one could_change_if condition.',
  ({ stateId }) => stateId === 'DirectLegalConclusionDraft',
  ['clv.core.conclusion.v1'],
);

export const argumentAuthorityAlignmentStub = stub(
  'argument_authority_alignment', 'filing',
  'Each argument_outline.authorities[] entry maps to a retrieved authority.',
  ({ stateId }) => stateId === 'CourtFilingDraftGenerate',
  ['clv.core.authority.v1', 'clv.core.filing.v1'],
);

export const toneCaveatCompletenessStub = stub(
  'tone_caveat_completeness', 'client_advice',
  'includes_caveats: true is supported by content; tone is appropriate; next attorney action named.',
  ({ stateId }) => stateId === 'ClientAdviceDraft',
  ['clv.core.client.v1', 'clv.core.privilege_attorney_client.v1'],
);
