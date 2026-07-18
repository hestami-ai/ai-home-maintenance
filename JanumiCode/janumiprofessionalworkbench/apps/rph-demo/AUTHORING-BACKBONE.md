# PWA authoring backbone — app-local implementation note

> **Status: non-normative application note.** This file describes implementation boundaries and an incremental
> direction for `apps/rph-demo`. It does not amend the canonical Janumi documents, ratify a domain object, define a
> public Command or Event, select a platform runtime, or authorize a production migration. Where this note and an
> accepted contract, ADR, or controlled document differ, the accepted authority wins.

The governing context for these boundaries is the
[Janumi Canonical Implementation Context — Coding Agent Guide](<../../docs/Janumi Canonical Implementation Context - Coding Agent Guide.md>),
especially its distinctions between PWU Type and PWU Instance, View/Projection and authority, typed Commands and
component state, immutable Events, exact revisions and semantic versions, material AI-output assurance, and the
unresolved contract register. The names used below for prospective steps are neutral implementation language, not
additions to Janumi's canonical vocabulary.

## Scope and runtime boundary

This is an app-local PWA Designer, agent-authoring, and browser-projection increment. Its implemented scope now
includes:

- deriving a structural graph representation from server-provided PWA/PWU Type data;
- laying out and rendering that representation through app-local adapters;
- displaying a derived PWU work-lifecycle topology in a local simulator; and
- maintaining presentation-only canvas interaction history;
- hardening agent authoring against host-id collisions and semantic degradation during recovery;
- preserving composition cardinality and conditional-applicability semantics across scaffold and incremental tools;
- routing assurance execution/configuration failures separately from valid subject findings; and
- providing an in-process foundation for isolated, previewable agent-turn candidates and guarded atomic replay.

It does **not** introduce Temporal, a scheduler, a durable workflow engine, or a second execution authority. The
platform runtime choice remains governed by accepted ADRs and the guide's current safe default (DBOS unless an
accepted Decision replaces it). This demo must not grow a parallel orchestration runtime merely because XState is
used for a browser simulation.

The demo's current server host is also not a production persistence architecture. A single process-local,
SQLite-backed engine is seeded lazily by `src/lib/server/workbench.ts`; SvelteKit loads and actions query it and
dispatch Commands through it. Browser refreshes can reload server state while the process lives, but a process
restart recreates the in-memory workbench. Nothing in this note upgrades that host into a production control plane.

## Authority map

| Concern | App-local mechanism | Authority boundary |
|---|---|---|
| PWA/PWU Type meaning | Contracted objects, fields, relationships, Commands, and accepted Events | Canonical/domain authority remains outside the canvas |
| Structural graph | `@statelyai/graph` intermediate representation derived from PWA/PWU Type data | Rebuildable projection, never independent truth |
| Layout | ELK layered layout profiles, with an explicit Dagre fallback | Presentation only; coordinates do not create meaning |
| Rendering | Svelte Flow nodes, edges, selection, collapse, zoom, and overlays | Browser View only |
| Data-flow lens | Derived matches between `requiredOutputs` and `requiredInputs` | Overlay of authored fields; not a composition edge or layout constraint |
| Lifecycle topology | Projection of the canonical `PWU.workLifecycleState` transition table | Read-only topology; it cannot authorize a transition |
| Lifecycle simulation | Local XState actor compiled from the topology projection | Ephemeral exploration, not PWU execution or persisted state |
| Canvas undo/redo | Position-only graph diffs and inverse patches | Presentation history only |
| Agent-turn candidate | Point-in-time `EngineHandle.fork()` over a snapshot/overlay adapter | Isolated, in-process proposal context; not canonical state and not durable |
| Candidate lifecycle | App-local XState machine plus `@statelyai/graph` inspection/path coverage | Governs the host workflow only; creates no canonical state vocabulary |
| Candidate commit | Base-revision/event-position guard plus one canonical `dispatchBatchGuarded` replay | Reuses accepted Commands and engine authority; no new semantic authority |
| Semantic mutation/rollback | Accepted Commands, exact revision checks, assurance, provenance, and future restore/compensation rules | Not supplied by canvas history, an engine fork, or XState |

## Delivered authoring reliability controls

The following fixes address concrete failures observed during a large natural-language PWA authoring turn:

- `mintUiId` now uses one process-wide monotonic ULID factory in production. The deterministic E2E sequence remains
  separate so tests stay reproducible. The broker also rejects duplicate or already-existing ids during scaffold
  preflight with `ID_COLLISION` before it dispatches any Command.
