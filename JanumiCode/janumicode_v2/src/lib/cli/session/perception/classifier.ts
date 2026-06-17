/**
 * StateClassifier — combines detector evidence into one Detection verdict
 * (reference design §8: weighted evidence, never a single heuristic).
 *
 * Kinds:
 *   busy   — the agent is working (spinner / interrupt hint visible)
 *   modal  — a bordered/overlay dialog demands a choice
 *   prompt — the app is idle and the last agent line is a question/prompt
 *   idle   — input box visible, not busy, no pending question
 *   normal — none of the above confidently detected
 *
 * `agentContentSig` is the echo-excluded agent-content signature — the policy
 * layer compares it across sends to decide "has the agent actually said
 * anything since I asked?" (kills the echo fast-settle class of bugs).
 */

import {
  GOOSE_MARKERS,
  agentContentLines,
  detectBoxRegions,
  detectBusy,
  detectInputRegion,
  detectOverlay,
  detectPrompt,
  scoreActions,
  type PerceptionMarkers,
} from './detectors';
import { regionsOverlap, type Region } from './diffEngine';
import type { ScreenSnapshot } from '../types';

export type DetectionKind = 'busy' | 'modal' | 'prompt' | 'idle' | 'normal';

export interface Detection {
  kind: DetectionKind;
  confidence: number;
  bounds?: Region;
  /** The prompt/question line (kind=prompt) or modal text (kind=modal). */
  line?: string;
  actions?: string[];
  /** Echo-excluded agent-content signature (joined content lines). */
  agentContentSig: string;
  /** True when the input box is visible (the app can accept input). */
  inputReady: boolean;
}

export interface ClassifierContext {
  /** Recently-sent input lines (echo exclusion). */
  recentSends: string[];
  markers?: PerceptionMarkers;
}

export function classifyScreen(
  prev: ScreenSnapshot | null,
  curr: ScreenSnapshot,
  ctx: ClassifierContext,
): Detection {
  const m = ctx.markers ?? GOOSE_MARKERS;
  const content = agentContentLines(curr, m, ctx.recentSends);
  const agentContentSig = content.join('\n');
  const input = detectInputRegion(curr, m);
  const inputReady = input.startRow >= 0;

  // 1. Busy dominates — never classify a working screen as idle/prompt.
  const busy = detectBusy(curr, m);
  if (busy.busy) {
    return { kind: 'busy', confidence: busy.score, line: busy.line, agentContentSig, inputReady: false };
  }

  // 2. Modal: bordered boxes + overlay diff, weighted.
  // Overlay-diff is REINFORCEMENT ONLY: a localized screen change is what any
  // ordinary agent response looks like, and bare action words ("ok") appear in
  // normal prose — solo-promoting overlay diffs misclassified a plain "ok"
  // reply as a modal (caught by fake-PTY trace). A modal verdict requires
  // structural box evidence.
  const candidates: Array<{ confidence: number; bounds: Region; text: string; actions: string[] }> = [];
  for (const box of detectBoxRegions(curr)) {
    let score = box.score * 0.55 + scoreActions(box.actions) * 0.25;
    const overlay = detectOverlay(prev, curr);
    if (overlay.region && regionsOverlap(box.region, overlay.region)) score += overlay.score * 0.2;
    candidates.push({ confidence: Math.min(score, 1), bounds: box.region, text: box.text, actions: box.actions });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const modal = candidates[0];
  if (modal && modal.confidence >= 0.5) {
    return {
      kind: 'modal', confidence: modal.confidence, bounds: modal.bounds,
      line: modal.text.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').slice(0, 200),
      actions: modal.actions, agentContentSig, inputReady,
    };
  }

  // 3. Prompt: idle + last agent line is a question.
  const prompt = detectPrompt(curr, m, ctx.recentSends);
  if (inputReady && prompt.prompt) {
    return { kind: 'prompt', confidence: Math.min(prompt.score + input.score * 0.2, 1), line: prompt.line, agentContentSig, inputReady };
  }

  // 4. Idle: input box visible, nothing pending.
  if (inputReady) {
    return { kind: 'idle', confidence: input.score, agentContentSig, inputReady };
  }

  return { kind: 'normal', confidence: 0.5, agentContentSig, inputReady };
}
