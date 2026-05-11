/**
 * Thin-slice runner — routing-driven mode.
 *
 * Drives the runner with a `FirmLlmRouting` instead of replay agents. Uses
 * the mock provider (registered globally via providerRegistry) and a per-
 * state script keyed by the prompt's bound state id (the assembled prompt
 * embeds the state input and the system prompt mentions the state).
 *
 * This is the test that proves `tsx scripts/initThinSliceRun.ts --provider=...`
 * actually drives 11 LLM-backed states end-to-end through the same code path.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runThinSlice, parseSpec, type ThinSliceSpec } from '../lib/calibration/thinSlice.js';
import { providerRegistry } from '../lib/llm/providerRegistry.js';
import { MockLLMProvider } from '../lib/llm/mockProvider.js';
import type { LLMRequest, LLMResponse } from '../lib/llm/provider.js';
import type { FirmLlmRouting } from '../layer3_firm_config/types.js';
import '../lib/llm/providers/index.js';

const SPEC_PATH = path.resolve(__dirname, '..', '..', 'test-and-evaluation', 'thin-slice-specs', 'single_issue_access_denial.md');

// Per-state stub responses keyed by templateId substring in the system prompt.
const SCRIPT: Array<{ match: (req: LLMRequest) => boolean; response: LLMResponse }> = [
  { match: (r) => /matter_context_normalize/.test(r.system ?? '') || /matter_context_normalize|MatterContextNormalize/.test(r.messages[0].content),
    response: { content: '{"matter_type":"custody_visitation_enforcement","client_role":"father","child_involved":true}' } },
  { match: (r) => /jurisdiction_capture|JurisdictionCapture/.test(promptText(r)),
    response: { content: '{"jurisdiction":"MD","jurisdiction_status":"confirmed_from_document"}' } },
  { match: (r) => /fact_extraction|FactExtraction/.test(promptText(r)),
    response: { content: '{"document_supported_facts":[{"fact":"order grants weekend access","source":"order"}],"client_reported_facts":[{"fact":"one denial","source":"intake"}]}' } },
  { match: (r) => /existing_order_extract|ExistingOrderExtract/.test(promptText(r)),
    response: { content: '{"potential_order_violation":true,"violation_basis":["weekend access denied"]}' } },
  { match: (r) => /issue_bloom|IssueBloom/.test(promptText(r)),
    response: { content: '{"issue_candidates":[{"issue":"visitation enforcement","why_it_might_matter":"single denial"}]}' } },
  { match: (r) => /issue_prune|IssuePrune/.test(promptText(r)),
    response: { content: '{"pruning_decisions":[{"issue":"visitation enforcement","decision":"retain","reason":"matches client objective"}]}' } },
  { match: (r) => /authority_verification|AuthorityVerification/.test(promptText(r)),
    response: { content: '{"overall_authority_status":"machine_assessed_support","attorney_confirmation_required":true}' } },
  { match: (r) => /direct_legal_conclusion|DirectLegalConclusionDraft/.test(promptText(r)),
    response: { content: '{"conclusion_text":"Single-incident access denial may support enforcement.","attorney_review_required":true,"verification_status":"machine_assessed"}' } },
  { match: (r) => /client_advice_draft|ClientAdviceDraft/.test(promptText(r)),
    response: { content: '{"draft_text":"We are reviewing your concern.","tone":"cautious","includes_caveats":true,"send_status":"external_release_blocked"}' } },
  { match: (r) => /court_filing_draft|CourtFilingDraftGenerate/.test(promptText(r)),
    response: { content: '{"caption":{"court":"Circuit","parties":["A","B"],"filing_type":"motion"},"relief_requested":["enforcement"],"filing_release_status":"external_release_blocked","signature_required":true}' } },
  { match: (r) => /release_status_determine|ReleaseStatusDetermine/.test(promptText(r)),
    response: { content: '{"draft_client_advice_message":"external_release_blocked","draft_court_filing":"external_release_blocked","internal_attorney_packet":"approved_for_internal_use"}' } },
];

function promptText(r: LLMRequest): string {
  return (r.system ?? '') + '\n' + r.messages.map((m) => m.content).join('\n');
}

describe('thin-slice runner — routing-driven (mock provider all 11 states)', () => {
  let workspaceRoot: string;
  let spec: ThinSliceSpec;

  beforeAll(() => {
    // Re-register a mock factory that returns a fresh provider seeded with our script each time.
    providerRegistry.register('mock', async () => new MockLLMProvider(SCRIPT));
  });

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-thin-route-'));
    spec = parseSpec(SPEC_PATH);
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('runs all 11 states with LLM-backed agents resolved via the provider registry', async () => {
    const routing: FirmLlmRouting = {
      defaultKind: 'llm',
      defaultProvider: 'mock',
      providerSettings: { mock: {} } as FirmLlmRouting['providerSettings'],
    };
    const result = await runThinSlice({ workspaceRoot, spec, llmRouting: routing });
    expect(result.capturedStates).toHaveLength(11);

    // matter-track now also carries prompt_assembled and completion_received
    // events emitted by the InvocationLogger (one of each per state).
    expect(result.matterTrackEventCount).toBeGreaterThanOrEqual(22);

    // Verify the IssuePrune state captured the LLM-shaped output
    const byState = new Map(result.capturedStates.map((s) => [s.stateId, s]));
    const prune = JSON.parse(byState.get('IssuePrune')!.outputJson) as { pruning_decisions: Array<{ decision: string }> };
    expect(prune.pruning_decisions[0].decision).toBe('retain');

    // Verify ReleaseStatusDetermine enforced the architectural floor
    const release = JSON.parse(byState.get('ReleaseStatusDetermine')!.outputJson) as { draft_court_filing: string };
    expect(release.draft_court_filing).toBe('external_release_blocked');
  });
});
