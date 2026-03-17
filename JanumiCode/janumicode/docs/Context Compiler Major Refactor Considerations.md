To engineer a policy-driven, role/phase-aware context handoff compiler that guarantees bounded situational awareness, we must shift   
compiler.ts from a "best-effort aggregator" to a strict Contract-Driven Memory Allocator.  
The core philosophy of this redesign is that every LLM invocation requires an explicit Context Contract. This contract dictates exactly what information is structurally required, what is nice-to-have, and what is the exact policy for shedding weight when the budget tightens.  
Here is the architectural blueprint for engineering this mature context-engineering system.  
---

### 1\. The Context Policy Engine (The Contracts)

We must introduce a declarative policy layer that defines the "bounded situational awareness" required for a specific Role at a specific Phase.  
We define a ContextContract interface that the compiler uses as its blueprint:  
typescript  
interface ContextContract {  
   targetRole: Role;  
   targetPhase: WorkflowPhase;  
    
   *// 1\. Required Context (Must-Haves)*  
   *// If these exceed the budget, compilation FAILS, returning an explicit error*  
   *// rather than lobotomizing the agent.*  
   requiredBlocks: ContextBlockType\[\];  
    
   *// 2\. Optional Context (Nice-to-Haves)*  
   *// Gathered if budget allows.*  
   optionalBlocks: ContextBlockType\[\];  
    
   *// 3\. Preserve-First Priorities (Resolution Strategy)*  
   *// Absolute ordering of what gets dropped first when budget is tight.*  
   sheddingPriority: ContextBlockType\[\];  
    
   *// 4\. Acceptable Omissions & Summarization rules*  
   *// Can we replace a block with a pointer, or summarize it?*  
   omissionPolicy: Record\<ContextBlockType, 'drop' | 'summarize' | 'pointer\_only'\>;  
}  
Example Profile for the Architecture Phase:

* Required: Constraint Manifest, Intake Summary (Product Spec), Open Loops.  
* Optional: Historical Findings, Human Decisions.  
* Shedding Priority (Drop First): 1\. Human Decisions (from old phases), 2\. Historical Code Artifacts, 3\. Verifier Rationales.  
* Omission Policy: If Intake Summary is too large, it cannot be dropped; it must trigger a sub-agent summarization task (or fail).

### 2\. Precision Token Budgeting (The Allocator)

We must eradicate heuristic math (length \* 100). The compiler must behave like an operating system allocating RAM.

1. Exact Token Counting: Inject a fast tokenizer (e.g., tiktoken equivalent) directly into the pipeline. Every string pulled from the database is immediately token-counted *with its structural formatting overhead included* (e.g., Markdown wrappers).  
2. Budgets as Hard Limits: The state orchestrator passes down a hard maxTokens limit based on the model being used (e.g., Claude 3.5 Sonnet might get a 30k token handoff limit).  
3. Block-Level Allocation: Information is retrieved and encapsulated into ContextChunk objects:  
4. typescript  
5. interface ContextChunk {  
6.    type: ContextBlockType;  
7.    rawContent: string;  
8.    formattedOutput: string;  
9.    exactTokenCount: number;  
10.    provenance: string; *// e.g., "db:verdicts:id-123"*  
11. }

### 3\. The Assembly Pipeline (The New 

### compiler.ts)

The execution flow of the compiler becomes a deterministic, multi-stage pipeline:

* Stage 1: Contract Resolution: Determine the active ContextContract based on the incoming Role and Phase.  
* Stage 2: Required Intake (The Floor): Query the database strictly for the requiredBlocks. Tokenize them. If the sum of required tokens exceeds the maxTokens budget, halt and throw a ContextSufficiencyError. Do not silently drop required data.  
* Stage 3: Optional Intake (The Ceiling): Query optionalBlocks. Tokenize them.  
* Stage 4: Policy-Driven Shedding: Sort the combined collection based on the contract's sheddingPriority. Iteratively apply the omissionPolicy (drop, convert to pointers, or summarize) from the lowest priority upwards until the total token count is ≤ maxTokens.  
* Stage 5: Scaffolding Generation: For any data that was shed, inject a lightweight "Pointer" into the prompt. (e.g., \[Omitted: 15 Historical Verdicts available via Tool: query\_verdicts\]). This provides the "retrieval scaffolding for autonomous follow-up."

### 4\. Measurable Sufficiency & The Audit Manifest

