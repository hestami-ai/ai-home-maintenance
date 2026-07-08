/**
 * Perception detectors — each examines a screen snapshot (and optionally the
 * previous one) and returns EVIDENCE (scored observations), not verdicts. The
 * classifier weighs them. Marker strings live in {@link PerceptionMarkers} so
 * a CLI's UI update is a config tweak, not a code change (goose 1.37 defaults
 * calibrated from the captured slice-142 frames).
 */

import { diffScreens, extractText, type Region } from './diffEngine';
import type { ScreenSnapshot } from '../types';

export interface PerceptionMarkers {
  /** Substrings marking a busy/working line (spinners, interrupt hints). */
  busyMarkers: string[];
  /** Substrings identifying the input box / its hint text. */
  inputBoxMarkers: string[];
  /** Prefix of an input-box line (the prompt char). */
  inputPrefix: string;
  /** Lines that are pure chrome (context meters, separators). */
  chromePatterns: RegExp[];
  /**
   * Lines NEVER filtered as echo even when they appear inside recently-sent
   * text. The completion sentinel lives in our own instruction ("end with the
   * exact line: TASK COMPLETE"), so the agent's emission of that line would
   * otherwise normalize to a substring of the send and vanish from agent
   * content — making completion undetectable.
   */
  echoExempt?: string[];
}

export const GOOSE_MARKERS: PerceptionMarkers = {
  busyMarkers: ['(Ctrl+C to interrupt)', 'Searching solution space', 'Initializing clever mode'],
  inputBoxMarkers: ['Enter to send'],
  inputPrefix: '>',
  chromePatterns: [/^[\s╌─━═]+\d*%?\s*[\d/.k]*\s*$/u, /^\s*[╌─━═]{3,}/u],
};

/** Visible-region lines with absolute row indices. */
function visibleLines(s: ScreenSnapshot): Array<{ row: number; text: string }> {
  const top = s.viewportTop ?? 0;
  const out: Array<{ row: number; text: string }> = [];
  for (let r = top; r < s.lines.length; r++) out.push({ row: r, text: s.lines[r] ?? '' });
  return out;
}

// ── Busy detector ───────────────────────────────────────────────────

export interface BusyEvidence { busy: boolean; line?: string; score: number }

export function detectBusy(s: ScreenSnapshot, m: PerceptionMarkers): BusyEvidence {
  // Scan the trailing visible lines — spinners render in the bottom area.
  const vis = visibleLines(s);
  const tail = vis.slice(-6);
  for (const { text } of tail.reverse()) {
    if (m.busyMarkers.some((b) => text.includes(b))) {
      return { busy: true, line: text.trim(), score: 0.9 };
    }
  }
  return { busy: false, score: 0 };
}

// ── Input-region detector ───────────────────────────────────────────

export interface InputRegionEvidence {
  /** Absolute row where the input box begins, or -1 when not found. */
  startRow: number;
  region: Region | null;
  score: number;
}

/**
 * Goose's input box is the trailing region beginning at the last visible line
 * that starts with the input prefix (`>`), optionally preceded by a chrome
 * (context-meter) line. Everything from there down is "ours + chrome", not
 * agent content.
 */
export function detectInputRegion(s: ScreenSnapshot, m: PerceptionMarkers): InputRegionEvidence {
  const vis = visibleLines(s);
  for (let i = vis.length - 1; i >= 0; i--) {
    const t = vis[i].text.trimStart();
    if (t.startsWith(m.inputPrefix)) {
      let startRow = vis[i].row;
      // Absorb an immediately-preceding chrome line (context meter) into the region.
      if (i > 0 && m.chromePatterns.some((p) => p.test(vis[i - 1].text))) startRow = vis[i - 1].row;
      const cols = s.cols ?? Math.max(1, ...s.lines.map((l) => l.length));
      const lastRow = s.lines.length - 1;
      const hasHint = m.inputBoxMarkers.some((h) => vis[i].text.includes(h));
      return {
        startRow,
        region: { top: startRow, left: 0, bottom: lastRow, right: cols - 1 },
        score: hasHint ? 0.95 : 0.7,
      };
    }
    // Stop scanning upward past substantive content — the input box is trailing.
    if (t.length > 0 && !m.chromePatterns.some((p) => p.test(vis[i].text))) break;
  }
  return { startRow: -1, region: null, score: 0 };
}

