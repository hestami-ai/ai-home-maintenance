# `verif/csaa/` — disposition after CSAA left JPWB

**Recorded:** 2026-09-12 · **Programme:** `JAN-CSAAEXT` S8 · **Rulings:** `REG-D-061`, `REG-D-062`

CSAA moved to `JanumiCode/csaa/` at S6. These eight artifacts were produced by it and stayed behind. This file
records what they are and why none of them moved, because an artifact with no generator and no reader is
indistinguishable from a live one unless something says so.

## ⛔ All eight STAY, and this corrects `DESIGN §12`

`§12` classified six of them MUST-LEAVE *"at zero cost — no reader, no gate step"*. The reader half is right;
the cost half is not.

| artifact | `§12` said | register path citations | disposition |
| --- | --- | --- | --- |
| `jan-csaa-005.inventory.baseline.json` | STAYS | **6** | STAYS |
| `rph-demo.svelte-kit.generated-context.evidence.json` | STAYS | **2** | STAYS |
| `dwp-007.persistence-selection.evidence.json` | MUST-LEAVE | **1** | ⛔ **STAYS — `§12` was wrong** |
| `dwp-007.content-addressed-store.cold-warm.evidence.json` | MUST-LEAVE | 0 | STAYS (see below) |
| `dwp-004.current-dependency-cruiser-differential.evidence.json` | MUST-LEAVE | 0 | STAYS |
| `dwp-004.rph-contracts-build-same-perimeter-differential.evidence.json` | MUST-LEAVE | 0 | STAYS |
| `experimental/dwp-009.local-provider-disposition.evidence.json` | MUST-LEAVE | 0 | STAYS |
| `fixtures/subject/README.md` | MUST-LEAVE | 0 | STAYS |

⭑ **THE DECIDING FACT IS THAT `JPWB-REG-005` CITES THREE OF THEM BY PATH**, and that register is append-only
ratified canon — it cannot be rewritten to follow a file. Moving a cited artifact would orphan a verification
record whose whole purpose was to be checkable. `§12` reached its six-move answer by classifying SUBJECT alone
and never asked what cites them.

⚠ **AND THE REMAINING FIVE STAY FOR A WEAKER BUT SUFFICIENT REASON: MOVING THEM BUYS NOTHING.** They have zero
readers in either repository and no generator in either. Splitting the set would leave a reader unable to tell
whether an absent artifact was moved or lost, and would split `jan-csaa-005`'s markdown/JSON pair, which `§12`
itself establishes is written atomically. ⛔ This is a disposition of record, not of tidiness.

## What is true of all eight

- **Nothing reads them.** Measured at S8 across `verif/`, `scripts/`, `apps/`, `packages/` and `docs/`: zero
  code readers. ⚠ The one apparent hit — `jan-csaa-005.inventory.baseline.json` in
  `verif/dependency-boundary-rules.test.ts:18` — is PROSE in a comment describing what the baseline used to pin,
  not a read. A filename in a citation is not a dependency.
- **Nothing regenerates them.** All 53 `csaa:*` scripts left JPWB with the engine.
- ⛔ **So they are DATED SNAPSHOTS.** Any figure inside them describes JPWB as it was before the extraction, and
  in particular describes a tree that still contained `packages/csaa`.

## The companion document

`docs/ASTs and Code Analysis/JAN-CSAA-005 …Mapping.md` carried three assertions of currency, each conditional on
`bun run csaa:inventory:check` reproducing its products byte-for-byte. All three are struck and dated as of S8.

⭑ **`§12` CALLED THAT BANNER "THE ONLY PLACE A STALE REPORT WOULD ACTIVELY LIE". IT DOES NOT LIE, AND THE REAL
STATE IS WORSE.** The banner states a CONDITION. The condition did not become false — it became
**UNCHECKABLE**, because the command that evaluates it no longer exists here. A false claim can be caught by
anyone who tests it; an unevaluated condition reads as a satisfied one to every reader who does not already know
the command is gone. That is why the strike says so explicitly rather than simply marking the file historical.

## Not taken

⛔ **`docs/ASTs and Code Analysis/` — CSAA's 127-file, 147 MB specification corpus — STAYS, and was never in
scope.** It is not CSAA's source; it is JPWB's governance record of a programme JPWB's own sponsor conferred
(`REG-D-017` Stage A, `REG-D-018` Stage B). The register anchors it by path WITH SHA-256 digests and byte counts
— `README.md` at 102,164 bytes, `833b97d9…` — in entries that verify carriage *"in the artifact rather than from
the register"*. Those records are the reason the corpus cannot follow the tool: the tool left, the record of
commissioning the tool is JPWB's.
