# JanumiCode Phase Indicator - Feature Requirements Document

**Summary:** A compact UI component displaying the current workflow phase with a mini-timeline progress visualization, designed to fit within the narrow sidebar width constraints.

---

# Part 1: Product Requirements

## 1. Overview

### Problem Statement

The v1 JanumiCode breadcrumb showed all 12 phases with sub-phases, requiring horizontal scrolling in the narrow sidebar. This created poor UX as users couldn't see the full workflow context without scrolling.

### Goals

| Goal | Description |
|------|-------------|
| **G1** | Display current phase prominently with full textual label |
| **G2** | Show overall workflow progress at a glance |
| **G3** | Fit within sidebar width (~300px) without horizontal scroll |
| **G4** | Enable navigation to completed phases |

### Non-Goals (MVP)

| Non-Goal | Reason |
|----------|--------|
| Sub-phase timeline display | Too many items, would clutter |
| Phase editing/reordering | Phases are sequential, not editable |
| Multi-workflow comparison | Single workflow focus |

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to identify current phase | < 1 second |
| Navigation to completed phase | < 2 clicks |
| User comprehension | "I know where we are" in testing |

---

## 2. User Stories

### US-1: See Current Phase

**As a** user with an active workflow  
**I want to** see the current phase name prominently  
**So that** I know what's happening

**Acceptance Criteria:**
- [ ] AC-1.1: Current phase name displayed in full (not abbreviated)
- [ ] AC-1.2: Current sub-phase shown below phase name
- [ ] AC-1.3: Visual distinction from other UI elements

### US-2: Understand Progress

**As a** user tracking workflow progress  
**I want to** see where we are in the overall workflow  
**So that** I understand how much work remains

**Acceptance Criteria:**
- [ ] AC-2.1: Mini-timeline shows all 12 phases as dots
- [ ] AC-2.2: Completed phases visually distinct from future phases
- [ ] AC-2.3: Current phase highlighted on timeline

### US-3: Navigate to Completed Phase

**As a** user reviewing past work  
**I want to** click on a completed phase  
**So that** I can jump to that phase's records

**Acceptance Criteria:**
- [ ] AC-3.1: Click on completed phase dot scrolls to phase milestone
- [ ] AC-3.2: Hover on any dot shows phase name tooltip
- [ ] AC-3.3: Future/current phase dots show appropriate cursor

---

## 3. Functional Requirements

### FR-1: Current Phase Display (P1)

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Display full phase name (e.g., "Architecture Definition") |
| FR-1.2 | Display current sub-phase name below |
| FR-1.3 | Use prominent typography (larger than timeline) |
| FR-1.4 | Update in real-time as workflow progresses |

### FR-2: Mini-Timeline (P1)

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Single row of 12 dots representing all phases |
| FR-2.2 | Dots connected by subtle line/connector |
| FR-2.3 | Three dot states: completed, current, future |
| FR-2.4 | Phase 0.5 shown as dimmed/conditional |

### FR-3: Dot States (P1)

| State | Visual | Description |
|-------|--------|-------------|
| **Completed** | `filled dot (solid)` | Phase gate approved |
| **Current** | `filled dot (accent color)` | Active phase, highlighted |
| **Future** | `hollow dot (outline)` | Not yet reached |
| **Conditional** | `dimmed dot` | Phase 0.5 only if triggered |

### FR-4: Interactivity (P1)

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Hover on timeline shows flyout with full phase list |
| FR-4.2 | Flyout shows all phases with names and status icons |
| FR-4.3 | Click on completed phase (dot or flyout item) scrolls to milestone |
| FR-4.4 | Click on current/future phase does nothing |
| FR-4.5 | Keyboard: Tab to focus dots, Enter to navigate |

### FR-5: Phase Flyout (P1)

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Flyout appears on hover over timeline area |
| FR-5.2 | Shows vertical list of all 12 phases with full names |
| FR-5.3 | Each phase shows status icon (checkmark, current, empty) |
| FR-5.4 | Flyout positioned above or below timeline (depending on space) |
| FR-5.5 | Flyout dismisses when mouse leaves timeline + flyout area |
| FR-5.6 | Click on flyout item navigates to that phase |

