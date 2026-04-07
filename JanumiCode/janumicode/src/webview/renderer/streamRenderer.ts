/**
 * Main stream renderer for the webview.
 * Dispatches each StreamItem to the appropriate renderer module.
 */

import { esc, wrapResizable } from './utils';
import type { StreamItem, IntakeState, PendingMmpSnapshot } from './streamTypes';
import { renderMilestoneDivider, renderRichCard, renderDialogueStartMarker, renderDialogueEndMarker, renderEmptyState, renderQaExchangeCard } from './cards';
import { renderHumanGateCard, renderVerificationGateCard, renderReviewGateCard } from './gates';
import { renderCommandBlock } from './commandBlock';
import { renderReasoningReviewCard } from './review';
import {
	renderIntakeTurnCard, renderIntakePlanPreview, renderIntakeApprovalGate,
	renderIntakeModeSelector, renderIntakeCheckpoint, renderDomainTransitionCard,
	renderGatheringCompleteBanner, renderIntakeAnalysisCard,
	renderIntakeProductDiscoveryCard, renderProposerDomainsCard,
	renderProposerJourneysCard, renderProposerEntitiesCard,
	renderProposerIntegrationsCard, renderIntakeProposalCard,
	renderDomainCoverageSidebar,
} from './intake';
import {
	renderArchitectureCapabilitiesCard, renderArchitectureDesignCard,
	renderArchitectureValidationCard, renderArchitectureGateCard,
} from './architecture';
import { renderValidationFindingCard, renderValidationSummaryCard } from './validation';

// ==================== Render Context ====================

export interface RenderContext {
	lastIntakePlanIdx: number;
	lastProposerMmpIdx: number;
	pendingDecisions?: Record<string, PendingMmpSnapshot>;
}

// ==================== Main Dispatcher ====================

/**
 * Render a single stream item. Used for incremental CSR updates.
 */
export function renderStreamItem(item: StreamItem, idx: number, context: RenderContext): string {
	return renderItemContent(item, idx, context);
}

/**
 * Render all stream items into a single HTML string.
 */
