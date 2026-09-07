# ROADMAP — `JAN-CTXPOL`: context assembly becomes a governed object (`ICP-04`)

**Design:** `DESIGN-context-assembly-policy.md` · **Date:** 2026-09-06

⛔ **EVERY UNIT BELOW IS GATED ON SPONSOR DECISION `D-1`** (grant to author `CONTEXT_ASSEMBLY_POLICY`). The
corpus declares `contextAssemblyPolicyId` and never defines the object it names; minting the type is a
ratification act, not wiring. Nothing here starts until that is answered.

---

### `CP-01` — the object type, authored under grant

`CONTEXT_ASSEMBLY_POLICY` in `m1-object-fields.json`, shape per design §4, with a vocab note recording: the
corpus verification and its **controls**, the `DEC-4` derivation of `fate`, and why volunteered reasoning has
**no member**.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| add a sixth `fate` member | the `DEC-4` adoption test — five exhaustive dispositions, adopted not derived (`REG-F-353`) |
| add a `VOLUNTEERED_REASONING` element kind | the `REG-Q-077` test — the slot must not exist before the permission |
| make `rationale` optional for `INAPPLICABLE`/`WAIVED` | the disclosure test — `DEC-4` forbids silent omission |

---

### `CP-02` — the id resolves, and a wrong id REFUSES

The reader: resolve `binding.contextAssemblyPolicyId` to a stored policy.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| resolve any id to a permissive default | ⛔ **the vacuous-route test** — the roadmap names this exact failure: *"seeding a permissive default so the check can never fire"* |
| refuse nothing | `ICP-04`'s stated exit: *"point a binding at a policy that does not exist. This MUST refuse"* |
| **CONTROL** | the seeded `'ctx-default'` DOES resolve, so the refusal is not "refuse everything" — the first horn of `D-2` |

---

### `CP-03` — the seeded default states TODAY'S behaviour, truthfully

`'ctx-default'` = `RENDERED_INSTRUCTION` only, everything else `INAPPLICABLE` with a rationale.

⚠ **It must be a TRUE statement, not a stub.** A policy that permits everything would resolve and mean nothing —
the permissive seed `D-2` refuses. A policy that says *"this deployment assembles the rendered instruction and
nothing prior"* is exactly what the code does today, so the object and the behaviour agree on day one.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| seed a permit-all policy | the truthfulness test — the seeded policy must match observed behaviour |
| seed nothing | `CP-02`'s CONTROL — every existing binding breaks |

---

### `CP-04` — the reader is CONSULTED, not merely resolved

⭑ The unit that stops this being another authored-with-no-consumer field. **REVISED 2026-09-06 after measuring
the shipped execution path** — see `DESIGN` §7. The original body is kept below with its disposition, because
one of its two predicted reds turned out to be already discharged and the other exposed a defect in `CP-03`.

#### `CP-04a` — the CEILING: everything assembled must be permitted, or REFUSE

`prepareModelInvocation` takes the resolved policy as a **required** parameter — required so that *"resolve the
policy and ignore it"* is not expressible — plus the sources the step will assemble beyond the instruction.
`RENDERED_INSTRUCTION`/`THIS_TRY` is itself checked. The refusal precedes the render.

| Mutant | Must redden |
|---|---|
| make the policy parameter optional | the type-checker, at every call site — an optional consultation is the defect wearing a default |
| exempt `RENDERED_INSTRUCTION` from the check | the empty-policy test — `permittedSources: []` is *"a CLAIM"* and must refuse everything |
| check `source` and ignore `scope` | the `THIS_UNDERTAKING` test — the surviving falsifiable boundary |
| refuse after rendering | the ordering test — `prompt-render.ts:8-12`, *"the disclosure arrives after the harm"* |
| **CONTROL** | the permitted repair turn RUNS — otherwise the ceiling is "refuse everything", `D-2`'s first horn again |

#### `CP-04b` — the FLOOR: a required element omitted must be DISPOSITIONED, or REFUSE

⭑ `PWU_TYPE.contextSpecification.requiredElements` is ratified and **read by nothing**. A type may require an
element its own template never declares; `assembleStepContext` walks `declaredPlaceholders` and
`renderPromptTemplate` checks declared-vs-supplied — neither ever looks at `requiredElements`. That is `DEC-4`'s
*"a context omission must not silently remove a mandatory constraint"* with nothing watching.

| Mutant | Must redden |
|---|---|
| drop the check | the silent-omission test — a required element absent from the assembled context and no disposition |
| accept ANY disposition | the naming test — the disposition must name the omitted element in `constraintId` |
| ~~accept any FATE~~ · ~~accept `INAPPLICABLE_WITH_RATIONALE` with no rationale~~ | ⛔ **SUPERSEDED 2026-09-07** — both asked which fates may excuse an omission. The sponsor's answer is that NONE can: a disposition dispositions a mandatory parent CONSTRAINT, not a context ELEMENT. See `DESIGN` §9. |
| ⛔ **REPLACES THEM** — let ANY disposition excuse a missing required element | the correction test — every fate in the schema is tried and every one must still refuse |
| **CONTROL** | a required element the context DOES supply needs no disposition, and a dispositioned omission PROCEEDS |

⛔ **NOT built: a disposition path for template placeholders.** `renderPromptTemplate:66-71` already REFUSES
that omission, under a sponsor ruling of 2026-09-04 which declined *"render the hole and disclose it
afterwards"*. A second, weaker path for one rule is `REG-F-353`, and it would soften a ruling.

#### `CP-04c` — the seed becomes TRUE, because `CP-04a` proved it false

The corrected seed permits all four sources at `THIS_TRY`/`THIS_WORK_UNIT`. ⚠ **Not `D-3`** — behaviour is
untouched; the claim is corrected to match it. `THIS_UNDERTAKING` stays permitted for nothing.

| Mutant | Must redden |
|---|---|
| leave the seed at instruction-only | `CP-04a`'s live-path test — the demo's own repair turn refuses |
| permit `THIS_UNDERTAKING` | the boundary test — the session is per work unit (`+page.server.ts:991,1133`) |

#### `CP-04d` — the id is resolved on the LIVE path

The execution action resolves the id **from the store**: from the step's `RUNTIME_BINDING` when one names it,
otherwise from the host's configured default **as a disclosed gap** (the demo's plans carry
`authorizedRuntimeBindingIds: []`). An id that names nothing REFUSES — `ICP-04`'s exit test, off the unit bench.

---

**ORIGINAL `CP-04` BODY, retained with disposition:**

| Mutant | Must redden | Disposition |
|---|---|---|
| resolve the policy and ignore it | the consultation test | ⭑ **KEPT and strengthened** — `CP-04a`, made unexpressible rather than merely tested |
| omit an element without recording its fate | `DEC-4` | ⚠ **ALREADY DISCHARGED for placeholders** by `renderPromptTemplate`'s refusal under the 2026-09-04 ruling; **relocated** to `requiredElements` (`CP-04b`), where it is genuinely unenforced |

---

### `CP-05` — filings

Register entry recording: the corpus verification with controls, the authoring grant, `D-2`'s disposition, and
⚠ **the correction to `F-3`** — *"`CONTEXT_ASSEMBLY_POLICY` … return 0 as object types"* reads as a declared
type with no instances; there is **no type**, and a reader would otherwise build on the wrong picture.

⛔ **NOT taken:** widening the seeded policy to draw prior work from the stream (`D-3`) — a behaviour change to
every execution, wanting its own red test and its own live run. And `memoryPolicyId` (`D-4`).

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
