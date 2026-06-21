/**
 * Phase-9 executor model bakeoff — CLI entry point.
 *
 *   npx tsx scripts/model-bakeoff/run-bakeoff.ts \
 *     --config scripts/model-bakeoff/sweep-matrix.smoke.json \
 *     --tier 1 [--resume] [--only <slug>]
 *
 * Flags:
 *   --config <path>   sweep matrix JSON (see bakeoffConfig.ts for the schema)
 *   --tier 1|2        Tier 1 = resumed Phase-9 corpus; Tier 2 = fresh full-slice
 *   --resume          skip configs already completed in sweep-state.json
 *   --only <slug>     run a single candidate (debugging)
 *   --validate        validate the matrix and exit
 *
 * Preconditions for a live run (NOT enforced here):
 *   - `pnpm build` so dist/cli/janumicode.js is current
 *   - the GPU has headroom for the candidate model (the harness uses the system
 *     resident models but won't fight another training/eval process)
 *   - a Phase-8-complete reference workspace + DB (run the TinyURL intent
 *     with --phase-limit 8 once and point the matrix at it)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateSweepConfig } from './bakeoffConfig';
import { runTierOne } from './tierOneRunner';
import { runTierTwo } from './tierTwoRunner';

interface CliArgs {
  config: string;
  tier: '1' | '2';
  resume: boolean;
  only?: string;
  validate: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { config: '', tier: '1', resume: false, validate: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--config':
        args.config = argv[++i] ?? '';
        break;
      case '--tier': {
        const t = argv[++i];
        if (t !== '1' && t !== '2') throw new Error(`--tier must be 1 or 2 (got ${t})`);
        args.tier = t;
        break;
      }
      case '--resume':
        args.resume = true;
        break;
      case '--only':
        args.only = argv[++i];
        break;
      case '--validate':
        args.validate = true;
        break;
      default:
        throw new Error(`Unknown flag: ${argv[i]}`);
    }
  }
  if (args.config === '') throw new Error('--config <path> is required');
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(args.config);
  if (!existsSync(configPath)) throw new Error(`Sweep matrix not found: ${configPath}`);

  const { config, errors, warnings } = validateSweepConfig(JSON.parse(readFileSync(configPath, 'utf-8')));
  for (const w of warnings) console.warn(`[bakeoff] WARNING: ${w}`);
  if (config === null) {
    for (const e of errors) console.error(`[bakeoff] ERROR: ${e}`);
    process.exit(2);
  }
  if (args.validate) {
    console.log(`[bakeoff] matrix OK: ${config.candidates.length} candidate(s), ${warnings.length} warning(s)`);
    return;
  }

  // Resolve paths relative to the matrix's own directory semantics: the
  // matrix stores absolute paths or paths relative to the repo cwd.
  config.referenceWorkspace = resolve(config.referenceWorkspace);
  config.referenceDb = resolve(config.referenceDb);
  config.outputDir = resolve(config.outputDir);
  if (!existsSync(config.referenceWorkspace)) {
    throw new Error(`referenceWorkspace not found: ${config.referenceWorkspace}`);
  }
  if (!existsSync(config.referenceDb)) {
    throw new Error(`referenceDb not found: ${config.referenceDb}`);
  }

  if (args.tier === '1') {
    await runTierOne(config, { resume: args.resume, only: args.only });
  } else {
    await runTierTwo(config, { resume: args.resume, only: args.only });
  }
}

main().catch((err) => {
  console.error(`[bakeoff] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
