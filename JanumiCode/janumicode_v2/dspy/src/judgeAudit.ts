/**
 * Audit: run both LLM judges over N recorded outputs and dump every finding with
 * its location, alongside the parent's AC ids (from the prompt) and the output's
 * child AC ids. Lets us classify each finding as INHERITED (targets a mirrored
 * parent AC) vs SATURATION-OWNED (surfaced_assumptions / newly-authored children)
 * — the basis for scoping the metric to what this sub-phase actually controls.
 *
 *   JUDGE_PASSES=1 npx tsx dspy/src/judgeAudit.ts --n 5
 */
import { readFileSync } from 'fs';
import type { ValidatorRuntimeParams } from '../../src/lib/review/harness/validatorRegistry';
import { runJudges } from './judgeMetric';

function arg(name: string, fb: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fb;
}

function parentAcIds(prompt: string): string[] {
  // Parent ACs appear in the "# Parent being decomposed" block as "AC-...: ..."
  const ids = new Set<string>();
  for (const m of prompt.matchAll(/\b(AC-[A-Z0-9._-]+)\b/g)) ids.add(m[1]);
  return [...ids];
}

(async () => {
  const n = parseInt(arg('n', '5'), 10);
  const rows = readFileSync('dspy/trainsets/fr_saturation.trainset.jsonl', 'utf-8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // pick a spread: first few (roots/atomic) + a couple decomposables
  const picks = rows.slice(0, n);

  for (const ex of picks) {
    let oc: any = null;
    try { oc = JSON.parse(ex.recordedOutputText); } catch {}
    const params: ValidatorRuntimeParams = {
      agentRole: 'requirements_agent', subPhaseId: 'fr_saturation', agentOutputId: 'x',
      outputText: ex.recordedOutputText, outputContent: oc, outputThinking: null,
      originalPrompt: ex.prompt, originalSystem: null,
    };
    const pAcs = parentAcIds(ex.prompt.split('# Sibling context')[0] ?? ex.prompt);
    const childAcs: string[] = [];
    for (const c of (oc?.children ?? []))
      for (const a of (c?.acceptance_criteria ?? [])) if (a?.id) childAcs.push(a.id);
    const nAssumptions = Array.isArray(oc?.surfaced_assumptions) ? oc.surfaced_assumptions.length : 0;

    console.log('\n' + '='.repeat(70));
    console.log(ex.label);
    console.log(`classification=${oc?.parent_branch_classification}  parentACs=${pAcs.length}  childACs=${childAcs.length}  surfaced_assumptions=${nAssumptions}`);
    const findings = await runJudges(params);
    if (!findings.length) { console.log('  (no judge findings)'); continue; }
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.validatorId} :: ${f.type}`);
      console.log(`     loc: ${f.location || '(none)'}`);
      console.log(`     ${f.summary}`);
    }
  }
})();
