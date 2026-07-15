I recently read this post on LinkedIn. It made me think about the application of the RPH to this domain. Alexander Rodov, PMP, Microsoft MVP Alumni • 3rd+ PMO Leadership, PMP, Microsoft MVP Alumni In project management, much of the \#AI talk focuses on optimization. But for those of us with boots on the ground especially in the \#construction sector, "optimization" looks very different when you're managing complex timelines, sub-contractors, and thin margins. I've been thinking specifically about how specialized AI could actually alleviate the real pain points construction PMs face daily, beyond just scheduling. We're developing a unique project focused precisely on this intersection of construction realities and AI capability. I'd be curious to hear from experienced \#ProjectManagers: What is the single biggest administrative headache you deal with today that traditional software just hasn't solved? Where do you see the most wasted time in a project lifecycle (e.g., procurement, safety documentation, reporting)? I look forward to hearing your perspectives in the comments.

Yes. I think Construction Management may be one of the **strongest domains for testing the RPH thesis**—perhaps stronger than the three professions we were just using.

The LinkedIn post asks where AI can remove administrative pain. RPH suggests that this may be the wrong abstraction level.

The deeper problem is not merely:

**Which administrative tasks can AI automate?**

It is:

**How does a complex, distributed professional undertaking preserve intent, state, evidence, dependencies, accountability, and verification across thousands of interdependent units of work performed by different organizations over months or years?**

That is almost exactly the problem RPH is trying to address.

## **Construction exposes something our current figures are missing**

Our three domains currently have these characteristic shapes:

SOFTWARE             LEGAL               HEALTHCARE

   TREE               NETWORK             DIFFERENTIAL  
    │                    │                     │  
    ▼                    ▼                     ▼

decompose          reinterpret          hypothesize  
implement          recompose            investigate  
verify             argue                update

Construction introduces a fourth:

                        CONSTRUCTION

                       COORDINATED SYSTEM  
                              │  
                              ▼

                     ┌──── DEPENDENCIES ────┐  
                     │                      │  
                     ▼                      ▼

                  DESIGN                PROCUREMENT  
                     │                      │  
                     └──────────┬───────────┘  
                                ▼

                            SITE WORK  
                                │  
                    ┌───────────┼───────────┐  
                    ▼           ▼           ▼

                 TRADE A      TRADE B      TRADE C  
                    │           │           │  
                    └─────┬─────┴─────┬─────┘  
                          ▼           ▼

                      INSPECTION    EVIDENCE  
                          │           │  
                          └─────┬─────┘  
                                ▼

                            ACCEPT?  
                           ╱       ╲  
                         YES        NO  
                          │          │  
                          ▼          ▼

                    RELEASE NEXT   REWORK /  
                    DEPENDENT WORK REPLAN

This is not merely a tree, network, or diagnostic differential. It is a **temporally constrained, physically coupled, multi-organization dependency system**.

That matters enormously for RPH.

## **A concrete construction Professional Work Unit**

Consider something apparently simple:

                INSTALL MECHANICAL EQUIPMENT

                              │  
                              ▼

                         ╔═════════╗  
                         ║   PWU   ║  
                         ╚═════════╝

A conventional project plan might represent it as:

Task: Install AHU-3  
Duration: 2 days  
Predecessor: Equipment delivery  
Assigned to: Mechanical subcontractor

But the actual professional work is closer to:

╔══════════════════════════════════════════════════════════════╗  
║                  INSTALL AHU-3 — PWU                        ║  
║                                                              ║  
║  INTENT                                                      ║  
║  Install the specified equipment in a condition suitable     ║  
║  for connection, inspection, commissioning, and operation.   ║  
║                                                              ║  
║  CONTEXT                                                     ║  
║  Current design revision • site conditions • project phase   ║  
║                                                              ║  
║  SCOPE                                                       ║  
║  Receive • position • anchor • protect • document            ║  
║                                                              ║  
║  CONSTRAINTS                                                 ║  
║  Approved submittal • code • tolerances • safety • access    ║  
║                                                              ║  
║  DEPENDENCIES                                                ║  
║  Equipment delivered                                         ║  
║  Pad accepted                                                ║  
║  Structural support complete                                 ║  
║  Access route available                                      ║  
║  Correct drawing revision released                           ║  
║                                                              ║  
║  EXECUTION                                                   ║  
║  Mechanical subcontractor performs installation              ║  
║                                                              ║  
║  EVIDENCE                                                    ║  
║  Photos • measurements • delivery record • installation data ║  
║                                                              ║  
║  VERIFICATION                                                ║  
║  Installed correctly? Ready to release dependent work?       ║  
╚══════════════════════════════════════════════════════════════╝

