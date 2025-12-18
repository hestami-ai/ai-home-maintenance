## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (existing backend) |
| Authorization | Cerbos |
| Observability | OpenTelemetry |

---

## **15\. Implementation Roadmap**

### **15.1 Current State Assessment**

| Component | Status | Notes |
|-----------|--------|-------|
| Prisma Schema | ✅ Complete | All enums updated, cross-domain FKs added, conflict of interest tracking added |
| oRPC Routes | ✅ Complete | Full state machine endpoints, voting lifecycle, resolution linking |
| DBOS Workflows | ⚠️ Partial | meetingLifecycle.ts updated with new states; motionLifecycle.ts pending |
| Cerbos Policies | ✅ Complete | governance_meeting, governance_motion, governance_vote, governance_resolution policies created |
| Frontend API Client | ✅ Complete | All new endpoints exposed in governanceApi |
| Frontend UI | ⚠️ Partial | Placeholder pages exist; missing tabbed detail view, voting panels |
| Real-time (WS/SSE) | ❌ Missing | No infrastructure for live vote tallying |
| Cross-domain Links | ✅ Schema Ready | Agenda items can link to ARC/Violations/Work Orders/Policies; UI pending |
| AI Minutes | ❌ Missing | No AI-assisted generation |
| Tests | ❌ Deferred | Unit/Integration/E2E tests planned but deferred |

---

### **15.2 Implementation Phases**

#### **Phase 11.1: Schema & State Machine Alignment** ✅ COMPLETE

**Objective:** Align Prisma schema with spec-defined states and add missing fields.

- [x] **11.1.1** Update `MeetingStatus` enum to include: `SCHEDULED`, `IN_SESSION`, `ADJOURNED`, `MINUTES_DRAFT`, `MINUTES_APPROVED`, `ARCHIVED`, `CANCELLED`
- [x] **11.1.2** Update `BoardMotionStatus` enum to include: `PROPOSED`, `SECONDED`, `UNDER_DISCUSSION`, `UNDER_VOTE`, `TABLED`, `APPROVED`, `DENIED`, `WITHDRAWN`
- [x] **11.1.3** Add `quorumRequired` field to `Meeting` model
- [x] **11.1.4** Add `virtualLink` field to `Meeting` model; `quorumMet` derived at runtime
- [x] **11.1.5** Add cross-domain link fields to `MeetingAgendaItem`:
  - [x] `arcRequestId` (optional FK)
  - [x] `violationId` (optional FK)
  - [x] `workOrderId` (optional FK)
  - [x] `policyDocumentId` (optional FK)
- [x] **11.1.6** Add `motionId` FK to `Vote` model (link votes to motions)
- [x] **11.1.7** Add `motionId` FK to `Resolution` model (link resolutions to motions)
- [x] **11.1.8** Add `hasConflictOfInterest` and `conflictNotes` to `VoteBallot` model
- [x] **11.1.9** Run `prisma migrate dev` (3 migrations applied) and regenerate Zod types
- [x] **11.1.10** Run `npm run check` - passes with 0 errors

---

#### **Phase 11.2: Cerbos Authorization Policies** ✅ COMPLETE

**Objective:** Create fine-grained authorization for governance resources.

- [x] **11.2.1** Create `cerbos/policies/resource/governance_meeting.yaml`
  - [x] Define actions: `create`, `view`, `edit`, `delete`, `start_session`, `adjourn`, `approve_minutes`, `archive`
  - [x] Board members: full session management access
  - [x] Managers/Admins: full access
  - [x] Owners: read-only
  - [x] Auditors: read-only
- [x] **11.2.2** Create `cerbos/policies/resource/governance_motion.yaml`
  - [x] Define actions: `create`, `view`, `edit`, `propose`, `second`, `vote`, `decide`, `withdraw`, `delete`
  - [x] Board members: propose, second, vote, withdraw
  - [x] Chair: decide (via isChair condition)
- [x] **11.2.3** Create `cerbos/policies/resource/governance_vote.yaml`
  - [x] Define actions: `create`, `view`, `cast_ballot`, `close`, `tally`, `delete`
  - [x] Voting eligibility enforced by eligibleVoterIds condition
- [x] **11.2.4** Create `cerbos/policies/resource/governance_resolution.yaml`
  - [x] Define actions: `create`, `view`, `edit`, `adopt`, `supersede`, `archive`, `delete`
