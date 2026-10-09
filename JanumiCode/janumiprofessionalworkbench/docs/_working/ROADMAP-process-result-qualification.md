# ROADMAP — `JAN-PRQUAL`: the selected reviewer is measured on process results, and the fingerprint sees how a process result is shown to it

**Design:** `DESIGN-process-result-qualification.md` (revision ~~4~~ 5). · **Authority:** `REG-F-476`, scheduled by `REG-D-091`. The design's delegated calls are `REG-D-094`, flagged for sponsor confirmation. · **Date:** 2026-10-02; updated 2026-10-05. ⭑ Landed 2026-10-08. · **Status:** ~~`PQ-1` IN PROGRESS.~~ `PQ-1` COMPLETE at its landing commit (2026-10-08; `REG-D-097`). `PQ-2` is next.
- The sponsor answered §7 on 2026-10-03 (`REG-D-095`): option (a), so `PQ-1` changes every case prompt; the fourteen cases are conferred; the reopening rule is adopted.
- Paid run 1 ran on 2026-10-04. The sponsor answered its result on 2026-10-05 (design §9.2): options 1 and 3 combined, built as design D7 to D9 in `PQ-1`, then one paid re-run.
- The re-run ran on 2026-10-05 (`qr-2026-10-05-devin-glm-5-3-flash-max-v3`): right in 52 of 52, so under design §9.4's rule (A) suffices and D9 stays HELD (`REG-D-096`). `REG-F-488` records paid run 1, and `REG-F-489` the re-run's malformations.

⭑ **Exit.**
- **What the reviewer reads for a process result is truthful** (design D2) and pinned branch by branch. The fingerprint reaches the renderer (D3).
- **The selected reviewer is measured on process results.**
  - The paid run over the conferred cases is recorded, and `reviewer:qual:check` is GREEN.
  - Its result is reported under the design's §7.3 rule.
- **The register.**
  - `REG-F-476` is closed.
  - The G6 findings are closed in the scope §7.1 chose.
  - G7, G8 and the general forms (under §7.1 (b)) stay filed.
- **The gate.** `gate:fast` is green, including Playwright. Nothing is pushed.

**The landing pattern** is `JAN-ESCREC`'s:
1. Implement.
2. Adversarial verification, whose own mutants find the gaps.
3. Fix rounds, re-verified, until no BLOCKER or MAJOR remains.
4. Land:
   - documents edited by Codex and audited by an independent rebuild;
   - the ledger, with OBSERVED texts taken from the final verification's outputs;
   - the official runner over the new mutants and every prior entry anchored in or victimised by the changed files;
   - the census regenerated;
   - `gate:fast`, then `commit -F`.

## `PQ-1` — one renderer and one builder; what the reviewer reads; the fingerprint reaches the renderer (D1, D2, D3, D6)

**Red first, in this order:**
1. **The defects.** Each G6 defect is driven as a red at the round start, through the real validator:
   - a stream lost to the content cut;
   - a cut declared after the bytes;
   - a forged observation block, from stdout and from the account;
   - two `argv` arrays rendering alike;
   - a lone surrogate;
   - the observation block's false *"The command own verdict"* line.
2. **The builder.** `review-input.test.ts` gains its third block, holding `runProcessResultFloor` to `processResultReviewInput` byte for byte, with no narration and no prior.
3. **The renderer's branches.** Each has a byte pin, which is the victim of that branch's mutant. The branches are:
   - clean;
   - signal;
   - timed out;
   - incomplete capture;
   - a STDOUT cut;
   - a STDERR cut;
   - a head-and-tail cut;
   - a long command line;
   - a surrogate pair astride a cut.
4. **The fence.** The same input gives byte-identical prompts, and a stdout printing the first candidate is not cut. The escalating fence is a mutant.
5. **The budget seam.** `processResultContentBudget` is exported from the validator and computed by `judgePrompt`'s own assembler. No `…(truncated)` appears between the content's fences.
6. **The evidence.** `argv` is a JSON array in both views and in the limitations line; `evidence-join.test.ts:257` is the predicted red.
7. **The fingerprint.**
   - The `P-` probes are rebuilt through the builder.
   - The pins at `:390`, `:405-411` and `:496-509` are re-expressed against the builder's declaration and the new fence.
   - One probe still reaches `CONTENT_MIN`, with its own mutant.
   - The `render` seam row shows that a renderer change moves `probes` and no case prompt.
