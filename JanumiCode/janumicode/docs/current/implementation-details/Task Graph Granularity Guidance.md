# Task Graph Granularity Guidance

Yes. You should define explicit constraints, or the Executor will drift to one of the two bad extremes.

“Smallest execution-planning unit worth tracking” is directionally right, but too vague to govern behavior on its own.

## Practical Definition

A `task_unit` should be:
* Small enough that failure is local
* Large enough that tracking it adds value
* Concrete enough that it can be verified independently
* Bounded enough that a provider/tool choice can be assigned to it

**A good mental model is:**
* Not “write the whole Concierge slice”
* Not “rename one variable”
* But rather: “introduce canonical association entity schema and regenerate dependent backend/frontend types”

That is usually the right scale.

## What to Constrain Explicitly

Yes, I would define all three categories you listed.

### 1. Cap the number of task units per planning cycle

Do not use a single universal hard cap forever, but do use a default operating range.

**Good starting rule:**
* Target 5-15 task units for a normal goal
* Soft warning above 20
* Require hierarchical grouping above 25
* Reject below 3 for any non-trivial feature request

That keeps the system from collapsing into either one giant plan or 80 microscopic steps.

**For larger work:**
* Allow nested decomposition
* Top-level graph: 5-12 units
* Each unit can later expand into child units only if needed

That is better than allowing one flat graph with 100 nodes.

### 2. Bound the scope of each unit

Yes, define practical scope boundaries, but avoid crude file-count-only rules.

A better constraint is a mix of change scope and semantic scope. A `task_unit` should usually satisfy:
* One primary objective
* One dominant failure mode
* One main validation pattern
* One clear dependency boundary

**Helpful soft heuristics:**
* Usually touches 1-3 primary files or one coherent slice across layers
* Usually introduces 1-3 atomic claims
* Usually has 1 clear completion check
* Usually maps to one provider/tool configuration

File count alone is too brittle because some valid units span schema, API, and UI types by design. So instead of “1-3 files touched” as a hard rule, I’d use:
* “One coherent change boundary”
* “One validation story”
* “One main reason it could fail”

### 3. Require fields that force meaningful granularity

Yes. This is the most important control.

A `task_unit` should be invalid unless it has:
* `goal`
* `inputs`
* `outputs`
* `preconditions`
* `postconditions`
* `observables`
* `falsifiers`
* `verification_method`
* `max_change_scope`

Those fields force the unit to be real rather than rhetorical. If the Executor cannot fill those fields cleanly, the unit is probably too vague or too broad.

## Best Anti-Under-Decomposition Rule

**Reject a unit if:**
* It has more than one independent objective
* It requires unrelated validations
* It introduces too many claims
* Its falsifiers are heterogeneous
* Its output is “implement feature X” or similarly broad

**A useful policy:**
* Max 3 introduced claims per unit
* Max 2 validation methods per unit
* Max 1 dominant dependency bottleneck per unit

If it exceeds those, split it.

## Best Anti-Over-Decomposition Rule

**Reject a unit if:**
* It has no meaningful standalone observable
* It cannot fail independently
* It exists only because of a sequencing detail
* It is too small to justify its own provider/validation cycle

**Examples of over-decomposition:**
* “Open file A”
* “Add import line”
* “Rename local variable”
* “Create interface and then separately export interface” as separate units

If a step is only a mechanical substep inside a coherent bounded change, it should not be a tracked `task_unit`.

## Recommended Decomposition Rubric

A `task_unit` is well-formed if all are true:
* It has one clear objective.
* It can be described in 1-2 sentences.
* It has a concrete observable output.
* It has at least one concrete falsifier.
* It can be validated without executing the whole project plan.
* If it fails, the repair strategy is local.
* A human reviewer could understand why it exists.

If any of those fail, the unit is wrong-sized.

## Good Examples

**Good:**
* “Add organizationId and associationId constraints to document persistence schema and verify generated types remain aligned.”
* “Implement RLS context setup/cleanup helper for DBOS workflow transactions and validate no context leakage in tests.”
* “Introduce Concierge route shell with SSR data contract and validate route-level type generation.”

**Too broad:**
* “Implement tenant isolation.”
* “Build Concierge MVP.”
* “Set up all schema/backend/frontend plumbing.”

**Too narrow:**
* “Add organizationId field to one type definition.”
* “Write one migration file.”
* “Export the helper.”

## Concrete Policy You Can Encode

I would define:
* **Top-level graph target:** 5-15 units
* **Soft max top-level units:** 20 (If >20: regroup into parent units or phases)
* **Claims per unit:** 1-3
* **Primary objective per unit:** Exactly 1
* **Validation methods per unit:** 1-2
* **Observables:** At least 1
* **Falsifiers:** At least 1
* **Human-readable label:** Required
* **Max change scope:** Required, but semantic not numeric-only

And I would add Evaluator checks for:
* `TOO_COARSE`
* `TOO_FRAGMENTED`
* `MISSING_OBSERVABLES`
* `MISSING_FALSIFIERS`
* `MULTI_OBJECTIVE_UNIT`

## Best Implementation Detail

Do not rely on the Executor alone to self-police granularity.

Use the Evaluator and Verifier together:
* Evaluator checks decomposition quality.
* Verifier checks whether claims are atomic/verifiable.
* If either complains, JanumiCode loops back internally before the human ever sees it.

**Bottom Line:** Define explicit constraints, especially around target unit count, one-objective-per-unit, required observables/falsifiers/validation fields, and max claims per unit. That is the cleanest way to prevent both prose-monoliths and useless microsteps.