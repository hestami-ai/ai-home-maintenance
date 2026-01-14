I want to develop a set of tools \- CLI \- that an agent could run to make sure it had implemented things consistent with the guidelines / standards expressed in the document. Propose some options.

Below is a **tooling-oriented proposal**, not a generic “linting” answer. It assumes autonomous or semi-autonomous **full-stack agents** working in HAOS and aims to **mechanize enforcement of the rules you codified** (R1–R10), rather than relying on agent self-discipline.

Rule Index (stable IDs)

R1 Tenant Contract

R2 DBOS-for-mutations

R3 Idempotency key required

R4 Type pipeline (Prisma→Zod→OpenAPI→types)

R5 SSR boundary (server-only)

R6 Error contract (type-safe errors only)

R7 SECURITY DEFINER triggers

R8 No direct Prisma in bootstrap/system flows

R9 Enum strategy



I’ll structure this as:

1. Design principles for agent-verifiable standards

2. CLI tool categories (what to build)

3. Concrete CLI commands mapped to your rules

4. Implementation strategies (how hard each is)

5. A recommended phased rollout

---

## **1\. Design principles for agent-verifiable standards**

To be effective for agents, the tools should be:

1. **Deterministic**

   * Same repo state → same result

   * No “judgment calls” or prose output by default

2. **Rule-indexed**

   * Output must reference rule IDs (R1–R10)

   * Example: `FAIL R5: Prisma import detected in UI layer`

3. **Composable**

   * Each check runnable independently

   * Aggregate command for “agent self-certification”

4. **Machine-parsable**

   * JSON output option mandatory

   * Enables agent feedback loops

5. **Fast**

   * Must run frequently (pre-commit, pre-PR, agent inner loop)

---

## **2\. CLI tool categories**

You should think in **four layers of enforcement**, not one monolithic linter.

### **Layer A — Static structural analysis**

“Does the code *look* like it violates rules?”

* AST scanning

* File-system boundary checks

* Import graph validation

### **Layer B — Schema & pipeline verification**

“Did you follow the Prisma → Zod → OpenAPI → Types pipeline?”

* Artifact freshness

* Enum source consistency

* Type drift detection

### **Layer C — Runtime intent enforcement**

“Is this mutation really durable / idempotent / policy-checked?”

* DBOS workflow presence

* Idempotency key propagation

* Policy call existence

### **Layer D — Execution simulation (selective)**

“If I run this path, does it violate assumptions?”

* Limited smoke tests

* RLS sanity checks

* SSR boundary checks

Not all rules need all layers.

---

## **3\. Proposed CLI commands (concrete)**

### **3.1 `haos verify rules`**

**Purpose**

* High-level agent self-certification

* One command to rule them all

**What it does**

* Runs all checks

* Emits summary mapped to R1–R10

**Example**

`haos verify rules --json`

**Output**

`{`  
  `"status": "fail",`  
  `"violations": [`  
    `{ "rule": "R5", "file": "src/routes/+page.ts", "reason": "Prisma import in UI layer" },`  
    `{ "rule": "R3", "workflow": "createWorkOrder", "reason": "Missing idempotencyKey parameter" }`  
  `]`  
`}`

This is the command agents should be instructed to run before declaring work complete.

---

### **3.2 `haos verify boundaries` (R1, R5, R7)**

**Checks**

* Prisma imports outside allowed directories

* DB access from UI / client code

* SC (server client) usage only in server contexts

* SD usage when org bootstrap detected

**Implementation**

* TypeScript AST (ts-morph)

* Directory rules (config-driven)

**Violations caught**

* UI importing Prisma

* API route bypassing SD during bootstrap

* Client bundle leaking server code

---

### **3.3 `haos verify mutations` (R2, R3)**

**Checks**

* Every mutation handler is inside a DBOS workflow

* Workflow ID derived from `idempotencyKey`

* No direct Prisma writes in request handlers

