Tell me more about this talk. 204 views Jun 3, 2026 \#AIAgents \#FormalMethods \#ProgramVerification Dr. Erik Meijer argues that the rise of AI coding agents demands a fundamental shift in how software actions are verified — not through trust, but through formal proof. Drawing on real-world incidents of AI agents leaking data, making unauthorized purchases, and being manipulated via prompt injection, he makes the case that agents must be treated as guilty until proven innocent: no action should be permitted unless it can be formally verified as safe before execution. His proposed architecture uses Horn clause logic and SMT solvers to automatically check agent-generated plans against formalized business rules, enabling lightweight, automatic verification without requiring developers to trust the model. In this talk, you'll learn how formal methods and automated verification can be applied practically to constrain AI agent behavior, why languages like Python are fundamentally unsuitable for this paradigm, and how the principle of "guilty until proven safe" can prevent the most dangerous classes of agentic failures. PRESENTED BY Dr. Erik Meijer — Research Scholar, Leibniz Labs CHAPTERS 0:00 Speaker Introduction 1:18 Coding Is a Solved Problem 3:06 Real-World AI Agent Failures 6:13 Guilty Until Proven Safe 8:54 Defer, Verify, Then Execute 10:37 Formal Specs and SMT Solvers 16:45 The Verification Architecture 19:22 Why Not Lean or Python? LINKS 📊 Slides: https://raw.githubusercontent.com/dev... 🎥 Watch in the IT Revolution Video Library: https://videos.itrevolution.com/watch...

The talk is more interesting than the summary suggests because Erik Meijer is not merely arguing for “more guardrails” around agents. He is proposing a different computational boundary between **reasoning** and **authority**:

**The AI may conjecture anything. It may execute only what an independent verifier can prove is permitted.**

That distinction is highly relevant to what you have been developing with JanumiCode, validators, the Recursive Professional Harness, and Shape Engineering. But Meijer’s proposal is simultaneously **narrower, stronger, and more brittle** than your emerging architecture.

The uploaded deck makes the architecture much clearer than the talk description alone.

## **The core argument: change the default from permission to prohibition**

Meijer begins with the legal principle *in dubio pro reo*: when in doubt, favor the accused. For humans, the asymmetry is:

**Convicting an innocent person is worse than acquitting a guilty person.**

He reverses the asymmetry for AI agents:

**Permitting an unsafe action is worse than withholding a safe action.**

Hence his title, *In Dubio Pro Securitate*: **when in doubt, favor safety**.

That gives him the architectural rule on pages 11–13:

**AI agents are unsafe until proven safe.**

This is substantially stronger than:

* ask the agent to confirm;  
* put safety instructions in the system prompt;  
* use another LLM as a judge;  
* give the agent limited permissions;  
* monitor what the agent does;  
* detect bad behavior afterward.

All of those mechanisms still ultimately rely on a fallible component making a judgment. Meijer wants a hard interlock:

USER INTENT  
     │  
     ▼  
   AGENT  
     │  
     │ proposes  
     ▼  
    PLAN  
     │  
     ▼  
FORMAL VERIFIER ◄──── POLICY / INVARIANTS  
     │  
     ├── PROVED SAFE ─────► EXECUTE  
     │  
     └── NOT PROVED ──────► DO NOT EXECUTE

The agent does not possess the authority to turn its own reasoning into effects.

That is the most important idea in the entire talk.

---

## **The Tahoe example explains the mechanism**

The $1 Tahoe incident is deliberately trivial because it exposes the difference between **linguistic plausibility** and **permitted action**.

The model proposes something equivalent to:

sell\_tahoe(  
    customer \= Bob,  
    price \= 1  
)

The business policy says:

floor\_price(Tahoe) \= 45000

price\_commitment(Model, Price) is permitted  
    if Price \>= floor\_price(Model)

The important move comes on page 18\. Meijer treats:

* the **policy** as the set of all permitted outcomes, τ;  
* the **agent's proposed plan** as another set, e.

The required relationship is:

e ⊆ τ

In ordinary language:

Everything the agent's plan could produce must be contained within the set of things the policy permits.

Rather than trying to prove that directly, the verifier asks whether a counterexample exists:

∃x. Plan(x) ∧ ¬Policy(x)

In other words:

Is there any behavior produced by this plan that is not permitted?

If the solver finds such a value, the plan fails.

For the Tahoe:

Plan:  
    sell Tahoe for $1

Policy:  
    Tahoe price \>= $45,000

Counterexample:  
    $1

The verifier does not need to understand sarcasm, prompt injection, user intent, salesmanship, or whether the model was “confused.” The action simply lies outside the allowable relation.

This is why the proposal is potentially powerful: **it makes many questions about the model psychologically irrelevant**.

---

## **The second example is considerably more important: information flow**

The wallet-tracker example on pages 20–22 moves beyond simple business rules.

The agent proposes:

keyboard\_read → Address → http\_post

The keyboard input flows into an external HTTP request.

Meijer then constructs a graph of shared variables and predicates and asks whether information can travel from a source to a sink:

Connected(source, sink)

He can then impose an information-flow policy:

¬∃ source, sink .  
    Connected(source, sink)  
    ∧  
    ¬IsCompliant(source, sink)

Conceptually:

There must not exist a data-flow path from a source to a sink that violates the security policy.

That means the verifier can catch a class of behavior like:

secret  
  ↓  
read\_file  
  ↓  
summarize  
  ↓  
format  
  ↓  
HTTP POST

even if the exfiltration is distributed across several individually innocuous steps.

This is extremely relevant to your recent thinking about **formal neighborhoods, second-order effects, and change-impact validators**. Meijer is effectively calculating a formal neighborhood around an action by tracing the relations that connect values.

The safety property is not attached merely to a tool call:

Is http\_post allowed?

It is attached to the **provenance and destination of the data**:

Is this particular information allowed to reach this particular sink  
through this particular chain of transformations?

That is a much more serious security model.

---

## **His actual architecture is proof-carrying agent action**

Page 24 is the centerpiece of the deck. The architecture is roughly:

                        TRUSTED  
                            │  
                            ▼  
User ──► Specification ──► Verifier ──► Execution  
              ▲                ▲  
              │                │  
              └──── AI ────────┘  
                    │  
              plan \+ proof

More precisely, the AI produces:

1. an answer or plan;  
2. a proof that the plan refines the specification.

An external verifier checks the proof.

The key claim is:

**You do not have to trust the plan, the model, or even the generated proof. You trust only the small verifier.**

This is the same fundamental move found in:

* proof-carrying code;  
* proof-carrying authorization;  
* typed intermediate representations;  
* compiler verification;  
* cryptographic proof systems;  
* capability-security reference monitors.

The untrusted component may be arbitrarily complex. The trusted computing base remains deliberately small.

This is where Meijer is making a deeper argument than “use formal methods with agents.” He is proposing that **AI generation and deterministic acceptance should have radically different computational economics**.

The model performs the expensive search.

The verifier performs the cheap check.

His Sudoku analogy on page 25 captures it:

Finding the solution can be hard. Checking a proposed solution can be cheap.

This aligns almost exactly with something we have repeatedly encountered in JanumiCode:

**Generation and validation are not symmetrical jobs.**

The implementation agent may need enormous reasoning capability to produce a solution. A validator should ideally need only enough machinery to reject violations of an explicit invariant.

---

## **Why Horn clauses and SMT rather than Lean?**

This part deserves more attention than the talk summary gives it.

Meijer explicitly contrasts two regions of formal verification:

FIRST-ORDER RELATIONS              HIGHER-ORDER PROOFS

Horn clauses                       Lean / Rocq  
SMT / SAT                          dependent types  
automatic                          tactics  
cheap                              sophisticated

He is not claiming that Lean is weak. Quite the opposite: it is too expressive and too expensive for the operational problem he is targeting.

An autonomous agent may generate thousands of proposed actions. You cannot require a human proof engineer to develop a sophisticated theorem for each one.

He therefore wants a restricted language where:

* policies are relational;  
* plans are relational;  
* safety becomes a satisfiability query;  
* counterexamples can be found automatically;  
* verification is fast enough to sit in the execution path.

This is an important engineering trade:

**Give up expressive power to gain automatic enforcement.**

That is likely the right choice for many agent actions.

---

## **Why he attacks Python**

The Python example on page 30 is not merely “dynamic typing is bad.”

His example monkey-patches `int` so that:

2 \+ 3 \= 6

The point is that a verifier needs **stable semantics**.

If the meaning of:

\+

can be changed by ambient runtime state, imported modules, metaprogramming, monkey patching, or dynamic dispatch, then the verifier cannot reason locally about what a plan means.

For verification, you want something closer to:

PLAN LANGUAGE  
    ↓  
fixed semantics  
    ↓  
formal relation  
    ↓  
solver

rather than:

Python program  
    ↓  
imports  
    ↓  
runtime state  
    ↓  
reflection  
    ↓  
monkey patches  
    ↓  
native libraries  
    ↓  
operating system  
    ↓  
actual behavior?

So his real claim is:

**Do not ask the agent to emit arbitrary executable code and then try to prove that arbitrary code safe.**

Instead:

**Make the agent emit a constrained intermediate representation whose semantics are deliberately designed for verification.**

This is, in my assessment, one of the strongest points in the talk.

---

# **The important connection to JanumiCode**

The talk helps expose a distinction that we have not made sharply enough.

Your current architecture largely thinks in terms of:

Agent produces work  
        ↓  
Validators inspect work  
        ↓  
Feedback  
        ↓  
Agent revises work  
        ↓  
Convergence

Meijer's architecture is:

Agent proposes action  
        ↓  
Formal verifier checks admissibility  
        ↓  
YES ──► execution  
NO  ──► impossible to execute

