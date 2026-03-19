/**
 * Document Registry
 *
 * Maps each DocumentType to its definition (label, description, applicable
 * category, system prompt). Provides getAvailableDocuments() which inspects
 * the dialogue's actual data (INTAKE sub-phase, plan contents, architecture
 * doc, claims) to decide which documents can be generated right now.
 */

import { DocumentType, type DocumentDefinition } from './types.js';
import { getWorkflowState } from '../workflow/stateMachine.js';
import { getIntakeConversation, getClaims } from '../events/reader.js';
import { getArchitectureDocumentForDialogue } from '../database/architectureStore.js';
import type { IntakePlanDocument, IntakeConversationState } from '../types/intake.js';
import type { ArchitectureDocument } from '../types/architecture.js';
import type { Claim } from '../types/index.js';

// ==================== DIALOGUE CONTEXT ====================

/**
 * Snapshot of all data relevant to availability checks.
 * Built once per getAvailableDocuments() call, then passed to each checker.
 */
interface DialogueContext {
	currentPhase: string;
	requestCategory: string | undefined;
	plan: IntakePlanDocument | null;
	intakeState: IntakeConversationState | null;
	archDoc: ArchitectureDocument | null;
	claims: Claim[];
}

// ==================== SYSTEM PROMPTS ====================

const VISION_PROMPT = `You are a senior product strategist generating a Vision Document.
You have access to structured data from a requirements gathering conversation.
Your job is to synthesize this into a compelling, publication-ready Vision Document.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable defaults for any gaps. The human will view your output as-is.

Generate a complete Vision Document in markdown with these sections:
1. Problem Statement
2. Opportunity & Market Context
3. Stakeholders
4. Product Vision
5. Value Proposition
6. Expected Impact
7. High-Level Concept`;

const CONOPS_PROMPT = `You are a systems engineer generating a Concept of Operations (ConOps) document.
You have access to structured data from a requirements gathering conversation including
user personas, user journeys, and workflow proposals.
Your job is to synthesize this into a comprehensive, narrative ConOps document.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable operational scenarios for any gaps. The human will view your output as-is.

Generate a complete ConOps in markdown with these sections:
1. Purpose & Scope
2. Operational Environment
3. Actors & Roles
4. Operational Scenarios (narrative walkthroughs)
5. User Workflows
6. External Systems & Interfaces
7. Operational Constraints
8. Assumptions`;

const PRD_PROMPT = `You are a senior product manager generating a Product Requirements Document (PRD).
You have access to structured data from a requirements gathering conversation.
Your job is to synthesize this into a comprehensive, publication-ready PRD.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable defaults for any gaps. The human will view your output as-is.

Generate a complete PRD in markdown with these sections:
1. Executive Summary
2. Product Vision & Goals
3. User Personas
4. Core Capabilities
5. User Journeys & Workflows
6. Requirements (functional + non-functional)
7. Constraints & Assumptions
8. Success Metrics
9. Release Phasing
10. Open Questions & Risks`;

const DOMAIN_MODEL_PROMPT = `You are a domain modeling expert generating a Domain Model document.
You have access to domain proposals, entity proposals, and workflow proposals
from a requirements gathering conversation.
Your job is to synthesize this into a comprehensive Domain Model document.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable entities, relationships, and invariants for any gaps.
The human will view your output as-is.

Generate a complete Domain Model document in markdown with these sections:
1. Overview
2. Business Domains
3. Core Entities (with attributes and relationships)
4. Entity Relationship Descriptions
5. Domain Invariants & Business Rules
6. Ubiquitous Language / Glossary`;

const ARCHITECTURE_PROMPT = `You are a senior software architect generating a System Architecture Document.
You have access to architecture data including capabilities, components, data models,
interfaces, and implementation sequences from a governed workflow.
Your job is to synthesize this into a comprehensive Architecture Document.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable architectural decisions for any gaps. The human will view your output as-is.

Generate a complete System Architecture Document in markdown with these sections:
1. Executive Summary
2. System Context & Scope
3. Architectural Drivers (key requirements & constraints)
4. Capability Architecture
5. Component Architecture (with responsibilities)
6. Data Architecture (models & relationships)
7. Interface Definitions (APIs & contracts)
8. Technology Stack Decisions
9. Cross-Cutting Concerns (security, observability, etc.)
10. Architecture Decision Records`;

const ROADMAP_PROMPT = `You are a technical program manager generating an Implementation Roadmap.
You have access to architecture data, implementation sequences, phasing strategy,
and task graph information from a governed workflow.
Your job is to synthesize this into a comprehensive Implementation Roadmap.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable milestones and sequencing for any gaps. The human will view your output as-is.

Generate a complete Implementation Roadmap in markdown with these sections:
1. Overview & Goals
2. Release Phases (MVP, V2, Future)
3. Phase Details (deliverables, dependencies, estimated effort)
4. Implementation Sequence
5. Dependency Graph (narrative description)
6. Risk Factors & Mitigations
7. Success Criteria per Phase`;

