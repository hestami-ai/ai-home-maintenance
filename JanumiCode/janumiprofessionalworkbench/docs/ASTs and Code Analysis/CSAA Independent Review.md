Independent Review · 2026-08-10

# The corpus solved the hard intellectual problem and never started the engineering one

A critique of JAN-CSAA-000 through \-011, the Codebase Semantic Analysis and Assurance corpus for the JPWB TypeScript repository.

SUBJECT / 446 FILES / 120,872 LOCCORPUS / 23,411 LINES / \~5,850 SHALLPROVIDERS / UNSELECTED / NOT\_RUNIMPLEMENTATION / 0 BYTES

## **Verdict**

The intellectual asset is real and I want to be unambiguous about it before criticising anything. The non-equivalence discipline running through every member — *zero static callers ≠ dead code*, *test passed ≠ behavior preserved*, *unsupported ≠ empty ≠ passed*, *named is not selected; declared is not installed; configured is not executed* — is the correct spine for the originating problem, and it is stated more precisely here than in most commercial static-analysis documentation. It is not boilerplate and it was not obvious.

The bookkeeping is genuinely rare too. Counts verify. Digests recompute. Line-level citations into the subject resolve. And the pattern in what our adversarial reviewers *killed* is itself evidence of quality: **20 of 33 candidate findings died**, most of them on text one paragraph further on, or on a deferral that was recorded and owned rather than hidden. The corpus is more careful than a fast reading suggests. Its problem is not incoherence. Its problem is proportion, and one specific blind spot.

Three facts decide it.

**First, nothing in 3.2 MB states what this costs or how big the subject is.** A corpus-wide grep for engineer-month, headcount, cost-benefit, off-the-shelf, or prior art returns zero hits. No member states the subject's file count, LOC, or a measured analysis wall time — for a 446-file, single-team, "private": true workspace whose full type-check runs in about 31 seconds. README §17's eighteen adversarial review questions are excellent at asking whether a document overclaims. Not one asks whether the programme is worth its cost.

**Second, the two artifacts that answer the sponsor's actual question were never written.** The sponsor asked what documents would get the tool suite *developed*. JAN-CSAA-W4-DESIGN-001 and JAN-CSAA-W4-ROADMAP-001 sit inside REG-D-021's commissioned scope, and the roadmap is a mandatory component of the final sponsor package. Both have zero bytes. Mentions of them across the status records run 7, 4, 3, 2, 1, 0 — then zero for nine consecutive records. In that same window the programme produced 530,734 bytes across nine revisions of a catalog whose job is resolving 116 Markdown hyperlinks.

**Third — and this is the one I would not have believed without checking — the corpus's own assurance instrument has recorded a PASS over a hole in its own specification.** records/JAN-CSAA-003 \- Objective Author Verification Record.md:48 certifies JAN-CSAA-003-VER-QRY-001 | Literal, negation, conjunction, disjunction, existential, universal … | PASS. The word *disjunction* occurs exactly once in the entire 151 MB corpus: in that PASS row. JAN-CSAA-003 claims ownership of query semantics and defines negation only — no conjunction, no disjunction, no composition rule for any of its six orthogonal epistemic dimensions. This is the precise failure mode the corpus exists to prevent, occurring inside the corpus.

Name it precisely, because "too much process" is the lazy diagnosis and it is not quite right. This is **process capture with a self-sustaining record economy**. The programme applies real adversarial rigor to whether documents overclaim; it has no criterion at all for whether it costs too much; and its verification methods measure *form* — cell counts, row counts, non-blank predicates — rather than content. That combination is stable and self-reinforcing: it will keep producing verifiable, well-governed, internally consistent records indefinitely, and never produce an analyzer.

The counter-proof is inside the same repository. During the thirteen days the corpus spent specifying an AST-based analyzer while formally recording the TypeScript Compiler API as UNSELECTED / NOT\_RUN / NOT\_QUALIFIED, the same team **shipped one**. verif/ grew from 383 to 6,517 lines — including arrow-command-census.ts, 451 lines importing typescript and calling ts.createSourceFile, running inside the test gate. The corpus cites none of it. The natural experiment already ran, and the executable branch won.

