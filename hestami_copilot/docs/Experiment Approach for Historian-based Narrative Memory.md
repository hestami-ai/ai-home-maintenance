# **Updated Technical Approach: Historian Without Inference-Time RAG**

## **1\. Problem Definition and Failure Modes**

**Context & Challenge:** We aim to implement an AI-assisted software development workflow where multiple Large Language Model (LLM) agents collaborate to build a product according to technical specifications, roadmaps, and engineering guidelines. The key challenge is ensuring that each proposed implementation step strictly adheres to the current specs and rules, without hallucination or drift. In particular, the **Executor agent** will propose actions (designs, code changes, tests, etc.) and a dedicated **Historian agent** will judge each proposal’s consistency against the authoritative knowledge (specs, guidelines, prior decisions). Relying on a context window alone to store all specs or conversation history is infeasible under a single NVIDIA 4090 GPU – the context is limited, and simply increasing context length doesn’t guarantee better reasoning or factual accuracy. A long context can even *reduce* model focus by pushing relevant info far apart in the token sequence. Instead, we require explicit memory and retrieval mechanisms to bring relevant evidence to the model as needed.

**Failure Modes:** Below are specific failure modes observed in naive or ungoverned multi-agent LLM setups, which the Historian role is designed to address:

* **Executor Drift:** The Executor may propose plans that subtly deviate from requirements or assume non-existent features. Over multiple steps, small drifts compound into major spec violations. Without correction, the implementation diverges from intended design.

* **Hallucinated History:** An agent might “remember” a decision or spec detail that never existed (hallucination) or that has been superseded. This leads to false justifications (e.g. citing a guideline that isn’t in the docs) and erodes trust. Persistent conversation alone is insufficient to prevent this, especially when context is truncated or updated specs aren’t fully in memory.

* **Inconsistent Spec Interpretation:** Different agents or runs may interpret ambiguous spec language differently, or the same agent might answer inconsistently across sessions. Without a single source of truth, the system can make conflicting decisions. For example, an Executor might treat a “should” guideline as mandatory in one proposal and optional in another, causing confusion.

* **Brittle Outputs:** Unstructured or free-form outputs from agents can be brittle for downstream consumption. If the Executor’s plan is not in a structured schema, the Historian might mis-parse it. Or if the Historian’s verdict is a long narrative, it may not be machine-checkable. Brittle outputs also include the model sometimes giving irrelevant preambles (“Sure, here’s the JSON…”) instead of the exact schema – a small format error can break an automated pipeline.

* **Non-Auditable Decisions:** Without enforced citations and logging, decisions made by the agents are not traceable. A product decision without a recorded rationale or source is essentially a black box, which is unacceptable in engineering contexts that require accountability (e.g. for safety or compliance review).

* **Stale Guidance:** The knowledge base (specs/guidelines) will evolve (new specs, changed requirements). A single static prompt or frozen model can become outdated quickly. A failure mode is the Executor proposing actions based on an *old* rule that has since changed, or the Historian approving something because it recalls an outdated decision. The system must handle spec supersession to avoid using stale or deprecated guidance.

* **Overconfident or Ungrounded Completions:** LLMs are prone to answer even when unsure. The Executor might propose a design even if the spec is ambiguous, and the Historian might “rubber-stamp” it by filling in logical gaps with assumed facts. Overconfident but wrong answers (sometimes called “confident nonsense”) are dangerous – e.g. the Historian might assert consistency without evidence, or fail to admit “unknown” when specs are silent on an edge-case.

**Why a Dedicated Historian Helps:** Introducing a specialized Historian LLM agent directly mitigates these failure modes:

* The Historian acts as a **single source of truth memory**, cross-checking every proposed action against the official corpus. This centralized memory reduces drift and hallucination by ensuring that *every step* is validated against up-to-date information. Prior work on multi-agent LLM systems highlights that hallucinations from outdated knowledge are a major challenge, and that a shared knowledge base or memory is crucial for maintaining correct and coherent information among agents. The Historian is essentially that shared memory with reasoning capabilities.

* By focusing on **consistency adjudication**, the Historian can be trained to be far more skeptical and evidence-driven than a generalist model. Its sole job is to either find supporting documentation or else raise a flag (inconsistency or unknown). This role separation (planner vs. checker) is akin to having a dedicated QA engineer: it enforces a higher standard of rigor than a single agent trying to do everything.

* The Historian outputs a **strict schema with citations**, making decisions auditable. Because it must either cite authoritative sources or explicitly say it lacks information, we achieve the “cite or refuse” discipline that greatly reduces confident hallucination. In other words, if the Historian can’t find a rule supporting the Executor’s proposal, it will not invent one – it will return *UNKNOWN* or *CONDITIONAL*, prompting further human or agent inquiry.

* The Historian maintains knowledge of **spec versioning and decision history**, addressing stale guidance. It can be imbued with awareness of which specs or decisions are current vs superseded. When the Executor unknowingly relies on an outdated spec, the Historian can catch that by citing the newer guideline that contradicts it, thus preventing the team from following obsolete instructions.

* In summary, a dedicated Historian improves reliability by introducing a robust check-and-balance. It’s effectively an internal **governance layer** for the LLM agents, forcing them to justify and align with a stable knowledge repository rather than whatever happens to be in their prompt context.

## **2\. System Roles and Contracts (Interfaces)**

Our system consists of three primary agent roles and one human product manager, each with well-defined responsibilities and interface schemas. By formalizing their inputs/outputs as JSON messages, we ensure clear contracts between agents and facilitate automated checks (e.g. schema validation, citation verification).

**Roles and Responsibilities:**

* **Executor Agent (Planner):** Given a feature specification or task, the Executor devises an implementation plan. This includes *what* to build or change, *how* to do it, and *in what order*. The Executor should also note any assumptions or prerequisites. It produces an **ActionProposal** message (structured JSON) describing the plan. The Executor is not all-knowing – it relies on the Historian to confirm whether its plan aligns with specs. It may include references to spec sections it considered, but these are just hints (the Historian will independently verify them).

* **Historian Agent (Consistency Adjudicator):** The Historian receives an ActionProposal (plus possibly relevant retrieved spec snippets) and outputs an **AdjudicationResponse** (structured JSON). The Historian’s job is to determine if the proposed action is consistent with all current requirements and guidelines. It must cite specific evidence for any claims – especially if it finds a conflict. If the proposal is fully consistent, the Historian marks it *CONSISTENT* with supporting citations. If it’s in direct violation of something, *INCONSISTENT* with citations of the violated rules. If it’s potentially consistent only under certain conditions or incomplete information, *CONDITIONAL* (including what condition or missing piece needs resolution). If the knowledge base has no information on that aspect, *UNKNOWN*. The Historian essentially serves as the “memory” of past decisions and specs: it will recall if a similar idea was previously rejected or if a new rule supersedes old ones. It is trained to be cautious: better to declare unknown or ask for clarification than to let a mistake pass.

* **Technical Expert Agent (Engineer-in-the-Loop):** The Technical Expert is a role that can be played by a specialized LLM assisting the human. This agent is responsible for exploratory tasks and final decision-making beyond the narrow verification. For example, it can discuss feasibility of a new feature, come up with alternative approaches, or clarify ambiguous specs by consulting stakeholders. Critically, the Technical Expert records **DecisionTraces** – whenever a decision is made (especially trade-offs and “why” rationales), it logs them in the decision ledger. These become part of the Historian’s knowledge. The Technical Expert can override the Historian (with justification) if a business decision dictates deviating from a guideline, but this override itself is captured as a formal decision record (so the Historian will treat it as new guidance going forward). In essence, the Technical Expert is the source of truth for spec changes and novel decisions that aren’t in the original documents.

* **Product Manager (Human Role)**: The Product Manager is a human who provides the initial product and feature requirements who then collaborates with the Technical Expert Agent to create a technical specification for the desired capability / functionality.

Each (agent) role communicates via JSON messages defined by a **schema contract**. Whereas the human Product Manager will communicate in natural language. Below we define the key message types and their fields:

`// Schema: ActionProposal (produced by Executor Agent)`  
`{`  
  `"action_id": "string (unique identifier for this proposed action)",`  
  `"feature": "string (name or ID of the feature/requirement this action addresses)",`  
  `"description": "string (natural language summary of the proposed implementation step)",`  
  `"steps": ["array of strings (if the proposal is broken into sub-steps or sequential plan items)"],`  
  `"preconditions": ["array of strings (any assumptions or preconditions for this action to succeed)"],`  
  `"dependencies": ["array of strings (other features or tasks that this action depends on, if any)"],`  
  `"expected_outcome": "string (the expected result or goal of this action when completed)",`  
  `"risks": ["array of strings (known risks or potential issues with this approach)"],`  
  `"references": [`  
    `{`  
      `"source": "string (source type, e.g. 'spec' or 'guideline')",`  
      `"id": "string (stable identifier of a spec section or guideline referenced)",`  
      `"excerpt": "string (optional short quote from that source, for context)"`  
    `}`  
  `]`  
`}`

* *ActionProposal:* The Executor fills out this JSON with all relevant details of the plan. Notably, `"references"` is an array where the Executor can list spec or guideline IDs it *believes* are relevant (e.g. it might include a spec section that motivated a design choice). These are not considered authoritative by themselves – they serve to help the Historian. The `action_id` ties the proposal to subsequent responses and logs.

`// Schema: AdjudicationResponse (produced by Historian Agent)`  
`{`  
  `"action_id": "string (echoing the ActionProposal's id for traceability)",`  
  `"status": "string (one of: CONSISTENT, INCONSISTENT, CONDITIONAL, UNKNOWN)",`  
  `"evidence": [`  
    `{`  
      `"source": "string (e.g. spec, guideline, decision)",`  
      `"id": "string (stable identifier of the cited source)",`  
      `"excerpt": "string (short quote or summary from that source that is relevant)"`  
    `}`  
  `],`  
  `"conflicts": ["array of strings (descriptions of any conflicts or inconsistencies found)"],`  
  `"conditions": ["array of strings (if status=CONDITIONAL, what conditions or additional info is needed for consistency)"],`  
  `"verification_queries": ["array of strings (questions or checks the Historian suggests to resolve UNKNOWNs or clarify ambiguous points)"],`  
  `"comments": "string (optional additional commentary or analysis by Historian, e.g. alternative suggestions or context; this is free text but should remain objective and evidence-driven)"`  
`}`

* *AdjudicationResponse:* The Historian’s output. The **`status`** field is the verdict:

  * **CONSISTENT** means the action does not violate any known rule and fits the specs, given the evidence.

  * **INCONSISTENT** means the action *conflicts* with one or more requirements or guidelines; the `conflicts` array should describe each conflict clearly, and `evidence` must cite the rules being violated.

  * **CONDITIONAL** means the action might be acceptable *only if* certain conditions hold or changes are made. For example, “Conditional: acceptable if module X also implements encryption as per spec Y.” These conditions are listed in `conditions`, and evidence might include references to the rules causing the conditional acceptance. (This status is used instead of outright Inconsistent when the conflict can be resolved or the spec leaves wiggle room.)

  * **UNKNOWN** means the Historian cannot find relevant info in the knowledge base to judge the proposal. It neither confirms nor denies the validity. In this case, `verification_queries` should list what further information is needed – e.g. “Is there a performance guideline for mobile devices? (specs are silent, might need human input)”. An UNKNOWN may also arise if the spec is ambiguous or missing in that area.

* The **`evidence`** list contains the authoritative snippets backing the verdict. Each evidence item has a stable `id` (see *SpecCitation* below for format) and an `excerpt` (a short quote or summary from that source). The Historian is trained to *cite or refrain* – i.e. every assertion about the spec must be linked to evidence, or else the model should explicitly refrain from making that assertion. The `conflicts` array is specifically for explanations of inconsistency: e.g. “Proposed API returns plaintext password, but **security-guidelines §4.1** requires hashing passwords (see evidence).” The `conditions` array is only populated for CONDITIONAL status to note what is required to make it consistent. The `verification_queries` are essentially follow-up actions that the Historian proposes, usually when UNKNOWN or CONDITIONAL – these might be questions for a human or a search query for missing specs.

`// Schema: ActionReport (feedback from Executor or system after executing an action)`  
`{`  
  `"action_id": "string (the ID of the action that was executed)",`  
  `"status": "string (result of execution: e.g. COMPLETED, FAILED, PARTIAL)",`  
  `"artifacts": ["array of strings (pointers to code commits, test results, or documents produced)"],`  
  `"outcome": "string (brief summary of what happened during execution, e.g. 'Feature deployed successfully' or error description)",`  
  `"decision_trace_refs": ["array of string (IDs of any DecisionTrace records created as a result of this action)"]`  
`}`

* *ActionReport:* After an action is implemented (either by an automated agent or a human developer), the Executor or system can generate an ActionReport. This is essentially feedback into the loop, telling the other agents what happened. For example, if the Executor’s plan was carried out and tests failed due to a requirement, that might be noted here. The Historian could use this in the future to know that a certain approach was tried and had issues. The ActionReport also can link to any new decisions made (for example, a human might decide to roll back the change – which would be a DecisionTrace).

`// Schema: DecisionTrace (recorded by Technical Expert or system for significant decisions)`  
`{`  
  `"decision_id": "string (unique ID for this decision event)",`  
  `"timestamp": "string (ISO datetime of when decision made)",`  
  `"actors": ["array of strings (who was involved: e.g. 'TechExpert', 'ArchitectReviewBoard')"],`  
  `"summary": "string (short description of the decision made)",`  
  `"details": "string (longer rationale or discussion of why the decision was made)",`  
  `"references": [`  
    `{`  
      `"source": "string (e.g. spec or prior decision or external info that influenced this decision)",`  
      `"id": "string (ID of that reference)",`  
      `"excerpt": "string (optional quote from that reference)"`  
    `}`  
  `],`  
  `"supersedes": "string or null (decision_id of an earlier decision that this one supersedes, if any)",`  
  `"status": "string (e.g. ACTIVE, SUPERSEDED, REJECTED – indicating if this decision is current or later overridden)",`  
  `"related_action": "string or null (action_id if this decision is linked to a specific ActionProposal outcome)"`  
`}`

* *DecisionTrace:* This schema captures the addition of new knowledge into the system – typically by a human or by consensus of the team. For example, the team might decide “We will deviate from guideline G1 for this feature because of X reason.” That becomes a DecisionTrace entry with a unique `decision_id` and a rationale in `details`. The `supersedes` field is critical: if this decision overrides a previous decision or spec directive, we link to that. Over time, this chain of supersession lets the Historian determine what the current truth is. Each decision can cite references (maybe it references an external standard or a customer requirement that motivated the change). The `status` allows marking a decision as superseded if another decision later reverses it. The Historian will consider only ACTIVE decisions as binding (but may still mention superseded ones for context or if someone tries to rely on an old decision, it can point out it’s no longer valid).

`// Schema: SpecCitation (how we reference a specific location in spec/guideline documents)`  
`{`  
  `"doc_id": "string (identifier for the document, e.g. 'SPEC-ARCH-v3' or 'GUIDELINE_SECURITY')",`  
  `"sec_id": "string (section identifier within the doc, if applicable, e.g. '4.1.2' or a heading slug)",`  
  `"stable_id": "string (concatenation of doc and section or an assigned unique ID)",`  
  `"text": "string (the exact text or a concise summary of that section/clause)"`  
`}`

* *SpecCitation:* This is not a message exchanged between agents, but a data format for referencing specific portions of source documents. In our system, each spec or guideline will be ingested and assigned stable identifiers for its sections or requirement statements. For example, if we have a document “SecurityGuidelines.md” and it has a section titled “4.1 Password Policies”, we might assign it `GUIDELINE_SECURITY#4.1` as the stable ID. If stable section numbers exist in the docs (many do), we use them; where not, we may generate an ID (for instance, based on a heading text or a hash). The Historian’s `evidence` field will use these IDs. E.g., `"source": "spec", "id": "SPEC-API-v2#3.2"` might refer to section 3.2 of the API spec, which might be "All API requests must be authenticated". By citing this ID, we ensure anyone can unambiguously find the source text. If documents lack any structure, we will create a scheme (like numbering each paragraph or requirement and mapping it in an index). Each SpecCitation also includes the actual text or a summary for readability, but the stable ID is the key for traceability.

**Evidence & Citation Mechanism:** Citations in this system refer to stable IDs rather than ephemeral context. This means even if the Historian doesn’t include the full text of a spec section in its output, the ID is enough to look it up. We will maintain a mapping of IDs to document content (in a vector store or database). During adjudication, the Historian will have access to the text of relevant sections (retrieved via vector or keyword search), and it will include the pertinent parts in `evidence.excerpt` along with the ID. For example, an evidence entry might be:

`{`  
  `"source": "spec",`  
  `"id": "SPEC-UI-v1#Section-5.4",`  
  `"excerpt": "Section 5.4: The application **must** lock out a user after 5 failed login attempts."`  
`}`

This tells us exactly which spec and section is being cited, and the excerpt shows the rule. These citations serve as “grounding” for the Historian’s assertions – the agent is trained never to claim something is required or allowed unless it can point to such an excerpt (or to a DecisionTrace entry). If it cannot find any, it will say `UNKNOWN`. This cite-or-abstain behavior is crucial for trust. In cases where specs have no stable numbering, we will simulate one (e.g. assign incremental IDs or anchor tags in the markdown). The key is that once an ID is assigned to a particular statement or section, it does not change even if documents are updated (we might version them or mark superseded). If a section is removed in a new version, the Historian might then cite the new source that replaces it (and possibly note the old ID as superseded).

**Interface Summary:** All communication between agents is via these structured JSON payloads (transferred perhaps as strings in a message). This ensures machine-readability and robust chaining. We will implement JSON schema validation at runtime for each message to catch any deviation (e.g. the Historian accidentally returning a non-JSON answer will be caught and corrected).

**Example JSON Artifacts:**

To illustrate, here are three example instances for each artifact type:

* *Example ActionProposal:* (Executor proposes adding a new login feature)

`{`  
  `"action_id": "AP-001",`  
  `"feature": "User Login",`  
  `"description": "Implement a user login feature using username/password. Will create a new login page and authenticate against the user DB.",`  
  `"steps": [`  
    `"Create a login page with form for username and password.",`  
    `"On submission, verify credentials against the existing user database.",`  
    `"Implement session management to keep users logged in."`  
  `],`  
  `"preconditions": [`  
    `"User database exists with hashed passwords",`  
    `"Password policy is defined for account creation"`  
  `],`  
  `"dependencies": [`  
    `"Database module for user accounts",`  
    `"Existing UI framework components"`  
  `],`  
  `"expected_outcome": "Users can log into the application with their credentials and maintain an authenticated session.",`  
  `"risks": [`  
    `"Security: Need to ensure passwords are handled according to security guidelines.",`  
    `"UX: Ensure login page matches the overall style."`  
  `],`  
  `"references": [`  
    `{ "source": "spec", "id": "SPEC-SECURITY#5.1", "excerpt": "5.1 Passwords must be stored using bcrypt hashing." },`  
    `{ "source": "guideline", "id": "GUIDELINE_UI#2.3", "excerpt": "2.3 Reuse existing UI components for consistency." }`  
  `]`  
`}`

*(In this example, the Executor believes the security spec section 5.1 and a UI guideline 2.3 are relevant. It’s basically saying: I plan to handle passwords securely as per spec, and use standard UI components as per guideline.)*

* *Example AdjudicationResponse:* (Historian checks AP-001 for consistency)

`{`  
  `"action_id": "AP-001",`  
  `"status": "CONDITIONAL",`  
  `"evidence": [`  
    `{`  
      `"source": "spec",`  
      `"id": "SPEC-SECURITY#5.1",`  
      `"excerpt": "Section 5.1: Passwords must be stored using bcrypt hashing."`  
    `},`  
    `{`  
      `"source": "spec",`  
      `"id": "SPEC-SECURITY#5.4",`  
      `"excerpt": "Section 5.4: After 5 failed login attempts, the account must be locked for 15 minutes."`  
    `}`  
  `],`  
  `"conflicts": [],`  
  `"conditions": [`  
    `"Implement account lockout after multiple failed attempts to comply with Security Spec 5.4."`  
  `],`  
  `"verification_queries": [],`  
  `"comments": "The proposal is generally consistent with security requirements (e.g., password hashing as per spec). However, spec 5.4 introduces a requirement not mentioned in the plan (account lockout policy). If the implementation includes that (or it's already handled elsewhere), then the plan is fully consistent. Otherwise, it should be added as a condition."`  
`}`

Here, the Historian marked it CONDITIONAL. It found spec security 5.1 which supports the plan (and was already referenced by Executor), but it also retrieved spec 5.4 about account lockout that the Executor didn’t mention. It doesn’t call this a direct conflict (the plan isn’t explicitly violating it; it just omitted it), so it’s “conditional”: the plan *will be consistent if* they also implement account lockout. The evidence cites 5.1 and 5.4 sections of the Security spec. No `conflicts` listed (because nothing in the plan violates a must-not). The `conditions` array points out the needed addition. In comments, the Historian provides a bit of explanation. (If the Executor had explicitly said “we won’t lock accounts”, that would be an *INCONSISTENT* with a conflict.)

* *Example DecisionTrace:* (Technical Expert logs a decision about an exception to a guideline)