export function renderStreamItems(
	items: StreamItem[],
	intakeState?: IntakeState,
	pendingDecisions?: Record<string, PendingMmpSnapshot>,
): string {
	if (items.length === 0) {
		return renderEmptyState();
	}

	// Pre-scan to find the last intake_plan_preview index
	let lastIntakePlanIdx = -1;
	items.forEach((item, idx) => {
		if (item.type === 'intake_plan_preview') { lastIntakePlanIdx = idx; }
	});

	// Pre-scan to find the last proposer MMP card index
	let lastProposerMmpIdx = -1;
	items.forEach((item, idx) => {
		if (item.type === 'intake_proposer_business_domains' || item.type === 'intake_proposer_journeys' ||
			item.type === 'intake_proposer_entities' || item.type === 'intake_proposer_integrations') {
			lastProposerMmpIdx = idx;
		}
	});

	const context: RenderContext = { lastIntakePlanIdx, lastProposerMmpIdx, pendingDecisions };

	// Helper to detect architecture-phase stream item types
	const isArchitectureItem = (item: StreamItem): boolean => {
		if (item.type === 'architecture_capabilities' || item.type === 'architecture_design' ||
			item.type === 'architecture_validation' || item.type === 'architecture_gate') {
			return true;
		}
		if (item.type === 'command_block' && item.command.label.startsWith('Architect')) {
			return true;
		}
		return false;
	};

	let html = items.map((item, idx) => {
		let prefix = '';
		let suffix = '';

		// Wrap consecutive architecture cards in a visual group container
		if (isArchitectureItem(item)) {
			const prevIsArch = idx > 0 && isArchitectureItem(items[idx - 1]);
			const nextIsArch = idx < items.length - 1 && isArchitectureItem(items[idx + 1]);
			if (!prevIsArch) {
				prefix = '<div class="architecture-phase-group">' +
					'<div class="architecture-phase-group-header">' +
					'<span class="codicon codicon-layers"></span> Recursive Architecture Decomposition' +
					'</div>';
			}
			if (!nextIsArch) {
				suffix = '</div>';
			}
		}

		const content = renderItemContent(item, idx, context);
		return prefix + content + suffix;
	}).join('');

	// Add domain coverage sidebar only for legacy GATHERING/DISCUSSING flows
	const isLegacyFlow = intakeState?.subState === 'GATHERING' || intakeState?.subState === 'DISCUSSING';
	if (isLegacyFlow && intakeState && intakeState.engineeringDomainCoverage && intakeState.turnCount > 0) {
		html += renderDomainCoverageSidebar(intakeState.engineeringDomainCoverage, intakeState.currentEngineeringDomain);
	}

	// Add finalize button or resolved marker based on INTAKE sub-state
	if (intakeState && intakeState.turnCount > 0) {
		if (intakeState.subState === 'GATHERING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeGatheringFooter(intakeState);
		} else if (intakeState.subState === 'DISCUSSING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		} else if (intakeState.subState === 'SYNTHESIZING') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Synthesizing final plan...</span></div>';
		} else if (intakeState.subState === 'AWAITING_APPROVAL') {
			html += renderIntakeFinalizeResolved();
		} else if (intakeState.subState === 'INTENT_DISCOVERY') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Analyzing documents and codebase...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_BUSINESS_DOMAINS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing business domains...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_JOURNEYS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing user journeys and workflows...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_ENTITIES') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing data model...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_INTEGRATIONS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing integrations...</span></div>';
		} else if (intakeState.subState === 'PRODUCT_REVIEW') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Review product artifacts above and submit your decisions to continue.</span></div>';
		} else if (intakeState.subState === 'PROPOSING' || intakeState.subState === 'CLARIFYING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		}
	}

	return html;
}

// ==================== Item ID / Rev helpers ====================

/**
 * Returns true if the item belongs to the architecture phase group
 * (rendered inside the .architecture-phase-group wrapper div).
 */
export function isArchitectureStreamItem(item: StreamItem): boolean {
	if (item.type === 'architecture_capabilities' || item.type === 'architecture_design' ||
		item.type === 'architecture_validation' || item.type === 'architecture_gate') {
		return true;
	}
	if (item.type === 'command_block' && item.command.label.startsWith('Architect')) {
		return true;
	}
	return false;
}

/**
 * Derive a stable, unique DOM ID for a stream item.
 * Used for targeted DOM patching in future update protocols.
 * Falls back to `{type}-{idx}` when no stable key is available.
 */