const TECHNICAL_BRIEF_PROMPT = `You are a senior engineer generating a Technical Brief for a scoped technical task.
You have access to structured data from a requirements gathering conversation about
a bug fix, refactor, or other technical task.
Your job is to synthesize this into a clear, actionable Technical Brief.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable technical context for any gaps. The human will view your output as-is.

Generate a complete Technical Brief in markdown with these sections:
1. Summary
2. Problem Statement
3. Scope & Boundaries
4. Technical Context
5. Proposed Approach
6. Constraints & Dependencies
7. Risks & Mitigations
8. Acceptance Criteria`;

const CHANGE_IMPACT_PROMPT = `You are a senior engineer generating a Change Impact Analysis.
You have access to claims, verdicts, and technical notes from a governed workflow
that analyzed a technical change.
Your job is to synthesize this into a comprehensive Change Impact Analysis.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable impact assessments for any gaps. The human will view your output as-is.

Generate a complete Change Impact Analysis in markdown with these sections:
1. Summary of Change
2. Affected Components
3. Assumptions & Verified Claims
4. Disproved Claims & Surprises
5. Risk Assessment
6. Dependency Impact
7. Testing Recommendations
8. Rollback Considerations`;

const VERIFICATION_PROMPT = `You are a QA lead generating a Verification Summary.
You have access to claims, verdicts, and validation findings from a governed workflow.
Your job is to synthesize this into a clear Verification Summary.

IMPORTANT: Do NOT ask for more information. Instead, use your domain expertise
to propose reasonable verification assessments for any gaps. The human will view your output as-is.

Generate a complete Verification Summary in markdown with these sections:
1. Executive Summary
2. Verification Scope
3. Claims & Their Verdicts (table format)
4. Verified Claims (detail)
5. Disproved Claims (detail with implications)
6. Unresolved / Conditional Claims
7. Validation Findings
8. Recommendations`;

// ==================== DOCUMENT DEFINITIONS ====================

export const DOCUMENT_DEFINITIONS: Record<DocumentType, DocumentDefinition> = {
	[DocumentType.VISION]: {
		type: DocumentType.VISION,
		label: 'Vision Document',
		description: 'Why this product should exist — problem, opportunity, stakeholders, impact',
		applicableCategory: 'product_or_feature',
		systemPrompt: VISION_PROMPT,
	},
	[DocumentType.CONOPS]: {
		type: DocumentType.CONOPS,
		label: 'Concept of Operations',
		description: 'How the system will be used — operational scenarios, actors, workflows',
		applicableCategory: 'product_or_feature',
		systemPrompt: CONOPS_PROMPT,
	},
	[DocumentType.PRD]: {
		type: DocumentType.PRD,
		label: 'Product Requirements Document',
		description: 'What the product must deliver — capabilities, personas, success metrics',
		applicableCategory: 'product_or_feature',
		systemPrompt: PRD_PROMPT,
	},
	[DocumentType.DOMAIN_MODEL]: {
		type: DocumentType.DOMAIN_MODEL,
		label: 'Domain Model',
		description: 'Core business entities, relationships, and invariants',
		applicableCategory: 'any',
		systemPrompt: DOMAIN_MODEL_PROMPT,
	},
	[DocumentType.ARCHITECTURE]: {
		type: DocumentType.ARCHITECTURE,
		label: 'System Architecture Document',
		description: 'System structure — capabilities, components, data models, interfaces',
		applicableCategory: 'any',
		systemPrompt: ARCHITECTURE_PROMPT,
	},
	[DocumentType.IMPLEMENTATION_ROADMAP]: {
		type: DocumentType.IMPLEMENTATION_ROADMAP,
		label: 'Implementation Roadmap',
		description: 'How development will occur — phases, milestones, sequencing',
		applicableCategory: 'any',
		systemPrompt: ROADMAP_PROMPT,
	},
	[DocumentType.TECHNICAL_BRIEF]: {
		type: DocumentType.TECHNICAL_BRIEF,
		label: 'Technical Brief',
		description: 'Scoped technical task — problem, approach, constraints, acceptance criteria',
		applicableCategory: 'technical_task',
		systemPrompt: TECHNICAL_BRIEF_PROMPT,
	},
	[DocumentType.CHANGE_IMPACT]: {
		type: DocumentType.CHANGE_IMPACT,
		label: 'Change Impact Analysis',
		description: 'Impact of a technical change — affected components, risks, testing needs',
		applicableCategory: 'any',
		systemPrompt: CHANGE_IMPACT_PROMPT,
	},
	[DocumentType.VERIFICATION_SUMMARY]: {
		type: DocumentType.VERIFICATION_SUMMARY,
		label: 'Verification Summary',
		description: 'Claims, verdicts, and validation findings — what was verified and what failed',
		applicableCategory: 'any',
		systemPrompt: VERIFICATION_PROMPT,
	},
};

// ==================== DATA-PRESENCE CHECKS ====================

/**
 * Per-document-type check: does the dialogue have enough data right now
 * to generate a meaningful version of this document?
 *
 * These are deliberately generous — the LLM is instructed to fill gaps —
 * but we avoid showing a document option when there is literally nothing
 * relevant to feed it.
 */
