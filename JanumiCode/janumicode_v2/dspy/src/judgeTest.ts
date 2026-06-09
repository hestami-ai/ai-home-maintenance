/**
 * Smoke test: do the LLM judges actually fire on the known-defective US-001 output?
 * (US-001 bolted an audit-log AC with an invented 2s SLA + actor_id, and left
 * surfaced_assumptions citations empty.)
 *
 *   JUDGE_MODEL=qwen3.5:9b npx tsx dspy/src/judgeTest.ts [--label US-001]
 */
import { readFileSync } from 'fs';
import type { ValidatorRuntimeParams } from '../../src/lib/review/harness/validatorRegistry';
import { runJudges, JUDGE_MODEL } from './judgeMetric';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

(async () => {
  const labelNeedle = arg('label', 'US-001 (depth 0');
  const rows = readFileSync('dspy/trainsets/fr_saturation.trainset.jsonl', 'utf-8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const ex = rows.find((e: any) => e.label.includes(labelNeedle));
  if (!ex) { console.error(`no example matching "${labelNeedle}"`); process.exit(1); }

  const params: ValidatorRuntimeParams = {
    agentRole: 'requirements_agent', subPhaseId: 'fr_saturation', agentOutputId: 'x',
    outputText: ex.recordedOutputText, outputContent: JSON.parse(ex.recordedOutputText),
    outputThinking: null, originalPrompt: ex.prompt, originalSystem: null,
  };

  console.log(`Judge model: ${JUDGE_MODEL}`);
  console.log(`Example: ${ex.label}`);
  const t0 = Date.now();
  const findings = await runJudges(params);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  if (!findings.length) { console.log('NO findings.'); return; }
  for (const f of findings) {
    console.log(`[${f.severity}] ${f.validatorId} :: ${f.type}`);
    console.log(`   ${f.summary}`);
    if (f.location) console.log(`   @ ${f.location}`);
  }
})();
