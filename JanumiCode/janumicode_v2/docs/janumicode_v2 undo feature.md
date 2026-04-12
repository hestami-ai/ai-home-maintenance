# JanumiCode Undo Capability - Feature Requirements Document

**Summary:** A layered undo capability that coordinates across Governed Stream records, workflow state, file system, and git to enable users to revert work at multiple scopes (action, sub-phase, phase, run).

---

# Part 1: Product Requirements

## 1. Overview

### Problem Statement

Users need the ability to undo work performed by CLI-backed agents (Claude Code, Gemini, Codex). Without undo, mistakes are costly and users may be hesitant to use automated workflows.

### Goals

| Goal | Description |
|------|-------------|
| **G1** | Enable users to undo work at multiple scopes (action, sub-phase, phase) |
| **G2** | Provide clear visibility into what an undo would affect before execution |
| **G3** | Ensure undo is atomic - either fully succeeds or fully fails |
| **G4** | Handle irreversible effects gracefully with user consent |

### Non-Goals (MVP)

| Non-Goal | Reason |
|----------|--------|
| Redo capability | Complex state management, defer to future |
| Multi-level undo history | Requires redo to work properly |
| Remote push prevention | Cannot control external systems |
| Non-git workspace support | Significant additional complexity |

### Success Metrics

| Metric | Target |
|--------|--------|
| Undo success rate | > 99% for reversible operations |
| Undo preview accuracy | 100% (preview matches actual effect) |
| Time to undo | < 5 seconds for phase-level undo |
| User confidence | "I can safely experiment" in user feedback |

---

## 2. User Stories

### US-1: Undo Last Action

**As a** user who just saw an action produce unexpected results  
**I want to** undo that single action  
**So that** I can try a different approach without manual cleanup

**Acceptance Criteria:**
- [ ] AC-1.1: Single command/click to undo last action
- [ ] AC-1.2: Preview shows exactly what will be undone
- [ ] AC-1.3: All records, files, and git changes from action are reverted
- [ ] AC-1.4: Workflow state returns to before the action

### US-2: Undo to Checkpoint

**As a** user who realizes Phase 3 went in the wrong direction  
**I want to** undo to the end of Phase 2  
**So that** I can restart Phase 3 with corrected context

**Acceptance Criteria:**
- [ ] AC-2.1: Can select any prior checkpoint as undo target
- [ ] AC-2.2: All work after checkpoint is reverted atomically
- [ ] AC-2.3: Git state matches checkpoint commit
- [ ] AC-2.4: Workflow resumes from checkpoint point

### US-3: Preview Undo Impact

**As a** user considering an undo  
**I want to** see exactly what would be affected  
**So that** I can make an informed decision

**Acceptance Criteria:**
- [ ] AC-3.1: Shows count of records, files, git commits affected
- [ ] AC-3.2: Highlights irreversible effects (remote pushes, external API calls)
- [ ] AC-3.3: Lists files that would be modified/deleted
- [ ] AC-3.4: Warns if undo is partial (some effects irreversible)

### US-4: Handle Irreversible Effects

**As a** user who wants to undo work that included external API calls  
**I want to** be warned and given options  
**So that** I understand what cannot be automatically undone

**Acceptance Criteria:**
- [ ] AC-4.1: System detects and logs external effects during execution
- [ ] AC-4.2: Preview clearly marks irreversible effects
- [ ] AC-4.3: User can choose: proceed with partial undo, cancel, or view details
- [ ] AC-4.4: Partial undo completes what's possible, logs what wasn't

---

## 3. Functional Requirements

### FR-1: Record-Level Undo (P1)

Mark Governed Stream records as superseded without file/git changes.

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Mark records with `superseded_at`, `superseded_by`, `supersession_reason` |
| FR-1.2 | Invalidate memory edges pointing to superseded records |
| FR-1.3 | Support single record or batch supersession |

