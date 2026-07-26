
We have used AST - abstract syntax trees - in the past to help with some code analysis, code quality and related things like creating complete syntactic and semantic view of a codebase to augment AI coding agents to shift left the discovery of code issues. However, I don’t recall how that is done.

You're probably remembering a combination of ASTs, symbol tables, control/data flow graphs, and code property graphs. Modern AI coding systems rarely stop at the AST anymore because an AST alone tells you only what the program looks like, not what it means.

For Janumi, this distinction is particularly important because you are trying to shift discovery of implementation defects to the earliest possible stage.

A useful way to think about it is as a series of increasingly richer representations.

Representation	Captures	Typical Uses
Text	Source code characters	LLM context
Token stream	Lexical elements	Formatting, syntax highlighting
AST	Program structure	Refactoring, linting, code generation
Symbol Table	Definitions and references	Name resolution
Control Flow Graph (CFG)	Execution paths	Dead code, reachability
Data Flow Graph (DFG)	Value movement	Uninitialized variables, taint
Program Dependence Graph (PDG)	Control + data dependencies	Slicing, optimization
Call Graph	Function relationships	Architecture analysis
Type Graph	Static type relationships	Type checking
Code Property Graph (CPG)	Unified semantic graph	Security, AI reasoning
Stage 1: Parse into an AST
For example

function area(r: number) {
    return Math.PI * r * r;
}
becomes something conceptually like

FunctionDeclaration
 ├── Identifier(area)
 ├── Parameter(r)
 │    └── Type(number)
 └── ReturnStatement
      └── BinaryExpression(*)
           ├── MemberExpression(Math.PI)
           └── BinaryExpression(*)
                ├── Identifier(r)
                └── Identifier(r)
Notice what we already gain:

function declarations
loops
conditionals
imports
classes
expressions
scopes
without any LLM involved.

Stage 2: Build Semantic Information
The parser then builds things like

Symbol Table

area
    kind: function

r
    kind: parameter
    type: number

Math.PI
    resolved to builtin
Now an AI can answer

"Where is r defined?"

without searching text.

Stage 3: Build the Control Flow Graph
Start
   |
   V
Compute PI*r*r
   |
   V
Return
For more complicated code

if (...)
   ...
else
   ...

finally
the CFG shows every possible execution path.

This enables

unreachable code
missing returns
exception paths
complexity metrics
Stage 4: Data Flow Analysis
Instead of asking

What executes?

you ask

Where did this value originate?

User Input
      |
      V
validate()
      |
      V
sanitize()
      |
      V
SQL Query
or perhaps

User Input
      |
      V
SQL Query
which immediately identifies SQL injection risk.

Stage 5: Build a Call Graph
main()

   |
   +------> authenticate()

   |
   +------> loadOrders()

                  |
                  +------> queryDB()

                  |
                  +------> cache()
Now the AI understands architectural relationships instead of merely source files.

Stage 6: Code Property Graph (CPG)
This is where modern static analysis has largely converged.

Instead of maintaining separate

AST
CFG
DFG
Call Graph
they are merged into one graph.

             Function

          /      |      \

      AST     CFG      DFG

        \       |       /

          Code Property Graph
A CPG lets you ask questions like

Show every path where user input reaches filesystem writes without validation.

or

Show every allocation not released.

or

Which functions ultimately affect payment authorization?

This is much richer than an AST alone.

Projects such as Joern popularized this approach for security analysis.

How AI Coding Agents Use This
Instead of giving an LLM

500 source files
you provide

AST

+
CFG

+
Call Graph

+
Type Information

+
Embeddings

+
Repository Knowledge
Now the model knows things like

This function is called by 187 locations.

Changing it affects

• authentication

• billing

• reporting

• audit logging
instead of guessing.

Shift-Left Applications
This is probably what you were remembering.

Before code is ever executed, you can automatically detect:

Structural
duplicate implementations
dead code
unreachable branches
unused variables
circular imports
Semantic
incorrect API usage
missing null handling
incorrect async flows
race conditions
lifetime issues
Architectural
layer violations
dependency inversion violations
forbidden imports
cyclic dependencies
bounded-context violations
Security
taint propagation
SQL injection
XSS
command injection
SSRF
secret leakage
Quality
excessive complexity
low cohesion
high coupling
unstable interfaces
architecture erosion
Where This Fits into Janumi
I think Janumi can take this substantially further than current coding agents because the AST/CPG becomes only one layer of evidence.

