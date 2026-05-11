/**
 * Thin-slice runner library.
 *
 * Per docs/calibration/thin_slice_harness.md (mirrors JanumiCode v2 thin-slice).
 *
 * Drives a constrained end-to-end activation through every state of a target
 * lens against a synthetic single-incident matter. Captures everything the
 * reviewer script (operator mode) needs to score prompt clarity / model
 * adherence / output validity per state.
 *
 * The runner is structural: it doesn't require LLM agents. Replay agents
 * stand in. When real LLM agents land (Wave 10+), the runner accepts a
 * different agent runtime via dependency injection.
 */

import { randomUUID, createHash } from 'node:crypto';
import * as fs from 'node:fs';
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
  AttorneyAdmissionsDal,
  AttorneyActionDal,
  PromptTemplateDal,
} from '../database/index.js';
import { loadCLVv1, DbBackedCLV } from '../clv/index.js';
import { generateKey } from '../encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../encryption/keyHierarchy.js';
import { AgentRegistry } from '../registry/agentRegistry.js';
import { AgentRuntime } from '../agents/runtime.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { MatterTrackStore, matterTrackPath } from '../governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import { AttorneyActionService } from '../attorneyAction/service.js';
import {
  familyLawProductionManifest,
  FAMILY_LAW_AGENTS,
} from '../../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../../layer2_lens_packs/registrations.js';
import { registerFamilyLawTemplates } from '../../layer2_lens_packs/familyLawProduction/agentFactory.js';
import { buildFamilyLawAgentsFromRouting } from '../../layer2_lens_packs/familyLawProduction/agentFactoryFromRouting.js';
import { PromptTemplateRegistry } from '../promptTemplates/registry.js';
import { providerRegistry } from '../llm/providerRegistry.js';
import { InvocationLogger } from '../llm/invocationLogger.js';
import '../llm/providers/index.js'; // side-effect: register providers
import type { Agent, AgentExecutionInput, AgentExecutionOutput } from '../agents/agent.js';
import type { LensPhaseManifest } from '../orchestrator/types.js';
import type { FirmLlmRouting } from '../../layer3_firm_config/types.js';

export interface ThinSliceSpec {
  readonly handle: string;
  readonly title: string;
  readonly clientMessage: string;
  readonly orderExcerpt: string;
  readonly intakeNotes: string;
  readonly expectedPrimaryLens: string;
  readonly expectedSecondaryLenses: readonly string[];
  readonly jurisdiction: string;
  readonly matterType: string;
}

export interface ThinSliceRunOptions {
  /** Workspace root — runner creates a workspace-N subdir under here. */
  readonly workspaceRoot: string;
  readonly spec: ThinSliceSpec;
  /** Override the default Family Law manifest if testing another lens. */
  readonly manifest?: LensPhaseManifest;
  /** Custom agent factory — if absent, uses the built-in replay-agent factory. */
  readonly agentFactory?: (agentId: string, spec: ThinSliceSpec) => Agent;
  /**
   * When supplied, the runner provisions LLM/CLI agents per state from this
   * routing config instead of the structural replay agents. Enables
   * `tsx scripts/initThinSliceRun.ts --provider=ollama --cli=goose` to drive
   * real models for prompt calibration.
   */
  readonly llmRouting?: FirmLlmRouting;
}

export interface ThinSliceCaptured {
  readonly stateId: string;
  readonly agentId: string;
  readonly outputJson: string;
  readonly outputHash: string;
  readonly completedAt: string;
}

export interface ThinSliceResult {
  readonly workspacePath: string;
  readonly platformDbPath: string;
  readonly matterTrackDbPath: string;
  readonly firmId: string;
  readonly clientId: string;
  readonly matterId: string;
  readonly activationId: string;
  readonly capturedStates: readonly ThinSliceCaptured[];
  readonly opTrackEventCount: number;
  readonly matterTrackEventCount: number;
  readonly summaryPath: string;
}

/**
 * Default replay-agent factory: emits a structurally-correct stand-in output
 * for each Family Law state shaped like the real outputs. Wave 10+ swaps in
 * an LLM-backed factory.
 */