- `scaffold_graph` remains atomic within its single batch. `link_types` now accepts `M1`, `M+`, `C1`, or `C+` plus an
  optional applicability note, and updating one relationship preserves sibling child rules. An incremental recovery
  therefore has the vocabulary needed to preserve the scaffold's relationship semantics.
- The agent instructions distinguish an id collision from a stale-revision conflict, forbid unchanged retry, and
  require explicit user acceptance before replacing a failed atomic scaffold with semantically or transactionally
  degraded live mutations.
- Assurance remediation uses policy identity, disposition, independence, and observation codes. Only valid
  Reasoning Review subject findings may trigger auto-refinement. `VALIDATOR_EXECUTION_FAILED`,
  `INDEPENDENCE_VIOLATION`, missing results, escalation, and configuration/external failures remain fail-closed and
  produce retry/configure/change-reviewer guidance rather than graph edits or waiver advice.
- Before a host configuration that uses the real reviewer starts an isolated agent candidate, an app-local preflight
  checks that `JPWB_JUDGE_MODEL` is pinned. This preflight does not invoke the reviewer or claim it is healthy; it only
  avoids starting work when the mandatory review is already known to be unexecutable.

These controls improve correctness and recovery behavior. The staged-turn layer below now prevents individual agent
tools from becoming live canonical mutations, but it still does not provide a durable or post-commit reversible
whole-turn transaction.

## Structural graph, layout, and rendering

Svelte Flow is the renderer, not the PWA model. The intended adapter path is:

```text
server-provided PWA/PWU Type state
  -> app-local @statelyai/graph structural representation
  -> ELK layout profile (or explicit Dagre fallback)
  -> Svelte Flow render nodes and edges
```

The structural representation contains only information needed to project the authored graph. It is serializable
and rebuildable. It does not become a new repository, aggregate, Event stream, or semantic graph authority.

The layout adapter supports presentation profiles such as a top-to-bottom composition-tree lens and a
left-to-right phase-map lens. A profile changes coordinates and routing, not PWA meaning. Node position, rank,
proximity, selection, collapse, zoom, and viewport state must never be interpreted as:

- parent/child composition;
- prerequisite or temporal order;
- permission or authority;
- PWU readiness, execution, assurance, or completion; or
- evidence that an authored graph is valid.

Only typed authored relationships and fields establish those meanings. Composition edges alone participate in the
base layout. The optional data-flow overlay is added after layout from matching artifact names in
`requiredOutputs` and `requiredInputs`; it must not pull nodes into a different rank or silently turn a hand-off into
composition. Layout failure may fall back to Dagre without changing semantic content.

## PWU Types are not PWU Instances

The PWA Designer canvas displays reusable **PWU Types** and type-level rules. It does not display the actual state
of a concrete PWU Instance owned by an Undertaking. Consequently, the PWA Type card must not be painted with a
concrete instance's work-lifecycle, execution, assurance, or shape-integrity state.

A Type card may display type-level facts such as root/leaf treatment, permitted-child cardinality, declared
inputs/outputs, and assigned assurance policies. Those declarations are not proof that any concrete Assessment ran
or passed. Concrete PWU Instance state belongs in an Undertaking/Professional Work Graph projection with the exact
instance and version identity.

## Derived lifecycle topology and local simulation

`packages/rph-projections` derives a JSON-safe topology from the canonical `PWU.workLifecycleState` machine. The
projection preserves declared states, initial/terminal markers, transitions, and explanatory trigger/guard prose.
Every projected transition explicitly records that a real transition still requires an authoritative Command.

The app may compile this projection into an XState machine for bounded browser exploration. That actor:

- starts from the topology's declared initial state;
- accepts projection-local `SIMULATE.PWU.*` event names;
- shows structurally possible paths; and
- labels guard prose as an authoritative check that was **not** evaluated.

The actor does not inspect a concrete PWU Instance, evaluate current eligibility, authorize an action, dispatch a
Command, emit a canonical Event, persist a snapshot, execute an Execution Plan, or mutate professional state.
`SIMULATE.PWU.*` names are browser-local inputs, not additions to the Command/Event vocabulary.

This is not persisted `PwuBehavior` authoring. No ratified `PwuBehavior` object, aggregate ownership, schema,
Command/Event surface, or supersession contract is introduced here. If such a capability is later required, its
authority and wire contract must be decided before the application stores it or claims it governs execution.

## Canvas history is presentation-only

The canvas can record a completed node move (pointer drag or accessible arrow-key move) as a position diff and use
an inverted diff for local undo. Redo reapplies the corresponding position patch. This history is bounded, cleared
by a new layout, and may be discarded on navigation without changing the PWA. Assurance-policy content scrolls
inside the fixed layout box so keyboard scrolling does not masquerade as node movement.

