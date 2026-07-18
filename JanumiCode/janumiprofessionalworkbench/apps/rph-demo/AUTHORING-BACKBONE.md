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

This increment is a PWA Designer and browser-projection increment. Its scope is deliberately limited to:

- deriving a structural graph representation from server-provided PWA/PWU Type data;
- laying out and rendering that representation through app-local adapters;
- displaying a derived PWU work-lifecycle topology in a local simulator; and
- maintaining presentation-only canvas interaction history.

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
| Semantic mutation/rollback | Future accepted Commands, revision checks, durable staging, assurance, and provenance | Deliberately not supplied by canvas history or XState |

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

## Semantic undo and whole-agent-turn rollback remain gated

Deleting a semantic node and moving a rendered card are different operations. Likewise, a broker `sessionId` that
names command IDs is not a durable authoring session or a reversible transaction. The demo must not market semantic
delete undo or whole-agent-turn rollback until accepted contracts cover all of the following:

1. **Revision discipline.** Reads expose the relevant aggregate revisions; proposed edits carry accepted
   `expectedRevision` semantics; a cross-aggregate operation has a ratified version-vector contract rather than
   silently applying against whatever is current.
2. **Restore versus compensation.** The domain defines when a tombstoned draft object may be restored, when a new
   successor is required, and when only a compensating Command is legal. Historical Events and prior approvals are
   never deleted or rewritten.
3. **Durable staging and preview.** Proposed edits are isolated from canonical state, survive/reconcile restart as
   required, and produce an exact candidate preview and diff. Abort, disconnect, or a rejected proposal cannot leave
   a half-applied turn.
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

## Proposed preview-first agent lifecycle

The following is a conceptual target for investigation. The labels are intentionally lowercase and neutral; they
do not name canonical objects, states, Commands, or Events:

```text
read current state and capture base versions
  -> collect proposed edits in an isolated working context
  -> build a candidate graph and human-readable diff
  -> run deterministic validation over that exact candidate
  -> obtain required independent review for the exact material output
  -> ask the human to accept, revise, or discard
  -> recheck current versions and authority
  -> atomically apply the accepted candidate, or leave canonical state unchanged
  -> record provenance and refresh rebuildable projections
```

The preview must identify itself as non-authoritative and must never be consumed as an approved fact. Agent text
must distinguish “proposed in preview,” “accepted and applied,” “rejected/conflicted,” and “assurance incomplete.”
Auto-refinement, if retained, operates on the isolated candidate and causes a new exact review subject; it does not
quietly mutate canonical state between reviews.

This is not the demo's current authoring behavior. Today, accepted agent tool calls dispatch through the broker as
they land, and the multi-node scaffold tool is atomic only within that one tool call. Most mutation tools change the
current DRAFT, but `create_assurance_policy` is an explicit wider-scope exception: it creates a shared workbench
library entry, requires explicit user authorization in the agent prompt, and has no session undo. Implementing the
conceptual flow above requires the ratified boundaries listed in the previous section.

## Verification expectations

Changes within this app-local backbone should keep deterministic tests for:

- structural graph conversion and ELK/Dagre fallback equivalence of semantic nodes/edges;
- proof that the data-flow overlay does not participate in composition layout;
- type-versus-instance rendering separation;
- exact lifecycle-topology derivation from the canonical machine;
- XState simulation isolation (no Command dispatch or persistence);
- position-only undo/redo; and
- negative assertions that layout, simulation, and canvas history cannot mutate canonical engine state.

Future semantic staging or rollback work additionally needs concurrency-conflict, atomicity, restart, assurance,
provenance, tombstone restoration/compensation, and agent-abort tests before any capability claim is made.
