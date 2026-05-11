/**
 * Wave 2 gate: trivial 2-state lens E2E + required-state skip + agent isolation.
 */

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
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { Orchestrator } from '../lib/orchestrator/orchestrator.js';
import { AgentRuntime } from '../lib/agents/runtime.js';
import type { Agent } from '../lib/agents/agent.js';
import { cacheKeyForScope } from '../lib/llm/provider.js';
import {
  trivialManifest,
  stateOneAgentRegistration,
  stateTwoAgentRegistration,
  TRIVIAL_LENS_ID,
  TRIVIAL_LENS_VERSION,
  STATE_ONE_AGENT_ID,
  STATE_TWO_AGENT_ID,
} from './fixtures/trivialLens.js';

const FIRM = 'firm_jclaw';
const CLIENT_A = 'client_a';
const CLIENT_B = 'client_b';
const MATTER_A = 'matter_a';
const MATTER_B = 'matter_b';

class CapturingAgent implements Agent {
  readonly invocations: Array<{ agentId: string; matterId: string; stateId: string }> = [];
  constructor(readonly agentId: string) {}
  async execute(input: { envelope: { matterId: string; stateId: string } }) {
    this.invocations.push({
      agentId: this.agentId,
      matterId: input.envelope.matterId,
      stateId: input.envelope.stateId,
    });
    return { status: 'completed' as const, output: { agent: this.agentId, state: input.envelope.stateId } };
  }
}

