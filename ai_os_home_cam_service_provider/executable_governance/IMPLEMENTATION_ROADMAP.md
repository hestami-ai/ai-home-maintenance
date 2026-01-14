# haos-guard: Implementation Roadmap

This document tracks the progress of the Executable Governance CLI (`haos-guard`) for the HAOS platform.

## Status Overview
- **Project Folder**: `executable_governance/`
- **Current Phase**: Phase 3 (Deep Semantic Trace)
- **Status**: [🟢 PHASE 3 COMPLETE]

---

## Progress Checklist

### **Phase 1: Core Enforcement (Highest ROI)**
- [x] Initial CLI Scaffolding (Bun + Commander + ts-morph)
- [x] Configuration System (`haos-guard.config.json`)
- [x] Reporting Engine (Console Chalk + JSON output)
- [x] **Check: Boundaries (R5)** - Detect Prisma/Server leakage in UI
- [x] **Check: Mutations (R2/R3)** - Detect direct Prisma writes outside workflows (Heuristic)
- [x] **Check: Types (R8)** - Detect hardcoded `z.enum` usages
- [x] **Check: Pipelines** - Detect artifact drift (Prisma -> Zod -> OpenAPI -> Types)
- [x] **Check: Error Contract (R6)** - Ensure oRPC handlers use `.errors()` instead of throwing raw errors
- [x] **README** - Basic usage and configuration guide

### **Phase 2: Governance Hardening**
- [x] **Check: Cerbos Policies (R10)** - Compare oRPC routes against Cerbos resource policies (Enhanced with missing check detection)
- [x] **Check: Timestamps (R9)** - Enforce `TIMESTAMPTZ(3)` in Prisma and SQL functions (Added SQL scan)
- [x] **Check: Security Definer (R7/R8)** - Verify RLS bypass patterns (Implemented new check)
- [x] Refine Mutation Check: Detect `idempotencyKey` presence in workflow signatures
- [x] Refine Mutation Check: Match `workflowID` assignment to `idempotencyKey`

### **Phase 3: Deep Semantic Trace**
- [x] **Check: Deep Semantic Trace** - Full call-graph verification to ensure all paths to sensitive operations are protected by Cerbos.
- [x] **Heuristic Enhancement**: Trace oRPC -> Workflow -> Step to verify authorization context propagation.

---

## Instructions for Next Agent
1. **Context**: You are continuing the development of `haos-guard`. The tool is currently a Bun project in `executable_governance/`.
2. **Setup**: Run `bun install` in the folder.
3. **Execution**: Run `bun run src/cli.ts verify rules` to see current violation counts.
4. **Current Focus**: The `verify mutations` check has revealed significant technical debt (many violations). The next task is either to refine the check to reduce false positives or to begin implementing **Phase 2: Policies (R10)** to ensure API routes have corresponding Cerbos definitions.
5. **Configuration**: Edit `haos-guard.config.json` to adjust project paths or boundary rules.
