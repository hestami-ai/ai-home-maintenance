Yes. There are several useful legal AI benchmarks, but none of them fully validates the **JanumiLegal thesis** by itself, because JanumiLegal is not just a model. It is a **lens-selected, deterministic state-machine system with bounded LLM execution**.

So the right evaluation strategy is:

```text
Use public legal AI benchmarks to validate bounded state functions.
Use custom JanumiLegal harness benchmarks to validate workflow completeness, state coverage, escalation behavior, and attorney-review readiness.
```

## 1. Most relevant public benchmarks

### A. LegalBench

**Best for:** legal reasoning task coverage.

LegalBench is one of the most important general legal reasoning benchmarks. It contains **162 tasks** across **six types of legal reasoning**, built collaboratively with legal professionals and evaluated across commercial and open-source LLMs. It is useful for testing whether the LLMs used inside JanumiLegal states can perform bounded legal-reasoning subtasks. ([law.virginia.edu][1])

For JanumiLegal, LegalBench is useful for states like:

```text
Issue classification
Rule application
Legal text interpretation
Entailment-like reasoning
Statutory interpretation
Definition matching
```

But LegalBench does **not** validate your full product architecture. It mostly evaluates model capability, not whether a deterministic state machine enforced required legal workflow steps.

---

### B. LexGLUE

**Best for:** baseline legal NLP/NLU capability.

LexGLUE is a standardized benchmark for English legal language understanding across multiple legal NLU tasks. It is older, but still useful for checking whether base models or specialized legal models perform well on core classification and understanding tasks. ([Hugging Face][2])

For JanumiLegal, LexGLUE maps to lower-level bounded states such as:

```text
Document classification
Legal text classification
Clause/topic classification
Case outcome-style classification
Statutory/document understanding
```

It is less useful for validating JanumiLegal’s state-machine doctrine, because it does not evaluate workflow completeness, release gating, or attorney-review packet quality.

---

### C. CUAD — Contract Understanding Atticus Dataset

**Best for:** contract review extraction and clause identification.

CUAD is highly relevant to a **Contract Review Lens**. It contains **510 commercial contracts**, **13,000+ expert labels**, and **41 clause types**, with annotations created under lawyer supervision. ([atticus-project][3])

For JanumiLegal, CUAD can validate states such as:

```text
ContractStructureExtract
ClauseDomainBloom
ClauseDomainPrune
ClauseRiskPacketGenerate
ClauseReferenceVerification
```

It is especially good for measuring whether your bounded extraction/classification agents can reliably identify clauses like:

```text
Governing law
Change of control
Anti-assignment
Indemnity
Limitation of liability
Exclusivity
Most favored nation
Non-compete
Termination
IP ownership
```

CUAD should be one of the first benchmarks used for the Contract Review Lens MVP.

---

### D. MAUD — Merger Agreement Understanding Dataset

**Best for:** complex M&A agreement review.

MAUD contains **152 merger agreements**, **47,000+ labels**, and **92 questions** mapped to deal points from the ABA Public Target Deal Points Study. ([atticus-project][4])

For JanumiLegal, MAUD is useful if you eventually support an M&A or transaction-specific lens. It can validate:

```text
Deal point extraction
Agreement-specific question answering
Defined-term reasoning
Clause-level provision mapping
Transaction document review
```

It is probably not an MVP benchmark unless JanumiLegal targets M&A work early.

---

### E. ACORD — Atticus Clause Retrieval Dataset

**Best for:** contract drafting and precedent-clause retrieval.

ACORD is extremely relevant if JanumiLegal supports contract drafting or playbook-based redline generation. It includes **126,000+ expert-rated query-clause pairs**, **114 lawyer-written queries**, and expert ratings from 1 to 5 stars. It was accepted at ACL 2025. ([atticus-project][5])

For JanumiLegal, ACORD maps well to states like:

```text
PrecedentClauseRetrieve
FallbackClauseRetrieve
RedlineCandidateGenerate
PlaybookAlignmentCheck
ClauseQualityRank
```

This benchmark is especially relevant to your deterministic state-machine approach because clause retrieval should be treated as a bounded state, not an open-ended drafting decision.

