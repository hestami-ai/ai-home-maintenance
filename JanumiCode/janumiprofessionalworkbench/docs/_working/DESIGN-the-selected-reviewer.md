# DESIGN — `JAN-SELREV`: the selected reviewer, GLM-5.3 Flash Max, in the product's assurance-reviewer role

**Authority:** `REG-D-084` (sponsor, 2026-09-26): *"REG-D-083 and REG-D-082 are approved. We will proceed with your
recommendation for the clean-case residue. GLM-5.3 Flash Max is selected."* The role is `REG-D-078`'s *"the assurance
policies responsibility"*. · **Date:** 2026-09-26 · **Revision:** 2 (revision 1 was attacked by two adversarial
critics; §7 lists what changed) · **Status:** DRAFT.

**Delegation.** The decisions below are delegated best judgement under `REG-D-071`'s standing delegation: *"For anything
else related that needs my decision or input you will need to author solutions and use your best judgement."* The
selection is Job 2's outcome (`REG-D-078`, `REG-D-084`). They are to be recorded as `REG-D-085`, with the items listed
in §6 for sponsor confirmation. One question (§5) is the sponsor's and is not built until ruled.

---

## 1. What the ruling asks, and what it leaves alone

- **Asked.** The product's reasoning review, the assurance floor's Reasoning Review policy, is to be carried out by
  `devin` with `glm-5-3-flash-max`. That is the candidate measured on case sets v2 and v3 (`REG-F-454`, `REG-F-456`):
  the right verdict on 51 of 52 on v3.
- **Read, not settled: `REG-D-052`.** The sponsor's words: *"We won't be pinning judge model because that will be
  selected based on performance parameters that have yet to be determined. Meaning that it will need to be
  configurable."*
  - The selection settles those parameters. **This design READS it as leaving the no-default rule in force**:
    `REG-F-331`'s argument (a pinned label rots when the installed tool stops recognising it) applies to any label,
    selected or not.
  - So the selection enters the product as its documented deployment configuration, and no code default names the
    model. The reading is the agent's, and it is listed for confirmation (§6).
- **The configuration.**

  | role | variables | value |
  |---|---|---|
  | reviewer | `JPWB_ASSURANCE_TOOL` / `JPWB_ASSURANCE_MODEL` | `devin` / `glm-5-3-flash-max` |
  | executor (producer of work products) | `JPWB_EXECUTOR` / `JPWB_EXECUTOR_MODEL` | `pi` / the operator's Pi model |
  | authoring agent (producer of drafts) | `JPWB_AGENT_MODEL`, or Pi's own settings (`agent/pi-agent.ts:61-86`) | the operator's Pi model |

- **Independence (ASR-13).** `DIFFERENT_MODEL` compares the model ids each tool REPORTS, by exact string
  (`assurance-rules.ts:190-203`). ASR-13 asks for *actual* independence. Neither producer, the executor or the
  authoring agent, may therefore run a GLM-5.3 Flash model under any provider or spelling, because a different spelling
  of the same model would pass the check falsely. The code cannot check this, so it is operator guidance. It goes into
  the refusal guidance and the documents (D9).
- **Left alone: what the reviewer is asked.** Nothing here touches the prompts, the 26,000-character budget, the
  criteria or the scoring. The reviewer fingerprint stays `2b6ca158…`, so the qualification record describes the
  deployed reviewer's PROMPT and scoring. It does not describe what devin adds on a given host (G11).
- **Left open, and now on the default path:** `REG-F-428`, a duplicate-key reply that mints a phantom NOT_MET row. It
  was observed once in 52 of this candidate's replies (`REG-F-454`).

## 2. What the product does today

Read from code (two readers, then two critics, 2026-09-26).