Now the RPH value becomes much clearer.

The problem is not that nobody knows how to install the equipment. The problem is that the work exists inside a **professional dependency graph whose state is distributed across drawings, RFIs, submittals, schedules, emails, field observations, procurement systems, meeting notes, inspections, and human memory**.

## **The administrative burden may actually be the control system**

This is where I think the LinkedIn post intersects directly with your broader theory.

Many things construction professionals call “administrative work” are not incidental bureaucracy:

RFI  
  │  
  ├── preserves ambiguity  
  ├── routes it to authority  
  ├── records resolution  
  └── propagates consequences

SUBMITTAL  
  │  
  ├── proposes a concrete implementation  
  ├── checks conformance  
  ├── records approval state  
  └── constrains downstream execution

DAILY REPORT  
  │  
  ├── observes actual state  
  ├── records progress  
  ├── captures deviations  
  └── creates evidence

INSPECTION  
  │  
  ├── evaluates executed work  
  ├── produces findings  
  ├── accepts or rejects state  
  └── gates dependent work

CHANGE ORDER  
  │  
  ├── acknowledges changed reality  
  ├── revises scope  
  ├── propagates cost and schedule effects  
  └── reconstitutes the agreement

These are remarkably close to **control-system mechanisms**.

The administrative headache exists partly because humans are manually operating the coordination and control system.

That suggests a much stronger RPH thesis than “AI for construction administration”:

**Much of professional administration is the machinery by which complex work maintains coherence. AI should not merely automate the paperwork. It should participate in the control system the paperwork imperfectly implements.**

## **The construction RPH**

Textually, I see it like this:

                       PROJECT INTENT  
                              │  
                              ▼

                    ╔═══════════════════╗  
                    ║   PROJECT PWU     ║  
                    ╚═════════╤═════════╝  
                              │  
                    recursive decomposition  
                              │  
          ┌───────────────────┼───────────────────┐  
          ▼                   ▼                   ▼

      ╔═════════╗         ╔═════════╗         ╔═════════╗  
      ║ DESIGN  ║         ║ PROCURE ║         ║ BUILD   ║  
      ║   PWU   ║         ║   PWU   ║         ║   PWU   ║  
      ╚════╤════╝         ╚════╤════╝         ╚════╤════╝  
           │                   │                   │  
       ┌───┼───┐           ┌───┼───┐          ┌───┼───┐  
       ▼   ▼   ▼           ▼   ▼   ▼          ▼   ▼   ▼

     \[PWU\]\[PWU\]\[PWU\]     \[PWU\]\[PWU\]\[PWU\]    \[PWU\]\[PWU\]\[PWU\]

           ╲                   │                   ╱  
            ╲                  │                  ╱  
             ╲                 ▼                 ╱

                 ╔════════════════════════╗  
                 ║   SHARED PROJECT STATE ║  
                 ║                        ║  
                 ║  requirements          ║  
                 ║  dependencies          ║  
                 ║  decisions             ║  
                 ║  evidence              ║  
                 ║  actual conditions     ║  
                 ║  verification state    ║  
                 ╚═══════════╤════════════╝  
                             │  
                             ▼

                      CONTINUOUS RECONCILIATION

              What was intended?  
              What was approved?  
              What is actually true?  
              What can proceed?  
              What must be reopened?

That final set of questions may be the essence of the RPH in construction.

And this changes my view of the blog post's visual plan. I would not simply add construction as a fourth column to Figure 5\. **Construction deserves a distinct figure because it reveals a dimension the other domains do not expose as clearly: coordination across organizational and physical boundaries.**

The four domains would now teach us four different properties of the RPH:

SOFTWARE       → recursive decomposition  
LEGAL          → interdependent reinterpretation  
HEALTHCARE     → evidence-driven hypothesis revision  
CONSTRUCTION   → distributed coordination and state reconciliation

Together, they support a much more substantial claim:

**The Professional Work Unit may be a common primitive, but professional domains compose those units into different work topologies. The RPH must preserve the topology of the profession rather than forcing every profession into the same agent workflow.**

I would revise the blog visual plan from seven to **eight figures**, inserting a dedicated construction figure after the three-profession comparison and before “When Evidence Changes the Work.” More importantly, I think this construction example gives us language we should incorporate into Figure 2: the PWU does not only produce evidence for verification; it also produces **state transitions that may authorize or block dependent work**. That is a significant addition to the canonical PWU model.