function defaultAgentFactory(agentId: string, spec: ThinSliceSpec): Agent {
  const outputs: Record<string, unknown> = {
    [FAMILY_LAW_AGENTS.matterContextNormalize]: {
      matter_type: spec.matterType,
      client_role: 'father',
      child_involved: true,
    },
    [FAMILY_LAW_AGENTS.jurisdictionCapture]: {
      jurisdiction: spec.jurisdiction,
      jurisdiction_status: 'confirmed_from_document',
    },
    [FAMILY_LAW_AGENTS.factExtraction]: {
      document_supported_facts: [{ fact: 'Court order grants every-other-weekend access.', source: 'order_excerpt' }],
      client_reported_facts: [{ fact: 'One denial occurred this past weekend.', source: 'intake_notes' }],
    },
    [FAMILY_LAW_AGENTS.existingOrderExtract]: { potential_order_violation: true },
    [FAMILY_LAW_AGENTS.issueBloom]: {
      issue_candidates: [
        { issue: 'visitation/access enforcement', why_it_might_matter: 'single denial of access under existing order' },
      ],
    },
    [FAMILY_LAW_AGENTS.issuePrune]: {
      pruning_decisions: [
        { issue: 'visitation/access enforcement', decision: 'retain', reason: 'matches client objective; sole alleged incident' },
      ],
    },
    [FAMILY_LAW_AGENTS.authorityVerification]: { overall_authority_status: 'machine_assessed_support' },
    [FAMILY_LAW_AGENTS.directLegalConclusion]: {
      attorney_review_required: true,
      conclusion_text: 'Single-incident access denial may support enforcement consideration; no contempt finding without further evidence.',
    },
    [FAMILY_LAW_AGENTS.clientAdviceDraft]: {},
    [FAMILY_LAW_AGENTS.courtFilingDraft]: {},
    [FAMILY_LAW_AGENTS.releaseStatusDetermine]: {
      draft_client_advice_message: 'external_release_blocked',
      draft_court_filing: 'external_release_blocked',
    },
  };
  const out = outputs[agentId] ?? {};
  return {
    agentId,
    async execute(_input: AgentExecutionInput): Promise<AgentExecutionOutput> {
      return { status: 'completed', output: out };
    },
  };
}

/**
 * Discover the next workspace number under the workspace root.
 */
