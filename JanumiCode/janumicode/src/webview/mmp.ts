/**
 * Mirror & Menu Protocol (MMP) webview handlers.
 * Manages user interactions with Mirror, Menu, and Pre-Mortem cards
 * and submits structured decisions to the extension host.
 */

import { vscode } from './types';
import { state, persistMmpState } from './state';

// ===== Scoped Query Helper =====

/**
 * Find the MMP card container by cardId, then query within it.
 * This ensures we find elements in the CORRECT card when multiple
 * MMP cards exist in the DOM (e.g., Domains card + Journeys card).
 */
function scopedQuery(cardId: string, selector: string): HTMLElement | null {
	const container = document.querySelector('[data-mmp-card-id="' + cardId + '"]');
	if (!container) {return null;}
	return container.querySelector(selector) as HTMLElement | null;
}

function scopedQueryAll(cardId: string, selector: string): NodeListOf<Element> {
	const container = document.querySelector('[data-mmp-card-id="' + cardId + '"]');
	if (!container) {return document.querySelectorAll('.nonexistent-guard');}
	return container.querySelectorAll(selector);
}

// ===== Mirror Handlers =====

/**
 * Handle accept/reject toggle on a Mirror item.
 */
export function handleMirrorDecision(
	mirrorId: string,
	cardId: string,
	decision: 'accepted' | 'rejected' | 'deferred',
): void {
	const key = cardId + ':' + mirrorId;
	const current = state.mmpMirrorDecisions[key];

	console.log('[MMP:Mirror] Decision:', { mirrorId, cardId, decision, key, wasPrevious: current?.status ?? 'none' });

	// Toggle off if already in this state
	if (current && current.status === decision) {
		delete state.mmpMirrorDecisions[key];
		console.log('[MMP:Mirror] Toggled OFF:', key);
	} else {
		state.mmpMirrorDecisions[key] = { status: decision };
		console.log('[MMP:Mirror] Set:', key, '=', decision);
	}

	console.log('[MMP:Mirror] All mirror keys:', Object.keys(state.mmpMirrorDecisions));

	// Update UI — scoped to the correct card container
	const item = scopedQuery(cardId, '[data-mmp-mirror-id="' + mirrorId + '"]');
	if (item) {
		item.classList.remove('accepted', 'rejected', 'deferred', 'edited');
		const stored = state.mmpMirrorDecisions[key];
		if (stored) {
			item.classList.add(stored.status);
		}
		// Update button selected states
		updateMirrorButtonStates(item, cardId, mirrorId);
		// Hide edit area when accepting/rejecting/deferring
		const editArea = item.querySelector('.mmp-mirror-item-edit-area') as HTMLElement | null;
		if (editArea) { editArea.classList.remove('visible'); }
	}

	updateMMPProgress(cardId);
	persistMmpState(cardId);
}

/**
 * Toggle the edit mode for a Mirror item.
 */
export function handleMirrorEdit(mirrorId: string, cardId: string): void {
	const key = cardId + ':' + mirrorId;
	const item = scopedQuery(cardId, '[data-mmp-mirror-id="' + mirrorId + '"]');
	if (!item) { return; }

	const editArea = item.querySelector('.mmp-mirror-item-edit-area') as HTMLElement | null;
	if (!editArea) { return; }

	const isVisible = editArea.classList.contains('visible');
	if (isVisible) {
		editArea.classList.remove('visible');
		// If there was edited text, store it
		const textarea = editArea.querySelector('textarea') as HTMLTextAreaElement | null;
		if (textarea && textarea.value.trim()) {
			state.mmpMirrorDecisions[key] = {
				status: 'edited',
				editedText: textarea.value.trim(),
			};
			item.classList.remove('accepted', 'rejected');
			item.classList.add('edited');
		}
	} else {
		editArea.classList.add('visible');
		const textarea = editArea.querySelector('textarea') as HTMLTextAreaElement | null;
		if (textarea) { textarea.focus(); }
	}

	updateMirrorButtonStates(item, cardId, mirrorId);
	updateMMPProgress(cardId);
	persistMmpState(cardId);
}

/**
 * Toggle rationale visibility for a Mirror item.
 */
export function handleMirrorRationale(mirrorId: string, cardId: string): void {
	const key = cardId + ':' + mirrorId;
	const rationale = document.getElementById('rationale-' + key) as HTMLElement | null;
	if (rationale) {
		rationale.classList.toggle('visible');
	}
}

