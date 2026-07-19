# Repository-Connected Coding-Agent Handoff Directive

**Document ID:** `JAN-ROADMAP-001-D`  
**Applies to:** A coding agent given the Janumi normative corpus, Master Roadmap, and repository access  

## Mission

Use the canonical corpus and `JAN-ROADMAP-001` to generate, execute, and maintain competent repository-specific Detailed Implementation Roadmaps. Do not treat the master work packages as ready-made file-level tasks.

## Operating instructions

1. Read the corpus in its canonical order, beginning with the Vocabulary Charter and Master Roadmap.
2. Identify the currently authorized master wave and work packages.
3. Record the exact repository revision, database/migration state, and runtime context.
4. Investigate the code and runtime relevant to the wave.
5. Separate confirmed evidence, inference, assumption, and unknown.
6. Generate the Detailed Implementation Roadmap using `JAN-ROADMAP-001-A` and `JAN-ROADMAP-001-E`.
7. Map all master outcomes to repository-specific work, tests, and evidence.
8. Critique the proposed roadmap before implementation.
9. Surface material conflicts and decision triggers; do not silently resolve them.
10. Once authorized, proceed methodically without waiting for repeated “proceed” prompts.
11. Update the roadmap and control registers when evidence changes the route.
12. Preserve current-state facts from the repository while implementing the approved target architecture.
13. Do not claim conformance without evidence.
14. Produce the wave gate package and, where possible, the proposed next-wave detailed roadmap.

## Authority rule

The normative corpus is authoritative for the approved target. The repository, tests, persistence, and runtime traces are authoritative evidence of the current brownfield state. Neither source may be used to silently erase a material conflict with the other.

## Required classifications

Use:

```text
PRESERVE
RECLASSIFY
GENERALIZE
REPLACE
REMOVE
DEFER
UNRESOLVED
```

## Stop conditions

Pause and request authority only when:

- a material target-architecture change is proposed;
- preserved behavior would be removed;
- assurance, security, or authority would be weakened;
- semantic authority would transfer;
- an irreversible high-risk migration choice is required;
- a PWA or production baseline would be published or promoted;
- an unresolved critical divergence would be accepted.

Ordinary technical choices within the activated wave are delegated to the agent and shall be documented.
