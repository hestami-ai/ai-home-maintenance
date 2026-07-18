# Janumi Engineering Policy

## Multi-Agent Git Repository Isolation and Coordination

| Document Control Field | Value |
|---|---|
| **Document ID** | **JAN-ENG-POL-GIT-001** |
| **Document Type** | Engineering Policy |
| **Authority Level** | Governing Policy |
| **Status** | FINAL |
| **Governing Status** | Proposed — not effective until approved |
| **Version** | 0.1.0 |
| **Policy Owner** | Janumi Engineering |
| **Approval Authority** | Designated Janumi Engineering Authority |
| **Effective Date** | 2026-07-18 |
| **Review Cycle** | At least annually and upon material change to repository, agent-orchestration, or integration practices |
| **Information Classification** | Janumi Internal |
| **Supersedes** | None |
| **Related Documents** | Repository-specific branching standards, contribution procedures, CI/CD controls, and coding-agent operating instructions |

---

## 1. Purpose

This policy establishes the mandatory controls by which human developers, coding agents, automation, and integrators SHALL coordinate concurrent work in Git repositories without overwriting, commingling, obscuring, or prematurely integrating one another's changes.

The policy is intended to:

1. preserve the integrity and traceability of repository changes;
2. prevent loss of uncommitted work;
3. minimize avoidable merge conflicts and divergence;
4. maintain a continuously trustworthy integration baseline;
5. constrain destructive or overly broad Git operations;
6. govern shared contracts, registries, schemas, and generated artifacts; and
7. ensure that coding-agent activity remains observable, reviewable, and subject to human or designated orchestration authority.

## 2. Policy Statement

Concurrent coding actors SHALL operate in isolated working directories and on distinct branches. A shared working tree SHALL NOT be used for concurrent implementation except under an explicitly approved, time-bounded exception.

All changes SHALL be developed as small, logically coherent, validated increments; SHALL be synchronized at defined integration events; and SHALL be admitted to the governing integration branch only through an authorized integration process.

## 3. Scope

This policy applies to:

- all Janumi-managed Git repositories;
- all human developers, coding agents, subagents, automated refactoring tools, code generators, and repository-writing automation;
- local worktrees that share a Git object database;
- independently cloned local, remote, cloud, or containerized development environments; and
- all branches used to develop, validate, integrate, release, or repair Janumi software.

This policy governs concurrent repository modification. It does not replace repository-specific standards that impose stricter requirements.

## 4. Normative Language

The following terms are normative:

- **SHALL** and **MUST** establish mandatory requirements.
- **SHALL NOT** and **MUST NOT** establish prohibitions.
- **SHOULD** establishes a recommended control that may be departed from only for a documented reason.
- **MAY** establishes a permitted option.

Where this policy conflicts with a lower-authority procedure, prompt, agent instruction, or convenience practice, this policy SHALL govern unless an approved exception explicitly states otherwise.

## 5. Definitions

### 5.1 Coding Actor

A human developer, coding agent, subagent, automation process, code generator, refactoring tool, or other system capable of changing repository content or Git state.

### 5.2 Worktree

A Git working directory associated with a specific checked-out branch. Multiple worktrees created from one repository share the repository's Git objects and references but maintain separate working-directory state.

### 5.3 Isolated Working Directory

A worktree or clone in which one coding actor has exclusive control over uncommitted working-directory state for the duration of an assigned increment.

### 5.4 Integration Branch

The designated branch that represents the current shared, validated development baseline. The integration branch may be named `integration`, `develop`, `main`, or another repository-defined name.

### 5.5 Green Checkpoint

A repository state in which all validation gates applicable to the increment have passed, including required type checks, tests, linting, boundary checks, build checks, generated-artifact verification, security checks, and relevant end-to-end checks.

### 5.6 Shared Surface

A file, interface, contract, schema, vocabulary, registry, manifest, dependency container, barrel export, generated-artifact source, migration sequence, test fixture, or other repository element whose modification can affect work owned by multiple coding actors.

### 5.7 Source-of-Truth Artifact

The authoritative authored input from which generated artifacts are produced, such as a schema, vocabulary, interface definition, protocol definition, template, or model.

### 5.8 Integrator

The human or explicitly authorized orchestration process responsible for admitting work to the integration branch and enforcing the required validation gate.

### 5.9 Published Commit