**Implementation**

* AST scan for Prisma `.create/.update/.delete`

* Ensure call graph flows through DBOS workflow wrapper

* Verify workflow signature includes `idempotencyKey`

This is **very high value** for preventing silent corruption.

---

### **3.4 `haos verify types` (R4, R8)**

**Checks**

* `types.generated.ts` is up-to-date with OpenAPI

* No Prisma types imported outside server

* No hardcoded enums (`z.enum([...])`)

* All enums sourced from ZodGen barrel

**Implementation**

* Hash comparison (OpenAPI vs generated types)

* AST enum detection

* Import source analysis

**Optional**

* `--fix` to regenerate types automatically

---

### **3.5 `haos verify policies` (R10)**

**Checks**

* Any new resource/action referenced in API has a Cerbos policy

* Policy version incremented when schema changes

* No “unknown action” usage

**Implementation**

* Parse oRPC routes → extract resource/action names

* Compare against Cerbos policy files

This directly enforces *policy-first development*.

---

### **3.6 `haos verify timestamps` (R9)**

**Checks**

* Prisma timestamp fields use `TIMESTAMPTZ(3)`

* No JS `Date` precision mismatch in SD functions

* Workflow payload timestamps normalized

**Implementation**

* Prisma schema inspection

* SQL function parsing (lightweight)

* TS payload scan for timestamp coercion

This is niche but important because it’s a known sharp edge.

---

### **3.7 `haos verify pipelines`**

**Checks**

* Prisma → ZodGen run since last schema change

* OpenAPI regenerated since router change

* API Types regenerated since OpenAPI change

**Implementation**

* Git diff \+ timestamps

* Content hashing

**Agent benefit**

* Prevents “forgot to regenerate” failures without human review.

---

## **4\. Advanced (optional) tools for later phases**

### **4.1 `haos trace mutation <workflow>`**

Simulates execution path:

* Verifies policy check occurs before mutation

* Verifies orgId propagation

* Verifies retry safety

Useful for debugging complex flows.

---

### **4.2 `haos explain violation R5`**

Agent-friendly explanation mode:

* Explains why rule exists

* Points to canonical section in onboarding doc

Useful during early agent training, can be disabled later.

---

### **4.3 `haos certify`**

Generates an **attestation artifact**:

`{`  
  `"commit": "abc123",`  
  `"verifiedRules": ["R1","R2","R3","R4","R5","R6","R7","R8","R9","R10"],`  
  `"timestamp": "2026-01-05T14:32:00Z"`  
`}`

This can be attached to PRs, CI, or agent output.

---

## **5\. Recommended phased rollout**

### **Phase 1 (highest ROI, lowest effort)**

* `verify boundaries`

* `verify mutations`

* `verify types`

* `verify pipelines`

These catch \~80% of real-world agent failures.

### **Phase 2 (governance hardening)**

* `verify policies`

* `verify timestamps`

### **Phase 3 (agent autonomy)**

* `verify rules`

* `certify`

* JSON-only mode for tight feedback loops

---

## **6\. Strategic insight: this turns your document into executable governance**

Once these tools exist:

* The **document becomes the spec**

* The **CLI becomes the enforcement**

* Agents stop “arguing” about interpretation

* You can safely increase autonomy and parallelism

This is exactly the same move that Kubernetes made with declarative specs \+ controllers — you are doing it for **full-stack AI-driven development**.

---

If you want next steps, I can:

* Propose a **CLI command spec \+ config file format**

* Sketch a **ts-morph–based implementation skeleton**

* Map each rule (R1–R10) to **specific AST patterns**

* Design this so it can run **inside DBOS workflows or CI**

Just tell me which direction you want to go next.

I will need an agent to implement these tools. What would you propose?

Below is what I would propose you hand to an implementing agent: an **implementation-ready mini-SRD \+ tasking prompt** that is specific enough to execute, with a phased plan, concrete command set, repo assumptions, and acceptance criteria. It is designed to produce a usable CLI quickly, then harden it.

