/**
 * Domain Compliance Reasoning Review — additional review pass for
 * compliance-relevant artifacts.
 * Based on JanumiCode Spec v2.3, §8.1 (Domain Compliance section).
 *
 * Uses a DIFFERENT model provider from the primary Reasoning Review
 * to reduce correlated reasoning errors.
 *
 * Prompt is loaded from .janumicode/prompts/cross_cutting/domain_compliance_review.system.md
 */

import { LLMCaller } from '../llm/llmCaller';
import { TemplateLoader } from '../orchestrator/templateLoader';

// ── Types ───────────────────────────────────────────────────────────

export interface DomainComplianceInput {
  artifactContent: string;
  artifactType: string;
  complianceRegimes: ComplianceRegime[];
  subPhaseId: string;
}

export interface ComplianceRegime {
  name: string;
  description: string;
  applicablePhases: string[];
}

export interface DomainComplianceResult {
  overallPass: boolean;
  findings: ComplianceFinding[];
  regimesChecked: string[];
  subPhaseId: string;
}

export interface ComplianceFinding {
  regime: string;
  severity: 'high' | 'low';
  description: string;
  evidence: string;
  recommendation: string;
}

export interface DomainComplianceConfig {
  provider: string;
  model: string;
  temperature: number;
  janumiCodeVersionSha: string;
}

const TEMPLATE_KEY = 'cross_cutting/domain_compliance_review.system';

// ── DomainComplianceReview ──────────────────────────────────────────

export class DomainComplianceReview {
  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly templateLoader: TemplateLoader,
    private readonly config: DomainComplianceConfig,
  ) {}

  /**
   * Run Domain Compliance Review.
   */
  async review(input: DomainComplianceInput): Promise<DomainComplianceResult> {
    const template = this.templateLoader.getTemplate(TEMPLATE_KEY);

    if (!template) {
      throw new Error(
        `Domain Compliance Review prompt template not found: ${TEMPLATE_KEY}`,
      );
    }

    const regimeDescriptions = input.complianceRegimes
      .map(r => `- ${r.name}: ${r.description}`)
      .join('\n');

    const renderResult = this.templateLoader.render(template, {
      compliance_regimes: regimeDescriptions,
      artifact_type: input.artifactType,
      artifact_content: input.artifactContent,
      janumicode_version_sha: this.config.janumiCodeVersionSha,
    });

    const result = await this.llmCaller.call({
      provider: this.config.provider,
      model: this.config.model,
      prompt: renderResult.rendered,
      responseFormat: 'json',
      temperature: this.config.temperature,
    });

    return this.parseResult(
      result.parsed,
      input.complianceRegimes.map(r => r.name),
      input.subPhaseId,
    );
  }

  /**
   * Check if a domain compliance review should be triggered.
   */
  shouldTrigger(
    complianceRegimes: ComplianceRegime[],
    currentPhaseId: string,
  ): boolean {
    if (complianceRegimes.length === 0) return false;
    return complianceRegimes.some(
      r => r.applicablePhases.length === 0 || r.applicablePhases.includes(currentPhaseId),
    );
  }

  private parseResult(
    parsed: Record<string, unknown> | null,
    regimesChecked: string[],
    subPhaseId: string,
  ): DomainComplianceResult {
    if (!parsed) {
      return {
        overallPass: false,
        findings: [{
          regime: 'unknown',
          severity: 'high',
          description: 'Domain Compliance Review failed to produce valid JSON',
          evidence: 'LLM response not parseable',
          recommendation: 'Retry review',
        }],
        regimesChecked,
        subPhaseId,
      };
    }

    const findings: ComplianceFinding[] = [];
    const rawFindings = parsed.findings as Record<string, unknown>[] | undefined;

    if (Array.isArray(rawFindings)) {
      for (const f of rawFindings) {
        findings.push({
          regime: (f.regime as string) ?? 'unknown',
          severity: (f.severity as 'high' | 'low') ?? 'high',
          description: (f.description as string) ?? '',
          evidence: (f.evidence as string) ?? '',
          recommendation: (f.recommendation as string) ?? '',
        });
      }
    }

    return {
      overallPass: (parsed.overall_pass as boolean) ?? findings.length === 0,
      findings,
      regimesChecked,
      subPhaseId,
    };
  }
}
