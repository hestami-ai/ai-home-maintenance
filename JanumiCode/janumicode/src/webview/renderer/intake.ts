/**
 * INTAKE phase renderers for the webview.
 * Covers intake turns, plan previews, approval gates, mode selectors,
 * checkpoints, domain transitions, gathering complete banners,
 * analysis cards, product discovery, proposer cards, and proposal cards.
 */

import { esc, formatTimestamp, simpleMarkdownToHtml, applyInlineFormatting, stringifyItem } from './utils';
import { renderCommandBlock } from './commandBlock';
import { renderMMPSection, renderInlineMirrorButtons, renderMenuCard, renderPreMortemCard, renderSourceBadge } from './mmpRenderer';
import type {
	IntakeConversationTurn, IntakeTurnResponse, IntakeGatheringTurnResponse,
	IntakePlanDocument, IntakeModeRecommendation, IntakeCheckpoint,
	EngineeringDomainCoverageMap, WorkflowCommandRecord, WorkflowCommandOutput,
	MMPPayload, MirrorItem, PendingMmpSnapshot,
} from './streamTypes';
import { IntakeMode, EngineeringDomainCoverageLevel, isGatheringResponse } from './streamTypes';

// ==================== Domain Info (replicated from engineeringDomainCoverageTracker) ====================

const DOMAIN_INFO: Record<string, { label: string; description: string }> = {
	CORE_FUNCTIONALITY: { label: 'Core Functionality', description: 'Primary features and use cases' },
	DATA_MODEL: { label: 'Data Model', description: 'Entities, relationships, and schemas' },
	USER_EXPERIENCE: { label: 'User Experience', description: 'UI/UX patterns and accessibility' },
	AUTHENTICATION: { label: 'Authentication', description: 'Auth, identity, and access control' },
	INTEGRATION: { label: 'Integration', description: 'External services and APIs' },
	PERFORMANCE: { label: 'Performance', description: 'Speed, scalability, and optimization' },
	SECURITY: { label: 'Security', description: 'Data protection and threat mitigation' },
	DEPLOYMENT: { label: 'Deployment', description: 'Infrastructure and CI/CD' },
	ERROR_HANDLING: { label: 'Error Handling', description: 'Failure modes and recovery' },
	TESTING: { label: 'Testing', description: 'Test strategy and quality assurance' },
	DOCUMENTATION: { label: 'Documentation', description: 'Docs, onboarding, and knowledge sharing' },
	COMPLIANCE: { label: 'Compliance', description: 'Regulatory and standards compliance' },
};

const DOMAIN_SEQUENCE = [
	'CORE_FUNCTIONALITY', 'DATA_MODEL', 'USER_EXPERIENCE', 'AUTHENTICATION',
	'INTEGRATION', 'PERFORMANCE', 'SECURITY', 'DEPLOYMENT',
	'ERROR_HANDLING', 'TESTING', 'DOCUMENTATION', 'COMPLIANCE',
];

// ==================== Ask More Toggle ====================

export function renderAskMoreToggle(itemId: string, itemContext: string): string {
	const escaped = esc(itemId);
	const escapedCtx = esc(itemContext);
	return `<button class="ask-more-toggle" data-action="toggle-askmore"
		data-clarification-item="${escaped}"
		data-clarification-context="${escapedCtx}">Ask More</button>`;
}

// ==================== Mic Button (stub) ====================

export function renderMicButton(_targetInputId: string): string {
	// In CSR mode, speech buttons are managed by the webview speech module.
	return '';
}

// ==================== Gathering Turn Card ====================

function renderGatheringTurnCard(
	turn: IntakeConversationTurn,
	response: IntakeGatheringTurnResponse,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
	eventId?: number,
): string {
	const domainInfo = DOMAIN_INFO[response.focusEngineeringDomain];
	const domainLabel = domainInfo ? domainInfo.label : response.focusEngineeringDomain;

	const engineeringDomainNotesHtml = response.engineeringDomainNotes.length > 0
		? '<div class="intake-domain-notes"><ul>' +
			response.engineeringDomainNotes.map((n) => '<li>' + esc(n) + '</li>').join('') +
			'</ul></div>'
		: '';

	const findingsHtml = response.codebaseFindings && response.codebaseFindings.length > 0
		? '<div class="intake-findings">' +
			'<span class="intake-findings-label">Codebase findings:</span>' +
			'<ul>' + response.codebaseFindings.map((f) => '<li><code>' + esc(f) + '</code></li>').join('') + '</ul>' +
			'</div>'
		: '';

	const hasMMP = response.mmp && (response.mmp.mirror || response.mmp.menu || response.mmp.preMortem);
	const mmpCardId = 'GT-' + (eventId ?? turn.turnNumber);
	const mmpHtml = hasMMP
		? renderMMPSection(response.mmp!, mmpCardId, !!isLatest)
		: '';

	const followUpHtml = !hasMMP && response.followUpQuestions && response.followUpQuestions.length > 0
		? '<div class="intake-suggestions">' +
			'<span class="intake-suggestions-label">Consider asking:</span>' +
			'<ul>' + response.followUpQuestions.map((q, i) => {
				const qId = 'GQ-T' + turn.turnNumber + '-' + (i + 1);
				if (isLatest) {
					return '<li class="question-item">' +
						'<span class="question-item-text">' + applyInlineFormatting(esc(q)) + '</span>' +
						'<div class="intake-question-response" data-clarification-item="' + qId + '">' +
						'<div class="clarification-messages" id="clarification-messages-' + qId + '" style="display:none;"></div>' +
						'<textarea class="intake-question-textarea" data-intake-question-id="' + qId + '" data-intake-question-text="' + esc(q) + '" placeholder="Type your response..." rows="2"></textarea>' +
						'<div class="response-toolbar">' +
						'<span class="intake-question-charcount" data-charcount-for="' + qId + '">0 chars</span>' +
						renderMicButton('intake-question:' + qId) +
						renderAskMoreToggle(qId, q) +
						'</div></div></li>';
				}
				return '<li class="question-item"><span class="question-item-text">' + applyInlineFormatting(esc(q)) + '</span></li>';
			}).join('') +
			'</ul></div>'
		: '';

	const humanPreview = esc(turn.humanMessage.substring(0, 60)) + (turn.humanMessage.length > 60 ? '\u2026' : '');

	return '<div class="intake-turn-card gathering-turn collapsible-card expanded" data-intake-turn="' + turn.turnNumber + '">' +
		'<div class="collapsible-card-header intake-turn-header" data-action="toggle-card">' +
		'<span class="card-chevron">&#x25B6;</span>' +
		'<span class="intake-turn-number">Turn ' + turn.turnNumber + '</span>' +
		'<span class="intake-domain-badge">' + esc(domainLabel) + '</span>' +
		'<span class="intake-turn-preview">' + humanPreview + '</span>' +
		'<span class="intake-turn-time">' + formatTimestamp(timestamp) + '</span>' +
		'</div>' +
		'<div class="collapsible-card-body">' +
		'<div class="intake-message intake-human">' +
		'<div class="card-header"><div class="card-header-left">' +
		'<span class="role-icon codicon codicon-account"></span>' +
		'<span class="role-badge role-human">Human</span>' +
		'</div></div>' +
		'<div class="card-content">' + esc(turn.humanMessage) + '</div>' +
		'</div>' +
		(commandBlocks && commandBlocks.length > 0
			? '<div class="intake-command-blocks" style="margin-top: 6px;">' + commandBlocks.map((cb) => renderCommandBlock(cb.command, cb.outputs)).join('') + '</div>'
			: '') +
		'<div class="intake-message intake-expert" style="margin-top: 6px;">' +
		'<div class="card-header"><div class="card-header-left">' +
		'<span class="role-icon codicon codicon-beaker"></span>' +
		'<span class="role-badge role-technical_expert">Interviewer</span>' +
		'<span class="intake-domain-badge">' + esc(domainLabel) + '</span>' +
		'</div></div>' +
		'<div class="card-content">' + simpleMarkdownToHtml(response.conversationalResponse) + '</div>' +
		engineeringDomainNotesHtml +
		mmpHtml +
		followUpHtml +
		findingsHtml +
		'</div></div></div>';
}