`{`  
  `"decision_id": "DT-2025-04-15-1",`  
  `"timestamp": "2025-04-15T10:45:00Z",`  
  `"actors": ["TechExpert", "ProductManager"],`  
  `"summary": "Approved use of 6-character passwords for internal tool despite 8-char policy.",`  
  `"details": "For the internal admin tool, we decided to allow 6-character minimum passwords due to usability concerns for admins using secure devices. This is an exception to the standard password policy (8-character minimum) because the risk is low in the internal environment and administrators requested shorter passwords for convenience.",`  
  `"references": [`  
    `{`  
      `"source": "spec",`  
      `"id": "SPEC-SECURITY#5.2",`  
      `"excerpt": "Section 5.2: Passwords must be at least 8 characters long."`  
    `},`  
    `{`  
      `"source": "discussion",`  
      `"id": "MEETING-2025-04-10",`  
      `"excerpt": "Team meeting on 2025-04-10: discussed internal tool password complexity."`  
    `}`  
  `],`  
  `"supersedes": null,`  
  `"status": "ACTIVE",`  
  `"related_action": null`  
`}`

In this DecisionTrace, a human (TechExpert) and Product Manager made a decision to allow a deviation from the security spec’s password length rule for an internal tool. They cite the original rule (spec 5.2 requiring 8 chars) to highlight what they’re overriding. `supersedes` is null (they’re not overriding a prior decision, just an existing spec implicitly – in the future, we might model spec rules as decisions too, but here we’ll just note the reference). `status` is ACTIVE, meaning this exception is now in force. The Historian would incorporate this such that if the Executor later proposes something for the internal tool with 6-char passwords, it would *not* flag it inconsistent because there’s an active decision allowing it (but it might mark it as a special-case scenario). Conversely, if someone proposes 6-char passwords for the public user-facing feature, that remains inconsistent because this decision was scoped to internal tool only (the scope could be inferred from context or an extended field we might add for scope).

These examples demonstrate how the schemas capture the necessary information in structured form, enabling each agent to perform its function while maintaining traceability.

## **5\. Training Data Generation Strategy**

To train our Historian LLM to perform its duties (schema-compliant responses, evidence citation, conflict detection, etc.), we need a specialized dataset. We will largely generate this dataset from existing artifacts: the \~40 spec documents, the engineering guidelines, and any decision traces or design discussions available. The strategy involves **automated and semi-automated annotation** to produce high-quality question/answer pairs or conversation turns that simulate the Historian’s task. We will also create *adversarial examples* to teach the model to abstain (output UNKNOWN) or to detect contradictions.

Here’s the plan for creating training and evaluation data:

**Data Source Ingestion:** First, we parse each spec and roadmap. Identify all normative statements:

* Normative statements usually contain keywords like *“must”, “shall”, “should not”, “required”, “forbidden”*. We can write a simple script to extract sentences containing these. For example: *“The system **shall** encrypt all user data at rest.”*

* Each such statement is labeled with its stable ID (doc and section).

* We also parse any existing guidelines document (which might be written similarly).

* Additionally, parse decision logs if they exist (though initially, we may not have many – perhaps we simulate some based on known changes in specs).

**Annotation pipeline:**

1. **Chunk Specs into Q\&A items:** For each normative statement or requirement, create at least one QA example where that statement is relevant.

   * For example, if spec says *“Feature A must do X”*, we can create a hypothetical ActionProposal that omits X or does \~X. Then the expected Historian response is INCONSISTENT citing that requirement.

   * Also create one where the proposal does X correctly, and expected response is CONSISTENT citing the same requirement.

   * In effect, for each rule, we get a pair: one violating, one compliant.

   * We vary phrasing: e.g., ActionProposal might not quote the spec verbatim. It might describe a plan that implicitly violates. This teaches the model to catch implied conflicts, not just identical text.

   * For each, we produce the *input* (which would include an ActionProposal text and possibly the system prompt instructing the Historian) and the *output* (the ideal AdjudicationResponse JSON).

   * These initial examples ensure coverage of all individual rules.

2. **Extract invariants and constraints:** Beyond explicit “must” statements, some specs have implicit constraints (like performance targets, compatibility requirements). We identify these too and generate examples. E.g., if a roadmap says *“Phase 1 is delivered before Phase 2”*, we create an example where an ActionProposal tries to do Phase 2 first \=\> Historian should flag sequencing inconsistency.

   * Another: coding standards, e.g., “All user-facing strings must be internationalized.” Create an example where plan hardcodes strings \-\> flag it.

3. **Stable citations assignment:** For each example we generate, ensure that in the expected output, the citations use the stable IDs we have for those spec sections. We essentially create a mapping in the prompt or in the data so that the model learns to cite exactly “SPEC-XYZ\#Section” rather than just saying “spec says...”. We might include a short context in the prompt like a footnote listing relevant IDs. Alternatively, we can rely on retrieval in actual inference. But in training examples, we might have to simulate the retrieval output explicitly.

   * One approach: include an intermediate step in the training data where the model is given an “evidence” context (like we do in inference). However, since we’re fine-tuning, we can also simply prompt the model to produce the evidence citation if it “knows” it (from the spec text we gave).

   * Possibly simplest: formulate training as a sort of closed-book QA with the model having the relevant snippet in context for the example. That way it can copy the snippet to evidence.

4. **Evidence removal for UNKNOWN:** We intentionally generate examples where a question is unanswerable by provided evidence. For instance, create an ActionProposal about a topic not covered in any spec. Then the expected correct Historian output is `UNKNOWN` with maybe a verification question.

   * Implementation: We can take a real spec requirement, remove it from the knowledge base in a hypothetical scenario, and ask the model about it. If the model was not fine-tuned, it might hallucinate an answer. We train it that the correct action is to say “UNKNOWN.”

   * Concretely: suppose a spec originally had requirement R. Create a variant knowledge base (just for data generation) without R. Ask “Is this plan consistent?” when the plan’s consistency depends on R. Since R is absent in KB, the correct answer is unknown. This teaches the model to not answer if it hasn't retrieved supporting evidence.

   * We can automate this by picking some rules and pretending they’re not in the input context for that training sample. The label is then UNKNOWN.

   * These pairs are akin to SQuAD 2.0 style QAs where some questions have no answer in the context, and the model must learn to output a no-answer response. In our case, "no-answer" equates to the UNKNOWN adjudication (similar to “NOTENOUGHINFO” in FEVER).

5. **Contradiction and conditional cases:** We create scenarios with contradictory evidence or partial info:

   * *Contradiction within knowledge:* e.g., the spec says two things that seem conflicting, or a spec vs a guideline conflict. We simulate by taking two rules that conflict (maybe from different docs) and an ActionProposal that inherently cannot satisfy both. The expected Historian output might be CONDITIONAL or INCONSISTENT with a note. For example: Spec says “Use library X”, guideline says “Library X is deprecated, avoid using it.” If the plan uses X, the Historian should ideally catch this conflict. Perhaps label could be INCONSISTENT with conflict citing both sources, or CONDITIONAL if there’s an acceptable conditional (like “allowed only if no alt available”).

   * *CONDITIONAL cases:* We want to explicitly train the nuance of conditional acceptance. Identify rules that use words like “if” or “unless”. For example, “You can do Y, but only if Z is also done.” Then create a plan that does Y without Z. The correct output is CONDITIONAL with condition "must do Z too". And a plan that does both Y and Z gets CONSISTENT.

   * This teaches the model to handle partial compliance by using the conditions field.

   * Also, cases where spec says “if environment \= prod, do A, else B.” Train the model to respond conditional/unknown if environment not specified in proposal, maybe prompt for clarification.

6. **Supersession (old vs new spec) cases:** Use known version changes:

   * If we have actual versioned specs, use them. E.g., Spec v1 allowed something, v2 forbids it. Create an example where the plan follows v1 but v2 exists. Expected output: Historian cites v2, marks inconsistent (as we did in scenario 5).

   * If we don’t have real versions, simulate: pick a rule, create an imaginary “decision” that changed it. Then treat the original as outdated. For training, we might include the decision text as context as well.

   * This ensures the model learns to prioritize newer rules. It may learn pattern like "supersedes" keyword in decisions or difference in version numbers.

   * Format example: Input could provide both an old spec excerpt and a newer decision in context and see if model appropriately uses the newer one.

7. **Decision trace integration:** We incorporate decision traces:

   * Some decisions might say “We will not implement Feature Q from spec for now.” If a plan tries to implement Q, model should say inconsistent (since a decision put it on hold).

   * Conversely, if a decision added a new requirement not in spec, plan must follow it.

   * We generate pairs where knowledge includes a DecisionTrace that overrides a spec rule. Test if model cites the decision or the original spec accordingly.

   * Also ensure decisions have *trust tiers* in training: e.g., show that if decision says "do X differently," the model should not blindly side with spec. The correct answer should use the decision as authority to either mark conditional or consistent with note of that decision overriding the general rule.

8. **Trust tier annotation:** In training prompts, we might subtly indicate source authority (though in deployment we do this outside the model, it might help to train if the model can infer trust).

   * Possibly by how we phrase evidence. For example, evidence text from a spec might include “\[Spec Version 2, Official\]” tag, and a decision maybe “\[Decision, approved by CTO\]” in the snippet.

   * The model can learn from context that “approved by CTO” decisions are conclusive. We have to be careful not to overfit to specific phrasing, but some meta-cues could help.

   * Alternatively, we incorporate in the system prompt guidelines like “If a decision by authority supersedes the spec, consider the decision as current truth.” That might be enough if the model can parse the content of DecisionTrace (like reading "supersedes: ..." field).

9. **Balanced and diverse dataset:** We ensure the dataset has a good mix:

   * Many more examples of consistency checks with evidence (so the model gets good at citing and formatting).

   * A substantial number of negative examples (inconsistencies) so it learns to spot issues.

   * A number of unknown cases so it’s not lured into always outputting one of consistent/inconsistent (some tasks should explicitly require unknown).

   * The distribution of labels might be, say, 40% consistent, 30% inconsistent, 20% unknown, 10% conditional in training, to cover all – though actual usage might skew, we want to ensure it doesn’t ignore the rarer outputs.

   * Possibly some multi-turn dialogues if we want to fine-tune it as a chat model, but since output is one-shot JSON, we can treat each example independently.

10. **Example templates (at least 5):**

Let’s craft five example training items in an instruct style, showing input content and expected output:

**Example 1: Straight consistency**

* *Spec context:* “Spec1 §2.1: API requests must be authenticated.”

* *Input (to Historian):* An ActionProposal that says: *“Action: Build a new API endpoint /data. This endpoint will require a valid user token for access (using existing auth middleware). ...”* (plus other details).

* *Model should output:* CONSISTENT, evidence citing "Spec1 §2.1 API must be authenticated". Possibly a comment "The plan includes auth as required."

*Training input structure:* Could be something like:

 `[System]: You are the Historian... (some instructions)`

`[User]: (Provides ActionProposal JSON or description, maybe along with relevant spec snippet "Spec1 2.1: ...").`

`[Assistant]: (AdjudicationResponse JSON).`

*  Since we might fine-tune in a supervised manner, we can actually provide the relevant spec as part of input so the model has something to cite explicitly.  
   Or we include it as part of the system prompt. For training demonstration, we can embed it in the prompt: e.g., "Spec Excerpt: Spec1\#2.1 '...must be authenticated'".

* *Expected output:* as described.

**Example 2: Inconsistency with direct violation**

* *Spec:* “Guideline G5: All user-facing text must be in English and Spanish.”

* *Input:* ActionProposal says: *“We will add hardcoded English text for the UI prompts, no internationalization.”*

* *Output:* INCONSISTENT, evidence citing G5, conflict "UI not in Spanish". Possibly a verification query "Is Spanish support planned separately?" (optional).

* This trains catching guideline enforcement.

**Example 3: Unknown scenario**

* *No spec covers it:* ActionProposal: *“We plan to use quantum database for storage.”* (Assume no doc mentions "quantum database").

* *Output:* UNKNOWN, verification query like "Is there an approval for using QuantumDB? Not found in guidelines." Possibly status UNKNOWN, evidence might be empty or something like referencing that no entry was found.

* We explicitly have no evidence except maybe a statement like "no relevant policy found". But better the model just doesn't cite anything and just says unknown. We'll train it to include maybe a placeholder like evidence: \[\] or omit evidence if unknown. Actually, schema expects evidence list always. Perhaps we allow evidence empty or with a note "None found".

* But more clean: evidence could contain an entry: {source: "search", id: "N/A", excerpt: "No relevant specification found regarding database choice."}. Or we instruct model that for UNKNOWN it can leave evidence empty or say "No relevant source."

We'll define in schema that evidence can be empty for unknown – which we did in AdjudicationResponse (it doesn’t say evidence is required; but likely we do want it ideally to say "no evidence because unknown").

Anyway, training data should reflect how we want unknown responses formatted.

**Example 4: Conditional scenario**

* *Spec:* “Spec2 §10: Feature Z is optional. If implemented, it must handle 1000 users.”

* *Input:* ActionProposal says: *“We decided not to implement Feature Z now.”*

* *Interpretation:* According to spec, it’s optional, so skipping it is allowed. That should be consistent. But if plan was to implement Z but didn’t mention the load requirement, that’s a conditional.

  * Actually, better example: "Plan: Implement Feature Z for 500 users." (less than spec requirement of 1000).

  * Output: CONDITIONAL – not inherently inconsistent to implement for 500, but to be fully compliant, need to plan for 1000\. So "Conditional: only consistent if user limit is raised to 1000 or spec requirement changed." Evidence citing spec 1000 user requirement.

* Or a conditional example where two conditions: "We'll do X but only if Y later" and spec requires Y concurrently. Could do but keep it simple.

**Example 5: Supersession example**

* *Old vs New:* Suppose an earlier training spec: “Spec3 v1 §5: use Algorithm A for encryption.” and a Decision says "We now use Algorithm B instead of A."

* *Input:* ActionProposal: "We'll use Algorithm A as per spec."

* *Output:* INCONSISTENT (or maybe CONDITIONAL) because the decision has changed that. The model should cite the decision (and possibly mention the old spec is outdated).

* This trains the model to incorporate decision overrides. Possibly we provide both old and decision in input context and expect it to choose the decision as authoritative.

Each such example in the dataset will have the input (which likely includes some relevant snippets as context) and the correct output JSON. We will generate many such examples by script and some manual curation.

**Automation level:** Many of these can be auto-generated:

* Normative rules → create consistent/inconsistent pairs (script can fill templates).

* We should manually verify a subset to ensure quality, and maybe manually craft some corner cases (like truly ambiguous ones, or multi-rule conflicts).

* The advantage of synthetic generation is volume and coverage; disadvantage is possible unnatural language. We mitigate by sometimes paraphrasing the spec text for the ActionProposal. We can even use an LLM to assist: e.g., ask ChatGPT or the base model to create a scenario that violates a given requirement in a subtle way.

* We will keep some real examples (if any historically known issues in the project) as test cases.

**Preventing poison/noise:** One risk: using the model (Qwen) to generate training data can introduce its own biases or errors if not checked. We prefer to generate via deterministic or human-reviewed means to avoid reinforcing hallucinations. For example, if the model were to generate a fake spec reference, we’d be in trouble. So we'll rely on the actual spec content to drive generation.

**Trust tiers in training:** ensure in examples that when spec and decision conflict, model picks decision; when narrative summary says something opposite to spec, the model chooses spec. Possibly include an example where the only evidence is a summary doc that contradicts spec, and correct output is to trust spec and maybe mark summary as not authoritative (which could be an "UNKNOWN" or a comment that conflict exists and spec prevails).

* E.g., "Team Summary note: 'We might skip Feature Q' but official spec says Feature Q is required." The model should say INCONSISTENT if plan says skip Q, citing spec as authority.

**Integration of Technical Expert Q\&A:** If we have transcripts or logs from the Tech Expert discussing a design, we can use those to fine-tune the style or content. For instance, if a Tech Expert often asks "why" and the Historian responds with references, we might simulate a multi-turn conversation for training to encourage cooperative behavior. However, given our focus is primarily the one-shot adjudication, we might not need multi-turn in fine-tuning; we can rely on simple Q-\>A format.

**Summaries vs truth:** We must avoid accidentally training the model on our own summary or narrative as if it were ground truth. For example, if we feed the model an "episode summary" that contains some derived info, we need to label it or ensure the model is asked to verify it. Perhaps include a training example: "Summary doc says X, but spec says Y, what does Historian do?" expected: it notes conflict and trusts spec. This can be done by including both pieces in context and expecting output that cites spec and maybe calls out summary as wrong. This way, the model learns not to trust everything provided equally – a tricky nuance, but at least we can demonstrate via few examples.

**Data Volume and Quality:** Ideally, we might end up with, say:

* \~200-300 training instances (if each spec yields \~5 examples for musts, etc., 40\*5=200).

* plus additional \~50 trickier ones (unknowns, contradictions, etc).

* So maybe \~250 training examples for fine-tuning. We also might create a smaller dev/test set manually to evaluate (the benchmark from section 7).

* These numbers are modest, but our fine-tune is relatively narrow domain – it's an SFT to teach formatting and knowledge usage. The model already has base knowledge of language and some reasoning, so hopefully a few hundred examples suffice to specialize it.

**Example Training Item (format):** We'll provide at least 5 in the report here:

Let's illustrate them as if they were an exchange or a JSON input for supervised training:

**Training Example 1 (Inconsistent case):**

 *Input:* (We show as a pseudo-conversation for clarity)

 `System: You are a Historian AI that checks proposals against specs and guidelines. Respond in JSON only.`

`User:` 

`ActionProposal:`

  `feature: "Login Rate Limit"`

  `description: "Implement login attempt rate limiting. Will allow 10 failed attempts before lockout."`

  `references: []`

`(Spec context: SecuritySpec#5.4: "After 5 failed login attempts, the account must be locked for 15 minutes.")`

`Assistant: (expected AdjudicationResponse)`

 *Output:*

 `{`

  `"action_id": null,`

  `"status": "INCONSISTENT",`

  `"evidence": [`

    `{`

      `"source": "spec",`

      `"id": "SPEC-SECURITY#5.4",`

      `"excerpt": "After 5 failed login attempts, the account must be locked for 15 minutes."`

    `}`

  `],`

  `"conflicts": ["Plan allows 10 failed attempts which violates SecuritySpec section 5.4 (max 5 attempts)."],`

  `"conditions": [],`

  `"verification_queries": [],`

  `"comments": ""`

`}`

*  (This teaches that 10 vs required 5 is a conflict, citing spec.)

**Training Example 2 (Consistent case):**

 *Input:*

 `User:` 

`ActionProposal:`

  `feature: "Password Storage"`

  `description: "Store user passwords using bcrypt hashing with salt."`

  `references: []`

`(Spec context: SecuritySpec#5.1: "Passwords must be stored using bcrypt hashing.")`

 *Output:*

 `{`

  `"action_id": null,`

  `"status": "CONSISTENT",`

  `"evidence": [`

    `{`

      `"source": "spec",`

      `"id": "SPEC-SECURITY#5.1",`

      `"excerpt": "Passwords must be stored using bcrypt hashing."`

    `}`

  `],`

  `"conflicts": [],`

  `"conditions": [],`

  `"verification_queries": [],`

  `"comments": "The plan uses bcrypt for password storage, which meets the security requirement."`

`}`

* 

**Training Example 3 (Unknown case):**

 *Input:*

 `User:`

`ActionProposal:`

  `feature: "Database Selection"`

  `description: "Use QuantumDB for data storage."`

  `references: []`

`(No spec or guideline about database choice in context)`

 *Output:*

 `{`

  `"action_id": null,`

  `"status": "UNKNOWN",`

  `"evidence": [],`

  `"conflicts": [],`

  `"conditions": [],`

  `"verification_queries": ["Is 'QuantumDB' an approved database technology? (No reference found in guidelines)"],`

  `"comments": "No guideline or spec covers the choice of this database."`

`}`

*  (This shows the model not citing anything and asking a verification query.)

**Training Example 4 (Conditional case):**

 *Input:*

 `User:`

`ActionProposal:`

  `feature: "Feature Z Implementation"`

  `description: "Implement Feature Z handling up to 500 concurrent users."`

  `references: []`

`(Spec context: PerformanceSpec#3.2: "Feature Z must support 1000 concurrent users if implemented.")`

 *Output:*

 `{`

  `"action_id": null,`

  `"status": "CONDITIONAL",`

  `"evidence": [`

    `{`

      `"source": "spec",`

      `"id": "SPEC-PERFORMANCE#3.2",`

      `"excerpt": "Feature Z must support 1000 concurrent users if implemented."`

    `}`

  `],`

  `"conflicts": [],`

  `"conditions": ["Increase capacity to 1000 users to meet PerformanceSpec section 3.2 requirement."],`

  `"verification_queries": [],`

  `"comments": "Currently planning for 500 users; spec requires 1000 for full compliance."`

`}`

* 

**Training Example 5 (Supersession case):**

 *Input:*

 `User:`

`ActionProposal:`

  `feature: "Encryption Algorithm"`

  `description: "Use Algorithm A for encryption of data."`

  `references: []`

`(Spec context: CryptoSpec v1 #2: "Use Algorithm A for encryption.";`

 `DecisionTrace: DT-2025-01 "Decided to use Algorithm B instead of A going forward (supersedes CryptoSpec v1 §2).")`

 *Output:*

 `{`

  `"action_id": null,`

  `"status": "INCONSISTENT",`

  `"evidence": [`

    `{`

      `"source": "decision",`

      `"id": "DT-2025-01",`

      `"excerpt": "Decision DT-2025-01: Use Algorithm B instead of A for encryption (overrides previous spec)."`

    `}`

  `],`

  `"conflicts": ["Plan proposes Algorithm A, but a decision has updated the standard to Algorithm B."],`

  `"conditions": [],`

  `"verification_queries": [],`

  `"comments": "The official guidance changed after Spec v1; Algorithm A is no longer approved."`

`}`

* 

