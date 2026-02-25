# AI Agent Onboarding: Unified Governed Stream

Audience: AI software engineer with strong implementation ability and weak project context.

Primary goal: get you productive on JanumiCode's implemented Unified Governed Stream quickly, without requiring deep historical knowledge.

## 1. Fast Mental Model (Read First)

JanumiCode is not a chat app. It is a governed workflow engine with a stream UI.

- Source of truth is SQLite event/state, not chat memory.
- The Unified Governed Stream is a projection of that state.
- Workflow phases and claim verdicts control what can execute.
- Human gates block progress on critical uncertainty.
- UI updates are event-driven (event bus -> webview messages), with full re-render fallback.

If you remember one rule, remember this:

- Never add behavior that lets dialogue text bypass state, verdicts, or gates.

## 2. What Is Implemented (Current Reality)

The Unified Governed Stream is implemented and registered as the main sidebar webview.

The stream is a **multi-dialogue event timeline**: it renders ALL dialogues chronologically with boundary markers. Each dialogue is a bounded workflow sequence (INTAKE -> COMMIT) within the stream. The `dialogues` table (SQLite) tracks lifecycle status (ACTIVE, COMPLETED, ABANDONED). The sticky header (phase stepper, claim health) reflects only the active dialogue.

Core entrypoints:

- `JanumiCode/janumicode/src/extension.ts`
- `JanumiCode/janumicode/src/lib/ui/governedStream/GovernedStreamPanel.ts`
- `JanumiCode/janumicode/src/lib/ui/governedStream/dataAggregator.ts`
- `JanumiCode/janumicode/src/lib/ui/governedStream/html/components.ts`
- `JanumiCode/janumicode/src/lib/ui/governedStream/html/script.ts`
- `JanumiCode/janumicode/src/lib/integration/eventBus.ts`
- `JanumiCode/janumicode/src/lib/integration/dialogueOrchestrator.ts`
- `JanumiCode/janumicode/src/lib/dialogue/lifecycle.ts`

Registration and commands:

- View id: `janumicode.governedStream`
- Command to focus: `janumicode.openGovernedStream`
- Command to start new dialogue: `janumicode.startDialogue` (abandons current if active, focuses sidebar)
- Workflow status and claims commands are routed to same view.

See `JanumiCode/janumicode/package.json`.

## 3. 30-Minute Bring-Up Checklist

1. Install deps and build/watch.
2. Run extension in VS Code debug host.
3. Open JanumiCode activity bar icon.
4. Open command palette and run `JanumiCode: Start New Dialogue`.
5. Submit a simple goal.
6. Confirm in UI:
   - sticky phase stepper updates
   - phase milestone cards appear
   - rich role cards appear
   - claim health summary updates
   - gate card appears when blocked
7. Use settings gear in view title to verify API key panel and key status.

Build commands are in `JanumiCode/janumicode/package.json`:

- `pnpm run watch`
- `pnpm run compile`
- `pnpm run test`

## 4. Architecture You Need For Changes

### 4.1 Runtime Flow (Input -> Workflow -> UI)

1. User submits input in webview (`submitInput` message).
2. `GovernedStreamViewProvider` handles it in `_handleSubmitInput`.
3. If `_activeDialogueId` is null, calls `startDialogueWithWorkflow` (creates dialogue record + workflow state). If set, calls `advanceDialogueWithWorkflow`.
4. Provider runs `executeWorkflowCycle`.
5. Orchestrator/workflow emits events via event bus.
6. Provider listens and posts incremental webview updates or triggers `_update()`.
7. `_update()` uses `aggregateStreamState` which queries ALL dialogues from the `dialogues` table and builds a multi-dialogue stream with boundary markers. Header data is scoped to the active dialogue only.
8. When workflow reaches COMMIT, `completeDialogue()` is called and `_activeDialogueId` is cleared.
9. "Start New Dialogue" command calls `abandonDialogue()` on current active (if any), resets `_activeDialogueId`, and re-renders the stream.

### 4.2 Data Projection Flow

- `aggregateStreamState` queries ALL dialogues from the `dialogues` table (ordered by created_at).
- For each dialogue, builds stream items wrapped with boundary markers:
  - `dialogue_start` marker (goal, timestamp)
  - phase milestones
  - turn cards
  - gate cards
  - `dialogue_end` marker (for COMPLETED/ABANDONED dialogues)
- Claim health and open gates are computed for the active dialogue only.
- Falls back to legacy single-dialogue behavior if no `dialogues` table rows exist.

### 4.3 Message Contract (Extension <-> Webview)

From extension to webview (handled in `script.ts`):

- `turnAdded`
- `claimUpdated`
- `phaseChanged`
- `gateTriggered`
- `gateResolved`
- `showSettings`
- `keyStatusUpdate`
- `setInputEnabled`
- `setProcessing`
- `errorOccurred`

From webview to extension:

- `submitInput`
- `gateDecision`
- `refresh`
- `copySessionId`
- `requestKeyStatus`
- `setApiKey`
- `clearApiKey`

## 5. Non-Negotiable Invariants (Do Not Break)

When implementing any change, enforce:

- Execution remains gated by verification.
- Critical `UNKNOWN`/`DISPROVED` can block via gate.
- Human decision requires rationale (gate path).
- State remains authoritative over rendered stream.
- Event history remains append-only behaviorally.

Spec references:

