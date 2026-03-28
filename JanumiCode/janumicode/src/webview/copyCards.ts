/**
 * Copy-content buttons for stream cards.
 *
 * Injects a copy button into the header of each card type:
 *   - .command-block  → structured stdin + response sections
 *   - .rich-card      → collapsible body text
 *   - .qa-exchange-card → Q: / A: formatted text
 *
 * Uses a MutationObserver on #stream-content so buttons are added
 * automatically as new cards appear during streaming.
 */

// ==================== Button Factory ====================

function makeCopyButton(): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.className = 'card-copy-btn';
	btn.title = 'Copy content';
	btn.setAttribute('aria-label', 'Copy card content');
	btn.innerHTML = '&#x1F4CB;'; // 📋
	btn.addEventListener('click', function (e) {
		e.stopPropagation(); // prevent toggling the card collapse
		const card = btn.closest('.command-block, .rich-card, .qa-exchange-card') as HTMLElement | null;
		if (!card) { return; }
		const text = extractCardCopyText(card);
		navigator.clipboard.writeText(text).then(function () {
			btn.innerHTML = '&#x2713;'; // ✓
			btn.classList.add('copied');
			setTimeout(function () {
				btn.innerHTML = '&#x1F4CB;';
				btn.classList.remove('copied');
			}, 1500);
		}).catch(function () { /* clipboard unavailable — silent fail */ });
	});
	return btn;
}

// ==================== Injection ====================

function injectCommandBlockCopy(el: Element): void {
	el.setAttribute('data-copy-injected', 'true');
	const header = el.querySelector('.command-block-header');
	if (!header) { return; }
	const btn = makeCopyButton();
	// Insert before the timestamp if present, otherwise append
	const timeEl = header.querySelector('.command-block-time');
	if (timeEl) {
		header.insertBefore(btn, timeEl);
	} else {
		header.appendChild(btn);
	}
}

function injectRichCardCopy(el: Element): void {
	el.setAttribute('data-copy-injected', 'true');
	const header = el.querySelector('.collapsible-card-header');
	if (!header) { return; }
	const btn = makeCopyButton();
	const timeEl = header.querySelector('.card-timestamp');
	if (timeEl) {
		header.insertBefore(btn, timeEl);
	} else {
		header.appendChild(btn);
	}
}

function injectQaCardCopy(el: Element): void {
	el.setAttribute('data-copy-injected', 'true');
	const questionRow = el.querySelector('.qa-exchange-question');
	if (!questionRow) { return; }
	const btn = makeCopyButton();
	const timeEl = questionRow.querySelector('.qa-exchange-time');
	if (timeEl) {
		questionRow.insertBefore(btn, timeEl);
	} else {
		questionRow.appendChild(btn);
	}
}

function injectCopyButtons(root: Element): void {
	// Inject into root itself if it matches
	if (root.matches('.command-block') && !root.hasAttribute('data-copy-injected')) {
		injectCommandBlockCopy(root);
	} else if (root.matches('.rich-card') && !root.hasAttribute('data-copy-injected')) {
		injectRichCardCopy(root);
	} else if (root.matches('.qa-exchange-card') && !root.hasAttribute('data-copy-injected')) {
		injectQaCardCopy(root);
	}

	// Inject into descendants
	root.querySelectorAll('.command-block:not([data-copy-injected])').forEach(injectCommandBlockCopy);
	root.querySelectorAll('.rich-card:not([data-copy-injected])').forEach(injectRichCardCopy);
	root.querySelectorAll('.qa-exchange-card:not([data-copy-injected])').forEach(injectQaCardCopy);
}

// ==================== Content Extraction ====================

function extractCardCopyText(card: HTMLElement): string {
	if (card.classList.contains('command-block')) {
		return extractCommandBlockText(card);
	}
	if (card.classList.contains('rich-card')) {
		return extractRichCardText(card);
	}
	if (card.classList.contains('qa-exchange-card')) {
		return extractQaText(card);
	}
	return card.textContent?.trim() ?? '';
}

/**
 * Command block: structured stdin section + response section.
 * Includes hidden/collapsed output lines so the full content is copied.
 */
function extractCommandBlockText(card: HTMLElement): string {
	const parts: string[] = [];

	// Stdin — content inside .cmd-stdin-content pre
	const stdinPre = card.querySelector('.cmd-stdin-content pre');
	const stdinText = stdinPre?.textContent?.trim();
	if (stdinText) {
		parts.push('=== STDIN ===\n' + stdinText);
	}

	// Response lines — all .cmd-line spans (covers both visible and hidden sections)
	const responseLines: string[] = [];
	card.querySelectorAll('.cmd-line').forEach(function (el) {
		const text = el.textContent?.trim();
		if (text) { responseLines.push(text); }
	});
	if (responseLines.length > 0) {
		parts.push('=== RESPONSE ===\n' + responseLines.join('\n'));
	}

	// Fallback: body text if neither section had content
	if (parts.length === 0) {
		return card.querySelector('.command-block-body')?.textContent?.trim() ?? '';
	}

	return parts.join('\n\n');
}

/**
 * Rich card: body text content, excluding interactive controls.
 */
function extractRichCardText(card: HTMLElement): string {
	const body = card.querySelector('.collapsible-card-body');
	if (!body) { return card.textContent?.trim() ?? ''; }
	// Walk text nodes and block elements, skip buttons
	return extractReadableText(body as HTMLElement);
}

/**
 * Q&A exchange: formatted as "Q: ...\n\nA: ..."
 */
function extractQaText(card: HTMLElement): string {
	const questionText = card.querySelector('.qa-exchange-question-text')?.textContent?.trim() ?? '';
	const answerText = card.querySelector('.qa-exchange-answer-body')?.textContent?.trim() ?? '';
	const parts: string[] = [];
	if (questionText) { parts.push('Q: ' + questionText); }
	if (answerText) { parts.push('A: ' + answerText); }
	return parts.join('\n\n');
}

/**
 * Extract readable text from an element, skipping button elements
 * and normalising excessive whitespace.
 */
function extractReadableText(el: HTMLElement): string {
	const skipTags = new Set(['BUTTON', 'SCRIPT', 'STYLE']);
	const parts: string[] = [];

	function walk(node: Node): void {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = (node.textContent ?? '').replace(/\s+/g, ' ');
			if (text.trim()) { parts.push(text); }
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) { return; }
		const elem = node as HTMLElement;
		if (skipTags.has(elem.tagName)) { return; }

		const isBlock = /^(DIV|P|LI|H[1-6]|PRE|BLOCKQUOTE|SECTION|ARTICLE)$/.test(elem.tagName);
		if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
			parts.push('\n');
		}
		for (const child of Array.from(elem.childNodes)) {
			walk(child);
		}
		if (isBlock) { parts.push('\n'); }
	}

	walk(el);
	return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

// ==================== Init ====================

/**
 * Initialise copy buttons for all existing cards and watch for new ones.
 * Call once at webview startup.
 */
export function initCopyCards(): void {
	const streamContent = document.getElementById('stream-content');
	if (!streamContent) { return; }

	// Inject into cards already in the DOM (page hydration)
	injectCopyButtons(streamContent);

	// Watch for new cards added during the session
	const observer = new MutationObserver(function (mutations) {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					injectCopyButtons(node as Element);
				}
			}
		}
	});

	// childList on direct children is sufficient — new cards are top-level children
	// of #stream-content. subtree catches cards nested inside wrapper elements.
	observer.observe(streamContent, { childList: true, subtree: true });
}
