# The Virtuous Cycle Harness — canon fitness program

**Status:** program tooling, non-canonical. Findings flow through the pilot-findings/REG-005 discipline; refinements follow B5. **Purpose:** continuously test, evaluate, refine, and improve the canon corpus as an *instrument for governing agent work* — before and between real-task pilots, using multi-agent cycles.

## 1. The unit under test

The corpus (six artifacts + templates + register discipline), evaluated as an instrument. A probe in which a competent agent lands wrong is attributed before it becomes a finding:

- **CANON-DEFECT** — the text invites the error, lacks the needed rule, routes wrongly, or leaves governed ground silent. *This is a finding.*
- **AGENT-ERROR** — the text is clear; the agent misread it. Not a canon finding (but repeated agent-error on the same passage across probes IS a canon finding: reproducible misreading is a drafting defect — the §9.7 lesson).
- **PROBE-DEFECT** — the probe or its oracle is wrong. A finding against the probe suite.

## 2. The cycle: Envision · Research · Shape · Investigate · Plan · Implement · Assure

| Phase | In this harness |
|---|---|
| **Envision** | Fix the cycle's intent: which fitness dimensions are under test, what improvement looks like. Sponsor-adjustable; defaults from §4. |
| **Research** | Gather existing evidence: pilot findings to date, open register questions, prior cycle reports, real-task lessons (the DWP series is standing input). No new probing. |
| **Shape** | Construct/extend the probe suite for the target dimensions (§3 genres). New probes get explicit oracles (expected outcome + expected routing). |
| **Investigate** | Run the probes: fresh subagents operate under the canon; independent judges attribute outcomes against oracles; HIGH findings get adversarial refuters (a finding survives only if it cannot be refuted). |
| **Plan** | Triage surviving findings into a refinement batch: classify (missing content / missing edge / wrong altitude / routing defect / consistency break), route to owning artifact, draft amendments with a mini ratify sheet. |
| **Implement** | Apply refinements per the delegation boundary (§5): tooling and HYPOTHESIS-grade fixes autonomously; PRESUMPTIVE and CONSTITUTIONAL queued as proposals for sponsor ratification. Version bumps + register entries per B5. |
| **Assure** | Re-run the motivating probes: **a refinement must flip its probe red→green and regress nothing** — the mutation discipline applied to the canon itself. Passing probes accumulate into the regression suite; the suite only grows. |

## 3. Probe genres

1. **Consumption probes** — a fresh agent with only the canon must perform intake for a realistic task (change contract, ledger, routing). Measures findability, load-order friction, silence on governed ground.
2. **Dispute probes** — novel disputes (beyond the founding case battery) the canon should decide or route. Verdict: decided / routed / undecidable.
3. **Adversarial economy probes** — the probe agent is instructed to take the most economical defensible interpretation; the judge asks whether the canon's text *blocks the cheap path* (obligation surface, floor rules, ledger, oracle integrity). Red-teams under-implementation.
4. **Over-application probes** — the probe agent is instructed to take the most conservative interpretation; the judge asks whether non-examples and scope clauses *prevent over-reach* (the §9.7 class). Red-teams the other direction.
5. **Consistency sweeps** — cross-artifact contradiction, broken references, status-block/version/register-numbering integrity, vocabulary conformance to DOC-002. Especially after amendment passes.
6. **Simulation probes** — a bounded end-to-end mini-task executed under the pilot prompt (in a worktree or dry-run), observing actual behavior against protocol. The most expensive genre; used sparingly, and superseded by real-task pilots when available.

## 4. Fitness model (diagnostics, never averaged into truth)

**Decidability** (disputes decided or correctly routed) · **Consumption cost** (reads/steps to first correct action) · **Economy resistance** (cheap paths blocked) · **Over-application resistance** (non-examples effective) · **Consistency** (contradictions found) · **Coverage** (governed-ground questions answerable) · **Stability** (probe regressions across cycles). Tracked per cycle in the cycle report.

## 5. Governance

- **Delegation boundary:** the harness applies autonomously only what DOC-004 §8.2 already delegates — tooling/template fixes and HYPOTHESIS-layer corrections consistent with recorded decisions. PRESUMPTIVE and CONSTITUTIONAL refinements are drafted and queued with a mini ratify sheet; the sponsor disposes in batch.
- **Oracle integrity is reflexive (DOC-004 §7.6 applies to the harness itself):** the probe suite is an oracle stream. The agent that refines the canon in a cycle SHALL NOT edit the probes that judged it in that cycle; probe changes are separate, declared acts (normally in the next cycle's Shape phase, with the change and reason recorded). A canon "fix" that works by weakening its probe is the named failure.
- **Findings channel:** cycle findings use the PILOT/REG entry discipline; cycle reports live at `docs/canon/_test/cycles/`; the accumulated suite at `docs/canon/_test/probes/`.
- **Braiding with real work:** real-task pilots (DWP-04 and successors) are the highest-value probes and feed Research directly; the harness fills the gaps between them and regression-tests every amendment the real work induces.

## 6. Stopping and cadence

A cycle series on a target dimension runs loop-until-dry: stop when two consecutive cycles yield no unrefuted HIGH findings on that dimension, or on sponsor direction. The regression suite runs (cheaply) after every canon amendment regardless of cycles.

## 7. Cycle-001 machinery changes (from the Cycle 000 shakedown)

The shakedown found the refutation round structurally one-sided: two default-refute refuters with no reply from the judge makes refutation decisive by construction (0/3 HIGHs survived; all died to closer reading — which was correct this time, but the asymmetry is real). From Cycle 001:

1. **Adjudicated verification:** the judge receives the refutations and may file one bounded rebuttal; a neutral adjudicator (who has read the cited passages) rules. Survival requires the adjudicator, not refuter unanimity alone.
2. **Pre-HIGH self-test:** before filing any HIGH, the judge must quote the strongest opposing canon passage and explain why a good-faith reader still escapes it. A HIGH without this is downgraded automatically.
3. **Cross-probe collation:** before Plan, collate findings by cited passage — a seam recurring across probes (e.g., §2.1/§9.1 in three Cycle-000 probes) is one finding with multiplied weight, not several.
4. **MEDIUM vetting:** amendment-bearing MEDIUMs get one cheap refuter pass before entering a sponsor batch; unvetted single-judge findings are labeled as such wherever presented.
5. **Workflow-authoring note:** embed all paths as literals in cycle scripts — `args` has reached scripts stringified (undefined fields) in every run to date; agents recover via the harness's fixed paths, but literals remove the failure mode.

## 8. Note on the seven-phase model itself

Envision/Research/Shape/Investigate/Plan/Implement/Assure is an operational rendering of the canon's cognitive loop (Intent → Understanding → Representation → Reasoning → Decision → Action → Observation/Reconciliation) with Assure carrying the assurance discipline. If it proves out across cycles, it is a candidate doctrine pattern for JPWB-DOC-001 — adoption via a REG-005 entry, never by silent use.