- [x] **11.2.5** Verified no duplicate resource+version definitions
- [ ] **11.2.6** Test policies with Cerbos playground (deferred - Windows not supported)

---

#### **Phase 11.3: Backend API Enhancement** ✅ COMPLETE

**Objective:** Implement complete governance API with state machine enforcement.

##### **11.3.1 Meeting API Enhancements**

- [x] **11.3.1.1** Add `meeting/startSession` endpoint (SCHEDULED → IN_SESSION)
  - [x] Validate quorum before allowing
  - [x] Validate agenda items exist
- [x] **11.3.1.2** Add `meeting/adjourn` endpoint (IN_SESSION → ADJOURNED)
  - [x] Auto-creates minutes placeholder
- [x] **11.3.1.3** Add `meeting/submitMinutesDraft` endpoint (ADJOURNED → MINUTES_DRAFT)
- [x] **11.3.1.4** Add `meeting/approveMinutes` endpoint (MINUTES_DRAFT → MINUTES_APPROVED)
- [x] **11.3.1.5** Add `meeting/archive` endpoint (MINUTES_APPROVED → ARCHIVED)
- [x] **11.3.1.6** Add `meeting/getQuorumStatus` endpoint
- [ ] **11.3.1.7** Add `meeting/bulkRecordAttendance` endpoint (deferred)
- [x] **11.3.1.8** Existing `meeting/addAgendaItem` supports cross-domain links via schema

##### **11.3.2 Motion API Enhancements**

- [x] **11.3.2.1** `boardMotion/create` enforces PROPOSED initial state (existing)
- [x] **11.3.2.2** Add `boardMotion/openVoting` endpoint (SECONDED/UNDER_DISCUSSION → UNDER_VOTE)
  - [x] Creates linked Vote record
- [x] **11.3.2.3** Add `boardMotion/closeVoting` endpoint (UNDER_VOTE → APPROVED/DENIED)
  - [x] Auto-calculate outcome based on vote tally
- [x] **11.3.2.4** Add `boardMotion/table` endpoint (any pre-decided state → TABLED)
- [x] **11.3.2.5** Enforce immutability: no edits after APPROVED/DENIED state
- [ ] **11.3.2.6** Link motion outcomes to downstream actions (deferred to Phase 11.7)

##### **11.3.3 Vote API Enhancements**

- [x] **11.3.3.1** Add conflict of interest tracking to `castBallot` (hasConflictOfInterest, conflictNotes)
- [x] **11.3.3.2** Enforce vote immutability (no changes after cast)
- [x] **11.3.3.3** Add `vote/getEligibleVoters` endpoint
- [ ] **11.3.3.4** Add vote confirmation requirement before finalization (UI concern)

##### **11.3.4 Resolution API Enhancements**

- [x] **11.3.4.1** Add `resolution/linkToMotion` endpoint
- [x] **11.3.4.2** Add `resolution/getLinkedActions` endpoint (returns linked motion, work orders, policies)
- [ ] **11.3.4.3** Add `resolution/linkDownstreamAction` endpoint (deferred to Phase 11.7)

---

#### **Phase 11.4: Frontend API Client Extension** ✅ COMPLETE

**Objective:** Expose all new backend endpoints to frontend.

- [x] **11.4.1** Extend `governanceApi.meetings` with:
  - [x] `get`, `create`, `startSession`, `adjourn`, `submitMinutesDraft`, `approveMinutes`, `archive`
  - [x] `getQuorumStatus`, `addAgendaItem`, `recordAttendance`
  - [x] `openVote`, `castBallot`, `getEligibleVoters`, `tallyVote`, `closeVote`
- [x] **11.4.2** Extend `governanceApi.motions` with:
  - [x] `openVoting`, `closeVoting`, `table`
- [x] **11.4.3** Extend `governanceApi.resolutions` with:
  - [x] `get`, `create`, `updateStatus`, `linkToMotion`, `getLinkedActions`
- [x] **11.4.4** Run `npm run check` - passes with 0 errors

---

#### **Phase 11.5: DBOS Workflow Enhancement** ✅ COMPLETE

**Objective:** Implement durable workflows for governance lifecycle.

- [x] **11.5.1** Enhance `meetingLifecycle.ts` with full state machine
  - [x] Updated validTransitions for all new states
  - [x] Minutes placeholder created on ADJOURNED
  - [ ] Add notification steps for each transition (deferred)
