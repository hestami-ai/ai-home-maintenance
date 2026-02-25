## **What Claude Code gives you (the hard interface contracts)**

### **1\) Hooks are *local processes* with a strict JSON contract**

Claude Code hooks are invoked at lifecycle points and communicate via **stdin (JSON input), stdout/stderr, and exit codes**.

Key implications for your extension:

* Every hook invocation can be treated as a **structured event**.

* Hook scripts can **block/allow/ask** depending on event, using either exit codes or JSON output (JSON is only processed on exit 0).

* Hook stdout must contain **only the JSON object** when using structured JSON output; any extra output can break parsing.

### **2\) Hook events cover the exact “control points” you need**

Claude Code documents hook events including: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`, plus compaction-related and subagent events.

For governance \+ traceability, the big ones are:

* **UserPromptSubmit**: intercept a user prompt *before* Claude processes it.

* **PreToolUse**: see/modify/block tool calls *before* they execute; can also “ask” (escalate) to user.

* **PermissionRequest**: allow/deny permission dialogs programmatically.

* **PostToolUse / PostToolUseFailure**: capture tool outputs and failures with structured context.

* **Stop**: know when Claude “finishes responding” (great for delimiting turns).

### **3\) Hooks snapshot at session start**

Claude Code captures a snapshot of hook configuration at startup and uses it for the session; changes require review/restart to take effect.

That matters because your extension cannot rely on “hot-updating” hook configuration mid-run.

### **4\) You already get a transcript file path from every hook**

Common input fields include `transcript_path` (path to the conversation JSONL), `session_id`, `cwd`, and `permission_mode`.

This is a key integration primitive: you can ingest **Claude’s session transcript** independently of streaming stdout.

---

## **What your VS Code extension should do (recommended integration architecture)**

You effectively have **two data planes** to integrate:

1. **Real-time events** (hooks firing live)

2. **Authoritative replay log** (Claude transcript JSONL \+ your own event store)

### **A. Real-time plane: use hooks to emit events to the extension**

**Goal:** The extension receives structured “Executor activity” *as it happens*.

**Mechanism:** Configure Claude Code hooks whose command is a **small forwarder** that:

* reads the hook JSON from stdin,

* adds minimal metadata (timestamp, hook name),

* forwards it to the extension via local IPC,

* exits 0 (never blocks by default in your “trusted executor” mode).

You can implement IPC in one of three robust ways:

1. **Local HTTP** (extension starts a localhost server; hook POSTs JSON)

2. **Unix domain socket / named pipe** (lower overhead, more plumbing)

3. **File spool \+ watcher** (hook appends to a file; extension tails it)

Because Claude Code may run in environments like WSL/remote containers, **file spool \+ watcher** is often the most portable; localhost is easiest when you control the runtime.

Why this works well with Claude’s hooks:

* Hooks already give you structured JSON inputs for tool name \+ tool input, and later tool responses.

* You can capture permission prompts and notifications too.

### **B. Replay plane: ingest `transcript_path` and correlate with hook events**

**Goal:** Your SQLite “infinite conversation” store stays consistent and queryable even if streaming events drop.

**Mechanism:**

* Whenever you receive any hook event, persist:

  * `session_id`, `cwd`, `hook_event_name`, and `transcript_path`

* Run a background ingestion loop in the extension that:

  * tails the transcript JSONL at `transcript_path`,

  * extracts “turn boundaries” (e.g., `Stop` events are a natural delimiter),

  * stores transcript entries in SQLite and links them to your workflow phases.

This gives you:

* **eventual consistency** even when IPC is imperfect,

* reproducibility (you can reconstruct what happened from transcript \+ your own workflow events).

---

## **How to map Claude Code events into your SRD workflow/state machine**

### **1\) “Executor Activity Feed” \= hooks \+ transcript**

* **PreToolUse** → “intent to act” (command about to run / file about to be written)

* **PermissionRequest** → “needs approval surface” (even if you trust executor, this tells you what it’s asking to do)

* **PostToolUse** → “action completed \+ outputs available”

* **PostToolUseFailure** → “action failed \+ error details”

Your extension should treat these as **append-only events** that drive UI updates, and optionally advance gates.

### **2\) Human escalation on failure (your requirement)**

You said: failures should **escalate to human with retry options**.

Implementation detail:

* On `PostToolUseFailure`, transition your workflow engine to `HUMAN_GATE` and present:

  * Retry same action

  * Retry with modified inputs

  * Ask Technical Expert/Historian to propose repair plan

  * Resume executor

Claude already includes error fields and tool input in the event payload.

### **3\) If you want “soft governance” without blocking**

Even with “trusted executor,” you can still use hook JSON output to:

* inject **additionalContext** (e.g., “spec invariants INV-\#\#\# apply here”) during `SessionStart` / `UserPromptSubmit` / `PreToolUse`

* convert your workflow engine’s current state into *context* Claude sees, without relying on the model to remember.

This aligns with your “dialogue subordinate to state” principle, while keeping executor autonomy.

---

## **Operational caveats you must design around**

1. **Hooks run in parallel and commands can be deduplicated.**  
    If you depend on ordering, use timestamps \+ tool\_use\_id where available, and never assume sequential execution.

2. **JSON parsing is brittle if stdout contains extra text.**  
    If you use structured JSON output, ensure your hook runner emits *only* JSON to stdout.

3. **Hook config isn’t hot-reloaded.**  
    Your extension needs an “Apply \+ Restart Claude session” UX if you generate hooks dynamically.

4. **Transcript ingestion is your safety net.**  
    Because every hook input includes `transcript_path`, treat it as authoritative for replay and reconciliation.

---

## **Concrete “effective” integration pattern (minimal moving parts)**

**v0 design recommendation:**

* Configure a small set of hooks: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`.

* Each hook runs the same forwarder script that writes events to:

  * a workspace-local spool file (append JSON lines), and/or

  * localhost IPC if available

* Extension:

  * tails spool file for real-time UI,

  * tails `transcript_path` for durable ingestion,

  * writes both into SQLite with stable IDs.

This is robust across terminals/VS Code, and doesn’t require you to reverse-engineer Claude’s internal UI.

