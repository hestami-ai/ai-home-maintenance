In "JanumiCode\\janumicode\\docs\\current\\architecture-redesign-verification-report.md" the latest report analysis had this feedback:

Ran the updated v3 checks and refreshed architecture-redesign-verification-report.md.

Current result: 85 PASS / 2 FAIL / 3 PARTIAL.

The new section 15 findings are the main addition:

15a PARTIAL: recursive decomposition still has a deterministic workflow-splitting heuristic after the main agent pass

15j PARTIAL: base DESIGNING and SEQUENCING prompts are good, but still underuse workspace-aware CLI-agent capabilities compared with MODELING and the deeper-decomposition path

Show less

The user is sharing feedback from the verification report (v3) which found 85 PASS / 2 FAIL / 3 PARTIAL. They're highlighting two PARTIAL findings from section 15 (the deeper analysis section). Let me read the verification report to understand the full context of these findings and the 2 FAILs, then address them.

Let me read the current verification report to understand the full context of all findings.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\docs\\current\\architecture-redesign-verification-report.md

Let me understand the specific findings:

**2 FAILs:**

* 13a: esbuild host/binary version mismatch (0.27.2 vs 0.27.3) — this is a Codex-specific issue, builds fine locally  
* 14j: Same as 13a (regression check for the same build issue)

**3 PARTIALs:**

* 13b: `npx tsc --noEmit` filtered output still has residual continuation lines from TS6059 diagnostics  
* 15a: Recursive decomposition still uses deterministic workflow-based heuristics after design pass  
* 15j: Base DESIGNING and SEQUENCING prompts don't push workspace inspection as explicitly as deeper-decomposition path

The user flagged 15a and 15j specifically. For the esbuild failures, that's an environment issue in Codex — the build works locally so we can skip it. The tsc filter leaving residual output is minor. But 15a and 15j point to the same root problem: the base decomposition prompts aren't driving workspace inspection hard enough compared to the recursive path, so the heuristics in `architectureRecursion.ts` still default to workflow-based splitting instead of pushing deeper analysis first. I need to look at the actual code to see what's happening with those two items — specifically how `splitByWorkflow()` fits into the decomposition flow versus the LLM-driven `invokeArchitectureDesign()` path, and whether the feedback is pointing to a real gap or a misunderstanding of the current architecture.

The report identifies 5 non-passing checks. Let me break them down:

**2 FAILs (13a, 14j):** Both are the same esbuild host/binary version mismatch — Codex environment-specific. Our local build passes fine (we just verified). This is not a code issue.

**3 PARTIALs:**

* **13b:** Residual `TS6059` continuation lines in filtered tsc output — cosmetic/tooling  
* **15a:** Recursive decomposition still uses deterministic `splitByWorkflow()` heuristic after LLM design pass  
* **15j:** Base DESIGNING and SEQUENCING prompts underuse workspace-aware CLI-agent capabilities compared to MODELING/deeper-decomposition

The two you highlighted (15a, 15j) are about the sophistication of the architecture prompts and recursion logic. Let me investigate the specific code to understand what improvements are warranted.

**EnterPlanMode**

OUT

Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.

In plan mode, you should:  
1\. Thoroughly explore the codebase to understand existing patterns  
2\. Identify similar features and architectural approaches  
3\. Consider multiple approaches and their trade-offs  
4\. Use AskUserQuestion if you need to clarify the approach  
5\. Design a concrete implementation strategy  
6\. When ready, use ExitPlanMode to present your plan for approval

Remember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.

**Task:**Explore 15a recursion heuristic

IN

I need to understand the recursive decomposition logic in the JanumiCode architecture phase. A verification report found (check 15a) that "recursive decomposition still uses deterministic workflow-based heuristics after the main agent design pass" in architectureRecursion.ts.

