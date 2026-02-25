/**
 * Client for communicating with the Historian inference service.
 */

import type { ActionProposal, AdjudicationResponse } from '@hestami/contracts';

export class HistorianClient {
  private historianUrl: string;
  private bundleBuilderUrl: string;

  constructor(historianUrl: string, bundleBuilderUrl: string) {
    this.historianUrl = historianUrl;
    this.bundleBuilderUrl = bundleBuilderUrl;
  }

  /**
   * Check if the Historian service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.historianUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Build an evidence bundle for a proposal
   */
  async buildEvidenceBundle(description: string, specRefs?: string[]): Promise<Array<{
    source: string;
    id: string;
    excerpt: string;
  }>> {
    try {
      const response = await fetch(`${this.bundleBuilderUrl}/bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          spec_refs: specRefs,
          max_excerpts: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Bundle builder error: ${response.status}`);
      }

      const data = await response.json();
      return data.evidence_bundle || [];
    } catch (error) {
      console.error('Failed to build evidence bundle:', error);
      return [];
    }
  }

  /**
   * Submit a proposal for adjudication
   */
  async adjudicate(proposal: Partial<ActionProposal>): Promise<AdjudicationResponse> {
    // Build evidence bundle if not provided
    if (!proposal.evidence_bundle || proposal.evidence_bundle.length === 0) {
      const evidence = await this.buildEvidenceBundle(
        proposal.description || '',
        proposal.spec_refs
      );
      proposal.evidence_bundle = evidence as ActionProposal['evidence_bundle'];
    }

    // Submit to Historian
    const response = await fetch(`${this.historianUrl}/adjudicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_id: proposal.action_id || `AP-${Date.now()}`,
        feature: proposal.feature || 'Unknown',
        description: proposal.description || '',
        steps: proposal.steps || [],
        expected_outcome: proposal.expected_outcome || '',
        evidence_bundle: proposal.evidence_bundle || [],
        assumptions: proposal.assumptions || [],
        invariants: proposal.invariants || [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Historian error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Reload the Historian's LoRA adapter
   */
  async reloadAdapter(adapterId?: string): Promise<void> {
    const response = await fetch(`${this.historianUrl}/reload-adapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapter_id: adapterId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reload adapter: ${response.status}`);
    }
  }

  /**
   * Get current model information
   */
  async getModelInfo(): Promise<{
    base_model: string;
    adapter_id: string | null;
    status: string;
  }> {
    const response = await fetch(`${this.historianUrl}/model`);
    if (!response.ok) {
      throw new Error(`Failed to get model info: ${response.status}`);
    }
    return response.json();
  }
}