A commit made visible to the authorized integrator and other affected coding actors through a shared local reference, approved remote branch, pull request, merge request, or equivalent repository mechanism.

## 6. Governing Principles

### 6.1 Isolation Before Vigilance

Repository safety SHALL be achieved primarily through structural isolation, not through reliance on coding actors manually avoiding one another's uncommitted changes.

### 6.2 Integration Through a Governing Baseline

The integration branch SHALL constitute the shared governing implementation state from which new increments begin and into which validated increments are admitted.

### 6.3 Event-Driven Synchronization

Synchronization SHALL occur at meaningful work and dependency boundaries. A fixed time interval MAY supplement synchronization but SHALL NOT replace event-driven synchronization.

### 6.4 Small, Validated, Traceable Change

Changes SHALL be committed in small logical increments, validated before submission, attributable to their authoring actor, and traceable to an authorized work item or intent.

### 6.5 Serialized Change at Chokepoints

Changes to shared contracts, source-of-truth artifacts, and other designated shared chokepoints SHALL be serialized so that only one active writer changes the governing source at a time.

### 6.6 Human or Designated Orchestration Authority

Coding agents SHALL operate under explicitly delegated repository authority. They SHALL NOT infer authority to push, rewrite history, integrate another actor's branch, approve exceptions, or discard another actor's work.

## 7. Mandatory Policy Requirements

### GIT-POL-001 — Isolated Concurrent Work

Each concurrently active coding actor SHALL work in a separate worktree or separate clone.

Two or more coding actors SHALL NOT concurrently modify files in the same working tree unless the conditions in Section 12, **Shared Working Tree Exception**, have been approved and are continuously satisfied.

### GIT-POL-002 — Unique Branch Assignment

Each isolated worktree or clone SHALL use a distinct branch.

A coding actor SHALL NOT commit directly to another coding actor's branch. A coding actor SHALL NOT take control of another actor's branch without explicit reassignment by the integrator or orchestrator.

### GIT-POL-003 — Governing Integration Branch

Each repository supporting concurrent coding actors SHALL designate an integration branch.

The integration branch SHALL remain buildable and shall satisfy the repository's required baseline gates. Direct implementation commits to the integration branch SHALL be restricted to the authorized integrator or to an explicitly authorized emergency procedure.

### GIT-POL-004 — Work Ownership and Surface Assignment

Before implementation begins, the orchestrator or integrator SHALL assign each coding actor:

1. an authorized work item or increment;
2. an owned branch and working directory;
3. a primary file, package, component, or capability scope;
4. any shared surfaces the actor is authorized to modify; and
5. any surfaces reserved to another actor or requiring serialized access.

Coding actors SHALL confine changes to their assigned scope unless an ownership change is explicitly recorded.

### GIT-POL-005 — Shared-Surface Coordination

A coding actor SHALL synchronize with the current integration branch immediately before modifying a shared surface.

Where two increments require changes to the same shared surface, the integrator SHALL establish an order of precedence. The later actor SHALL wait for the earlier change to land, synchronize from the updated integration branch, and then continue from the new governing state.

### GIT-POL-006 — Required Synchronization Events

A coding actor SHALL synchronize its branch with the current integration branch:

1. before beginning a new increment;
2. before modifying a shared surface;
3. after notification that a relevant contract, schema, registry, or dependency change has landed;
4. before publishing or submitting an increment for integration; and
5. after resolving any material integration conflict and before resubmission.

A coding actor SHALL NOT continue material implementation against a known stale governing interface.

### GIT-POL-007 — Local Worktree and Remote-Clone Synchronization

For worktrees sharing one local Git repository, commits on other local branches are available through shared local references. Coding actors SHALL use local branch synchronization rather than unnecessary network fetches to exchange local work.

For independently cloned or remote environments, coding actors SHALL fetch the authoritative remote references and synchronize from the current remote integration branch at each required synchronization event.

Remote push and pull operations SHALL be treated as transport, durability, review, and CI mechanisms; they SHALL NOT substitute for branch ownership, integration control, or validation.

### GIT-POL-008 — Green Checkpoints

A coding actor SHALL run every validation gate applicable to its increment before submitting the increment for integration.

A commit intended for publication or integration SHALL represent a green checkpoint. A temporary recovery commit MAY be created on a private branch solely to prevent work loss, but it SHALL NOT be submitted, merged, or represented as complete until the applicable gates pass.

