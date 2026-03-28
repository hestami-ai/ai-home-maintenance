/**
 * Architecture phase card renderers for the webview.
 */

import { esc, formatTimestamp } from './utils';
import { renderMMPSection } from './mmpRenderer';
import type { MMPPayload, PendingMmpSnapshot } from './streamTypes';

// ==================== Architecture Capabilities Card ====================

export function renderArchitectureCapabilitiesCard(
	capabilities: Array<{ id: string; label: string; requirements: number; workflows: number; parentId: string | null }>,
	timestamp: string,
	dialogueId?: string
): string {
	if (!capabilities.length) { return ''; }

	const topLevel = capabilities.filter(c => !c.parentId);
	const childrenByParent = new Map<string, typeof capabilities>();
	for (const cap of capabilities) {
		if (cap.parentId) {
			const siblings = childrenByParent.get(cap.parentId) ?? [];
			siblings.push(cap);
			childrenByParent.set(cap.parentId, siblings);
		}
	}

	let rows = '';
	for (const cap of topLevel) {
		rows += `<tr class="capability-top-level">
			<td><code>${esc(cap.id)}</code></td>
			<td><strong>${esc(cap.label)}</strong></td>
			<td>${cap.requirements}</td>
			<td>${cap.workflows}</td>
		</tr>`;
		const children = childrenByParent.get(cap.id) ?? [];
		for (const child of children) {
			rows += `<tr class="capability-child">
				<td><code>&nbsp;&nbsp;├ ${esc(child.id)}</code></td>
				<td>${esc(child.label)}</td>
				<td>${child.requirements}</td>
				<td>${child.workflows}</td>
			</tr>`;
		}
	}

	return `<div class="card architecture-card" data-timestamp="${esc(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-architect">ARCHITECT</span>
			<span class="card-title">Capability Decomposition</span>
			<span class="card-meta">${topLevel.length} top-level, ${capabilities.length} total</span>
		</div>
		<div class="card-body">
			<table class="architecture-table">
				<thead><tr><th>ID</th><th>Capability</th><th>Reqs</th><th>Workflows</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
			<button class="gate-btn" data-action="open-architecture-explorer"${dialogueId ? ` data-dialogue-id="${esc(dialogueId)}"` : ''} style="margin-top:6px;">&#x1F50D; View Full Architecture</button>
		</div>
	</div>`;
}

// ==================== Architecture Design Card ====================