describe('orchestrator E2E', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let manifestDal: ManifestDal;
  let activationDal: ActivationDal;
  let opStream: OpStreamDal;
  let registry: AgentRegistry;
  let runtime: AgentRuntime;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-orch-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    firmDal = new FirmDal(db);
    manifestDal = new ManifestDal(db);
    activationDal = new ActivationDal(db);
    opStream = new OpStreamDal(db);
    registry = new AgentRegistry();
    registry.register(stateOneAgentRegistration);
    registry.register(stateTwoAgentRegistration);
    runtime = new AgentRuntime({ registry, opStream });
    orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });

    manifestDal.insert(trivialManifest);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT_A, 'Client A');
    firmDal.insertClient(FIRM, CLIENT_B, 'Client B');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A, matterName: 'A', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B, matterName: 'B', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function envelopeContext() {
    return {
      privilegeFrame: { snapshotHash: 'hash-test', version: 1 },
      authorizedSources: [],
      authorizedPriorArtifacts: [],
      authorizedMMP: [],
      forbiddenScopes: [],
    };
  }

  it('runs both states in order on matter A', async () => {
    runtime.bindAgent(new CapturingAgent(STATE_ONE_AGENT_ID));
    runtime.bindAgent(new CapturingAgent(STATE_TWO_AGENT_ID));
    const scope = { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A };

    const activationId = orchestrator.startActivation({ scope, lensId: TRIVIAL_LENS_ID, lensVersion: TRIVIAL_LENS_VERSION, activatedBy: 'test_user' });

    const r1 = await orchestrator.advanceNextState({
      scope, activationId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_ONE_AGENT_ID,
    });
    expect(r1.stateId).toBe('StateOne');
    expect(r1.status).toBe('completed');

    const r2 = await orchestrator.advanceNextState({
      scope, activationId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_TWO_AGENT_ID,
    });
    expect(r2.stateId).toBe('StateTwo');
    expect(r2.status).toBe('completed');

    expect(orchestrator.isActivationComplete(scope, activationId)).toBe(true);
    expect(activationDal.listCompletedStates(scope, activationId)).toEqual(['StateOne', 'StateTwo']);
  });

  it('blocks attempting to skip StateOne by binding only StateTwo agent', async () => {
    runtime.bindAgent(new CapturingAgent(STATE_TWO_AGENT_ID));
    const scope = { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A };
    const activationId = orchestrator.startActivation({ scope, lensId: TRIVIAL_LENS_ID, lensVersion: TRIVIAL_LENS_VERSION, activatedBy: 'test_user' });

    // The orchestrator's computeNextState identifies StateOne as next.
    // Caller tries to invoke STATE_TWO_AGENT_ID; should be rejected because
    // STATE_TWO_AGENT_ID is not in StateOne's permittedAgents.
    await expect(
      orchestrator.advanceNextState({
        scope, activationId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_TWO_AGENT_ID,
      }),
    ).rejects.toThrow(/AGENT_NOT_PERMITTED_FOR_STATE|not permitted/);

    expect(activationDal.listCompletedStates(scope, activationId)).toEqual([]);
  });

  it('two matters in flight do not leak state to each other', async () => {
    const captureOne = new CapturingAgent(STATE_ONE_AGENT_ID);
    runtime.bindAgent(captureOne);
    runtime.bindAgent(new CapturingAgent(STATE_TWO_AGENT_ID));

    const scopeA = { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A };
    const scopeB = { firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B };

    const aId = orchestrator.startActivation({ scope: scopeA, lensId: TRIVIAL_LENS_ID, lensVersion: TRIVIAL_LENS_VERSION, activatedBy: 'u' });
    const bId = orchestrator.startActivation({ scope: scopeB, lensId: TRIVIAL_LENS_ID, lensVersion: TRIVIAL_LENS_VERSION, activatedBy: 'u' });

    await orchestrator.advanceNextState({ scope: scopeA, activationId: aId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_ONE_AGENT_ID });
    await orchestrator.advanceNextState({ scope: scopeB, activationId: bId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_ONE_AGENT_ID });

    // Each invocation must have seen its own matter id.
    expect(captureOne.invocations.find((i) => i.matterId === MATTER_A)).toBeDefined();
    expect(captureOne.invocations.find((i) => i.matterId === MATTER_B)).toBeDefined();

    // State outputs are isolated per matter.
    expect(activationDal.listCompletedStates(scopeA, aId)).toEqual(['StateOne']);
    expect(activationDal.listCompletedStates(scopeB, bId)).toEqual(['StateOne']);
    expect(activationDal.listCompletedStates(scopeA, bId)).toEqual([]); // wrong scope, no leak
    expect(activationDal.listCompletedStates(scopeB, aId)).toEqual([]); // wrong scope, no leak
  });

  it('per-matter prompt cache namespace differs across matters', () => {
    const nsA = cacheKeyForScope({ firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A });
    const nsB = cacheKeyForScope({ firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B });
    expect(nsA).not.toBe(nsB);
    // Stable: same scope produces same namespace.
    const nsA2 = cacheKeyForScope({ firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A });
    expect(nsA).toBe(nsA2);
    // Format: m_<24 hex>
    expect(nsA).toMatch(/^m_[0-9a-f]{24}$/);
  });

  it('op-track records the agent invocation and state completion', async () => {
    runtime.bindAgent(new CapturingAgent(STATE_ONE_AGENT_ID));
    const scope = { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A };
    const activationId = orchestrator.startActivation({ scope, lensId: TRIVIAL_LENS_ID, lensVersion: TRIVIAL_LENS_VERSION, activatedBy: 'u' });

    await orchestrator.advanceNextState({ scope, activationId, stateInput: {}, envelopeContext: envelopeContext(), agentId: STATE_ONE_AGENT_ID });

    expect(opStream.countByType(FIRM, 'lens_activation_started')).toBe(1);
    expect(opStream.countByType(FIRM, 'state_started')).toBe(1);
    expect(opStream.countByType(FIRM, 'agent_invoked')).toBe(1);
    expect(opStream.countByType(FIRM, 'agent_completed')).toBe(1);
    expect(opStream.countByType(FIRM, 'state_completed')).toBe(1);

    // Op-track must NOT contain client/matter content — verify metadata only
    const recent = opStream.recent(FIRM, 5);
    for (const e of recent) {
      const json = JSON.stringify(e.payload);
      expect(json).not.toContain('Custody'); // no matter name
      expect(json).not.toContain('Client A'); // no client name
    }
  });
});