// ── Agent-content extraction (echo-excluded) ────────────────────────

/**
 * Agent content = visible+scrollback lines ABOVE the input region, minus
 * chrome, minus lines that are fragments of text WE recently sent (the TUI
 * echoes and wraps our input, producing continuation lines without the `>`
 * prefix — the source of the echo fast-settle bug).
 */
export function agentContentLines(
  s: ScreenSnapshot,
  m: PerceptionMarkers,
  recentSends: string[],
): string[] {
  const input = detectInputRegion(s, m);
  const limit = input.startRow >= 0 ? input.startRow : s.lines.length;
  const sentNorm = recentSends.map((t) => t.replace(/\s+/g, ''));
  const out: string[] = [];
  for (let r = 0; r < limit; r++) {
    const line = s.lines[r] ?? '';
    const t = line.trim();
    if (t.length === 0) continue;
    if (t.startsWith(m.inputPrefix)) continue; // echoed input-box lines
    if (m.chromePatterns.some((p) => p.test(line))) continue;
    if (m.busyMarkers.some((b) => line.includes(b))) continue; // spinner churn
    // EXACT match only: the agent's sentinel emission is the marker alone on
    // its own line. An endsWith here would exempt the echoed tail of OUR OWN
    // instruction ("…exact line: TASK COMPLETE"), feeding the marker into
    // agent content the moment the echo renders → instant false completion.
    // Prefixed agent renderings ("◆ TASK COMPLETE") need no exemption: their
    // normalized text isn't a substring of any send, so they're kept anyway.
    const exempt = (m.echoExempt ?? []).includes(t);
    const lineNorm = t.replace(/\s+/g, '');
    if (!exempt && lineNorm.length > 8 && sentNorm.some((sn) => sn.includes(lineNorm))) continue; // echo fragment
    out.push(t);
  }
  return out;
}

// ── Prompt detector ─────────────────────────────────────────────────

export interface PromptEvidence {
  prompt: boolean;
  /** The question/prompt line (agent content). */
  line?: string;
  score: number;
}

const PROMPT_PATTERNS = [
  /\?\s*\[y\/n\]/i, /\[y\/N\]/, /\(yes\/no\)/i,
  /\bpress\s+(enter|return|any key)\b/i,
  /\bcontinue\b.*\?\s*$/i, /\bconfirm\b.*\?\s*$/i,
  /\?\s*$/,
];

/** A prompt requires the app to be IDLE (input box present, not busy) with a
 *  trailing agent-content line shaped like a question. Long questions WRAP at
 *  the terminal width (real goose capture: the `?` landed two lines above a
 *  "Reply with clarification points…" continuation), so the trailing WINDOW of
 *  content lines is examined, strongest (truly last) first. */
export function detectPrompt(
  s: ScreenSnapshot,
  m: PerceptionMarkers,
  recentSends: string[],
): PromptEvidence {
  const content = agentContentLines(s, m, recentSends);
  if (content.length === 0) return { prompt: false, score: 0 };
  const tail = content.slice(-3);
  for (let i = tail.length - 1; i >= 0; i--) {
    if (PROMPT_PATTERNS.some((p) => p.test(tail[i]))) {
      return { prompt: true, line: tail[i], score: i === tail.length - 1 ? 0.8 : 0.65 };
    }
  }
  // Explicit answer-request phrasings without a trailing '?'.
  const last = tail.at(-1)!;
  if (/\b(reply with|please (confirm|answer|choose|select)|let me know)\b/i.test(last)) {
    return { prompt: true, line: last, score: 0.7 };
  }
  return { prompt: false, score: 0 };
}

// ── Action/button detector ──────────────────────────────────────────

const ACTION_WORDS = ['ok', 'cancel', 'yes', 'no', 'confirm', 'continue', 'close', 'dismiss', 'submit', 'save', 'delete', 'quit', 'retry', 'abort'];

export function detectActions(text: string): string[] {
  const actions: string[] = [];
  for (const pattern of [/\[\s*([A-Za-z][A-Za-z ]{0,20})\s*\]/g, /<\s*([A-Za-z][A-Za-z ]{0,20})\s*>/g, /\(\s*([A-Za-z][A-Za-z ]{0,20})\s*\)/g]) {
    for (const match of text.matchAll(pattern)) actions.push(match[1].trim().toLowerCase());
  }
  for (const word of ACTION_WORDS) {
    if (new RegExp(String.raw`\b${word}\b`, 'i').test(text)) actions.push(word);
  }
  return [...new Set(actions)];
}