function updateMirrorButtonStates(item: HTMLElement, cardId: string, mirrorId: string): void {
	const key = cardId + ':' + mirrorId;
	const stored = state.mmpMirrorDecisions[key];
	const btns = item.querySelectorAll('.mmp-btn');
	btns.forEach((btn) => {
		btn.classList.remove('selected');
		const el = btn as HTMLElement;
		if (stored) {
			if (stored.status === 'accepted' && el.dataset.action === 'mirror-accept') {
				btn.classList.add('selected');
			}
			if (stored.status === 'rejected' && el.dataset.action === 'mirror-reject') {
				btn.classList.add('selected');
			}
			if (stored.status === 'deferred' && el.dataset.action === 'mirror-defer') {
				btn.classList.add('selected');
			}
			if (stored.status === 'edited' && el.dataset.action === 'mirror-edit') {
				btn.classList.add('selected');
			}
		}
	});
}

// ===== Menu Handlers =====

/**
 * Handle selection of a Menu option.
 */
export function handleMenuSelect(menuId: string, optionId: string, cardId: string): void {
	const key = cardId + ':' + menuId;

	// Toggle off if same option clicked
	const current = state.mmpMenuSelections[key];
	if (current && current.selectedOptionId === optionId) {
		delete state.mmpMenuSelections[key];
	} else {
		state.mmpMenuSelections[key] = { selectedOptionId: optionId };
	}

	// Update UI — scoped to the correct card container
	const allOptions = scopedQueryAll(cardId,
		'.mmp-option-card[data-mmp-menu-id="' + menuId + '"]'
	);
	const stored = state.mmpMenuSelections[key];
	allOptions.forEach((opt) => {
		const el = opt as HTMLElement;
		if (stored && el.dataset.mmpOptionId === stored.selectedOptionId) {
			el.classList.add('selected');
		} else {
			el.classList.remove('selected');
		}
	});

	updateMMPProgress(cardId);
	persistMmpState(cardId);
}

/**
 * Handle custom text input for a Menu "Other" option.
 */
export function handleMenuCustomInput(menuId: string, cardId: string, text: string): void {
	const key = cardId + ':' + menuId;
	const current = state.mmpMenuSelections[key];
	if (current) {
		current.customResponse = text;
	}
}

// ===== Pre-Mortem Handlers =====

/**
 * Handle accept/reject toggle on a Pre-Mortem item.
 */
export function handlePreMortemDecision(
	riskId: string,
	cardId: string,
	decision: 'accepted' | 'rejected' | 'deferred',
): void {
	const key = cardId + ':' + riskId;
	const current = state.mmpPreMortemDecisions[key];

	// Toggle off if already in this state
	if (current && current.status === decision) {
		delete state.mmpPreMortemDecisions[key];
	} else {
		state.mmpPreMortemDecisions[key] = { status: decision };
	}

	// Update UI — scoped to correct card container
	const item = scopedQuery(cardId, '[data-mmp-premortem-id="' + riskId + '"]');
	if (item) {
		item.classList.remove('accepted', 'rejected', 'deferred');
		const stored = state.mmpPreMortemDecisions[key];
		if (stored) {
			item.classList.add(stored.status);
		}

		// Find buttons within the card container (buttons may be siblings in some renderings)
		const btns = scopedQueryAll(cardId,
			'.mmp-btn[data-mmp-item="' + riskId + '"]'
		);
		btns.forEach((btn) => {
			btn.classList.remove('selected');
			const el = btn as HTMLElement;
			if (stored) {
				if (stored.status === 'accepted' && el.dataset.action === 'premortem-accept') {
					btn.classList.add('selected');
				}
				if (stored.status === 'rejected' && el.dataset.action === 'premortem-reject') {
					btn.classList.add('selected');
				}
				if (stored.status === 'deferred' && el.dataset.action === 'premortem-defer') {
					btn.classList.add('selected');
				}
			}
		});
		// Show rationale area for rejected items
		const rationaleArea = item.querySelector('.mmp-premortem-rationale-area') as HTMLElement | null;
		if (rationaleArea) {
			if (stored && stored.status === 'rejected') {
				rationaleArea.classList.add('visible');
				const textarea = rationaleArea.querySelector('textarea') as HTMLTextAreaElement | null;
				if (textarea) { textarea.focus(); }
			} else {
				rationaleArea.classList.remove('visible');
			}
		}
	}

	updateMMPProgress(cardId);
	persistMmpState(cardId);
}

/**
 * Handle rationale text input for a rejected Pre-Mortem item.
 */