The Professional Work Architecture (PWA) and its normative corpus already define the intended architecture, invariants, and constraints. That means the realization pipeline can compare multiple representations:

Intent
        ↓
Normative Doctrine
        ↓
Architecture Model
        ↓
AST
        ↓
Semantic Graph
        ↓
Code Property Graph
        ↓
Running System
        ↓
Observability
At each transition, Assurance Engineering can validate that the lower layer still conforms to the higher layer. Rather than asking only "Is the code syntactically or semantically correct?", Janumi could also ask:

Does this implementation still satisfy the doctrinal intent?
Does it violate any declared architectural invariants?
Does it introduce new dependency paths that contradict the PWA?
Does the implementation preserve required contracts and policies?
What downstream PWUs and architectural elements are impacted by this change?
That aligns closely with the realization pipeline you've been developing: the code graph becomes one artifact among many that the Recursive Professional Harness reasons over, instead of being the sole source of truth. This effectively extends today's static-analysis techniques into a broader, intent-aware assurance framework that spans from professional intent through implementation and runtime behavior.

We are primarily a Typescript codebase. Can we use Joern and some combination of other open source (preferred) tools build the approach you just shared - or if there is already such a tool?

Yes. In fact, I think what you're describing is converging on something larger than a static analyzer. It is an AI Semantic Code Intelligence Layer that sits between your TypeScript repository and the coding agent. This aligns very well with the Janumi philosophy of shifting assurance left.

The only nuance is that Joern probably would not be my first choice today for a TypeScript-first codebase.

Why not Joern?
Joern is excellent at:

C/C++
Java
Go
JavaScript (reasonable support)
Security-oriented Code Property Graphs
Its TypeScript support has improved over the years, but it still isn't as deep as the TypeScript compiler itself because it doesn't leverage the complete TypeScript type checker as its primary semantic engine.

For a repository that is 90–100% TypeScript, I'd build on the TypeScript compiler rather than around it.

A better architecture
I'd think of this in layers.

                  Repository

                       │

        ┌──────────────┴───────────────┐
        │                              │

 TypeScript Compiler             Tree-sitter
   (semantic truth)           (fast parsing)

        │                              │

        └──────────────┬───────────────┘

                  Unified AST

                       │

             Symbol Resolution

                       │

             Type Relationships

                       │

               Control Flow Graph

                       │

                Call Graph Builder

                       │

              Dependency Graph

                       │

            Code Property Graph

                       │

          Repository Knowledge Graph

                       │

           AI Coding Agent Interface
Open source components
1. TypeScript Compiler API
This is the foundation.

It already provides

AST
parser
symbol table
types
inheritance
generics
overload resolution
decorators
source maps
diagnostics
This is effectively the "ground truth."

2. ts-morph
One of my favorites.

It wraps the TypeScript compiler with a much nicer API.

Instead of

compiler.getTypeChecker()...
you write

sourceFile.getClasses()

method.getReferences()

project.getSourceFiles()
This dramatically reduces engineering effort.

3. Tree-sitter
Excellent for

incremental parsing
editor integration
partial parsing
extremely fast updates
Useful if your coding agent is continuously monitoring edits.

4. Madge
Excellent dependency graph generation.

Finds

cycles
imports
architecture violations
5. dependency-cruiser
This one is almost mandatory.

It lets you write rules like

UI
↓

Application

↓

Domain

↓

Infrastructure
and fails builds if violated.

Very useful for Janumi Assurance.

6. ESLint
Not just linting.

It already has

parser
AST
rule engine
plugins
Many semantic analyses can be implemented as custom ESLint rules.

7. Semgrep CE
Very useful.

Provides semantic matching beyond regex.

Can express

Any SQL query using string interpolation
without writing an AST visitor yourself.

8. CodeQL
Although GitHub maintains it, it's free for open source and research use (with licensing considerations for commercial use). It is arguably the most mature semantic code analysis system available.

Advantages:

data flow
taint
call graphs
SSA
security
custom queries
Think of it as an industrial-strength semantic query engine.

9. Joern
I would still include it.

Not as the primary engine.

Instead:

TypeScript
      ↓

TypeScript Semantic Graph

      ↓

Convert

      ↓