### GIT-POL-009 — Logical Commit Integrity

Each submitted commit SHALL contain one coherent logical change or one inseparable group of changes required to preserve repository correctness.

Unrelated cleanup, opportunistic refactoring, formatting, dependency changes, or file rewrites SHALL NOT be included unless they are explicitly within the authorized scope.

### GIT-POL-010 — Prompt Publication of Validated Work

After a green increment is committed, the coding actor SHALL make the commit visible to the authorized integrator promptly through the approved publication mechanism.

A coding agent SHALL push to a remote only when remote-push authority has been explicitly delegated. Where agents do not possess push authority, the agent SHALL prepare the validated commit and notify the authorized human or orchestrator for publication.

### GIT-POL-011 — Explicit Staging

Coding actors SHALL stage changes by explicit path or another mechanism that identifies the intended change set with equivalent precision.

Coding actors SHALL NOT use blanket staging or committing commands, including `git add -A`, `git add .`, or `git commit -a`, unless a repository-specific approved procedure demonstrates equivalent isolation and verifies the complete resulting change set.

### GIT-POL-012 — Pre-Commit Verification

Before every commit, the coding actor SHALL verify:

1. the complete working-tree status;
2. the complete staged file set;
3. the staged diff or an equivalent content-level representation;
4. that no file outside the authorized scope is staged; and
5. that no change owned by another actor is included.

The coding actor SHALL remove unintended files or hunks from the staged set before committing.

### GIT-POL-013 — Destructive Git Operations

A coding actor SHALL NOT execute a destructive or broad state-changing operation unless it has first verified ownership, working-tree cleanliness, recovery availability, and authorization.

The following operations SHALL be prohibited during concurrent work except under an approved recovery or maintenance procedure:

- `git reset --hard`;
- `git clean` against unreviewed paths;
- `git checkout .` or equivalent whole-tree restoration;
- `git restore` against unreviewed broad paths;
- blanket `git stash` in a non-isolated working tree;
- forced branch movement; and
- any command that can discard, conceal, or overwrite another actor's uncommitted work.

Before restoring, resetting, checking out, or otherwise replacing a file with live edits, the coding actor SHALL create a recoverable commit or path-specific stash and SHALL verify that the recovery object contains the intended work.

### GIT-POL-014 — Path-Specific Stashing

Where a stash is necessary, the coding actor SHALL stash only explicitly identified paths within its authorized scope.

The coding actor SHALL restore the stash as soon as the diagnostic or temporary operation is complete and SHALL verify that all intended files and edits were restored.

A bare or blanket stash SHALL NOT be used in a shared working tree.

### GIT-POL-015 — Repository-Wide Rewrite Controls

Repository-wide formatting, code generation, automated migration, codemod, dependency normalization, or other broad rewrite operations SHALL NOT be performed unless:

1. the operation is explicitly within scope;
2. the actor has exclusive or coordinated ownership of the affected surface;
3. the worktree is isolated and its pre-operation state is recoverable;
4. the resulting diff is reviewed; and
5. the applicable validation gates pass.

When only specific files require formatting or regeneration, the coding actor SHALL target those files by explicit path.

### GIT-POL-016 — Shared Contracts and Source-of-Truth Artifacts

Only one authorized coding actor SHALL modify a designated shared contract, schema, vocabulary, protocol definition, or other source-of-truth artifact at a time.

A shared contract change SHALL be integrated as a discrete increment before dependent actors continue implementation against it.

Dependent actors SHALL synchronize from the integrated source-of-truth change before regenerating artifacts or implementing dependent behavior.

### GIT-POL-017 — Generated Artifacts

Generated artifacts SHALL be derived from the current integrated source-of-truth artifact using the repository-approved generator and configuration.

Two independently generated versions of the same artifact SHALL NOT be manually merged as competing sources of truth.

Where a generated artifact conflicts during synchronization, the coding actor SHALL resolve the governing authored source, synchronize from the accepted source, and regenerate the artifact. Manual edits to generated output SHALL NOT be used to bypass the generator unless an explicitly approved repair procedure requires them.

### GIT-POL-018 — Shared Registries and High-Contention Files

Shared registries, barrel exports, route manifests, dependency-injection containers, migration indexes, generated-code manifests, and similar high-contention files SHALL be designated and governed as serialized shared surfaces.

