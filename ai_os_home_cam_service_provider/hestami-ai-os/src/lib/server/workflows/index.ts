/**
 * DBOS Workflow Registry
 *
 * All workflows are registered here and exported for use in API routes.
 */

// Work Order Lifecycle (Phase 4)
export {
	workOrderLifecycle_v1,
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError,
	type TransitionInput,
	type TransitionResult
} from './workOrderLifecycle.js';

// Violation Lifecycle (Phase 5)
export {
	violationLifecycle_v1,
	startViolationTransition,
	getViolationTransitionStatus,
	getViolationTransitionError,
	type ViolationTransitionInput,
	type ViolationTransitionResult
} from './violationLifecycle.js';

// ARC Review Lifecycle (Phase 6)
export {
	arcReviewLifecycle_v1,
	startARCReviewTransition,
	getARCReviewTransitionStatus,
	getARCReviewTransitionError,
	type ARCTransitionInput,
	type ARCTransitionResult
} from './arcReviewLifecycle.js';

// Assessment Posting (Phase 13)
export {
	assessmentPosting_v1,
	startAssessmentPosting,
	getAssessmentPostingStatus,
	type AssessmentPostingInput,
	type AssessmentPostingResult
} from './assessmentPosting.js';

// Meeting Lifecycle (Phase 13)
export {
	meetingLifecycle_v1,
	startMeetingTransition,
	getMeetingTransitionStatus,
	type MeetingTransitionInput,
	type MeetingTransitionResult
} from './meetingLifecycle.js';

// Future workflows will be exported here:
// - apPaymentProcessing_v1 (Phase 13)
// - vendorAssignment_v1 (Phase 13)