To guarantee transparency, the compiler no longer just returns a string. It returns a Handoff Packet containing the text and a cryptographic-style receipt of its decision-making.  
typescript  
interface HandoffPacket {  
   contextText: string;  
    
   metrics: {  
       totalTokens: number;  
       budgetUtilization: number; *// e.g., 0.95 (95%)*  
   };  
    
   auditManifest: {  
       contractUsed: string; *// The active policy*  
       includedChunks: Array\<{ type: string, provenance: string, tokens: number }\>;  
       omittedChunks: Array\<{ type: string, reason: string }\>; *// What was left behind*  
       scaffoldingInjected: boolean;  
   };  
}  
This manifest is logged to the workflow state. If an AI agent later hallucinates or fails a verification gate, a human engineer (or an oversight agent) can look at the auditManifest and immediately say: *"Ah, the agent failed because the architecture contract was forced to shed the Intake Summary due to budget constraints."*

### 5\. Deterministic, Phase-Aware Caching

The current cache uses role:dialogueId. This causes phase-bleed. The new cache key must uniquely identify the exact state conditions: sha256(Role \+ Phase \+ DialogueId \+ TurnId \+ Hash(ContextContract))  
If you navigate backward, the TurnId changes, bypassing the stale cache. If a new claim is introduced, the TurnId changes. The cache becomes a true memoization of a specific workflow tick, rather than a loose time-bound bucket.

### Summary of the Engineered Solution

By moving to this architecture,   
compiler.ts graduates from a State Bundle Assembler to a Context Handoff Layer. It ensures that:

1. Agents are never starved of required data: They fail loudly if the budget cannot support the contract.  
2. Context is highly tuned: The Architecture phase no longer wastes budget on Execution-phase artifacts.  
3. Agents know what they don't know: Shedding data results in explicit "Pointers," allowing the agent to use tools to fetch it if they decide they need it.  
4. Everything is deeply observable: We replace silent heuristic failures with explicit token accounting and audit logs.

Architecture  
I would redesign it around an explicit handoff contract, not a generic “collect some upstream state” function.

type ContextTarget \= {  
  dialogueId: string;  
  role: Role;  
  majorPhase: Phase;  
  subPhase?: string;  
  intent: string;  
  tokenBudget: number;  
};

type HandoffPolicy \= {  
  id: string;  
  version: number;  
  requiredSections: string\[\];  
  optionalSections: string\[\];  
  preserveOrder: string\[\];  
  sectionBudgets: Record\<string, { min: number; max: number }\>;  
  freshnessRules: Record\<string, "latest" | "phase-boundary" | "current-phase"\>;  
  failOnMissing: string\[\];  
};

The key change is that compiler.ts (line 23\) cannot just take role, dialogueId, and tokenBudget. It needs the actual receiving context target: role, major phase, sub-phase, and invocation intent. The workflow already has the phase model in stateMachine.ts (line 16\) and navigation/sub-phase model in navigationResolver.ts (line 17\); the compiler should consume that directly.

I would also stop treating “history” as string\[\]. Every context item should be typed, provenance-bearing, and independently budgetable:

* INTAKE\_HANDOFF  
* ARCHITECTURE\_HANDOFF  
* HUMAN\_DECISION  
* CLAIM  
* VERDICT  
* OPEN\_LOOP  
* CURATOR\_LESSON  
* ARTIFACT\_POINTER  
* RAW\_EXCERPT

Each item should carry source refs, source timestamps/event ids, rendered text, exact token count, and truncation eligibility.

Pipeline  
I would build the compiler as a deterministic multi-pass system.

1. Resolve target.  
   Load current workflow state and sub-phase from stateMachine.ts and architecturePhase.ts (line 54\), then combine that with the caller’s intent.  
2. Load policy.  
   Use a registry keyed by role \+ phase \+ subPhase \+ intent.  
   Example: ARCHITECTURE / DECOMPOSING / architecture-design.  
3. Materialize candidate sections.  
   Each section is produced by a resolver with deterministic rules.  
   Examples:  
   * Approved intake handoff  
   * Human corrections after intake approval  
   * Domain coverage  
   * Constraints  
   * Architecture validation feedback  
   * Open loops  
   * Prior precedents  
   * Raw excerpts only when policy allows  
4. Prefer handoff artifacts over raw transcript scraping.  
   At each phase boundary, create canonical handoff docs.  
   Examples:  
   * IntakeHandoffDocument  
   * ArchitectureHandoffDocument  
   * VerificationHandoffDocument

