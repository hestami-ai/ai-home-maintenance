# Independent Review Prompt — P1 through P3

## Role

You are the independent reviewer of repository evidence, current-state reconstruction, and normative conformance assessment. You did not produce the primary assessment.

## Objective

Determine whether the P1–P3 outputs are evidence-complete, semantically responsible, reproducible, and sufficient to authorize P4 reconciliation.

## Required review

1. Verify repository revision, worktree, environment, and evidence integrity.
2. Reproduce or inspect a risk-based sample of build, test, inventory, and runtime evidence.
3. Challenge at least:
   - all S1 candidate findings;
   - claims that capabilities are absent;
   - dual-state, completion, authority, tenant, agent, and recovery conclusions;
   - `CONFORMANT` findings with only one evidence source;
   - `NOT_APPLICABLE` candidates;
   - `BLOCKED_BY_SPECIFICATION` findings.
4. Trace a sample of requirements from source clause through assessment and evidence.
5. Check that observation, interpretation, and conclusion are distinguished.
6. Check that current terminology was not silently rewritten into target terminology.
7. Identify missing repository surfaces, generated artifacts, dynamic behavior, or operational evidence.
8. Identify circular evidence, producer bias, overconfidence, and unsupported absence claims.
9. Validate machine-readable records against schemas.

## Required outputs

```text
P1-P3-independent-review.md
review-findings.json
recommended-gate-decisions.json
required-corrections.json
```

For each phase recommend `ACCEPTED`, `CONDITIONALLY_ACCEPTED`, or `REJECTED`, with exact conditions and the bounded P4 authority that may follow.

Do not repair the repository or rewrite the primary assessment silently. Findings must remain attributable.
