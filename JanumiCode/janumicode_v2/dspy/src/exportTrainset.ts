/**
 * Export a trainset for a saturation sub-phase from a workspace governed_stream DB.
 *
 *   npx tsx dspy/src/exportTrainset.ts --db <path> --out <jsonl> \
 *       [--sub-phase fr_saturation] [--agent-role requirements_agent] \
 *       [--label-filter "decomposition of"]
 *
 * Each line is a TrainExample: the rendered prompt + the recorded model output.
 */

import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { TrainExample } from './types';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

const dbPath = arg('db');
const outPath = arg('out');
const subPhase = arg('sub-phase', 'fr_saturation')!;
const agentRole = arg('agent-role', 'requirements_agent')!;
const labelFilter = arg('label-filter', 'decomposition of')!;

if (!dbPath || !outPath) {
  console.error('Usage: exportTrainset.ts --db <path> --out <jsonl> [--sub-phase ..] [--agent-role ..] [--label-filter ..]');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const invocations = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE record_type = 'agent_invocation'
     AND sub_phase_id = ?
     AND produced_by_agent_role = ?
     AND is_current_version = 1
`).all(subPhase, agentRole) as Array<{ id: string; content: string }>;

const outputStmt = db.prepare(`
  SELECT content FROM governed_stream
   WHERE record_type = 'agent_output'
     AND is_current_version = 1
     AND derived_from_record_ids LIKE ?
   LIMIT 1
`);

const examples: TrainExample[] = [];
let skippedNoOutput = 0;
let skippedLabel = 0;
let skippedError = 0;

for (const inv of invocations) {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(inv.content);
  } catch {
    skippedError++;
    continue;
  }
  const label = String(c.label ?? '');
  if (labelFilter && !label.toLowerCase().includes(labelFilter.toLowerCase())) {
    skippedLabel++;
    continue;
  }
  const outRow = outputStmt.get(`%${inv.id}%`) as { content: string } | undefined;
  if (!outRow) { skippedNoOutput++; continue; }
  let oc: Record<string, unknown>;
  try {
    oc = JSON.parse(outRow.content);
  } catch {
    skippedError++;
    continue;
  }
  if (oc.status !== 'success') { skippedNoOutput++; continue; }

  examples.push({
    invocationId: inv.id,
    label,
    agentRole,
    subPhaseId: subPhase,
    prompt: String(c.prompt ?? ''),
    system: (c.system as string | null) ?? null,
    recordedOutputText: String(oc.text ?? ''),
    provider: String(c.provider ?? ''),
    model: String(c.model ?? ''),
  });
}

db.close();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, examples.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');

console.log(`Exported ${examples.length} examples → ${outPath}`);
console.log(`  scanned ${invocations.length} invocations for (${agentRole}, ${subPhase})`);
console.log(`  skipped: label-mismatch=${skippedLabel}, no-success-output=${skippedNoOutput}, parse-error=${skippedError}`);