Yes, the distributed coordination is a new aspect that at least for the coding / software development (janumicode) we think of as coordination from a cross functional team perspective (e.g., a product manager, a GTM, a legal review, software developer, etc.). Granted this is envisioned for the enterprise version but is not thought out in any real way. This construction scenario would be a good walkthrough of how this might be envisioned working. Especially what you referred to as "continuous reconciliation". Walk me through the construction scenario in more detail. Be sure to include some external repository integrations where various artifacts are maintained and need to be retrieved.

I’ll ground this in a concrete construction scenario and use it to make the RPH mechanics explicit: PWUs, shared state, artifact repositories, external integrations, reconciliation loops, and what triggers reopening work.

Thought for 4s

Below is the construction walkthrough I would use as the **reference example** for RPH \+ continuous reconciliation.

## **Scenario**

**Project:** Commercial building renovation  
 **Work package:** Install AHU-3, a rooftop air handling unit  
 **Goal:** Install, connect, inspect, and release AHU-3 for commissioning without blocking downstream trades.

The simple task says:

Install AHU-3.

The RPH version says:

Install AHU-3 only when the current design, approved submittal, site condition, procurement state, access path, safety plan, inspection requirements, and downstream dependencies are reconciled.

## **1\. External repositories**

The RPH would not own all artifacts. It would integrate with systems where professional evidence already lives.

Design repository  
\- Drawings  
\- BIM model  
\- Specifications  
\- Revision history

Document control  
\- RFIs  
\- ASIs  
\- Bulletins  
\- Meeting minutes

Submittal system  
\- Product data  
\- Shop drawings  
\- Approved equipment selections  
\- Review comments

Schedule system  
\- CPM schedule  
\- Lookahead plans  
\- Trade sequencing  
\- Constraints log

Procurement / ERP  
\- Purchase orders  
\- Delivery dates  
\- Shipping notices  
\- Vendor confirmations

Field management system  
\- Daily reports  
\- Photos  
\- Punch items  
\- Safety observations  
\- Inspection records

Commissioning repository  
\- Startup checklists  
\- Test results  
\- Functional performance tests

In enterprise software, the analogous repositories might be Jira, GitHub, Figma, Salesforce, legal review systems, product requirements docs, support tickets, telemetry, CI/CD, and customer evidence.

Construction makes the pattern more physical and obvious.

## **2\. The root PWU**

╔════════════════════════════════════╗  
║ PROJECT PWU                        ║  
║ Renovate Building X                ║  
╚════════════════╤═══════════════════╝  
                 │  
                 ▼  
╔════════════════════════════════════╗  
║ MECHANICAL SYSTEM PWU              ║  
║ Deliver HVAC capability            ║  
╚════════════════╤═══════════════════╝  
                 │  
                 ▼  
╔════════════════════════════════════╗  
║ AHU-3 INSTALLATION PWU             ║  
║ Install and release AHU-3          ║  
║ for downstream connection,         ║  
║ inspection, and commissioning      ║  
╚════════════════════════════════════╝

The AHU-3 PWU contains:

Intent:  
Install AHU-3 correctly and release dependent work.

Scope:  
Receive, stage, lift, place, anchor, protect, document.

Constraints:  
Approved submittal, current drawings, code, safety, access, tolerances.

Dependencies:  
Equipment delivered, roof curb ready, crane path clear, structural support accepted,  
electrical rough-in coordinated, controls path available.

Evidence:  
Photos, delivery ticket, inspection record, installed dimensions, torque/anchoring record,  
field report, commissioning readiness checklist.

Verification:  
Does installed AHU-3 match approved design and is dependent work authorized?

## **3\. Continuous reconciliation**

The RPH continuously asks:

What was intended?  
What was approved?  
What is currently true?  
What has changed?  
What evidence exists?  
What depends on this?  
What can proceed?  
What must be reopened?

For AHU-3, reconciliation might look like this:

Design says: AHU-3 is Model A, revision 7\.  
Submittal says: Approved as Model A with vibration-isolator condition.  
Procurement says: Model A shipped, delivery Friday.  
Schedule says: Crane lift Monday.  
Field report says: Roof curb is installed.  
Inspection says: Roof curb not yet accepted.  
Electrical says: Disconnect location conflicts with access panel.  
Controls says: BAS point list still under review.

The RPH does **not** conclude “install Monday” merely because the schedule says so.

It produces a reconciled state:

AHU-3 install is NOT READY.

Blocking issues:  
1\. Roof curb not accepted.  
2\. Electrical disconnect conflict unresolved.  
3\. BAS controls dependency not finalized.  
4\. Vibration-isolator condition must be verified against approved submittal.

Recommended action:  
Open or update the relevant PWUs before releasing installation.

## **4\. Recursive decomposition**

The AHU-3 PWU decomposes into child PWUs.