Code Property Graph

      ↓

Joern Queries
This lets you reuse Joern's mature query ecosystem where it adds value.

Repository Knowledge Graph
This is where your work becomes distinctive.

Instead of stopping at

Function A

calls

Function B
extend it to

PWA

↓

PWU

↓

Requirement

↓

Validator

↓

Invariant

↓

Architecture Decision

↓

Function

↓

Class

↓

Method

↓

Statement
Now your coding agent can answer questions like:

Which doctrinal invariant is violated by this code change?

or

Which PWUs are affected if I modify AuthenticationService?

Those are beyond the scope of conventional static analyzers.

Additional graph technologies
I would also consider:

Graphology for in-memory graph algorithms.
Neo4j Community Edition if you want persistent graph storage and Cypher queries.
Memgraph Community as an alternative graph database.
NetworkX (Python) for offline analyses if you're comfortable crossing language boundaries.
What I would build for Janumi
Rather than trying to force everything through an existing tool, I'd build a Janumi Semantic Indexer (JSI) that composes best-of-breed components.

                    Janumi Semantic Indexer

          ┌────────────────────────────────────┐

          │ TypeScript Compiler                │
          │ ts-morph                           │
          │ dependency-cruiser                 │
          │ Madge                              │
          │ ESLint                             │
          │ Semgrep                            │
          │ CodeQL (optional/commercial-aware) │
          │ Joern (optional CPG layer)         │

          └────────────────────────────────────┘

                         │

              Unified Semantic Model

                         │

        Repository Knowledge Graph (RKG)

                         │

        Janumi Assurance Engineering

                         │

              AI Coding Agents
Where I think Janumi can go beyond existing tools
Current systems answer questions about code:

What calls this function?
Is there a security vulnerability?
Is this dependency cyclic?
Janumi can answer questions about realization:

Which professional objective does this function implement?
Which doctrinal requirement justified its existence?
Which architectural decision records are affected by changing it?
Which invariants, validators, and assurance policies need to be re-executed?
Which other PWUs become semantically inconsistent because of this modification?
That shifts the semantic layer from "understanding source code" to "understanding the implementation of professional intent."

I think this semantic realization graph is one of the more technically differentiated aspects of the Janumi methodology. It bridges your normative corpus, implementation artifacts, and runtime assurance into a single navigable model, rather than treating them as separate documentation and tooling silos.

See we might talk about this solution in three separate concerns. 

1 - the Janumi codebase itself which is primarily Typescript
2 - Janumi Platform which will be base level Kubernetes; but if we use Pulumi might there be a use case for assurance there?
3 - PWAs, PWU, etc.

I think that's exactly the right decomposition. In fact, I would go one step further and say these are three different semantic universes. While they can share infrastructure, they require different parsers, different graph models, and different assurance rules.

Here's how I'd characterize them.

1. Janumi Codebase (TypeScript)
This is the conventional software engineering domain.

The source of truth is the implementation.

The semantic model consists of:

TypeScript AST
symbol tables
type graph
call graph
dependency graph
control-flow graph
data-flow graph
code property graph
test coverage
runtime traces
The assurance questions are familiar:

Is the implementation correct?
Does it violate architectural constraints?
Is there dead code?
Is a contract violated?
Does this change increase coupling?
Does it introduce security vulnerabilities?
Does it preserve the intended behavior?
This is the area where ts-morph, dependency-cruiser, Semgrep, ESLint, Joern, CodeQL, etc., all contribute.

2. Janumi Platform (Infrastructure)
This is a completely different problem.

Now the "source code" is no longer TypeScript.

It is things like:

Pulumi (TypeScript)
Kubernetes manifests
Helm charts
Traefik configuration
Cloudflare configuration
Vault configuration
RBAC
NetworkPolicy
Ingress
Service Mesh
Temporal configuration
Kafka configuration
The semantic model becomes an Infrastructure Graph.

For example:

Tenant

↓

Namespace

↓

Deployment

↓

ReplicaSet

↓

Pod

↓

Container

↓

Secret

↓

PVC

↓

Service

↓

Ingress

↓

DNS

↓

Certificate

↓

Firewall
The assurance questions become:

Can this deployment ever expose a secret?
Is there a NetworkPolicy protecting this namespace?
Does every public endpoint terminate TLS?
Does every Deployment have liveness probes?
Are resource requests specified?
Does every Pod run as non-root?
Does RBAC allow privilege escalation?
Can tenant A ever communicate with tenant B?
Does the infrastructure satisfy the platform doctrine?
Notice these are not "code" questions anymore.

They're graph validation questions.

Pulumi is particularly interesting because it expresses infrastructure in a real programming language. That means you can analyze both:

the Pulumi program itself (using your TypeScript tooling), and
the resulting infrastructure graph after synthesis.
That creates an opportunity for pre-synthesis and post-synthesis assurance.

3. PWAs, PWUs, RPHs, etc.
This is where I think Janumi becomes fundamentally different from existing platforms.

The source material isn't source code.

It's professional cognition.

Examples include:

Professional Work Architectures
Professional Work Units
Validators
Invariants
Personas
Undertakings
Intent
Professional contracts
Policies
Assumptions
Evidence
Decision records
Narrative memories
The semantic graph might look something like:

Mission

↓

Objective

↓

PWA

↓

PWU

↓

Capability

↓

Validator

↓

Invariant

↓

Evidence

↓

Outcome
Notice something.

Nothing here is executable code.

It is executable professional reasoning.

The assurance questions become:

Is every professional objective implemented by a PWU?
Is every PWU validated?
Does every validator support at least one invariant?
Are there contradictory assumptions?
Does this PWA violate organizational doctrine?
Is there an orphan PWU?
Can this undertaking terminate?
Is there a missing approval stage?
Are all mandatory professional roles represented?
That is an entirely new semantic domain.

The commonality
All three concerns can be viewed through the same architectural lens.

                Semantic Object Graph

                        │

                Nodes + Relationships

                        │

                Validators

                        │

                 Invariants

                        │

             Assurance Engine
The nodes simply represent different things.

For software they are classes and methods.

For infrastructure they are Pods and Services.

For professional work they are PWUs and Validators.

The underlying assurance engine can remain largely unchanged.

A possible evolution of Assurance Engineering
This discussion also makes me think that Assurance Engineering itself can be stratified.

Software Assurance
Input:

ASTs
call graphs
CPGs
tests
Output:

implementation correctness
Infrastructure Assurance
Input:

Kubernetes graph
Pulumi graph
cloud topology
runtime configuration
Output:

deployment correctness
operational safety
security posture
Professional Assurance
Input:

PWAs
PWUs
professional doctrine
organizational policies
evidence
Output:

realization correctness
A fourth layer?
One additional thought occurred to me as I was reading your decomposition.

I suspect there is actually a fourth semantic universe that ties the other three together.

Professional Intent

        ↓

Professional Architecture

        ↓

Software Architecture

        ↓

Infrastructure Architecture

        ↓

Running System

        ↓

Observed Behavior
Each transition is a realization boundary:

Intent → PWA/PWU: "Did we model the professional work correctly?"
PWA/PWU → TypeScript: "Did we implement the professional architecture correctly?"
TypeScript → Kubernetes/Pulumi: "Did we deploy the implementation correctly?"
Kubernetes → Runtime: "Is the system behaving as intended in production?"
That end-to-end realization chain is something I haven't seen existing tools model explicitly. Today's tools are typically excellent within one semantic universe (code, infrastructure, or operations), but they rarely provide traceability and assurance across all of them. The Janumi methodology is well positioned to make those transitions first-class, allowing assurance to verify not only correctness within each layer but also fidelity between layers.

The primary focus now is own creating the tool for the first set of concerns - Janumi codebase and software assurance. Using the documentation methodology you explained previously for creating that robust normative prescriptive deontic language corpus what set of documents would you propose we generate to get this integrated tool suite developed?

I actually would not start by generating documents about ASTs, ts-morph, or Joern.

Based on the methodology we've been developing (the recursive normative closure approach, vertical derivation, horizontal closure, and the integrated normative corpus), those are implementation decisions. They belong relatively low in the derivation hierarchy.

Instead, I'd treat this as if we were developing a new Janumi product:

Janumi Software Assurance (JSA)

The documents should first define what the system must know, prove, preserve, and assure, and only then define how those capabilities are realized using TypeScript compiler APIs, graph databases, or static-analysis engines.

I would organize this into seven document families
Foundational Doctrine

↓

Semantic Model

↓

Analysis Model

↓

Assurance Model

↓

Reference Architecture