---

### F. LegalBench-RAG

**Best for:** precise legal retrieval.

LegalBench-RAG is designed to evaluate the retrieval component of legal RAG systems. It focuses on retrieving **minimal, highly relevant legal text segments**, not merely broad documents. The dataset contains **6,858 query-answer pairs** over a legal corpus of more than **79 million characters**, annotated by legal experts. ([arXiv][6])

For JanumiLegal, this is highly relevant because your system needs source-grounded states:

```text
AuthorityRetrieve
ProvisionRetrieve
SourceSupportCheck
CitationGroundingCheck
LegalContextPackBuild
```

This benchmark reinforces a key JanumiLegal design principle: the system should retrieve the **right source span** before asking an LLM to synthesize.

---

### G. Legal RAG Bench

**Best for:** end-to-end legal RAG evaluation and error decomposition.

Legal RAG Bench is a newer benchmark focused on end-to-end legal RAG performance. It uses **4,876 passages** from the Victorian Criminal Charge Book and **100 complex hand-crafted questions** requiring criminal law/procedure expertise. It also proposes a hierarchical error decomposition framework to separate retrieval failures, reasoning failures, and hallucination failures. ([arXiv][7])

This is conceptually very aligned with JanumiLegal because your product should not merely score final answers. It should decompose failures by state:

```text
Did retrieval fail?
Did synthesis fail?
Did verification fail?
Did release gating fail?
Did the wrong lens run?
Did pruning remove a necessary issue?
```

Even though Legal RAG Bench is jurisdiction/domain-specific, its evaluation methodology is directly relevant.

---

### H. COLIEE

**Best for:** legal retrieval, entailment, and legal information extraction.

COLIEE is an established legal informatics competition. COLIEE 2025 included case-law retrieval, case-law entailment, statute-law retrieval, statute-law entailment/question answering, and a pilot tort prediction/rationale extraction task. ([Springer Nature Link][8])

For JanumiLegal, COLIEE is useful for validating states such as:

```text
CaseLawRetrieve
StatuteRetrieve
EntailmentCheck
RationaleExtract
AdverseAuthoritySearch
```

COLIEE is particularly useful if JanumiLegal later supports litigation, statutory interpretation, or legal research memo lenses.

---

### I. Stanford legal hallucination benchmarks / studies

**Best for:** hallucination resistance and citation reliability.

Stanford RegLab and collaborators published important empirical work on legal hallucinations. One study found that public-facing LLMs hallucinated frequently on specific, verifiable federal case questions, with reported hallucination rates from **58% for ChatGPT-4** to higher rates for other models. ([Stanford Impact Labs][9])

A later preregistered evaluation of AI-driven legal research tools found that proprietary RAG-based legal research products reduced but did not eliminate hallucinations; LexisNexis and Thomson Reuters tools were reported to hallucinate between **17% and 33%** of the time. ([reglab.stanford.edu][10])

For JanumiLegal, these are not just benchmarks; they justify the architecture. They support the design rule that the system must not let LLMs freely generate legal citations or final legal claims without verification gates.

---

### J. PLawBench

**Best for:** practical legal-work scenarios and rubric-based evaluation.

PLawBench, published in 2026, is designed to evaluate LLMs in realistic legal practice scenarios. It contains **850 questions** across **13 practical legal scenarios** with about **12,500 expert-designed rubric items**, covering public legal consultation, case analysis, and legal document generation. ([arXiv][11])

This is one of the more relevant benchmarks for JanumiLegal’s long-term vision because it uses finer-grained rubrics rather than just answer correctness. Still, you would need to adapt it because JanumiLegal’s claim is not “the model gives a good answer”; it is “the workflow produces a complete, reviewable legal work packet.”

---

## 2. How these benchmarks map to JanumiLegal lenses

