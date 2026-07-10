/**
 * Shared probe runner for prompt template regression testing.
 *
 * Loads a prompt template, renders with test variables, sends to Ollama,
 * validates the JSON output against the artifact schema, and saves all
 * artifacts (prompt, request, response) to disk for manual inspection.
 */

import { TemplateLoader, type PromptTemplate } from '../../lib/orchestrator/templateLoader';
import { SchemaValidator } from '../../lib/orchestrator/schemaValidator';
import { callOllama, isOllamaAvailable, resolveSamplingForModel, shouldUseJsonFormat, type OllamaResponse } from '../helpers/ollamaClient';
import { judge, type JudgeRubric, type JudgeVerdict } from '../helpers/ollamaJudge';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import path from 'path';

const WORKSPACE_PATH = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = join(WORKSPACE_PATH, 'test-and-evaluation', 'prompt-probe-output');

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

/**
 * Build a ProbeResult for a failure that occurs before (or instead of) a
 * successful Ollama round-trip. Every early-exit path shares this empty
 * validation/response shape; only the error string and any partially
 * rendered prompt differ.
 */
function buildFailureResult(
  name: string,
  startTime: number,
  error: string,
  renderedPrompt: string,
): ProbeResult {
  return {
    name,
    success: false,
    schemaValid: false,
    schemaErrors: [],
    structuralValid: false,
    structuralErrors: [],
    response: null,
    parsed: null,
    renderedPrompt,
    durationMs: Date.now() - startTime,
    error,
    judgePassed: false,
  };
}

/**
 * Resolve the template referenced by the config: by explicit key, or by
 * (agentRole, subPhase). Returns null when neither selector is provided or
 * the lookup misses — the caller treats null as "template not found".
 */
function resolveTemplate(loader: TemplateLoader, config: ProbeConfig): PromptTemplate | null {
  if (config.templateKey) {
    return loader.getTemplate(config.templateKey);
  }
  if (config.agentRole && config.subPhase) {
    return loader.findTemplate(config.agentRole, config.subPhase);
  }
  return null;
}

type SamplingProfile = ReturnType<typeof resolveSamplingForModel>;

/**
 * Assemble the bare Ollama request body (as saved for manual replay) along
 * with the sampling profile and JSON-format decision used to build it.
 */
function buildRequestBody(
  model: string,
  numCtx: number,
  renderedPrompt: string,
): { requestBody: Record<string, unknown>; sampling: SamplingProfile; useJsonFormat: boolean } {
  const sampling = resolveSamplingForModel(model, { model, prompt: '' });
  const useJsonFormat = shouldUseJsonFormat(model);
  const requestBody = {
    model,
    prompt: renderedPrompt,
    stream: false,
    think: true,
    ...(useJsonFormat ? { format: 'json' } : {}),
    options: {
      ...sampling,
      num_ctx: numCtx,
    },
  };
  return { requestBody, sampling, useJsonFormat };
}

function logRequestInfo(
  name: string,
  model: string,
  numCtx: number,
  useJsonFormat: boolean,
  sampling: SamplingProfile,
  renderedPrompt: string,
): void {
  console.log(`\n[${name}] ── Ollama Request ──`);
  console.log(`  Model: ${model}`);
  console.log(`  num_ctx: ${numCtx}`);
  console.log(`  format: ${useJsonFormat ? 'json' : '(none — denied for this model)'}`);
  const presencePenaltyPart = sampling.presence_penalty ? ` presence_penalty=${sampling.presence_penalty}` : '';
  console.log(`  sampling: temp=${sampling.temperature} top_p=${sampling.top_p} top_k=${sampling.top_k}${presencePenaltyPart}`);
  console.log(`  Prompt length: ${renderedPrompt.length} chars (~${Math.ceil(renderedPrompt.length / 4)} tokens)`);
  console.log(`  Calling Ollama...`);
}

