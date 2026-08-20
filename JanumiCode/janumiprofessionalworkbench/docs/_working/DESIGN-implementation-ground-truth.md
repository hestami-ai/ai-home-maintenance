# DESIGN — implementation ground truth: the capability census and the tracker index

## 1. The problem, stated from this repository's own record

Three facts, each with a filed precedent:

1. **Session data is not durable and was never ground truth.** The arrows-session transcript loss
   showed status must never live in session state.
2. **Claimed-complete is not implemented.** The harmonization program found **74% of the kernel dead
   in production**; REG-F-001 found the seeded governed layer hollow; REG-F-096 found the evidence
   guard "never bites." A code scan cannot distinguish these from real work.
3. **There are many trackers, of various vintages, and no way to enforce one.** Surveyed 2026-08-20:
   the register (canonical: 293 `###` entries + 31 REG-E bullets, 277 commits, machine-read by THREE
   verif gates), the Roadmap-and-Tracker (LIVE and GATED — `verif/tracker-deferrals.test.ts`, whose
   own header records that before it existed "NOTHING READ THE TRACKER AT ALL"), two Ratify Sheets,
   a Conferral Sheet (dormant, "confers nothing"), BACKLOG (most-live), OPEN-QUESTIONS (frozen
   2026-07-12 yet cited from production code comments), RESUME-STATE (fossil), and the audit/census
   artifacts. Creating tracker N+1 adds fuel to the fire (sponsor's observation, 2026-08-20).

And the decisive fourth fact, from `verif/register-status.test.ts:4-7`: asked "how many entries are
open?", two reasonable regexes gave two different answers — *"a reader's regex cannot be audited —
the register IS the audit record."* Every cross-tracker question today is an unauditable ad-hoc
regex.

## 2. The decision: an INDEX, not a peer

A SQLite database, built by a deterministic script as a **derived, rebuildable index over the
existing trackers plus the new capability census**. It is not a new tracker:

- **Authority stays exactly where it is.** The register stays canonical; sheets stay sheets; the
  backlog stays the backlog. The DB rules nothing and records no decision of its own.
- **Its only native content is the census** (capability records + verdicts) — ground no existing
  tracker covers.
- **It answers the questions no single tracker can:** what is OPEN across all trackers; which
  claimed capabilities have no evidence above DECLARED; what references REG-F-100; which audit
  roster items lack dispositions; what did we say about X.

**Why SQLite, and which driver — DRIVEN, NOT ASSUMED.** The obvious choice (better-sqlite3, the
rph-persistence stack) is **wrong for scripts**: it is a Node NAPI addon and does not load under
`bun <script>` at all (`ERR_DLOPEN_FAILED`, "not yet supported in Bun" — probed 2026-08-20; the
engine's tests only work because vitest runs on Node). The tracker instead uses **`bun:sqlite`** —
Bun's built-in driver: zero new dependencies, the repo's canonical runtime, and its bundled SQLite
(3.53.0, probed) **has FTS5**. The relational shape (items × verdicts × evidence × refs) is exactly
the structure whose absence made REG-F-120's "21 findings" evaporate into a count. rph-persistence
keeps better-sqlite3; the two never share a connection or a file.

## 3. Durability architecture — the proven rebuild/gate pattern, applied to tracking

The committed ground truth is **plaintext in git**; the DB is disposable. The pattern already
exists twice in this repo (`csaa:inventory --write/--check`; the arrow-census baseline diffed by
its test) and is copied, not invented:

```
docs/tracking/
  README.md                 — what this is, how to rebuild, the no-peer-tracker rule
  census/*.ndjson           — capability records + verdict records (append-only journals)
scripts/tracker/
  build.ts                  — deterministic: parse sources → build tracker.db (gitignored)
  check.ts                  — rebuild + digest-compare + source-hash freshness
  query.ts                  — CLI: canned queries + FTS
```

- **Append-only NDJSON records.** A record is never edited; corrections are new records that
  supersede by id — the register's strike-don't-delete discipline, in data. Diff-friendly,
  merge-friendly, immune to the CRLF/binary-edit hazards this repo has recorded.
- **The DB file is gitignored.** `tracker:build` derives it; `tracker:check` fails when a source
  changed without a rebuild (source rows carry sha256).
- **Session-loss immunity is total:** everything the index knows is derivable from the committed
  tree at any commit.

## 4. Schema (first cut)

```sql
sources(path, sha256, parser, ingested_at)
items(id, kind, name, anchor_doc, anchor_text, origin, created_at, superseded_by)
verdicts(item_id, verdict, evidence, method, measured_at)     -- append-only; view latest_verdict
refs(from_id, to_id, kind)                                    -- REG↔capability↔test↔commit edges
-- FTS5: items_fts(name, anchor_text, entry_text)             -- lexical, in-box
-- OPTIONAL, pluggable, NOT gate-load-bearing: item_embeddings(item_id, model, vec)
```

`kind` starts closed: `register-entry | sheet-row | tracker-row | backlog-item |
audit-roster-item | capability | schema | mutant | question`. Verdict vocabulary is §5's ladder
plus the REG-F-197 set. **Semantic layer:** designed-for, not depended-on — the embeddings table
is optional, populated by a separate opt-in step (sqlite-vec or equivalent); no gate or build step
requires a model. FTS5 covers recall today; adding semantics later is a data migration, not a
schema redesign.

## 5. The evidence ladder (verdicts a stub cannot climb)

| tier | meaning | stub-fakeable? |
|---|---|---|
| DECLARED | the name exists in code | yes — the stub currency |
| TESTED | a test exercises it | yes — tests can assert on stubs (REG-F-096) |
| OBSERVED | perturbing it reddens a named test | no |
| DRIVEN | an end-to-end scenario exercises it through the real engine surface | no |
| HOLLOW | exists; consumed by nothing on any production path | the REG-F-001 verdict |

OBSERVED at scale = probe mutations (perturb, run, restore — recorded as evidence rows, not ledger
entries); only load-bearing guards get promoted to the mutation ledger proper.

## 6. Consumers from day one — the anti-hollow clause

A tracker nothing reads is the hollow-layer finding re-committed. Day-one consumers, minimal and
real: (1) `tracker:check` wired beside `csaa:inventory:check`; (2) `tracker:query` CLI with canned
queries (open-by-tracker, unverified-claims, roster-without-disposition); (3) one verif test that
builds the DB and asserts a small invariant population — the gate that notices the index dying.

## 7. Census population rules — from the 2026-08-20 corpus survey (Lane C)

**Governing rule: REUSE THE ENUMERABLE THAT ALREADY EXISTS.** For four populations the
authoritative enumeration is already code/data with a standing census — the DB **ingests** those
artifacts; re-deriving them from prose would be duplication with a divergence risk:

| population | authoritative enumerable (ingest) | existing guard (refs) |
|---|---|---|
| Commands | `COMMANDS` map, 84 types (`rph-contracts/src/messages.ts`) | `verif/command-dispatch-census.test.ts` |
| State machines/arrows | `transitions.data.ts` (27 machines, generated from `vocab/m2-transitions.json`) | arrow census chain (`verif/arrow-command-census.*`) |
| Conformance rules | `vocab/m12-conformance.json` (ruleCatalog 125, P1–P8, mutationCatalog 9) | `enforcement-register.ts` (3-way disposition, 112/125 over 15 families, family list as gated data) |
| Policies | seeded policy objects | `doc004-conformance.test.ts` (reads ratified DOC-004 **at runtime**; a paraphrase fails CI) + `doc003-carriage.test.ts` |

Doc-side markers are for the populations **nothing censuses yet** (each with its marker, per the
survey, anchors verified):

- **Invariants — ⚠ the corpus has ZERO `INV-*` ids** (a prior assumption of this design, killed by
  the survey). DOC-002 carries **102 prose bullets** under 14 `## X.Y … invariants` headings;
  DOC-004 §39 is an ordinal list 1–20; DOC-007 §35 has 8 numbered subsections; the **numbered
  successors live in canon**: JPWB-DOC-003's 62 `**FAM-N · Title.**` invariants (ASR 19, PER 12,
  STA 8, OBJ 7, DEC 6, REL 4, LYR 3, AUT 2, AGG 1; legacy INV-5 → STA-2).
- **Projections/queries**: DOC-002 §32 (5 `## 32.N` headings) + §34.5 (14 `get*` names in a text
  fence) + DOC-007 §26 (3).
- **UX surfaces**: DOC-010 §4.1–4.8 (8 named surfaces) + §5 navigation tree; partial guard:
  `route-action-census.test.ts` + the playwright suite.
- **Event names**: DOC-002 §26 (96 bare PascalCase lines) vs DOC-007 §33 (24 first-slice) —
  partially guarded by `event-surface-census.test.ts`.

**Namespace trap, recorded:** `POL-001..025` in `JAN-ENG-POL-GIT-001` are the *git* policy — a
naive `POL-*` grep conflates two unrelated populations. RPH-DOC-* maps 000–010 per the corpus
README ("do not extend the sequence").

## 8. Ingest parser table — from the 2026-08-20 surveys (Lanes A+B)

| source | grammar | clean-ingest rate | tolerant rules needed |
|---|---|---|---|
| Register `###` entries (293) | `^### (~~)?REG-[A-Z]-\d+ —` — 100% mechanical, em-dash uniform | headers 100%; date+type 84% direct | strip inline code spans BEFORE matching (REG-F-113 lesson, already in the gate's parser); allow `~~` header prefix (3 struck); section-default inheritance recovers all 47 missing Date/Type (two "All Section B/C entries:" lines); `**Raised:**` variant (REG-F-196) |
| Register REG-E bullets (31) | **a second grammar**: `- **REG-E-NNN** —` bullets, amendments as sibling bullets | high | ⚠ REG-E-022 is a TRUE duplicate-id collision (two entries, two sections) — disambiguate by section context; E ids are also defined in the Ratify Sheet (the citations gate exempts E for exactly this reason) |
| Status lines | one live `**Status:**` line per entry | 78.5% (230/293) | 63 grandfathered ids (shrink-only list, asserted both directions by the gate); Status VALUES 75.5% enum-prefixed, rest free prose — ingest raw + optional normalized column; same for Type (~80 distinct values, 61% enum-adjacent) |
| Cross-refs | `\bREG-[DFQE]-\d+\b` | near-closed graph: 1,728 mentions, 326 distinct, only 2 undefined (F-115 deliberate hole; F-998 test fixture) | none — ideal `refs` seed |
| Roadmap Tracker (16 rows) | §6 pipe table + emoji legend + `DISCHARGED:`/`RESIDUE:` cell markers | high | reuse `tracker-deferrals.test.ts` parse |
| Ratify Sheet R1 (29+ rows) | pipe tables + 72 `☐` + `~~…~~ — AMENDED <date> (REG-D-nnn)` | high | ⚠ **checkbox state does NOT encode ratification** — R1 was executed wholesale-interim (REG-D-010) with every ☐ unmarked; ingest dispositions from amendment annotations, never from checkboxes |
| M0 sheet / Conferral sheet | numbered pipe tables / 12×4 `☐` rows | high | fossil-as-record; conferral sheet "confers nothing" — ingest as questions, not states |
| BACKLOG / audit artifacts | checkbox bullets keyed by REG ids / verdict tables | high | strike-in-place retirement convention |
| OPEN-QUESTIONS / RESUME-STATE | mixed prose+headings, frozen | partial | ingest headings+ids only; both are fossils (but OPEN-QUESTIONS is cited from production code comments — ingest so those refs resolve) |

**Prior-art parsers to reuse, not reimplement:** `register-status.test.ts` `entries()` (split,
strike-tolerant, code-span-stripping, fixture-tested), `register-citations.test.ts` `definedIds()`
(over ALL `docs/canon/*.md` — E ids live outside the register), `tracker-deferrals.test.ts` (the
tracker-row parser), plus `verif/absence-claims.test.ts` (the third register gate). The register's
YAML front matter is itself parseable metadata.

## 9. What this deliberately does not do

No tracker is retired or migrated; no markdown source is rewritten; the register's gates are
untouched; embeddings are optional; the DB never appears in a commit. The census is the only new
authored content, and it lands as roster records — the REG-F-120 lesson is structural here: a
count without a roster cannot exist in this schema.
