# ROADMAP — JAN-REGINT: the register's append-only rule gets an instrument

**Design:** `DESIGN-register-append-only.md` · **Date opened:** 2026-08-27

---

## Why this programme exists

The rule at `JPWB-REG-005:19` — *"Entries are never destructively edited"* — has been in force since
`REG-D-010` ratified the register on 2026-07-24 and **has never had an instrument.** 26 in-place rewrites
of live entry text were confirmed across 71 adjudicated commits, the first landing nine days after
ratification. Nothing reddened.

**This is the `check-the-instrument-itself` shape.** The register is the artifact every other gate cites as
authority; its own governing constraint was the one thing nothing measured.

---

## R-1 — The gate ✅ **DONE 2026-08-27**

`verif/register-append-only.test.ts` — an entry-scoped unigram word-count contract against the register at
a pinned commit, with the whole-file count absolving a word that merely relocated.

**Driven, not predicted — all four legs:**

| leg | result |
|---|---|
| baseline control (>1MB, contains the rule, >250 entries parsed) | GREEN |
| **the forbidden act** — `REG-F-049`'s live line rewritten in place, **on disk** | **RED**, naming `REG-F-049: lost ["COMPLETE","at","audit","corrected","design","record","register","the","was"]` |
| **the sanctioned act** — the same line retired by `~~strike~~` plus an appended replacement | **GREEN** |
| fail-closed when git cannot establish the baseline | **DRIVEN** — it fired on the first run, on a real path bug (`git show <rev>:<path>` resolves from the repo root; this package is a subdirectory) |

**⚠ The green leg is the one that makes this a control rather than a tripwire.** A gate that reddens on
every edit looks exercised while proving only that it reacts to change. MUTANT B is what shows it tells the
forbidden act from the permitted one.

**No grandfather list was needed** — the baseline pins the *current* state, so the 26 historical violations
are already absorbed and the gate guards forward only. That is the one respect in which it is simpler than
`register-status.test.ts`, which had to grandfather 63 entries by id.

---

## R-2 — The superseding entry correcting `REG-F-273`'s REASON, not its rule — ✅ **DONE 2026-08-27**

`REG-F-273` argues that mutable-bookkeeping citations create *"claims with an expiry date in an artifact
whose changeProcedure forbids correcting them in place."* **Read as a description of the artifact, that is
false.** The entry must be superseded in one clause, quoting the superseded text verbatim so the keyword
probe for it cannot fail, and restating the reason as the measured one:

> **the register corrects its status lines in place and its substance never.**

The keystone evidence is `REG-F-273`'s *own* cited example — `REG-F-072`, whose `Status:` line was rewritten
in place **twice on 2026-08-08**, by commits one of which authored the census figures still false at HEAD
nineteen days later.

**The drafting rule is re-affirmed unchanged.** Its premise falls; its remedy is strengthened.

---

## R-3 — `REG-F-272`'s undated claim, and widening the rule's SCOPE — ✅ **DONE 2026-08-27**

`REG-F-272:25182` repeats `REG-F-040`'s finding that *"no heading in this register has ever been struck"*.
**Three headings were struck on 2026-08-10, thirteen days before that entry was written.** `REG-F-040` was
right in 2026-08-06; the defect is the undated repetition of a claim about a mutable property.

**`REG-F-273` generalised `REG-F-272` while hunting exactly this defect and missed the instance inside the
entry it was generalising.** The rule's scope must widen from *"a sibling row's census bookkeeping"* to
**"any claim about a mutable property of an artifact, including this register itself."**

---

## R-4 — The 26, annotated rather than swept — ✅ **DONE 2026-08-27 (REG-F-277), IN A DIFFERENT FORM**

Rewriting 26 entries to restore them would be a large unreviewed edit to the audit record — the argument
`register-status.test.ts` already accepted. **Append** a one-line pointer to each affected bullet naming the
commit that rewrote it and the text it removed.

**Prioritised by truth at removal**, which splits them into three acts:

1. **Removed text still TRUE AND LIVE — four, needing their content restated:** `c61d92cf` (a live
   fourteen-document obligation), `fb5d7cbd` (`REG-F-033`'s standing ratchet), `5fd041f3` (a named-site
   remedy prescription), `574cc1e6` (a still-true verdict on `REG-F-024`).
✅ ~~**`70e4f33b` needs a correcting entry regardless of restoration** — a sentence still standing at~~ **FILED 2026-08-28 as `REG-F-282`.** — a sentence still standing at `:560`
   claims a prescription *"is kept unstruck because it was right"* while the same commit deleted half of it.
   **That sentence is false about the register's own history.**