### FR-6: No Active Run State (P2)

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Show "No Active Workflow" when no run |
| FR-6.2 | Timeline shows all hollow dots |
| FR-6.3 | Component still visible (not hidden) |

---

## 4. Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target |
|-------------|--------|
| NFR-1.1 | Render time | < 50ms |
| NFR-1.2 | Tooltip appear | < 200ms hover |
| NFR-1.3 | Scroll to phase | < 300ms |

### NFR-2: Accessibility

| Requirement | Description |
|-------------|-------------|
| NFR-2.1 | Dots have ARIA labels with phase names |
| NFR-2.2 | Keyboard navigable (Tab + Enter) |
| NFR-2.3 | Color not sole indicator (dot fill + tooltip) |
| NFR-2.4 | High contrast support via VS Code CSS vars |

### NFR-3: Responsiveness

| Requirement | Description |
|-------------|-------------|
| NFR-3.1 | Fits in 280px minimum width |
| NFR-3.2 | Timeline dots scale appropriately |
| NFR-3.3 | Phase name truncates with ellipsis if needed |

---

## 5. Out of Scope (MVP)

| Feature | Reason | Future Consideration |
|---------|--------|----------------------|
| Sub-phase timeline | Too cluttered | Phase 2 |
| Phase duration display | Requires timing data | Phase 2 |
| Multi-run comparison | Complex UI | Phase 3 |
| Phase status details | Click-through sufficient | Phase 2 |

---

# Part 2: Technical Specification

## 6. Architecture

### 6.1 Component Structure

```
src/webview/components/
  PhaseIndicator.svelte      # Main component
```

### 6.2 Visual Layout

**Default State:**
```
+--------------------------------------------------+
|                                                  |
|   ARCHITECTURE DEFINITION                        |  <-- Current phase (prominent)
|   Sub-phase: Component Design                    |  <-- Current sub-phase
|                                                  |
|   (phase status badge: "In Progress")            |
|                                                  |
|   (dot) (dot) (dot) (dot) (dot) (dot) ...        |  <-- Mini-timeline
|    0   0.5   1    2    3    4    5    6 ...       |  <-- Phase numbers (optional)
|                                                  |
+--------------------------------------------------+
```

**Hover State (Flyout Visible):**
```
                    +----------------------------------+
                    |  Phase List                      |
                    |  +----------------------------+  |
                    |  |  Workspace Initialization |  |
                    |  |  Intent Capture           |  |
                    |  |  Requirements Definition  |  |
                    |  |  System Specification     |  |
                    |  |  Architecture Definition  |  |  <-- Current highlighted
                    |  |  Technical Specification  |  |
                    |  |  Implementation Planning  |  |
                    |  |  ...                      |  |
                    |  +----------------------------+  |
                    +----------------------------------+
                              ^
                              | (flyout appears on hover)
+--------------------------------------------------+
|                                                  |
|   ARCHITECTURE DEFINITION                        |
|   Sub-phase: Component Design                    |
|                                                  |
|   (dot) (dot) (dot) (dot) (dot) (dot) ...        |  <-- Hovering over timeline
|    0   0.5   1    2    3    4    5    6 ...       |
|   [=================hover area=================]  |
+--------------------------------------------------+
```

**Flyout Item States:**
```
  [checkmark] Workspace Initialization     <-- Completed
  [checkmark] Intent Capture               <-- Completed
  [checkmark] Requirements Definition      <-- Completed
  [checkmark] System Specification         <-- Completed
  [circle]   Architecture Definition       <-- Current (highlighted)
  [empty]    Technical Specification       <-- Future
  [empty]    Implementation Planning       <-- Future
  ...
```

**Flyout Behavior:**
- Appears when mouse enters timeline area
- Disappears when mouse leaves timeline + flyout area (with small delay to allow moving between)
- Positioned above timeline if space allows, otherwise below
- Max height with scroll if needed (rarely, as only 12 items)

### 6.3 Position in App

The PhaseIndicator sits at the **top of the Governed Stream panel**, above the scrollable content area:

```
+--------------------------------------------------+
|  [PhaseIndicator - sticky header]                |
+--------------------------------------------------+
|                                                  |
|  [Scrollable card content]                       |
|  ...                                             |
|                                                  |
+--------------------------------------------------+
|  [IntentComposer - pinned to bottom]             |
+--------------------------------------------------+
```