const DATA_CHECKS: Record<DocumentType, (ctx: DialogueContext) => boolean> = {
	// Vision: needs at least a summary, productVision, or some requirements
	[DocumentType.VISION]: (ctx) => {
		const p = ctx.plan;
		return !!p && (!!p.summary || !!p.productVision || (p.requirements?.length ?? 0) > 0);
	},

	// ConOps: needs personas, user journeys, or workflow proposals
	[DocumentType.CONOPS]: (ctx) => {
		const p = ctx.plan;
		return !!p && (
			(p.personas?.length ?? 0) > 0 ||
			(p.userJourneys?.length ?? 0) > 0 ||
			(p.workflowProposals?.length ?? 0) > 0
		);
	},

	// PRD: needs requirements + some structure (title or summary)
	[DocumentType.PRD]: (ctx) => {
		const p = ctx.plan;
		return !!p && (p.requirements?.length ?? 0) > 0 && (!!p.summary || !!p.title);
	},

	// Domain Model: needs domain proposals or entity proposals
	[DocumentType.DOMAIN_MODEL]: (ctx) => {
		const p = ctx.plan;
		return !!p && (
			(p.domainProposals?.length ?? 0) > 0 ||
			(p.entityProposals?.length ?? 0) > 0
		);
	},

	// Architecture Doc: needs an actual architecture document in the DB
	[DocumentType.ARCHITECTURE]: (ctx) => !!ctx.archDoc,

	// Implementation Roadmap: needs architecture with implementation sequence,
	// OR plan phasing strategy
	[DocumentType.IMPLEMENTATION_ROADMAP]: (ctx) => {
		if (ctx.archDoc?.implementation_sequence?.length) { return true; }
		return (ctx.plan?.phasingStrategy?.length ?? 0) > 0;
	},

	// Technical Brief: needs summary + requirements (for technical tasks)
	[DocumentType.TECHNICAL_BRIEF]: (ctx) => {
		const p = ctx.plan;
		return !!p && !!p.summary && (p.requirements?.length ?? 0) > 0;
	},

	// Change Impact: needs claims OR (requirements + constraints/decisions)
	[DocumentType.CHANGE_IMPACT]: (ctx) => {
		if (ctx.claims.length > 0) { return true; }
		const p = ctx.plan;
		return !!p && (p.requirements?.length ?? 0) > 0 &&
			((p.constraints?.length ?? 0) > 0 || (p.decisions?.length ?? 0) > 0);
	},

	// Verification Summary: needs claims with verdicts
	[DocumentType.VERIFICATION_SUMMARY]: (ctx) => ctx.claims.length > 0,
};

// ==================== AVAILABILITY CHECK ====================

/**
 * Build the DialogueContext snapshot used by all availability checkers.
 */
function buildContext(dialogueId: string): DialogueContext | null {
	const stateResult = getWorkflowState(dialogueId);
	if (!stateResult.success) { return null; }

	const intakeResult = getIntakeConversation(dialogueId);
	const intakeState = intakeResult.success ? intakeResult.value : null;
	const plan: IntakePlanDocument | null =
		intakeState?.finalizedPlan ?? intakeState?.draftPlan ?? null;

	const archResult = getArchitectureDocumentForDialogue(dialogueId);
	const archDoc = (archResult.success ? archResult.value : null) as ArchitectureDocument | null;

	const claimsResult = getClaims({ dialogue_id: dialogueId });
	const claims = claimsResult.success ? claimsResult.value : [];

	return {
		currentPhase: stateResult.value.current_phase,
		requestCategory: plan?.requestCategory,
		plan,
		intakeState,
		archDoc,
		claims,
	};
}

/**
 * Get the list of document types available for a given dialogue.
 *
 * Availability is determined by **data presence**, not phase gates.
 * Each document type has a checker that inspects the plan, architecture
 * doc, claims, etc. to decide whether enough material exists to
 * generate a meaningful document.
 */
export function getAvailableDocuments(dialogueId: string): DocumentDefinition[] {
	const ctx = buildContext(dialogueId);
	if (!ctx) { return []; }

	const available: DocumentDefinition[] = [];

	for (const def of Object.values(DOCUMENT_DEFINITIONS)) {
		// Category filter
		if (!isCategoryMatch(def, ctx.requestCategory)) { continue; }

		// Data-presence check
		const check = DATA_CHECKS[def.type];
		if (check && !check(ctx)) { continue; }

		available.push(def);
	}

	return available;
}

/**
 * Check whether a definition's applicableCategory matches the dialogue's
 * requestCategory. 'any' always matches. If the dialogue has no category
 * yet, we allow product docs (likely product intent) but block
 * technical_task docs until explicitly classified.
 */
function isCategoryMatch(def: DocumentDefinition, requestCategory: string | undefined): boolean {
	if (def.applicableCategory === 'any') { return true; }
	if (requestCategory) { return requestCategory === def.applicableCategory; }
	// Unknown category: allow product, block technical
	return def.applicableCategory !== 'technical_task';
}
