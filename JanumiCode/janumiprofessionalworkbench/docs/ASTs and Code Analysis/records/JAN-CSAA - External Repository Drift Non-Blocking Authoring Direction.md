# JAN-CSAA External Repository Drift Non-Blocking Authoring Direction

**Record ID:** `JAN-CSAA-STANDING-DIRECTION-003`

**Record version:** `0.1.0`

**Status:** Effective procedural direction for autonomous corpus preparation; non-conferring and not a corpus ratification

**Recorded by:** Codex documentation author/integrator

**Recorder time:** `2026-07-28T15:29:46.4152177-04:00`

**Source:** Authoritative sponsor/user direction in the active authoring session

**Applies to:** Intermediate authoring, objective documentation verification, ledger closure, self-review, and preparation of the final JAN-CSAA corpus candidate in `docs/ASTs and Code Analysis/**`

---

## 1. Sponsor-originated direction

The sponsor/user directed:

> For the time being, your work is not impacted by the git updates of the other agent. You might want to consider stop checking git for that specific purpose at least because there are updates but they don't impact your work - no one else is working in your directory of documents nor sub-directories.

This is a procedural scope and concurrency direction. It is not an intermediate document disposition, a waiver of final review, an adoption act, or authority for implementation work.

---

## 2. Operative interpretation

For the remainder of autonomous corpus preparation:

1. Git commits and working-copy changes made by other agents outside `docs/ASTs and Code Analysis/**` SHALL NOT, solely by changing repository `HEAD`, implementation status, generated-file time, or running-process state, block intermediate documentation authoring or documentation-ledger closure.
2. The author SHALL stop polling Git for the purpose of treating such external activity as an intermediate closure invalidation.
3. Concurrency protection SHALL remain strict for `docs/ASTs and Code Analysis/**`. A change to an exact controlled preimage, evidence input, archive target, closure target, or transaction lock inside that subtree remains blocking.
4. Previously accepted repository observations remain dated snapshot evidence. After their observation windows they SHALL NOT be described as continuously current merely because intermediate authoring continues.
5. Intermediate objective closure SHALL mean closure of the named documentation-authoring commission against its exact Draft and ledger preimages. It SHALL NOT mean that the live implementation was reverified at the closure instant.
6. No source, test, configuration, dependency, provider, fixture, oracle, executable gate, register, staging area, or commit outside the documentation subtree is authorized by this direction.

---

## 3. Deferred consolidated refresh

The non-blocking rule does not erase implementation drift. Before the final corpus is frozen for sponsor review, the author SHALL perform one consolidated implementation-subject refresh against the then-selected repository state.

That refresh SHALL:

- identify the selected branch/revision and dirty state;
- reconcile material implementation/configuration changes with JAN-CSAA-005;
- update or supersede stale snapshot claims rather than silently relabel them;
- re-run affected objective and cross-package checks;
- identify any residual uncertainty or unreviewed external change;
- freeze exact candidate bytes and digests only after the refresh; and
- block any statement of live-current conformance that the refreshed evidence does not support.

If the implementation continues to move during final freeze, the final package SHALL state an explicit cutoff revision and observation window. The final sponsor review may then judge that exact bounded corpus without implying perpetual synchronization.

---

## 4. Relationship to prior standing direction

This record supplements, and does not replace:

- `JPWB-REG-005 REG-D-021`, which commissions autonomous documentation-corpus preparation and defers sponsor judgment to the exact final corpus;
- `REG-D-022`, which preserves role separation, no manufactured passes, and final itemized sponsor judgment; and
- the existing JAN-CSAA standing-direction and interpretation-correction records.

Where a prior intermediate procedure treated every out-of-subtree Git change as an immediate authoring blocker, this record controls for the current authoring run. Exact-document integrity, append-only historical evidence, final refresh, independent assurance, and final sponsor review remain mandatory.

---

## 5. Non-conferral

This direction:

- does not ratify JAN-CSAA-001, JAN-CSAA-002, JAN-CSAA-005, or any other corpus member;
- does not convert a Draft into Proposed;
- does not convert snapshot evidence into live-current evidence;
- does not declare implementation correctness or behavior preservation;
- does not accept another agent's source changes;
- does not waive author self-review or independent post-Proposed assurance; and
- does not authorize final register or README carriage.

Its sole effect is to prevent unrelated external repository activity from repeatedly invalidating intermediate work confined to the controlled documentation subtree.
