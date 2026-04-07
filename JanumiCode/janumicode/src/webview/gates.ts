/**
 * Gate decision handlers for the Governed Stream webview.
 * Handles generic gates, verification gates, and review gates.
 */

import { vscode } from './types';
import { state, persistDrafts } from './state';

// ===== Generic Gate =====

export function handleRationaleInput(gateId: string, text: string): void {
	state.gateRationales[gateId] = text;
	persistDrafts();
	const charCount = document.getElementById('charcount-' + gateId);
	if (charCount) {
		charCount.textContent = text.length + ' / 10 min';
	}

	const gateCard = document.querySelector('[data-gate-id="' + gateId + '"]');
	if (gateCard) {
		gateCard.querySelectorAll('.gate-btn').forEach(function (btn) {
			(btn as HTMLButtonElement).disabled = text.length < 10;
		});
	}
}

export function submitGateDecision(gateId: string, action: string): void {
	const rationale = state.gateRationales[gateId] || '';
	if (rationale.length < 10) {
		return;
	}
	vscode.postMessage({
		type: 'gateDecision',
		gateId: gateId,
		action: action,
		rationale: rationale,
	});
	// Don't clear draft yet — wait for host ack (handleGateDecisionAccepted)
}

/** Host accepted the gate decision — clear draft and freeze UI. */
export function handleGateDecisionAccepted(gateId: string): void {
	delete state.gateRationales[gateId];
	vscode.postMessage({ type: 'draftClear', category: 'gate_rationale' });
}

/** Host rejected the gate decision — show error. */
export function handleGateDecisionRejected(gateId: string, reason: string): void {
	console.warn('[Gate:Rejected]', gateId, reason);
}

// ===== Verification Gate =====

export function handleClaimRationaleInput(claimId: string, text: string): void {
	state.verificationClaimRationales[claimId] = text;
	persistDrafts();
	const charCount = document.getElementById('vg-charcount-' + claimId);
	if (charCount) {
		charCount.textContent = text.length + ' / 10 min';
	}
	updateAcceptRisksButton();
}

export function updateAcceptRisksButton(): void {
	const acceptBtn = document.querySelector('.verification-btn.accept-risks') as HTMLButtonElement | null;
	if (!acceptBtn) { return; }
	const blockingCount = parseInt(acceptBtn.dataset.blockingCount || '0', 10);
	if (blockingCount === 0) {
		acceptBtn.disabled = false;
		return;
	}
	// Find all blocking claim textareas
	const textareas = document.querySelectorAll('.verification-claim-response textarea[data-claim-rationale]');
	let allHaveRationale = true;
	textareas.forEach(function (ta) {
		const claimId = (ta as HTMLTextAreaElement).dataset.claimRationale;
		const text = state.verificationClaimRationales[claimId || ''] || '';
		if (text.length < 10) {
			allHaveRationale = false;
		}
	});
	acceptBtn.disabled = !allHaveRationale;
}

export function handleVerificationGateDecision(gateId: string, action: string): void {
	if (action === 'OVERRIDE') {
		vscode.postMessage({
			type: 'verificationGateDecision',
			gateId: gateId,
			action: 'OVERRIDE',
			claimRationales: state.verificationClaimRationales,
		});
	} else {
		vscode.postMessage({
			type: 'verificationGateDecision',
			gateId: gateId,
			action: action,
		});
	}
}

// ===== Review Gate =====

export function handleReviewItemRationaleInput(itemKey: string, text: string): void {
	state.reviewItemRationales[itemKey] = text;
	persistDrafts();
	const charCount = document.getElementById('review-charcount-' + itemKey);
	if (charCount) {
		charCount.textContent = text.length + ' / 10 min';
	}
	updateReviewApproveButton();
}

export function handleReviewOverallInput(gateId: string, text: string): void {
	state.reviewOverallRationale = text;
	persistDrafts();
	const charCount = document.getElementById('review-overall-charcount-' + gateId);
	if (charCount) {
		charCount.textContent = text.length + ' characters';
	}
	updateReviewApproveButton();
}

export function updateReviewApproveButton(): void {
	const approveBtn = document.querySelector('.review-actions:not(.resolved) .review-btn.approve-execute') as HTMLButtonElement | null;
	if (!approveBtn) { return; }
	const disabledTip = 'Provide overall feedback or respond to at least one item above (min 10 characters) to enable this button.';
	const enabledTip = 'Accept all findings and proceed to execution.';
	const needsCount = parseInt(approveBtn.dataset.needsDecisionCount || '0', 10);
	if (needsCount === 0) {
		approveBtn.disabled = false;
		approveBtn.title = enabledTip;
		return;
	}
	let enabled = false;
	if (state.reviewOverallRationale.length >= 10) {
		enabled = true;
	} else {
		const textareas = document.querySelectorAll('.review-item-response textarea[data-review-item-rationale]');
		textareas.forEach(function (ta) {
			const key = (ta as HTMLTextAreaElement).dataset.reviewItemRationale;
			const text = state.reviewItemRationales[key || ''] || '';
			if (text.length >= 10) {
				enabled = true;
			}
		});
	}
	approveBtn.disabled = !enabled;
	approveBtn.title = enabled ? enabledTip : disabledTip;
}

export function handleReviewGateDecision(gateId: string, action: string): void {
	if (action === 'APPROVE') {
		vscode.postMessage({
			type: 'reviewGateDecision',
			gateId: gateId,
			action: 'APPROVE',
			itemRationales: state.reviewItemRationales,
			overallFeedback: state.reviewOverallRationale,
		});
	} else {
		vscode.postMessage({
			type: 'reviewGateDecision',
			gateId: gateId,
			action: action,
			overallFeedback: state.reviewOverallRationale,
		});
	}
}
