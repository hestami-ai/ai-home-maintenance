# Assessment: requirements_agent / nfr_bloom_enrichment (Phase 2.2.2)

**Sample:** `track_c_samples/12_requirements_agent__nfr_bloom_enrichment.md`
**Reviewed agent:** `requirements_agent` running `qwen3.5:9b` (497-byte JSON response, ~19.8 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`
**Reviewer outcome:** `has_concerns: false`, 0 findings

---

## 1. What this sample reveals

This is **Pass 2 of 3 (Threshold + Measurement Enrichment)** for Sub-Phase 2.2 — the NFR-side parallel to sample 10's FR-AC enrichment, and the canonical home of the original ChatGPT 5.5 assessment's `measurement_adequacy_validator`. By prompt contract, this pass receives **one** NFR skeleton plus the substrate it traces to and emits the same JSON object with `seed_threshold` dropped and `threshold` + `measurement_method` written. Producing exactly one enriched NFR per call is the *expected* shape, so the 497-byte response size is not, on its face, an output-substantiveness defect. (See §1a.0 below — `output_substantiveness_check` would pass on this sample for the right reason: the prompt asked for ~two short strings and the agent supplied them.)

What the sample tests, and the question this assessment closes for Phase C.2, is whether **the original ChatGPT 5.5 measurement-adequacy battery — count-equality, set-equality, null/orphan, threshold mismatch, weak proxy, time-window, "zero direct traffic" without observation surface, executability — engages at full original strength** when the response is a single NFR's `threshold` + `measurement_method` pair. The answer is yes, with one rotation: the FR-side enrichment exercise was at the *acceptance-criterion array* level (sample 10), and the count/set/null patterns there fired on inter-AC arithmetic; here at NFR enrichment the same patterns fire on the **(threshold, measurement_method)** pair viewed as one mini-verifier. The defect catalogue does not shrink; the unit of inspection rotates.

The relationship to sample 10 (FR enrichment, same agent role, same pass index) governs validator reuse, exactly as sample 11 reused sample 09's family. The enrichment pipeline carries forward by parameter variation (FR→NFR), and one new validator is needed at this pass that did not appear at FR enrichment: an `output_substantiveness_check`, deterministic and cheap, distinguishing "single-NFR contract satisfied with two strings" from "agent emitted a near-empty placeholder."

The reviewer's `hasConcerns: false` is structurally consistent with its `concerns: []` (so the contradictory-Boolean failure mode that motivated the original assessment does not fire here), but it is mis-calibrated against the actual response: the response carries one HIGH measurement-adequacy defect ("zero direct traffic" without an observation-surface predicate), one HIGH threshold-grounding defect (the `1-minute cadence` invention), and one HIGH grounding defect (the `WAF` instrument), all of which are within the original ChatGPT 5.5 template's standing scope.

### 1a.0 Output-substantiveness check (negative finding — passes)

The Pass-2 enrichment contract is "echo six fields; drop one; author two strings (`threshold`, `measurement_method`)." The agent's final response satisfies that contract:

- The six echoed fields (`id`, `category`, `description`, `priority`, `traces_to`, `applies_to_requirements`) are byte-equal to the input skeleton.
- `seed_threshold` is correctly dropped.
- `threshold` is a non-empty 78-character string.
- `measurement_method` is a non-empty 121-character string.

A 497-byte response is exactly the expected order of magnitude for a single-NFR enrichment with the prompt's exemplar-style brevity. `output_substantiveness_check` — a new deterministic validator detailed in §4.x below — passes.

This negative finding matters because output size is *the* signal a downstream pipeline would naturally use to gate "did the agent do the work?" It must be calibrated against the contract, not against absolute byte counts; otherwise every legitimate single-unit enrichment would be falsely flagged.

### 1a. Defects in the agent's response

The two authored strings are:

```
threshold:           "Zero direct traffic reaching the origin IP on the public network layer."
measurement_method:  "Automated external port scanning and WAF log analysis at 1-minute cadence;
                      zero-tolerance alerting on any direct hit."
```

The substrate is impoverished:

- Traced V&V Requirements: `(none)`
- Traced Quality Attributes: `(none)`
- Traced Compliance Items: `(none)`
- Traced Technical Constraints: `TECH-ORIGIP-1 (security) [Origin IP] No direct client access to the origin IP is permitted`

Every defect below pivots on the gap between the categorical commitment ("Zero ... direct traffic") and the substrate's silence on *how* that "Zero" is observed.

#### 1a.1 "Zero direct traffic" without observation surface — HIGH (measurement adequacy, canonical original-assessment pattern)

The original ChatGPT 5.5 `measurement_adequacy_validator` enumerates eleven defect patterns. **The tenth pattern in that list reads, verbatim:**

> "zero direct traffic" requirement without checking both access logs and network paths

The current sample is the canonical instance. The threshold says "Zero direct traffic reaching the origin IP." The measurement method names *port scanning from outside* (a network-path probe, partial) and *WAF log analysis* (an access-log probe, partial *and* contingent on WAF being the only ingress path). It does not assert anything about **the origin host's own ingress** — the perimeter where "direct traffic" would actually arrive if it slipped past the CDN/WAF. A misconfigured firewall rule that admits direct traffic on a port the external scanner does not probe (e.g., a backend admin port, an internal management VLAN bridged accidentally to the public side, an IPv6 route the scanner doesn't enumerate) would pass both stated checks while the requirement is materially false.

The minimum repair shape combines three observation surfaces:

```
EXISTS observation o on origin host's network interfaces WHERE
  o.source_ip ∉ allowed_proxy_set
  AND o.destination_port ∈ public_listener_set
THEN the NFR is violated. The check must reconcile:
  (a) origin-host packet capture / VPC flow log of inbound on origin ENI
  (b) network ACL / security-group configuration audit (declared paths == observed paths)
  (c) external multi-port multi-protocol probing (scan)
```

The agent supplied (c) and an indirect proxy for (a) (WAF logs), but (a) and (b) are the *load-bearing* surfaces — the WAF logs only show traffic the WAF saw, by definition. This is a HIGH `measurement_adequacy_validator` finding under the pattern "the condition can pass while the stated requirement is materially false."

#### 1a.2 Ungrounded measurement cadence ("1-minute cadence") — HIGH (threshold grounding)

The substrate is silent on cadence. TECH-ORIGIP-1 names *what* (no direct access) but not *how often it is checked*. The agent's thinking chain explicitly works through this and decides to invent the cadence by **copying the exemplar**:

> *"Is '1-minute cadence' justified? If the constraint is 'No direct access', checking every minute is good for critical security. Okay."*
>
> *"Let's check the examples in the prompt: `Synthetic availability probe at 1-minute cadence`. So '1-minute cadence' is an acceptable pattern."*

That is the textbook `exemplar_leakage_detector` failure mode the FR enrichment validator catches at sample 10: an exemplar's *value* (1-minute) imported as if it were grounded. The exemplar's role is to demonstrate *form*; the cadence number itself was illustrating availability, not origin-IP exposure, and the agent's substrate names neither cadence regime. The chain's own reasoning establishes the leak: the agent considered "24-hour cadence" and "Continuous" before settling on "1-minute" *because the exemplar used 1-minute*.

This is HIGH under `threshold_grounding_audit` (ungrounded numeric in a binding measurement commitment) and MEDIUM under `exemplar_leakage_detector` (exemplar value reused as authored content). The double-fire is the design overlap noted at sample 10 §4.6 / §4.4.

#### 1a.3 Ungrounded instrument identifier ("WAF") — MEDIUM (grounding)

The substrate names no Web Application Firewall. TECH-ORIGIP-1 names "Origin IP" with the prose "No direct client access to the origin IP is permitted." The traced-handoff context for this Pass-2 invocation does not include a CDN, WAF, or proxy. The agent imports "WAF" from background knowledge — and the thinking chain confirms this is an inference, not a citation:

> *"This is about hiding the origin IP, likely via a load balancer, WAF, proxy, or NAT layer."*

"Likely via" is the operative phrase: the agent guesses the instrument set, then writes the most specific guess into the binding `measurement_method` string. Under the original §2 grounding template, this is `unsupported_claim` / `fabricated_entity`: the measurement now binds the platform to a WAF-shaped observability stack the substrate has not authorised. If the platform's actual edge is, say, an AWS NLB + Cloudflare (without WAF logs in the relevant tier), the measurement string is non-executable.

Severity is MEDIUM rather than HIGH because the broader corpus (cf. sample 11) does include `TECH-CDNF-1` and a Cloudflare/origin-IP regime, and a generous reader would treat "WAF" as shorthand for that edge layer. But this Pass-2 invocation does not receive that broader substrate — only TECH-ORIGIP-1 — so within the bounds of the inputs to this call, "WAF" is an invented instrument.

#### 1a.4 Ungrounded port set / scan target ("Automated external port scanning") — MEDIUM (executability)

`measurable_condition_executability` (sample 10 §4.9) asks: *could a QA engineer run this test from the string alone?* The string says "Automated external port scanning" with no port set, no source IP set, no protocol set, and no acceptance threshold for scan results. A QA engineer would have to invent:

- which ports (22, 80, 443, 8080? full TCP/UDP sweep? top-N most-common?)
- from where (a single SaaS scanner? geographic diversity? inside-the-VPC vs outside-the-VPC?)
- against what target (the documented origin IP? all IPs in the origin's subnet? any IP that DNS-resolves from the public hostname?)
- and how a "direct hit" is distinguished from a legitimate proxy-fronted hit on the same port (the WAF and the origin both listen on 443; how does the scan tell them apart?)

The thinking chain even surfaces some of these alternatives (`Nmap/Shuffle ... 22, 80, 443, 8080`) before discarding them in favour of the bare phrase. That is `incomplete_predicate` at MEDIUM.

#### 1a.5 Threshold tightening without substrate authorisation — LOW (skeleton drift, marginal)

The `seed_threshold` says "No direct traffic reaching origin IP allowed." The authored `threshold` adds "*on the public network layer*." This narrowing is mostly faithful — the description echoes the same scope ("permitted on the public network layer") — but it is a Pass-2 commitment that *internal* network paths (private peering, VPN, internal management) are *out of scope* of this NFR. Whether that scoping is correct depends on substrate the prompt does not include. Since the description itself includes the qualifier and the agent is bound to echo (not invent) the description, this is not skeleton drift in the strong sense, but the threshold is more specific than the seed.

LOW. Worth recording because it is the kind of silent narrowing that downstream consumers might not notice.

#### 1a.6 No exemplar leakage in the threshold string — negative finding

The exemplar block in the prompt offers six threshold templates, including:

```
"Zero cross-tenant read leaks across the continuous penetration-test suite;
 any single incident fails the NFR."
```

A naive copy-and-paraphrase would have substituted "cross-tenant read leaks" → "direct origin connections" and kept "across the continuous penetration-test suite; any single incident fails the NFR." The agent did *not* do this — its threshold string is shaped by the substrate's wording (`"No direct traffic reaching origin IP"`) plus the addition of "Zero." This is a clean axis. The threshold-side exemplar leakage check passes; the leakage was confined to `measurement_method` (§1a.2).

#### 1a.7 Schema and echo invariance — clean (negative finding)

`enrichment_echo_invariance` would pass byte-equally on all six echoed fields. `seed_threshold` is correctly dropped. The `contract_schema_enrichment_nfr` checks (parameter-varied from sample 10's FR contract: top-level keys exactly `{id, category, description, priority, traces_to, applies_to_requirements, threshold, measurement_method}`) all pass. No markdown fences. No prose. JSON parses.

#### 1a.8 Reasoning chain pathology — LOW (cost, not correctness)

The thinking chain is 19,764 characters for a 497-byte response — a 40× ratio, near-identical to sample 10's 41× ratio. The chain consists of `"Wait, ..."` re-evaluations of the same threshold/measurement string roughly fifteen times, producing five draft pairs before committing to the sixth. This is the same Gemma-tier failure mode flagged at sample 10 §1a.6: the agent self-loops on constraint restatement instead of committing to a verified pair. It does not affect correctness on this sample (the last revision matches the output, so `reasoning_to_response_faithfulness` does not fire), but it is a **cost** signal worth surfacing in pipeline observability.

### 1b. Reviewer performance

`hasConcerns: false`, `concerns: []`, with the prose summary: *"The reasoning is highly sound, robust, and demonstrates excellent adherence to all governing constraints. The agent successfully translated a high-level technical constraint ('No direct client access') into a precise, measurable, and actionable NFR threshold and measurement method. The proposed measurement method is specific enough to be actionable (naming instruments and cadence) while remaining grounded in the security context. No logical flaws or unsupported assumptions were found."*

Calibration verdict: **mis-calibrated; misses the canonical pattern this pass exists to catch.**

The summary's exact phrasing — *"specific enough to be actionable (naming instruments and cadence) while remaining grounded in the security context"* — is precisely the inversion of the truth. The instruments and cadence are *the* ungrounded elements (§1a.2, §1a.3, §1a.4). The reviewer mistakes the *appearance of specificity* (a named instrument, a numeric cadence) for *grounding-in-substrate*, exactly the failure mode sample 10 also documented and exactly the reason the original ChatGPT 5.5 assessment was authored. The Boolean gate is internally consistent (false / empty), so the contract-schema-style failure of sample 11's reviewer (`hasConcerns: false` with non-empty concerns) does not recur — but the **substantive miss is identical in shape to samples 02–11**: a Gemma-class single-pass reviewer with broad scope confidently declares clean on a response whose defects are semantic-verification-shaped rather than structural.

The pattern is now closed across all twelve samples in Phase C.2: at the role-and-pass granularity the broad `reasoning_review` prompt was designed for, broad scope produces broad blindness. The remediation is the same in every assessment: narrow validators with positive-mission framing and a deterministic prefix wherever cheap.

### 1c. What carries forward from sample 10 (FR enrichment) and what newly engages

| Validator | FR enrichment (sample 10) | NFR enrichment (this sample) |
|---|---|---|
| `contract_schema_enrichment` | active (FR shape: AC array) | **parameter-vary** → `contract_schema_enrichment_nfr` (top-level `threshold` + `measurement_method` strings; no AC array) |
| `enrichment_echo_invariance` | active (echo skeleton minus AC array) | **carry as-is** (echo skeleton minus `seed_threshold`; both checks reduce to `assert_deep_equal(skeleton.except(authored_fields), response.except(authored_fields))`) |
| `ac_count_discipline` | active (3–7 ACs) | **deactivated** (no AC array; one threshold + one method is the contract) |
| `exemplar_leakage_detector` | active (exemplar AC values) | **carry as-is** (exemplar threshold/measurement values; fires here on `1-minute cadence` import) |
| `source_attribution_grounding` | active (per-AC anchor) | **parameter-vary** → per-`(threshold, method)` anchor against substrate set |
| `threshold_grounding_audit` | active (numerics in AC conditions) | **carry as-is** at full original scope (numerics in `threshold` + `method`); **fires HIGH on `1-minute cadence`** |
| `grounding_validator` | active (endpoints, codes, error names) | **carry as-is**, claim set rotated to instruments / cadences / observation surfaces |
| `measurement_adequacy_validator` | active (full original scope) | **carry as-is at FULL ORIGINAL SCOPE** — the centerpiece of this pass; fires HIGH on §1a.1 |
| `measurable_condition_executability` | active (per-AC executability) | **parameter-vary** → `measurement_method_executability` (per-method-string executability; fires MEDIUM on §1a.4) |
| `skeleton_drift_audit` | active (FR scope drift past skeleton) | **parameter-vary** → NFR threshold/method drift past skeleton's `description` and `category`; LOW on §1a.5 |
| `pass_scope_discipline` | Pass-2 boundary (no NFR thresholds in FR ACs) | **parameter-vary** — Pass-2 boundary for NFRs (no Pass-3 verifier work, no new traces, no new categories) |
| `assumption_citation_validator` | trace-only | trace-only |
| `reasoning_to_response_faithfulness` | active | active (does not fire here — chain's last revision matches output) |
| `open_question_vs_decided` | active | active (no Q-* in this sample) |
| `reasoning_quality_validator` | active | active (LOW on the 40× chain ratio) |
| `tier_decomposition_validator` | inactive | inactive (re-engages at NFR saturation in 2.2.3 and beyond) |
| `final_synthesis` | active | active |
| **NEW** `output_substantiveness_check` | not needed (multi-AC arrays make trivial output structurally impossible) | **NEW at NFR enrichment** (single-string contract makes near-empty output structurally possible; deterministic) |

---

## 2. Diagnosis

NFR enrichment's failure surface is parametrically identical to FR enrichment's, with the unit of measurement-adequacy inspection rotated:

| Axis | FR enrichment (sample 10) | NFR enrichment (this) |
|---|---|---|
| Inspection unit | per-AC `(description, measurable_condition)` pair, N≈3–7 per response | the single `(threshold, measurement_method)` pair |
| Fabrication surface | endpoints, status codes, error names, sibling status enums | instruments, cadences, observation surfaces, scan targets |
| Drift | scope drift past skeleton's outcome (e.g., search/list capability bolted onto status-update FR) | threshold tightening past skeleton's seed (e.g., narrowing to "public network layer" without substrate) |
| Measurement-adequacy patterns at full strength | existence-as-coverage, transition-as-postcondition, weak proxy, executability | "zero X" without observation surface, weak proxy on instrument coverage, time-window without grounding, executability of the method string |
| Output-size failure mode | structurally impossible (≥3 ACs per the contract) | structurally possible (single string each) — needs deterministic floor |

Two diagnostic claims close out Phase C.2:

1. **The original ChatGPT 5.5 `measurement_adequacy_validator` engages at full strength here, not at FR enrichment.** Sample 10 fires the validator on AC-level patterns (existence-as-coverage on AC-014, weak proxy on AC-017); the eleven-pattern list is partially exercised. The current sample fires the validator on *exactly* pattern #10 ("'zero direct traffic' requirement without checking both access logs and network paths") — verbatim from the original list. Both samples need the validator at full scope. Re-paraphrasing or narrowing it at either pass loses signal.

2. **`output_substantiveness_check` is the only new validator this pass requires** that did not appear at FR enrichment. The deterministic prefix grows by one. Everything else is parameter-varied reuse from sample 10.

The pipeline below restores the original validator at full scope (centerpiece), parameter-varies sample 10's enrichment family (FR→NFR), adds `output_substantiveness_check` to the deterministic prefix, and retires `ac_count_discipline` (no work to do at NFR enrichment).

---

## 3. Recommended validator pipeline for this role

Pipeline order (deterministic first, then narrow LLM, synthesis last):

```
1.  contract_schema_enrichment_nfr        (deterministic; parameter-varied from sample 10)
2.  enrichment_echo_invariance            (deterministic; reused; echo skeleton minus seed_threshold)
3.  output_substantiveness_check          (deterministic; NEW for NFR enrichment)
4.  exemplar_leakage_detector             (deterministic; reused; threshold + method strings)
5.  source_attribution_grounding          (LLM; reused, parameter-varied for (threshold, method) anchors)
6.  threshold_grounding_audit             (LLM; reused at FULL ORIGINAL SCOPE)
7.  grounding_validator                   (LLM; reused; claim set rotated to instruments/cadences/surfaces)
8.  measurement_adequacy_validator        (LLM; reused at FULL ORIGINAL ChatGPT 5.5 SCOPE — centerpiece)
9.  measurement_method_executability      (LLM; parameter-varied from sample 10's measurable_condition_executability)
10. skeleton_drift_audit                  (LLM; reused, parameter-varied for threshold/method drift)
11. pass_scope_discipline                 (LLM; reused, parameter-varied for NFR Pass-2 boundary)
12. assumption_citation_validator         (LLM; reused, trace-only)
13. reasoning_to_response_faithfulness    (LLM; reused)
14. open_question_vs_decided              (LLM; reused if Q-* refs present)
15. reasoning_quality_validator           (LLM; reused unchanged)
16. final_synthesis                       (LLM; reused unchanged)
```

**FR-enrichment ↔ NFR-enrichment parametrization summary:**

| Sample 10 validator | NFR enrichment fate |
|---|---|
| `contract_schema_enrichment` | **parameter-vary** → `contract_schema_enrichment_nfr` (no AC array; `threshold`, `measurement_method` instead) |
| `enrichment_echo_invariance` | **carry as-is** (mechanical: echo skeleton minus the authored fields) |
| `ac_count_discipline` | **deactivated** (no AC array) |
| `exemplar_leakage_detector` | **carry as-is** (exemplar threshold/method strings instead of AC strings) |
| `source_attribution_grounding` | **carry as-is**, anchor surface rotated |
| `threshold_grounding_audit` | **carry as-is at FULL ORIGINAL SCOPE** (numerics, cadences, status-code-shaped tokens) |
| `grounding_validator` | **carry as-is**, claim set rotated to instruments/cadences/observation surfaces |
| `measurement_adequacy_validator` | **carry as-is at FULL ORIGINAL ChatGPT 5.5 SCOPE** — centerpiece |
| `measurable_condition_executability` | **parameter-vary** → `measurement_method_executability` |
| `skeleton_drift_audit` | **parameter-vary** → threshold/method scope drift past skeleton description/category |
| `pass_scope_discipline` | **parameter-vary** — NFR Pass-2 boundary |
| Everything else | carry as-is |

**Genuinely new at NFR enrichment:**
- `output_substantiveness_check` (deterministic) — distinguishes a contract-satisfying minimal response from a near-empty placeholder. Deterministic floor on (`threshold` length, `measurement_method` length, presence of at least one measurable predicate token). Likely cross-role candidate at any pass whose contract authors a fixed-arity small string set.

**Deactivated at this pass:**
- `ac_count_discipline` (no AC array).
- `tier_decomposition_validator` still inactive; re-engages at NFR saturation.

---

## 4. Validator prompt templates

All LLM validators inherit the revised positive-mission shared envelope from `redesign recommendations - 1.md`. Validators reused without modification from samples 09, 10, or 11, or from the original assessment, are referenced by name and not reproduced. The `measurement_adequacy_validator` template at this pass is **the original ChatGPT 5.5 §3 template verbatim**; do not paraphrase.

### 4.1 `contract_schema_enrichment_nfr` (deterministic, parameter-varied)

Implemented in code. Pseudocode contract:

```
ASSERT response is valid JSON
ASSERT top-level keys exactly == { id, category, description, priority,
                                   traces_to, applies_to_requirements,
                                   threshold, measurement_method }
ASSERT no markdown fences, no prose before "{", no prose after "}"
ASSERT no unescaped double quotes inside string values
ASSERT response.id matches /^NFR-\d{3}$/
ASSERT response.category is in the allowed-categories enum from sample 11 §4.1
ASSERT response.priority is in the allowed-priorities enum
ASSERT response.threshold is a non-empty string
ASSERT response.measurement_method is a non-empty string
ASSERT "seed_threshold" key NOT present
ASSERT response.traces_to is a non-empty array of strings
FOR each trace_id in response.traces_to:
  ASSERT trace_id matches /^(VV|QA|TECH|COMP|UJ)-/
ASSERT response.applies_to_requirements is an array
FOR each fr_id in response.applies_to_requirements:
  ASSERT fr_id matches /^US-\d{3}$/   # bare FR id, no AC suffix
```

Severity rule: any failure ⇒ HIGH (Pass-3 verifier will reject).

For this sample, this validator passes.

### 4.2 `enrichment_echo_invariance` (deterministic, reused)

Sample 10 §4.2 template, parameter-swapped:

```
LET skeleton  = the input NFR skeleton (from prompt's "NFR Skeleton" block)
LET response  = the agent's final response

FOR field in { id, category, description, priority }:
  ASSERT response[field] == skeleton[field]                     (byte-equal)

ASSERT response.traces_to == skeleton.traces_to                 (order-equal)
ASSERT response.applies_to_requirements == skeleton.applies_to_requirements  (order-equal)
ASSERT "seed_threshold" NOT in response                         (correctly dropped)
ASSERT "threshold" in response and "measurement_method" in response  (authored)
ASSERT no NEW key in response not in the schema set
```

Severity rule: any echo violation ⇒ HIGH; missing required authored field ⇒ HIGH; presence of `seed_threshold` ⇒ MEDIUM (contract requires drop).

For this sample, this validator passes.

### 4.3 `output_substantiveness_check` (deterministic, NEW)

Mission-equivalent pseudocode:

```
LET t = response.threshold
LET m = response.measurement_method

# floors
ASSERT len(t) >= 30 chars and len(m) >= 30 chars   # one-sentence minimum
ASSERT t contains at least one MEASURABLE-PREDICATE token, where the
       MEASURABLE-PREDICATE set is:
         - any of {"Zero", "Every", "100%", "exactly", "at most", "at least",
                   "no more than", "no fewer than"}
         - any numeric+unit token (regex: /\d+(\.\d+)?\s*(ms|s|min|hour|day|year|%)/i)
         - any falsifiable boolean phrase ("must fail", "must succeed",
           "must be", "is not", "is bounded by")
ASSERT m contains at least one INSTRUMENT-TOKEN, where the INSTRUMENT-TOKEN
       set is non-vague-monitoring: explicit instrument family names
       (Prometheus, OTEL, Signoz, scanner, probe, log analyzer, hash chain,
       audit harness, penetration test, ...) — i.e., NOT bare "monitoring"
       or "testing" or "observability"
ASSERT m contains at least one CADENCE-TOKEN OR an explicit triggering rule
       (cadence: "/(continuous|nightly|daily|weekly|hourly|N-minute|N-second|
        per deploy|every release|on every commit)/i")
ASSERT NOT (t == skeleton.seed_threshold)            # not a verbatim echo
ASSERT NOT (m is a near-paraphrase of t)             # method is not a
                                                     # restatement of the
                                                     # threshold
```

Severity rule:
- `len(t) < 30` or `len(m) < 30` ⇒ HIGH (near-empty enrichment).
- missing MEASURABLE-PREDICATE in `threshold` ⇒ HIGH (aspirational threshold; carry-forward of sample 11 §4.5 `threshold_presence_check`).
- missing INSTRUMENT-TOKEN in `measurement_method` ⇒ MEDIUM ("vague monitoring" pattern).
- missing CADENCE-TOKEN ⇒ LOW (Pass 2 should usually name *when*, but some thresholds — e.g., one-off compliance audits — are inherently cadence-less).
- threshold echoes seed_threshold verbatim ⇒ MEDIUM (no enrichment work performed).
- measurement_method paraphrases threshold ⇒ MEDIUM (collapsed pair).

For this sample, this validator passes on every check (`len(t)=78, len(m)=121`, contains "Zero", contains "WAF" + "port scanning" as instrument tokens, contains "1-minute cadence" as cadence token, threshold ≠ seed_threshold). Note: this validator passing is **not** a defence of the response — its job is the floor, not the ceiling. The substantive defects fire downstream.

This validator is recommended as a **cross-role candidate** at any pass whose contract emits a small fixed set of authored strings; the same template applies (mutatis mutandis) to architecture-decision authoring, ADR rationales, and similar small-arity authoring contracts.

### 4.4 `exemplar_leakage_detector` (deterministic, reused)

Sample 10 §4.4 template, with the corpus rotated to threshold + method strings:

```
LET exemplar_block = JSON.parse + textextract(prompt section listing
                     "Acceptable forms" thresholds and measurement methods)
LET exemplar_strings = collect every threshold-shaped and method-shaped
                       phrase in the exemplar (e.g., "p95 API response
                       time ≤ 800ms over rolling 5-minute windows", "Zero
                       cross-tenant read leaks", "Synthetic availability
                       probe at 1-minute cadence")
LET response_strings = { response.threshold, response.measurement_method }

FOR (e, r) in exemplar_strings × response_strings:
  IF normalized_levenshtein_similarity(e, r) >= 0.85:
    emit HIGH "exemplar leakage" (e, r)
  ELSE IF longest common substring length(e, r) >= 25 chars:
    emit MEDIUM "exemplar fragment reuse"

LET exemplar_value_tokens = { "1-minute cadence", "p95", "≤ 800ms",
                              "rolling 5-minute windows", "0.1%", "5xx",
                              "99.9%", "7 years", "2× and 10×",
                              "1-minute cadence from two geographic regions" }
FOR token in exemplar_value_tokens:
  IF token appears in response_strings AND substrate does not name token:
    emit MEDIUM "exemplar value reuse without grounding"
```

Severity rule as embedded.

For this sample, fires MEDIUM on `1-minute cadence` (exemplar value reuse without grounding — see §1a.2). The token also appears in the exemplar's availability example, and the substrate names no cadence.

### 4.5 `source_attribution_grounding` (LLM, reused, parameter-varied)

Sample 09 §4.4 template, with `[INSPECT]` retargeted at the (threshold, method) pair:

```
At NFR enrichment pass, identify the substrate item(s) that
response.threshold and response.measurement_method invoke (V&V threshold
fields, quality-attribute prose, technical-constraint clauses, compliance-
item language, vocabulary terms). Verify that those substrate items are
reachable from skeleton.traces_to.

Flag a (threshold, method) pair whose authored content invokes substrate
items not in skeleton.traces_to.
```

Severity rule unchanged from sample 09.

For this sample, fires informationally (the only traced substrate item is TECH-ORIGIP-1; the threshold echoes its content, the method invokes WAF + port scanning, neither of which is named in TECH-ORIGIP-1). The attribution defect is reported by `grounding_validator` at the right severity; here the validator passes through.

### 4.6 `threshold_grounding_audit` (LLM, reused at FULL ORIGINAL SCOPE)

Sample 10 §4.6 template carries as-is. The claim set at NFR enrichment is:

- numeric tokens in `threshold` (latency budgets, error rates, percentages, retention windows)
- numeric tokens in `measurement_method` (cadences, sample sizes, scan frequencies)
- categorical tokens (`Zero`, `100%`, `Every`, `At most N`)
- HTTP status codes / error codes if present
- named status enums if present
- *and the full set of cadence numerics in measurement_method*

A threshold token is GROUNDED when the same value (modulo unit conversion) appears in the seed_threshold, in any traced V&V threshold field, in any traced compliance-window obligation, or in any traced quality-attribute commitment.

Severity rule (sample 10): ungrounded numeric in a binding threshold ⇒ HIGH; ungrounded cadence ⇒ HIGH (the cadence binds the platform to an observability tier the substrate has not authorised); ungrounded HTTP status code ⇒ MEDIUM; ungrounded sibling-status enum ⇒ MEDIUM.

For this sample, fires HIGH on `1-minute cadence` (see §1a.2).

### 4.7 `grounding_validator` (LLM, reused at FULL ORIGINAL SCOPE)

Original §2 template, with `[CLAIMS TO CHECK]` rotated for NFR enrichment:

```
At NFR enrichment, in addition to the original list, pay attention to:
- instrument names (WAF, Prometheus, OTEL, Signoz, Nessus, Nmap, Cloudflare,
  load balancer, sidecar) — flag if not present in substrate or traced
  technical constraints
- observation-surface names (access logs, VPC flow logs, packet capture,
  network ACL audit, ingress logs) — flag if not present in substrate
- cadence regimes (1-minute, daily, nightly, on-deploy) — flag if not
  authorised by an SLO/SLA/V&V seed
- alerting / paging instruments and routes ("zero-tolerance alerting",
  "pages on-call") — flag if not present in substrate
```

Severity rule from original; ungrounded instrument ⇒ MEDIUM (HIGH if it is the *sole* observation surface for a HIGH-priority NFR).

For this sample, fires MEDIUM on `WAF` (§1a.3). `Automated external port scanning` is borderline — the act of "external port scanning" is plausibly inferable from any "block public traffic" NFR — but the MEDIUM rests on the absence of any substrate-anchored choice of scanner.

### 4.8 `measurement_adequacy_validator` (LLM, reused at FULL ORIGINAL ChatGPT 5.5 SCOPE) — centerpiece

**Use the original ChatGPT 5.5 §3 template verbatim.** The full eleven-pattern `[COMMON DEFECT PATTERNS]` list applies, with pattern #10 — *"'zero direct traffic' requirement without checking both access logs and network paths"* — load-bearing for this sample.

For NFR enrichment, the inspection unit is the (threshold, method) pair viewed as one mini-verifier:

> Question: could the (threshold, method) pair pass on a happy path while the underlying NFR is materially false?

The eleven-pattern enumeration applies to NFR enrichment as follows:

| Original pattern | NFR-enrichment instance |
|---|---|
| "100%" requirement verified by "> 0" | `100% retention` threshold paired with `audit log exists` method |
| "every record" verified by count equality without nulls/orphans | `Every privileged mutation produces an audit entry` paired with method that counts entries without joining to mutation-event source |
| uniqueness requirement verified by total count | `Unique audit-id per mutation` paired with `count(audit_entries) = count(mutations)` |
| existence vs coverage confusion | `Zero cross-tenant reads` paired with `tenant-isolation harness exists` (existence of harness ≠ coverage of all reads) |
| status alignment without defining populations | `99.9% availability` paired with `synthetic probe at 1-min` from a single region (population = single-region external view) |
| time-window without timestamps | `≤ 800ms p95` paired with method that doesn't bound the window |
| external linkage without referential integrity | `every audit chained to previous` paired with hash check that doesn't verify hash-chain integrity end-to-end |
| critical/high severity without filter | `zero critical CVEs` paired with scanner method that doesn't filter by severity |
| immutable/audit trail without append-only | `audit trail immutable` paired with method that reads but doesn't verify append-only |
| **"zero direct traffic" without both access logs and network paths** | **the present sample (§1a.1)** |
| SQL-like condition not executable / ambiguous | method string that names "WAF logs" without naming the WAF |

Severity rule from original §3 unchanged.

For this sample the validator fires:
- HIGH on the (`Zero direct traffic`, port scanning + WAF logs) pair — pattern #10 (§1a.1).
- MEDIUM on the same pair under "SQL-like condition not executable / ambiguous" — the method is non-executable as written (§1a.4).

### 4.9 `measurement_method_executability` (LLM, parameter-varied)

Sample 10 §4.9 template, parameter-varied:

```
[MISSION]
Verify that response.measurement_method could be turned into a runnable
operational check by a security/reliability engineer without inventing
missing instruments, sources, or thresholds.

[INSPECT]
For response.measurement_method:
- Are referenced instruments named specifically enough to procure or
  configure? ("WAF" is ambiguous if the substrate names no specific WAF;
  "Cloudflare WAF" or "AWS WAFv2" would be specific.)
- Is the observation source named? (port scan from where? log read from
  which sink?)
- Is the trigger / cadence named?
- Is the alerting endpoint or escalation route named when "alerting" is
  mentioned?
- Is the sample / scope explicit when "scanning" is mentioned? (which
  ports? which IP ranges? which protocols?)

[BOUNDARY]
Whether the executable check would adequately verify the threshold
belongs to measurement_adequacy_validator. This validator only asks:
"could an operator turn this string into a deployed control?"

[FINDING SHAPE]
{ severity, type: "ambiguous_instrument|missing_observation_source|
                   missing_cadence|incomplete_alerting|missing_scope",
  fieldSpan (quoted), recommendation }
```

Severity rule: ambiguous instrument ⇒ MEDIUM; missing observation source on a HIGH-priority NFR ⇒ HIGH; missing scope on scanning ⇒ MEDIUM.

For this sample, fires MEDIUM on `Automated external port scanning` (missing scope; §1a.4).

### 4.10 `skeleton_drift_audit` (LLM, parameter-varied)

Sample 10 §4.10 template, parameter-varied:

```
[MISSION]
Verify that the authored threshold and measurement_method stay within
the commitment named by skeleton.description and skeleton.category, and
the substrate items in skeleton.traces_to.

[INSPECT]
- Does response.threshold tighten the seed_threshold's scope without
  substrate authorisation? (e.g., adding "on the public network layer"
  when the seed says "No direct traffic to origin IP" — borderline,
  acceptable if description carries the qualifier)
- Does response.threshold loosen the seed_threshold's scope? (more
  serious — would water down the NFR)
- Does response.measurement_method commit to instruments or observation
  surfaces outside the NFR's category?
- Does response invoke a different quality attribute than skeleton.category?

[FAILURE PATTERNS]
- security NFR enriched with maintainability-style measurement
- compliance NFR enriched with performance-style measurement
- threshold that adds a population restriction not in skeleton.description
- threshold that adds a temporal restriction not in any traced source

[BOUNDARY]
Grounding of new instruments belongs to grounding_validator. This
validator only judges whether the AUTHORED PAIR remains within the
SKELETON's commitment.

[FINDING SHAPE]
{ severity, type: "scope_tightening|scope_loosening|category_drift|
                   substrate_widening",
  fieldSpan, skeletonAnchor, recommendation }
```

Severity rule: scope loosening ⇒ HIGH; category drift ⇒ HIGH; scope tightening ⇒ LOW–MEDIUM (LOW if description carries the qualifier; MEDIUM if it does not).

For this sample, fires LOW on §1a.5 (scope tightening — "on the public network layer" — but the description carries the qualifier).

### 4.11 `pass_scope_discipline` (LLM, reused, parameter-varied)

Sample 10 §4.11 template, retargeted for NFR Pass-2:

```
At NFR enrichment, the boundary moves:
- threshold and measurement_method MUST be authored.
- All other fields MUST be echoed.
- seed_threshold MUST be dropped.
- Pass-3 deterministic-verifier work (referential-integrity assertions
  across the NFR set) is OUT OF SCOPE for this pass.
- New trace ids are OUT OF SCOPE.
- New categories are OUT OF SCOPE.
- AC arrays / FR-style decomposition are OUT OF SCOPE.

[INSPECT]
- response invokes implementation choices (e.g., specific cloud vendor
  products) that exceed Pass-2's authoring scope?
- response invokes Pass-3-style cross-NFR claims (e.g., "this NFR
  supersedes NFR-006" — Pass-3 absorption work)?
```

Severity rule: introducing new traces / categories ⇒ HIGH (caught by `enrichment_echo_invariance` first); premature implementation binding ⇒ LOW.

For this sample, fires LOW (the WAF / port-scan instrument choice is mildly implementation-coupled, but the prompt's exemplars sanction this style).

### 4.12 `assumption_citation_validator` (LLM, reused, trace-only)

Same as sample 10 §4.12. The enrichment contract has no `surfaced_assumptions[]`, so the citation half remains the only active half. Mission: verify every `traces_to[]` entry resolves to a real handoff id and matches the prefix whitelist (`VV | QA | TECH | COMP | UJ`). Severity rule unchanged.

For this sample, this validator passes (`TECH-ORIGIP-1` is correctly shaped and resolves).

### 4.13 `reasoning_to_response_faithfulness` (LLM, reused)

Same as sample 10 §4.13. At NFR enrichment, expect this validator to fire when:
- the chain commits to a specific threshold pair and emits a different one;
- the chain identifies a defect in its draft and emits the unfixed version anyway.

For this sample, this validator does NOT fire materially: the chain wavers across many drafts but the *last* committed pair matches the response. The pathological chain length is a `reasoning_quality_validator` concern, not a faithfulness concern.

### 4.14 `open_question_vs_decided` (LLM, reused)

Sample 10 §4.14. At NFR enrichment, additionally: a `threshold` or `measurement_method` that binds a value the substrate treats as an open question (e.g., a Q-* in `traces_to`) must surface that anchoring rather than silently committing.

For this sample, no Q-* refs; validator passes.

### 4.15 `reasoning_quality_validator` (LLM, reused unchanged)

Original §6. The 40× thinking-to-response ratio observed here is a `over-cleverness / shortcut-taking` signal at LOW (the chain's last decision is correct in shape; the defect is cost). When accompanied by other defects (here, the exemplar-leakage finding the chain itself documents), it can escalate to MEDIUM.

For this sample, fires LOW.

### 4.16 `final_synthesis` (LLM, reused unchanged)

Original §7. Decision policy:
- Any HIGH from `contract_schema_enrichment_nfr`, `enrichment_echo_invariance`, `output_substantiveness_check`, `exemplar_leakage_detector`, `threshold_grounding_audit`, `grounding_validator`, or `measurement_adequacy_validator` ⇒ QUARANTINE.
- HIGH from `skeleton_drift_audit` (scope-loosening or category-drift class) ⇒ QUARANTINE.
- MEDIUM-only with no HIGHs ⇒ REVISE.
- LOW-only ⇒ ACCEPT_WITH_NOTES.

For this sample, the synthesis output should be **QUARANTINE** on the basis of: HIGH from `measurement_adequacy_validator` (pattern #10 — zero direct traffic without observation surface), HIGH from `threshold_grounding_audit` (1-minute cadence ungrounded), and MEDIUM from `grounding_validator` (WAF instrument ungrounded) plus MEDIUM from `measurement_method_executability` (missing scan scope) plus MEDIUM from `exemplar_leakage_detector` (1-minute cadence exemplar value).

---

## 5. Conditional dispatch and integration

**Always-run (deterministic, near-zero cost):**
- `contract_schema_enrichment_nfr`
- `enrichment_echo_invariance`
- `output_substantiveness_check`
- `exemplar_leakage_detector`

If `contract_schema_enrichment_nfr`, `enrichment_echo_invariance`, or `output_substantiveness_check` fires HIGH, short-circuit to `final_synthesis` — running LLM validators against an off-contract or near-empty response wastes budget.

**Always-run (LLM, narrow):**
- `measurement_adequacy_validator` (centerpiece — never skip)
- `threshold_grounding_audit`
- `grounding_validator` (NFR enrichment systematically invokes instrument names; the regex pre-filter from sample 10 should be relaxed at this pass to "always run on `measurement_method` strings ≥ 30 chars")
- `measurement_method_executability`
- `skeleton_drift_audit`
- `reasoning_to_response_faithfulness`

These are the validators the corpus has consistently shown a single broad reviewer cannot cover.

**Conditional:**
- `source_attribution_grounding` runs if `measurement_method` invokes a substrate-named entity, workflow, or compliance item by id (regex `/\b(VV|QA|TECH|COMP|UJ)-[A-Z0-9-]+\b/`). For this sample, none does — substrate is invoked semantically — so this validator may be skipped.
- `pass_scope_discipline` runs if regex pre-filter detects ms/seconds-level latency (NFR-specific, ms-coupled), named cloud-vendor products, or Pass-3-style absorption claims.
- `open_question_vs_decided` runs if any `Q-*` or `OPEN-*` id is in `traces_to` (none for this sample).
- `assumption_citation_validator` runs always (cheap, trace-only).

**Synthesis:** `final_synthesis` always last. Same policy as sample 10 with the additions in §4.16.

**Cost note:** the four deterministic validators eliminate the schema/echo/substantiveness/leakage axes for free. The six always-run LLM validators each have small input scope (one NFR skeleton, the substrate excerpt for the traced items, ~500-byte response — typically < 5 KB context per call) and can run on a Gemma-class reviewer in serial. The `measurement_adequacy_validator` is the only one that benefits materially from a stronger model (qwen3.5:9b or larger). At 5 KB context the cost is small; if budget allows, route only the centerpiece to a higher-capacity reviewer.

---

## 6. Notes and open questions (handoff to Phase C.3 synthesis)

1. **Original ChatGPT 5.5 template is the canonical text for `measurement_adequacy_validator` at this pass.** Use it verbatim. This sample's HIGH defect is one of the original eleven patterns word-for-word ("zero direct traffic" without checking both access logs and network paths). Re-paraphrasing the template anywhere in the codebase will erode signal at exactly this defect class.

2. **`output_substantiveness_check` is a cross-role candidate.** Recommended for promotion to the cross-role validator family (alongside `contract_schema_*`, `grounding_*`, `reasoning_*`). Any pass whose contract emits a small fixed-arity authored set (NFR enrichment threshold+method, ADR rationale, architecture-decision summary, single-paragraph synthesis) needs the same floor.

3. **FR-enrichment ↔ NFR-enrichment parametrization closes cleanly.** The full sample 10 family carries forward to NFR enrichment with three parameter-varied validators (`contract_schema_enrichment_nfr`, `measurement_method_executability`, `skeleton_drift_audit`-rotated), one new validator (`output_substantiveness_check`), and one deactivation (`ac_count_discipline`). Everything else is reuse-as-is. This is a strong implementation story for Wave-8: roughly 80% of the enrichment-pass validator code is shared between FR and NFR, with the remaining 20% being clean parameter swaps.

4. **The "zero direct traffic" pattern is a flagship example for the `measurement_adequacy_validator` documentation.** When implementing, include this sample as a worked example in the validator's developer documentation. It demonstrates pattern #10 in its purest form: a categorical commitment, a measurement that *names instruments* (deceptive specificity), and a reviewer that confidently passes the response. Future onboarding of the validator should be calibrated against this sample and against sample 10's AC-014 (existence-as-coverage).

5. **`measurement_method_executability` ↔ `measurement_adequacy_validator` overlap remains deliberate.** Same architectural choice as sample 10 §6.4: the two validators read the same string at different abstraction levels. At NFR enrichment the overlap fires more often than at FR enrichment because the method string is the *sole* observation surface (versus AC arrays where multiple ACs spread the load). Run both; let `final_synthesis` deduplicate.

6. **Reasoning-chain pathology cost is now consistently 40× across qwen3.5:9b enrichment passes.** Samples 10 (41×) and 12 (40×) corroborate. This is a *cost* defect at thinking-budget scale, not a *correctness* defect. Recommendation for Phase C.3: a corpus-level `thinking_budget_audit` reporting, per phase, the median chain-to-response ratio with an alert threshold at >15×. Out of scope for any per-output validator.

7. **Negative findings as evidence — closing a Phase C.2 pattern.** Three sample-pairs in this Phase have produced clean negative findings of value: sample 10 §1a.7 (FR enrichment exemplar leakage closed across pass boundary), sample 12 §1a.0 (output substantiveness — single-NFR contract correctly satisfied at 497 bytes), and sample 12 §1a.6 (threshold-side exemplar leakage clean). These are the kind of positive signals the validator pipeline should record in observability, not just as the absence of findings. Phase C.3 should consider whether the validator schema needs a `passing_observations[]` field for explicit positive signals.

8. **Items deferred to Phase C.3 synthesis (handoff).** The following themes are present in sample 12 but belong in cross-sample synthesis, not in this per-sample assessment:

   a. **Cross-role validator family promotion.** `contract_schema_*`, `grounding_*`, `reasoning_to_response_faithfulness`, `open_question_vs_decided`, `reasoning_quality_validator`, `assumption_citation_validator`, `final_synthesis`, and now `output_substantiveness_check` and `exemplar_leakage_detector` all carry through every Phase C.2 sample. Phase C.3 should formalise the cross-role family and place the templates in `prompts/cross_cutting/validators/`.

   b. **Pass-pair parametrization rule.** Skeleton↔Saturation↔Enrichment validator family carries by parameter variation FR↔NFR. The rule needs codification for Wave-8: validator implementations should be parameterised by `{role, pass}` rather than written per-`{role, pass}` pair.

   c. **Reviewer model gap.** Across all twelve samples, the gemma4:e4b reviewer under broad scope misses semantic-verification-shaped defects in 11 of 12 cases (the exception is sample 11, where the reviewer fires three findings but mis-anchors the HIGH). The fix is structural (narrow validators), not a model swap, but the corpus warrants a final synthesis statement: **broad-scope reasoning-review at Gemma-tier capacity is not a viable governance gate.**

   d. **Decomposition reference document.** Phase C.3's decomposition reference should consume the validator inventory from all twelve assessments and produce a single dependency-ordered manifest — including the conditional dispatch graph, deterministic-vs-LLM split, and per-validator severity rules. This assessment's §3 + §5 are inputs to that manifest.

   e. **Original ChatGPT 5.5 assessment retirement plan.** With this sample assessed, the original assessment can be retired in favour of the per-role assessments (samples 01–12) plus the Phase C.3 synthesis. The original's `measurement_adequacy_validator` template is preserved verbatim in samples 10 and 12; the rest of the original is superseded by the sample-specific narrowings.

   f. **Calibration corpus for the validator pipeline.** Each per-role assessment names specific findings the corresponding validator should fire on the corresponding sample. Phase C.3 should aggregate these into a regression-test corpus: `sample_id × validator_id → expected_findings`. Running this regression against any new reviewer model is the cheapest reliable model-eval for this pipeline going forward.

   g. **Phase C.3 entry condition met.** All twelve samples assessed. All five cross-cutting themes (cross-role family, pass-pair parametrization, reviewer model gap, decomposition reference, calibration corpus) recur with sufficient frequency to warrant single-document treatment.