Canvas undo/redo therefore does **not**:

- reverse `DefinePwuType`, `EditPwuType`, `RemovePwuType`, or any other Command;
- delete or rewrite a domain Event;
- restore a tombstoned PWU Type;
- reuse a prior idempotency key;
- undo an authoring-agent turn; or
- restore an older aggregate revision or semantic version.

The controls and accessibility labels should say “Undo canvas move” and “Redo canvas move,” not unqualified
“Undo” and “Redo.”

## Pre-commit discard is implemented; semantic undo remains gated

Deleting a semantic node and moving a rendered card are different operations. Likewise, a broker `sessionId` that
names command IDs is not, by itself, a durable authoring session or a reversible transaction. The app-local staged
turn described below can discard an **uncommitted** overlay without compensation and can atomically replay a guarded
candidate. That is pre-commit isolation, not post-commit undo. The demo must not market semantic delete undo,
post-commit whole-turn rollback, or durable authoring recovery until accepted contracts cover all of the following:

1. **Revision discipline.** Reads expose the relevant aggregate revisions; proposed edits carry accepted
   `expectedRevision` semantics; a cross-aggregate operation has a ratified version-vector contract rather than
   silently applying against whatever is current.
2. **Restore versus compensation.** The domain defines when a tombstoned draft object may be restored, when a new
   successor is required, and when only a compensating Command is legal. Historical Events and prior approvals are
   never deleted or rewritten.
3. **Durable staging and preview.** Proposed edits are isolated from canonical state, survive/reconcile restart as
   required, and produce an exact candidate preview and diff. Abort, disconnect, or a rejected proposal cannot leave
   a half-applied turn. The current overlay provides isolation and an app-local preview, but it is intentionally
   process-local and does not satisfy the durability limb.
4. **Atomic guarded commit.** The complete proposal is revalidated against current authority, DRAFT status,
   revisions, graph invariants, and idempotency, then state, versions, Events, receipts, and outbox effects commit
   atomically or not at all.
5. **Assurance binding.** Every material AI/agent-produced candidate remains provisional until the mandatory
   Reasoning Review and other applicable controls are durably bound to the exact subject/version. A changed candidate
   invalidates a stale review; a rollback is itself a new recorded transformation, not resurrection of old assurance.
6. **Provenance and audit.** Actor, model/provider/version, tool inputs/results, rationale, limitations, candidate
   identity, correlation/causation, accepted/rejected disposition, Commands, and resulting Events remain inspectable
   without storing private chain-of-thought.
7. **Conflict and impact handling.** Intervening edits, downstream references, publication, policy bindings, and
   affected assurance are detected. The system rejects or reconciles conflicts instead of forcing last-write-wins.

These requirements need a coordinated contract, persistence, application, projection, UI, and conformance-test
slice. An app-local convenience must not invent public `Restore`, `Undo`, change-set, or version-vector Commands to
make the controls appear complete.

The current increment supplies useful implementation evidence for revision capture, candidate isolation, conflict
detection, and atomic batch replay. It does **not** settle restore-versus-compensation, durable change-set identity,
restart recovery, downstream impact reconciliation, or post-commit reversal.

## App-local staged agent-turn foundation

The staging foundation uses the existing engine and accepted authoring Commands rather than creating a second
authority:

```text
canonical EngineHandle
  -> point-in-time EngineHandle.fork()
  -> SnapshotOverlayStorageAdapter
  -> normal broker + normal Command handlers against the isolated candidate
  -> validation and assurance over that candidate
  -> base-revision-vector recheck
  -> one canonical dispatchBatchGuarded replay, or no canonical mutation
```

`SnapshotOverlayStorageAdapter` consults the canonical adapter only while the fork's base snapshot is constructed.
Candidate objects, Events, receipts, and outbox effects then live only in the overlay. Its transaction checkpoint
preserves all-or-nothing behavior inside the candidate, and closing or discarding it never deletes or rewrites
canonical Events.

The staged-turn layer records only accepted top-level Commands; a rejected command and every Command in a rolled-back
batch are excluded from replay. A complete PWA/PWU-Type subject hash binds assurance to the semantic candidate. The
candidate hash then binds the base revision/event position, accepted Command sequence, affected aggregate content
hashes, and assured subject hash. Accepted mutation invalidates cached bindings, and mutation is closed after the
turn reaches commit readiness. Before commit, the app recomputes both hashes and requires the caller to supply the
exact candidate hash it accepted. This is a technical preview-token check, not a ratified human approval protocol.

