/**
 * Shared utilities for webview renderers.
 * All renderer modules import from here instead of from the extension host.
 */

import { escapeHtmlClient } from '../utils';

/** Short alias for escapeHtmlClient — used throughout all renderer modules. */
export const esc = escapeHtmlClient;

/** Format an ISO timestamp for display. */
export function formatTimestamp(iso: string): string {
	try {
		// Normalize SQLite datetime('now') format ("YYYY-MM-DD HH:MM:SS", UTC but no T/Z)
		// to ISO 8601 so JavaScript Date parses it as UTC, not local time.
		let normalized = iso;
		if (iso && !iso.includes('T')) {
			normalized = iso.replace(' ', 'T') + 'Z';
		}
		const d = new Date(normalized);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	} catch {
		return iso;
	}
}

/** Wrap an HTML string so its first element becomes vertically resizable. */
export function wrapResizable(html: string): string {
	return html.replace(/^(\s*<\w+)([\s>])/, '$1 style="resize:vertical;overflow:auto;height:400px;"$2');
}

/**
 * Lightweight markdown-to-HTML converter for turn content.
 * Handles headings, bold, italic, inline code, fenced code blocks,
 * unordered lists, and horizontal rules. Input is escaped first for safety.
 */
export function simpleMarkdownToHtml(md: string): string {
	const escaped = esc(md);
	const lines = escaped.split('\n');
	const out: string[] = [];
	let inCodeBlock = false;
	let inList = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Fenced code blocks (``` )
		if (line.trimStart().startsWith('```')) {
			if (inList) { out.push('</ul>'); inList = false; }
			if (inCodeBlock) {
				out.push('</code></pre>');
				inCodeBlock = false;
			} else {
				out.push('<pre><code>');
				inCodeBlock = true;
			}
			continue;
		}
		if (inCodeBlock) {
			out.push(line);
			continue;
		}

		// Blank line — close list if open
		if (line.trim() === '') {
			if (inList) { out.push('</ul>'); inList = false; }
			continue;
		}

		// Horizontal rule
		if (/^-{3,}$/.test(line.trim())) {
			if (inList) { out.push('</ul>'); inList = false; }
			out.push('<hr>');
			continue;
		}

		// Headings
		const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
		if (headingMatch) {
			if (inList) { out.push('</ul>'); inList = false; }
			const level = headingMatch[1].length;
			out.push(`<h${level}>${applyInlineFormatting(headingMatch[2])}</h${level}>`);
			continue;
		}

		// Unordered list items (- item)
		const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
		if (listMatch) {
			if (!inList) { out.push('<ul>'); inList = true; }
			out.push(`<li>${applyInlineFormatting(listMatch[2])}</li>`);
			continue;
		}

		// Paragraph text
		if (inList) { out.push('</ul>'); inList = false; }
		out.push(`<p>${applyInlineFormatting(line)}</p>`);
	}

	if (inCodeBlock) { out.push('</code></pre>'); }
	if (inList) { out.push('</ul>'); }

	return out.join('\n');
}

/** Apply inline markdown formatting (bold, italic, inline code) to already-escaped text. */
export function applyInlineFormatting(text: string): string {
	return text
		// Inline code: `code`
		.replaceAll(/`([^`]+)`/g, '<code>$1</code>')
		// Bold: **text** or __text__
		.replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replaceAll(/__([^_]+)__/g, '<strong>$1</strong>')
		// Italic: *text* or _text_
		.replaceAll(/\*([^*]+)\*/g, '<em>$1</em>')
		.replaceAll(/\b_([^_]+)_\b/g, '<em>$1</em>');
}

/** Render text content, auto-detecting markdown and applying formatting. */
export function renderContentWithMarkdown(text: string): string {
	if (/^#{1,4}\s|^\*\*|\n#{1,4}\s|\n```/.test(text)) {
		return `<div class="card-content card-content-md">${simpleMarkdownToHtml(text)}</div>`;
	}
	return `<div class="card-content">${esc(text)}</div>`;
}

/** Safely convert a value to a display string. Handles objects that LLMs return instead of plain strings. */
export function stringifyItem(item: unknown): string {
	if (typeof item === 'string') { return item; }
	if (item === null || item === undefined) { return ''; }
	if (typeof item === 'object') {
		const obj = item as Record<string, unknown>;
		for (const key of ['text', 'description', 'metric', 'requirement', 'name', 'value', 'label', 'content']) {
			if (typeof obj[key] === 'string') { return obj[key] as string; }
		}
		const parts = Object.entries(obj)
			.filter(([, v]) => typeof v === 'string' || typeof v === 'number')
			.map(([k, v]) => `${k}: ${v}`);
		if (parts.length > 0) { return parts.join(' | '); }
		return JSON.stringify(item);
	}
	return String(item);
}

/** Format phase label from enum value. */
export function formatPhaseLabel(phase: string): string {
	return phase.replaceAll('_', ' ');
}
