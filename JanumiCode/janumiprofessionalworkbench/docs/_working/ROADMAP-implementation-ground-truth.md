# ROADMAP — implementation ground truth (census + tracker index)

Implements `DESIGN-implementation-ground-truth.md`. Each wave lands with its own gate evidence;
no wave rides another's green. Commits are the sponsor-visible increments.

## W-0 — The substrate, witnessed

`scripts/tracker/{build,check,query}.ts` on **bun:sqlite** (driven fact: better-sqlite3 does not
load under bun; bun:sqlite has FTS5, probed at SQLite 3.53.0). Schema per design §4. `docs/tracking/`
with README + the no-peer-tracker rule. `tracker:build` / `tracker:check` package scripts.
**Witness rule (REG-F-196's lesson):** W-0 is unwitnessed until `tracker:check` can actually FAIL —
its control is a deliberate source-hash mismatch reddening the check, and one verif test asserting
a small invariant population. A check that cannot fail proves nothing.

## W-1 — Ingest the trackers that exist

Parsers per design §8 (register first — BOTH grammars: 293 `###` entries and the 31 REG-E bullets with the REG-E-022 collision rule — reuse `register-status.test.ts`'s proven
`entries()` split, which is fixture-tested prior art). Every source row carries sha256; every
ingested item carries its anchor. **No source document is modified.** Gate: ingested-entry count
cross-checked against the register gate's own count; a disagreement between two independent parsers
of the same file is a finding, not a formatting nit.

## W-2 — The capability census (corpus → roster)

Per design §7: the four already-enumerated populations (COMMANDS map, transitions.data.ts,
m12-conformance.json, seeded policies) are INGESTED with their standing guards as refs; doc-side
lanes cover only what nothing censuses yet — the 102 DOC-002 invariant bullets (⚠ zero INV-* ids
exist; that assumption died in survey), projections/queries, DOC-010 surfaces, event-name deltas.
Output: capability records in `docs/tracking/census/`, each with anchor + source form.
Verdicts land as DECLARED-tier only in this wave — enumeration and verdicting are separate acts,
so an enumeration error and a verdict error can never hide each other.

## W-3 — Verdicts a stub cannot fake

The probe instruments: consumer-walk (HOLLOW detection, the dead-kernel-census method), probe
mutations (OBSERVED — perturb, run named suite, restore; recorded as evidence rows), TESTED via
coverage mapping. Applied census-wide; load-bearing guards promoted to the mutation ledger proper
(their own anchors, their own victims). This wave turns the census from a list into ground truth.

## W-4 — The vertical probe

One real PWA + one Undertaking + a handful of PWUs driven end-to-end through the engine's public
surface (author → instantiate → decompose → execute → assure → baseline). Every step recorded as
DRIVEN evidence; every refusal filed as a finding. Known first blocker, on record: the repository
smoke harness is red and ungated (REG-F-196 Finding 1) — hitting it is the probe working.
Subject may be a thin slice of JanumiCode v3; the deliverable is the gap roster, not the product.

## W-5 — The ratchet

`tracker:check` beside `csaa:inventory:check` in the gate; the register entry recording the
program; BACKLOG.md rewired to point into the roster (items reference record ids rather than
re-describing them); staleness policy (a census verdict older than its subject's last commit is
flagged, not trusted).

## Ordering

W-0 → W-1 → W-2 → W-3 → W-5, with W-4 startable any time after W-2 (its DRIVEN evidence rows just
need the schema). W-3 is the only wave whose green means the census tells the truth; W-5 is the
only wave that makes the truth durable against the next session loss.
