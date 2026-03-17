# Bounded Repair

You should define hard safety bounds explicitly. Otherwise “bounded repair” turns into hidden autonomous thrashing.

## Recommended Default Bounds

**For a single `task_unit`:**
* Max 1 automatic repair attempt after the initial failure
* Max 2 total execution attempts per unit
* Max 1 validation-driven repair cycle per failure class
* Max 15-20 minutes wall-clock per unit before escalation
* Max 1 provider handoff during repair, and only later if you add multi-provider repair

**For a full task graph:**
* Max 3 repaired units before forcing a higher-level review
* Max 1 repeated failure of the same failure class across sibling units before escalation
* Max 1 full replan triggered automatically from repair logic

That is conservative on purpose.

## Good Default Policy

* **Attempt 0:** Initial execution
* **Attempt 1:** One local repair if the failure is classified safe
* **Then:** Escalate

Do not let the system silently iterate five or six times. Minions-style bounded loops work because they are aggressively capped.

## What is Safe to Auto-Repair

Safe to auto-repair means:
* The failure is local
* The cause is legible
* The repair scope is bounded
* The repair does not require product judgment
* The repair does not weaken guarantees silently

**Examples of usually safe auto-repair:**
* Formatting/lint errors
* Missing import / trivial symbol resolution
* Type mismatches caused by known local change
* Failing generated type sync
* Obvious schema/client regeneration miss
* Test failure caused by deterministic expectation drift clearly tied to the recent change
* Missing config wire-up where intended behavior is already specified

These are “mechanical correction” failures.

## What Should Escalate Immediately

Escalate when the failure involves:
* Ambiguous product behavior
* Conflicting requirements
* Security/privacy boundary uncertainty
* Data migration risk
* Destructive or irreversible operations
* Broad architectural contradiction
* Repeated failure after one repair attempt
* Inability to identify a dominant cause
* External dependency missing/unreachable in a way that changes scope
* Validation that suggests the original decomposition was wrong

**Examples:**
* Tenant isolation behavior unclear
* Failing auth/permission checks where intended policy is uncertain
* Migration may corrupt or reinterpret existing data
* Repair would require changing acceptance criteria
* Multiple unrelated tests fail after one change
* Same unit fails again with different symptoms

Those are not safe auto-repair territory.

## Simple Safety Classifier

I would classify repair candidates into three buckets:

1. **AUTO_REPAIR_SAFE**
   * Deterministic, local, reversible, no product judgment.
2. **AUTO_REPAIR_CONDITIONAL**
   * Maybe safe, but only if within strict scope.
   * One file cluster / one subsystem / one failure class.
   * No security/data boundary touched.
3. **ESCALATE_REQUIRED**
   * Judgment, risk, ambiguity, or repeated failure.

**If you want a rule:**
* Only `AUTO_REPAIR_SAFE` gets automatic retry in Phase 1.
* Defer `AUTO_REPAIR_CONDITIONAL` until the pipeline is mature.

## Should Repair be Sandboxed?

Yes.

At minimum, repairs should be isolated enough that you can:
* Inspect delta from the initial failed attempt
* Discard bad repair output cleanly
* Avoid compounding workspace damage

**Best practical approach:**
* Each repair attempt should operate on the same task-scoped working state, but with explicit diff tracking.
* Store pre-repair artifact snapshot or git diff baseline.
* Compute per-attempt delta.
* If repair fails, either revert that attempt’s delta or roll forward only from a clean checkpoint.

You do not necessarily need `git stash` specifically, but you do need repair isolation.

## Recommended Implementation Options

* **Best:** Worktree / ephemeral branch / isolated task workspace.
* **Acceptable near-term:** Snapshot changed-file hashes before repair; record patch delta after repair; revert failed repair attempt to pre-repair snapshot before escalating or retrying.
* **Avoid:** Untracked sequential edits across multiple repair attempts with no reset point. That makes debugging and safe rollback much harder.

## Practical Repair Boundary

A repair attempt should be allowed only if all are true:
* Touches the same task unit scope
* Does not expand beyond declared `max_change_scope`
* Does not change acceptance contract
* Does not add new critical claims without re-verification
* Does not touch protected areas like auth, security, tenancy, migrations unless the unit was explicitly about those.

That last rule matters a lot. A harmless-looking repair can quietly cross a trust boundary.

## Concrete Defaults I’d Encode

**`repair_policy` for Phase 1:**
* `max_attempts_per_unit = 2`
* `max_auto_repairs_per_unit = 1`
* `max_minutes_per_unit = 20`
* `escalate_on_repeated_failure = true`
* `escalate_on_new_failure_class = true` after first repair
* `escalate_on_scope_expansion = true`
* `escalate_on_security_or_data_boundary = true`
* `escalate_on_acceptance_contract_change = true`

**`safe_auto_repair_failure_types`:**
* `lint_error`
* `format_error`
* `import_resolution`
* `local_type_error`
* `generated_artifact_stale`
* `deterministic_test_update`

**`always_escalate_failure_types`:**
* `security_boundary`
* `permission_policy`
* `data_migration_risk`
* `tenant_isolation`
* `destructive_change`
* `ambiguous_behavior`
* `external_dependency_gap`
* `architectural_conflict`

## Bottom Line

My recommendation is:
* One automatic repair attempt max.
* Only for clearly mechanical, local, reversible failures.
* With repair isolation/checkpointing.
* And immediate escalation for ambiguity, policy, security, migration, or repeated failure.

That gives you a true bounded repair loop rather than an uncontrolled autonomous retry system.