// ==================== Intake Turn Card ====================

export function renderIntakeTurnCard(
	turn: IntakeConversationTurn,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
	eventId?: number,
): string {
	if (isGatheringResponse(turn.expertResponse)) {
		return renderGatheringTurnCard(turn, turn.expertResponse, timestamp, commandBlocks, isLatest, eventId);
	}

	const expertResponse = turn.expertResponse as IntakeTurnResponse;

	const mmpSource = expertResponse.mmp;
	const hasMMP = mmpSource && (mmpSource.mirror || mmpSource.menu || mmpSource.preMortem);
	const mmpCardId = 'T-' + (eventId ?? turn.turnNumber);

	const mmpHtml = hasMMP
		? renderMMPSection(mmpSource!, mmpCardId, !!isLatest)
		: '';

	const suggestionsHtml = !hasMMP && expertResponse.suggestedQuestions && expertResponse.suggestedQuestions.length > 0
		? `<div class="intake-suggestions">
				<span class="intake-suggestions-label">Consider asking:</span>
				<ul>${expertResponse.suggestedQuestions.map((q, i) => {
					const qId = `SQ-T${turn.turnNumber}-${i + 1}`;
					if (isLatest) {
						return `<li class="question-item">
							<span class="question-item-text">${applyInlineFormatting(esc(q))}</span>
							<div class="intake-question-response" data-clarification-item="${qId}">
								<div class="clarification-messages" id="clarification-messages-${qId}" style="display:none;"></div>
								<textarea class="intake-question-textarea"
									data-intake-question-id="${qId}"
									data-intake-question-text="${esc(q)}"
									placeholder="Type your response..."
									rows="2"></textarea>
								<div class="response-toolbar">
									<span class="intake-question-charcount" data-charcount-for="${qId}">0 chars</span>
									${renderMicButton('intake-question:' + qId)}
									${renderAskMoreToggle(qId, q)}
								</div>
							</div>
						</li>`;
					} else {
						return `<li class="question-item"><span class="question-item-text">${applyInlineFormatting(esc(q))}</span></li>`;
					}
				}).join('')}</ul>
			</div>`
		: '';

	const findingsHtml = expertResponse.codebaseFindings && expertResponse.codebaseFindings.length > 0
		? `<div class="intake-findings">
				<span class="intake-findings-label">Codebase findings:</span>
				<ul>${expertResponse.codebaseFindings.map((f: string) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>
			</div>`
		: '';

	const humanPreview = esc(turn.humanMessage.substring(0, 60)) + (turn.humanMessage.length > 60 ? '\u2026' : '');

	return `
		<div class="intake-turn-card collapsible-card expanded" data-intake-turn="${turn.turnNumber}">
			<div class="collapsible-card-header intake-turn-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="intake-turn-number">Turn ${turn.turnNumber}</span>
				<span class="intake-turn-preview">${humanPreview}</span>
				<span class="intake-turn-time">${formatTimestamp(timestamp)}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="intake-message intake-human">
					<div class="card-header">
						<div class="card-header-left">
							<span class="role-icon codicon codicon-account"></span>
							<span class="role-badge role-human">Human</span>
						</div>
					</div>
					<div class="card-content">${esc(turn.humanMessage)}</div>
				</div>
				${commandBlocks && commandBlocks.length > 0
					? `<div class="intake-command-blocks" style="margin-top: 6px;">${commandBlocks.map((cb) => renderCommandBlock(cb.command, cb.outputs)).join('')}</div>`
					: ''}
				<div class="intake-message intake-expert" style="margin-top: 6px;">
					<div class="card-header">
						<div class="card-header-left">
							<span class="role-icon codicon codicon-beaker"></span>
							<span class="role-badge role-technical_expert">Tech Expert</span>
							<span class="intake-plan-version">Plan v${expertResponse.updatedPlan.version}</span>
						</div>
					</div>
					<div class="card-content">${esc(expertResponse.conversationalResponse)}</div>
					${mmpHtml}
					${suggestionsHtml}
					${findingsHtml}
				</div>
			</div>
		</div>
	`;
}

// ==================== Intake Plan Preview ====================

