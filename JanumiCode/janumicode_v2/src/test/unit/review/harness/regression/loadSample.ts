/**
 * Track D Commit 11 — captured-sample loader.
 *
 * Reads one of the 12 markdown samples under
 * `docs/reasoning review prompt template redesign/track_c_samples/` and
 * extracts the four canonical sections plus the (agent_role, sub_phase)
 * inferred from the filename.
 *
 * Sample structure (every file uses these top-level headers):
 *   ## Original prompt (system + user)
 *   ## Agent thinking / reasoning chain
 *   ## Agent final response
 *   ## Current reasoning review output
 *
 * The thinking / response / current-review sections wrap their bodies in
 * a single fenced code block. The user prompt body lives inside a
 * `### User prompt` fenced block under the Original-prompt section.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SAMPLES_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'reasoning review prompt template redesign',
  'track_c_samples',
);

export interface LoadedSample {
  sampleId: string;
  agentRole: string;
  subPhaseId: string;
  prompt: string;
  systemPrompt: string;
  thinking: string;
  response: string;
  /** Best-effort JSON.parse of the response body; null when not parsable. */
  responseParsed: Record<string, unknown> | null;
  currentReview: string;
}

const SAMPLES_BY_ID: Record<string, string> = {
  '01_orchestrator__intent_quality_check':
    '01_orchestrator__intent_quality_check.md',
  '02_orchestrator__intent_lens_classification':
    '02_orchestrator__intent_lens_classification.md',
  '03_domain_interpreter__product_intent_discovery':
    '03_domain_interpreter__product_intent_discovery.md',
  '04_domain_interpreter__compliance_retention_discovery':
    '04_domain_interpreter__compliance_retention_discovery.md',
  '05_domain_interpreter__business_domains_bloom':
    '05_domain_interpreter__business_domains_bloom.md',
  '06_domain_interpreter__user_journey_bloom':
    '06_domain_interpreter__user_journey_bloom.md',
  '07_domain_interpreter__product_description_synthesis':
    '07_domain_interpreter__product_description_synthesis.md',
  '08_orchestrator__release_plan': '08_orchestrator__release_plan.md',
  '09_requirements_agent__fr_bloom_skeleton':
    '09_requirements_agent__fr_bloom_skeleton.md',
  '10_requirements_agent__fr_bloom_enrichment':
    '10_requirements_agent__fr_bloom_enrichment.md',
  '11_requirements_agent__nfr_bloom_skeleton':
    '11_requirements_agent__nfr_bloom_skeleton.md',
  '12_requirements_agent__nfr_bloom_enrichment':
    '12_requirements_agent__nfr_bloom_enrichment.md',
};

export const SAMPLE_IDS = Object.keys(SAMPLES_BY_ID);

/**
 * Parse "NN_<role>__<sub_phase>" → { agentRole, subPhaseId }. The role
 * uses single underscores so we split on the first '__' separator.
 */
function parseFilenameMeta(sampleId: string): {
  agentRole: string;
  subPhaseId: string;
} {
  // Drop the leading "NN_"
  const withoutNumber = sampleId.replace(/^\d+_/, '');
  const sepIdx = withoutNumber.indexOf('__');
  if (sepIdx < 0) {
    throw new Error(`Invalid sample id: ${sampleId}`);
  }
  return {
    agentRole: withoutNumber.slice(0, sepIdx),
    subPhaseId: withoutNumber.slice(sepIdx + 2),
  };
}

/**
 * Extract the body of the FIRST fenced code block (``` ... ```) appearing
 * in `text`, or null when no fenced block is present.
 */
const CODE_BLOCK_REGEX = /```[a-zA-Z0-9]*\n([\s\S]*?)\n```/;

function firstCodeBlock(text: string): string | null {
  // Match ```optional-lang\n...```
  const match = CODE_BLOCK_REGEX.exec(text);
  return match ? match[1] : null;
}

/**
 * Find the User-prompt code block specifically (under "### User prompt"),
 * which is itself nested under "## Original prompt (system + user)".
 */
function extractUserPrompt(originalPromptSection: string): string {
  const userMarker = originalPromptSection.indexOf('### User prompt');
  if (userMarker < 0) return '';
  const tail = originalPromptSection.slice(userMarker);
  return firstCodeBlock(tail) ?? '';
}

function extractSystemPrompt(originalPromptSection: string): string {
  const sysMarker = originalPromptSection.indexOf('### System prompt');
  if (sysMarker < 0) return '';
  // Stop before User prompt section.
  const userMarker = originalPromptSection.indexOf('### User prompt', sysMarker);
  const slice =
    userMarker > 0
      ? originalPromptSection.slice(sysMarker, userMarker)
      : originalPromptSection.slice(sysMarker);
  const body = firstCodeBlock(slice) ?? '';
  return body.trim() === '(none)' ? '' : body;
}

const SECTION_MARKERS = {
  ORIGINAL: '\n## Original prompt (system + user)',
  THINKING: '\n## Agent thinking / reasoning chain',
  RESPONSE: '\n## Agent final response',
  REVIEW: '\n## Current reasoning review output',
} as const;

function sliceSection(
  contents: string,
  startMarker: string,
  endMarker: string | null,
): string {
  const start = contents.indexOf(startMarker);
  if (start < 0) return '';
  const from = start + startMarker.length;
  const end = endMarker ? contents.indexOf(endMarker, from) : -1;
  return end < 0 ? contents.slice(from) : contents.slice(from, end);
}

export function loadSample(sampleId: string): LoadedSample {
  const fileName = SAMPLES_BY_ID[sampleId];
  if (!fileName) throw new Error(`Unknown sample id: ${sampleId}`);

  const filePath = path.join(SAMPLES_DIR, fileName);
  // Normalise CRLF -> LF (Windows line endings break the regex). Prepend
  // a newline so SECTION_MARKERS (which begin with "\n") match even when
  // a section header is at the very start of the file.
  const raw = fs.readFileSync(filePath, 'utf-8').replaceAll('\r\n', '\n');
  const contents = '\n' + raw;

  const { agentRole, subPhaseId } = parseFilenameMeta(sampleId);

  const originalSection = sliceSection(
    contents,
    SECTION_MARKERS.ORIGINAL,
    SECTION_MARKERS.THINKING,
  );
  const thinkingSection = sliceSection(
    contents,
    SECTION_MARKERS.THINKING,
    SECTION_MARKERS.RESPONSE,
  );
  const responseSection = sliceSection(
    contents,
    SECTION_MARKERS.RESPONSE,
    SECTION_MARKERS.REVIEW,
  );
  const reviewSection = sliceSection(contents, SECTION_MARKERS.REVIEW, null);

  const prompt = extractUserPrompt(originalSection);
  const systemPrompt = extractSystemPrompt(originalSection);
  const thinking = firstCodeBlock(thinkingSection) ?? '';
  const response = firstCodeBlock(responseSection) ?? '';
  const currentReview = firstCodeBlock(reviewSection) ?? '';

  let responseParsed: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(response);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      responseParsed = parsed as Record<string, unknown>;
    }
  } catch {
    responseParsed = null;
  }

  return {
    sampleId,
    agentRole,
    subPhaseId,
    prompt,
    systemPrompt,
    thinking,
    response,
    responseParsed,
    currentReview,
  };
}
