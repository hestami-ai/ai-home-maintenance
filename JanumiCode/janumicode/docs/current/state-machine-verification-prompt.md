# JanumiCode Workflow: Intended State Machine & Storyboards

## Context

This document defines what the **entire JanumiCode workflow** should be doing — the intended state machine, transitions, and user-facing storyboards for ALL phases. A verification agent will use this as the specification to compare against the actual source code.

The INTAKE phase is JanumiCode's requirements-gathering phase. It classifies a user request, analyzes the codebase/documents, presents product discovery artifacts for review (if applicable), proposes a technical approach, clarifies open questions, synthesizes a final plan, and obtains human approval before transitioning to the ARCHITECTURE phase.

---

## 1. Sub-States

**Enum:** `IntakeSubState` in `src/lib/types/intake.ts`

### Inverted Flow (STATE_DRIVEN & DOMAIN_GUIDED modes)
| Sub-State | Purpose | LLM Call? | Awaits Input? |
|-----------|---------|-----------|---------------|
| `ANALYZING` | Expert silently reads all docs/codebase, produces analysis + initial plan | Yes (one big call) | No — user waits |
| `PRODUCT_REVIEW` | User reviews product discovery artifacts via MMP. UI gate only. | No | Yes — MMP submit |
| `PROPOSING` | Technical approach displayed; user reviews and responds | No (display only) | Yes — free text |
| `CLARIFYING` | Expert asks business gaps & tradeoffs (max 2 rounds) | Yes | Yes — free text |
| `SYNTHESIZING` | Expert synthesizes conversation into final plan | Yes | No — user waits |
| `AWAITING_APPROVAL` | Final plan displayed; user approves or continues discussing | No | Yes — gate buttons |

### Legacy Flow (HYBRID_CHECKPOINTS mode)
| Sub-State | Purpose | LLM Call? | Awaits Input? |
|-----------|---------|-----------|---------------|
| `GATHERING` | Expert interviews user domain-by-domain (12 domains) | Yes | Yes |
| `DISCUSSING` | Free-form conversation between user and expert | Yes | Yes |
| `SYNTHESIZING` | (same as above) | Yes | No |
| `AWAITING_APPROVAL` | (same as above) | No | Yes |

---

## 2. State Machine Transitions

### 2A. Inverted Flow (product_or_feature request)

```
User submits prompt
    │
    ▼
[DISCUSSING turnCount=0]  ──classifier──▶  [ANALYZING]
    │                                           │
    │                                    executeIntakeAnalysis()
    │                                           │
    │                              ┌────────────┴────────────┐
    │                              │                         │
    │                     productMMP exists?           no productMMP
    │                              │                         │
    │                              ▼                         ▼
    │                     [PRODUCT_REVIEW]            [PROPOSING]
    │                              │                         │
    │                     user submits MMP                   │
    │                              │                         │
    │                              ▼                         │
    │                        [PROPOSING] ◄───────────────────┘
    │                              │
    │                     user submits text
    │                              │
    │                              ▼
    │                       [CLARIFYING] ◄──┐
    │                              │        │ round < 2 AND
    │                              │        │ no [CLARIFICATION_COMPLETE]
    │                     ┌────────┴────────┘
    │                     │
    │            convergence met?
    │            (round >= 2 OR tag)
    │                     │
    │                     ▼
    │              [SYNTHESIZING]
    │                     │
    │              plan finalized
    │                     │
    │                     ▼
    │            [AWAITING_APPROVAL]
    │                     │
    │              ┌──────┴──────┐
    │              │             │
    │          "Approve"   "Continue"
    │              │             │
    │              ▼             ▼
    │        → ARCHITECTURE   [DISCUSSING]
    │                           (loops back)
```

### 2B. Inverted Flow (technical_task request)

Same as above but skips PRODUCT_REVIEW:
```
ANALYZING → PROPOSING → CLARIFYING → SYNTHESIZING → AWAITING_APPROVAL
```

### 2C. Legacy Flow (HYBRID_CHECKPOINTS)