export function renderIntakePlanPreview(plan: IntakePlanDocument, isFinal: boolean, isLatest?: boolean): string {
	const borderClass = isFinal ? 'intake-plan-final' : 'intake-plan-draft';
	const label = isFinal ? 'Final Plan' : 'Draft Plan';

	const requirements = plan.requirements ?? [];
	const decisions = plan.decisions ?? [];
	const constraints = plan.constraints ?? [];
	const openQuestions = plan.openQuestions ?? [];

	const requirementsHtml = requirements.length > 0
		? `<div class="intake-plan-section"><h5>Requirements (${requirements.length})</h5><ul>${requirements.map((r) => `<li><strong>[${esc(r.id)}]</strong> ${esc(r.text)}</li>`).join('')}</ul></div>`
		: '';

	const decisionsHtml = decisions.length > 0
		? `<div class="intake-plan-section"><h5>Decisions (${decisions.length})</h5><ul>${decisions.map((d) => `<li><strong>[${esc(d.id)}]</strong> ${esc(d.text)}</li>`).join('')}</ul></div>`
		: '';

	const constraintsHtml = constraints.length > 0
		? `<div class="intake-plan-section"><h5>Constraints (${constraints.length})</h5><ul>${constraints.map((c) => `<li><strong>[${esc(c.id)}]</strong> ${esc(c.text)}</li>`).join('')}</ul></div>`
		: '';

	const openQuestionsHtml = !isLatest && openQuestions.length > 0
		? `<div class="intake-plan-section"><h5>Open Questions (${openQuestions.length})</h5><ul>${openQuestions.map((q) => {
				return `<li class="question-item"><span class="question-item-text"><strong>[${esc(q.id)}]</strong> ${esc(q.text)}</span></li>`;
			}).join('')}</ul></div>`
		: '';

	const approachHtml = plan.proposedApproach
		? `<div class="intake-plan-section"><h5>Proposed Approach</h5><p>${esc(plan.proposedApproach)}</p></div>`
		: '';

	const visionHtml = plan.productVision
		? `<div class="intake-plan-section"><h5>Product Vision</h5><p>${esc(plan.productVision)}</p></div>`
		: '';

	const descriptionHtml = plan.productDescription
		? `<div class="intake-plan-section"><h5>Product Description</h5><p>${esc(plan.productDescription)}</p></div>`
		: '';

	const personasHtml = plan.personas && plan.personas.length > 0
		? `<div class="intake-plan-section"><h5>Personas (${plan.personas.length})</h5><ul>${plan.personas.map((p) =>
				`<li><strong>[${esc(p.id)}] ${esc(p.name)}</strong>: ${esc(p.description)}`
				+ ((p.goals ?? []).length > 0 ? `<br/><em>Goals:</em> ${p.goals.map(g => esc(g)).join('; ')}` : '')
				+ ((p.painPoints ?? []).length > 0 ? `<br/><em>Pain points:</em> ${p.painPoints.map(pp => esc(pp)).join('; ')}` : '')
				+ `</li>`
			).join('')}</ul></div>`
		: '';

	const journeysHtml = plan.userJourneys && plan.userJourneys.length > 0
		? `<div class="intake-plan-section"><h5>User Journeys (${plan.userJourneys.length})</h5><ul>${plan.userJourneys.map((j) => {
				const steps = (j.steps ?? []).filter(
					(s: { actor?: string; action?: string; expectedOutcome?: string }) =>
						s.actor || s.action || s.expectedOutcome
				);
				const ac = j.acceptanceCriteria ?? [];
				return `<li><strong>[${esc(j.id)}] ${esc(j.title)}</strong> <span class="badge">${esc(j.implementationPhase ?? j.priority ?? '')}</span>`
				+ `<br/>${esc(j.scenario)}`
				+ (steps.length > 0 ? `<ol>${steps.map((s: { actor?: string; action?: string; expectedOutcome?: string }) =>
					`<li>${esc(s.actor || '')} → ${esc(s.action || '')} → ${esc(s.expectedOutcome || '')}</li>`
				).join('')}</ol>` : '')
				+ (ac.length > 0 ? `<em>Acceptance:</em> ${ac.map(a => esc(a)).join('; ')}` : '')
				+ `</li>`;
			}).join('')}</ul></div>`
		: '';

	const phasingHtml = plan.phasingStrategy && plan.phasingStrategy.length > 0
		? `<div class="intake-plan-section"><h5>Phasing Strategy</h5><ul>${plan.phasingStrategy.map((ph) =>
				`<li><strong>${esc(ph.phase)}</strong>: ${esc(ph.description)}<br/><em>${esc(ph.rationale)}</em></li>`
			).join('')}</ul></div>`
		: '';

	const metricsHtml = plan.successMetrics && plan.successMetrics.length > 0
		? `<div class="intake-plan-section"><h5>Success Metrics</h5><ul>${plan.successMetrics.map((m) => `<li>${esc(stringifyItem(m))}</li>`).join('')}</ul></div>`
		: '';

	const uxHtml = plan.uxRequirements && plan.uxRequirements.length > 0
		? `<div class="intake-plan-section"><h5>UX Requirements</h5><ul>${plan.uxRequirements.map((u) => `<li>${esc(stringifyItem(u))}</li>`).join('')}</ul></div>`
		: '';

	const domainsHtml = plan.businessBusinessDomainProposals && plan.businessBusinessDomainProposals.length > 0
		? `<div class="intake-plan-section"><h5>Business Domains (${plan.businessBusinessDomainProposals.length})</h5><ul>${plan.businessBusinessDomainProposals.map((d) =>
				`<li><strong>[${esc(d.id)}] ${esc(d.name)}</strong>: ${esc(d.description)}`
				+ (d.entityPreview?.length ? `<br/><em>Entities:</em> ${d.entityPreview.map(e => esc(e)).join(', ')}` : '')
				+ (d.workflowPreview?.length ? `<br/><em>Workflows:</em> ${d.workflowPreview.map(w => esc(w)).join(', ')}` : '')
				+ `</li>`
			).join('')}</ul></div>`
		: '';

	const entitiesHtml = plan.entityProposals && plan.entityProposals.length > 0
		? `<div class="intake-plan-section"><h5>Data Entities (${plan.entityProposals.length})</h5><ul>${plan.entityProposals.map((e) =>
				`<li><strong>[${esc(e.id)}] ${esc(e.name)}</strong> <span class="badge">${esc(e.businessDomainId)}</span>: ${esc(e.description)}`
				+ (e.keyAttributes?.length ? `<br/><em>Attributes:</em> ${e.keyAttributes.map(a => esc(a)).join(', ')}` : '')
				+ (e.relationships?.length ? `<br/><em>Relationships:</em> ${e.relationships.map(r => esc(r)).join(', ')}` : '')
				+ `</li>`
			).join('')}</ul></div>`
		: '';

	const workflowsHtml = plan.workflowProposals && plan.workflowProposals.length > 0
		? `<div class="intake-plan-section"><h5>Workflows (${plan.workflowProposals.length})</h5><ul>${plan.workflowProposals.map((w) =>
				`<li><strong>[${esc(w.id)}] ${esc(w.name)}</strong> <span class="badge">${esc(w.businessDomainId)}</span>: ${esc(w.description)}</li>`
			).join('')}</ul></div>`
		: '';

	const integrationsHtml = plan.integrationProposals && plan.integrationProposals.length > 0
		? `<div class="intake-plan-section"><h5>Integrations (${plan.integrationProposals.length})</h5><ul>${plan.integrationProposals.map((i) =>
				`<li><strong>[${esc(i.id)}] ${esc(i.name)}</strong> <span class="badge">${esc(i.category)}</span>: ${esc(i.description)}`
				+ (i.standardProviders?.length ? `<br/><em>Providers:</em> ${i.standardProviders.map(p => esc(p)).join(', ')}` : '')
				+ `</li>`
			).join('')}</ul></div>`
		: '';

	const qualityHtml = plan.qualityAttributes && plan.qualityAttributes.length > 0
		? `<div class="intake-plan-section"><h5>Quality Attributes (${plan.qualityAttributes.length})</h5><ul>${plan.qualityAttributes.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div>`
		: '';

	const hasProposerArtifacts = domainsHtml || entitiesHtml || workflowsHtml || integrationsHtml || qualityHtml;
	const hasProductArtifacts = visionHtml || descriptionHtml || personasHtml || journeysHtml;

	return `
		<div class="intake-plan-preview ${borderClass}">
			<div class="intake-plan-header" data-action="toggle-intake-plan">
				<span class="intake-plan-chevron">&#x25B6;</span>
				<span class="intake-plan-label">${label} v${plan.version}</span>
				${plan.title ? `<span class="intake-plan-title">${esc(plan.title)}</span>` : ''}
			</div>
			<div class="intake-plan-body">
				${plan.summary ? `<p class="intake-plan-summary">${esc(plan.summary)}</p>` : ''}
				${hasProductArtifacts ? `${visionHtml}${descriptionHtml}${personasHtml}${journeysHtml}${phasingHtml}${metricsHtml}${uxHtml}` : ''}
				${requirementsHtml}
				${decisionsHtml}
				${constraintsHtml}
				${openQuestionsHtml}
				${approachHtml}
				${hasProposerArtifacts ? `${domainsHtml}${entitiesHtml}${workflowsHtml}${integrationsHtml}${qualityHtml}` : ''}
			</div>
		</div>
	`;
}