export function handlePreMortemRationale(riskId: string, cardId: string, text: string): void {
	const key = cardId + ':' + riskId;
	const current = state.mmpPreMortemDecisions[key];
	if (current) {
		current.rationale = text;
	}
}

// ===== Bulk Action Handlers =====

/**
 * Apply a bulk action to all Mirror items in a card.
 */
export function handleBulkMirrorAction(
	cardId: string,
	action: 'accept' | 'reject' | 'defer',
): void {
	const decision = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'deferred';
	const items = scopedQueryAll(cardId, '.mmp-mirror-item');
	console.log('[MMP:Bulk] Mirror', action, 'all for card:', cardId, '| items:', items.length);

	items.forEach((el) => {
		const item = el as HTMLElement;
		const mirrorId = item.dataset.mmpMirrorId;
		if (!mirrorId) { return; }
		handleMirrorDecision(mirrorId, cardId, decision);
	});
}

/**
 * Apply a bulk action to all Pre-Mortem items in a card.
 */
export function handleBulkPreMortemAction(
	cardId: string,
	action: 'accept' | 'reject',
): void {
	const decision = action === 'accept' ? 'accepted' : 'rejected';
	const items = scopedQueryAll(cardId, '.mmp-premortem-item');
	console.log('[MMP:Bulk] PreMortem', action, 'all for card:', cardId, '| items:', items.length);

	items.forEach((el) => {
		const item = el as HTMLElement;
		const riskId = item.dataset.mmpPremortemId;
		if (!riskId) { return; }
		handlePreMortemDecision(riskId, cardId, decision);
	});
}

// ===== Submit Handler =====

/**
 * Submit all MMP decisions to the extension host.
 * Collects mirror, menu, and pre-mortem decisions from state.
 */