```
User submits prompt
    │
    ▼
[DISCUSSING turnCount=0]  ──classifier──▶  [DISCUSSING] (stays)
    │                                           │
    │                                    conversation turns
    │                                    (self-loop)
    │                                           │
    │                                  user clicks "Finalize"
    │                                           │
    │                                           ▼
    │                                    [SYNTHESIZING]
    │                                           │
    │                                           ▼
    │                                  [AWAITING_APPROVAL]
    │                                           │
    │                                    (same as above)
```

---

## 3. Transition Details

### T1: Entry → Classifier → Mode Selection
- **Trigger:** First human message (turnCount=0, subState=DISCUSSING)
- **Where:** `orchestrator.ts` — `executeIntakePhase()` switch on DISCUSSING, checks `turnCount === 0`
- **Action:** Calls `initializeAdaptiveIntake()` which:
  1. Runs `classifyIntakeInput()` → returns mode recommendation
  2. Initializes domain coverage map
  3. Sets `subState` to ANALYZING (if STATE_DRIVEN/DOMAIN_GUIDED) or stays DISCUSSING (HYBRID_CHECKPOINTS)
- **Verification:** After classifier, `conv.intakeMode` is set and `intake:classifier_result` + `intake:mode_selected` events emitted

### T2: ANALYZING → PRODUCT_REVIEW or PROPOSING
- **Trigger:** `executeIntakeAnalysis()` completes
- **Where:** `intakePhase.ts` — `executeIntakeAnalysis()`
- **Action:**
  1. Invoke `invokeAnalyzingTechnicalExpert()` — silent analysis, returns `IntakeAnalysisTurnResponse`
  2. Seed domain coverage from analysis
  3. Call `extractProductDiscoveryMMP(analysis.initialPlan)`
  4. Write `intake_analysis` event (includes `productDiscoveryMMP` in detail)
  5. **If productMMP defined** → `subState = PRODUCT_REVIEW`
  6. **If productMMP undefined** → `subState = PROPOSING`
- **Verification:** DB `intake_conversations.sub_state` matches; V6 migration applied so CHECK constraint accepts PRODUCT_REVIEW

### T3: PRODUCT_REVIEW → PROPOSING
- **Trigger:** User submits MMP decisions (via webview Submit Decisions button)
- **Where:** `orchestrator.ts` — switch case `PRODUCT_REVIEW`
- **Action:** Update `subState = PROPOSING`, return `awaitingInput: true`
- **No LLM call** — this is a UI gate
- **Verification:** Technical approach card becomes visible (was filtered during PRODUCT_REVIEW)

### T4: PROPOSING → CLARIFYING
- **Trigger:** User submits free-text response to proposal
- **Where:** `orchestrator.ts` — switch case `PROPOSING`
- **Action:** Set `subState = CLARIFYING`, `clarificationRound = 1`, call `executeIntakeClarificationTurn()`
- **Verification:** Expert responds with focused business-gap questions, not implementation details

### T5: CLARIFYING → CLARIFYING (self-loop) or SYNTHESIZING
- **Trigger:** `executeIntakeClarificationTurn()` completes
- **Where:** `intakePhase.ts` — convergence check
- **Condition:** `[CLARIFICATION_COMPLETE]` tag in response OR `currentRound >= MAX_CLARIFICATION_ROUNDS (2)`
- **Action:**
  - **Not converged:** `subState = CLARIFYING`, `clarificationRound++`, `awaitingInput: true`
  - **Converged:** `subState = SYNTHESIZING`, `awaitingInput: false`
- **Verification:** Max 2 clarification rounds, then auto-synthesis

### T6: SYNTHESIZING → AWAITING_APPROVAL
- **Trigger:** `executeIntakePlanFinalization()` called
- **Where:** `intakePhase.ts` — `executeIntakePlanFinalization()`
- **Action:** Synthesize final plan, enrich with coverage gaps, set `subState = AWAITING_APPROVAL`, store `finalizedPlan`
- **Verification:** Plan preview card appears with approval gate

### T7: AWAITING_APPROVAL → ARCHITECTURE (or back to DISCUSSING)
- **Trigger:** User clicks "Approve Plan" or "Continue Discussing"
- **Where:** `orchestrator.ts` — switch case `AWAITING_APPROVAL`
- **Action (Approve):**
  1. Store approved plan in workflow metadata
  2. Write `intake_approval` event
  3. Run narrative curation (INTENT snapshot)
  4. Create MAKER IntentRecord + AcceptanceContract
  5. Return `nextPhase: ARCHITECTURE`
