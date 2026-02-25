# Claude Code Integration

**Phase 9.3: Claude Code CLI Integration**

This document describes how JanumiCode integrates with Claude Code CLI for execution.

## Overview

JanumiCode is a **verification and workflow orchestration layer** that sits on top of Claude Code. It provides:

- **Claim-based verification** of assumptions before execution
- **Multi-phase workflow** with human gates and safety checks
- **Historical contradiction detection** using dialogue history
- **Audit trail** of all decisions and overrides

Claude Code handles the actual code generation and file manipulation, while JanumiCode ensures that code changes are safe, verified, and traceable.

## Architecture

```
┌─────────────────────────────────────────┐
│         JanumiCode Extension            │
│  (Workflow Orchestration & Verification)│
├─────────────────────────────────────────┤
│  • Dialogue Management                  │
│  • Claim Verification                   │
│  • Workflow State Machine               │
│  • Human Gates                          │
│  • Historical Contradiction Detection   │
└──────────────┬──────────────────────────┘
               │
               │ Invokes for execution
               ▼
┌─────────────────────────────────────────┐
│         Claude Code CLI                 │
│      (Code Generation & Execution)      │
├─────────────────────────────────────────┤
│  • File Read/Write/Edit                 │
│  • Command Execution                    │
│  • Git Operations                       │
│  • Tool Invocation                      │
└─────────────────────────────────────────┘
```

## Prerequisites

### 1. Claude Code CLI Installation

JanumiCode requires Claude Code CLI to be installed and accessible in your PATH.

**Installation:**

```bash
npm install -g @anthropic-ai/claude-code
```

**Verify Installation:**

```bash
claude --version
```

**Minimum Version:** 1.0.0 (or latest)

### 2. Claude API Key

Both JanumiCode and Claude Code require a valid Anthropic API key.

**Set API Key:**

```bash
# Option 1: Environment variable
export ANTHROPIC_API_KEY="your-api-key"

# Option 2: Claude Code config
claude config set apiKey "your-api-key"
```

### 3. VS Code Extension

JanumiCode is a VS Code extension and requires VS Code to run.

**Minimum VS Code Version:** 1.85.0

## Workflow Integration

### Execution Phase

When JanumiCode reaches the **EXECUTE** phase:

1. **Pre-execution validation:**
   - All CRITICAL claims must be VERIFIED
   - No UNKNOWN verdicts (or human override required)
   - No open gates blocking execution

2. **Invoke Executor role:**
   - Generates execution proposal
   - Proposal contains code changes, commands, etc.

3. **Extract artifacts:**
   - Parse code blocks from proposal
   - Store as artifacts in database

4. **Invoke Claude Code CLI:**
   - Pass proposal to Claude Code for execution
   - Claude Code performs actual file operations
   - Monitor execution progress

5. **Post-execution validation:**
   - Validate execution output
   - Run validation phase
   - Ensure changes match expectations

### Execution Safety

JanumiCode provides multiple safety layers:

- **Claim Verification:** All assumptions verified before execution
- **Human Gates:** Critical decisions require human approval
- **Rollback Support:** Failed executions can be rolled back
- **Audit Trail:** All actions logged for debugging

## Claude Code Invocation

### Detection

JanumiCode detects Claude Code CLI in the following order:

1. **Global PATH:** Check if `claude` command is available
2. **VS Code Setting:** Check `janumicode.claudeCode.path` setting
3. **Environment Variable:** Check `CLAUDE_CODE_PATH`

### Validation

Before invocation, JanumiCode validates:

- ✅ Claude Code CLI is installed
- ✅ Version is compatible
- ✅ API key is configured
- ✅ User has execution permissions

### Invocation

JanumiCode invokes Claude Code CLI with:

```bash
claude execute --proposal <proposal-file> --context <context-file>
```

**Proposal File:** Contains execution instructions from Executor role
**Context File:** Contains verified claims and constraints

### Error Handling

JanumiCode gracefully handles Claude Code errors:

| Error Type | Handling |
|-----------|----------|
| **Not Installed** | Show installation instructions |
| **Version Mismatch** | Prompt to update Claude Code |
| **API Key Missing** | Prompt for API key configuration |
| **Execution Failed** | Log error, offer rollback |
| **Timeout** | Cancel execution, preserve state |