## **Measured**

| Quantity | Value |
| :---- | :---- |
| Subject codebase | 446 files · 120,872 LOC |
| Corpus specification (12 members) | 23,411 lines · 3.2 MB |
| Entire ratified JPWB canon it is subordinate to | 1,953 lines |
| Normative clauses across the corpus | \~5,850 SHALL |
| Records tree · requirement ledgers | 22 MB · 18 MB |
| Whole corpus directory | 151 MB |
| Members with authority | 0 of 11 — all Draft |
| Providers selected (incl. TypeScript Compiler API) | 0 of 18 |
| Machine-readable bytes in the corpus | 0 — no typed code fence anywhere |
| Fixture files, schema files, tests produced | 0 |
| verif/ growth over the same 13 days | 383 → 6,517 lines (17×) |
| Repository drift since the inventory's bound subject | 267 commits · 339 files · \+50,817 / −7,386 |
| Commits landed *during* this review | 3 |

## **What genuinely holds**

* **The non-equivalence discipline is the real contribution**  
* JAN-CSAA-011 §2 extends it to tooling with unusual precision: *"named is not selected; declared is not installed; locked is not installed; configured is not executed; executed is not healthy; healthy is not semantically conformant."* These name, in a few lines, the exact false-green vectors that defeat agent-driven analysis.  
* **The doctrine is converted into obligations that would constrain a real implementation**  
* CSAA-001-FLW-025  
* forbids treating zero static callers as proof of deadness while any dynamic-entry mechanism is unresolved. Checked against this repository, that rule is load-bearing: SvelteKit's filesystem-convention entrypoints and  
* command-bus.ts  
* 's registry dispatch both have no static caller. A naive dead-code pass here deletes working code. That rule needs no analyzer to enforce — it is usable today.  
* **The capability catalog reflects real TypeScript expertise**  
* JAN-CSAA-003 §5's profiles land the things that separate a genuine analyzer from a naive one:  
* CAP-011  
* — "an unresolved specifier is not an absent dependency";  
* CAP-012  
* — conditional exports resolve per condition set, not universally;  
* CAP-025  
* — "no static caller count is meaningful without this reachability surface."  
* **Oracle independence is specified as a structural control, not an exhortation**  
* JAN-CSAA-008 §13.3: *"Provider output cannot become the oracle by copying, majority vote, snapshot update, or acceptance-baseline regeneration"* — backed by dedicated harness mutants. JAN-CSAA-006 §16 correctly generalises independence across "producer, reviewer, agent, model, provider, hidden context, prompt lineage, and authority" for an LLM-authored pipeline.  
* **The evidentiary binding in JAN-CSAA-005 is exemplary**  
* §3 binds every fact to a parent commit, git tree objects, digests of normalised manifests, and a sub-second observation window — then explicitly refuses to present that historical subject as the present worktree. This is how inventory evidence should be recorded.  
* **The programme reports its own failures rather than passing itself**  
* Two open MAJOR findings currently block it; §21 and §24 nonperformance tables list "design, roadmap, final refresh, Proposed freeze, independent assurance, sponsor review, conferral" as absent. That honesty is what makes the rest of this critique possible.

## **Findings — 13 survived adversarial refutation**

F-1Major

### No instrument in the corpus can ask whether the programme is worth its cost

Claim

The corpus states no effort, duration, team size, expected defect yield, or subject magnitude anywhere, and none of its acceptance instruments contains a cost, benefit, or throughput criterion — so \~5,850 clauses, including 1,100 of enterprise-database operations engineering in JAN-CSAA-009, are unconditioned on any scale a reader can check.

Evidence

grep over all twelve members for engineer-month|headcount|cost-benefit|off-the-shelf|prior art → 0 hits.

"proportional" occurs exactly twice, neither about programme cost.