- **Action (Continue):** Return to DISCUSSING for more turns

---

## 4. Storyboards — What The User Sees

### Storyboard A: Product/Feature Request (Inverted Flow)

**Screen 1: Prompt Entry**
- Empty governed stream with composer
- User types: "Review specs/product-description.md and prepare for implementation"

**Screen 2: Classification**
- `HUMAN` message bubble with user's prompt
- `Intake Classifier` card (collapsed, API badge, green checkmark)
- `INTAKE Mode: Document-Based` resolved badge
- `HUMAN / DECISION` event echo

**Screen 3: Analysis In Progress**
- `Technical Expert — INTAKE Analysis` command block (CLI badge)
  - Shows stdin content (system prompt excerpt)
  - Shows CLI activity (tool calls, file reads)
- Status bar: "Analyzing documents and codebase..."
- Composer disabled

**Screen 4: Product Discovery (PRODUCT_REVIEW sub-state)**
- `Technical Analysis` card:
  - Analysis summary (2-5 paragraphs)
  - Collapsible codebase findings
- `Product Discovery` card (green left border):
  - **Vision** section with text + inline edit textarea
  - **Product Description** section with text + inline edit textarea
  - **Personas** — each persona with name, description, goals, pain points + inline edit textarea per persona
  - **User Journeys** — each journey with title, priority badge, scenario, steps (if valid), acceptance criteria + inline edit textarea per journey
  - **Phasing Strategy** — phases numbered sequentially (Phase 1, Phase 2...) + inline edit textarea per phase
  - **Success Metrics** — bulleted list + inline edit textarea per metric
  - **MMP Section** (Mirror: personas, journeys, UX, vision as accept/reject/edit items; Menu: phasing scope decisions)
  - **Submit Decisions** button
- **Technical approach card is NOT visible** (filtered by PRODUCT_REVIEW state)
- Status bar: "Review product artifacts above and submit your decisions to continue."
- Composer enabled (user can also type free text)

**Screen 5: Technical Proposal (PROPOSING sub-state)**
- Previous cards still visible
- MMP shows "Decisions Submitted" (frozen)
- `Proposed Technical Approach` card (blue left border) NOW appears:
  - Plan title
  - Summary
  - Proposed approach
  - Domain coverage bar (X adequate, Y partial, Z uncovered — N%)
- Status bar: submit bar + "Finalize Plan" button
- Composer enabled

**Screen 6: Clarification (CLARIFYING sub-state)**
- Expert's clarification response as `intake_turn` card
  - Focused on business gaps and tradeoffs only
  - May include MMP cards for structured decisions
- User responds via composer
- Up to 2 rounds, then auto-synthesis

**Screen 7: Synthesis (SYNTHESIZING sub-state)**
- `intake_plan_preview` card with final synthesized plan
  - All sections: requirements, decisions, constraints, open questions, approach
  - Product artifacts (vision, personas, journeys, phasing, metrics, UX)
- Status: resolved marker

**Screen 8: Approval (AWAITING_APPROVAL sub-state)**
- `intake_approval_gate` card:
  - Plan summary (title, coverage %)
  - "Approve Plan" button
  - "Continue Discussing" button
- Composer disabled (gate decision required)

**Screen 9: Phase Transition**
- Approval gate shows resolved state
- Stream transitions to ARCHITECTURE phase

### Storyboard B: Technical Task (Inverted Flow, No Product Review)

Same as Storyboard A except:
- **Screen 4 is skipped entirely** — no product discovery card, no MMP
- After ANALYZING, goes directly to Screen 5 (PROPOSING)
- `intake_proposal` card appears immediately with technical approach
- `requestCategory = 'technical_task'`

### Storyboard C: Conversational (Legacy HYBRID_CHECKPOINTS)

- Classifier selects HYBRID_CHECKPOINTS mode
- Expert and user have free-form conversation (DISCUSSING)
- Periodic coverage checkpoints appear
- User clicks "Finalize Plan" when ready
- Synthesis + approval flow (same as Screens 7-9)

