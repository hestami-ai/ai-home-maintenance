/**
 * Per-config workspace prep for Tier-1 runs.
 *
 * Each candidate gets a FRESH workspace directory seeded from the
 * Phase-8-complete reference workspace: the intent file and a config.json
 * with the executor routing pointed at the candidate model. No scaffold or
 * generated code is copied — resuming at `reconnaissance` re-runs all of
 * Phase 9 (recon → scaffold → implement) fresh, so codegen artifacts can never
 * leak between configs. The reference DB itself is handed to the CLI via
 * --resume-from-db (which copies it; the reference is never mutated).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CandidateSpec } from './bakeoffConfig';

type JsonObject = Record<string, unknown>;

/**
 * Pre-seed the hermetic goose config so a fresh GOOSE_PATH_ROOT does NOT block
 * on goose's first-run onboarding (the interactive "Share anonymous usage
 * data? Yes/No" consent prompt + provider setup). Without this, every candidate
 * hangs forever at session start — goose never issues an inference call (the
 * smoke run sat at 5% GPU with the model loaded but idle).
 *
 * Records telemetry consent (key presence = decided) and a CONFIGURED ollama
 * provider pointed at the system ollama server. Per-candidate model/host are still
 * overridden by the CLI flags + env the runner sets; this only satisfies
 * onboarding. Returns the config path written.
 */
export function seedGooseConfig(gooseRoot: string, opts: { modelTag: string; ollamaPort: number }): string {
  const configDir = join(gooseRoot, 'config');
  mkdirSync(configDir, { recursive: true });
  const host = `http://127.0.0.1:${opts.ollamaPort}`;
  // Minimal known-good shape (mirrors a configured goose config.yaml).
  const yaml = [
    'GOOSE_TELEMETRY_ENABLED: false',
    `OLLAMA_HOST: ${host}`,
    // 30 min: a reasoning model (gpt-oss) can stream a long chain-of-thought
    // for a complex leaf; the 600s default cut the goose request off mid-stream
    // → "Stream decode error: error decoding response body" (confirmed by the
    // ollama server logging a 500 + cancel at exactly ~10m0s).
    'OLLAMA_TIMEOUT: 1800',
    'active_provider: ollama',
    'providers:',
    '  ollama:',
    '    enabled: true',
    `    model: ${opts.modelTag}`,
    '    configured: true',
    '',
  ].join('\n');
  const configPath = join(configDir, 'config.yaml');
  writeFileSync(configPath, yaml, 'utf-8');
  return configPath;
}

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
  // Disable the packet-coherence cycle loop (9→7→8→9). A LANGUAGE bakeoff
  // measures executor code quality on ONE clean Phase-9 pass; the multi-cycle
  // decomposition-convergence loop is orthogonal and (per the smoke run) never
  // converged in 4h, producing zero executor metrics. NOTE: the resumed run's
  // DB field workflow_runs.max_cycles_per_release takes precedence over config,
  // so the reference DB is also set to 0 (see prepare-reference notes).
  execution.max_cycles_per_release = 0;
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
