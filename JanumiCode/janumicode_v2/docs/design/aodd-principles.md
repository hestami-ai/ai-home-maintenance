# AODD Principles — janumicode v2

**Status**: Approved 2026-05-26. Companion design memo at `aodd-design.md`.
**Date**: 2026-05-26.
**Scope**: Internal engineering infrastructure for v2. Not a product surface (yet).

---

## Purpose

This document defines the principles governing the AI Observability-Driven Development (AODD) layer of janumicode v2. AODD is parallel observability infrastructure built alongside the v2 application to enable AI coding agents to reliably finish building, debug, and maintain v2 itself.

The audience for the AODD trace is **AI coding agents working on v2**. Whether AODD later becomes a user-facing product capability is a separate decision and out of scope here.

## Why AODD

v2 is built primarily by AI coding agents. Agents cannot reliably diagnose, fix, or extend a system whose behavior they cannot reconstruct. Today's observability surface — `transforms.jsonl`, `lifecycle.ndjson`, per-invocation `live/*.log` files, audit markers, and several smaller streams — exists in de minimis form: fragmented across five record formats, inconsistent stable identifiers, ephemeral channels that vanish on background runs, and history-shaped records co-mingled with production state in the SQLite database.

The bottleneck is fragmentation, not absence of data. Agents pay context-window cost on archaeology instead of fixing the bug, and when reconstruction fails they confabulate.

## Architectural boundary

| Layer | Purpose | Lifetime | Source of truth for |
|---|---|---|---|
| **Production state (SQLite DB)** | What the system *is* — current world model used by the orchestrator | Permanent | "What is true now" |
| **AODD trace** | What the system *did* — append-only evidence of how state came to be | TTL-bounded; aged out per retention policy | "What happened during the retention window" |
| **EventBus** | In-app reactive coordination (orchestrator ↔ webview etc.) | In-memory, per-process | Application wiring |

The DB does not change as part of AODD work. The AODD trace is a **parallel** layer, not a refactor of the DB. EventBus is not AODD; their concerns and lifetimes differ.

AODD is **not a backup** of the DB. It cannot reconstruct production state outside its retention window. Replayability is for diagnosing what happened within a still-traced run, not for recovery.

---

## Principles

### 1. The trace is the primary AODD surface

Agents debugging v2 read the trace, not the DB. The DB's accidental usefulness for debugging is a symptom of inadequate AODD, not a feature to preserve. Diagnostic questions that today require joining DB tables, JSONL streams, and per-invocation log files must be answerable from the trace alone.

### 2. One coherent event model

A single canonical trace event schema. A single emitter seam. A single set of standardized identifier names (`run_id`, `phase_id`, `sub_phase_id`, `invocation_id`, `step_id`, `parent_step_id`) with one stringification convention used across every event.

NDJSON is the canonical on-disk form. Existing surfaces like `live/*.log` and audit markers either become projections of the trace or specialized indices over it.

The five record formats coexisting today (NDJSON, JSONL, JSON files, plain text, SQLite-as-history) collapse to one structured stream plus its derived views.

### 3. Capture verbosity supports fine-grained debugging

When in doubt about capture detail, capture more. AODD's design constraint is reconstructability for diagnosis, not minimal volume. Volume is managed at the boundary through retention policy and projection, never by pruning at write time.

### 4. Events are self-describing

Each event carries enough metadata to be reasoned about in isolation: timestamps, all relevant IDs, parent reference, prompt-template SHA (when applicable), model and parameters, schema version, references to upstream events.

An agent reading any single event can chain backward without consulting the DB.

### 5. Sub-phase summaries are emitted at write time

At every sub-phase exit, the trace produces a summary artifact that aggregates inputs consumed, records produced, decisions made, validator findings, retries, escalations, and lifecycle deltas. This is the agent's entry point into a run.

A summary is complete if and only if it answers, from its own contents plus the trace events it references:

- **Who** — model, role, agent identity, invocation chain
- **What** — records produced, decisions made, validator findings
- **Why** — governing constraints in effect, prompt template (with source SHA) and rendered prompt
- **How** — process: retries, repairs, escalations, fallbacks taken
- **When** — wall-clock timestamps and ordering relative to siblings

If a summary cannot answer one of these, it is incomplete and the producing code is buggy.

### 6. Logger is AODD; EventBus is not

`src/lib/logging/logger.ts` becomes an AODD primary capture surface alongside structured trace events. Its existing ephemeral handlers (stdout, VS Code Output Channel) remain available but are no longer the *only* destination — log records also flow into the AODD trace.

`src/lib/events/eventBus.ts` remains in-app coordination infrastructure. AODD does **not** subscribe to it. When a code-site emits an EventBus event that is also diagnostically valuable (e.g., `agent:reasoning_step`, `mirror:presented`, `decision:resolved`), the same call-site emits a corresponding AODD trace event. Two independent emitters; one shared call-site.

This keeps the architectural boundary clean: EventBus can be refactored without breaking AODD, and AODD can be refactored without rewiring application reactivity.

### 7. Trace completeness is a regression test

Golden fixtures freeze not only product outputs but also the answer to: "given this trace alone, can a downstream consumer reconstruct what happened?" A refactor that breaks reconstructability — even if product outputs are unchanged — fails the test.

### 8. File-first, TTL-bounded, debugging-not-recovery

NDJSON streams on disk are the canonical AODD record. The trace is not a DB backup, does not feed back into the DB, and is not retained indefinitely. Retention is governed by an explicit policy (TTL and/or run-count cap). Aging out a trace must not impair production state.

---

## Out of scope

- DB schema changes
- EventBus refactor
- Product-facing observability surfaces (webview AODD UI, customer-facing trace export, etc.)
- Migration of historical runs to the new model
- Replacement of the in-application logger for non-AODD purposes

---

## Open design questions

Deferred to the design memo (`aodd-design.md`):

1. **Event schema** — exact field set, type system, schema versioning strategy.
2. **Stream layout** — how many NDJSON files per run, how partitioned (by phase? by event class?), where on disk.
3. **ID normalization** — chosen string form for `phase_id` (`"1"` vs `"phase1"` vs `"phase01"`) and migration path for existing streams during cutover.
4. **Summary artifact format** — JSON, Markdown, or both; file naming; placement relative to its parent run.
5. **Dual-emit mechanics** — helper API at the call-site, performance considerations, ordering guarantees vs EventBus.
6. **Logger integration** — how Logger handlers extend to emit AODD trace events without breaking existing console/output-channel behavior; level filtering policy.
7. **Retention policy** — TTL value, run-count cap, archival vs deletion, opt-out for runs an operator wants kept indefinitely.
8. **Replay surface** — read API for agents (CLI, slash command, library function), summary indexing, query patterns.
9. **Trace-completeness fixtures** — format and location of golden trace fixtures; how the regression test asserts reconstructability.
10. **Orphan stream policy** — disposition of today's orphaned diagnostic islands (`.tmp/acceptance-raw-*.txt`, bakeoff results, prompt-probe output, calibration review logs): adopt into AODD, link to AODD, or leave untouched.

---

## Acceptance criteria for the AODD layer

These principles are considered satisfied in implementation when:

- An AI coding agent, given a v2 run's trace alone (no DB access), can correctly answer the 5W+H questions for any sub-phase in that run.
- A prompt-template edit can be assessed against golden traces and a behavioral regression caught without manually inspecting `transforms.jsonl`.
- A background v2 run produces no diagnostically-relevant data that is lost to stdout, stderr, or in-memory channels.

The design memo and implementation work derive from these principles, not the other way around. If implementation reveals a principle is wrong, the principle is revised here first.
