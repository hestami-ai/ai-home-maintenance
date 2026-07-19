# Detailed Roadmap Generation and Normalization Standard

**Document ID:** `JAN-ROADMAP-001-A`  
**Version:** `2.0.0-draft`  
**Status:** Proposed normative companion  
**Applies to:** Every repository-specific wave roadmap derived from `JAN-ROADMAP-001`  

---

# 1. Purpose

This Standard defines how a repository-connected coding agent or human engineering team SHALL transform the canonical Janumi corpus, an activated master wave, and the actual repository into a competent normalized Detailed Implementation Roadmap.

The detailed roadmap is the repository-specific implementation authority for its activated wave, subordinate to the Master Roadmap and canonical corpus.

# 2. Required inputs

The agent SHALL record:

- master-roadmap version;
- activated wave and gate status;
- applicable master work-package IDs;
- normative source documents and versions;
- repository identity and exact revision;
- relevant database schema or migration revision;
- relevant runtime/deployment identity;
- known prior decisions, divergences, deferrals, and waivers.

# 3. Required generation procedure

## 3.1 Read and digest the governing corpus

The agent SHALL identify the requirements, invariants, prohibited shortcuts, and evidence obligations applicable to the wave. It SHALL not rely on document titles or summaries alone where the detailed section is material.

## 3.2 Inspect current implementation

The agent SHALL inspect the repository areas relevant to the activated wave, including as applicable:

- domain and state models;
- orchestration and control flow;
- persistence and migrations;
- prompts and context assembly;
- roles, validators, and model/tool bindings;
- tests and fixtures;
- side effects and recovery;
- UI projections;
- deployment and operational behavior.

## 3.3 Establish knowledge status

Every material finding SHALL be identified as:

- `CONFIRMED` — directly supported by code, test, state, or trace evidence;
- `INFERRED` — strongly supported but not directly demonstrated;
- `ASSUMED` — temporarily accepted for planning and requiring validation;
- `UNKNOWN` — unresolved and potentially plan-affecting.

## 3.4 Perform semantic classification

Legacy elements relevant to migration SHALL be classified as:

- `PRESERVE` — retain the professional outcome materially unchanged;
- `RECLASSIFY` — retain behavior under a different canonical abstraction;
- `GENERALIZE` — move product-specific behavior into reusable RPH/JPWB capability;
- `REPLACE` — preserve the required outcome through a materially different implementation;
- `REMOVE` — eliminate accidental, obsolete, or harmful behavior;
- `DEFER` — valid but outside the current wave;
- `UNRESOLVED` — requires evidence or authority before planning can bind.

## 3.5 Identify implementation alternatives

For material architecture or migration choices, the roadmap SHALL record:

- alternatives considered;
- advantages and disadvantages;
- compatibility and migration impact;
- security and operational impact;
- selected approach;
- rationale;
- decision authority when required.

## 3.6 Decompose the wave

Each activated master work package SHALL map to one or more detailed work packages. Each detailed work package SHALL define:

- a concrete professional and technical outcome;
- repository locations or discovery actions;
- dependencies;
- required changes;
- invariants and prohibited shortcuts;
- tests;
- evidence;
- migration/rollback;
- exit criteria.

## 3.7 Critique the proposed roadmap

Before implementation, the agent SHALL perform a self-review covering:

- normative coverage;
- omitted difficult requirements;
- legacy behavior preservation;
- semantic-authority risks;
- assurance and evidence gaps;
- security and permissions;
- data migration and recovery;
- overengineering and unnecessary new abstractions;
- sequencing and reversibility;
- contradictions with code or corpus.

## 3.8 Bind or escalate

The agent MAY authorize ordinary implementation details within an approved wave. It SHALL escalate material-decision triggers defined by the Master Roadmap.

# 4. Required detailed-roadmap sections

Every detailed roadmap SHALL include:

1. Document control and repository identity
2. Activated master scope
3. Normative-source digest
4. Current-state findings and evidence
5. Legacy semantic classification
6. Target-state gap analysis
7. Alternatives considered and selected strategy
8. Repository architecture and change map
9. Detailed work-package register
10. Data and persistence changes
11. Execution, compatibility, and migration strategy
12. Assurance, tests, and evidence plan
13. Security, authority, and tenant-impact analysis
14. Observability, recovery, and rollback
15. Risks, assumptions, unknowns, decisions, deferrals, and divergences
16. Traceability matrix
17. Implementation ordering and concurrency plan
18. Exit criteria and gate package requirements
19. Self-critique and readiness determination

# 5. Detailed work-package contract

```yaml
id: JAN-W<n>-DWP-<number>
master_wave: W<n>
master_work_packages: []
title: ""
outcome: ""
knowledge_status: CONFIRMED
repository_scope:
  repositories: []
  files_or_symbols: []
  database_objects: []
  runtime_surfaces: []
dependencies: []
required_changes: []
invariants: []
prohibited_shortcuts: []
tests: []
evidence: []
migration_and_compatibility: []
rollback_and_recovery: []
risks: []
open_decisions: []
exit_criteria: []
delivery_state: NOT_STARTED
conformance_state: UNASSESSED
```

# 6. Repository investigation quality

A detailed roadmap SHALL NOT claim repository grounding merely because filenames were listed. It must show evidence of understanding relevant:

- ownership of state;
- invocation and data flow;
- behavior under failure;
- persistence effects;
- external side effects;
- test coverage;
- compatibility dependencies;
- hidden coupling.

# 7. Normative-document correction

When code-grounded evidence shows that a normative document contains a false current-state assumption, stale term, internal contradiction, or infeasible prescription, the agent SHALL propose a documented correction. It SHALL distinguish:

- correction of current-state description;
- change to target architecture;
- implementation-route change;
- clarification without substantive change.

Only target-architecture changes require master-level authority unless the applicable governance says otherwise.

# 8. Execution autonomy

After the detailed roadmap is authorized, the agent SHALL proceed through its work packages without repeated confirmation, unless:

- a material-decision trigger occurs;
- critical new evidence invalidates the strategy;
- safety or security requires interruption;
- the work would leave the activated wave;
- required authority is unavailable.

# 9. Roadmap maintenance during implementation

The detailed roadmap is a living controlled artifact. The agent SHALL update it when:

- repository discoveries alter dependencies;
- a chosen strategy proves invalid;
- a migration seam changes;
- additional tests or evidence become necessary;
- a work package is split, merged, deferred, or superseded;
- a divergence or decision is resolved.

The roadmap SHALL preserve revision history and rationale. Updating the route is not a failure when it preserves the destination and is evidence-based.

# 10. Completion rule

A detailed roadmap is complete when:

- all activated master outcomes are mapped;
- all detailed work packages are implemented or validly dispositioned;
- required tests pass;
- required evidence exists;
- unresolved material issues are explicitly controlled;
- the gate package is complete;
- traceability reaches code, tests, evidence, and decisions.