// ==================== Intake Approval Gate ====================

export function renderIntakeApprovalGate(_plan: IntakePlanDocument, dialogueId: string, resolved?: boolean, resolvedAction?: string): string {
	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F4CB;';
	const headerText = isResolved
		? `Plan ${esc(resolvedAction ?? 'Decision Made')}`
		: 'Plan Ready for Approval';

	const contextText = isResolved
		? `This plan review has been completed. Decision: <strong>${esc(resolvedAction ?? 'Decision made')}</strong>`
		: 'The Technical Expert has synthesized your conversation into a final plan. Review the plan above and choose to approve or continue discussing.';

	return `
		<div class="intake-approval-gate collapsible-card ${expandedClass}${resolvedClass}" data-dialogue-id="${esc(dialogueId)}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="gate-context">
					${contextText}
				</div>
				${isResolved ? `
				<div class="intake-approval-actions resolved">
					<button class="gate-btn approve ${resolvedAction === 'Approved' ? 'was-selected' : ''}" disabled
						title="${resolvedAction === 'Approved' ? 'This action was taken.' : ''}">Approve Plan</button>
					<button class="gate-btn reframe ${resolvedAction === 'Continued Discussing' ? 'was-selected' : ''}" disabled
						title="${resolvedAction === 'Continued Discussing' ? 'This action was taken.' : ''}">Continue Discussing</button>
				</div>
				` : `
				<div class="intake-approval-actions">
					<button class="gate-btn approve" data-action="intake-approve-plan">Approve Plan</button>
					<button class="gate-btn reframe" data-action="intake-continue-discussing">Continue Discussing</button>
				</div>
				`}
			</div>
		</div>
	`;
}

// ==================== Intake Mode Selector ====================

export function renderIntakeModeSelector(recommendation: IntakeModeRecommendation, resolved?: boolean, selectedMode?: string): string {
	const modeLabels: Record<string, { label: string; icon: string; description: string }> = {
		STATE_DRIVEN: {
			label: 'Guided Walkthrough',
			icon: '&#x1F4CB;',
			description: 'Sequential walk through 12 engineering domains with targeted questions',
		},
		DOCUMENT_BASED: {
			label: 'Document-Based',
			icon: '&#x1F4C4;',
			description: 'Analyze provided documents, then explore uncovered domains',
		},
		HYBRID_CHECKPOINTS: {
			label: 'Conversational',
			icon: '&#x1F4AC;',
			description: 'Free-form discussion with periodic domain coverage checkpoints',
		},
	};

	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F9ED;';
	const headerText = isResolved
		? `INTAKE Mode: ${modeLabels[selectedMode || recommendation.recommended]?.label || selectedMode}`
		: 'Select INTAKE Mode';

	let buttonsHtml = '';
	const modes = [IntakeMode.STATE_DRIVEN, IntakeMode.DOCUMENT_BASED, IntakeMode.HYBRID_CHECKPOINTS];
	for (const mode of modes) {
		const info = modeLabels[mode];
		const isRecommended = mode === recommendation.recommended;
		const recommendedTag = isRecommended ? ' <span class="intake-mode-recommended">(Recommended)</span>' : '';

		if (isResolved) {
			const wasSelected = mode === selectedMode;
			buttonsHtml += `
				<button class="intake-mode-btn${wasSelected ? ' was-selected' : ''}" disabled>
					<span class="intake-mode-btn-icon">${info.icon}</span>
					<span class="intake-mode-btn-label">${info.label}${recommendedTag}</span>
					<span class="intake-mode-btn-desc">${info.description}</span>
				</button>`;
		} else {
			buttonsHtml += `
				<button class="intake-mode-btn${isRecommended ? ' recommended' : ''}"
					data-action="intake-select-mode" data-intake-mode="${mode}">
					<span class="intake-mode-btn-icon">${info.icon}</span>
					<span class="intake-mode-btn-label">${info.label}${recommendedTag}</span>
					<span class="intake-mode-btn-desc">${info.description}</span>
				</button>`;
		}
	}

	return `
		<div class="intake-mode-selector collapsible-card ${expandedClass}${resolvedClass}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="intake-mode-rationale">
					${esc(recommendation.rationale)}
				</div>
				<div class="intake-mode-options">
					${buttonsHtml}
				</div>
			</div>
		</div>
	`;
}

// ==================== Intake Checkpoint ====================

export function renderIntakeCheckpoint(checkpoint: IntakeCheckpoint, resolved?: boolean): string {
	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F4CA;';
	const headerText = isResolved
		? `Coverage Checkpoint (Turn ${checkpoint.turnNumber})`
		: `Coverage Checkpoint — Turn ${checkpoint.turnNumber}`;

	let adequate = 0, partial = 0, none = 0;
	const total = DOMAIN_SEQUENCE.length;
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = checkpoint.coverageSnapshot[domain];
		if (!entry) { none++; continue; }
		switch (entry.level) {
			case EngineeringDomainCoverageLevel.ADEQUATE: adequate++; break;
			case EngineeringDomainCoverageLevel.PARTIAL: partial++; break;
			default: none++; break;
		}
	}
	const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);

	let suggestionsHtml = '';
	if (checkpoint.suggestedDomains.length > 0 && !isResolved) {
		const domainBtns = checkpoint.suggestedDomains.map(d => {
			const info = DOMAIN_INFO[d];
			if (!info) { return ''; }
			return `<button class="checkpoint-domain-btn"
				data-action="intake-ask-domain" data-domain-label="${esc(info.label)}">
				Ask about ${esc(info.label)}
			</button>`;
		}).join('');
		suggestionsHtml = `
			<div class="checkpoint-suggestions">
				<div class="checkpoint-suggestions-label">Suggested areas to explore:</div>
				${domainBtns}
			</div>`;
	}

	let actionsHtml = '';
	if (!isResolved) {
		if (checkpoint.offerModeSwitch) {
			actionsHtml = `
				<div class="checkpoint-gap-prompt">How would you like to address uncovered domains?</div>
				<div class="checkpoint-actions">
					<button class="gate-btn approve" data-action="intake-switch-to-walkthrough"
						data-intake-mode="${IntakeMode.STATE_DRIVEN}">Walk Through Gaps</button>
					<button class="gate-btn" data-action="intake-switch-to-conversational"
						data-intake-mode="${IntakeMode.HYBRID_CHECKPOINTS}">Discuss Freely</button>
					<button class="gate-btn reframe" data-action="intake-finalize-plan">Finalize As-Is</button>
				</div>`;
		} else {
			actionsHtml = `
				<div class="checkpoint-actions">
					<button class="gate-btn approve" data-action="intake-checkpoint-continue">Continue Discussing</button>
					<button class="gate-btn reframe" data-action="intake-finalize-plan">Finalize Plan</button>
				</div>`;
		}
	}

	return `
		<div class="intake-checkpoint collapsible-card ${expandedClass}${resolvedClass}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="checkpoint-summary">
					<div class="checkpoint-bar">
						<div class="coverage-bar-fill" style="width: ${percentage}%"></div>
					</div>
					<div class="checkpoint-stats">
						${percentage}% coverage: ${adequate} adequate, ${partial} partial, ${none} uncovered
					</div>
				</div>
				${suggestionsHtml}
				${actionsHtml}
			</div>
		</div>
	`;
}

