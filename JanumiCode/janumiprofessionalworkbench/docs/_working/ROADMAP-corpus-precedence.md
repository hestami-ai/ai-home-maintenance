# ROADMAP — making REG-D-034 operative

**Parent design:** `DESIGN-corpus-precedence.md` · **Authorising act:** REG-D-034 (sponsor ruling, 2026-08-09),
merged into CON-000 **B1** / **B3** / **B8**.

**Why a roadmap at all.** The ruling is now constitutional text. Constitutional text that nothing enforces is the
defect CON-000 **B7** names in terms — *"no artifact, object, or field may claim a status its relations do not
perform"*. Three same-day instances this session of a written rule failing to bind (the fold-in-the-minting-commit
rule, the C-0b anchor rot, my own agent prompts) are the argument for gating rather than trusting.

Each increment: red-first → implement → mutants with predicted reds → full gate → register → commit.

---

## Part A — What the ruling already settled

| | |
|---|---|
| ~~**P-1** State the precedence in a ratifiable location~~ | ✅ **DONE** in REG-D-034's own merge. CON-000 B1 (registry + SOURCE OF RECORD role), B3 (traceability + the silence clause), B8 (reversal + provenance exception), B6 (scope clarified), Ratify Sheet rows 22/24/29 synchronised. |

## Part B — Increments

| # | increment | blocker | notes |
|---|---|---|---|
| **P-2** | **Provenance reachable at the point of use** | none | ⚠ **RULING 3 PROMOTED THIS FROM CONVENIENCE TO A REQUIREMENT.** B3 now says canon governs a principle *only where a divergence carries a ratifying act*. **To apply B3 at all you must be able to (a) resolve a canon clause to its source lines and (b) check the register for an act naming it.** Today (a) means knowing the sidecar exists and reading prose; (b) means grepping. A clause nobody can apply is B7's hollow, one level up. Build a reader over the 6 sidecars + 52 extracts exposing `provenanceOf(clauseId)`. |
| **P-3** | **Gate the absence rule** | P-2 | B3's silence clause and REG-F-093's standing rule are prose today. A control must assert that any register entry claiming an absence names the sources it searched. **Its own mutant is a fabricated absence entry the control must catch** — without that it is a control that cannot fail. |
| **P-4** | **Repair `ASR-14` and `ASR-16`** | P-2 | Unblocked by ruling 3 **without further sponsor input**: both diverge from source, both weaken a prohibition, both have an instrumented NONE FOUND for a ratifying act, so under B3 both are DEFECTIVE and their sources control. `ASR-14`: a categorical *"cannot waive a critical integrity failure"* became *"may be non-waivable"*. `ASR-16`: canon permits what its own first-cited source forbids. **Repair means restoring the source's strength in canon, not weakening the source.** |
| **P-5** | **Re-examine the register under the absence rule** | P-2, P-3 | REG-F-093 swept **six** questions and found four answered. **The rest of the register has never been re-read against the source corpora.** On that hit rate this is the highest-yield item here, and it is deliberately sequenced last so the tooling exists before the sweep rather than after. |

## Part C — What this roadmap does not claim

- **It does not claim the fidelity audit was complete.** 87 clauses were checked. The canon corpus is larger, and
  the audit sampled families (STA, AGG/OBJ, PER, ASR, CON-000 B*, DOC-001). **Un-audited clauses are unknown, not
  faithful** — and five of six audited families were refuted in both directions, so a single pass is not evidence.
- **It does not claim P-4 is mechanical.** Restoring a prohibition's strength is a canon edit; it follows from
  B3 without a new ruling, but each repair must cite the source line whose strength it restores and record the
  divergence it closes.
- **It does not settle D-2** (need the source corpora be ratified? recommendation: **no** — they are authoritative
  for detail as source material, and ratifying 60+ exploratory documents is a large act for little gain).
- **It does not extend to the RPH set's internal order.** M0's intra-corpus precedence governs source-vs-source and
  is untouched by REG-D-034; under Ruling 1 M0 stays readable for provenance regardless of its own standing
  (REG-Q-026).
