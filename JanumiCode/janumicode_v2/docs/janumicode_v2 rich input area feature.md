# JanumiCode Intent Composer - Feature Requirements Document

**Summary:** A rich input composer at the bottom of the Governed Stream sidebar supporting file attachments, @mentions, slash commands, and dual-mode operation (Raw Intent for new workflows, Open Query for active workflows).

---

# Part 1: Product Requirements

## 1. Overview

### Problem Statement

Users need a unified input interface for:
1. Starting new workflows with raw intents
2. Asking questions during active workflows
3. Attaching context (files, references, constraints)

Without a unified composer, users must navigate different interfaces for different actions.

### Goals

| Goal | Description |
|------|-------------|
| **G1** | Single input area for all user interactions |
| **G2** | Support rich context attachment (files, @mentions) |
| **G3** | Clear mode indication (new workflow vs. active workflow query) |
| **G4** | Efficient token usage visibility |

### Non-Goals (MVP)

| Non-Goal | Reason |
|----------|--------|
| Rich text/markdown rendering | Plain text + chips sufficient |
| Monaco Editor | Overkill for input |
| Intent templates | Users type free-form for now |
| Real-time validation | Post-submit quality check |
| Intent history dropdown | Defer to future |

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to submit intent | < 3 seconds from focus |
| Attachment success rate | > 99% |
| Mode clarity | 0% confusion in user testing |
| Token estimate accuracy | ±20% of actual |

---

## 2. User Stories

### US-1: Start New Workflow

**As a** user with a new idea  
**I want to** type my intent and press send  
**So that** JanumiCode begins working on it

**Acceptance Criteria:**
- [ ] AC-1.1: Composer shows "Start a new workflow..." placeholder when no run active
- [ ] AC-1.2: Ctrl+Enter or Send button submits intent
- [ ] AC-1.3: Workflow starts, Phase 0 begins
- [ ] AC-1.4: Composer shows loading state during processing

### US-2: Attach Files

**As a** user with relevant context files  
**I want to** attach files to my intent  
**So that** JanumiCode has the right context

**Acceptance Criteria:**
- [ ] AC-2.1: + button opens VS Code file picker
- [ ] AC-2.2: Drag-drop from explorer adds attachments
- [ ] AC-2.3: Files display as removable chips
- [ ] AC-2.4: Multiple files supported (horizontal scroll)

### US-3: Use @mentions

**As a** user referencing prior work  
**I want to** @mention decisions, constraints, phases  
**So that** my intent has precise context

**Acceptance Criteria:**
- [ ] AC-3.1: @ triggers autocomplete dropdown
- [ ] AC-3.2: 6 mention types: file, symbol, decision, constraint, phase, run
- [ ] AC-3.3: Keyboard navigation (arrows + Enter)
- [ ] AC-3.4: Selected mentions become chips

### US-4: Ask Question During Workflow

**As a** user with an active workflow  
**I want to** ask a question without interrupting  
**So that** I get clarification while work continues

**Acceptance Criteria:**
- [ ] AC-4.1: Composer shows "Ask a question..." placeholder when run active
- [ ] AC-4.2: Query routes to Client Liaison Agent
- [ ] AC-4.3: Response appears in Governed Stream
- [ ] AC-4.4: Workflow continues unaffected

### US-5: Use Slash Commands

**As a** user wanting quick actions  
**I want to** type / commands  
**So that** I can perform common actions efficiently

**Acceptance Criteria:**
- [ ] AC-5.1: `/start` begins new workflow
- [ ] AC-5.2: `/attach` opens file picker
- [ ] AC-5.3: `/clear` clears composer
- [ ] AC-5.4: `/help` shows available commands
- [ ] AC-5.5: `/status` shows current workflow status

---

## 3. Functional Requirements

### FR-1: Multi-line Text Input (P1)

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Textarea grows from 1 to 8 lines dynamically |
| FR-1.2 | After 8 lines, scrolls internally |
| FR-1.3 | Shift+Enter adds new line |
| FR-1.4 | Ctrl+Enter submits |
| FR-1.5 | Escape clears composer |