export function handleMMPSubmit(cardId: string): void {
	// Collect decisions for this card, enriched with text content from the DOM
	const mirrorDecisions: Record<string, { status: string; editedText?: string; text?: string }> = {};
	const menuSelections: Record<string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }> = {};
	const preMortemDecisions: Record<string, { status: string; rationale?: string; assumption?: string }> = {};

	const prefix = cardId + ':';
	for (const [key, val] of Object.entries(state.mmpMirrorDecisions)) {
		if (key.startsWith(prefix)) {
			mirrorDecisions[key.substring(prefix.length)] = { ...val };
		}
	}
	for (const [key, val] of Object.entries(state.mmpMenuSelections)) {
		if (key.startsWith(prefix)) {
			menuSelections[key.substring(prefix.length)] = { ...val };
		}
	}
	for (const [key, val] of Object.entries(state.mmpPreMortemDecisions)) {
		if (key.startsWith(prefix)) {
			preMortemDecisions[key.substring(prefix.length)] = { ...val };
		}
	}

	// Enrich mirror decisions with the assumption text from the DOM — scoped to card
	scopedQueryAll(cardId, '.mmp-mirror-item').forEach((el) => {
		const item = el as HTMLElement;
		const id = item.dataset.mmpMirrorId;
		if (id && mirrorDecisions[id]) {
			const textEl = item.querySelector('.mmp-mirror-item-text');
			if (textEl) { mirrorDecisions[id].text = textEl.textContent || ''; }
		}
	});

	// Enrich menu selections with the question text and selected option label — scoped to card
	scopedQueryAll(cardId, '.mmp-menu-item').forEach((menuItem) => {
		const firstOption = menuItem.querySelector('.mmp-option-card') as HTMLElement | null;
		if (!firstOption) { return; }
		const menuId = firstOption.dataset.mmpMenuId;
		if (!menuId || !menuSelections[menuId]) { return; }

		const questionEl = menuItem.querySelector('.mmp-menu-question');
		if (questionEl) { menuSelections[menuId].question = questionEl.textContent || ''; }

		// Find the selected option's label
		const selectedOptId = menuSelections[menuId].selectedOptionId;
		if (selectedOptId && selectedOptId !== 'OTHER') {
			const selectedCard = menuItem.querySelector(
				'.mmp-option-card[data-mmp-option-id="' + selectedOptId + '"]'
			);
			if (selectedCard) {
				const labelEl = selectedCard.querySelector('.mmp-option-label');
				if (labelEl) { menuSelections[menuId].selectedLabel = labelEl.textContent || ''; }
			}
		}
	});

	// Enrich pre-mortem decisions with the assumption text — scoped to card
	scopedQueryAll(cardId, '.mmp-premortem-item').forEach((el) => {
		const item = el as HTMLElement;
		const id = item.dataset.mmpPremortemId;
		if (id && preMortemDecisions[id]) {
			const textEl = item.querySelector('.mmp-premortem-assumption');
			if (textEl) { preMortemDecisions[id].assumption = textEl.textContent || ''; }
		}
	});

	// Detect MMP context from DOM attributes (review gate vs INTAKE)
	const mmpContainer = document.querySelector('[data-mmp-card-id="' + cardId + '"]');
	const mmpContext = (mmpContainer as HTMLElement | null)?.dataset.mmpContext || '';
	const mmpGateId = (mmpContainer as HTMLElement | null)?.dataset.mmpGateId || '';

	if (mmpContext === 'review' && mmpGateId) {
		// Route to review gate handler
		vscode.postMessage({
			type: 'reviewMmpDecision',
			gateId: mmpGateId,
			cardId,
			mirrorDecisions,
			menuSelections,
			preMortemDecisions,
		});
	} else {
		// Collect inline product discovery edits (vision/description textareas)
		const productEdits: Record<string, string> = {};
		const pdCard = mmpContainer?.closest('.intake-product-discovery-card');
		if (pdCard) {
			pdCard.querySelectorAll<HTMLTextAreaElement>('[data-pd-edit-field]').forEach((ta) => {
				const field = ta.dataset.pdEditField;
				const val = ta.value.trim();
				if (field && val) {
					productEdits[field] = val;
				}
			});
		}

		// Original INTAKE routing
		vscode.postMessage({
			type: 'mmpSubmit',
			cardId,
			mirrorDecisions,
			menuSelections,
			preMortemDecisions,
			productEdits: Object.keys(productEdits).length > 0 ? productEdits : undefined,
		});
	}

	// Freeze the UI — disable all buttons, show submitted state
	const container = mmpContainer;
	if (container) {
		container.querySelectorAll('button').forEach((btn) => {
			btn.disabled = true;
		});
		container.querySelectorAll('textarea').forEach((ta) => {
			ta.readOnly = true;
			ta.style.opacity = '0.7';
		});
		container.querySelectorAll('.mmp-option-card').forEach((card) => {
			(card as HTMLElement).style.pointerEvents = 'none';
		});
	}
	// Also freeze product discovery inline edit textareas (outside MMP container)
	const pdCardForFreeze = mmpContainer?.closest('.intake-product-discovery-card');
	if (pdCardForFreeze) {
		pdCardForFreeze.querySelectorAll<HTMLTextAreaElement>('.pd-inline-edit-area').forEach((ta) => {
			ta.readOnly = true;
			ta.style.opacity = '0.7';
		});
	}
	const submitBar = document.querySelector('[data-mmp-submit-bar="' + cardId + '"]') as HTMLElement | null;
	if (submitBar) {
		submitBar.classList.add('submitted');
		const btn = submitBar.querySelector('.mmp-submit-btn') as HTMLButtonElement | null;
		if (btn) {
			btn.textContent = 'Decisions Submitted';
			btn.disabled = true;
		}
	}

	// Clean up submitted card's keys from state to prevent accumulation
	for (const key of Object.keys(state.mmpMirrorDecisions)) {
		if (key.startsWith(prefix)) { delete state.mmpMirrorDecisions[key]; }
	}
	for (const key of Object.keys(state.mmpMenuSelections)) {
		if (key.startsWith(prefix)) { delete state.mmpMenuSelections[key]; }
	}
	for (const key of Object.keys(state.mmpPreMortemDecisions)) {
		if (key.startsWith(prefix)) { delete state.mmpPreMortemDecisions[key]; }
	}
	console.log('[MMP:Submit] Cleaned state for card:', cardId, '| remaining mirror keys:', Object.keys(state.mmpMirrorDecisions).length);
	persistMmpState();
}

// ===== Progress Tracking =====

/**
 * Update the progress indicator in the submit bar.
 */
