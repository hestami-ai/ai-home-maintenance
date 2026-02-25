# Multi-CLI Integration Specification

**JanumiCode — Model C Hybrid Architecture**

This specification defines how JanumiCode integrates with three CLI-based coding agents — Claude Code, Google Gemini CLI, and OpenAI Codex CLI — to provide grounded, workspace-aware role execution within the governed multi-role dialogue framework.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Role-to-CLI Mapping](#role-to-cli-mapping)
3. [RoleCLIProvider Interface](#rolecliprovider-interface)
4. [Per-Role Invocation Contracts](#per-role-invocation-contracts)
5. [Prompt Construction](#prompt-construction)
6. [Output Parsing](#output-parsing)
7. [Streaming Events & UI Integration](#streaming-events--ui-integration)
8. [Permission Enforcement](#permission-enforcement)
9. [Configuration & Detection](#configuration--detection)
10. [Claim Batching & Parallelism](#claim-batching--parallelism)
11. [Orchestrator Integration](#orchestrator-integration)
12. [Error Handling & Fallback](#error-handling--fallback)

---

## 1. Architecture Overview

### Design Summary

JanumiCode uses a **Model C Hybrid** architecture:

- A **new `RoleCLIProvider` interface** is the primary abstraction for dispatching work to CLI tools.
- An **`LLMProviderAdapter`** wraps the existing `LLMProviderInterface` (API-based providers) so they can serve as fallbacks when no CLI tool is configured or available.
- The **Workflow Orchestrator** remains the top-level control plane. It owns the state machine, phase transitions, gate management, and audit trail. CLI tools are stateless, one-shot workers dispatched by the orchestrator.
- Each role is assigned a CLI tool best suited to its responsibilities. The assignment is configurable per role.

### Layered Control Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATOR                      │
│       (State Machine + Gates + Phase Transitions)            │
│       Owns: phase order, gate logic, DB writes, audit trail  │
│       Never delegated to a CLI tool                          │
└──┬─────────┬─────────┬─────────┬─────────┬──────────────────┘
   │         │         │         │         │
   │         │         │         │         │  dispatches via
   │         │         │         │         │  RoleCLIProvider
   ▼         ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────┐
│EXEC  │ │T-EXP │ │VERI  │ │HIST  │ │HIST-CORE   │
│UTOR  │ │ERT   │ │FIER  │ │-INT  │ │(Database)  │
│      │ │      │ │      │ │      │ │            │
│Claude│ │Codex │ │Gemini│ │Gemini│ │ SQLite     │
│ Code │ │ CLI  │ │ CLI  │ │ CLI  │ │ queries    │
└──────┘ └──────┘ └──────┘ └──────┘ └────────────┘
```

### Design Principles Preserved

All seven non-negotiable design principles from the Architecture spec are preserved:

1. **State lives outside the LLM** — CLI tools receive deterministic context packs compiled from the DB. They have no persistent state.
2. **Dialogue is subordinate to state** — CLI tool outputs are parsed into structured types and stored in the DB. The orchestrator drives phase transitions, not the CLI.
3. **Execution is gated by verification** — CLI write permissions activate only during the EXECUTE phase, after REVIEW gate approval.
4. **History is append-only** — All CLI activity events are persisted to the DB regardless of UI display level.
5. **Humans are first-class authorities** — Human gates block workflow advancement. CLI tools cannot bypass them.
6. **Failure must be explicit** — Missing CLI tools fail loudly. UNKNOWN verdicts block critical claims. No silent degradation.
7. **Simplest viable mechanism wins** — One-shot CLI invocations via stdin piping. No session management, no complex orchestration protocols.

---

## 2. Role-to-CLI Mapping

### Default Assignments

| Role | CLI Tool | Primary Phase(s) | Access Level |
|------|----------|-------------------|--------------|
| **Executor** | Claude Code CLI | PROPOSE (read), EXECUTE (write) | Read during PROPOSE; Full (read+write+execute) during EXECUTE |
| **Technical Expert** | OpenAI Codex CLI | VERIFY (evidence gathering) | Read-only sandbox (`--sandbox read-only`) |
| **Verifier** | Google Gemini CLI | VERIFY (verdict emission) | Read-only, scoped (`--include-directories`) |
| **Historian-Interpreter** | Google Gemini CLI | HISTORICAL_CHECK | Read-only, scoped to docs/specs (`--include-directories`) |
| **Historian-Core** | N/A (SQLite) | All phases (passive) | Database queries only |
| **Human Authority** | N/A (Webview UI) | REVIEW, gate resolution | Full (via gates) |

### CLI Tool Capabilities

| Capability | Claude Code | Gemini CLI | Codex CLI |
|-----------|-------------|------------|-----------|
| Headless invocation | `claude -p` or stdin | `gemini -p` or stdin | `codex exec` or stdin (`-`) |
| JSON output | `--output-format json` | `--output-format json` | `--json` |
| Streaming JSONL | `--output-format stream-json` | `--output-format stream-json` | `--json` (JSONL events) |
| Stdin piping | ✅ | ✅ | ✅ (`-` for stdin) |
| Sandbox/read-only | Permission modes | `--include-directories`, container sandbox | `--sandbox read-only` |
| Schema validation | ❌ | ❌ | `--output-schema path` |
| Hooks/events | `PreToolUse`, `PostToolUse`, `Stop` | `BeforeTool`, `AfterTool`, `BeforeModel` | Via JSONL stream |
| Working directory | Inherits cwd | Inherits cwd | `--cd path` |
| Output to file | ❌ | File redirection | `--output-last-message path` |
| Directory scoping | ❌ | `--include-directories` | `--add-dir` |

### Why This Mapping

- **Executor → Claude Code**: Most battle-tested coding agent for planning and executing code changes. Rich hooks system for real-time monitoring during EXECUTE phase. Full agentic capabilities (file read/write, command execution, git operations).
- **Technical Expert → Codex CLI**: `--sandbox read-only` provides OS-level enforcement that the agent cannot modify the workspace. `--output-schema` enables schema-validated structured output for `EvidencePacket`. Purpose-built for constrained, read-only inspection tasks.
- **Verifier → Gemini CLI**: `--include-directories` scopes workspace visibility to directories relevant to the claims being verified. Streaming events (`tool_use`, `tool_result`) map naturally to "evidence gathered" in the governed stream.
- **Historian-Interpreter → Gemini CLI**: Same CLI, different prompt and directory scope. Scoped to `docs/`, spec files, changelogs, and version-controlled knowledge not available in the SQLite event store. Independently configurable model and API key.

---

## 3. RoleCLIProvider Interface

### Primary Interface

```typescript
/**
 * RoleCLIProvider — Primary interface for CLI-based role execution.
 * All CLI tool backends (Claude Code, Gemini, Codex) implement this interface.
 * The orchestrator dispatches to roles through this interface.
 */
interface RoleCLIProvider {
  /** Unique provider identifier (e.g., 'claude-code', 'gemini-cli', 'codex-cli') */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Detect whether this CLI tool is installed and ready to use.
   * Returns availability, version, and API key status.
   */
  detect(): Promise<Result<CLIProviderInfo>>;

  /**
   * Invoke the CLI tool for a role task.
   * Spawns the CLI process, pipes prompt via stdin, collects JSON output.
   * Returns the parsed response.
   */
  invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>>;

  /**
   * Invoke with streaming output.
   * Spawns the CLI process and emits normalized events as they arrive.
   * Returns the final result after the process completes.
   */
  invokeStreaming(
    options: RoleCLIInvocationOptions,
    onEvent: (event: CLIActivityEvent) => void
  ): Promise<Result<RoleCLIResult>>;

  /**
   * Get the command that would be executed (for display/logging).
   * Does NOT include the stdin content — only the CLI flags.
   */
  getCommandPreview(options: RoleCLIInvocationOptions): Result<string>;
}
```

### Supporting Types

```typescript
/**
 * CLI provider detection info
 */
interface CLIProviderInfo {
  id: string;
  name: string;
  available: boolean;
  version?: string;
  requiresApiKey: boolean;
  apiKeyConfigured: boolean;
}

/**
 * Options for invoking a CLI tool for a role task
 */
interface RoleCLIInvocationOptions {
  /** The full prompt content to pipe via stdin (system prompt + context pack) */
  stdinContent: string;

  /** Working directory for the CLI process */
  workingDirectory?: string;

  /** Directories the CLI can access (Gemini --include-directories) */
  includedDirectories?: string[];

  /** Sandbox mode (Codex --sandbox) */
  sandboxMode?: 'read-only' | 'workspace-write' | 'full-access';

  /** Path to JSON schema for output validation (Codex --output-schema) */
  outputSchemaPath?: string;

  /** Output format preference */
  outputFormat?: 'json' | 'stream-json' | 'text';

  /** Model override */
  model?: string;

  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;

  /** Whether to auto-approve tool use (for read-only roles) */
  autoApprove?: boolean;
}

/**
 * Result from a CLI tool invocation
 */
interface RoleCLIResult {
  /** Main response content (the CLI's answer/output) */
  response: string;

  /** Process exit code */
  exitCode: number;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Token usage statistics (if available from CLI output) */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  /** Tool call statistics */
  toolStats?: {
    totalCalls: number;
    totalSuccess: number;
    totalFail: number;
  };

  /** Files modified during execution (if reported) */
  filesModified?: string[];

  /** Raw CLI output (for debugging) */
  rawOutput: string;
}
```

### LLMProviderAdapter (Fallback)

```typescript
/**
 * Adapter that wraps an LLMProviderInterface to conform to RoleCLIProvider.
 * Used as a fallback when no CLI tool is configured for a role.
 * The role invocation functions work identically — they receive the same
 * context pack and return the same structured types.
 */
class LLMProviderAdapter implements RoleCLIProvider {
  readonly id: string;
  readonly name: string;

  constructor(
    private readonly provider: LLMProviderInterface,
    providerName: string
  ) {
    this.id = `api-${providerName.toLowerCase()}`;
    this.name = `${providerName} (API)`;
  }

  async detect(): Promise<Result<CLIProviderInfo>> {
    // Validate API key
    const valid = await this.provider.validateApiKey();
    return {
      success: true,
      value: {
        id: this.id,
        name: this.name,
        available: valid.success && valid.value,
        requiresApiKey: true,
        apiKeyConfigured: valid.success && valid.value,
      },
    };
  }

  async invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
    const startTime = Date.now();

    // Parse stdin content back into system prompt + user message
    const [systemPrompt, userContent] = splitStdinContent(options.stdinContent);

    const llmResult = await this.provider.complete({
      messages: [
        { role: MessageRole.SYSTEM, content: systemPrompt },
        { role: MessageRole.USER, content: userContent },
      ],
      model: options.model ?? 'default',
      maxTokens: 4000,
    });

    if (!llmResult.success) {
      return llmResult;
    }

    return {
      success: true,
      value: {
        response: llmResult.value.content,
        exitCode: 0,
        executionTime: Date.now() - startTime,
        tokenUsage: {
          inputTokens: llmResult.value.usage.inputTokens,
          outputTokens: llmResult.value.usage.outputTokens,
          totalTokens: llmResult.value.usage.totalTokens,
        },
        rawOutput: llmResult.value.content,
      },
    };
  }

  async invokeStreaming(
    options: RoleCLIInvocationOptions,
    onEvent: (event: CLIActivityEvent) => void
  ): Promise<Result<RoleCLIResult>> {
    // API providers don't support granular streaming events.
    // Emit a single 'message' event with the complete response.
    onEvent({
      timestamp: new Date().toISOString(),
      eventType: 'init',
      summary: `${this.name} processing...`,
    });

    const result = await this.invoke(options);

    if (result.success) {
      onEvent({
        timestamp: new Date().toISOString(),
        eventType: 'complete',
        summary: 'Response received',
        detail: result.value.response,
      });
    }

    return result;
  }

  getCommandPreview(options: RoleCLIInvocationOptions): Result<string> {
    return {
      success: true,
      value: `[API fallback: ${this.name}] (no CLI command)`,
    };
  }
}

/**
 * Split stdin content back into system prompt and user content.
 * Convention: system prompt and user content separated by "\n---\n"
 */
function splitStdinContent(stdinContent: string): [string, string] {
  const separatorIndex = stdinContent.indexOf('\n---\n');
  if (separatorIndex === -1) {
    return ['', stdinContent];
  }
  return [
    stdinContent.substring(0, separatorIndex),
    stdinContent.substring(separatorIndex + 5),
  ];
}
```

### Provider Registry

```typescript
/**
 * Registry of available RoleCLIProviders
 */
const roleCLIRegistry = new Map<string, RoleCLIProvider>();

function registerRoleCLIProvider(provider: RoleCLIProvider): void {
  roleCLIRegistry.set(provider.id, provider);
}

function getRoleCLIProvider(id: string): RoleCLIProvider | undefined {
  return roleCLIRegistry.get(id);
}

/**
 * Get the configured provider for a specific role.
 * Reads from per-role configuration, falls back to LLMProviderAdapter.
 */
async function getProviderForRole(role: Role): Promise<Result<RoleCLIProvider>> {
  const config = await getConfig();
  const roleConfig = config.cliConfig?.[role];

  if (roleConfig?.providerId) {
    const provider = getRoleCLIProvider(roleConfig.providerId);
    if (provider) {
      const detection = await provider.detect();
      if (detection.success && detection.value.available) {
        return { success: true, value: provider };
      }
      // CLI configured but not available — explicit failure
      return {
        success: false,
        error: new CodedError(
          'CLI_NOT_AVAILABLE',
          `${provider.name} is configured for ${role} but is not available. ` +
          `Install it or reassign this role to a different provider in settings.`
        ),
      };
    }
  }

  // No CLI configured — fall back to LLM API adapter
  const llmProviderResult = await createProviderForRole(role);
  if (!llmProviderResult.success) {
    return llmProviderResult as Result<RoleCLIProvider>;
  }
  return {
    success: true,
    value: new LLMProviderAdapter(llmProviderResult.value, role),
  };
}
```

---

## 4. Per-Role Invocation Contracts

### 4.1 Executor (Claude Code CLI)

#### PROPOSE Phase (Read-Only)

**Purpose**: Generate a grounded proposal by reading the real workspace.

**Invocation**:
```
stdin: {systemPrompt}\n---\n{formattedContext}
claude --output-format json
```

**Flags**:
- `--output-format json` — structured JSON response
- No `--dangerously-auto-approve` — interactive approval for any tool use during proposal generation ensures read-only behavior

**Input**: Executor system prompt + compiled context pack (goal, constraints, active claims, historical findings)

**Expected Output**: JSON containing `ExecutorResponse`:
```json
{
  "proposal": "Detailed proposal...",
  "assumptions": [
    { "statement": "...", "criticality": "CRITICAL", "rationale": "..." }
  ],
  "artifacts": [
    { "type": "CODE", "content": "...", "description": "..." }
  ],
  "constraint_adherence_notes": ["..."]
}
```

**Output Parsing**: Extract `response` field from Claude Code JSON output. Parse the inner JSON to `ExecutorResponse`. On parse failure, the raw response is stored and the phase fails with a descriptive error.

#### EXECUTE Phase (Full Access)

**Purpose**: Implement the verified proposal — write files, run commands.

**Invocation**:
```
stdin: {executionPrompt}\n---\n{verifiedProposal + constraints}
claude --output-format stream-json
```

**Flags**:
- `--output-format stream-json` — real-time JSONL events for progress monitoring
- Approval mode per user configuration (auto-approve for trusted contexts, or interactive)

**Input**: Execution-specific prompt + verified proposal + constraint manifest

**Expected Output**: JSONL stream of tool use events, followed by final result. Files are modified in the workspace directly by Claude Code.

**Output Parsing**: Stream events are normalized to `CLIActivityEvent` and emitted to the governed stream UI. Final result parsed for exit code, execution time, files modified.

---

### 4.2 Technical Expert (Codex CLI)

**Purpose**: Inspect the codebase to provide grounded evidence for technical questions.

**Invocation**:
```
stdin: {systemPrompt}\n---\n{formattedContext with questions}
codex exec --sandbox read-only --json --output-schema evidence_packet.json -
```

**Flags**:
- `--sandbox read-only` — OS-level enforcement, cannot modify workspace
- `--json` — JSONL event output
- `--output-schema evidence_packet.json` — validates output against `EvidencePacket` schema
- `-` — read prompt from stdin

**Input**: Technical Expert system prompt + compiled context pack (questions, related claims, historical evidence)

**Expected Output**: Schema-validated JSON containing `EvidencePacket`:
```json
{
  "answer": "Based on inspection of package.json...",
  "evidence_references": [
    {
      "type": "FILE",
      "url": "package.json",
      "description": "Express.js 4.18.2 found in dependencies",
      "relevance_score": 0.95
    }
  ],
  "confidence_level": "HIGH",
  "caveats": ["Version pinned but no lock file found"]
}
```

**Output Parsing**: Codex validates output against `--output-schema`. JanumiCode reads `--output-last-message` or parses the final JSONL `result` event. Adds `packet_id` and `question` fields. On schema validation failure, Codex itself reports the error.

---

### 4.3 Verifier (Gemini CLI)

**Purpose**: Gather evidence from the workspace and emit verdicts for claims.

**Invocation**:
```
stdin: {systemPrompt}\n---\n{formattedContext with claims to verify}
gemini --output-format json --include-directories src,lib,config,package.json
```

**Flags**:
- `--output-format json` — structured JSON response with stats
- `--include-directories` — scoped to source directories relevant to the claims

**Input**: Verifier system prompt + compiled context pack (claims to verify, existing evidence, historical verdicts). All open claims batched into a single invocation.

**Expected Output**: JSON response containing `VerifierResponse` for each claim:
```json
{
  "verdicts": [
    {
      "claim_id": "claim-abc",
      "verdict": "VERIFIED",
      "confidence": 0.92,
      "evidence_summary": "Confirmed Express.js 4.18.2 in package.json",
      "constraints": [],
      "rationale": "Direct dependency match found"
    },
    {
      "claim_id": "claim-def",
      "verdict": "UNKNOWN",
      "confidence": 0.3,
      "evidence_summary": "No JWT configuration found in environment",
      "constraints": [],
      "rationale": "Checked .env, .env.example, and config/ — no JWT_SECRET"
    }
  ]
}
```

**Output Parsing**: Extract `response` field from Gemini JSON output. Parse inner JSON for verdict array. Map each verdict to the existing `VerifierResponse` type. If the Gemini response is not reliably structured JSON, a lightweight LLM API call post-processes the raw response into structured verdicts (augment strategy).

**Directory Scoping**: The `--include-directories` flag is computed dynamically based on the claims being verified. For example, a claim about database configuration scopes to `src/,config/,prisma/`. A claim about dependencies scopes to the project root (for `package.json`, `requirements.txt`, etc.).

---

### 4.4 Historian-Interpreter (Gemini CLI)

**Purpose**: Read version-controlled documentation and specs to detect contradictions and surface precedents.

**Invocation**:
```
stdin: {systemPrompt}\n---\n{formattedContext with DB history + query}
gemini --output-format json --include-directories docs,specs,CHANGELOG.md,.github
```

**Flags**:
- `--output-format json` — structured JSON response
- `--include-directories` — scoped to documentation, specs, changelogs, and CI/CD config

**Input**: Historian-Interpreter system prompt + compiled context pack. The context pack includes:
- JanumiCode event history from SQLite (queried in-process before CLI invocation)
- The current query (contradiction check, precedent search, etc.)
- Related claim IDs

**Expected Output**: JSON response containing `HistorianInterpreterResponse`:
```json
{
  "findings": [
    {
      "type": "CONTRADICTION",
      "description": "Current proposal assumes PostgreSQL but docs/Architecture.md specifies SQLite",
      "severity": "HIGH",
      "source_references": ["docs/Architecture.md:45", "claim-xyz"]
    }
  ],
  "precedents": [
    {
      "description": "Similar migration was attempted in Sprint 12...",
      "outcome": "Reverted due to performance regression",
      "relevance_score": 0.78
    }
  ],
  "summary": "One high-severity contradiction found..."
}
```

**Output Parsing**: Same as Verifier — extract `response` from Gemini JSON, parse inner JSON. Use lightweight LLM API call to structure the response if needed (augment strategy).

---

## 5. Prompt Construction

### Principle: All Content Via Stdin

All large content (system prompt + context pack) flows through stdin to avoid OS command line length limits (Windows `CreateProcess` caps at ~32K chars, `cmd.exe` at ~8K). Only short behavioral flags appear on the command line.

### Stdin Format Convention

```
{ROLE_SYSTEM_PROMPT}
---
{FORMATTED_CONTEXT_PACK}
```

The separator `\n---\n` divides the role's system instructions from the compiled context. This convention is also used by the `LLMProviderAdapter` to split stdin content back into system prompt + user message for API-based fallback.

### Context Pack Compilation (Unchanged)

The existing context compilation pipeline is preserved:

1. **`buildXxxContext()`** — Role-specific context builder queries the DB for claims, verdicts, constraints, history
2. **`formatXxxContext()`** — Formats the context into a structured text representation
3. **Token budgeting** — Truncation strategy ensures the context fits within the CLI tool's context window

The only change is that step 4 (previously "construct `LLMMessage[]` and call `provider.complete()`") becomes "concatenate system prompt + `\n---\n` + formatted context and pipe to CLI via stdin."

### Example: Verifier Prompt

```
You are the VERIFIER role in the JanumiCode autonomous system.
[... full verifier system prompt ...]
Your response MUST be valid JSON with the specified structure.
---
## Claims to Verify

### Claim 1: claim-abc
Statement: "Express.js v4.x is installed as a dependency"
Criticality: CRITICAL
Introduced by: EXECUTOR

### Claim 2: claim-def
Statement: "JWT_SECRET environment variable is configured"
Criticality: CRITICAL
Introduced by: EXECUTOR

## Existing Evidence
(none gathered yet)

## Historical Verdicts
- Similar claim "Express.js v4 available" was VERIFIED in dialogue-xyz (2 days ago)

## Constraint Manifest
- MUST verify against actual workspace files, not assumptions
- MUST emit a verdict for every claim listed
```

---

## 6. Output Parsing

### Strategy Per CLI Tool

| CLI Tool | Role(s) | Strategy | Mechanism |
|----------|---------|----------|-----------|
| **Claude Code** | Executor | CLI replaces | Parse `response` field from `--output-format json`. Prompt instructs JSON schema. |
| **Codex CLI** | Technical Expert | CLI replaces | `--output-schema` validates output. `JSON.parse()` on stdout or `--output-last-message`. |
| **Gemini CLI** | Verifier, Historian-Interpreter | CLI augments | Parse `response` field from `--output-format json`. If not valid structured JSON, post-process via lightweight LLM API call. |

### Gemini CLI JSON Output Structure

Gemini's `--output-format json` returns:
```json
{
  "response": "...",
  "stats": {
    "models": { ... },
    "tools": { "totalCalls": N, ... },
    "files": { "totalLinesAdded": N, "totalLinesRemoved": N }
  },
  "error": null
}
```

The `response` field contains the model's answer. JanumiCode extracts this field and attempts to parse it as the expected structured type (`VerifierResponse`, `HistorianInterpreterResponse`). The `stats` field is used to populate `RoleCLIResult.tokenUsage` and `RoleCLIResult.toolStats`.

### Codex CLI JSON Output Structure

Codex's `--json` returns newline-delimited JSON events. The final event contains the result. With `--output-schema`, Codex validates the final response against the provided JSON Schema before emitting it.

### Claude Code JSON Output Structure

Claude Code's `--output-format json` returns a JSON object with the model's response. The `--output-format stream-json` variant emits JSONL events including tool use records, which are used during the EXECUTE phase for real-time progress monitoring.

### Post-Processing (Augment Strategy)

For Verifier and Historian-Interpreter, if the Gemini CLI response is not valid structured JSON:

1. Extract the raw `response` text
2. Make a lightweight LLM API call (using the existing `LLMProviderInterface`) with a simple extraction prompt:
   ```
   Extract structured JSON from the following response.
   Expected schema: { verdicts: [...] }
   Response: {rawResponse}
   ```
3. Parse the API response as the expected type
4. If this also fails, the phase fails with the raw response stored for debugging

This two-stage approach (CLI for grounded evidence → API for structured extraction) is the "augment" strategy.

---

## 7. Streaming Events & UI Integration

### Display Levels

| Level | What's Shown | When Used |
|-------|-------------|-----------|
| **Level 2 (default)** | Key milestones: tool calls, file reads/writes, errors, completion | Always visible in governed stream |
| **Level 3 (on demand)** | Full JSONL event stream from CLI tool | Expandable per phase card ("Show full activity log") |

**All events are persisted to the DB regardless of display level.** The audit trail is always complete.

### Normalized Event Type

All three CLI tools emit different event schemas. JanumiCode normalizes them to a common type:

```typescript
/**
 * Normalized CLI activity event.
 * Maps events from all CLI tools to a common format for UI and audit.
 */
interface CLIActivityEvent {
  /** ISO-8601 timestamp */
  timestamp: string;

  /** Which role generated this event */
  role?: Role;

  /** Which workflow phase this event belongs to */
  phase?: Phase;

  /** Normalized event type */
  eventType:
    | 'init'          // CLI process started
    | 'tool_call'     // CLI tool invoked a tool (file read, bash, etc.)
    | 'tool_result'   // Tool returned a result
    | 'file_read'     // File was read (high-signal for Verifier/Expert)
    | 'file_write'    // File was written (high-signal for Executor)
    | 'command_exec'  // Shell command executed
    | 'message'       // Model generated text
    | 'error'         // Non-fatal error or warning
    | 'complete';     // CLI process finished

  /** Human-readable one-line summary (displayed at Level 2) */
  summary: string;

  /** Full event content (displayed at Level 3) */
  detail?: string;

  /** Tool name if tool-related (e.g., "ReadFile", "Bash", "WriteFile") */
  toolName?: string;

  /** File path if file-related */
  filePath?: string;

  /** Success or error status */
  status?: 'success' | 'error';
}
```

### Event Mapping Per CLI

#### Claude Code (`stream-json`)

| Claude Code Event | → `CLIActivityEvent.eventType` | Summary Template |
|-------------------|-------------------------------|------------------|
| Tool use (ReadFile) | `file_read` | "Read `{path}`" |
| Tool use (WriteFile) | `file_write` | "Wrote `{path}`" |
| Tool use (Bash) | `command_exec` | "Ran `{command}`" |
| Other tool use | `tool_call` | "Used tool `{name}`" |
| Tool result | `tool_result` | "Tool `{name}`: {status}" |
| Assistant message | `message` | First 100 chars of content |
| Error | `error` | Error message |
| Session end | `complete` | "Completed ({exitCode})" |

#### Gemini CLI (`stream-json`)

| Gemini Event Type | → `CLIActivityEvent.eventType` | Summary Template |
|-------------------|-------------------------------|------------------|
| `init` | `init` | "Gemini session started (model: {model})" |
| `tool_use` | `tool_call` / `file_read` / `file_write` / `command_exec` | Mapped by `tool_name` |
| `tool_result` | `tool_result` | "Tool `{tool_name}`: {status}" |
| `message` (assistant) | `message` | First 100 chars |
| `error` | `error` | Error message |
| `result` | `complete` | "Completed ({status})" |

#### Codex CLI (`--json`)

| Codex JSONL Event | → `CLIActivityEvent.eventType` | Summary Template |
|-------------------|-------------------------------|------------------|
| State: tool execution | `tool_call` / `file_read` / `file_write` / `command_exec` | Mapped by tool type |
| State: tool result | `tool_result` | "Tool: {status}" |
| State: message | `message` | First 100 chars |
| State: error | `error` | Error message |
| Final state | `complete` | "Completed" |

### Event Bus Integration

CLI activity events are emitted through the existing event bus:

```typescript
function emitCLIActivity(dialogueId: string, event: CLIActivityEvent): void {
  // 1. Persist to DB (always, for audit)
  persistCLIActivityEvent(dialogueId, event);

  // 2. Emit to UI (for live updates)
  eventBus.emit('cli-activity', { dialogueId, event });
}
```

The governed stream webview listens for `cli-activity` events and renders them as lightweight activity items nested under the current phase card.

---

## 8. Permission Enforcement

### Per-Role Enforcement

| Role | Enforcement Mechanism | Guarantee Level |
|------|----------------------|-----------------|
| **Executor (PROPOSE)** | No auto-approve flags; interactive approval for writes | Behavioral (prompt-based) |
| **Executor (EXECUTE)** | Workflow state machine gate (REVIEW phase must be resolved) | Architectural (orchestrator-level) |
| **Technical Expert** | Codex `--sandbox read-only` | **OS-level** (strongest) |
| **Verifier** | Gemini `--include-directories` scoping | Tool-level (directory visibility) |
| **Historian-Interpreter** | Gemini `--include-directories docs,specs,...` scoping | Tool-level (directory visibility) |

### Defense in Depth

1. **Architectural**: The orchestrator never calls `executeExecutePhase()` until the REVIEW gate is resolved. This is enforced by the state machine transition rules.
2. **Tool-level**: CLI flags (`--sandbox`, `--include-directories`) constrain what the CLI process can access.
3. **Audit**: All CLI activity events are persisted. Any unexpected file write by a read-only role is detectable in the audit log.
4. **Validation**: The VALIDATE phase checks execution results. Unexpected changes trigger a human gate.

### Executor Write Protection During PROPOSE

During the PROPOSE phase, Claude Code CLI is invoked without `--dangerously-auto-approve` or `--yolo`. This means:
- Claude Code will request approval for any file writes or command execution
- Since JanumiCode spawns Claude Code non-interactively, these approval requests will cause the tool use to be skipped (or the process to timeout)
- The Executor's system prompt explicitly instructs: "During PROPOSE, you are in READ-ONLY mode. Inspect the workspace but do not modify any files."

This is **behavioral enforcement** (prompt + no-auto-approve), not OS-level. For stronger guarantees, Claude Code could be invoked with a restricted permission profile if one becomes available.

---

## 9. Configuration & Detection

### Configuration Schema

```typescript
interface JanumiCodeCLIConfig {
  /** Per-role CLI provider assignments */
  roles: {
    executor: RoleCLIAssignment;
    technicalExpert: RoleCLIAssignment;
    verifier: RoleCLIAssignment;
    historianInterpreter: RoleCLIAssignment;
  };

  /** Per-provider settings */
  providers: {
    claudeCode?: CLIProviderSettings;
    geminiCli?: CLIProviderSettings;
    codexCli?: CLIProviderSettings;
  };
}

interface RoleCLIAssignment {
  /** Provider ID ('claude-code', 'gemini-cli', 'codex-cli', or 'api-{name}') */
  providerId: string;

  /** Model override for this role */
  model?: string;

  /** Additional CLI flags for this role */
  extraFlags?: string[];
}

interface CLIProviderSettings {
  /** Custom path to CLI binary */
  path?: string;

  /** Default model */
  defaultModel?: string;

  /** Default timeout (ms) */
  timeout?: number;

  /** API key (or reference to env var / secret store) */
  apiKeyEnvVar?: string;
}
```

### VS Code Settings Mapping

```json
{
  "janumicode.cli.roles.executor": "claude-code",
  "janumicode.cli.roles.technicalExpert": "codex-cli",
  "janumicode.cli.roles.verifier": "gemini-cli",
  "janumicode.cli.roles.historianInterpreter": "gemini-cli",

  "janumicode.cli.providers.claudeCode.path": "",
  "janumicode.cli.providers.claudeCode.defaultModel": "",
  "janumicode.cli.providers.claudeCode.timeout": 300000,

  "janumicode.cli.providers.geminiCli.path": "",
  "janumicode.cli.providers.geminiCli.defaultModel": "gemini-2.5-pro",
  "janumicode.cli.providers.geminiCli.timeout": 300000,

  "janumicode.cli.providers.codexCli.path": "",
  "janumicode.cli.providers.codexCli.defaultModel": "",
  "janumicode.cli.providers.codexCli.timeout": 300000
}
```

### Detection Flow

On extension activation (and on-demand via command):

1. **Scan for all registered CLI providers** — call `detect()` on each
2. **Report availability** — show in status bar / welcome view which CLIs are installed
3. **Auto-suggest configuration** — if a role's configured CLI is missing but another CLI is available, suggest reassignment
4. **Validate API keys** — check each available CLI's API key status

```typescript
async function detectAllCLIProviders(): Promise<CLIProviderInfo[]> {
  const results: CLIProviderInfo[] = [];
  for (const provider of roleCLIRegistry.values()) {
    const detection = await provider.detect();
    if (detection.success) {
      results.push(detection.value);
    }
  }
  return results;
}
```

### Detection Per CLI

| CLI Tool | Detection Command | Version Check | API Key Check |
|----------|------------------|---------------|---------------|
| Claude Code | `claude --version` | Parse semver from stdout | `claude config get apiKey` or check `ANTHROPIC_API_KEY` |
| Gemini CLI | `gemini --version` | Parse from stdout | Check `GEMINI_API_KEY` or Google Cloud auth |
| Codex CLI | `codex --version` | Parse from stdout | Check `OPENAI_API_KEY` or OAuth status via `codex login` |

---

## 10. Claim Batching & Parallelism

### Batching Strategy

Instead of invoking CLI tools once per claim, all open claims are batched into a single invocation per role:

```
VERIFY phase:
  1. Query DB for all OPEN claims in this dialogue
  2. Compile a single context pack containing ALL claims
  3. One Gemini CLI invocation → verdicts for all claims
  4. One Codex CLI invocation → evidence for all claims (parallel with step 3)
  5. Parse batch response, map verdicts/evidence to individual claims
  6. Store each verdict/evidence individually in DB
```

### Cost Model

| Strategy | CLI Invocations | Latency |
|----------|----------------|---------|
| Per-claim (old) | N × (Verifier + TechExpert) = 2N | O(N × CLI_latency) |
| Batched | 1 Verifier + 1 TechExpert = 2 | O(1 × CLI_latency) |
| Batched + parallel | 1 Verifier ∥ 1 TechExpert | O(1 × max(CLI_latency)) |

### Parallelism

Verifier (Gemini) and Technical Expert (Codex) can run simultaneously since they:
- Use different CLI tools (no resource contention)
- Both have read-only access (no write conflicts)
- Operate on the same claim set independently

```typescript
// Parallel invocation during VERIFY phase
const [verifierResult, expertResult] = await Promise.all([
  invokeVerifierBatch(dialogueId, openClaims, verifierProvider),
  invokeTechnicalExpertBatch(dialogueId, openClaims, expertProvider),
]);
```

### Batch Prompt Format

The system prompt includes explicit instructions for batch processing:

```
You will receive multiple claims to verify. You MUST emit a verdict for EACH claim.
Your response MUST contain a "verdicts" array with one entry per claim, identified by claim_id.
Do not skip any claims. If you cannot determine a verdict, emit UNKNOWN.
```

---

## 11. Orchestrator Integration

### Phase Dispatch Table

The `advanceWorkflow()` function dispatches to CLI providers based on the current phase:

| Phase | Provider Used | How Provider Is Obtained |
|-------|--------------|-------------------------|
| INTAKE | None (pure orchestrator logic) | N/A |
| PROPOSE | `getProviderForRole(Role.EXECUTOR)` | Claude Code CLI or API fallback |
| ASSUMPTION_SURFACING | None (pure orchestrator logic on cached Executor response) | N/A |
| VERIFY | `getProviderForRole(Role.VERIFIER)` + `getProviderForRole(Role.TECHNICAL_EXPERT)` | Gemini CLI + Codex CLI (parallel) |
| HISTORICAL_CHECK | `getProviderForRole(Role.HISTORIAN)` | Gemini CLI or API fallback |
| REVIEW | None (human gate) | N/A |
| EXECUTE | `getProviderForRole(Role.EXECUTOR)` | Claude Code CLI (streaming) |
| VALIDATE | Orchestrator logic (optionally dispatches Verifier) | Optional |
| COMMIT | None (pure orchestrator logic) | N/A |

### Updated `advanceWorkflow()` Signature

```typescript
export async function advanceWorkflow(
  dialogueId: string,
  tokenBudget: number = 10000
): Promise<Result<PhaseExecutionResult>> {
  // Providers are resolved per-phase from configuration
  // No longer passed as a parameter — getProviderForRole() handles resolution
  ...
}
```

### Updated `WorkflowProviders` (Removed)

The current `WorkflowProviders` interface (which bundles `executor`, `verifier`, `historianInterpreter` as `LLMProviderInterface`) is removed. Providers are resolved dynamically per-phase via `getProviderForRole()`, which returns the configured `RoleCLIProvider` (or `LLMProviderAdapter` fallback).

### Phase Function Signatures (Updated)

```typescript
// Before (API-based):
export async function executeProposePhase(
  dialogueId: string,
  provider: LLMProviderInterface,  // ← passed in
  tokenBudget: number
): Promise<Result<PhaseExecutionResult>>;

// After (CLI-based):
export async function executeProposePhase(
  dialogueId: string,
  tokenBudget: number
): Promise<Result<PhaseExecutionResult>>;
// Provider resolved internally via getProviderForRole(Role.EXECUTOR)
```

### EXECUTE Phase: Streaming Integration

```typescript
export async function executeExecutePhase(
  dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
  const providerResult = await getProviderForRole(Role.EXECUTOR);
  if (!providerResult.success) return providerResult;

  const provider = providerResult.value;

  // Build stdin content
  const stdinContent = buildExecuteStdinContent(dialogueId);

  // Invoke with streaming for real-time progress
  const result = await provider.invokeStreaming(
    {
      stdinContent,
      workingDirectory: getWorkspaceRoot(),
      outputFormat: 'stream-json',
    },
    (event) => {
      // Emit each event to the governed stream UI
      emitCLIActivity(dialogueId, {
        ...event,
        role: Role.EXECUTOR,
        phase: 'EXECUTE' as Phase,
      });
    }
  );

  // Store result, transition to VALIDATE
  ...
}
```

---

## 12. Error Handling & Fallback

### Error Categories

| Error | Handling | User Impact |
|-------|---------|-------------|
| **CLI not installed** | `detect()` returns `available: false`. Phase fails with install instructions. | Blocking — must install or reassign role |
| **CLI not in PATH** | Custom path checked from config. Fallback to common install locations. | Blocking if not found |
| **API key not configured** | `detect()` returns `apiKeyConfigured: false`. Phase fails with setup instructions. | Blocking — must configure |
| **CLI timeout** | Process killed after timeout. Phase fails with timeout error. Workflow paused. | Human gate opened |
| **CLI crash (non-zero exit)** | stderr captured. Phase fails with CLI error details. | Human gate opened |
| **Output parse failure** | Raw output stored in DB. Phase fails with parse error. | Human gate for manual review |
| **Schema validation failure** (Codex) | Codex reports validation error. Phase fails. | Retry or human intervention |
| **Augment API call failure** | Post-processing LLM call fails. Raw CLI output stored. Phase fails. | Human gate for manual review |

### Fallback Chain

```
1. Try configured RoleCLIProvider
   ↓ (not available)
2. Fail with explicit error + instructions
   ↓ (user reconfigures to different CLI)
3. Try newly configured RoleCLIProvider
   ↓ (no CLI available at all)
4. Fall back to LLMProviderAdapter (API-based)
   ↓ (API also fails)
5. Phase fails, human gate opened
```

There is **no automatic fallback** from CLI to API. The user must explicitly choose to use API fallback by configuring the role's `providerId` to an API provider. This preserves the "failure must be explicit" principle.

### Retry Logic

CLI invocations use the existing `executeWithRetry()` infrastructure:
- Max 2 retries for transient failures (timeout, network error)
- No retry for deterministic failures (not installed, API key missing, schema validation)
- Exponential backoff between retries

---

## Appendix: Implementation File Map

| New/Modified File | Purpose |
|-------------------|---------|
| `src/lib/cli/roleCLIProvider.ts` | `RoleCLIProvider` interface, registry, `getProviderForRole()` |
| `src/lib/cli/llmProviderAdapter.ts` | `LLMProviderAdapter` wrapping existing API providers |
| `src/lib/cli/providers/claudeCode.ts` | Claude Code CLI implementation of `RoleCLIProvider` |
| `src/lib/cli/providers/geminiCli.ts` | Gemini CLI implementation of `RoleCLIProvider` |
| `src/lib/cli/providers/codexCli.ts` | Codex CLI implementation of `RoleCLIProvider` |
| `src/lib/cli/eventNormalizer.ts` | Per-CLI event stream → `CLIActivityEvent` mapping |
| `src/lib/cli/schemas/` | JSON schemas for `--output-schema` (Codex) |
| `src/lib/workflow/orchestrator.ts` | Updated phase functions to use `getProviderForRole()` |
| `src/lib/roles/executor.ts` | Updated to accept `RoleCLIProvider` |
| `src/lib/roles/verifier.ts` | Updated for batch invocation + CLI augment strategy |
| `src/lib/roles/technicalExpert.ts` | Updated to accept `RoleCLIProvider` |
| `src/lib/roles/historianInterpreter.ts` | Updated for CLI augment strategy |
| `src/lib/config/settings.ts` | New `JanumiCodeCLIConfig` schema |
| `src/lib/integration/eventBus.ts` | New `cli-activity` event type |
| `src/lib/database/schema.ts` | New `cli_activity_events` table |
