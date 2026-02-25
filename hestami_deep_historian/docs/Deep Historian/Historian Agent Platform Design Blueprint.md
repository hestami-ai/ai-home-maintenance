# **Historian Agent Platform Design Blueprint**

## **Introduction and Goals**

The **Historian Agent Platform** is a local-first, auditable AI system designed to **evaluate an Executor’s proposal against authoritative specifications**. Unlike a free-form chatbot, it operates as a structured verification pipeline that produces a *grounded, deterministic judgment* with full traceability. Key goals of this architecture include **accuracy**, **correctness**, **completeness**, **determinism**, and **auditability**. To achieve these, the platform separates concerns into distinct components for *authority retrieval*, *logical reasoning*, and *versioned truth state*. Each component has a **non-overlapping epistemic responsibility**, meaning no single module is trusted to do everything; this clear separation is what enables high correctness and auditability.

**Scope:** The initial system runs on a single machine (e.g. one workstation with an RTX 4090 GPU) via Docker Compose, and serves a single human analyst user. All critical processing (the “Historian” agent path) is local for auditability and data security. The design can be extended later for multi-user scenarios and optional cloud helpers, but the core judgment loop remains local-first and reproducible. The following report details the system’s architecture, workflow, data schemas, failure handling, evaluation approach, and an implementation roadmap with deployment specifics.

## **High-Level Architecture Overview**

At a high level, the Historian platform is a **one-way critique pipeline** with a side-channel to consult ground truth (not an open-ended conversation). The major components and their interactions are illustrated below:

           `[ Executor (Proposal) ]`  
                     `│`  
                     `▼`  
      `+---------------------------------+`  
      `|       Historian Orchestrator    |      (Control logic: ensures process)`  
      `+----------------+----------------+`  
                       `|`   
      `+----------Retrieval-----------+        Truth State`         
      `|  PageIndex (Spec Index)      |   ╱╲    Dolt (Database)`     
      `|  - hierarchical TOC index    |  //\\   - versioned specs &`   
      `|  - finds relevant sections   | //  \\    prior interpretations`  
      `+-----------------------------+//    \\`    
                       `│          //        \\`    
                       `▼         //          \\`   
               `Evidence Packets //   Truth    \\`   
            `(authoritative text ╱     Context) ╲  (from Dolt)`   
                       `╲      //                \\`   
                        `╲    //                  \\`   
                         `▼  ▼                    \\`   
                `+-------------+                  ||`  
                `|  Beads Trace| (Reasoning Ledger)||`   
                `+-------------+ (stepwise chain)  || (read-only during run)`  
                         `│                        ||`  
                         `▼                        ||`  
                    `[ Judgment ] <---------------╱╲`   
                 `(Verdict + citations + optional corrections)`

**Figure: Architecture Diagram –** *The orchestrator decomposes the proposal and orchestrates retrieval from PageIndex and truth lookup from Dolt in parallel. Evidence is then fed into a stepwise reasoning trace (Beads), leading to a final judgment. Humans can later update the truth state in Dolt based on the outcome.*

Each component is described below along with its role and justification:

* **Executor Proposal:** *Input.* A structured document from a human or another agent (the “Executor”) describing a plan, design, or code to be verified. It typically contains the proposed solution and its assumptions, decisions, requirements, etc.. Importantly, the proposal itself is treated **only as a subject for verification, not as truth**. Nothing in it is trusted without evidence – this ensures the Historian’s outputs are always grounded in authoritative sources, not the proposer’s claims.

* **Historian Orchestrator:** *Control plane.* The orchestrator is a deterministic controller that **enforces a disciplined verification process**. It doesn’t answer questions or make subjective judgments itself; instead, it breaks the proposal into checkable pieces and manages the flow through subsequent stages. Key duties include **Claim Decomposition** (parsing the proposal into discrete claims, assumptions, etc.) and setting **Coverage Expectations** (deciding which areas of the spec or rules *must* be checked for completeness). By enforcing a fixed sequence of steps and rules, the orchestrator guarantees **process determinism** – every run on the same input and knowledge base will follow the same steps – and thus results are reproducible and auditable. DBOS is the preferred component for workflow and durable execution and durable queues requirements and implementation.