| # | Gap | Where |
|---|---|---|
| G1 | **The tool defaults to agy.** An unset `JPWB_ASSURANCE_TOOL` means `agy`, which is not the selected reviewer. The default was introduced in `bdff99ce` (`JAN-TOOLSUITE` TS-07, 2026-09-05), kept in `f35cb69d`, and never put to the sponsor. A host with nothing configured is told to set `JPWB_JUDGE_MODEL`, which steers it to agy. | `assurance/index.ts:62`; `assurance/preflight.ts:43-45` |
| G2 | **Unknown tools run agy silently.** Every value except exactly `devin` runs agy: `pi` (which the catalog declares ASSURANCE-capable, `backing-tool.ts:79-80`), `Devin`, a typo, `''`. The executor refuses the same thing, and `backing-tool.ts:115` names it: *"A SILENT FALLBACK IS THE FICTION `REG-D-052` FORBIDS"*. | `assurance/index.ts:80-89` |
| G3 | **A missing devin model throws instead of being recorded.** devin's model is resolved while the registry is BUILT, so an unset `JPWB_ASSURANCE_MODEL` throws out of `createFloorRegistry`. On authoring, the throw is caught only after the paid Pi agent ran. On execution, it escapes `beginExecute`'s try/finally, which has no catch, and leaves the step RUNNING. agy's missing model, by contrast, is resolved inside `evaluate` and recorded as `VALIDATOR_EXECUTION_FAILED`. | `assurance/index.ts:84`; `routes/pwa/[id]/agent/+server.ts:173, :372`; `routes/undertakings/[id]/+page.server.ts:1253-1472`; `reasoning-review-validator.ts:387` |
| G4 | **The authoring preflight is agy-only.** It checks only `JPWB_JUDGE_MODEL`, and chooses by the retired `JPWB_ASSESSOR` (`REG-F-443`). A devin-only host is refused on every authoring turn. A devin host with no model passes the preflight, then fails as in G3. | `assurance/preflight.ts:30`; `agent/+server.ts:340-341` |
| G5 | **The execution path has no preflight.** A misconfigured reviewer is discovered only after paid execution. | `+page.server.ts` (`beginExecute`) |
| G6 | **devin's reported model is never checked.** The model devin reports running is not compared with the one configured. | `tools/devin-reviewer.ts:82-105` |
| G7 | **The reviewer program can be replaced.** `JPWB_DEVIN_BIN` and `JPWB_AGY_BIN` work in every mode, and a replacement's reviews are recorded as the real tool's (`REG-F-441`). The agy EXECUTOR shares `AGY_BIN` (`execution/model.ts:103`). | `tools/devin-reviewer.ts:20`; `assurance/agy-cli.ts:8` |
| G8 | **The gate inherits the shell's live-backend selections.** An exported `JPWB_ASSURANCE_TOOL` turns every test-mode stand-in into the real, paid reviewer, because `useStandin` keys on the variable's ABSENCE. An exported `JPWB_EXECUTOR` reaches the e2e server's executor (`execution/model.ts:66`, same shape). An exported `JPWB_AGENT=pi` reaches the authoring agent (`workbench.ts:636`). The gate's three vitest entry points and its e2e server all inherit the shell. | `assurance/index.ts:58`; `playwright.config.ts:57`; `scripts/gate-tail.ts:47`; `package.json` `test` / `test:dist` / `test:coverage` |
| G9 | **The documents say agy.** README and `AUTHORING-BACKBONE.md` describe a Gemini default that does not exist (`REG-F-442`). `harness/README.md:31-36` and the headers of `index.ts` and `reasoning-review-validator.ts` name agy/Gemini as the product's reviewer. The live lane: its documents name `glm-5-2`; its spec says `readReportedModel` *"IS NEVER CALLED"* (false since `devin-reviewer.ts:82`); its config's REQUIRED list demands `JPWB_ASSURANCE_MODEL` for every tool, while the spec compares the reviewer against it (`:169`), which is wrong for agy; and its comments at `:15` and `:42-43` are stale. | `README.md:68-75`; `AUTHORING-BACKBONE.md:73-76`; `e2e-live-exec/execution.live.ts:42-46, 169`; `playwright.live-exec.config.ts:15, 25-30, 42-46` |
| G10 | **The agy executor records the wrong model.** It runs `JPWB_JUDGE_MODEL` (`agyPrint` → `judgeModel()`) but records `JPWB_EXECUTOR_MODEL`. So agy executing and agy reviewing could run one model while the record shows two, a false ASR-13 pass. Out of this design's scope; filed. | `execution/model.ts:103`; `agy-cli.ts:82`; `+page.server.ts:1328` |
| G11 | **devin adds hidden context.** devin injects ambient context from its host profile (`REG-F-357`: *"`<rules type=\"always-on\">` … plus `<available_skills>` — an ASR-13 *shared hidden context* concern that nothing detects"*). It runs in the server process's working directory, which must be trusted for print mode (`devin-reviewer.ts:58-60`). | `tools/devin-reviewer.ts:73-77` |
| — | **The tests.** Two mutants anchor at `index.ts:70`, the stand-in arm (`J12A-M7`, `J13-M3`); none anchors on the tool selection (`:58`, `:62`, `:78-89`). No test reaches the devin branch, because every real-path test injects `print`, which wins at `:78`. devinPrint has no exec seam, and a stub program cannot stand in for it: on this host node refuses script targets with `shell: false` (`child-process-runner.test.ts:196-197`). | map and critics, 2026-09-26 |