AHU-3 INSTALLATION PWU  
│  
├── Equipment procurement PWU  
├── Submittal verification PWU  
├── Roof curb readiness PWU  
├── Crane / logistics PWU  
├── Electrical coordination PWU  
├── Controls coordination PWU  
├── Installation execution PWU  
├── Inspection PWU  
└── Commissioning readiness PWU

Each child has its own intent, scope, dependencies, evidence, and verification.

Example:

╔════════════════════════════════════╗  
║ ELECTRICAL COORDINATION PWU        ║  
╚════════════════════════════════════╝

Intent:  
Ensure AHU-3 electrical connection does not conflict with access, safety, or code.

Repositories checked:  
\- Electrical drawings  
\- Mechanical shop drawing  
\- Approved AHU submittal  
\- Field photo repository  
\- RFI log

Evidence found:  
\- Disconnect shown on E-403  
\- AHU access panel shown on approved shop drawing  
\- Field photo confirms current conduit stub-up location  
\- Conflict identified between disconnect and access clearance

Verification result:  
Not acceptable.

Action:  
Generate RFI or coordination issue.  
Block installation release until resolved.

## **5\. Reopening work**

This is the most important part.

Traditional task tracking often treats conflict as a note, comment, or blocker. RPH treats it as a reason to **reopen the relevant professional work unit**.

Field evidence contradicts installation assumption  
                │  
                ▼  
      Reopen Electrical Coordination PWU  
                │  
                ▼  
      Retrieve affected artifacts  
                │  
                ▼  
      Determine authoritative source  
                │  
                ▼  
      Update decision state  
                │  
                ▼  
      Propagate impact to dependent PWUs

So the system may reopen:

Electrical coordination PWU  
Controls coordination PWU  
Installation execution PWU  
Schedule readiness PWU  
Inspection readiness PWU

This is why “continuous reconciliation” matters. The work structure is not static.

## **6\. Example repository-integrated flow**

1\. RPH detects scheduled AHU-3 install in schedule system.

2\. It retrieves:  
   \- Latest mechanical drawings from design repository  
   \- Approved AHU-3 submittal from submittal system  
   \- Open RFIs from document control  
   \- Delivery status from procurement system  
   \- Field photos and reports from field management  
   \- Inspection status from QA/QC repository

3\. It compares:  
   \- Drawing revision vs submittal revision  
   \- Approved equipment vs delivered equipment  
   \- Required prerequisites vs actual field status  
   \- Open coordination issues vs planned work  
   \- Inspection gates vs downstream dependencies

4\. It produces:  
   \- Reconciled readiness state  
   \- Blockers  
   \- Evidence links  
   \- Required PWU reopenings  
   \- Recommended next actions

5\. It updates:  
   \- Shared project state  
   \- AHU-3 PWU status  
   \- Dependent trade readiness  
   \- Schedule risk register

## **7\. What the construction PM sees**

Instead of another dashboard, the PM gets a professional-state summary:

AHU-3 Installation Readiness: BLOCKED

Reason:  
The planned installation depends on unresolved electrical coordination and unaccepted roof curb readiness.

Evidence:  
\- Approved AHU submittal requires access clearance.  
\- Field photo shows disconnect conflict.  
\- Roof curb inspection has not been accepted.  
\- Crane lift is scheduled before readiness is verified.

Affected downstream work:  
\- Electrical final connection  
\- Controls wiring  
\- TAB  
\- Commissioning  
\- Ceiling close-in in adjacent area

Recommended actions:  
1\. Issue RFI for disconnect relocation or confirm alternate detail.  
2\. Request roof curb inspection closeout.  
3\. Notify schedule owner that AHU-3 install should not be released.  
4\. Reassess crane lift sequence once blockers clear.

That is not merely automation. It is **professional coherence management**.

## **8\. The big RPH insight**

In construction, “administration” often means manually maintaining the project’s control system:

RFI        → ambiguity control  
Submittal  → conformance control  
Schedule   → dependency control  
Inspection → quality gate  
Daily log  → reality capture  
Change order → agreement reconstitution

RPH reframes the problem:

The paperwork is not the work.  
But the paperwork preserves the state of the work.

The AI opportunity is not just filling out paperwork faster.  
It is continuously reconciling professional state across fragmented repositories.

That is the construction version of RPH.

For JanumiCode Enterprise, the equivalent claim would be:

A product launch is not just software tasks.

It is a distributed professional system involving product intent,  
engineering implementation, legal constraints, GTM readiness,  
security posture, support readiness, customer evidence, and operational telemetry.

The RPH coordinates the work by continuously reconciling the state of those professional units.  