* **PageIndex (Spec Document Index) \[**https://github.com/VectifyAI/PageIndex\]**:** *Authority retrieval.* PageIndex is the platform’s **knowledge oracle for official specs**. It ingests large authoritative documents (standards, requirements, manuals, etc.) and builds a **hierarchical index (tree)** akin to an intelligent table-of-contents. Instead of using vector search on arbitrary text chunks, PageIndex indexes documents into logical sections and uses *reasoning-based retrieval* to navigate them. This yields highly relevant, stable sections of text. PageIndex can answer questions like *“Where exactly in the spec is X stated?”* by returning the **precise section or page reference with the content**. It provides **structured, context-preserving evidence** rather than fuzzy semantic matches. Crucially, PageIndex *does not perform any reasoning or interpretation* of its own – it simply fetches authoritative excerpts and citations from the documents. The output of a PageIndex query is an **Evidence Packet**: an immutable bundle containing the document ID, section identifier, page range, and the actual snippet of spec text or summary of it. PageIndex’s approach (no vectors or chunking) improves accuracy and traceability; every result is a human-comprehensible section with a stable reference. In tests, such a **tree-based retrieval** method can dramatically improve accuracy (e.g. 98.7% on a finance document benchmark) over traditional embedding-based search. By organizing knowledge like a human would (via a TOC and reasoning to find relevant parts), PageIndex ensures that evidence is directly **relevant and citable**, supporting the Historian’s grounded reasoning.

* **Dolt (Versioned Truth State) \[**https://github.com/dolthub/dolt\]**:** *Authoritative truth database.* Dolt is a **Git-for-data** SQL database that acts as the Historian’s memory of accepted truth. It stores the official specification versions and any established interpretations, previous rulings, exceptions or domain “ground truth” facts. Dolt enables branching and versioning of data just like code: one can fork and merge the knowledge base and query historical versions by commit hash. In our system, Dolt’s primary role is to answer **“what do we currently believe to be true?”** as a complement to PageIndex’s **“what do the documents literally say?”**. For example, Dolt can tell which version of the spec is current, whether a certain rule has known exceptions, or if a similar proposal was previously deemed non-compliant. During a Historian run, Dolt is **consulted in parallel** with PageIndex: while PageIndex fetches raw text, Dolt provides context like *“this section was updated in commit X”* or *“that requirement was interpreted by a past verdict Y”*. Importantly, Dolt is **read-only during the analysis phase** – the Historian will never write to the truth store mid-run. Any changes to truth (like adding a new interpretation or correction) happen after the run, subject to human validation (just as code is reviewed before merging). This ensures determinism and consistency: the reasoning process always uses a fixed snapshot of truth (identified by a `spec_commit` hash), avoiding race conditions. Dolt’s **branching and commit mechanism** also means we can sandbox changes or maintain multiple baselines (e.g. different spec versions for different projects) and always reproduce a run by referencing the same commit of the database. In short, Dolt provides a **ground truth ledger** that the Historian trusts, with full traceability of how that truth has evolved over time.

* **Evidence Packets:** *Intermediate artifacts.* Once PageIndex and Dolt have delivered results, the orchestrator combines them into **Evidence Packets** – these are the fundamental units of *grounded context* that will be fed into reasoning. An Evidence Packet contains **raw authoritative text (from PageIndex)** contextualized by any **relevant truth metadata (from Dolt)**. For example, a packet might contain a requirement paragraph from the spec *plus* a note that “this requirement had a known exception approved in March 2025 (ref. commit abc123 in Dolt)”. Evidence packets are **immutable and traceable** through the rest of the pipeline – they are essentially the “facts on the table” that the reasoning engine must consider. This separation ensures that the LLM reasoning component (described next) operates only on verifiable, *cited* information rather than model hallucinations.

* **Beads Trace (Reasoning Ledger) \[**https://github.com/steveyegge/beads\]**:** *Stepwise reasoning and trace.* **Beads** is the subsystem responsible for performing and recording the logical reasoning steps the Historian takes. It acts as a **ledger or log of the chain-of-thought**, implemented as an append-only graph of reasoning “events”. Each **bead** in this chain represents a single reasoning operation, for example: mapping a claim to a specific requirement, interpreting the meaning of that requirement, comparing the proposal’s behavior against that requirement, highlighting a contradiction or ambiguity, etc.. Beads takes the Evidence Packets as input and **externalizes the entire reasoning process**: rather than trusting the LLM’s hidden internal chain-of-thought, we force the reasoning to be stepwise and logged. **Critically, Beads captures *process*, not just conclusions**. Every intermediate inference, every rule application or check is recorded as a structured event in the trace. This design prevents “black box” judgments where an answer is given with no explanation. Instead, one can audit the Beads trace to see exactly *why* the system reached a conclusion. Because the trace is structured (a graph of steps with links to evidence and prior steps), we can also apply **validation rules** on it – e.g., **no step can assert a normative conclusion without citing a normative premise** (a rule to catch unsupported claims), or **every violation flagged must point to at least one evidence packet**. Such checks are built in (as we detail in the workflow) to detect logical errors *independently of the final verdict*. The concept is similar to logging a program’s execution or an issue tracker for agents: *each reasoning step is an item that can be examined, tested, even replayed*. In fact, by structuring reasoning as a graph of dependent steps (rather than free-form text), we allow potential replay or partial re-evaluation: if a mistake is found in one step, we could correct that step and replay subsequent steps deterministically. This approach draws inspiration from tools like **Beads by Steve Yegge**, which provide a persistent, dependency-aware graph of tasks for AI agents, stored in a git-backed database. Our adaptation uses a similar principle for reasoning: each reasoning step node can be uniquely identified, versioned, and validated. This makes the agent’s “thought process” not only transparent but also **queryable and checkable** by automated validators or humans (enhancing auditability tremendously).

* **Historian Judgment:** *Output.* Finally, the system produces a **Judgment** artifact, which is the end result of the Historian’s critique. The judgment includes: (1) an overall **verdict** – typically one of **PASS** (proposal is compliant), **BLOCK** (proposal violates some spec rules or requirements), or **REVISE** (proposal is neither clearly compliant nor outright violating, indicating ambiguities or gaps that need clarification); (2) a list of **findings or violations** with explanations; (3) explicit **citations** linking each finding to the supporting Evidence Packet(s), the specific steps in the Beads trace, and the relevant truth references (Dolt commits or entries); and optionally (4) **corrective guidance** – suggestions for how to fix or clarify the proposal. The verdict is generated in a **defensible, traceable manner**: every claim in the output *must* be backed by evidence, and every reasoning step that led there is in the trace. In effect, the final report is not just an answer but a mini audit report with footnotes into the evidence and reasoning. This structure means any stakeholder can drill down from a judgment to *why* it was made – fulfilling the auditability goal. If the judgment is later found to be wrong (e.g., a human discovers a mistake), the system can ingest a **Correction** (via updating Dolt or retraining, discussed later), and because of our structured approach, even the **correction** itself becomes a tracked event for future reference (closing the loop on continuous improvement).

Overall, this architecture ensures that **accuracy emerges from structure and verification, not from hoping an LLM “guesses right.”** By externalizing knowledge (PageIndex), maintaining a durable truth ledger (Dolt), forcing explicit reasoning (Beads), and strictly separating those roles, the Historian agent becomes a *“verifiable epistemic machine”* rather than a generative black box. No claim is accepted without evidence, no reasoning step is hidden, and no truth is altered without human review – these are the pillars that deliver on accuracy, completeness, and trustworthiness.

## **Runtime Workflow: From Claims to Verdict**

The Historian’s runtime behavior can be understood as a **stateful step-by-step process** that the orchestrator drives. It begins when a new proposal is submitted and ends with a final judgment (or a controlled failure). We outline the **end-to-end workflow** here, then detail key stages. This essentially implements a state machine that ensures each required step is completed in order:

1. **Ingest Proposal:** The orchestrator receives the Executor’s proposal. It validates the input format and computes a unique `proposal_id` (e.g., a hash) for tracking. If the proposal is malformed or missing critical fields, the process aborts with an input error (failure mode: `FAIL_INPUT_INVALID`). On success, the Proposal artifact is recorded for reference.

2. **Resolve Truth Baseline:** The system determines which **spec version or truth snapshot** to use for this run. By default, it takes the latest committed version of the specs and interpretations in Dolt (e.g. the `HEAD` of the “specs” branch), recording that commit hash as `spec_commit`. Optionally, the proposal might request an earlier baseline (for example, if the proposal is meant to comply with last year’s standard – in such case the orchestrator will checkout the corresponding Dolt branch or commit). If the specified commit or branch doesn’t exist, it’s a system error (`FAIL_SYSTEM_ERROR`). This baseline step **anchors the entire analysis to a fixed truth version**.

3. **Validate Index Alignment:** Given the `spec_commit` (truth snapshot), the orchestrator checks that the PageIndex is synchronized with it. The PageIndex index of documents should have a version or hash (`index_version`) that corresponds to the same spec data commit; if not, it means the documents and the truth DB are out of sync (e.g., perhaps the spec text updated but the index wasn’t rebuilt). In that case, the run fails with `FAIL_AUTHORITY_MISMATCH`. This is a **hard gate** – we refuse to proceed with potentially stale or mismatched knowledge. The remedy is to rebuild or update the index for that spec version, then retry. This check ensures that the evidence we retrieve will actually match the authoritative truth version we consider. On success, the PageIndex version is recorded and we move on.

4. **Decompose Claims:** The proposal’s text is parsed into a **ClaimSet** – a structured list of all verifiable statements, assumptions, decisions, and any apparent omissions. This uses natural language parsing or a prompt-based extraction with the LLM (in a controlled manner) to identify every factual or normative claim the proposal makes that **should** be checked. For example, if the proposal says “We will encrypt data at rest using AES-256”, the claim might be “Data is encrypted at rest with AES-256”. Assumptions or implicit claims are also captured (e.g. “the threat model excludes physical attacks” might be an assumption). If this yields nothing (no claims) or is structurally invalid, it’s an `FAIL_INPUT_INVALID` because there is nothing to verify or the input couldn’t be understood. The result is a **ClaimSet artifact** listing all these items (with IDs for each claim and category tags perhaps).

5. **Generate Coverage Plan:** Before looking anything up, the Historian defines **what “complete” verification looks like** for this particular proposal. Using a set of heuristics and rules, it generates a **CoveragePlan** – essentially an enumeration of spec topics or sections that should be consulted given the proposal’s scope. For instance, if the proposal is about a database system, the plan might say: *relevant spec domains \= {security, auditing, performance}* and within security, must cover *{authentication, encryption, access control}* etc. It may list expected *“invariants”* or important requirements that must be checked. The idea is to establish a *priori* what a thorough job means, so we can later detect if we missed something. This addresses completeness: the system doesn’t just wander through whatever the model happens to find, but actively checks off all areas that *should* be covered. If the CoveragePlan generation fails (e.g., internal error) it’s a system error. The output is a structured plan listing expected spec nodes or requirement IDs.

6. **Build Retrieval Plan:** Given the claims and the coverage expectations, the orchestrator formulates a set of queries for PageIndex (and possibly strategies) to retrieve evidence. This **RetrievalPlan** is essentially a list of search queries or lookups to perform. For each claim and each expected spec node, we create specific queries – for example:

   * *Lookup requirement:* Find the section of the spec that defines the requirement related to this claim.

   * *Find constraints:* Search the spec for any constraints or limits relevant to the claim (e.g., “max password length” if claim is about passwords).

   * *Search exceptions:* Query Dolt/Truth for known exceptions or prior decisions related to this area.

   * *Counter-evidence:* **Critically, include at least one query designed to find *contradictory or disconfirming evidence*** for each major claim. This ensures we’re not just looking to confirm the proposal, but also actively trying to refute it if possible (a key to avoiding oversight bias).

7. The RetrievalPlan might also encode **deterministic retrieval settings** (like specifying that PageIndex should enforce using TOC structure and exact section titles when searching, to avoid semantic drift). If for some reason a critical claim has no counter-evidence query planned, that’s treated as a workflow error (`FAIL_SYSTEM_ERROR`) because it violates our *accuracy-first* policy of always checking for negatives. The output is essentially a list of `(query, intent)` pairs.

8. **Retrieve Evidence:** Now the orchestrator executes the RetrievalPlan. It sends queries to **PageIndex** and collects the resulting **EvidencePacketSet** artifact. Each query yields zero or more Evidence Packets (doc section \+ snippet). The system monitors the retrieval process for **stability**: if repeated queries or slightly perturbed queries yield significantly different results or lots of variance in sections (high “node entropy”), that indicates *retrieval instability*. PageIndex’s reasoning-based search should generally be stable (it’s guided by structure, not random embedding scores), but if the LLM component in it introduces nondeterminism, we measure it. For example, we might run each query twice and compare the sets of top results; if the overlap is below a threshold, we flag instability. An unstable retrieval triggers `FAIL_RETRIEVAL_INSTABILITY` – meaning the evidence is not reliable. In that case, we can attempt mitigations: e.g. **enforce TOC anchors or stricter search heuristics, reduce breadth or use higher confidence cutoff, or even fix a random seed for the LLM inside PageIndex** and then **redo the retrieval**. The system will not proceed until the evidence retrieval is deterministic within acceptable bounds (to maintain overall determinism). Assuming success, we end up with **EvidencePacketSet** – a collection of all evidence gathered, each packet labeled by which claim or coverage item it addresses.

9. **Assemble Truth Context:** In parallel with evidence retrieval (or right after), the orchestrator queries **Dolt** for any **TruthContext** relevant to the evidence found. This means: for each spec section or requirement we retrieved, check if Dolt has entries about it – e.g., previous judgments, interpretations, notes about deprecation, etc. Also fetch any known **exceptions or waivers**: for instance if the evidence packet is about “Requirement X must always be done”, Dolt might contain an exception “In project Y, Requirement X was waived under conditions Z”. These truth context elements are compiled into a `TruthContext` object keyed by requirement or section IDs. Essentially, this gives the reasoning engine additional “side notes” about how to interpret the raw text. If Dolt query fails (e.g., DB not responding), that’s a system error fail. On success, we now have the twin inputs for reasoning: the evidence packets (what the spec says) and the truth context (how we currently interpret those specs or any known special cases).

10. **Construct Beads Trace (Reasoning):** With all relevant information in hand, the Historian now performs the reasoning steps to compare the **claims vs. the truth**. This is done in a structured way, populating the **BeadsTrace**. For each claim from the proposal, the orchestrator (through prompt templates or logic) goes through sub-steps such as:

    * **CLAIM\_PARSE:** Ensure the claim is understood and identify the key requirement or question it poses (this might involve rephrasing the claim).

    * **EVIDENCE\_SELECT:** Link the claim to one or more Evidence Packets (from the EvidencePacketSet) that are relevant. Essentially, *attach supporting excerpts* that relate to this claim. If none are found for a particular claim, that’s a red flag (potentially an omission).

    * **INTERPRET\_REQUIREMENT:** Using the spec text and truth context, interpret what the requirement means in this context. For example, if the claim is “we do X”, and the spec says “X shall be done under conditions Y”, interpret whether those conditions hold.

    * **COMPARE:** Compare the proposal’s claim or design to the requirement’s expectation. Is it fully compliant? Partially? Does it violate something? This step uses the evidence and truth context to reason.

    * **VERDICT\_STEP:** Tentatively label the claim as compliant, non-compliant, or uncertain with respect to that specific requirement.

    * **UNCERTAINTY\_FLAG:** If any ambiguity or missing information is identified (perhaps the evidence is unclear, or the proposal omitted something necessary to judge), mark this claim with an uncertainty flag for follow-up (could translate to a “Revise” outcome).

11. These steps can be implemented via a sequence of LLM prompts or a single prompt that is instructed to produce a structured reasoning path. Given our emphasis on determinism, a **stepwise prompting** approach is helpful: e.g., first prompt the model to retrieve the exact relevant law from the evidence (closed-book, since evidence is provided), then separately prompt to evaluate compliance. This reduces the chance of skipping logic. All intermediate results are added as nodes in the **Beads graph** along with references (which evidence was used, which truth context applied). The trace is stored as an **append-only log** (with timestamped or indexed events).

     While constructing the trace, the orchestrator also checks some **guards**: e.g., if a claim was identified as a potential “blocker” (critical requirement) but ended up with no supporting evidence attached, that indicates an incomplete reasoning (`FAIL_TRACE_INVALID`). Also, recall we required *counter-evidence queries* for critical claims; here we ensure each such claim has at least one “counter-bead” considering a negative scenario. Failing these will trigger a trace invalid failure, which could prompt re-running this step with stricter reasoning prompts or logic fixes. Assuming all goes well, we now have a complete **BeadsTrace** capturing how each claim fared against the evidence and truth rules, step by step.

12. **Validate Trace and Coverage:** Before finalizing the verdict, the orchestrator performs a rigorous self-check on the results:

    * **Trace validation:** Apply a series of logical consistency rules to the Beads trace. For example: *“No normative conclusion without a cited normative premise”* (ensuring every decision in the trace references evidence), *“Every violation flagged must have at least one evidence packet pointer”*, *“Contradictory intermediate findings are resolved or explicitly marked”*, and a check that each claim’s reasoning depth meets a minimum (no claim was judged in a single step if policy says we expect multi-step analysis). These rules catch any internal incoherence or missed reasoning steps.

    * **Coverage validation:** Now compare the evidence and trace against the original **CoveragePlan**. Did we retrieve and consider all the spec sections we said we needed to? Compute a **coverage ratio** \= (number of expected nodes covered / total expected). If this ratio is below a configured threshold (say we only covered 70% of what we planned) *and* there’s no acceptable justification (the system can allow omissions if explicitly justified, e.g., “not applicable because…”), then we have a `FAIL_COVERAGE_GAP` situation. That means the analysis is incomplete. The policy in an accuracy-first mode is to treat that as a failure unless explicitly allowed to degrade to a “Revise” verdict. In case of failure, the orchestrator could attempt recovery: perhaps go back to retrieval with an expanded plan for the missing pieces, or if allowed by config, issue a **REVISE** verdict indicating the proposal needs to supply more info (the difference is a matter of policy; we assume by default we want hard completeness, not partial).

13. If any trace rule violations remain, that’s `FAIL_TRACE_INVALID` as well. The outputs of this validation stage are a **validation report** and metrics like coverage ratio.

14. **Emit Judgment:** If all validation passes, the orchestrator now determines the final verdict and compiles the **Judgment** artifact. The logic is roughly:

    * If any *validated* blocker (critical violation) exists, verdict \= **BLOCK**.

    * Else if there were unresolved ambiguities or missing coverage (but policy allowed non-fatal), verdict \= **REVISE** (basically a “not ready for pass”).

    * Otherwise, verdict \= **PASS** (fully compliant).

15. The Judgment object includes a list of **findings**, each referencing:

    * the related claim(s) from the ClaimSet,

    * the specific spec requirement or section (with evidence packet citation) involved,

    * the reasoning step(s) in Beads that led to this finding (so one can pinpoint where in the trace this conclusion comes from),

    * and a classification (violation, concern, or confirmation).  
       It also includes any **corrections or guidance**: for example, if verdict is REVISE or BLOCK, the system might include suggestions extracted from the reasoning on how to address the issues (e.g. “Add X to the design to meet requirement Y”). All references are explicit: even a Block verdict must list exactly which evidence and trace step back it up (we also enforce that no **BLOCK** decision is allowed unless it’s backed by cited evidence and a trace reference). This makes the judgment auditable and easy to justify. The judgment is then output (e.g., as a structured report).

16. **Package Audit Bundle:** Finally, the system packages everything – Proposal, ClaimSet, CoveragePlan, RetrievalPlan, EvidencePacketSet, TruthContext, BeadsTrace, Judgment, plus run metadata (timestamps, version hashes, etc.) – into an **AuditBundle**. This bundle is an immutable record of the entire process. It can be persisted (e.g., stored on disk or in an archive database) so that any third-party auditor or future engineer can reload it and **replay the analysis** exactly or inspect any piece. The AuditBundle contains checksums and the spec/truth version IDs to ensure integrity. After packaging, the workflow ends (`DONE` state).

If any failure state was triggered along the way, the process may terminate early *with a failure output* rather than a normal judgment. Each failure state emits a clear explanation and often a recommended recovery path (for an operator or for automatic retries). For example, `FAIL_AUTHORITY_MISMATCH` will output a message that the spec index is out of date and must be rebuilt for commit X; `FAIL_RETRIEVAL_INSTABILITY` outputs metrics (like entropy or divergence in results) and suggests using stricter retrieval settings or rerunning the retrieval step with adjustments. We will discuss all failure modes and mitigations in a later section.

This stepwise runtime workflow ensures **coverage (by planning what to check), grounding (by retrieving actual spec text), reasoning transparency (by recording chain-of-thought in Beads), and rigor (by validating the reasoning and coverage)**. By the time we output a verdict, we have high confidence in its completeness and correctness, or we explicitly mark where confidence is lacking (Revise).

The approach of splitting retrieval and generation also aligns with best practices in RAG (Retrieval-Augmented Generation) systems: one should *evaluate and ensure the retriever’s quality and the generator’s faithfulness separately* to isolate issues. Our design does exactly that – retrieval is constrained and verified before reasoning proceeds. Moreover, by requiring every answer to be supported by retrieved context, we enforce **faithfulness** (groundedness): *Every claim in the output must be directly supported by evidence from source documents*, which is indeed considered the most critical metric in RAG evaluation.

## **Data Artifacts and Schemas**

Throughout the workflow, the Historian produces **structured artifacts** that encapsulate the state at each stage. Defining clear schemas for these artifacts is important for determinism, caching, and auditability. Below we outline each major artifact and its schema/contents:

* **Proposal:** The input object containing the Executor’s plan. Schema: `{ proposal_id, content, metadata }`. The `content` may have sub-fields like `plan_text` (free-form description), and possibly structured subcomponents (e.g. lists of assumptions, goals if provided explicitly). It’s stored upon ingestion for reference. The key property is the `proposal_id` (e.g., a hash or UUID) which ties all subsequent artifacts to this proposal.

**ClaimSet:** Parsed claims and related statements extracted from the proposal. Schema (conceptually):

 `ClaimSet:`  
  `proposal_id: <ref>`  
  `claims:`  
    `- id: C1`  
      `text: "...some verifiable claim..."`  
      `type: "requirement_claim" | "factual_claim" | etc.`  
    `- id: C2, text: "...", type: "assumption"`  
    `...`   
  `assumptions: [ list of claim IDs or texts that are assumptions ]`  
  `decisions: [ list of claim IDs that represent design decisions ]`  
  `omissions: [ list of expected items that were not found in the proposal ]`

*  Essentially, it’s a breakdown of the proposal into atomic checkable units. Each claim could also include references to where in the proposal text it came from (offsets or section IDs), which aids traceability. The ClaimSet is **immutable** once created; it’s used to drive retrieval and reasoning.

**CoveragePlan:** A description of what topics or spec sections need to be covered. Schema idea:

 `CoveragePlan:`  
  `expected_sections: [ {id: S1, description: "Security > Encryption"}, {id: S2, description: "Auditing > Logs"} ... ]`  
  `must_check_invariants: [ "All user data must be encrypted at rest", ... ]`  
  `critical_claims: [C1, C3]  # references to claims that are critical`   
  `notes: "...", # any reasoning or heuristic notes`  
  `coverage_threshold: 0.9  # e.g., 90% coverage required`

*  This plan is used later to measure coverage.

**RetrievalPlan:** The set of queries to run against PageIndex (and possibly Dolt for truth lookups). Could be represented as a list of query specifications:

 `RetrievalPlan:`  
  `queries:`  
    `- target: "PageIndex"`  
      `type: "lookup_requirement"`  
      `claim_ref: C1`  
      `query_text: "Find section on encryption at rest"`  
    `- target: "PageIndex"`  
      `type: "counter_evidence"`  
      `claim_ref: C1`  
      `query_text: "Find conditions where encryption at rest might not be required"`  
    `- target: "Dolt"`  
      `type: "prior_rulings"`  
      `topic: S1`  
      `query: SELECT * FROM rulings WHERE section=S1 ...`  
    `...`

*  Each query entry notes its purpose. This plan is mainly for orchestration; often it may not be explicitly serialized beyond logging, but it’s useful for debugging and repeatability (and could be included in the AuditBundle).

**EvidencePacketSet:** The collection of evidence packets retrieved from PageIndex (and possibly enriched with truth context). Each **EvidencePacket** has a schema like:

 `EvidencePacket:`  
  `packet_id: E123`  
  `doc_id: "SpecGuide_v3.pdf"`  
  `section_id: "Section 5.4.2"`  
  `pages: [32, 33]  # page numbers or a range`  
  `content: "... exact excerpt or summary ..."`  
  `source: "PageIndex"`  
  `related_claims: [C1]`  
  `retrieval_trace: "TOC path: Security > Encryption > At Rest"`

*  This captures the minimal snippet of authority needed. If summarization is used (e.g., if the relevant section is very large, we might include a summary), it should be noted, but ideally we keep the actual text for auditability. The `related_claims` field links to which claim(s) this evidence was meant to inform. The `retrieval_trace` might contain how it was found (useful for debugging PageIndex behavior). The **EvidencePacketSet** is just an array of such packets. This artifact is central for grounding – all further reasoning references these packets by ID.

**TruthContext:** The data retrieved from Dolt relevant to the evidence. Could be represented as a mapping of keys (requirement IDs or topics) to information:

 `TruthContext:`  
  `spec_version: <spec_commit_hash>`  
  `context_map:`  
    `"Section 5.4.2":`   
       `- type: "interpretation"`  
         `text: "Per ruling 2024-01, 'encryption at rest' was defined to include cloud storage."`  
       `- type: "exception"`  
         `text: "Project X was exempted from this due to hardware limitations."`  
    `"Section 3.1":`  
       `- type: "deprecation"`  
         `text: "Algorithm XYZ no longer approved as of spec v3.1"`  
    `...`

*  This gives the reasoning engine additional “facts” that aren’t in the raw spec text but are considered true in our organization’s context (and have been stored in Dolt via prior human decisions). TruthContext entries should be treated similarly to evidence (they should be cited if used). In implementation, this may be fetched via SQL queries (Dolt being MySQL-compatible).

**BeadsTrace:** The reasoning trace structure. We can model it as a directed acyclic graph (DAG) of nodes (beads) and edges (dependencies or sequence). A simplified representation might be:

 `BeadsTrace:`  
  `beads:`  
    `- id: B1`  
      `type: "CLAIM_PARSE"`  
      `claim: C1`  
      `result: "Identified requirement: 'All data must be encrypted at rest'."`  
    `- id: B2`  
      `type: "EVIDENCE_SELECT"`  
      `claim: C1`  
      `evidence_refs: [E123, E124]`  
      `result: "Relevant spec text found."`  
    `- id: B3`  
      `type: "INTERPRET_REQUIREMENT"`  
      `claim: C1`  
      `truth_refs: [interpretation_X]`  
      `result: "'Encrypted at rest' includes DB files and backups."`  
    `- id: B4`  
      `type: "COMPARE"`  
      `claim: C1`  
      `conclusion: "Violation"`  
      `detail: "Proposal says user data not encrypted on backup."`  
    `- id: B5`  
      `type: "VERDICT_STEP"`  
      `claim: C1`  
      `provisional_verdict: "BLOCK"`  
      `justification_refs: [B2, B3, B4]`  
    `...`  
  `edges:`  
    `- from: B1, to: B2   # sequence or dependency`  
    `- from: B2, to: B3`  
    `- from: B3, to: B4`  
    `- from: B4, to: B5`  
    `...`

*  Each bead node contains fields like `type` (the reasoning action), references to claims, evidence, or truth used, and a result or conclusion. The edges show how beads connect (often mostly sequential, but can branch if parallel reasoning happens or join if multiple inputs needed). The trace might also be stored in a log form (each bead with a timestamp or index). The key is that **every decision made is one bead**. This trace is stored durably (e.g. could be stored as JSON lines, or even in Dolt or another database with commit \= run\_id for replay). Because the trace is data, not just text, we can write validators to traverse it.

**Judgment:** The final result object. Schema example:

 `Judgment:`  
  `run_id: <unique id for this run>`  
  `verdict: "BLOCK"  # or PASS/REVISE`  
  `findings:`  
    `- claim: C1`  
      `outcome: "violated requirement"`  
      `requirement_id: "Section 5.4.2"`  
      `evidence: [E123]`  
      `trace: [B4, B5]  # referencing which beads led to this`  
    `- claim: C2`  
      `outcome: "compliant"`  
      `requirement_id: "Section 3.1"`  
      `evidence: [E200]`  
      `trace: [B10]`  
    `...`  
  `issues: []  # any general issues not tied to a single claim`  
  `corrections:`   
    `- "Consider encrypting database backups to comply with Section 5.4.2."`  
  `audit_trail_refs:`  
    `spec_commit: <hash>`  
    `index_version: <id>`  
    `trace_hash: <hash of BeadsTrace or link to AuditBundle>`

*  Essentially, it lists each claim and the final judgment on it (or groups of claims if appropriate), with references back to evidence and reasoning. The `verdict` at top is overall – e.g. BLOCK if any finding is blocking. The structure ensures **every finding is backed by something**. The corrections/guidance field is optional, containing any advice. Audit trail refs include the identifiers needed to retrieve the full context (for instance, you might store a hash or ID for the trace or just rely on run\_id to get the AuditBundle).

* **Correction:** (Not a primary artifact in the run, but worth defining.) If a human reviewer finds an error in the judgment or wants to update the truth state, they would issue a Correction which results in an update to Dolt (or in retraining data). A Correction could be as simple as a record: `{ run_id, issue_description, resolution }` with resolution being either *“adjust truth (Dolt) with X”* or *“mark model error for training”*. Corrections get applied outside the automated run, but we mention them because the architecture allows ingesting them back: e.g., after a correction, one could re-run the Historian on the same proposal with the updated truth to see if the verdict changes to PASS, etc. The system could treat a Correction as an event to learn from (discussed in training section).

* **AuditBundle:** A comprehensive bundle that contains all the above in one package (likely a directory or archive with JSON files, or an entry in a database linking them). The AuditBundle schema is basically: `{ Proposal, ClaimSet, CoveragePlan, RetrievalPlan, EvidencePacketSet, TruthContext, BeadsTrace, Judgment, metadata }`. It may have checksums and version info to ensure integrity (for example, storing the hash of each component, the versions of the software or model used, time taken for each step, etc.). This is what someone can use to fully **audit or replay** the run. Because each artifact is immutable and identified (with hashes/IDs), the AuditBundle also allows caching and reuse (e.g., if one claim or one evidence appears in multiple runs, we can reference it rather than duplicate it, if we had a system to manage that).

All these artifacts can be serialized as JSON/YAML or stored in databases. They form a **structured data trail** of the reasoning. By having explicit schema, we avoid free-form text that’s hard to parse or compare. For instance, we can **cache** an EvidencePacket for “Spec section 5.4.2” under a certain spec version, so that if another run needs it, it could retrieve it without re-querying PageIndex (if performance became an issue). Similarly, having ClaimSet and CoveragePlan in machine-readable form means we can quickly compare two runs to see if they covered different areas, etc.

## **Determinism and Caching Strategy**

Determinism is a core goal: given the same input and knowledge base, the Historian should produce the same output every time. Achieving this in an LLM-powered system requires careful control of randomness and caching of intermediate results. Our strategy includes:

* **Single-Threaded, Single-Task Operation:** We run one workload (proposal analysis) at a time on the GPU. This avoids nondeterminism from concurrency or resource contention. The orchestrator strictly sequences steps; even if parallelizing retrieval and truth lookup for speed, we treat them as effectively deterministic functions.

* **LLM Inference Determinism:** We use **vLLM** as the inference engine for any LLM calls, configured in a deterministic manner. vLLM is an optimized inference library that can serve models with high throughput, but importantly it can be run with fixed random seeds and controlled sampling. We will generally use **greedy decoding or low-temperature sampling** for reasoning steps to minimize randomness. If multiple answers are needed (e.g., PageIndex may do some tree search reasoning internally), we can either fix a seed or run multiple times and verify consistency. vLLM itself provides an OpenAI-compatible server which we can run locally, giving us easy integration with libraries that expect an OpenAI API. By self-hosting the model, we remove external API nondeterminism and latency variance. vLLM’s efficient memory management (via *PagedAttention*) means we can handle long context (spec sections \+ chain-of-thought) on a single 24GB GPU by optimizing KV cache usage. This efficiency doesn’t directly affect determinism, but ensures that even if our prompt sizes vary, the model won’t run out of memory or require truncation (which could introduce nondeterministic truncation behavior). vLLM allows continuous batching of requests, but since we’re mostly sequential, we may not use that – however, it means if we needed to say query multiple spec sections in parallel, vLLM can batch them behind the scenes deterministically (the results are as if run one-by-one, just faster). We will also pin the model weights and version – e.g., use a specific Llama2 13B model fine-tuned for our domain (discussed later) – and not change it during a run. All LLM calls should log their prompts and parameters to the AuditBundle so we know exactly what was asked. Where possible, we favor **prompting the LLM to produce structured output** (JSON or tagged text) for easier parsing, reducing the chance of randomness in format (structure failures are caught by validators).

* **Stable Retrieval:** PageIndex’s design already avoids the inherent randomness of vector search by using a reasoning approach. Still, LLM reasoning can be nondeterministic. To address this, PageIndex queries will use deterministic prompts and possibly multiple attempts: for instance, run the same query twice. If the results differ, that signals instability. PageIndex also supports using the document’s hierarchy (the *tree index*) to constrain searches. We will configure it to rely on section headings and known structure, which yields consistent results (like always retrieving the same section for the same query if nothing changed in the index). We can also set PageIndex to only use our local LLM (via vLLM) and set `temperature=0` for its internal reasoning steps. The **retrieval caching** is important: If the same query is encountered again (even across runs on the same spec version), we could cache the result. For example, if multiple claims ask about encryption, the underlying spec section on encryption will be fetched repeatedly. We could cache EvidencePacket “Spec5.4.2” so that after the first time, further queries return the cached packet instantly, ensuring consistency. Each cache entry would be tagged by `(spec_commit, query_text)` or even better by the specific section ID (since we know exactly what we need, we could directly retrieve by ID once identified). Because the PageIndex returns exact section IDs, it’s easy to use the ID as a stable key. This caching prevents minor differences in phrasing from causing different sections to be chosen. If a new query yields a section we already have, we merge it rather than duplicate.

* **Reuse of Truth Data:** Since Dolt is a database, queries to it are deterministic given a commit hash. We don’t really need to “cache” Dolt responses beyond maybe storing the extracted TruthContext in the AuditBundle for reference – but it’s essentially our source of truth, so it’s fine.

* **Artifact Immutability and Checkpoints:** Each stage’s output is persisted (in memory and/or on disk) before moving on. If a failure or retry happens, we **reuse** previous stages’ outputs rather than recompute them (unless the failure requires changing them). For example, if we fail at retrieval instability, we don’t need to redo claim decomposition – we simply adjust retrieval parameters and hit PageIndex again. By saving artifacts to the AuditBundle incrementally, we can roll back to the last known good state easily. This approach is akin to a **workflow checkpointing**: the FSM states map to checkpointed outputs.

* **Seeding and Randomness Management:** For any component that might use randomness (like perhaps the LLM or if we do any sampling in chain-of-thought generation), we will explicitly set seeds. The orchestrator can generate a random seed at the start of a run (record it in the AuditBundle) and pass that into all random number generators to ensure reproducibility. vLLM’s OpenAI API compatibility allows a fixed `random_seed` through certain parameters or by controlling the underlying model. If not directly supported, we can simulate determinism by using greedy decoding or by customizing the model to produce the same output given same input (which generally holds for LLMs if no sampling).

* **Hard Gating and Policy Enforcement:** Part of determinism is making the outcome less sensitive to subtle prompt variations or model quirks. We implement **hard gates** such as the validation rules (no output unless evidence is present, etc.) so that if the model fails to provide a needed structured element, we consider that a failed step and possibly re-prompt or error out. This prevents the system from silently continuing with a half-baked result. For instance, if a reasoning step should list an evidence ID but the model’s output missed it (structure violation), we catch that and can retry that step with a more constrained prompt. Essentially, any nondeterministic glitch can be turned into a detectable error via these strict output expectations.

* **Caching across runs:** While initial focus is on single-run determinism, we can also leverage caching across runs to improve consistency and speed. For example, if the same spec and a very similar proposal are analyzed, they will likely hit many of the same sections. We could maintain a cache or knowledge store of common Evidence Packets or reasoning snippets. However, caution is needed to ensure we don’t carry over incorrect results. A safer cross-run cache is the **truth state in Dolt** – which we already have. In essence, Dolt can store results of past judgments (which is part of truth). For example, if a particular combination of factors was evaluated before, Dolt might have a record “We previously determined doing X violates Y”. The Historian, by consulting Dolt, is effectively using that cached knowledge rather than reasoning from scratch every single time. This is more of a knowledge reuse than a blind cache, but it serves a similar role: avoiding redoing work that’s been validated before. Also, by branching Dolt for different contexts, we can manage different sets of cached truths for different projects.

* **No External API Variance:** By confining all operations to local services (the local LLM via vLLM, local PageIndex on local docs, local database), we eliminate external API variability or downtime issues. The only optional external calls might be if we allowed a cloud LLM for some non-critical analysis (but in the “Historian path” we wouldn’t, per requirements). If any external call was ever allowed (say for an ancillary agent to suggest improvements), it would not affect the core verdict and would be clearly isolated (and likely not run by default in the local-first mode).

* **Temporal consistency:** Another aspect of determinism is ensuring that if the underlying spec or truth changes, we know it and handle it (which we do by anchoring on commit hashes). Thus a run’s results are always tied to the specific version of knowledge. If you re-run months later on a new spec version, you intentionally might get different results – but that’s controlled, not random. If you want the same result, you use the same commit snapshot.

In summary, through **deterministic prompting, thorough validation, snapshotting of state, and caching at both retrieval and truth levels**, we make the Historian’s output as predictable as possible. Every random element is either eliminated or monitored. This not only aids reproducibility but also performance – caching means repeated analysis of similar issues will be faster (since evidence found once can be reused).

Finally, the entire pipeline can be viewed as a **pure function** `f(proposal, spec_commit) -> judgment` (plus trace) for a given environment. We aim to approach that ideal – any deviation (like nondeterministic intermediate results) is treated as a bug or instability to correct, not an acceptable variation. This discipline aligns with practices in high-assurance systems where processes must be repeatable and auditable.

## **Failure Modes and Mitigations (FMEA)**

Despite best efforts, various things can go wrong in the process. We enumerate the key **failure modes** in an FMEA-style matrix, detailing their meaning, detection triggers, and recovery strategies. The Historian is designed to detect these conditions and either handle them gracefully or halt with a clear error, rather than produce a potentially incorrect judgment silently.

| Failure Mode | Detection / Trigger | Impact | Recovery / Mitigation |
| ----- | ----- | ----- | ----- |
| **FAIL\_INPUT\_INVALID** | \- Triggered if the proposal input fails basic validation: missing required fields, unparsable format, or ClaimSet comes out empty (no verifiable claims). \- Also if any critical structured piece (like assumptions or decisions) is malformed. | The Historian cannot proceed as the input is not analyzable. No judgment is given. | *Mitigation:* Notify the Executor/human of the specific schema errors. The run terminates early with an error report detailing what is invalid. The user must correct the proposal and resubmit. No automatic retry (since the input itself is the problem). |
| **FAIL\_AUTHORITY\_MISMATCH** | \- Detected during the **Validate Index Alignment** step if the PageIndex’s knowledge version doesn’t match the Dolt `spec_commit`. For example, `index_version.spec_commit != spec_commit`. \- This implies the retrieved evidence might come from a different version of the spec than the truth baseline. | Using mismatched data could lead to false conclusions (outdated or wrong spec references). The run is halted to prevent analysis on wrong data. | *Mitigation:* This is a hard failure by design. The system emits an error: “Spec index is out-of-date for the chosen spec version”. **Recovery:** Rebuild or update the PageIndex for the spec version in question, then restart the run from the alignment check. (The orchestrator could optionally automate this: e.g., trigger a re-index job, but likely it’s manual or a separate process). Once PageIndex and Dolt are aligned, rerun from that state. |
| **FAIL\_RETRIEVAL\_INSTABILITY** | \- Occurs in the **Retrieve Evidence** step if the retrieval results are inconsistent or nondeterministic beyond a threshold. We measure something like entropy of the set of nodes returned over multiple tries, or variance in ranks. If, say, the overlap of top-3 results between two runs of the same query is \< X%, or an internal PageIndex confidence score is too diffuse, we flag instability. \- Also if too many results come back (the retrieval is unfocused) or contradictory sections are retrieved each time. | Unstable retrieval means we can’t be sure we got the right evidence; it undermines determinism and could cause incomplete or inconsistent reasoning. | *Mitigation:* The system stops before reasoning and reports which query or topic was unstable, including metrics (e.g. “Query Q1 returned divergent sections with entropy 0.7”). **Recovery options:** The orchestrator can modify retrieval parameters and retry. For example, enforce using strict section anchors or keywords (use the TOC hierarchy more heavily); reduce the number of results K (to focus on top hits); set the LLM to deterministic mode (temperature 0\) for PageIndex reasoning; or even break a query into smaller subqueries. After adjustments, rerun the retrieval phase. The system can do this automatically a limited number of times until stability is achieved, or escalate to human if it cannot stabilize. |
| **FAIL\_COVERAGE\_GAP** | \- Triggered during **Validate Trace & Coverage** if the actual evidence and trace do not cover all items in the CoveragePlan. Specifically, if the coverage ratio (covered vs expected sections) is below the configured `coverage_threshold` and no acceptable justification for skipping exists. \- In practice, this means the system realized “we didn’t check X and Y which we said we should have.” It could be because retrieval missed something or a claim was not addressed. | Indicates a potential *incompleteness* in verification. Without covering those areas, the verdict might miss critical issues. By default, in an accuracy-first stance, this is treated as a non-acceptable outcome (you don’t want to sign off PASS with gaps). | *Mitigation:* The system can take two paths: (a) **Attempt Recovery:** Go back to the RetrievalPlan and add queries for the missed sections (perhaps the CoveragePlan was updated after seeing the trace – e.g., “we never touched the performance section”). Then fetch those and possibly append new reasoning beads, effectively a second pass. This can fill the gap and then re-validate coverage. (b) **Degraded Mode (if allowed):** If policy permits `allow_degraded_mode`, the system could instead issue a **REVISE** verdict, essentially saying “Incomplete – the proposal needs revision or further review on those uncovered points”. This is safer than incorrectly passing. In a strict accuracy-first setting, the default is to treat it as hard fail unless explicitly configured to allow degrade. If emitted as a failure, the output includes which expected nodes were missing and why they matter so the user or developer knows what to do next. |
| **FAIL\_TRACE\_INVALID** | \- Triggered if the reasoning trace violates logical rules or is incomplete. This is checked in **Trace validation** and also during trace construction guards. Examples: a conclusion bead that lacks any evidence support, a logical contradiction in the trace that wasn’t resolved, or missing mandatory reasoning steps (like no counter-evidence considered for a critical claim). \- It can also happen if the LLM’s output for a reasoning step doesn’t meet the schema (e.g., it was supposed to output a JSON with certain fields and didn’t), causing a validation failure. | A trace invalid error means the reasoning process itself failed to adhere to correctness standards – the result cannot be trusted or is not fully justified. No final verdict is given because the reasoning wasn’t sound. | *Mitigation:* The system halts and reports which rule was violated or which beads/evidence are missing (for example, “Claim C3 has a conclusion but no evidence cited”). **Recovery:** Often this involves adjusting the reasoning approach and re-running that stage. For instance, enforce a stricter reasoning prompt or use a smaller step granularity: if the model jumped to a conclusion without laying out premises, we can prompt it in a more step-by-step fashion or add a few-shot example to force proper justification. The orchestrator can then **reset to the CONSTRUCT\_BEADS\_TRACE state and try again** with those adjustments. Additionally, we might plug in a different validator or even an automated theorem prover to double-check steps. Because all prior artifacts are intact, we only regenerate the trace, not the expensive retrieval. In extreme cases, a human might need to intervene to refine the rules or provide a nudge (but ideally not). |
| **FAIL\_SYSTEM\_ERROR** | \- A catch-all for unexpected errors or external issues. This could be failure to connect to Dolt (DB down), running out of GPU memory, an unhandled exception in code, etc. It’s any error not covered by the structured failures above. \- The orchestrator will catch exceptions and funnel them here if possible. | The analysis cannot continue due to an operational fault. No result produced. | *Mitigation:* The system logs the fault details and stops safely. **Recovery:** Typically requires operator intervention: e.g. restart a service, expand GPU memory or fix a bug. After addressing the issue, we can **resume from the last checkpoint** (thanks to our saved artifacts). For instance, if it crashed during retrieval due to memory, we fix memory and then rerun retrieval without redoing claims decomposition, by loading the saved state. The design with persisted outputs and commit IDs helps here: we can jump to the last known good state once the system is fixed. |

In all failure cases, the system’s philosophy is to **fail fast and transparently rather than produce a possibly wrong judgment**. Each failure mode is effectively an **audit checkpoint**: it tells us that the process did not meet the criteria for a reliable outcome. This approach is crucial for high-stakes use – it’s better to have the agent say “I cannot complete this check due to X” than to silently give a pass/fail that might be flawed.

The recovery actions show that many failures are not end-of-story: the design supports iterative improvement. For instance, instability or coverage gaps trigger a loop of evidence gathering or reasoning until stability and completeness are achieved, or a human is asked to step in. Also, because the entire chain is logged, debugging a failure is easier (e.g. if we see a FAIL\_TRACE\_INVALID, we can inspect the trace to see exactly which step was wrong).

**Note:** The configuration has **tunable thresholds** that directly relate to some failures: e.g., `retrieval_instability_threshold` (how sensitive we are to declare instability), `coverage_threshold` (minimum coverage ratio), and whether to allow degrade to REVISE (`allow_degraded_mode`). These would be set in a config file for the orchestrator. For a very strict setting (accuracy-first), we’d set high thresholds and disallow degraded mode, meaning almost any gap triggers a hard fail. In a more lenient mode (perhaps during early testing), one might allow the system to produce a judgment even if not all is perfect, but mark it as such.

This failure-mode analysis not only guides what the system checks, but also forms part of the **evaluation**: in testing, we will deliberately simulate scenarios that should trigger each failure to ensure they are caught.

## **Evaluation Framework and Test Harness**

To ensure the Historian Agent meets its goals, we need a robust **evaluation strategy**. We will evaluate the system on multiple dimensions: **groundedness**, **coverage**, **correctness**, and **calibration** (among others). We also propose a minimal local test harness to continuously verify these metrics during development.

**1\. Groundedness (Faithfulness):** This measures whether the Historian’s outputs (particularly the Judgment and the reasoning steps) are **grounded in the retrieved evidence**. In practice, every claim or decision in the output should trace back to an Evidence Packet or TruthContext entry. We can calculate a metric: e.g., the proportion of assertions in the Beads trace or verdict that are supported by citations. Ideally this is 100%. Groundedness is critical in RAG; a “hallucination” would be a serious failure. We will write tests where we know the correct answer and see if the agent’s explanation sticks to provided documents. For example, if the spec says “A must be B” and the proposal violates that, a grounded answer would explicitly cite “Spec, Sec 1.1: ‘A must be B’” as rationale. We can use automated checks or even LLM-as-a-judge to verify that for each output sentence, there is evidence (though our system already builds that in by design). In effect, our trace validation rules ensure high groundedness, so in evaluation we expect near-perfect scores on that. Any case where the agent output a fact not found in evidence would be a bug.

**2\. Coverage:** We will measure how well the system covers the expected areas (similar to code coverage in testing). The metric could be the **coverage ratio** (as computed in the workflow) – e.g., “90% of expected spec sections were actually referenced.” During evaluation on sample proposals, we will manually identify which spec sections *should* have been looked at and see if the system did. For example, given a proposal about user authentication, did it check the spec’s section on password policies, session timeout, and audit logging (if those were in coverage plan)? If some were missed, that’s a coverage failure. We can create test proposals that deliberately touch multiple spec areas to see if the system catches all. Over time, we refine the CoveragePlan rules until coverage is consistently high. Our target is that **no critical spec topic goes unchecked** – we might set an internal threshold like 95% coverage in tests.

**3\. Correctness:** This is whether the final verdicts and findings are **actually correct** in the sense of aligning with ground truth or expert expectation. This is tricky because it requires a “gold standard” to compare against. We’ll approach this in multiple ways:

* **Unit tests on synthetic scenarios:** We can craft small toy specifications and proposals where we *know* the expected outcome. For instance, a tiny spec might say “All widgets must be blue.” Then test a proposal that has a red widget – expected verdict \= BLOCK. The test harness will run the Historian on this and assert that the verdict was BLOCK and the cited spec rule is the correct one. These controlled tests can measure correctness as simple pass/fail (did it catch the violation or not).

* **Comparison to human judgments:** We will collect a set of real or realistic proposals and have domain experts or ourselves manually determine compliance. Then we run the Historian on them and compare. Metrics like precision/recall can be used on findings: e.g., did the system catch all the issues the human noted (recall), and did it raise any incorrect issues (precision)? A **correctness score** might be percentage of cases where the overall verdict matched the human’s verdict. We aim for very high precision (no false violations) since a false BLOCK could cause unnecessary work, and high recall (no misses) for safety. In early stages, we favor avoiding false passes over false alarms (calibration addresses this).

* **Multi-metric correctness:** sometimes correctness is broken into *answer relevance* and *factual accuracy* in QA contexts, but here the “answer” is a verdict. We mainly care that the verdict label (PASS/BLOCK/REVISE) is correct and each justification is factually correct. We’ll verify factual correctness by checking the cited sources indeed support what is said (which again is part of groundedness).

* We might leverage an **LLM-as-judge** approach in addition to human eval: use a large model to double-check the reasoning. For example, have GPT-4 or Claude review the AuditBundle and ask it “Do you see any mistakes in this reasoning? Should the verdict be different?” as a sanity check. This can help catch subtle logic errors at scale, though we’d be cautious to trust it fully (it’s just another tool).

**4\. Calibration (Uncertainty and Bias):** By calibration we mean that the system’s level of certainty or verdict choice should align with reality. A well-calibrated system will answer “Revise” when it’s not sure rather than guessing. Concretely, we want to minimize cases where the system would say PASS or BLOCK confidently and be wrong (either missed something or flagged something that’s not actually an issue). We can measure calibration in a few ways:

* **Outcome frequency vs. difficulty:** Over a set of test cases, if we deliberately include some ambiguous ones, the system should respond with REVISE in most of those, not incorrectly pass/fail. If the system is over-confident, it might produce PASS when info was missing (a mis-calibration). We will track how often REVISE is used appropriately.

* **False negative/positive rate:** These are essentially calibration errors. False negative \= system said PASS but actually there was a violation (missed it). False positive \= system BLOCKed something that was actually fine (over-cautious or misinterpreted spec). Ideally, with our design, false negatives should be near zero (because of thorough coverage) and false positives low. If any appear in testing, we analyze why: was it a misunderstanding of spec (model issue), or overly strict interpretation? Those inform either model fine-tuning or adjustment of truth context. We can treat the ratio of “revise” outputs to total uncertain cases as a measure of how well it defers judgment when needed.

* We can also perform a **calibration curve** analysis: in some designs, an AI might output a confidence score; ours doesn’t explicitly output one, but we could infer confidence by how many issues it found or how much it had to say. Alternatively, we might incorporate a calibration mechanism such as requiring a certain number of independent reasoning paths to agree before declaring PASS. If we do something like that, we can test different thresholds.

**5\. Other metrics:**

* **Efficiency metrics:** not a primary goal but we will measure runtime, number of LLM calls, etc., on average. This ensures the system is tractable to run locally.

* **Trace consistency metrics:** We might measure average beads per claim, average evidence per claim, etc., to see if the reasoning depth is as expected (e.g., each claim should ideally have \>N beads of reasoning). If too shallow, maybe the model is skipping steps – could signal a need for prompt adjustment.

* **User experience metrics:** If a human is reviewing the output, does the structured report actually help them trust and verify the result? This can be informally tested by giving outputs to users and collecting feedback. For auditability, one could attempt to *audit* a decision using the AuditBundle and see if everything needed is there.

**Evaluation Tools:**  
 We will incorporate existing RAG evaluation tools where appropriate:

* Use **RAGAS or TruLens** to automate groundedness checks and measure relevance. For example, RAGAS can generate a faithfulness score by comparing output to context.

* Possibly use **unit test frameworks** for chain-of-thought (like DeepEval or simply PyTest with our own checks).

* Use a small **benchmark dataset** of spec paragraphs and proposals (we might create something akin to a QA dataset but for spec compliance). We could adapt some QA or closed-book QA datasets to a RAG scenario to test the system’s ability to find the right source and make correct decisions.

**Minimal Viable Test Harness:**  
 We will create a lightweight test harness script that can run the entire Historian pipeline on a set of test inputs and then automatically assess some criteria. This harness might:

* Load a known Dolt database state (e.g., a mini spec and truth base prepared for tests).

* For each test proposal (could be in a YAML with expected outcome annotated), run the Historian (perhaps via a CLI or API) to get the Judgment.

* Compare the actual verdict to expected verdict. Log success/failure.

* Optionally parse the Judgment and ensure that the expected spec sections are cited. For example, if we expected it to mention Section 5.4.2, check that `section_id` appears in evidence.

* If the test includes expected findings, verify each appears.

* Summarize metrics like how many tests passed, coverage stats (we can aggregate coverage\_ratio across tests to see average).

* If any failure modes were expected (we can include a test case intentionally missing info expecting a REVISE or FAIL\_COVERAGE\_GAP), verify that the system indeed triggered the right failure.

This harness would be run locally (no cloud needed) as part of a CI pipeline or just during dev to catch regressions. It enforces that, for example, if we update the model or rules and suddenly the system misses an issue it used to catch, a test fails alerting us.

We will also create some **stress tests**: e.g., a very large proposal to see if performance holds up, or slightly randomized proposals to test stability. Because our system is deterministic, running the same test twice should yield identical AuditBundles (we can even compare hashes to verify determinism on a given machine).

**Agent grounding and auditability evaluation:** Beyond numeric metrics, a key evaluation is qualitative: does the Historian make it easier to audit AI decisions? To evaluate this, we might have a human auditor attempt to verify decisions with and without the Historian. If with the Historian’s output, they can confirm correctness much faster by tracing evidence, that’s a success. Some of this is subjective, but we could gather feedback from a few domain experts on whether they trust the outputs and find the evidence and trace sufficient.

Incorporating evaluation from enterprise AI best-practices: Many organizations emphasize **chain-of-thought monitoring for trust**. We can align our evaluation to those expectations. For instance, check if our logs (Beads trace) indeed provide the defensible trail enterprises want (we expect yes, as we log every decision step). We could simulate a compliance audit scenario and see if an auditor finds what they need in the AuditBundle.

In summary, our evaluation will combine **automated metrics** (for groundedness, coverage, etc.), **targeted tests** for each failure and success scenario, and **human judgment** for assessing correctness on complex real cases. This multi-pronged approach ensures we catch both technical issues and practical efficacy. The end result should be a high degree of confidence that if the Historian outputs PASS, it’s truly compliant with evidence; if BLOCK, it’s truly violating something real; and if it’s unsure (REVISE), that is a correct reflection that more info or human input is needed – aligning system behavior with a calibrated level of trust. As noted in literature, *“faithfulness (groundedness) is the most critical RAG metric”*, so our system is constructed to maximize that, and our tests will keep it so.

## **Model and Data Improvement Plan (Training Strategy)**

While the initial system can leverage a pre-trained LLM (like LLaMA-2 or another 13B model) for reasoning and retrieval, achieving optimal performance and domain specialization will likely require **fine-tuning and iterative training**. We outline a data and model training plan that can be executed on a single RTX 4090 (which is feasible with parameter-efficient fine-tuning like LoRA) and leverages the artifacts and corrections as supervision signals.

**1\. Domain Adaptation via LoRA:** We assume our spec documents and style of reasoning are somewhat domain-specific (e.g., could be regulatory compliance, software security standards, etc.). Fine-tuning the LLM on this domain’s vocabulary and patterns will improve accuracy. Using **LoRA (Low-Rank Adaptation)**, we can train on our 24GB GPU without full model retraining. We’ll gather a corpus of relevant text: the authoritative specs themselves (so the model is familiar with the language), and example Q\&A or reasoning pairs if available. Even without explicit Q\&A, we can use the spec content to further pre-train or instruct-tune the model in an unsupervised way (continued pretraining on domain text). LoRA allows adding these adaptations as small weight matrices, keeping the base model intact.

**2\. Narrative Chain-of-Thought Distillation:** One intriguing approach is to use a more capable model (like GPT-4.5 or GPT-5 in the cloud, if available) to generate **ideal reasoning traces and judgments** for some sample scenarios, and then use those as training data to improve our local model. This is sometimes called *chain-of-thought distillation* or *narrative distillation*. Concretely, we could feed a larger model a spec and a proposal and ask it to "think step-by-step like a compliance auditor" and produce a detailed reasoning (a pseudo-Beads trace) and verdict. We then format that into our structured trace format and include it in a fine-tuning dataset for our local model. The local model thus learns from the "narrative" of a stronger reasoner. Prior research shows that fine-tuning smaller models on chain-of-thought data can significantly improve their reasoning performance. We must ensure the larger model outputs are correct (some manual verification needed), or use multiple prompts to get high-quality traces. Over time, as our own system generates traces, we can also use the best ones as examples to further train (a form of bootstrapping).

**3\. Utilizing Corrections as Supervision:** Every time a human corrects the system (e.g., “the Historian missed that requirement X applies” or “it mistakenly flagged Y”), that’s valuable data. We will log corrections in a structured way, and periodically incorporate them into the training set. For example, if the Historian thought a proposal PASSED but a human found a violation, we create a training example where the input is that scenario and the expected output is to find that violation (with the reasoning). Essentially, corrections become labeled examples of either *false negatives* or *false positives* that the model should learn to avoid. Over time, this will drive down the error rates as the model sees more variations. This is similar to reinforcement learning from human feedback (RLHF), but we can implement it via direct fine-tuning: treat a correction as a demonstration of the correct chain-of-thought and verdict for that case. We might maintain a separate “corrections dataset” and do occasional fine-tune epochs on it.

**4\. Calibration and Uncertainty Training:** If we notice the model is overconfident in ambiguous cases, we can explicitly train it to express uncertainty. For instance, we can include training prompts where the best answer is “I’m not sure due to lack of info” and map that to our REVISE outcome. Techniques like *ask for verification* can be employed: have the model generate its answer and a self-evaluation. However, since our architecture handles uncertainty via explicit rules (if coverage low \-\> Revise), the model itself might not need special training in uncertainty beyond learning to yield multiple options if asked. An interesting idea is to train a **calibration classifier** on top of the trace: i.e., a simple model that looks at the trace and decides if the verdict should be Revise or if any uncertainty flags should be raised. This could be derived from patterns (e.g., many UNCERTAINTY\_FLAG beads \=\> likely REVISE). But this might be overkill; our rule-based approach may suffice.

**5\. Multi-phase Training (Phase-wise improvements):**

* In early phases, focus on getting retrieval prompts right and possibly fine-tune the model on the *retrieval task*. For example, use supervised data of question \-\> relevant section mapping (which could be distilled from PageIndex’s logic). Since PageIndex relies on an LLM to navigate the tree, fine-tuning the model on that procedure (perhaps via examples of how to traverse a TOC) can improve retrieval accuracy. We might generate synthetic queries from the spec and train the model to predict which section is relevant (a form of **self-supervised retrieval training** using the spec structure).

* Next, focus on reasoning: fine-tune on chain-of-thought with known outcomes (like the distilled traces or any existing logical reasoning datasets that fit). Possibly include some public datasets for logical reasoning or policy compliance if any (there might be QA datasets like TruthfulQA, but those are QA style; some custom data creation might be needed).

* Evaluate on a validation set of scenarios after each training iteration to ensure improvement on metrics without overfitting.

**6\. Continual Learning and Branching:** Because Dolt allows branching, we could even branch our knowledge base and model for experiments. For instance, maintain a “stable” branch of truth and a “development” branch where new interpretations are being tested. Similarly, we could have a stable model vs a fine-tuning in progress. We should ensure that when we adopt a new model (with LoRA), we test it thoroughly with the harness to confirm it doesn’t break any existing tests (regression). That becomes part of the acceptance in the roadmap.

**7\. Promotion Gates for Models and Knowledge:** The term "promotion gates" implies having checkpoints that a new model or knowledge update must pass before being promoted to production use. For knowledge (Dolt data), we already require human validation to merge changes to the main truth branch. For models, we should similarly gate: e.g., after fine-tuning a new model version, run all tests, maybe run additional evaluation with human oversight on some cases, and only promote the model if it’s strictly better or at least not worse on critical metrics. This prevents a bad fine-tune from degrading performance. We might keep the previous model around as a fallback if something goes wrong.

**8\. Data Management:** All training and test data (including proposals, spec texts, corrections) should be stored versioned as well, possibly in Dolt or git, to ensure reproducibility of training. The LoRA weights themselves can be versioned (with tags for each training run). We’ll also note that the dataset of reasoning traces and judgments generated by the system over time (with human corrections applied) is a *unique asset* – essentially, we are building a supervised dataset of how to verify specs. This could be used to train even other models or as proof of compliance practices.

**9\. Use of Cloud Models (Optional):** While the core must be local, we have the option to use cloud AI for non-critical tasks. For example, we might use a cloud LLM for **suggesting rephrasings** of claims or providing more fluent explanations in the Judgment (while the local model ensures the facts). Or as mentioned, using GPT-4 to generate training data or even double-check outputs (an AI assistant to the Historian, not in line-of-fire of decision). These usages can improve quality but are outside the core decision loop. If used, we ensure they do not undermine determinism (e.g., only for off-line data generation or as a separate labeled step whose output is also validated by the local system).

In summary, the training plan leverages **small-scale fine-tuning (LoRA)** on domain data, **distilled reasoning traces from stronger models**, and an evolving dataset of **human corrections as supervision**. This continuous learning loop will refine the LLM’s capabilities to better align with the precise requirements of the Historian’s tasks. Over time, the local model should improve in identifying the correct spec sections, following the reasoning discipline, and understanding the nuances of the domain rules, thus reducing the need for human intervention and lowering failure rates. By keeping all training local or in control (and models relatively small), we adhere to the local-first constraint while still benefiting from improvements in model accuracy.

## **Deployment Architecture (Docker Compose)**

The entire Historian platform is designed to be deployable on a single machine using **Docker Compose**, orchestrating multiple services/containers for each component. This section outlines the deployment specification, including how we manage the GPU, networking between components, volumes for data, and configuration of each service.

**Services Overview:** We will containerize at least four main services:

1. **Orchestrator Service** – runs the Historian Orchestrator code (and possibly the Beads logic). This is the brain coordinating everything, likely implemented in Python. It will connect to the other services via network APIs or client libraries.

2. **vLLM Inference Server** – a service providing the local LLM inference (both for the Historian’s reasoning and for PageIndex’s needs). vLLM has an official Docker image or we can build one. It will expose a REST endpoint (OpenAI-compatible API on port 8000 for example), and will be configured to use the GPU.

3. **PageIndex Service** – a service that handles document indexing and retrieval queries. This might be a FastAPI or similar server that upon startup loads the indexed documents (or builds the index if not present) and then listens for retrieval requests (perhaps on HTTP port 8080). We can use the open-source PageIndex code: it likely requires the documents volume and an OpenAI API key. We will **point its OpenAI API calls to our vLLM server** by setting `OPENAI_API_BASE` environment to `http://vllm:8000/v1` and a dummy API key (as vLLM can accept a token). This way, PageIndex’s internal LLM calls are served by our local model. The PageIndex container will mount the volume containing specification documents (e.g., PDF or text files) and possibly a precomputed index if we persist one.

4. **Dolt Service** – a container running the Dolt SQL database server. Dolt can be run as a MySQL-compatible server process on a port (3306 by default). We’ll use the official `dolthub/dolt` image or similar. It will mount a volume for data storage so that the database state (repositories, commits) is persisted between restarts. We might have the Dolt container initialize with a repository containing the spec data and truth state; if not, we ensure we can load data in it via scripts.

Optionally, there could be:

* **Beads Database** – If we decide to store the BeadsTrace in a separate durable store (instead of just in orchestrator memory and in the AuditBundle), we could run a lightweight database or even use Dolt for it. But Dolt could manage an “issues” table for beads since it’s git-backed (or we rely on orchestrator writing trace to file). An alternative is using the **Beads CLI** from Steve Yegge: it’s essentially a git-backed issue tracker. We could incorporate it by having an `agent-beads` container that runs a daemon or just use it via orchestrator invoking CLI commands. However, to keep deployment simpler, we might just handle traces in the orchestrator process for now and consider integrating Beads CLI later for multi-agent or long-term memory. We’ll note how to do it but might not have a separate service.

* **User Interface** (optional) – e.g., a simple web UI or jupyter notebook interface to submit proposals and view results. Not required by prompt, but could ease use. This might be another container (with a web app that calls orchestrator APIs). But in MVP, the orchestrator might just be triggered via CLI or a watched folder.

Now, focusing on the main services and Compose setup:

**GPU Management:** The vLLM container needs access to the GPU. We will use Docker Compose with the NVIDIA Container Toolkit. In the `docker-compose.yml`, for the vLLM service we’ll set:

`deploy:`  
  `resources:`  
    `reservations:`  
      `devices:`  
        `- capabilities: [gpu]`

and also ensure the Docker daemon is configured to use the nvidia runtime (or simply use `runtime: nvidia` in older docker-compose version). We can also pass environment variables like `NVIDIA_VISIBLE_DEVICES=all` or a specific index, and `NVIDIA_DRIVER_CAPABILITIES=compute,utility`. Only the vLLM container (and possibly PageIndex if it uses GPU for embedding, but PageIndex uses LLM via API so that’s all on vLLM side) requires GPU. The orchestrator and Dolt can run on CPU.

**Networking:** Compose by default creates a common network so containers can talk by service name. So orchestrator will reach others by their names:

* It will call the vLLM’s OpenAI API at `http://vllm:8000/v1/completions` (for example).

* It will call PageIndex’s retrieval endpoint (assuming something like `http://pageindex:8080/query` or a gRPC) by service name and port.

* It will connect to Dolt’s MySQL port at `dolt:3306`. We’ll ensure Dolt is configured with a user/password or use the default root with no password for simplicity in local dev, but for security one would set credentials.

**Volumes and Configuration:**

* **Spec Documents Volume:** A folder containing the spec docs (PDFs, or text) will be mounted into the PageIndex container (and perhaps orchestrator if it needs them, but likely not). PageIndex on startup will check if an index exists (maybe we mount a volume for the index too) and build it if not. Alternatively, we could bake the index building step into container startup (like an entrypoint script).

* **Dolt Data Volume:** Mount a volume for `/var/lib/dolt` (or whichever path holds the Dolt repos) so that the data persists. We can pre-initialize this volume by running Dolt locally or via a script: for example, clone or init a repository named “specs” and import the spec documents (or at least a reference to them) and any existing truth data. Dolt can store documents via its `dolt docs` feature or store tables of rules and rulings. The orchestrator might run queries like `SELECT * FROM rulings WHERE ...` so those tables need to exist. We can include a SQL import or a Dolt schema file to set this up on first run.

* **Orchestrator Config:** The orchestrator might have a config file (YAML) that sets parameters like coverage\_threshold, etc.. We mount that config into the orchestrator container or bake defaults in. It will also need credentials to connect to Dolt (hostname, user, pass) – though if we use root with no password on internal network, that’s fine. For vLLM, orchestrator uses HTTP so no client lib needed.

* **PageIndex Config:** Likely needs environment variables: `OPENAI_API_KEY` (we’ll set a fake key) and maybe `PAGEINDEX_DOCS_DIR=/data/specs` to point to docs. If pageindex.ai code expects an API key to be present, we’ll provide it (the actual value doesn’t matter as long as it’s consistent with what we give vLLM’s `--api-key`). We might also give it `PAGEINDEX_INDEX_OUTPUT=/data/index` if we want to persist the index. The container will use the vLLM service by pointing to `OPENAI_API_BASE=http://vllm:8000/v1` as mentioned.

* **vLLM Model Weights:** We need to provide the model weights to the vLLM server. Options: mount a volume with pre-downloaded HuggingFace model files (e.g., in `/models/llama-2-13b`), or have the container download on startup (not ideal each time). Better to volume mount. On our machine, we’d download the model once (perhaps the fine-tuned version’s files) and then in compose:  
   `volumes: ["./models/llama2-13b:/models/llama2-13b"]`  
   and run vLLM with `--model /models/llama2-13b` if it supports loading from local path (which it does for HuggingFace format). Also specify dtype (fp16 perhaps to fit in 24GB).

* **Timeouts and Memory:** We should set appropriate resource limits. The orchestrator container can have limited CPU (maybe 1-2 cores) since heavy work is on GPU in vLLM. The vLLM uses GPU fully – we should ensure it’s allowed (the above config does that). If memory on GPU is tight, consider using slightly smaller model or enabling quantization. vLLM supports some quantization or efficient KV management but typically not 4-bit quantization out of the box (there is AWQ support for weight quantization that we might leverage to reduce memory).

**Example Docker Compose Configuration (pseudo-code):**

`version: '3.9'`  
`services:`  
  `orchestrator:`  
    `build: ./orchestrator  # or image: historian/orchestrator:latest`  
    `command: ["python", "run_historian.py", "--config", "/config/config.yml"]`  
    `volumes:`  
      `- ./config.yml:/config/config.yml:ro`  
      `- ./logs:/logs  # to store audit bundles or logs`  
    `depends_on:`  
      `- vllm`  
      `- pageindex`  
      `- dolt`  
    `networks: [ historian_net ]`  
    `environment:`  
      `- DOLT_HOST=dolt`  
      `- DOLT_PORT=3306`  
      `- DOLT_USER=root`  
      `- DOLT_PASSWORD=`  
      `- PAGEINDEX_URL=http://pageindex:8080`  
      `- LLM_API_URL=http://vllm:8000/v1`  
      `- GPU_ENABLED=false  # orchestrator itself doesn't need GPU`  
  `vllm:`  
    `image: vllm:v0.4  # assume we have an image`  
    `networks: [ historian_net ]`  
    `deploy:`  
      `resources:`  
        `reservations:`  
          `devices:`  
            `- capabilities: [gpu]`  
    `command: ["python", "-m", "vllm.entrypoints.openai.api_server",`   
              `"--model", "/models/llama2-13b", "--port", "8000", "--host", "0.0.0.0",`  
              `"--tokenizer", "/models/llama2-13b", "--dtype", "float16",`  
              `"--api-key", "local-api-key-123"]`  
    `volumes:`  
      `- ./models/llama2-13b:/models/llama2-13b:ro`  
    `ports:`  
      `- "8000:8000"   # expose if needed for external test, or could keep internal`  
  `pageindex:`  
    `image: vectifyai/pageindex:latest  # hypothetical image`  
    `networks: [ historian_net ]`  
    `depends_on:`  
      `- vllm`  
    `environment:`  
      `- OPENAI_API_KEY=local-api-key-123`  
      `- OPENAI_API_BASE=http://vllm:8000/v1`  
      `- PAGEINDEX_DOCS_DIR=/data/specs`  
      `- PAGEINDEX_PORT=8080`  
    `volumes:`  
      `- ./specs:/data/specs:ro`  
      `- ./pageindex_index:/data/index:rw`  
    `ports:`  
      `- "8080:8080"  # if we want to query it externally`   
    `command: ["pageindex", "--docs", "/data/specs", "--index", "/data/index", "--serve", "--host=0.0.0.0", "--port=8080"]`  
    `# The above command is hypothetical; actual might differ.`  
  `dolt:`  
    `image: dolthub/dolt:latest`  
    `networks: [ historian_net ]`  
    `environment:`  
      `- DOLT_ENABLE_FEATURE_Flags=0  # if needed`  
    `volumes:`  
      `- ./dolt-data:/var/lib/dolt:rw`  
    `ports:`  
      `- "3306:3306"`  
    `command: ["dolt", "sql-server", "--host=0.0.0.0", "--user=root", "--password="]`

In the above (illustrative) snippet:

* We configure orchestrator to wait for others (Compose ensures it starts after dependencies are “up”, though up means started, not fully ready – we may add a healthcheck or simple retry logic in orchestrator when connecting).

* The `historian_net` is an internal network so they resolve each other by name.

* vLLM gets the GPU. If multiple GPUs, we could specify device index. But one 4090 is fine.

* vLLM is given an `--api-key` which is just a token it expects from clients (both orchestrator and PageIndex will use that “local-api-key-123” as their auth, mimicking OpenAI usage). This ensures unauthorized external use is prevented if port opened.

* PageIndex uses environment to know where to get docs and how to call LLM (we override it to use local vLLM).

* Dolt exposes port 3306 so that developers could connect from host with a MySQL client if needed (for debugging or manual corrections). In production, maybe it’s internal only, but local is fine.

We also manage logs or outputs: orchestrator might write AuditBundles to a mounted volume so the host can see them or persist them. Alternatively, orchestrator can push them into Dolt or some other storage. But file system is simplest for now.

**Security Considerations:** Since this is local-first, we trust local network. But we could add basic auth to PageIndex’s API if worried or keep it unexposed (no port mapping to host). The same for vLLM’s port (could keep it internal). Dolt ideally also internal only, unless we want to use a client externally. But given it’s single user local, not a big risk. The data (specs, etc.) stays on local volumes.

**Deployment and Startup:**

* The user would do `docker-compose up -d`. Dolt starts (if first time, perhaps empty or with pre-seeded data). PageIndex starts and if needed indexes docs (which could take some time for large docs, but once done it might save index to volume for reuse). vLLM starts and loads the model into GPU (this can take 30+ seconds for a 13B model, but fine). Orchestrator could either start in a server mode (e.g., a REST API waiting for proposals to analyze) or just run a one-shot analysis job. A nice approach is to have orchestrator provide an API endpoint (like `POST /analyze` with a proposal, then it returns a job ID or the result). This way multiple requests could be queued (though we plan one at a time). Alternatively, orchestrator could be run on demand outside of Compose (like a CLI that spins up containers, executes, stops) but that’s less convenient.

* We likely want orchestrator to be always running, listening for tasks (maybe it monitors a folder for new proposal files or has an API as said). Since single user, even a CLI that execs inside orchestrator container is possible (e.g., `docker-compose run orchestrator python run_historian.py --input /some/path`).

* In any case, logs from orchestrator and others can be seen with `docker-compose logs`.

**Resource usage:**

* The 4090 GPU is used by vLLM. We ensure to give it the full GPU (no other container uses it).

* CPU and memory: vLLM will also use some CPU for its server, orchestrator uses some CPU for logic and maybe minor model usage, PageIndex uses CPU for building index (which can be somewhat heavy for large PDFs due to parsing) and for orchestrating retrieval calls (actual heavy lifting of language reasoning within PageIndex’s approach is done by the LLM on GPU).

* Dolt uses CPU and some memory for the DB. For big data, it could be heavy, but our use (storing spec metadata and prior cases) is likely small so it’s fine.

**Scaling and Extensibility:**  
 This Compose setup is for single-machine. In future, one could break out components: e.g., run the inference on a separate GPU machine, or run multiple PageIndex instances for different document sets, etc. But local-first suggests one machine is enough. If multi-user in future, we might have a microservice where orchestrator is stateless and many instances handle requests, but that’s beyond MVP.

**Monitoring:** We can use Docker healthchecks to ensure each service is up: e.g., ping Dolt’s port with an `mysqladmin ping`, ping vLLM’s /v1/health if available, PageIndex maybe responds on /health. Orchestrator can wait until it can connect to all. That way Compose can report if something fails to stay healthy.

**Configuration management:** The configuration (thresholds, etc.) can be tweaked by editing config file or environment variables and doing `docker-compose up` again. Because everything is versioned (images and volumes), we can snapshot this environment for audit as well.

In summary, the Docker Compose deployment encapsulates the Historian’s components in isolated containers while enabling easy communication between them. It provides a reproducible environment – any auditor or developer can bring up the exact same versions of services and model and run the AuditBundle through them to reproduce results (given the Dolt commit and so on). The use of containerization also helps in controlling the dependencies (e.g., ensure the PageIndex code uses the right version of libraries, which might rely on specific PDF parsers, etc.). It aligns with the local-first principle: no need to rely on cloud services at runtime, and all data remains on the local volumes.

Finally, as a convenience, we can supply a one-step launch script and possibly a Makefile or similar to build images (especially the orchestrator’s image if it’s custom code). The vLLM and Dolt can be pulled from official repos. PageIndex might come from an official image or we create one by installing it from pip inside a container.

## **Implementation Roadmap**

Building the Historian Agent Platform will be an iterative process. We propose a **phase-based implementation plan** with milestones, deliverables, and tests to be passed at each stage. This roadmap ensures that we build up the system methodically, verifying core functionality and addressing failure modes as we go:

* **Phase 0: Project Setup and Baseline**  
   **Deliverables:**

  * Repository initialized (monorepo or multi-repo for components) with Docker Compose structure.

  * Basic Dockerfiles for orchestrator and a confirmed working environment for vLLM, Dolt, and PageIndex (possibly just ensure we can run a simple query end-to-end).

  * Specification documents loaded into Dolt (as data or at least a reference) and into PageIndex index.  
     **Acceptance Criteria:**

  * Able to bring up the infrastructure with `docker-compose up` and all services stay up.

  * Dolt is reachable (e.g. can run a sample query via orchestrator container or external client).

  * vLLM responds to a test prompt (like a simple completion) through its API.

  * PageIndex can return a known section for a test query (manually call its API or via orchestrator dummy call).

  * No actual reasoning yet, this is mostly environment plumbing.  
     **Failure Modes Addressed:** At this stage, mainly ensuring no system errors – e.g., container crashes, model load issues. Not tackling logical failure modes yet.

* **Phase 1: Claim Decomposition & Retrieval MVP**  
   **Focus:** Implement the orchestrator logic up to assembling evidence, without full reasoning.  
   **Deliverables:**

  * Claim decomposition module: either a simple parser or an LLM prompt (could be a regex-based placeholder to start). It should output a ClaimSet object given a proposal (which for now can be a very simple proposal text).

  * Basic CoveragePlan logic: possibly hardcode some expected sections or simple mapping (like if proposal contains word “security” include security section). Initially, this can be rudimentary.

  * Retrieval integration: orchestrator sends queries to PageIndex for each claim (maybe just one query per claim to start).

  * EvidencePacket assembly: code to combine PageIndex results into our EvidencePacket structure.

  * The system can log or output the EvidencePacketSet for inspection.  
     **Acceptance Tests:**

  * Give a small test proposal, e.g., "Our system will use AES-256 for encryption." and ensure:

    * ClaimSet identifies "use AES-256 for encryption" as a claim.

    * CoveragePlan expects maybe a "Cryptography" section.

    * Retrieval calls PageIndex and retrieves the relevant spec section (for example, if spec says "Encryption must be FIPS compliant", etc.).

    * EvidencePacketSet contains that section snippet.

  * Check that the evidence is correct and the citation matches what we expect from manual lookup.

  * Introduce a scenario where a claim should lead to no result (like claim about an unrelated topic) and ensure system handles "no evidence found" gracefully – perhaps by leaving evidence empty or flagging for future steps.

  * If PageIndex returns multiple sections, ensure they are all captured.  
     **Failure Modes:**

  * Could start encountering `FAIL_AUTHORITY_MISMATCH` if the commit doesn’t match index version. We can simulate by deliberately messing version and see if orchestrator catches it. Might postpone strict checking until Phase 2 when we have actual Dolt commits in use.

  * We will likely not implement retrieval instability detection fully yet, but any glaring issues (like PageIndex returning random stuff each time) should be observed. At this stage, we might set temperature=0 to avoid that.

  * Input invalid: test with empty proposal and ensure it returns an error.

  * The aim is that by end of Phase 1, the pipeline from input to evidence is working for nominal cases.

* **Phase 2: Beads Trace & Reasoning Core**  
   **Focus:** Implement the reasoning mechanism and production of a preliminary verdict (though we will likely refine verdict logic in next phase).  
   **Deliverables:**

  * A structure for BeadsTrace in code, and functions to add beads for each reasoning step.

  * Initial reasoning algorithm that for each claim, does a simple comparison: e.g., check if evidence text contains or contradicts the claim. This could be a templated prompt to the LLM: "Given the requirement \[evidence\] and the proposal claim \[claim\], is the claim compliant? Answer yes or no and reason." The output can be parsed and turned into beads (we might not have each fine-grained bead yet, we can start with coarse steps).

  * Logging of the reasoning steps to the AuditBundle.

  * Generation of a draft Judgment (verdict \+ findings) purely based on those reasoning outcomes (e.g., if any "no" then BLOCK, etc.).  
     **Acceptance Tests:**

  * Use a known scenario: e.g., spec says "must use AES-256", proposal says "uses AES-256" \-\> expected PASS. Run it:

    * Check that the reasoning step identified that claim meets requirement (maybe a bead with conclusion "Compliant").

    * Judgment verdict PASS with that finding recorded as compliant.

  * Another: spec says "must use AES-256", proposal says "uses DES" \-\> expected BLOCK:

    * Reasoning should flag non-compliance.

    * Judgment BLOCK with violation cited.

    * The evidence cited in finding should be the spec rule "AES-256 required".

  * Try an ambiguous case: spec says "use encryption", proposal says "we consider using encryption" (vague) \-\> likely we expect REVISE or at least an uncertainty. At this phase we might not have uncertainty logic, but see what happens. This will highlight need for UNCERTAINTY\_FLAG bead, which we add if model is unsure.

  * Ensure that for each finding, the evidence reference is present.

  * Also test that multiple claims are handled independently and compiled.

  * Start tracking performance: how long does reasoning take per claim roughly (for awareness)? Should be okay with small model.  
     **Failure Modes:**

  * We might implement the guard for "blocker requires evidence" now: test a case where model says "This is a violation" but no evidence cited \-\> our validator should catch and mark FAIL\_TRACE\_INVALID. Simulate by e.g. forcing a step to not attach evidence (maybe by mis-parsing).

  * If such failure is caught, ensure system reports it. Possibly not auto-recovering yet; developer fixes prompt or logic to provide evidence.

  * Also start implementing the contradiction/consistency checks: if the model output contradicts itself in reasoning (less likely in single step logic now, but could plan to detect "yes and no" type outputs).

  * Essentially, at end of Phase 2, we should have the base ability to get a verdict with reasoning on straightforward cases, and initial trace validation rules enforced for glaring issues.

* **Phase 3: Truth Context & Advanced Reasoning**  
   **Focus:** Introduce the parallel consultation of Dolt for truth context, and incorporate that into reasoning. Also refine multi-step reasoning (explicit beads chain) and verdict logic with uncertainty.  
   **Deliverables:**

  * Dolt integration: orchestrator queries Dolt for relevant context (we should have a predefined schema in Dolt, e.g., a table `interpretations(requirement_id, text)` and `rulings(issue, verdict, reference)`, etc.). For initial testing, we can manually insert a known interpretation to see if the system picks it up.

  * Modify reasoning prompts or logic to include truth context: e.g., if Dolt says "DES is explicitly disallowed per committee decision", the reasoning should factor that in. Perhaps feed it into the LLM prompt or logic branch: if truth context exists for a requirement, add a bead "As per prior ruling, ...".

  * Implement **UNCERTAINTY\_FLAG bead**: when the LLM says "not sure" or when evidence is inconclusive, we add that. Could detect certain keywords or use a special prompt asking "is there ambiguity?".

  * Improved chain granularity: Instead of one-shot reasoning per claim, break it: first bead identifies relevant requirement (which we might already have via evidence selection), second bead interprets it (maybe uses truth context), third compares, etc., matching our planned bead types. We can orchestrate multiple LLM calls or prompt the LLM to explicitly output intermediate steps.

  * Verdict logic: incorporate conditions like if any UNCERTAINTY\_FLAG exists and no blockers, verdict becomes REVISE. If no issues at all, PASS. If issues, BLOCK. Already partly done but refine.

  * Fully populate the Judgment object with citations to beads and evidence.  
     **Acceptance Criteria:**

  * Introduce a scenario where truth context matters: e.g., spec might not forbid something explicitly, but Dolt has a prior interpretation that it’s not allowed. For instance, spec says "encryption should be strong", Dolt has interpretation "strong \= at least 128-bit". Proposal uses 64-bit. The spec text alone might not catch it, but truth context does. Test that:

    * The Dolt entry is retrieved.

    * The reasoning beads include something like "TruthContext: previously, strong encryption defined as \>=128, our proposal uses 64, thus violation".

    * The final verdict correctly BLOCKs this and cites "prior interpretation from Dolt commit X" as part of evidence (could treat truth context as evidence too).

  * Test the case for ambiguity: e.g., spec requirement "do X if feasible", proposal doesn’t clarify feasibility. This should produce an UNCERTAINTY bead and result in REVISE. Check:

    * verdict \= REVISE,

    * reasoning explains the uncertainty,

    * coverage maybe doesn't fail here because it's not missing evidence, it’s just ambiguous.

  * By now we should test **FAIL\_COVERAGE\_GAP** explicitly: create a scenario where CoveragePlan expects 2 topics but we intentionally don't supply evidence for one (maybe remove it from spec or skip retrieval). The validation should catch it and fail. Then try recovery: perhaps add an option to allow REVISE on coverage gap and see that it then issues verdict REVISE with missing areas listed. Ensure that works as coded.

  * Test **FAIL\_AUTHORITY\_MISMATCH** by simulating a spec update: for example, update Dolt to a new commit but don't rebuild PageIndex index (or fake index\_version). Confirm the orchestrator spots mismatch and stops. Then simulate fixing it (maybe run a script to update index) and ensure it proceeds.

  * By end of Phase 3, all core logic pieces (retrieval, truth, reasoning, validation, verdict) are implemented and working on controlled examples. Many failure conditions have been implemented or at least recognized.

* **Phase 4: Robustness, Determinism, and Caching**  
   **Focus:** Strengthen determinism and efficiency. Implement caching layers, stability checks, and finalize all failure recoveries.  
   **Deliverables:**

  * Retrieval stability measurement: incorporate code to run duplicate queries if needed and measure entropy or set differences. Decide threshold and add config. If unstable, trigger the mitigation loop (like toggling an option for PageIndex to be stricter or using a simpler search).

  * Caching: Implement a basic cache for evidence. Perhaps maintain a dict in orchestrator keyed by (spec\_commit, query) \-\> evidence results. Also could cache Dolt queries results similarly. This could also be persisted in memory across runs if orchestrator stays running. Also ensure the PageIndex index is persisted on disk (already covered by volume).

  * Checkpointing: ensure that if any fail occurs, we can restart from a logical point. We might implement a command like `--resume-from STATE with run_id` to reload artifacts from an AuditBundle and continue. At least make sure the orchestrator code structured that you can call pieces independently for rerun.

  * Finalize all **failure recovery logic** in code: e.g., a try-catch around retrieval to catch instability and loop, around trace to catch invalid and retry with modifications (like increasing reasoning steps or simplifying prompt).

  * Logging and traceability: ensure every random or important decision is logged (with seeds, etc.). If using any randomness, make it optional/seeded.

  * Possibly integration with Steve Yegge’s Beads storage: If time permits, integrate the Beads CLI to store reasoning steps in `.beads` git repo. But this is optional; we can stick to our own logging.

  * Deterministic mode toggles: e.g., ability to run with an explicit seed. Possibly an option for debug vs normal (but likely always deterministic).

  * Comprehensive config file updated with all tunables and defaults chosen.  
     **Acceptance Criteria:**

  * Run the same input twice and verify the outputs (Judgment and trace) are identical bit-for-bit (excluding timestamps). This tests determinism. Perhaps do this on a couple of different proposals. Log differences if any.

  * Intentionally cause a retrieval instability by introducing a bit of randomness in PageIndex (maybe set a high temperature just to test) and see the system catch it. Then adjust to stable and see it pass.

  * Time how long a typical run takes on a real doc (\~50 page spec) to ensure caching etc. is effective enough (should be within a couple of minutes ideally, depending on model speed).

  * Memory check: ensure 13B fits in 24GB – vLLM should be fine with half precision. If not, consider use quantization (we would test this earlier though).

  * Verify that if a run fails at, say, trace invalid, we can modify config and resume without losing everything. Perhaps simulate by causing a fail, then fix the prompt to avoid the fail, and implement a mechanism to reuse prior evidence instead of calling PageIndex again (because that was fine). This might involve coding resume.

  * Final regression: run all previous test cases again (we accumulate them) to make sure nothing broke. All phases' tests should still pass.

  * Document all remaining known issues or corner cases to handle.

* **Phase 5: Evaluation Harness and Refinement**  
   **Focus:** Build out the automated evaluation and improve via results.  
   **Deliverables:**

  * A suite of test scenarios (maybe 10-20 to start, but ideally expanding) covering common patterns and edge cases. This includes some we used in development and new ones.

  * A script or small tool to run these and collect metrics as described in evaluation section.

  * Integration of an LLM judge or additional checks if needed for output quality (maybe not fully, but explore).

  * Based on test results, fine-tune thresholds or fix logic. For example, if evaluation finds some false positive, adjust truth context or model prompt.

  * Documentation on how to run the harness and interpret results.  
     **Acceptance Criteria:**

  * Achieve high scores on internal metrics: e.g., 100% groundedness (no hallucination in outputs), coverage above threshold in all testcases except those intentionally incomplete, correct verdicts matching expected in, say, \>90% of cases (or 100% on our curated ones).

  * Specifically test calibration: include a case with insufficient info and ensure verdict is REVISE (not PASS). Include a tricky case where an irrelevant spec section might confuse the system and see if it avoids a false alarm (if not, that is a bug to fix maybe by better query or context use).

  * If possible, have a colleague or domain expert review a couple of outputs for sanity.

  * The harness should be easy to run (maybe `make test` runs it inside orchestrator container for consistency).

  * Ensure that any failure path (like a known scenario that triggers FAIL\_COVERAGE\_GAP by design) is caught and reported in a clear way.

* **Phase 6: Optional Enhancements (Parallel & Multi-User Prep)**  
   **Focus:** Beyond MVP, preparing for scaling or extended features:

  * Perhaps allow orchestrator to handle multiple proposals sequentially by running as a service (if not already).

  * Add a simple API or UI for submission to make it more user-friendly.

  * Multi-user: not fully implemented, but design how it *would* work: e.g., separate branches in Dolt per user or tagging data by user.

  * Possibly integrate a second LLM (cloud) as a comparison or backup for certain tasks (like cross-check reasoning).

  * Performance tuning: if wanting to speed up, consider using a smaller model or distilling one specifically for retrieval vs reasoning, etc. But on one GPU we might keep it simple.

  * Summarize where a cloud could optionally fit (like if not enough GPU, one could call an API at step X). But this is optional as the prompt says, if done, ensure audit logs record external calls too.

* **This phase is more open-ended and likely ongoing once core system is stable.**

**Milestone Deliverables Summary:**

* *Milestone 1 (end Phase 1):* Able to ingest a proposal and output relevant spec excerpts (evidence) for each claim. Verified on simple cases.

* *Milestone 2 (end Phase 2):* Able to produce a basic verdict (Pass/Block) with reasoning for straightforward compliance/non-compliance cases. Trace is recorded and one can follow logic.

* *Milestone 3 (end Phase 3):* Full reasoning pipeline with truth context integration and all verdict types (Pass/Block/Revise) possible. All key failure checks implemented. Verified on more complex cases and edge conditions.

* *Milestone 4 (end Phase 4):* System is deterministic, stable, and efficient. All targeted failure modes have recovery or clear messaging. Ready for extensive testing.

* *Milestone 5 (end Phase 5):* System meets evaluation targets on test suite. Ready for initial deployment/use on real tasks (with caution). Documentation and harness available for future regression tests.

* *Milestone 6:* (if done) Extended capabilities and prep for expansion, based on further user feedback.

**Acceptance Testing & Failure Handling in Roadmap:** At each milestone, we have explicit tests as listed. Especially important are:

* After Phase 3: test each failure mode injection (we might write a specialized test to simulate each fail and see that system responds per design).

* We might intentionally create a dummy mode in orchestrator that flips a bit to simulate a fail condition to test that branch (for example, temporarily force index\_version mismatch or drop one evidence).

* The harness in Phase 5 will include tests for each fail state too (except system error which we can simulate by, say, shutting down Dolt mid-run and seeing if FAIL\_SYSTEM\_ERROR is caught).

Finally, we plan a **demo scenario** as a final acceptance: pick a realistic proposal and run the full pipeline, then have a human reviewer examine the Judgment and trace. Acceptance is that the human agrees the verdict is correct and the justification is complete and easy to follow (this is more subjective but important for real-world uptake). This could be done as user acceptance test if this were a delivered project.

By following this roadmap, we implement incrementally, ensure each component works properly, and gradually build confidence in the Historian agent’s reliability. Each phase builds on the last, and we address potential points of failure as we introduce them (rather than all at once at the end), aligning with an engineering approach that ensures robust, testable progress. The result will be a **minimum viable build** at Phase 5 that can already deliver local auditable analysis, and a clear path to an ideal end-state (multi-user support, continuous learning with corrections, etc.) in future phases.

## **Conclusion and Future Outlook**

In this report, we specified a comprehensive design for a **Historian Agent Platform** that emphasizes accuracy, determinism, and auditability in verifying proposals against specifications. The system architecture cleanly separates responsibilities across a retrieval oracle (PageIndex), a versioned truth store (Dolt), an explicit reasoning ledger (Beads trace), and an orchestrator that enforces process discipline. This design ensures that **no single component is a black box** and every conclusion is backed by evidence and logged reasoning, echoing industry best-practices for AI transparency (e.g., **Chain-of-Thought monitoring to make AI “thinking” visible**).

We detailed the runtime workflow from claim decomposition to verdict and correction, showing how each step contributes to a final judgment that is **grounded in source documents** and **fully reproducible**. Key data schemas were presented to formalize the interface between stages (ClaimSet, EvidencePacket, etc.), providing a blueprint for implementation and data exchange.

Design choices were justified with references to state-of-the-art tools and research:

* We leverage **vLLM** to maximize inference efficiency and maintain high throughput on a single GPU, with the bonus of an OpenAI-compatible API for integration.

* **PageIndex** was chosen for document retrieval due to its hierarchical, reasoning-based approach that avoids vector search pitfalls and delivers explainable, precise references.

* **Dolt** underpins our truth management, bringing the power of Git version control to database records, so every knowledge change is tracked and reversible – a crucial factor for audit trails and enabling “what-if” analyses via branching.

* The concept of **Beads** ensures that reasoning is not an ephemeral chain-of-thought inside an LLM, but a persistent, queryable graph of steps (inspired by tools like Yegge’s Beads for agent memory). This yields a system where *logical errors can be detected and corrected independently of outcomes*, as we can inspect the reasoning structure itself.

We addressed potential failure modes head-on with an FMEA-style analysis, designing detection and recovery strategies for each (from index mismatches to coverage gaps to reasoning rule violations). This level of rigor is rarely applied to AI agents, but it’s essential for a platform intended to produce **defensible judgments**. In effect, the system has internal “safety nets” and will refuse to give an answer if it cannot do so reliably – a property that fosters trust. As noted, enterprises require *replayable reasoning records to prove adherence to logic*, and our Historian’s output plus AuditBundle provide exactly that.

For evaluation, we proposed a thorough framework combining both **quantitative metrics** (groundedness, coverage, correctness) and **qualitative assessments**, along with a test harness. This ensures the system not only works on paper but is empirically validated against known standards and cases. We align evaluation with the “RAG triad” concepts (retrieval quality, context quality, answer quality), focusing strongly on faithfulness to evidence and completeness of analysis.

The deployment plan demonstrates that the platform can be run fully on-premises in Docker, meaning organizations can use it on sensitive data without fear of external leakage, and auditors can deploy the same stack to reproduce results. Each service (LLM, index, DB, orchestrator) can be updated or replaced independently as long as it respects the interfaces, offering flexibility. For instance, one could swap the LLM to a newer model in the vLLM container when available, and thanks to our evaluation harness, verify that everything still works before promotion (as per our **promotion gates** concept for model updates).

Looking ahead, this blueprint sets the stage for future enhancements, such as:

* **Scaling to multi-user and multi-project**: using Dolt branches or separate Dolt databases to isolate truth states, and perhaps sharding PageIndex indexes per document set. The orchestrator could handle concurrent requests (with careful scheduling since one GPU might run one reasoning at a time, but retrieval could be parallelized).

* **Active Learning**: using the corrections logged to continually improve the LLM via fine-tuning (our training plan addresses how to incorporate those in a feedback loop). Over time, the reliance on human corrections should diminish as the system learns from its mistakes – effectively implementing a form of organizational memory.

* **Enhanced UI and integration**: The Historian could be wrapped in a user interface that allows engineers to submit proposals and get interactive feedback, exploring the beads trace via a UI (like stepping through an execution trace). The structured output makes it feasible to build such tools.

* **Additional Agents**: The design allows optional use of cloud or other agents for things like generating suggestions (which could be logged separately). For example, a “Refactorer” agent could use the Historian’s verdict to propose fixes to the proposal – all outside the core verification loop, thereby not compromising auditability.

In conclusion, this Historian Agent Platform marries the power of modern LLMs with the discipline of traditional software engineering and database techniques. By doing so, it transforms what would be a fuzzy AI assistant into a **“verifiable epistemic machine”** that can serve as a trustworthy co-pilot for complex decision-making. It cannot assert anything without backing, cannot skip steps without detection, and cannot lose truth context due to the hard gates we’ve set.

This blueprint has laid out not just how to build the system, but why each part is necessary and how it contributes to the overall goals. By following this design, one will implement a cutting-edge Historian agent that is **grounded, structured, and auditable by design**, ready to be deployed locally for rigorous compliance and verification tasks. All decisions and trade-offs were made with a view to maximize correctness and traceability, even at the cost of extra complexity – a worthwhile trade-off for high-stakes applications where **explanation and accountability** are as important as the answer itself.

The deliverable is a platform where **every output is a thesis with citations**, and every reasoning path is open for inspection – a significant leap forward from opaque AI to a new standard of **transparent, deterministic AI assistant**. With this in place, organizations can confidently use AI to audit and verify, knowing that the process can be trusted and verified step-by-step, meeting both internal governance and external regulatory demands for AI decision-making.