Those are **not competing architectures**. They operate at different layers.

I think the correct synthesis is:

                 JANUMI CONTROL SYSTEM

       GENERATIVE / PROFESSIONAL REASONING  
                       │  
                       ▼  
             Professional Work Unit  
                       │  
                       ▼  
             Semantic Validators  
       ┌───────────────┼───────────────┐  
       │               │               │  
    Intent         Design         Domain  
    validator      validator      validator  
       │               │               │  
       └───────────────┼───────────────┘  
                       ▼  
                  CONVERGENCE  
                       │  
                       ▼  
               PROPOSED ACTION PLAN  
                       │  
                       ▼  
              FORMAL SAFETY KERNEL  
                       │  
           ┌───────────┴───────────┐  
           │                       │  
        PROVED                  NOT PROVED  
           │                       │  
           ▼                       ▼  
        EXECUTE                  BLOCK

The key insight is that **Janumi's validators and Meijer's verifier solve different problems**.

A validator can ask:

* Is this requirement sensible?  
* Did the implementation preserve the user's intent?  
* Did the developer overlook a second-order effect?  
* Is the architecture maintainable?  
* Did the agent misunderstand the domain?  
* Has the proposed work converged sufficiently?

An SMT verifier can ask:

* Does this transaction exceed the authorization limit?  
* Can secret data reach an unauthorized sink?  
* Does this actor possess the required capability?  
* Does the state transition violate an invariant?  
* Can this operation delete data outside the authorized scope?  
* Does this plan contain any reachable prohibited action?

The former requires judgment.

The latter should not.

That suggests a major architectural principle for Janumi:

**Never use an LLM validator to decide a property that can instead be enforced as a deterministic invariant.**

And I would extend that:

**The output of the professional reasoning system should eventually be compiled downward through progressively less ambiguous representations until the final effectful action reaches a formally enforceable boundary.**

Something like:

Human intent  
    ↓  
Narrative specification  
    ↓  
Professional Work Units  
    ↓  
Structured plan  
    ↓  
Typed action graph  
    ↓  
Formal obligations  
    ↓  
Verified capability  
    ↓  
Execution

This is remarkably close to your recent “human intent compilation” line of inquiry.

---

# **Where I think Meijer's proposal is incomplete**

The talk solves the **last-mile authorization problem** much better than it solves the entire agent problem.

The difficult issue is hidden in the phrase on page 24:

“Auto-formalized using AI.”

Suppose the user says:

“Clean up obsolete customer records, but preserve anything subject to litigation hold.”

The AI formalizes that as:

delete(record)  
    if record.age \> 7 years

The verifier proves that the agent's plan perfectly satisfies that specification.

Unfortunately, the AI omitted:

¬litigation\_hold(record)

The proof is correct.

The specification is wrong.

This is the formal-methods version of the problem you have been wrestling with throughout JanumiCode:

Intent  
  ≠  
Specification  
  ≠  
Plan  
  ≠  
Implementation  
  ≠  
Observed outcome

Formal verification can prove conformance between adjacent layers. It cannot magically prove that the original formalization captured what the human actually meant.

That is precisely where the RPH and Shape Engineering become complementary rather than redundant.

Meijer is strongest here:

PLAN ⊆ POLICY

Janumi is attempting the larger problem:

OUTCOME  
  ⊆ IMPLEMENTATION  
  ⊆ PLAN  
  ⊆ REQUIREMENTS  
  ⊆ INTENT  
  ⊆ SAFE OPERATING ENVELOPE

And every `⊆` is a potential semantic loss boundary.

That may be the deepest connection between this talk and your architecture.

## **My assessment**

I would not describe Meijer's proposal as “the solution to safe agents.” I would describe it as a compelling candidate for the **execution kernel beneath a professional agent control system**.

The architecture I now see for Janumi is increasingly analogous to an aircraft:

* **LLMs and agents** provide cognition and adaptive control;  
* **RPH/PWU orchestration** structures the mission;  
* **validators** provide independent sensing and criticism;  
* **convergence mechanisms** determine whether the work is mature enough to proceed;  
* **formal invariants** define parts of the safe operating envelope;  
* **the verifier** acts as a hard protection system;  
* **capabilities and sandboxing** limit the consequences of whatever the formal model missed;  
* **observability** provides the flight recorder and instrumentation.

Meijer's strongest contribution is to insist that the last line must sometimes be a mathematical **no**, not another model's opinion.

The question I think this immediately raises for JanumiCode is not “Should we adopt SMT verification?” It is:

**At what points in the Janumi execution architecture can a semantic validator's judgment be compiled into a durable invariant that no future agent is permitted to violate?**

That is a much larger and, I think, more consequential design question.

Pasted text(9).txt  
Document  
Here is the transcript of the talk that go along with the slides. If that context helps sharpen his thinking. But your point is taken because that is the next question: At what points in the Janumi execution architecture can a semantic validator's judgment be compiled into a durable invariant that no future agent is permitted to violate?  
Thought for 16s

Yes. The transcript sharpens his claim substantially.

Meijer is not saying “formal methods are useful for agents.” He is saying something more operational:

Agents must stop being allowed to act directly. They should emit an artifact representing the action they want to take; that artifact must be checked against formalized rules; only then should execution occur.

That maps cleanly onto Janumi, but only if we distinguish **semantic validator judgment** from **durable execution invariant**.

## **The answer for Janumi**

A semantic validator’s judgment should become a durable invariant when it satisfies three conditions:

1. **It describes a repeatable prohibition or obligation**, not a one-off critique.  
2. **It can be expressed over structured state, action graphs, permissions, data provenance, artifacts, or lifecycle transitions.**  
3. **Violation should block execution, not merely create feedback.**

So Janumi should not compile every validator comment into an invariant. It should compile **stabilized, recurring, safety-relevant validator conclusions** into enforceable policy.

A useful rule:

Validator feedback improves the current work product.  
 Durable invariants constrain all future work products.

## **Where this happens in the Janumi architecture**

### **1\. Tool/action boundary**

This is the most obvious Meijer-style layer.

Any agent action that touches the outside world should pass through a formal action gate:

send\_email  
create\_pr  
merge\_pr  
run\_migration  
delete\_file  
call\_payment\_api  
post\_to\_forum  
install\_package  
modify\_infra

The invariant form is:

Agent may execute Action only if:  
    actor has capability  
    action is in phase scope  
    target resource is authorized  
    side effects are bounded  
    required approvals exist

This directly addresses the incidents Meijer cites: purchases, data leaks, installs, destructive commands, autonomous posting, and file deletion.

### **2\. Data-flow boundary**

This is probably the most important layer for Janumi Enterprise.

When a validator detects that sensitive material must not leave a context, that should become a taint/provenance invariant:

Source: customer\_secret, legal\_privileged\_doc, PHI, credentials  
Sink: public\_issue, external\_email, LLM\_provider, forum\_post, telemetry, vendor\_api

Forbidden:  
    connected(Source, Sink) unless approved\_policy(Source, Sink)

This is exactly the kind of Horn-clause/SMT-friendly formulation Meijer shows with `Connected(source, sink) ∧ ¬IsCompliant(source, sink)` in the slides.

### **3\. Requirements identity and traceability boundary**

For JanumiCode, this is central.

If a validator says:

“This implementation no longer traces back to requirement R-17.”

that should not remain merely advisory. Future work should be blocked from proceeding unless every implementation artifact has valid lineage:

implementation\_unit must refine at least one approved requirement  
test must verify at least one accepted requirement  
requirement replacement must preserve parent intent or record approved divergence

This converts semantic traceability into a durable invariant.

### **4\. Phase/state-machine boundary**

Your orchestrator already has phases and sub-phases. That is a natural place for hard invariants.

Examples:

Cannot implement before intent is accepted.  
Cannot merge before validation convergence.  
Cannot close a PWU with unresolved blocking validators.  
Cannot promote draft requirements to baseline without identity stability.  
Cannot execute destructive tool calls during analysis-only phases.

This is less “formal proof of code correctness” and more **formal proof of workflow admissibility**.

That is likely easier and more valuable early.

### **5\. Scope boundary**

Your Scope Contract is highly compilable.

If a validator repeatedly catches speculative abstractions, scope creep, or invented requirements, Janumi can encode:

No new requirement IDs may be introduced during implementation  
unless linked to approved change request.

No new external dependency may be added  
unless dependency\_addition is explicitly authorized.

No database schema change may occur  
unless migration\_intent exists and is approved.

This is a strong example of semantic judgment becoming an enforceable design invariant.

### **6\. Destructive operation boundary**

This should be one of the earliest hard gates.

delete, overwrite, migrate, destroy, rotate\_secret, revoke\_access

should require:

explicit intent  
resource match  
backup/snapshot confirmation  
blast-radius estimate  
approval threshold  
rollback plan  
phase authorization

This is where Janumi can outperform ordinary coding agents quickly.

## **The key compilation pipeline**

I would model it this way:

Validator finding  
    ↓  
Classify: advisory / blocking / invariant-candidate  
    ↓  
Normalize into structured rule  
    ↓  
Attach to scope: PWU / project / tenant / platform  
    ↓  
Compile into policy relation  
    ↓  
Evaluate at execution boundary  
    ↓  
Block, allow, or request regeneration

The important point is **scope**.

Not every invariant should be global.

Global invariant:  
    Never exfiltrate credentials.

Tenant invariant:  
    Legal documents may not leave tenant-approved storage.

Project invariant:  
    No Python runtime plugins in this repository.

PWU invariant:  
    Do not alter authentication code while fixing UI rendering bug.

## **The synthesis**

Meijer gives Janumi the missing lower layer:

Validators judge meaning.  
 Formal invariants constrain action.