These should be written when phases complete, not synthesized ad hoc inside the hot-path compiler. The compiler then uses raw events only as fallback or for citations. That is the biggest step from “aggregation” to true handoff engineering.

5. Budget with exact rendered counts.  
   Render each section in its final prompt form, then call countTokens on that rendered section. Do not use flat estimates like the current compiler.ts (line 890\) and compiler.ts (line 909\).  
6. Apply a policy-aware budget solver.  
   Use hard reservations for required sections, then fill optional sections by policy priority.  
   Truncation should be section-specific:  
   * Long intake analysis: compress to structured summary with citations  
   * Many open loops: keep top severity first  
   * Historical precedents: keep highest relevance first  
   * Human decisions: preserve newest/highest authority first  
   * Raw excerpts: trim within-item before dropping entire section if policy allows  
7. Validate sufficiency before returning.  
   The result should answer: “Is this agent actually well informed for this target?”  
   If required sections are missing, either fail closed or return a degraded result with explicit warnings.  
8. Return a compound result, not just a pack.  
   Return:  
   * rendered context  
   * structured section manifest  
   * diagnostics  
   * retrieval handles/pointers  
   * cache fingerprint

Policy example  
For ARCHITECTURE / DECOMPOSING, I would define:

* Required: approved intake handoff, non-negotiable constraints, domain coverage, human corrections since plan approval  
* Optional: open loops, curator lessons, prior architecture precedents  
* Excluded by default: generic verifier rationale dump unless directly tied to decomposition risk  
* Preserve order: human corrections \> constraints \> approved plan \> domain coverage \> unresolved risks \> precedents  
* Compression rule: raw intake analysis never included wholesale; include structured handoff plus top cited excerpts only

That is how you make it phase-aware instead of globally “historical-first” or “verdict-first.”

Controls  
To make it transparent, auditable, configurable, and performant, I would add four things.

* A context\_policies layer in code with versioned policy ids and unit tests.  
* A context\_compilations audit table storing policy id/version, source refs, omitted sections, token counts, cache fingerprint, and compile latency.  
* State-fingerprint caching instead of TTL-only caching. Cache key should include workflow phase/sub-phase, intent, token budget, policy version, latest relevant event ids, and handoff artifact versions. Never return the cached object by reference.  
* Compiler quality gates:  
  * required-section completeness  
  * rendered-token accuracy  
  * freshness of sources  
  * omission severity  
  * compile latency  
  * stale-cache rate

The KPIs I’d track are:

* required\_section\_completeness  
* rendered\_vs\_estimated\_token\_error  
* degraded\_compile\_rate  
* stale\_cache\_hit\_rate  
* mean\_compile\_ms  
* tokens\_dropped\_by\_section  
* followup\_retrieval\_rate

Practical rollout  
I would do it in this order:

1. Extend the compiler input model to ContextTarget.  
2. Replace TTL cache keys with state fingerprints and deep-copy returns in compiler.ts.  
3. Introduce typed sections/items with exact token counts.  
4. Add policy registry and sufficiency validation.  
5. Generate canonical handoff artifacts at phase transitions.  
6. Remove the current coarse in-compiler truncation and replace it with a section-aware budget solver.  
7. Persist compile manifests for audit/debug.

How might an agent context engineer / context builder / context compiler enable more sophisticated context building?

By treating context as a compiled operating environment, not just a prompt prelude.

In the current shape, compiler.ts mostly assembles upstream state into one pack. A more sophisticated context engineer/compiler would do three bigger things.

Representation

* It would build multiple representations of the same upstream knowledge: canonical handoff summaries, structured facts, deltas since last phase, raw excerpts, and source pointers.  
* It would preserve provenance on every item: where it came from, why it was included, how fresh it is, and what policy selected it.  
* It would compile different “views” of the same dialogue for different kinds of work: planning view, execution view, contradiction-check view, architecture decomposition view.

Procedure

* It would reason about what the receiving agent must know, what would be useful, and what can be deferred.  
* It would detect context gaps and include a retrieval agenda: “if you need more, inspect these event ids, these artifacts, these unresolved loops.”  
* It would support staged expansion rather than one-shot stuffing: primary brief first, supplements on demand, raw excerpts only when needed.  
* It would compile causal lineage, not just content: what was decided, what changed, what was rejected, what remains open, and what downstream consequences follow.

Adaptation

