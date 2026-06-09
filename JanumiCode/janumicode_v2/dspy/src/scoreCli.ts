/**
 * Score ONE candidate output. Reads a JSON request from stdin, prints a JSON
 * ScoreResult to stdout. Called by the Python DSPy metric (one process per call).
 *
 * Request shape:
 *   { "agentRole": "...", "subPhaseId": "...", "prompt": "...",
 *     "system": null, "outputText": "..." }
 *
 * Usage:
 *   echo '<json>' | npx tsx dspy/src/scoreCli.ts
 */

import { scoreCandidate, type ScoreInput } from './metric';
import { scoreWithJudges } from './judgeMetric';

const WITH_JUDGES = process.argv.includes('--with-judges');

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

(async () => {
  try {
    const raw = await readStdin();
    const req = JSON.parse(raw) as Partial<ScoreInput>;
    const input: ScoreInput = {
      agentRole: req.agentRole ?? 'requirements_agent',
      subPhaseId: req.subPhaseId ?? 'fr_saturation',
      prompt: req.prompt ?? '',
      system: req.system ?? null,
      outputText: req.outputText ?? '',
    };
    const result = WITH_JUDGES ? await scoreWithJudges(input) : scoreCandidate(input);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stderr.write(`scoreCli error: ${err instanceof Error ? err.message : String(err)}\n`);
    // Emit a zero score so the optimizer treats a malformed candidate as worst-case.
    process.stdout.write(JSON.stringify({ score: 0, parseOk: false, penalty: 0, byValidator: [], totalFindings: 0 }));
    process.exit(0);
  }
})();