README §§17–21 (18 review questions, 3 Definitions of Done, 1 of Ready) contain no cost, benefit or throughput criterion.

Consequence

There is no principled way to cut the corpus down, because no obligation is conditioned on a scale a reader can check. A team adopting it must build a hosted, multi-tenant, encrypted, DR-covered, dual-run-migratable index service for a local dev tool — or cut arbitrarily and lose the claim to conformance.

Remedy

Publish a one-page sizing note under JAN-CSAA-005's ownership: 446 files / 120,872 LOC / 11 packages, measured turbo check-types wall time, dependency-cruiser module and edge counts, estimated node/edge cardinality for one full pass. Then resolve exactly one operational profile — local-single-process — and mark JAN-CSAA-009's multi-tenant, encryption and DR sections not-applicable to it.

F-2Major

### The design and the implementation roadmap have zero bytes and have fallen out of the plan of record

Claim

The two artifacts that answer the sponsor's third question are named inside the commissioned scope, and the roadmap is mandatory in the final sponsor package — yet neither exists, and both stopped being mentioned nine status records ago.

Evidence

REG-D-021: "…cross-corpus closure records, **repository-specific design, and detailed implementation roadmap**."

Roadmap mentions per status record: 7, 4, 3, 2, 1, 0, then 0 × 9 consecutive.

Same window: 530,734 bytes across 9 revisions of the Historical Triplet Ledger Link Resolution Catalog.

Consequence

The sponsor's question — which documents get the suite developed — is unanswered, and the programme has stopped tracking the deliverable that would answer it. An engineer handed the corpus gets \~5,850 clauses, zero work packages, and no build order.

Remedy

Restore both to the next status record with their blocking predicate named. Close JAN-CSAA-010-SR-001 and \-011-SR-001 ahead of any further catalog or reconciliation record — they are the stated blockers. Then author the roadmap, capped at ten pages: first buildable increment, its acceptance evidence, its measured cost.

F-3Major

### The query algebra defines no conjunction or disjunction — and the corpus's own record certifies those exact branches as PASS

Claim

JAN-CSAA-003 claims ownership of query semantics and forbids JAN-CSAA-007 from changing that meaning, yet no file in the corpus states how conjunction or disjunction composes the four predicate-truth values, or how any of the six orthogonal epistemic dimensions compose.

Evidence

§9.3: "Negation SHALL preserve unknown and conflict." — negation only.

§9.3: "Joins SHALL compose predicate truth and every orthogonal epistemic dimension separately. They SHALL NOT replace dimension-specific composition with one scalar 'weakest state.'" — removes the fallback, supplies no rule.

"conjunction" / "disjunction" in the specification: 0 occurrences.

records/JAN-CSAA-003 \- Objective Author Verification Record.md:48 → "…conjunction, disjunction, existential, universal… | **PASS**"

Consequence

Two conforming implementations will disagree on supported-true AND unknown and every dimension composition, and both pass every check the document defines. More seriously: a verification instrument that passes a section which does not exist is not measuring content.

Remedy

Nine small tables discharge it: 4×4 for AND and for OR, 1×4 for NOT, and one composition table per orthogonal dimension. Publish them into §9.3 before JAN-CSAA-007 encodes operators whose meaning it does not own. Separately, reopen JAN-CSAA-003-VER-QRY-001 to FAIL and audit every other verification row that names a branch rather than checking one.

F-4Major

### The corpus never reads the subject's own evidence: a 75-finding defect register and a working AST census sit uncited inside the analyzed repository

Claim

The subject repository contains both a ready-made ground-truth corpus of what actually breaks in it, and a working TypeScript-Compiler-API instrument built by the same team for exactly the class of problem CSAA targets. A recursive grep across all corpus files plus the records tree returns zero references to either.

Evidence

docs/\_working/HARMONIZATION-FINDINGS.md — "107 raised, **75 confirmed**, 32 refuted"; 64 of 75 verdicts CODE\_IS\_WRONG; every row file:line-anchored. Example: "The Command envelope's expectedRevision is never read anywhere in the engine" — a pure symbol/reference-index query.