export function renderArchitectureDesignCard(
	components: Array<{ id: string; label: string; responsibility: string; rationale: string; parentId: string | null; workflowsServed: string[]; dependencies: string[]; interactionPatterns: string[]; technologyNotes: string; fileScope: string }>,
	dataModels: Array<{ id: string; entity: string; description: string; fields: Array<{ name: string; type: string; required: boolean }>; relationships: Array<{ targetModel: string; type: string; description: string }>; invariants: string[] }>,
	interfaces: Array<{ id: string; label: string; type: string; description: string; contract: string; providerComponent: string; consumerComponents: string[]; sourceWorkflows: string[] }>,
	implementationSequence: Array<{ id: string; label: string; description: string; componentsInvolved: string[]; dependencies: string[]; complexity: string; verificationMethod: string; sortOrder: number }>,
	timestamp: string,
	dialogueId?: string
): string {
	const topLevel = components.filter(c => !c.parentId);
	const childrenByParent = new Map<string, typeof components>();
	for (const c of components) {
		if (c.parentId) {
			const existing = childrenByParent.get(c.parentId) || [];
			existing.push(c);
			childrenByParent.set(c.parentId, existing);
		}
	}
	const hasHierarchy = childrenByParent.size > 0;
	const parentCount = topLevel.length;
	const childCount = components.length - parentCount;

	function renderComponentCard(comp: typeof components[0], isChild: boolean): string {
		const badges: string[] = [];
		if (comp.workflowsServed.length > 0) {
			badges.push(...comp.workflowsServed.map(w => `<span class="arch-badge arch-badge-workflow">${esc(w)}</span>`));
		}
		if (comp.dependencies.length > 0) {
			badges.push(...comp.dependencies.map(d => `<span class="arch-badge arch-badge-dep">${esc(d)}</span>`));
		}

		const children = childrenByParent.get(comp.id) || [];
		const childSection = children.length > 0
			? `<details class="arch-sub-components">
				<summary>Sub-components (${children.length})</summary>
				<div class="arch-children">${children.map(ch => renderComponentCard(ch, true)).join('')}</div>
			</details>`
			: '';

		return `<div class="arch-component-card${isChild ? ' arch-child-card' : ''}">
			<div class="arch-comp-header">
				<code class="arch-comp-id">${esc(comp.id)}</code>
				<strong class="arch-comp-label">${esc(comp.label)}</strong>
			</div>
			<div class="arch-comp-body">
				<div class="arch-comp-responsibility">${esc(comp.responsibility)}</div>
				${comp.rationale ? `<div class="arch-comp-rationale"><span class="arch-rationale-label">Rationale:</span> ${esc(comp.rationale)}</div>` : ''}
				${badges.length > 0 ? `<div class="arch-comp-badges">${badges.join('')}</div>` : ''}
				${comp.technologyNotes ? `<div class="arch-comp-tech"><span class="arch-detail-label">Tech:</span> ${esc(comp.technologyNotes)}</div>` : ''}
				${comp.fileScope ? `<div class="arch-comp-scope"><span class="arch-detail-label">Scope:</span> <code>${esc(comp.fileScope)}</code></div>` : ''}
				${comp.interactionPatterns.length > 0 ? `<div class="arch-comp-interactions"><span class="arch-detail-label">Interactions:</span> ${comp.interactionPatterns.map(p => esc(p)).join('; ')}</div>` : ''}
			</div>
			${childSection}
		</div>`;
	}

	const componentCards = topLevel.map(c => renderComponentCard(c, false)).join('');

	const domainModelCards = dataModels.map(m => {
		const fieldRows = m.fields.map(f =>
			`<tr>
				<td><code>${esc(f.name)}</code></td>
				<td>${esc(f.type)}</td>
				<td>${f.required ? '<span class="arch-required">required</span>' : '<span class="arch-optional">optional</span>'}</td>
			</tr>`
		).join('');

		const relRows = m.relationships.map(r =>
			`<div class="arch-relationship">
				<span class="arch-rel-arrow">&rarr;</span>
				<strong>${esc(r.targetModel)}</strong>
				<span class="arch-rel-type">(${esc(r.type)})</span>
				<span class="arch-rel-desc">${esc(r.description)}</span>
			</div>`
		).join('');

		const invariantList = m.invariants.length > 0
			? `<div class="arch-invariants"><span class="arch-detail-label">Invariants:</span><ul>${m.invariants.map(inv => `<li>${esc(inv)}</li>`).join('')}</ul></div>`
			: '';

		return `<div class="arch-model-card">
			<div class="arch-model-header">
				<code class="arch-comp-id">${esc(m.id)}</code>
				<strong>${esc(m.entity)}</strong>
			</div>
			${m.description ? `<div class="arch-model-desc">${esc(m.description)}</div>` : ''}
			${m.fields.length > 0 ? `<table class="arch-fields-table">
				<thead><tr><th>Field</th><th>Type</th><th></th></tr></thead>
				<tbody>${fieldRows}</tbody>
			</table>` : ''}
			${relRows ? `<div class="arch-relationships">${relRows}</div>` : ''}
			${invariantList}
		</div>`;
	}).join('');

	const interfaceCards = interfaces.map(iface => {
		const consumers = iface.consumerComponents.length > 0
			? iface.consumerComponents.map(c => esc(c)).join(', ')
			: 'none';
		const workflows = iface.sourceWorkflows.length > 0
			? iface.sourceWorkflows.map(w => `<span class="arch-badge arch-badge-workflow">${esc(w)}</span>`).join('')
			: '';

		return `<div class="arch-interface-card">
			<div class="arch-iface-header">
				<code class="arch-comp-id">${esc(iface.id)}</code>
				<strong>${esc(iface.label)}</strong>
				<span class="arch-badge arch-badge-type">${esc(iface.type)}</span>
			</div>
			${iface.description ? `<div class="arch-iface-desc">${esc(iface.description)}</div>` : ''}
			${iface.contract ? `<div class="arch-contract"><pre>${esc(iface.contract)}</pre></div>` : ''}
			<div class="arch-iface-endpoints">
				<span class="arch-detail-label">Provider:</span> <code>${esc(iface.providerComponent)}</code>
				<span class="arch-detail-label" style="margin-left:12px">Consumers:</span> ${consumers}
			</div>
			${workflows ? `<div class="arch-iface-workflows">${workflows}</div>` : ''}
		</div>`;
	}).join('');

	const sortedSteps = [...implementationSequence].sort((a, b) => a.sortOrder - b.sortOrder);

	const roadmapHtml = sortedSteps.map(step => {
		const depText = step.dependencies.length > 0
			? `<span class="arch-detail-label">Depends on:</span> ${step.dependencies.map(d => esc(d)).join(', ')}`
			: '';
		const compText = step.componentsInvolved.length > 0
			? step.componentsInvolved.map(c => `<code>${esc(c)}</code>`).join(', ')
			: '';
		const complexityClass = step.complexity === 'HIGH' ? 'arch-complexity-high'
			: step.complexity === 'MEDIUM' ? 'arch-complexity-medium'
			: 'arch-complexity-low';

		return `<div class="arch-roadmap-step">
			<div class="arch-step-header">
				<code class="arch-comp-id">${esc(step.id)}</code>
				<strong>${esc(step.label)}</strong>
				<span class="arch-badge ${complexityClass}">${esc(step.complexity)}</span>
			</div>
			<div class="arch-step-desc">${esc(step.description)}</div>
			<div class="arch-step-meta">
				${compText ? `<div><span class="arch-detail-label">Components:</span> ${compText}</div>` : ''}
				${depText ? `<div>${depText}</div>` : ''}
				${step.verificationMethod ? `<div><span class="arch-detail-label">Verify:</span> ${esc(step.verificationMethod)}</div>` : ''}
			</div>
		</div>`;
	}).join('');

	const metaText = hasHierarchy
		? `${parentCount} top-level, ${childCount} sub-components, ${dataModels.length} models, ${interfaces.length} interfaces`
		: `${components.length} components, ${dataModels.length} models, ${interfaces.length} interfaces`;

	return `<div class="card architecture-card architecture-design-card" data-timestamp="${esc(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-architect">ARCHITECT</span>
			<span class="card-title">Architecture Design</span>
			<span class="card-meta">${metaText}</span>
		</div>
		<div class="card-body">
			<details open>
				<summary class="arch-section-summary">Components (${components.length})</summary>
				<div class="arch-section-content">${componentCards || '<p class="arch-empty">No components defined.</p>'}</div>
			</details>
			${dataModels.length ? `<details>
				<summary class="arch-section-summary">Domain Model (${dataModels.length} entities)</summary>
				<div class="arch-section-content">${domainModelCards}</div>
			</details>` : ''}
			${interfaces.length ? `<details>
				<summary class="arch-section-summary">Interfaces (${interfaces.length})</summary>
				<div class="arch-section-content">${interfaceCards}</div>
			</details>` : ''}
			${sortedSteps.length ? `<details>
				<summary class="arch-section-summary">Implementation Roadmap (${sortedSteps.length} steps)</summary>
				<div class="arch-section-content">${roadmapHtml}</div>
			</details>` : ''}
			<button class="gate-btn" data-action="open-architecture-explorer"${dialogueId ? ` data-dialogue-id="${esc(dialogueId)}"` : ''} style="margin-top:6px;">&#x1F50D; View Full Architecture</button>
		</div>
	</div>`;
}

