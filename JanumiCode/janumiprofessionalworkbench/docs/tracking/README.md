# docs/tracking — the ground-truth records

**This directory is NOT a new tracker.** It is the committed, plaintext ground truth behind the
implementation-ground-truth INDEX — a gitignored SQLite database (`.tracker/tracker.db`) rebuilt
deterministically from what is committed here plus the existing tracking documents. Authority
stays where it always was: the register is canonical, the sheets are sheets, the backlog is the
backlog. The index rules nothing and records no decision of its own.

Design: `docs/_working/DESIGN-implementation-ground-truth.md` ·
Roadmap: `docs/_working/ROADMAP-implementation-ground-truth.md`

## Layout

- `census/*.ndjson` — append-only journals of capability records and verdict records. **A record
  is never edited.** Corrections are new records that supersede by id (`{"type":"supersede",...}`)
  — the register's strike-don't-delete discipline, in data. The build REFUSES duplicate ids and
  dangling references.

## Commands (bun only — the scripts use `bun:sqlite`, which does not exist under Node)

```
bun run tracker:build    # derive .tracker/tracker.db from committed inputs; prints canonical digest
bun run tracker:check    # DB_MISSING | SOURCE_STALE | DIGEST_MISMATCH | RECORDS_INVALID, or green
bun run tracker:query -- counts | unverified | fts <expr> | item <id>
```

## The laws, and where they are enforced

1. **Append-only** — `scripts/tracker/core.ts` `loadRecords` refuses re-issued ids.
2. **Deterministic** — nothing in the build reads a clock; identical inputs give an identical
   canonical digest (ordered content, not file bytes).
3. **The check can fail, provably** — `verif/tracker-substrate.test.ts` tampers inputs after a
   build and asserts the named refusals. Do not weaken that test to make a red go away.
4. **Session-loss immunity** — everything the index knows is derivable from the committed tree at
   any commit. Nothing about implementation status may live only in session state.