export function getStreamItemId(item: StreamItem, _idx: number): string {
	switch (item.type) {
		case 'turn':               return 'turn-' + item.turn.event_id;
		case 'gate':               return 'gate-' + item.gate.gate_id;
		case 'verification_gate':  return 'vgate-' + item.gate.gate_id;
		case 'review_gate':        return 'rgate-' + item.gate.gate_id;
		case 'command_block':      return 'cmd-' + item.command.command_id;
		case 'intake_turn':        return item.eventId !== undefined ? 'iturn-' + item.eventId : 'iturn-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_approval_gate': return 'iapproval-' + item.dialogueId;
		case 'intake_mode_selector': return 'imode-' + item.dialogueId;
		case 'intake_product_discovery': return item.eventId !== undefined ? 'ipd-' + item.eventId : 'ipd-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_proposer_business_domains': return item.eventId !== undefined ? 'ibd-' + item.eventId : 'ibd-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_proposer_journeys':     return item.eventId !== undefined ? 'ijrn-' + item.eventId : 'ijrn-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_proposer_entities':     return item.eventId !== undefined ? 'ient-' + item.eventId : 'ient-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_proposer_integrations': return item.eventId !== undefined ? 'iint-' + item.eventId : 'iint-' + item.dialogueId + '-' + item.timestamp;
		case 'architecture_capabilities': return item.eventId !== undefined ? 'arch-cap-' + item.eventId : 'arch-cap-' + item.dialogueId + '-' + item.timestamp;
		case 'architecture_design':       return item.eventId !== undefined ? 'arch-design-' + item.eventId : 'arch-design-' + item.dialogueId + '-' + item.timestamp;
		case 'architecture_validation':   return item.eventId !== undefined ? 'arch-val-' + item.eventId : 'arch-val-' + item.dialogueId + '-' + item.timestamp;
		case 'architecture_gate':         return item.eventId !== undefined ? 'arch-gate-' + item.eventId : 'arch-gate-' + item.docId + '-v' + item.version;
		case 'intake_analysis':    return item.eventId !== undefined ? 'ianalysis-' + item.eventId : 'ianalysis-' + item.dialogueId + '-' + item.timestamp;
		case 'validation_finding': return 'vfind-' + item.findingId;
		case 'validation_summary': return 'vsum-' + item.dialogueId;
		case 'dialogue_start':  return 'dlg-start-' + item.dialogueId;
		case 'dialogue_end':    return 'dlg-end-' + item.dialogueId;
		case 'milestone':       return 'ms-' + item.dialogueId + '-' + item.phase;
		// Stable IDs for remaining types — use dialogueId + timestamp (never array index)
		case 'intake_plan_preview':      return 'iplan-' + item.dialogueId + '-' + item.timestamp;
		case 'intake_checkpoint':        return 'ichk-' + item.dialogueId + '-t' + item.checkpoint.turnNumber;
		case 'intake_domain_transition': return 'idom-' + item.dialogueId + '-' + (item.toDomain ?? 'end') + '-' + item.timestamp;
		case 'intake_gathering_complete': return 'igather-' + item.dialogueId;
		case 'intake_proposal':          return 'iprop-' + item.dialogueId + '-' + item.timestamp;
		case 'qa_exchange':              return 'qa-' + item.dialogueId + '-' + item.timestamp;
		case 'reasoning_review':         return 'rr-' + item.dialogueId + '-' + item.timestamp;
		case 'human_message':            return 'hmsg-' + item.timestamp;
		default:                         return (item as { type: string }).type + '-' + (item as { dialogueId?: string }).dialogueId + '-' + (item as { timestamp?: string }).timestamp;
	}
}

/**
 * Encode the mutable state of an item as a short revision string.
 * The reconciler re-renders only when this changes between hydrates.
 * Immutable items (turn, command_block, etc.) always return ''.
 * Context-dependent items encode their position-sensitive property.
 */
export function getStreamItemRev(item: StreamItem, idx: number, context: RenderContext): string {
	switch (item.type) {
		case 'gate':                return item.resolvedAction ?? '';
		case 'verification_gate':   return item.resolvedAction ?? '';
		case 'review_gate':         return (item.resolvedAction ?? '') + '|' + (item.resolvedRationale ?? '');
		case 'intake_approval_gate': return item.resolvedAction ?? '';
		case 'intake_mode_selector': return item.selectedMode ?? '';
		case 'intake_checkpoint':   return item.resolved ? '1' : '';
		case 'architecture_gate':   return item.resolvedAction ?? '';
		case 'validation_finding':  return String(item.useful_rating ?? '');
		// Re-render when position changes so the "last" card shows/hides the MMP panel
		case 'intake_plan_preview':
			return idx === context.lastIntakePlanIdx ? 'last' : '';
		case 'intake_proposer_business_domains':
		case 'intake_proposer_journeys':
		case 'intake_proposer_entities':
		case 'intake_proposer_integrations':
			return idx === context.lastProposerMmpIdx ? 'last' : '';
		default: return '';
	}
}

/**
 * Inject data-item-id and data-item-rev onto the first element of an HTML string.
 * Works the same way as wrapResizable — no extra wrapper div needed.
 */
