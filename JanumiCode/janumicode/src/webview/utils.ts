/**
 * Pure utility functions for the Governed Stream webview.
 * No side effects, no state mutation, no DOM writes — just transforms.
 */

import { vscode } from './types';
import { FILE_ICONS } from './state';

// ===== HTML Escaping =====

export function escapeHtmlClient(str: string): string {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

// ===== Verdict Helpers =====

export function getVerdictClass(status: string): string {
	switch (status) {
		case 'VERIFIED': return 'verified';
		case 'DISPROVED': return 'disproved';
		case 'UNKNOWN': return 'unknown';
		case 'CONDITIONAL': return 'conditional';
		default: return 'pending';
	}
}

export function getVerdictIcon(status: string): string {
	switch (status) {
		case 'VERIFIED': return '&#x2705;';
		case 'DISPROVED': return '&#x274C;';
		case 'UNKNOWN': return '&#x2753;';
		case 'CONDITIONAL': return '&#x26A0;';
		default: return '&#x26AA;';
	}
}

// ===== Formatting =====

export function formatTime(isoStr: string): string {
	try {
		// Normalize SQLite datetime format (no T/Z) to ISO 8601 for consistent UTC parsing
		let normalized = isoStr;
		if (isoStr && isoStr.indexOf('T') === -1) {
			normalized = isoStr.replace(' ', 'T') + 'Z';
		}
		const d = new Date(normalized);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	} catch {
		return '';
	}
}

export function formatByteSize(len: number): string {
	if (len < 1024) { return len + ' chars'; }
	const kb = (len / 1024).toFixed(1);
	return kb + ' KB';
}

// ===== Simple Markdown Parser =====

export function simpleMd(text: string): string {
	const s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const lines = s.split('\n');
	const out: string[] = [];
	let listType: '' | 'ul' | 'ol' = '';
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') {
			if (listType) { out.push('</' + listType + '>'); listType = ''; }
			continue;
		}
		const hm = line.match(/^(#{1,4})\s+(.*)$/);
		if (hm) {
			if (listType) { out.push('</' + listType + '>'); listType = ''; }
			out.push('<strong>' + inlineFmt(hm[2]) + '</strong>');
			continue;
		}
		const olm = line.match(/^\s*\d+\.\s+(.*)$/);
		if (olm) {
			if (listType !== 'ol') {
				if (listType) { out.push('</' + listType + '>'); }
				out.push('<ol>'); listType = 'ol';
			}
			out.push('<li>' + inlineFmt(olm[1]) + '</li>');
			continue;
		}
		const lm = line.match(/^\s*[-*]\s+(.*)$/);
		if (lm) {
			if (listType !== 'ul') {
				if (listType) { out.push('</' + listType + '>'); }
				out.push('<ul>'); listType = 'ul';
			}
			out.push('<li>' + inlineFmt(lm[1]) + '</li>');
			continue;
		}
		if (listType) { out.push('</' + listType + '>'); listType = ''; }
		out.push('<p class="md-p">' + inlineFmt(line) + '</p>');
	}
	if (listType) { out.push('</' + listType + '>'); }
	return out.join('');
}

export function inlineFmt(t: string): string {
	return t
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ===== Scroll & Navigation =====

const SCROLL_THRESHOLD = 80; // px from bottom before auto-scroll resumes
let isNearBottom = true;
let scrollBadgeEl: HTMLElement | null = null;

/** Call once at startup to attach the scroll listener and create the badge. */
export function initSmartScroll(): void {
	const streamArea = document.querySelector<HTMLElement>('.stream-area');
	if (!streamArea) { return; }

	streamArea.addEventListener('scroll', function () {
		const distanceFromBottom = streamArea.scrollHeight - streamArea.scrollTop - streamArea.clientHeight;
		const wasNearBottom = isNearBottom;
		isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
		if (isNearBottom && !wasNearBottom) {
			hideScrollBadge();
		}
	});

	const badge = document.createElement('button');
	badge.id = 'scroll-to-bottom-badge';
	badge.className = 'scroll-to-bottom-badge';
	badge.setAttribute('aria-label', 'Scroll to latest content');
	badge.innerHTML = '&#x2193; Latest';
	badge.addEventListener('click', function () { forceScrollToBottom(); });
	document.body.appendChild(badge);
	scrollBadgeEl = badge;
}

function showScrollBadge(): void {
	if (scrollBadgeEl) { scrollBadgeEl.classList.add('visible'); }
}

function hideScrollBadge(): void {
	if (scrollBadgeEl) { scrollBadgeEl.classList.remove('visible'); }
}

/**
 * Smart scroll — only scrolls to bottom if the user is already near the bottom.
 * When suppressed, shows the "↓ Latest" badge instead.
 * Use this for all automated updates (streaming, progress, phase changes).
 */
export function scrollToBottom(): void {
	const streamArea = document.querySelector<HTMLElement>('.stream-area');
	if (!streamArea) { return; }
	if (isNearBottom) {
		streamArea.scrollTop = streamArea.scrollHeight;
	} else {
		showScrollBadge();
	}
}

/**
 * Force scroll to bottom unconditionally — ignores user scroll position.
 * Use this for deliberate navigation: initial page load, user message submit.
 */
export function forceScrollToBottom(): void {
	const streamArea = document.querySelector<HTMLElement>('.stream-area');
	if (streamArea) {
		streamArea.scrollTop = streamArea.scrollHeight;
	}
	isNearBottom = true;
	hideScrollBadge();
}

export function scrollToClaim(claimId: string): void {
	const el = document.querySelector('[data-claim-id="' + claimId + '"]');
	if (el) {
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		(el as HTMLElement).style.outline = '2px solid var(--vscode-focusBorder)';
		setTimeout(function () {
			(el as HTMLElement).style.outline = '';
		}, 2000);
	}
}

export function scrollToClaimsByStatus(status: string): void {
	const badges = document.querySelectorAll('.verdict-badge.' + status.toLowerCase());
	if (badges.length > 0) {
		const parent = badges[0].closest('.claim-item, .rich-card');
		if (parent) {
			parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}
}

export function copySessionId(sessionId: string): void {
	navigator.clipboard.writeText(sessionId).then(function () {
		vscode.postMessage({ type: 'copySessionId', sessionId: sessionId });
	}).catch(function () {
		vscode.postMessage({ type: 'copySessionId', sessionId: sessionId });
	});
}

// ===== File Path Helpers =====

export function getFileIcon(filePath: string): string {
	const ext = (filePath.split('.').pop() || '').toLowerCase();
	return FILE_ICONS[ext] || '&#x1F4C4;';
}

export function getFileName(filePath: string): string {
	return filePath.split(/[/\\]/).pop() || filePath;
}

export function getFileFolder(filePath: string): string {
	const parts = filePath.split(/[/\\]/);
	return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

// ===== Fuzzy Matching =====

export function fuzzyMatch(query: string, text: string): boolean {
	if (!query) { return true; }
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	// Substring match first (fast path)
	if (t.indexOf(q) >= 0) { return true; }
	// Character-by-character fuzzy
	let qi = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) { qi++; }
	}
	return qi === q.length;
}

export function fuzzyScore(query: string, text: string): number {
	if (!query) { return 0; }
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	const name = getFileName(text).toLowerCase();
	// Exact name match = highest
	if (name === q) { return 100; }
	// Name starts with query
	if (name.indexOf(q) === 0) { return 80; }
	// Name contains query
	if (name.indexOf(q) >= 0) { return 60; }
	// Path contains query
	if (t.indexOf(q) >= 0) { return 40; }
	// Fuzzy match
	return 20;
}

export function highlightMatch(escapedName: string, query: string): string {
	if (!query) { return escapedName; }
	const lowerName = escapedName.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const idx = lowerName.indexOf(lowerQuery);
	if (idx >= 0) {
		return escapedName.substring(0, idx) +
			'<span class="mention-highlight">' + escapedName.substring(idx, idx + query.length) + '</span>' +
			escapedName.substring(idx + query.length);
	}
	return escapedName;
}