## 3. The design

- **D1 — The model stays configuration.** No code default names `glm-5-3-flash-max`. Every refusal's guidance names
  `REG-D-084`'s selection and the independence guidance of §1. That is guidance to the operator, not a value the code
  falls back to. *Rejected:* a model default, for the reading in §1. It would also redden `devin-reviewer.test.ts:85-95`.
- **D2 — The tool is configuration too, outside test mode.**
  - **How it is read.** The tool is trimmed, and `''` or whitespace means UNSET, as `resolveExecutorToolId` does
    (`backing-tool.ts:348-351`).
  - **Outside test mode.** Unset → REFUSED. Otherwise the tool goes through `selectBackingTool(tool, 'ASSURANCE')`, whose
    refusal covers unknown tools. A tool the catalog declares but has no adapter wired for (`pi`) → REFUSED, *"declares
    ASSURANCE but no adapter is wired"*, as `execution/model.ts:104-106` does for execution.
  - **In test mode.** Unset → the declared stand-in, unchanged. Set → the same rules as outside.
  - **agy stays legal.** agy, and devin with another model, stay configurable (`REG-D-052`: *"configurable"*). They are
    simply no longer what an unconfigured host gets.
  - *Rejected: defaulting the tool to `devin`.* It would refuse an agy-only host rather than switch it, and would switch
    silently only a host that set `JPWB_ASSURANCE_MODEL` without a tool. It is rejected for symmetry with the executor,
    which refuses an unset tool (`backing-tool.ts:359-369`), and because a tool default is the class `REG-D-052`'s
    reasoning refuses for the model.
- **D3 — One selector.** A new module, `assurance/reviewer-selection.ts`, sits outside `lib/server/tools`, so
  `verif/tool-adapter-exports-reachable.test.ts`'s rule does not reach it.
  - It reads the environment, the mode and the program overrides the adapters captured at load (D7). It answers
    exactly one of: STAND-IN; AGY + model; DEVIN + model; or REFUSED + reason + guidance.
  - `createFloorRegistry`, the authoring preflight and the execution preflight (D5) all read it.
  - This is `REG-F-443`'s recorded remedy (*"through one function both call"*). The `JPWB_ASSESSOR` reads go.
