/**
 * Per-config workspace prep for Tier-1 runs.
 *
 * Each candidate gets a FRESH workspace directory seeded from the
 * Phase-8-complete reference workspace: the intent file and a config.json
 * with the executor routing pointed at the candidate model. No scaffold or
 * generated code is copied — `--resume-at-sub-phase scaffold_synthesis`
 * regenerates the project skeleton deterministically, so codegen artifacts
 * can never leak between configs. The reference DB itself is handed to the
 * CLI via --resume-from-db (which copies it; the reference is never mutated).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CandidateSpec } from './bakeoffConfig';

type JsonObject = Record<string, unknown>;

/**
 * Merge the candidate's executor routing into a reference config.json.
 * Pure — returns a new object. Everything else in the reference config
 * (upstream role routing, decomposition caps, execution rails) is kept,
 * per the locked decision that only the executor role is under test.
 */
export function mergeExecutorConfig(referenceConfig: JsonObject, candidate: CandidateSpec): JsonObject {
  const merged: JsonObject = structuredClone(referenceConfig);
  const routing = (merged.llm_routing ??= {}) as JsonObject;
  const executor = (routing.executor ??= {}) as JsonObject;
  executor.primary = {
    ...(executor.primary as JsonObject | undefined),
    backing_tool: 'goose_cli',
    provider: 'ollama',
    model: candidate.modelTag,
  };
  const execution = (merged.execution ??= {}) as JsonObject;
  execution.auto_approve_wave_gates = true;
  execution.unattended_skip_permissions = true;
  return merged;
}

export interface PreparedWorkspace {
  workspaceDir: string;
  intentPath: string;
}

export function prepareConfigWorkspace(opts: {
  referenceWorkspace: string;
  candidate: CandidateSpec;
  workspacesRoot: string;
}): PreparedWorkspace {
  const refJanumi = join(opts.referenceWorkspace, '.janumicode');
  const refIntent = join(refJanumi, 'intent.md');
  const refConfig = join(refJanumi, 'config.json');
  if (!existsSync(refIntent)) {
    throw new Error(`Reference workspace has no .janumicode/intent.md: ${opts.referenceWorkspace}`);
  }
  if (!existsSync(refConfig)) {
    throw new Error(`Reference workspace has no .janumicode/config.json: ${opts.referenceWorkspace}`);
  }

  const workspaceDir = join(opts.workspacesRoot, opts.candidate.slug);
  const janumiDir = join(workspaceDir, '.janumicode');
  if (existsSync(janumiDir)) {
    throw new Error(
      `Workspace already exists: ${workspaceDir} — a config re-run must start clean. ` +
      `Delete it (or use a new sweep outputDir) and retry.`,
    );
  }
  mkdirSync(janumiDir, { recursive: true });

  const intentPath = join(janumiDir, 'intent.md');
  copyFileSync(refIntent, intentPath);

  const referenceConfig = JSON.parse(readFileSync(refConfig, 'utf-8')) as JsonObject;
  const merged = mergeExecutorConfig(referenceConfig, opts.candidate);
  writeFileSync(join(janumiDir, 'config.json'), JSON.stringify(merged, null, 2), 'utf-8');

  return { workspaceDir, intentPath };
}