- [x] **11.5.2** Create `motionLifecycle.ts` workflow
  - [x] PROPOSED → SECONDED → UNDER_VOTE → APPROVED/DENIED
  - [x] Handle TABLED and WITHDRAWN branches
  - [x] Trigger downstream actions on approval (stub)
- [x] **11.5.3** Create `resolutionCloseout.ts` workflow
  - [x] Link resolution to motion
  - [x] Create downstream work orders
  - [x] Update policy documents
- [x] **11.5.4** Add workflow status tracking events for real-time updates

---

#### **Phase 11.6: Real-time Infrastructure (SSE)** ✅ COMPLETE

**Objective:** Enable live vote tallying and attendance updates.

- [x] **11.6.1** Selected SSE approach for simpler implementation
- [x] **11.6.2** Create SSE endpoint: `/api/v1/governance/meeting/[id]/live`
  - [x] Stream: attendance changes, vote tallies, motion status changes, quorum updates
  - [x] Heartbeat every 30 seconds
- [x] **11.6.3** Create SSE endpoint: `/api/v1/governance/vote/[id]/live`
  - [x] Stream: ballot counts (yes/no/abstain), quorum status, vote closure
- [x] **11.6.4** Implement server-side event emitter for governance events
- [x] **11.6.5** Create client-side Svelte stores (`meetingLive`, `voteLive`) in `governanceLive.ts`
- [x] **11.6.6** Add reconnection logic with exponential backoff and error handling

---

#### **Phase 11.7: Frontend Implementation**

**Objective:** Build complete governance UI per spec.

##### **11.7.1 Primary Screen: CAM-GOV-01 (Split View)** ✅ COMPLETE

- [x] **11.7.1.1** Enhance left pane meetings list
  - [x] Add columns: Date, Type, Status
  - [x] Add filters: Status, Meeting type
  - [ ] Add dense table view option (deferred)
- [x] **11.7.1.2** Implement right pane tabbed detail view
  - [x] Tab 1: Overview (type, date/time, location, attendees, quorum status)
  - [x] Tab 2: Agenda (ordered items with AgendaItemRow component)
  - [x] Tab 3: Motions & Votes (motion list with MotionCard component)
  - [x] Tab 4: Resolutions & Outcomes (approved motions display)
  - [x] Tab 5: Minutes (MinutesEditor component)
  - [x] Tab 6: History & Audit (GovernanceAuditTimeline component)

##### **11.7.2 Secondary Screen: CAM-GOV-02 (Meeting Creation)** ✅ COMPLETE

- [x] **11.7.2.1** Enhance `ScheduleMeetingModal` component with step wizard
  - [x] Step 1: Select meeting type (card-based selection)
  - [x] Step 2: Set date/time/location
  - [x] Step 3: Meeting details (title, quorum, agenda)
  - [x] Step 4: Review and confirm
- [x] **11.7.2.2** Add virtual meeting link support
- [x] **11.7.2.3** Add quorum requirement field
- [ ] **11.7.2.4** Add recurring meeting support (deferred)

##### **11.7.3 Secondary Screen: CAM-GOV-03 (Motion Proposal)** ✅ COMPLETE

- [x] **11.7.3.1** Create `ProposeMotionPanel` component
  - [x] Motion title and text input
  - [x] Category selector
  - [x] Related entities selector (ARC, Violations, Work Orders, Policies)
  - [x] Supporting documents uploader (UI ready)
  - [x] Submit for seconding button
- [x] **11.7.3.2** Motion seconding handled via MotionCard status
- [x] **11.7.3.3** Motion status indicator in MotionCard component

##### **11.7.4 Secondary Screen: CAM-GOV-04 (Voting Panel)** ✅ COMPLETE

- [x] **11.7.4.1** Create `VotingPanel` component (in 11.7.5.5)
  - [x] Motion summary display (motionTitle prop)
  - [ ] Supporting docs viewer (deferred)
  - [x] Vote controls (Yes/No/Abstain buttons)
  - [x] Conflict of interest checkbox
  - [x] Vote confirmation dialog
- [x] **11.7.4.2** Add real-time vote tally display (VoteTallyCard embedded)
- [x] **11.7.4.3** Add quorum indicator (QuorumIndicator component available)
- [x] **11.7.4.4** Implement vote finality (hasVoted/isClosed/canVote props)