Read:  
1\. \`e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/workflow/architectureRecursion.ts\` — the full file, especially \`decomposeComponent()\`, \`splitByWorkflow()\`, and any comments about decomposition strategy  
2\. \`e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/workflow/architecturePhase.ts\` — search for \`decomposeDeeper\`, \`decompos\`, \`recursion\`, \`deeper\` to find the deeper-decomposition call site and how it uses the recursion module

Tell me:  
\- What exactly does \`splitByWorkflow()\` do? How is it called?  
\- What is the flow: LLM design pass → then what happens with the heuristic?  
\- Where is the decision point between "LLM-driven decomposition" vs "deterministic heuristic decomposition"?  
\- How does \`decomposeDeeper\` in architecturePhase.ts invoke the recursion?  
\- What would "fully LLM-driven" decomposition look like vs what exists now?

Be thorough — read full function bodies and trace the call chain.

**Task:**Explore 15j prompt workspace gaps

IN

I need to understand the DESIGNING, SEQUENCING, MODELING, and deeper-decomposition prompts in the JanumiCode architecture phase. A verification report found (check 15j) that "base DESIGNING and SEQUENCING prompts still do not push workspace inspection as explicitly as the deeper-decomposition path or MODELING prompt."

Read these sections of \`e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/roles/architectureExpert.ts\`:  
1\. The MODELING prompt/function (around line 119\) — what workspace-aware instructions does it give?  
2\. The DESIGNING prompt/function (around line 170\) — what workspace-aware instructions does it give?  
3\. The SEQUENCING prompt/function (around line 259\) — what workspace-aware instructions does it give?

Also read the deeper-decomposition feedback in \`e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/workflow/architecturePhase.ts\` around line 547 — what workspace-aware analysis does IT include?

And read the context builders in \`e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/context/builders/architecture.ts\` to understand what workspace context is passed to each prompt.

Tell me:  
\- Exactly what workspace-aware instructions does each prompt (MODELING, DESIGNING, SEQUENCING, deeper-decomposition) include?  
\- What does MODELING say that DESIGNING/SEQUENCING don't?  
\- What does the deeper-decomposition path say that DESIGNING/SEQUENCING don't?  
\- What would "push workspace inspection more explicitly" look like concretely for DESIGNING and SEQUENCING?

Be thorough — read full prompt strings.

**Read** architecturePhase.ts  
**Read** architecture.ts  
**Read** architecture.ts  
**Grep** "DEFAULT\_DECOMPOSITION\_CONFIG|DecompositionConfig|StoppingCriteria" (in e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/types/architecture.ts, type: ts)3 lines of output  
**Grep** "workspace|codebase|ground-truth|src/|directory|project|inspect" (in /e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/roles, type: ts)51 lines of output  
**Read** architectureExpert.ts  
**Read** architectureExpert.ts (lines 401-600)  
**Bash**

IN

grep \-n "DESIGNING\_SYSTEM\_PROMPT" e:/Projects/hestami-ai/JanumiCode/janumicode/src/lib/roles/architectureExpert.ts | head \-5

OUT

170:const DESIGNING\_SYSTEM\_PROMPT \= \`You are the ARCHITECTURE EXPERT performing COMPONENT DESIGN and INTERFACE SPECIFICATION.

456:		const stdinContent \= buildStdinContent(DESIGNING\_SYSTEM\_PROMPT, contextResult.value);

**Read** architectureExpert.ts (lines 171-320)

Excellent analysis from both agents. Now I have a clear picture of what needs to change:

**15a: Recursive decomposition heuristic**

The issue is that after the LLM produces components, `applyRecursiveDecomposition()` uses a mechanical stopping criteria check \+ `splitByWorkflow()` heuristic. The fix would be to make the decomposition step LLM-driven instead of using the deterministic `splitByWorkflow()` function.

However, I need to be careful here. Making decomposition LLM-driven means:

1. For each component that fails stopping criteria, invoke the LLM to decompose it  
2. This adds LLM calls (cost \+ latency)  
3. The current heuristic is fast and deterministic

The pragmatic approach is to replace `splitByWorkflow()` with an LLM call that asks the architecture expert to decompose a specific component, giving it full context about what the component does and why decomposition might be needed.

**15j: Workspace-aware prompts**

The straightforward fix is adding workspace inspection instructions to the DESIGNING and SEQUENCING prompts—both system prompts and context builders—matching what MODELING and deeper-decomposition already do. I'm thinking through the right level of detail for each fix.

For the LLM-driven decomposition, instead of having the recursion module do mechanical splitting based on workflow counts, I should identify components that violate stopping criteria and feed those back to the LLM design pass with specific feedback about what needs decomposition. This avoids passing LLM clients into the recursion module and handles failures more gracefully than adding latency to every decomposition step. splitting them, then have the main DESIGNING flow handle the re-decomposition via LLM.

Actually, I'm thinking about this wrong. The report says it's PARTIAL, not FAIL, and the current workflow-based heuristic is already safer than generic concern splitting. So I should improve it incrementally rather than overhaul it.

The pragmatic approach for 15a is to have `decomposeComponent()` call the architecture LLM directly instead of using `splitByWorkflow()`, which means adding an LLM callback parameter to `applyRecursiveDecomposition()` and falling back to keeping the component atomic if the LLM decomposition fails.

But I need to trace through the code flow more carefully—`applyRecursiveDecomposition()` is called from `architecturePhase`, and I need to understand how to thread the LLM dependency through that call chain.

Looking at the architecture, `architecturePhase.ts` already has access to the CLI provider and LLM configuration, so I can add an optional `decomposeFn` callback parameter to `applyRecursiveDecomposition()`. Then in `architecturePhase`, I'll pass a lambda that invokes the architecture design with focused feedback for that specific component. When a component violates stopping criteria in `architectureRecursion.ts`, I'll call the decompose function instead of `splitByWorkflow()`, with `splitByWorkflow()` as a fallback for backward compatibility.

For 15j, the workspace-aware prompts fix is just adding text to the DESIGNING and SEQUENCING prompts plus updating the context builders.

Let me check how `applyRecursiveDecomposition` is currently being called and what its signature looks like.

Excellent analysis from both agents. Let me read the key call sites to verify the integration points before writing the plan.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\workflow\\architectureRecursion.ts (lines 101-280)  
**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\workflow\\architecturePhase.ts (lines 701-760)

Now let me also read the DESIGNING and SEQUENCING prompts to understand exactly what text to add.

Now let me read the DESIGNING and SEQUENCING prompts, and the MODELING prompt for reference.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\roles\\architectureExpert.ts (lines 120-319)

Now I have a clear picture of both findings. Let me also read the deeper decomposition feedback section more precisely.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\workflow\\architecturePhase.ts (lines 536-585)  
**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\workflow\\architectureRecursion.ts (lines 267-346)

Now let me also check the context builders for DESIGNING and SEQUENCING to see what workspace context they provide.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\context\\builders\\architecture.ts (lines 116-355)

I now have a complete picture. Let me now also check how `invokeArchitectureDesign` takes its feedback parameter to understand how I might pass an LLM decomposition callback.

Now let me check the `invokeArchitectureDesign` signature to understand the callback pattern.

**Read** e:\\Projects\\hestami-ai\\JanumiCode\\janumicode\\src\\lib\\roles\\architectureExpert.ts (lines 424-503)

Now I have a complete understanding. Let me design the plan:

**15a: Replace deterministic `splitByWorkflow()` with LLM-driven decomposition**

The approach: Add an optional `decomposeFn` callback to `applyRecursiveDecomposition()`. When a component violates stopping criteria:

* If `decomposeFn` is provided, call it to get LLM-driven sub-components  
* Fall back to keeping the component as-is if the LLM call fails  
* Remove `splitByWorkflow()` and `decomposeComponent()` (no longer needed)

The callback would be provided by `architecturePhase.ts` when calling `applyRecursiveDecomposition()`. It would invoke `invokeArchitectureDesign()` with focused feedback about the specific component that needs decomposition.

Actually, re-invoking the full design for each violating component is too expensive. A better approach would be to evaluate the stopping criteria as we recurse, collect all components that violate them, then make a single LLM call afterward with feedback about what needs decomposition. This way we're doing one additional LLM invocation instead of one per component.

Looking at the current flow, I could add an async callback to `applyRecursiveDecomposition()` that gets invoked when a component violates constraints—this callback would handle the decomposition by re-invoking the design with targeted feedback about that specific component. The architecture phase would provide this callback, keeping the logic centralized and avoiding mechanical splitting.

The main trade-off is latency: only violating components trigger the callback, and most components should pass validation on the first pass, so the overhead should be minimal. I'm also wondering whether this actually changes the total number of LLM calls compared to the current approach.

Now I'm defining the concrete types and function signatures for this system. I need a callback function that takes a component, its violations, and depth, then returns a promise of decomposed sub-components. Then I'll update the main recursion function to accept this callback and a token budget parameter.

Defining the types and signatures... Writing the decomposition callback...

I'm realizing this approach is too expensive—invoking the full design prompt for each component would regenerate everything instead of just decomposing the target. I need a lighter-weight function that focuses specifically on breaking down a single component based on its violations, considering workflow boundaries and the actual codebase structure.

The cleanest path forward is to add a targeted decomposition prompt that the architecture phase can invoke directly through the existing CLI provider, rather than creating an entirely new function or modifying the main design invocation. After identifying which components violate the stopping criteria, I can collect them and apply this focused decomposition logic to each one. them all. Re-invoke `invokeArchitectureDesign()` once with feedback listing all violating components and asking the LLM to decompose them. The LLM returns a full redesigned component set, which is essentially what `decomposeDeeper` already does—the difference is it would trigger automatically rather than on human request.

But this is a significant architectural shift. The current recursion loop is iterative with a BFS queue, and changing it to "run loop, then re-invoke LLM, then run loop again" is a different pattern entirely. Let me think about what's actually pragmatic here. The verification report marked this as PARTIAL, not FAIL, and the current behavior is much safer than generic concern splitting. The real question is what level of improvement makes sense.

I think the most pragmatic approach is to replace `splitByWorkflow()` with a targeted LLM decomposition function that takes a specific component plus context and returns sub-components, falling back to keeping it as-is on failure. This requires LLM access in the recursion module, so I'll use a callback pattern—adding a `DecomposeFn` type to `architectureRecursion.ts` and accepting an optional `decomposeFn` parameter in `applyRecursiveDecomposition`. When a component violates, I call the decompose function if available, otherwise keep it unchanged. Then in `architecturePhase.ts` I'll wire up the callback.

For the decompose function itself, I'm building a lightweight inline LLM invocation with a focused prompt that describes the specific component, its violations, and asks whether meaningful sub-component boundaries exist—returning JSON with sub-components if yes, or an empty array if no. This is just one LLM call per violating component, typically zero to three calls total, with a prompt that's much more targeted than the full architecture design flow.

Now I'm weighing whether to keep `splitByWorkflow()` as a fallback or remove it entirely. The LLM could fail due to network issues or quota limits, but the report specifically identifies the heuristic as the core problem—falling back to it would mean we haven't actually solved the issue. Better to fall back to keeping the component as-is rather than reapplying the same flawed heuristic.

So the final approach is: add a `DecomposeFn` callback that the system calls when a component violates stopping criteria, use the LLM results if successful, and keep the component unchanged if the callback isn't provided or fails. This removes the mechanical splitting entirely and lets humans manually trigger deeper decomposition when needed. I'll create a new function in architectureExpert.ts to handle the focused LLM invocation rather than inlining it.

Most of the stopping criteria are heuristic metadata checks, but `single_responsibility` is the real trigger for splitting—components serving more than 3 workflows would get an LLM prompt asking whether they should be decomposed and how.

Now I'm mapping out the workspace-aware prompts fix: I need to add workspace guidance sections to both the designing and sequencing system prompts, plus their corresponding context builders, mirroring what's already in the modeling layer.

I have a complete picture now. Let me write the plan.

**Edit** C:\\Users\\mchen\\.claude\\plans\\elegant-fluttering-wreath.mdEdit failed  
**Read** C:\\Users\\mchen\\.claude\\plans\\elegant-fluttering-wreath.md  
**Write** C:\\Users\\mchen\\.claude\\plans\\elegant-fluttering-wreath.md190 lines  
\# Fix: Verification Report 15a and 15j — LLM-Driven Decomposition \+ Workspace-Aware Prompts

\#\# Context

The v3 verification report (85 PASS / 2 FAIL / 3 PARTIAL) identified two sophistication gaps in the architecture phase:

\- \*\*15a PARTIAL\*\*: Recursive decomposition still uses a deterministic \`splitByWorkflow()\` heuristic after the LLM design pass. When a component violates stopping criteria (e.g., serves \>3 workflows), it is mechanically split into one sub-component per workflow — regardless of whether those workflows are semantically cohesive. The LLM's judgment is overridden by a structural rule.

\- \*\*15j PARTIAL\*\*: The DESIGNING and SEQUENCING prompts don't push workspace-aware inspection (examining \`src/\`, \`ground-truth-specs/\`, project configs) as explicitly as the MODELING prompt and deeper-decomposition path do.

The 2 FAILs (13a, 14j) are both the esbuild host/binary version mismatch in the Codex environment — the local build passes.

\---

\#\# Fix 15a: LLM-Driven Component Decomposition

\#\#\# Problem

In \`architectureRecursion.ts\`, when \`evaluateStoppingCriteria()\` identifies a component that violates criteria, \`decomposeComponent()\` (line 276\) mechanically calls \`splitByWorkflow()\` (line 298\) — one sub-component per workflow, with auto-generated responsibility text like \*"Handles WF-X workflow within Parent"\*.

This flattens semantic cohesion. Example: A \`PropertyServices\` component serving 5 CRUD workflows is split into 5 fragments even though the LLM reasoned they're cohesive.

\#\#\# Fix: DecomposeFn Callback

Replace the mechanical \`splitByWorkflow()\` with an LLM-driven callback that asks the architecture agent HOW (or whether) to decompose a specific component.

\*\*File: \`src/lib/workflow/architectureRecursion.ts\`\*\*

1\. Export a \`DecomposeFn\` type:  
\`\`\`typescript  
export type DecomposeFn \= (  
    component: ComponentSpec,  
    violations: string\[\],  
    depth: number  
) \=\> Promise\<ComponentSpec\[\]\>;  
\`\`\`

2\. Add optional \`decomposeFn\` to the options parameter of \`applyRecursiveDecomposition()\`:  
\`\`\`typescript  
options?: { commandId?; dialogueId?; forcedMinDepth?; decomposeFn?: DecomposeFn }  
\`\`\`

3\. Replace the call to \`decomposeComponent()\` (line 189\) with LLM callback:  
\`\`\`typescript  
let subComponents: ComponentSpec\[\] \= \[\];  
if (options?.decomposeFn) {  
    try {  
        subComponents \= await options.decomposeFn(component, violations, depth);  
    } catch (err) {  
        log?.warn('LLM decomposition failed, keeping component as-is', {  
            componentId: component.component\_id,  
            error: err instanceof Error ? err.message : String(err),  
        });  
    }  
}  
// Falls through to existing "no viable split" handling if empty  
\`\`\`

4\. Remove \`decomposeComponent()\` and \`splitByWorkflow()\` — no more mechanical splitting.

\*\*File: \`src/lib/roles/architectureExpert.ts\`\*\*

5\. Add a new focused function \`invokeComponentDecomposition()\` with a targeted prompt:

\`\`\`typescript  
export async function invokeComponentDecomposition(  
    dialogueId: string,  
    component: ComponentSpec,  
    violations: string\[\],  
    workflows: WorkflowNode\[\],  
    dataModels: DataModel\[\],  
    options?: { commandId?: string; dialogueId?: string }  
): Promise\<Result\<ComponentSpec\[\]\>\>  
\`\`\`

The prompt focuses on ONE component:  
\- States the component's label, responsibility, workflows served, and violations  
\- Asks the LLM to analyze whether it should be split and how  
\- Directs it to consider: workflow cohesion, data flow patterns, domain model alignment, workspace structure  
\- Return \`{ "components": \[...\] }\` — empty array means keep intact  
\- Anti-hallucination: "Do NOT split into Data/Logic/API unless genuinely separable"

\*\*File: \`src/lib/workflow/architecturePhase.ts\`\*\*

6\. When calling \`applyRecursiveDecomposition()\` (line 733), provide the \`decomposeFn\` that wraps \`invokeComponentDecomposition()\`:  
\`\`\`typescript  
const { DecomposeFn } \= await import('./architectureRecursion');  
const { invokeComponentDecomposition } \= await import('../roles/architectureExpert');

const decomposeFn: DecomposeFn \= async (component, violations, depth) \=\> {  
    const result \= await invokeComponentDecomposition(  
        dialogueId, component, violations,  
        doc.workflow\_graph, doc.data\_models,  
        { commandId: recursionCmdId, dialogueId }  
    );  
    return result.success ? result.value : \[\];  
};

const recursionResult \= await applyRecursiveDecomposition(  
    dialogueId, components, doc.workflow\_graph,  
    decompositionConfig, tokenBudget,  
    { commandId: recursionCmdId, dialogueId, forcedMinDepth, decomposeFn }  
);  
\`\`\`

\#\#\# Files modified  
\- \`src/lib/workflow/architectureRecursion.ts\` — DecomposeFn type, callback invocation, remove splitByWorkflow/decomposeComponent  
\- \`src/lib/roles/architectureExpert.ts\` — new \`invokeComponentDecomposition()\` function \+ prompt  
\- \`src/lib/workflow/architecturePhase.ts\` — provide decomposeFn callback

\---

\#\# Fix 15j: Workspace-Aware DESIGNING and SEQUENCING Prompts

\#\#\# Problem

| Prompt | Workspace Inspection |  
|--------|---------------------|  
| \*\*MODELING\*\* | Explicit — \*"Read the ground-truth spec files in the workspace..."\* |  
| \*\*DESIGNING\*\* | None — no workspace inspection instructions |  
| \*\*SEQUENCING\*\* | None — no workspace inspection instructions |  
| \*\*Deeper Decomp\*\* | Explicit — \*"examine existing source files and directory structure..."\* |

\#\#\# Fix

\*\*File: \`src/lib/roles/architectureExpert.ts\`\*\*

1\. Add to \`DESIGNING\_SYSTEM\_PROMPT\` (after Anti-Hallucination Guardrails, before Stopping Criteria):

\`\`\`  
\# Workspace Inspection  
Before finalizing components, examine the workspace for implementation context:  
1\. Look at src/ directory structure for existing module organization patterns.  
2\. Read ground-truth spec files (specs/ or ground-truth-specs/) for domain  
   patterns that suggest natural component boundaries.  
3\. Check project configs (package.json, tsconfig.json, build configs) for  
   hints about intended module structure.  
4\. Align file\_scope paths with actual workspace directory conventions.  
\`\`\`

2\. Add to \`SEQUENCING\_SYSTEM\_PROMPT\` (after Approach, before Critical Guardrails):

\`\`\`  
\# Workspace-Aware Sequencing  
Before finalizing the implementation order, examine the workspace:  
1\. Look at src/ directory structure for existing implementation layers.  
2\. Check for existing build scripts, migration files, or deployment configs  
   that suggest a natural build order.  
3\. Examine ground-truth spec files (specs/ or ground-truth-specs/) for  
   domain priorities or phasing guidance.  
4\. Align verification methods with the project's actual test and build tooling.  
\`\`\`

\*\*File: \`src/lib/context/builders/architecture.ts\`\*\*

3\. Add \`\# Workspace Guidance\` section to \`buildDesigningContext()\` (after human feedback, before return):

\`\`\`typescript  
sections.push('\# Workspace Guidance');  
sections.push('Examine the workspace for implementation patterns. Look for existing module');  
sections.push('structures in src/, domain patterns in ground-truth-specs/, and project');  
sections.push('conventions in config files to inform component boundaries and file\_scope.');  
\`\`\`

4\. Add \`\# Workspace Guidance\` section to \`buildSequencingContext()\` (after interfaces, before return):

\`\`\`typescript  
sections.push('\# Workspace Guidance');  
sections.push('Examine the workspace for build and deployment patterns. Check for existing');  
sections.push('migration files, build scripts, test infrastructure, and deployment configs');  
sections.push('to inform implementation order and verification methods.');  
\`\`\`

\#\#\# Files modified  
\- \`src/lib/roles/architectureExpert.ts\` — workspace sections in DESIGNING and SEQUENCING prompts  
\- \`src/lib/context/builders/architecture.ts\` — workspace guidance in both context builders

\---

\#\# Verification

1\. \*\*Build:\*\* \`node esbuild.js\` — no errors  
2\. \*\*Static check:\*\* Verify \`splitByWorkflow\` and \`decomposeComponent\` no longer exist in \`architectureRecursion.ts\`  
3\. \*\*Prompt review:\*\* Confirm DESIGNING, SEQUENCING, MODELING, and deeper-decomposition all mention workspace inspection  
4\. \*\*Functional test:\*\* Run a dialogue through ARCHITECTURE phase, verify:  
   \- Recursion logs show LLM-driven decomposition (not "workflow split")  
   \- Components that serve cohesive workflows are kept intact by LLM judgment  
   \- Components that genuinely need splitting are split meaningfully  
5\. \*\*Regression:\*\* Verify deeper-decomposition path still works (human "Decompose Deeper" button)

**Claude’s Plan**

# **Fix: Verification Report 15a and 15j — LLM-Driven Decomposition \+ Workspace-Aware Prompts**

## **Context**

The v3 verification report (85 PASS / 2 FAIL / 3 PARTIAL) identified two sophistication gaps in the architecture phase:

* **15a PARTIAL**: Recursive decomposition still uses a deterministic `splitByWorkflow()` heuristic after the LLM design pass. When a component violates stopping criteria (e.g., serves \>3 workflows), it is mechanically split into one sub-component per workflow — regardless of whether those workflows are semantically cohesive. The LLM's judgment is overridden by a structural rule.  
* **15j PARTIAL**: The DESIGNING and SEQUENCING prompts don't push workspace-aware inspection (examining `src/`, `ground-truth-specs/`, project configs) as explicitly as the MODELING prompt and deeper-decomposition path do.

The 2 FAILs (13a, 14j) are both the esbuild host/binary version mismatch in the Codex environment — the local build passes.

---

## **Fix 15a: LLM-Driven Component Decomposition**

### **Problem**

In `architectureRecursion.ts`, when `evaluateStoppingCriteria()` identifies a component that violates criteria, `decomposeComponent()` (line 276\) mechanically calls `splitByWorkflow()` (line 298\) — one sub-component per workflow, with auto-generated responsibility text like *"Handles WF-X workflow within Parent"*.

This flattens semantic cohesion. Example: A `PropertyServices` component serving 5 CRUD workflows is split into 5 fragments even though the LLM reasoned they're cohesive.

### **Fix: DecomposeFn Callback**

Replace the mechanical `splitByWorkflow()` with an LLM-driven callback that asks the architecture agent HOW (or whether) to decompose a specific component.

**File: `src/lib/workflow/architectureRecursion.ts`**

1. Export a `DecomposeFn` type:

export type DecomposeFn \= (  
    component: ComponentSpec,  
    violations: string\[\],  
    depth: number  
) \=\> Promise\<ComponentSpec\[\]\>;

2. Add optional `decomposeFn` to the options parameter of `applyRecursiveDecomposition()`:

options?: { commandId?; dialogueId?; forcedMinDepth?; decomposeFn?: DecomposeFn }

3. Replace the call to `decomposeComponent()` (line 189\) with LLM callback:

let subComponents: ComponentSpec\[\] \= \[\];  
if (options?.decomposeFn) {  
    try {  
        subComponents \= await options.decomposeFn(component, violations, depth);  
    } catch (err) {  
        log?.warn('LLM decomposition failed, keeping component as-is', {  
            componentId: component.component\_id,  
            error: err instanceof Error ? err.message : String(err),  
        });  
    }  
}  
// Falls through to existing "no viable split" handling if empty

4. Remove `decomposeComponent()` and `splitByWorkflow()` — no more mechanical splitting.

**File: `src/lib/roles/architectureExpert.ts`**

5. Add a new focused function `invokeComponentDecomposition()` with a targeted prompt:

export async function invokeComponentDecomposition(  
    dialogueId: string,  
    component: ComponentSpec,  
    violations: string\[\],  
    workflows: WorkflowNode\[\],  
    dataModels: DataModel\[\],  
    options?: { commandId?: string; dialogueId?: string }  
): Promise\<Result\<ComponentSpec\[\]\>\>

The prompt focuses on ONE component:

* States the component's label, responsibility, workflows served, and violations  
* Asks the LLM to analyze whether it should be split and how  
* Directs it to consider: workflow cohesion, data flow patterns, domain model alignment, workspace structure  
* Return `{ "components": [...] }` — empty array means keep intact  
* Anti-hallucination: "Do NOT split into Data/Logic/API unless genuinely separable"

**File: `src/lib/workflow/architecturePhase.ts`**

6. When calling `applyRecursiveDecomposition()` (line 733), provide the `decomposeFn` that wraps `invokeComponentDecomposition()`:

const { DecomposeFn } \= await import('./architectureRecursion');  
const { invokeComponentDecomposition } \= await import('../roles/architectureExpert');

const decomposeFn: DecomposeFn \= async (component, violations, depth) \=\> {  
    const result \= await invokeComponentDecomposition(  
        dialogueId, component, violations,  
        doc.workflow\_graph, doc.data\_models,  
        { commandId: recursionCmdId, dialogueId }  
    );  
    return result.success ? result.value : \[\];  
};

const recursionResult \= await applyRecursiveDecomposition(  
    dialogueId, components, doc.workflow\_graph,  
    decompositionConfig, tokenBudget,  
    { commandId: recursionCmdId, dialogueId, forcedMinDepth, decomposeFn }  
);

### **Files modified**

* `src/lib/workflow/architectureRecursion.ts` — DecomposeFn type, callback invocation, remove splitByWorkflow/decomposeComponent  
* `src/lib/roles/architectureExpert.ts` — new `invokeComponentDecomposition()` function \+ prompt  
* `src/lib/workflow/architecturePhase.ts` — provide decomposeFn callback

---

## **Fix 15j: Workspace-Aware DESIGNING and SEQUENCING Prompts**

### **Problem**

| Prompt | Workspace Inspection |
| ----- | ----- |
| **MODELING** | Explicit — *"Read the ground-truth spec files in the workspace..."* |
| **DESIGNING** | None — no workspace inspection instructions |
| **SEQUENCING** | None — no workspace inspection instructions |
| **Deeper Decomp** | Explicit — *"examine existing source files and directory structure..."* |

### **Fix**

**File: `src/lib/roles/architectureExpert.ts`**

1. Add to `DESIGNING_SYSTEM_PROMPT` (after Anti-Hallucination Guardrails, before Stopping Criteria):

\# Workspace Inspection  
Before finalizing components, examine the workspace for implementation context:  
1\. Look at src/ directory structure for existing module organization patterns.  
2\. Read ground-truth spec files (specs/ or ground-truth-specs/) for domain  
   patterns that suggest natural component boundaries.  
3\. Check project configs (package.json, tsconfig.json, build configs) for  
   hints about intended module structure.  
4\. Align file\_scope paths with actual workspace directory conventions.

2. Add to `SEQUENCING_SYSTEM_PROMPT` (after Approach, before Critical Guardrails):

\# Workspace-Aware Sequencing  
Before finalizing the implementation order, examine the workspace:  
1\. Look at src/ directory structure for existing implementation layers.  
2\. Check for existing build scripts, migration files, or deployment configs  
   that suggest a natural build order.  
3\. Examine ground-truth spec files (specs/ or ground-truth-specs/) for  
   domain priorities or phasing guidance.  
4\. Align verification methods with the project's actual test and build tooling.

**File: `src/lib/context/builders/architecture.ts`**

3. Add `# Workspace Guidance` section to `buildDesigningContext()` (after human feedback, before return):