↓

Implementation Standards

↓

Reference Implementations
This mirrors the methodology we've already used successfully for the RPH and JPWB corpus.

Family 1 — Product Constitution
This is analogous to your Constitution documents.

JSA-CON-001
Janumi Software Assurance Constitution

Defines:

mission
scope
principles
terminology
authority
exclusions
goals
Examples of normative requirements:

The Software Assurance Platform SHALL construct an authoritative semantic representation of every supported software system.

Semantic representations SHALL be considered first-class engineering artifacts.

All assurance conclusions SHALL identify the evidence supporting those conclusions.

Family 2 — Semantic Model
This becomes the heart of everything.

JSA-SEM-001
Semantic Metamodel

Defines every entity.

Examples:

Repository

Package

Module

Namespace

Class

Interface

Function

Method

Variable

Generic Parameter

Import

Decorator

Annotation

Test

Issue

Finding

Constraint

Invariant

Evidence

Every one receives:

identity
lifecycle
authority
relationships
state
versioning
JSA-SEM-002
Repository Knowledge Graph Specification

Defines:

Node taxonomy

Edge taxonomy

Graph invariants

Required metadata

Provenance

Versioning

Evidence links

Confidence

This document is essentially the schema for your Repository Knowledge Graph.

Family 3 — Analysis Doctrine
Now define the analyses.

JSA-ANA-001
Static Analysis Doctrine

Normatively defines:

AST

CFG

DFG

PDG

Call Graph

Dependency Graph

Type Graph

CPG

without mentioning specific tools.

JSA-ANA-002
Repository Discovery Doctrine

Defines:

How repositories are scanned

Incremental updates

Caching

Indexing

File watching

Change detection

Baselines

Snapshots

JSA-ANA-003
Semantic Enrichment Doctrine

Defines:

Symbol resolution

Reference resolution

Architecture discovery

Framework discovery

Generated code

Dependency inference

Ownership inference

Confidence scoring

Family 4 — Assurance Doctrine
This is where Janumi becomes differentiated.

JSA-ASSURE-001
Software Assurance Doctrine

Defines:

correctness

completeness

consistency

architectural integrity

realization integrity

security

performance

maintainability

observability

JSA-ASSURE-002
Validator Catalog

Normatively specifies validator classes.

Examples

Structural Validator

Architectural Validator

Dependency Validator

Concurrency Validator

Nullability Validator

Performance Validator

Security Validator

Observability Validator

Testability Validator

API Compatibility Validator

JSA-ASSURE-003
Invariant Catalog

Examples

Every public API SHALL have documentation.

Every command SHALL have authorization.

Every event SHALL have a schema.

Every asynchronous operation SHALL be cancellable.

Every persistent object SHALL possess identity.

No Infrastructure component SHALL directly reference UI.

These become executable.

Family 5 — Architecture
These explain the tool suite itself.

JSA-ARCH-001
Software Assurance Reference Architecture

Defines major subsystems.

Repository Scanner

Parser

Semantic Indexer

Graph Builder

Validator Engine

Evidence Engine

LLM Adapter

Query Engine

Visualization

JSA-ARCH-002
Plugin Architecture

Defines extension points.

Parser Plugins

Language Plugins

Validator Plugins

Graph Plugins

LLM Plugins

Evidence Providers

Visualization Plugins

JSA-ARCH-003
Repository Knowledge Graph Architecture

Storage

Indexes

Versioning

Incremental updates

Caching

Query language

Traversal

Family 6 — Implementation Standards
Only here do concrete technologies appear.

JSA-IMPL-001
TypeScript Analysis Standard

Defines:

ts-morph

Compiler API

Project references

Declaration files

Decorators

Incremental compilation

JSA-IMPL-002
Graph Construction Standard

Defines:

AST → Graph

CFG construction

Call graph algorithms

Edge normalization

Identity resolution

JSA-IMPL-003
Tool Integration Standard

Normatively specifies:

ts-morph

dependency-cruiser

Madge

ESLint

Semgrep

Joern

CodeQL

Tree-sitter

how each contributes to the unified semantic model.

Family 7 — Reference PWAs
Now we finally describe how this work is executed.

Examples

PWA
Repository Analysis

PWUs

Repository Discovery

Incremental Scan

AST Construction

Semantic Resolution

Call Graph Generation

Graph Merge