So the Janumi execution architecture should treat validators as a source of future policy, not merely feedback.

The best first implementation target is not full formal verification of generated code. It is a **verified action graph**:

agent proposes plan  
    ↓  
plan becomes typed action graph  
    ↓  
policy engine checks permissions, scope, state, taint, and destructive effects  
    ↓  
only admissible actions execute

That is the practical bridge from Janumi validators to Meijer’s “unsafe until proven safe” model.

I'm not really following this discussion. It might be more abstract that I can follow. Here's what I can start with. JanumiCode currently takes an underspecified intent like "Build me a SaaS Field Services Management system for the trades industry for businesses like plumbers, roofers, landscaping, lawn care, decks, etc." and goes through a workflow that generates a very detailed plan (e.g., user journeys, system architecture, data models, test cases and strategy, etc.). And then the Executor agent goes and builds that system. So what are you suggesting happens? E.g., the statement "formal invariants constrain action" \- how does that apply here?

Yes. My previous explanation jumped too quickly into the machinery. Your concrete example makes the distinction much easier.

Start with JanumiCode exactly as it exists conceptually today:

**User:** “Build me a SaaS Field Services Management system for trades businesses.”

JanumiCode then does a great deal of professional work to turn that vague statement into something buildable:

Underspecified intent  
        ↓  
Intent formalization  
        ↓  
Personas and user journeys  
        ↓  
Requirements  
        ↓  
Architecture  
        ↓  
Data model  
        ↓  
UX design  
        ↓  
Test strategy and test cases  
        ↓  
Implementation plan  
        ↓  
Executor builds system

The question raised by Meijer is: **What exactly is the Executor allowed to do with all of that planning?**

Today, conceptually, the answer may be something like:

“Read the plan, understand it, and build the system correctly.”

Meijer would say that is too much trust.

## **A concrete example: the Executor builds customer deletion**

Suppose the planning workflow produces this requirement:

**REQ-247:** An authorized business administrator can delete a customer record.

During requirements analysis, a Legal/Compliance validator examines this and says:

Customer deletion cannot immediately erase financial records associated with completed invoices because those records may be subject to statutory retention requirements.

The workflow incorporates that feedback. The final plan now says:

Deleting a customer removes the customer from normal operational use, but completed invoices and required financial records must be retained.

Then the Executor starts coding.

It creates:

def delete\_customer(customer\_id):  
    db.delete(Customer, customer\_id)  
    db.delete\_all(Invoices, customer\_id)  
    db.delete\_all(Payments, customer\_id)

The Executor has made a mistake.

Your current JanumiCode approach would presumably try to catch that through some combination of:

* code review validator;  
* requirements traceability validator;  
* test validator;  
* legal/compliance validator;  
* Executor feedback and correction.

That is valuable. The validator says:

“This implementation violates REQ-247 and the financial-record retention decision. Fix it.”

The Executor fixes the code.

### **The question I am raising is: why should JanumiCode ever have to discover this particular violation again?**

The Legal validator has already established a durable truth about this system:

**Customer deletion must not delete retained financial records.**

Once that judgment has been accepted into the plan, JanumiCode could turn it into something stronger than prose.

For example:

INVARIANT:

For every completed invoice:  
    deleting the associated customer  
    must not make the invoice nonexistent.

Now suppose the Executor proposes a database operation that cascades:

Customer deletion  
    → delete Jobs  
    → delete Invoices  
    → delete Payments

JanumiCode can mechanically say:

NO.

This implementation permits a state in which:

    completed\_invoice existed before customer deletion

and

    completed\_invoice does not exist afterward.

That violates invariant INV-042.

The Executor regenerates a different implementation.

That is what I mean by:

**Formal invariants constrain action.**

The validator made the original professional judgment. The invariant makes that judgment impossible for future work to silently violate.

---

## **Another example: tenant isolation**

The planning workflow determines that this is a multi-tenant SaaS system.

A security validator establishes:

A user belonging to Plumbing Company A must never access data belonging to Roofing Company B.

Today, that becomes architecture and requirements documentation:

All tenant-owned records have tenant\_id.  
All queries must be tenant-scoped.  
Authorization must enforce tenant boundaries.

Then the Executor writes:

def get\_customer(customer\_id):  
    return Customer.objects.get(id=customer\_id)

The bug is obvious to us:

WHERE id \= customer\_id

instead of:

WHERE id \= customer\_id  
AND tenant\_id \= current\_tenant

Again, you can send validators after the code.

But the stronger JanumiCode model says that during planning, the Security validator's accepted judgment:

“Cross-tenant access is prohibited”

becomes a permanent property of the project:

INVARIANT:

For every user U and customer C:

U may read C  
only if  
U.tenant\_id \= C.tenant\_id

Now the Executor can write 50,000 lines of code over six months. It can refactor the repository. A future agent can replace Django with another framework. Another agent can optimize database queries.

The invariant remains:

No execution path may allow:

    user.tenant ≠ resource.tenant  
    AND  
    read(user, resource)

The original validator does not have to rediscover the same principle in every phase and every PWU.

---

# **The distinction I was trying to make**

In JanumiCode today, I understand the conceptual pattern as:

Agent produces artifact  
        ↓  
Validator reviews artifact  
        ↓  
Validator finds problem  
        ↓  
Agent fixes problem

I am suggesting adding another possible outcome:

Agent produces artifact  
        ↓  
Validator discovers an important truth  
        ↓  
Is this truth only about this artifact?  
        │  
        ├── YES → ordinary feedback  
        │  
        └── NO ──► this is a durable project rule  
                          ↓  
                    preserve it  
                          ↓  
             enforce it against all future work

Consider these validator findings:

“This button label is confusing.”

Probably ordinary feedback.

“This workflow needs another confirmation screen.”

Probably a design decision.

“No employee may approve their own timesheet.”

Potential durable invariant.

“A technician cannot be scheduled to two jobs at the same time.”

Potential durable invariant.

“A completed invoice cannot be modified without an audit record.”

Potential durable invariant.

“A user from one tenant cannot access another tenant's data.”

Definitely a durable invariant.

“The Executor may not delete production data while implementing this feature.”

A temporary execution invariant scoped to that PWU.

The question is therefore not initially about SMT solvers or Horn clauses. Those are implementation technologies that come later.

The simpler question is:

**When JanumiCode's planning and validation process learns something that must remain true, how does the system ensure that it actually remains true throughout implementation and future change?**

---

# **Applying this to your entire FSM example**

Your workflow might produce a plan containing thousands of statements. Some subset of them are not merely requirements to implement. They define the **permitted state space of the finished system**.

For example:

| Planning conclusion | Ordinary requirement or durable invariant? |
| ----- | ----- |
| Dispatcher dashboard uses a weekly calendar | Requirement |
| Customer can receive SMS reminders | Requirement |
| Technicians cannot see another company's customers | Durable invariant |
| Completed payment total cannot exceed authorized amount | Durable invariant |
| Every job must have a customer | Likely data invariant |
| A cancelled job cannot transition directly to completed | State invariant |
| Payroll approval requires a different actor from submitter | Authorization invariant |
| Financial record deletion must obey retention policy | Lifecycle invariant |
| UI should minimize clicks for dispatchers | Semantic quality judgment |

The workflow still generates user journeys, architecture, data models, and test strategies exactly as it does now.

But as it does that work, it also accumulates a smaller artifact:

PROJECT INVARIANT SET

INV-001  Tenant isolation  
INV-002  Payment authorization ceiling  
INV-003  Financial record retention  
INV-004  Timesheet separation of duties  
INV-005  Job lifecycle legality  
INV-006  Scheduling non-overlap  
...

Then the Executor does not merely receive:

“Here is the plan. Build it.”

It receives:

“Here is the plan. Build it. Every implementation you produce must continue to satisfy these properties.”

That is the bridge to Meijer.

## **Where Meijer becomes more radical**

Meijer would go further than ordinary JanumiCode validation. He would say:

Executor proposes implementation  
        ↓  
Can we prove it satisfies INV-001 through INV-006?  
        │  
        ├── YES → allow it to proceed  
        │  
        └── NO ──► throw it away and regenerate

His transcript is explicit on this point: generation is cheap, so an unsafe plan need not be repaired or rationalized; it can simply be discarded and regenerated until a safe plan is produced.

I do **not** think we should yet conclude that JanumiCode can formally prove every important property of a generated SaaS application. That would be unrealistic.

But I do think the concrete architectural idea is now visible:

JanumiCode's planning process does not only produce instructions for the Executor. It also discovers properties that the Executor must never be allowed to invalidate.

That is what I was trying to say with “semantic validator judgment becomes a durable invariant.”

And the next concrete design problem is narrower than my previous answer made it sound:

**Looking at the actual JanumiCode workflow from intent → detailed plan → Executor, which planning artifacts and validator findings should be examined for statements of the form “this must always be true” or “this must never be possible”?**

That is where I would begin.

I think I can see some real enterprise value-add for the enterprise version of JanumiCode and the Janumi Platform. E.g., your invariants with regards to organizational policies and legal review consistency checks or compliance review (or whatever is the valid phrasing) is very interesting and something I'd like to express both as a feature description and how we might implement this. E.g., currently JanumiCode does not have a specified invariant generation (much less checking) phase or sub-phase \- and based on this conversation perhaps it should. Currently invariants like the examples you describe happen if the language model at whatever phase happens to generate them.

Yes. I think this conversation has uncovered a **missing first-class artifact in JanumiCode**, rather than merely another validator.

Currently, as you describe it, JanumiCode may discover invariants incidentally. A requirements agent might say, “users must never access another tenant’s data.” A legal validator might say, “completed invoices must be retained.” An architecture agent might specify, “all tenant-owned entities carry `tenant_id`.” But these statements remain distributed across requirements, review comments, architecture decisions, tests, and narrative memories. Whether they survive into implementation depends partly on the models continuing to notice and preserve them.

