# Governance Violations - Executive Summary

**Analysis Date:** 2026-01-12
**Source:** mutations_final.json

## Overall Statistics

| Metric | Count |
|--------|-------|
| **Total Violations** | **444** |
| R2 (Prisma outside workflows) | 258 |
| R3 Input Schema (missing idempotencyKey) | 42 |
| R3 Workflow Mapping (missing workflowID) | 144 |
| **Unique Files Affected** | **148** |
| R2 Files | 54 |
| R3 Input Schema Files | 23 |
| R3 Workflow Mapping Files | 71 |

## Effort Estimates

| Phase | Violations | Effort | Duration |
|-------|-----------|--------|----------|
| **Phase 1: R3 Violations** | 186 | 5-9 hours | 1-2 weeks |
| R3 Input Schema | 42 | 2-4 hours | 2-3 days |
| R3 Workflow Mapping | 144 | 3-5 hours | 2-3 days |
| **Phase 2: R2 Violations** | 258 | 60-80 hours | 8-10 weeks |
| Infrastructure & Core | 18 | 8-10 hours | 1 week |
| Major Domains | 131 | 36-45 hours | 4-5 weeks |
| Remaining Files | 109 | 16-25 hours | 3-4 weeks |
| **TOTAL** | **444** | **65-89 hours** | **10-12 weeks** |

## Top 20 Files by Violation Count

| Rank | File | Violations | Type | Priority |
|------|------|-----------|------|----------|
| 1 | staff.ts | 16 | R2 | HIGH |
| 2 | conciergeCase.ts | 15 | R2 | HIGH |
| 3 | ownerPortal.ts | 14 | R2 | HIGH |
| 4 | conciergeAction.ts | 13 | R2 | HIGH |
| 5 | workOrder.ts | 13 | R2 | HIGH |
| 6 | crossDomainIntegration.ts | 12 | R2 | CRITICAL |
| 7 | violation.ts | 10 | R2 | MEDIUM |
| 8 | rls.ts | 10 | R2 | CRITICAL |
| 9 | ownerIntent.ts | 9 | R2 | HIGH |
| 10 | propertyOwnership.ts | 9 | R2 | HIGH |
| 11 | individualProperty.ts | 7 | R2 | MEDIUM |
| 12 | bid.ts | 7 | R2 | HIGH |
| 13 | bankAccount.ts | 6 | R2 | HIGH |
| 14 | externalHoa.ts | 6 | R2 | MEDIUM |
| 15 | organization.ts | 6 | R2 | HIGH |
| 16 | asset.ts | 6 | R2 | HIGH |
| 17 | documentWorkflow.ts | 5 | R3 Map | MEDIUM |
| 18 | portfolio.ts | 5 | R2 | MEDIUM |
| 19 | document.ts | 5 | R2 | MEDIUM |
| 20 | vendorBid.ts | 5 | R2 | MEDIUM |

## Violations by Domain

| Domain | R2 | R3 Input | R3 Map | Total | Priority |
|--------|----|---------|----|-------|----------|
| Concierge | 79 | 4 | 1 | 84 | HIGH |
| Workflows | 0 | 0 | 140 | 140 | HIGH |
| Accounting | 26 | 0 | 0 | 26 | HIGH |
| Work Orders | 26 | 8 | 0 | 34 | HIGH |
| Staff | 16 | 0 | 0 | 16 | HIGH |
| Owner Portal | 14 | 0 | 0 | 14 | HIGH |
| Core Entities | 15 | 12 | 1 | 28 | HIGH |
| Infrastructure | 18 | 0 | 2 | 20 | CRITICAL |
| Violations | 12 | 4 | 0 | 16 | MEDIUM |
| Vendor Mgmt | 9 | 0 | 0 | 9 | MEDIUM |
| Documents | 6 | 2 | 0 | 8 | MEDIUM |
| Contractor | 3 | 3 | 0 | 6 | MEDIUM |
| Governance | 2 | 1 | 0 | 3 | MEDIUM |
| Other | 32 | 8 | 0 | 40 | MEDIUM |

## Critical Path

### Week 1-2: R3 Violations (Quick Wins)
- **Goal:** Fix all 186 R3 violations
- **Impact:** Establish idempotency infrastructure
- **Automation:** Scripts can reduce effort by 40-50%

### Week 3: Infrastructure (Critical)
- **Goal:** Fix RLS and middleware (18 violations)
- **Impact:** Unblocks all other R2 work
- **Risk:** Highest complexity, affects all domains

### Week 4-7: Major Domains
- **Concierge:** 79 violations (weeks 4-5)
- **Accounting:** 26 violations (week 6)
- **Work Orders:** 26 violations (week 7)

### Week 8-12: Remaining Files
- **High-Impact:** 30 violations (week 8)
- **Medium-Impact:** 45 violations (weeks 9-10)
- **Low-Impact:** 35 violations (weeks 11-12)

## Key Recommendations

### 1. Automation First (Week 0)
- Create scripts for R3 violations (~40% time savings)
- Generate workflow templates for R2 patterns
- **ROI:** High - saves 2-4 hours of manual work

### 2. Test Infrastructure (Ongoing)
- Write tests BEFORE refactoring R2 violations
- Feature flags for gradual rollout
- **Risk Mitigation:** Prevents regressions

### 3. Parallel Work Streams (After Week 3)
- After infrastructure fixes, domains can be parallelized
- Concierge, Accounting, Work Orders are independent
- **Speed:** Can reduce timeline by 2-3 weeks

### 4. Documentation Standards
- Create workflow pattern guide
- Document migration patterns
- **Consistency:** Ensures maintainability

## Success Criteria

- [ ] All 444 violations resolved
- [ ] Zero functional regressions
- [ ] All mutations are idempotent
- [ ] Workflow durability verified
- [ ] Governance rules enforced in CI/CD
- [ ] Team trained on workflow patterns

## Next Actions

1. **Approve roadmap** with stakeholders
2. **Create automation scripts** for R3 violations
3. **Establish testing protocols**
4. **Assign Phase 1 batches** to developers
5. **Schedule infrastructure week** (critical path)
6. **Set up monitoring** for workflow execution

---

**Full details:** See `VIOLATIONS_IMPLEMENTATION_ROADMAP.md`
