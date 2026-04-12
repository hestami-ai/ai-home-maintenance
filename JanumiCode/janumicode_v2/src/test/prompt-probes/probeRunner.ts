/**
 * Shared probe runner for prompt template regression testing.
 *
 * Loads a prompt template, renders with test variables, sends to Ollama,
 * validates the JSON output against the artifact schema, and saves all
 * artifacts (prompt, request, response) to disk for manual inspection.
 */

import { TemplateLoader } from '../../lib/orchestrator/templateLoader';
import { SchemaValidator } from '../../lib/orchestrator/schemaValidator';
import { callOllama, isOllamaAvailable, resolveSamplingForModel, shouldUseJsonFormat, type OllamaResponse } from '../helpers/ollamaClient';
import { judge, type JudgeRubric, type JudgeVerdict } from '../helpers/ollamaJudge';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import path from 'path';

const WORKSPACE_PATH = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = join(WORKSPACE_PATH, 'test-output', 'prompt-probes');

// ── Types ───────────────────────────────────────────────────────────

export interface ProbeConfig {
  /** Probe name (used for output files) */
  name: string;
  /** Template key (relative path without .md) */
  templateKey?: string;
  /** Or find by agent role + sub-phase */
  agentRole?: string;
  subPhase?: string;
  /** Variables to render the template with */
  variables: Record<string, string>;
  /** Expected artifact type (for schema validation) */
  expectedArtifactType: string;
  /** Ollama model to use */
  model?: string;
  /** Context window size */
  numCtx?: number;
  /** Structural assertions on the parsed output */
  structuralAssertions?: (parsed: Record<string, unknown>) => string[];
  /** Optional judge rubric — runs a second-stage Ollama assessment */
  judgeRubric?: JudgeRubric;
  /** Override judge model (defaults to OLLAMA_JUDGE_MODEL or qwen3.5:9b) */
  judgeModel?: string;
  /** Pass threshold for judge scores (0-10, default 7) */
  judgePassThreshold?: number;
}

export interface ProbeResult {
  name: string;
  success: boolean;
  /** Schema validation passed */
  schemaValid: boolean;
  schemaErrors: string[];
  /** Structural assertions passed */
  structuralValid: boolean;
  structuralErrors: string[];
  /** Raw Ollama response */
  response: OllamaResponse | null;
  /** Parsed JSON output */
  parsed: Record<string, unknown> | null;
  /** Rendered prompt */
  renderedPrompt: string;
  /** Duration in ms */
  durationMs: number;
  /** Error if probe failed before Ollama call */
  error?: string;
  /** Judge verdict (only present when judgeRubric was provided) */
  judgeVerdict?: JudgeVerdict | null;
  /** Whether the judge passed — true if no rubric (vacuous), false if judge failed */
  judgePassed: boolean;
}

// ── Probe Runner ────────────────────────────────────────────────────

let templateLoader: TemplateLoader | null = null;
let schemaValidator: SchemaValidator | null = null;

function getTemplateLoader(): TemplateLoader {
  if (!templateLoader) templateLoader = new TemplateLoader(WORKSPACE_PATH);
  return templateLoader;
}

function getSchemaValidator(): SchemaValidator {
  if (!schemaValidator) schemaValidator = new SchemaValidator(WORKSPACE_PATH);
  return schemaValidator;
}

export async function checkOllama(): Promise<boolean> {
  return isOllamaAvailable();
}

