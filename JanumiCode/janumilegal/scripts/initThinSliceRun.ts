#!/usr/bin/env tsx
/**
 * Thin-slice run initializer.
 *
 * Mirrors `JanumiCode/janumicode_v2/scripts/init-thin-slice-run.sh` for
 * JanumiLegal. Cross-platform TypeScript implementation.
 *
 * Creates a numbered workspace under `test-and-evaluation/thin-slice-workspaces/`,
 * loads a thin-slice spec, runs the lens activation end-to-end with replay
 * agents, captures all op-track + matter-track + state-output records,
 * writes a summary JSON.
 *
 * Usage:
 *   tsx scripts/initThinSliceRun.ts [-s <spec-path>] [-y] [--dry-run]
 *
 * Options:
 *   -s <spec-path>  Spec markdown file (default: single_issue_access_denial.md).
 *   -y              Skip confirmation.
 *   --dry-run       Print the planned actions without creating workspace.
 *
 * Run from a regular shell, not from inside a Claude Code session.
 *
 * Exit codes:
 *   0 — workspace created and run completed.
 *   2 — usage error.
 *   3 — spec or workspace path invalid.
 *   4 — runner threw.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runThinSlice, parseSpec } from '../src/lib/calibration/thinSlice.js';
import type { FirmLlmRouting } from '../src/layer3_firm_config/types.js';
import type { ProviderName } from '../src/lib/llm/providerRegistry.js';
import type { CliKind } from '../src/lib/agents/cliBackedAgent.js';

const REPO_ROOT = path.resolve(__dirname, '..');
const SPEC_DIR = path.join(REPO_ROOT, 'test-and-evaluation', 'thin-slice-specs');
const WORKSPACE_ROOT = path.join(REPO_ROOT, 'test-and-evaluation', 'thin-slice-workspaces');
const DEFAULT_SPEC = path.join(SPEC_DIR, 'single_issue_access_denial.md');

interface Args {
  specPath: string;
  skipConfirm: boolean;
  dryRun: boolean;
  provider?: ProviderName;
  fallback?: ProviderName;
  cli?: CliKind;
  /** Comma-separated list of state IDs to route to the CLI (rest use the LLM). */
  cliStates?: string[];
  ollamaModel?: string;
  ollamaEndpoint?: string;
}

const PROVIDERS = new Set<ProviderName>(['mock', 'ollama', 'anthropic', 'google']);
const CLIS = new Set<CliKind>(['goose', 'claude', 'codex', 'gemini']);

function parseArgs(argv: string[]): Args {
  const out: Args = { specPath: DEFAULT_SPEC, skipConfirm: false, dryRun: false };
  const valueOf = (a: string, prefix: string): string | undefined =>
    a.startsWith(prefix + '=') ? a.slice(prefix.length + 1) : undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue; // pnpm/npm pass-through separator
    if (a === '-s') out.specPath = path.resolve(argv[++i]);
    else if (a === '-y') out.skipConfirm = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '-h' || a === '--help') {
      console.error(helpText());
      process.exit(0);
    } else {
      const provider = valueOf(a, '--provider');
      const fallback = valueOf(a, '--fallback');
      const cli = valueOf(a, '--cli');
      const cliStates = valueOf(a, '--cli-states');
      const ollamaModel = valueOf(a, '--ollama-model');
      const ollamaEndpoint = valueOf(a, '--ollama-endpoint');
      if (provider !== undefined) {
        if (!PROVIDERS.has(provider as ProviderName)) {
          console.error(`[init-thin-slice] unknown provider: ${provider}`);
          process.exit(2);
        }
        out.provider = provider as ProviderName;
      } else if (fallback !== undefined) {
        if (!PROVIDERS.has(fallback as ProviderName)) {
          console.error(`[init-thin-slice] unknown fallback: ${fallback}`);
          process.exit(2);
        }
        out.fallback = fallback as ProviderName;
      } else if (cli !== undefined) {
        if (!CLIS.has(cli as CliKind)) {
          console.error(`[init-thin-slice] unknown cli: ${cli}`);
          process.exit(2);
        }
        out.cli = cli as CliKind;
      } else if (cliStates !== undefined) {
        out.cliStates = cliStates.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (ollamaModel !== undefined) {
        out.ollamaModel = ollamaModel;
      } else if (ollamaEndpoint !== undefined) {
        out.ollamaEndpoint = ollamaEndpoint;
      } else {
        console.error(`[init-thin-slice] unknown option: ${a}`);
        process.exit(2);
      }
    }
  }
  return out;
}