function nextWorkspaceNumber(root: string): number {
  if (!fs.existsSync(root)) return 1;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  let max = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = /^thin-slice-workspace-(\d+)$/.exec(e.name);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

/**
 * Run the thin slice end-to-end and capture every output.
 */
export async function runThinSlice(opts: ThinSliceRunOptions): Promise<ThinSliceResult> {
  fs.mkdirSync(opts.workspaceRoot, { recursive: true });
  const sliceN = nextWorkspaceNumber(opts.workspaceRoot);
  const workspace = path.join(opts.workspaceRoot, `thin-slice-workspace-${sliceN}`);
  fs.mkdirSync(workspace, { recursive: true });

  const platformDbPath = path.join(workspace, 'platform.sqlite');
  const db = openDirect(platformDbPath);

  // CLV + lens manifest + agents
  loadCLVv1(new ClvDal(db));
  const manifest = opts.manifest ?? familyLawProductionManifest;
  const manifestDal = new ManifestDal(db);
  manifestDal.insert(manifest);
  const registry = new AgentRegistry();
  registerAllMvpAgents(registry);

  const opStream = new OpStreamDal(db);
  const firmDal = new FirmDal(db);
  const frameDal = new PrivilegeFrameDal(db);
  const firmKey = new FirmKey(generateKey());
  const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
  const admissions = new AttorneyAdmissionsDal(db);

  // Synthetic firm/client/matter — single attorney admitted in spec jurisdiction
  const firmId = `firm_thin_${sliceN}`;
  const clientId = `client_thin_${sliceN}`;
  const matterId = `matter_thin_${sliceN}`;
  const attorneyId = `attorney_thin_${sliceN}`;
  const scope = { firmId, clientId, matterId };

  firmDal.insertFirm(firmId, `Thin Slice Firm ${sliceN}`, opts.spec.jurisdiction);
  firmDal.insertClient(firmId, clientId, `Thin Slice Client ${sliceN}`);
  firmDal.insertMatter({
    firmId, clientId, matterId,
    matterName: opts.spec.title,
    practiceArea: 'family_law',
    primaryJurisdiction: opts.spec.jurisdiction,
    matterType: opts.spec.matterType,
  });
  firmDal.insertUser({ firmId, userId: attorneyId, displayName: 'Thin Slice Attorney', role: 'attorney' });
  admissions.insert({
    firmId, attorneyId,
    jurisdiction: opts.spec.jurisdiction,
    barNumber: `THIN-${sliceN}`,
    admittedAt: '2010-01-01',
    status: 'active',
  });

  const keys = keySvc.provision(scope);
  const frameRef = frameDal.saveSnapshot(scope, {
    matterId,
    attorneyClientPairs: [{ attorneyId, clientId }],
  });

  const matterTrackDbPath = matterTrackPath(workspace, scope);
  const store = new MatterTrackStore(matterTrackDbPath);
  const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
  // AttorneyAction wiring exists for completeness; thin slice doesn't sign.
  void new AttorneyActionService(new AttorneyActionDal(db), admissions, writer);

  const runtime = new AgentRuntime({ registry, opStream });

  // Bind one agent per state-permitted agent referenced in the manifest
  const agentIds = new Set<string>();
  for (const s of manifest.states) for (const a of s.permittedAgents) agentIds.add(a);

  if (opts.llmRouting) {
    // Routing-driven path — provisions real LLM and CLI agents per state.
    const clv = new DbBackedCLV(new ClvDal(db));
    const promptRegistry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registerFamilyLawTemplates(promptRegistry);
    const invocationLogger = new InvocationLogger(writer, opStream);
    const builtAgents = await buildFamilyLawAgentsFromRouting({
      clv,
      templateRegistry: promptRegistry,
      providerRegistry,
      routing: opts.llmRouting,
      invocationLogger,
      cliSandboxRoot: path.join(workspace, 'cli-sandbox'),
    });
    for (const id of agentIds) {
      const agent = builtAgents.get(id);
      if (!agent) {
        throw new Error(`thin-slice: routing did not produce an agent for ${id}`);
      }
      runtime.bindAgent(agent);
    }
  } else {
    const agentFactory = opts.agentFactory ?? defaultAgentFactory;
    for (const id of agentIds) runtime.bindAgent(agentFactory(id, opts.spec));
  }

  const orchestrator = new Orchestrator({ manifestDal, activationDal: new ActivationDal(db), opStream, agentRuntime: runtime });
  const activationId = orchestrator.startActivation({
    scope, lensId: manifest.lensId, lensVersion: manifest.lensVersion, activatedBy: attorneyId,
  });

  const stateAgentMap: Record<string, string> = {};
  for (const s of manifest.states) stateAgentMap[s.stateId] = s.permittedAgents[0];

  const env = {
    privilegeFrame: frameRef,
    authorizedSources: [],
    authorizedPriorArtifacts: [],
    authorizedMMP: [],
    forbiddenScopes: [],
  };

  const captured: ThinSliceCaptured[] = [];
  for (const state of manifest.states) {
    const r = await orchestrator.advanceNextState({
      scope, activationId, stateInput: {}, envelopeContext: env, agentId: stateAgentMap[state.stateId],
    });
    if (r.status !== 'completed') {
      throw new Error(`thin-slice state ${state.stateId} did not complete: ${r.status}`);
    }
    captured.push({
      stateId: r.stateId,
      agentId: stateAgentMap[state.stateId],
      outputJson: JSON.stringify(r.output ?? {}),
      outputHash: r.outputHash ?? createHash('sha256').update(JSON.stringify(r.output ?? {})).digest('hex'),
      completedAt: new Date().toISOString(),
    });
  }

  const opTrackEventCount = opStream.recent(firmId, 1000).length;
  const matterTrackEventCount = store.listEvents().length;

  // Summary file
  const summary = {
    sliceNumber: sliceN,
    runId: randomUUID(),
    spec: opts.spec.handle,
    workspacePath: workspace,
    firmId,
    clientId,
    matterId,
    activationId,
    statesCompleted: captured.length,
    opTrackEventCount,
    matterTrackEventCount,
    capturedAt: new Date().toISOString(),
  };
  const summaryPath = path.join(workspace, 'thin-slice-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  store.close();
  db.close();

  return {
    workspacePath: workspace,
    platformDbPath,
    matterTrackDbPath,
    firmId,
    clientId,
    matterId,
    activationId,
    capturedStates: captured,
    opTrackEventCount,
    matterTrackEventCount,
    summaryPath,
  };
}

/** Parse a thin-slice spec markdown file. Tolerant — falls back to defaults. */
export function parseSpec(filePath: string): ThinSliceSpec {
  const raw = fs.readFileSync(filePath, 'utf8');
  const handle = path.basename(filePath, '.md');
  const titleMatch = /^#\s+(.+?)\s*$/m.exec(raw);
  const title = titleMatch?.[1] ?? handle;

  const sectionAfter = (heading: string): string | undefined => {
    const re = new RegExp(`###\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, 'i');
    const m = re.exec(raw);
    return m?.[1]?.trim();
  };

  const clientMessage = sectionAfter('Client message') ?? '';
  const orderExcerpt = sectionAfter('Custody order excerpt') ?? '';
  const intakeNotes = sectionAfter('Intake notes') ?? '';

  const jurisdictionMatch = /(?:^|\n)##\s*Jurisdiction\s*\n+([^\n#]+)/i.exec(raw);
  const matterTypeMatch = /(?:^|\n)##\s*Matter Type\s*\n+([^\n#]+)/i.exec(raw);
  const expectedPrimaryMatch = /Primary:\s*`([^`]+)`/.exec(raw);
  const expectedSecondaryMatches = Array.from(raw.matchAll(/Secondary:\s*`([^`]+)`/g)).map((m) => m[1]);

  return {
    handle,
    title,
    clientMessage: stripBlockquote(clientMessage),
    orderExcerpt: stripBlockquote(orderExcerpt),
    intakeNotes: stripBlockquote(intakeNotes),
    jurisdiction: jurisdictionMatch?.[1].trim() ?? 'MD',
    matterType: matterTypeMatch?.[1].trim().split(/\s/)[0]?.replace(/[`.,]/g, '') ?? 'unspecified',
    expectedPrimaryLens: expectedPrimaryMatch?.[1] ?? 'family_law_production_lens',
    expectedSecondaryLenses: expectedSecondaryMatches,
  };
}

function stripBlockquote(s: string): string {
  return s.split('\n').map((l) => l.replace(/^\s*>\s?/, '').trim()).filter(Boolean).join(' ');
}
