# Extract: Documentation Challenges — Canonical-vs-Doctrinal Vocabulary + §9.7 Fallacy Analysis

Sources (both chat transcripts; all items tagged [HUMAN]/[ASSISTANT]):
- `docs/Documentation Challenges/Janumi Canonical vs Doctrinal Discussion.md` (888 lines) — cited as `CanonVsDoc.md`. Human turns: L1, L359; rest assistant.
- `docs/Documentation Challenges/coding-guide-fallacy-analysis-6a2b0f.md` (197 lines) — cited as `fallacy-6a2b0f.md`. Human turns: L1, L56-60; rest assistant (includes an embedded plan file).

Focus per brief: governing stack, four-axis model, practice/applied distinctions -> DOCTRINE-CONOP; §9.7 over-application worked example -> PROTOCOL-PRACTICE.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "A **charter** establishes purpose, scope, powers, and responsibilities. A **constitution** establishes the highest-order rules and limitations governing the system." (CanonVsDoc.md L186) — Defines the constitutional layer itself; anchors what a Janumi constitution is for.
- [ASSISTANT] "what authority human users retain; what agents may and may not autonomously decide; what evidence must accompany consequential decisions; which invariants no PWA may override; how conflicts among policies, agents, validators, and users are resolved; what constitutes legitimate professional work" (CanonVsDoc.md L191-195) — The enumerated subject matter a Janumi constitution must decide; a table of contents for the constitution.
- [ASSISTANT] "The constitution is not merely doctrine. It establishes the governing order within which doctrine operates." (CanonVsDoc.md L197) — Constitution/doctrine layer separation: doctrine is subordinate to and framed by constitutional order.
- [ASSISTANT] "tenant policies may strengthen but not weaken platform constitutional controls" (CanonVsDoc.md L226) — One-way ratchet between tenant policy and constitutional controls; classic supremacy rule.
- [ASSISTANT] "**Constitutional PWU invariant** — a constraint no lower-level policy or architecture may override." (CanonVsDoc.md L348) — Defines "constitutional" as override-immunity, distinct from canonical/authoritative/binding.
- [ASSISTANT] "**Constitution** | Consequential work must remain traceable, reviewable, bounded, and subject to appropriate human authority." (CanonVsDoc.md L853) — Worked Shape Engineering example of a constitutional-level commitment; candidate constitutional sentence.

## DOCTRINE-CONOP

- [ASSISTANT] "**Canonical** concerns **recognition, identity, and reference**: which version, form, vocabulary, or artifact is accepted as the standard one? **Doctrinal** concerns **principles, interpretation, and judgment**" (CanonVsDoc.md L8-9) — The core distinction the whole discussion establishes; the two words answer different questions.
- [ASSISTANT] "**Doctrinal** therefore sits between pure interpretation and concrete prescription. Doctrine tells practitioners how to think and exercise judgment; it does not necessarily dictate every step." (CanonVsDoc.md L47) — Places doctrine on the function continuum; doctrine governs judgment, not steps.
- [ASSISTANT] "Vision / Worldview / Thesis ↓ Values, Axioms, and First Principles ↓ Constitution / Charter ↓ Doctrine ↓ Policy ↓ Standards ↓ Specifications ↓ Procedures and Playbooks ↓ Controls, Invariants, and Validators" (CanonVsDoc.md L134-152) — The governing stack: the recommended Janumi governance-and-operationalization hierarchy replacing a word-strength continuum.
- [ASSISTANT] "Doctrine explains the logic; policy states what the organization has decided." (CanonVsDoc.md L231) — Doctrine/policy boundary in one sentence.
- [ASSISTANT] "**A canonical articulation of Janumi doctrine, grounded in a professional-work constitution, expressed through normative standards and specifications, and realized through executable controls, invariants, and validators.**" (CanonVsDoc.md L355) — Recommended one-sentence description of the corpus; assigns each adjective its proper layer.
- [ASSISTANT] "replacing every instance of **canonical** with **doctrinal** would go too far. Some Janumi material is doctrinal; some is canonical; some is constitutional; some is normative." (CanonVsDoc.md L357) — Corrects the over-correction: preserve distinctions, do not swap synonyms wholesale.
- [ASSISTANT] "Axis 1: Recognition and authority ... Axis 2: Intellectual and normative function ... Axis 3: Abstraction to application ... Axis 4: Knowledge to enactment ... A single thing can have one description on every axis." (CanonVsDoc.md L771-806) — The four-axis vocabulary model; the discussion's central organizing device for all governance vocabulary.
- [ASSISTANT] "**Doctrine guides practice; practice interprets, tests, and evolves doctrine.**" (CanonVsDoc.md L557) — The reciprocal doctrine-practice loop; doctrine is not a description of current practice.
- [ASSISTANT] "Worldview ↓ Theory ↓ Constitution ↓ Doctrine ↓ Applied Doctrine ↓ Professional Practice ↓ Practice Patterns ↓ Methods and Techniques ↓ Procedures and Workflows ↓ Executable Controls ↓ Case-Specific Performance" (CanonVsDoc.md L825-845) — The Janumi translation stack, extending the governing stack through applied doctrine and practice to performance.
- [ASSISTANT] "Encoding a procedure is relatively straightforward. Encoding professional practice requires representing: when the procedure applies; when it does not; what evidence counts; how exceptions are handled; how conflicts are resolved; when judgment or escalation is necessary." (CanonVsDoc.md L623-630) — Why practice-vs-procedure matters for agentic systems; the JPWB encoding burden.
- [ASSISTANT] "**Shape Engineering Doctrine** ... **Applied Shape Engineering** ... **Shape Engineering Practice** ... These are not competing names. They name different layers of the same discipline." (CanonVsDoc.md L864-877) — Naming scheme for one discipline across three layers; template for titling Janumi doctrinal bodies.
## VOCABULARY