function addItemMeta(html: string, id: string, rev: string): string {
	// Trim leading whitespace from template literals before matching the opening tag
	const trimmed = html.trimStart();
	return trimmed.replace(/^(<\w+)/, '$1 data-item-id="' + id + '" data-item-rev="' + rev + '"');
}

// ==================== Item Content Dispatcher ====================

function renderItemContentInner(item: StreamItem, idx: number, context: RenderContext): string {
	switch (item.type) {
		case 'human_message':
			return '<div class="intake-message intake-human">' +
				'<div class="card-header"><div class="card-header-left">' +
				'<span class="role-icon codicon codicon-account"></span>' +
				'<span class="role-badge role-human">Human</span>' +
				'</div></div>' +
				'<div class="card-content">' + esc(item.text) + '</div>' +
				'</div>';

		case 'milestone':
			return renderMilestoneDivider(item.phase, item.timestamp);

		case 'turn':
			return wrapResizable(renderRichCard(item.turn, item.claims, item.verdict));

		case 'gate':
			return renderHumanGateCard(item.gate, item.blockingClaims, item.resolvedAction, item.metadata);

		case 'verification_gate':
			return renderVerificationGateCard(item.gate, item.allClaims, item.verdicts, item.blockingClaims, item.resolvedAction);

		case 'review_gate':
			return wrapResizable(renderReviewGateCard(item.gate, item.allClaims, item.verdicts,
				item.historianFindings, item.reviewItems, item.summary, item.resolvedAction, item.resolvedRationale));

		case 'dialogue_start':
			return renderDialogueStartMarker(item.dialogueId, item.goal, item.title, item.timestamp);

		case 'dialogue_end':
			return renderDialogueEndMarker(item.dialogueId, item.status, item.timestamp);

		case 'command_block':
			return wrapResizable(renderCommandBlock(item.command, item.outputs, item.hasReview));

		case 'intake_turn':
			return wrapResizable(renderIntakeTurnCard(item.turn, item.timestamp, item.commandBlocks, item.isLatest ?? false, item.eventId));

		case 'intake_plan_preview':
			return renderIntakePlanPreview(item.plan, item.isFinal, idx === context.lastIntakePlanIdx);

		case 'intake_approval_gate':
			return renderIntakeApprovalGate(item.plan, item.dialogueId, item.resolved, item.resolvedAction);

		case 'qa_exchange':
			return renderQaExchangeCard(item.question, item.answer, item.timestamp);

		case 'reasoning_review':
			return renderReasoningReviewCard(item.concerns, item.overallAssessment, item.reviewerModel, item.timestamp, item.reviewPrompt);

		case 'intake_mode_selector':
			return renderIntakeModeSelector(item.recommendation, item.resolved, item.selectedMode);

		case 'intake_checkpoint':
			return renderIntakeCheckpoint(item.checkpoint, item.resolved);

		case 'intake_domain_transition':
			return renderDomainTransitionCard(item.fromLabel, item.toDomain, item.toLabel, item.toDescription);

		case 'intake_gathering_complete':
			return renderGatheringCompleteBanner(item.coverageSummary, item.intakeMode);

		case 'intake_analysis':
			return wrapResizable(renderIntakeAnalysisCard(item.humanMessage, item.analysisSummary, item.codebaseFindings, item.commandBlocks));

		case 'intake_product_discovery':
			return renderIntakeProductDiscoveryCard({
					requestCategory: item.requestCategory,
					productVision: item.productVision,
					productDescription: item.productDescription,
					personas: item.personas,
					userJourneys: item.userJourneys,
					phasingStrategy: item.phasingStrategy,
					successMetrics: item.successMetrics,
					uxRequirements: item.uxRequirements,
				}, item.mmpJson, context.pendingDecisions, item.eventId);

		case 'intake_proposal':
			return renderIntakeProposalCard(item.title, item.summary, item.proposedApproach, item.engineeringDomainCoverage);

		case 'intake_proposer_business_domains':
			return wrapResizable(renderProposerDomainsCard(item.domains, item.personas, item.mmpJson, context.pendingDecisions, idx === context.lastProposerMmpIdx, item.eventId));

		case 'intake_proposer_journeys':
			return wrapResizable(renderProposerJourneysCard(item.journeys, item.workflows, item.mmpJson, context.pendingDecisions, idx === context.lastProposerMmpIdx, item.eventId));

		case 'intake_proposer_entities':
			return wrapResizable(renderProposerEntitiesCard(item.entities, item.mmpJson, item.domainNames, context.pendingDecisions, idx === context.lastProposerMmpIdx, item.eventId));

		case 'intake_proposer_integrations':
			return wrapResizable(renderProposerIntegrationsCard(item.integrations, item.qualityAttributes, item.mmpJson, context.pendingDecisions, idx === context.lastProposerMmpIdx, item.eventId));

		case 'architecture_capabilities':
			return wrapResizable(renderArchitectureCapabilitiesCard(item.capabilities, item.timestamp, item.dialogueId));

		case 'architecture_design':
			return wrapResizable(renderArchitectureDesignCard(item.components, item.dataModels, item.interfaces, item.implementationSequence, item.timestamp, item.dialogueId));

		case 'architecture_validation':
			return renderArchitectureValidationCard(item.score, item.findings, item.validated, item.timestamp, item.dialogueId);

		case 'architecture_gate':
			return renderArchitectureGateCard(item.docId, item.version, item.capabilities, item.components, item.goalAlignmentScore, item.dialogueId, item.resolved, item.resolvedAction, item.mmpJson, item.decompositionDepth, context.pendingDecisions, item.eventId);

		case 'validation_finding':
			return renderValidationFindingCard(item);

		case 'validation_summary':
			return renderValidationSummaryCard(item);

		default:
			return '';
	}
}

