# DESIGN — tier tailoring is a RATCHET: how standalone, SaaS and Enterprise may differ, and how they may not

**Ruling on the five ratification acts owed from REG-D-041, under the sponsor's extension of that grant
(2026-08-10):** *"the solutions may have to be tailored by each of the tiers specific needs and constraints —
e.g., a solution that works for standalone may not work for enterprise or SaaS even."*

---

## 1. The instruction meets ratified canon, and I must say so before building

The extension is a licence to differentiate. **JPWB-DOC-001 §on deployment (L252, L256) forbids one direction of
differentiation and permits the other**, and it does so in terms:

> **"The constitution does not vary with deployment scale.** The intended employment ladder — solo professional,
> team, department, enterprise, multi-enterprise federation — changes topology, tenancy, and operational
> hardening, **never professional semantics**: the same framing gates, assurance floor, authority boundaries, and
> recomposition obligations hold for one person with one Undertaking as for a federated portfolio."

> **"Edition tiering monetizes scale, integration, and organizational governance — never permission to be
> trustworthy: core correctness and the de minimis assurance floor are not enterprise features."**

And this programme has ruled on it once already, on the sponsor's own evidence. **REG-E-006 (2026-08-06):**
*"There are three configurations: standalone, SaaS and Enterprise…"*, and the conclusion drawn there —
*"REG-F-047's divergence therefore has no deployment in which it is correct, and the remedy is uniform rather
than tier-conditional — **which is a materially different design from the one that was forming an hour
earlier**."*

**These are not in conflict, and the resolution is the ruling:**

> ### A rule may be TIGHTENED per tier. It may never be RELAXED per tier.
> **Standalone is the floor, and the floor is the same floor.** Above it, an organization may add constraints —
> that is exactly what canon means by *"organizational governance"* being edition-tiered. Below it there is
> nothing, in any tier, at any price.

**⚠ THE DANGEROUS READING, NAMED SO IT CANNOT ARRIVE QUIETLY.** *"A solution that works for standalone may not
work for enterprise"* is true and is the sponsor's point: enterprise needs MORE. The inversion — *"standalone
doesn't need the independence check", "standalone can skip the expiry", "standalone is just the demo"* — is the
same sentence read backwards, it is what canon calls *"permission to be trustworthy"* sold as an edition, and it
would arrive one convenience at a time with a plausible reason each time. **So the mechanism must make
relaxation structurally impossible, not merely discouraged.** A profile that can lower a bound is not a profile;
it is a waiver with no authority and no record.

---

## 2. The mechanism: a monotonic profile over an invariant floor

**There is no tier mechanism in the codebase today** (verified: no `deploymentProfile`, `edition`, or
`governanceProfile` anywhere in `packages/*/src`). What exists is a **floor** —
`BLOCKING_SEVERITIES = {BLOCKING, CRITICAL}` in `rph-assurance`, already read uniformly by the baseline gate and
by `reject-authorization`. That is the shape to generalize, not replace.

**The rule of construction, and every tiered decision below obeys it:**

1. **The FLOOR is a constant in the domain**, not a configuration value. It is what the engine does when nothing
   says otherwise. It is never absent, never empty, never `?? []`.
2. **A profile may only ADD.** Its operations are set-union and predicate-conjunction — never subtraction,
   never replacement. A profile that names a smaller set than the floor is a **contract error**, refused at
   load, not silently honoured.
3. **The absence of a profile is the floor**, not the absence of a rule. This is REG-F-111's lesson stated
   generally: *an optional field that defaults to "no constraint" is a gate switched off by silence.*
4. **The tier is a property of the DEPLOYMENT, never of a request.** A caller cannot declare its own tier for
   the same reason a skipper cannot declare its own step mandatory (REG-F-105) — the party a rule constrains
   does not get to supply the fact that decides whether it applies.

---

## 3. The five owed items, dispositioned

| # | Item | Disposition | Why |
|---|---|---|---|
| 1 | `ExecutionStep.strength` carrier | **UNIFORM** | An **authority boundary**, named in L252's list. There is no tier in which the actor may declare its own exemption. |
| 2 | strength ⟷ obligation agreement | **RATCHET** | A constraint on the plan AUTHOR = *organizational governance*, which canon tiers by name. |
| 3 | `COMPLETED` gloss (REG-F-107) | **UNIFORM** | Semantics of a status value. A word cannot mean different things per deployment. |
| 4 | Expiry on non-waiver decisions | **RATCHET** | The version bind is the floor and already enforced. Expiry is *operational hardening* for a standing authority held by an absent party. |
| 5 | `dispositionRules` required (REG-F-111) | **UNIFORM — and this one inverts** | §10.3's foreclosure IS the de minimis assurance floor, which canon says is **"not an enterprise feature."** |

### 3.1 Item 5 inverts, and it is the most important of the five

I had recorded this as *"should `CreateAssurancePolicy` REQUIRE `dispositionRules`?"* — a question about
authoring strictness, and a natural candidate for tiering (*enterprise requires it; standalone need not*).
**Canon forecloses that answer.** If the §10.3 foreclosure is part of the de minimis assurance floor — and
DOC-004 §10.3 is precisely that ladder — then it **cannot** be a thing an enterprise gets and a standalone user
does not.