### FR-2: File Attachments (P1)

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | + button opens VS Code file picker (multi-select) |
| FR-2.2 | Drag-drop from VS Code explorer adds files |
| FR-2.3 | Files display as chips with icon + name + × |
| FR-2.4 | × removes attachment |
| FR-2.5 | Horizontal scrollable attachment bar |
| FR-2.6 | Store file URIs for submission |

### FR-3: @mention Autocomplete (P1)

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | @ character triggers dropdown |
| FR-3.2 | 6 mention types with icons |
| FR-3.3 | Filter as user types |
| FR-3.4 | Arrow keys navigate, Enter selects |
| FR-3.5 | Selected mention becomes chip in composer |
| FR-3.6 | Tab accepts first suggestion |

### FR-4: Context Bar (P1)

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Shows active file (click to attach) |
| FR-4.2 | Shows constraint count (click to expand) |
| FR-4.3 | Shows reference count (click to expand) |
| FR-4.4 | Only visible when has content |

### FR-5: Mode Detection (P1)

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | No active run = Raw Intent mode |
| FR-5.2 | Active run = Open Query mode |
| FR-5.3 | Different placeholder text per mode |
| FR-5.4 | Phase indicator shows current phase |

### FR-6: Token Counter (P2)

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Live token estimate (words × 1.3) |
| FR-6.2 | Updates on every keystroke |
| FR-6.3 | Includes attachments in estimate |

### FR-7: Slash Commands (P2)

| Requirement | Description |
|-------------|-------------|
| FR-7.1 | `/start` - begin new workflow |
| FR-7.2 | `/attach` - open file picker |
| FR-7.3 | `/clear` - clear composer |
| FR-7.4 | `/help` - show command list |
| FR-7.5 | `/status` - show workflow status |

### FR-8: Loading State (P1)

| Requirement | Description |
|-------------|-------------|
| FR-8.1 | Spinner during submission |
| FR-8.2 | Send button disabled |
| FR-8.3 | Text input disabled |

---

## 4. Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target |
|-------------|--------|
| NFR-1.1 | Time to focus composer | < 100ms |
| NFR-1.2 | Autocomplete appears | < 200ms |
| NFR-1.3 | File attach (picker) | VS Code native |
| NFR-1.4 | Submit response | < 500ms to acknowledge |

### NFR-2: Usability

| Requirement | Description |
|-------------|-------------|
| NFR-2.1 | Clear mode indication via placeholder |
| NFR-2.2 | Keyboard shortcuts match VS Code patterns |
| NFR-2.3 | Chips use consistent styling |
| NFR-2.4 | Loading state clearly visible |

### NFR-3: Accessibility

| Requirement | Description |
|-------------|-------------|
| NFR-3.1 | ARIA labels on all interactive elements |
| NFR-3.2 | Tab order logical |
| NFR-3.3 | Screen reader announces attachments |
| NFR-3.4 | High contrast support via VS Code CSS vars |

---

## 5. Out of Scope (MVP)

| Feature | Reason | Future Consideration |
|---------|--------|----------------------|
| Intent templates | Users type free-form | Phase 2 |
| Recent intents history | Requires storage | Phase 2 |
| Real-time validation | Post-submit sufficient | Phase 2 |
| Image preview thumbnails | Chips sufficient | Phase 3 |
| Symbol navigation | Complex integration | Phase 3 |
| Full context panel | Compact bar sufficient | Phase 2 |

---

# Part 2: Technical Specification

## 6. Architecture

### 6.1 Component Structure

```
src/webview/
  components/
    IntentComposer.svelte      # Main composer component
    ContextBar.svelte          # Compact context indicators
    AttachmentBar.svelte       # File attachment chips
    MentionAutocomplete.svelte # @mention dropdown
  stores/
    composer.ts                # Composer state store
```

### 6.2 Position in Layout

