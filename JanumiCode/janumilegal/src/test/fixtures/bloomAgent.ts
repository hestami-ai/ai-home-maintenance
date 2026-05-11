/**
 * Test fixture: scriptable IssueBloomAgent for the three-pass discipline.
 */

import type {
  BloomPassInput,
  IssueBloomAgent,
  IssueCandidate,
  NonApplicabilityRecord,
  PassOneOutput,
  PassThreeOutput,
  PassTwoOutput,
} from '../../lib/issueBloom/types.js';

export interface ScriptedAgentScript {
  pass1?: { candidates: readonly IssueCandidate[]; nonApplicable?: readonly NonApplicabilityRecord[] };
  pass2?: { candidates: readonly IssueCandidate[]; attestation?: PassTwoOutput['attestation'] };
  pass3?: { candidates: readonly IssueCandidate[] };
}

export class ScriptedBloomAgent implements IssueBloomAgent {
  readonly calls: BloomPassInput[] = [];
  constructor(private readonly script: ScriptedAgentScript) {}

  async pass1(input: BloomPassInput): Promise<PassOneOutput> {
    this.calls.push(input);
    return {
      pass: 1,
      candidates: this.script.pass1?.candidates ?? [],
      nonApplicable: this.script.pass1?.nonApplicable ?? [],
    };
  }
  async pass2(input: BloomPassInput): Promise<PassTwoOutput> {
    this.calls.push(input);
    return {
      pass: 2,
      candidates: this.script.pass2?.candidates ?? [],
      attestation: this.script.pass2?.attestation,
    };
  }
  async pass3(input: BloomPassInput): Promise<PassThreeOutput> {
    this.calls.push(input);
    return {
      pass: 3,
      candidates: this.script.pass3?.candidates ?? [],
    };
  }
}

export function candidate(args: {
  issueId: string;
  domain: string;
  pass?: 1 | 2 | 3;
}): IssueCandidate {
  return {
    issueId: args.issueId,
    issueDomain: args.domain,
    whyItMightMatter: `${args.domain}: synthetic test candidate`,
    requiredFacts: [],
    requiredSources: [],
    reviewRequirement: 'none',
    introducedAtPass: args.pass ?? 1,
    lastModifiedAtPass: args.pass ?? 1,
  };
}
