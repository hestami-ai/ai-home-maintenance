# Getting Started with JanumiCode

**A step-by-step guide to your first governed AI workflow**

Welcome to JanumiCode! This guide will walk you through setting up the extension, configuring your first workflow, and understanding how governed AI-assisted development works.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Initial Configuration](#initial-configuration)
4. [Your First Dialogue](#your-first-dialogue)
5. [Understanding the UI](#understanding-the-ui)
6. [Working with Human Gates](#working-with-human-gates)
7. [Best Practices](#best-practices)
8. [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have:

### Required Software

- **VS Code**: Version 1.85.0 or higher
  - Download from: https://code.visualstudio.com/
- **Node.js**: Version 18.0.0 or higher
  - Download from: https://nodejs.org/
  - Verify installation: `node --version` in terminal

### API Keys

You'll need at least one LLM provider API key:

**Option A: Anthropic (Recommended)**
- Sign up at: https://console.anthropic.com/
- Create an API key from the dashboard
- Cost: Pay-as-you-go (approximately $0.50-$2 per dialogue)
- Models: Claude Sonnet 4, Claude Haiku 4

**Option B: OpenAI**
- Sign up at: https://platform.openai.com/
- Create an API key from API keys section
- Cost: Pay-as-you-go (varies by model)
- Models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo

### Workspace Setup

- Open or create a project folder in VS Code
- Ensure you have write permissions for the folder
- JanumiCode will create a `.janumicode/` directory for data storage

## Installation

### Method 1: From VSIX (Development)

1. Download the latest `.vsix` file from the releases page
2. Open VS Code
3. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open Extensions
4. Click the `...` menu at the top right
5. Select "Install from VSIX..."
6. Navigate to and select the downloaded `.vsix` file
7. Click "Reload" when prompted

### Method 2: From VS Code Marketplace (Coming Soon)

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
3. Search for "JanumiCode"
4. Click "Install"
5. Click "Reload" when prompted

### Verify Installation

1. Check the status bar at the bottom of VS Code
2. You should see: `$(gear) JanumiCode: Ready`
3. You should also see: `$(warning) 0 Gates`

If you see these, JanumiCode is successfully installed!

## Initial Configuration

Let's configure JanumiCode for your first use.

### Step 1: Open Configuration

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) to open Command Palette
2. Type: `JanumiCode: Configure`
3. Press Enter

This opens the JanumiCode configuration UI.

### Step 2: Enter API Keys

**For Anthropic (Recommended)**:

1. Find the "Anthropic API Key" field
2. Paste your API key (starts with `sk-ant-`)
3. Click "Test Connection" to verify
4. If successful, you'll see a green checkmark

**For OpenAI**:

1. Find the "OpenAI API Key" field
2. Paste your API key (starts with `sk-`)
3. Click "Test Connection" to verify
4. If successful, you'll see a green checkmark

### Step 3: Select Providers for Each Role

JanumiCode uses different LLM providers for different roles. Configure each:

**Executor** (generates code and proposals):
- Provider: `anthropic` or `openai`
- Model: `claude-sonnet-4-20250514` (recommended)
- Why: Needs strong reasoning and code generation

**Technical Expert** (provides evidence):
- Provider: `anthropic` or `openai`
- Model: `claude-haiku-4-20250731` (recommended for cost savings)
- Why: Simpler task, can use faster/cheaper model

**Verifier** (validates claims):
- Provider: `anthropic` or `openai`
- Model: `claude-sonnet-4-20250514` (recommended)
- Why: Needs precise reasoning to validate claims

**Historian-Interpreter** (checks history):
- Provider: `anthropic` or `openai`
- Model: `claude-sonnet-4-20250514` (recommended)
- Why: Needs strong context understanding

### Step 4: Set Token Budget

The token budget controls how much context JanumiCode sends to the LLM.

1. Find "Token Budget" setting
2. Default: `10000` (recommended for most tasks)
3. Increase for complex tasks with lots of context
4. Decrease to save costs on simple tasks

### Step 5: Save Configuration

1. Click "Save Configuration"
2. You should see a success message
3. Configuration is stored in VS Code settings

## Your First Dialogue

Let's create your first governed AI workflow!

### Choose a Simple Task

For your first dialogue, choose something straightforward like:

- "Create a function to validate email addresses"
- "Write a REST API endpoint to get user profile"
- "Create a React component for a login form"

**Avoid** complex multi-file projects for your first try.

### Start the Dialogue

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P` to open Command Palette
2. Type: `JanumiCode: Start New Dialogue`
3. Press Enter
4. Enter your goal in the input box
5. Press Enter again

Example goal: "Create a TypeScript function to validate email addresses with regex"

### Watch the Workflow Progress

The system will now move through several phases automatically:

#### 1. INTAKE Phase

- **What's happening**: System receives and parses your goal
- **Duration**: A few seconds
- **You'll see**: Status bar updates to "INTAKE"

#### 2. PROPOSE Phase

- **What's happening**: Executor generates an implementation plan
- **Duration**: 10-30 seconds (LLM call)
- **You'll see**:
  - Dialogue View shows Executor's proposal
  - Status bar updates to "PROPOSE"

#### 3. ASSUMPTION SURFACING Phase

- **What's happening**: System extracts claims from the proposal
- **Duration**: A few seconds
- **You'll see**:
  - Claims appear in Claims View
  - Each claim marked as OPEN

#### 4. VERIFY Phase

- **What's happening**: For each claim:
  1. Verifier normalizes the claim
  2. Technical Expert provides evidence
  3. Verifier emits a verdict
- **Duration**: 10-60 seconds per claim (multiple LLM calls)
- **You'll see**:
  - Claims View updates with verdicts
  - Status bar shows progress

**Possible Outcomes**:
- ✅ VERIFIED: All critical claims supported by evidence → Continue to EXECUTE
- ⚠️ CONDITIONAL: Claims supported with constraints → Continue to EXECUTE
- ❌ UNKNOWN/DISPROVED: Critical claim blocked → HUMAN GATE triggers

#### 5. HUMAN GATE (If Triggered)

If a critical claim is UNKNOWN or DISPROVED, you'll see:

- **Notification**: "Human decision required"
- **Status bar**: Shows "GATE OPEN"
- **Dialogue View**: Shows gate decision UI

See [Working with Human Gates](#working-with-human-gates) below for details.

#### 6. EXECUTE Phase (After Gate Resolution)

- **What's happening**: Executor generates code artifacts
- **Duration**: 10-30 seconds (LLM call)
- **You'll see**:
  - Code artifacts appear in Dialogue View
  - Artifacts stored in content-addressed blob storage

#### 7. VALIDATE Phase

- **What's happening**: Historian checks for contradictions
- **Duration**: 5-15 seconds (LLM call)
- **You'll see**: Status bar updates to "VALIDATE"

#### 8. COMMIT Phase

- **What's happening**: All decisions persisted to history
- **Duration**: A few seconds
- **You'll see**:
  - Status bar updates to "COMMIT"
  - Then "COMPLETED"
  - Complete audit trail available

### View the Results

1. **Dialogue View**: See full conversation with all role interactions
2. **Claims View**: See all claims and their verdicts
3. **Workflow View**: See complete phase progression
4. **Artifacts**: Code is stored and ready for export/use

## Understanding the UI

JanumiCode provides three main views in the VS Code sidebar:

### 1. Dialogue View

Shows the complete conversation between all roles.

**What you'll see**:
- User goal at the top
- Executor proposals and assumptions
- Technical Expert evidence
- Verifier verdicts
- Historian findings
- Human decisions (if any)

**Color coding**:
- 🟦 Blue: Human/User
- 🟩 Green: Executor
- 🟨 Yellow: Technical Expert
- 🟥 Red: Verifier
- 🟪 Purple: Historian-Interpreter

**Features**:
- Click on turns to expand/collapse details
- Code blocks have syntax highlighting
- Search and filter functionality

### 2. Claims View

Shows all claims being verified in the workflow.

**What you'll see**:
- Claim statement
- Criticality (CRITICAL / NON_CRITICAL)
- Status (OPEN / VERIFIED / CONDITIONAL / DISPROVED / UNKNOWN)
- Related evidence
- Verifier verdict details

**Status indicators**:
- ⚪ OPEN: Not yet verified
- ✅ VERIFIED: Supported by evidence
- ⚠️ CONDITIONAL: Supported with constraints
- ❌ DISPROVED: Contradicted by evidence
- ❓ UNKNOWN: Insufficient evidence

**Features**:
- Filter by status
- Sort by criticality
- Click to see evidence details

### 3. Workflow View

Shows the current state of the workflow.

**What you'll see**:
- Current phase (e.g., "VERIFY")
- Phase progress (e.g., "Verifying claim 2 of 5")
- Open gates (if any)
- Workflow history timeline
- Next expected steps

**Status indicators**:
- 🔵 Current phase
- ✅ Completed phases
- ⏸️ Blocked by gate
- ⏳ Pending phases

## Working with Human Gates

Human gates are a core feature of JanumiCode. They ensure you're in control of critical decisions.

### When Do Gates Appear?

Gates trigger when:

1. **Critical claim is UNKNOWN**: Not enough evidence to verify a critical assumption
2. **Critical claim is DISPROVED**: Evidence contradicts a critical assumption
3. **Conflicting precedents**: Current decision conflicts with past decisions
4. **Risk acceptance needed**: High-impact change requires approval

### Anatomy of a Gate

When a gate opens, you'll see:

```
┌─────────────────────────────────────────────┐
│ 🚧 HUMAN GATE: UNKNOWN CRITICAL CLAIM       │
├─────────────────────────────────────────────┤
│ Claim:                                      │
│ "Express.js version 4.x is installed"      │
│                                             │
│ Criticality: CRITICAL                       │
│                                             │
│ Verifier Verdict: UNKNOWN                   │
│ Rationale: No package.json found in        │
│ workspace to verify Express version        │
│                                             │
│ Evidence Reviewed:                          │
│ - Technical Expert searched for            │
│   package.json                             │
│ - Found no dependency declarations          │
│                                             │
│ Context:                                    │
│ This claim is critical because the         │
│ authentication middleware being proposed   │
│ uses Express 4.x-specific features.        │
└─────────────────────────────────────────────┘

Your Decision:
[ ] APPROVE    [ ] REJECT    [ ] OVERRIDE    [ ] REFRAME

Rationale (required): ______________________________
```

### Making a Gate Decision

Follow these steps:

#### Step 1: Review the Context

- **Read the claim**: What assumption is being questioned?
- **Check the verdict**: Why was it UNKNOWN or DISPROVED?
- **Review evidence**: What did Technical Expert find?
- **Understand impact**: Why is this critical?

#### Step 2: Evaluate Your Options

**APPROVE**:
- Use when: The claim is actually correct, but evidence wasn't found
- Example: "Yes, Express 4.x is installed, I just haven't run npm install yet"
- Effect: System proceeds as if claim is VERIFIED

**REJECT**:
- Use when: The claim is wrong and proposal should be abandoned
- Example: "This assumption is incorrect, we use Fastify not Express"
- Effect: Workflow stops, you can start a new dialogue with corrected goal

**OVERRIDE**:
- Use when: Claim is uncertain but you accept the risk
- Example: "I'm not sure about the version, but let's proceed and fix if needed"
- Effect: System continues despite UNKNOWN, decision recorded as waiver

**REFRAME**:
- Use when: The assumption needs clarification or adjustment
- Example: "Let's use Express 5.x instead" or "Add validation for Express version first"
- Effect: You provide new constraints, workflow adapts

#### Step 3: Provide Rationale

This is **required** for audit trail:

- **Be specific**: Explain your reasoning
- **Be honest**: Note uncertainties or assumptions
- **Be detailed**: Future you will thank you

**Good rationale examples**:
- "Express 4.18.2 is installed per package.json in parent directory"
- "We will use PostgreSQL as decided in project kickoff meeting 2024-01-15"
- "Accepting risk: will add validation in next sprint if issues arise"

**Poor rationale examples**:
- "I think it's fine"
- "Just do it"
- "Not important"

#### Step 4: Attach Evidence (Optional)

If you have supporting documents:
- Screenshots
- Meeting notes
- External documentation
- Email approvals

Click "Attach Files" and select documents.

#### Step 5: Confirm Decision

1. Review your choice one more time
2. Click "Confirm Decision"
3. System records decision with full context
4. Workflow resumes from gate point

### After Gate Resolution

The workflow continues with your decision incorporated:

- **APPROVE/OVERRIDE**: Execution proceeds with your acknowledgment
- **REJECT**: Dialogue ends, you can start fresh
- **REFRAME**: System adapts proposal based on your new constraints

All decisions are recorded in the audit trail and can be reviewed later.

## Best Practices

### For Effective Dialogues

1. **Start Small**: Begin with single-function or single-file tasks
2. **Be Specific**: Provide clear, detailed goals
3. **Review Proposals**: Read Executor's proposals before verification
4. **Trust the Process**: Let the verification system work
5. **Learn from Gates**: Gates are learning opportunities, not annoyances

### For API Cost Management

1. **Use Haiku for Technical Expert**: Saves 80% on evidence gathering
2. **Set Reasonable Token Budget**: 10,000 is good starting point
3. **Clear Old Dialogues**: Export and clear history periodically
4. **Choose Right Model**: Not every task needs Claude Opus

### For Audit Trail Quality

1. **Provide Detailed Rationales**: Your future self will thank you
2. **Attach Evidence**: Screenshots and docs add context
3. **Export Regularly**: Create backups of critical decisions
4. **Review Past Decisions**: Learn from historical patterns

### For Workflow Efficiency

1. **Monitor Claims View**: Catch issues early
2. **Prepare for Gates**: Have evidence ready for critical decisions
3. **Use REFRAME Wisely**: Better to adjust early than override
4. **Learn Role Behaviors**: Understand what each role does

## Next Steps

### Explore Advanced Features

- **Multi-Step Workflows**: Combine multiple dialogues for complex tasks
- **Historical Context**: See how past decisions influence current workflow
- **Constraint Manifests**: Define rules that apply across all dialogues
- **Artifact Management**: Organize and export generated code

### Dive Deeper

- **Read Technical Specification**: Understand the architecture
- **Review Implementation Roadmap**: See what's coming next
- **Join Community**: Share experiences and learn from others
- **Contribute**: Help improve JanumiCode

### Common Next Tasks

1. **Multi-File Feature**: "Create a user registration system with database, API, and UI"
2. **Refactoring**: "Refactor authentication code to use JWT tokens"
3. **API Integration**: "Create a client for the GitHub API with error handling"
4. **Testing**: "Add unit tests for the email validation function"

### Get Help

If you run into issues:

1. **Check Troubleshooting**: See README.md Troubleshooting section
2. **Review Output Panel**: View → Output → JanumiCode for detailed logs
3. **Check Database Stats**: Run `JanumiCode: Show Database Stats`
4. **Ask Community**: GitHub Discussions or Issues

---

**Congratulations! You're now ready to use JanumiCode effectively.**

Remember: JanumiCode is designed to keep you in control. Every critical decision goes through verification gates, and you always have the final say. The system is here to help, not to replace your judgment.

Happy governed coding! 🚀