---

## 5. Stream Item Rendering Order

Items appear in this visual order (sort priority):

| Priority | Stream Item | Card |
|----------|-------------|------|
| 1.0 | `dialogue_start` | Phase entry marker |
| 1.5 | `intake_analysis` | Technical Analysis card |
| 1.6 | `intake_product_discovery` | Product Discovery card (green border) |
| 1.8 | `intake_proposal` | Proposed Technical Approach card (blue border) |
| 2.0 | `intake_turn` | Expert conversation turn |
| 3.0 | `intake_mode_selector` | Mode selection card |
| 5.0 | `intake_domain_transition` | Domain transition marker |
| 6.0 | `intake_gathering_complete` | "All Domains Gathered" banner |
| 7.0 | `intake_checkpoint` | Coverage checkpoint |
| 8.0 | `intake_approval_gate` | Approve/Continue gate |

---

## 6. Visibility Rules

| Rule | Condition | Effect |
|------|-----------|--------|
| Hide proposal during PRODUCT_REVIEW | `conv.subState === PRODUCT_REVIEW` | `intake_proposal` items spliced from stream |
| Composer enabled | `subState ∈ {DISCUSSING, CLARIFYING, PROPOSING, GATHERING, PRODUCT_REVIEW}` | Input area active |
| Composer disabled | `subState ∈ {ANALYZING, SYNTHESIZING, AWAITING_APPROVAL}` | Input area inactive |
| isLatest on last turn | `phase === INTAKE && awaitingInput` | Last `intake_turn` gets interactive MMP |
| Finalize button | `subState ∈ {PROPOSING, CLARIFYING, DISCUSSING}` | "Finalize Plan" shown |

---

## 7. Data Integrity Invariants

| Invariant | Description |
|-----------|-------------|
| V6 migration | DB CHECK constraint includes PRODUCT_REVIEW (table recreation migration) |
| Plan arrays nullable | `requirements`, `decisions`, `constraints`, `openQuestions`, `technicalNotes` may be `undefined` from ANALYZING; all consumers must guard with `?? []` |
| Journey steps nullable | `steps`, `acceptanceCriteria`, `goals`, `painPoints` may be undefined or contain stub objects; guard in rendering AND prompt building |
| Phasing renumbered | Phases always displayed as Phase 1, Phase 2, etc. regardless of LLM-provided `phase` field |
| Product edits captured | Inline textareas (`data-pd-edit-field`) collected during MMP submit, formatted as `PRODUCT_EDIT (field): "value"` |

---

---

# PART II: DOWNSTREAM PHASES

## 8. Global Phase Lifecycle

**11 Phases** in the complete workflow:

```
INTAKE → ARCHITECTURE → PROPOSE → ASSUMPTION_SURFACING → VERIFY
→ HISTORICAL_CHECK → REVIEW → EXECUTE → VALIDATE → COMMIT → (loop)
                                                       ↗
                              REPLAN ──────────→ PROPOSE
```

**Valid transitions** (`stateMachine.ts`):

| From | To |
|------|-----|
| INTAKE | INTAKE (self-loop), ARCHITECTURE |
| ARCHITECTURE | ARCHITECTURE (self-loop), PROPOSE, REPLAN |
| PROPOSE | ASSUMPTION_SURFACING, REPLAN |
| ASSUMPTION_SURFACING | VERIFY, REPLAN |
| VERIFY | HISTORICAL_CHECK, REVIEW, REPLAN |
| HISTORICAL_CHECK | REVIEW, REPLAN |
| REVIEW | EXECUTE, REPLAN |
| EXECUTE | VALIDATE, REPLAN |
| VALIDATE | COMMIT, REPLAN |
| COMMIT | INTAKE (new cycle) |
| REPLAN | PROPOSE |

**Central dispatcher:** `advanceWorkflow()` in `orchestrator.ts` — single switch on `currentPhase`, calls each phase's execution function. Before executing, checks for open gates (blocks if any exist).

---

## 9. ARCHITECTURE Phase

**Files:** `src/lib/workflow/architecturePhase.ts`, `src/lib/types/architecture.ts`

