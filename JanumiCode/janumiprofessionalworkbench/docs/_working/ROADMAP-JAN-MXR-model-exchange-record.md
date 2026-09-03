# ROADMAP — `JAN-MXR`: the durable model exchange record

**Authority:** `REG-D-054` (sponsor ratification, 2026-09-03) resolving §16 item 23 for the exchange-record
limb. **Design:** `DESIGN-item23-exchange-record-resolution.md`. **Tier:** roadmap — this sequences the work
`REG-D-054` licensed; it decides nothing the ruling did not grant.

---

## 0. The two rules that shape every package below

**`PER-2` — the shape ships ONCE.** *"Persisted event schemas are permanent — evolution uses upcasters at read
time, never event rewriting."*

> ### ⭑ CONSEQUENCE, AND IT IS COUNTER-INTUITIVE: THE `E-2` FIELDS MUST EXIST NOW, WHILE `E-2` IS STILL BLOCKED
> `REG-Q-066` is OPEN and forbids **writing** `E-2` content. It does not forbid the **field**. If the shape
> ships without `answerSpanRef` / `volunteeredReasoningRef`, then the day `REG-Q-066` is answered we must
> either add fields to a permanent schema — **an upcaster forever, for a field we knew we needed** — or mint a
> second event type for the same act, which is `PER-9`'s *"duplicate event authority."*
> **So: the fields land now, always emitted as `PENDING_CONTENT_PLANE` with the `REG-Q-066` reason, and the
> block stays where it already is — at the WRITE, not at the SHAPE.** ⚠ This is the distinction `REG-F-330`
> got wrong in the other direction: it wrote the *content* before the ruling. Declaring a field that is
> lawfully empty is not that.

**Item 23's instruction is a CONJUNCTION** — *"registry, schemas, persistence, projections, fixtures, and
conformance tests together before claiming support."* ⛔ **No package below may be reported as support until
`MXR-06` is green.** Partial completion is reported as partial.

---

## 1. Work packages

### `MXR-01` — contracts
The command `RecordModelExchange`, the event `ModelExchangeRecorded`, and the three shapes they need:
`ResolvedModelIdentity` (⚠ **with `version`** — `ActorReference` has none), `ExchangeContentRef`
(`storageProvider`/`storageKey`/`contentHash`/`byteSize`/`purgeability`/`contentDurability`, or
`PENDING_CONTENT_PLANE` + reason), and `ExchangeTruncation`.
**Exit:** schemas exist, are registered in the message map, and **round-trip** in a test. **Every field typed —
no `z.record`, no `z.unknown()`.** A single open field would reproduce exactly what `REG-D-054` refused.

### `MXR-02` — handler + registry
Handle the command, emit the event onto **the plane's existing aggregate**. No new aggregate, no new object.
**Exit:** registered in the handler registry; dispatch produces exactly one event; an unknown aggregate is
refused rather than silently created.

### `MXR-03` — persistence
**Measure, do not assume**, that the event lands in `domain_events.payload` and survives a reopen.
**Exit:** a test that writes, reopens the store, and reads the record back **byte-identical**. ⚠ **Predicted
red first** — assert the reopen path before trusting it.

### `MXR-04` — projections
**Prove** the record adds no governed-object catalog entry — the property `REG-D-054` says must stay
structural.
**Exit:** a conformance test asserting `listGovernedObjects` is **unchanged** across recording an exchange,
with a **positive control** proving the instrument would see a real object if one appeared. ⚠ Without that
control this is an absence assertion that cannot fail — the defect this repository records most often.

### `MXR-05` — the consumer (⭑ the package that makes the rest non-hollow)
Drain the exchange sink at the **async layer** and dispatch `RecordModelExchange` — the placement `REG-F-328`
recorded and `REG-F-342` confirmed (`await store.put(...)`, then a **synchronous** dispatch carrying only the
ref).
**Exit:** an authoring turn that calls the model produces durable records — **one per bounded try**, chained
by predecessor. ⛔ **Until this lands, `ICP-02` remains inert and must be reported as inert.**

### `MXR-06` — fixtures + conformance tests
The conjunction's last limb. **Exit:** `PER-9`'s six elements each asserted present and typed; the per-try
chain asserted across a repair; **and the `E-2` fields asserted PENDING with the `REG-Q-066` reason**, so a
future writer cannot quietly fill them without reddening a gate.

### `MXR-07` — the §31 durable adapter, landing **with** `MXR-05`
**Never before it.** `REG-F-343`: `GATE-1` tests that a sink EXISTS, not that it is DURABLE, so a durable
store landing against today's ephemeral sink **walks straight through the gate** and produces durable content
whose record dies at end of run.
**Exit:** the adapter declares `durability: 'DURABLE'`, and `H-2` moves from *disclosed* to *resolved*.

---

## 2. Standing traps, from this programme's own record

- **Assert the MESSAGE, not the code** — `project_jpwb_csaa_assurance_gap`: 65 tests asserted an issue code
  alone and proved nothing.
- **Name the predicted red before trusting green**, and drive a mutant per claim. **A control needs its OWN
  single-victim mutant** — three times in two days a control turned out redundant when driven (`REG-F-337`,
  `REG-F-341`, `REG-F-343`).
- **Derive lists from the filesystem or the schema**, never hand-list them — `REG-F-341`'s own defect.
- **Run the FULL suite**, not the scoped one: CSAA population pins move whenever files are added, and the
  scoped run will not show it.
- ⚠ **`check-types` catches what vitest cannot** (`REG-F-338`): tests pass green on a file that does not
  typecheck.

---

## 3. Exit criteria for `JAN-MXR` as a whole

1. `PER-9`'s durable-exchange-record clause is **met for the assurance plane**, with each element typed and
   asserted.
2. `PER-12`'s *"never projected"* holds **structurally**, proven by `MXR-04` with a firing control.
3. `ASR-11` limb 3 is **re-dispositioned** against the new carrier — it may still be unmet, and if so the
   register says **why**, not merely that it is open.
4. `REG-Q-066` becomes **actionable**: a ruling would then change something. ⛔ **It is still not asked for
   here.**
5. Everything item 23's conjunction names has moved, or the package reports itself **partial** and says which
   limb did not.