function updateMMPProgress(cardId: string): void {
	const progressEl = document.querySelector('[data-mmp-progress="' + cardId + '"]') as HTMLElement | null;
	if (!progressEl) {
		console.warn('[MMP:Progress] No progress element for cardId:', cardId);
		return;
	}

	const prefix = cardId + ':';

	// Count mirror items and decisions — scoped to card
	const mirrorItems = scopedQueryAll(cardId, '.mmp-mirror-item');
	const mirrorTotal = mirrorItems.length;
	let mirrorDone = 0;
	const mirrorDebug: string[] = [];
	mirrorItems.forEach((item) => {
		const el = item as HTMLElement;
		const id = el.dataset.mmpMirrorId;
		const stateKey = prefix + id;
		const hasDecision = !!(id && state.mmpMirrorDecisions[stateKey]);
		mirrorDebug.push(id + '=' + (hasDecision ? state.mmpMirrorDecisions[stateKey]?.status : 'none'));
		if (hasDecision) { mirrorDone++; }
	});

	// Count menu items and selections — scoped to card
	const menuItems = scopedQueryAll(cardId, '.mmp-option-card[data-mmp-menu-id]');
	const menuIds = new Set<string>();
	menuItems.forEach((el) => {
		const menuId = (el as HTMLElement).dataset.mmpMenuId;
		if (menuId) { menuIds.add(menuId); }
	});
	const menuTotal = menuIds.size;
	let menuDone = 0;
	menuIds.forEach((id) => {
		if (state.mmpMenuSelections[prefix + id]) { menuDone++; }
	});

	// Count pre-mortem items and decisions — scoped to card
	const pmItems = scopedQueryAll(cardId, '.mmp-premortem-item');
	const pmTotal = pmItems.length;
	let pmDone = 0;
	pmItems.forEach((item) => {
		const el = item as HTMLElement;
		const id = el.dataset.mmpPremortemId;
		if (id && state.mmpPreMortemDecisions[prefix + id]) { pmDone++; }
	});

	console.log('[MMP:Progress] cardId:', cardId, '| mirror:', mirrorDone + '/' + mirrorTotal,
		'| menu:', menuDone + '/' + menuTotal, '| pm:', pmDone + '/' + pmTotal);
	console.log('[MMP:Progress] Mirror details:', mirrorDebug);
	console.log('[MMP:Progress] DOM container found:', !!document.querySelector('[data-mmp-card-id="' + cardId + '"]'));
	console.log('[MMP:Progress] State keys (mirror):', Object.keys(state.mmpMirrorDecisions).filter(k => k.startsWith(prefix)));
	console.log('[MMP:Progress] State keys (ALL mirror):', Object.keys(state.mmpMirrorDecisions));

	const parts: string[] = [];
	if (mirrorTotal > 0) {
		const cls = mirrorDone === mirrorTotal ? ' class="complete"' : '';
		parts.push('<span' + cls + '>Mirror: ' + mirrorDone + '/' + mirrorTotal + '</span>');
	}
	if (menuTotal > 0) {
		const cls = menuDone === menuTotal ? ' class="complete"' : '';
		parts.push('<span' + cls + '>Menu: ' + menuDone + '/' + menuTotal + '</span>');
	}
	if (pmTotal > 0) {
		const cls = pmDone === pmTotal ? ' class="complete"' : '';
		parts.push('<span' + cls + '>Risks: ' + pmDone + '/' + pmTotal + '</span>');
	}

	progressEl.innerHTML = parts.join(' &middot; ');
}

// ===== Pending MMP Restoration =====

interface PendingDecisionSet {
	mirrorDecisions: Record<string, { status: string; editedText?: string }>;
	menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>;
	preMortemDecisions: Record<string, { status: string; rationale?: string }>;
	productEdits: Record<string, string>;
}

/**
 * Apply pending MMP decisions loaded from SQLite (survives VS Code restarts).
 * Populates state and updates DOM classes/button states.
 */
export function applyPendingMmpDecisions(
	decisions: Record<string, PendingDecisionSet>
): void {
	console.log('[MMP:Restore] applyPendingMmpDecisions called with cards:', Object.keys(decisions));

	// Collect all cardIds currently in the DOM
	const domCardIds = new Set<string>();
	document.querySelectorAll('[data-mmp-card-id]').forEach((el) => {
		const id = (el as HTMLElement).dataset.mmpCardId;
		if (id) { domCardIds.add(id); }
	});

	// Only merge keys whose cardId matches a DOM container
	let restored = 0, skipped = 0;
	for (const [cardId, pending] of Object.entries(decisions)) {
		if (!domCardIds.has(cardId)) {
			console.log('[MMP:Restore] Skipping card (not in DOM):', cardId);
			skipped++;
			continue;
		}
		console.log('[MMP:Restore] Restoring card:', cardId, '| mirror:', Object.keys(pending.mirrorDecisions ?? {}).length,
			'| menu:', Object.keys(pending.menuSelections ?? {}).length,
			'| pm:', Object.keys(pending.preMortemDecisions ?? {}).length);
		if (pending.mirrorDecisions) {
			Object.assign(state.mmpMirrorDecisions, pending.mirrorDecisions);
		}
		if (pending.menuSelections) {
			Object.assign(state.mmpMenuSelections, pending.menuSelections);
		}
		if (pending.preMortemDecisions) {
			Object.assign(state.mmpPreMortemDecisions, pending.preMortemDecisions);
		}
		restored++;
	}

	console.log('[MMP:Restore] Restored', restored, 'cards, skipped', skipped);
	console.log('[MMP:Restore] After merge — mirror:', Object.keys(state.mmpMirrorDecisions).length,
		'| menu:', Object.keys(state.mmpMenuSelections).length,
		'| pm:', Object.keys(state.mmpPreMortemDecisions).length);

	// Also save to webview state for in-session persistence
	persistMmpState();

	// Apply to DOM
	applyMmpStateToDom();
}

