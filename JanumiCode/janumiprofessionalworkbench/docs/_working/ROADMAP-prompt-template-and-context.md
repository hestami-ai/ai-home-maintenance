# ROADMAP — `JAN-PROMPT`: a work-unit type that says how the work is attempted

**Design:** `DESIGN-prompt-template-and-context.md` · **Ruling:** `REG-D-058` (owned) · **Date:** 2026-09-04

**Sponsor defaults accepted 2026-09-04** — *"Agree with your defaults."*

1. A DRAFT template is edited freely; it freezes at publish.
2. A missing declared placeholder at render time is a **REFUSAL**, not a disclosed gap.
3. An ACTIVE template needs no approval separate from publishing.

> ### ⭑ DEFAULT 1 IS ALREADY ENFORCED AND COSTS NOTHING TO ADOPT
> `editPwuType` (`packages/rph-application/src/handlers/pwa-authoring.ts:675-681`) calls
> `requireDraftOwner` before it does anything else, and a published PWA is immutable end to end
> (`apps/rph-demo/e2e/agent-sse.e2e.ts:78`). **The template rides an existing lifecycle rule rather than
> introducing one** — which is the ownership ruling paying for itself a second time.

---

## Stages

### `PT-01` — the shape

Add to `packages/rph-contracts/vocab/m1-object-fields.json`:

- **`PromptTemplate`** sub-type — `templateText`, `templateVersion`, `declaredPlaceholders` (closed list),
  `outputContract`, `status` (`DRAFT` | `ACTIVE`).
- **`ContextSpecification`** sub-type — `requiredElements`, and `constraintDispositions[]` of
  **`ConstraintDisposition`** = `{ constraintId, fate, rationale? }` where `fate` is `DEC-4`'s **closed**
  five: `PROPAGATED` | `RETAINED_AT_PARENT` | `INAPPLICABLE_WITH_RATIONALE` | `WAIVED_THROUGH_AUTHORITY` |
  `SUPERSEDED_BY_STRONGER`. ⭑ **Quoted from canon, not invented** (`JPWB-DOC-003:224`).
- Both **OPTIONAL** on `PWU_TYPE`, and on the `DefinePwuType` / `EditPwuType` payloads.

⚠ **OPTIONAL IS FORCED, NOT PREFERRED.** `PER-2` makes event schemas permanent and forbids rewriting history;
every `PwuTypeDefined` already written carries no template. A REQUIRED field would either falsify those
records or demand an upcaster inventing a template nobody authored. **Absence means "this type declares no
agent behaviour" — which is true of every type that exists today**, and is a fact rather than a placeholder.

**Exit:** `bun run gen` clean; the emitted schema carries both; `check-types` green.

### `PT-02` — carry it through define and edit

`buildRedefinedTypeState` and the define handler pass both fields through.

> ### ⛔ THE TRAP, NAMED BEFORE IT IS HIT
> `editPwuType` refuses a **no-op edit** (`pwuTypeEditNoOp`, `pwa-authoring.ts:682-686`), and that check
> *"Compares RAW payload fields"* — an enumerated list that does not know about these two.
> **So an edit changing ONLY the prompt would be refused as "nothing changed."** The feature would appear
> broken in exactly the way the sponsor already found once: the field exists and the screen cannot save it.

**Predicted reds, before green is trusted:**

| Mutant | Must redden |
|---|---|
| leave `promptTemplate` out of the no-op comparison | an edit that changes only the prompt — refused as a no-op |
| leave it out of `buildRedefinedTypeState` | the edit is accepted and the state does not change |
| accept an undeclared placeholder in `declaredPlaceholders` | the closed-list test |

### `PT-03` — rendering, and the refusal the sponsor ruled

`renderPromptTemplate(template, context)` in `packages/rph-application`:

- Every placeholder in `templateText` must appear in `declaredPlaceholders` **and** be supplied by the
  context. A missing one **REFUSES** and names it.
- ⭑ **Both directions.** An *undeclared* placeholder present in the text is equally a refusal — otherwise the
  closed list is decorative and a template can grow a hole nobody declared.
- Refusal carries the placeholder name, because a refusal a reader cannot act on is the silent omission
  `PER-9` forbids.

**Predicted reds:** render with a declared-but-unsupplied placeholder → refuse; render with an
undeclared-but-present one → refuse; **CONTROL** — a fully supplied template renders, so the guard is not
"refuse everything."

### `PT-04` — the screen the sponsor went looking for

Prompt template and context specification on the PWU type editor in the PWA Designer: visible, editable while
DRAFT, read-only once published.

**Exit:** a non-test call site, and an e2e spec that edits a prompt and reads it back after reload.
⚠ **Without this stage the work is a hollow layer** — the defect this repository has recorded against itself
repeatedly, and the exact defect the sponsor reported: *"I couldn't see where to view or edit the PWU's
prompt template."* **`PT-01`–`PT-03` do not ship without `PT-04`.**

### `PT-05` — give `promptTemplateFingerprint` its referent

`MODEL_EXCHANGE.promptTemplateFingerprint` currently fingerprints a template with no home. Populate it from
the rendered template's identity so the record resolves — the `PER-9` clause it sits under says a fingerprint
*"never substitutes for it"*, and until now there was no "it".

### `PT-06` — the honesty items

- File the outcome; re-run `REG-F-348`'s derivation (**run it, do not recall it** — it has under-run twice).
- ⚠ **`limb`/entry claims:** this stage supplies the ASSET, not the CALLER. Nothing yet calls a model on
  behalf of a step. **Say so in the entry before anyone can claim otherwise.**
- Correct any record that asserts a prompt template does not exist, once one does.

---

## Gates

`bun run check-types` · `bun run lint` · vitest across every project but CSAA
(**261 files / 2196 baseline** — any new count explained by tests added) · playwright for `PT-04`.

## Boundaries

No new values for the four unratified columns (`REG-Q-056`) · no read-authority mechanism (`REG-Q-077`) ·
`handlers/artifact.test.ts:123-136` green and unedited · no new PWU kind (`DEC-1`) · memory stays unmodelled ·
no CSAA.
