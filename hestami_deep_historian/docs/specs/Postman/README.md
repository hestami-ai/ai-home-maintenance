# PageIndex Evaluation - Postman Test Suite

This directory contains 7 Postman test prompts for evaluating Qwen3-4B-Thinking's capabilities with sophisticated prompt engineering, using the **Photorealistic 3D Scanning SDK specification** as test data.

## Purpose

These tests evaluate whether more sophisticated prompts can produce better results than PageIndex's simple summarization approach. Each test demonstrates a different capability needed for the Historian Agent.

## Postman Configuration

**Endpoint:** `http://localhost:8000/v1/chat/completions`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer local-historian-key
```

**Method:** POST

## Test Files

### Test 1: Basic Summarization
**File:** `Test_1_Basic_Summarization.json`

**Purpose:** Baseline test comparing against PageIndex's simple summarization

**Content:** Approach 1: Medida-Style CV/AI section

**What to observe:**
- Does it avoid copying the text verbatim?
- Does it extract key technical details?
- Is there a `</think>` tag in the output?

---

### Test 2: Structured Summarization with Extraction
**File:** `Test_2_Structured_Summarization.json`

**Purpose:** Get both summary AND extractive metadata in one pass

**Content:** Feature Detection System section

**What to observe:**
- Does it return valid JSON?
- Does it correctly extract functions, technical terms, and dependencies?
- Are the entities accurately identified?

---

### Test 3: Multi-Section Context Summarization
**File:** `Test_3_MultiSection_Context.json`

**Purpose:** Test hierarchical understanding (parent + children sections)

**Content:** Performance Requirements section with 3 subsections

**What to observe:**
- Can it distinguish between prefix_summary and full_summary?
- Does it accurately capture subsection topics?
- Does it maintain hierarchical context?

---

### Test 4: Relevance Scoring (Single Document)
**File:** `Test_4_Relevance_Scoring.json`

**Purpose:** Score document relevance to a query

**Content:** Full document structure with question about ML models

**What to observe:**
- Is the relevance score appropriate (0.0-1.0)?
- Does the reasoning cite specific sections and keywords?
- Are the matching sections correctly identified?

---

### Test 5: Deep Section Selection (Tree Search)
**File:** `Test_5_Deep_Section_Selection.json`

**Purpose:** Navigate document tree to find relevant sections

**Content:** Hierarchical document tree about memory management

**What to observe:**
- Does it identify the most relevant nodes?
- Is the confidence scoring reasonable?
- Does the search reasoning explain the strategy?

---

### Test 6: Verification & Compliance
**File:** `Test_6_Verification_Compliance.json`

**Purpose:** Verify proposal compliance with specs (Historian's core use case)

**Content:** Proposal vs. Feature Detection System specification

**What to observe:**
- Does it correctly identify non-compliant items?
- Are compliance statuses accurate?
- Does it provide actionable recommendations?

---

### Test 7: Multi-Document Comparison
**File:** `Test_7_MultiDocument_Comparison.json`

**Purpose:** Rank multiple documents by relevance

**Content:** 5 different sections of the 3D Scanning SDK spec

**What to observe:**
- Is the ranking logical?
- Are relevance scores differentiated?
- Does reasoning cite specific content?

## How to Use

1. **Start vLLM:**
   ```bash
   cd hestami_deep_historian
   docker compose up vllm -d
   ```

2. **Open Postman**

3. **For each test:**
   - Create new POST request to `http://localhost:8000/v1/chat/completions`
   - Add header: `Authorization: Bearer local-historian-key`
   - Copy the JSON content from the test file into the request body
   - Send the request
   - Observe the response

4. **Evaluate Results:**
   - Check for `</think>` tags (should be absent if prompt is good)
   - Verify JSON validity (if applicable)
   - Assess quality vs. PageIndex's simple prompts
   - Measure response time and token usage

## Success Criteria

**Good Results:**
- ✅ No `</think>` tags in final output
- ✅ Valid JSON when requested
- ✅ Accurate extraction of technical details
- ✅ Appropriate confidence/relevance scores
- ✅ Reasoning that cites specific evidence
- ✅ Processing time < 5 seconds per test

**Poor Results:**
- ❌ Thinking process mixed with output
- ❌ Invalid JSON or missing fields
- ❌ Generic summaries without specifics
- ❌ Incorrect entity extraction
- ❌ Reasoning that doesn't cite sources

## Next Steps

If tests show good results:
1. Integrate winning prompts into PageIndex wrapper
2. Replace PageIndex's simple summarization
3. Add post-processing to handle any `</think>` tags
4. Create production prompt templates

If tests show poor results:
1. Iterate on prompt engineering
2. Try different temperature settings
3. Consider using a larger model
4. Add few-shot examples to prompts