##### **11.7.5 UI Components** ✅ COMPLETE

- [x] **11.7.5.1** Create `QuorumIndicator` component
- [x] **11.7.5.2** Create `VoteTallyCard` component
- [x] **11.7.5.3** Create `MotionCard` component
- [x] **11.7.5.4** Create `AttendanceList` component
- [x] **11.7.5.5** Create `VotingPanel` component (with conflict of interest)
- [x] **11.7.5.6** Create `AgendaItemRow` component (with cross-domain links)
- [x] **11.7.5.7** Create `MinutesEditor` component (with AI assist placeholder)
- [x] **11.7.5.8** Create `GovernanceAuditTimeline` component

##### **11.7.6 Type Centralization** ✅ COMPLETE

- [x] **11.7.6.1** Add/update governance types in `src/lib/api/cam.ts`
  - [x] `Meeting` interface (full spec with relations)
  - [x] `MeetingAgendaItem` interface (with cross-domain links)
  - [x] `BoardMotion` interface (with status types)
  - [x] `Vote` interface (with ballots)
  - [x] `VoteBallot` interface (with conflict tracking)
  - [x] `Resolution` interface (with relations)
  - [x] Type aliases: `MeetingType`, `MeetingStatus`, `BoardMotionStatus`, `VoteChoice`, `ResolutionStatus`
- [x] **11.7.6.2** Add governance API functions to `cam.ts` (completed in Phase 11.4)

---

#### **Phase 11.8: Cross-Domain Integration**

**Objective:** Link governance outcomes to other CAM domains.

- [x] **11.8.1** Agenda Item → ARC Request linking (schema complete)
  - [x] UI: `AgendaItemLinkSelector` component for selecting entities
  - [x] API: Store `arcRequestId` on agenda item
  - [x] Display: `AgendaItemRow` shows linked entities
- [x] **11.8.2** Agenda Item → Violation linking (schema complete)
  - [x] UI: `AgendaItemLinkSelector` supports violations
- [x] **11.8.3** Agenda Item → Work Order linking (schema complete)
  - [x] UI: `AgendaItemLinkSelector` supports work orders
- [ ] **11.8.4** Agenda Item → Budget Item linking (deferred - no budgetItemId added)
- [x] **11.8.5** Resolution → Work Order creation (implemented in resolutionCloseout.ts workflow)
  - [x] When resolution approves work, auto-create work order
  - [x] Set `originType: BOARD_DIRECTIVE`, `resolutionId`
- [x] **11.8.6** Resolution → Policy update (implemented in resolutionCloseout.ts workflow)
  - [x] When resolution changes policy, update PolicyDocument
- [x] **11.8.7** Motion → ARC Decision
  - [x] `boardMotion/applyToArc` endpoint updates ARC status based on motion outcome

---

#### **Phase 11.9: AI-Assisted Minutes Generation** ✅ COMPLETE (Infrastructure)

**Objective:** Prepare infrastructure for AI minutes generation (LLM integration deferred).

- [x] **11.9.1** Create `MinutesGenerationService` in `minutesGenerationService.ts`
  - [x] Input: meetingId, includeAttendance, includeMotions, includeVotes
  - [x] Output: structured minutes draft with sections
- [x] **11.9.2** Create `MinutesTemplate` interface
  - [x] Standard sections: Call to Order, Roll Call, Agenda Items, Motions, Vote Results, Adjournment
  - [x] `DEFAULT_MINUTES_TEMPLATE` constant
- [x] **11.9.3** Create `meeting/generateMinutesDraft` endpoint
  - [x] Returns template-based draft from structured meeting data
  - [ ] LLM enhancement deferred
- [x] **11.9.4** Create `MinutesEditor` component with AI assist button (disabled until LLM ready)
- [ ] **11.9.5** Add transcript upload capability (deferred for future LLM processing)

---

#### **Phase 11.10: Audit & Activity Events** ✅ COMPLETE

**Objective:** Ensure complete audit trail for governance actions.