function helpText(): string {
  return [
    'Usage: tsx scripts/initThinSliceRun.ts [-s <spec-path>] [-y] [--dry-run]',
    '                                       [--provider=<name>] [--fallback=<name>]',
    '                                       [--cli=<name>] [--cli-states=<id,id>]',
    '                                       [--ollama-model=<m>] [--ollama-endpoint=<url>]',
    '',
    'Options:',
    '  -s <spec-path>          Thin-slice spec markdown (default: single_issue_access_denial.md)',
    '  -y                      Skip confirmation prompt',
    '  --dry-run               Print actions without creating workspace',
    '  --provider=<name>       LLM provider for non-CLI states: mock|ollama|anthropic|google',
    '  --fallback=<name>       Optional fallback provider when primary fails',
    '  --cli=<name>            CLI for CLI-routed states: goose|claude|codex|gemini',
    '  --cli-states=<id,id>    Comma-separated state IDs routed to --cli (rest use --provider)',
    '  --ollama-model=<m>      Ollama model name (default llama3.1:8b)',
    '  --ollama-endpoint=<url> Ollama HTTP endpoint (default http://127.0.0.1:11434)',
    '',
    'Without --provider/--cli, runs structurally with replay agents.',
  ].join('\n');
}

function buildRouting(args: Args): FirmLlmRouting | undefined {
  if (!args.provider && !args.cli) return undefined;
  const providerSettings: Record<string, Record<string, unknown>> = {};
  if (args.provider === 'ollama' || args.fallback === 'ollama') {
    providerSettings.ollama = {};
    if (args.ollamaModel) providerSettings.ollama.model = args.ollamaModel;
    if (args.ollamaEndpoint) providerSettings.ollama.endpoint = args.ollamaEndpoint;
  }
  const defaultKind: 'llm' | 'cli' = args.provider ? 'llm' : 'cli';
  const perState = args.cli && args.cliStates
    ? args.cliStates.map((stateId) => ({
        stateId,
        kind: 'cli' as const,
        cli: args.cli,
      }))
    : undefined;
  return {
    defaultKind,
    defaultProvider: args.provider,
    defaultFallback: args.fallback,
    defaultCli: args.cli,
    perState,
    providerSettings: providerSettings as FirmLlmRouting['providerSettings'],
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.specPath)) {
    console.error(`[init-thin-slice] spec not found: ${args.specPath}`);
    return 3;
  }
  const spec = parseSpec(args.specPath);
  console.error(`[init-thin-slice] spec: ${spec.handle}`);
  console.error(`[init-thin-slice] title: ${spec.title}`);
  console.error(`[init-thin-slice] jurisdiction: ${spec.jurisdiction}`);
  console.error(`[init-thin-slice] matter type: ${spec.matterType}`);

  if (args.dryRun) {
    console.error('[init-thin-slice] --dry-run; not creating workspace.');
    return 0;
  }

  if (!args.skipConfirm) {
    process.stderr.write(`[init-thin-slice] proceed? [y/N] `);
    const ans = await readLine();
    if (!/^y(es)?$/i.test(ans.trim())) {
      console.error('[init-thin-slice] aborted.');
      return 0;
    }
  }

  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

  const llmRouting = buildRouting(args);
  if (llmRouting) {
    console.error(`[init-thin-slice] llm routing: defaultKind=${llmRouting.defaultKind} provider=${llmRouting.defaultProvider ?? '-'} cli=${llmRouting.defaultCli ?? '-'} fallback=${llmRouting.defaultFallback ?? '-'}`);
  } else {
    console.error('[init-thin-slice] llm routing: (none — using replay agents)');
  }

  try {
    const result = await runThinSlice({ workspaceRoot: WORKSPACE_ROOT, spec, llmRouting });
    console.error(`[init-thin-slice] workspace: ${result.workspacePath}`);
    console.error(`[init-thin-slice] summary  : ${result.summaryPath}`);
    console.error(`[init-thin-slice] states completed: ${result.capturedStates.length}`);
    console.error(`[init-thin-slice] op-track events: ${result.opTrackEventCount}`);
    console.error(`[init-thin-slice] matter-track events: ${result.matterTrackEventCount}`);
    console.error('');
    console.error('Next: operator review pass (LLM-backed):');
    console.error(`  tsx scripts/thinSliceReview.ts --workspace ${result.workspacePath} --out ${path.join(result.workspacePath, 'thin-slice-review.md')}`);
    return 0;
  } catch (err) {
    console.error(`[init-thin-slice] runner threw: ${(err as Error).message}`);
    return 4;
  }
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', (chunk: Buffer) => resolve(chunk.toString()));
  });
}

main().then((code) => process.exit(code));