export async function runProbe(config: ProbeConfig): Promise<ProbeResult> {
  const model = config.model ?? process.env.OLLAMA_PROBE_MODEL ?? 'qwen3.5:9b';
  const numCtx = config.numCtx ?? parseInt(process.env.OLLAMA_PROBE_NUM_CTX ?? '262144', 10);
  const startTime = Date.now();

  // Load and render template
  const loader = getTemplateLoader();
  let template;

  if (config.templateKey) {
    template = loader.getTemplate(config.templateKey);
  } else if (config.agentRole && config.subPhase) {
    template = loader.findTemplate(config.agentRole, config.subPhase);
  }

  if (!template) {
    return {
      name: config.name,
      success: false,
      schemaValid: false,
      schemaErrors: [],
      structuralValid: false,
      structuralErrors: [],
      response: null,
      parsed: null,
      renderedPrompt: '',
      durationMs: Date.now() - startTime,
      error: `Template not found: ${config.templateKey ?? `${config.agentRole}/${config.subPhase}`}`,
      judgePassed: false,
    };
  }

  const renderResult = loader.render(template, config.variables);
  if (renderResult.missing_variables.length > 0) {
    return {
      name: config.name,
      success: false,
      schemaValid: false,
      schemaErrors: [],
      structuralValid: false,
      structuralErrors: [],
      response: null,
      parsed: null,
      renderedPrompt: renderResult.rendered,
      durationMs: Date.now() - startTime,
      error: `Missing variables: ${renderResult.missing_variables.join(', ')}`,
      judgePassed: false,
    };
  }

  // Save rendered prompt to disk
  saveArtifact(config.name, 'prompt.txt', renderResult.rendered);

  // Build the request body for instrumentation
  const sampling = resolveSamplingForModel(model, { model, prompt: '' });
  const useJsonFormat = shouldUseJsonFormat(model);
  const requestBody = {
    model,
    prompt: renderResult.rendered,
    stream: false,
    think: true,
    ...(useJsonFormat ? { format: 'json' } : {}),
    options: {
      ...sampling,
      num_ctx: numCtx,
    },
  };

  // Save bare request body (for manual Postman/curl replay)
  saveArtifact(config.name, 'request.json', JSON.stringify(requestBody, null, 2));

  console.log(`\n[${config.name}] ── Ollama Request ──`);
  console.log(`  Model: ${model}`);
  console.log(`  num_ctx: ${numCtx}`);
  console.log(`  format: ${useJsonFormat ? 'json' : '(none — denied for this model)'}`);
  console.log(`  sampling: temp=${sampling.temperature} top_p=${sampling.top_p} top_k=${sampling.top_k}${sampling.presence_penalty ? ` presence_penalty=${sampling.presence_penalty}` : ''}`);
  console.log(`  Prompt length: ${renderResult.rendered.length} chars (~${Math.ceil(renderResult.rendered.length / 4)} tokens)`);
  console.log(`  Calling Ollama...`);

  // Call Ollama
  let ollamaResponse: OllamaResponse;
  try {
    ollamaResponse = await callOllama({
      model,
      prompt: renderResult.rendered,
      format: 'json',
      numCtx,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ Ollama call FAILED: ${errorMsg}`);
    return {
      name: config.name,
      success: false,
      schemaValid: false,
      schemaErrors: [],
      structuralValid: false,
      structuralErrors: [],
      response: null,
      parsed: null,
      renderedPrompt: renderResult.rendered,
      durationMs: Date.now() - startTime,
      error: `Ollama call failed: ${errorMsg}`,
      judgePassed: false,
    };
  }

  console.log(`  ✓ Ollama responded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`  Response length: ${ollamaResponse.response.length} chars`);
  console.log(`  Thinking length: ${ollamaResponse.thinking.length} chars`);
  console.log(`  Parsed as JSON: ${ollamaResponse.parsed ? 'yes' : 'NO'}`);
  if (ollamaResponse.parsed) {
    console.log(`  Top-level keys: ${Object.keys(ollamaResponse.parsed).join(', ')}`);
  } else {
    // Show first 500 chars of raw response for debugging
    console.log(`  Raw response (first 500 chars):\n    ${ollamaResponse.response.slice(0, 500).replace(/\n/g, '\n    ')}`);
  }

  // Save all output artifacts for inspection
  saveArtifact(config.name, 'response.json', JSON.stringify({
    response: ollamaResponse.response,
    responseRaw: ollamaResponse.responseRaw,
    thinking: ollamaResponse.thinking,
    parsed: ollamaResponse.parsed,
    model: ollamaResponse.model,
    totalDuration: ollamaResponse.totalDuration,
    durationSeconds: ((Date.now() - startTime) / 1000).toFixed(1),
  }, null, 2));

  // Plain text files for easy reading
  saveArtifact(config.name, 'response_only.txt', ollamaResponse.response);

  if (ollamaResponse.thinking) {
    saveArtifact(config.name, 'thinking.txt', ollamaResponse.thinking);
  }

  if (ollamaResponse.parsed) {
    saveArtifact(config.name, 'parsed.json', JSON.stringify(ollamaResponse.parsed, null, 2));
  }

  const parsed = ollamaResponse.parsed;

  // Schema validation
  const validator = getSchemaValidator();
  let schemaValid = false;
  let schemaErrors: string[] = [];

  if (parsed && validator.hasSchema(config.expectedArtifactType)) {
    const validation = validator.validate(config.expectedArtifactType, parsed);
    schemaValid = validation.valid;
    schemaErrors = validation.errors.map(e => `${e.path}: ${e.message}`);
  } else if (!parsed) {
    schemaErrors = ['Response did not parse as JSON'];
  } else {
    schemaErrors = [`No schema found for ${config.expectedArtifactType}`];
  }

  // Structural assertions
  let structuralValid = true;
  let structuralErrors: string[] = [];

  if (parsed && config.structuralAssertions) {
    structuralErrors = config.structuralAssertions(parsed);
    structuralValid = structuralErrors.length === 0;
  }

  // ── Judge Stage (second-stage Ollama assessment) ────────────────
  let judgeVerdict: JudgeVerdict | null = null;
  let judgePassed = true; // vacuously true when no rubric provided

  if (config.judgeRubric && parsed && schemaValid && structuralValid) {
    // Save the judge prompt + request body BEFORE calling the judge for manual replay
    const judgeModel = config.judgeModel ?? process.env.OLLAMA_JUDGE_MODEL ?? 'qwen3.5:9b';
    const judgePassThreshold = config.judgePassThreshold ?? 7;

    console.log(`\n[${config.name}] ── Judge Stage ──`);
    console.log(`  Judge model: ${judgeModel}`);
    console.log(`  Pass threshold: ${judgePassThreshold}/10`);
    console.log(`  Calling judge...`);

    const judgeStartTime = Date.now();
    try {
      judgeVerdict = await judge(
        config.judgeRubric,
        renderResult.rendered,
        ollamaResponse.response,
        ollamaResponse.thinking,
        judgeModel,
        judgePassThreshold,
        numCtx,
      );

      const judgeDurationMs = Date.now() - judgeStartTime;
      judgePassed = judgeVerdict.passed;

      console.log(`  ${judgePassed ? '✓' : '✗'} Judge ${judgePassed ? 'PASSED' : 'FAILED'} in ${(judgeDurationMs / 1000).toFixed(1)}s`);
      console.log(`  Score: ${judgeVerdict.score}/10${judgeVerdict.reasoningScore !== undefined ? `, reasoning: ${judgeVerdict.reasoningScore}/10` : ''}`);
      if (judgeVerdict.issues.length > 0) {
        console.log(`  Issues:`);
        for (const issue of judgeVerdict.issues) console.log(`    - ${issue}`);
      }
      if (judgeVerdict.rationale) {
        console.log(`  Rationale: ${judgeVerdict.rationale}`);
      }

      // Save judge artifacts
      saveArtifact(config.name, 'judge_response.json', JSON.stringify(judgeVerdict, null, 2));
      if (judgeVerdict.judgeThinking) {
        saveArtifact(config.name, 'judge_thinking.txt', judgeVerdict.judgeThinking);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Judge call FAILED: ${errorMsg}`);
      judgePassed = false;
      judgeVerdict = {
        score: 0,
        passed: false,
        issues: [`Judge call failed: ${errorMsg}`],
        rationale: '',
        rawText: '',
      };
    }
  }

  const success = schemaValid && structuralValid && judgePassed;
  const durationMs = Date.now() - startTime;

  // Save final result
  saveArtifact(config.name, 'result.json', JSON.stringify({
    name: config.name,
    success,
    schemaValid,
    schemaErrors,
    structuralValid,
    structuralErrors,
    judgePassed,
    judgeScore: judgeVerdict?.score,
    judgeReasoningScore: judgeVerdict?.reasoningScore,
    judgeIssues: judgeVerdict?.issues,
    model,
    durationMs,
  }, null, 2));

  return {
    name: config.name,
    success,
    schemaValid,
    schemaErrors,
    structuralValid,
    structuralErrors,
    response: ollamaResponse,
    parsed,
    renderedPrompt: renderResult.rendered,
    durationMs,
    judgeVerdict,
    judgePassed,
  };
}

function saveArtifact(probeName: string, filename: string, content: string): void {
  const dir = join(OUTPUT_DIR, probeName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, 'utf-8');
}