---

## **Proposal: Build “haos-guard” (CLI governance for HAOS agents)**

### **Objectives**

1. Encode HAOS onboarding rules (R1–R10) as **executable checks**.

2. Provide a CLI that returns **deterministic, machine-readable** results (JSON) for agents and CI.

3. Make the checks **config-driven** so rules and folder boundaries can evolve without rewriting logic.

### **Non-goals (initially)**

* Deep semantic verification (full call-graph proof) beyond practical AST heuristics.

* Full runtime simulation of workflows.

---

## **Recommended architecture**

### **Language/runtime**

* **TypeScript** running on **Bun** (align with your stack direction).

* Use **ts-morph** (TypeScript AST) for source scanning.

* Use **yargs** (or **commander**) for CLI structure.

* Use **zx**\-style shell execution or Bun’s `spawn` for pipeline commands.

### **Packaging**

* New package in repo: `tools/haos-guard/`

* Expose command as: `bunx haos-guard …` or `bun run haos:verify …`

* Optional: publish as internal npm package later.

### **Configuration**

Single file at repo root:

* `haos-guard.config.json`

Contains:

* folder boundary rules

* allowed imports

* prisma client path(s)

* cerbos policy path(s)

* dbos workflow wrapper identifiers

* openapi/types artifact paths

This is critical so the CLI remains stable even as repo layout changes.

---

## **CLI command set (MVP → V1)**

### **MVP commands (deliver first)**

1. `haos-guard verify boundaries`

   * Enforces R5 (SSR boundary) \+ “no prisma in UI/client” \+ basic R1 hygiene.

2. `haos-guard verify mutations`

   * Enforces R2/R3 heuristically (writes must be inside workflow, idempotencyKey present).

3. `haos-guard verify types`

   * Enforces R4/R8 (type pipeline and enum strategy).

4. `haos-guard verify pipelines`

   * Enforces “did you regenerate artifacts” (hash/timestamp drift).

5. `haos-guard verify rules`

   * Aggregates all above, emits JSON \+ human summary.

### **V1 commands (next iteration)**

6. `haos-guard verify policies`

   * Enforces R10 by comparing oRPC route actions/resources to Cerbos policies.

7. `haos-guard verify timestamps`

   * Enforces R9 (Prisma schema \+ SD SQL parsing where feasible).

8. `haos-guard certify`

   * Emits attestation JSON artifact for CI/agents.

---

## **How each MVP check should work (implementation detail)**

### **A) `verify boundaries`**

**Technique:** AST scan \+ import graph inspection  
 **Checks:**

* Forbidden imports in UI/client directories:

  * `@prisma/client`, `generated/prisma/*`, any file matching configured Prisma output path

* Forbidden imports of ZodGen directly in UI if your rule is “API Types only” (configurable)

* Enforce SSR boundary:

  * routes must use server files (`+page.server.ts`, `+layout.server.ts`) for data fetching

  * disallow importing server-only modules into client modules

**Output:**

* violations with `{rule, file, symbol, reason, suggestion}`

---

### **B) `verify mutations`**

**Technique:** AST scan for Prisma write calls \+ proximity rules  
 **Checks:**

* Detect Prisma mutation calls: `.create`, `.update`, `.delete`, `.upsert`, `$executeRaw`, `$transaction`

* Ensure they occur within:

  * a function annotated/wrapped as DBOS workflow (configured patterns), OR

  * a file path under `workflows/` (configurable)

* Ensure workflow function signature includes `idempotencyKey` (string) parameter

* Ensure workflow ID assignment references `idempotencyKey` (pattern match)

**Note:** This is heuristic, but very effective in practice.

---

### **C) `verify types`**

**Checks:**

* Disallow `z.enum([…])` literals unless in generated files (R8)

* Require enum imports from the ZodGen barrel (configured file)

