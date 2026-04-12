/**
 * Accessibility utilities for the Governed Stream webview.
 * Based on JanumiCode Spec v2.3, §17.6.
 *
 * - All interactive elements have ARIA labels
 * - Color is never the sole indicator of state
 * - Keyboard navigation: Tab through cards, Enter to expand/collapse, Space to select
 * - Screen reader: semantic HTML with headings
 */

/**
 * Set up keyboard navigation on a container of cards.
 */
export function setupKeyboardNavigation(container: HTMLElement): () => void {
  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const card = target.closest('[data-record-id]') as HTMLElement | null;
    if (!card) return;

    switch (event.key) {
      case 'Enter':
      case ' ': {
        // Toggle expand/collapse
        const header = card.querySelector('.card-header') as HTMLElement | null;
        if (header && target === header) {
          event.preventDefault();
          header.click();
        }
        break;
      }

      case 'ArrowDown': {
        // Move to next card
        event.preventDefault();
        const next = card.nextElementSibling as HTMLElement | null;
        const nextHeader = next?.querySelector('.card-header') as HTMLElement | null;
        nextHeader?.focus();
        break;
      }

      case 'ArrowUp': {
        // Move to previous card
        event.preventDefault();
        const prev = card.previousElementSibling as HTMLElement | null;
        const prevHeader = prev?.querySelector('.card-header') as HTMLElement | null;
        prevHeader?.focus();
        break;
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}

/**
 * Generate ARIA label for a card based on its record type and content.
 */
export function cardAriaLabel(recordType: string, phaseId: string | null, role: string | null): string {
  const parts: string[] = [];

  if (phaseId) parts.push(`Phase ${phaseId}`);
  if (role) parts.push(role.replace(/_/g, ' '));
  parts.push(recordType.replace(/_/g, ' '));

  return parts.join(' — ');
}

/**
 * Announce a message to screen readers via a live region.
 */
export function announceToScreenReader(message: string): void {
  let liveRegion = document.getElementById('jc-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'jc-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = message;
}
