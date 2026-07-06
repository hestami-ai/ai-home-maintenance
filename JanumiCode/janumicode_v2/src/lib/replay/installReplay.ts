/**
 * Replay wiring — decides what to register on the engine/liaison in replay mode.
 *
 * Tier-1 (record playback): fail-loud providers, no CLI resolver — nothing
 *   should call an LLM/CLI (the webview is fed recorded rows directly).
 * Tier-2 (engine replay, JANUMICODE_REPLAY_ENGINE=1): recorded-output
 *   ReplayLLMProvider under every provider name (Seam A) + a CLI replay
 *   resolver on AgentInvoker (Seam B), both fed from a fixture map loaded from
 *   an `--export-json` NDJSON (JANUMICODE_REPLAY_FIXTURE). Falls back to Tier-1
 *   fail-loud if the fixture is missing.
 */

import * as fs from 'node:fs';
import type { LLMProviderAdapter } from '../llm/llmCaller';
import type { AgentInvocationOptions, AgentInvocationResult } from '../orchestrator/agentInvoker';
import type { CLIInvocationResult } from '../cli/cliInvoker';
import { getLogger } from '../logging';
import { buildFailLoudProviders } from './failLoudProvider';
import { buildReplayLLMProviders, ReplayMissError } from './replayLLMProvider';
import { ReplayFixtureMap } from './replayFixtureMap';

export interface ReplayInstall {
  /** Register these under every provider name on the engine caller + liaison. */
  llmProviders: LLMProviderAdapter[];
  /** Seam-B resolver for AgentInvoker (Tier-2 only; null for Tier-1). */
  cliResolver: ((o: AgentInvocationOptions) => AgentInvocationResult | null) | null;
  /** The loaded fixture map (null → Tier-1 fail-loud). */
  map: ReplayFixtureMap | null;
}

export function buildReplayInstall(engineReplay: boolean, strict: boolean): ReplayInstall {
  if (!engineReplay) {
    return { llmProviders: buildFailLoudProviders(), cliResolver: null, map: null };
  }
  const fixturePath = process.env.JANUMICODE_REPLAY_FIXTURE;
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    getLogger().error(
      'activation',
      'JANUMICODE_REPLAY_ENGINE=1 but JANUMICODE_REPLAY_FIXTURE missing/not found — '
      + 'falling back to Tier-1 fail-loud (no engine replay).',
      { fixturePath: fixturePath ?? '(unset)' },
    );
    return { llmProviders: buildFailLoudProviders(), cliResolver: null, map: null };
  }
  const map = ReplayFixtureMap.fromNdjson(fixturePath);
  return {
    llmProviders: buildReplayLLMProviders(map, strict),
    cliResolver: makeCliReplayResolver(map, strict),
    map,
  };
}

/** Seam-B CLI resolver: recorded executor output, or a hermetic empty result. */
export function makeCliReplayResolver(
  map: ReplayFixtureMap,
  strict: boolean,
): (o: AgentInvocationOptions) => AgentInvocationResult | null {
  return (options: AgentInvocationOptions): AgentInvocationResult | null => {
    // direct_llm_api is replayed at Seam A (the LLMCaller's replay provider).
    if (options.backingTool === 'direct_llm_api') return null;
    const out = map.lookupCLI(options.prompt);
    if (out) return { success: true, cliResult: synthCliResult(out.text) };
    if (strict) {
      throw new ReplayMissError(`CLI ${options.backingTool} role=${options.agentRole} (no recorded output)`);
    }
    getLogger().warn('ui', 'replay CLI MISS (lenient) — empty result', {
      role: options.agentRole,
      backing: options.backingTool,
    });
    // Return a hermetic empty result (NOT null) so invoke() doesn't fall
    // through to invokeCLI and trip the gpuGuard by spawning a subprocess.
    return { success: true, cliResult: synthCliResult('') };
  };
}

function synthCliResult(text: string): CLIInvocationResult {
  return {
    exitCode: 0,
    timedOut: false,
    idledOut: false,
    noContentTimedOut: false,
    events: [],
    stdoutText: text,
    stderr: '',
    durationMs: 0,
  };
}
