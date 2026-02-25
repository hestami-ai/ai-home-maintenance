# Phase 6 - Optional Enhancements

## Objective

Extend the platform beyond MVP with features for scaling, multi-user support, improved UX, and performance optimization. This phase is open-ended and driven by user feedback and operational needs.

---

## 6.1 API Service Mode

- [ ] Implement REST API for proposal submission:
  - [ ] `POST /api/analyze` - Submit proposal
  - [ ] `GET /api/status/{run_id}` - Check run status
  - [ ] `GET /api/result/{run_id}` - Retrieve judgment
  - [ ] `GET /api/audit/{run_id}` - Download AuditBundle
- [ ] Implement request queuing (single-threaded processing)
- [ ] Add authentication (API key or OAuth)
- [ ] Add rate limiting
- [ ] Implement async processing with callbacks/webhooks
- [ ] API documentation (OpenAPI/Swagger)

### Notes / Issues
<!-- Track API implementation issues here -->

---

## 6.2 Web User Interface

- [ ] Design simple web UI:
  - [ ] Proposal submission form
  - [ ] Status tracking
  - [ ] Results display with verdict and findings
  - [ ] Trace viewer (expandable reasoning steps)
  - [ ] Evidence viewer with citations
- [ ] Implement frontend (Svelte, React, or simple HTML/JS)
- [ ] Connect to API backend
- [ ] Authentication flow
- [ ] Deploy as additional container

### Notes / Issues
<!-- Track web UI issues here -->

---

## 6.3 Multi-User Support Preparation

### Data Isolation Options
- [ ] Research Dolt branch-per-user approach
- [ ] Research separate Dolt databases per organization
- [ ] Research row-level security with user tags
- [ ] Document recommended approach

### Implementation (if pursued)
- [ ] Add user/organization context to runs
- [ ] Implement data isolation mechanism
- [ ] Add user management (basic)
- [ ] Test isolation between users
- [ ] Document multi-tenancy patterns

### Notes / Issues
<!-- Track multi-user issues here -->

---

## 6.4 Concurrent Processing

- [ ] Evaluate GPU sharing feasibility:
  - [ ] vLLM continuous batching
  - [ ] Multiple reasoning tasks in parallel
- [ ] Implement request queue with priority
- [ ] Implement worker pool pattern (if beneficial)
- [ ] Benchmark throughput improvements
- [ ] Handle resource contention gracefully
- [ ] Document scaling limits

### Notes / Issues
<!-- Track concurrency issues here -->

---

## 6.5 Model Training Integration

### Fine-Tuning Pipeline
- [ ] Set up LoRA fine-tuning environment
- [ ] Create training data format from:
  - [ ] Spec documents (domain adaptation)
  - [ ] Chain-of-thought distillation
  - [ ] Human corrections
- [ ] Implement training script
- [ ] Implement model evaluation before promotion
- [ ] Implement model versioning and rollback

### Correction Feedback Loop
- [ ] Implement correction submission UI/API
- [ ] Store corrections in structured format
- [ ] Periodic conversion to training examples
- [ ] Track correction patterns for common errors

### Notes / Issues
<!-- Track training integration issues here -->

---

## 6.6 Cloud LLM Integration (Optional)

- [ ] Research use cases for cloud LLM:
  - [ ] Generating suggestions/improvements
  - [ ] Double-checking verdicts
  - [ ] Distillation data generation
- [ ] Implement optional cloud LLM client
- [ ] Ensure cloud calls are:
  - [ ] Clearly logged in AuditBundle
  - [ ] Not in critical decision path
  - [ ] Opt-in via configuration
- [ ] Handle cloud API failures gracefully
- [ ] Cost monitoring for cloud usage

### Notes / Issues
<!-- Track cloud integration issues here -->

---

## 6.7 Performance Optimization

### Model Optimization
- [ ] Evaluate quantization (AWQ, GPTQ)
- [ ] Benchmark quantized vs full precision
- [ ] Test smaller models (7B vs 13B)
- [ ] Evaluate distilled models for specific tasks

### Retrieval Optimization
- [ ] PageIndex caching improvements
- [ ] Precomputed indexes for common spec sets
- [ ] Batch query optimization

### Infrastructure
- [ ] Evaluate multi-GPU setups
- [ ] Container resource tuning
- [ ] Network optimization between services

### Notes / Issues
<!-- Track performance optimization issues here -->

---

## 6.8 Beads CLI/Storage Integration

- [ ] Evaluate Steve Yegge's Beads CLI for trace storage
- [ ] Implement Beads-compatible trace format
- [ ] Set up git-backed beads repository
- [ ] Enable trace querying via Beads CLI
- [ ] Explore multi-agent memory use cases
- [ ] Document integration approach

### Notes / Issues
<!-- Track Beads integration issues here -->

---

## 6.9 Advanced Audit Features

- [ ] Implement trace diff between runs:
  - [ ] Compare reasoning on same proposal, different spec versions
  - [ ] Highlight changes in verdict reasoning
- [ ] Implement trace search:
  - [ ] Find all runs that cited specific evidence
  - [ ] Find all runs with specific failure mode
- [ ] Implement compliance reporting:
  - [ ] Aggregate statistics across runs
  - [ ] Trend analysis over time
- [ ] Export formats (PDF report, CSV, etc.)

### Notes / Issues
<!-- Track audit features issues here -->

---

## 6.10 Additional Agent Integration

- [ ] Design agent collaboration framework:
  - [ ] Historian as critique agent
  - [ ] Refactorer/Fixer agent for suggestions
  - [ ] Summarizer agent for reports
- [ ] Implement agent communication protocol
- [ ] Ensure additional agents don't affect Historian determinism
- [ ] Log all agent interactions
- [ ] Document agent extension patterns

### Notes / Issues
<!-- Track agent integration issues here -->

---

## 6.11 Monitoring and Observability

- [ ] Integrate with observability stack:
  - [ ] Prometheus metrics export
  - [ ] Grafana dashboards
  - [ ] Log aggregation (Loki, ELK)
- [ ] Define key metrics:
  - [ ] Runs per day
  - [ ] Verdict distribution
  - [ ] Average run time
  - [ ] Failure rate by type
  - [ ] GPU/memory utilization
- [ ] Set up alerting for anomalies
- [ ] Document operational monitoring

### Notes / Issues
<!-- Track monitoring issues here -->

---

## Milestone 6 Criteria

This phase has no fixed endpoint. Success is measured by:

- [ ] User-requested features implemented
- [ ] System scales to meet demand
- [ ] Operational burden reduced
- [ ] Quality maintained or improved
- [ ] Documentation kept current

---

## Phase 6 Status

- [ ] API service implemented
- [ ] Web UI implemented
- [ ] Multi-user preparation complete
- [ ] Performance optimizations applied
- [ ] Additional features as needed

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 6 issues, decisions, and TODOs here -->

