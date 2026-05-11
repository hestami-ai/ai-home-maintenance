/**
 * MMP — Mirror / Menu / Pre-Mortem.
 *
 * Per docs/janumilegal_product_description_evolution.md §13:
 *
 *   - Mirror cards     — assumptions about matter type, objective, jurisdiction,
 *                        procedural posture, release intent. Attorney accepts/rejects/edits.
 *   - Menu cards       — strategic decisions surfaced for attorney choice.
 *   - Pre-Mortem cards — risks the system has identified that the attorney must
 *                        acknowledge before downstream states proceed.
 *
 * MMP submissions are recorded as work_product_mental in the matter-track
 * Governed Stream. They encode attorney mental impressions.
 */

export type MMPCardType = 'mirror' | 'menu' | 'pre_mortem';

export interface MirrorCard {
  readonly cardType: 'mirror';
  readonly cardId: string;
  readonly assumption: string;
  readonly basis?: string;
}

export interface MenuOption {
  readonly optionId: string;
  readonly label: string;
  readonly description?: string;
}

export interface MenuCard {
  readonly cardType: 'menu';
  readonly cardId: string;
  readonly question: string;
  readonly options: readonly MenuOption[];
  readonly defaultOptionId?: string;
}

export interface PreMortemCard {
  readonly cardType: 'pre_mortem';
  readonly cardId: string;
  readonly risk: string;
  readonly impactIfIgnored: string;
  readonly recommendedMitigation?: string;
}

export type MMPCard = MirrorCard | MenuCard | PreMortemCard;

export interface MirrorDecision {
  readonly cardId: string;
  readonly action: 'accept' | 'reject' | 'edit';
  readonly editedAssumption?: string;
}

export interface MenuSelection {
  readonly cardId: string;
  readonly chosenOptionId: string;
  readonly comment?: string;
}

export interface PreMortemDecision {
  readonly cardId: string;
  readonly action: 'acknowledge' | 'reject' | 'mitigated';
  readonly note?: string;
}

export interface MMPSubmission {
  readonly mirrorDecisions: readonly MirrorDecision[];
  readonly menuSelections: readonly MenuSelection[];
  readonly preMortemDecisions: readonly PreMortemDecision[];
  readonly submittedBy: string;
  readonly submittedAt: string;
}

export interface MMPSession {
  readonly mmpId: string;
  readonly cards: readonly MMPCard[];
  readonly submission?: MMPSubmission;
  readonly producedAt: string;
}
