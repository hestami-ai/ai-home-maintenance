/**
 * Pure HTML rendering functions for the Architecture Explorer.
 * Takes an ArchitectureDocument and produces interactive HTML for each tab.
 */
import type {
	ArchitectureDocument,
	CapabilityNode,
	ComponentSpec,
	DataModelSpec,
	InterfaceSpec,
	ImplementationStep,
	WorkflowNode,
	DecompositionConfig,
} from '../../types/architecture';
import { DEFAULT_DECOMPOSITION_CONFIG } from '../../types/architecture';
import { evaluateStoppingCriteria, isAtomic } from '../../workflow/architectureRecursion';

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── CAPABILITY TREE ──

export function renderCapabilityTree(doc: ArchitectureDocument, concerns: ConcernMap): string {
	const { capabilities, workflow_graph } = doc;
	if (!capabilities.length) { return '<p>No capabilities defined.</p>'; }

	const topLevel = capabilities.filter(c => !c.parent_capability_id);
	const childrenByParent = new Map<string, CapabilityNode[]>();
	for (const cap of capabilities) {
		if (cap.parent_capability_id) {
			const list = childrenByParent.get(cap.parent_capability_id) ?? [];
			list.push(cap);
			childrenByParent.set(cap.parent_capability_id, list);
		}
	}

	// Build workflow lookup: capability_id → workflow names
	const workflowsByCap = new Map<string, WorkflowNode[]>();
	for (const wf of workflow_graph) {
		const list = workflowsByCap.get(wf.capability_id) ?? [];
		list.push(wf);
		workflowsByCap.set(wf.capability_id, list);
	}

	// Build component lookup: workflow_id → component labels
	const componentsByWorkflow = new Map<string, string[]>();
	for (const comp of doc.components) {
		for (const wfId of comp.workflows_served) {
			const list = componentsByWorkflow.get(wfId) ?? [];
			list.push(comp.label);
			componentsByWorkflow.set(wfId, list);
		}
	}

	function renderCap(cap: CapabilityNode, depth: number): string {
		const children = childrenByParent.get(cap.capability_id) ?? [];
		const workflows = workflowsByCap.get(cap.capability_id) ?? [];
		const reqs = cap.source_requirements ?? [];
		const capConcerns = concerns.get(cap.capability_id) ?? [];

		const hasChildren = children.length > 0;
		const chevron = hasChildren
			? `<span class="tree-chevron expanded" data-toggle="${esc(cap.capability_id)}">&#x25B6;</span>`
			: `<span class="tree-chevron">&nbsp;</span>`;

		const reqBadges = reqs.map(r => `<span class="badge badge-req">${esc(r)}</span>`).join('');
		const wfBadges = workflows.map(w => `<span class="badge badge-workflow" title="${esc(w.label)}">${esc(w.workflow_id)}</span>`).join('');

		// Components serving this capability's workflows
		const servingComponents = new Set<string>();
		for (const wf of workflows) {
			for (const cl of (componentsByWorkflow.get(wf.workflow_id) ?? [])) {
				servingComponents.add(cl);
			}
		}
		const compBadges = [...servingComponents].map(c => `<span class="badge badge-component">${esc(c)}</span>`).join('');

		const concernHtml = capConcerns.map(c =>
			`<div class="concern-badge ${esc(c.severity)}">&#x26A0; ${esc(c.severity)}: ${esc(c.summary)}</div>`
		).join('');

		let html = `<div class="tree-node" data-node-id="${esc(cap.capability_id)}">`;
		html += `<div class="tree-node-header">`;
		html += chevron;
		html += `<span class="tree-node-id">${esc(cap.capability_id)}</span>`;
		html += `<span class="tree-node-label">${esc(cap.label)}</span>`;
		html += `<span class="tree-node-meta">`;
		if (reqs.length) { html += ` Reqs: ${reqBadges}`; }
		if (workflows.length) { html += ` | Workflows: ${wfBadges}`; }
		if (servingComponents.size) { html += ` | Components: ${compBadges}`; }
		html += `</span>`;
		html += `</div>`;

		if (cap.description) {
			html += `<div class="tree-node-detail"><div class="detail-row">${esc(cap.description)}</div></div>`;
		}
		if (concernHtml) { html += concernHtml; }

		if (hasChildren) {
			html += `<div class="tree-children" id="children-${esc(cap.capability_id)}">`;
			for (const child of children) {
				html += renderCap(child, depth + 1);
			}
			html += `</div>`;
		}
		html += `</div>`;
		return html;
	}

	const statsHtml = `<div class="stats-bar">
		<div class="stat-item"><strong>${topLevel.length}</strong> top-level</div>
		<div class="stat-item"><strong>${capabilities.length}</strong> total capabilities</div>
		<div class="stat-item"><strong>${workflow_graph.length}</strong> workflows</div>
	</div>`;

	return statsHtml + topLevel.map(c => renderCap(c, 0)).join('');
}

