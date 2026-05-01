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

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
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
} {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { parsed: null, jsonText: null, error: 'No JSON object found in text' };
  }
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return { parsed, jsonText };
  } catch (err) {
    return {
      parsed: null,
      jsonText,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Backward-compat alias. Prefer `tryParseJson` in new code.
 * @deprecated Use `tryParseJson`.
 */
export const parseJsonWithRecovery = tryParseJson;