The integrator MAY assign a single owner or integration sequence for each such file. Coding actors SHALL comply with that assignment.

### GIT-POL-019 — History Integrity

Coding actors SHALL NOT rewrite published shared history without explicit integrator authorization.

The following actions SHALL NOT be performed on a published branch unless an approved repository procedure authorizes them:

- force push;
- amendment of a published commit;
- interactive rebase that changes published commit identity;
- deletion or replacement of another actor's published branch; or
- any operation that invalidates an active review or integration reference.

A private, unpublished agent branch MAY be rebased to synchronize with the integration branch, provided the branch is owned exclusively by that actor and no other process depends on its existing commit identities.

### GIT-POL-020 — Integration Authority and Admission Gate

Only the authorized integrator SHALL admit work to the integration branch unless the repository's approved workflow delegates that authority through a protected pull-request or automated merge process.

Before admission, the integrator SHALL verify:

1. scope and ownership compliance;
2. required gate results;
3. staged and committed change integrity;
4. synchronization with the current integration baseline;
5. conflict resolution quality;
6. generated-artifact consistency; and
7. required human or automated review.

Fast-forward-only integration SHOULD be used where the branch model permits it. Where merge commits or squash merges are used, the repository SHALL preserve traceability from the integrated change to its source branch, work item, validation evidence, and authoring actor.

### GIT-POL-021 — Conflict Handling

A coding actor SHALL resolve conflicts only within its authorized scope and only after synchronizing from the current governing baseline.

The coding actor SHALL stop and refer the conflict to the integrator when:

- the conflict includes changes owned by another actor;
- the correct governing behavior is ambiguous;
- the conflict affects a shared contract or source-of-truth artifact;
- resolution would require discarding another actor's work;
- the conflict exposes an undocumented architectural or requirements inconsistency; or
- the actor cannot demonstrate that the resulting state satisfies the applicable gates.

A coding actor SHALL NOT use destructive commands to make a conflict disappear without preserving and evaluating both sides of the conflict.

### GIT-POL-022 — Commit Message and Attribution Requirements

Each submitted commit SHALL include:

1. a concise description of what changed;
2. the intent or reason for the change;
3. a reference to the applicable work item, requirement, or authorized objective where available;
4. material validation gates executed and their outcome; and
5. the repository-approved human, agent, or co-author attribution trailer.

Attribution SHALL accurately identify the accountable human authority and any coding agent whose generated contribution is represented by the commit, consistent with repository policy.

### GIT-POL-023 — Integration Branch Health

The integration branch SHALL be treated as a controlled baseline.

When the integration branch fails a mandatory gate, new non-remediation integrations SHALL cease until the baseline is repaired or reverted. The integrator SHALL identify the responsible change, preserve relevant evidence, and coordinate restoration of a green baseline.

### GIT-POL-024 — No Unauthorized Disposition of Another Actor's Work

A coding actor SHALL NOT stage, commit, stash, restore, reset, delete, reformat, regenerate, move, or otherwise modify another actor's uncommitted changes without explicit authorization from the integrator and the responsible actor where available.

Discovery of another actor's uncommitted changes in an actor-controlled working directory SHALL be treated as a repository-safety incident.

### GIT-POL-025 — Stable Requirement Identifiers

Requirement identifiers in this policy SHALL remain stable after approval. Existing identifiers SHALL NOT be renumbered or reused. New requirements SHALL receive new identifiers, and superseded requirements SHALL retain their identifiers with an explicit supersession record.

## 8. Required Operating Model

The following operating model SHALL govern each concurrent increment:

1. **Assign.** The orchestrator SHALL define the work item, ownership scope, shared surfaces, branch, worktree or clone, gates, and integration authority.
2. **Synchronize.** The coding actor SHALL begin from the current integration branch and create or update its owned branch.
3. **Implement.** The coding actor SHALL modify only authorized files and SHALL avoid unrelated repository-wide changes.
4. **Validate.** The coding actor SHALL execute all applicable gates and SHALL correct failures attributable to the increment.
5. **Inspect.** The coding actor SHALL inspect working-tree status, staged files, and staged content before committing.
6. **Commit.** The coding actor SHALL create a small, logical, attributable commit at a green checkpoint.
7. **Resynchronize.** Before submission, the coding actor SHALL incorporate the current integration baseline and rerun gates affected by the synchronization.
8. **Publish.** The coding actor or authorized human SHALL publish the validated commit through the approved shared mechanism.
9. **Integrate.** The integrator SHALL review, gate, and admit the increment to the integration branch.
10. **Propagate.** Affected coding actors SHALL synchronize when the integrated increment changes a shared surface on which their work depends.

