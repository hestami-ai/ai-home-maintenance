import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect,
  ClvDal,
  FirmDal,
  ManifestDal,
  ActivationDal,
  OpStreamDal,
  PrivilegeFrameDal,
  MatterKeysDal,
  PromptTemplateDal,
} from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { AgentRuntime } from '../lib/agents/runtime.js';
import { Orchestrator } from '../lib/orchestrator/orchestrator.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { PromptTemplateRegistry } from '../lib/promptTemplates/registry.js';
import { MockLLMProvider } from '../lib/llm/mockProvider.js';
import { InvocationLogger } from '../lib/llm/invocationLogger.js';
import { LlmBackedAgent } from '../lib/agents/llmBackedAgent.js';
import {
  familyLawProductionManifest,
  FAMILY_LAW_AGENTS,
} from '../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';
import { registerFamilyLawTemplates, buildFamilyLawAgents } from '../layer2_lens_packs/familyLawProduction/agentFactory.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('LlmBackedAgent — single state with mock provider', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let clv: DbBackedCLV;
  let templateRegistry: PromptTemplateRegistry;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let opStream: OpStreamDal;
  let frameRef: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-llm-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    clv = new DbBackedCLV(new ClvDal(db));
    const firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    templateRegistry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registerFamilyLawTemplates(templateRegistry);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses a JSON response from a mock provider and emits prompt + completion to matter track', async () => {
    const mock = new MockLLMProvider([
      { response: { content: '```json\n{"matter_type": "custody_visitation_enforcement", "client_role": "father", "child_involved": true}\n```' } },
    ]);
    const logger = new InvocationLogger(writer, opStream);
    const agent = new LlmBackedAgent({
      agentId: FAMILY_LAW_AGENTS.matterContextNormalize,
      templateId: 'family_law.matter_context_normalize',
      templateVersion: 'v1',
      provider: mock,
      clv,
      templateRegistry,
      invocationLogger: logger,
    });

    const out = await agent.execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', stateId: 'MatterContextNormalize',
        privilegeFrame: frameRef,
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: { intake: 'father wants enforcement' },
    });

    expect(out.status).toBe('completed');
    expect((out.output as { matter_type: string }).matter_type).toBe('custody_visitation_enforcement');
    expect(mock.calls).toHaveLength(1);

    // Both a prompt_assembled and completion_received event should land on the matter track
    const events = store.listEvents();
    const types = events.map((e) => e.eventType).sort();
    expect(types).toContain('prompt_assembled');
    expect(types).toContain('completion_received');
  });

  it('escalates when the completion is unparseable and repair is disabled', async () => {
    const mock = new MockLLMProvider([{ response: { content: 'this is not JSON' } }]);
    const agent = new LlmBackedAgent({
      agentId: FAMILY_LAW_AGENTS.matterContextNormalize,
      templateId: 'family_law.matter_context_normalize',
      templateVersion: 'v1',
      provider: mock,
      clv,
      templateRegistry,
      repairAttempts: 0,
    });
    const out = await agent.execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', stateId: 'MatterContextNormalize',
        privilegeFrame: frameRef,
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: {},
    });
    expect(out.status).toBe('escalated');
  });

  it('blocks when provider throws', async () => {
    const failing: import('../lib/llm/provider.js').LLMProvider = {
      name: 'failing',
      async invoke() { throw new Error('quota exceeded'); },
    };
    const agent = new LlmBackedAgent({
      agentId: FAMILY_LAW_AGENTS.matterContextNormalize,
      templateId: 'family_law.matter_context_normalize',
      templateVersion: 'v1',
      provider: failing,
      clv,
      templateRegistry,
    });
    const out = await agent.execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', stateId: 'MatterContextNormalize',
        privilegeFrame: frameRef,
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: {},
    });
    expect(out.status).toBe('blocked');
    expect(out.blockReason).toMatch(/quota exceeded/);
  });

  it('repairs an unparseable completion via a corrective re-invocation', async () => {
    // First call: prose. Second call (the repair) detected by presence of an assistant turn.
    const mock = new MockLLMProvider([
      { match: (r) => r.messages.some((m) => m.role === 'assistant'),
        response: { content: '{"matter_type":"custody_visitation_enforcement","client_role":"father","child_involved":true}' } },
      { response: { content: 'sorry — here is the answer: matter_type=custody' } },
    ]);
    const agent = new LlmBackedAgent({
      agentId: FAMILY_LAW_AGENTS.matterContextNormalize,
      templateId: 'family_law.matter_context_normalize',
      templateVersion: 'v1',
      provider: mock,
      clv,
      templateRegistry,
      // default repairAttempts is 1
    });
    const out = await agent.execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', stateId: 'MatterContextNormalize',
        privilegeFrame: frameRef,
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: {},
    });
    expect(out.status).toBe('completed');
    expect((out.output as { matter_type: string }).matter_type).toBe('custody_visitation_enforcement');
    expect(mock.calls).toHaveLength(2);
    // The repair invocation must include an assistant turn carrying the bad completion
    // followed by a corrective user message.
    const repairMsgs = mock.calls[1].messages;
    expect(repairMsgs.some((m) => m.role === 'assistant')).toBe(true);
    expect(repairMsgs[repairMsgs.length - 1].content).toMatch(/SINGLE valid JSON/);
    expect(out.metrics?.repairs).toBe('1');
  });

  it('escalates after exhausting the repair budget', async () => {
    const mock = new MockLLMProvider([
      { response: { content: 'still not JSON' } }, // matches every call — never parseable
    ]);
    const agent = new LlmBackedAgent({
      agentId: FAMILY_LAW_AGENTS.matterContextNormalize,
      templateId: 'family_law.matter_context_normalize',
      templateVersion: 'v1',
      provider: mock,
      clv,
      templateRegistry,
      repairAttempts: 2,
    });
    const out = await agent.execute({
      envelope: {
        firmId: FIRM, clientId: CLIENT, matterId: MATTER,
        lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', stateId: 'MatterContextNormalize',
        privilegeFrame: frameRef,
        authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
      },
      input: {},
    });
    expect(out.status).toBe('escalated');
    expect(out.escalationReason).toMatch(/2 repair attempt/);
    expect(mock.calls).toHaveLength(3); // initial + 2 repairs
  });
});