// ==================== Domain Transition Card ====================

export function renderDomainTransitionCard(
	fromLabel: string,
	toDomain: string | null,
	toLabel: string | null,
	toDescription: string | null,
): string {
	const completedHtml =
		'<div class="domain-transition-completed">' +
		'<span class="domain-transition-check">&#x2705;</span>' +
		'<span class="domain-transition-label">' + esc(fromLabel) + '</span>' +
		'<span class="domain-transition-status">Adequate</span>' +
		'</div>';

	let nextHtml: string;
	if (toDomain && toLabel) {
		nextHtml =
			'<div class="domain-transition-next">' +
			'<span class="domain-transition-next-label">Next: ' + esc(toLabel) + '</span>' +
			(toDescription
				? '<span class="domain-transition-next-desc">' + esc(toDescription) + '</span>'
				: '') +
			'</div>';
	} else {
		nextHtml =
			'<div class="domain-transition-next">' +
			'<span class="domain-transition-next-label">All domains explored</span>' +
			'</div>';
	}

	return '<div class="intake-domain-transition">' +
		completedHtml +
		'<div class="domain-transition-arrow">&#x25BC;</div>' +
		nextHtml +
		'</div>';
}

// ==================== Gathering Complete Banner ====================

export function renderGatheringCompleteBanner(
	coverageSummary: { adequate: number; partial: number; none: number; percentage: number },
	intakeMode?: string | null,
): string {
	const isDocBased = intakeMode === 'DOCUMENT_BASED';
	const title = isDocBased ? 'Document Analysis Complete' : 'All Domains Gathered';
	const hint = isDocBased
		? 'Initial document analysis is complete. You can now discuss the plan, answer follow-up questions, or finalize.'
		: 'The system will now synthesize your responses into a plan. You can also type additional context in the composer.';

	return '<div class="intake-gathering-complete-banner">' +
		'<div class="gathering-complete-icon">&#x1F4CB;</div>' +
		'<div class="gathering-complete-content">' +
		'<div class="gathering-complete-title">' + esc(title) + '</div>' +
		'<div class="gathering-complete-stats">' +
		coverageSummary.percentage + '% coverage &mdash; ' +
		coverageSummary.adequate + ' adequate, ' +
		coverageSummary.partial + ' partial, ' +
		coverageSummary.none + ' uncovered' +
		'</div>' +
		'<div class="gathering-complete-hint">' + esc(hint) + '</div>' +
		'</div></div>';
}

// ==================== Intake Analysis Card ====================

export function renderIntakeAnalysisCard(
	humanMessage: string,
	analysisSummary: string,
	codebaseFindings: string[],
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
): string {
	let html = '';

	html += '<div class="intake-analysis-card">';

	html += '<div class="intake-analysis-header">' +
		'<span class="intake-analysis-icon">&#x1F50D;</span>' +
		'<span class="intake-analysis-title">Intent Discovery</span>' +
		'</div>';

	if (commandBlocks && commandBlocks.length > 0) {
		for (const block of commandBlocks) {
			html += renderCommandBlock(block.command, block.outputs);
		}
	}

	html += '<div class="intake-analysis-body">' +
		simpleMarkdownToHtml(analysisSummary) +
		'</div>';

	if (codebaseFindings.length > 0) {
		html += '<details class="intake-analysis-findings">' +
			'<summary class="intake-analysis-findings-header">Codebase Findings (' + codebaseFindings.length + ')</summary>' +
			'<ul class="intake-analysis-findings-list">';
		for (const finding of codebaseFindings) {
			html += '<li>' + esc(finding) + '</li>';
		}
		html += '</ul></details>';
	}

	html += '</div>';
	return html;
}

// ==================== Product Discovery Card ====================

export function renderIntakeProductDiscoveryCard(
	productFields: {
		requestCategory?: string;
		productVision?: string;
		productDescription?: string;
		personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>;
		userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>;
		phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>;
		successMetrics?: string[];
		uxRequirements?: string[];
	},
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	eventId?: number,
): string {
	let html = '<div class="intake-product-discovery-card">';

	html += '<div class="intake-product-discovery-header">' +
		'<span class="intake-product-discovery-icon">&#x1F4CB;</span>' +
		'<span class="intake-product-discovery-title">Product Discovery</span>' +
		'</div>';

	html += '<div class="intake-product-discovery-intro">' +
		'Review the product artifacts below. Accept, reject, or edit each assumption ' +
		'before proceeding to the technical approach.' +
		'</div>';

	html += renderProposalProductArtifacts(productFields);

	if (mmpJson) {
		try {
			const mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror || mmp.menu || mmp.preMortem) {
				const cardId = 'PD-REVIEW-' + (eventId ?? '0');
				html += renderMMPSection(mmp, cardId, true, { type: 'intake' }, allPendingDecisions?.[cardId]);
			}
		} catch { /* ignore parse errors */ }
	}

	html += '</div>';
	return html;
}

// ==================== Proposal Product Artifacts ====================

