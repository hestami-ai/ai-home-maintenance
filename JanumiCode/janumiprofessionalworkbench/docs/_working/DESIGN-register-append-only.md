# DESIGN — the register's append-only rule has never had an instrument

**Status:** DRAFT · **Date:** 2026-08-27 · **Programme:** JAN-REGINT
**Supersedes in part:** one clause of one bullet of `REG-F-273` (its stated REASON, not its rule)

---

## 1. The finding in one paragraph

`JPWB-REG-005`'s own front matter (`:19`) says **"Entries are never destructively edited; a correction is
a superseding entry citing the entry it supersedes."** That rule has never been gated. Over the register's
200-commit mainline history, between **103 and 163 removed lines** (the range is derivation-dependent —
§3) are absent from the file at HEAD. Of 71 commits adjudicated by five readers and five adversarial
verifiers, **26 are confirmed in-place rewrites** of live entry text. They cluster almost entirely on the
two most load-bearing fields an open entry has: **`Status:` and `Merge target:`**.

> **⚠ CORRECTED 2026-08-27, AND THE CORRECTION IS THE MORE INTERESTING FACT.** This paragraph first said
> the practice ran *"from 2026-08-02 ... to 2026-08-21"*, carried from the analysis agent's synthesis.
> **It is wrong.** All 26 confirmed edits fall between **2026-08-02 and 2026-08-10** — author and committer
> dates both, all 26 hashes resolved. The synthesis had conflated the CANDIDATE range with the CONFIRMED
> range: `29b14912` (2026-08-21) is a candidate and is **not** among the 26.
>
> **And the sample did not merely thin.** Nine candidate commits from 2026-08-17, 08-20 and 08-21 were
> adjudicated, and **none was destructive**. So the practice is a **NINE-DAY BURST THAT STOPPED** — opening
> nine days after `REG-D-010` ratified the register on 2026-07-24, closing 2026-08-10 — not the standing
> habit the first draft described.
>
> **A hypothesis, offered as one and not as a finding:** `REG-F-040` (2026-08-06) is titled *"WHY THIS IS AN
> ENTRY AND NOT AN EDIT"* — the register diagnosing the practice on itself, four days before the last
> instance. **It was not tested and no causal claim is made.**
>
> ⚠ **"STOPPED" IS BOUNDED BY WHAT COULD BE SAMPLED.** The candidate population is derived (§2), and a
> destructive edit whose exact words happen to recur elsewhere never becomes a candidate at all. So **no
> destructive edit was FOUND after 2026-08-10**, which is not the same as none having occurred.
>
> **This raises the gate's value rather than lowering it.** The practice stopped by informal means, with
> nothing enforcing it and nothing able to report a relapse. §7 is what makes the stop durable.

The sanctioned idiom exists and is genuinely used — `~~struck~~` text plus an appended replacement, as at
`:57`. **It is the exception, not the rule:** 9 lines carry a struck `~~**Status:**` against 445 carrying
`Status:` (measured directly, this session). Four of the 26 commits apply the strike correctly *in the same
hunk* as a violation, so this is **selective application, not ignorance of the idiom.**

---

## 2. ⚠ Why counting git deletions is counting the wrong thing

The strike idiom rewrites a line to wrap it in `~~ ~~` and append. **Git scores that `-1/+1`; nothing is
lost.** Any instrument that counts diff deletions counts compliant corrections as violations. The first
measurement this session did exactly that and reported *"127 commits destructively edited the register"* —
which was wrong, and was caught only by reading `:57` and recognising the idiom.

The correct question is **content survival**, not line churn. Three filters, in order:

1. discard a removed line whose `~~`- and whitespace-normalised text reappears among the same commit's
   **added** lines (the strike, or a rewrap) — this removed 60 of 166;
2. discard it if the text is still present **at HEAD** (moved, not lost) — 3 more;
3. what remains is a **candidate**, and a candidate is not a violation.

---

## 3. ⚠ There is no single number, and publishing one would repeat a defect this register already recorded

`REG-F-272` (`:25136`) states the standing rule verbatim: *"No exact partition is asserted here; an entry
that needs one must re-derive it and publish its splitter."* **Two independent splitters move this
population**, and both were measured rather than assumed:

- **TRAVERSAL** — whether a branch-side authoring commit is counted at its author or collapsed into the
  merge that carried it. `--no-merges` walks 298 commits; `-m --first-parent` walks 200. Evidenced in the
  data: `7db0fda7` ("Correct 'eight arrows' to fifteen") is branch-side, so the two traversals attribute
  its edit to different commits.