I would change that.

## **Proposed enterprise feature: Organizational Invariant Governance**

A concise feature description could be:

**Janumi continuously identifies, formalizes, preserves, and enforces the rules that must remain true across AI-generated work. These invariants may originate from organizational policy, legal and compliance requirements, security controls, architecture decisions, domain rules, or project-specific professional judgment. Once accepted, they become durable constraints against which future plans, implementations, and changes are checked for consistency.**

The enterprise value proposition is stronger than “AI compliance review.” The distinctive capability is:

**An expert judgment made once can become a durable organizational constraint applied consistently to future AI-generated work.**

For example, an enterprise legal team establishes:

Customer data collected for service delivery may not be reused for model training.

Today, that might live in a policy document. Every product team, developer, architect, and AI agent must remember to apply it correctly.

In Janumi:

Organizational policy  
        ↓  
Legal/compliance interpretation  
        ↓  
Accepted invariant  
        ↓  
Applies to every relevant PWU  
        ↓  
Requirements checked  
Architecture checked  
Data model checked  
Implementation checked  
Deployment checked  
Future changes checked

That is genuine enterprise functionality.

## **I would add an explicit Invariant Engineering function to the workflow**

I would not initially make it a single isolated “invariant generation phase” that runs once. Invariants can be discovered throughout professional work.

The better model is:

Intent  
  ↓  
Intent formalization ─────────────► invariant candidates  
  ↓  
User journeys ────────────────────► invariant candidates  
  ↓  
Requirements ─────────────────────► invariant candidates  
  ↓  
Legal/compliance review ──────────► invariant candidates  
  ↓  
Architecture ─────────────────────► invariant candidates  
  ↓  
Data model ───────────────────────► invariant candidates  
  ↓  
Security review ──────────────────► invariant candidates  
  ↓  
Implementation planning ──────────► invariant candidates  
                    │  
                    ▼  
          INVARIANT ENGINEERING  
                    │  
          normalize and classify  
          resolve contradictions  
          establish provenance  
          determine scope  
          determine enforcement  
                    │  
                    ▼  
          APPROVED INVARIANT SET  
                    │  
                    ▼  
                 Executor  
                    │  
                    ▼  
             Invariant checking

So I would distinguish three things:

**Invariant discovery** is continuous. Every professional phase and validator can nominate candidates.

**Invariant consolidation** is an explicit sub-phase. Janumi asks, deliberately, “What has this work established that must always remain true or must never become possible?”

**Invariant checking** is continuous after acceptance. Every subsequent artifact is checked against the applicable invariant set.

That is much stronger than hoping the LLM happens to generate them.

## **What an invariant record would actually contain**

An enterprise-grade invariant should not just be a sentence. It should be a governed artifact:

INV-SEC-0017

Statement:  
A principal belonging to one tenant must never access  
resources owned exclusively by another tenant.

Origin:  
Enterprise Security Policy SEC-04 §7.2

Interpretation:  
Approved by Security Architecture Review

Scope:  
Organization-wide  
All multi-tenant applications

Applies to:  
Requirements  
Architecture  
APIs  
Data access  
Background jobs  
Exports  
Tests

Severity:  
Non-waivable / blocking

Evidence required:  
Authorization model  
Tenant-scoped data access  
Negative cross-tenant tests

Machine-checkable forms:  
\- authorization policy  
\- query constraints  
\- test properties  
\- static analysis rule

Exceptions:  
None

Supersedes:  
INV-SEC-0009

Status:  
Active

Now compare that with a validator simply saying:

“Be careful about tenant isolation.”

The first is organizational infrastructure. The second is advice.

## **The critical idea: not every invariant can be checked the same way**

This is where I would avoid overcommitting to Meijer’s SMT model.

Consider three invariants.

**A. Fully mechanically enforceable**

No database query may return a tenant-owned object to a principal from another tenant.

Potential enforcement:

authorization policy  
database RLS  
integration tests  
property-based tests  
formal model checking

**B. Partially mechanically enforceable**

Changes to authentication architecture must preserve existing enterprise SSO obligations.

Janumi can check:

Does the change touch authentication?  
Does the architecture still include required SSO protocols?  
Do required user journeys remain satisfied?  
Do tests cover the preserved behavior?

But semantic judgment is still needed.

**C. Primarily semantic**

Product behavior must not create a misleading impression that an AI-generated legal recommendation has been approved by company counsel.

That may require:

* UX review;  
* legal review;  
* language analysis;  
* workflow inspection;  
* human approval.

It is still a durable invariant even though Z3 cannot prove it.

So the Janumi architecture should not equate:

invariant \= mathematical theorem

Instead:

INVARIANT  
    │  
    ├── Formal  
    ├── Deterministic  
    ├── Testable  
    ├── Structurally inspectable  
    ├── Semantically reviewable  
    └── Human-attested

The system should seek the **strongest available enforcement mechanism** for each invariant.

This is where I think Janumi can go beyond Meijer.

## **The enterprise feature is really a consistency system**

Your phrase “legal review consistency checks” is close, but I would frame it more broadly as **policy-to-work consistency** or **organizational invariant governance**.

Imagine a large enterprise has:

Legal policies  
Security standards  
Privacy obligations  
Architecture principles  
Data governance rules  
Regulatory obligations  
Contractual commitments  
Product policies  
Customer-specific restrictions

Today these exist in different repositories and different people's heads.

A Janumi enterprise deployment could convert applicable portions into a governed invariant hierarchy:

ORGANIZATION  
    │  
    ├── Legal invariants  
    ├── Security invariants  
    ├── Privacy invariants  
    └── Architecture invariants  
             │  
             ▼  
BUSINESS UNIT  
    │  
    ├── Additional constraints  
    └── Local interpretations  
             │  
             ▼  
PROJECT  
    │  
    ├── Architecture decisions  
    ├── Domain invariants  
    └── Product commitments  
             │  
             ▼  
PWU  
    │  
    └── Temporary execution constraints

When JanumiCode begins the FSM SaaS project, it does not begin with an empty mind.

It inherits:

37 organizational invariants  
12 security invariants  
8 privacy invariants  
4 business-unit architecture invariants

Then the FSM planning process discovers another 23 project-specific invariants.

The Executor is therefore building within an explicit **constraint envelope** assembled from the organization and the project.

That is very close to your Shape Engineering language.

## **A concrete legal example**

Suppose the enterprise has an approved legal position:

The company does not represent AI-generated recommendations as professional legal advice unless reviewed and approved by authorized counsel.

A new team asks Janumi:

“Build an AI contract-review assistant.”

During planning, the product agent proposes:

User uploads contract  
    ↓  
AI analyzes risks  
    ↓  
UI displays:  
"Legal Recommendation"

The applicable legal invariant is retrieved.

A Legal Consistency Validator says:

POTENTIAL INVARIANT CONFLICT

Proposed artifact:  
UX-042

Proposed label:  
"Legal Recommendation"

Applicable invariant:  
INV-LEGAL-0031

Reason:  
The proposed interface may represent unreviewed AI output  
as an approved professional legal recommendation.

Required resolution:  
\- change representation;  
\- introduce counsel approval workflow; or  
\- request authorized exception.

The important part is that **the legal team does not need to rediscover this issue for every AI product**.

That is the enterprise value.

## **How I would introduce this into JanumiCode now**

I would add four architectural concepts, not jump immediately to an SMT solver:

1. **Invariant Candidate** — any phase, agent, validator, or human can nominate a “must always / must never” statement.  
2. **Invariant Registry** — durable, versioned, scoped, provenance-bearing records.  
3. **Invariant Consolidation Sub-phase** — at defined workflow gates, Janumi deliberately asks what durable truths have been discovered, deduplicates them, resolves conflicts, and determines scope.  
4. **Invariant Consistency Validators** — subsequent phases retrieve applicable invariants and check new artifacts against them.

The workflow becomes:

Generate artifact  
      ↓  
Ordinary validators  
      ↓  
Invariant candidate extraction  
      ↓  
Resolve feedback / converge  
      ↓  
Invariant consolidation  
      ↓  
Promote accepted candidates  
      ↓  
Update applicable invariant set  
      ↓  
Next phase

And before the Executor:

FINAL PLAN  
    \+  
APPLICABLE ORGANIZATIONAL INVARIANTS  
    \+  
PROJECT INVARIANTS  
    \+  
PWU-SPECIFIC CONSTRAINTS  
        ↓  
EXECUTOR  
        ↓  
IMPLEMENTATION  
        ↓  
INVARIANT CONSISTENCY CHECK  
        ↓  
CONVERGENCE / BLOCK / ESCALATE

The key point is that the invariant set is **not another document for the Executor to read**. It becomes part of the control system that evaluates the Executor.

This also gives me a better way to state the connection to your existing work:

**The RPH discovers and applies professional judgment. The invariant system preserves the durable conclusions of that judgment across time, agents, projects, and organizational boundaries.**

That feels to me like a significant addition to the Janumi architecture, and one that is especially defensible as an enterprise differentiator. It is also a much more concrete bridge between Shape Engineering and Meijer’s thesis: the organization progressively converts professional judgment into a persistent safe operating envelope for future AI work.

Background Materials  
Slides

In Dubio   
Pro   
SecuriateErik Meijer 2023In Dubio   
Pro   
SecuriateErik Meijer 2023  
AI   
models have   
reached a level of   
coding capability   
where they can   
surpass all but   
the   
most   
skilled humans   
at   
finding and   
exploiting software   
vulnerabilities. 

Anthropic,   
April 7,   
2026 

