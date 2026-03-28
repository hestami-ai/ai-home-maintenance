# Observability: LLM API Call and CLI Invocation Logging Plan

## Problem Statement

During the investigation of the missing `userJourneys`/`personas` bug, the critical question was:
**"What did the synthesis LLM actually receive and return?"**

We could trace the answer only because `cli_invocation`-type commands happen to store a `stdin` line (the full piped prompt) and `detail` lines (raw streaming JSONL fragments). But this was accidental coverage — the fragmented detail lines require reconstruction, and direct API calls (Narrative Curator, Intake Classifier, etc.) store only a human-readable summary and brief explanation, not the actual request/response payloads.

---

## Current State of Logging

### What IS captured

| Command Type | Captured |
|---|---|
| `cli_invocation` (Gemini/Claude CLI) | `stdin` = full piped prompt; `detail` = raw streaming JSONL lines (fragments); `reasoning_review` = reviewer output |
| `role_invocation` (Context Engineer wrapper) | `summary` lines only (start/complete labels) |
| `llm_api_call` (direct Anthropic SDK calls) | `summary` = one-line human-readable description; `detail` = one short excerpt from the response (narrative curator: first 200 chars of context) |

### What is NOT captured

1. **LLM API call request bodies** — the `messages[]` array, `systemPrompt`, model name, temperature, and `maxTokens` sent to the Anthropic API are never persisted.
2. **LLM API call full response bodies** — only a brief summary excerpt is stored; the complete `content[0].text` is not persisted.
3. **Parsed CLI responses** — for CLI invocations, the final extracted JSON (the LLM's actual structured answer after parsing out JSONL events) is not stored as a discrete artifact; it must be reconstructed from 100+ `detail` fragment lines.
4. **Token counts for direct API calls** — usage metadata (`input_tokens`, `output_tokens`, `cache_read_input_tokens`) is logged to console/logger but not persisted to the DB.
5. **Context pack sent to CLI roles** — for `role_invocation` commands that wrap a Context Engineer + CLI pipeline, only the Context Engineer's output summary is stored, not the full assembled context pack that was passed downstream.

---

## Diagnosis of the Synthesis Bug Using Current Logging

With current logging, it was possible (but difficult) to reconstruct the bug:

1. Found the synthesis command ID by label: `"Technical Expert — Plan Synthesis"` (`command_type=cli_invocation`)
2. Concatenated all 100 `detail` fragment lines to reconstruct the response JSON
3. Searched the reconstructed JSON for `userJourneys` → found `"userJourneys": []`
4. Confirmed the fix by reading `technicalExpertIntake.ts` source

This took multiple queries. With proper observability it would have been a single query.

---

## Proposed Solution

### New `line_type` values in `workflow_command_outputs`

Add to the `line_type` CHECK constraint in `schema.ts`:

```sql
line_type TEXT NOT NULL CHECK(line_type IN (
  'summary', 'detail', 'error', 'stdin',
  'tool_input', 'tool_output', 'reasoning_review',
  -- NEW:
  'request_body',    -- Full JSON request payload (messages[], systemPrompt, model, params)
  'response_body',   -- Full JSON/text response body (parsed final answer)
  'token_usage'      -- Token usage metadata as JSON { inputTokens, outputTokens, cacheRead }
))
```

---

### Change 1: Direct LLM API Calls (`narrativeCurator.ts`, `intakeClassifier.ts`, `responseEvaluator.ts`)

**Where**: Every call site that does `provider.complete({ systemPrompt, messages, model, ... })` and then emits a `workflow:command` event.

**What to add** — after the `action: 'start'` emit and before the API call:

```typescript
// Log full request payload for diagnostics
emitWorkflowCommand({
  dialogueId,
  commandId,
  action: 'output',
  commandType: 'llm_api_call',
  lineType: 'request_body',
  summary: `Request: ${model} (${messages.length} messages)`,
  detail: JSON.stringify({ model, systemPrompt, messages, maxTokens, temperature }),
  timestamp: new Date().toISOString(),
  collapsed: true,
});
```

**What to add** — in the success path, before the `action: 'complete'` emit:

```typescript
// Log full response for diagnostics
emitWorkflowCommand({
  dialogueId,
  commandId,
  action: 'output',
  commandType: 'llm_api_call',
  lineType: 'response_body',
  summary: `Response (${result.value.content.length} chars)`,
  detail: result.value.content,  // full text
  timestamp: new Date().toISOString(),
  collapsed: true,
});

// Log token usage
if (result.value.usage) {
  emitWorkflowCommand({
    dialogueId,
    commandId,
    action: 'output',
    commandType: 'llm_api_call',
    lineType: 'token_usage',
    summary: `Tokens: ${result.value.usage.inputTokens}+${result.value.usage.outputTokens} (cache: ${result.value.usage.cacheReadInputTokens ?? 0})`,
    detail: JSON.stringify(result.value.usage),
    timestamp: new Date().toISOString(),
    collapsed: true,
  });
}
```

**Files to modify**:
- `src/lib/curation/narrativeCurator.ts` — Narrative Curator (INTENT and ARCHITECTURE modes)
- `src/lib/workflow/intakeClassifier.ts` — Intake Classifier
- `src/lib/workflow/responseEvaluator.ts` — Response Evaluator

---

### Change 2: CLI Invocations — Persist Parsed Final Response

For `cli_invocation` commands (Gemini CLI, Claude Code CLI), the final extracted JSON response is computed by `extractFinalResponseFromStream()` or `parseGeminiOutput()` inside the CLI providers. This parsed response should be stored as a `response_body` line alongside the raw streaming fragments.

**Where**: `src/lib/cli/roleInvoker.ts` — after `invokeRoleStreaming()` completes and the response is extracted from `raw.stdout`.

**What to add**:

```typescript
// After extracting the final response from the CLI output:
appendCommandOutput(
  commandId,
  'response_body',
  finalResponse,  // the extracted/parsed response text
  new Date().toISOString(),
);
```

This makes the final answer queryable without reconstructing 100 fragment lines.

---

### Change 3: `workflow_command_outputs` Schema Migration

In `src/lib/database/schema.ts`, update the `workflow_command_outputs` table DDL:

```sql
CREATE TABLE IF NOT EXISTS workflow_command_outputs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id  TEXT    NOT NULL REFERENCES workflow_commands(command_id),
  line_type   TEXT    NOT NULL CHECK(line_type IN (
    'summary', 'detail', 'error', 'stdin',
    'tool_input', 'tool_output', 'reasoning_review',
    'request_body', 'response_body', 'token_usage'
  )),
  tool_name   TEXT,
  content     TEXT    NOT NULL,
  timestamp   TEXT    NOT NULL
);
```

Add a schema version bump (V2 → V3 or whatever current version + 1) that uses `ALTER TABLE` to add the new `line_type` values, or simply drop+recreate the constraint via a migration.

Since `line_type` is stored as TEXT (SQLite CHECK is advisory, not enforced on existing rows), the new line types can be written immediately — the schema migration only updates the constraint for documentation purposes and future validation.

---

### Change 4: `commandStore.ts` — Add `lineType` pass-through

The `subscribeCommandPersistence()` handler in `commandStore.ts` currently only handles `stdin` and generic `summary`/`detail` in the `'output'` action case. It needs to pass through the new line types:

```typescript
case 'output':
  if (payload.lineType === 'stdin' && payload.detail) {
    if (payload.summary) appendCommandOutput(payload.commandId, 'summary', payload.summary, ...);
    appendCommandOutput(payload.commandId, 'stdin', payload.detail, ...);
  } else if (payload.lineType === 'request_body' && payload.detail) {
    if (payload.summary) appendCommandOutput(payload.commandId, 'summary', payload.summary, ...);
    appendCommandOutput(payload.commandId, 'request_body', payload.detail, ...);
  } else if (payload.lineType === 'response_body' && payload.detail) {
    if (payload.summary) appendCommandOutput(payload.commandId, 'summary', payload.summary, ...);
    appendCommandOutput(payload.commandId, 'response_body', payload.detail, ...);
  } else if (payload.lineType === 'token_usage' && payload.detail) {
    appendCommandOutput(payload.commandId, 'token_usage', payload.detail, ...);
  } else {
    // existing generic handler
  }
  break;
```

---

### Change 5: `eventBus.ts` — Add `lineType` to `workflow:command` payload

The `WorkflowCommandPayload` for `action: 'output'` should expose the new line type field:

```typescript
// In EventPayloads['workflow:command'] | action: 'output' shape:
lineType?: 'summary' | 'detail' | 'error' | 'stdin' | 'tool_input' | 'tool_output' |
           'reasoning_review' | 'request_body' | 'response_body' | 'token_usage';
```

---

## Diagnostic Query After Fix

Once implemented, diagnosing a future synthesis issue becomes:

```sql
-- Find the synthesis command
SELECT command_id FROM workflow_commands
WHERE label LIKE '%Plan Synthesis%'
ORDER BY started_at DESC LIMIT 1;

-- Get the full parsed response in one row
SELECT content FROM workflow_command_outputs
WHERE command_id = '<id>' AND line_type = 'response_body';

-- Get the full request (what was actually sent)
SELECT content FROM workflow_command_outputs
WHERE command_id = '<id>' AND line_type = 'request_body';

-- Get token usage
SELECT content FROM workflow_command_outputs
WHERE command_id = '<id>' AND line_type = 'token_usage';
```

---

## Build Order

### Phase 1 — Schema + Infrastructure (no behaviour change, no breaking changes)
1. Add new `line_type` values to `schema.ts` DDL (schema version bump)
2. Add `lineType` field to `eventBus.ts` `workflow:command` output payload
3. Update `commandStore.ts` `subscribeCommandPersistence()` to handle new line types
4. Run `npx tsc --noEmit` — zero errors

### Phase 2 — Direct API Call Logging
5. `intakeClassifier.ts` — add `request_body` + `response_body` + `token_usage` emits
6. `narrativeCurator.ts` — add same
7. `responseEvaluator.ts` — add same
8. Run typecheck + smoke test

### Phase 3 — CLI Parsed Response Logging
9. `roleInvoker.ts` — append `response_body` line after extracting final response from CLI output
10. Run typecheck + smoke test: verify synthesis command now has a single `response_body` line containing the parsed JSON

### Phase 4 — UI (optional, lower priority)
11. In `components.ts`, render `request_body` and `response_body` lines in the governed stream UI with a collapsible disclosure widget (collapsed by default, "View full request/response" toggle)

---

## Size Considerations

For very long synthesis prompts (10k–50k chars), storing the full `request_body` in `workflow_command_outputs` will increase DB size. This is acceptable — these are diagnostic artifacts per-dialogue, and the governed stream UI already stores the `stdin` line for CLI invocations. The trade-off (debuggability vs. disk) strongly favors storing the data.

If storage becomes a concern later, a TTL-based pruning job can remove `request_body`/`response_body` lines older than N days while preserving `summary` and `token_usage`.