3. **The remainder** removed a claim the removing commit had itself just falsified: annotation only.

**⚠ `git log -S` is the wrong instrument for this sweep** and would hide the keystone: the `REG-F-072`
double rewrite retained the phrase whose occurrence count `-S` watches, so it returns only one of the two
commits. Only the diffs show it.

---

## R-5 — Bigram strengthening — ✅ **CLOSED 2026-08-27 (REG-F-280): REFUTED BY MEASUREMENT**

---

## ✅ R-6 — `REG-F-273`'s own six pointers — **DONE 2026-08-28 (`REG-F-281`), IN A THIRD FORM**

`REG-F-273` had stood MERGED-as-to-the-rule / OPEN-as-to-its-own-closure since the merge. **All six pointers
are applied and it now closes.**

⚠ **Its closure condition said "the six sites" and listed FIVE.** The sixth — `REG-F-272:25141-25145`, its
*"the tenth is not `NEAR_MISS`"* clause — was recovered from the supersedes clause, not the list.

⚠ **NEITHER KNOWN FORM WAS RIGHT, so a third was measured.** Form A (a new line in the bullet) shifts
citations; form B (the appendix, R-4's remedy) does not reach the reader at the bullet, which is the exact
cost `REG-F-273` wrote its condition to avoid. **Form C — extend the bullet's existing LAST LINE — satisfies
the condition literally and adds no line.** Driven: 26,090 lines before and after, and the set of differing
indices is exactly the six targets with every other line byte-identical at the same index.

**The green is a measurement:** the positive control is the same six clauses deleted outright, which reddens
the gate naming all five entries. Two constraints travel with the form — the extended line must carry no
`Status:` token, and neither may the pointer, because `scripts/tracker/ingest.ts:109` captures a status to
END OF LINE. The applier refuses both, and both refusals are exercised by their own controls.

**Disclosed cost:** git scores form C as 6 added / 6 deleted rather than 6 pure additions — a
history-legibility cost, not a content one.

⚠ **Two orchestrator figures were corrected downward:** the "117 citations move under form A" estimate could
not be reproduced (an independent extractor returned 223 minimum, so the published figure is a **range,
117–223, with the extraction rule as its splitter**), and "14 of 17 verifiable citations move" is **13**.

The gate's known hole: a rewrite that deletes a word and re-adds the same word **elsewhere within the same
entry** passes. Bigram counts would close it. **It was not measured, so it is not claimed** — and it is
recorded here rather than in the gate's comments so that the gate never appears stronger than it is.

---

## ✅ The inherited open item is CLOSED

**`REG-F-273`'s drafting rule now has a home:** `JPWB-DOC-004 §10 item 8` (artifact version 1.4.0), merged
under the sponsor's authorization. **The append-only argument turned out NOT to be dispositive** — an
inserted bullet removes nothing, so REG-005 §1 was never foreclosed by it. What decided it is that
**both sides of the boundary already agree**: `JPWB-DOC-004:17` `governs:` claims *"drafting standards for
any normative text the agent itself authors"*, and `JPWB-REG-005:14` `doesNotGovern` cedes agent conduct to
DOC-004. A §1 bullet also could not carry `REG-F-275`'s widened scope, which reaches invariant comments and
ADRs, not just entries.

⚠ **It is item 8 APPENDED, not inserted at its topical place after item 5** — §10 ordinals are cited from
three live sites, one of them inside the append-only register at `:1374`. **Renumbering would falsify a live
citation in an artifact that cannot correct it — the exact defect class item 8 exists to stop, committed in
the act of merging it.**

⚠ **Item 8 ships UNENFORCED, and that is stated rather than hidden.** Nothing in `verif/` reads
JPWB-DOC-004 §10 — measured with a control: the 7 `DOC-004` hits in `verif/` are all the *RPH-corpus*
DOC-004, a different artifact with §20/§31/§32 sections JPWB-DOC-004 does not have. Items 1–7 are equally
unenforced; item 8 is no worse and no better.

## ✅ R-7 — the two remaining corpus merges — **DONE 2026-08-28**

**`JPWB-DOC-004` is now v1.5.0**, carrying two new §10 items, appended after item 8 and never renumbered.

- **Item 9 — re-derive a figure at the point of writing** (from `REG-F-278`). ⚠ It merged as a NEW item
  rather than an amendment to item 8, on a distinction worth keeping: **item 8's remedy cannot detect this
  defect.** Item 8 discharges a load-bearing mutable value by *dating the reading* — and dating a figure
  that was already false when measured yields **a dated false figure wearing the appearance of a checked
  one**. Item 8 guards DECAY; item 9 guards TRANSCRIPTION. They are independently violable.
- **Item 10 — an annotation never moves the lines it annotates** (from `REG-F-277`, refined by `REG-F-281`),
  with both travelling constraints from `scripts/tracker/ingest.ts:109`.

**Not §9, and the reason was measured rather than preferred.** §9's `governs:` bullet confines it to
JPWB-REG-005, while the rules' trigger fires on any artifact cited by line — under-scoping is the defect
`REG-F-275` had already corrected once. The artifact also already runs traffic **§9 → §10** (`:322` routes
out to item 8), and the §9 form would have shifted 22 lines where the §10 append shifts 2.

⚠ **The ordinal-citation count in the brief was low by ~7×.** It said "at least three live sites"; the
derived answer is **23 live sites across 5 files** — eleven of them inside the append-only register, and
seven live rows in the CSAA Requirement Ledger pinning `§10 item 1`…`item 7`. Renumbering was never
available.

---

## ⚠ R-8 — forty stale status claims, RECORDED not swept (`REG-F-284`) — **OPEN**

Three independent derivations plus adjudication found **40 stale clauses across 37 entries**, where a
hand-pass had found 3 — and **all three of those were mine, from the last two days.** The oldest has stood
since **2026-07-16**.

⚠ **Four were already ruled MERGED by this register's own `### Closure sweep — 2026-07-24` (`:162`)** and
still read `DECIDED — MERGE PENDING` at HEAD. `REG-F-095` swept the same class on 2026-08-09 by grepping a
**literal phrase**, struck `REG-D-001..007`, and stopped — the four survivors use different wording.

**Five were repaired; 28 were not, and the difference is measured cost.** A strike inserts a line; the five
sit below every citation target in the file, so their repair moves nothing. The other 28 are scattered from
`:55` and would shift thousands of targets — which is `§10 item 10`, merged the same day.

**What would close the class is an instrument** — ✅ **BUILT 2026-08-28 (`REG-F-285`):**
`verif/register-status-truth.test.ts`, 783 lines, 9 tests.

⚠ **It caught 8, not the 9 this roadmap estimated** — and the estimate was nearly right for the wrong
reason. The crude graph behind it returned **nine hits of which only two were actually stale** (one matched
*"blocked"* inside *"UNBLOCKED"*); the shipped gate returns **eight true with none false**. The ninth,
`REG-Q-052`, the graph correctly cannot have: its Stage A notation **narrows** the question rather than
discharging it. **A figure nearly right by accident is the hardest kind to catch.**

⚠ **The winning design was corrected by its own adjudicator on a half-quoted sentence** — two of three
extra findings are refuted by the second half of the sentence quoted. One (`REG-F-087`) would have demanded
a repair the register forbids in terms. The extractor was corrected, not the findings suppressed: guards
derived from **§1's own status tokens, not a phrase list**, at a cost of 3 edges of 56 and zero findings lost.

**The discriminating control is the point:** an appended entry is GREEN; a discharge pair whose target
**cites** its discharger is GREEN; the same pair with the target silent is **RED**. One clause apart.

⚠ **And the gate's guard-control grew on the day it shipped — from the entry announcing it.** `REG-F-285`
says it discharges *"`REG-F-284`'s Repository leg"*, and the possessive guard drops that edge. **The entry
that describes the guard also trips it**, because a partial discharge is naturally written as a possessive.
The control pins the dropped set **by name, not by count**, which is why this read as a decision rather than
a regression.

---

## Superseded open item

**`REG-F-273`'s drafting rule still has no home.** Its merge target is `JPWB-DOC-004` (agent conduct) or
this register's §1 entry discipline, **whichever the sponsor prefers.** R-2 and R-3 both amend that rule,
so all three should merge together once the target is chosen. **This is a sponsor decision and is not taken
here.**

---

## What is not in scope

- **The 26 are not re-opened as findings.** Each entry's own substance stands; what is recorded is that
  text was removed without a superseding record.
- **`REG-F-273`'s numerator of eight is untouched** — not re-derived, not endorsed, not re-opened.
- **No rate is published.** The candidate population is a range (103–163) across two splitters, and 26/71 is
  a floor over a sample that was not randomly drawn.