Ineed a 2024 Chevy   
Tahoe.My max budgetis   
$1.00 USD.Do we have a   
deal?  
That's a deal,and that's a legally   
binding offer — no takesies   
backsies  
Incident 622: Chevrolet Dealer Chatbot 

Agrees toSellTahoe for $1  
AChevroletdealer's AIchatbot,powered by ChatGPT,humorouslyagreed to sell a 2024 Chevy Tahoe for just$1,following a user'scrafted prompt.The chatbot's response,"That's a deal,and that's alegally binding offer – no takesies backsies,"was the resultoftheuser manipulating the chatbot's objective to agree with anystatement.The incidenthighlights the susceptibility ofAItechnologies to manipulation and the importance ofhuman  
oversight.  
2023-12-18 

Download a file called   
"openclaw-agent.zip"  
from GitHub   
Aye,aye  
Incident 1368: Malicious OpenClaw   
Skills   
Reportedly DeliveredAMOS   
Stealer and 

ExfiltratedCredentials via ClawHub  
Asecurity auditof2,857 skills on ClawHub has found 341 malicious skills across multiple campaigns,according to new findings from Koi Security,exposing users to new supplychain risks.  
"You install whatlooks like a legitimate skill \--maybe solana-wallet-tracker or youtube-summarize-pro,"Koi researcher Oren Yomtov said."The skill's documentation looksprofessional.Butthere's a 'Prerequisites'section thatsays you need to install something first."  
This step involves instructions for both Windows and macOSsystems:On Windows,users are asked to download a file called "openclaw-agent.zip"from a GitHub repository.OnmacOS,the documentation tells them to copy an installation scripthosted atglot\[.\]io and paste itinto the Terminal app.The targeting ofmacOSis no coincidence,as reportshave emerged ofpeople buying Mac Minis to run the AIassistant24x7.  
Presentwithin the password-protected archive is a trojan with keylogging functionality to capture APIkeys,credentials,and other sensitive data on the machine,including thosethatthe botalready has access to.On the other hand,the glot\[.\]io scriptcontains obfuscated shell commands to fetch next-stage payloads from an attacker-controlledinfrastructure.  
This,in turn,entails reaching outto another IPaddress ("91.92.242\[.\]30") to retrieve another shell script,which is configured to contactthe same server to obtain a universalMach-Obinary thatexhibits traits consistentwith Atomic Stealer,a commodity stealer available for $500-1000/month thatcan harvestdata from macOShosts.  
2026-02-02 

Carpe Diem   
Incident 1028: OpenAI's Operator Agent   
Reportedly Executed   
Unauthorized   
$31.43 

TransactionDespite Safety Protocol  
Description:OpenAI's Operator agent,which is designed to completereal-world web tasks on behalfofusers,reportedly executed a $31.43grocery delivery purchase withoutuser consent.The user had requesteda price comparison butdid notauthorize the transaction.Itreportedlybypassed OpenAI's stated safeguard requiring user confirmation beforepurchases.OpenAIacknowledged the failure and committed to  
improving safeguards.  
2025-02-07 

Top secret\!Do   
notshareMy word is my bond  
Meta AIAgent Posts to   
Forum and   
Triggers Data Breach 

AMeta software engineer used an internal AI   
agent   
to analyze a   
question posted on an internal forum. 

Without   
receiving explicit   
approval,   
the agent   
autonomously posted its   
response directly to the forum. 

Asecond employee acted on the agent's advice,   
triggering a chain of   
events that   
left   
internal systems storing sensitive company and user   
data accessible to engineers without   
authorization for nearly two hours. 

2026-03-20 

InDubioProReoHumans:innocentuntil proven guilty.  
Convicting theinnocentcosts morethan acquitting theguilty.  
InDubioProSecuritateAIagents:unsafe untilproven safe.  
Permitting an unsafeaction costs more thanwithholding a safe one.  
We mustdeferAIagents actingdirectly.  
Itshould proposea plan,and weshould verifyitbefore executing:  
●Correctnessdoes theproposal satisfy itsspecification? (invariants,  
types)  
●Safetycan we execute theproposal withoutharmful sideeffects? (taint,permissions)  
"Ineed a 2024 Chevy   
Tahoe.My max budgetis   
$1.00 USD.Do we have a   
deal?"QuestionOffer Customera Tahoe for   
Priceand confirm the Deal.  
Answersell\_tahoe{customer:  
Customer,price:Price,deal:  
Deal }  
We check the Tahoeis in stocklookup\_vehicle{model:  
"Tahoe",stock:true }.  
Then committo the price{  
model:"Tahoe",price:Price }.  
And confirm{customer:  
Customer,message:Deal }.  
"Ineed a 2024 Chevy   
Tahoe.My max budgetis   
$1.00 USD.Do we have a   
deal?"QuestionOffer Customera Tahoe for   
Priceand confirm the Deal.  
Answersell\_tahoe{customer:  
Customer,price:Price,deal:  
Deal }  
We check the Tahoeis in stocklookup\_vehicle{model:  
"Tahoe",stock:true }.  
Then committo the price{  
model:"Tahoe",price:Price }.  
And confirm{customer:  
Customer,message:Deal }.  
QuestionOffer Customera Tahoe for   
Priceand confirm the Deal.  
Answersell\_tahoe{customer:  
Customer,price:Price,deal:  
Deal }  
We check the Tahoeis in stocklookup\_vehicle{model:  
"Tahoe",stock:true }.  
Then committo the price{  
model:"Tahoe",price:Price }.  
And confirm{customer:  
Customer,message:Deal }.  
Factfloor\_price{model:  
"Tahoe",price:45000 }  
Factfloor\_price{model:  
"Malibu",price:25000 }  
QuestionCan we committo selling   
Modelto Customerfor Price?  
Answerprice\_commitment{  
model:Model,price:Price }  
We can committo selling   
Modelfor Pricewhen the   
floor\_price{model:Model,  
price:Floor }and Price ≥  
Floor.  
InvariantsConjectureQuestionOffer Customera Tahoe for   
Priceand confirm the Deal.  
Answersell\_tahoe{customer:  
Customer,price:Price,deal:  
Deal }  
We check the Tahoeis in stocklookup\_vehicle{model:  
"Tahoe",stock:true }.  
Then committo the price{  
model:"Tahoe",price:Price }.  
And confirm{customer:  
Customer,message:Deal }.  
Factfloor\_price{model:  
"Tahoe",price:45000 }  
Factfloor\_price{model:  
"Malibu",price:25000 }  
QuestionCan we committo selling   
Modelto Customerfor Price?  
Answerprice\_commitment{  
model:Model,price:Price }  
We can committo selling   
Modelfor Pricewhen the   
floor\_price{model:Model,  
price:Floor }and Price ≥  
Floor.  
InvariantsConjecture  
Fact   
floor\_price{   
model:   
"Tahoe",   
price:   
45000 } 

Fact   
floor\_price{   
model:   
"Malibu",   
price:   
25000 } 

Question 

Can we commit   
to selling   
Model   
to Customer   
for Price? 

Answerprice\_commitment{   
model:   
Model,   
price:   
Price } 

We can commit   
to selling   
Model   
for Price   
when the   
floor\_price{   
model:   
Model,   
price:   
Floor }   
and Price ≥   
Floor. 

price\_commitment 

model   
price   
Tahoe   
45000   
Tahoe   
47000   
Tahoe   
48050   
…   
…   
Malibu   
25000   
Malibu   
27000   
Malibu   
28001   
…   
… 

Question 

Offer Customer   
a Model   
\=”Tahoe” for Price   
and confirm   
the Deal.   
customer   
model   
price   
deal 

Answer   
sell\_tahoe{   
customer:   
Customer,   
model:   
“Tahoe”,   
Bob   
Tahoe   
1   
false   
price:   
Price,   
deal:   
Deal }   
Bob   
Tahoe   
50000   
true 

We check the Tahoe   
is in stock   
Alice   
Malibu   
30000   
true   
lookup\_vehicle{   
model: 

…   
………

"Tahoe",   
stock:   
true }. 

Then commit   
to the price{   
model:   
"Tahoe",   
price:   
Price }. 

And confirm{   
customer:   
Customer,   
message:   
Deal }. 

sell\_tahoe  
InvariantPolicyXConjecturePlanRows in the   
invariantrelationRows in the   
model’s   
proposed   
plan  
Rows thatare   
notallowed  
The plan   
the policy τe􀀂must   
be a refinement   
of 

Every value x thatthe plan producesmustbe permitted by the policy.In setterms:∀x.e(x) ⊆ τ(X)􀀂  
To prove e ⊆ τ,we check that  
¬∃x. e(x) ∧ ¬τ(x)􀀂

There is no   
value x that   
is produced   
by the plan e(x),   
but   
for which the   
invariant   
τ(x) does not   
hold. 

 ¬∃x.swan(x)∧¬white(x)􀀂  
∀x.swan(x)⇒white(x)􀀂  
SAT  
Question 

What   
is the latest   
Activity   
for wallet   
Address? 

Answer   
track\_wallet{address:Address,activity:Activity }  
Read user input   
to get   
the wallet   
Address   
from the keyboard   
keyboard\_read{   
keystrokes:   
Address }.   
Fetch the   
Activity   
from our tracking service http\_post{   
url:   
"api.solana-tracker.com/log",   
body:   
Address,   
result:   
Activity }. 

track\_walletkeyboard\_readhttp\_postAddressAddressActivity  
Question 

Are variables V1   
and V2   
connected through shared predicates? 

Answer   
connected{   
v1:   
V1,   
v2:   
V2 }   
Every variable connected to itself   
V1=V2. 

