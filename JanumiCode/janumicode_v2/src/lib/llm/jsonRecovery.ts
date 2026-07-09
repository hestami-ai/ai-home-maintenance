/**
 * Minimal JSON extraction + parse helpers for model outputs that are
 * intended to be JSON.
 *
 * Local pathology repair (regex passes that tried to fix qwen / gemma
 * malformations) was removed: the patterns weren't robust or scalable,
 * each new pathology became another whack-a-mole rule. JSON malformations
 * are now handled by an LLM-based repair fallback (`jsonRepairLLM.ts`)
 * — see LLMCaller's success path.
 *
 * What's left here is purely structural unwrapping: strip a markdown
 * code fence if the model wrapped the JSON, locate the first `{` and
 * last `}`, then `JSON.parse`. No mutation of the JSON content itself.
 */

/**
 * Locate a JSON object within a model response. Handles three shapes:
 *
 *   1. Response is a JSON object directly (most common with
 *      `responseFormat: 'json'`).
 *   2. Response is wrapped in a ```json …``` markdown fence.
 *   3. Response has prose preamble/postamble around a JSON object —
 *      use the outermost `{` … `}` span.
 *
 * Returns the candidate JSON text (still potentially malformed) or
 * `null` if no JSON-shaped content was found at all.
 */
export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  const fenceMatch = text.match(/```(?:json)?([\s\S]*?)```/);
  if (fenceMatch?.[1]?.trim().startsWith('{')) {
    return fenceMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

/**
 * Try to parse `text` as a JSON object. Returns the parsed object on
 * success or `null` on any failure. Performs structural unwrapping
 * (markdown fences, prose preamble) but no content repair.
 *
 * Callers that need pathology recovery should fall back to the LLM
 * repair path (`jsonRepairLLM.repairJsonViaLLM`) — this function does
 * not attempt regex-based fixes.
 */
export function tryParseJson(text: string): {
  parsed: Record<string, unknown> | null;
  jsonText: string | null;
  error?: string;
  /** True when the parse only succeeded after `repairStructuralJson`. */
  structurallyRepaired?: boolean;
} {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { parsed: null, jsonText: null, error: 'No JSON object found in text' };
  }
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return { parsed, jsonText };
  } catch (err) {
    // Deterministic STRUCTURAL repair attempt (not content-pathology
    // guessing): balance unclosed braces/brackets and strip trailing
    // commas. Models (gpt-oss/qwen) reliably miscount closers on deeply
    // nested output (Phase 5 api_definitions: full JSON-Schema
    // inputs/outputs). This salvages the REAL content the model produced
    // rather than discarding it — ts-117 lost correct api definitions to
    // a fabricated fallback because this layer didn't exist. Strictly
    // structural completion; never invents field values.
    try {
      const repairedText = repairStructuralJson(jsonText);
      const parsed = JSON.parse(repairedText) as Record<string, unknown>;
      return { parsed, jsonText: repairedText, structurallyRepaired: true };
    } catch { /* fall through to failure */ }
    return {
      parsed: null,
      jsonText,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Deterministic structural JSON repair. Performs ONLY structural
 * completion — it never guesses or invents content:
 *
 *   1. Strip trailing commas before `}` / `]` (and at EOF).
 *   2. Close an unterminated trailing string.
 *   3. Append the missing closing `}` / `]` for any brackets/braces left
 *      open at end-of-text, in the correct nesting order.
 *
 * String/escape state is tracked so braces inside string literals are
 * ignored. This recovers truncated or miscounted-closer output (the
 * dominant Phase 5 failure mode) while remaining faithful to whatever the
 * model actually emitted up to the truncation point. Returns the original
 * text unchanged when nothing is unbalanced.
 */
export function repairStructuralJson(jsonText: string): string {
  const stripTrailingCommas = (x: string): string => x.replace(/,(\s*[}\]])/g, '$1');
  let s = stripTrailingCommas(jsonText);
  const { stack, inString } = scanJsonStructure(s);
  if (inString) s += '"';
  const closer: Record<string, string> = { '{': '}', '[': ']' };
  for (let i = stack.length - 1; i >= 0; i--) s += closer[stack[i]];
  return stripTrailingCommas(s);
}

/** Walk `s` tracking string/escape state; return the still-open
 *  bracket/brace stack and whether the text ended inside a string. */
function scanJsonStructure(s: string): { stack: string[]; inString: boolean } {
  const stack: string[] = [];
  let inString = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (inString) {
      if (ch === '\\') esc = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if ((ch === '}' && stack.at(-1) === '{') || (ch === ']' && stack.at(-1) === '[')) stack.pop();
  }
  return { stack, inString };
}

/**
 * Backward-compat alias. Prefer `tryParseJson` in new code.
 * @deprecated Use `tryParseJson`.
 */
export const parseJsonWithRecovery = tryParseJson;