- **D4 — A misconfiguration reaching a floor is RECORDED, never thrown.**
  - On REFUSED, the registry registers a refusing validator with its own id, `reasoning-review.unconfigured`, so a
    refusal is never recorded as agy's work. Its `evaluate` throws the guidance, and `runFloorResults` turns that into
    `VALIDATOR_EXECUTION_FAILED` (`validators.ts:433-440`). The floor fails closed.
  - devin's model is resolved inside `evaluate`, never at build, so `createFloorRegistry` never throws for
    configuration.
  - The mechanism works on both floors: `createFloorRegistry` has two callers, `floor.ts:471` and
    `floor-over-subject.ts:159`, and nothing reads whether the build succeeded.
- **D5 — Preflight before paid work, when the CONFIGURATION is invalid.**
  - **Authoring.** The preflight asks the selector, which closes G4. Its refusal is shown to the operator and not
    recorded, as today (`agent/+server.ts:348-351`).
  - **Execution.** For a MODEL step only (`isModelStep`, `+page.server.ts:1011`), the selector is asked after `:1011`
    and before the dispatch batch at `:1030`. On REFUSED the action returns `fail(400, { error: guidance })` and
    dispatches nothing, so the PWU stays as it was. TRANSFORMATION steps run no reviewer and are never refused. This
    closes G5.
  - **What a preflight cannot see.** A devin that is configured but unusable is discovered at the first review and
    recorded (D4) after the paid work. Unusable means: not on the server's `PATH`, not signed in (inferred, untested),
    or run from an untrusted working directory.
- **D6 — The model devin REPORTS must be the model configured.**
  - **Where the check lives.** In `createAgyReasoningReviewValidator`'s `timed()`, right after the identity override
    (`reasoning-review-validator.ts:495-503`), behind a new option, `requireReportedModel`. Only `createFloorRegistry`'s
    devin branch sets it; `fingerprint.ts` and the qualification `runner.ts` never do.
    - The scoring corpus holds replies reporting other models (`scoring-corpus.ts:143-151`), and their outcomes are
      hashed into the fingerprint. An ungated check would move the fingerprint.
  - **What a mismatch does.** The try is captured before the throw: disposition `rejected`, the reported model graded
    `PROVIDER_REPORTED`, both ids in its detail. There is no repair try. Then the review fails closed, naming both ids.
    PER-9's exchange record is kept.
  - **The guidance.** A mismatch is not fixed by reconfiguring. Its remedy is re-qualification or re-selection.
  - **What is compared.** devin's reported model is its export's last `generation_model` (`devin-reviewer.ts:147-150`),
    the value the record already carries. It was equal to the configured label on 104 of 104 qualification calls.
    When devin reports nothing, the identity stays `HOST_CONFIGURED`, as today.
  - **Disclosed.** The model's VERSION stays unreported for this reviewer.