### FR-2: Workflow State Rollback (P1)

Update workflow run state to reflect undo.

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Update `workflow_runs.current_phase_id` to target phase |
| FR-2.2 | Update `workflow_runs.current_sub_phase_id` to target sub-phase |
| FR-2.3 | Set `workflow_runs.status` to 'active' if was 'waiting_for_input' |
| FR-2.4 | Rollback constraints added after target point |
| FR-2.5 | Notify Orchestrator to rebuild in-memory state |

### FR-3: File-Level Undo (P1)

Revert file changes made during undone scope.

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Track all file writes in `file_system_writes` table |
| FR-3.2 | Use git reset to checkpoint for tracked files |
| FR-3.3 | Delete files created during undone scope |
| FR-3.4 | Restore files deleted during undone scope |
| FR-3.5 | Handle files outside git via backup system |

### FR-4: Git Checkpoint System (P1)

Create and manage git checkpoints for undo targets.

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Create checkpoint before each sub-phase execution |
| FR-4.2 | Store checkpoint commit SHA in database |
| FR-4.3 | Verify checkpoint commit exists before reset |
| FR-4.4 | Handle dirty working directory (stash or abort) |
| FR-4.5 | Bypass pre-commit hooks for checkpoints (`--no-verify`) |

### FR-5: Impact Preview (P1)

Show what an undo would affect before execution.

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Count records that would be superseded |
| FR-5.2 | List files that would be modified/deleted/created |
| FR-5.3 | Count git commits that would be reset |
| FR-5.4 | Detect and list irreversible effects |
| FR-5.5 | Return preview in < 500ms |

### FR-6: Irreversibility Detection (P1)

Detect and communicate effects that cannot be undone.

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Log external API calls during execution |
| FR-6.2 | Detect if git commits were pushed to remote |
| FR-6.3 | Track user-approved git operations separately |
| FR-6.4 | Warn user before undo if irreversible effects present |

---

## 4. Non-Functional Requirements

### NFR-1: Atomicity

All undo operations must be atomic.

| Requirement | Description |
|-------------|-------------|
| NFR-1.1 | Database updates execute in single transaction |
| NFR-1.2 | Git reset happens only after DB transaction commits |
| NFR-1.3 | No partial state on crash - either all done or none |

### NFR-2: Performance

| Requirement | Target |
|-------------|--------|
| NFR-2.1 | Impact preview | < 500ms |
| NFR-2.2 | Record-level undo | < 1s |
| NFR-2.3 | Phase-level undo | < 5s |
| NFR-2.4 | Git checkpoint creation | < 2s |

### NFR-3: Reliability

Handle 25 identified failure modes gracefully.

| Requirement | Description |
|-------------|-------------|
| NFR-3.1 | Detect git repository presence before checkpoint |
| NFR-3.2 | Handle dirty working directory with user consent |
| NFR-3.3 | Verify checkpoint commit exists before reset |
| NFR-3.4 | Lock workflow run during undo to prevent races |
| NFR-3.5 | Log each undo step for recovery |

### NFR-4: Usability

| Requirement | Description |
|-------------|-------------|
| NFR-4.1 | Clear language: "Undo will revert X, Y, Z" |
| NFR-4.2 | Distinguish reversible from irreversible effects |
| NFR-4.3 | Provide recovery guidance on failure |
| NFR-4.4 | Disable undo button while undo in progress |

---

## 5. Out of Scope (MVP)

| Feature | Reason | Future Consideration |
|---------|--------|----------------------|
| Redo capability | Requires storing undo state | Phase 2 |
| Multi-level undo history | Requires redo | Phase 2 |
| Remote push prevention | Cannot control external | Document limitation |
| Non-git workspace support | Significant complexity | Phase 3 |
| Abort-and-undo during execution | Complex process management | Phase 2 |

---

# Part 2: Technical Specification

## 6. Prerequisites