export function renderProposalProductArtifacts(fields: {
	productVision?: string;
	productDescription?: string;
	personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>;
	userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>;
	phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>;
	successMetrics?: string[];
	uxRequirements?: string[];
}): string {
	let html = '';
	const hasAny = fields.productVision || fields.productDescription ||
		(fields.personas && fields.personas.length > 0) ||
		(fields.userJourneys && fields.userJourneys.length > 0);

	if (!hasAny) { return ''; }

	html += '<details class="intake-proposal-product" open>' +
		'<summary class="intake-proposal-product-header">Product Discovery</summary>' +
		'<div class="intake-proposal-product-body">';

	if (fields.productVision) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Vision</div>' +
			'<div class="intake-proposal-product-text">' + esc(fields.productVision) + '</div>' +
			'<div class="pd-inline-edit">' +
			'<textarea class="pd-inline-edit-area" data-pd-edit-field="vision" ' +
			'placeholder="Suggest changes to the vision statement..." rows="2"></textarea>' +
			'</div>' +
			'</div>';
	}

	if (fields.productDescription) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Product Description</div>' +
			'<div class="intake-proposal-product-text">' + esc(fields.productDescription) + '</div>' +
			'<div class="pd-inline-edit">' +
			'<textarea class="pd-inline-edit-area" data-pd-edit-field="description" ' +
			'placeholder="Suggest changes to the product description..." rows="2"></textarea>' +
			'</div>' +
			'</div>';
	}

	if (fields.personas && fields.personas.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Personas</div>';
		for (let pIdx = 0; pIdx < fields.personas.length; pIdx++) {
			const p = fields.personas[pIdx];
			const pFieldId = 'persona:' + (p.name || 'Persona ' + (pIdx + 1));
			html += '<div class="intake-proposal-persona">' +
				'<strong>' + esc(p.name) + '</strong> ' +
				'<span class="intake-proposal-persona-id">[' + esc(p.id) + ']</span>' +
				'<div class="intake-proposal-persona-desc">' + esc(p.description) + '</div>';
			if ((p.goals ?? []).length > 0) {
				html += '<div class="intake-proposal-persona-goals">Goals: ' + p.goals.map(g => esc(g)).join('; ') + '</div>';
			}
			if ((p.painPoints ?? []).length > 0) {
				html += '<div class="intake-proposal-persona-pains">Pain points: ' + p.painPoints.map(pp => esc(pp)).join('; ') + '</div>';
			}
			html += '<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + esc(pFieldId) + '" ' +
				'placeholder="Clarify or correct this persona..." rows="1"></textarea>' +
				'</div>';
			html += '</div>';
		}
		html += '</div>';
	}

	if (fields.userJourneys && fields.userJourneys.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">User Journeys</div>';
		for (let jIdx = 0; jIdx < fields.userJourneys.length; jIdx++) {
			const j = fields.userJourneys[jIdx];
			const jFieldId = 'journey:' + (j.title || 'Journey ' + (jIdx + 1));
			html += '<div class="intake-proposal-journey">' +
				'<strong>' + esc(j.title) + '</strong> ' +
				'<span class="intake-proposal-journey-priority badge-' + j.priority.toLowerCase() + '">' + esc(j.priority) + '</span>' +
				'<div class="intake-proposal-journey-scenario">' + esc(j.scenario) + '</div>';
			const validSteps = (j.steps ?? []).filter(
				(s: { actor?: string; action?: string; expectedOutcome?: string }) =>
					s.actor || s.action || s.expectedOutcome
			);
			if (validSteps.length > 0) {
				html += '<ol class="intake-proposal-journey-steps">';
				for (const s of validSteps) {
					html += '<li>';
					if (s.actor) { html += '<strong>' + esc(s.actor) + '</strong>: '; }
					html += esc(s.action || '');
					if (s.expectedOutcome) { html += ' &rarr; ' + esc(s.expectedOutcome); }
					html += '</li>';
				}
				html += '</ol>';
			}
			if (j.acceptanceCriteria && j.acceptanceCriteria.length > 0) {
				html += '<div class="intake-proposal-journey-ac">Acceptance: ' +
					j.acceptanceCriteria.map(ac => esc(ac)).join('; ') + '</div>';
			}
			html += '<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + esc(jFieldId) + '" ' +
				'placeholder="Clarify or correct this journey..." rows="1"></textarea>' +
				'</div>';
			html += '</div>';
		}
		html += '</div>';
	}

	if (fields.phasingStrategy && fields.phasingStrategy.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Phasing Strategy</div>';
		for (let phIdx = 0; phIdx < fields.phasingStrategy.length; phIdx++) {
			const ph = fields.phasingStrategy[phIdx];
			const phaseLabel = `Phase ${phIdx + 1}`;
			html += '<div class="intake-proposal-phasing">' +
				'<strong>' + esc(phaseLabel) + '</strong>: ' + esc(ph.description) +
				' <span class="intake-proposal-phasing-rationale">(' + esc(ph.rationale) + ')</span>' +
				'<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + esc('phase:' + phaseLabel) + '" ' +
				'placeholder="Clarify or correct this phase..." rows="1"></textarea>' +
				'</div>' +
				'</div>';
		}
		html += '</div>';
	}

	if (fields.successMetrics && fields.successMetrics.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Success Metrics</div>' +
			'<ul>';
		for (let mIdx = 0; mIdx < fields.successMetrics.length; mIdx++) {
			const m = fields.successMetrics[mIdx];
			html += '<li>' + esc(m) +
				'<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="metric:' + esc(m.substring(0, 60)) + '" ' +
				'placeholder="Clarify or correct this metric..." rows="1"></textarea>' +
				'</div>' +
				'</li>';
		}
		html += '</ul></div>';
	}

	html += '</div></details>';
	return html;
}

// ==================== Proposer Domains Card ====================