- [x] **11.10.1** Add ActivityEvent creation for all governance actions:
  - [x] Meeting created → `CREATE`
  - [x] Meeting started → `START_SESSION`
  - [x] Meeting adjourned → `ADJOURN`
  - [x] Motion proposed → `PROPOSE`
  - [x] Motion seconded → `SECOND`
  - [x] Voting opened → `OPEN_VOTING`
  - [x] Voting closed → `CLOSE_VOTING`
  - [x] Motion tabled → `TABLE`
  - [x] Vote cast → `CAST_BALLOT`
  - [x] Minutes approved → `APPROVE_MINUTES`
  - [x] Resolution adopted → `ADOPT`
- [x] **11.10.2** Capture actor, role, authority context in each event (via `governanceActivityService.ts`)
- [x] **11.10.3** Added MEETING, MOTION, VOTE, RESOLUTION entity types to schema
- [x] **11.10.4** Added governance action types to ActivityActionType enum
- [ ] **11.10.5** Create governance-specific audit report (deferred)

---

#### **Phase 11.11: Testing (Deferred)**

**Objective:** Comprehensive test coverage (implementation deferred per user request).

- [ ] **11.11.1** Unit Tests
  - [ ] State machine transition validation
  - [ ] Quorum calculation
  - [ ] Vote tally logic
  - [ ] Authorization checks
- [ ] **11.11.2** Integration Tests
  - [ ] Full meeting lifecycle flow
  - [ ] Motion → Vote → Resolution flow
  - [ ] Cross-domain linking
- [ ] **11.11.3** E2E Tests (Playwright)
  - [ ] Meeting creation and scheduling
  - [ ] Live voting session
  - [ ] Minutes approval flow

---

### **15.3 Implementation Order & Dependencies**

```
Phase 11.1 (Schema) ✅ ──┬──> Phase 11.2 (Cerbos) ✅
                         │
                         └──> Phase 11.3 (API) ✅ ──┬──> Phase 11.4 (Frontend API) ✅
                                                    │
                                                    └──> Phase 11.5 (Workflows)
                                                              │
                                                              v
                                                    Phase 11.6 (Real-time)
                                                              │
                                                              v
                                                    Phase 11.7 (Frontend UI)
                                                              │
                                                              v
                                                    Phase 11.8 (Cross-domain)
                                                              │
                                                              v
                                                    Phase 11.9 (AI Minutes)
                                                              │
                                                              v
                                                    Phase 11.10 (Audit)
                                                              │
                                                              v
                                                    Phase 11.11 (Testing) [DEFERRED]
```

---

### **15.4 Estimated Effort**

| Phase | Effort | Priority | Status |
|-------|--------|----------|--------|
| 11.1 Schema Alignment | 2-3 hours | P0 - Critical | ✅ Complete |
| 11.2 Cerbos Policies | 2-3 hours | P0 - Critical | ✅ Complete |
| 11.3 Backend API | 8-12 hours | P0 - Critical | ✅ Complete |
| 11.4 Frontend API Client | 2-3 hours | P0 - Critical | ✅ Complete |
| 11.5 DBOS Workflows | 4-6 hours | P1 - High | ✅ Complete |
| 11.6 Real-time (SSE) | 4-6 hours | P1 - High | ✅ Complete |
| 11.7 Frontend UI | 12-16 hours | P1 - High | ✅ Complete (screens + 9 components) |
| 11.8 Cross-domain | 4-6 hours | P2 - Medium | ✅ Complete (UI + workflows) |
| 11.9 AI Minutes | 2-4 hours | P2 - Medium | ✅ Complete (infrastructure, LLM deferred) |
| 11.10 Audit Events | 2-3 hours | P1 - High | ✅ Complete |
| 11.11 Testing | Deferred | P3 - Deferred | ❌ Deferred |

**Total Estimated: 40-60 hours**
**Completed: ~50-55 hours (Phases 11.1-11.10 complete; 11.11 Testing deferred)**

---

### **15.5 Success Criteria**

- [x] All meeting states from spec are implemented and enforced
- [x] All motion states from spec are implemented and enforced
- [x] Votes are immutable once cast
- [x] Quorum is validated before starting session
- [x] Real-time vote tallying works in live meeting (SSE infrastructure complete)
- [x] Cross-domain links schema ready (UI pending)
- [x] All governance actions create ActivityEvents (service + schema complete)
- [x] Cerbos policies enforce role-based access
- [x] Frontend matches CAM-GOV-01 through CAM-GOV-03 specs (CAM-GOV-04 VotingPanel component ready)
- [x] `npm run check` passes with 0 errors