**So the fix is not to require the field. It is to make the FLOOR the default when the field is silent:**

```
forbidden = policy.dispositionRules?.find(...)?.forbiddenOpenSeverities  ??  BLOCKING_SEVERITIES
```

A policy that says nothing gets the floor. A policy may **add** severities it will not tolerate; a policy that
tries to name **fewer** than the floor is refused at authoring, because that is a waiver of the floor and a
waiver needs an authority that a policy field is not.

**This is strictly stronger than what I shipped in REG-F-111**, which fixed *one policy* by declaring the rule
on it. Every other policy in the system — including any a user authors tomorrow — still has an inert Gate C.
**I fixed the instance and recorded the class; this fixes the class.**

### 3.2 The two genuine ratchets, and what each tier gets

**Item 2 — step strength must not contradict the obligations the step discharges.**

- **FLOOR (all tiers):** none. There is no ratified rule that the two must agree, and inventing one uniformly
  would be authoring a constraint the corpus does not state.
- **SaaS / Enterprise:** at `ProposeExecutionPlan`, a step marked `ADVISORY` that discharges a MANDATORY
  obligation is **refused**, naming both. This is checkable exactly because REG-F-105 put `strength` on a
  declared, stored, authority-set field — the enterprise rule is *downstream of* the uniform one, which is the
  ratchet working as intended.
- **Standalone:** the same disagreement is **recorded as an observation**, not refused. A solo professional who
  marks a step advisory in full knowledge is exercising judgement; a governed record of having done so is the
  proportionate response, and it is still a record.

**Item 4 — expiry on standing non-waiver authorities.**

- **FLOOR (all tiers):** the **version bind**, already enforced (`resolveAbandonAuthorization`, ASR-15). A
  decision approving version *n* never authorizes *n+1*.
- **Enterprise / SaaS:** an EFFECTIVE authorization for a destructive act (`ABANDON`, `REJECTION`,
  `PROMOTE_BASELINE`) **must carry an expiry**, because the authorizer is not the actor and may be absent for
  months — REG-F-106's own hazard note, which I deliberately left open rather than invent a field for.
- **Standalone:** not required. The authorizer is the actor and is present; the version bind is the bound.

**⚠ AND ITEM 4 IS THE ONE THAT NEEDS A CONTRACT ACT.** `DecisionObject` has no expiry field for non-waiver types.
Adding one is authoring a ratified contract; REG-D-041's grant covers choosing among carriers the corpus
defines, and here **the corpus defines none**. So this design specifies the ratchet and **stops at the field** —
recorded, not invented. §5.

---

## 4. Why this is the answer that serves all three tiers

- **Standalone.** Gets the floor, entire, and is never told a safeguard is an upsell. The two ratchets cost it
  nothing it needs: it is not refused a plan for a strength/obligation disagreement (it is recorded), and it is
  not made to expire authorities it holds and exercises itself.
- **SaaS.** Gets the floor plus the ratchets, because tenancy means the audit trail is the product and the
  authorizer may be a colleague.
- **Enterprise.** Gets the floor plus the ratchets plus the capacity to add its own — because the whole point of
  *"organizational governance"* as an edition concern is that an organization can bind itself harder than the
  product binds it. **What it cannot do is bind itself less.**

And the property that makes the whole thing safe: **any tier's behaviour can be derived by starting from the
floor and applying additions.** There is no configuration in which you must read three code paths to know what
the engine will do — the answer is always *"the floor, plus whatever this deployment added."*

---

## 5. Deliberately not built, and why

- **Expiry as a `DecisionObject` field** — the corpus defines no such field for non-waiver types. REG-Q-012
  requires expiry of WAIVERS only. Inventing it is outside the grant (REG-D-041 §6 already stopped here once).
  **Owed to governance, now with a stated tier rationale it did not have before.**
- **A profile-selection mechanism (how a deployment declares its tier).** Deliberate: canon allocates tenancy
  and deployment identity to the **Platform**, not to JPWB (REG-E-006's *"cede to repository ADRs"*; the Charter
  §33.4 allocation). JPWB's job is to make the ratchet **expressible and enforceable**; choosing the tier is the
  Platform's. Building a config knob here would be JPWB absorbing a Platform responsibility — the ninth
  boundary DOC-001 warns about.
- **Retro-fitting the ratchet to existing gates.** Item 5's floor default lands now because it is uniform and
  closes a live hole. The two ratchets are specified and **not implemented**, because they need the profile
  mechanism above them and would otherwise be a tier check with no tier.

---

## 6. What lands now

**Only item 5 — the floor default — and item 3's disposition.** Both are UNIFORM, so neither waits on a
mechanism that belongs to the Platform. That is not a reduction of the sponsor's instruction: it is the
instruction applied, and it turns out that **three of the five owed items must not be tiered at all**, one is
blocked on a contract act, and one is blocked on a Platform allocation. **Saying which is which is the ruling.**