// ── COMPONENT TREE ──

export function renderComponentTree(doc: ArchitectureDocument, concerns: ConcernMap, config?: DecompositionConfig): string {
	const { components } = doc;
	if (!components.length) { return '<p>No components defined.</p>'; }

	const decompConfig = config ?? DEFAULT_DECOMPOSITION_CONFIG;
	const topLevel = components.filter(c => !c.parent_component_id);
	const childrenByParent = new Map<string, ComponentSpec[]>();
	for (const comp of components) {
		if (comp.parent_component_id) {
			const list = childrenByParent.get(comp.parent_component_id) ?? [];
			list.push(comp);
			childrenByParent.set(comp.parent_component_id, list);
		}
	}

	const compLabelById = new Map(components.map(c => [c.component_id, c.label]));

	// Compute decomposition depth per component
	function getDepth(comp: ComponentSpec): number {
		let d = 0;
		let current: ComponentSpec | undefined = comp;
		while (current?.parent_component_id) {
			d++;
			current = components.find(c => c.component_id === current!.parent_component_id);
		}
		return d;
	}
	const maxDepth = Math.max(0, ...components.map(getDepth));

	// Count atomic vs non-atomic (leaf components)
	const leafComponents = components.filter(c => !childrenByParent.has(c.component_id));
	let atomicCount = 0;
	let needsDecompCount = 0;
	for (const leaf of leafComponents) {
		const criteria = evaluateStoppingCriteria(leaf, doc.workflow_graph, decompConfig);
		if (isAtomic(criteria)) { atomicCount++; } else { needsDecompCount++; }
	}

	function renderComp(comp: ComponentSpec, depth: number): string {
		const children = childrenByParent.get(comp.component_id) ?? [];
		const compConcerns = concerns.get(comp.component_id) ?? [];
		const hasChildren = children.length > 0;
		const isLeaf = !hasChildren;

		// Evaluate stopping criteria for leaf components
		let criteriaHtml = '';
		if (isLeaf) {
			const criteria = evaluateStoppingCriteria(comp, doc.workflow_graph, decompConfig);
			const atomic = isAtomic(criteria);
			const checkMark = (v: boolean) => v ? '<span style="color:var(--concern-low);">&#x2713;</span>' : '<span style="color:var(--concern-high);">&#x2717;</span>';
			criteriaHtml = `<div class="stopping-criteria ${atomic ? 'atomic' : 'needs-decomp'}">`;
			criteriaHtml += atomic
				? `<span class="badge" style="background:rgba(76,175,80,0.15);color:var(--concern-low);">atomic &#x2713;</span>`
				: `<span class="badge" style="background:rgba(244,67,54,0.15);color:var(--concern-high);">needs decomposition</span>`;
			criteriaHtml += `<span style="font-size:11px;opacity:0.7;margin-left:8px;">`;
			criteriaHtml += `${checkMark(criteria.context_fit)} context `;
			criteriaHtml += `${checkMark(criteria.verifiable_output)} verifiable `;
			criteriaHtml += `${checkMark(criteria.clear_inputs)} inputs `;
			criteriaHtml += `${checkMark(criteria.single_responsibility)} SRP`;
			criteriaHtml += `</span></div>`;
		}

		const chevron = hasChildren
			? `<span class="tree-chevron expanded" data-toggle="${esc(comp.component_id)}">&#x25B6;</span>`
			: `<span class="tree-chevron">&nbsp;</span>`;

		const wfBadges = comp.workflows_served.map(w => `<span class="badge badge-workflow">${esc(w)}</span>`).join('');
		const depBadges = comp.dependencies.map(d =>
			`<span class="badge badge-dep">${esc(compLabelById.get(d) ?? d)}</span>`
		).join('');

		const concernHtml = compConcerns.map(c =>
			`<div class="concern-badge ${esc(c.severity)}">&#x26A0; ${esc(c.severity)}: ${esc(c.summary)}</div>`
		).join('');

		let html = `<div class="tree-node" data-node-id="${esc(comp.component_id)}">`;
		html += `<div class="tree-node-header">`;
		html += chevron;
		html += `<span class="tree-node-id">${esc(comp.component_id)}</span>`;
		html += `<span class="tree-node-label">${esc(comp.label)}</span>`;
		html += `<span class="tree-node-meta">`;
		if (comp.workflows_served.length) { html += ` Serves: ${wfBadges}`; }
		if (comp.dependencies.length) { html += ` | Deps: ${depBadges}`; }
		html += `</span>`;
		html += `</div>`;

		// Stopping criteria badges
		if (criteriaHtml) { html += criteriaHtml; }

		// Detail section
		html += `<div class="tree-node-detail">`;
		html += `<div class="detail-row"><span class="detail-label">Responsibility:</span>${esc(comp.responsibility)}</div>`;
		if (comp.rationale) {
			html += `<div class="detail-row"><span class="detail-label">Rationale:</span>${esc(comp.rationale)}</div>`;
		}
		if (comp.file_scope) {
			html += `<div class="detail-row"><span class="detail-label">File scope:</span><code>${esc(comp.file_scope)}</code></div>`;
		}
		html += `</div>`;

		if (concernHtml) { html += concernHtml; }

		if (hasChildren) {
			html += `<div class="tree-children" id="children-${esc(comp.component_id)}">`;
			for (const child of children) {
				html += renderComp(child, depth + 1);
			}
			html += `</div>`;
		}
		html += `</div>`;
		return html;
	}

	// Decomposition depth breadcrumb
	const depthStages = ['Goal', 'Capabilities', 'Workflows', 'Components'];
	if (maxDepth >= 1) { depthStages.push('Sub-components'); }
	if (atomicCount > 0) { depthStages.push('Atomic Components'); }
	// Determine current stage
	let currentStageIdx = 3; // Components
	if (maxDepth >= 1) { currentStageIdx = 4; } // Sub-components
	if (needsDecompCount === 0 && atomicCount > 0) { currentStageIdx = depthStages.length - 1; } // Atomic

	const breadcrumbHtml = `<div class="decomposition-breadcrumb">
		<div class="breadcrumb-label">DECOMPOSITION DEPTH</div>
		<div class="breadcrumb-stages">
			${depthStages.map((stage, idx) => {
				const cls = idx < currentStageIdx ? 'stage-complete'
					: idx === currentStageIdx ? 'stage-current'
					: 'stage-pending';
				return `<span class="breadcrumb-stage ${cls}">${esc(stage)}</span>`;
			}).join('<span class="breadcrumb-arrow">&#x2192;</span>')}
		</div>
	</div>`;

	const statsHtml = `<div class="stats-bar">
		<div class="stat-item"><strong>${topLevel.length}</strong> top-level</div>
		<div class="stat-item"><strong>${components.length}</strong> total</div>
		<div class="stat-item"><strong>${maxDepth}</strong> max depth</div>
		<div class="stat-item" style="color:var(--concern-low);"><strong>${atomicCount}</strong> atomic</div>
		${needsDecompCount > 0 ? `<div class="stat-item" style="color:var(--concern-high);"><strong>${needsDecompCount}</strong> needs decomposition</div>` : ''}
	</div>`;

	return breadcrumbHtml + statsHtml + topLevel.map(c => renderComp(c, 0)).join('');
}