- **LINE ELIGIBILITY AND SURVIVAL** — minimum line length, normalisation, and whether survival is tested
  per-commit or against the whole file. This moves the count **as much as the traversal does.**

Three defensible derivations give **103, 106, 130, 131 and 163**. The published figure is therefore a
**RANGE: 103–163 candidate removed lines**, and no member of it is "the" number.

**The adjudicated quantity is different and much smaller: 26 confirmed of 71 commits read — and it is a
FLOOR, not a total.** The readers answered about the candidate lines they were handed rather than each
commit's full register diff, so `fb5d7cbd` rewrote four entry lines rather than the three reported,
`29b14912` five rather than two, and `d4be2574` was graded *"nothing removed"* while in fact deleting
`REG-F-020`'s Status line. **That batching defect was mine**, and the gate instrument (§7) reddens on all
three, which is how the floor is known to be real rather than asserted.

---

## 4. ⚠⚠ The keystone: `REG-F-273`'s own cited example refutes its stated reason

`REG-F-273` (filed 2026-08-26) names **`REG-F-072:2255`** as proof that a stale claim sits uncorrectable in
an append-only artifact. Its census figures — `UNENFORCED 44 · ARROW_UNREACHABLE 22 · ENFORCED 14 ·
REDUNDANT_WITH_MACHINE 2` — are false at HEAD against `verif/guard-enforcement-ledger.test.ts:59-62`, which
pins **42 / 20 / 18 / 2**. Three of four numbers are wrong.

**That entry's `Merge target:` / `Status:` line was destructively rewritten in place TWICE on 2026-08-08**
— by `8cfc341b`, then by `174047b8`. **And `174047b8` is the commit that authored the stale census figures
in the same hunk.** *(Verified directly this session: both diffs opened, both `-`/`+` pairs read, the
surviving line read at `:2255`, and the test read at its lines.)*

> **The register rewrote that entry's BOOKKEEPING twice in one day and left its SUBSTANCE to rot for
> nineteen days and counting.** The correction mechanism was available, was used twice on that exact line,
> and still did not reach the claim.

`REG-F-273`'s **harm is real; only its stated cause is wrong.**

---

## 5. What this does to `REG-F-273` — the premise falls, the remedy is strengthened

Read **normatively**, its clause is simply true: the rule does say entries are never destructively edited.
Read as a **description of the artifact** — which is what makes the harm bite — it is **false**.

The remedy survives on three grounds:

1. **The in-place edits do not reach the stale claims.** §4 is the proof, and it is `REG-F-273`'s own
   example.
2. **A reader at a given commit still sees the stale claim.** An audit record is read at revisions, not
   only at HEAD; in-place correction does nothing for any reader before it.
3. **The in-place edits are themselves the defect and cannot be relied on.** A remedy repaired by pointing
   at them would license the 26 — including `c61d92cf`, which erased a live fourteen-document obligation,
   and `fb5d7cbd`, which erased a standing ratchet still true when deleted.

**The correct repair is a superseding entry restating the reason as the measured one:** *the register
corrects its status lines in place and its substance never.* That is a sharper finding than the one filed,
not a softer one — which is the direction a re-reading of one's own entry should be held to.

---

## 6. ⚠ And the same defect is in `REG-F-272`, undated, and `REG-F-273` walked past it

`REG-F-272:25182` — written 2026-08-23 — states that `REG-F-040` found **"no heading in this register has
ever been struck."** Three headings were struck on **2026-08-10**: `REG-F-105` (`:3055`), `REG-F-106`
(`:3090`), `REG-F-108` (`:3142`). **The claim was false by thirteen days when it was repeated.**

`REG-F-040` was right when it wrote that on 2026-08-06. What went wrong is the **repetition of a claim
about a mutable property, in the present perfect, undated.**

> **THE GENERAL FORM — and it is why `REG-F-273`'s rule is right but its SCOPE is too narrow.** That rule
> names *census bookkeeping*. This is not census bookkeeping; it is a **finding about the register's own
> state**, which is exactly as mutable. `REG-F-273` generalised `REG-F-272` while looking for precisely
> this defect **and did not find the instance inside the entry it was generalising.**

The rule's third limb — *"where the claim is load-bearing, DATE IT"* — would have caught this. The scope
must widen from "a sibling row's bookkeeping" to **"any claim about a mutable property of an artifact,
including this register itself."**

---

## 7. The gate

`verif/register-append-only.test.ts` plus a pinned `register-append-only.baseline.json`.

**Design: an entry-scoped unigram word-count contract.** Split the register on `/^### /m`, key each block
by its `REG-[A-Z]-\d+` id (tolerating a struck `~~REG-…~~` heading), strip `~~` markers, tokenise, and
build a per-entry word-count plus a whole-file word-count.