---

## 7. Data Model

### 7.1 Phase Indicator State

```typescript
interface PhaseIndicatorState {
  // Current workflow
  workflowRunId: string | null;
  status: 'no_run' | 'active' | 'paused' | 'completed' | 'failed';
  
  // Current position
  currentPhaseId: PhaseId | null;
  currentPhaseName: string | null;
  currentSubPhaseId: string | null;
  currentSubPhaseName: string | null;
  
  // Completed phases (for timeline)
  completedPhases: PhaseId[];
}
```

### 7.2 Phase Data

```typescript
// From src/lib/types/records.ts
type PhaseId = '0' | '0.5' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

const PHASE_NAMES: Record<PhaseId, string> = {
  '0': 'Workspace Initialization',
  '0.5': 'Cross-Run Impact Analysis',
  '1': 'Intent Capture and Convergence',
  '2': 'Requirements Definition',
  '3': 'System Specification',
  '4': 'Architecture Definition',
  '5': 'Technical Specification',
  '6': 'Implementation Planning',
  '7': 'Test Planning',
  '8': 'Evaluation Planning',
  '9': 'Execution',
  '10': 'Commit and Deployment Initiation',
};

const PHASE_ORDER: PhaseId[] = [
  '0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];
```

---

## 8. API Design

### 8.1 Webview Messages (from Extension)

#### `phaseUpdate`

```typescript
interface PhaseUpdateMessage {
  type: 'phaseUpdate';
  payload: {
    workflowRunId: string;
    currentPhaseId: PhaseId;
    currentSubPhaseId: string | null;
    completedPhases: PhaseId[];
    status: 'active' | 'paused' | 'completed' | 'failed';
  };
}
```

### 8.2 Webview Messages (to Extension)

#### `scrollToPhase`

```typescript
interface ScrollToPhaseMessage {
  type: 'scrollToPhase';
  phaseId: PhaseId;
}
```

---

## 9. Visual Design

### 9.1 Dot Styling

```css
/* Timeline container */
.phase-timeline {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

/* Individual dot */
.phase-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--vscode-descriptionForeground);
  background: transparent;
  cursor: pointer;
}

/* Completed phase */
.phase-dot.completed {
  background: var(--vscode-terminal-ansiGreen);
  border-color: var(--vscode-terminal-ansiGreen);
}

/* Current phase */
.phase-dot.current {
  background: var(--vscode-button-background);
  border-color: var(--vscode-button-background);
  box-shadow: 0 0 4px var(--vscode-button-background);
}

/* Future phase */
.phase-dot.future {
  background: transparent;
  opacity: 0.5;
}

/* Conditional phase (0.5) */
.phase-dot.conditional {
  opacity: 0.3;
}
```

### 9.2 Flyout Styling

```css
/* Flyout container */
.phase-flyout {
  position: absolute;
  z-index: 100;
  min-width: 220px;
  max-width: 280px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 8px 0;
}

/* Flyout header */
.phase-flyout-header {
  padding: 4px 12px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border);
  margin-bottom: 4px;
}

/* Flyout item */
.phase-flyout-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.phase-flyout-item:hover {
  background: var(--vscode-list-hoverBackground);
}

/* Flyout item status icon */
.phase-flyout-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-flyout-icon.completed {
  color: var(--vscode-terminal-ansiGreen);
}

.phase-flyout-icon.current {
  color: var(--vscode-button-background);
}

.phase-flyout-icon.future {
  color: var(--vscode-descriptionForeground);
  opacity: 0.5;
}

/* Flyout item name */
.phase-flyout-name {
  font-size: 0.85em;
  flex: 1;
}

.phase-flyout-item.current .phase-flyout-name {
  font-weight: 600;
}

/* Flyout item phase number */
.phase-flyout-number {
  font-size: 0.75em;
  color: var(--vscode-descriptionForeground);
}
```

### 9.3 Current Phase Display

```css
.current-phase {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--vscode-foreground);
  margin-bottom: 2px;
}

.current-subphase {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}
```

---

## 10. Interactions

### 10.1 Hover Tooltip

