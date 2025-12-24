# Phase 8: CAM ARC Request Lifecycle Implementation Roadmap

Based on the storyboard document `(Phase 8) CAM Storyboard 2 - ARC Request Lifecycle.md`.

---

## Current Implementation Status

### ✅ Already Implemented

#### Frontend
- [x] ARC list page with split view (`/app/cam/arc/+page.svelte`)
- [x] Search and status filtering
- [x] Detail page with tabs (`/app/cam/arc/[id]/+page.svelte`)
- [x] Overview tab with request details
- [x] Documents tab (basic)
- [x] History tab (basic)
- [x] New ARC request form (`/app/cam/arc/new/+page.svelte`)
- [x] ARCDecisionModal with rationale/conditions
- [x] Decision buttons (Approve, Deny, Table, Request Changes)

#### Backend
- [x] `arcRequest.create` - Create ARC request
- [x] `arcRequest.get` - Get single request with relations
- [x] `arcRequest.list` - List requests with pagination/filters
- [x] `arcRequest.update` - Update request details
- [x] `arcRequest.submit` - Submit draft request
- [x] `arcRequest.withdraw` - Withdraw request
- [x] `arcRequest.addDocument` - Add document to request
- [x] `arcRequest.recordDecision` - Record final decision
- [x] `arcReview.addMember` / `removeMember` / `listMembers` - Committee membership
- [x] `arcReview.assignCommittee` - Assign committee to request
- [x] `arcReview.submitReview` - Member review submission
- [x] `arcReview.recordDecision` - Final decision with quorum validation

---

## P8.1 Canonical States Enhancement

### P8.1.1 Add Missing Status Support
- [ ] Add `NEEDS_INFO` status handling in frontend
- [ ] Add `BOARD_REVIEW` status handling in frontend
- [x] `APPROVED_WITH_CONDITIONS` already in decision modal

### P8.1.2 Status Color Mapping
- [x] Status colors defined in list and detail pages

### Deliverables
- [ ] All canonical states supported in UI

---

## P8.2 Enhanced Detail Tabs

### P8.2.1 Proposal Tab (Tab 2)
- [x] Display drawings/plans with inline preview ✓
- [x] Display specs and supporting docs ✓
- [x] Document categorization (PLANS, SPECS, PHOTO, etc.) ✓
- [x] Permits section ✓

### P8.2.2 Governing Rules Tab (Tab 3)
- [x] Display architectural guidelines placeholder ✓
- [x] Link to precedent ARC requests ✓
- [x] Prior requests for same unit ✓
- [x] Similar requests by category ✓

### P8.2.3 Decisions Tab (Tab 4)
- [x] Vote breakdown display with progress bar ✓
- [x] Decision options with mandatory rationale ✓
- [x] Conditional terms display ✓
- [x] Quorum indicator ✓
- [x] Approval threshold indicator ✓
- [x] Individual vote details ✓

### P8.2.4 History & Audit Tab Enhancement (Tab 5)
- [x] ActivityEvent timeline (like violations) ✓
- [x] Actor type badges (HUMAN/SYSTEM/AI) ✓
- [x] Rationale display for each decision ✓
- [x] Related documents display ✓

### Deliverables
- [x] All 5 tabs fully implemented ✓

---

## P8.3 Board Voting Panel

### P8.3.1 Voting UI
- [x] Vote summary with progress bar ✓
- [x] Vote controls (Approve/Deny/Request Changes/Table) ✓
- [x] Quorum indicator with status ✓
- [x] Approval threshold indicator ✓
- [x] Individual vote details with notes/conditions ✓

### P8.3.2 Vote Recording
- [x] `arcReview.getVotes` - Get all votes with summary ✓
- [x] `arcReview.getCommitteeForRequest` - Get committee members ✓
- [x] Vote tally calculation ✓
- [x] Threshold validation ✓

### Deliverables
- [x] Complete voting panel UI (Decisions tab) ✓
- [x] Backend vote endpoints ✓

---

## P8.4 Prior Precedents

### P8.4.1 Backend Endpoint
- [x] `arcRequest.getPriorPrecedents` - Get similar past ARC requests ✓

### P8.4.2 Frontend Display
- [x] Prior precedents section in Governing Rules tab ✓
- [x] Link to past approved/denied requests of same category ✓
- [x] Prior requests for same unit ✓

### Deliverables
- [x] Prior precedent lookup working ✓

---

## P8.5 Backend API Enhancements

### P8.5.1 New Endpoints Needed
- [x] `arcRequest.requestInfo` - Request more info from applicant ✓
- [x] `arcRequest.submitInfo` - Applicant submits requested info ✓
- [x] `arcRequest.getPriorPrecedents` - Prior similar requests ✓
- [x] `arcReview.submitReview` - Individual committee member vote (existing) ✓
- [x] `arcReview.getVotes` - Get all votes for a request ✓
- [x] `arcReview.getCommitteeForRequest` - Get committee with members ✓

### P8.5.2 ActivityEvent Generation
- [x] Submission → ARC_REQUEST SUBMIT ✓
- [x] Info requested → ARC_REQUEST STATUS_CHANGE ✓
- [x] Info submitted → ARC_REQUEST SUBMIT ✓
- [x] Decision → ARC_REQUEST APPROVE/DENY ✓
- [x] Document added → ARC_REQUEST UPDATE ✓
- [x] Withdrawal → ARC_REQUEST CANCEL ✓
- [x] Creation → ARC_REQUEST CREATE (existing) ✓

### Deliverables
- [x] All endpoints implemented ✓
- [x] ActivityEvents for all actions ✓

---

## P8.6 Testing & Polish

### P8.6.1 Flow Testing
- [ ] Test complete ARC lifecycle (DRAFT → APPROVED)
- [ ] Test conditional approval flow
- [ ] Test denial with rationale
- [ ] Test info request flow

### P8.6.2 Edge Cases
- [ ] Quorum not met handling
- [ ] Threshold not met handling
- [ ] Expired request handling

### Deliverables
- [ ] All flows tested
- [ ] Edge cases handled

---

## Implementation Priority

1. **P8.2.4** - Enhanced History tab (reuse violations pattern)
2. **P8.5.2** - ActivityEvent generation for existing actions
3. **P8.4** - Prior precedents endpoint and display
4. **P8.2.1** - Proposal tab enhancement
5. **P8.2.3** - Decisions tab with vote breakdown
6. **P8.3** - Board voting panel
7. **P8.1.1** - Missing status support
8. **P8.2.2** - Governing rules tab