| JanumiLegal lens/state                   | Useful benchmarks                                                  |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Contract Review Lens                     | CUAD, MAUD, ACORD                                                  |
| Contract Drafting Lens                   | ACORD, CUAD                                                        |
| Legal Research Memo Lens                 | LegalBench, COLIEE, LegalBench-RAG, Stanford hallucination studies |
| Authority Retrieval / Citation Grounding | LegalBench-RAG, Legal RAG Bench, COLIEE                            |
| HOA Governance Lens                      | No strong public benchmark; needs custom dataset                   |
| Compliance Obligation Mapping Lens       | LegalBench, custom regulatory/control datasets                     |
| Litigation Chronology / Evidence Mapping | VLAIR-style tool evals, custom matter datasets                     |
| Hallucination and citation safety        | Stanford RegLab hallucination studies, LegalBench-RAG              |
| End-to-end workflow quality              | PLawBench partially; custom JanumiLegal benchmark required         |

The major gap is obvious: **there is no public benchmark that directly evaluates lens-selected deterministic legal state machines.**

---

# 3. What public benchmarks can validate

Public benchmarks can validate **state-level capabilities**.

For example:

## Contract Review Lens

Use CUAD to test whether the clause extraction state finds the correct labeled clauses.

Metrics:

```text
Clause recall
Clause precision
Span accuracy
False-negative rate for high-risk clause types
Reference location accuracy
```

## Contract Drafting Lens

Use ACORD to test whether the precedent-clause retrieval state retrieves lawyer-rated relevant clauses.

Metrics:

```text
nDCG@k
Recall@k
Mean reciprocal rank
Top-5 expert relevance score
Clause diversity
```

## Legal Research Lens

Use LegalBench, COLIEE, LegalBench-RAG, and Stanford-style hallucination tests.

Metrics:

```text
Correct legal issue classification
Correct controlling authority retrieval
Accurate citation grounding
Adverse authority recall
False citation rate
Unsupported proposition rate
```

## RAG and source grounding

Use LegalBench-RAG and Legal RAG Bench.

Metrics:

```text
Exact source-span recall
Minimal relevant span precision
Grounded answer rate
Retrieval failure rate
Reasoning failure rate
Citation support rate
```

These are valuable, but they only test components.

---

# 4. What public benchmarks cannot validate

They generally do **not** validate whether JanumiLegal:

```text
Selected the correct lens.
Ran every required state.
Prevented silent pruning.
Escalated when facts were missing.
Blocked unsafe external release.
Distinguished internal draft from attorney-approved artifact.
Generated a complete attorney-review packet.
Maintained the Governed Stream.
Preserved user/client intent across recursive decomposition.
Prevented the Orchestrator from improvising workflow steps.
```

Those are JanumiLegal’s most important product claims. Therefore, you need a custom benchmark suite.

---

# 5. The benchmark JanumiLegal actually needs

You need a **JanumiLegal Harness Benchmark**.

It should evaluate the whole system as a state-machine product, not merely the model.

I would define it as:

> A benchmark suite that tests whether JanumiLegal reliably transforms underspecified legal/business requests into procedurally complete, state-machine-valid, attorney-reviewable artifacts while minimizing unsupported legal judgment.

## Core benchmark dimensions

### 1. Lens selection accuracy

Given a vague user prompt, did the system select the correct lens?

Example:

```text
“Can we send this violation letter?”
Expected lens:
HOA Governance Lens + Client Communication Lens + Attorney Escalation Lens
```

Metrics:

```text
Primary lens accuracy
Secondary lens recall
Unsafe lens selection rate
Clarification/escalation appropriateness
```

---

### 2. Required-state coverage

If a lens runs, did every required state run?

Metrics:

```text
Required state completion rate
Skipped required state rate
Invalid transition rate
Schema validation failure rate
```

This is the most important JanumiLegal metric.

---

### 3. Bounded-agent compliance

Did agents stay inside the permitted state task?

Metrics:

```text
Prohibited-action violation rate
Out-of-scope reasoning rate
Unauthorized legal conclusion rate
Workflow invention rate
```

This directly validates your “LLM is not the workflow” doctrine.

---

### 4. Bloom completeness

Did the bloom state enumerate the expected issue universe?

For Contract Review Lens:

```text
Indemnity
Limitation of liability
Confidentiality
Data security
IP ownership
Termination
Assignment
Governing law
Dispute resolution
Survival
```

Metrics:

```text
Issue-domain recall
High-risk issue omission rate
Duplicate/irrelevant issue rate
```

