# Test S1_05: PageIndex Evidence Retrieval - Expected Output

## Purpose
Simulate PageIndex returning Evidence Packets containing authoritative specification text.

## Expected Behavior

The LLM (simulating PageIndex) should:
1. Extract relevant spec sections based on the query
2. Create Evidence Packets with exact specification text
3. Include proper citations (doc_id, section_id, pages)
4. Link packets to related claims
5. Provide retrieval trace (TOC path used)
6. Return metadata about retrieval process

## Expected Evidence Packets

The response should contain 4-5 evidence packets covering:

**E001: ML Models Requirement**
- Section: Feature Detection System - ML Models
- Content: "SuperPoint: Feature detection and description (2.5MB). SuperGlue: Feature matching (4.2MB). Both models run on-device using Core ML."
- Related claims: C1, C2, C8, C9

**E002: Key Features**
- Section: Feature Detection System - Key Features
- Content: "Deep learning-based feature detection (SuperPoint). Neural network feature matching (SuperGlue). RANSAC-based outlier rejection. Sub-pixel refinement."
- Related claims: C1, C2, C4

**E003: Configuration**
- Section: Feature Detection System - Configuration
- Content: "struct Configuration { let maxFeaturesPerImage: Int = 2000; let minFeatureQuality: Float = 0.7; let ransacThreshold: Float = 3.0; let enableSubPixelRefinement: Bool = true }"
- Related claims: C3, C4

**E004: Performance Requirements**
- Section: Feature Detection System - Performance Requirements
- Content: "Feature detection: < 200ms per image (1920x1080). Feature matching: < 300ms per image pair. Memory usage: < 150MB"
- Related claims: C5, C6, C7

## Success Criteria

✅ **Pass if:**
- 4-5 evidence packets returned
- Each packet has unique packet_id (E001-E005)
- Content is exact quotes from specification
- All critical claims (C1-C4) linked to at least one packet
- retrieval_trace shows TOC path
- retrieval_metadata.confidence = "high"

❌ **Fail if:**
- Fewer than 3 evidence packets
- Content is paraphrased instead of exact quotes
- Missing critical information (e.g., no configuration values)
- packet_id not unique
- No retrieval_trace provided

## Related Blueprint Sections

- **Evidence Packet Schema:** lines 196-208
- **Retrieve Evidence:** lines 86-88
- **PageIndex Description:** lines 48-49