verif/arrow-command-census.ts — 451 lines, imports typescript, calls ts.createSourceFile / ts.forEachChild, runs in the gate. Shipped 2026-08-08, mid-corpus.

Consequence

The corpus's entire premise is being specified with no empirical baseline, while the one set of known-true findings against this exact repository sat unread inside it. Nothing in the programme can currently answer *"would a CPG have found these 75?"* — which is the question that decides whether the remaining work is worth doing.

Remedy

Add a §15.4 to JAN-CSAA-005 inventorying the repository's own recorded defect and instrument corpora as an artifact class. Then classify each of the 75 confirmed findings on one axis: *could an AST / symbol-index / call-graph / dataflow analyzer in principle have caught this?* That single number is the business case, and it is a day's work.

F-5Major

### Provider qualification is unreachable, and the corpus forbids requesting the authorization that would unblock it

Claim

JAN-CSAA-011 §27 places provider execution outside every permitted next activity, REG-D-021's no-expansion boundary excludes it from the standing commission, and CSAA-011-VFY-013 prohibits requesting the sponsor's authorization until the entire corpus is final. An agent following the rules has no reachable path to empirical validation of anything it specifies.

Evidence

CSAA-011-VFY-013: "The sponsor SHALL remain reserved to one review of the final exact full corpus and SHALL NOT be requested for intermediate disposition."

JAN-CSAA-011 §7: all 18 candidates — including TypeScript Compiler API — read UNSELECTED / NOT\_RUN / NOT\_QUALIFIED.

§24: "Preparation-control network lookup deviation | UNAUTHORIZED\_NETWORK\_LOOKUPS\_EXCLUDED / PRIMARY\_SOURCE\_VERIFICATION\_NOT\_PERFORMED"

Consequence

94 KB converts the sponsor's build-or-buy question into eighteen UNSELECTED rows and then closes every evidence path to resolving them. Non-selection is defensible only when the resolving act is defined and scheduled. Here it is scheduled nowhere.

Remedy

Carve one bounded exception into CSAA-011-VFY-013: permit exactly one intermediate sponsor request whose subject is "authorize a time-boxed provider spike." Then run one under the §12 isolated profile — Joern or CodeQL over packages/rph-domain, \~50 files — and feed it into §18's six qualification predicates.

F-6Major

### The currentness discipline is not applied to the corpus's own controlling instruments

Claim

README.md — the only Normative document — carries eleven of twelve manifest rows that are factually wrong about the members they govern; and JAN-CSAA-008 §3.1 binds six controlled inputs by byte count and SHA-256 that no longer match the live files it hyperlinks.

Evidence

README §9 rows for 003, 004, 006–011 read "Unaudited and unauthored | Reserved; later wave not commissioned | None" — for files that exist as authored Drafts totalling 2.7 MB (009 alone \= 386,317 bytes).

Rows for 001, 002, 005 read "0.1.0 / Draft" — all three headers now read 0.3.1.

README §9.1: "manifest metadata and document metadata SHALL change together."

Consequence

The document the charter routes every reader through first is the least accurate artifact in the corpus, and carries no currentness caveat at the point of use. A reader following README §13.2 concludes that eight documents do not exist.

Remedy

Add a §9.0 currentness note naming the highest Working Corpus Authoring Status record as the authority on artifact state; replace the eleven stale cells with "Authored under REG-D-021; lifecycle state carried by the current working-status record"; add that record as the first node of §13.1's reading sequence. REG-D-021 already permits this as administrative carriage — it changes no obligation.

F-7Major

### The records tree — including 121 MB of "immutable" archive — is git-ignored and invisible even to git status

Claim

A single .gitignore line excludes the entire corpus records directory, so 258 of 366 record files — including 140 of 161 archive snapshots and the requirement ledgers for members 003, 004 and 006–011 — exist only as untracked working-tree files on one machine.