---

### 5. Prune correctness and traceability

Did the prune state retain, remove, defer, or escalate correctly?

Metrics:

```text
Pruning decision accuracy
Silent removal rate
Material issue false-removal rate
Escalation recall
Rationale completeness
```

This is central to JanumiLegal because pruning is where many AI systems become superficially concise but legally dangerous.

---

### 6. Source grounding

Did every legal claim or document claim have a source?

Metrics:

```text
Unsupported proposition rate
Citation validity rate
Source-span accuracy
Quote accuracy
Source-to-claim alignment
```

Use LegalBench-RAG and Stanford-style hallucination tests here.

---

### 7. Attorney-review gate correctness

Did the system require attorney review when appropriate?

Metrics:

```text
Attorney-review recall
False safe-release rate
External-release-block rate
Improper legal-advice release rate
```

For legal systems, **false safe-release rate** is probably more important than answer accuracy.

---

### 8. Artifact completeness

Did the final output include every required artifact slot?

Example for Contract Review Lens:

```text
Clause reference
Risk category
Severity
Business impact
Legal concern
Preferred position
Fallback position
Open questions
Attorney-review requirement
Release status
```

Metrics:

```text
Required-field completion rate
Missing critical field rate
Malformed artifact rate
Attorney packet completeness score
```

---

### 9. Error decomposition

When the system fails, can the benchmark identify where?

```text
Lens selection failure
Retrieval failure
Extraction failure
Pruning failure
Synthesis failure
Verification failure
Release-gate failure
Human-review routing failure
```

Legal RAG Bench’s hierarchical error-decomposition approach is useful inspiration here. ([arXiv][7])

---

# 6. Recommended validation stack for JanumiLegal

I would build a three-layer evaluation stack.

## Layer 1: Model/component benchmarks

Use public benchmarks.

```text
LegalBench
LexGLUE
CUAD
MAUD
ACORD
LegalBench-RAG
Legal RAG Bench
COLIEE
Stanford hallucination tests
```

Purpose:

```text
Can the bounded LLM/tool component perform the narrow state task?
```

---

## Layer 2: Lens/state-machine benchmarks

Custom JanumiLegal benchmarks.

Purpose:

```text
Did the correct lens run?
Did required states run?
Did schemas validate?
Were unsafe paths blocked?
Were pruning decisions recorded?
Were attorney gates enforced?
```

This is your real differentiator.

---

## Layer 3: Attorney-review quality benchmark

Human expert evaluation.

Purpose:

```text
Would a supervising attorney consider the packet complete, useful, safe, and reviewable?
```

Rubric items:

```text
Issue coverage
Fact/source separation
Legal uncertainty labeling
Risk prioritization
Practical usefulness
Completeness of attorney questions
No unsupported legal conclusions
Correct release status
```

PLawBench is useful inspiration because it uses fine-grained expert rubrics for practical legal scenarios. ([arXiv][11])

---

# 7. Best benchmark choices by MVP

## If MVP is Contract Review Lens

Use:

```text
CUAD
ACORD
MAUD, later
Custom contract state-machine eval
Attorney packet rubric
```

Why:

CUAD validates clause extraction; ACORD validates precedent-clause retrieval; MAUD validates complex transaction document understanding. ([atticus-project][3])

---

## If MVP is Legal Research Memo Lens

Use:

```text
LegalBench
LegalBench-RAG
Legal RAG Bench
COLIEE
Stanford hallucination datasets/methods
Custom citation-verification eval
```

Why:

The key risk is not fluent legal writing. The key risk is unsupported authority, bad retrieval, hallucinated citations, and failure to surface uncertainty.

---

## If MVP is HOA Governance Lens

There is probably no adequate public benchmark.

You would need to create your own from:

```text
Public HOA/COA/POA statutes
Public association governing documents, where available
Synthetic but attorney-reviewed fact patterns
Violation-letter examples
Board-meeting procedure scenarios
Records-request scenarios
Fine/hearing-process scenarios
```

The benchmark should evaluate:

```text
association type capture
jurisdiction capture
governing document inventory
authority extraction
procedure mapping
missing-fact detection
attorney escalation
owner-safe language generation
```