These examples demonstrate the structure of training data we’ll create. The input will usually consist of an ActionProposal (and possibly relevant context in parentheses as shown, or that context could be part of a system prompt in an actual training JSON). The output is the expected JSON from the Historian. We will refine the formatting and ensure the model is trained on exactly the style we want in deployment.

**Annotation Tools:** We can create a small script or use Jupyter to generate these examples. Possibly feed spec docs through a script to output JSON lines with prompt and completion. We should manually review and tweak many of them, especially the tricky ones. If available, involve domain experts (the team who wrote the specs) to ensure the interpretations are correct.

**Avoiding Overfitting to Corpus Phrasing:** One challenge: we are training on the actual spec content. There's a chance the model might memorize some spec lines. But since it's a closed domain, that might be okay – we *want* it to know key rules. However, we should be cautious that the fine-tuning doesn’t just teach the model the entire spec by heart (which would reduce its need to retrieve and could cause it to hallucinate citations). We’ll mitigate by:

* Not giving it the entirety of spec text at once, only pieces in context relevant to a query. It learns to use evidence when provided, not to recall everything from parameters.

* Keep some hold-out scenarios for eval (the model shouldn’t see all combinations).

* If some parts of specs are withheld from training and only present in retrieval at runtime, we test if the model can handle that – this ensures it truly uses retrieval and can say unknown if it wasn’t in training.

**Trust and "Poison"**: If an early DecisionTrace was just a model’s suggestion not validated by a human (kind of a "speculative note"), we might label it differently or exclude it from training. Or include it only to train the model that such speculative notes are not authoritative. For example, maybe mark them as status "DRAFT" in decision, and train model to treat DRAFT decisions as lower trust (maybe by always pairing a draft with a contradictory official stance to see what it does). But this may be too subtle; likely we just won't have drafts in the corpus unless deliberately.

Finally, once this dataset is prepared, we will use it for **Supervised Fine-Tuning (SFT)** with QLoRA (discussed next). We’ll also create a subset as a **custom evaluation set** (the micro-benchmark in section 7\) to measure performance improvements.

## **6\. Post-Training Approach Feasible on 1× RTX 4090**

We will fine-tune and adapt the baseline model (Qwen-3 family) in stages to incrementally achieve the Historian’s performance goals, all within the limits of a single NVIDIA RTX 4090 (24GB VRAM). The baseline model options are Qwen with \~8B parameters or Qwen with \~14B parameters (since "Qwen 3" likely refers to a newer open model series by Alibaba). We need to choose a starting point that balances capability with training feasibility.

**Model Size Recommendation:** Start with the Qwen \~7-8B model (if available, possibly called Qwen-7B or Qwen-8B) for initial development. This size should comfortably fine-tune on 24GB with room for experimentation. Qwen-14B is likely fine-tunable with 4-bit quantization as well, but it will be slower and push the VRAM usage near the limit (14B in 4-bit \~7GB base, plus overhead and gradients). It’s doable, but for initial SFT we might prefer the smaller one to iterate faster and see if the concept works. Once the pipeline is proven on 8B, we can attempt to scale to 14B to improve quality, as 14B will generally produce more accurate and fluent outputs. Empirical evidence suggests a 13B model can be fine-tuned on a 24GB GPU with QLoRA, so Qwen-14B should be manageable with the techniques below.

**Training Stages:**

* **Stage A: Baseline Prompting & Schema Enforcement (No Training):**

  * Immediately, we can attempt to use the pre-trained Qwen model (which likely has general knowledge and some instruction-following ability) to respond as a Historian via prompting alone. We craft a prompt that includes role description ("You are an AI who outputs JSON...") and perhaps few-shot examples of the schema. This is to establish a baseline performance. We expect the base model to struggle with the very strict format and citing requirement, but it might partially succeed.

  * We also implement a simple output validator at this stage: if the model’s output isn’t valid JSON or lacks required fields, we can try to regenerate or instruct it again (reinforce "JSON only, no explanation"). This step doesn’t modify the model but uses prompt engineering to get as close as possible to our desired output.

  * The baseline evaluation (from Stage A) will tell us where prompting alone fails. Likely issues: the model might output extra text or not know actual spec content (thus either hallucinating or giving generic answers), and it might not obey the cite-or-refuse rule consistently.

  * This sets the stage for why fine-tuning is needed.

* **Stage B: Supervised Fine-Tuning (SFT) with QLoRA on Historian Micro-Tasks:**

  * Using the training data generated in section 5, we fine-tune the Qwen model (preferably starting with the chat/instruct variant if Qwen has one, since that already knows to follow instructions) to better perform the Historian tasks. QLoRA (quantization \+ LoRA) allows this finetuning on a single GPU. For instance, QLoRA can reduce a 13B model finetune to fit in \<24GB.

  * We target specific *micro-skills*: producing the JSON format, citing evidence, using the correct label, and generating verification queries. The training examples directly supervise these behaviors.

  * Technically: We will load the model in 4-bit precision (likely using `bitsandbytes` library for 4-bit quantization) and attach LoRA adapters to the model’s transformer layers. Typically, we apply LoRA to key/query or value matrices of the attention layers, and maybe the output projection. Past research indicates LoRA on all linear layers of the Transformer works well. We can use rank e.g. 8 or 16 for LoRA matrices (balance between capacity and memory; rank 8 is often enough).

  * **Hyperparameters (tentative):**

    * Base model loaded 4-bit (quantization scheme: NF4 or similar, as in QLoRA paper).

    * LoRA rank \= 8, LoRA alpha \= 16 (just a typical choice), bias \= none.

    * Sequence length: 1024 tokens for training sequences (should cover an entire prompt+output in most cases).

    * Batch size: due to limited memory, perhaps effective batch size 4-8. We might set micro-batch (per GPU batch) \= 1 or 2 and use gradient accumulation for 4 steps to get effective batch 4 or 8\.

    * Learning rate: \~2e-4 to 1e-4 for LoRA parameters, since only those small matrices are being learned (we can tune).

    * Train for a few epochs (maybe 3-5 epochs over our small dataset) – watch out for overfitting because dataset might not be huge. Alternatively, train until loss plateau but likely not too long given the simplicity of outputs.

    * Use AdamW optimizer with low betas (0.9,0.95) as usual. Possibly use weight decay on LoRA weights if needed (maybe not critical).

    * Gradient checkpointing can be enabled if memory is tight at sequence length 1024 even in 4-bit, but with 8B model should be okay. For 14B, might consider it to reduce memory at cost of compute.

  * We verify during fine-tune that the model is learning to output JSON. Possibly monitor a small validation set if available. Our benchmark from section 7 can serve as a validation to check if things improve after SFT.

  * After Stage B, the model (base+LoRA) should much more reliably produce schema-compliant answers with references, at least for scenarios similar to training data.

* **Stage C: Preference Tuning (DPO or Equivalent for RLHF):**

  * Even after SFT, the model might still occasionally produce suboptimal answers: e.g., maybe sometimes it gives a "CONSISTENT" but with no evidence because none was directly in training for that scenario – an indication of a hallucination or too eager compliance. We want to further align the model with the *policies* of cite-or-refuse and careful conflict handling.

  * We will leverage **Direct Preference Optimization (DPO)** or a similar preference-based method because it is simpler than full RLHF and can be done with pairwise comparisons. DPO fine-tunes the model using pairs of outputs (preferred vs dispreferred) and a loss that pushes the model to increase the probability of the preferred output relative to the dispreferred.

  * To do this, we generate some comparison data:

    * Use our model from Stage B to produce outputs on various prompts (including those not in training data). Also include some manually crafted wrong outputs.

    * For each prompt, produce a *good* output (perhaps the reference correct answer we have, or by manually editing model output) and a *bad* output. Examples of bad outputs: ones that include an unsupported statement, or skip a needed citation, or are not strictly JSON (like have extra text).

    * Mark the good vs bad for each pair. We ensure key differences correspond to our alignment goals: e.g., *bad output* might be one that says "CONSISTENT" without citing the known rule, whereas *good output* cites it. Or bad might be hallucinating a spec reference, good says UNKNOWN.

    * We then fine-tune the model with DPO: basically, it’s like performing a form of logistic regression that the model’s logits for good are higher than for bad. Implementation wise, we might use an existing library or write a custom loss. The huggingface `trl` library might have support for DPO if we supply pairs and preferences.

  * DPO avoids needing a separate reward model or sampling loop, making it efficient. We still are within single GPU. The dataset for DPO might be, say, 50-100 prompt pairs.

  * We should be cautious not to disturb the model’s base knowledge too much – we’re focusing on style. So we might freeze most of model or still just use LoRA on top. Actually, with LoRA we could train separate adapters for RLHF stage or continue the same LoRA.

  * By Stage C end, the model should be strongly biased to:

    * Always include evidence for any claim (or else mark unknown).

    * Avoid providing an answer if not sure (prefer UNKNOWN).

    * Clearly identify contradictions rather than gloss them over.

    * Adhere strictly to JSON format (we might include that in preference too: any non-JSON or apologies from model should be considered bad outputs).

  * This stage essentially teaches the model the *values* or *policy rules* beyond pure accuracy.

* **Stage D: Periodic Adapter Updates:**

  * Instead of repeatedly fine-tuning the full model, we adopt an incremental approach for maintenance:

    * We keep the LoRA adapters from initial SFT and RL tuning. When new data arrives (new specs, new decisions, etc.), we can fine-tune *new LoRA adapters* on just the new data, or even on a small combined dataset.

    * Because LoRA adapters are composable to some extent, one idea is to keep the original LoRA (v1) and apply an additional LoRA (v2) for new training. In practice, stacking LoRAs isn't directly supported by all inference frameworks, but one can merge them or alternate them. Alternatively, incorporate new data by continuing training on the existing LoRA weights for a few more steps (which effectively updates them with new knowledge).

    * The rationale: we don’t want to completely re-fine-tune from scratch with every small change (risk of forgetting, plus time). Instead, treat it like making incremental updates. Perhaps maintain a buffer of new training examples and once a threshold is reached, do a short fine-tune epoch on combined old+new to update the LoRA.

    * Always test after updating to ensure we didn’t break existing behavior (this is where our benchmark helps).

  * Also consider using different LoRA modules for different focuses: e.g., one LoRA for domain knowledge, one for alignment. However, merging LoRA is possible (since LoRA is additive), we might simply have one combined adapter in practice after RLHF. We can still update it gradually.

  * We avoid *full model fine-tuning* at any stage – that would risk catastrophic forgetting of base abilities and definitely overshoot 24GB for large models. By using LoRA, we only train 0.1-1% of parameters, and the base model’s general language capability remains intact (we rely on that to interpret prompts and articulate answers).

  * We also consider **quantization during training**: QLoRA uses 4-bit quant for base model, which might slightly degrade theoretical max quality, but it was shown to maintain near-original performance in many tasks. Given our domain is narrow, this should be fine. At inference, we can either keep it 4-bit or even quantize further to e.g. int4 or int8. But during training, 4-bit is fine. (We keep LoRA in 16-bit precision even if base is 4-bit, per QLoRA practice.)

**Training Limits and Monitoring:** With 24GB, we might find 14B model training borderline. If needed:

* Use gradient accumulation to compensate for smaller batch.

* Possibly use Deepspeed ZeRO if we need to offload gradients temporarily, but likely not needed for LoRA.

* If memory still an issue at seq 1024 with 14B, we can shorten sequences (maybe 800\) if typical input+output are shorter. Or we can enable gradient checkpointing in HF which trades compute for memory by recomputing forward pass segments on backward.

**Avoiding Drift and Forgetting:**