### Entry
- Triggered after INTAKE plan approval (T7 above)
- Input: approved `IntakePlanDocument` from workflow metadata

### Internal Sub-States (6-step pipeline)

| Step | Sub-State | LLM Call | Produces |
|------|-----------|----------|----------|
| 1 | DECOMPOSING | Architecture Expert | `CapabilityNode[]` + `WorkflowNode[]` (Use Case Model) |
| 2 | MODELING | Architecture Expert | `DataModelSpec[]` (Domain Model) |
| 3 | DESIGNING | Architecture Expert | `ComponentSpec[]` + `InterfaceSpec[]` (System Architecture + ICD) |
| 4 | SEQUENCING | Architecture Expert | `ImplementationStep[]` (Implementation Plan) |
| 5 | VALIDATING | Historian + structural checks | Goal alignment score, traceability, consistency |
| 6 | PRESENTING | None (human gate) | Architecture review gate with MMP |

### Key Behaviors
- **Recursive decomposition** in DESIGNING: agent re-analyzes components for sub-boundaries (`max_depth=3, max_breadth=25`)
- **Validation repair loop**: On validation failure, up to 2 repair attempts → loop back to DESIGNING
- **Human gate at PRESENTING**: MMP cards for architecture review (Mirror: assumptions, Pre-Mortem: risks)

### User Actions at PRESENTING
- **Approve** → `ARCHITECTURE_APPROVED` → advance to PROPOSE
- **Request Revision** → `ARCHITECTURE_REVISION` → loop back to DESIGNING with feedback
- **Skip Architecture** → `ARCHITECTURE_SKIPPED` → jump to PROPOSE

### Database
- `architecture_documents` table (doc_id, dialogue_id, version, status: DRAFT/VALIDATED/APPROVED)
- Stores: capabilities, workflow_graph, components, data_models, interfaces, implementation_sequence, validation_findings

### Storyboard
- Command blocks per sub-state: "Decomposing capabilities...", "Modeling domain...", "Designing components...", etc.
- Architecture review gate card with full document preview + MMP
- Three action buttons: Approve, Request Revision, Skip

---

## 10. PROPOSE Phase

**File:** `orchestrator.ts` (executeProposePhase)

### Entry
- After ARCHITECTURE approved/skipped, or after REPLAN

### Steps
1. **Invoke Executor**: Generate concrete implementation proposal from goal + approved plan
   - Output: `ExecutorResponse { proposal, assumptions[], artifacts[], constraint_adherence_notes[] }`
2. **Evaluate Response**: LLM evaluates quality
   - `PROCEED` → continue normally
   - `ESCALATE_CONFUSED` → gate (executor incoherent)
   - `ESCALATE_QUESTIONS` → gate (executor has clarification questions)
   - `ESCALATE_OPTIONS` → multi-branch analysis mode
3. **MAKER Task Graph Decomposition** (if MAKER path): Decompose goal into task units

### Exit
- Normal: → ASSUMPTION_SURFACING
- Escalation: Gate triggered, workflow pauses
- Multi-branch: Stores branches in metadata, → ASSUMPTION_SURFACING (iterates per branch)

### Storyboard
- Command block: "Executor — Generating Proposal"
- Proposal text, assumptions list, artifacts
- Gate card if escalation (with reason + user action buttons)

---

## 11. ASSUMPTION_SURFACING Phase

**File:** `orchestrator.ts` (executeAssumptionSurfacingPhase)

### Entry
- After PROPOSE completes (no escalation)

### Steps
1. Retrieve cached executor response from PROPOSE
2. Write assumption event (role: EXECUTOR, speech_act: ASSUMPTION)
3. **Convert assumptions → Claims**: Each assumption becomes a `Claim` record (statement, criticality, status: OPEN)
4. **MAKER claim units**: Extract observable conditions from task units for ground-truth verification

### Exit
- → VERIFY (always, unless replan)

### Storyboard
- Event card: "Surfaced X assumption(s)"
- Each assumption listed with criticality level

---

## 12. VERIFY Phase

**File:** `orchestrator.ts` (executeVerifyPhase)

### Entry
- After ASSUMPTION_SURFACING