Validator Execution

Evidence Collection

Issue Classification

Recommendation Generation

LLM Review

Human Review

Publication

These are professional work definitions, not software components.

One document I think is missing from most static-analysis systems
This is the one I would be most excited to write.

JSA-REAL-001
Software Realization Doctrine

Current tools generally assume:

Source Code

↓

AST

↓

Analysis
I think Janumi should instead define:

Intent

↓

Architecture

↓

Repository

↓

Semantic Graph

↓

Assurance

↓

Evidence

↓

Recommendation

↓

Realization Decision
That document would define what it means for software to faithfully realize its intended architecture, not merely compile or pass tests.

I think there is an eighth family that will become your differentiator
If I were prioritizing this effort, I would move one family to the very top because it is what existing tools do not have.

Intent
↓

Doctrine
↓

Architecture
↓

Implementation
↓

Evidence
↓

Recommendation
I'd call it something like:

JSA-TRACE-001 — Intent-to-Implementation Traceability and Realization Standard

This document would define how every software element is linked upward to:

the architectural decision that justified it,
the requirement or capability it implements,
the applicable doctrinal constraints,
the validators and invariants that govern it, and
the evidence that demonstrates conformance.
Once that traceability model exists, the AST, call graph, dependency graph, and even the Repository Knowledge Graph become supporting evidence rather than the primary artifact. That is a significant conceptual shift: instead of building "a better static analyzer," you're building an assurance-driven realization system in which static analysis is one of several evidence-generating subsystems.

Without using the words themselves, does this corpus include a CONOP and CONEMP for how the coding agent is intended to use this tool suite?

No—not yet. I think that's an important gap.

What I proposed primarily describes the system itself: its doctrine, semantic model, architecture, assurance model, and implementation standards. It answers questions like:

What is this system?
What must it do?
What invariants must it preserve?
How is it architected?
How is it implemented?
It does not fully answer:

How is the coding agent expected to employ this capability throughout realization?
At what points in its work must it invoke the analysis engine?
Which analyses are mandatory versus discretionary?
How should findings influence planning, implementation, or refactoring?
When is the agent authorized to proceed despite unresolved findings?
What constitutes sufficient evidence before declaring a task complete?
Those are operational questions.

I think there are actually three missing document families
1. Operational Employment
This describes how the coding agent uses the assurance platform during realization.

For example:

Initial repository ingestion
Before decomposition
Before implementation
During implementation
After implementation
Before committing
Before merging
During regression analysis
During architectural refactoring
During incident investigation
Each stage would define:

required analyses
required evidence
mandatory validators
escalation rules
stopping conditions
This is the operational playbook.

2. Agent Behavioral Doctrine
This defines the expected behavior of an AI coding agent while interacting with the tool suite.

Examples of normative statements might include:

The agent SHALL treat semantic analysis as authoritative evidence unless contrary evidence is documented.
The agent SHALL not introduce a new architectural dependency without evaluating its impact.
The agent SHALL rerun affected validators after material structural changes.
The agent SHALL reconcile conflicting evidence before continuing realization.
The agent SHALL justify any decision to defer an assurance finding.
This governs the agent itself, not the software.

3. Assurance Lifecycle
This describes how assurance is woven through the realization process.

Rather than:

Plan
↓

Code
↓

Run analysis
the lifecycle becomes something like:

Understand
↓

Analyze current state
↓

Plan

↓

Predict impacts

↓

Implement

↓

Re-analyze

↓

Validate

↓

Collect evidence

↓

Determine readiness

↓

Commit
The analysis engine is continuously consulted rather than invoked only at the end.

In Janumi terminology
Stepping back, I think there are three distinct kinds of doctrine emerging:

Product Doctrine — what the software assurance platform is.
Operational Doctrine — how it is employed during realization.
Behavioral Doctrine — how autonomous agents are expected to behave while using it.
The earlier corpus covers the first category well. The second and third are the pieces that correspond to the operational concepts you've used elsewhere in the Janumi methodology. Without them, a coding agent understands what the platform is but not how it is expected to integrate it into its day-to-day realization activities.

I would therefore elevate those operational and behavioral documents to first-class artifacts alongside the technical specification. In practice, they will likely have as much influence on the quality of the coding agent's work as the implementation standards themselves, because they define the expected patterns of use rather than merely the capabilities available.

