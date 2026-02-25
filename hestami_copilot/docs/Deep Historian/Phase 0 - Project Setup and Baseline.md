# Phase 0 - Project Setup and Baseline

## Objective

Initialize the project repository, configure Docker Compose infrastructure, and verify all core services (vLLM, PageIndex, Dolt) can start and communicate.

---

## 0.1 Repository Initialization

- [ ] Create project repository structure (monorepo or multi-repo decision)
- [ ] Set up `.gitignore` for Python, Docker, model weights, etc.
- [ ] Create base directory structure:
  - [ ] `/orchestrator` - Historian orchestrator code
  - [ ] `/config` - Configuration files
  - [ ] `/specs` - Specification documents
  - [ ] `/models` - LLM model weights (gitignored)
  - [ ] `/scripts` - Utility scripts
  - [ ] `/tests` - Test files
- [ ] Initialize README with project overview
- [ ] Set up Python virtual environment or Poetry/PDM for dependency management

### Notes / Issues
<!-- Track repository setup issues here -->

---

## 0.2 Docker Compose Infrastructure

- [ ] Create base `docker-compose.yml` file
- [ ] Define shared network (`historian_net`)
- [ ] Configure volume mounts:
  - [ ] Spec documents volume
  - [ ] Dolt data volume
  - [ ] PageIndex index volume
  - [ ] Model weights volume
  - [ ] Logs/output volume
- [ ] Set up environment variable files (`.env`, `.env.example`)

### Notes / Issues
<!-- Track Docker setup issues here -->

---

## 0.3 vLLM Service Configuration

- [ ] Create vLLM service definition in docker-compose
- [ ] Configure GPU access (NVIDIA Container Toolkit)
- [ ] Download and prepare model weights (e.g., Llama-2-13B or similar)
- [ ] Configure vLLM startup parameters:
  - [ ] Model path
  - [ ] Port (8000)
  - [ ] Dtype (float16)
  - [ ] API key for internal auth
- [ ] Verify vLLM starts and loads model successfully
- [ ] Test simple completion request via curl/httpie

### Notes / Issues
<!-- Track vLLM setup issues here -->

---

## 0.4 Dolt Service Configuration

- [ ] Create Dolt service definition in docker-compose
- [ ] Initialize Dolt repository for specs database
- [ ] Create initial schema:
  - [ ] `specs` table (or document references)
  - [ ] `interpretations` table
  - [ ] `rulings` table
  - [ ] `exceptions` table
- [ ] Configure Dolt SQL server (port 3306)
- [ ] Verify Dolt starts and accepts connections
- [ ] Test sample query from host or orchestrator container

### Notes / Issues
<!-- Track Dolt setup issues here -->

---

## 0.5 PageIndex Service Configuration

- [ ] Research PageIndex deployment options (official image or custom build)
- [ ] Create PageIndex service definition in docker-compose
- [ ] Configure PageIndex to use local vLLM as LLM backend:
  - [ ] Set `OPENAI_API_BASE=http://vllm:8000/v1`
  - [ ] Set dummy `OPENAI_API_KEY`
- [ ] Configure document directory mount
- [ ] Configure index persistence volume
- [ ] Verify PageIndex starts successfully
- [ ] Load sample specification document
- [ ] Test retrieval query and verify response

### Notes / Issues
<!-- Track PageIndex setup issues here -->

---

## 0.6 Orchestrator Service Scaffold

- [ ] Create Dockerfile for orchestrator
- [ ] Set up Python project structure:
  - [ ] `run_historian.py` - Main entry point
  - [ ] `config.py` - Configuration loader
  - [ ] `models/` - Data models/schemas
  - [ ] `services/` - Service clients (vLLM, PageIndex, Dolt)
- [ ] Create orchestrator service definition in docker-compose
- [ ] Configure environment variables for service connections
- [ ] Implement basic health check for all dependent services
- [ ] Verify orchestrator can connect to vLLM, PageIndex, and Dolt

### Notes / Issues
<!-- Track orchestrator scaffold issues here -->

---

## 0.7 Initial Specification Loading

- [ ] Select sample specification document(s) for testing
- [ ] Load spec document into PageIndex (trigger indexing)
- [ ] Import spec metadata/references into Dolt
- [ ] Verify spec version/commit tracking in Dolt
- [ ] Create `index_version` tracking mechanism
- [ ] Document spec loading process

### Notes / Issues
<!-- Track spec loading issues here -->

---

## 0.8 End-to-End Connectivity Verification [Deferred]

- [ ] Create simple integration test script
- [ ] Verify: Orchestrator → vLLM (test completion)
- [ ] Verify: Orchestrator → PageIndex (test query)
- [ ] Verify: Orchestrator → Dolt (test SQL query)
- [ ] Verify: PageIndex → vLLM (internal LLM calls)
- [ ] Document any firewall/network issues
- [ ] All services stay up after `docker-compose up`

### Notes / Issues
<!-- Track connectivity issues here -->

---

## Acceptance Criteria [Deferred]

- [ ] `docker-compose up` brings all services online
- [ ] Dolt is reachable and returns query results
- [ ] vLLM responds to test prompts via OpenAI-compatible API
- [ ] PageIndex returns known section for test query
- [ ] Orchestrator can communicate with all services
- [ ] Basic logging is in place

---

## Phase 0 Complete

- [ ] All above checklists completed
- [ ] Phase 0 review conducted
- [ ] Ready to proceed to Phase 1

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 0 issues, decisions, and TODOs here -->