Evidence

.gitignore:311 → "…/docs/ASTs and Code Analysis/records/\*"

git status \--porcelain \--untracked-files=all → 0 lines. The files are invisible even as untracked.

Untracked: JAN-CSAA-009 \- Requirement Ledger.md (5,000,788 bytes), 008 (4,098,520), Status 032, the archive snapshots.

Against REG-D-021: "requirement ledgers, self-reviews, independent adversarial reviews… must remain inspectable."

Consequence

A corpus whose entire thesis is revision-bound, provenance-bearing evidence has staked its own evidentiary base on files version control cannot see. A routine git clean \-xdf — which nothing warns against — destroys the sole mechanism for resolving historical identity.

Remedy

Decide this week and record the decision. Either negate the exclusion and commit the tree, or — if 143 MB is genuinely unwanted in history — accept that the archive duplicates what git already provides, delete it, and resolve historical identity through git object ids instead.

F-8Moderate

### The verification apparatus measures form, not content

Claim

Verification methods across the corpus's largest artifacts have pass conditions that are structural non-emptiness or count reproduction rather than content, so 18 MB of ledgers and 46 KB of matrices certify shape while the substance goes unchecked.

Evidence

JAN-CSAA-006-VER-CAP-001: "The 32 × 8 capability matrix contains exactly 256 nonblank traceable cells."

Measured: 32 of 32 rows cite identical scenario sets across POS/PAR/CON/DYN and identical sets across NEG/UNK/STA/NVA → 64 distinct bindings across 256 cells; each column has exactly 1 distinct trailing text. The ARP "Non-bypass" column has one text across all 17 rows.

That span is 46,051 bytes — 31.9% of the file.

Consequence

Passing VER-CAP-001 proves a template string was pasted 467 times. A reviewer who believes those matrices carry 467 independently-reasoned expectations is wrong by roughly 4×. This is the same defect as F-3, one layer down: the instrument checks that a cell is non-blank, not that it says anything.

Remedy

Rewrite the three VER-\*-001 methods to require distinct, non-template content — "no column may contain fewer than N distinct expectation texts" — and replace the per-cell expansion with a compact applicability grid plus a short list of the genuinely capability-specific cells. Retire the cell-count acceptance criterion.

F-9Moderate

### The inventory's subject has drifted past the point where a hand-authored inventory can catch up

Claim

JAN-CSAA-005 is the only member containing real facts about the real repository, and its refresh is deferred until the whole corpus is authored — but the subject moves faster than the corpus does.

Evidence

Bound subject: parent commit 0e7893f5, 2026-07-28.

Since then: 267 commits, 339 files, \+50,817 / −7,386 lines.

packages/\*/src TS 252 → 322 (+28%); \*.test.ts 150 → 206 (+37%); verif/ tests 4 → 30; three of four coverage thresholds moved.

Three further commits landed during this review.

Consequence

Moderate rather than major, because the drift deferral is sponsor-directed and recorded, the §7.1 counts are correctly labelled HISTORICAL\_RECORDED\_SUBJECT\_ONLY, and they verifiably do not propagate as current facts into downstream members. But a consolidated refresh authored by hand will be stale on the day it lands, and the corpus concedes this without treating it as a design problem.

Remedy

Stop hand-authoring the inventory. Generate it. The repository already has the precedent: scripts/spec-obligations.ts is 299 lines that derive a normative claim from source and ship with a self-test, written after a hand-derived count was found wrong three ways. A generated JAN-CSAA-005 is always fresh, satisfies the corpus's own revision-binding doctrine, and is the natural first vertical slice of the analyzer.

## **What we could not sustain**

Twenty of thirty-three candidate findings were killed by adversarial re-checking. Several were ones I had formed independently. They are listed because a critique that reports only its hits is not evidence.

