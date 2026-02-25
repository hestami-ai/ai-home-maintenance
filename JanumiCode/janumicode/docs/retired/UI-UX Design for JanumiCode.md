# UI/UX Design Specification: The Governed Stream

**JanumiCode VS Code Extension**

## 1. Design Philosophy
The JanumiCode UI is a **structured projection of the underlying SQLite event log**. Unlike a standard chat interface, this is a "Governed Stream" where every message represents a state change, a claim, or a verification event.

### Core Principles
- **Chronological Authority**: The stream is the single source of truth for the current session.
- **Role-Based Visual Identity**: Each of the 6 roles has a distinct visual signature to prevent "speaker confusion."
- **Blocking Gates**: Human intervention points are not messages; they are functional UI components that halt the stream.
- **State over Dialogue**: The UI prioritizes the status of claims and the current workflow phase over free-text exchange.

---

## 2. Layout Architecture
The extension will move from a three-way split view to a **Unified Webview** with three functional zones.

### 2.1 The Sticky Header (Global State)
Fixed at the top of the Webview.
- **Phase Indicator**: A progress stepper showing the 8 phases (INTAKE → COMMIT). The active phase is highlighted.
- **Claim Health Bar**: A summary widget: `[Verified: 4 | Unknown: 1 | Disproved: 0 | Open: 2]`.
- **Session ID**: Small, copyable UUID for audit referencing.

### 2.2 The Governed Stream (The Hero View)
A scrollable area containing a sequence of **Rich Cards**.

#### Role Visual Signatures:
| Role | Color Accent | Icon |
| :--- | :--- | :--- |
| **Human** | `vscode-charts-blue` | `$(account)` |
| **Executor** | `vscode-charts-green` | `$(terminal)` |
| **Verifier** | `vscode-charts-red` | `$(shield)` |
| **Tech Expert** | `vscode-charts-yellow` | `$(beaker)` |
| **Historian** | `vscode-charts-purple` | `$(history)` |

### 2.3 The Contextual Input Area
Fixed at the bottom.
- **Dynamic Placeholder**: Changes based on phase (e.g., "Describe your goal..." vs "Provide rationale for override...").
- **Action Buttons**: Primary actions (e.g., "Start Verification") appear above the text box when the system is waiting for a transition.

---

## 3. Component Specifications

### 3.1 Phase Milestone Dividers
When the workflow transitions (e.g., PROPOSE → VERIFY), a full-width horizontal divider is inserted into the stream.
- **Label**: "Entering VERIFY Phase"
- **Timestamp**: ISO-8601.

### 3.2 The Executor Proposal Card
- **Content**: Markdown-rendered plan.
- **Artifacts**: Collapsible file-tree view of proposed changes.
- **Assumptions List**: A nested list of claims extracted from this specific proposal.

### 3.3 The Verifier "Live" Card
This card updates in real-time as the Technical Expert feeds it evidence.
- **Claim Statement**: The normalized claim text.
- **Evidence Log**: A small, scrolling sub-window showing raw evidence snippets.
- **Verdict Badge**: Transitions from `⚪ PENDING` → `✅ VERIFIED` | `❓ UNKNOWN` | `❌ DISPROVED`.

### 3.4 The Human Gate (Decision Card)
When a gate triggers, the stream stops. A high-contrast card is rendered.
- **Header**: "🚧 Human Decision Required: [Reason]"
- **Context**: Summary of the blocking claim and the Verifier's rationale.
- **Action Group**:
    - `[APPROVE]`: Proceed as if verified.
    - `[REJECT]`: Terminate and replan.
    - `[OVERRIDE]`: Proceed with risk acknowledgment.
    - `[REFRAME]`: Adjust constraints.
- **Rationale Input**: A required text area that enables the action buttons only after text is entered.

---

## 4. Interaction Patterns

### 4.1 Real-time Updates (The Subscription Model)
The Webview does not "poll." It uses a `vscode.postMessage` bridge to receive events from the `DialogueOrchestrator`.
1. **Event**: `claim_event` (Type: VERIFIED).
2. **Action**: Find the DOM element with `data-claim-id` and update its CSS class and icon.

### 4.2 Historical Contradiction Highlighting
When the Historian-Interpreter finds a contradiction:
- A **Warning Card** appears in the stream.
- It contains a "View Precedent" button that, when clicked, scrolls the stream back to the original decision or opens the historical record in a side-by-side diff.

---

## 5. Visual Style Guide (VS Code Integration)

### Colors
Use VS Code CSS variables to ensure theme compatibility:
- **Background**: `var(--vscode-editor-background)`
- **Card BG**: `var(--vscode-welcomePage-tile-background)`
- **Border**: `var(--vscode-widget-border)`
- **Text**: `var(--vscode-foreground)`

### Typography
- **Body**: `var(--vscode-font-family)`
- **Code**: `var(--vscode-editor-font-family)`

---

## 6. Implementation Checklist for Agent

- [ ] **Phase 1**: Implement the Webview provider and basic message passing.
- [ ] **Phase 2**: Create the `GovernedStream` React/Vanilla component that maps `dialogue_turns` to `RichCards`.
- [ ] **Phase 3**: Implement the "Sticky Header" that derives state from the `claims` and `workflow_state` tables.
- [ ] **Phase 4**: Build the `HumanGate` component with mandatory rationale validation.
- [ ] **Phase 5**: Add "Scroll-to-Claim" logic to link the Header summary to the Stream content.

---

## 7. Example Stream Sequence

1. **[HUMAN]**: "Add a login endpoint."
2. **[SYSTEM]**: --- Entering PROPOSE Phase ---
3. **[EXECUTOR]**: "I will create `auth.ts`. **Assumption**: We use JWT."
4. **[SYSTEM]**: --- Entering VERIFY Phase ---
5. **[VERIFIER]**: "Verifying: 'System uses JWT'..."
6. **[TECH EXPERT]**: "Found `jsonwebtoken` in `package.json`."
7. **[VERIFIER]**: "Verdict: ✅ VERIFIED."
8. **[SYSTEM]**: --- Entering EXECUTE Phase ---
```

<!--
[PROMPT_SUGGESTION]Can you suggest the CSS styles for the "Human Gate" card to make it look distinct from regular messages?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]How should the Webview handle very long streams to maintain performance without losing the "infinite history" feel?[/PROMPT_SUGGESTION]