### PREREQ-1: Batch Transaction Support (CRITICAL)

**Issue:** v2's RPC-based database lacks atomic transactions. Each `exec()` is a separate RPC call.

**Solution:** Port v1's `handleTransaction` to v2 sidecar.

**Impact:** Without this, undo can leave partial state on crash.

**Implementation:**

```typescript
// Add to v2/src/sidecar/dbServer.ts
interface TransactionOp {
  method: 'run' | 'get' | 'all' | 'exec';
  sql: string;
  params?: unknown[];
}

function handleTransaction(params: Record<string, unknown>): unknown {
  const operations = params.operations as TransactionOp[];
  const txn = db.transaction((ops: TransactionOp[]) => {
    return ops.map(op => { /* execute op */ });
  });
  return txn(operations);  // Atomic in sidecar
}

// Add to v2/src/lib/database/rpcClient.ts
runTransaction(operations: TransactionOp[]): unknown[] {
  return this.callSync('transaction', { operations }) as unknown[];
}
```

**Reference:** `sqlite-transaction-sidecar-friction-b1c6c5.md`

### PREREQ-2: Git Repository Detection

**Requirement:** Detect git presence at workflow start.

**Implementation:**
- Check `.git` directory exists
- Verify `git status` succeeds
- Store `hasGit: boolean` in workflow metadata

---

## 7. Architecture

### 7.1 Layered Undo Model

```
+------------------+
|   UNDO REQUEST   |
+------------------+
        |
        v
+------------------+
|  UNDO COORDINATOR|  <-- Orchestrator
+------------------+
        |
        +-- 1. Identify scope
        +-- 2. Identify affected layers
        +-- 3. Check reversibility
        +-- 4. Execute undo (if reversible)
        +-- 5. Report results
```

### 7.2 Undo Scopes

| Scope | Records | Files | Git | Use Case |
|-------|---------|-------|-----|----------|
| **Record** | Yes | No | No | Mark single record superseded |
| **Action** | Yes | Yes | Yes | Undo last capability execution |
| **Sub-Phase** | Yes | Yes | Yes | Undo current sub-phase work |
| **Phase** | Yes | Yes | Yes | Undo entire phase |
| **Run** | Yes | Yes | Yes | Undo everything (rare) |

### 7.3 Execution Order (Compensating Transaction)

```
1. DB Transaction (atomic)
   - Update workflow_runs
   - Mark records superseded
   - Invalidate memory edges
   - Rollback constraints
   - Create undo_executed record

2. Git Reset (can retry)
   - git reset --hard to checkpoint
   - git stash apply if needed

3. Orchestrator Notification (can resend)
   - Clear cached state
   - Rebuild context
   - Emit event for webview
```

---

## 8. Data Model

### 8.1 New Tables

#### `git_checkpoints`

```sql
CREATE TABLE git_checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  created_at TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  sub_phase_id TEXT,
  description TEXT,
  stash_id TEXT,  -- If stashed uncommitted changes
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);
```

#### `file_system_writes`

```sql
CREATE TABLE file_system_writes (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  checkpoint_id TEXT,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'create' | 'modify' | 'delete'
  content_hash TEXT,  -- SHA256 before change
  created_at TEXT NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES git_checkpoints(checkpoint_id)
);
```

### 8.2 New Record Type

#### `undo_executed`

```typescript
interface UndoRecord {
  record_type: 'undo_executed';
  undo_scope: 'record' | 'action' | 'sub_phase' | 'phase' | 'run';
  undone_record_ids: string[];
  undone_file_changes: FileChange[];
  git_reset_to?: string;
  irreversible_effects: string[];
  undo_timestamp: string;
  undo_reason?: string;
}

interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  reversible: boolean;
  reverted: boolean;
  original_content_sha?: string;
}
```

### 8.3 Schema Changes

Add to `governed_stream`:

```sql
ALTER TABLE governed_stream ADD COLUMN superseded_at TEXT;
ALTER TABLE governed_stream ADD COLUMN superseded_by TEXT;  -- 'undo' | 'rollback'
ALTER TABLE governed_stream ADD COLUMN supersession_reason TEXT;
```

Add to `memory_edge`:

```sql
ALTER TABLE memory_edge ADD COLUMN is_valid INTEGER DEFAULT 1;
ALTER TABLE memory_edge ADD COLUMN invalidated_at TEXT;
ALTER TABLE memory_edge ADD COLUMN invalidation_reason TEXT;
```

---

## 9. API Design

### 9.1 Capabilities

#### `undoLastAction`

```typescript
const undoLastAction: Capability = {
  name: "undoLastAction",
  description: "Undo the last capability execution. Reverts files, git state, and marks records as superseded.",
  parameters: {
    type: "object",
    properties: {
      reason: { type: "string", description: "Optional reason for the undo" }
    }
  },
  preconditions: (ctx) => {
    if (!ctx.lastAction) return "No action to undo";
    if (ctx.lastAction.irreversible) return "Last action had irreversible effects";
    return true;
  }
};
```

#### `undoToCheckpoint`

```typescript
const undoToCheckpoint: Capability = {
  name: "undoToCheckpoint",
  description: "Undo to a specific checkpoint. Reverts all work after the checkpoint.",
  parameters: {
    type: "object",
    properties: {
      checkpoint_id: { type: "string" },
      reason: { type: "string" }
    },
    required: ["checkpoint_id"]
  }
};
```

#### `getUndoImpact`

```typescript
const getUndoImpact: Capability = {
  name: "getUndoImpact",
  description: "Preview what an undo would affect without executing it.",
  parameters: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["last_action", "sub_phase", "phase"] }
    }
  }
};
```

#### `listUndoTargets`

```typescript
const listUndoTargets: Capability = {
  name: "listUndoTargets",
  description: "List checkpoints that can be used as undo targets.",
  parameters: { type: "object", properties: {} }
};
```

### 9.2 Database RPC Methods

#### `runTransaction`

```typescript
// Single atomic transaction across multiple operations
db.runTransaction([
  { method: 'run', sql: 'UPDATE workflow_runs SET current_phase_id = ? WHERE id = ?', params: [targetPhase, runId] },
  { method: 'run', sql: 'UPDATE governed_stream SET superseded_at = ? WHERE workflow_run_id = ? AND produced_at > ?', params: [now, runId, checkpointTime] },
  { method: 'run', sql: 'INSERT INTO undo_executed (id, ...) VALUES (?, ...)' }
]);
```

---

## 10. Git Integration

### 10.1 CLI Tool Behavior (Research Summary)

| CLI Tool | Auto-Commit | Worktrees | Branch Management |
|----------|-------------|-----------|-------------------|
| **Claude Code** | No | `--worktree` flag (opt-in) | No |
| **Gemini** | No | `experimental.worktrees` (disabled by default) | No |
| **Codex** | No | Not supported | No |

**Conclusion:** JanumiCode can safely manage git checkpoints. CLIs don't interfere.

**Reference:** `cli-git-behavior-research-b1c6c5.md`

### 10.2 Checkpoint Creation Flow

```
Before sub-phase execution:
1. Check for git repository
2. Check for dirty working directory
   - If dirty: stash or prompt user
3. git add -A
4. git commit --no-verify -m "checkpoint: {phase}/{sub_phase}"
5. Store checkpoint in database
```

### 10.3 Undo Flow

```
1. Verify checkpoint commit exists: git rev-parse {sha}
2. Execute DB transaction (all-or-nothing)
3. git reset --hard {checkpoint_sha}
4. If stash exists: git stash apply {stash_id}
5. Notify orchestrator
```

### 10.4 Configuration

**Claude Code:**
```bash
claude -p "prompt" --output-format stream-json
# NO --worktree flag
```