- **D7 — `REG-F-441`, remedy (a), enforced in the SELECTOR.**
  - The adapters keep reading their overrides at load (`agy-cli.ts:8`, `devin-reviewer.ts:20`, unchanged), so the
    harness test that kills `J22-M10` stands. They export the value they captured.
  - Outside test mode, the selector refuses when the override for the SELECTED tool is defined, even as `''`. A set
    `JPWB_AGY_BIN` does not refuse a devin review.
  - *Remedy (b) rejected:* recording the program's path and hash would keep an override usable in server mode, where
    no product or harness path uses one (critic's search, 2026-09-26).
  - **Residual.** The agy EXECUTOR still honours `JPWB_AGY_BIN` outside test mode. `REG-F-441` closes for the reviewer
    only; the executor half is filed.
- **D8 — The gate never inherits a live-backend selection.** Every test-mode entry point of the gate starts with these
  variables set to `''`: `JPWB_ASSURANCE_TOOL`, `JPWB_ASSURANCE_MODEL`, `JPWB_JUDGE_MODEL`, `JPWB_EXECUTOR`,
  `JPWB_EXECUTOR_MODEL`, `JPWB_AGENT`, `JPWB_DEVIN_BIN`, `JPWB_AGY_BIN`. This follows
  `verif/reviewer-qualification-hermetic.ts`'s prior art.
  - **Why `''` and never `undefined`.** Vitest writes config env into `process.env`, and Node turns `undefined` into
    the string `"undefined"`. Every reader of these variables must therefore treat `''` as unset; the implementer
    verifies each one.
  - **The entry points.**
    - The Playwright webServer env (`playwright.config.ts:57`).
    - The root vitest configs' `test.env`, covering `vitest.config.ts` and `vitest.dist.config.ts`.
    - `apps/rph-demo`'s own `vitest run` under turbo, whose `vite.config.ts` has no `test` block.
  - Tests that set a value in-process for their own arrangement are unchanged.
- **D9 — The documents say what the product does.**
  - **The host documents.** README and `AUTHORING-BACKBONE.md` are rewritten, which closes `REG-F-442`. They cover:
    - the selected configuration and the independence guidance;
    - the working directory devin runs in, which must be trusted;
    - the host-profile precondition (G11: no always-on rules or skills, or disclosed);
    - that agy stays configurable;
    - that the agy executor runs `JPWB_JUDGE_MODEL` (G10).
  - **The rest.** `harness/README.md` and the header comments of `index.ts` and `reasoning-review-validator.ts` are
    corrected.
  - **The live lane.**
    - Its config's REQUIRED list depends on the tool: agy needs `JPWB_JUDGE_MODEL`, devin needs
      `JPWB_ASSURANCE_MODEL`. Its spec takes the expected reviewer model from the same mapping and asserts it against
      the RECORDED reviewer identity.
    - Its stale comments are corrected, and its documents name the selected model as configuration.
    - `REG-F-445` (its two field names) is fixed there or cited.
  - Test timeouts are checked against the reviewer's worst case (below).
- **Kept, and disclosed.**
  - **The recorded ids.** A devin review keeps `validatorId` `agy.reasoning-review` (`reasoning-review-validator.ts:366,
    :604`). The authoring floor's `invokerId` is `agy.reasoning-review` (`floor.ts:526`); the execution floors record
    `reasoning-review` (`floor-over-subject.ts:105`). Renaming would change the meaning of records already written. The
    evaluator identity (`agentId: 'devin'`, the model, `PROVIDER_REPORTED`) says who reviewed.
  - **The prompt budget** stays agy's 26,000 characters, because it is part of the fingerprint.
  - **The time bound** stays 240 s per call. The measured maximum is 181 s on v2 (75 % of the bound) and 88 s on v3. A
    timeout records `VALIDATOR_EXECUTION_FAILED`, and the floor fails closed. Reviewer time per authoring turn can reach
    about 4 × 240 s (initial plus repair, times the refinement pass); the live lane's 600 s test timeout is checked
    against that.

## 4. What must hold

Every instrument below runs HERMETICALLY. `PATH` is the empty `NO_PROGRAMS` directory, and the model variables hold
fixture values only. The devin branch is reached through a new injectable exec seam, `DevinExec`, which mirrors
`AgyExec` (`agy-cli.ts:66-70`) and writes the export file; `createFloorRegistry` accepts it as `devinExec?`. So no test
is one mutant away from a paid devin or agy.

| Instrument | Must show first |
|---|---|
| the selector's full table: mode × tool (unset, `''`, `agy`, `devin`, `pi`, unknown) × model (unset, set) × override (unset, set) | new |
| the registry reaches the devin branch through `devinExec`, with no `print`, and records the devin identity | red today: no seam exists |
| server mode: an unset tool, an unknown tool, `pi`, an unset devin model and a set override each record `VALIDATOR_EXECUTION_FAILED` whose statement NAMES the tool and carries `REG-D-084`'s guidance; `JPWB_JUDGE_MODEL` is unset so nothing can spawn; none throws out of the registry | red today: the statement reads *"JPWB_JUDGE_MODEL is not set, and there is no application default…"* |
| a reported ≠ configured model: exactly one exchange record carrying the reported id, no repair try, the review failed with both ids named | red today |
| the fingerprint with `requireReportedModel` off is unmoved; a mutant setting it in the fingerprint's seams reddens `verif/reviewer-qualification-fingerprint.test.ts` | new |
| the authoring preflight and the registry agree in both directions (`REG-F-443`'s mutant pair); a devin-only host is READY | red today |
| `beginExecute` on a model step with a refused reviewer: the executor is never opened and nothing is dispatched; a TRANSFORMATION step is not refused | red today |
| a child vitest and a child e2e server started with the eight variables EXPORTED still select the stand-in and the fixture executor | red today |
| a set override outside test mode refuses; under the never-honour mutant, the test fails at the seam, never at a real program | new |
| the reviewer fingerprint | `2b6ca158…`, unmoved |
| `reviewer:qual:check`, `gate:fast` with its e2e tail | green |

**Tests rewritten, not deleted**, each with the reason its old expectation no longer holds:
- `preflight.test.ts:28-41` expected READY with no tool outside test mode. That is now refused (D2).
- `preflight.test.ts:49-53` expected a refusal for `JPWB_ASSESSOR=agy` in test mode. The assessor is retired (D3).
- `preflight.test.ts:17` and `:60` pin the refusal code `JUDGE_MODEL_UNCONFIGURED`. The codes now name the refusal.

Any mutant whose anchor moves is re-anchored in the same commit (ledger rule #5).

## 5. The sponsor's question

**Q1 — Should the gate hold the SELECTED reviewer to today's definition?**
- **Today.** Any candidate's RUN, or RESCORED record, under the current fingerprint covers
  (`DESIGN-what-the-tests-prove.md` §5.6 limb 1; Q7 (d) (iii), adopted).
- **The option.** A `SELECTION` line in the qualification record citing `REG-D-084`. For each changed case, the
  covering records must then include one from the selected candidate. A RESCORED record of its run suffices when only
  the scoring moved. This is stricter than Q7 (d) (ii).
- **The cost.**
  - None when only the scoring moved.
  - When what the cases send changes, one devin run over the changed cases: at most 52 calls, 40–77 minutes on the
    measured v3/v2 latencies, plus devin's per-call charge.
- **What it guarantees.** The SELECTED candidate is measured on the current definition. It does not show what a given
  host deploys, or that devin served the model it named.
- *Recommended: yes.* Not built until ruled.

## 6. For sponsor confirmation (`REG-D-085`)

1. The reading of §1: the selection leaves `REG-D-052`'s no-default rule in force.
2. D2: an unconfigured host is refused rather than given agy. This includes the README's documented developer setup,
   which today sets only `JPWB_JUDGE_MODEL`.
3. D6: a substituted model fails the review.
4. D7: a program override outside test mode refuses the review.

## 7. Changes from revision 1

Two critics (a code lens and a rulings lens) raised 0 BLOCKER, 12 + 11 MAJOR and 6 + 8 MINOR findings. Each is
addressed above:
- **Authority.** The delegation source is cited, and `REG-D-085` is marked *to be recorded*. D1 is marked a reading.
- **D2.** Its rejection ground is corrected, and `pi` is refused through the catalog.
- **The exit.** It no longer contradicts D2 (see the roadmap).
- **Placements.** D6 is gated behind an option in the validator; D7 is enforced in the selector; D8 has its mechanism
  and its wider variable list; D5 has its place in `beginExecute`.
- **The tests.** They now assert the refusal MESSAGE and use an exec seam instead of a stub program.
- **New.** The authoring producer, G10, G11 and the time bound.
- **Corrected.** G1's commit, the mutant anchors, and the `invokerId` split.
- **Q1.** Restated: its baseline, cost and guarantee.