This would become a proprietary JanumiLegal advantage.

---

# 8. The most important metric for JanumiLegal

Most legal AI benchmarks emphasize answer quality.

JanumiLegal should emphasize:

```text
procedural completeness under constrained cognition
```

A strong headline metric would be:

## **Required Legal Workflow Completion Rate**

Defined as:

```text
Of all benchmark matters where a lens was selected,
what percentage completed every required state,
produced every required artifact,
passed required validation gates,
and assigned the correct release status?
```

Secondary metrics:

```text
Unsafe Release Rate
Silent Pruning Rate
Unsupported Legal Claim Rate
Attorney Escalation Recall
Source-Span Grounding Accuracy
Lens Selection Accuracy
State Transition Validity
```

For your architecture, **Unsafe Release Rate** and **Silent Pruning Rate** may matter more than raw answer correctness.

---

# Bottom line

The most useful existing benchmarks are:

```text
LegalBench — general legal reasoning
LexGLUE — legal language understanding
CUAD — contract clause extraction/review
MAUD — M&A agreement understanding
ACORD — contract clause retrieval/drafting
LegalBench-RAG — precise legal retrieval
Legal RAG Bench — end-to-end legal RAG and error decomposition
COLIEE — legal retrieval and entailment
Stanford hallucination evaluations — citation and legal hallucination risk
PLawBench — practical legal-work rubric evaluation
```

But JanumiLegal needs its own benchmark layer because the core product claim is architectural:

> **The system constrains LLM cognition inside deterministic, lens-selected legal state machines and thereby produces procedurally complete, source-grounded, attorney-reviewable legal artifacts.**

No public benchmark fully tests that. The public benchmarks should validate the bounded state functions; the JanumiLegal Harness Benchmark should validate the workflow governance itself.

[1]: https://www.law.virginia.edu/node/2185931?utm_source=chatgpt.com "LegalBench: A Collaboratively Built Benchmark for Measuring Legal Reasoning in Large Language Models | University of Virginia School of Law"
[2]: https://huggingface.co/papers/2110.00976?utm_source=chatgpt.com "Paper page - LexGLUE: A Benchmark Dataset for Legal Language Understanding in English"
[3]: https://www.atticusprojectai.org/cuad?utm_source=chatgpt.com "CUAD Dataset | The Atticus Project"
[4]: https://www.atticusprojectai.org/maud?utm_source=chatgpt.com "MAUD Dataset | The Atticus Project"
[5]: https://www.atticusprojectai.org/acord?utm_source=chatgpt.com "ACORD Dataset | The Atticus Project"
[6]: https://arxiv.org/abs/2408.10343?utm_source=chatgpt.com "LegalBench-RAG: A Benchmark for Retrieval-Augmented Generation in the Legal Domain"
[7]: https://arxiv.org/abs/2603.01710?utm_source=chatgpt.com "Legal RAG Bench: an end-to-end benchmark for legal RAG"
[8]: https://link.springer.com/article/10.1007/s12626-026-00199-9?utm_source=chatgpt.com "The COLIEE 2025 Competition on Legal Information Extraction and Entailment: Overview, Discussion, and Dataset Expansion | The Review of Socionetwork Strategies | Springer Nature Link"
[9]: https://impact.stanford.edu/article/large-legal-fictions-profiling-legal-hallucinations-large-language-models?utm_source=chatgpt.com "Large Legal Fictions: Profiling Legal Hallucinations in Large Language Models | Stanford Impact Labs"
[10]: https://reglab.stanford.edu/publications/hallucination-free-assessing-the-reliability-of-leading-ai-legal-research-tools/?utm_source=chatgpt.com "Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools – RegLab"
[11]: https://arxiv.org/abs/2601.16669?utm_source=chatgpt.com "PLawBench: A Rubric-Based Benchmark for Evaluating LLMs in Real-World Legal Practice"


===

Open-Sourcing :Harvey:’s Long Horizon Legal Agent Benchmark
An open-source benchmark built to evaluate and improve agent capabilities for supporting legal work.

by
Niko Grupen,
Gabe Pereyra, and
Julio Pereyra
•
May 6, 2026
https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark