/**
 * Classifier — LLM-backed 8-type query classifier for the Universal Router.
 *
 * Uses the existing `cross_cutting/client_liaison_query_classification.system`
 * template (updated for 8 types) and the priority-queued LLMCaller in the
 * `user_query` lane so it never waits behind phase work.
 */

import type { PriorityLLMCaller } from '../../llm/priorityLLMCaller';
import type { TemplateLoader } from '../../orchestrator/templateLoader';
import type { OpenQuery, QueryClassification, QueryType } from './types';
import { getLogger } from '../../logging';

const TEMPLATE_KEY = 'cross_cutting/client_liaison_query_classification.system';

const VALID_TYPES: ReadonlySet<QueryType> = new Set<QueryType>([
  'workflow_initiation',
  'historical_lookup',
  'consistency_challenge',
  'forward_implication',
  'rationale_request',
  'ambient_clarification',
  'status_check',
  'artifact_request',
]);

export interface ClassifierConfig {
  provider: string;
  model: string;
}

export class Classifier {
  constructor(
    private readonly llm: PriorityLLMCaller,
    private readonly templates: TemplateLoader,
    private readonly config: ClassifierConfig,
    private readonly capabilityListing: () => string,
  ) {}

  async classify(query: OpenQuery): Promise<QueryClassification> {
    const template = this.templates.getTemplate(TEMPLATE_KEY);
    if (!template) {
      return this.fallback();
    }

    try {
      const rendered = this.templates.render(template, {
        query_text: query.text,
        available_capabilities: this.capabilityListing(),
        janumicode_version_sha: 'dev',
      });

      if (rendered.missing_variables.length > 0) {
        getLogger().warn('agent', 'Classifier template missing variables', {
          missing: rendered.missing_variables,
        });
        return this.fallback();
      }

      const result = await this.llm.call(
        {
          provider: this.config.provider,
          model: this.config.model,
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.2,
        },
        { priority: 'user_query' },
      );

      const parsed = result.parsed ?? {};
      const rawType = parsed.query_type as string | undefined;
      const queryType: QueryType = rawType && VALID_TYPES.has(rawType as QueryType)
        ? (rawType as QueryType)
        : 'ambient_clarification';

      const shouldQueue =
        query.currentPhaseId === '9' &&
        (queryType === 'consistency_challenge' || queryType === 'forward_implication');

      return {
        queryType,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        shouldQueue,
        suggestedCapability:
          typeof parsed.suggested_capability === 'string' ? parsed.suggested_capability : undefined,
      };
    } catch (err) {
      getLogger().warn('agent', 'Classifier LLM call failed', { error: String(err) });
      return this.fallback();
    }
  }

  private fallback(): QueryClassification {
    return {
      queryType: 'ambient_clarification',
      confidence: 0.3,
      shouldQueue: false,
    };
  }
}