// ── DATA MODELS ──

export function renderDataModels(doc: ArchitectureDocument): string {
	const { data_models } = doc;
	if (!data_models.length) { return '<p>No data models defined.</p>'; }

	const modelNameById = new Map(data_models.map(m => [m.model_id, m.entity_name]));

	return data_models.map(model => {
		const fieldsHtml = (model.fields ?? []).map(f => {
			const reqClass = f.required ? 'field-required' : 'field-optional';
			const reqMark = f.required ? '*' : '?';
			return `<div class="field-row ${reqClass}">${reqMark} ${esc(f.name)}: <code>${esc(f.type)}</code></div>`;
		}).join('');

		const relsHtml = (model.relationships ?? []).map(r => {
			const targetName = modelNameById.get(r.target_model) ?? r.target_model;
			return `<div><span class="relationship-arrow">&#x2192;</span> ${esc(targetName)} (${esc(r.type)}): ${esc(r.description)}</div>`;
		}).join('');

		const invariantsHtml = (model.invariants ?? []).length > 0
			? `<div style="margin-top:4px;"><strong>Invariants:</strong> ${model.invariants.map(i => esc(i)).join('; ')}</div>`
			: '';

		return `<div class="data-model-card">
			<h3>${esc(model.entity_name)} <span style="opacity:0.5;font-size:11px">${esc(model.model_id)}</span></h3>
			${model.description ? `<div style="margin-bottom:4px;">${esc(model.description)}</div>` : ''}
			<div class="data-model-fields">${fieldsHtml}</div>
			${relsHtml ? `<div class="data-model-relationships">${relsHtml}</div>` : ''}
			${invariantsHtml}
		</div>`;
	}).join('');
}