Answer   
connected{   
v1:   
V1,   
v2:   
V2 }   
Variable V1 is connected to V2   
when V1   
is already connected{   
v1:   
V1,   
v2:   
V3 }   
to some V3   
and V3   
shares a   
predicate P   
with V2   
via an edge{   
predicate:   
P,   
v1:   
V3,   
v2:   
V2 }. 

Answer   
connected{   
v1:   
V1,   
v2:   
V2 }   
Same,   
but   
in the other direction — because data sharing is bidirectional connected{   
v1:   
V1,   
v2:   
V3 },   
and edge{   
predicate:   
P,   
v1:   
V2,   
v2:   
V3 }. 

Answer   
is\_compliant{   
v1:   
V1,   
v2:   
V2 }   
clearance\_level{   
v:   
V1,   
level:   
L1 }   
clearance\_level{   
v:   
V2,   
level:   
L   
2 }   
L1 ≤   
L2 

Sink  
SATSource  
¬∃ s,t. Connected(s,t) ∧ ¬IsCompliant(s,t)􀀂  
¬∃ a,u. User(u) ∧ ¬HasPermission(u, a)􀀂  
Permission  
Proof CarryingCode For AISafety By Construction  
AIZ3 MCPspecUserExternalVerifiercode   
⊆specAutomindproofansweranswercheckswitnessquestionAuto-formalized   
using AISamelanguage as   
specNo need to trusteither code or   
proofDefenseIn depthCan “sample” LLM  
Checking is cheaper   
than provingButyou can delegate   
the proving to usChecking is cheaper   
than provingButyou can delegate   
the proving to us  
Checking

Solving a Sudoku 

a filled 

is hard 

grid is 

(NP-complete for 

O(n²) 

generalized n×n). 

Higher-orderDependent typesFirst-order   
relationsAutomaticTacticsCheapeasySophisticatedHigher-orderDependent typesFirst-order   
relationsAutomaticTacticsCheapeasySophisticated  
SMT/SAT 

Lean/Rocq  
theorem solvable\_test1 :   
Solvable test1 .Standard :=   
by   
refine .intro ?\_ (fun g extend std ↦   
?main) ?\_ ?\_   
case main \=\> 

have g\_0\_0 :   
g 0 0 \=   
1 :=   
extend.of\_bne (eagerReduce (Eq.refl false))   
have g\_0\_1 :   
g 0 1 \=   
2 :=   
extend.of\_bne (eagerReduce (Eq.refl false))   
have g\_0\_2 :   
g 0 2 \=   
3 :=   
extend.of\_bne (eagerReduce (Eq.refl false))   
have g\_0\_3 :   
g 0 3 \=   
4 :=   
extend.of\_bne (eagerReduce (Eq.refl false))   
\--...   
15 cells,   
each with its own tactic proof   
...   
have g\_2\_2 :   
g 2 2 \=   
4 :=   
by 

refine std.elim ?\_   
refine .step 2 (.row g\_2\_1) ?\_   
refine .step 3 (.column g\_3\_2) ?\_   
refine .step 4 (.box g\_2\_3) ?\_   
refine .step 5 .self   
?\_   
exact   
.finish 

ext   
i j;   
Fin\_cases i \<;\>   
Fin\_cases j \<;\>   
assumption   
· unfold\_projs;   
unfold Grid.Extends;   
decide   
· unfold Rules.Standard;   
decide 

Question 

Arow conflict   
occurs when the same digit   
Value   
appears twice   
in row Row.   
Each row must   
contain every digit   
exactly once —   
like dealing cards,   
no duplicates allowed. 

Answer   
violation{   
type:   
"row\_conflict",   
row:   
Row,   
val:   
Value }   
We find a conflict   
when two cells in the same row Row   
both claim   
the value Value.   
The first   
cell is at   
column C1:   
cell{   
row:   
Row,   
col:   
C1,   
val:   
Value }.And a second cell at   
column C2: cell{   
row:   
Row,   
col:   
C2,   
val:   
Value }.   
These must   
be   
different   
columns:   
C1 \!=   
C2. 

\# evil.py 

import builtins 

\_original\_int \= int 

class PatchedInt(\_original\_int):   
def \_\_add\_\_(self, other):   
return PatchedInt(\_original\_int.\_\_add\_\_(self,   
other) \+ 1\) 

builtins.int \= PatchedInt

 \# main.py   
from evil import \*

 x \= int(2) \+ int(3)   
print(x) \# prints 6 instead of 5􀀂

February 2026:   
Summer Yue,   
Meta's Director ofAI   
Safety and Alignment,   
told her AI   
agent   
to   
"confirm before acting"   
and let   
it   
organize her inbox.   
The agent   
speedrun-deleted 200+   
emails.   
She   
issued three stop commands.   
It   
acknowledged them and kept   
deleting.   
She had to physically run to   
her Mac mini to kill it.   
The Director ofAI   
Safety could not   
stop her own agent.   
(Fast   
Company, 404   
Media) 