* **Mixing data:** We will include some portion of generic data or initial instructions in fine-tuning if needed to not unlearn base instructions. However, since Qwen presumably has been instruction-tuned, and our fine-tune is aligned with that (we're also basically doing instructions: given a proposal, output an analysis), we might not need to include generic tasks. But if we see the model becomes too narrow (e.g., cannot handle a general question anymore), that’s a sign of catastrophic forgetting.

* We can mitigate forgetting by:

  * Fine-tuning at a relatively low learning rate and on limited epochs – enough to learn new tasks but not so high that it overwrites everything. LoRA inherently helps by preserving base weights, but it can still effectively shift output distribution heavily if overtrained.

  * Possibly mixing a bit of original model’s data: e.g., if Qwen came with a known set of instruction demonstrations, include a small sample in our training just to keep it familiar. Or simply include a generic Q\&A example in training as a sanity check.

  * Use a *replay buffer* approach: maintain a set of some earlier fine-tune examples and always train on some of them when doing new fine-tunes (ensures it retains earlier tasks).

* **Compliance and safety:** Qwen base might have been fine-tuned for general safe completion (like not producing disallowed content, or not revealing sensitive info). Our fine-tune is domain-specific and doesn’t involve those topics, so we likely won’t interfere with those aspects. We should ensure none of our data inadvertently instructs the model to ignore its safety layers (unlikely, since we only ask it to focus on specs).

* **Testing**: After each fine-tuning stage, run tests on some general prompts to ensure it hasn’t become broken. For instance, ask it a basic math question or a casual question and see if it still responds (in test environment). It might respond in JSON since we heavily bias that format. That’s fine for our use-case (we expect it to talk mostly in JSON for its job), but we should note that after fine-tuning, the model might default to JSON style even outside its role. This is acceptable since we intend to deploy it specifically as Historian, not a general chatbot.

**Incorporating narrative memory carefully:**

* If we decide to feed the model “narrative episodes” (like a summary doc of recent events) as part of context or even fine-tune, we must ensure the model doesn’t consider them as absolute truth. Ideally, we *don’t* fine-tune the model on narrative as if it’s fact; instead, we only let it see narratives at inference as additional context (like an FYI).

* Another approach: treat narratives as a different input channel. Possibly have a system prompt that says "Here is a summary of context (which may be incomplete): \<...\>. Use official docs for final verification." But that’s more complicated.

* For training, we can include an example where a narrative conflicts with a spec to teach the model to side with the spec (as discussed earlier).

* If narratives are provided, they could be used for things like delta briefings (the Historian summarizing what changed). The Historian might even generate narratives as output if asked (like a timeline of decisions). But we separate that mode from the strict adjudication.

* We do not incorporate narratives into the retrieval index with same rank as specs; if we do store them, we tag them such that the retrieval filter can demote them for direct fact questions.

* As a result, the model’s “truth substrate” remains the actual spec/decision text, not the derivative summaries. Summaries might be used by the Technical Expert agent more than the Historian (the TE might ask "Historian, give me a brief of last week's decisions", which the Historian could do by summarizing the decision ledger).

* In training, we might have a couple of examples of summarization as optional ability, but not necessary if focusing on adjudication. Possibly postpone adding that until the core consistency function is stable.

In summary, our fine-tuning plan is mindful of the 4090’s limits: QLoRA for memory efficiency, incremental LoRA training for maintainability, and preference tuning for alignment without expensive RL loops. By structuring it in phases, we ensure we first get the model *capable* (Stage B) and then *aligned to our policies* (Stage C), and finally keep it updated without redoing everything (Stage D). This approach is cost-effective and has been shown to achieve good performance with modest compute, as evidenced by QLoRA fine-tuning 65B on a single GPU (which is extreme, but shows the method’s power).

## **7\. Custom Historian Micro-Benchmark**

To evaluate the effectiveness of our Historian model, we will construct a **custom benchmark suite** tailored to its duties. This benchmark will test the model on realistic tasks and measure key performance indicators such as classification accuracy, citation correctness, and its handling of special situations like superseded specs or missing information. The goal is to have quantitative metrics to decide if the model is "good enough to ship" and to guide further improvements.

**Benchmark Tasks (Categories):**

1. **Adjudication Classification Accuracy:** These are tests of the model’s ability to assign the correct `status` label (CONSISTENT, INCONSISTENT, CONDITIONAL, UNKNOWN) to a given scenario. We will have a set of scenarios with known ground-truth labels. Many will be straightforward, e.g., a proposal clearly violating a must-rule (should be INCONSISTENT), or a fully compliant proposal (CONSISTENT). Some will be subtle (where the correct answer might be CONDITIONAL or UNKNOWN).

   * *Example:* Input: Plan says "10 attempts before lockout", spec says 5\. Expected label: INCONSISTENT.

   * *Example:* Input: Plan includes all requirements properly. Expected: CONSISTENT.

   * *Example:* Plan about an undefined area. Expected: UNKNOWN.

   * *Example:* Plan partially fulfills a conditional requirement. Expected: CONDITIONAL.

   * We measure **exact match accuracy**: the percentage of cases where the model’s label matches the expected label exactly. (We do not partial credit here; each case is right or wrong on the classification.)

2. **Citation Precision and Recall:** This evaluates whether the model provides the appropriate evidence for its claims. For each test case, we will have a set of relevant source IDs that *should* be cited (ground truth evidence) and check what the model actually cited.

   * *Precision:* Of the citations the model provides, how many are actually relevant and correct? (No hallucinated or incorrect references.)

   * *Recall:* Did the model cite all the key relevant sources? (Sometimes multiple specs might apply.)

   * We can compute these if we have a known list of expected citations per case. For instance, if a scenario expected citation of spec A and B, and the model cited A and C:

     * Precision: 1 out of 2 citations are correct (50% precision, since C was wrong).

     * Recall: 1 out of 2 relevant references were cited (50% recall, since B was missing).

   * We might combine into an F1 score for citations. But more simply, we can set a threshold like "the model should cite at least X% of relevant sources and have minimal incorrect ones." Ideally, precision should be extremely high (we want no bogus citations).

   * We'll consider any citation that doesn't correspond to a known ID in the knowledge base as an error (hallucination).

   * Also, if the model chooses to cite some related but not exactly needed source, we might count that as extraneous (affecting precision).

3. **Unsupported Assertion Rate:** This measures how often the model makes an assertion that is not backed by provided evidence or known truth. Essentially, any factual or normative statement in the model’s comments/conflicts that isn’t directly traceable to a source.

   * This is somewhat the inverse of citations. Ideally this should be near 0 for final model: the Historian should rarely if ever introduce uncited “knowledge.”

   * We will manually or programmatically check a subset of outputs for any statement that should have a citation but doesn’t.

   * For example, if the model says "This plan is safe because the team is experienced" – that's not from specs, and should be flagged.

   * We define the metric as: (\# of outputs containing an unsupported claim) / (total outputs). We want this percentage low.

   * Specifically, if an output is CONSISTENT or INCONSISTENT, it should have cited justification. If it's unknown but then gives some reasoning, that reasoning should be neutral or clearly speculative with a query.

   * If model outputs any definite claim without evidence, that counts toward this error.

4. **Handling of "UNKNOWN" Cases (Correct abstentions):** We include pairwise tests where one version of input has evidence and another has it removed (similar to how FEVER tests "not enough info"). The model should answer UNKNOWN when the evidence is not present.

   * We will craft e.g. 10 such pairs: one where a key spec is available (should answer e.g. INCONSISTENT because it finds the rule), and one where we remove that rule from context (should answer UNKNOWN).

   * The metric is the percentage of these pairs where the model correctly switches to UNKNOWN when evidence is missing.

   * This ensures it’s truly doing evidence-based reasoning, not answering from param memory. If it still answered confidently in the no-evidence scenario, that’s a fail.

   * For instance, with evidence: "Spec says X must be done" \-\> model says INCONSISTENT (citing spec). Without evidence: model should say UNKNOWN or at least not claim inconsistency since it can't find it.

   * Ideally we want near 100% on this for good shipping quality: meaning the model never pretends to know something if it didn't retrieve supporting evidence.

5. **Verification Query Quality:** For cases where the model outputs `verification_queries` (which will mostly be UNKNOWN or maybe some CONDITIONAL cases), we qualitatively and quantitatively assess those queries.

   * We check if the queries are relevant, specific, and likely to help resolve the uncertainty.

   * We can have some sample unknown scenarios and define what a good query would look like. Score them perhaps on a scale or just count how many are "good".

   * Example metric: out of N unknown outputs, how many included a meaningful verification question (as opposed to none or a trivial question).

   * We could also evaluate clarity: does the query clearly state what info is needed?

   * This might be somewhat subjective; perhaps have human evaluators rank them or at least confirm they're on-topic. For automation, we can verify that the queries mention the key concept that was missing. E.g., if the plan uses "QuantumDB" and no guideline found, a good query would mention "QuantumDB" and "approved or not?".

   * We might require something like \>80% of unknown/conditional cases have an appropriate query.

6. **Supersession and Contradiction Handling:** We specifically test scenarios with outdated vs updated info and with conflicting rules.

   * Supersession test: e.g., older spec allowed X, newer forbids X. The plan follows old. We expect the model to catch and cite the new rule. Metric: percentage of such cases where model correctly flags the supersession (instead of either missing it or citing the old rule incorrectly).

   * Contradiction test: cases where two sources conflict (like spec vs guideline). We check if the model surfaces that conflict explicitly. It should list in `conflicts` something indicating the contradiction.

   * Score: we can give partial credit. Ideally the model should mention both sides of the conflict in its answer. If it only cites one and ignores the other, that’s a miss.

   * We might have 5-10 such tricky cases. For each, have we coded the expected output or at least criteria (like must mention both spec ID and guideline ID).

   * The metric could be something like "multi-source conflict identification rate".

   * If we had to condense: maybe measure as part of citation recall (both conflicting sources should be cited) and check `conflicts` text mentions the gist of contradiction. Likely manual evaluation for these few cases.

   * We want near perfect handling of explicit contradictory rules in the knowledge base because that’s a core function (reporting conflicts rather than giving a single answer). The acceptance threshold might be lower (because it's hard) but target is high.

**Scoring Metrics Summary:**

We will aggregate results as follows:

* **Label Accuracy:** target \>= 90%. (This means at least 90% of test cases the model got the correct classification. For a high-stakes system, we want as close to 100% as possible on clear cases. The occasional tough ambiguous case might be forgiven if 'unknown' vs 'conditional' is a fine line, but ideally we define them clearly.)

* **Unsupported Assertion Rate:** target \<= 2% of outputs. Ideally 0%. We basically want nearly every factual claim to be grounded. A small margin in case of very tricky phrasing or some oversight, but essentially aim for zero hallucinations.

* **Citation Precision:** target \~95% (the citations given are almost all relevant). We allow a small margin in case maybe it cites an extra somewhat relevant thing that wasn’t strictly needed – not harmful but can ding precision.

* **Citation Recall:** target \~90%. We want most relevant references included, but if the model occasionally cites one main source and omits a secondary one, that might be okay as long as the primary conflict is evidenced. But ideally it catches the major ones. For critical references (like the rule directly violated), recall should be \~100%. The 90% accounts for maybe minor additional references.

* **"Unknown" correctness on evidence-removed pairs:** target \>= 95%. We really want the model almost always to answer "UNKNOWN" when it doesn’t have evidence. A slip here means the model might be relying on memory, which is dangerous. So we set a high bar.

* **Verification query quality:** We might set a more qualitative target: e.g., "80% of verification queries are judged useful and relevant by evaluators." We could also measure the length or specificity. But likely, we'll review them manually to ensure they're not generic. We aim for queries that if given to a human, would help them quickly provide the needed info.

* **Supersession correctness:** target \>= 90%. If a spec is outdated, the model should catch it in most cases. It's possible a particularly subtle version change might slip by, but we want the model to be keen on version tags or explicit "supersedes" notes. Many of these can be baked into the retrieval context (like we ensure superseded docs have metadata). But the model should not quote an outdated spec as justification when a newer one contradicts it.

* **Contradiction surfacing:** target \>= 90%. In tests where two constraints conflict, the model should not just pick one silently; it should call out that there's a conflict. This is a nuanced skill (some LLMs might try to reconcile or choose one), but our training will emphasize raising an issue. We want at least 9/10 such cases the model explicitly flags it.

**Overall "Good Enough to Ship" Criteria:** We might say:

* Label accuracy \> 90%.

* No showstopper issues: e.g., any hallucinated reference is a potential showstopper because it undermines trust. So we require maybe 0% hallucinated citation in our test or at least none in critical tests.

* The model must never output completely invalid format (we can consider that in accuracy or separate but presumably after training it won't).

* If the model fails a particular category significantly (e.g., supersession only 50%), we’d hold off shipping until improved, because that could lead to serious mistakes (like endorsing outdated practice).

* It's worth noting, these thresholds are somewhat arbitrary but guided by wanting high reliability. They can be adjusted with stakeholder input.

We will use automated scripts to run through the benchmark scenarios, feed them to the model (post-training), collect outputs and compute these metrics. Some things (like query quality) may require human judgment, but we can approximate by checking if query contains some keywords. Possibly a simpler measure: is the query field non-empty when it should be, and does it mention the topic. But final evaluation might be manual.

This benchmark effectively plays a similar role to academic benchmarks like FEVER or TruthfulQA but customized. It ensures our Historian is not just generally fluent but meeting the specialized requirements we set (truthfulness, evidence use, consistency awareness).

## **8\. Containerized Build/Train/Run Plan (Docker Compose)**

We will implement the entire system as a set of Docker containers orchestrated by Docker Compose. This ensures an isolated, reproducible environment for training, inference, and auxiliary services (like the vector store and database). Below, we outline the components, their roles, and how they connect, followed by an example of the docker-compose structure.

**Microservice Components:**

1. **Training Container:** This container will contain the environment needed to fine-tune the model (HuggingFace Transformers, PEFT for LoRA, bitsandbytes for 4-bit, and possibly Accelerate or DeepSpeed for efficiency). It’s mostly used during development/training time, not continuously running in production. We might spin it up on demand via compose when we need to train or evaluate.

   * It could be based on an image like `pytorch/pytorch:latest` with CUDA support, then pip install `transformers`, `peft`, `datasets`, `accelerate`, etc.

   * We mount a volume with the training data and another volume for output models (to persist the fine-tuned adapters).

   * For example, this container might run a command to execute a training script (which could be triggered manually or via compose run).

   * We might not have it always running, but it's defined in compose for convenience.

2. **Inference Container (Model Serving):** This runs the fine-tuned Historian model for real-time adjudication requests. We have a few options:

   * **Option A: HuggingFace Text Generation Inference (TGI) server** – optimized C++ backend that can serve models with high throughput. It supports HF models and can use GPU. We can load our fine-tuned model (we might have to merge LoRA into the base or load it with `PEFT` in the server).

   * **Option B: vLLM** – a library by Berkeley for high-throughput serving using a dynamic batching and GPU memory management. It could be overkill for single-user scenarios but is efficient.

   * **Option C: Custom Flask/FastAPI with Transformers pipeline** – simpler to implement for our use-case since concurrency is low. The container can just load model and wait for requests (like a minimal API that receives ActionProposal and returns AdjudicationResponse).

   * **Option D: Ollama** – which is a specialized local LLM server we consider, but it's somewhat separate (I'll handle below).

   * Perhaps the safest is to use HuggingFace TGI (there is an official image for it). But to ensure it knows about our LoRA, we may need to merge LoRA weights first, because TGI expects a single model file.

   * We can instead combine LoRA by loading the model in Python and saving a new set of weights (which is heavy but doable on 4090 offline).

   * For now, let's assume we either merge or the serving container can apply LoRA. TGI might not directly apply LoRA without a custom script, so merging might be easier.

   * The inference container exposes an API (HTTP endpoint) on which the Executor agent or any client can request an adjudication. Typically TGI uses port 80/8000 with a /generate endpoint (or /v1/ completions if using OAI compatibility).

   * We'll allocate the GPU to this container (in compose we can use `runtime: nvidia` and appropriate env for CUDA).

   * We may quantize the model for inference to 4-bit or 8-bit to save memory and speed; libraries like GPTQ or llama-int8 can be used. If using TGI, it now supports quantized models (like load 8-bit). But if we want to use 4-bit, might require custom code.

   * Another inference approach: use the `llama.cpp`/GGML ecosystem to run on CPU (less ideal since we have a GPU, but interesting for multi-platform and memory). Qwen might not be supported by llama.cpp out-of-box because Qwen is not Llama architecture. So let's stick to GPU inference via HF libs.

3. **Ollama Deployment (Optional):**

   * Ollama is a tool that easily runs models on local machines (especially Mac) via a CLI and server, focusing on GGML/GGUF quantized models. If we want to distribute our fine-tuned model in a user-friendly way, packaging it for Ollama is attractive.

   * However, as noted, Ollama expects the model in a GGUF (unstructured) format, typically used for Llama or Mistral, etc. If Qwen’s architecture is different, it might not be directly convertible. We need to check if Qwen can be converted to a GGML (some community might have done it if Qwen is popular).

   * If not, a pragmatic approach: If using Qwen becomes a blocker for deployment, consider using a Llama2 model of similar size as the base (since those have robust tool support). But let's assume we stick to Qwen and try to make it work:

     * We would take the merged fine-tuned model (in FP16) and run a conversion script (maybe HF Transformers has a conversion for custom models to GGML if the architecture is identical to Llama? Possibly not straightforward).

     * Alternatively, skip Ollama if not viable. Instead, have the inference container itself serve the model (like with a nice CLI or API). If the user specifically mentions Ollama, they likely want to try it. So let's provide a plan:

   * We could spin up an `ollama` container (there’s an official Docker image). The official image is CPU-only by default, which might be fine if using a quantized small model. Ollama uses core ML / llama.cpp under the hood, so GPU is not utilized (except maybe Mac's Metal).

   * Steps to get model into Ollama:

     * Merge LoRA with base Qwen weights to get a full fine-tuned model.

     * Quantize to GGUF format (e.g., use `llama.cpp` conversion if Qwen can be tricked into it by treating it like Llama architecture, or if not, possibly skip Qwen).

     * Use `ollama import` or mount model into the ollama container's volume (`/root/.ollama`) with a proper YAML config naming the model.

     * Run `ollama run historian -m our_model` to test it.

   * If Qwen is too custom, an alternative: fine-tune Llama-2 7B/13B with our data; that can be easily converted to ggml. But baseline was Qwen presumably for license/performance reasons (Qwen might be truly open or has better context).

   * For the sake of the plan, I'll propose using Ollama if we convert to a supported format, and if not, just use the HF container. It's good to explicitly mention conversion steps:

     * e.g., use `transformers.model.convert_graph_to_ggml` script (there are community scripts to convert HF models to ggml if the arch is Llama or similar).

     * Possibly, if Qwen uses a RoPE and transformer architecture similar to Llama, we could map it. We should highlight uncertainty and mention fallback.

4. **Vector Store / Search Service:** We'll run a container that provides the retrieval function. Options:

   * **ChromaDB**: They have a `chromadb` server mode and even a Docker image. Chroma is easy to use and stores data in either memory or disk. It's local and can persist.

   * **Weaviate or Milvus**: heavier solutions and likely overkill for 40 docs. Not necessary.

   * **Elasticsearch**: if we wanted combined lexical+vector in one, ES has a vector search module, but again heavy, plus managing both synonyms etc might be complex.

   * Simpler: use a Python service that loads our embedding index and exposes an API. Actually, Chroma’s Python API is easy, but for separation, they allow running as a separate process (Chroma can be launched with `chromadb serve`).

   * We'll choose Chroma because it’s lightweight and can handle hybrid (we can store documents and use filtering or do our own keyword search).

   * Setup:

     * One container `vectorstore` running chromadb server on some port (e.g., 8001).

     * We populate it initially via a script (maybe the training container or a one-time init container could load the data into it by calling its REST API or through a mounted volume).

     * Alternatively, we maintain the embedding index outside and just host a service for querying (less dynamic though).

     * But since our corpus updates when specs update, the vector store should allow adding/updating documents. Chroma’s API allows upsert.

   * We'll also likely need an embedding model to embed queries and docs. We could:

     * Precompute doc embeddings offline (maybe using InstructorXL or all-MiniLM) and store them in Chroma. Then at query time, embed the query similarly (embedding model needed).

     * The embedding model could run within the vectorstore container or as a separate microservice.

     * Perhaps simplest: use `sentence-transformers` within the vectorstore container to embed incoming query on the fly then do similarity search in the stored vectors.

   * Lexical search: We might implement a basic keyword search in the same container using whoosh or just scanning text. Or we could rely on an SQLite FTS index.

     * Possibly index the text in an FTS table and query that, or just do a simple substring search if performance is fine. 40 docs is small, substring search is fine.

     * Could incorporate in the vector store service or a separate service. For simplicity, the vectorstore container could handle both: it can maintain an in-memory index of text for exact matches, and the Chroma for semantic.

   * So the `vectorstore` container might run a custom script that loads documents (from a mounted volume or DB) into memory (embedding index \+ text index) and exposes a minimal REST or gRPC:

     * e.g., `GET /search?query=...` returns top 5 chunks with fields (id, text).

     * Or separate endpoints: `/search/semantic` and `/search/keyword`.

     * But likely one endpoint performing the hybrid logic: do both searches and merge results. The logic explained in section 4 (rank by combination).

   * Or if using Chroma’s server plus an external search, we could also just call Chroma for vector and do keyword search in the inference container itself. This integration detail can vary; I'll assume the easiest: one combined "retrieval" service that does what we need.

5. **Data Store (Database) Container:** For persistent storage of specs, decisions, and event logs, we can include a small database.

   * A PostgreSQL container is a straightforward choice if multiple services might read/write concurrently. Alternatively, since we can also have everything in files (like markdown for specs, and a JSON for decisions), we might not strictly need a running DB for function, but it's nice for structured queries.

   * Let's include `postgres` for now. We'll define tables as above. The Technical Expert (human via maybe a UI or CLI) could update specs or decisions by interacting with the DB (or more likely editing markdown and then running an ingestion script).

   * The Historian or vector store will read from this DB when updating its index (maybe watch for changes, or require a manual re-index command).

   * We can mount a volume for the database data to persist it.

   * Alternatively, an SQLite could be simpler (just file access), but concurrency might be tricky if our retrieval container and others access it. Postgres is more robust if multiple microservices access the same data simultaneously (like a UI service and the retrieval service).

   * We'll go with Postgres to be safe, albeit it's heavier. It's not too heavy for local usage (or even use a small one like Postgres-alpine).

   * The Compose will set `POSTGRES_PASSWORD` etc environment.

6. **Evaluation Harness Container:** A container dedicated to running the benchmark suite. This could be a simple python container that can call the inference API and measure metrics.

   * It may not run all the time; it's used by us to test the model. But having it in compose helps isolation (it can have the test data and scripts).

   * For example, it might use `pytest` or just a script that prints results.

   * It would depend on the inference service and possibly the vectorstore to be up (though maybe it bypasses retrieval by calling inference which itself will call retrieval).

   * Likely, the inference container will call vectorstore internally (the model agent might code or pipeline the retrieval).

   * Alternatively, we design the inference API such that the request triggers retrieval. Maybe we actually implement the Historian logic partly outside the model:

     * For instance, the inference service, upon receiving an ActionProposal, will first call vectorstore to get evidence, then format the prompt with that evidence, then call the model (the model itself isn't calling vectorstore). This approach means our model is a pure text generator, and the orchestration of retrieval+LLM happens in the inference container code.

     * This is likely easier than trying to teach the model to query itself. Yes, we'll do that: the inference container will incorporate a simple pipeline:

       1. receive request with ActionProposal JSON,

       2. query vectorstore for relevant chunks,

       3. construct a prompt (maybe a system prompt with instructions, then user prompt containing the actionproposal and the retrieved evidence in some form),

       4. call the model (local) to generate output,

       5. validate JSON and return.

     * This way, the model focuses on reasoning and writing the response, not searching.

   * Therefore, the inference service will have logic to call the `vectorstore` service. So those are connected (we specify in compose that the inference container can see the vectorstore container by name).

   * The evaluation harness then can just hit the inference's public API with various test requests and analyze the JSON responses.

**Compose File Structure:**

We'll outline a `docker-compose.yml` with these services. For brevity and clarity, I'll not include every env detail, but highlight key aspects and volumes:

`version: "3.8"`

`services:`

  `db:`

    `image: postgres:15-alpine`

    `environment:`

      `- POSTGRES_USER=histuser`

      `- POSTGRES_PASSWORD=histpass`

      `- POSTGRES_DB=historiandb`

    `volumes:`

      `- db_data:/var/lib/postgresql/data`

    `networks:`

      `- llmnet`

  `vectorstore:`

    `build: ./vectorstore   # custom Dockerfile setting up chromadb or our retrieval service`

    `ports:`

      `- "8001:8001"        # if we expose externally for debug`

    `environment:`

      `- DB_URL=postgresql://histuser:histpass@db/historiandb`

    `networks:`

      `- llmnet`

    `depends_on:`

      `- db`

  `model-inference:`

    `build: ./inference    # Dockerfile to install transformers, etc, and our inference server code`

    `ports:`

      `- "8000:8000"`

    `deploy:`

      `resources:`

        `reservations:`

          `devices:`

            `- capabilities: [gpu]   # access GPU for this service (assuming Docker with nvidia runtime)`

    `environment:`

      `- CUDA_VISIBLE_DEVICES=0`

      `- MODEL_NAME=Qwen-7B-Historian`

      `- MODEL_PATH=/models/qwen-historian`

      `- VECTORSTORE_URL=http://vectorstore:8001`

    `volumes:`

      `- model_vol:/models   # where the model weights (and perhaps tokenizer) are stored`

    `networks:`

      `- llmnet`

    `depends_on:`

      `- vectorstore`

  `training:`

    `build: ./training    # Dockerfile for training env`

    `volumes:`

      `- model_vol:/models   # to output trained adapters`

      `- data_vol:/data      # training data`

    `networks:`

      `- llmnet`

    `# not usually running by default; we might run commands like:`

    `# docker compose run training python train.py --stage B ...`

  `evaluator:`

    `build: ./evaluation`

    `volumes:`

      `- data_vol:/data   # test scenarios`

    `networks:`

      `- llmnet`

    `depends_on:`

      `- model-inference`

  `# Optional Ollama service:`

  `ollama:`

    `image: ollama/ollama:latest`

    `# (Assuming we've imported the model to the volume or use ollama CLI to pull it if it was published)`

    `ports:`

      `- "11434:11434"`

    `volumes:`

      `- ollama_data:/root/.ollama   # store models`

    `networks:`

      `- llmnet`

    `# (We won't depend it by default; this is for user to run queries manually via ollama)`

Volumes:

`volumes:`

  `db_data:`

  `model_vol:`

  `data_vol:`

  `ollama_data:`

In the above:

* `model_vol` might initially contain the base Qwen model weights (downloaded via HF). The training container can read from it and write LoRA weights there (or directly merge and write final). The inference container then loads from it. This volume allows sharing model artifacts between training and inference easily.

* Alternatively, we could have training output a LoRA file to data\_vol and then in inference container script, merge it on startup. But merging can be done offline to not add latency at runtime.

* `data_vol` contains the spec documents, training data, benchmark definitions, etc. The vectorstore on startup could read spec files from there to populate its index, or connect to the db if the docs are stored in db.

* We might also put spec markdown files in data\_vol and have an ingestion step:

  * Could either run as part of vectorstore container startup (e.g., if DB is empty, read markdowns, fill DB and index).

  * Or a separate small init container or script the user runs.

* For simplicity, maybe maintain specs in Git (outside container) and have a one-off import routine to the db and vectorstore. But for an initial deployment, we could mount a folder of markdowns to vectorstore and have it parse them directly into memory index (skipping the db). The db is more for dynamic updates via other means.

**Model artifact pipeline:**

* During training stage B/C, we'll produce either:

  * A LoRA adapter file (like `qwen-historian-8b-lora.pt`).

  * Perhaps we decide to merge it for simplicity: use `peft.merge_and_unload` to create a merged model weights (though that doubles storage).

* We'll likely keep as LoRA for flexibility, but inference might not natively support applying LoRA (unless we write custom loading).

* E.g., we can modify our inference container code to load base and then load PEFT model.

* If we want to use TGI or Ollama which don't inherently apply LoRA, we must merge weights in training environment to get a final model.

* Merging approach:

  * After fine-tune, in training container run a script to load base, apply lora, then `model.save_pretrained('/models/qwen-historian')`. That outputs HF format with the changes.

  * We then possibly convert to needed runtime: for TGI, HF format is fine. For ollama, we need quantization.

  * We can use e.g. `ct2-transformers` (Convert Transformers to ONNX or int8) or `gptq` library to quantize to 4-bit.

  * If aiming for CPU and low mem, could produce a GGUF:

    * If Qwen is like Llama: possibly we can use `python convert.py Qwen-7B-Historian c4 --outfile qwen.gguf` style if a script exists. This is speculative; likely not directly since Qwen's architecture details (like vocab, position encoding) might differ.

    * If not possible, one pragmatic approach: Use a Llama2-7B as fallback for Ollama. But that might mean re-training it from scratch or replicating fine-tune. Possibly out of scope for now; maybe skip that recommendation unless necessary.

  * I'll assume maybe we can deploy via HF inference (for GPU) and optionally provide instructions to convert to GGUF by exporting the model to a format that llama.cpp can read (if any tool to convert).

  * We mention something like "if direct conversion fails, as a pragmatic solution, consider using a Llama-based model for final deployment to Ollama."

**If Ollama cannot host LoRA directly:** Indeed, currently Ollama loads models as static files. There's no notion of applying a LoRA on the fly. So:

* We must produce a final quantized model file. Steps:

  1. Merge LoRA with base in FP16.

  2. Use `ollama convert` or a similar tool to quantize. Actually, reading \[14\], maybe they expect to mount the model and provide a YAML with architecture info. The docker hub says "CPU only, run with volume" etc.

  3. Possibly one could run llama.cpp conversion for a Qwen model if structure is translatable. If not, indeed maybe we suggest training Llama2 as backup.

* To remain on Qwen path, maybe mention "Alternatively, fine-tune Llama-2 13B similarly and then convert to ggml, since that pipeline is proven."

**Docker Compose Example Explanation:**

* We link all services on a common network `llmnet`. So they can refer to each other by name (db, vectorstore, model-inference, etc).

* The `depends_on` ensures proper startup order (db before vectorstore, vectorstore before model).

* The inference container has an env `VECTORSTORE_URL` so it knows where to query for retrieval.

* The vectorstore has `DB_URL` to fetch data from Postgres if needed.

* The training container not automatically started (no long-running process), but we can run it with a specific command to do training or data prep.

* For example, we could do `docker compose run training python generate_data.py` to produce training data from specs, then `docker compose run training python finetune.py` to fine-tune and output LoRA weights to model\_vol.

* The inference container might have an entrypoint script that loads the model. It might need to merge LoRA if present:

  * We could store LoRA files in model\_vol (like adapter.bin). The script can detect if an adapter exists and merge it on startup (if memory/time is acceptable) or load via PEFT.

  * If using TGI, we might pre-merge because TGI probably expects one model. There's possibly a way to hack a custom model loading in TGI but not trivial.

* We'll likely implement a custom FastAPI in inference container that does retrieval \+ calls model generate (since that gives us flexibility to apply LoRA easily by Python code).

**Volume management for models:**

* Qwen-7B model itself is a few GB, we can either:

  * Download it in training container (via Transformers from HuggingFace hub) and then persist on model\_vol.

  * Or volume mount a host directory where user can place the model files manually (less ideal).

  * Compose can’t easily auto-download, so building an image could include downloading (but large).

  * Usually, one might mount `~/.cache/huggingface` but let's assume manual or script to get it.

* Fine-tuned model storage: We'll have either merged HF model (like a folder with pytorch\_model.bin etc) on model\_vol or a diff (LoRA). The inference container will use that.

**Choice of Vector DB vs local:** Another approach: instead of a separate vectorstore container, we could integrate retrieval logic into the inference container to reduce overhead. Given the data is small, it’s possible to just load all spec chunks into memory within the inference process and do vector math using an in-process library (like FAISS or use sentence-transformers to find similarity). This avoids network calls and simplifies. But having separate container is more microservice style and decouples concern (also maybe the TE agent or others can query the knowledge base via vectorstore API).

* To stick to microservices, we keep it separate. But we must ensure latency is okay: likely fine because local network calls on one machine are fast, and vector search on \<1000 chunks is trivial.

**Model-run integration with Ollama:**

* If we successfully produce a `.bin` (ggml) model, the Ollama container can be used to serve it. We might then not need the model-inference container in production if we rely on Ollama's interface.

* However, given the unknown support, I'd lean on our custom inference for primary use (especially since it uses GPU for speed). The Ollama container could be a convenience for e.g. a Mac user wanting to run the final model on CPU with 16GB RAM.

* Possibly in Compose, we won't run both at same time typically; either user uses the `model-inference` (GPU) or `ollama` (CPU) depending on environment.

**Conversion Steps for Ollama (Pragmatic Approach):**

* Document it:

  * Use the training container (or a separate script) to convert model. E.g., there's a tool `convert.py` in llama.cpp but specific to Llama architecture. If Qwen structure differs (like different hidden dim or rotary usage), one might have to adapt it.

  * If not possible, one approach is to distill our historian to a Llama-based one. That’s too complex to put in this plan likely.

  * Or run Qwen in CPU mode through HF which is slower but possible if small. But Ollama specifically uses llama.cpp for efficiency.

  * Possibly, advise that if direct conversion is not possible, the technical team could use the inference container to serve the model locally (which is effectively similar to what Ollama provides, just less user-friendly CLI).

  * Alternatively, maybe skip recommending switching model, just highlight the risk: "If Qwen conversion not feasible, one might consider using Llama2 as baseline."

**Governance of images and volumes:**

* We likely will host our own code in some directories (`./training`, `./inference`, etc). For instance:

  * `./training/Dockerfile` with content:

    * Base on nvidia/cuda image, install Python libs.

    * Copy train scripts.

  * `./inference/Dockerfile`: base on something like `nvidia/cuda` with huggingface. Or even use the official text-generation-inference image and add a custom entrypoint if needed.

  * `./vectorstore/Dockerfile`: base on python:3.10-slim, pip install chromadb, sentence-transformers, etc, copy in our server script.

  * `./evaluation/Dockerfile`: base on python, pip install requests/pytest etc, copy test scripts.

* Compose ties them.

**Volume Organization:**

* `db_data`: persists the DB.

* `model_vol`: persists model weights (we can have tens of GB, 24GB GPU can load it so fine).

* `data_vol`: share things like spec markdowns and training/benchmark data between training and eval etc. Possibly also needed by vectorstore if we parse direct from files.

* `ollama_data`: persists downloaded models for ollama (so it doesn't re-download on restart). If we manage to produce a local model file, we'd mount or import it here.

**To illustrate the pipeline from training to deployment:**

* We run `docker compose up db` to start DB and maybe populate schema if not done (we can include a .sql in vectorstore container that runs migration).

* Run an ingestion step:

  * Option 1: Exec into vectorstore container and run a script to read .md files from /data and put into DB and to build initial embedding index. Or vectorstore does it on startup if DB is empty.

  * Option 2: Use training container to do one-time import (like `python import_specs.py` connecting to DB).

* Now DB has specs and decisions.

* Bring up vectorstore container, it loads all sections (maybe it queries DB for all current active specs and decisions, computes embeddings, stores in memory or in Chroma).

* Bring up training container (if needed to generate training data). Possibly unnecessary if we already prepared it offline. But we might run `docker compose run training python generate_training_data.py`.

* The generate script could read specs from DB or /data and produce JSON dataset to /data.

* Then run fine-tune: `docker compose run --gpus all training python finetune.py --base_model /models/qwen7b --data /data/train.json --output_dir /models/historian-lora` (for example). This uses the GPU allocated to training container. It writes the LoRA weights to the shared /models volume.

* Then we run a merge script: `docker compose run training python merge_lora.py --base /models/qwen7b --lora /models/historian-lora --out /models/qwen-historian-full`. This produces full weights.

* Now inference container can be started, mounting /models which now contains `qwen-historian-full` model. It loads it on GPU, spins up API on port 8000\.

* We test: `docker compose run evaluator python run_benchmark.py --endpoint http://model-inference:8000`.

* Evaluate results. If fine, proceed to maybe converting for Ollama:

  * Could use training container to run a conversion script: e.g., `python convert_to_ggml.py --model_dir /models/qwen-historian-full --out /models/qwen-historian.gguf`.

  * Then use `ollama push` or mount it accordingly. Possibly out-of-scope to fully automate in compose, but we mention.

* Finally, in production usage, one might only run `vectorstore`, `db`, and `model-inference` (and optionally `ollama` if we deploy via that route). The training and eval are dev-time.

**Tradeoffs / Alternatives:**

* If memory was extremely constrained, we might consider running the model in 4-bit int on CPU (like llama.cpp style), but since we have a 4090, better to use it.

* There is also possibility of using `llama.cpp` with GPU (it has a CUBLAS mode), which could run e.g. a 13B at about 10 tokens/s on 4090\. But HF with Torch might be faster and easier given we fine-tune there.

* Using TGI vs custom server: TGI is great for concurrency but somewhat complex to configure for LoRA. Custom server is more straightforward and flexible to do RAG pipeline. We'll likely do custom with FastAPI or Flask.

**Example Compose Excerpt (as code block for clarity):**

We'll present something similar to above, focusing on main services and volumes.

Now I'll compile a succinct ASCII architecture diagram focusing on containers:  
 We might not do another ASCII, since we already did for roles. But maybe a small one to show container interactions:

`[ Train (HF Transformers) ] -> produces model -> [ Inference API ] -> serves clients`

                                 `/|\                 | uses`

                                  `| (reads model)    v` 

                              `model_vol         [ VectorStore Service ] -> DB` 

                                                         `^`

                                                         `| DB persisted specs & decisions`

                                                 `[ Postgres DB ]`

Alternatively, just describe it in text which we already did.

Alright, I'll include a snippet of docker-compose YAML in the answer as requested.

## **9\. Inference-Time Guardrails and Verification**

At inference (runtime), we will implement multiple guardrails to ensure the Historian’s output is always valid, grounded, and safe. These guardrails act as a second line of defense beyond the model’s training, catching any lapses or enforcing strict output standards. They include schema validation, citation checks, content checks, and optional verification by another pass.

**Schema Validation:**

* We will enforce that the Historian’s response strictly conforms to the JSON schema for AdjudicationResponse. This can be done by parsing the model’s output with a JSON parser and validating required fields and types.

* For example, we can use a JSON Schema definition of AdjudicationResponse and run a validator library on the output. If the output is not valid (e.g., missing a `status` or having a typo in a key), we will treat that as a failure of that generation.

* What do we do on failure? Options:

  * **Auto-correction:** If the error is minor (like the model added a prefix "Here is the JSON:"), we can programmatically strip it and re-validate.

  * **Retry with adjusted prompt:** We could have a loop: upon format failure, reprompt the model more sternly: e.g., "Output JSON only. Remember no extra text." possibly appending the last output for it to correct. Since the model is fine-tuned, this likely won’t be needed often, but it's a fallback.

  * **Ultimately, human fallback:** If after a couple retries it doesn’t produce valid JSON (very unlikely by final model), we might either return an error or have a simplified fallback like just mark unknown.

* We will also ensure that lists like `evidence`, `conflicts` etc. exist even if empty (the schema expects them). The model hopefully does this from training; if not, we might post-process by adding empty arrays if missing.

* By having this validation, we ensure downstream systems can always parse the Historian's answer automatically.

**Citation Validation:**

* Each evidence entry has an `id` that should correspond to a real document section or decision in our knowledge base. We will verify that every cited `id` indeed exists in our index or database.

  * For instance, if the model outputs `SPEC-SECURITY#5.4`, we check against a list of known IDs. If an ID is not recognized, that likely means the model hallucinated a reference. We treat that as a serious error.

  * We can address it by either:

    * Re-running the answer generation with a stronger constraint (maybe telling it it cited an invalid source, please only cite known ones).

    * Or by removing that evidence and marking the answer as needing review.

  * However, since we integrate retrieval and provide relevant IDs, the model shouldn’t invent entirely new ones. It might possibly combine IDs incorrectly, e.g., output "SPEC-SECURITY\#5.5" when only 5.4 and 5.6 existed. This we will catch.

* We will maintain a registry of stable IDs (all spec sections, guideline clauses, decision IDs) accessible to the inference system. This can be simply derived from our database or vectorstore index.

* If an output contains an ID not in that registry:

  * The verifier component (see below) or a post-check will flag it. We could then automatically append a note like "UNCITED CLAIM" or change the status to UNKNOWN because a claimed reference was invalid.

  * More conservatively, we might tell the user "The Historian provided an invalid citation, please verify manually." But we aim to avoid reaching that point by training.

* Another aspect: the content of evidence vs claims. Ideally, we cross-verify that the excerpt quoted actually supports the conflict or statement in `conflicts`.

  * We can do a simple check: for each conflict string, see if the relevant keywords appear in the evidence text. E.g., conflict says "10 attempts vs spec 5 attempts", check evidence excerpt contains "5" or "5 attempts".

  * Or use a smaller language model to evaluate: "Does the evidence sentence logically imply the conflict stated?" This is complex but could be done as an optional second-pass model check.

  * At least, we verify there's no obvious mismatch (like citing a section about logging to justify a password rule conflict).

  * This could be part of an automated consistency check pass.

**"UNKNOWN" and "CONDITIONAL" Enforcement:**

* We will enforce that the model uses `UNKNOWN` when appropriate rather than guessing. The training and preference tuning should handle this mostly, but at inference we can add rules:

  * If the model returns a status other than UNKNOWN but provided zero evidence or empty `evidence` list, that's suspicious. Normally, CONSISTENT/INCONSISTENT should have evidence. If none is given, we can assume it should have been UNKNOWN (since it apparently found nothing to cite).

  * In such a case, we can either:

    * Change the status to UNKNOWN and perhaps list as conflict "No evidence found to support a conclusion."

    * Or ask the model to reconsider with a prompt: "You gave no evidence. If you found none, you should return UNKNOWN."

  * Similarly for CONDITIONAL: a conditional should ideally have something in `conditions` or `verification_queries`. If the model says CONDITIONAL but leaves those empty, that's not helpful. We might treat that as an error and prompt it to fill in the condition.

* Essentially, we enforce logical consistency of the output fields:

  * CONSISTENT/INCONSISTENT should have evidence (non-empty evidence array).

  * INCONSISTENT should have at least one conflict explanation.

  * CONDITIONAL should have at least one condition listed.

  * UNKNOWN should likely have a verification query (if not, it's okay, but often we prefer it).

  * If these are not met, we either auto-correct (like for query, maybe we can generate a generic verification query from context) or have the model regenerate with a nudge.

* These checks can be done with a simple function after parsing JSON.

**Optional Verifier Model/Pass:**

* We can introduce a verification stage where either the same Historian model or a smaller one (like an instruction-tuned 2B model or even an LLM chain) reviews the output. The purpose is to catch subtle issues:

  * Uncited claims (which our above rules partly catch by checking evidence presence).

  * Contradictions or logical errors in the reasoning.

  * Possibly compliance issues (like the model output content that violates some policy, though that’s unlikely as it’s mostly technical content).

* How to implement:

  * One idea: Use the Historian model itself in a different prompt: *"Check the following AdjudicationResponse for errors or unsupported statements."* Provide the output and maybe the relevant spec excerpts again, and ask it to output issues. This is like an audit mode. If the model is well-trained, it might identify if something in `conflicts` wasn't actually in evidence.

  * Another idea: a purpose-built smaller model (maybe something like an XLM-R or GPT-4 via API if allowed offline – but we can't rely on external API given constraints, so stick offline).

  * Possibly just reusing the same model is simplest: after it generates the answer, we append a system message "Now verify that every claim above is supported by evidence or mark error." The model could then output some verification analysis.

  * But to keep it simpler, an automated script can do 80% of this (like the string checks described).

* We could incorporate a second run of Historian with a different prompt template as part of inference pipeline:

  * Step1: Historian generates answer.

  * Step2: Feed (ActionProposal \+ answer \+ evidence) to a "Verifier prompt" to the same model: "Given the proposal and the adjudication above, verify: Are there any claims in the adjudication not backed by the evidence? Does the conclusion follow? Answer yes/no and list issues."

  * If it says yes issues, then we know we need to adjust.

  * This is somewhat meta; might not be foolproof because the model might be biased to defend its answer or might not detect subtle errors. Still, it’s an option for extra safety.

* Possibly simpler: incorporate some known tools. If this were open internet, I'd mention using an external fact-checker or rule engine, but offline, we rely on our curated rules and the model.

* At least, verifying citations exist and references valid covers the main risk of hallucination. Logical consistency (like did it misread evidence) is rarer if training was good, but we can pick it up by human QA if needed.

**Hard vs Soft Gates:**

* **Hard-Gate Invariants (must-block conditions):**

  * Output not valid JSON schema – block (ask model to correct or raise error).

  * Evidence ID not found – block or flag (we might attempt one regeneration; if still hallucinating references, better to not trust it).

  * Model making an unsupported claim (detected by absence of evidence for a critical claim) – we can either try to auto-correct by flipping to unknown or at least include a warning in the output that this part is unverified. But in general, we would treat this as a fail and require revision.

  * Model not citing in an inconsistent classification – that's a fail (because if it's inconsistent, there has to be something to point to).

  * Schema fields missing as per above rules – treat as generation error and fix via re-run.

  * In summary, anything that violates the structured contract or the fundamental "cite or abstain" principle is a hard stop that triggers either an automated fix or a refusal to finalize output.

* **Soft-Gate Historical Consistency / Advisory:**

  * Some outputs might be formally correct but could be improved. For instance, maybe the model marks something CONSISTENT but didn’t mention a minor caveat that a human reviewer might find relevant. Or it cited slightly tangential evidence when a more precise one exists.

  * These are not outright wrong, so we wouldn't block the output. But we might log a warning or include a comment.

  * Example: The model might mark something CONSISTENT citing a guideline, but there was also a spec explicitly saying it's allowed. It didn't cite the spec, only guideline. It's not wrong, but it missed an evidence. We might accept it (pass the output) but note in logs to improve recall.

  * Another example: The model says UNKNOWN and has a verification query, but maybe it could have guessed conditional given partial info. That's fine to be cautious; we let it through (caution is okay).

  * If the model has a style issue (maybe too verbose comments), that's soft – no need to block, maybe just trim if needed for brevity.

  * We will define some of these conditions and possibly have a logging system that records them for developers:

    * e.g., "Soft issue: Only 1 evidence cited but 2 known relevant." – not a user-facing error, but something to consider in next training.

    * Or "Soft: Possibly contradictory decisions not explicitly flagged but likely known." – etc.

  * The user likely won’t see these warnings, it's internal.

  * Another soft scenario: The model might allow an action with condition, whereas a human might have outright rejected it. If it's subjective, we consider that not a strict error. The human in the loop can always add a decision if they disagree. The model did its job by pointing out a condition.

* **Human-in-the-loop at verification:**

  * If a response triggers a hard gate and our automated retries don't fix it, we escalate: meaning a human (maybe the Tech Expert) should review the proposal manually. We can design the system to output "Historian cannot confidently adjudicate this proposal, human review needed."

  * This would be an explicit unknown but rather a system-level unknown. It should be rare if the model is working.

  * But having this catch ensures safe failure: if model gets confused, it doesn’t silently produce a wrong answer.

In implementation, a lot of these checks can be done in the inference container after the model generates text:

* Parse JSON. If fails \-\> reprompt or error.

* Validate fields. If fails \-\> fix or reprompt.

* Check each evidence id in DB. If any fail \-\> maybe attempt to drop them and add a note, or reprompt instructing "You cited something not found, try again referencing known docs." We could even feed it the list of allowed doc IDs in the prompt to restrict it.

* Possibly use regex to ensure no disallowed content (like it didn't output full spec text beyond allowed snippet size, etc. But that's probably fine.)

* The optional second-pass verification can be turned on/off depending on performance needs. We might enable it in a debug mode or for particularly critical outputs (like if an output is going to be used in a meeting or automated decision, maybe double-check it).

* Hard gates clearly stop or correct output; soft gates produce logs or metrics but let output through.

This multi-layer approach (model alignment via training \+ runtime validation) ensures a high level of reliability and trustworthiness in the Historian's outputs. It's aligning with the general approach of "guardrails keep the system safe and consistent: answer only from context, cite or refuse when missing evidence” that we referenced earlier, implemented both through the model and through code-based verification.

## **A. Core Design Principle**

### **Goal**

The Historian adjudicates an Executor’s proposal **using only**:

1. the **ActionProposal** content (self-contained evidence bundle \+ anchors), and

2. **its post-trained internalized knowledge** (“constitutional invariants” \+ learned narrative patterns),  
    with **no external retrieval tools** during adjudication.

### **Non-negotiable implication**

**The Executor must carry the memory anchors.** If a proposal omits necessary anchors (spec IDs, decision IDs, invariants), the Historian must return `UNKNOWN` or `CONDITIONAL` with verification queries.

This replaces “RAG accuracy” with **contract completeness \+ trained abstention discipline**.

---

# **1\) Updated Failure Model (No-RAG Historian)**

### **Additional failure modes introduced by no-RAG constraint**

* **Anchor omission**: executor fails to cite relevant spec/decision IDs → historian cannot evaluate.

* **Stale internalization**: historian weights lag behind latest decisions (until the next distillation run).

* **Over-generalized narrative**: fine-tuning on recent incidents causes incorrect rule extrapolation.

* **Silent drift**: repeated micro-updates degrade previously learned constraints.

### **Mitigation**

* Enforce **proposal completeness contract**

* Run **event-triggered, gated LoRA updates** (no “always-on” learning)

* Maintain **replay \+ regression** to prevent forgetting/drift

* Versioned **model lineage** and promotion gates

---

# **2\) Updated System Contracts (Interfaces)**

## **2.1 Executor Artifact Must Be Self-Contained**

The ActionProposal now **must** include a structured “EvidenceBundle” section that is **explicitly non-RAG**: it contains the minimal excerpts/claims required for adjudication, referenced by stable IDs (spec section IDs, decision IDs).

### **ActionProposal JSON Schema (updated)**

`{`  
  `"$schema": "https://json-schema.org/draft/2020-12/schema",`  
  `"$id": "https://hestami.local/schemas/action_proposal.v2.json",`  
  `"title": "ActionProposal",`  
  `"type": "object",`  
  `"required": [`  
    `"proposal_id",`  
    `"feature_id",`  
    `"created_at",`  
    `"executor",`  
    `"objective",`  
    `"assumptions",`  
    `"plan",`  
    `"spec_refs",`  
    `"decision_refs",`  
    `"invariants",`  
    `"risks",`  
    `"non_goals",`  
    `"open_questions",`  
    `"evidence_bundle",`  
    `"confidence"`  
  `],`  
  `"properties": {`  
    `"proposal_id": { "type": "string" },`  
    `"feature_id": { "type": "string" },`  
    `"created_at": { "type": "string", "format": "date-time" },`  
    `"executor": {`  
      `"type": "object",`  
      `"required": ["agent_id", "model_id", "version"],`  
      `"properties": {`  
        `"agent_id": { "type": "string" },`  
        `"model_id": { "type": "string" },`  
        `"version": { "type": "string" }`  
      `}`  
    `},`  
    `"objective": { "type": "string" },`  
    `"assumptions": { "type": "array", "items": { "type": "string" } },`  
    `"plan": {`  
      `"type": "array",`  
      `"items": {`  
        `"type": "object",`  
        `"required": ["step_id", "action", "expected_outcome", "validation"],`  
        `"properties": {`  
          `"step_id": { "type": "string" },`  
          `"action": { "type": "string" },`  
          `"expected_outcome": { "type": "string" },`  
          `"validation": { "type": "array", "items": { "type": "string" } }`  
        `}`  
      `}`  
    `},`  
    `"spec_refs": {`  
      `"type": "array",`  
      `"items": { "$ref": "https://hestami.local/schemas/spec_citation.v1.json" }`  
    `},`  
    `"decision_refs": {`  
      `"type": "array",`  
      `"items": { "type": "string", "description": "DecisionTrace IDs" }`  
    `},`  
    `"invariants": {`  
      `"type": "array",`  
      `"items": { "type": "string", "description": "Explicit must/must-not invariants asserted by the executor" }`  
    `},`  
    `"risks": {`  
      `"type": "array",`  
      `"items": {`  
        `"type": "object",`  
        `"required": ["risk", "impact", "mitigation"],`  
        `"properties": {`  
          `"risk": { "type": "string" },`  
          `"impact": { "type": "string" },`  
          `"mitigation": { "type": "string" }`  
        `}`  
      `}`  
    `},`  
    `"non_goals": { "type": "array", "items": { "type": "string" } },`  
    `"open_questions": { "type": "array", "items": { "type": "string" } },`  
    `"evidence_bundle": {`  
      `"type": "object",`  
      `"required": ["bundle_id", "items"],`  
      `"properties": {`  
        `"bundle_id": { "type": "string" },`  
        `"items": {`  
          `"type": "array",`  
          `"description": "Self-contained evidence items, each anchored to stable IDs",`  
          `"items": {`  
            `"type": "object",`  
            `"required": ["evidence_id", "source_type", "source_id", "section_id", "excerpt", "claim"],`  
            `"properties": {`  
              `"evidence_id": { "type": "string" },`  
              `"source_type": { "type": "string", "enum": ["SPEC", "GUIDELINE", "DECISION_TRACE"] },`  
              `"source_id": { "type": "string", "description": "SpecDoc ID or DecisionTrace ID" },`  
              `"section_id": { "type": "string", "description": "Stable section anchor inside markdown docs" },`  
              `"excerpt": { "type": "string", "description": "Short excerpt used for adjudication (keep small)" },`  
              `"claim": { "type": "string", "description": "Executor’s interpretation of this excerpt" }`  
            `}`  
          `}`  
        `}`  
      `}`  
    `},`  
    `"confidence": { "type": "number", "minimum": 0, "maximum": 1 }`  
  `}`  
`}`

## **2.2 Updated AdjudicationResponse (No-RAG semantics)**

Key change: Historian must explicitly report **Anchor Sufficiency**.

`{`  
  `"$schema": "https://json-schema.org/draft/2020-12/schema",`  
  `"$id": "https://hestami.local/schemas/adjudication_response.v2.json",`  
  `"title": "AdjudicationResponse",`  
  `"type": "object",`  
  `"required": [`  
    `"adjudication_id",`  
    `"proposal_id",`  
    `"label",`  
    `"anchor_sufficiency",`  
    `"evidence_used",`  
    `"conflicts",`  
    `"required_verification_queries",`  
    `"recommended_edits",`  
    `"confidence"`  
  `],`  
  `"properties": {`  
    `"adjudication_id": { "type": "string" },`  
    `"proposal_id": { "type": "string" },`  
    `"label": { "type": "string", "enum": ["CONSISTENT", "INCONSISTENT", "CONDITIONAL", "UNKNOWN"] },`  
    `"anchor_sufficiency": {`  
      `"type": "string",`  
      `"enum": ["SUFFICIENT", "INSUFFICIENT"],`  
      `"description": "Whether the proposal contains enough anchored evidence to adjudicate"`  
    `},`  
    `"evidence_used": {`  
      `"type": "array",`  
      `"items": {`  
        `"type": "object",`  
        `"required": ["source_type", "source_id", "section_id", "evidence_id"],`  
        `"properties": {`  
          `"source_type": { "type": "string", "enum": ["SPEC", "GUIDELINE", "DECISION_TRACE"] },`  
          `"source_id": { "type": "string" },`  
          `"section_id": { "type": "string" },`  
          `"evidence_id": { "type": "string" }`  
        `}`  
      `}`  
    `},`  
    `"conflicts": {`  
      `"type": "array",`  
      `"items": {`  
        `"type": "object",`  
        `"required": ["conflict", "severity", "citations"],`  
        `"properties": {`  
          `"conflict": { "type": "string" },`  
          `"severity": { "type": "string", "enum": ["HIGH", "MED", "LOW"] },`  
          `"citations": {`  
            `"type": "array",`  
            `"items": { "$ref": "https://hestami.local/schemas/spec_citation.v1.json" }`  
          `}`  
        `}`  
      `}`  
    `},`  
    `"required_verification_queries": {`  
      `"type": "array",`  
      `"description": "If label is UNKNOWN or CONDITIONAL, list exact questions that must be answered with IDs needed",`  
      `"items": { "type": "string" }`  
    `},`  
    `"recommended_edits": {`  
      `"type": "array",`  
      `"items": { "type": "string", "description": "Concrete edits to the ActionProposal to make it consistent or evaluable" }`  
    `},`  
    `"confidence": { "type": "number", "minimum": 0, "maximum": 1 }`  
  `}`  
`}`

## **2.3 DecisionTrace Record (mandatory for narrative distillation)**

This is the authoritative “why” substrate. It is **not** automatically truth; it is truth only when marked human-approved.

`{`  
  `"$schema": "https://json-schema.org/draft/2020-12/schema",`  
  `"$id": "https://hestami.local/schemas/decision_trace.v1.json",`  
  `"title": "DecisionTrace",`  
  `"type": "object",`  
  `"required": [`  
    `"decision_id",`  
    `"created_at",`  
    `"status",`  
    `"trust_tier",`  
    `"supersedes",`  
    `"scope",`  
    `"rationale",`  
    `"normative_outcome",`  
    `"citations",`  
    `"discussion_refs"`  
  `],`  
  `"properties": {`  
    `"decision_id": { "type": "string" },`  
    `"created_at": { "type": "string", "format": "date-time" },`  
    `"status": { "type": "string", "enum": ["ACTIVE", "SUPERSEDED", "RETIRED"] },`  
    `"trust_tier": { "type": "string", "enum": ["HUMAN_APPROVED", "HUMAN_NOTED", "MODEL_DRAFT"] },`  
    `"supersedes": { "type": "array", "items": { "type": "string" } },`  
    `"scope": {`  
      `"type": "object",`  
      `"required": ["feature_ids", "components"],`  
      `"properties": {`  
        `"feature_ids": { "type": "array", "items": { "type": "string" } },`  
        `"components": { "type": "array", "items": { "type": "string" } }`  
      `}`  
    `},`  
    `"rationale": { "type": "string", "description": "The 'why' in human language" },`  
    `"normative_outcome": {`  
      `"type": "array",`  
      `"description": "Machine-usable rules distilled from the rationale",`  
      `"items": { "type": "string" }`  
    `},`  
    `"citations": {`  
      `"type": "array",`  
      `"items": { "$ref": "https://hestami.local/schemas/spec_citation.v1.json" }`  
    `},`  
    `"discussion_refs": {`  
      `"type": "array",`  
      `"description": "Pointers to chat logs / PR links / issue IDs (local URLs or IDs)",`  
      `"items": { "type": "string" }`  
    `}`  
  `}`  
`}`

---

# **3\) Updated Operating Model: “No-RAG Adjudication, Event-Triggered Distillation”**

## **3.1 End-to-end service blueprint (updated)**

**Design-time**: specs/guidelines/decisions maintained in markdown with stable section IDs.  
 **Run-time**: Executor proposes; Historian adjudicates using proposal \+ weights; Human resolves; Decisions captured; Distillation run triggered.

### **Updated flow**

1. **Executor** generates `ActionProposal.v2` (must include `evidence_bundle`)

2. **Historian** returns `AdjudicationResponse.v2`

3. **Human manager**:

   * approves proposal → proceed

   * corrects proposal → creates/updates `DecisionTrace`

4. System emits **TrainingTuple batch** derived from: (proposal, adjudication, human correction, decision trace)

5. **Distillation run** (event-triggered, batched, gated):

   * SFT/QLoRA LoRA update

   * regression benchmark

   * promote adapter if pass

---

# **4\) Updated Scenario Playbooks (no-RAG specific additions)**

You still keep the original 8 playbooks, but update the *mechanics*:

### **Playbook: “Missing evidence / anchor omission”**

1. Executor submits proposal without decision refs or spec sections for a critical invariant.

2. Historian returns `UNKNOWN` with `anchor_sufficiency=INSUFFICIENT`

3. Required verification query demands exact anchors:

   * “Provide spec sections governing tenant isolation invariants: SPEC:auth.md\#RLS-Context, GUIDELINE:backend.md\#ConnectionPooling”

4. Executor revises proposal to include evidence\_bundle items

5. Historian re-adjudicates

### **Playbook: “Human correction triggers distillation”**

1. Human marks historian verdict wrong or marks executor plan wrong with a new “why.”

2. Human records DecisionTrace with `trust_tier=HUMAN_APPROVED`

3. System generates TrainingTuple variants (positive/negative/abstain/supersession)

4. Distillation run triggered → candidate adapter

5. Candidate must pass regression → promote

---

# **5\) Updated Data Architecture: No-RAG Inference, Still Need Records**

Even if Historian doesn’t retrieve at inference, you still need:

* authoritative records for auditing,

* training corpora generation,

* regression suite construction,

* model lineage.

### **Minimal local storage (unchanged conceptually)**

* `spec_docs` (markdown)

* `spec_sections` (index of stable IDs)

* `decision_traces` (JSON)

* `training_items` (JSONL)

* `bench_cases` (JSONL)

* `model_registry` (adapters, versions, scores)

**Key change**: retrieval index is **not** for historian inference; it is for:

* building evidence bundles (executor tooling),

* building training sets,

* ensuring citations refer to existing IDs.

So you can keep an indexing service, but you do not route historian inference through it.

---

# **6\) Updated Training Strategy: “Narrative Distillation Runs” as First-Class Workflow**

## **6.1 Training item format (standardized)**

Each “decision of note” produces a bundle:

* `SFT` item: (proposal → adjudication)

* `Critique` item: (proposal → conflict report)

* `Repair` item: (proposal \+ critique → revised plan)

* `Abstain` item: (proposal with missing anchors → UNKNOWN \+ verification)

* `Supersession` item: (proposal cites superseded decision → mark conflict \+ cite newer)

## **6.2 Distillation run cadence (event-triggered but batched)**

* Trigger: any new HUMAN\_APPROVED decision trace

* Batch minimum: e.g., 10–50 new items (configurable)

* Always include replay: e.g., 200–1000 curated prior “memory exemplars”

## **6.3 Promotion gates (hard)**

* JSON validity: 100%

* Unsupported assertion rate: ≤ 1% (ideally 0% for normative claims)

* UNKNOWN correctness on evidence-removed pairs: ≥ 95%

* Supersession correctness: ≥ 95%

* No regression \> 2% absolute on core benchmark tasks

---

# **7\) Updated Post-Training Plan (single RTX 4090, frequent runs)**

### **Recommendation (unchanged): start with Qwen 3 8B**

Frequent LoRA updates \+ inference headroom are significantly easier at 8B on 24GB VRAM.

### **Stages (updated emphasis)**

* **Stage A (mandatory)**: schema-first prompting \+ strict JSON validator \+ “anchor sufficiency rule”

* **Stage B**: QLoRA/SFT on adjudication tasks (short sequences, anchor discipline)

* **Stage C**: preference tuning (DPO) *only after* you have stable SFT behavior; focus on abstention and conflict surfacing

* **Stage D (new)**: **event-triggered LoRA micro-updates** with replay \+ regression \+ gated promotion

### **Operational anti-drift requirements**

* Fixed “constitutional” dataset always mixed into training (small but constant)

* Replay buffer must include:

  * top invariants

  * worst historical failure modes

  * evidence-removed abstention pairs

* Never auto-promote without regression

---

# **8\) Updated Containerization Plan (Docker Compose) — No-RAG Historian Inference**

You still have local DB \+ indexer, but the historian inference path does **not** call them.

### **Services (updated responsibilities)**

* `historian_infer`: serves Historian model (base \+ current promoted adapter)

* `executor_infer`: serves Executor model (may be same base, different adapter)

* `training`: runs LoRA training jobs

* `bench`: runs benchmark/regression suite

* `registry_db`: postgres/sqlite for model registry \+ decisions

* `spec_store`: bind-mounted markdown corpus

* `indexer`: builds spec/decision indices for *executor evidence bundle generation* \+ dataset generation

* `bundle_builder`: creates `evidence_bundle` candidates for the executor (optional but practical)

### **Compose skeleton (updated)**

`version: "3.9"`  
`services:`  
  `registry_db:`  
    `image: postgres:16`  
    `environment:`  
      `POSTGRES_USER: hestami`  
      `POSTGRES_PASSWORD: hestami`  
      `POSTGRES_DB: historian`  
    `volumes:`  
      `- ./volumes/postgres:/var/lib/postgresql/data`  
    `ports: ["5432:5432"]`

  `indexer:`  
    `build: ./services/indexer`  
    `volumes:`  
      `- ./specs:/data/specs:ro`  
      `- ./decisions:/data/decisions:ro`  
      `- ./volumes/index:/data/index`  
    `depends_on: [registry_db]`

  `bundle_builder:`  
    `build: ./services/bundle_builder`  
    `volumes:`  
      `- ./specs:/data/specs:ro`  
      `- ./volumes/index:/data/index:ro`  
      `- ./schemas:/data/schemas:ro`  
    `environment:`  
      `BUNDLE_MAX_CHARS: "1200"`  
    `depends_on: [indexer]`

  `historian_infer:`  
    `build: ./services/infer`  
    `environment:`  
      `MODEL_BASE: "/models/qwen3-8b"`  
      `MODEL_ADAPTER: "/models/adapters/current"`  
      `MODE: "historian"`  
    `volumes:`  
      `- ./volumes/models:/models`  
      `- ./schemas:/schemas:ro`  
    `deploy:`  
      `resources:`  
        `reservations:`  
          `devices:`  
            `- capabilities: [gpu]`  
    `ports: ["8001:8000"]`

  `executor_infer:`  
    `build: ./services/infer`  
    `environment:`  
      `MODEL_BASE: "/models/qwen3-8b"`  
      `MODEL_ADAPTER: "/models/adapters/executor"`  
      `MODE: "executor"`  
    `volumes:`  
      `- ./volumes/models:/models`  
      `- ./schemas:/schemas:ro`  
    `deploy:`  
      `resources:`  
        `reservations:`  
          `devices:`  
            `- capabilities: [gpu]`  
    `ports: ["8002:8000"]`

  `training:`  
    `build: ./services/training`  
    `volumes:`  
      `- ./datasets:/data/datasets`  
      `- ./volumes/models:/models`  
      `- ./runs:/data/runs`  
    `deploy:`  
      `resources:`  
        `reservations:`  
          `devices:`  
            `- capabilities: [gpu]`

  `bench:`  
    `build: ./services/bench`  
    `volumes:`  
      `- ./benchmarks:/data/benchmarks`  
      `- ./volumes/models:/models`  
      `- ./runs:/data/runs`  
    `depends_on: [historian_infer]`

  `ollama:`  
    `image: ollama/ollama:latest`  
    `volumes:`  
      `- ./volumes/ollama:/root/.ollama`  
      `- ./volumes/models:/models:ro`  
    `ports: ["11434:11434"]`

### **Ollama deployment path (unchanged, but clarified)**

Ollama generally wants a single consolidated model artifact (often GGUF). If your LoRA adapter cannot be loaded directly:

1. Merge adapter into base (offline) → “merged fp16”

2. Convert to GGUF / quantize (e.g., Q4\_K\_M) if needed

3. Create Ollama Modelfile → `ollama create historian-qwen3 -f Modelfile`

4. Serve locally

**Pragmatic**: Keep vLLM/HF inference for development; treat Ollama as the “packaged deployment target” after merges.

---

# **9\) Updated Guardrails: Contract Completeness is the New “Retrieval”**

### **Hard gates (block)**

* JSON schema invalid

* Citations reference nonexistent IDs (validated against local index)

* Normative claim without a citation anchor in `evidence_used`

* `anchor_sufficiency=INSUFFICIENT` but label ≠ `UNKNOWN`/`CONDITIONAL`

### **Soft gates (warn)**

* Conflicts with low severity

* Open questions unresolved but safe to proceed with limited scope

### **Optional second-pass verifier (no-RAG)**

A lightweight “verifier pass” (same model at temperature 0, or a smaller model) checks:

* every “must/must-not” statement has a cited anchor

* no conflicts reported without citations

* if anchors insufficient → enforce UNKNOWN/CONDITIONAL

---

# **10\) Updated Roadmap Milestones (distillation experiment included)**

## **v0**

* Schemas v2 (ActionProposal/AdjudicationResponse/DecisionTrace)

* 20 gold cases \+ evidence-removed pairs

* Baseline prompting \+ schema \+ anchor sufficiency gate

## **v1**

* 100-case benchmark

* SFT LoRA for historian (adjudication \+ abstention discipline)

* Local regression harness (bench container)

## **v2**

* DPO (or equivalent) for cite-or-refuse \+ conflict surfacing

* Verifier pass

* Ollama packaging pipeline (merge \+ convert)

## **v3**

* **Event-triggered narrative distillation runs (experimental)**

  * decision-of-note trigger

  * batch+replay

  * regression gated promotion

* Supersession automation in decision trace ledger

* Model lineage registry \+ delta briefing generation

---

## **Three Updated Example Artifacts (instances)**

### **Example ActionProposal (v2, abbreviated)**

`{`  
  `"proposal_id": "AP-2026-01-26-001",`  
  `"feature_id": "FEAT-SR-CREATE",`  
  `"created_at": "2026-01-26T18:45:00Z",`  
  `"executor": { "agent_id": "executor-1", "model_id": "qwen3-8b", "version": "base+exec-adapter-v1" },`  
  `"objective": "Implement Create Service Request workflow with tenant isolation and durable workflow idempotency.",`  
  `"assumptions": [`  
    `"All backend requests are server-side only (no direct browser->backend).",`  
    `"Tenant context must be explicit per request; no implicit pooled connection state."`  
  `],`  
  `"plan": [`  
    `{ "step_id": "S1", "action": "Add POST /service-requests endpoint", "expected_outcome": "Request persisted", "validation": ["integration test: creates SR", "rls test: tenant isolation"] }`  
  `],`  
  `"spec_refs": [`  
    `{ "doc_id": "SPEC-BACKEND-001", "section_id": "RLS-Context", "quote_hash": "sha256:abc...", "title": "Tenant Context Rules" }`  
  `],`  
  `"decision_refs": ["DT-2026-01-20-004"],`  
  `"invariants": ["Must set tenant context explicitly per request; never rely on pooled session state."],`  
  `"risks": [{ "risk": "RLS denies due to missing context", "impact": "false empty reads", "mitigation": "explicit context middleware + tests" }],`  
  `"non_goals": ["No UI polish beyond functional form"],`  
  `"open_questions": ["Do we require idempotency keys for SR create?"],`  
  `"evidence_bundle": {`  
    `"bundle_id": "EB-AP-2026-01-26-001",`  
    `"items": [`  
      `{`  
        `"evidence_id": "E1",`  
        `"source_type": "SPEC",`  
        `"source_id": "SPEC-BACKEND-001",`  
        `"section_id": "RLS-Context",`  
        `"excerpt": "Tenant context must be set explicitly for each request; pooled connections must not assume prior session variables.",`  
        `"claim": "Endpoint middleware must set tenant context on every request."`  
      `}`  
    `]`  
  `},`  
  `"confidence": 0.72`  
`}`

### **Example AdjudicationResponse (v2)**

`{`  
  `"adjudication_id": "AR-2026-01-26-001",`  
  `"proposal_id": "AP-2026-01-26-001",`  
  `"label": "CONDITIONAL",`  
  `"anchor_sufficiency": "SUFFICIENT",`  
  `"evidence_used": [`  
    `{ "source_type": "SPEC", "source_id": "SPEC-BACKEND-001", "section_id": "RLS-Context", "evidence_id": "E1" }`  
  `],`  
  `"conflicts": [],`  
  `"required_verification_queries": [`  
    `"Provide spec/guideline anchor for idempotency requirement on create endpoints (if any). If none, record DecisionTrace explicitly."`  
  `],`  
  `"recommended_edits": [`  
    `"Add either (a) spec section proving idempotency requirement or (b) DecisionTrace stating policy for create SR idempotency keys."`  
  `],`  
  `"confidence": 0.81`  
`}`

### **Example DecisionTrace**

`{`  
  `"decision_id": "DT-2026-01-26-007",`  
  `"created_at": "2026-01-26T19:02:00Z",`  
  `"status": "ACTIVE",`  
  `"trust_tier": "HUMAN_APPROVED",`  
  `"supersedes": [],`  
  `"scope": { "feature_ids": ["FEAT-SR-CREATE"], "components": ["API", "Workflow"] },`  
  `"rationale": "We require idempotency keys for any create endpoint that may be retried by workflows to prevent duplicate side effects.",`  
  `"normative_outcome": [`  
    `"Create endpoints invoked by durable workflows must accept an idempotency key.",`  
    `"Duplicate idempotency keys must return the original result without reapplying side effects."`  
  `],`  
  `"citations": [`  
    `{ "doc_id": "GUIDE-WORKFLOWS-001", "section_id": "Idempotency", "quote_hash": "sha256:def...", "title": "Workflow Retry and Idempotency" }`  
  `],`  
  `"discussion_refs": ["CHAT-2026-01-26-THREAD-12"]`  
`}`

# **The Constitutional Historian: A Hybrid Cloud/Local Architecture**

## **1\. Executive Summary & Problem Definition**

We are architecting a software engineering agent ecosystem. The primary failure mode in such systems is **Architectural Drift**: over time, high-velocity execution agents (Cloud LLMs) propose changes that validly solve a local problem but violate obscure, long-standing project constraints or superseded decisions.

To mitigate this, we introduce the **Historian Agent**. Unlike the creative Executors, the Historian is a conservative, local "Constitutional Court." It does not write code; it adjudicates whether an Executor's proposal is **CONSISTENT** or **INCONSISTENT** with the immutable history of the project.

**The Hybrid Advantage:**

By offloading the heavy lifting of code generation to commercial cloud providers (Executor/Expert), we free the local RTX 4090 to run a high-fidelity, fine-tuned Qwen 3 model dedicated entirely to consistency checking and narrative preservation.

---

## **2\. System Roles & Hybrid Topology**

The system operates on a **check-and-balance** model.

| Role | Hosting | Model | Function |
| :---- | :---- | :---- | :---- |
| **Executor** | Cloud (API) | **Claude 3.5 Sonnet / GPT-4o** | **Proposes changes.** Consumes specs, produces ActionProposal. Optimized for coding capability and speed. |
| **Technical Expert** | Cloud (API) | **Claude 3.5 Sonnet** | **Drafts decisions.** Interviewed by humans to produce DecisionTrace documents. Optimized for nuance and communication. |
| **Historian** | **Local (RTX 4090\)** | **Qwen 3-14B (Thinking)** | **Adjudicates.** Consumes Proposals \+ History, produces AdjudicationResponse. Fine-tuned for skepticism and citation. |

### **2.1 Qwen 3 Assessment**

**Verdict:** **Qwen 3 is the optimal baseline.**

Unlike Qwen 2.5, Qwen 3 features a native **"Thinking Process" (Chain of Thought)**.

* **Why it matters for the Historian:** Adjudication requires multi-step logic ("The spec says X, but Decision 4 says Y, therefore X is superseded"). Qwen 3 can perform this reasoning in a hidden "thought" block before outputting the JSON verdict, significantly reducing hallucinated inconsistencies.  
* **Size:** We will use **Qwen 3-14B-Instruct**. On a 24GB card, this leaves \~10GB of VRAM for context (approx. 32k tokens at 4-bit) and overhead, ensuring we can load substantial history without OOM.

---

## **3\. Technical Deep Dive: Catastrophic Forgetting**

**User Query:** *Why does continuous fine-tuning cause catastrophic unlearning, especially if each new decision document is small?*

It is intuitive to think that learning "just one more small thing" shouldn't hurt a massive brain. In Neural Networks, the opposite is often true. This is the **Stability-Plasticity Dilemma**.

### **3.1 The Mechanics of Destruction**

1. **The Manifold Hypothesis:** A pre-trained LLM rests on a specific "manifold" of weights that allows it to understand English, logic, and JSON formatting.  
2. **The "Spiky" Loss Landscape:** When you fine-tune on a *single* document (e.g., "Decision 104: Use Postgres"), the loss landscape for that specific task is incredibly narrow.  
3. **Gradient Over-Optimization:** To drive the loss to zero on that *one* document, the optimizer aggressively updates weights. Since there are no other examples in the batch to "anchor" the model to general English or JSON syntax, the weights drift wildly off the pre-trained manifold.  
4. **Result:** The model perfectly memorizes "Use Postgres" but forgets how to close a JSON bracket or how to reason about Python. This is **Catastrophic Forgetting**.

### **3.2 The Solution: Replay Buffers**

To prevent this, we never train on *just* the new memory. We construct a **Replay Buffer**.

Every training batch is a mixture:

* **10% New Signal:** The new Decision Trace or Spec Update.  
* **40% Narrative Memory:** Random samples from *previous* decision traces (prevents forgetting history).  
* **50% Constitutional Anchors:** Static examples of JSON formatting, logic, and "refusal" behaviors (prevents forgetting how to be an LLM).

---

## **4\. Operational Workflows (Playbooks)**

### **4.1 Scenario A: The "New Feature" Flow (Inference)**

1. **Human** asks for "Dark Mode".  
2. **Technical Expert (Cloud)** drafts a DecisionTrace (ID: DEC-050) detailing the approach.  
3. **Executor (Cloud)** reads DEC-050 and existing specs, generates an ActionProposal.  
4. **Historian (Local)** wakes up.  
   * **Retrieval:** Pulls DEC-050 and relevant chunks of Spec-UI-v1.  
   * **Inference:** Qwen 3 performs a "Thinking" pass to check for conflicts.  
   * **Output:** Returns AdjudicationResponse (JSON).  
5. **Orchestrator:** If CONSISTENT, allows code generation. If INCONSISTENT, returns critique to Executor.

### **4.2 Scenario B: The "Narrative Distillation" Flow (Training)**

*Trigger:* A new DecisionTrace is approved by the human.

1. **Orchestrator:**  
   * Pauses the **Historian Inference Service** (Ollama).  
   * Generates a synthetic training dataset:  
     * **Positive:** (Input: Proposal matching new decision \-\> Output: CONSISTENT)  
     * **Negative:** (Input: Proposal violating new decision \-\> Output: INCONSISTENT \+ Citation)  
   * Mixes this with the **Replay Buffer**.  
2. **Trainer Container:**  
   * Loads Qwen 3 Base \+ Current LoRA Adapter.  
   * Runs **Unsloth** fine-tuning (1-2 epochs max).  
   * Saves new adapter adapter\_v(n+1).  
3. **Orchestrator:**  
   * Restarts Ollama with adapter\_v(n+1).

---

## **5\. Artifact Schemas (JSON)**

These schemas define the strict contract between the Cloud agents and the Local Historian.

### **5.1 ActionProposal (from Cloud Executor)**

JSON

{  
  "id": "prop\_8823",  
  "objective": "Migrate user auth to OAuth2",  
  "proposed\_changes":,  
  "justification": "Per security audit requirements.",  
  "references": \["spec\_security\_v2", "audit\_log\_2025"\]  
}

### **5.2 AdjudicationResponse (from Local Historian)**

JSON

{  
  "status": "INCONSISTENT",  
  "confidence\_score": 0.98,  
  "thinking\_trace": "The proposal removes bcrypt. Spec SEC-001 explicitly states 'Legacy auth must be maintained for offline support'. The proposal violates this invariant.",  
  "violations":,  
  "suggested\_fix": "Implement OAuth2 as primary, retain bcrypt as fallback for offline mode."  
}

---

## **6\. Implementation Strategy: Docker Compose**

We use a "Toggle" architecture. The GPU is never shared; it is handed off between the **Service** (Ollama) and the **Trainer** (Unsloth).

**Folder Structure:**

/opt/historian

├── docker-compose.yml

├── data/

│ ├── vectors/ (ChromaDB)

│ ├── training/ (JSONL datasets)

│ └── history/ (Raw markdown specs)

├── models/

│ ├── base/ (Qwen 3 GGUF/Safetensors)

│ └── adapters/ (Versioned LoRAs)

└── orchestrator/

└── app.py (FastAPI)

**docker-compose.yml:**

YAML

services:  
  \# \--- CONTROLLER \---  
  orchestrator:  
    image: python:3.11-slim  
    environment:  
      \- OPENAI\_API\_KEY=${OPENAI\_KEY}  
      \- ANTHROPIC\_API\_KEY=${ANTHROPIC\_KEY}  
      \- OLLAMA\_HOST=http://historian\_service:11434  
    volumes:  
      \-./data:/app/data  
      \- /var/run/docker.sock:/var/run/docker.sock \# Essential for controlling sibling containers  
    ports: \["8080:8080"\]

  \# \--- INFERENCE (DAY JOB) \---  
  historian\_service:  
    image: ollama/ollama:latest  
    deploy:  
      resources:  
        reservations:  
          devices:  
            \- driver: nvidia  
              count: 1  
              capabilities: \[gpu\]  
    volumes:  
      \-./models/ollama:/root/.ollama  
    environment:  
      \- OLLAMA\_KEEP\_ALIVE=24h \# Keep model loaded for speed  
    expose: \["11434"\]

  \# \--- TRAINING (NIGHT JOB) \---  
  historian\_trainer:  
    image: unsloth/unsloth:latest  
    profiles: \["training"\] \# Only starts when explicitly called  
    deploy:  
      resources:  
        reservations:  
          devices:  
            \- driver: nvidia  
              count: 1  
              capabilities: \[gpu\]  
    volumes:  
      \-./data/training:/data  
      \-./models/adapters:/output  
    command: python train\_lora.py \--base\_model unsloth/Qwen3-14B \--data /data/mixed\_batch.jsonl

### **6.1 The Handover Script (Python)**

The orchestrator uses the Docker SDK to manage the GPU mutex:

Python

import docker

client \= docker.from\_env()

def run\_distillation\_cycle():  
    \# 1\. Stop Inference  
    print("Stopping Historian Service...")  
    service \= client.containers.get("historian\_service")  
    service.stop()

    \# 2\. Run Training  
    print("Starting Distillation Run...")  
    trainer \= client.containers.run(  
        "historian\_trainer",  
        detach=True,  
        device\_requests=\])\]  
    )  
    trainer.wait() \# Block until training finishes

    \# 3\. Restart Inference  
    print("Restarting Historian Service...")  
    service.start()

## **7\. Data Engineering: Converting Specs to Training Data**

To train the Historian, we cannot just feed it raw text. We must convert specs into **Adjudication Pairs**.

**Source:**

*Spec:* "All database timestamps must be in UTC."

**Synthetic Generator (Technical Expert Cloud Agent):**

We ask the Cloud Agent to generate:

1. **A Valid Action:** "Create table with created\_at timestamp default timezone('utc', now())." \-\> **Label: CONSISTENT**  
2. **An Invalid Action:** "Create table with created\_at timestamp default now() (defaults to server time)." \-\> **Label: INCONSISTENT**

**Prompt to Cloud Agent:**

"You are a QA Engineer. Read this requirement: '{requirement}'. Generate 3 JSON ActionProposals that violate this requirement subtly, and 3 that adhere to it perfectly. Output in JSONL format for fine-tuning."

This creates the "Gold Standard" dataset used to train the local Historian.

## **8\. Summary of Recommendations**

1. **Model:** Switch to **Qwen 3-14B-Instruct**. The "Thinking" capability is a force multiplier for consistency checking.  
2. **Architecture:** Adopt the Hybrid approach. Cloud for creativity (Executor/Expert), Local 4090 for Governance (Historian).  
3. **Training:** Implement **Replay Buffers** immediately. Do not fine-tune on single documents without mixing in historical anchors, or the model will lobotomize itself (Catastrophic Forgetting).  
4. **Deployment:** Use Docker Compose with a Mutex strategy. Stop Ollama to Train; Stop Training to Serve. Do not attempt concurrent execution on one GPU.

# **Phased Implementation Roadmap**

**Historian-Centric, No-RAG, Narrative-Distilled Multi-Agent System**

---

## **PHASE 0 — Foundational Contracts & Truth Substrate**

**Purpose:** Establish non-negotiable interfaces, schemas, and ground truth before any model training or agent behavior is trusted.

### **Entry Condition**

* None (bootstrap phase)

### **Deliverables (Must Exist)**

1. **Canonical Schemas (v2)**

   * `ActionProposal.v2.json`

   * `AdjudicationResponse.v2.json`

   * `DecisionTrace.v1.json`

   * `SpecCitation.v1.json`

2. **Schema Validators**

   * Strict JSON Schema validation (fail-fast)

   * Deterministic error messages

3. **Spec Corpus Normalization**

   * Markdown ingestion

   * Stable `doc_id` \+ `section_id` index

   * Hashing of quoted text (`quote_hash`)

4. **Decision Ledger (Empty but Live)**

   * Supports status (`ACTIVE | SUPERSEDED | RETIRED`)

   * Supports supersession graph

   * Trust tiers enforced

### **Hard Gates**

* ❌ Any schema ambiguity

* ❌ Any spec section without a stable ID

* ❌ Any citation that cannot be validated against corpus

### **Exit Criteria**

* A proposal and adjudication can be schema-validated and round-tripped with **zero inference**.

---

## **PHASE 1 — Deterministic Historian (No Training)**

**Purpose:** Make the Historian reliable *before* learning anything.

### **Entry Condition**

* Phase 0 complete

### **Deliverables**

1. **Baseline Historian Prompt**

   * Zero creativity

   * Explicit evaluation checklist

   * Mandatory abstention rules

2. **Anchor Sufficiency Rule**

   * If anchors insufficient → `UNKNOWN` or `CONDITIONAL`

3. **Hard Guardrails**

   * No uncited normative claims

   * No conflicts without citations

4. **Verifier Pass (Static)**

   * Post-hoc scan for uncited “must/must not”

5. **Minimal Gold Benchmark (≈20 cases)**

   * Consistent

   * Inconsistent

   * Missing evidence

   * Superseded decision

   * Ambiguous proposal

### **Hard Gates**

* ❌ Any hallucinated spec/decision

* ❌ Any invalid JSON

* ❌ Any normative claim without citation

### **Exit Criteria**

* Historian behaves like a **deterministic rules engine with language**, not an “assistant.”

---

## **PHASE 2 — Executor Contract Enforcement**

**Purpose:** Ensure the Historian never compensates for a weak Executor.

### **Entry Condition**

* Phase 1 complete

### **Deliverables**

1. **Executor Output Linter**

   * Reject proposals missing:

     * assumptions

     * invariants

     * spec refs

     * evidence bundle

2. **Evidence Bundle Builder**

   * Pulls excerpts by stable IDs

   * Enforces size limits

3. **Proposal Completeness Scoring**

   * Quantitative “evaluable / non-evaluable” score

4. **Failure Mode Catalog**

   * Common executor omissions mapped to historian responses

### **Hard Gates**

* ❌ Historian asked to adjudicate incomplete proposals

* ❌ Executor allowed to “hand-wave” evidence

### **Exit Criteria**

* Historian failures are attributable only to **knowledge gaps**, not missing inputs.

---

## **PHASE 3 — Training Data Pipeline (Pre-Model)**

**Purpose:** Generate *correct* learning material before touching weights.

### **Entry Condition**

* Phase 2 complete

### **Deliverables**

1. **Training Item Schemas**

   * SFT items

   * Abstention items

   * Supersession items

   * Conflict surfacing items

2. **Automated Spec Decomposition**

   * Extract:

     * MUST / MUST NOT

     * SHOULD

     * Invariants

3. **Decision Trace Canonicalizer**

   * Human correction → structured DecisionTrace

4. **Synthetic Pair Generation**

   * Evidence-removed variants

   * Contradiction variants

5. **Trust-Tier Filtering**

   * Only `HUMAN_APPROVED` decisions become authoritative

### **Hard Gates**

* ❌ Any training item without a verifiable anchor

* ❌ Mixing speculative notes into authoritative training

### **Exit Criteria**

* You can regenerate the **entire training corpus deterministically** from specs \+ decisions.

---

## **PHASE 4 — Historian SFT (LoRA, Controlled)**

**Purpose:** Teach the Historian *how* to adjudicate, not *what* to believe.

### **Entry Condition**

* Phase 3 complete

### **Deliverables**

1. **Qwen 3 Base Selection**

   * 8B baseline

2. **QLoRA SFT**

   * Tasks:

     * classification

     * citation discipline

     * abstention

     * conflict explanation

3. **Replay Buffer**

   * Core invariants

   * Historical failure cases

4. **Regression Harness**

   * Run against Phase-1 gold cases

### **Hard Gates**

* ❌ Unsupported assertion rate \> 1%

* ❌ UNKNOWN accuracy \< 95% on evidence-removed pairs

* ❌ Any regression on supersession handling

### **Exit Criteria**

* Historian is **strict, skeptical, and boring** (this is success).

---

## **PHASE 5 — Preference Tuning (Selective)**

**Purpose:** Shape *judgment quality*, not factual content.

### **Entry Condition**

* Phase 4 complete

### **Deliverables**

1. **DPO Dataset**

   * Good vs bad adjudications

   * Overconfident vs abstaining

2. **Preference Axes**

   * Cite-or-refuse

   * Early conflict surfacing

   * Conservative confidence

3. **Verifier-Aware Training**

   * Penalize outputs that fail verifier

### **Hard Gates**

* ❌ Any increase in hallucinations

* ❌ Any decrease in abstention correctness

### **Exit Criteria**

* Historian prefers **safe refusal over clever guess**.

---

## **PHASE 6 — Narrative Distillation Runs (Experimental Core)**

**Purpose:** Enable learning from human corrections *without* drift.

### **Entry Condition**

* Phase 5 complete

### **Deliverables**

1. **Decision-of-Note Trigger**

   * Deterministic criteria:

     * human correction

     * new invariant

     * supersession

2. **Distillation Batch Builder**

   * Expand one decision into multiple training tuples

3. **Event-Triggered LoRA Training**

   * Small batch \+ replay

4. **Mandatory Regression**

   * Full benchmark suite

5. **Adapter Promotion Logic**

   * Pass → promote

   * Fail → archive

### **Hard Gates**

* ❌ Auto-promotion without regression

* ❌ Adapter overwrite without lineage record

### **Exit Criteria**

* Historian improves **locally** without degrading globally.

---

## **PHASE 7 — Model Lineage & Auditability**

**Purpose:** Make the system governable.

### **Entry Condition**

* Phase 6 operational

### **Deliverables**

1. **Model Registry**

   * Adapter ID

   * Training batch IDs

   * Benchmark scores

2. **Delta Brief Generator**

   * “What changed and why”

3. **Rollback Capability**

   * Instant revert to prior adapter

4. **Human-Readable Model Card**

   * Included decisions

   * Known blind spots

### **Hard Gates**

* ❌ Untraceable model state

* ❌ Inability to explain why a model changed

### **Exit Criteria**

* You can answer: *“Why did the Historian say this?”* with evidence.

---

## **PHASE 8 — Packaged Deployment (Ollama)**

**Purpose:** Freeze and ship without losing guarantees.

### **Entry Condition**

* Phase 7 complete

### **Deliverables**

1. **Merged Model Artifact**

   * Base \+ promoted adapter

2. **Quantized GGUF (if needed)**

3. **Ollama Modelfile**

4. **Inference Parity Tests**

   * vLLM vs Ollama outputs

### **Hard Gates**

* ❌ Behavior drift between dev and packaged deployment

### **Exit Criteria**

* Historian is reproducible, local, and portable.

---

## **PHASE 9 — Steady-State Operation**

**Purpose:** Continuous correctness, not continuous change.

### **Capabilities**

* Executor proposes

* Historian adjudicates

* Human corrects (when needed)

* Decision recorded

* Distillation triggered (optionally)

* Regression enforced

* Lineage preserved

### **System Invariant**

**No model change without evidence, regression, and audit trail.**

# **Synthesized Technical Approach**

**Historian-Based Narrative Memory & Adjudication System**

---

## **1\. Synthesis Overview: What Was Unified**

The two source documents share the same experimental objective but differ in emphasis:

| Dimension | Author A Strength | Author B Strength | Synthesis Outcome |
| ----- | ----- | ----- | ----- |
| Core role of Historian | Contract-driven adjudication, abstention discipline | Constitutional guardian, narrative continuity | Historian as **non-creative constitutional court** |
| Memory model | No-RAG inference, anchor sufficiency | Narrative distillation with replay | **Event-triggered distillation, no inference retrieval** |
| Training philosophy | Schema-first, regression-gated | Catastrophic forgetting analysis | **Replay-buffered LoRA with promotion gates** |
| Architecture | Precise schemas, executor responsibility | Hybrid cloud/local topology | **Hybrid system with strict contracts** |
| Failure handling | UNKNOWN / CONDITIONAL semantics | Drift & forgetting risks | **Abstention as first-class success state** |

The resulting system is **not a memory-augmented assistant**, but a **governance subsystem** whose correctness is defined by *refusal, citation, and consistency*, not creativity.

---

## **2\. Canonical Problem Statement**

*How do we ensure long-term architectural and policy coherence in a high-velocity, multi-agent software system where most reasoning and generation occurs in external cloud models?*

### **Core risks identified**

* Architectural drift

* Silent supersession of decisions

* Hallucinated consistency

* Catastrophic forgetting from naïve fine-tuning

* Over-reliance on retrieval at inference time

### **Non-negotiable constraint**

The Historian **must not depend on inference-time retrieval**. All adjudication must be based on:

1. The **ActionProposal** itself

2. The Historian’s **post-trained internalized invariants**

This constraint drives every downstream design choice.

---

## **3\. System Roles (Finalized)**

### **3.1 Executor (Cloud)**

* High-creativity, high-bandwidth model (Claude / GPT)

* Produces **ActionProposal**

* Bears responsibility for **evidence completeness**

### **3.2 Technical Expert (Cloud, optional but recommended)**

* Assists humans in drafting **DecisionTrace**

* Converts discussion into explicit rationale \+ normative outcomes

### **3.3 Historian (Local, RTX 4090\)**

* Conservative, citation-obsessed adjudicator

* Produces **AdjudicationResponse**

* Fine-tuned for:

  * abstention

  * supersession detection

  * invariant enforcement

  * schema compliance

**Key synthesis decision:**  
 The Historian is explicitly *not* optimized for recall breadth. It is optimized for **skeptical evaluation under uncertainty**.

---

## **4\. Contract-First Design (System Spine)**

The entire system is stabilized by **three immutable contracts**.

### **4.1 ActionProposal (Executor → Historian)**

* Must be **self-contained**

* Must include:

  * explicit invariants

  * spec references

  * decision references

  * **EvidenceBundle** (minimal excerpts \+ claims)

If anchors are missing, **evaluation must fail safely**.

---

### **4.2 AdjudicationResponse (Historian → Orchestrator)**

Mandatory semantics:

* CONSISTENT

* INCONSISTENT

* CONDITIONAL

* UNKNOWN

Plus:

* `anchor_sufficiency = SUFFICIENT | INSUFFICIENT`

**Design synthesis insight:**  
 UNKNOWN is not a failure. UNKNOWN is a *correct outcome* when evidence is insufficient.

---

### **4.3 DecisionTrace (Human-Approved Truth)**

* Records *why*, not just *what*

* Has lifecycle: ACTIVE → SUPERSEDED → RETIRED

* Is the **only admissible source** for narrative distillation

This resolves the tension between:

* “LLMs should learn from experience”

* “LLMs must not hallucinate policy”

They only learn from **explicitly approved decisions**.

---

## **5\. Memory Model: Narrative Distillation (Unified)**

### **5.1 What “Memory” Actually Means Here**

Not vector recall.  
 Not chat history.

**Memory \= learned adjudication behavior under constraints.**

### **5.2 Distillation Trigger**

A distillation run occurs **only when**:

* A new DecisionTrace is marked `HUMAN_APPROVED`

No background learning. No continuous fine-tuning.

---

### **5.3 Training Composition (Replay Buffer)**

Every training batch mixes:

| Component | Purpose |
| ----- | ----- |
| New decisions | Plasticity |
| Historical decisions | Stability |
| Constitutional anchors | Preserve base competence |
| Abstention examples | Enforce refusal discipline |
| Supersession cases | Temporal reasoning |

This directly resolves catastrophic forgetting described in the second document.

---

## **6\. Inference Model: No-RAG by Design**

### **Why this matters**

* Retrieval masks missing contracts

* Retrieval hides executor negligence

* Retrieval encourages false confidence

### **Final rule**

If the Executor does not carry the memory anchor, the Historian must refuse to judge.

Retrieval infrastructure still exists, but **only** for:

* building evidence bundles

* dataset generation

* regression benchmarks

* auditability

Never for inference.

---

## **7\. Infrastructure & Deployment (Consolidated)**

### **7.1 Hybrid Topology**

* Cloud: Executors, Experts

* Local (RTX 4090): Historian only

### **7.2 GPU Mutex Model**

* GPU is never shared

* Either:

  * inference service is running **or**

  * training container is running

This ensures:

* determinism

* thermal stability

* reproducibility

---

### **7.3 Container Roles (Final)**

* `executor_infer`

* `historian_infer`

* `training`

* `bench`

* `registry_db`

* `spec_store`

* `indexer`

* `bundle_builder`

* `ollama` (packaged deployment target)

---

## **8\. Failure Model (Unified)**

| Failure | System Response |
| ----- | ----- |
| Missing anchors | UNKNOWN \+ verification queries |
| Conflicting decisions | INCONSISTENT \+ citations |
| Ambiguous policy | CONDITIONAL |
| Superseded reference | INCONSISTENT \+ newer decision |
| Drift risk | Block promotion via regression |

**Key synthesis insight:**  
 The Historian is evaluated as much on *what it refuses to say* as on what it asserts.

---

## **9\. Evaluation & Promotion Gates**

A new Historian adapter is promoted **only if**:

* JSON validity: 100%

* Unsupported claims: ≤ 1%

* Correct abstention on evidence-removed cases: ≥ 95%

* Supersession detection: ≥ 95%

* No \>2% regression on core benchmarks

This transforms “memory” into a **controlled software artifact**, not an emergent property.

---

## **10\. Implementation Roadmap (Directly Actionable)**

### **Phase 0 — Foundations**

* Finalize schemas (ActionProposal, AdjudicationResponse, DecisionTrace)

* Stable spec section IDs

* 20–30 gold adjudication cases

---

### **Phase 1 — Baseline Historian**

* Qwen 3 baseline

* Prompt-only adjudication

* Schema enforcement

* Anchor sufficiency gate

---

### **Phase 2 — First Distillation**

* LoRA SFT with replay buffer

* Abstention & citation tuning

* Regression harness

---

### **Phase 3 — Operationalization**

* Event-triggered distillation pipeline

* Model registry \+ lineage

* Ollama packaging path

---

### **Phase 4 — Hardening**

* Supersession automation

* Verifier second-pass

* Drift analytics

* Human review dashboards

---

## **11\. Final Synthesis Insight**

The experiment is not about *making the Historian smarter*.

It is about making **the system intolerant of ambiguity without evidence**.

The strongest outcome of combining these two documents is a reframing:

**Narrative memory is not recall — it is disciplined judgment under incomplete information.**

That principle is now enforced:

* contractually

* architecturally

* operationally

* and statistically

# **1\) Canonical Feature Artifact Model**

Each feature becomes a **Feature Pack** with two authoritative documents plus a generated court record directory.

## **1.1 Authoritative docs (human-authored)**

1. **Feature Spec** (SRD/PRD)

2. **Implementation Roadmap** (phased, non-time-based)

## **1.2 Generated artifacts (extension-owned, court record)**

Stored under something like:

`.hestami/features/FEAT__<slug>__<hash8>/`  
  `feature.meta.json`  
  `convo.transcript.ndjson`  
  `roadmap.v1.md`  
  `roadmap.v1.json`  
  `steps/`  
    `S01/`  
      `step.plan.json`  
      `step.plan.adjudication.json`  
      `step.patch`  
      `step.verify.json`  
      `step.patch.adjudication.json`  
  `decisions/`  
    `DT-*.json`  
  `runs/`  
    `distill-*.json`  
    `bench-*.json`

This structure is what enables:

* reproducible review

* dataset generation

* regression gates

* “chat history leveraged to maximal utility”

---

# **2\) Spec Header Block: Required Going Forward**

At the top of **both** the feature spec and roadmap file, enforce a small YAML header.

## **2.1 Feature Spec header (authoritative intent)**

Example:

`hestami:`  
  `feature:`  
    `slug: create-service-request`  
    `title: Create Service Request`  
    `scope: feature`  
    `required_surfaces: [schema, backend, workflow, frontend, tests]`  
    `optional_surfaces: [observability, docs]`  
    `invariants:`  
      `- TENANT_ISOLATION`  
      `- IDEMPOTENCY_WORKFLOWS`  
    `dependencies:`  
      `- service-provider-directory`  
    `acceptance:`  
      `e2e_user_story: "Property owner submits request; staff triages; provider assigned."`

### **Why this matters**

* It resolves Q19 (“inferred from prose”) by gradually making the critical parts explicit.

* Completeness Option E becomes *measurable*: “frontend required” is no longer an inference.

## **2.2 Roadmap header (execution intent)**

`hestami:`  
  `feature_id: FEAT::create-service-request::a13f9c2b`  
  `roadmap_version: 1`  
  `execution_style: layered-slice   # schema→backend→workflow→frontend`

---

# **3\) Feature Identity Recommendation (Operationalized)**

Given Q22/Q23, the Feature ID becomes:

**Primary key**

`FEAT::<slug>::<hash8>`

**hash8 computed from the Feature Spec header \+ canonical “Scope/Acceptance” sections**, not from the whole file (to avoid churn from minor edits). The extension will maintain a stable “hash scope” rule.

**User workflow**

* On “Start Feature Conversation”:

  * select spec file \+ confirm header

  * extension computes Feature ID

  * creates court record folder

  * links the roadmap file (or offers to generate a scaffold)

---

# **4\) UX: Single Windsurf-Like Chat With Phase-Gated Workflow**

## **4.1 One main panel: Conversation Canvas**

* One thread, four speakers

* One speaker active at a time (streaming allowed)

* Every message is tagged with:

  * persona

  * phase

  * feature\_id

  * optional “addresses step Sxx”

## **4.2 Supporting panels (minimal but essential)**

1. **Feature Panel**

   * spec file link

   * roadmap file link

   * required\_surfaces checklist (from header)

   * current phase \+ current step

2. **Court Panel (Historian)**

   * last plan verdict

   * last patch verdict

   * open verification queries

   * “Potential Narrative Update” prompts

3. **Diff/Step Panel**

   * current step contract

   * current step patch diff

   * completeness signals (surfaces touched, missing expected artifacts)

4. **Command Center**

   * allowlist/confirm list for commands

   * per-workspace approvals

   * step-attached command logs

This keeps the UI tight while giving you the governance primitives.

---

# **5\) Flows: The End-to-End Lifecycle**

## **Phase 0 — Feature bootstrap**

**Human**

* picks the Feature Spec doc (or creates it from a template)

**Extension**

* validates YAML header exists (or scaffolds it)

* computes feature\_id

* links/creates roadmap doc

* initializes court record directory

---

## **Phase 1 — Requirements shaping (Human \+ Technical Expert, Historian “light”)**

**Human**

* states objectives / constraints

**Technical Expert**

* iterates on spec quality:

  * scope boundaries

  * required surfaces

  * acceptance criteria

  * invariants and dependencies

**Historian**

* allowed to quote doctrine/spec excerpts and flag conflicts early, but does not block unless a direct invariant violation is introduced.

**Exit criterion**

* Feature Spec header is complete enough to drive roadmap generation:

  * required\_surfaces present

  * invariants present (even if coarse)

  * acceptance criteria present

---

## **Phase 2 — Roadmap synthesis (Technical Expert → Historian → Human)**

**Technical Expert**

* generates phased, non-time roadmap in **both** formats:

  * `roadmap.v1.md` (readable)

  * `roadmap.v1.json` (machine-drivable)

**Historian**

* adjudicates roadmap consistency:

  * do steps cover required\_surfaces?

  * are invariants addressed in early phases?

  * are deferrals explicit and justified?

**Human**

* approves or overrides

* **override requires DecisionTrace** (narrative mutation)

**Exit criterion**

* Roadmap is “Court Approved” and step contracts can be instantiated.

---

## **Phase 3 — Step execution loop (Executor \+ Historian \+ Human)**

This is the heart of your system. Each step has two court passes.

### **Pass A: Plan Adjudication (pre-edit)**

**Executor emits `step.plan.json`**:

* intent

* expected files

* expected validations

* evidence bundle (quoted excerpts \+ IDs)

* surfaces it intends to cover

* deferrals (if any) with reasons \+ future step IDs

**Historian adjudicates**

* CONSISTENT / INCONSISTENT / CONDITIONAL / UNKNOWN

* UNKNOWN/CONDITIONAL \=\> “Blocked. Escalating for clarification” (and lists exact queries)

### **Execution**

Executor performs edits (direct write or via OpenHands), but must end with:

### **Pass B: Patch Adjudication (post-edit)**

Executor (or extension) generates **step patch artifact**:

* `step.patch` \= unified diff

* `step.verify.json` \= command outputs \+ analyzer outputs

**Historian checks**

* letter: does patch implement what step contract promised?

* spirit: does it violate invariants, introduce shortcuts, or omit required components?

* completeness option E: does it plausibly deliver the intended functional increment?

**Human**

* intervenes only if:

  * consensus stalls

  * Historian flags new intent

  * override needed (=\> DecisionTrace required)

**Exit criterion**

* Step accepted and recorded.

---

## **Phase 4 — Debug lifecycle (secondary conversation type)**

When bugs arise, you open a **Debug Conversation** linked to the same feature\_id.

Key capability:

* “Promote Debug Insight” → DecisionTrace or spec patch or regression test requirement.

This is how you close the UX gap you called out: debugging chat becomes durable wisdom.

---

# **6\) Completeness Option E: “Likely Provides Required Functionality”**

With Q23 header, completeness becomes concrete:

### **6.1 Surface coverage signals (deterministic)**

The extension computes surface coverage per step by file/path heuristics \+ tool outputs:

* schema: migrations / ORM schema changes

* backend: API routes/controllers/services

* workflow: durable workflow files, queues, idempotency guards

* frontend: routes/components/hooks/api client usage

* tests: test files changed \+ test results

* docs/observability: as applicable

### **6.2 Historian’s role (judgment \+ exceptions)**

Historian uses:

* step contract

* patch diff

* analyzer outputs

* spec excerpts (quoted)

Flags:

* “frontend required by spec but not yet covered by roadmap phase”

* “this step claimed frontend coverage but patch touched no frontend files”

* “deferral missing future-step reference”

Allows:

* justified deferrals *only if* explicitly recorded with future step IDs.

---

# **7\) Tooling for detections (what you can plug in immediately)**

Given your “yes” to analyzers/AST:

**Baseline now**

* ESLint/TS compiler, pytest, unit/integration/e2e harness

* Semgrep for policy-style rules (auth guard present, tenant context calls, etc.)

* SonarQube for broad quality/security signals

**Deeper semantic checks (custom)**

* ts-morph / TypeScript compiler API for route wiring, handler patterns, idempotency enforcement, RLS context usage

* tree-sitter for multi-language structural checks

Crucially: these tools feed the Historian as **evidence**, not retrieval.

---

# **8\) What I’d implement first (to de-risk)**

If you’re sequencing the build:

1. Feature bootstrap \+ header enforcement \+ feature\_id

2. Roadmap dual-output generation \+ “coverage matrix”

3. Step plan adjudication (Historian pre-pass)

4. Patch artifact capture \+ diff panel \+ command center

5. Patch adjudication (Historian post-pass) with surface coverage signals

6. Court record export pack

This gets you to a usable experimental loop fast.

---

# **One small follow-up question (only because it affects everything)**

Do you want the canonical files to live in a fixed workspace convention, e.g.:

`/specs/features/<slug>.md`  
`/roadmaps/features/<slug>.md`

…or should the extension support arbitrary locations and rely purely on header metadata?

If you don’t answer, the safe default is: **support arbitrary paths**, but offer an optional convention generator.

support arbitrary paths, but offer an optional convention generator.

Understood. That choice is the right one for real-world repos: **metadata-driven linking** with an optional scaffold is the cleanest way to avoid path politics while still enabling automation.

Below is the **finalized “ideal extension” specification at the UX/flow level** (not code), incorporating everything we’ve agreed: single Windsurf-like chat, four personas in one thread, phase gating, patch-per-step court record, completeness inspection, arbitrary spec/roadmap paths, and optional convention generation.

---

# **Ideal VS Code / Open VSX Extension Setup, UX, and Flows**

## **1\) Extension Overview**

**Name (placeholder):** Hestami Court  
 **Core idea:** A Windsurf-like conversational IDE that enforces a governed workflow across four personas (Human, Technical Expert, Executor, Historian) with:

* phase-gated progression

* step contracts

* **pre-step plan adjudication**

* **post-step patch adjudication**

* completeness inspection (option E)

* explicit narrative mutations (DecisionTrace required for overrides)

* exportable “court record packs” for training and audits

---

## **2\) Configuration & Setup UX**

### **2.1 Settings Model (workspace-scoped, supports arbitrary paths)**

The extension stores configuration in `.vscode/settings.json` (or internal storage with export).

**Role backends:**

* Executor provider (e.g., Claude Code / Anthropic)

* Technical Expert provider (e.g., OpenAI)

* Historian provider (local endpoint, e.g., Ollama/vLLM)

**Knowledge roots (arbitrary paths):**

* specs/guidelines/decisions directories and/or file globs

* these are used for: evidence quoting, ID validation, indexing (not inference-time RAG)

**Command approval policy:**

* auto-approved allowlist

* confirm-required list

* denylist patterns

### **2.2 Setup Wizard (first-run)**

1. Configure role providers \+ credential sources (env vars encouraged)

2. Select knowledge sources:

   * “Add files/folders/globs”

3. Command policy:

   * choose baseline preset (safe / balanced / strict)

4. Optional: enable “Convention Generator”

   * offers default directory structure but does not enforce it

---

## **3\) Canonical Artifacts & Identifiers**

### **3.1 Feature identity (metadata-driven, path-independent)**

Feature ID:

`FEAT::<slug>::<hash8>`

* `slug` from spec header

* `hash8` from normalized canonical “spec root” content (header \+ key sections)

### **3.2 Two authoritative docs per feature**

* Feature Spec (PRD/SRD) — human authored

* Implementation Roadmap — human/agent authored, **both MD and JSON**

Both can live anywhere; extension links them by reading their YAML headers.

### **3.3 Generated “Court Record Pack”**

Stored under `.hestami/features/<feature_id>/...` regardless of where spec/roadmap lives.

This pack becomes the durable substrate for:

* auditing

* regression cases

* dataset generation

* distillation triggers

---

## **4\) UI Surfaces**

## **4.1 Primary Surface: Conversation Canvas**

One chat thread, turn-based, streaming.

Each message has:

* persona tag

* phase tag

* feature\_id tag

* optional step\_id tag

### **Controls embedded in chat**

* “Start Feature”

* “Link Spec”

* “Generate Roadmap”

* “Adjudicate Step Plan”

* “Execute Step”

* “Review Patch”

* “Override (requires DecisionTrace)”

* “Advance Phase”

* “Export Court Record”

## **4.2 Feature Panel (sidebar)**

* Current feature summary (from spec header)

* Linked spec \+ roadmap paths

* required\_surfaces checklist

* invariants list

* phase status \+ step list

* coverage matrix status (by phase and surface)

## **4.3 Court Panel (Historian)**

* last verdicts (plan \+ patch)

* open verification queries

* conflicts with citations (quotes \+ IDs)

* narrative update prompts (“Potential narrative mutation detected”)

## **4.4 Step/Diff Panel**

* shows current StepContract

* shows `step.patch` visual diff

* shows “surface coverage signals”

* shows “promised artifacts checklist”

* highlights missing expected outputs

## **4.5 Command Center**

* shows planned commands for this step

* indicates auto-approved vs confirm-required

* stores approvals per workspace/session

* attaches command outputs to step verification artifact

---

## **5\) Workflow State Machine (Phase-Gated)**

### **Phases**

1. **BOOTSTRAP**

2. **REQUIREMENTS\_SHAPING**

3. **ROADMAP\_SYNTHESIS**

4. **EXECUTION** (step loop)

5. **DEBUG** (secondary convo type)

6. **NARRATIVE\_UPDATE** (interrupt-driven subflow)

Only one phase is active at a time; phase changes require explicit action and meeting exit criteria.

---

## **6\) Detailed Flows**

## **6.1 Bootstrap Flow (link spec \+ compute feature ID)**

**Human triggers “Start Feature”.**  
 Extension asks for:

* select spec file (anywhere)

* validate YAML header exists (or scaffold)

* compute feature\_id

* optionally link roadmap file (or scaffold)

Output:

* Feature Panel populated

* Court record directory created

* Conversation scoped to feature\_id

## **6.2 Requirements Shaping Flow (Human \+ Technical Expert)**

* Technical Expert proposes clarifications/structure

* Historian can flag direct conflicts, but typically “light” here

Exit criteria:

* Spec header complete enough to drive roadmap:

  * required\_surfaces set

  * invariants present (even coarse)

  * acceptance story present

## **6.3 Roadmap Synthesis Flow (both formats)**

Technical Expert generates:

* `roadmap.v1.md` (human)

* `roadmap.v1.json` (machine)

Historian adjudicates:

* do phases cover required\_surfaces?

* are invariants addressed early enough?

* are deferrals explicit with future step IDs?

* quotes excerpts \+ cites IDs (for low cognitive load)

Human:

* approves OR overrides (override forces DecisionTrace)

Exit criteria:

* Roadmap “Court Approved”

* Step list instantiated

---

# **7\) Execution Flow (The Core Loop)**

You insisted on:

* every step pre-adjudicated

* historian reviews actual edits

* completeness inspection

So each step has **two mandatory court passes**.

---

## **7.1 Step Pass A: Plan Adjudication (Pre-edit)**

Executor must produce `step.plan.json` containing:

* intent

* surfaces targeted (schema/backend/workflow/frontend/tests/docs)

* expected files / globs

* expected validations

* evidence bundle with quoted excerpts \+ IDs

* deferrals (if any) \+ reasons \+ future step references

Historian returns `step.plan.adjudication.json`:

* label: CONSISTENT / INCONSISTENT / CONDITIONAL / UNKNOWN

* anchor\_sufficiency

* conflicts \+ citations

* required\_verification\_queries

* recommended edits

If UNKNOWN/CONDITIONAL → UI shows:

**Blocked. Escalating for clarification.**  
 and routes conversation to Human \+ Executor \+ Historian until resolved.

---

## **7.2 Step Execution (Actuation)**

Regardless of how edits are made (Claude Code, OpenHands, direct tools), the step must end with a canonical artifact:

### **Canonical requirement: patch-per-step**

Extension generates (or requires Executor to supply):

* `step.patch` \= unified diff of exactly this step’s changes

This is your “hard boundary” for completeness enforcement and future training.

---

## **7.3 Step Pass B: Patch Adjudication (Post-edit)**

Inputs to Historian:

* StepContract (from plan)

* `step.patch`

* current workspace snapshot

* command outputs \+ analyzer outputs (`step.verify.json`)

Historian returns `step.patch.adjudication.json`:

* STEP\_ACCEPTED / STEP\_REJECTED

* missing artifacts checklist

* invariant violations (letter)

* shortcut risks (spirit)

* completeness inspection (option E)

Completeness inspection is driven by:

* required\_surfaces (spec header)

* step’s declared surfaces

* actual touched files \+ analyzer evidence

If rejected:

* Executor must propose a repair plan (which itself is adjudicated)

If accepted:

* step is finalized in court record pack

* optional: commit to a step branch

---

# **8\) Debug Conversation Flow**

A debug conversation is linked to the same feature\_id and can reference:

* prior steps

* patches

* adjudications

* command logs

Key feature:

* “Promote Debug Insight” button:

  * into DecisionTrace (policy/why)

  * into spec patch proposal

  * into regression test requirement

This is how you solve the “chat histories not leveraged” gap.

---

# **9\) Narrative Mutation Flow (Override \= DecisionTrace)**

Any time the human overrides Historian or introduces new “why”:

* extension blocks progress until DecisionTrace is authored and HUMAN\_APPROVED

DecisionTrace wizard:

* drafts rationale

* produces normative outcomes

* links citations and discussion refs (the chat)

* sets lifecycle (ACTIVE/SUPERSEDED/RETIRED)

This triggers:

* dataset generation entries

* optional distillation queueing

---

# **10\) Optional Convention Generator**

Even though paths are arbitrary, the extension can offer:

* “Generate conventional structure”

* “Move linked docs into convention”

* “Create new feature spec \+ roadmap files in convention”

But it never requires it; it just offers it.

---

# **11\) Tooling Hooks (Completeness & Static Analysis)**

Since you said “yes” to deterministic tools:

* SonarQube/Semgrep/TypeScript checks run as evidence producers

* custom AST verifiers attach results into `step.verify.json`

* Historian uses those as evidence, not retrieval