```
+----------------------------------------------------------+
|  [Governed Stream - scrollable content above]            |
|  ...                                                     |
+----------------------------------------------------------+
|  +----------------------------------------------------+  |
|  | Context Bar (compact, expandable)                  |  |
|  +----------------------------------------------------+  |
|  +----------------------------------------------------+  |
|  | Attachment Bar (horizontal scroll)                 |  |
|  +----------------------------------------------------+  |
|  +----------------------------------------------------+  |
|  |  Intent Composer (multi-line, grows to max 8 lines)|  |
|  +----------------------------------------------------+  |
|  +----------------------------------------------------+  |
|  | [Send] | 247 tokens | Phase 1: INTAKE              |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

---

## 7. Data Model

### 7.1 Composer State

```typescript
interface ComposerState {
  text: string;                    // Raw text content
  attachments: Attachment[];       // File URIs + metadata
  references: Reference[];         // @mentions
  isSubmitting: boolean;
  currentPhase: PhaseId | null;
  contextSummary: ContextSummary | null;
}

interface Attachment {
  uri: string;         // VS Code file URI
  name: string;        // Display name
  type: 'file' | 'image';
  size?: number;
}

interface Reference {
  type: 'file' | 'symbol' | 'decision' | 'constraint' | 'phase' | 'run';
  id: string;
  display: string;     // Chip text
  uri?: string;        // For files
}