8. **`REG-D-093`'s owed pins** (ER2-V100..V104), each shown red under its mutant.

**Under §7.1 (a)**, the fence and the declared cuts also apply to the graph and work-product arms, each pinned. Every case prompt then moves.

**The guards**, each in the same commit:
- `DISPOSED_STDERR_SITES` and its pinned literal;
- `REG-Q-066`'s disposition, moved and restated for the two views;
- the review-input closure census;
- re-anchoring every ledger mutant whose anchor an edit touches (`J21-M3`, `J23-M1`, `J23-M8`, and any others the build finds);
- the export census;
- the operator messages that tell how to clear a probes-only move (*"…or RESCORED lines where no case prompt changed (§5.6 limb 1)"*).

**The record**, regenerated after the last edit that moves a probe:
- **Under (b):** the ACKNOWLEDGED line with the design's verbatim reason, a whole RESCORED record of the selected run, and its ESCALATION line citing `REG-F-456`.
- **Under (a):** paid run 1 of the selected candidate over the 26 v3 cases, two repetitions, with its ESCALATION lines.

**Design §9's additions (revision 5; the sponsor's answers of 2026-10-05, the last *"Proceed as you recommend"*).** Built after the fence rounds, before the re-run:
1. **D7.** The account's layout restored inside its regions: HEAD's labels and `  - ` bullets, each field its own region, the prose first and unlabelled. Every reader of the list encoding moves with it (the regions pin, both copies of the §4.1 inverse transform, `processResultUntrustedSlices`, the probes' plants, the per-break and encoder rows).
2. **D8.** The rubric and recommendation lines exactly as design §9.3 writes them: each criterion's declared stakes beside it; `failed: true` as "not met"; concerns that leave a criterion met in residual uncertainty; each gloss held by a test to `dispositionFromFindings`. ESCALATED stays bare, last and named once; `REG-D-090`'s pins restated for the new glosses and their ledger entries re-anchored.
3. **D9 is HELD.** Nothing of it is built in the product. A scratch re-scorer (a copy of the package scoring with the tolerance sketched) re-scores the re-run's replies for the report.
4. **The re-run.** The selected candidate over the 26 v3 cases, two repetitions, on the prompt with D7 and D8; a transport failure re-run once, then counted. It is reported under design §9.4's rule, decided before the run, with each verdict beside its re-scored verdict. Paid run 1 stays in the record with ESCALATION lines citing the finding that records design §9.1. ⭑ That finding is `REG-F-488`. Done 2026-10-05: the re-run is right in 52 of 52, so (A) suffices and D9 stays HELD. The re-run's ESCALATION lines cite `REG-F-489`, and the probes-only move after it (the account-breaks probes) is discharged by an ACKNOWLEDGED line and a whole RESCORED record of the re-run, `rs-2026-10-08-devin-glm-5-3-flash-max-v3`.

## `PQ-2` — the process-result arm and the paid run (D4, D5)

**Begins only after the sponsor confers §5's cases.** ⭑ Conferred 2026-10-03 (`REG-D-095`): `PQ-2` is next, its fourteen cases rendered on the final prompt.
1. **The fixture suite.** Build it in scratch, outside the repository: pytest 9.1.0 on the build host, with the `fatigue` marker registered. Record each case's output literally, and state the platform in the case file.
2. **Case set v4 and oracles v4.**
   - They are generated: the 26 v3 cases carried under their ids, plus the 14 conferred cases.
   - A case carries the run literal, rendered at materialize time.
   - There is exactly one oracle per case, and a `CONTESTABLE` set.
3. **The machinery made exhaustive by arm:**
   - the union and `materialize`;
   - in the cases test: the arms, prefixes, producer limb, id census (`evd_`) and the arm's renamed-copy count;
   - SEEN WHOLE asserted on the run;
   - `P-RR-07-CUT` pinned by id, with every line its oracle note cites.
4. **The mutants.** Re-anchor `J25-M5` and `J27-M8`; add a "left on v3" mutant and one mutant per new case.
5. **The paid run.** devin with `glm-5-3-flash-max`, `run.ts --cases` over the 14 new cases, two repetitions.
   - Record the RUN and its CALL lines, and escalate every material failure to an open finding.
   - `reviewer:qual:check` must be GREEN.
   - Report the result under §7.3.
   - Build, run and record land in ONE commit.
