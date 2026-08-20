# DESIGN — the shape-survivorship audit (REG-D-008; REG-F-180 P2; Ratify Sheet Part 4 precondition 2)

**Framing.** Post-REG-D-034 this audit verifies **authority transfer**, not retirement: the source
corpora are SOURCE OF RECORD, and REG-D-008's rule — shape authority belongs to *reference
artifacts*, the implementation is the experiment and cannot self-certify — makes this audit the
transfer verification (REG-D-009's SPEC-lifecycle clause names it exactly that). Per REG-F-180:
the question outlives the reversed act; the obligation does not bind.

**Scope, stated so a partial audit cannot read as complete.** Exactly the six documents REG-D-008
names foremost: RPH-DOC-000 (Product Architecture & Canonical Vocabulary Charter), RPH-DOC-002
(Canonical Domain Model, Invariant Catalog, State Machines, Event Contract), RPH-DOC-004
(Assurance Policy Catalog & Validator Contract), RPH-DOC-007 (Command, Event, Schema Contract
Package), RPH-DOC-008 (Executable Invariant & Conformance Test Specification), RPH-DOC-009
(Persistence, Migration, Dual-Run, Cutover Design). RPH-DOC-003 is P1's ground (REG-F-183) and is
NOT re-audited here. This audit claims nothing about any other document.

**Population rule (derive, never enumerate by hand).** A lane's population is every RATIFIED
SCHEMA in its document: a field-level shape presented normatively — field tables, fenced
TypeScript/JSON shape blocks, enumerated state machines with transitions, event payload
definitions, error catalogs with shapes. Each lane reports the RULE it used (which structural
markers) and the resulting count, so the enumeration is checkable. Prose obligations without a
shape are out of scope (they are SPEC-tier ground, not schema ground).

**Verdict vocabulary, one per schema:**
- `ENFORCED` — a repository reference artifact exists (real type / zod schema / generated
  contract), a conformance fixture or test would redden on divergence, and the implementation
  conforms. Name the artifact AND the test.
- `REFERENCE_NO_FIXTURE` — a real type exists; nothing tests conformance against the source shape.
- `PLACEHOLDER` — an artifact exists but is vacuous (`any`/`unknown`/empty interface/`Partial`
  escape) — the REG-F-005 failure shape (criterion `{id,statement,mandatory}` vs the ratified
  eight-field shape slid through exactly this way).
- `DIVERGENT_FILED` — implementation diverges and a register entry records it (cite it).
- `DIVERGENT_UNFILED` — diverges with no filed finding. This is itself a finding to file.
- `ABSENT` — no repository artifact carries the shape.

**Method rules, inherited from this register's own failures:**
1. Anchor TEXT, never line numbers (REG-F-183 closed its caveat this way and found REG-Q-045's
   off-by-one doing it).
2. Every absence claim searched BOTH directions with a POSITIVE CONTROL, and stated as a claim
   about the search (P-3).
3. Search CONTENT, not field names — REG-F-183's first pass would have filed eleven false absences
   from phrase-searching what was carried structurally.
4. "Losslessly" asks WHERE content landed, not just whether: structured-and-gated beats
   prose-in-a-string; a schema carried in prose is `REFERENCE_NO_FIXTURE` at best.
5. Citation normativity: before citing any governing document, check it is still the governing one
   (the REG-E-019 lesson, twice in one day).

**Output.** Per-document verdict tables with citations → one register entry (next REG-F number)
recording the audit, its scope, its per-lane enumeration rules, and the actionable residue
(`DIVERGENT_UNFILED`/`PLACEHOLDER`/`ABSENT` items become named findings or a remediation
increment). BACKLOG.md updated. REG-F-183's remedy increment (the 36 prose-carried items) is a
SEPARATE increment and is not bundled here — the register's own rule against riding on another
increment's green.