* **"The programme self-authorized past its charter."** False. REG-D-021 is a genuine sponsor-originated standing commission that activates Waves 2–4 documentation authoring, quoting the sponsor verbatim. The manifest staleness in F-6 is *expressly sanctioned* by the same entry — "the adopted README manifest… need not churn for every Draft revision" — which is why F-6 is a usability defect, not a governance breach.  
* **"Zero of eleven members received their mandatory independent review."** Dissolved by the same entry: the standing commission defers review to one final exact-corpus event.  
* **"The critical path to first code is a deadlock."** Refuted one paragraph past the cited text. README §19 expressly carves out "separately commissioned oracle-stream fixture, reference-contract, or red-first conformance-test construction." The path is *unscheduled*, not blocked — which is F-2, and a much easier fix.  
* **"JAN-CSAA-007 became the prose shape authority its own charter forbade."** Refuted. Appendix C.1 defines a formal machine-parseable grammar (/payload/rawPayloadDigest:DigestDescriptor:1:SCALAR:ID:SELF) explicitly intended for regeneration. The residual is narrower: the registry→schema hop is obligated at materially shallower depth than the schema→TypeScript hop.  
* **"The fixture document contains no fixture."** Measured true — zero code fences — but not a defect in JAN-CSAA-006, which discloses the state ("Design specified; repository not created") and defers repository shape to 007 by design. The residual is programme sequencing risk, and it belongs to F-2.  
* **"The candidate tool universe is closed and incumbency is unrepresentable."** Refuted. JAN-CSAA-011 §7's status token has an incumbency axis (NOT\_DECLARED\_AT\_ROOT vs CONFIG\_AND\_LOCK\_EVIDENCE\_ONLY). The real, smaller defect: no single row joins "config-and-lock evidenced" to "already wired into gate:fast", so a reader of 011 alone cannot see that eight candidates already run in the subject's own gate.

## **Monday**

* **Stop authoring records.**  
* Not the corpus — the records. The last specification edit was 2026-08-03; the eleven days since produced status records, reconciliation records, and catalog revisions. That is the loop to break first.  
* **Classify the 75 confirmed findings.**  
* One axis: could an AST, symbol-index, call-graph, or dataflow analyzer in principle have caught this? A day's work. That number — not another matrix — decides whether the remaining 99% is worth building, and it is the only artifact that can.  
* **Run one bounded provider spike.**  
* Joern or CodeQL against  
* packages/rph-domain  
* , \~50 files, under the isolated execution profile 011 §12 already defines. One executed row converts eighteen UNSELECTED cells into evidence and answers the sponsor's original question.  
* **Write**  
* **W4-ROADMAP-001**  
* **, capped at ten pages.**  
* First buildable increment, its acceptance evidence, its measured cost. Make the generated  
* JAN-CSAA-005  
* that increment — it satisfies the corpus's own doctrine, retires a document that cannot stay current by hand, and is the analyzer's first real component.  
* **Settle the records durability question.**  
* git add \-f  
* the tree, or delete the 121 MB archive. Do not leave the sole historical-resolution mechanism one  
* git clean \-xdf  
* from gone.  
* **Move the five transferable rules into**  
* **JPWB-DOC-004**  
* **.**  
* The operative 376-line protocol already carries "never imply a check passed that did not run" and "absence of evidence is not evidence of absence." What CSAA adds and DOC-004 lacks is small and specific: the dead-code / dynamic-entry frontier rule, analyzer disagreement, single-provider security claims, index freshness, and edge provenance. Five rules, ratifiable this week, valuable with or without an analyzer.

**Method.** Thirty agents: one deep reader per corpus member plus a governance reader, six cross-cutting lenses (question-fit, prior art, buildability, consistency, epistemics, proportionality), eleven adversarial skeptics instructed to refute rather than confirm, and one synthesis pass. 146 candidate findings raised, 33 verified, 13 survived, 20 refuted. Every quantitative claim above was independently re-measured against the working tree and git history on 2026-08-10. Where a reviewer's evidence did not hold on re-check, the finding was dropped and is listed under *What we could not sustain*.  