### Steps
1. Query all OPEN claims for this dialogue
2. **Per-claim verification** (expensive LLM calls):
   - Verifier role checks each claim against workspace + codebase + constraints
   - Output: `Verdict { verdict: VERIFIED|CONDITIONAL|DISPROVED|UNKNOWN, rationale, evidence_ref, novel_dependency }`
3. Update claim status based on verdict
4. If ALL verifications failed → `VERIFICATION_FAILURE` gate

### Multi-Branch Loop
- If analyzing multiple proposal branches: stores findings per branch, loops back to ASSUMPTION_SURFACING for next branch

### Exit
- Normal: → HISTORICAL_CHECK
- All failed: Gate triggered
- Multi-branch: → ASSUMPTION_SURFACING (next branch)

### Storyboard
- Command block: "Verifier — Checking N claims"
- Per-claim checkmarks with verdicts (color-coded)
- Summary: "X verified, Y conditional, Z disproved, W unknown"

---

## 13. HISTORICAL_CHECK Phase

**File:** `orchestrator.ts` (executeHistoricalCheckPhase)

### Entry
- After VERIFY completes

### Steps
1. Query all claims + verdicts
2. **Historian adjudication**: LLM adjudicates claims against historical context
   - Finds contradictions, precedents, patterns, invariants
   - Output: `claim_adjudications[]`, `general_findings[]`, `summary`
3. **MAKER Historical Packet**: Classify findings into `relevant_invariants`, `prior_failure_motifs`, `precedent_patterns`

### Exit
- Normal: → REVIEW
- Multi-branch: → ASSUMPTION_SURFACING (next branch iteration)

### Storyboard
- Command block: "Historian — Checking Precedents"
- Adjudication summary per claim
- Historical findings and patterns

---

## 14. REVIEW Phase

**File:** `orchestrator.ts` (executeReviewPhase)

### Entry
- After HISTORICAL_CHECK

### What Happens
- **Pure human gate** — workflow always pauses here
- Creates `createReviewGate()` with accumulated analysis
- Presents MMP cards:
  - **Mirror**: Assumptions to accept/reject/edit
  - **Menu**: Branch selection (if multi-branch)
  - **Pre-Mortem**: Historical risks to acknowledge/dismiss

### User Actions
- **Approve** → resolve gate → EXECUTE
- **Replan** → REPLAN phase (feedback appended to goal)
- **Override** → force-accept risky assumptions

### Storyboard
- Review gate card with full proposal summary
- MMP interactive cards (Mirror/Menu/Pre-Mortem)
- Two action buttons: "Proceed to Execute" / "Replan"

---

## 15. REPLAN Phase

**File:** `orchestrator.ts` (pass-through)

### Entry
- User selected REPLAN from any review gate

### What Happens
- **Pass-through** — no LLM call
- Appends `replanRationale` (human feedback) to the goal
- Immediately transitions to PROPOSE

### Exit
- → PROPOSE (always)

---

## 16. EXECUTE Phase

**File:** `orchestrator.ts` (executeExecutePhase)

### Entry
- After REVIEW gate approved

### Two Execution Paths

**Path A: Legacy Monolithic**
1. Invoke Executor CLI once with full proposal
2. Stream real-time CLI output to governed stream
3. Exit code 0 = success, non-zero = failure

**Path B: MAKER Per-Unit**
1. Load task graph + toolchains + acceptance contract
2. Execute ready task units in dependency order:
   - Route each unit to best provider
   - Invoke Executor tailored to unit
3. Per-unit validation after each:
   - Run against contract + observables
   - **Pass** → mark COMPLETED, unlock dependents
   - **Fail** → bounded repair attempt
4. Bounded repair:
   - Classify failure (build_error, test_failure, type_error)
   - If safe + budget available: auto-repair + re-validate
   - If unsafe or budget exhausted: `REPAIR_ESCALATION` gate
5. Graph completion check: all units done → proceed

### Exit
- Success: → VALIDATE
- Failure (monolithic): Stay, `awaitingInput: true` (retry)
- Gate (MAKER): `REPAIR_ESCALATION`, workflow pauses