function logResponseInfo(ollamaResponse: OllamaResponse, startTime: number): void {
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
}

/** Persist the full response bundle plus the plain-text/parsed views. */
function saveResponseArtifacts(name: string, ollamaResponse: OllamaResponse, startTime: number): void {
  saveArtifact(name, 'response.json', JSON.stringify({
    response: ollamaResponse.response,
    responseRaw: ollamaResponse.responseRaw,
    thinking: ollamaResponse.thinking,
    parsed: ollamaResponse.parsed,
    model: ollamaResponse.model,
    totalDuration: ollamaResponse.totalDuration,
    durationSeconds: ((Date.now() - startTime) / 1000).toFixed(1),
  }, null, 2));

  // Plain text files for easy reading
  saveArtifact(name, 'response_only.txt', ollamaResponse.response);

  if (ollamaResponse.thinking) {
    saveArtifact(name, 'thinking.txt', ollamaResponse.thinking);
  }

  if (ollamaResponse.parsed) {
    saveArtifact(name, 'parsed.json', JSON.stringify(ollamaResponse.parsed, null, 2));
  }
}

/** Validate parsed output against the registered schema for its artifact type. */
function validateSchema(
  validator: SchemaValidator,
  expectedArtifactType: string,
  parsed: Record<string, unknown> | null,
): { schemaValid: boolean; schemaErrors: string[] } {
  if (parsed && validator.hasSchema(expectedArtifactType)) {
    const validation = validator.validate(expectedArtifactType, parsed);
    return {
      schemaValid: validation.valid,
      schemaErrors: validation.errors.map(e => `${e.path}: ${e.message}`),
    };
  }
  if (!parsed) {
    return { schemaValid: false, schemaErrors: ['Response did not parse as JSON'] };
  }
  return { schemaValid: false, schemaErrors: [`No schema found for ${expectedArtifactType}`] };
}

/** Run the caller-supplied structural assertions (vacuously valid if none). */
function runStructuralAssertions(
  parsed: Record<string, unknown> | null,
  structuralAssertions: ProbeConfig['structuralAssertions'],
): { structuralValid: boolean; structuralErrors: string[] } {
  if (parsed && structuralAssertions) {
    const structuralErrors = structuralAssertions(parsed);
    return { structuralValid: structuralErrors.length === 0, structuralErrors };
  }
  return { structuralValid: true, structuralErrors: [] };
}

function logJudgeVerdict(name: string, verdict: JudgeVerdict, durationMs: number): void {
  const passed = verdict.passed;
  console.log(`  ${passed ? '✓' : '✗'} Judge ${passed ? 'PASSED' : 'FAILED'} in ${(durationMs / 1000).toFixed(1)}s`);
  const reasoningPart = verdict.reasoningScore !== undefined ? `, reasoning: ${verdict.reasoningScore}/10` : '';
  console.log(`  Score: ${verdict.score}/10${reasoningPart}`);
  if (verdict.issues.length > 0) {
    console.log(`  Issues:`);
    for (const issue of verdict.issues) console.log(`    - ${issue}`);
  }
  if (verdict.rationale) {
    console.log(`  Rationale: ${verdict.rationale}`);
  }
}

/**
 * Second-stage Ollama assessment. Runs only when a rubric is provided and the
 * prior stages (parse + schema + structural) all passed (`canJudge`).
 * Returns a vacuous pass (verdict null, passed true) when skipped, and a
 * failed verdict when the judge call itself throws.
 */