export function scoreActions(actions: string[]): number {
  if (actions.length === 0) return 0;
  if (actions.includes('cancel') && actions.length >= 2) return 0.4;
  if (actions.some((a) => ['ok', 'yes', 'no', 'confirm'].includes(a))) return 0.3;
  return 0.15;
}

// ── Box-region detector ─────────────────────────────────────────────

const TL = new Set(['┌', '╔', '+']);
const TR = new Set(['┐', '╗', '+']);
const BL = new Set(['└', '╚', '+']);
const BR = new Set(['┘', '╝', '+']);
const HC = new Set(['─', '═', '-']);
const VC = new Set(['│', '║', '|']);

export interface BoxEvidence { region: Region; score: number; text: string; actions: string[] }

export function detectBoxRegions(s: ScreenSnapshot): BoxEvidence[] {
  const top0 = s.viewportTop ?? 0;
  const lines = s.lines;
  const out: BoxEvidence[] = [];
  for (let r1 = top0; r1 < lines.length; r1++) {
    const row = lines[r1] ?? '';
    for (let c1 = 0; c1 < row.length; c1++) {
      if (!TL.has(row[c1])) continue;
      for (let c2 = c1 + 4; c2 < row.length; c2++) {
        if (!TR.has(row[c2])) continue;
        // Top edge: mostly horizontal chars (≥50% — allows embedded titles
        // like `┌──── Confirm ────┐`).
        const topOk = countEdge(row, c1 + 1, c2 - 1) >= (c2 - c1 - 1) * 0.5;
        if (!topOk) continue;
        for (let r2 = r1 + 2; r2 < lines.length; r2++) {
          const bot = lines[r2] ?? '';
          if (!BL.has(bot[c1] ?? '') || !BR.has(bot[c2] ?? '')) continue;
          if (countEdge(bot, c1 + 1, c2 - 1) < (c2 - c1 - 1) * 0.5) continue;
          let sidesOk = true;
          for (let r = r1 + 1; r < r2; r++) {
            const l = lines[r] ?? '';
            if (!VC.has(l[c1] ?? '') || !VC.has(l[c2] ?? '')) { sidesOk = false; break; }
          }
          if (!sidesOk) continue;
          const region: Region = { top: r1, left: c1, bottom: r2, right: c2 };
          const text = extractText(s, region);
          const actions = detectActions(text);
          out.push({ region, score: scoreBox(region, s, text), text, actions });
        }
      }
    }
  }
  return out;
}

function countEdge(row: string, from: number, to: number): number {
  let n = 0;
  for (let c = from; c <= to; c++) if (HC.has(row[c] ?? '')) n++;
  return n;
}

function scoreBox(region: Region, s: ScreenSnapshot, text: string): number {
  const width = region.right - region.left + 1;
  const height = region.bottom - region.top + 1;
  const cols = s.cols ?? 120;
  let score = 0;
  if (width * height > 40) score += 0.2;
  if (width >= cols * 0.25) score += 0.2;
  if (height >= 3) score += 0.1;
  if (Math.abs((region.left + region.right) / 2 - cols / 2) < cols * 0.2) score += 0.2;
  if (/\b(ok|cancel|yes|no|confirm|continue|close|submit)\b/i.test(text)) score += 0.3;
  return Math.min(score, 1);
}

// ── Overlay-diff detector ───────────────────────────────────────────

export interface OverlayEvidence { region: Region | null; score: number }

export function detectOverlay(prev: ScreenSnapshot | null, curr: ScreenSnapshot): OverlayEvidence {
  if (!prev) return { region: null, score: 0 };
  const d = diffScreens(prev, curr);
  if (!d.bounds) return { region: null, score: 0 };
  let score = 0;
  if (d.coverage > 0.05 && d.coverage < 0.75) score += 0.25;
  if (d.density > 0.25) score += 0.25;
  const cols = curr.cols ?? 120;
  if (Math.abs((d.bounds.left + d.bounds.right) / 2 - cols / 2) < cols * 0.25) score += 0.2;
  const text = extractText(curr, d.bounds);
  if (/\b(ok|cancel|yes|no|confirm|continue|dismiss|close)\b/i.test(text)) score += 0.3;
  return { region: d.bounds, score: Math.min(score, 1) };
}
