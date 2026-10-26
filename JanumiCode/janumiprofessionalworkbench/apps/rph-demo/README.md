# RPH Demo — SvelteKit workbench

An interactive demonstration workbench for the Janumi Professional Workbench Recursive Professional Harness. It
hosts a seeded RPH engine behind SvelteKit server routes and provides PWA authoring, Undertaking/PWU inspection,
assurance, Decision, and Baseline views.

The [PWA authoring-backbone implementation note](AUTHORING-BACKBONE.md) records the app-local graph, layout,
simulation, and history boundaries. It is explicitly non-normative and does not introduce canonical Janumi
objects, Commands, Events, or runtime decisions.

## What it shows

- A PWA library and a PWA Designer for recursively composed **PWU Types**, permitted-child cardinality,
  input/output hand-offs, and assurance-policy assignments.
- A structural PWA graph rendered with [Svelte Flow](https://svelteflow.dev) (`@xyflow/svelte`) from an app-local
  `@statelyai/graph` representation and ELK layout, with an explicit Dagre fallback.
- Separate composition and data-flow lenses, graph-health feedback, collapsible subtrees, and presentation-only
  canvas controls.
- A derived, non-authoritative PWU work-lifecycle topology that can be explored locally with XState without
  dispatching a Command or persisting simulated state.
- The Reference Undertaking's Professional Work Graph and each concrete PWU Instance's independent state axes:
  work-lifecycle, execution, assurance, and shape-integrity.
- **No green without assurance** (INV-5 / Property P1): a node is green **only** when execution SUCCEEDED *and*
  assurance is SATISFIED. The Mobile/Offline concern executed successfully but is only *conditionally* satisfied,
  so it renders **amber**, not green — execution success never implies assurance.
- Command-driven PWA publication, PWU lifecycle actions, assurance-floor recording, Decisions, waivers, and
  Baselines within the demo host.

## Architecture

This is a SvelteKit client/server demo, not a pure client surface. [`src/lib/server/workbench.ts`](src/lib/server/workbench.ts)
hosts one lazily seeded, process-local RPH engine backed by in-memory SQLite. Server loads query it; form actions and
the PWA authoring broker dispatch real domain Commands; the authoring-agent endpoint streams normalized events over
SSE. The process-local store is suitable for a demonstrator and test harness, not production durability.

The browser receives page data and rebuildable projections. `@janumipwb/rph-projections` supplies graph and
assurance read models; app-local adapters turn PWA/PWU Type structure into `@statelyai/graph`, ELK/Dagre layout, and
Svelte Flow render models. Native Node dependencies such as `better-sqlite3` remain in server-only modules.

The PWA canvas shows reusable PWU Types. Concrete PWU Instance state remains on Undertaking views; it is not painted
onto Type cards. XState is used only for a derived local lifecycle simulation and is not a persistence or execution
authority. Canvas position undo/redo is likewise presentation-only.

## Run

```sh
# From the monorepo root (Bun is pinned by devEngines)
bun install
bun run --filter @janumipwb/rph-demo dev
```

Or, after the root install:

```sh
cd apps/rph-demo
bun run dev
```

Vite serves the development app at the URL it prints (normally `http://localhost:5173`). Use the app-local checks
from `apps/rph-demo`:

```sh
bun run check
bun run test
bun run e2e
```

The development server runs outside test mode, so an authoring turn runs only once a reasoning reviewer is configured,
and a model step only once its executor is configured too. See [The reasoning reviewer](#the-reasoning-reviewer).

The package is a Bun workspace and participates in the monorepo's Turbo tasks through its declared scripts. npm is
not the supported package-manager path for this repository.

## The reasoning reviewer

The mandatory Reasoning Review judges an authoring turn's candidate before it can be committed to the DRAFT, and a
model step's work product before the step can complete. When the authoring agent's run throws before the review, or
the producing model never resolves, no review runs, and the candidate cannot be committed. Outside test mode
(`bun run dev`, or `RPH_DEMO_MODE=server`) no reviewer runs until one is configured: there is no default tool and no
default model (`REG-D-052`). The sponsor's selection (`REG-D-119`) is devin with GLM-5.3 Flash High. That is
configuration you set, not a value the application falls back to. For example, in PowerShell:

```powershell
$env:JPWB_ASSURANCE_TOOL = 'devin'
$env:JPWB_ASSURANCE_MODEL = 'glm-5-3-flash-high'
bun run --filter @janumipwb/rph-demo dev
```

- **Unset or wrong, it is refused before paid work.** These are refused: an unset `JPWB_ASSURANCE_TOOL`, a tool the
  application does not know, `pi` (no reviewer adapter is wired for it), a missing model variable, and a program
  override (below). The tool name is trimmed and then matched exactly, so `Devin` is unknown. A refused authoring turn
  stops before the agent starts, and a refused model step before anything is dispatched. The message names the
  selected configuration. A refusal that reaches an assurance floor anyway is recorded as a failed review
  (`VALIDATOR_EXECUTION_FAILED`, under the validator id `reasoning-review.unconfigured`), and the floor fails closed.
- **agy stays configurable.** Set `JPWB_ASSURANCE_TOOL=agy`, and `JPWB_JUDGE_MODEL` to a label the installed agy
  recognises. agy rejects a label it does not know, and its error output lists the labels it does (`REG-F-331`).
  devin with another model is configurable too.
- **Independence (ASR-13).** Neither the executor nor the authoring agent may run a GLM-5.3 Flash model, under any
  provider or spelling. The executor's model is `JPWB_EXECUTOR_MODEL`, for agy and Pi alike (below). The authoring
  agent's is `JPWB_AGENT_MODEL` when it is set, otherwise Pi's own default
  model, and, when that one does not resolve, the first model Pi has credentials for. The independence check compares
  the model ids the tools report by exact string, so another spelling of the same model would pass it falsely. The
  code cannot detect this; keeping to it is the operator's job.
- **devin's program, sign-in, working directory and profile.** The adapter runs `devin` by name, so devin must be on
  the server process's `PATH`, and it must be signed in (inferred from the design, not tested here). devin runs in the
  server process's working directory: `apps/rph-demo` when the server is started with either command above. devin's
  print mode fails in a directory devin does not trust, and the adapter deliberately does not bypass that check, so
  that directory must be one devin trusts. Making it trusted is devin's own step; this repository does not verify how.
  The preflight checks none of these: a missing program, a signed-out devin or an untrusted directory shows up only at
  the first review, after the paid work it reviews, and that review is recorded as failed. devin also injects its host
  profile's always-on rules and available skills into the reviewer's context (`REG-F-357`). Run it from a profile
  with none, or disclose what the profile carries.
- **devin must answer with the model configured.** devin reports which model answered. If that is not
  `JPWB_ASSURANCE_MODEL`, the review fails closed and names both. Pointing the configuration at the model devin
  served is not the fix: the configured model is the one that was qualified and selected, so re-qualify the model
  devin serves, or re-select the reviewer. When devin reports no model, the configured one is recorded, graded
  `HOST_CONFIGURED`. A substitution is recorded as `VALIDATOR_MODEL_SUBSTITUTED` beside `VALIDATOR_EXECUTION_FAILED`,
  and answered by its own remediation, `REQUALIFY_OR_RESELECT_REVIEWER`: retrying or reconfiguring the same selection
  does not fix it, and the remedy is a sponsor decision. An authoring turn shows that guidance and stays blocked; the
  execution plane names the action (`REG-F-460`, closed by `JAN-SELRES` `RS-2`).
- **Program overrides are for tests.** `JPWB_DEVIN_BIN` and `JPWB_AGY_BIN` replace a program only in test mode.
  Outside it, an override set for the selected reviewer tool refuses the review, and `JPWB_AGY_BIN` set while agy is
  the executor refuses the model step before anything is dispatched, even when the override is empty. An override for
  a tool that is not selected refuses nothing. Each adapter reads its override once, when it loads, so unset it and
  restart the server.
- **The executor.** A model step needs `JPWB_EXECUTOR`, a tool this host has an executor adapter for (`agy` or `pi`),
  and `JPWB_EXECUTOR_MODEL`, the model that tool runs. Neither has a default, and the executor's model never falls back
  to the reviewer's. Outside test mode these are refused before anything is dispatched, with a message that says what
  to set: an unset or unknown tool, `devin` (no executor adapter is wired for it), a missing model, and `JPWB_AGY_BIN`
  set while agy is the executor. In test mode an unset tool selects the deterministic test fixture. For agy,
  `JPWB_EXECUTOR_MODEL` must be a label agy recognises: it is the model agy is asked to run and the model the record
  names, graded `HOST_CONFIGURED` because agy reports none (`REG-F-458` and `REG-F-459` are closed by `JAN-SELRES`
  `RS-1`). Pi resolves its model only when the step opens it, so a model Pi cannot resolve still fails the step after
  it has started. The paid execution lane (`e2e:live-exec`) refuses an agy executor at boot: its spec asserts a
  provider-reported producer, which agy cannot give.
- **The authoring review's allowance.** `JPWB_AUTHORING_REVIEW_ALLOWANCE` gives the authoring floor's review in parts a
  reviewer-call allowance for the server process (`REG-F-580`, design D20). Unset or blank, the default, there is none and
  nothing changes. Set to a whole number of calls, each review round of an authoring turn, the first and the refinement's,
  reserves its worst case before its first reviewer call: its types × 6, the most calls one review makes (the first call, one
  JSON repair and one criterion repair, each run once more after a throw). A round runs only while the worst cases already
  reserved and its own stay within the allowance, so reaching it is allowed. A round that would pass it calls no reviewer:
  each type's review is recorded as one that did not execute (`VALIDATOR_EXECUTION_FAILED`, under the validator id
  `reasoning-review.allowance-stopped`), with the reason (the round's types, its worst case and what is left) and, beside it,
  `VALIDATOR_ALLOWANCE_STOPPED`, and the candidate is staged blocked, not accepted. The floor's guidance and the page's hint
  say no reviewer failed, so retrying or changing the reviewer does not clear it; the round runs once its worst case fits:
  under an allowance that holds it, read when the server starts, or for a candidate with fewer types. A value that is not a
  whole number of calls stops every round that has a type.
  The variable is read once, at the first round, and the reservations are held in memory: restarting the server starts
  afresh. The paid execution lane (`e2e:live-exec`) sets it for a paid half-B run and refuses one exported in the shell.
- **The gate ignores all of this.** The gate's tests and its e2e server start with these variables removed:
  `JPWB_ASSURANCE_TOOL`, `JPWB_ASSURANCE_MODEL`, `JPWB_JUDGE_MODEL`, `JPWB_EXECUTOR`, `JPWB_EXECUTOR_MODEL`,
  `JPWB_AGENT`, `JPWB_DEVIN_BIN` and `JPWB_AGY_BIN`. So exporting the configuration in your shell does not change
  `bun run test` or `bun run e2e`, and the e2e server's reviewer stays the declared test stand-in. The paid live lanes
  (`e2e:live`, `e2e:live-exec`) do inherit them. ⚠ `JPWB_AUTHORING_REVIEW_ALLOWANCE` is not removed: exported in the
  shell, it bounds the gate's authoring floors too, so leave it unset where you run the gate.