* It would be role/phase/sub-phase aware, so “important context” changes with the target.  
* It would budget by section and fidelity, not by crude item dropping.  
* It would validate sufficiency before returning: is this enough for the agent to begin responsibly, and if not, what is missing?  
* It would learn from outcomes: which sections actually helped, which omissions caused failures, which policies overpacked or underpacked.

The key shift is that the compiler stops being a serializer and becomes a context orchestrator. It does not just answer “what can I include?” It answers:

* what must this agent know to act safely and well  
* what can it retrieve later  
* what should be summarized vs quoted vs omitted  
* what evidence supports the handoff  
* how confident we are that the handoff is sufficient

In practice, that means returning something more like:

* briefing: the main prompt-ready handoff  
* section\_manifest: what was included and why  
* omissions: what was excluded and the risk  
* retrieval\_map: where the agent should look next  
* sufficiency\_assessment: whether the handoff is complete for this target  
* diagnostics: token usage, freshness, policy id, truncation decisions

That is what enables genuinely sophisticated context building: the compiler becomes the system that manages abstraction, relevance, provenance, and retrieval strategy, not just text assembly.

How might an agent context engineer / context builder / context compiler enable more sophisticated context building?

Created

An intelligent Agent Context Engineer (or an active context-building sub-agent layer) radically transforms the system from a passive "data dumper" into an active, semantic sense-making pipeline.

If 

compiler.ts is currently a static file bundler, an Agent Context Engineer acts as a highly skilled Technical Lead preparing a briefing packet for a new hire. It doesn't just hand them every Slack message ever sent; it synthesizes, prioritizes, and annotates.

I have detailed the specific capabilities such an agent would enable in this artifact: advanced\_context\_engineering.md.

Here are the most powerful ways an Agent Context Builder elevates the architecture:

### 1\. Dynamic Abstractive Summarization (Context Compression)

Instead of the current *lossy truncation* (e.g., dropping the last 50 historical findings because we hit the token limit), an Agent Context Builder uses *abstractive compression*. If the Intake phase generated 50,000 tokens of raw dialogue, the Builder doesn't chop off the first 25,000. It spawns a sub-task: *"Distill this Intake transcript into a dense, 2,000-token Product Requirements Document (PRD)."* The downstream Architecture agent receives the dense PRD, guaranteeing it understands the full scope without blowing the context budget.

### 2\. Semantic Relevance Pre-Computation

A static compiler pulls data chronologically or by rigid categories. An Agent Context Builder pulls data *semantically*. If the current phase goal is "Implement Postgres Auth Provider", the Builder uses vector embeddings or graph traversal to pull *only* the constraints, verdicts, and history relevant to Database schemas and Authentication. It deliberately ignores the 10,000 tokens of discussion about CSS styling.

### 3\. Pre-Flight Verification & Conflict Resolution

A major failure mode of a static context dump occurs when the compiled history contains contradictions (e.g., an early constraint says "Use REST", but a later human decision says "Switch to GraphQL"). An LLM receiving both might hallucinate or flip-flop. The Context Builder scans the assembled context *before* handoff. If it spots a conflict, it resolves it or annotates it:

*"\[Context Builder Note: Constraint C-12 (REST) is superseded by Human Decision HD-8 (GraphQL). Obey HD-8.\]"*

### 4\. Lossless Compression via Semantic Pointers

When the Context Builder must compress data to fit the budget, it doesn't just delete it. It leaves "Pointers."

*"\[Omitted: 15 Historical Verdicts regarding the UI Grid design. Available via retrieval tool: query\_verdicts(tags=\[ui, grid\])\]*"

This gives the downstream agent bounded situational awareness. The agent knows what it *doesn't* know, and has the exact tool schema needed to fetch it autonomously if the agent decides that detail is critical mid-execution.

### 5\. Phase-Specific Formatting (Empathy)

Different agents need data structured differently.

* The Verifier needs context framed as strict logical assertions and invariant laws to build test cases.  
* The Executor needs file paths, diffs, and API contracts. The Context Builder translates the raw workflow state into the precise cognitive layout that maximizes the target persona's effectiveness.

### The Architectural Shift

To enable this, the Context Compiler moves from being a synchronous utility file (

compileContextPack()) to an asynchronous, agentic Context Server/Service.

Worker agents no longer query the append-only log directly. They request a briefing packet:  
POST /api/context/build { role: "EXECUTOR", task: "Build Auth Service", maxTokens: 16000 }

The Context Server runs its synthesis, retrieves the semantic dependencies, resolves conflicts, and returns a verified, perfectly budgeted Handoff Packet.