### Storyboard
- Command blocks per unit: "Executor — Unit: {label}"
- Real-time CLI output (monolithic) or structured unit results (MAKER)
- Validation results per unit with pass/fail indicators
- Repair attempt cards if applicable

---

## 17. VALIDATE Phase

**File:** `orchestrator.ts` (executeValidatePhase)

### Entry
- After EXECUTE succeeds

### Steps
1. Check execution result from metadata
2. If failed: create gate, pause
3. **MAKER contract validation** (if acceptance contract exists):
   - Validate entire project against contract success conditions
   - Run full validation pipeline (type-check, tests, lint)
   - Fail → `ACCEPTANCE_CONTRACT_FAILURE` gate

### Exit
- Success: → COMMIT
- Gate: workflow pauses

---

## 18. COMMIT Phase

**File:** `orchestrator.ts` (executeCommitPhase)

### Entry
- After VALIDATE succeeds

### Steps
1. Write commit event (type='commit', speech_act=DECISION)
2. Record MAKER outcome snapshot (providers used, success, failure modes, invariants discovered, units completed, wall-clock time)

### Exit
- → INTAKE (loop back for next task) or workflow ends

---

## 19. Gate System

**File:** `src/lib/workflow/gates.ts`

### Gate Trigger Conditions

| Condition | When Created |
|-----------|-------------|
| `CRITICAL_CLAIM_DISPROVED` | Critical assumption failed verification |
| `CRITICAL_CLAIM_UNKNOWN` | Critical assumption status unknown after verification |
| `CONFLICTING_PRECEDENTS` | Historical contradiction detected |
| `RISK_ACCEPTANCE_REQUIRED` | Human must acknowledge a known risk |
| `CONSTRAINT_VIOLATION` | Constraint manifestly violated |
| `MANUAL_GATE` | Generic gate (review, clarification) |
| `REPAIR_ESCALATION` | Auto-repair failed (MAKER) |
| `SCOPE_VIOLATION` | Task exceeds allowed scope (MAKER) |
| `ACCEPTANCE_CONTRACT_FAILURE` | Contract validation failed (MAKER) |
| `DECOMPOSITION_REJECTED` | Task graph quality failed (MAKER) |
| `VERIFICATION_FAILURE` | All verification invocations failed |
| `ARCHITECTURE_REVIEW` | Architecture presented for approval |

### Gate Blocking
- `advanceWorkflow()` checks for open gates before executing any phase
- Open gates block advancement with error: "Cannot advance: workflow has open gates"
- Gates must be resolved (approve, replan, override) before workflow continues

---

## 20. Transition Triggers

**File:** `src/lib/workflow/stateMachine.ts`

| Trigger | Context |
|---------|---------|
| `PHASE_COMPLETE` | Phase completed successfully |
| `GATE_TRIGGERED` | Gate opened, workflow suspended |
| `GATE_RESOLVED` | Gate resolved, workflow resumed |
| `MANUAL_OVERRIDE` | Human-initiated transition |
| `INTAKE_TURN_COMPLETE` | INTAKE conversation turn done |
| `INTAKE_PLAN_FINALIZED` | INTAKE synthesis done |
| `INTAKE_PLAN_APPROVED` | Human approved INTAKE plan |
| `INTENT_CAPTURED` | IntentRecord + Contract created |
| `DECOMPOSITION_COMPLETE` | Task graph decomposed |
| `UNIT_COMPLETE` / `UNIT_FAILED` | MAKER unit result |
| `REPAIR_ATTEMPT` / `REPAIR_ESCALATED` | MAKER repair |
| `GRAPH_COMPLETE` | All MAKER units done |
| `ARCHITECTURE_DECOMPOSED` / `DESIGNED` / `VALIDATED` / `APPROVED` / `REVISION` / `SKIPPED` | Architecture sub-state triggers |

---

# PART III: CRITICAL FILES & VERIFICATION

## 21. Critical Source Files