**What reddens it.** For every entry id in the baseline: RED if the id is absent from the current file, or
if any word's count **within that entry** has fallen below baseline **AND** that word's count in the
**whole file** has also fallen. The two-level test is load-bearing: the entry level catches the deletion,
the file level absolves a word merely relocated — which is what makes reflow, line-splitting and
cross-entry moves free. **Appends are unconditionally free; there is no upper line bound.**

**⚠ Why not the two obvious alternatives — rejected by measurement, not by argument.**

| design | false negatives | behaviour on compliant strikes |
|---|---|---|
| history assertion over git deletions | 0 / 11 | flags **6 of 9** — a word changed inside a strike breaks subsequence |
| n-gram shingle contract (n=3,5,8) | — | flags **12 of 12** — re-wrapping destroys every n-gram |
| **entry-scoped unigram counts** | **0 / 18** | **1 false positive of 12** |

The unigram design is the only one of the three that separates a violation from a strike. Its single false
positive is `6f947ed4`'s `*Default:*` → `*Default as filed:*` relabel — one token.

**The mutants.** ⚠ A control needs its own predicted red *and* a predicted green; this programme has
shipped three controls that could not fail.

- **MUTANT A (the forbidden act)** — rewrite `REG-F-049`'s live line in place as
  `- **Merge target:** This register. **Status:** **CLOSED**.` — the shape `c61d92cf` performed.
  **MUST RED.**
- **MUTANT B (the sanctioned act)** — wrap that same line in `~~ ~~` and append a replacement status.
  **MUST STAY GREEN.** Without B, a gate that reddens on every edit would look exercised while proving
  nothing.
- **Identity control** — file against itself. **MUST BE GREEN.**

**⚠ CARRIED, NOT RE-DRIVEN.** The mutant results, the 0/18 and 1/12 figures, and the two rejected designs
were measured by the analysis agent and are **recorded here as its measurements.** They are not re-driven
in this document. **They must be re-driven when the gate is implemented**, and the implementation is not
complete until they are — a recorded remedy is a hypothesis about code that does not exist yet.

**⚠ AND THE FIRST VERSION OF THIS GATE ERODED TOWARD A FALSE NEGATIVE — CAUGHT BY ITS OWN AUTHOR'S APPEND.**
The whole-file count was meant to absolve RELOCATION. It cannot tell *"this word moved to another entry"*
from *"this word was independently written somewhere else later"*. Appending `REG-F-274..276` (185 lines)
raised the global counts of `the`, `at`, `was`, `register`, `audit`, `corrected`, `COMPLETE` and `record`,
and **MUTANT A's detection collapsed from NINE words to ONE** (`design`, 153 → 152 file-wide).
**For an append-only artifact, "erodes with every append" means erodes always.**

The fix: the elsewhere-count is taken over **entries PRESENT IN THE BASELINE**, not the whole file. A
brand-new entry cannot absolve a deletion from an old one; a genuine cross-entry move still can.
Re-measured after the change — **MUTANT A back to all nine words, MUTANT B still green, identity green.**

> **This is the reason the mutants are driven on every run rather than recorded once.** A gate whose
> strength depends on the rest of the file will pass its own author's review on the day it is written and
> silently weaken afterwards, and nothing but a re-driven mutant says so.

**Coverage limit, stated as a limit and not a claim:** a rewrite that deletes a word and re-adds the same
word elsewhere *within the same entry*, or inside another entry that existed at the baseline, passes.

