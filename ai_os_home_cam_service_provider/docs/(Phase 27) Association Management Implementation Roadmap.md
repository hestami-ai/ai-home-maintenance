# (Phase 27) Association Management Implementation Roadmap

## Overview

This roadmap outlines the steps to implement the Association Creation UX for Management Companies in the CAM pillar.

**Status:** In Progress (Execution Complete, Verification in Progress)  
**Dependencies:** Phase 6 Platform UX, Core Association API  

---

## P27.1 Backend — Durable Creation Workflow

- [x] **P27.1.1 Create Association Workflow**
    - Implement `CREATE_MANAGED_ASSOCIATION_v1` in `src/lib/server/workflows/associationWorkflow.ts`.
    - [x] Wrap `prisma.association.create` and `prisma.managementContract.create` in a DBOS step.
    - [x] Wrap `seedDefaultChartOfAccounts` (with template support) in a DBOS step.
    - [x] Record activity event via `recordWorkflowEvent`.
- [x] **P27.1.2 Refactor oRPC Router**
    - Update `association.create` in `src/lib/server/api/routes/association.ts`.
    - [x] Pass `idempotencyKey` as workflow ID.
    - [x] Delegate logic to the new workflow.
- [x] **P27.1.3 Regenerate Types**
    - [x] Run `bun run openapi:generate`.
    - [x] Run `bun run types:generate`.

---

## P27.2 Frontend — Association Creation UI

- [x] **P27.2.1 Navigation & List Entry Point**
    - [x] Modify `src/routes/app/cam/associations/+page.svelte`.
    - [x] Add "New Association" button to the `listPanel` header.
- [x] **P27.2.2 Creation Form Page**
    - [x] Create `src/routes/app/cam/associations/new/+page.svelte`.
    - [x] Use `Superforms` for validation (Name, Legal Name, Tax ID, Fiscal Year).
    - [x] Implement sectioned layout (Profile, Accounting, Contract).
- [x] **P27.2.3 Server-Side Form Handling**
    - [x] Create `src/routes/app/cam/associations/new/+page.server.ts`.
    - [x] Implement `load` function for form initialization.
    - [x] Implement `action` to call the oRPC API using `createDirectClient`.

---

## P27.3 Verification & Polish

- [ ] **P27.3.1 Functional Testing**
    - [ ] Verify form validation (client & server).
    - [ ] Verify successful creation and redirection.
    - [ ] Verify Chart of Accounts seeding (multi-template).
    - [ ] Verify Management Contract linkage.
- [x] **P27.3.2 Technical Verification**
    - [x] Run `bun run check` (0 errors, 2 warnings - acceptable).
    - [ ] Verify DBOS workflow traces in SigNoz (if applicable).
- [ ] **P27.3.3 Activity Feed Audit**
    - [ ] Ensure the "Association Created" event appears in the system history.

---

## Success Criteria

1. Management Company users can see a "New Association" button in the Associations list.
2. Clicking the button opens a standardized creation form.
3. Submitting the form creates a new association and seeds its accounting data accurately.
4. All operations are durable and idempotent via DBOS.
5. Code passes all Svelte and TypeScript checks.
