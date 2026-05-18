/**
 * `pnpm regression:extract --db <path> [--templates a,b,c] [--validators all|a,b,c] [--overwrite]`
 *
 * `--templates`  selects producer-template fixtures.
 * `--validators` selects validator (reasoning-review harness) fixtures.
 *                Pass `all` to include every validator that fired in the run.
 * If both flags are supplied, both extractors run.
 * If neither flag is supplied, the producer extractor runs on every known
 * template (preserves prior behavior).
 */
import { extract } from '../extractor.js';
import { extractValidators } from '../extractorValidators.js';

function parseArgs(argv: string[]): {
  db?: string;
  templates?: string[];
  validators?: string[] | 'all';
  overwrite: boolean;
  workflowRunId?: string;
  sampleSlug?: string;
} {
  const out: {
    db?: string;
    templates?: string[];
    validators?: string[] | 'all';
    overwrite: boolean;
    workflowRunId?: string;
    sampleSlug?: string;
  } = { overwrite: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--templates') out.templates = argv[++i]?.split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--validators') {
      const raw = argv[++i];
      if (!raw || raw === 'all') {
        out.validators = 'all';
      } else {
        out.validators = raw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else if (a === '--overwrite') out.overwrite = true;
    else if (a === '--workflow-run-id') out.workflowRunId = argv[++i];
    else if (a === '--sample-slug') out.sampleSlug = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) {
    console.error('Usage: pnpm regression:extract --db <path> [--templates fr_bloom_skeleton,...] [--validators all|id,id] [--overwrite] [--workflow-run-id <id>] [--sample-slug <slug>]');
    process.exit(2);
  }

  const writtenAll: string[] = [];
  const skippedAll: { reason: string; sub_phase: string }[] = [];

  // Producer extractor runs when --validators is NOT exclusively the only
  // selector (i.e. --templates was specified, or neither flag was given).
  const runProducers = !args.validators || args.templates !== undefined;
  if (runProducers) {
    const result = await extract({
      dbPath: args.db,
      templates: args.templates,
      overwrite: args.overwrite,
      workflowRunId: args.workflowRunId,
      sampleSlug: args.sampleSlug,
    });
    writtenAll.push(...result.written);
    skippedAll.push(...result.skipped);
  }

  if (args.validators) {
    const result = await extractValidators({
      dbPath: args.db,
      validators: args.validators,
      overwrite: args.overwrite,
      workflowRunId: args.workflowRunId,
      sampleSlug: args.sampleSlug,
    });
    writtenAll.push(...result.written);
    for (const s of result.skipped) {
      skippedAll.push({ reason: s.reason, sub_phase: `validator:${s.validator_id}` });
    }
  }

  console.log(`Wrote ${writtenAll.length} fixture(s):`);
  for (const p of writtenAll) console.log(`  ${p}`);
  if (skippedAll.length > 0) {
    console.log(`\nSkipped ${skippedAll.length}:`);
    for (const s of skippedAll) {
      console.log(`  [${s.sub_phase}] ${s.reason}`);
    }
  }
  process.exit(writtenAll.length === 0 && skippedAll.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