sections.push('\# Workspace Guidance');  
sections.push('Examine the workspace for implementation patterns. Look for existing module');  
sections.push('structures in src/, domain patterns in ground-truth-specs/, and project');  
sections.push('conventions in config files to inform component boundaries and file\_scope.');

4. Add `# Workspace Guidance` section to `buildSequencingContext()` (after interfaces, before return):

sections.push('\# Workspace Guidance');  
sections.push('Examine the workspace for build and deployment patterns. Check for existing');  
sections.push('migration files, build scripts, test infrastructure, and deployment configs');  
sections.push('to inform implementation order and verification methods.');

### **Files modified**

* `src/lib/roles/architectureExpert.ts` — workspace sections in DESIGNING and SEQUENCING prompts  
* `src/lib/context/builders/architecture.ts` — workspace guidance in both context builders

---

## **Verification**

1. **Build:** `node esbuild.js` — no errors  
2. **Static check:** Verify `splitByWorkflow` and `decomposeComponent` no longer exist in `architectureRecursion.ts`  
3. **Prompt review:** Confirm DESIGNING, SEQUENCING, MODELING, and deeper-decomposition all mention workspace inspection  
4. **Functional test:** Run a dialogue through ARCHITECTURE phase, verify:  
   * Recursion logs show LLM-driven decomposition (not "workflow split")  
   * Components that serve cohesive workflows are kept intact by LLM judgment  
   * Components that genuinely need splitting are split meaningfully  
5. **Regression:** Verify deeper-decomposition path still works (human "Decompose Deeper" button)