describe('Family Law E2E with LlmBackedAgents (mock provider, all 11 states)', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-llm-e2e-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('drives all 11 Family Law states through LlmBackedAgents with scripted mock responses', async () => {
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    const frameRef = frameDal.saveSnapshot(scope, { matterId: MATTER, attorneyClientPairs: [] });
    const store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    const clv = new DbBackedCLV(new ClvDal(db));
    const templateRegistry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registerFamilyLawTemplates(templateRegistry);

    // One mock provider that returns a state-appropriate JSON for each call.
    const responsesByState: Record<string, string> = {
      MatterContextNormalize: '{"matter_type":"custody_visitation_enforcement","client_role":"father","child_involved":true,"requested_action":"enforce","known_urgency":"moderate","external_release_requested":true,"external_release_allowed_without_attorney":false}',
      JurisdictionCapture: '{"jurisdiction":"Maryland","jurisdiction_status":"confirmed_from_document"}',
      FactExtraction: '{"document_supported_facts":[],"client_reported_facts":[]}',
      ExistingOrderExtract: '{"order_obligations":[],"potential_order_violation":true,"violation_basis":[]}',
      IssueBloom: '{"issue_candidates":[{"issue":"enforcement","why_it_might_matter":"sole denial"}]}',
      IssuePrune: '{"pruning_decisions":[{"issue":"enforcement","decision":"retain","reason":"matches client objective"}]}',
      AuthorityVerification: '{"overall_authority_status":"machine_assessed_support","attorney_confirmation_required":true}',
      DirectLegalConclusionDraft: '{"conclusion_text":"draft","attorney_review_required":true,"verification_status":"machine_assessed"}',
      ClientAdviceDraft: '{"draft_text":"...","tone":"neutral","includes_caveats":true,"send_status":"external_release_blocked"}',
      CourtFilingDraftGenerate: '{"caption":{},"relief_requested":[],"argument_outline":[],"exhibits":[],"certificate_of_service_required":true,"signature_required":true,"filing_release_status":"external_release_blocked"}',
      ReleaseStatusDetermine: '{"draft_client_advice_message":"external_release_blocked","draft_court_filing":"external_release_blocked","internal_attorney_packet":"approved_for_internal_use"}',
    };

    const mock = new MockLLMProvider([{
      match: (req) => true,
      response: { content: '' },
    }]);
    // override invoke to dispatch by state in the user prompt
    const originalInvoke = mock.invoke.bind(mock);
    mock.invoke = async (req) => {
      void originalInvoke;
      mock.calls.push(req);
      const userText = req.messages[0]?.content ?? '';
      for (const [state, content] of Object.entries(responsesByState)) {
        if (userText.includes(state) || (req.system ?? '').includes(stateAgentMap[state])) {
          return { content };
        }
      }
      return { content: '{}' };
    };

    const stateAgentMap: Record<string, string> = {
      MatterContextNormalize: FAMILY_LAW_AGENTS.matterContextNormalize,
      JurisdictionCapture: FAMILY_LAW_AGENTS.jurisdictionCapture,
      FactExtraction: FAMILY_LAW_AGENTS.factExtraction,
      ExistingOrderExtract: FAMILY_LAW_AGENTS.existingOrderExtract,
      IssueBloom: FAMILY_LAW_AGENTS.issueBloom,
      IssuePrune: FAMILY_LAW_AGENTS.issuePrune,
      AuthorityVerification: FAMILY_LAW_AGENTS.authorityVerification,
      DirectLegalConclusionDraft: FAMILY_LAW_AGENTS.directLegalConclusion,
      ClientAdviceDraft: FAMILY_LAW_AGENTS.clientAdviceDraft,
      CourtFilingDraftGenerate: FAMILY_LAW_AGENTS.courtFilingDraft,
      ReleaseStatusDetermine: FAMILY_LAW_AGENTS.releaseStatusDetermine,
    };

    // We use a single mock provider for every state. dispatch in invoke() returns
    // the right JSON based on stateId presence in the system prompt (which the
    // assembler sets to include the lens+state).
    mock.invoke = async (req) => {
      mock.calls.push(req);
      const sys = req.system ?? '';
      for (const state of Object.keys(responsesByState)) {
        if (sys.includes(`state '${state}'`)) {
          return { content: responsesByState[state] };
        }
      }
      return { content: '{}' };
    };

    const providerByStateId = new Map(Object.keys(stateAgentMap).map((s) => [s, mock]));
    const logger = new InvocationLogger(writer, opStream);
    const agents = buildFamilyLawAgents({
      clv, templateRegistry, providerByStateId, invocationLogger: logger,
    });

    const registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    const runtime = new AgentRuntime({ registry, opStream });
    for (const [agentId, agent] of agents) runtime.bindAgent(agent);

    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);
    const activationDal = new ActivationDal(db);
    const orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });
    const aId = orchestrator.startActivation({ scope, lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', activatedBy: 'attorney_1' });

    const env = { privilegeFrame: frameRef, authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [] };
    for (const state of familyLawProductionManifest.states) {
      const r = await orchestrator.advanceNextState({ scope, activationId: aId, stateInput: {}, envelopeContext: env, agentId: stateAgentMap[state.stateId] });
      expect(r.status).toBe('completed');
    }
    expect(orchestrator.isActivationComplete(scope, aId)).toBe(true);

    // Each state produced a prompt_assembled + completion_received pair on matter track
    const promptCount = store.countByClassification('work_product_factual');
    expect(promptCount).toBeGreaterThanOrEqual(22);

    store.close();
  });
});