async function runJudgeStage(
  config: ProbeConfig,
  renderedPrompt: string,
  ollamaResponse: OllamaResponse,
  numCtx: number,
  canJudge: boolean,
): Promise<{ judgeVerdict: JudgeVerdict | null; judgePassed: boolean }> {
  if (!config.judgeRubric || !canJudge) {
    return { judgeVerdict: null, judgePassed: true };
  }

  // Resolve judge config just before the call for manual replay parity.
  const judgeModel = config.judgeModel ?? process.env.OLLAMA_JUDGE_MODEL ?? 'qwen3.5:9b';
  const judgePassThreshold = config.judgePassThreshold ?? 7;

  console.log(`\n[${config.name}] ── Judge Stage ──`);
  console.log(`  Judge model: ${judgeModel}`);
  console.log(`  Pass threshold: ${judgePassThreshold}/10`);
  console.log(`  Calling judge...`);

  const judgeStartTime = Date.now();
  try {
    const judgeVerdict = await judge(
      config.judgeRubric,
      renderedPrompt,
      ollamaResponse.response,
      ollamaResponse.thinking,
      judgeModel,
      judgePassThreshold,
      numCtx,
    );

    logJudgeVerdict(config.name, judgeVerdict, Date.now() - judgeStartTime);

    // Save judge artifacts
    saveArtifact(config.name, 'judge_response.json', JSON.stringify(judgeVerdict, null, 2));
    if (judgeVerdict.judgeThinking) {
      saveArtifact(config.name, 'judge_thinking.txt', judgeVerdict.judgeThinking);
    }

    return { judgeVerdict, judgePassed: judgeVerdict.passed };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ Judge call FAILED: ${errorMsg}`);
    return {
      judgeVerdict: {
        score: 0,
        passed: false,
        issues: [`Judge call failed: ${errorMsg}`],
        rationale: '',
        rawText: '',
      },
      judgePassed: false,
    };
  }
}

export async function runProbe(config: ProbeConfig): Promise<ProbeResult> {
  const model = config.model ?? process.env.OLLAMA_PROBE_MODEL ?? 'qwen3.5:9b';
  const numCtx = config.numCtx ?? parseInt(process.env.OLLAMA_PROBE_NUM_CTX ?? '262144', 10);
  const startTime = Date.now();

  // Load and render template
  const loader = getTemplateLoader();
  const template = resolveTemplate(loader, config);

  if (!template) {
    const templateRef = config.templateKey ?? `${config.agentRole}/${config.subPhase}`;
    return buildFailureResult(config.name, startTime, `Template not found: ${templateRef}`, '');
  }

  const renderResult = loader.render(template, config.variables);
  if (renderResult.missing_variables.length > 0) {
    return buildFailureResult(
      config.name,
      startTime,
      `Missing variables: ${renderResult.missing_variables.join(', ')}`,
      renderResult.rendered,
    );
  }

  // Save rendered prompt to disk
  saveArtifact(config.name, 'prompt.txt', renderResult.rendered);

  // Build the request body for instrumentation
  const { requestBody, sampling, useJsonFormat } = buildRequestBody(model, numCtx, renderResult.rendered);

  // Save bare request body (for manual Postman/curl replay)
  saveArtifact(config.name, 'request.json', JSON.stringify(requestBody, null, 2));

  logRequestInfo(config.name, model, numCtx, useJsonFormat, sampling, renderResult.rendered);

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
    return buildFailureResult(config.name, startTime, `Ollama call failed: ${errorMsg}`, renderResult.rendered);
  }

  logResponseInfo(ollamaResponse, startTime);

  // Save all output artifacts for inspection
  saveResponseArtifacts(config.name, ollamaResponse, startTime);

  const parsed = ollamaResponse.parsed;

  // Schema validation
  const validator = getSchemaValidator();
  const { schemaValid, schemaErrors } = validateSchema(validator, config.expectedArtifactType, parsed);

  // Structural assertions
  const { structuralValid, structuralErrors } = runStructuralAssertions(parsed, config.structuralAssertions);

  // ── Judge Stage (second-stage Ollama assessment) ────────────────
  const canJudge = Boolean(parsed) && schemaValid && structuralValid;
  const { judgeVerdict, judgePassed } = await runJudgeStage(
    config,
    renderResult.rendered,
    ollamaResponse,
    numCtx,
    canJudge,
  );

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