// ==================== Architecture Validation Card ====================

export function renderArchitectureValidationCard(
	score: number | null,
	findings: string[],
	validated: boolean,
	timestamp: string,
	dialogueId?: string
): string {
	const scoreDisplay = score !== null ? `${Math.round(score * 100)}%` : 'N/A';
	const scoreClass = score !== null
		? (score >= 0.8 ? 'score-good' : score >= 0.5 ? 'score-warn' : 'score-bad')
		: 'score-na';
	const statusLabel = validated ? 'Passed' : 'Needs Revision';
	const statusClass = validated ? 'status-pass' : 'status-fail';

	const findingsList = findings.length
		? `<ul class="validation-findings">${findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`
		: '<p class="no-findings">No findings — architecture looks good.</p>';

	return `<div class="card architecture-card validation-card" data-timestamp="${esc(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-historian">HISTORIAN</span>
			<span class="card-title">Architecture Validation</span>
			<span class="card-meta ${statusClass}">${statusLabel}</span>
		</div>
		<div class="card-body">
			<div class="validation-score ${scoreClass}">
				<span class="score-label">Goal Alignment</span>
				<span class="score-value">${scoreDisplay}</span>
			</div>
			${findingsList}
			<button class="gate-btn" data-action="open-architecture-explorer"${dialogueId ? ` data-dialogue-id="${esc(dialogueId)}"` : ''} style="margin-top:6px;">&#x1F50D; View Full Architecture</button>
		</div>
	</div>`;
}