## 9. Synchronization Policy

### 9.1 Same-Repository Worktrees

When multiple worktrees share one Git repository, coding actors SHALL recognize that commits are visible through shared local references without a network fetch. Each actor SHALL nevertheless update its own branch explicitly from the current integration branch at the events defined in GIT-POL-006.

### 9.2 Separate Clones or Remote Agents

When coding actors operate in separate clones or remote environments, the authoritative remote integration branch SHALL be fetched before synchronization. An actor SHALL NOT assume that a previously fetched reference remains current.

### 9.3 Divergence Management

Divergence risk SHALL be assessed primarily by overlap in shared surfaces and governing interfaces, not solely by elapsed time or commit count.

The orchestrator SHALL increase synchronization frequency and may serialize work when two or more increments affect the same contract, schema, registry, generated-artifact source, or other high-contention surface.

## 10. Roles and Responsibilities

### 10.1 Designated Engineering Authority

The Designated Engineering Authority SHALL:

- approve this policy and material revisions;
- approve or reject policy exceptions;
- designate repository integration authority; and
- resolve conflicts between this policy and lower-level engineering instructions.

### 10.2 Orchestrator or Work Coordinator

The orchestrator SHALL:

- partition work and define ownership;
- identify shared surfaces and serialization requirements;
- establish branch and worktree topology;
- communicate relevant landed changes;
- prevent incompatible simultaneous assignments; and
- escalate architectural, contractual, or requirements ambiguity.

### 10.3 Coding Actor

Each coding actor SHALL:

- remain within assigned authority and scope;
- preserve another actor's work;
- synchronize at required events;
- validate and inspect its own changes;
- disclose failures, conflicts, uncertainty, and unintended modifications; and
- refrain from integration, push, history rewrite, or destructive operations beyond delegated authority.

### 10.4 Integrator

The integrator SHALL:

- maintain the health and authority of the integration branch;
- enforce admission gates;
- control shared-surface sequencing;
- verify traceability and attribution;
- resolve or assign conflict resolution; and
- stop integration when the baseline becomes untrustworthy.

### 10.5 Human Repository Authority

Where coding agents lack remote publication or merge authority, the human repository authority SHALL publish, review, or integrate validated agent work without unnecessarily allowing completed work to remain invisible to dependent actors.

## 11. Prohibited Practices

Unless an approved exception or recovery procedure expressly permits them, coding actors SHALL NOT:

1. share one working tree for concurrent uncommitted implementation;
2. use blanket staging or commit commands;
3. modify files outside assigned scope;
4. reformat or regenerate the repository broadly for convenience;
5. discard, conceal, or overwrite another actor's work;
6. manually merge independently generated artifacts;
7. continue against a known obsolete shared contract;
8. integrate work that has not passed applicable gates;
9. push without delegated push authority;
10. rewrite published shared history;
11. bypass the designated integrator; or
12. represent a red or partially validated increment as complete.

## 12. Shared Working Tree Exception

### 12.1 Approval

A shared working tree MAY be used only when isolated worktrees or clones are temporarily infeasible and the Designated Engineering Authority or delegated integrator approves the exception.

The exception SHALL identify:

- the reason isolation is infeasible;
- the participating coding actors;
- the exact file and directory ownership boundaries;
- the permitted duration;
- the integrator;
- the recovery mechanism; and
- any additional prohibited commands.

### 12.2 Mandatory Compensating Controls

During an approved shared-working-tree exception:

1. every actor SHALL stage only explicit paths;
2. every actor SHALL inspect `git status`, the staged file list, and the staged diff before each commit;
3. blanket staging, blanket stashing, whole-tree restoration, hard reset, cleaning, and repo-wide formatting SHALL be prohibited;
4. stashes SHALL be path-specific and SHALL be restored and verified immediately after use;
5. each actor SHALL commit promptly at green checkpoints;
6. no actor SHALL touch another actor's uncommitted files;
7. destructive file restoration SHALL require a verified recoverable commit or path-specific stash;
8. the integrator SHALL coordinate any shared-surface edit; and
9. the exception SHALL terminate as soon as isolation becomes available.

