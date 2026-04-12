/**
 * Scroll management for the Governed Stream webview.
 * Based on JanumiCode Spec v2.3, §17.5.
 *
 * - Auto-scroll during active execution (disabled when user scrolls up)
 * - "Jump to latest" button
 * - Phase navigation floating sidebar
 */

export interface ScrollState {
  autoScroll: boolean;
  currentPhaseInView: string | null;
}

/**
 * Check if the container is scrolled near the bottom.
 */
export function isNearBottom(container: HTMLElement, threshold = 50): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * Scroll to the bottom of the container.
 */
export function scrollToBottom(container: HTMLElement): void {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

/**
 * Scroll to a specific phase milestone card.
 */
export function scrollToPhase(container: HTMLElement, phaseId: string): void {
  const card = container.querySelector(`[data-phase-id="${phaseId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Get all phase milestone elements for the navigation sidebar.
 */
export function getPhaseAnchors(container: HTMLElement): { phaseId: string; label: string; top: number }[] {
  const anchors: { phaseId: string; label: string; top: number }[] = [];
  const elements = container.querySelectorAll('[data-phase-id]');

  for (const el of elements) {
    const phaseId = el.getAttribute('data-phase-id');
    const label = el.getAttribute('data-phase-label') ?? `Phase ${phaseId}`;
    if (phaseId) {
      anchors.push({ phaseId, label, top: (el as HTMLElement).offsetTop });
    }
  }

  return anchors;
}