> **⚠ MEASURED 2026-08-27 (REG-F-280) — BIGRAM IS REFUTED, NOT DEFERRED.** It closes the hole (the
> scrambled-re-add evasion reddens, where unigram flags nothing) and is refuted on cost by the control this
> gate exists to pass: **MUTANT B, the sanctioned `~~strike~~`, REDDENS** under both tokenizations tried.
> Also **7 of 11** real adjudicated compliant strikes, and **14 of 30** post-burst commits in which *not a
> single word was lost*. On real history the gain is **zero** — 26/26 detected either way.
>
> **The mechanism is the register's own shape:** a strike destroys the bigrams at *both edges* of the struck
> span, and an entry ending in a `Merge target:`/`Status:` trailer makes every in-entry append an insertion
> that severs a pair at the junction — so **a bare append reddens**, destroying the one property that makes
> this gate survivable here. No tokenization passes B, D and E; the obvious repair reopens the hole and is
> "the unigram gate with extra steps".
>
> **Next to measure is not n=3 but an insertion-tolerant order check** (LCS over the entry's token stream),
> which would pass the strike, the re-wrap and the append while still failing the evasion. **Not measured,
> not claimed.**

> **⚠ AND THE MUTANTS NOW DERIVE THEIR OWN TARGET, AFTER TWO HARD-CODED ONES WENT STALE IN ONE DAY.** V1
> asserted a word COUNT and V2 a hard-coded commit hash; the §8 annotations re-supplied both **into the very
> entry that lost them**, collapsing the forbidden-act mutant from nine words to one and then to zero. The
> mutant now derives a token occurring EXACTLY ONCE in the register, inside a baseline entry, and **fails
> loudly if none exists** rather than passing vacuously.

---

## 8. The 26 are not swept

Restoring 26 entries by rewriting them would be a large unreviewed edit to the audit record — **the same
argument `verif/register-status.test.ts` already accepted when it grandfathered 63 entries by id** (`:74`),
by id rather than by count, with a shrink-only ratchet so a repair must be removed from the list
deliberately. This gate takes the same shape.

Instead, **append** a one-line pointer naming the commit that rewrote it and the text it removed.

> **⚠ THE IN-BULLET FORM WAS PERFORMED, MEASURED AND REVERTED (REG-F-277).** Applying 28 pointers to their
> bullets inserts 34 lines into the register's body at 28 sites, **and every line-number citation below an
> insertion moves**: 543 of 594 matched citations shift, 364 of them by 34 lines, in an artifact that can
> never repair them. The strictly verifiable subset — entry-qualified `` `REG-x-nnn:NNNN` `` citations — is
> **17, and all 17 land inside the entry they name at HEAD**, so the convention is maintained and reliable,
> which is exactly what makes breaking it expensive.
>
> **And the in-bullet form was eroding this gate**, because a pointer quotes the removed text back into the
> entry that lost it — the case §7's absolution forgives. Driven: the forbidden-act mutant fell from nine
> lost words to one, then to zero. **A new entry cannot absolve**, so the appendix form leaves the
> instrument at full strength.
>
> **The pointers therefore live in `REG-F-277` as an appendix**, keyed by entry id. The cost is real and
> accepted: a reader who opens `REG-F-049` alone will not see it. **And the count of still-true-and-live
> removals is SIX, not the four this section first listed** — the two extra were found by the annotation
> pass, which read each removal at its commit rather than from the synthesis.

**Prioritise by truth at removal**, which splits the 26 into three acts needing three repairs:

- **Removed text still TRUE AND LIVE — four, needing their content restated:** `c61d92cf` (a
  fourteen-document obligation), `fb5d7cbd` (`REG-F-033`'s standing ratchet), `5fd041f3` (a named-site
  remedy prescription), `574cc1e6` (a still-true verdict on `REG-F-024`).
✅ ~~**`70e4f33b` needs a correcting entry regardless of restoration** — a sentence still standing at~~ **FILED 2026-08-28 as `REG-F-282`.** — a sentence still standing at `:560`
  says the prescription *"is kept unstruck because it was right"*, which is **false about the register's
  own history**: the same commit deleted half of it.
- **The remainder** removed a claim the removing commit had itself just falsified, and need only an
  annotation.

**⚠ A note for whoever writes the sweep: `git log -S` is the wrong instrument and would hide the keystone.**
The `REG-F-072` double rewrite retained the phrase *"C-0b turns this census into a standing control"*, so
the occurrence count never changed and `-S` returns only `7afba73f`. **Only the diffs show it.**

---

## 9. What is not claimed

- **`REG-F-273`'s numerator of eight is not re-derived and not endorsed here.** Those eight limbs were not
  re-checked; nothing here re-opens `REG-F-235`, `REG-F-236`, `REG-F-237`, `REG-Q-062` or their closures.
- **No rate and no partition.** 103–163 is a range across derivations, not a denominator. 26 of 71 is a
  count over a sample that was **not randomly drawn** and is a floor.
- **The 26 are not exhaustive within their own commits** — the opposite is measured (§3).
- **No claim that the authors were ignorant of the strike idiom** — four commits apply it correctly in the
  same hunk as a violation. This is selective application, and *why* is not known.
- **No claim that `REG-F-072`'s figures were wrong when written.** They were correct at `174047b8`; the
  ledger moved under them.
- **No claim that the in-place edits misled a downstream reader.** Where checkable they did not:
  `REG-F-183` cites the appended bullet rather than the overwritten status, and `REG-F-199` reads
  `REG-F-006` correctly.
- **The gate guards the future from a pinned baseline.** It does not adjudicate the 26 already in history.
