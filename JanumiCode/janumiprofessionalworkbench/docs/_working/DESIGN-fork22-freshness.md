# DESIGN — FORK-22: revision-aware dispatch from the surface

**Authority:** REG-D-025. **Ruling:** JPWB-SPEC-001 §11.4.22 (ratified, REG-D-023).
**Grounding:** 6 agents, measure-then-refute, run before authoring — **and one of its central
claims was false and is corrected in §0.**

---

## 0. The trigger is coherent — and its ratified DEFAULT decides the implementation

FORK-22 item 2 binds the surface to set `expectedRevision` *"on every state-changing Command issued
from a Projection **whose `freshness` is not `FRESH`**."*

**⚠ A GROUNDING AGENT REPORTED THAT `FRESH` IS NOT A MEMBER OF THE ENUM, MAKING THE TRIGGER
UNSATISFIABLE — AND THAT IS FALSE.** I wrote it into an earlier draft of this record and was one step
from filing a corpus-defect finding on it. Verified directly: §2.5.2 *Field contracts — O-5 Affordance
Withholding* defines **`freshness` — `'FRESH' | 'STALE' | 'UNKNOWN'` · required · default
`'UNKNOWN'`**, and the triple occurs three times in the document. **The trigger is perfectly
evaluable.** Recorded here rather than quietly deleted: it is the fourth authored-claim trap of the
week and the first one caught *before* it reached the register, and the only reason it was caught is
that a claim of the form *"the corpus contradicts itself"* now gets checked at the source every time.

**WHAT IS ACTUALLY THE CASE, and it is a different thing entirely.** `freshness` lives on the
`ProjectionEnvelope`, and §5.9 marks that interface **`[UNRATIFIED-AUTHORED]`** with the sentence
*"This interface does not exist."* Zero occurrences of `ProjectionEnvelope`, `freshness` or
`derivedAtSubjectRevision` anywhere in the tree. So the trigger's **input** is unbuilt — not
incoherent, merely absent.

**AND THE RULING'S OWN DEFAULT SETTLES THE IMPLEMENTATION, WITHOUT DEPARTING FROM IT.** The ratified
default is **`UNKNOWN`**, and `UNKNOWN` **is not** `FRESH`. So under the clause as written, a
projection carrying no envelope is in scope by default. **Setting `expectedRevision` on every
state-changing command from the surface is therefore the LITERAL reading of the ruling given the
ratified default — not a strengthening of it, and not a workaround.** It also satisfies **PER-4**
directly (*"updates to existing aggregates declare the revision they believe current"*), and it needs
no freshness model to evaluate, which is what makes it buildable today.

**No corpus defect is filed. There is none here.**

## 1. What the surface does today

**All 28 dispatch sites are last-write-wins.** Measured:

- `StoredObject` carries `revision`, and **both** read helpers discard it one layer up: `ObjectRow` is
  `{ id, state }`, and `getObject` returns `handle.loadObject(id)?.state`. **The revision is dropped
  structurally, below every loader** — so no route could supply it even if it wanted to.
- Nothing rendered carries a revision; nothing round-trips one.
- `uiCommand()` builds a ten-field envelope with no `expectedRevision`.
- The engine's side is already correct: `loadOrReject` honours the field whenever present.

**The engine offers the protection and the surface declines it by omission.**

## 2. What FORK-22 actually obliges — seven modal clauses, not one

The ruling carries **4 SHALL + 2 SHALL NOT across four items**, plus a fifth SHALL in its namespace
note. Item 2 is the only one whose non-satisfaction the ruling admits, and **items 1, 3 and 4 are
unbuilt too.** Item 1 is the half most likely to be dropped: *"**SHALL** continue to render an
Affordance in `A-OFFERED` when the Projection's `freshness` is `STALE`, and **SHALL NOT** transition it
to `A-WITHHELD` on staleness alone."*

**This increment implements item 2 only, and says so.** Items 1/3/4 need the affordance state machine,
which the surface also lacks; bundling them would produce a partial gate wearing a complete name.
Scoped, disclosed, and filed as remaining.

## 3. The build

1. **Stop discarding the revision.** `ObjectRow` gains `revision`; `getObject` returns it alongside
   state. This is the structural fix — everything else is threading.
2. **Capture at load.** The route records the revision it derived from, per subject.
3. **Round-trip it.** A hidden field on the form, so what returns is *what the page was rendered
   from* — not a value re-fetched at submit, which would be the tautology again.
4. **Set it at construction.** `uiCommand()` accepts and sets `expectedRevision`.

**The tautology test this design must survive:** the value must originate from the *earlier* read that
produced the page, and must survive a round-trip through the client. A value fetched server-side
immediately before dispatch would pass every test and protect nothing.

## 4. Verification

**This would be the first `SPEC-001-FX-*` check in the repository** — the namespace has 983
occurrences in one document and **zero in executable code**. There is no FX registry; §10.8 says the
assertion conforms, not the identifier. So:

- **The check is a test, named for its assertion**, not for `FX-FRESH-18`: dispatch from a page
  rendered at revision *r* against a subject now at *r+1* ⇒ `CONFLICT` / `RPH_REVISION_CONFLICT`.
- **The mutant joins the declared ledger** at `scripts/mutants/ledger.ts` (`DECLARED_MUTANTS`, shape
  `{id, file, find, replace, expectRed, why, source}`, `find` must anchor **exactly once**), gated by
  `bun run mutants` and `verif/mutant-ledger.test.ts`. The mutant removes `expectedRevision` from the
  envelope literal, per the ruling.
- **`bun run spec:obligations` cannot see this.** It is latch-excluded from all of §11, so FORK-22's
  obligations are invisible to the one script that looks like their gate. Recorded as a gap; not
  silently relied on.

## 5. What this does not claim

Not FORK-22 complete — item 2 of four. Not protection against concurrent *agents*, which dispatch
outside the surface entirely. Not a freshness model: there is no `ProjectionEnvelope`, no `freshness`,
no `derivedAtSubjectRevision` anywhere in the tree, and this increment introduces none of them —
it carries the one value those shapes would have carried, by the shortest honest route.
