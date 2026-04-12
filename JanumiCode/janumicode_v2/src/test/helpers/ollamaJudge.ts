/**
 * Ollama-backed judge for prompt-regression probes.
 * Ported from v1.
 *
 * Calls Ollama a second time after a generator probe, asking it to score
 * the generated output against a rubric. Captures the judge's own thinking
 * trace. Lower temperature than the generator to keep verdicts stable.
 */

import { callOllama } from './ollamaClient';

export interface JudgeRubric {
  name: string;
  criteria: string[];
  reasoningCriteria?: string[];
}

export interface JudgeVerdict {
  score: number;           // 0-10, structural/semantic answer quality
  reasoningScore?: number; // 0-10, generator-thinking quality
  passed: boolean;
  issues: string[];
  rationale: string;
  judgeThinking?: string;
  rawText: string;
}

const DEFAULT_REASONING_CRITERIA = [
  'Reasoning is on-topic and addresses the input.',
  'Reasoning identifies concrete entities, not vague placeholders.',
  'Reasoning leads to the final answer without contradicting it.',
];

export function buildJudgePrompt(
  rubric: JudgeRubric,
  inputPrompt: string,
  generatedOutput: string,
  generatorThinking: string | undefined,
): string {
  const answerCriteria = rubric.criteria.map(c => `- ${c}`).join('\n');
  const reasoningCriteria = [
    ...DEFAULT_REASONING_CRITERIA,
    ...(rubric.reasoningCriteria ?? []),
  ].map(c => `- ${c}`).join('\n');

  return [
    'You are a strict architecture-review judge. Score the GENERATED output 0-10 against the ANSWER CRITERIA, and (separately) score the GENERATOR THINKING 0-10 against the REASONING CRITERIA.',
    'Return ONLY a JSON object with this exact shape and nothing else:',
    '{"score": <integer 0-10>, "reasoningScore": <integer 0-10>, "issues": [<string>, ...], "rationale": "<one or two sentences>"}',
    '',
    `ANSWER CRITERIA for ${rubric.name}:`,
    answerCriteria,
    '',
    'REASONING CRITERIA:',
    reasoningCriteria,
    '',
    'INPUT PROMPT (what the generator was asked to produce):',
    '<<<',
    inputPrompt,
    '>>>',
    '',
    'GENERATED OUTPUT:',
    '<<<',
    generatedOutput,
    '>>>',
    '',
    'GENERATOR THINKING:',
    '<<<',
    generatorThinking ?? '(no thinking captured)',
    '>>>',
  ].join('\n');
}

function clampInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export async function judge(
  rubric: JudgeRubric,
  inputPrompt: string,
  generatedOutput: string,
  generatorThinking: string | undefined,
  model?: string,
  passThreshold = 7,
  numCtx?: number,
): Promise<JudgeVerdict> {
  const judgeModel = model ?? process.env.OLLAMA_JUDGE_MODEL ?? 'qwen3.5:9b';
  const prompt = buildJudgePrompt(rubric, inputPrompt, generatedOutput, generatorThinking);

  const resp = await callOllama({
    model: judgeModel,
    prompt,
    think: true,
    format: 'json',
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    numCtx,
  });

  const parsed = (resp.parsed && typeof resp.parsed === 'object')
    ? resp.parsed as Record<string, unknown>
    : {};

  const score = clampInt(parsed.score, 0);
  const reasoningScoreRaw = parsed.reasoningScore;
  const reasoningScore = reasoningScoreRaw == null ? undefined : clampInt(reasoningScoreRaw, 0);
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter(x => typeof x === 'string') as string[]
    : [];
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';

  const passed = score >= passThreshold && (reasoningScore === undefined || reasoningScore >= passThreshold);

  return {
    score,
    reasoningScore,
    passed,
    issues,
    rationale,
    judgeThinking: resp.thinking,
    rawText: resp.response,
  };
}
