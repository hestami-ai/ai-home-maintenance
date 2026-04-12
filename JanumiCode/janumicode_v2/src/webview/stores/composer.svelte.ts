/**
 * Composer state — Svelte 5 runes class.
 *
 * Holds the textarea value, attachment chips, mention references, submission
 * state, current phase (for mode detection), and a small context summary.
 *
 * Mode is derived: `currentPhase ? open_query : raw_intent`. The composer
 * never blocks waiting for a response; isSubmitting is reset by the App
 * shell when a `client_liaison_response` arrives or after a 60s safety timeout.
 */

export type ComposerMode = 'raw_intent' | 'open_query';
export type MentionType = 'file' | 'symbol' | 'decision' | 'constraint' | 'phase' | 'run';

export interface Attachment {
  uri: string;
  name: string;
  type: 'file' | 'image';
  size?: number;
}

export interface Reference {
  type: MentionType;
  id: string;
  display: string;
  uri?: string;
}

export interface ContextSummary {
  activeFile: string | null;
  constraintCount: number;
  referenceCount: number;
}

export interface MentionCandidate {
  type: MentionType;
  id: string;
  label: string;
  detail?: string;
  uri?: string;
}

class ComposerStore {
  text = $state('');
  attachments = $state<Attachment[]>([]);
  references = $state<Reference[]>([]);
  isSubmitting = $state(false);
  llmQueueDepth = $state(0);
  currentPhase = $state<string | null>(null);
  contextSummary = $state<ContextSummary | null>(null);

  // Autocomplete UI state
  mentionOpen = $state(false);
  mentionQuery = $state('');
  mentionCandidates = $state<MentionCandidate[]>([]);
  mentionActiveIndex = $state(0);

  // Derived getters via accessor methods
  get mode(): ComposerMode {
    return this.currentPhase ? 'open_query' : 'raw_intent';
  }

  get tokenEstimate(): number {
    const textTokens = Math.ceil(this.text.length / 4);
    const attachmentTokens = this.attachments.reduce(
      (sum, a) => sum + Math.ceil((a.size ?? 1024) / 4),
      0,
    );
    return textTokens + attachmentTokens;
  }

  get canSubmit(): boolean {
    return !this.isSubmitting && this.text.trim().length > 0;
  }

  // ── Actions ────────────────────────────────────────────────────

  setText(value: string): void {
    this.text = value;
  }

  addAttachment(a: Attachment): void {
    if (this.attachments.some((x) => x.uri === a.uri)) return;
    this.attachments = [...this.attachments, a];
  }

  removeAttachment(uri: string): void {
    this.attachments = this.attachments.filter((a) => a.uri !== uri);
  }

  addReference(r: Reference): void {
    if (this.references.some((x) => x.id === r.id && x.type === r.type)) return;
    this.references = [...this.references, r];
  }

  removeReference(id: string): void {
    this.references = this.references.filter((r) => r.id !== id);
  }

  beginSubmit(): void {
    this.isSubmitting = true;
  }

  endSubmit(): void {
    this.isSubmitting = false;
  }

  clear(): void {
    this.text = '';
    this.attachments = [];
    this.references = [];
    this.mentionOpen = false;
    this.mentionQuery = '';
    this.mentionCandidates = [];
    this.mentionActiveIndex = 0;
  }

  // Mention helpers
  openMentions(query: string): void {
    this.mentionOpen = true;
    this.mentionQuery = query;
    this.mentionActiveIndex = 0;
  }

  closeMentions(): void {
    this.mentionOpen = false;
    this.mentionQuery = '';
    this.mentionCandidates = [];
    this.mentionActiveIndex = 0;
  }

  setMentionCandidates(candidates: MentionCandidate[]): void {
    this.mentionCandidates = candidates;
    this.mentionActiveIndex = 0;
  }
}

export const composerStore = new ComposerStore();
