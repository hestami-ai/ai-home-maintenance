# DESIGN — Intent at 6/15: the nine terminal arrows nothing performs

**Status: DESIGN — all findings below are MEASURED (2026-08-13). No code change proposed yet; §5 states what
must land TOGETHER if anything lands at all.**

## 1. The gap, measured

`Intent.intentStatus` ratifies 15 arrows; commands declare 6. The uncovered 9 are ALL terminal-bound, and they
split by trigger, not evenly:

| Trigger | Arrows | Sources |
|---|---|---|
| **Supersede** | 6 | RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED (every non-terminal state) |
| **Withdraw** | 3 | RAW, UNDER_DISCOVERY, PROVISIONAL **only** |

⚠ The Withdraw asymmetry is a semantic statement the machine makes deliberately: an intent that has been
FORMALIZED, APPROVED or REVISED **cannot be withdrawn — it can only be superseded.** Any command design that
offered Withdraw from those states would contradict the ratified machine.

## 2. The corpus is ASYMMETRIC too, and it decides the disposition

Derived from `packages/rph-contracts/vocab/m3-commands-events.json` and `messages.ts`:

- **`IntentSuperseded` EXISTS as a ratified event NAME** (cited DOC-002 §26.2), with an **UNRATIFIED-AUTHORED**
  shape — `{ supersedingIntentId, intentStatus }`, annotated *"Do NOT treat this sourceSection as proof the
  shape is ratified"*. Its own field note reads **`"(any active)->SUPERSEDED"`**, which is the 6 arrows.
- **`IntentWithdrawn` DOES NOT EXIST — no event, no payload schema, no name in the corpus.** `WithdrawIntent`
  likewise occurs nowhere. Checked in both directions: grepped for content (`IntentWithdrawn`, `WithdrawIntent`)
  across `packages/`, and enumerated every `Intent`-matching contract export.

**The precedent that settles this is in this repository already**, at `recordClaimAssessment`
(`assurance.ts:~755`): states with a ratified event name are performable; a state with **neither a ratified
event nor a consumer** is deliberately left unreachable, because *"a state reached by an INVENTED event looks
governed, where a state nothing can reach is visible."* (REG-D-024.)

So: **the honest ceiling for Intent is 12/15, not 15/15.** The 3 Withdraw arrows should stay uncovered and
VISIBLE. Closing them would require minting an event name the corpus does not have.

## 3. ⚠ THE TRAP, RECORDED IN ADVANCE BY THE REPOSITORY ITSELF

`packages/rph-domain/src/enforcement-register.ts` `RPH-INT-007` (kind `NOT_A_COMMAND_REFUSAL`) closes the rule
*"a superseded intent cannot authorize new PWUs"* (JPWB-DOC-003 §5 STA-6) on the ground that **SUPERSEDED is
command-unreachable**. Its final sentence:

> *"THE RESIDUE, stated because it is real: if SUPERSEDED ever becomes reachable, this rule becomes a live
> UNENFORCED_DISCLOSED row on the same day."*

And the mechanism, quoted from the same entry: `proposePwu` *"loads the intent, checks that it EXISTS, then
narrows it to `{ ontologyId, ontologyVersion }` and copies those two fields; it never reads `intentStatus`, so a
superseded intent would sail through."*

**Therefore a `SupersedeIntent` command cannot land alone.** Shipping it without the companion guard would
convert a closed register row into a live governance hole in the same commit — a superseded intent authorizing
new PWUs — and the register would be telling the truth about a system that had just acquired the defect.

## 4. Why this was found before it was built

The standing practice is to grep the enforcement register and the per-programme design corpus BEFORE designing.
Done here, it returned the trigger condition for a defect this increment would otherwise have created. Recorded
because the cost of the alternative is concrete: six new arrows, a green gate, and STA-6 silently unenforced.

## 5. What must land TOGETHER (the increment's shape, not yet its roadmap)

1. `proposePwu` reads `intentStatus` and refuses a SUPERSEDED (and WITHDRAWN) intent — **red-first, and it can
   be written and landed BEFORE any supersede command exists**, since the guard is testable by seeding. Landing
   it first means RPH-INT-007 never has a window in which it is live-and-unenforced.
2. Only then, `SupersedeIntent` + `IntentSuperseded` emission, with the shape's authored status disclosed as
   `recordClaimAssessment` disclosed its own (REG-D-024 pattern).
3. `RPH-INT-007`'s register row is rewritten in the same commit as (2): its `NOT_A_COMMAND_REFUSAL` ground
   (unreachability) expires the moment the command exists, and the row must move to ENFORCED — with the guard
   from (1) as its probe — rather than be left describing a world that ended.
4. The 3 Withdraw arrows: **no command.** Recorded as deliberately uncovered with the REG-D-024 reasoning, so
   the census's uncovered list keeps naming them.

## 6. Predicted movement, stated before measuring

`ratifiedArrowsCovered` +6 (156 → 162) and Intent 6/15 → 12/15, IF and only if all four items land. The count
must NOT be quoted from this doc — it is a prediction, and REG-F-118 exists because a number was pinned in
advance. Measure it from the census at the time.