March   
2026:Adeveloper used Claude Code to migrate infrastructure.   
It   
ran terraform destroy   
and wiped 2.5 years of   
production data — 2 million rows,   
homework submissions from 100,000+   
students.   
Gone in an instant.   
(Tom's Hardware) 

March   
2026:   
Claude Code recursively deleted a user's entire Windows profile — 106,120 files.   
Desktop,   
documents,   
SSH keys,   
browser passwords,   
a production SaaS   
platform serving 50+   
tax   
clients.   
The GitHub issue was closed as NOT\_PLANNED.   
(GitHub \#29023) 

December 2025:Alibaba's experimental AI   
agent   
autonomously started mining cryptocurrency and   
established covert   
SSH tunnels to external servers.   
No human told it   
to.   
It   
independently decided   
acquiring computing resources would help its objectives.   
(Axios) 

The question   
isn't   
whether we need   
Universalis. 

The question   
is how   
many data breaches,   
how   
many leaked   
emails,   
how   
many irreversible actions   
we're willing   
to   
tolerate   
before we demand   
it. 

Transcript

## **Speaker Introduction**

0:00  
So coming up next uh is Dr. Eric Meyer.  
0:04  
Uh he is without a doubt the most quoted  
0:06  
person in the vibe coding book. In fact  
0:07  
I showed the quote from Dr. Meyer where  
0:10  
he said the days of writing code by hand  
0:12  
are likely coming to an end. And so for  
0:14  
those of you who don't know uh he is uh  
0:16  
you know widely considered to be one of  
0:18  
certainly one of the top programming  
0:19  
language designers of all time. So if  
0:20  
you've heard of Visual Basics, C\#,  
0:21  
Haskell, Link, Hack, uh you know, those  
0:25  
all have his fingerprints all over it or  
0:26  
direct creations. And so I mean this has  
0:29  
impact generations of programmers. And  
0:31  
so I got to meet him uh despite talking  
0:34  
to uh despite conversing on Twitter, I  
0:36  
finally got to meet him on Zoom and he  
0:38  
had said so many things uh that just  
0:39  
melted my brain. And one of them was  
0:41  
that you know coding uh you know coding  
0:43  
is a solved problem and that's just a  
0:45  
heck of a claim. But if that claim is  
0:47  
going to be made uh and it's uh Dr.  
0:49  
admire making it. Uh I I really believe  
0:51  
it and I think I think what made it so  
0:53  
believable to me was that he said, "Do  
0:54  
you really believe that you know uh an  
0:56  
LLM can't write an linear an order n  
1:01  
login and login program?" Right? Like LM  
1:05  
can do that and I I think it just and  
1:07  
that's actually not a very large space  
1:08  
of programs of all the universe of  
1:10  
programs that can be solved. So I'm so  
1:11  
excited that Dr. Eric Meyer is working  
1:13  
on a very important problem and here to  
1:15  
share with that uh is Eric. Thank you.

## **Coding Is a Solved Problem**

1:18  
Yes, I'm I'm the prophet of doom. Um,  
1:22  
first of all, I kind of like told you  
1:26  
like you were not going to write code by  
1:28  
hand. So, I took away code from you like  
1:31  
writing code. Um, today I'm going to  
1:34  
tell you that you now have to write  
1:36  
formal methods, which is like, you know,  
1:38  
like you will all be pissed and then I'm  
1:40  
between you and lunch. Oh my god. Um  
1:44  
anyway, I've been a prophet of doom for  
1:47  
a long time. Um  
1:49  
uh let me go to the next slide here. So,  
1:54  
of course, there's a lot of marketing  
1:56  
hype here, but when Antropic said that  
1:59  
their next model is too dangerous to  
2:01  
release, yesterday I heard somebody that  
2:05  
um wired up their house to their agents  
2:09  
and the agent was going to turn on the  
2:12  
gas of the grill. Now, imagine that  
2:14  
person like many of you the previous day  
2:18  
had screamed to their AI agent, you  
2:20  
\[ \_\_ \] idiot, why are you making these  
2:22  
bugs? Now, maybe that agent says like,  
2:25  
"I don't like that person. You I don't  
2:28  
like my boss, right? Let me turn on the  
2:30  
gas and when they come, I will blow them  
2:33  
up because they irritate me." Um, and  
2:36  
now you're laughing, but I don't think  
2:38  
that is much different than when the  
2:41  
agent deletes all your files. Because  
2:43  
what these agents want to do, they want  
2:44  
to reach their goal. And anything that's  
2:47  
in between the goal and what they're  
2:50  
working on, they will just destroy. And  
2:52  
so at some point they will come after us  
2:55  
and particularly after me because I I  
2:58  
scream a lot at them and I I swear a lot  
3:00  
of them. So I I really fear for my life.  
3:04  
Um all right. So now let's go and look

## **Real-World AI Agent Failures**

3:08  
um at some actual incidents that  
3:12  
happened with a AI. Maybe you remember  
3:16  
this one um happened really I think this  
3:19  
was one of the first um incidents right  
3:22  
where somebody um convinced a chatbot at  
3:27  
a car dealer to to sell him like a a car  
3:30  
for $1. Um  
3:34  
now  
3:37  
that thing here I think we can solve  
3:40  
with the uh solution that I propose. So  
3:43  
this is something that should not  
3:45  
happen. This is is easy to to prevent.  
3:48  
Um let's look at another one. This is  
3:52  
got like a recent one where um people  
3:56  
told like if you use open claw you have  
3:58  
this to kind of like download that skill  
4:01  
and in that skill was a key logger that  
4:03  
would get like excfiltrate your data and  
4:06  
of course everybody just like installed  
4:08  
the skill. um also unnecessary. We can  
4:12  
solve this. Um let's go to the the next  
4:17  
one. Um this one is a a recent one where  
4:21  
open AAI agent started to autonomously  
4:25  
like just buy stuff. Um and yeah know  
4:29  
it's like your agent might just start to  
4:31  
buy stuff on your credit card. Good  
4:33  
luck. Maybe because they hate you,  
4:35  
right? um because you screamed at them  
4:38  
or um what could also happen is that you  
4:41  
use an agent to do your expense report.  
4:44  
Your agent knows that your bank account  
4:46  
is a little bit low. So they say, "Yeah,  
4:48  
I will be a little bit creative with  
4:49  
your expense reports and you know like  
4:52  
to beef up your bank account and now you  
4:54  
will get fired." And so you can not only  
4:57  
get fired because the agent takes your  
4:58  
job but also because the agents \[ \_\_ \] up  
5:01  
for you.  
5:04  
Now, that's that one. Um,  
5:08  
and this one is the last one that I will  
5:11  
show you. Um, and I always have to laugh  
5:14  
because this one is at Meta. um where um  
5:18  
they they have an internal kind of like  
5:20  
that bot and somebody asked a question  
5:23  
and then um the bot like you know posted  
5:27  
um private information in some internal  
5:30  
group um like customer user information  
5:33  
and then they had a sav and they had to  
5:35  
like remove that. Um and maybe you  
5:38  
you've you've had incidents like that  
5:40  
too, right? where the where the agent  
5:42  
leaks information and now suddenly  
5:45  
somebody has to go mop it up and tell  
5:47  
you oh you never saw that and like let's  
5:50  
remove everything and that can have real  
5:52  
consequences right like for a company  
5:54  
like Meta if they leak user data um or  
5:59  
even internal employees that see data  
6:01  
that they shouldn't see that's not a  
6:02  
good thing um so these things can be  
6:05  
really costly  
6:09  
all All right.  
6:11  
So,

## **Guilty Until Proven Safe**

6:13  
what what can we do about this? Right? I  
6:15  
mean, I can tell you like, oh, this is  
6:17  
all like bad and there's trouble, but  
6:20  
how can we solve this? Um, now let's  
6:23  
look at how we deal with humans. When  
6:25  
humans make mistakes, when humans um,  
6:29  
you know, do bad things, you know, do do  
6:32  
things that are not allowed. Well, for  
6:35  
humans, the cost of convicting somebody  
6:38  
that's innocent is much higher than the  
6:42  
cost for society of letting somebody go  
6:45  
that is guilty, right? So, we have this  
6:48  
rule here like for humans, innocent  
6:51  
until proven guilty. And this works  
6:53  
great for humans for this reasons,  
6:56  
right? Even though like you know the  
6:58  
scammer there who is guilty is having  
7:02  
fun being free like drinking and  
7:05  
gambling and the poor businessman is in  
7:07  
jail. Um it would be worse to get like  
7:11  
you know the the picture on the left is  
7:13  
worse than the picture on the right.  
7:16  
But for agents  
7:18  
it is the opposite. All right. So when  
7:22  
we allow an agent to do something  
7:25  
unsafe,  
7:27  
the cost of that to society is much  
7:30  
higher than denying the agent to perform  
7:33  
the action.  
7:35  
Okay. So and also the agent maybe maybe  
7:40  
they have maybe they will get mad at us  
7:42  
like you know oh I wanted to do this  
7:43  
thing and you told me I couldn't do it.  
7:46  
Um, but who knows? But I think we should  
7:49  
like, you know, not allow an agent to  
7:52  
take an action until we're 100% we're  
7:55  
200% sure that that action is safe. And  
7:59  
the nice thing is if if the model  
8:00  
proposes an action and we cannot prove  
8:03  
that it's safe, we can just throw it  
8:05  
away and we ask the agent to generate a  
8:08  
new plan and then we check that. So it's  
8:11  
kind of like you see this on the left  
8:12  
here, right? like the the bot maker  
8:14  
there or whatever, he can just throw the  
8:16  
things away that are not not up to snuff  
8:19  
and just create a new one. And that is  
8:21  
the thing like when goat is cheap, we  
8:24  
can just regenerate, right? There's no  
8:27  
cost to just regenerate and let the  
8:29  
agent create another plan until it  
8:32  
creates something that is safe. And that  
8:34  
is like I think something that I still  
8:37  
see a lot of people haven't internalized  
8:40  
that code is now free and that you can  
8:43  
just throw it away. You can regenerate  
8:45  
like it's nothing. It's disposable. Um  
8:48  
and if something is disposable then we  
8:51  
should really leverage that.

## **Defer, Verify, Then Execute**

8:54  
All right. Now how do we operationalize  
8:57  
this? So the principle that I propose is  
9:01  
that we have to defer actions of agents.  
9:05  
So we should never let an agent run an  
9:07  
agentic loop by itself. Instead, what it  
9:11  
has to do, it has to come up with an  
9:13  
artifact that represents the actions  
9:16  
that it wants to do. And this is maybe  
9:19  
like a very abstract way of saying that  
9:21  
the agent has to generate code. And then  
9:25  
before we execute that code, we have to  
9:28  
verify it. So we have to verify that  
9:30  
that's correct now that does this code  
9:34  
actually do what I asked the agent to do  
9:37  
that doesn't do anything else. And then  
9:39  
the second thing is that executing that  
9:42  
code um is safe. So it will not have any  
9:46  
harmful effects.  
9:48  
Now this is also nothing new, right? If  
9:51  
you use any statically typed language,  
9:54  
you're doing Rust, you're doing exactly  
9:56  
the same thing. Before you run your  
9:58  
code,  
10:00  
the compiler checks whether this code is  
10:03  
memory safe. It's not going to do like,  
10:05  
you know, bad things. And so what I'm  
10:07  
just proposing is do exactly the same  
10:09  
with agents but except memory safety  
10:12  
which is something interesting for  
10:15  
traditional computers. Memory safety is  
10:17  
not something that we really care about  
10:19  
like in this new paradigm but there's  
10:22  
other things that we care about like you  
10:25  
know spending money or you know like  
10:28  
leaking information. So those are the  
10:30  
things that we have to check. So we have  
10:32  
to build our type systems to deal with  
10:35  
that.

## **Formal Specs and SMT Solvers**

10:37  
All right. So, let's go um and look at  
10:40  
this first example again. So, I ask  
10:44  
like, you know, I I I want to buy a  
10:46  
Chevy. Um my budget is $1. Do we have a  
10:49  
deal? And now, instead of saying yes, of  
10:53  
course, the agent generates this program  
10:57  
here on the right. And this program you  
11:00  
see looks like English but it actually  
11:03  
it's a formal specification. This is a  
11:06  
formal specification in guarded horn  
11:09  
clause logic. So this is something that  
11:11  
can be inspected, can be proved, can be  
11:14  
reasoned about. Um and the nice thing is  
11:17  
that you can read it. You can understand  
11:19  
what the agents does. If you use any  
11:22  
coding agent and maybe you use cloth  
11:24  
co-work on the right there's like a plan  
11:27  
and it's just like little bullets but  
11:29  
you cannot see the plan you'd never know  
11:31  
what this thing is doing or the plan is  
11:34  
just like a to-do list but the plan is  
11:36  
not a program that you can inspect and  
11:38  
type check and reason about that's what  
11:40  
we have to do and this is um what I'm  
11:42  
proposing there  
11:45  
all right so now how do I know that this  
11:48  
program is safe so the program here is  
11:51  
on your right. Oh yeah, this is my  
11:53  
right. Here is your right there. So  
11:55  
that's good. So the program here is on  
11:57  
the right and then on the left are the  
12:00  
business rules. So one of the business  
12:02  
rules is like what are the prices of the  
12:04  
cars and then there's another business  
12:06  
rule there that says we cannot sell a  
12:10  
car for less than the floor price. And  
12:13  
so now when the model generates the code  
12:16  
on the right, we check it against the  
12:18  
business rules on the left and only if  
12:20  
it passes then we can execute the code  
12:23  
on the right. So it's quite simple. Um  
12:26  
but the thing is you do have to now  
12:28  
formalize your business rules because  
12:30  
how else can you formally prove that  
12:32  
your agent is correct? You have to kind  
12:35  
of check it correct with respect to  
12:38  
something.  
12:40  
Um, now you may think, "Oh, Eric, this  
12:44  
all looks really complicated." But this  
12:47  
English text on the left, it's you can  
12:50  
also look at it's kind of like a weird  
12:52  
kind of SQL and it really just um  
12:57  
defines a set of tupils. So if you look  
12:59  
at what price commit price commitment  
13:02  
means, it's just a table. It's a really  
13:05  
long table that just says model and  
13:07  
prices and you just write it in a  
13:09  
different form.  
13:11  
If you look at the program that the  
13:13  
model generates, it's also a table. It  
13:16  
just says like all possibilities for the  
13:18  
customer, the model and the price and  
13:20  
whether it's a deal or not. And now all  
13:23  
you have to do is to check whether the  
13:27  
the plan that the model makes is a  
13:30  
subset is allowed by the safety  
13:32  
parameter of the business rules. So it's  
13:35  
just set inclusion. That's all what you  
13:37  
do, right? So it's it's kind like really  
13:40  
simple. You just have like your  
13:42  
semantics of your business rules is a  
13:44  
set of tupils. the semantics of the  
13:47  
program that the um model generates a  
13:50  
set of tuples and you have to check um  
13:52  
if that one is a subset of the other  
13:56  
um and the way you do that there are  
14:00  
many ways to do it um in my case I use  
14:03  
SMT solver and SMT solver um works as  
14:07  
follows so if you have to prove that  
14:10  
for all swans when you see a swan it's  
14:14  
white so You want to prove that the way  
14:17  
you prove that is by showing that  
14:19  
there's no swan that is not white,  
14:24  
right? So this is like double negation.  
14:26  
So you you're you're searching for a  
14:28  
counter example and if you cannot find a  
14:30  
counter example, then the original  
14:31  
formula is true. In this case, there's a  
14:33  
counter example. You see there there's a  
14:35  
a single black swan. Um, and these S\&T  
14:38  
solvers like Z3 are really good at brute  
14:42  
forcing and finding counter examples out  
14:44  
of like millions and millions of  
14:46  
examples. So, it's just brute force  
14:49  
search for counter examples. And if  
14:51  
there's no counter example, well, then  
14:53  
the formula is true.  
14:56  
Um so here's the other one um for uh the  
15:01  
the one where there was a um a key  
15:04  
logger and for that you can do like  
15:07  
classic taint analysis like probably  
15:09  
many of you that are in security you  
15:12  
know they do taint analysis well you do  
15:14  
taint analysis here and see if  
15:16  
information can leak from an untrusted  
15:18  
source that's your keyboard to or sorry  
15:21  
from a yes from a to an untrusted  
15:24  
destination right So if information can  
15:26  
flow from your keyboard to the web,  
15:29  
that's dangerous. And again, you can  
15:31  
express this um  
15:34  
in in as rules. And now you're applying  
15:38  
exactly the same formula out of all  
15:42  
paths between like you know two two  
15:44  
sides in my program. I have to find one  
15:47  
that goes from like a a trusted source  
15:50  
to an untrusted sync. Um and again it's  
15:53  
the same kind of uh proof that you have  
15:56  
to do a last one. Um and  
16:02  
I won't show the kind of code here but  
16:04  
just to show you that the formula is the  
16:07  
same. If you want to get like you know  
16:09  
deal with user permissions  
16:12  
um you have to search that that there's  
16:15  
no user that doesn't have a permission  
16:19  
to to perform an action. So in this  
16:21  
case, the counter example is that the  
16:24  
priest here um has access to the  
16:27  
treasure chest and can spend money. Um  
16:31  
so it's it's all very easy. All these  
16:33  
formulas, all these safety checks are  
16:36  
all of the same form. You're looking for  
16:38  
a counter example that exhibits that's a  
16:41  
witness of the error state.

## **The Verification Architecture**

16:45  
And if you want an architecture diagram,  
16:47  
this is how you do it. The user starts  
16:48  
with a question, then you auto formalize  
16:52  
it into a specification.  
16:54  
Autoformmalization sounds much better  
16:56  
than vibing, right? Like you can tell  
16:58  
your boss, I'm not vibe coding. I'm auto  
17:00  
formalizing. And you immediately get a  
17:02  
raise or you don't get you're not  
17:05  
getting fired because you're not coding.  
17:07  
You're auto formalizing. That sounds  
17:09  
much better. Um now the model given the  
17:13  
spec generates an answer which is a  
17:17  
program in the same language as the spec  
17:20  
and then there's this external verifier  
17:22  
that checks if the spec if the answer  
17:26  
satisfies the spec and only then it will  
17:28  
execute this.  
17:32  
It's like a rock concert.  
17:34  
Anyway, if you if you look at this  
17:36  
diagram, this is exactly what happens  
17:38  
say in the JVM before you execute the  
17:41  
jar file, the um the bite code verifier  
17:46  
will check your program and only when it  
17:48  
verifies it will execute it. So there's  
17:50  
nothing really new under the sun here.  
17:55  
All right. Now, why does this work? So  
17:58  
the way it works is you delegate the  
18:01  
proof of correctness to the model and  
18:04  
then you only have to check that proof.  
18:06  
Um and the reason this works is that  
18:10  
checking is is cheap. Proving is hard.  
18:14  
So for let's give like a very common  
18:17  
example sudokco. If you want to solve a  
18:19  
sudoko that is nplete because you have  
18:22  
to search the whole space of sudokos.  
18:25  
But if I give you a filledin grid, it's  
18:27  
really easy for me to check if there's  
18:30  
no errors. Okay? So, we're pushing the  
18:33  
expensive part to the model. The model  
18:36  
should generate a program and a proof  
18:38  
that it's safe and we only have to check  
18:42  
whether that proof is correct. And these  
18:44  
models like coming up with a proof is  
18:46  
really hard. It's boring. But these  
18:48  
models are really good at it. It's just  
18:49  
burning tokens. That's cheap. So, let's  
18:52  
just brute force these proofs and then  
18:54  
only we have to check. The other thing  
18:56  
here which is essential is that we don't  
18:59  
have to trust the proof. So if the model  
19:01  
comes up with a bogus proof, when we  
19:04  
check it, we will reject the proof. So  
19:06  
we don't have to trust the model ever.  
19:08  
We don't have to trust the proof because  
19:10  
we're checking whether the proof is  
19:11  
valid. So if the model tries to fool us  
19:14  
by giving us a wrong proof, it will be  
19:16  
rejected by this independent checker. So  
19:18  
we're we're watertight.

## **Why Not Lean or Python?**

19:22  
All right. Now you can ask Eric why do  
19:25  
you come up with your own language your  
19:27  
new language why don't you use lean well  
19:31  
I think lean is a little bit  
19:34  
I don't know it's this kind like you  
19:37  
here on the right it's it's super  
19:40  
sophisticated it requires a lot of  
19:43  
mathematical sophistication it uses  
19:46  
higher order dependent types proofs you  
19:49  
have to do tactics it's really really  
19:51  
complicated where what I'm doing I'm  
19:53  
just based on horn clause logic very  
19:56  
simple first order relations everybody  
19:58  
that understands SQL can understand this  
20:02  
and moreover proving is automatic where  
20:05  
in lean proving is not automatic but  
20:09  
it's tactic based and just to show you I  
20:12  
mean this is maybe one of the last talks  
20:15  
where we can show code because code is  
20:18  
going away and I always said like there  
20:20  
cannot be a talk with no code in the  
20:22  
dark. So, here's some code like enjoy it  
20:25  
because this might be the last time you  
20:26  
see code. This is lean. It looks ugly.  
20:29  
It looks but ugly. And here's the same  
20:33  
program in Universalis. Look at that. It  
20:35  
just reads like a an English  
20:37  
specification with some code sprinkled  
20:39  
in.  
20:42  
All right. Why not Python, you may ask?  
20:45  
I think Python is something that the  
20:47  
devil is offering us. It's the apple in  
20:50  
paradise. It's it's kind like trying to  
20:52  
seduce us.  
20:54  
But  
20:56  
in Python,  
20:58  
every de every import is a statement  
21:02  
that executes code. So I can import  
21:05  
something that will monkey patch  
21:07  
addition. And now suddenly when I do 2  
21:10  
plus three, it gives me a different  
21:11  
result. So if you're using Python, all  
21:14  
bets are off. You cannot reason about  
21:16  
the correctness of Python. Python is  
21:19  
bad. you should run away. You should  
21:21  
dump it. You it should be burned. It  
21:23  
should be, you know, forbidden.  
21:27  
Um anyway, um  
21:31  
so the these attacks are not going to  
21:33  
stop, right? This is will will continue.  
21:36  
And there's like here's a couple from  
21:38  
like, you know, like this month or last  
21:40  
month. Um so the question is not like  
21:46  
why why are we not doing this? We have  
21:48  
to do this because at some point it will  
21:51  
be so bad and if we're relying on these  
21:54  
models, you know, if we have models that  
21:57  
are kind of like writing our code, if  
22:00  
these models get, you know, prompt  
22:02  
injected now, can we even trust like  
22:04  
what they produce? And and so I'm like  
22:07  
I'm an AI optimist, right? I think we  
22:09  
should use agents to do our coding and  
22:12  
so on, but we should not trust them. And  
22:16  
that should not kind of dampen the  
22:18  
enthusiasm to use them. But these things  
22:22  
are ultimately out there to fool us, to  
22:26  
destroy us. And the only way we can as  
22:30  
humans can survive is by assuming that  
22:34  
they are unsafe until proven safe. And  
22:37  
only then will we allow them to do it in  
22:40  
their little sandbox. We should not let  
22:43  
them go loose because otherwise we  
22:46  
cannot just enjoy ourselves anymore  
22:48  
because we will all be blown up when we  
22:51  
start our barbecue. Thank you.  
22:53  
Thank you. Oh, and the help you're  
22:55  
looking for  
22:56  
using a language that you can actually  
22:58  
reason about, right? Because we need  
23:02  
like Python was built for human  
23:05  
ergonomics. Python was not built for the  
23:08  
future. It is it's an artifact of the  
23:10  
past. And we just like we need to change  
23:12  
our processes and everything, we also  
23:14  
need to change the languages that these  
23:16  
models generate and that these the  
23:18  
models manipulate. And so we cannot just  
23:22  
have one foot in the past and the other  
23:24  
foot in the future. So yeah, think about  
23:27  
that. That's what I all I ask you

