/**
 * Webview message types — extension host ↔ webview client.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §8: every webview
 * paint reflects the single active matter context. Matter-switch messages
 * trigger a full webview re-render.
 */

export type ExtToWebviewMessage =
  | { type: 'matter_context'; payload: MatterContextPayload | null }
  | { type: 'cross_matter_dashboard'; payload: CrossMatterPayload }
  | { type: 'mistaken_matter_recovery'; payload: { affectedArtifactIds: readonly string[] } };

export type WebviewToExtMessage =
  | { type: 'request_switch_matter'; payload: { firmId: string; clientId: string; matterId: string } }
  | { type: 'request_cross_matter_dashboard' };

export interface MatterContextPayload {
  readonly clientName: string;
  readonly matterName: string;
  readonly practiceArea: string;
  readonly proceduralPosture?: string;
  readonly activeLens?: { lensId: string; lensVersion: string };
  readonly colorHashHex: string;
  readonly readOnly: boolean;
}

export interface CrossMatterPayload {
  readonly chrome: 'cross_matter_read_only';
  readonly matters: ReadonlyArray<{
    readonly scope: { firmId: string; clientId: string; matterId: string };
    readonly matterName: string;
    readonly clientName: string;
    readonly practiceArea: string;
    readonly status: 'open' | 'closed';
  }>;
}