* Disallow Prisma type imports in non-server code (R4/R5)

* Detect usage of `types.generated.ts` in UI for API payload types

---

### **D) `verify pipelines`**

**Checks:**

* If Prisma schema changed since last generation:

  * flag if ZodGen artifacts not regenerated

* If oRPC routes changed since last OpenAPI generation:

  * flag if OpenAPI spec not regenerated

* If OpenAPI changed since last `types.generated.ts`:

  * flag drift

**Implementation approaches:**

* Fast path: file timestamps

* Robust path: content hashing of key inputs/outputs

---

## **Acceptance criteria (what “done” means)**

### **Functional**

* Running `haos-guard verify rules` produces:

  * exit code `0` when clean

  * exit code `1` on violations

* JSON output mode: `--json` must exist for all commands.

* Each violation includes:

  * `rule` in {R1..R10}

  * file path

  * short reason

  * actionable suggestion

### **Operational**

* Runs in \< 10 seconds on repo on a dev machine (goal)

* Works cross-platform (Windows dev included)

### **Integration**

* Add CI job (optional for MVP, required for V1):

  * `bun run haos:verify -- --json`

---

## **What I would send to the implementing agent (prompt)**

Use the following as the agent tasking message:

---

### **Prompt for Implementing Agent**

You are implementing a governance CLI for the HAOS repo that programmatically enforces onboarding rules R1–R10.

**Goal:** Create a Bun \+ TypeScript CLI named `haos-guard` in `tools/haos-guard/` with config-driven checks. It must support both human-readable output and `--json` output.

#### **Deliverables**

1. `tools/haos-guard/` package with:

   * `src/cli.ts` entrypoint

   * `src/checks/*` modules

   * `src/reporting/*` (JSON \+ pretty output)

   * `haos-guard.config.json` at repo root (or sample)

2. Commands:

   * `haos-guard verify boundaries`

   * `haos-guard verify mutations`

   * `haos-guard verify types`

   * `haos-guard verify pipelines`

   * `haos-guard verify rules` (aggregate)

3. Output:

   * exit code `0` clean, `1` violations

   * `--json` outputs `{status, violations[]}`

4. Each violation must include:

   * `rule` (R1..R10), `file`, `reason`, `suggestion`

5. Provide README with:

   * install/run instructions

   * how to configure folder boundaries and allowed imports

   * examples of failure output

#### **Technical requirements**

* Use Bun \+ TypeScript.

* Use `ts-morph` for AST scanning.

* Must not require network access.

* Must run on Windows.

#### **Rule mapping**

* Boundaries: enforce R5 and “no Prisma import in UI”

* Mutations: enforce R2/R3 heuristically (Prisma writes must be in workflow; idempotencyKey required; workflow ID \= idempotencyKey)

* Types: enforce R4/R8 (no Prisma types in UI; no `z.enum([…])` outside generated; enums from barrel)

* Pipelines: detect drift between Prisma schema, ZodGen outputs, OpenAPI, and `types.generated.ts`

#### **Workflow**

* Start with a minimal working CLI and one check per command.

* Expand until each command produces at least one meaningful class of violation.

* Add unit tests for key detectors if feasible (optional for MVP, preferred).

Return the PR-ready code changes.

---

## **Recommendation on agent profile**

Use an implementing agent with:

* TypeScript toolchain comfort

* AST tooling experience (ts-morph, ESLint rule writing)

* Build tooling familiarity (Bun, monorepo scripts)

* Security/policy awareness (Cerbos integration later)

---

## **If you want my “best bet” execution plan**

1. Implement reporting \+ CLI skeleton first.

2. Implement `verify boundaries` (easiest and high impact).

3. Implement `verify mutations` (most valuable).

4. Implement `verify pipelines` (simple drift checks).

5. Implement `verify types` (enum \+ import rules).

This ensures you get early value even if later checks are more nuanced.

