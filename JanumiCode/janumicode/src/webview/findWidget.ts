/**
 * Custom Find Widget for the Governed Stream sidebar webview.
 * VS Code WebviewView does not support enableFindWidget, so we implement
 * a lightweight in-DOM find with highlight, match count, and prev/next navigation.
 */

// ==================== STATE ====================

let isOpen = false;
let currentQuery = '';
let matches: Range[] = [];
let currentMatchIndex = -1;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const HIGHLIGHT_CLASS = 'find-highlight';
const ACTIVE_HIGHLIGHT_CLASS = 'find-highlight-active';
const MIN_QUERY_LENGTH = 2;
const MAX_MATCHES = 500;
const DEBOUNCE_MS = 250;

// ==================== PUBLIC API ====================

/** Toggle the find widget open/closed. If opening, focus the input. */
export function toggleFindWidget(): void {
	if (isOpen) {
		closeFindWidget();
	} else {
		openFindWidget();
	}
}

/** Open the find widget and focus the input. */
export function openFindWidget(): void {
	const widget = document.getElementById('find-widget');
	if (!widget) { return; }
	widget.classList.add('visible');
	isOpen = true;
	// Defer focus so VS Code's webview focus management settles first
	setTimeout(function () {
		const input = document.getElementById('find-input') as HTMLInputElement | null;
		if (input) {
			input.focus();
			input.select();
		}
	}, 50);
}

/** Close the find widget and clear all highlights. */
export function closeFindWidget(): void {
	const widget = document.getElementById('find-widget');
	if (!widget) { return; }
	widget.classList.remove('visible');
	isOpen = false;
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = null;
	}
	clearHighlights();
	currentQuery = '';
	matches = [];
	currentMatchIndex = -1;
	updateMatchCount();
}

/** Run search when the user types in the find input (debounced). */
export function onFindInput(): void {
	const input = document.getElementById('find-input') as HTMLInputElement | null;
	if (!input) { return; }
	const query = input.value;
	if (query === currentQuery) { return; }
	currentQuery = query;

	// Clear any pending debounced search
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = null;
	}

	// Immediately clear highlights if query is too short
	if (query.length < MIN_QUERY_LENGTH) {
		clearHighlights();
		matches = [];
		currentMatchIndex = -1;
		updateMatchCount();
		return;
	}

	// Debounce the actual search to avoid blocking on rapid typing
	searchDebounceTimer = setTimeout(function () {
		performSearch(query);
	}, DEBOUNCE_MS);
}

/** Navigate to the next match. */
export function findNext(): void {
	if (matches.length === 0) { return; }
	currentMatchIndex = (currentMatchIndex + 1) % matches.length;
	highlightActiveMatch();
}

/** Navigate to the previous match. */
export function findPrev(): void {
	if (matches.length === 0) { return; }
	currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
	highlightActiveMatch();
}

/** Whether the find widget is currently open. */
export function isFindOpen(): boolean {
	return isOpen;
}

// ==================== SEARCH ENGINE ====================

function performSearch(query: string): void {
	clearHighlights();
	matches = [];
	currentMatchIndex = -1;

	if (!query || query.length < MIN_QUERY_LENGTH) {
		updateMatchCount();
		return;
	}

	// Search within the stream content area only
	const searchRoot = document.getElementById('stream-content')
		|| document.querySelector('.stream-area')
		|| document.body;

	const treeWalker = document.createTreeWalker(
		searchRoot,
		NodeFilter.SHOW_TEXT,
		null,
	);

	const lowerQuery = query.toLowerCase();
	const textNodes: { node: Text; start: number }[] = [];

	// Collect text node matches (capped to avoid DOM explosion)
	let matchCount = 0;
	let node: Text | null = treeWalker.nextNode() as Text | null;
	while (node && matchCount < MAX_MATCHES) {
		const text = node.textContent || '';
		const lowerText = text.toLowerCase();
		let idx = lowerText.indexOf(lowerQuery);
		while (idx !== -1 && matchCount < MAX_MATCHES) {
			textNodes.push({ node, start: idx });
			matchCount++;
			idx = lowerText.indexOf(lowerQuery, idx + 1);
		}
		node = treeWalker.nextNode() as Text | null;
	}

	// Wrap each match in a highlight span (process in reverse order to preserve offsets)
	for (let i = textNodes.length - 1; i >= 0; i--) {
		const { node: textNode, start } = textNodes[i];
		const range = document.createRange();
		range.setStart(textNode, start);
		range.setEnd(textNode, start + query.length);

		const wrapper = document.createElement('mark');
		wrapper.className = HIGHLIGHT_CLASS;
		try {
			range.surroundContents(wrapper);
		} catch {
			// surroundContents can fail if range spans elements; skip this match
			continue;
		}
	}

	// Collect the highlight elements as match references (in document order)
	const allMarks = searchRoot.querySelectorAll('mark.' + HIGHLIGHT_CLASS);
	matches = [];
	allMarks.forEach(function (mark) {
		const r = document.createRange();
		r.selectNodeContents(mark);
		matches.push(r);
	});

	updateMatchCount();

	if (matches.length > 0) {
		currentMatchIndex = 0;
		highlightActiveMatch();
	}
}

// ==================== HIGHLIGHT MANAGEMENT ====================

function highlightActiveMatch(): void {
	// Remove active class from all highlights
	const allActive = document.querySelectorAll('mark.' + ACTIVE_HIGHLIGHT_CLASS);
	allActive.forEach(function (el) {
		el.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
	});

	if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) { return; }

	// Find the mark element for the current match
	const searchRoot = document.getElementById('stream-content')
		|| document.querySelector('.stream-area')
		|| document.body;
	const allMarks = searchRoot.querySelectorAll('mark.' + HIGHLIGHT_CLASS);
	const activeMark = allMarks[currentMatchIndex] as HTMLElement | undefined;

	if (activeMark) {
		activeMark.classList.add(ACTIVE_HIGHLIGHT_CLASS);
		activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	updateMatchCount();
}

function clearHighlights(): void {
	// Unwrap all <mark> elements back to plain text
	const marks = document.querySelectorAll('mark.' + HIGHLIGHT_CLASS);
	marks.forEach(function (mark) {
		const parent = mark.parentNode;
		if (!parent) { return; }
		while (mark.firstChild) {
			parent.insertBefore(mark.firstChild, mark);
		}
		mark.remove();
		// Merge adjacent text nodes
		parent.normalize();
	});
}

function updateMatchCount(): void {
	const countEl = document.getElementById('find-match-count');
	if (!countEl) { return; }

	if (!currentQuery || matches.length === 0) {
		countEl.textContent = currentQuery ? 'No results' : '';
	} else {
		countEl.textContent = `${currentMatchIndex + 1} of ${matches.length}`;
	}
}
