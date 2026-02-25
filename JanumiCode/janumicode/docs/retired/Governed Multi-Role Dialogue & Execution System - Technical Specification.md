# **Technical Specification**

## **Governed Multi-Role Dialogue & Execution System (Baseline Architecture)**

### **Version**

v0.1 (Baseline / MVP-Complete, Non-Experimental)

---

## **1\. Purpose and Scope**

This system provides a **governed, auditable, multi-role dialogue and execution framework** for AI-assisted software and systems engineering tasks.

It is designed to:

* Prevent invalid assumptions from propagating into execution

* Support long-horizon, multi-step reasoning with **error containment**

* Integrate AI agents **and humans** in a single controlled workflow

* Operate reliably with **stateless LLM APIs**

* Be compatible with **DBOS durable workflows**

This specification defines the **baseline architecture** required to meet these goals, intentionally avoiding unnecessary frameworks or abstractions.

---

## **2\. Design Principles (Non-Negotiable)**

1. **State lives outside the LLM**

2. **Dialogue is subordinate to state**

3. **Execution is gated by verification**

4. **History is append-only**

5. **Humans are first-class authorities**

6. **Failure must be explicit, not smoothed**

7. **Simplest viable mechanism wins**

---

## **3\. Roles and Responsibilities**

### **3.1 Executor (Agent)**

**Purpose:** Propose plans, generate artifacts (code, designs, docs).

**May:**

* Propose solutions

* Emit assumptions

* Respond to constraints

* Generate artifacts

**May not:**

* Override verification

* Invent constraints

* Proceed past gates

---

### **3.2 Technical Expert (Agent)**

**Purpose:** Supply domain-specific knowledge and evidence.

**May:**

* Provide evidence packets

* Explain APIs, specs, standards

* Answer narrowly scoped questions

**May not:**

* Make feasibility verdicts

* Authorize execution

---

### **3.3 Verifier (Gate / State Machine)**

**Purpose:** Determine whether claims are admissible for execution.

**Characteristics:**

* Non-creative

* Conservative

* Evidence-bound

* Deterministic gate

**Outputs (only):**

* VERIFIED

* CONDITIONAL (+ constraints)

* DISPROVED

* UNKNOWN

**May not:**

* Suggest solutions

* Repair claims

* Reason creatively

---

### **3.4 Historian-Core (Non-Agent)**

**Purpose:** Persist immutable record of decisions, claims, verdicts, and rationales.

**Properties:**

* Append-only

* Queryable

* Versioned by event time

* No interpretation

---

### **3.5 Historian-Interpreter (Agent)**

**Purpose:** Interpret history for consistency and precedent.

**May:**

* Detect contradictions

* Identify violated invariants

* Surface precedents

**May not:**

* Modify history

* Override verifier verdicts

---

### **3.6 Human Authority (User)**

**Purpose:** Resolve ambiguity, approve tradeoffs, accept risk.

**May:**

* Approve / reject gate transitions

* Override (with rationale)

* Reframe requirements

* Supply external evidence

**All actions are logged and auditable.**

---

## **4\. Dialogue Model**

### **4.1 Dialogue Envelope (Required)**

Every utterance or system action MUST be wrapped in a structured envelope:

`{`  
  `"dialogue_id": "uuid",`  
  `"turn_id": 17,`  
  `"role": "EXECUTOR | TECHNICAL_EXPERT | VERIFIER | HISTORIAN | HUMAN",`  
  `"phase": "PROPOSE | VERIFY | REVIEW | EXECUTE | COMMIT",`  
  `"speech_act": "CLAIM | ASSUMPTION | EVIDENCE | VERDICT | DECISION",`  
  `"content_ref": "blob://hash",`  
  `"related_claims": ["A1"],`  
  `"timestamp": "ISO-8601"`  
`}`

Free-form chat transcripts are not authoritative.

---

## **5\. Core Data Model (Baseline)**

### **5.1 Event Tables (Append-Only)**

#### **`dialogue_turns`**

* turn\_id (PK)

* dialogue\_id

* role

* phase

* speech\_act

* content\_ref

