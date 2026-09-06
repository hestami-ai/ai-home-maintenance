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

⭑ The unit that stops this being another authored-with-no-consumer field. `prepareModelInvocation` obeys the
policy: it assembles only the declared elements, and records the fates of those it did not.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| resolve the policy and ignore it | the consultation test — three ratified slots already have no reader; a fourth is the defect, not the fix |
| omit an element without recording its fate | `DEC-4`: *"a context omission must not silently remove a mandatory constraint"* |

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
