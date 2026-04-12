/**
 * Find-in-page for the Governed Stream webview.
 * Based on JanumiCode Spec v2.3, §17.5.
 *
 * Custom find widget: minimum 2-character query, 250ms debounce, max 500 matches.
 */

export interface FindState {
  query: string;
  matches: FindMatch[];
  currentMatchIndex: number;
  isActive: boolean;
}

export interface FindMatch {
  cardId: string;
  textOffset: number;
}

const MAX_MATCHES = 500;
const MIN_QUERY_LENGTH = 2;

/**
 * Search for a query string across all visible card content.
 */
export function findInCards(
  container: HTMLElement,
  query: string,
): FindMatch[] {
  if (query.length < MIN_QUERY_LENGTH) return [];

  const matches: FindMatch[] = [];
  const lowerQuery = query.toLowerCase();
  const cards = container.querySelectorAll('[data-record-id]');

  for (const card of cards) {
    const cardId = card.getAttribute('data-record-id');
    if (!cardId) continue;

    const text = card.textContent?.toLowerCase() ?? '';
    let offset = 0;

    while (offset < text.length && matches.length < MAX_MATCHES) {
      const idx = text.indexOf(lowerQuery, offset);
      if (idx === -1) break;
      matches.push({ cardId, textOffset: idx });
      offset = idx + lowerQuery.length;
    }
  }

  return matches;
}

/**
 * Scroll to and highlight a specific match.
 */
export function scrollToMatch(container: HTMLElement, match: FindMatch): void {
  const card = container.querySelector(`[data-record-id="${match.cardId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Briefly highlight the card
    card.classList.add('find-highlight');
    setTimeout(() => card.classList.remove('find-highlight'), 1500);
  }
}

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs = 250,
): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  }) as T;
}