interface ContextSummary {
  activeFile: string | null;
  constraintCount: number;
  referenceCount: number;
}
```

### 7.2 @mention Types

| Type | Source | Example |
|------|--------|---------|
| `file` | Workspace files | `@src/auth.ts` |
| `symbol` | LSP symbols | `@AuthService.login()` |
| `decision` | Governed Stream decisions | `@decision:ADR-003` |
| `constraint` | Active constraints | `@constraint:auth-flow` |
| `phase` | Prior phase output | `@phase:1.intent_statement` |
| `run` | Prior workflow run | `@run:2024-03-15` |

---

## 8. API Design

### 8.1 Webview Messages (to Extension)

#### `submitIntent`

```typescript
interface SubmitIntentMessage {
  type: 'submitIntent';
  intent: string;
  attachments: string[];    // File URIs
  references: Reference[];
}
```

#### `submitOpenQuery`

```typescript
interface SubmitOpenQueryMessage {
  type: 'submitOpenQuery';
  query: string;
  attachments: string[];
  references: Reference[];
}
```

#### `pickFile`

```typescript
interface PickFileMessage {
  type: 'pickFile';
  multiple?: boolean;
}
```

#### `resolveMention`

```typescript
interface ResolveMentionMessage {
  type: 'resolveMention';
  query: string;        // Text after @
  types?: string[];     // Filter by mention types
}
```

### 8.2 Extension Messages (to Webview)

#### `contextUpdate`

```typescript
interface ContextUpdateMessage {
  type: 'contextUpdate';
  summary: ContextSummary;
}
```

#### `phaseUpdate`

```typescript
interface PhaseUpdateMessage {
  type: 'phaseUpdate';
  phaseId: PhaseId;
  phaseName: string;
}
```

---

## 9. Client Liaison Integration

### 9.1 Mode Detection

```typescript
function getComposerMode(state: ComposerState): 'raw_intent' | 'open_query' {
  return state.currentPhase ? 'open_query' : 'raw_intent';
}
```

### 9.2 Submission Routing

```typescript
async function handleSubmit(state: ComposerState): Promise<void> {
  const mode = getComposerMode(state);
  
  if (mode === 'raw_intent') {
    // Start new workflow
    await vscode.postMessage({
      type: 'submitIntent',
      intent: state.text,
      attachments: state.attachments.map(a => a.uri),
      references: state.references
    });
  } else {
    // Route to Client Liaison
    await vscode.postMessage({
      type: 'submitOpenQuery',
      query: state.text,
      attachments: state.attachments.map(a => a.uri),
      references: state.references
    });
  }
}
```

### 9.3 Placeholder Text

| Mode | Placeholder |
|------|-------------|
| Raw Intent | "Start a new workflow... (Ctrl+Enter to send)" |
| Open Query | "Ask a question... (Ctrl+Enter to send)" |

---

## 10. Implementation Steps

### Step 1: Create Composer State Store

- `src/webview/stores/composer.ts`
- Svelte writable store with ComposerState
- Actions: setText, addAttachment, removeAttachment, addReference, removeReference, submit, clear

### Step 2: Build IntentComposer Component

- `src/webview/components/IntentComposer.svelte`
- Multi-line textarea (auto-grow to 8 lines)
- Send button, Ctrl+Enter shortcut
- Token counter (simple word-count estimate)
- Loading state (spinner during submit)
- Phase indicator

### Step 3: Build AttachmentBar Component

- `src/webview/components/AttachmentBar.svelte`
- Horizontal scrollable container
- File chips with icon + name + ×
- + button triggers VS Code file picker
- Drag-drop zone highlight

### Step 4: Build ContextBar Component

- `src/webview/components/ContextBar.svelte`
- Compact row of indicators
- Only renders if has content
- Shows: active file, constraint count, reference count

### Step 5: Build MentionAutocomplete Component

- `src/webview/components/MentionAutocomplete.svelte`
- Triggered on `@` character
- Dropdown with filter input
- Keyboard navigation (arrows + Enter)
- Shows: files, symbols, decisions, constraints, phases, runs

### Step 6: Wire File Picker

- Extension host handles `pickFile` message
- Uses `vscode.window.showOpenDialog`
- Returns selected URIs to webview
- Webview adds to attachments

### Step 7: Wire @mention Resolution

- Extension host handles `resolveMention` message
- Queries database for matching items
- Returns list of candidates
- Webview shows in autocomplete

### Step 8: Wire Submit to Workflow

- Extension host handles `submitIntent` message
- Creates workflow run if none active
- Logs `raw_intent_received` record
- Triggers Phase 0 execution

### Step 9: Wire Submit to Client Liaison

- Extension host handles `submitOpenQuery` message
- Logs `open_query_received` record
- Invokes Client Liaison Agent
- Displays response in Governed Stream

### Step 10: Update App.svelte Layout

- Position composer at bottom (fixed)
- Scrollable content area above
- Pass vscode handle to composer
- Wire message handlers

---

## 11. Styling Approach

- Use VS Code CSS variables for theming
- Composer fixed at bottom with `position: sticky`
- Attachment bar above composer
- Context bar above attachment bar
- Consistent with existing card styling

### Key CSS Variables

```css
--vscode-input-background
--vscode-input-foreground
--vscode-input-border
--vscode-button-background
--vscode-button-foreground
--vscode-button-secondaryBackground
```

---

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Send intent |
| `Shift+Enter` | New line (multi-line) |
| `Escape` | Clear composer / cancel |
| `Tab` | Accept autocomplete |
| `Ctrl+Space` | Trigger autocomplete |
| `Ctrl+K` | Attach file (VS Code pattern) |
| `Arrow Up/Down` | Navigate autocomplete |

---

## 13. Testing Checklist

- [ ] Textarea grows to 8 lines, then scrolls
- [ ] Ctrl+Enter submits intent
- [ ] Send button submits intent
- [ ] + button opens file picker
- [ ] Drag-drop adds attachments
- [ ] Attachment chips show with × remove
- [ ] @ triggers autocomplete dropdown
- [ ] Arrow keys navigate autocomplete
- [ ] Enter selects autocomplete item
- [ ] Context bar shows when has content
- [ ] Phase indicator shows when run active
- [ ] Loading spinner during submit
- [ ] Raw Intent mode when no active run
- [ ] Open Query mode when run active
- [ ] Token counter updates live

---

## 14. References

- `janumicode-input-area-bloom-b1c6c5.md` - Full feature vision
- `janumicode-input-area-implementation-b1c6c5.md` - Implementation details