| File | Role |
|------|------|
| `src/lib/types/index.ts` | Phase enum (11 values), core types |
| `src/lib/types/intake.ts` | IntakeSubState enum, IntakePlanDocument, UserJourney, PhasingEntry |
| `src/lib/types/architecture.ts` | Architecture document structures, sub-states |
| `src/lib/workflow/stateMachine.ts` | Phase transition map, TransitionTrigger enum, guards |
| `src/lib/workflow/orchestrator.ts` | Central dispatcher + ALL phase implementations (PROPOSE through COMMIT) |
| `src/lib/workflow/intakePhase.ts` | INTAKE execution: analysis, clarification, synthesis, approval, MMP |
| `src/lib/workflow/architecturePhase.ts` | ARCHITECTURE 6-step pipeline |
| `src/lib/workflow/gates.ts` | Gate creation, resolution, trigger conditions |
| `src/lib/roles/technicalExpertIntake.ts` | INTAKE LLM prompts, response parsing, normalization |
| `src/lib/context/builders/intakeTechnicalExpert.ts` | Plan serialization for LLM context |
| `src/lib/database/schema.ts` | MIGRATIONS array (V1-V6), CHECK constraints |
| `src/lib/ui/governedStream/dataAggregator.ts` | StreamItem union, event→item mapping, filtering, sort |
| `src/lib/ui/governedStream/html/components.ts` | All card renderers, status bar |
| `src/lib/ui/governedStream/GovernedStreamPanel.ts` | Webview host — message handlers, workflow cycle |
| `src/webview/mmp.ts` | MMP interactions, submit handler, product edit collection |

---

## 22. Verification Checklist

A verification agent should confirm each against source code:

### Global State Machine
- [ ] Phase enum has all 11 values
- [ ] Transition map in `stateMachine.ts` matches Section 8 table
- [ ] `advanceWorkflow()` has switch cases for all 11 phases
- [ ] Open gates block phase advancement
- [ ] Phase completion triggers `transitionWorkflow()` + event emission

### INTAKE Phase
- [ ] All 8 IntakeSubState values exist in the enum
- [ ] Orchestrator has a switch case for every sub-state
- [ ] Every transition path from Section 3 is implemented
- [ ] PRODUCT_REVIEW is a pure UI gate (no LLM call)
- [ ] CLARIFYING self-loops max 2 rounds, then auto-SYNTHESIZING
- [ ] AWAITING_APPROVAL → ARCHITECTURE creates IntentRecord + AcceptanceContract
- [ ] V6 migration includes PRODUCT_REVIEW in CHECK constraint
- [ ] All plan array consumers guard with `?? []`
- [ ] Journey steps/acceptanceCriteria/goals/painPoints guarded in all renderers + prompt builders
- [ ] Phasing renumbered sequentially in display
- [ ] Product discovery card filtered during PRODUCT_REVIEW, visible after PROPOSING
- [ ] Inline edit textareas on all product artifact sub-groups

### ARCHITECTURE Phase
- [ ] 6 sub-states execute in pipeline order
- [ ] Recursive decomposition has stopping criteria (max_depth=3, max_breadth=25)
- [ ] Validation can loop back to DESIGNING (max 2 repair attempts)
- [ ] PRESENTING creates human gate with MMP
- [ ] Three user actions: Approve, Revise, Skip — each triggers correct transition

### PROPOSE → VERIFY Pipeline
- [ ] PROPOSE caches executor response in metadata for reuse
- [ ] Evaluation classifies as PROCEED/ESCALATE_CONFUSED/ESCALATE_QUESTIONS/ESCALATE_OPTIONS
- [ ] ASSUMPTION_SURFACING converts assumptions to Claim records
- [ ] VERIFY checks each claim individually with Verifier role
- [ ] All-failure creates VERIFICATION_FAILURE gate
- [ ] Multi-branch analysis iterates: ASSUMPTION_SURFACING → VERIFY → HISTORICAL_CHECK per branch

### REVIEW → COMMIT Pipeline
- [ ] REVIEW always creates a human gate (never auto-proceeds)
- [ ] REPLAN appends feedback to goal, transitions to PROPOSE
- [ ] EXECUTE supports both monolithic and MAKER per-unit paths
- [ ] MAKER bounded repair: classify → check safety → auto-repair or escalate
- [ ] VALIDATE checks execution result + optional contract validation
- [ ] COMMIT records outcome snapshot, transitions to INTAKE or ends