**Gemini:**
```json
{ "experimental": { "worktrees": false } }
```

**Codex:**
```bash
codex exec --sandbox workspace-write -
# No worktree flags exist
```

---

## 11. Failure Handling

### 11.1 Failure Mode Categories

| Category | Count | Critical | Recoverable |
|----------|-------|----------|-------------|
| Git Operations | 6 | 2 | 4 |
| Database | 4 | 1 | 3 |
| Workflow State | 4 | 1 | 3 |
| File System | 4 | 1 | 3 |
| Concurrency | 3 | 1 | 2 |
| Partial Undo | 3 | 1 | 2 |
| Recovery | 3 | 1 | 2 |

**Reference:** `undo-capability-failure-modes-b1c6c5.md`

### 11.2 Critical Safeguards

| Safeguard | Purpose |
|-----------|---------|
| Workflow Run Locking | Prevent concurrent modifications during undo |
| Compensating Transaction Order | DB first, then git, then notify |
| Git Presence Detection | Fail gracefully if no git repo |
| Irreversibility Warning | User consent for partial undo |

### 11.3 Recovery Procedures

**Failed Undo Mid-Operation:**
1. Check `undo_executed` record - if exists, DB transaction succeeded
2. If DB succeeded but git failed: retry `git reset --hard`
3. If DB failed: no changes made, safe to retry
4. If both failed: check logs, manual recovery may be needed

**Checkpoint Corruption:**
1. Verify commit exists: `git rev-parse {sha}`
2. If missing: use `file_system_writes` table for manual restoration
3. Or: undo to earlier checkpoint

---

## 12. Implementation Phases

### Phase 1: Record-Level Undo
- [ ] Add supersession columns to `governed_stream`
- [ ] Add invalidation columns to `memory_edge`
- [ ] Implement `markRecordsSuperseded()` function
- [ ] Implement `invalidateMemoryEdges()` function
- [ ] Add `undo_executed` record type

### Phase 2: Workflow State Rollback
- [ ] Implement `rollbackWorkflowState()` function
- [ ] Implement `rollbackConstraints()` function
- [ ] Add Orchestrator notification via event bus
- [ ] Add context rebuild on rollback

### Phase 3: Batch Transaction Support (PREREQ)
- [ ] Add `handleTransaction` to v2 sidecar
- [ ] Add `runTransaction` to RPC client
- [ ] Test atomicity with crash scenarios

### Phase 4: Git Checkpoint System
- [ ] Add `git_checkpoints` table
- [ ] Implement checkpoint creation before sub-phases
- [ ] Handle dirty working directory (stash)
- [ ] Implement checkpoint verification

### Phase 5: File-Level Undo
- [ ] Add `file_system_writes` table
- [ ] Track file operations during CLI execution
- [ ] Implement file restoration via git reset
- [ ] Handle files outside git (backup system)

### Phase 6: Full Undo Capability
- [ ] Implement `undoLastAction` capability
- [ ] Implement `undoToCheckpoint` capability
- [ ] Implement `getUndoImpact` capability
- [ ] Implement `listUndoTargets` capability
- [ ] Add UI for undo preview and confirmation

---

## 13. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Should git be required? | Require git / Support non-git with backups | Require git for MVP |
| What happens to uncommitted user changes? | Force stash / Abort / Warn | Warn and prompt |
| How to handle external API calls? | Just warn / Compensating action hook | Warn + log for MVP |
| Should we support abort-and-undo? | Block until complete / Kill CLI then undo | Block for MVP |

---

## 14. References

- `janumicode-undo-capability-proposal-b1c6c5.md` - Original design proposal
- `cli-git-behavior-research-b1c6c5.md` - CLI tool git behavior research
- `undo-capability-failure-modes-b1c6c5.md` - Failure mode analysis
- `sqlite-transaction-sidecar-friction-b1c6c5.md` - Transaction atomicity issue