// ── INTERFACES ──

export function renderInterfaces(doc: ArchitectureDocument): string {
	const { interfaces: ifaces } = doc;
	if (!ifaces.length) { return '<p>No interfaces defined.</p>'; }

	const compLabelById = new Map(doc.components.map(c => [c.component_id, c.label]));

	return ifaces.map((iface: InterfaceSpec) => {
		const provider = compLabelById.get(iface.provider_component) ?? iface.provider_component;
		const consumers = iface.consumer_components.map(c => compLabelById.get(c) ?? c);

		return `<div class="data-model-card">
			<h3>${esc(iface.label)} <span style="opacity:0.5;font-size:11px">${esc(iface.interface_id)}</span></h3>
			<div class="detail-row"><span class="detail-label">Type:</span>${esc(iface.type)}</div>
			<div class="detail-row"><span class="detail-label">Provider:</span><span class="badge badge-component">${esc(provider)}</span></div>
			<div class="detail-row"><span class="detail-label">Consumers:</span>${consumers.map(c => `<span class="badge badge-component">${esc(c)}</span>`).join(' ')}</div>
			${iface.description ? `<div style="margin-top:4px;">${esc(iface.description)}</div>` : ''}
		</div>`;
	}).join('');
}

// ── IMPLEMENTATION SEQUENCE ──