// ==================== Decomposition Breadcrumb ====================

export function renderDecompositionBreadcrumb(depth: number): string {
	const levels = [
		{ label: 'Goal', level: -2 },
		{ label: 'Capabilities', level: -1 },
		{ label: 'Workflows', level: -1 },
		{ label: 'Components', level: 0 },
		{ label: 'Sub-components', level: 1 },
		{ label: 'Atomic Components', level: 2 },
	];

	const spans = levels.map(function (l) {
		let cls = 'decomposition-level';
		if (l.level < depth) { cls += ' completed'; }
		else if (l.level === depth) { cls += ' active'; }
		return '<span class="' + cls + '">' + l.label + '</span>';
	});

	return '<div class="decomposition-breadcrumb">'
		+ '<div class="decomposition-label">Decomposition Depth</div>'
		+ '<div class="decomposition-levels">' + spans.join('<span class="decomposition-arrow">&#x2192;</span>') + '</div>'
		+ '</div>';
}

// ==================== Architecture Gate Card ====================

export function renderArchitectureGateCard(
	docId: string,
	version: number,
	capabilityCount: number,
	componentCount: number,
	goalAlignmentScore: number | null,
	dialogueId: string,
	resolved?: boolean,
	resolvedAction?: string,
	mmpJson?: string,
	decompositionDepth?: number,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	eventId?: number,
): string {
	const scoreDisplay = goalAlignmentScore !== null ? `${Math.round(goalAlignmentScore * 100)}%` : 'N/A';
	const depth = decompositionDepth ?? 0;

	let mmpHtml = '';
	if (mmpJson && !resolved) {
		try {
			const mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror || mmp.menu || mmp.preMortem) {
				const cardId = 'ARC-' + (eventId ?? docId + '-v' + version);
				mmpHtml = renderMMPSection(mmp, cardId, true, undefined, allPendingDecisions?.[cardId]);
			}
		} catch { /* ignore parse errors */ }
	}

	const breadcrumbHtml = renderDecompositionBreadcrumb(depth);

	if (resolved) {
		const actionLabel = resolvedAction === 'APPROVE' ? 'Approved'
			: resolvedAction === 'OVERRIDE' ? 'Skipped'
			: resolvedAction === 'SUPERSEDED' ? 'Superseded by newer review'
			: 'Revision Requested';
		const actionClass = resolvedAction === 'APPROVE' ? 'gate-approved'
			: resolvedAction === 'OVERRIDE' ? 'gate-skipped'
			: resolvedAction === 'SUPERSEDED' ? 'gate-skipped'
			: 'gate-revised';

		return '<div class="card architecture-card architecture-gate ' + actionClass + '">'
			+ '<div class="card-header">'
			+ '<span class="role-badge role-human">HUMAN</span>'
			+ '<span class="card-title">Architecture Review</span>'
			+ '<span class="card-meta">' + actionLabel + '</span>'
			+ '</div>'
			+ '<div class="card-body">'
			+ breadcrumbHtml
			+ '<p>Architecture v' + version + ': ' + capabilityCount + ' capabilities, ' + componentCount + ' components, goal alignment ' + scoreDisplay + '</p>'
			+ '<button class="gate-btn" data-action="open-architecture-explorer" data-dialogue-id="' + esc(dialogueId) + '" style="margin-top:4px;">&#x1F50D; View Architecture</button>'
			+ '</div>'
			+ '</div>';
	}

	const maxDepthReached = depth >= 2;
	const deeperBtnDisabled = maxDepthReached ? ' disabled' : '';
	const deeperBtnLabel = maxDepthReached ? 'Max Depth Reached' : 'Decompose Deeper';
	const deeperBtnTitle = maxDepthReached
		? 'Maximum decomposition depth (2 additional levels) has been reached'
		: 'Request one additional level of decomposition';

	return '<div class="card architecture-card architecture-gate gate-pending">'
		+ '<div class="card-header">'
		+ '<span class="role-badge role-human">HUMAN</span>'
		+ '<span class="card-title">Architecture Review Required</span>'
		+ '</div>'
		+ '<div class="card-body">'
		+ '<p>Architecture v' + version + ' is ready for review.</p>'
		+ '<ul>'
		+ '<li><strong>Capabilities:</strong> ' + capabilityCount + '</li>'
		+ '<li><strong>Components:</strong> ' + componentCount + '</li>'
		+ '<li><strong>Goal Alignment:</strong> ' + scoreDisplay + '</li>'
		+ '</ul>'
		+ breadcrumbHtml
		+ mmpHtml
		+ '<div class="architecture-feedback-area">'
		+ '<textarea placeholder="Describe what changes you want (min 10 characters)..." rows="3"></textarea>'
		+ '</div>'
		+ '<div class="gate-actions">'
		+ '<button class="gate-btn gate-btn-approve" data-action="architecture-approve" data-dialogue-id="' + esc(dialogueId) + '" data-doc-id="' + esc(docId) + '">Approve</button>'
		+ '<button class="gate-btn gate-btn-revise" data-action="architecture-revise" data-dialogue-id="' + esc(dialogueId) + '" data-doc-id="' + esc(docId) + '">Request Changes</button>'
		+ '<button class="gate-btn gate-btn-skip" data-action="architecture-skip" data-dialogue-id="' + esc(dialogueId) + '" data-doc-id="' + esc(docId) + '">Skip</button>'
		+ '<button class="gate-btn gate-btn-deeper" data-action="architecture-decompose-deeper" data-dialogue-id="' + esc(dialogueId) + '" data-doc-id="' + esc(docId) + '" title="' + deeperBtnTitle + '"' + deeperBtnDisabled + '>' + deeperBtnLabel + '</button>'
		+ '<button class="gate-btn" data-action="open-architecture-explorer" data-dialogue-id="' + esc(dialogueId) + '" style="margin-left:auto;">&#x1F50D; View Architecture</button>'
		+ '</div>'
		+ '</div>'
		+ '</div>';
}