```typescript
// On mouseenter of phase dot
function showTooltip(dot: HTMLElement, phaseId: PhaseId): void {
  const name = PHASE_NAMES[phaseId];
  const status = getPhaseStatus(phaseId); // "Completed", "Current", "Not started"
  
  tooltip.textContent = `${name} (${status})`;
  tooltip.style.position = 'absolute';
  tooltip.style.left = `${dot.offsetLeft}px`;
  tooltip.style.top = `${dot.offsetTop - 30}px`;
}
```

### 10.2 Click Navigation

```typescript
function handleDotClick(phaseId: PhaseId): void {
  if (isCompleted(phaseId)) {
    // Scroll to phase milestone card
    const card = document.querySelector(`[data-phase-id="${phaseId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
```

---

## 11. Implementation Steps

### Step 1: Create PhaseIndicator Component

- `src/webview/components/PhaseIndicator.svelte`
- Svelte component with props for state
- Renders current phase + timeline

### Step 2: Add to App.svelte

- Import PhaseIndicator
- Position at top of governed-stream container
- Make sticky so it stays visible while scrolling

### Step 3: Wire State Updates

- Handle `phaseUpdate` messages from extension
- Update component state reactively
- Track completed phases from records store

### Step 4: Implement Flyout

- Create flyout container element
- Show on hover over timeline area
- Position above or below timeline (based on available space)
- Dismiss when mouse leaves timeline + flyout area
- Render all phases with status icons

### Step 5: Implement Navigation

- Click handler on completed dots and flyout items
- Scroll to phase milestone card
- Optional: emit `scrollToPhase` message to extension

### Step 6: Accessibility

- Add ARIA labels to dots
- Implement keyboard navigation (Tab + Enter)
- Ensure color contrast meets WCAG

---

## 12. Testing Checklist

- [ ] Current phase name displays correctly
- [ ] Current sub-phase displays correctly
- [ ] Timeline shows all 12 phases
- [ ] Completed phases show as filled dots
- [ ] Current phase highlighted with accent
- [ ] Future phases show as hollow dots
- [ ] Phase 0.5 shows as dimmed/conditional
- [ ] Hover on timeline shows flyout
- [ ] Flyout shows all phase names with status icons
- [ ] Flyout dismisses when mouse leaves area
- [ ] Click on completed phase (dot or flyout) scrolls to milestone
- [ ] Click on future phase does nothing
- [ ] Keyboard navigation works (Tab + Enter)
- [ ] No active run shows appropriate state
- [ ] Fits in 280px width without scroll

---

## 13. Design Decision Rationale

### Why Option D + E Hybrid (Stacked Current + Mini-Timeline + Flyout)?

**Problem:** v1 breadcrumb with all phase names required horizontal scrolling in the narrow sidebar (~300px). With 12 phases having long names (15-30 characters each), the breadcrumb became unusable.

**Rejected Alternatives:**

| Option | Why Rejected |
|--------|--------------|
| **A: Abbreviated Labels** | Loses meaning, users must learn abbreviations |
| **B: Windowed View** | Loses overall progress context |
| **C: Dropdown Only** | Hidden until clicked, no at-a-glance progress |
| **E: Vertical List (alone)** | Takes too much vertical space, always visible |

**Chosen Approach: Hybrid D + E**

Combines the best of both options:
1. **Prominent current phase** - Full name visible, what user cares about most
2. **Mini-timeline dots** - Compact progress visualization (fits any width)
3. **Flyout on hover (Option E)** - Full phase list with names appears on hover
4. **Navigation from flyout** - Click any completed phase to jump to it

**Why This Works:**

| Aspect | Solution |
|--------|----------|
| **Default state** | Compact, shows current + progress dots |
| **On hover** | Full phase list with names (Option E behavior) |
| **Navigation** | Click from dots OR flyout items |
| **Space efficiency** | No permanent vertical scroll list |

This gives users the compact view they need most of the time, with the detailed list available on demand without extra clicks.

---

## 14. References

- `janumicode_spec_v2.3.md` §17.5 - Original "floating sidebar" spec
- `janumicode_v2 rich input area feature.md` - Phase indicator requirement
- `src/lib/types/records.ts` - PhaseId and PHASE_NAMES definitions