- [ASSISTANT] "**Canonical** | Recognized as the standard, normalized, or accepted representation among alternatives." (CanonVsDoc.md L79) — The working definition of canonical for the whole corpus.
- [ASSISTANT] "Canonical does **not**, by itself, mean governing, mandatory, philosophically foundational, or correct." (CanonVsDoc.md L93) — Negative definition preventing the original misuse that prompted the discussion.
- [ASSISTANT] "**Doctrine versus dogma:** Doctrine can guide reasoned interpretation and evolve through evidence. Dogma implies that a proposition is treated as incontrovertible" (CanonVsDoc.md L304) — Doctrine is evolvable by design; guards against reading Janumi doctrine as fixed dogma.
- [ASSISTANT] "The **canon** is the recognized corpus of Janumi artifacts. The **doctrine** is the system of principles they articulate. The **constitution** establishes the highest governing commitments." (CanonVsDoc.md L318-320) — Canon = corpus membership, doctrine = principle content; the religious-analogy mapping into Janumi.
- [ASSISTANT] "'This wins when sources conflict.' | **Controlling** ... 'This defines the system's supreme commitments and limits.' | **Constitutional**" (CanonVsDoc.md L337-338) — The practical replacement test: choose the word by the claim being made.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "These are not always strict levels of authority. A canonical form can emerge informally, while an official document can fail to become the practically canonical reference." (CanonVsDoc.md L82) — Canonical status and official status are independent variables; one never implies the other.
## PROTOCOL-PRACTICE

- [ASSISTANT] "Never solicit it, never make a control depend on it, and never treat its presence or absence as a signal ... It is never admitted as Evidence, never supplies another agent's context, never reaches a log ... never supports a finding, and is never the professional rationale summary" (fallacy-6a2b0f.md L106-107) — §9.7's actual text as quoted: a consumption/governance prohibition on private CoT, not a generation prohibition.
- [ASSISTANT] "// §9.7: never solicit private chain-of-thought ... — so we do not ask for it. thinkingLevel: 'off'," (fallacy-6a2b0f.md L111-113) — The defective implementation: hardcoded thinking off, justified by a mis-scoped citation of §9.7.
- [ASSISTANT] "The code should enable thinkingLevel: 'medium' (or higher) for quality while still ignoring any thinking_delta events for governance purposes. The restriction is on consumption, not generation." (fallacy-6a2b0f.md L90) — The corrected reading in one sentence; the worked example's resolution.
- [ASSISTANT] "**Primary Fallacy:** Category Error (Conflation of Distinct Categories) — Confuses 'reasoning as output material' with 'reasoning as internal computation' — Treats a restriction on *usage* as a restriction on *generation*" (fallacy-6a2b0f.md L140-142) — Names the failure class: prohibition over-application via category conflation.
- [ASSISTANT] "1. **Enable internal thinking** at an appropriate level ... 2. **Ignore reasoning output** if Pi emits it (don't pass to Reasoning Review) 3. **Continue to require** `declare_rationale` for the professional rationale summary" (fallacy-6a2b0f.md L154-157) — Correct-implementation recipe: generation on, consumption fenced, declared rationale remains the governed artifact.
- [ASSISTANT] "1. **Update the coding guide** to explicitly distinguish between: 'Internal model computation (thinking level)' - configurable for quality; 'Reasoning output material' - never used as evidence" (fallacy-6a2b0f.md L191-193) — Remediation direction: the guide itself must carry the computation/output-material distinction to prevent recurrence.

## SPONSOR-RULINGS

- [HUMAN] "I have using the word 'canonical' when I should be using 'doctrinal'. This leads to the question of: on the continuum of these related words, what is that continuum of words?" (CanonVsDoc.md L1) — Sponsor's originating correction: the corpus misused "canonical"; commissions the vocabulary analysis.
- [HUMAN] "Where do the words 'practice' and 'applied' fit into this discussion? As Applied Engineering or Medical Practice?" (CanonVsDoc.md L359) — Sponsor extends scope: practice/applied must be placed in the same vocabulary system.
- [HUMAN] "section 9.7 has some problems separating the intention of that guidance vs. the implementation implications ... while it is arguable that we should not use the output 'thoughts' of the model, that the model should 'think' at a specified thinking level is still something needs to be correct." (fallacy-6a2b0f.md L58) — Sponsor ruling: §9.7 prohibits using CoT output, not enabling thinking; configurable thinking level must remain correct.
- [HUMAN] "How might we characterize this type of coding agent logical fallacy?" (fallacy-6a2b0f.md L60) — Sponsor directs that the failure be named as a reusable class, not just patched.

## OPEN-QUESTIONS-CONTRADICTIONS

- [ASSISTANT] The two stacks differ: the governing stack (CanonVsDoc.md L134-152) includes "Values, Axioms, and First Principles" between Vision and Constitution; the translation stack (CanonVsDoc.md L825-845) replaces that layer with "Theory" and adds Applied Doctrine/Practice layers. — Which stack is canonical for Janumi documentation, or how they merge, is unresolved.
- [ASSISTANT] The fallacy analysis asserts §9.7 addresses "Nothing" about internal computation (fallacy-6a2b0f.md L123) yet names root cause as "The coding guide's language is ambiguous" (fallacy-6a2b0f.md L183) — Was the scope clear-but-misread, or genuinely ambiguous? Determines whether the fix is guide text or agent interpretation discipline.