/**
 * Apply the current MMP state to DOM elements — add CSS classes and button states.
 * Called after restoring from either webview state or SQLite.
 * Uses scoped queries to find elements in the correct card container.
 */
export function applyMmpStateToDom(): void {
	console.log('[MMP:ApplyDOM] Starting. Mirror entries:', Object.keys(state.mmpMirrorDecisions).length,
		'| Menu entries:', Object.keys(state.mmpMenuSelections).length,
		'| PM entries:', Object.keys(state.mmpPreMortemDecisions).length);

	for (const [key, val] of Object.entries(state.mmpMirrorDecisions)) {
		const parts = key.split(':');
		const cardId = parts[0];
		const mirrorId = parts.slice(1).join(':');
		console.log('[MMP:ApplyDOM] Mirror key:', key, '→ cardId:', cardId, ', mirrorId:', mirrorId, ', status:', val.status);
		const item = scopedQuery(cardId, '[data-mmp-mirror-id="' + mirrorId + '"]');
		if (item) {
			item.classList.remove('accepted', 'rejected', 'deferred', 'edited');
			item.classList.add(val.status);
			item.querySelectorAll('.mmp-btn').forEach((btn) => {
				const el = btn as HTMLElement;
				btn.classList.remove('selected');
				if ((val.status === 'accepted' && el.dataset.action === 'mirror-accept')
					|| (val.status === 'rejected' && el.dataset.action === 'mirror-reject')
					|| (val.status === 'deferred' && el.dataset.action === 'mirror-defer')
					|| (val.status === 'edited' && el.dataset.action === 'mirror-edit')) {
					btn.classList.add('selected');
				}
			});
		}
	}
	for (const [key, val] of Object.entries(state.mmpMenuSelections)) {
		const parts = key.split(':');
		const cardId = parts[0];
		const menuId = parts.slice(1).join(':');
		scopedQueryAll(cardId, '.mmp-option-card[data-mmp-menu-id="' + menuId + '"]').forEach((opt) => {
			const el = opt as HTMLElement;
			if (el.dataset.mmpOptionId === val.selectedOptionId) {
				el.classList.add('selected');
			}
		});
	}
	for (const [key, val] of Object.entries(state.mmpPreMortemDecisions)) {
		const parts = key.split(':');
		const cardId = parts[0];
		const riskId = parts.slice(1).join(':');
		const item = scopedQuery(cardId, '[data-mmp-premortem-id="' + riskId + '"]');
		if (item) {
			item.classList.remove('accepted', 'rejected', 'deferred');
			item.classList.add(val.status);
			item.querySelectorAll('.mmp-btn').forEach((btn) => {
				btn.classList.remove('selected');
				const el = btn as HTMLElement;
				if ((val.status === 'accepted' && el.dataset.action === 'premortem-accept')
					|| (val.status === 'rejected' && el.dataset.action === 'premortem-reject')
					|| (val.status === 'deferred' && el.dataset.action === 'premortem-defer')) {
					btn.classList.add('selected');
				}
			});
		}
	}

	// Update progress bars for all cards that have restored state
	const cardIds = new Set<string>();
	for (const key of Object.keys(state.mmpMirrorDecisions)) { cardIds.add(key.split(':')[0]); }
	for (const key of Object.keys(state.mmpMenuSelections)) { cardIds.add(key.split(':')[0]); }
	for (const key of Object.keys(state.mmpPreMortemDecisions)) { cardIds.add(key.split(':')[0]); }
	for (const cid of cardIds) { updateMMPProgress(cid); }
}