## Configuration

### VS Code Settings

```json
{
  "janumicode.claudeCode.path": "/usr/local/bin/claude",
  "janumicode.claudeCode.timeout": 300000,
  "janumicode.claudeCode.validateBeforeExecution": true,
  "janumicode.claudeCode.autoRollbackOnError": true
}
```

### Setting Descriptions

- **path:** Custom path to Claude Code CLI
- **timeout:** Execution timeout in milliseconds (default: 5 minutes)
- **validateBeforeExecution:** Validate claims before execution (default: true)
- **autoRollbackOnError:** Automatically rollback on execution errors (default: true)

## Relationship Between JanumiCode and Claude Code

### JanumiCode's Role

JanumiCode is the **"verification and workflow layer"** that:

1. **Surfaces assumptions** that need verification
2. **Verifies claims** using Technical Expert and Verifier roles
3. **Detects contradictions** with historical decisions
4. **Requires human approval** for critical decisions
5. **Orchestrates workflow** through 9 phases
6. **Maintains audit trail** of all decisions

### Claude Code's Role

Claude Code is the **"execution engine"** that:

1. **Reads and writes files** in the codebase
2. **Executes commands** (e.g., git, npm, etc.)
3. **Generates code** based on proposals
4. **Manipulates codebase** with precision
5. **Handles tool invocation** for specialized tasks

### Division of Responsibility

| Responsibility | JanumiCode | Claude Code |
|---------------|-----------|-------------|
| Claim verification | ✅ | ❌ |
| Assumption surfacing | ✅ | ❌ |
| Historical contradiction detection | ✅ | ❌ |
| Human gates | ✅ | ❌ |
| Workflow orchestration | ✅ | ❌ |
| Audit trail | ✅ | ❌ |
| File operations | ❌ | ✅ |
| Code generation | ❌ | ✅ |
| Command execution | ❌ | ✅ |
| Git operations | ❌ | ✅ |

### Example Workflow

**User Request:** "Add authentication to the API"

1. **JanumiCode (INTAKE):** Capture goal
2. **JanumiCode (PROPOSE):** Executor generates proposal
3. **JanumiCode (ASSUMPTION_SURFACING):** Surface assumptions:
   - "Database has users table"
   - "bcrypt is available"
   - "JWT secret is configured"
4. **JanumiCode (VERIFY):** Verify each assumption
   - Query database schema
   - Check package.json
   - Check environment variables
5. **JanumiCode (EXECUTE):** If all verified:
   - Extract code from proposal
   - **Invoke Claude Code** to apply changes
6. **Claude Code:** Execute proposal:
   - Create auth middleware
   - Update routes
   - Add authentication tests
7. **JanumiCode (VALIDATE):** Validate execution:
   - Check files were created
   - Verify tests pass
8. **JanumiCode (COMMIT):** Commit to history

## Troubleshooting

### Claude Code Not Found

**Error:** "Claude Code CLI not found in PATH"

**Solution:**
1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Verify: `claude --version`
3. Or set custom path in VS Code settings

### Version Mismatch

**Error:** "Claude Code version X.X.X is not compatible"

**Solution:**
1. Update Claude Code: `npm update -g @anthropic-ai/claude-code`
2. Restart VS Code

### Execution Timeout

**Error:** "Claude Code execution timed out"

**Solution:**
1. Increase timeout in settings: `janumicode.claudeCode.timeout`
2. Check Claude Code logs for errors
3. Try running Claude Code directly to diagnose

### API Key Issues

**Error:** "Claude Code API key not configured"

**Solution:**
1. Set API key: `claude config set apiKey "your-key"`
2. Or set environment variable: `export ANTHROPIC_API_KEY="your-key"`
3. Restart VS Code

## Future Enhancements

Potential future integrations:

- **Streaming execution:** Real-time progress updates from Claude Code
- **Interactive execution:** Allow user to approve each file change
- **Diff preview:** Show diffs before applying changes
- **Selective execution:** Execute only specific parts of proposal
- **Parallel execution:** Execute independent changes in parallel

## References

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [JanumiCode Implementation Roadmap](./Implementation%20Roadmap.md)
- [JanumiCode Technical Specification](./Technical%20Specification.md)