export function renderImplementationSequence(doc: ArchitectureDocument): string {
	const { implementation_sequence } = doc;
	if (!implementation_sequence.length) { return '<p>No implementation steps defined.</p>'; }

	const compLabelById = new Map(doc.components.map(c => [c.component_id, c.label]));
	const sorted = [...implementation_sequence].sort((a, b) => a.sort_order - b.sort_order);

	return sorted.map((step: ImplementationStep, idx: number) => {
		const compBadges = step.components_involved.map(c =>
			`<span class="badge badge-component">${esc(compLabelById.get(c) ?? c)}</span>`
		).join(' ');
		const depBadges = step.dependencies.map(d => `<span class="badge badge-dep">${esc(d)}</span>`).join(' ');

		return `<div class="impl-step">
			<div class="impl-step-order">${idx + 1}</div>
			<div class="impl-step-body">
				<div class="impl-step-label">${esc(step.label)} <span class="complexity-badge complexity-${esc(step.estimated_complexity)}">${esc(step.estimated_complexity)}</span></div>
				<div class="impl-step-desc">${esc(step.description)}</div>
				<div>${compBadges}</div>
				${step.dependencies.length ? `<div style="font-size:11px;opacity:0.7;">Depends on: ${depBadges}</div>` : ''}
				${step.verification_method ? `<div style="font-size:11px;opacity:0.7;">Verification: ${esc(step.verification_method)}</div>` : ''}
			</div>
		</div>`;
	}).join('');
}

// ── CROSSWALK (Traceability Matrix) ──

export function renderCrosswalk(doc: ArchitectureDocument): string {
	const { capabilities, workflow_graph, components } = doc;

	const rows: string[] = [];
	for (const cap of capabilities) {
		const wfs = workflow_graph.filter(w => w.capability_id === cap.capability_id);
		for (const wf of wfs) {
			const servingComps = components.filter(c => c.workflows_served.includes(wf.workflow_id));
			rows.push(`<tr>
				<td>${esc(cap.label)}</td>
				<td>${esc(wf.label)}</td>
				<td>${servingComps.map(c => esc(c.label)).join(', ') || '<em>none</em>'}</td>
			</tr>`);
		}
		if (wfs.length === 0) {
			rows.push(`<tr>
				<td>${esc(cap.label)}</td>
				<td><em>no workflows</em></td>
				<td>-</td>
			</tr>`);
		}
	}

	return `<table class="crosswalk-table">
		<thead><tr><th>Capability</th><th>Workflow</th><th>Implementing Components</th></tr></thead>
		<tbody>${rows.join('')}</tbody>
	</table>`;
}

// ── VALIDATION FINDINGS ──

export function renderValidationFindings(findings: string[]): string {
	if (!findings.length) { return '<p style="color:var(--concern-low);">No validation findings.</p>'; }
	return findings.map(f => `<div class="validation-finding">${esc(f)}</div>`).join('');
}

// ── CONCERN MAP TYPE ──

export interface Concern {
	severity: string;
	summary: string;
	detail?: string;
	nodeId?: string;
}

export type ConcernMap = Map<string, Concern[]>;

/**
 * Parse reasoning review JSON strings into a map of node ID → concerns.
 * Tries to match concern text to component/capability IDs.
 */
export function buildConcernMap(reviewJsonStrings: string[], doc: ArchitectureDocument): ConcernMap {
	const map: ConcernMap = new Map();
	const allIds = [
		...doc.capabilities.map(c => c.capability_id),
		...doc.components.map(c => c.component_id),
		...doc.workflow_graph.map(w => w.workflow_id),
	];

	for (const json of reviewJsonStrings) {
		try {
			const review = JSON.parse(json);
			const concerns: Array<{ severity: string; summary: string; detail?: string }> = review.concerns ?? [];
			for (const c of concerns) {
				// Try to find which node this concern references
				const text = `${c.summary} ${c.detail ?? ''}`;
				let matched = false;
				for (const id of allIds) {
					if (text.includes(id)) {
						const list = map.get(id) ?? [];
						list.push({ severity: c.severity, summary: c.summary, detail: c.detail, nodeId: id });
						map.set(id, list);
						matched = true;
					}
				}
				// If no specific node matched, attach to a generic key
				if (!matched) {
					const list = map.get('__general__') ?? [];
					list.push({ severity: c.severity, summary: c.summary, detail: c.detail });
					map.set('__general__', list);
				}
			}
		} catch {
			// Skip malformed review JSON
		}
	}
	return map;
}
