/**
 * Webview renderer for Deep Validation Review stream items.
 *
 * Renders:
 *   - renderValidationFindingCard()  — individual finding with severity badge,
 *       proof artifact, tool badge, and 👍/👎 feedback buttons
 *   - renderValidationSummaryCard()  — overview totals
 */

import { esc } from './utils';
import type { StreamItem } from './streamTypes';

// ==================== Finding Card ====================

type ValidationFindingItem = Extract<StreamItem, { type: 'validation_finding' }>;
type ValidationSummaryItem = Extract<StreamItem, { type: 'validation_summary' }>;

const SEVERITY_BADGE: Record<string, string> = {
	critical: 'var(--vscode-charts-red)',
	high: 'var(--vscode-charts-orange)',
	medium: 'var(--vscode-charts-yellow)',
	low: 'var(--vscode-charts-blue)',
};

const TOOL_LABEL: Record<string, string> = {
	llm_only: 'LLM',
	dafny: 'Dafny',
	z3: 'z3',
	micro_fuzz: 'Fuzz',
	sandbox_poc: 'PoC',
};

const PROOF_STATUS_LABEL: Record<string, string> = {
	proven: '✓ proven',
	probable: '~ probable',
	disproven: '✗ disproven',
	error: '⚠ error',
};

function severityColor(severity: string): string {
	return SEVERITY_BADGE[severity.toLowerCase()] ?? 'var(--vscode-descriptionForeground)';
}

export function renderValidationFindingCard(item: ValidationFindingItem): string {
	const color = severityColor(item.severity);
	const toolLabel = TOOL_LABEL[item.tool_used] ?? item.tool_used;
	const proofLabel = PROOF_STATUS_LABEL[item.proof_status] ?? item.proof_status;
	const confidencePct = Math.round(item.confidence * 100);

	const proofArtifactHtml = item.proof_artifact
		? `<details class="val-artifact">
			<summary>Proof artifact</summary>
			<pre class="val-artifact-pre"><code>${esc(item.proof_artifact.slice(0, 2000))}</code></pre>
		</details>`
		: '';

	const locationHtml = item.location
		? `<div class="val-location">${esc(item.location)}</div>`
		: '';

	const usefulHtml = renderUsefulButtons(item.findingId, item.useful_rating);

	return `<div class="stream-card val-finding-card" data-finding-id="${esc(item.findingId)}">
	<div class="val-finding-header">
		<span class="val-severity-badge" style="background:${color};">${esc(item.severity.toUpperCase())}</span>
		<span class="val-category-badge">${esc(item.category)}</span>
		<span class="val-tool-badge">${esc(toolLabel)}</span>
		<span class="val-proof-status">${esc(proofLabel)}</span>
		<span class="val-confidence">${confidencePct}%</span>
	</div>
	<div class="val-finding-text">${esc(item.hypothesis)}</div>
	${locationHtml}
	${proofArtifactHtml}
	<div class="val-feedback-row">
		${usefulHtml}
	</div>
</div>`;
}

function renderUsefulButtons(findingId: string, usefulRating: number | null): string {
	const thumbsUpActive = usefulRating === 1 ? ' val-thumb-active' : '';
	const thumbsDownActive = usefulRating === 0 ? ' val-thumb-active' : '';

	return `<button class="val-thumb-btn${thumbsUpActive}"
		data-action="validation-feedback"
		data-finding-id="${esc(findingId)}"
		data-useful="true"
		title="Useful">👍</button>
	<button class="val-thumb-btn${thumbsDownActive}"
		data-action="validation-feedback"
		data-finding-id="${esc(findingId)}"
		data-useful="false"
		title="Not useful">👎</button>`;
}

// ==================== Summary Card ====================

export function renderValidationSummaryCard(item: ValidationSummaryItem): string {
	const categoryRows = Object.entries(item.categories)
		.sort(([, a], [, b]) => b - a)
		.map(([cat, count]) => `<span class="val-cat-chip">${esc(cat)}: ${count}</span>`)
		.join(' ');

	return `<div class="stream-card val-summary-card">
	<div class="val-summary-header">
		<span class="val-summary-icon">🔍</span>
		<span class="val-summary-title">Validation Complete</span>
	</div>
	<div class="val-summary-stats">
		<span class="val-stat-item"><strong>${item.totalFindings}</strong> finding${item.totalFindings === 1 ? '' : 's'}</span>
		<span class="val-stat-sep">·</span>
		<span class="val-stat-item"><strong>${item.provenCount}</strong> proven</span>
		<span class="val-stat-sep">·</span>
		<span class="val-stat-item"><strong>${item.probableCount}</strong> probable</span>
	</div>
	${categoryRows ? `<div class="val-category-chips">${categoryRows}</div>` : ''}
</div>`;
}