The commit path compares a conservative base revision vector, PWU-Type and policy revisions, new-target absence, and
the captured event-log position against canonical state. Those guards, replay, and expected resultant aggregate
content hashes execute inside one `dispatchBatchGuarded` transaction, closing the check-versus-commit race and
detecting replay divergence. A guard or command-level revision mismatch enters `CONFLICTED`; Command rejection,
postcondition divergence, or an exception enters `COMMIT_FAILED`, with the canonical batch rolled back.

XState models the app-local lifecycle:

```text
COLLECTING -> VALIDATING -> ASSURING -> READY_TO_COMMIT -> COMMITTING -> COMMITTED

VALIDATING -> REVISION_REQUIRED
ASSURING   -> REVISION_REQUIRED | BLOCKED_EXTERNAL
COMMITTING -> CONFLICTED | COMMIT_FAILED

Any pre-commit working state may also end as DISCARDED where the machine declares that transition.
```

The companion serializable `@statelyai/graph` representation is checked for structural issues and path reachability;
`xstate/graph` generates executable machine-state coverage. These state names belong to this host workflow. They are
not canonical Janumi objects, Commands, Events, dispositions, or additions to the controlled vocabulary.

The staged preview must identify itself as non-authoritative and must never be consumed as an approved fact. It may
show lifecycle status, candidate hash, Command count, and the candidate graph while canonical state remains
unchanged. `READY_TO_COMMIT` means that the app-local validation/assurance path reached commit eligibility; it does
**not** claim that a general human accept/revise protocol or a ratified approval authority has been implemented. The
guarded commit API's exact-hash argument prevents committing a different preview; it does not, by itself, establish
who is authorized to accept or how that acceptance becomes a durable governed record.

Valid reviewer subject findings may revise the isolated candidate and create a new candidate hash. External reviewer
execution, configuration, or independence failures enter `BLOCKED_EXTERNAL` instead of mutating the graph.

### Explicit limits of this foundation

- The active-turn registry and overlay are **in-process and non-durable**. Process restart loses the candidate; this
  is not restart-safe staging or a production authoring-session store.
- Pre-commit discard needs no compensating Command because canonical state was never changed. After a successful
  commit, however, this layer provides **no semantic undo or redo**, restore, successor creation, or compensation.
- There is no claim that tombstoned PWU Types can be restored, that published/version-bound state can be rewound, or
  that prior assurance/approval can be resurrected.
- The revision vector and candidate lifecycle are app-local implementation structures, not ratified public objects or
  wire contracts.
- The captured event-log position is deliberately conservative: any unrelated canonical Event in the process causes
  the candidate commit to conflict. Narrower multi-PWA concurrency requires a ratified/scoped dependency-vector rule;
  this demo chooses a safe false conflict rather than an undetected new-aggregate race.
- The canonical engine remains authoritative. Candidate commit reuses its typed Commands, handlers, invariants,
  idempotency, Events, and transaction boundary; the fork, XState, `@statelyai/graph`, and Svelte Flow do not acquire
  domain authority.
- Temporal remains outside this UI-level solution. No scheduler, durable workflow runtime, or replacement execution
  authority is introduced.

## Verification expectations

Changes within this app-local backbone should keep deterministic tests for:

- structural graph conversion and ELK/Dagre fallback equivalence of semantic nodes/edges;
- proof that the data-flow overlay does not participate in composition layout;
- type-versus-instance rendering separation;
- exact lifecycle-topology derivation from the canonical machine;
- XState simulation isolation (no Command dispatch or persistence);
- position-only undo/redo; and
- negative assertions that layout, simulation, and canvas history cannot mutate canonical engine state.

The authoring reliability and staged-turn slice additionally keeps tests for:

- production-like same-millisecond ULID bursts and large full-SDLC scaffolds;
- broker collision preflight with zero Command dispatch;
- scaffold/incremental cardinality and applicability-note equivalence;
- recovery instructions that refuse unchanged collision retry and silent atomicity/semantic degradation;
- code-based assurance routing and reviewer-configuration preflight;
- point-in-time fork isolation and overlay transaction rollback;
- XState lifecycle and `@statelyai/graph`/`xstate/graph` reachability;
- subject/candidate hashing, revision/event-position conflict detection, replay postconditions, and atomic canonical
  replay; and
- staged preview/discard behavior with canonical state unchanged before commit.

Further work still needs restart/durable-session, multi-process concurrency, exact assurance/provenance rebinding,
downstream impact, tombstone restore-versus-successor/compensation, and post-commit reversal tests before any durable
semantic undo/redo or rollback capability claim is made.