* timestamp

#### **`claims`**

* claim\_id (PK)

* statement

* introduced\_by

* criticality (CRITICAL | NON\_CRITICAL)

* status (OPEN | VERIFIED | CONDITIONAL | DISPROVED | UNKNOWN)

#### **`claim_events`**

* event\_id (PK)

* claim\_id

* event\_type (CREATED | VERIFIED | DISPROVED | OVERRIDDEN)

* source (VERIFIER | HUMAN)

* evidence\_ref

* timestamp

#### **`verdicts`**

* verdict\_id (PK)

* claim\_id

* verdict

* constraints\_ref

* evidence\_ref

* timestamp

#### **`gates`**

* gate\_id (PK)

* dialogue\_id

* reason

* status (OPEN | RESOLVED)

* blocking\_claims

#### **`human_decisions`**

* decision\_id (PK)

* gate\_id

* action (APPROVE | REJECT | OVERRIDE | REFRAME)

* rationale

* attachments\_ref

* timestamp

#### **`constraint_manifests`**

* manifest\_id (PK)

* version

* constraints\_ref

* timestamp

---

## **6\. Workflow Model (DBOS)**

### **6.1 High-Level Workflow**

`INTAKE`  
 `→ PROPOSE`  
 `→ ASSUMPTION_SURFACING`  
 `→ VERIFY`  
   `├─ if DISPROVED/UNKNOWN → HUMAN_GATE → REPLAN`  
   `└─ else → HISTORICAL_CHECK`  
        `├─ if conflict → HUMAN_GATE`  
        `└─ else → EXECUTE`  
             `→ VALIDATE`  
             `→ COMMIT`

### **6.2 DBOS Mapping**

* **Workflow:** Orchestrates phases and gates

* **Steps:** LLM calls, retrieval, parsing, testing

* **Gates:** Deterministic branching on step outputs

* **Human input:** External resume signal

---

## **7\. Verification Submachine (Baseline)**

For each critical claim:

1. Normalize claim

2. Generate disconfirming queries

3. Retrieve authoritative evidence

4. Classify evidence

5. Emit verdict

6. Store verdict event

**UNKNOWN is treated as blocking.**

---

## **8\. Context Management (Stateless LLM Compatibility)**

### **8.1 Context Compiler (Required Component)**

LLMs are invoked with a **Context Pack**, not chat history.

#### **Executor Context Pack**

* Goal

* Current constraint manifest

* Active claims \+ statuses

* Verifier verdict summary

* Human decisions

* Relevant historical findings

* Artifact pointers

Context Packs are:

* Deterministically generated

* Role- and phase-specific

* Token-budgeted

---

## **9\. Human-in-the-Loop Handling**

### **9.1 Human Gates**

Triggered when:

* Critical claim is DISPROVED or UNKNOWN

* Conflicting precedents detected

* Risk acceptance required

### **9.2 Human Actions**

Human actions are constrained to explicit options and always recorded.

Overrides:

* Do not change claim truth

* Only permit execution under waiver

* Must include rationale

---

## **10\. Storage Strategy (Baseline)**

### **Required**

* Relational database (Sqlite)

* Append-only event log

* Deterministic projections



---

## **11\. Non-Goals (Baseline)**

* Autonomous agent swarms

* Free-form conversational memory

* Self-modifying history

* Implicit assumption handling

* “Helpful” verification

---

## **12\. Key Safety Invariants**

1. No execution without VERIFIED or CONDITIONAL assumptions

2. UNKNOWN blocks progress

3. Overrides are explicit and logged

4. History is immutable

5. Dialogue never supersedes state

---

## **13\. Baseline Success Criteria**

The system is considered correct if:

* A false feasibility assumption cannot silently reach execution

* Every executed artifact is traceable to verified claims and constraints

* A human can reconstruct *why* a decision was made

* Replaying a workflow produces the same admissible state

---

## **14\. Summary (One Paragraph)**

This baseline architecture replaces fragile conversational context with structured, auditable state; replaces implicit trust with explicit verification gates; and replaces ad hoc human review with governed decision points. 