### 12.3 Incident Escalation

Any suspected commingling, deletion, overwrite, unintended staging, or unexplained change during a shared-working-tree exception SHALL cause affected work to stop. Participants SHALL preserve the current state and notify the integrator before attempting repair.

## 13. Exceptions

An exception to this policy SHALL:

1. be documented before the exception is exercised, except during an immediate repository-recovery emergency;
2. identify the specific policy requirement being waived;
3. state the business or technical necessity;
4. define compensating controls;
5. identify an accountable owner and approval authority;
6. specify an expiration condition or date; and
7. be reviewed after use when the exception involves data loss, history rewrite, bypassed validation, or another repository-safety incident.

Standing, implicit, convenience-based, or agent-inferred exceptions SHALL NOT be valid.

## 14. Compliance and Enforcement

Repository owners SHOULD enforce this policy through branch protection, access controls, CI admission gates, repository hooks, agent-harness constraints, worktree provisioning automation, ownership manifests, and auditable integration workflows.

Material noncompliance SHALL be reported to the integrator or Designated Engineering Authority. The affected increment SHALL NOT be integrated until the repository state and change provenance are trustworthy.

Repeated or systemic violations SHALL result in revision of the responsible workflow, agent permissions, prompts, harness controls, or repository architecture rather than reliance solely on renewed verbal instruction.

## 15. Records and Evidence

The repository or associated engineering system SHALL retain sufficient evidence to reconstruct:

- the work item and authorized intent;
- branch and actor ownership;
- relevant synchronization points;
- commit identity and attribution;
- validation results;
- review and integration decision;
- exceptions invoked; and
- repository-safety incidents and their disposition.

Evidence MAY be retained in commits, pull requests, CI records, agent-run logs, issue trackers, orchestration events, or other approved systems of record.

## 16. Policy Rationale

This section is explanatory and does not reduce the force of the normative requirements above.

A shared working tree permits one actor's broad staging, formatting, stashing, reset, checkout, restoration, or cleanup operation to absorb or destroy another actor's uncommitted work. Isolated worktrees eliminate most of this risk by separating working-directory state while preserving efficient local visibility of commits.

The cost of divergence is driven primarily by overlap in shared interfaces and chokepoint files rather than by time alone. Accordingly, this policy combines ownership partitioning, event-driven synchronization, serialized shared-surface changes, small green increments, and controlled integration.

Generated artifacts require special treatment because independent regeneration can amplify a small source difference into a large, difficult-to-review conflict. The governing source SHALL therefore be resolved first and generated outputs reproduced from that accepted source.

## Appendix A — Reference Branch Topology (Informative)

```text
integration                     shared validated baseline
├── agent-a/<work-item>         Agent A isolated branch/worktree
├── agent-b/<work-item>         Agent B isolated branch/worktree
└── agent-n/<work-item>         Additional isolated branch/worktree
```

No coding actor commits directly to another actor's branch. Agents synchronize from `integration`; the integrator admits validated work into `integration`.

## Appendix B — Reference Command Pattern (Informative)

The commands below illustrate one compliant local-worktree pattern. Repository-specific procedures SHALL determine exact names and commands.

```bash
# Provision isolated branches/worktrees from the governing baseline.
git worktree add ../repo-agent-a -b agent-a/work integration
git worktree add ../repo-agent-b -b agent-b/work integration

# At a required synchronization event, from an actor-owned branch.
git rebase integration

# Stage only authorized paths.
git add path/to/file-a path/to/file-b

# Verify scope and content before commit.
git status --short
git diff --cached --stat
git diff --cached

# Commit a green logical increment.
git commit

# Resynchronize before submission and rerun affected gates.
git rebase integration

# Integration is performed by the authorized integrator or protected workflow.
git switch integration
git merge --ff-only agent-a/work
```

Where remote publication is required, the authorized actor SHALL fetch or push in accordance with repository permissions and shall not use the remote operation to bypass integration controls.

## Appendix C — Change History

| Version | Status | Date | Description |
|---|---|---|---|
| 0.1.0 | Proposed | 2026-07-18 | Initial policy conversion from the engineering discussion concerning Git safety, worktree isolation, synchronization, generated artifacts, and two-agent integration. |
