/**
 * Best-effort recovery helpers for model outputs that are intended to be JSON
 * but occasionally contain non-JSON quoting pathologies.
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

export function parseJsonWithRecovery(text: string): {
  parsed: Record<string, unknown> | null;
  jsonText: string | null;
  recovered: boolean;
  error?: string;
} {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { parsed: null, jsonText: null, recovered: false, error: 'No JSON object found in text' };
  }

  try {
    return {
      parsed: JSON.parse(jsonText) as Record<string, unknown>,
      jsonText,
      recovered: false,
    };
  } catch (err) {
    const repaired = repairJsonCommonModelPathologies(jsonText);
    if (repaired !== jsonText) {
      try {
        return {
          parsed: JSON.parse(repaired) as Record<string, unknown>,
          jsonText: repaired,
          recovered: true,
        };
      } catch {
        // Fall through to the original parse error so callers see the
        // first failure, not a secondary repaired failure.
      }
    }
    return {
      parsed: null,
      jsonText,
      recovered: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function repairJsonCommonModelPathologies(input: string): string {
  const normalizedLines = input
    .split('\n')
    .map((line) => repairSingleQuotedLineValue(line))
    .join('\n');

  let out = '';
  let i = 0;
  let inDouble = false;
  let escaped = false;

  while (i < normalizedLines.length) {
    const ch = normalizedLines[i];

    if (inDouble) {
      if (escaped) {
        out += isValidJsonEscape(ch)
          ? `\\${ch}`
          : `\\\\${ch}`;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else {
        out += ch;
        if (ch === '"') {
          inDouble = false;
        }
      }
      i++;
      continue;
    }

    if (ch === '\\') {
      // Outside strings, preserve the backslash as-is.
      out += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '\'') {
      const parsed = consumeSingleQuotedString(normalizedLines, i);
      if (!parsed) {
        out += ch;
        i++;
        continue;
      }
      out += `"${escapeForJson(parsed.value)}"`;
      i = parsed.nextIndex;
      continue;
    }

    out += ch;
    i++;
  }

  return stripTrailingCommas(out);
}

/**
 * Strip trailing commas before `}` / `]`. qwen3.5:9b + gemini reliably
 * emit JSON like:
 *   { "a": "b", }
 *   [ 1, 2, 3, ]
 *   { "a": { "b": 1, }, }
 * which is invalid strict JSON. The parser walks in/out of double-quoted
 * strings so commas inside string values (e.g. `"tuple-like, values"`)
 * are not touched.
 *
 * This is the pathology that caused the Hestami Phase 1.2 bloom to
 * fall through to the c1/Primary-interpretation placeholder — a 9KB
 * response with three real candidate concepts had one trailing comma
 * and JSON.parse rejected the whole thing at position 7217.
 */
function stripTrailingCommas(input: string): string {
  let out = '';
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inDouble) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else {
        out += ch;
        if (ch === '"') inDouble = false;
      }
      continue;
    }

    if (ch === '"') {
      out += ch;
      inDouble = true;
      continue;
    }

    if (ch === ',') {
      // Peek past whitespace/newlines for the next non-ws char.
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (j < input.length && (input[j] === '}' || input[j] === ']')) {
        // Drop this trailing comma. Keep the whitespace intact so
        // error-position reporting (if anything later fails) stays
        // aligned with the original text roughly.
        continue;
      }
    }

    out += ch;
  }

  return out;
}

function isValidJsonEscape(ch: string): boolean {
  return ch === '"' ||
    ch === '\\' ||
    ch === '/' ||
    ch === 'b' ||
    ch === 'f' ||
    ch === 'n' ||
    ch === 'r' ||
    ch === 't' ||
    ch === 'u';
}

function repairSingleQuotedLineValue(line: string): string {
  const mixedQuoteKeyValueMatch = /^(\s*"[^"]+"\s*:\s*)'(.*)"(\s*[,}\]])\s*$/.exec(line);
  if (mixedQuoteKeyValueMatch) {
    return `${mixedQuoteKeyValueMatch[1]}"${escapeForJson(`'${mixedQuoteKeyValueMatch[2]}`)}"${mixedQuoteKeyValueMatch[3]}`;
  }

  const keyValueMatch = /^(\s*"[^"]+"\s*:\s*)'(.*)'(\s*[,}\]])\s*$/.exec(line);
  if (keyValueMatch) {
    return `${keyValueMatch[1]}"${escapeForJson(keyValueMatch[2])}"${keyValueMatch[3]}`;
  }

  const mixedQuoteArrayValueMatch = /^(\s*)'(.*)"(\s*[,}\]])\s*$/.exec(line);
  if (mixedQuoteArrayValueMatch) {
    return `${mixedQuoteArrayValueMatch[1]}"${escapeForJson(`'${mixedQuoteArrayValueMatch[2]}`)}"${mixedQuoteArrayValueMatch[3]}`;
  }

  const arrayValueMatch = /^(\s*)'(.*)'(\s*[,}\]])\s*$/.exec(line);
  if (arrayValueMatch) {
    return `${arrayValueMatch[1]}"${escapeForJson(arrayValueMatch[2])}"${arrayValueMatch[3]}`;
  }

  return line;
}

function consumeSingleQuotedString(input: string, start: number): { value: string; nextIndex: number } | null {
  let i = start + 1;
  let value = '';
  let escaped = false;

  while (i < input.length) {
    const ch = input[i];
    if (escaped) {
      value += ch;
      escaped = false;
      i++;
      continue;
    }
    if (ch === '\\') {
      value += ch;
      escaped = true;
      i++;
      continue;
    }
    if (ch === '\'') {
      return { value, nextIndex: i + 1 };
    }
    value += ch;
    i++;
  }

  return null;
}

function escapeForJson(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