- `JanumiCode/janumicode/docs/Architecture.md`
- `JanumiCode/janumicode/docs/Governed Multi-Role Dialogue & Execution System - Technical Specification.md`

## 6. File-Level Ownership Map (Edit Here For X)

If you need to change X, start in Y:

- Stream layout/cards/header/input: `src/lib/ui/governedStream/html/components.ts`
- Stream styles: `src/lib/ui/governedStream/html/styles.ts`
- Webview client behavior/events: `src/lib/ui/governedStream/html/script.ts`
- Server-side webview orchestration/events/settings/gates: `src/lib/ui/governedStream/GovernedStreamPanel.ts`
- Data snapshot shape and ordering logic: `src/lib/ui/governedStream/dataAggregator.ts`
- Event definitions and publish-subscribe: `src/lib/integration/eventBus.ts`
- Dialogue/workflow lifecycle glue: `src/lib/integration/dialogueOrchestrator.ts`
- Dialogue lifecycle tracking (ACTIVE/COMPLETED/ABANDONED): `src/lib/dialogue/lifecycle.ts`
- Core workflow transitions and gating: `src/lib/workflow/orchestrator.ts`, `src/lib/workflow/stateMachine.ts`, `src/lib/workflow/gates.ts`, `src/lib/workflow/humanGateHandling.ts`
- Extension registration/commands/status bar: `src/extension.ts`
- View/command contribution metadata: `package.json`

## 7. Implementation Recipes (Common Tasks)

### 7.1 Add New Card Type To Stream

1. Extend `StreamItem` union in `dataAggregator.ts`.
2. Insert item in timeline build logic.
3. Add render function in `components.ts`.
4. Update `renderStream()` switch.
5. Add CSS in `styles.ts`.
6. If interactive, add `data-action` path in `script.ts` and handle message in panel.

### 7.2 Add New Header Metric

1. Extend `GovernedStreamState` and compute in `aggregateStreamState`.
2. Render metric in `renderStickyHeader`.
3. Ensure updates happen on relevant event handlers in panel (`_subscribeToEvents`).

### 7.3 Add New Phase

1. Update phase enum and workflow transitions.
2. Add phase to `WORKFLOW_PHASES` in `dataAggregator.ts`.
3. Add placeholder text in `components.ts`.
4. Update phase label mapping in `GovernedStreamPanel.ts` processing indicator.
5. Verify milestone insertion on transition.

### 7.4 Change Gate UX

1. Update `renderHumanGateCard` markup.
2. Keep rationale minimum guard (webview and provider both enforce).
3. Preserve `APPROVE | REJECT | OVERRIDE | REFRAME`.
4. Ensure `processHumanGateDecision` remains single authority.

## 8. Debugging Workflow (Minimal)

When behavior is wrong, debug in this order:

1. Confirm event emitted.
2. Confirm panel subscription receives event.
3. Confirm webview message posted.
4. Confirm client handler updates DOM.
5. If incremental path fails, verify full `_update()` output.

Useful greps:

```powershell
rg -n "emit\\(|workflow:|claim:|dialogue:" JanumiCode/janumicode/src/lib
rg -n "onDidReceiveMessage|postMessage|data-action" JanumiCode/janumicode/src/lib/ui/governedStream
rg -n "_handleSubmitInput|_runWorkflowCycle|_update\\(" JanumiCode/janumicode/src/lib/ui/governedStream/GovernedStreamPanel.ts
```

## 9. Common Failure Modes

- UI looks stale: event emitted but no panel subscription or no refresh fallback.
- Gate actions do nothing: missing `data-gate-id` wiring or invalid action mapping.
- Phase stepper wrong: `WORKFLOW_PHASES` not aligned with workflow enum.
- Claims health wrong: status mapping incomplete in `computeClaimHealth`.
- Input stuck disabled: processing indicator lifecycle did not clear in `finally`.

## 10. Known Product/Doc Drift You Should Expect

- Historical docs describe older split views; unified stream is now implemented.
- Some roadmap items are marked complete while TODOs remain in command handlers.
- Start-dialogue command (`janumicode.startDialogue`) is now wired: it focuses the sidebar and calls `startNewDialogue()` on the panel provider.

Treat code as execution truth; treat docs as intent unless recently updated.

## 11. Guardrails For AI Agent Contributors

Before any PR/change:

1. Verify no invariant is weakened (gates, verification, state authority).
2. Prefer additive event-driven changes over ad hoc direct DOM edits.
3. Keep server/client message contracts explicit and version-safe.
4. Add or update docs in this folder when behavior changes.
5. Test one happy path and one gate-blocked path manually.

## 12. Suggested First Tasks For New Contributors

1. Add a small metric to sticky header and wire updates.
2. Add a compact "last event" debug badge in stream footer.
3. Improve gate resolution visual state with action + timestamp.
4. Add a focused unit test around `computeClaimHealth` and stream ordering.

## 13. Canonical References

- Architecture: `JanumiCode/janumicode/docs/Architecture.md`
- Spec baseline: `JanumiCode/janumicode/docs/Governed Multi-Role Dialogue & Execution System - Technical Specification.md`
- UI design intent: `JanumiCode/janumicode/docs/UI-UX Design for JanumiCode.md`
- Integration details: `JanumiCode/janumicode/docs/Claude Code Integration.md`
- Build/debug: `JanumiCode/janumicode/docs/Build-Debug-Deploy.md`

