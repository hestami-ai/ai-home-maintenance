/**
 * Phase 9.0 — Scaffolding Agent (Stage 1+2 inc.2, the "Replace" authoring).
 *
 * Under the agreed authorship model the AGENT authors all scaffolding from the
 * recon plan; the kernel only ENFORCES. This step launches one executor session
 * with a precise SKELETON mandate (NOT feature work): per area, author the
 * dependency manifest + language/build config, the canonical shared modules
 * (from the data models + interface contracts), the directory layout, and the
 * import aliases the recon plan specifies.
 *
 * Safety: a missing dependency manifest after the agent runs is a foundational
 * failure (every downstream leaf would fail to resolve imports), worse than the
 * run-to-run variance the model accepts. So the caller keeps the deterministic
 * materializer as a CATASTROPHIC SAFETY NET (not a hybrid fast-path): if the
 * agent produced no primary manifest, fall back to it. `producedPrimaryManifest`
 * reports that.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../../logging';
import type { PhaseContext } from '../orchestratorEngine';
import type { ExecutorAgent } from '../../agents/executorAgent';
import type { Phase9ReconPlan } from './phase9Recon';

export interface ScaffoldingAgentResult {
  /** True when every area's primary dependency manifest exists on disk after. */
  producedPrimaryManifest: boolean;
  invocationId: string | null;
  /** Per-area manifest existence (audit). */
  manifestsPresent: Record<string, boolean>;
}

export async function runScaffoldingAgentSubPhase(
  ctx: PhaseContext,
  plan: Phase9ReconPlan,
  executorAgent: ExecutorAgent,
): Promise<ScaffoldingAgentResult> {
  const { workflowRun, engine } = ctx;
  const workspacePath = engine.workspacePath;
  const logger = getLogger();

  const dataModels = gatherDataModels(engine, workflowRun.id);
  const contracts = gatherContracts(engine, workflowRun.id);

  // ONE session per area — a polyglot workspace must not cram N stacks into a
  // single agent context; each area's session sees only its own stack + the
  // shared types it exposes. (Single-area greenfield ⇒ exactly one session.)
  const invocationIds: string[] = [];
  for (const area of plan.areas) {
    const task = {
      id: `task-scaffolding-${area.area_id}`,
      taskType: 'standard' as const,
      componentId: 'scaffolding',
      componentResponsibility: `Author the ${area.area_id} (${area.stack}) skeleton: manifest, config, canonical shared modules, layout.`,
      description:
        `PROJECT SCAFFOLDING for area "${area.area_id}" (stack ${area.stack}). Author ONLY the skeleton the implementation `
        + 'tasks will build on — no feature logic. (1) create the dependency manifest with the dependencies the stack needs and '
        + 'a runnable test script; (2) create the language/build configuration; (3) create the canonical shared modules this area '
        + 'exposes (from the data models / contracts) at EXACTLY the given paths, importable via the given aliases; (4) create the '
        + 'directory layout. Match the stack exactly; keep modules minimal canonical type/interface definitions.',
      completionCriteria: [
        { criterionId: 'CC-SCAF-001', description: `Area ${area.area_id} has its dependency manifest + build/test config, and its canonical shared modules exist at their stated paths with working imports.` },
      ],
      writeDirectoryPaths: areaWriteScope(area),
    };
    const stdin = buildAreaScaffoldingPrompt(area, dataModels, contracts);
    try {
      const r = await executorAgent.execute(task, workflowRun.id, stdin, workspacePath, engine.janumiCodeVersionSha);
      invocationIds.push(r.invocationId);
    } catch (err) {
      logger.warn('workflow', 'Phase 9.0 scaffolding agent threw for area (catastrophic safety net may run)', {
        workflow_run_id: workflowRun.id, area: area.area_id, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const invocationId: string | null = invocationIds[0] ?? null;

  const manifestsPresent: Record<string, boolean> = {};
  for (const a of plan.areas) {
    const manifest = a.dependency_manifest || 'package.json';
    const rel = a.source_roots[0] && a.source_roots[0] !== 'src'
      ? path.join(areaRoot(a.source_roots[0]), manifest)
      : manifest;
    manifestsPresent[a.area_id] = fs.existsSync(path.join(workspacePath, manifest))
      || fs.existsSync(path.join(workspacePath, rel));
  }
  const producedPrimaryManifest = plan.areas.length > 0 && plan.areas.every(a => manifestsPresent[a.area_id]);

  logger.info('workflow', 'Phase 9.0 scaffolding agent complete', {
    workflow_run_id: workflowRun.id,
    produced_primary_manifest: producedPrimaryManifest,
    manifests_present: manifestsPresent,
  });
  return { producedPrimaryManifest, invocationId, manifestsPresent };
}

/** One area's scaffolding write scope: its source/test roots plus the area
 *  root where its dependency manifest lives. */
export function areaWriteScope(area: Phase9ReconPlan['areas'][number]): string[] {
  const dirs = new Set<string>();
  dirs.add(area.source_roots[0] ? areaRoot(area.source_roots[0]) : '.');
  for (const r of area.source_roots) dirs.add(r);
  for (const r of area.test_roots) dirs.add(r);
  return [...dirs];
}

export function areaRoot(sourceRoot: string): string {
  // 'services/billing/src' → 'services/billing'; 'src' → '.'
  const norm = sourceRoot.replace(/\\/g, '/').replace(/\/+$/g, '');
  const segs = norm.split('/');
  return segs.length <= 1 ? '.' : segs.slice(0, -1).join('/');
}

function gatherDataModels(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'data_models');
    return rec ? JSON.stringify((rec.content as Record<string, unknown>).models ?? rec.content, null, 1).slice(0, 8000) : '(none)';
  } catch { return '(none)'; }
}

function gatherContracts(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'interface_contracts');
    return rec ? JSON.stringify((rec.content as Record<string, unknown>).contracts ?? rec.content, null, 1).slice(0, 8000) : '(none)';
  } catch { return '(none)'; }
}

function buildAreaScaffoldingPrompt(area: Phase9ReconPlan['areas'][number], dataModels: string, contracts: string): string {
  const mods = area.canonical_modules.length
    ? area.canonical_modules.map(m => `  - ${m.path}  (import as ${m.import_specifier})${m.description ? ` — ${m.description}` : ''}`).join('\n')
    : '  (none listed — derive the shared types this area needs from the data models / contracts)';
  const aliases = area.import_aliases.map(al => `${al.alias} → ${al.target}`).join(', ') || '(none)';
  return `# Project Scaffolding — area "${area.area_id}" (stack ${area.stack})\n\n`
    + `Author ONLY this area's skeleton. No feature logic.\n\n`
    + `## Layout\n`
    + `- source roots: ${area.source_roots.join(', ') || '(unset)'}\n`
    + `- test roots: ${area.test_roots.join(', ') || '(unset)'}\n`
    + `- dependency manifest: ${area.dependency_manifest || 'package.json'}\n`
    + `- import aliases: ${aliases}\n\n`
    + `## Canonical shared modules to create (exact paths)\n${mods}\n\n`
    + `## Shared data models (materialize the types this area exposes)\n${dataModels}\n\n`
    + `## Interface contracts (materialize the contracts this area exposes)\n${contracts}\n\n`
    + `## Rules\n`
    + `- Create the dependency manifest with a runnable test script and the dependencies the ${area.stack} stack needs.\n`
    + `- Create the canonical shared modules at EXACTLY the listed paths, importable via the listed aliases — do not duplicate them.\n`
    + `- Honor the ${area.stack} stack; do not introduce another language.\n`
    + `- Verify the skeleton type-checks / parses before finishing.`;
}