export function renderItemContent(item: StreamItem, idx: number, context: RenderContext): string {
	const html = renderItemContentInner(item, idx, context);
	if (!html) { return ''; }
	return addItemMeta(html, getStreamItemId(item, idx), getStreamItemRev(item, idx, context));
}

// ==================== Intake Footer Helpers ====================

function renderIntakeQuestionsSubmitBar(): string {
	return `
		<div class="intake-questions-submit-bar" id="intake-questions-submit-bar" style="display:none;">
			<span class="intake-questions-submit-count" id="intake-submit-count">0 responses</span>
			<button class="intake-questions-submit-btn" id="intake-submit-btn"
				data-action="intake-submit-responses" disabled>
				Submit Responses
			</button>
		</div>
	`;
}

function renderIntakeFinalizeButton(): string {
	return `
		<div class="intake-finalize-bar">
			<button class="intake-finalize-btn" data-action="intake-finalize-plan">
				Finalize Plan
			</button>
			<span class="intake-finalize-hint">Synthesize conversation into a final plan for approval</span>
		</div>
	`;
}

function renderIntakeFinalizeResolved(): string {
	return `
		<div class="intake-finalize-bar resolved">
			<span class="gate-icon">&#x2705;</span>
			<span class="intake-finalize-hint">Plan finalized and synthesized</span>
		</div>
	`;
}

function renderIntakeGatheringFooter(intakeState: IntakeState): string {
	// Simplified version — domain info is replicated in intake.ts
	const mode = intakeState.intakeMode;
	const guidanceText = mode === 'DOCUMENT_BASED'
		? 'Answer any questions above, then submit to continue document analysis. Or type freely in the composer.'
		: 'Answer any questions above, then submit to continue the walkthrough. Or type freely in the composer.';

	return '<div class="intake-gathering-footer">' +
		'<div class="intake-gathering-guidance">' + esc(guidanceText) + '</div>' +
		'<button class="intake-skip-gathering-btn" data-action="intake-skip-gathering">' +
		'Skip to Plan Discussion &#x2192;' +
		'</button></div>';
}