export function renderProposerDomainsCard(
	domains: Array<{ id: string; name: string; description: string; rationale: string; entityPreview: string[]; workflowPreview: string[] }>,
	personas: Array<{ id: string; name: string; description: string }>,
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-DOMAINS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: MMPPayload | null = null;
	const mirrorById = new Map<string, MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-domains-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F30D;</span>' +
		'<span class="proposer-card-title">Proposed Business Domains</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed business domains and personas. Accept, reject, or edit each one.</div>';

	if (domains.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Domains (' + domains.length + ')</div>';
		for (const d of domains) {
			const contentHtml =
				'<div class="proposer-domain-header">' +
				'<strong>' + esc(d.name) + '</strong> <code>' + esc(d.id) + '</code>' +
				'</div>' +
				'<div class="proposer-domain-desc">' + esc(d.description) + '</div>' +
				'<div class="proposer-domain-meta">Entities: ' + d.entityPreview.map(e => esc(e)).join(', ') +
				' | Workflows: ' + d.workflowPreview.map(w => esc(w)).join(', ') + '</div>' +
				'<div class="proposer-domain-rationale"><em>' + esc(d.rationale) + '</em></div>';

			const mirrorItem = mirrorById.get(d.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(d.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-domain-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	if (personas.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Personas (' + personas.length + ')</div>';
		for (const p of personas) {
			const contentHtml = '<strong>' + esc(p.name) + '</strong>: ' + esc(p.description);
			const mirrorItem = mirrorById.get(p.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(p.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-persona-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

// ==================== Proposer Journeys Card ====================

export function renderProposerJourneysCard(
	journeys: Array<{ id: string; title: string; scenario: string; priority?: string }>,
	workflows: Array<{ id: string; name: string; description: string; businessDomainId: string }>,
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-JOURNEYS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: MMPPayload | null = null;
	const mirrorById = new Map<string, MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-journeys-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F6A3;</span>' +
		'<span class="proposer-card-title">Proposed Journeys & Workflows</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed user journeys and system workflows.</div>';

	if (journeys.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">User Journeys (' + journeys.length + ')</div>';
		for (const j of journeys) {
			const phase = (j as Record<string, unknown>).implementationPhase as string | undefined ?? j.priority ?? '';
			const source = (j as Record<string, unknown>).source as string | undefined ?? '';
			const contentHtml =
				'<strong>' + esc(j.title) + '</strong> ' +
				(phase ? '<span class="badge badge-phase">' + esc(phase) + '</span> ' : '') +
				(source ? '<span class="badge badge-source">' + esc(source) + '</span>' : '') +
				'<div>' + esc(j.scenario) + '</div>';
			const mirrorItem = mirrorById.get(j.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(j.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-journey-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	if (workflows.length > 0) {
		const wfByDomain = new Map<string, typeof workflows>();
		for (const w of workflows) {
			const group = wfByDomain.get(w.businessDomainId) ?? [];
			group.push(w);
			wfByDomain.set(w.businessDomainId, group);
		}
		html += '<div class="proposer-section"><div class="proposer-section-label">System Workflows (' + workflows.length + ' across ' + wfByDomain.size + ' domains)</div>';
		for (const [businessDomainId, domainWorkflows] of wfByDomain) {
			html += '<details class="proposer-domain-group" open>' +
				'<summary class="proposer-domain-group-header">' + esc(businessDomainId) +
				' <span class="proposer-domain-group-count">(' + domainWorkflows.length + ')</span></summary>' +
				'<div class="proposer-domain-group-body">';
			for (const w of domainWorkflows) {
				const contentHtml =
					'<strong>' + esc(w.name) + '</strong>' +
					'<div>' + esc(w.description) + '</div>';
				const mirrorItem = mirrorById.get(w.id);
				if (mirrorItem) {
					html += renderInlineMirrorButtons(w.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
				} else {
					html += '<div class="proposer-workflow-item">' + contentHtml + '</div>';
				}
			}
			html += '</div></details>';
		}
		html += '</div>';
	}

	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

// ==================== Proposer Entities Card ====================

export function renderProposerEntitiesCard(
	entities: Array<{ id: string; name: string; description: string; businessDomainId: string; keyAttributes: string[]; relationships: string[] }>,
	mmpJson?: string,
	domainNames?: Record<string, string>,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-ENTITIES-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: MMPPayload | null = null;
	const mirrorById = new Map<string, MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-entities-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F4CA;</span>' +
		'<span class="proposer-card-title">Proposed Data Model</span></div>';

	const byDomain = new Map<string, typeof entities>();
	for (const e of entities) {
		const group = byDomain.get(e.businessDomainId) ?? [];
		group.push(e);
		byDomain.set(e.businessDomainId, group);
	}

	html += '<div class="proposer-card-intro">Review the proposed data entities — ' +
		entities.length + ' entities across ' + byDomain.size + ' domains.</div>';

	for (const [businessDomainId, domainEntities] of byDomain) {
		const domainName = domainNames?.[businessDomainId] ?? businessDomainId;
		html += '<details class="proposer-domain-group" open>' +
			'<summary class="proposer-domain-group-header">' +
			esc(domainName) + ' <span class="proposer-domain-group-count">(' +
			domainEntities.length + ' entit' + (domainEntities.length === 1 ? 'y' : 'ies') + ')</span></summary>' +
			'<div class="proposer-domain-group-body">';
		for (const e of domainEntities) {
			const contentHtml =
				'<strong>' + esc(e.name) + '</strong>' +
				'<div class="proposer-entity-desc">' + esc(e.description) + '</div>' +
				(e.keyAttributes.length > 0 ? '<div class="proposer-entity-meta">Attributes: ' + e.keyAttributes.map(a => esc(a)).join(', ') + '</div>' : '') +
				(e.relationships.length > 0 ? '<div class="proposer-entity-meta">Relationships: ' + e.relationships.map(r => esc(r)).join(', ') + '</div>' : '');
			const mirrorItem = mirrorById.get(e.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(e.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-entity-item">' + contentHtml + '</div>';
			}
		}
		html += '</div></details>';
	}

	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

// ==================== Proposer Integrations Card ====================

export function renderProposerIntegrationsCard(
	integrations: Array<{ id: string; name: string; category: string; description: string; standardProviders: string[]; ownershipModel: string }>,
	qualityAttributes: string[],
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-INTEGRATIONS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: MMPPayload | null = null;
	const mirrorById = new Map<string, MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-integrations-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F517;</span>' +
		'<span class="proposer-card-title">Proposed Integrations & Quality</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed integrations and quality attributes. Submit to generate the full product specification.</div>';

	if (integrations.length > 0) {
		const byCategory = new Map<string, typeof integrations>();
		for (const int of integrations) {
			const group = byCategory.get(int.category) ?? [];
			group.push(int);
			byCategory.set(int.category, group);
		}
		html += '<div class="proposer-section"><div class="proposer-section-label">Integrations (' + integrations.length + ' across ' + byCategory.size + ' categories)</div>';
		for (const [category, catIntegrations] of byCategory) {
			const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
			html += '<details class="proposer-domain-group" open>' +
				'<summary class="proposer-domain-group-header">' + esc(catLabel) +
				' <span class="proposer-domain-group-count">(' + catIntegrations.length + ')</span></summary>' +
				'<div class="proposer-domain-group-body">';
			for (const int of catIntegrations) {
				const contentHtml =
					'<strong>' + esc(int.name) + '</strong>' +
					'<div>' + esc(int.description) + '</div>' +
					'<div class="proposer-entity-meta">Providers: ' + int.standardProviders.map(p => esc(p)).join(', ') +
					' | Ownership: ' + esc(int.ownershipModel) + '</div>';
				const mirrorItem = mirrorById.get(int.id);
				if (mirrorItem) {
					html += renderInlineMirrorButtons(int.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
				} else {
					html += '<div class="proposer-integration-item">' + contentHtml + '</div>';
				}
			}
			html += '</div></details>';
		}
		html += '</div>';
	}

	if (qualityAttributes.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Quality Attributes</div>';
		for (let i = 0; i < qualityAttributes.length; i++) {
			const qaId = `PV-QA-${i + 1}`;
			const contentHtml = esc(qualityAttributes[i]);
			const mirrorItem = mirrorById.get(qaId);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(qaId, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-qa-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

// ==================== Intake Proposal Card ====================

export function renderIntakeProposalCard(
	title: string,
	summary: string,
	proposedApproach: string,
	engineeringDomainCoverage: { adequate: number; partial: number; none: number; percentage: number },
): string {
	let html = '<div class="intake-proposal-card">';

	html += '<div class="intake-proposal-header">' +
		'<span class="intake-proposal-icon">&#x1F4D0;</span>' +
		'<span class="intake-proposal-title">Proposed Technical Approach</span>' +
		'</div>';

	if (title) {
		html += '<div class="intake-proposal-plan-title">' + esc(title) + '</div>';
	}

	if (summary) {
		html += '<div class="intake-proposal-summary">' +
			simpleMarkdownToHtml(summary) +
			'</div>';
	}

	if (proposedApproach) {
		html += '<div class="intake-proposal-approach">' +
			'<div class="intake-proposal-approach-label">Approach</div>' +
			'<div class="intake-proposal-approach-body">' +
			simpleMarkdownToHtml(proposedApproach) +
			'</div></div>';
	}

	html += '<div class="intake-proposal-coverage">' +
		'<div class="intake-proposal-coverage-bar">' +
		'<span class="intake-proposal-coverage-label">Domain Coverage</span>' +
		'<span class="intake-proposal-coverage-pct">' + engineeringDomainCoverage.percentage + '%</span>' +
		'</div>' +
		'<div class="intake-proposal-coverage-stats">' +
		engineeringDomainCoverage.adequate + ' adequate, ' +
		engineeringDomainCoverage.partial + ' partial, ' +
		engineeringDomainCoverage.none + ' uncovered' +
		'</div></div>';

	html += '<div class="intake-proposal-footer">' +
		'Review the approach above. Share feedback or questions to refine it.' +
		'</div>';

	html += '</div>';
	return html;
}

// ==================== Domain Coverage Sidebar ====================

export function renderDomainCoverageSidebar(coverage: EngineeringDomainCoverageMap, currentEngineeringDomain?: string | null): string {
	let domainsHtml = '';
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = coverage[domain];
		const info = DOMAIN_INFO[domain];
		if (!entry || !info) { continue; }
		let dotClass: string;
		switch (entry.level) {
			case EngineeringDomainCoverageLevel.ADEQUATE: dotClass = 'coverage-adequate'; break;
			case EngineeringDomainCoverageLevel.PARTIAL: dotClass = 'coverage-partial'; break;
			default: dotClass = 'coverage-none'; break;
		}

		const hasEvidence = entry.evidence.length > 0;
		const isCurrentDomain = currentEngineeringDomain && domain === currentEngineeringDomain;
		const evidenceSnippets = hasEvidence
			? entry.evidence.map(e => '<li>' + esc(e) + '</li>').join('')
			: '<li class="no-evidence">No evidence yet</li>';
		const chevron = hasEvidence ? '<span class="coverage-row-chevron">&#x25B6;</span>' : '';
		const pointer = isCurrentDomain ? '<span class="coverage-current-indicator">&#x25B6;</span>' : '';

		domainsHtml +=
			'<div class="coverage-domain-row' + (hasEvidence ? ' has-evidence' : '') + (isCurrentDomain ? ' current-domain' : '') + '" title="' + esc(info.description) + '" data-action="toggle-coverage-evidence">' +
				chevron +
				pointer +
				'<span class="coverage-dot ' + dotClass + '"></span>' +
				'<span class="coverage-domain-label">' + esc(info.label) + '</span>' +
				'<span class="coverage-level-tag ' + dotClass + '">' + entry.level + '</span>' +
			'</div>' +
			'<div class="coverage-evidence-details"' + (hasEvidence ? '' : ' style="display:none"') + '>' +
				'<ul>' + evidenceSnippets + '</ul>' +
			'</div>';
	}

	let adequate = 0, partial = 0, none = 0;
	const total = DOMAIN_SEQUENCE.length;
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = coverage[domain];
		if (!entry) { none++; continue; }
		switch (entry.level) {
			case EngineeringDomainCoverageLevel.ADEQUATE: adequate++; break;
			case EngineeringDomainCoverageLevel.PARTIAL: partial++; break;
			default: none++; break;
		}
	}
	const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);

	return `
		<div class="domain-coverage-sidebar">
			<div class="coverage-sidebar-header">
				<span class="coverage-sidebar-title">Domain Coverage</span>
				<span class="coverage-sidebar-pct">${percentage}%</span>
			</div>
			<div class="coverage-sidebar-bar">
				<div class="coverage-bar-fill" style="width: ${percentage}%"></div>
			</div>
			<div class="coverage-sidebar-stats">
				<span class="coverage-stat adequate">${adequate} adequate</span>
				<span class="coverage-stat partial">${partial} partial</span>
				<span class="coverage-stat none">${none} uncovered</span>
			</div>
			<div class="coverage-domain-list">
				${domainsHtml}
			</div>
		</div>
	`;
}

// ==================== Private helper used by proposer cards ====================

function renderMMPSubmitBar(cardId: string, mmp: MMPPayload, pending?: PendingMmpSnapshot): string {
	const prefix = cardId + ':';
	let mirrorTotal = 0, mirrorDone = 0;
	let menuTotal = 0, menuDone = 0;
	let pmTotal = 0, pmDone = 0;
	if (mmp.mirror) {
		mirrorTotal = mmp.mirror.items.length;
		for (const item of mmp.mirror.items) {
			if (pending?.mirrorDecisions[prefix + item.id] || item.status !== 'pending') { mirrorDone++; }
		}
	}
	if (mmp.menu) {
		const menuIds = new Set(mmp.menu.items.map(m => m.id));
		menuTotal = menuIds.size;
		for (const id of menuIds) {
			if (pending?.menuSelections[prefix + id]) { menuDone++; }
		}
	}
	if (mmp.preMortem) {
		pmTotal = mmp.preMortem.items.length;
		for (const item of mmp.preMortem.items) {
			if (pending?.preMortemDecisions[prefix + item.id] || item.status !== 'pending') { pmDone++; }
		}
	}
	const progressParts: string[] = [];
	if (mirrorTotal > 0) { progressParts.push('Mirror: ' + mirrorDone + '/' + mirrorTotal); }
	if (menuTotal > 0) { progressParts.push('Menu: ' + menuDone + '/' + menuTotal); }
	if (pmTotal > 0) { progressParts.push('Risks: ' + pmDone + '/' + pmTotal); }
	const progressHtml = progressParts.join(' &middot; ');

	const hasMirror = mirrorTotal > 0;
	const hasPm = pmTotal > 0;
	const bulkHtml = (hasMirror || hasPm)
		? '<div class="mmp-bulk-actions">' +
			(hasMirror
				? '<button class="mmp-bulk-btn mmp-bulk-accept" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="accept" title="Accept all Mirror items">&#x2713; Accept All</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-reject" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="reject" title="Reject all Mirror items">&#x2717; Reject All</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-defer" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="defer" title="Defer all Mirror items">&#x23F3; Defer All</button>'
				: '') +
			(hasPm
				? '<button class="mmp-bulk-btn mmp-bulk-accept-pm" data-action="mmp-bulk-pm" data-mmp-card="' + cardId + '" data-mmp-bulk-action="accept" title="Accept all risks">&#x2713; Accept All Risks</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-reject-pm" data-action="mmp-bulk-pm" data-mmp-card="' + cardId + '" data-mmp-bulk-action="reject" title="Reject all risks">&#x2717; Reject All Risks</button>'
				: '') +
			'</div>'
		: '';

	return '<div class="mmp-submit-bar" data-mmp-submit-bar="' + cardId + '">' +
		bulkHtml +
		'<span class="mmp-submit-progress" data-mmp-progress="' + cardId + '">' + progressHtml + '</span>' +
		'<button class="mmp-submit-btn" data-action="mmp-submit" data-mmp-card="' + cardId + '">Submit Decisions</button>' +
	'</div>';
}
