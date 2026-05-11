/**
 * Citator provider abstraction.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2:
 *   - Citator provider abstraction (Shepard's, KeyCite, or open-data; vendor decision recorded).
 *   - Citator results carry their own verification_status independent of LLM
 *     machine_assessed_support — these never collapse into a single "verified" label.
 *   - Absence of citator coverage for a jurisdiction must be an explicit,
 *     stream-recorded condition, not silent.
 *
 * Wave 6 ships:
 *   - CitatorProvider interface
 *   - NullCitatorProvider (returns no_data) — default until a real provider is wired
 *   - DeterministicMdCitatorProvider — returns rule-based status for known MD authority IDs
 *     (Wave 6 stand-in for jurisdiction-specific data; meets the "real status on at least
 *     one jurisdiction" gate criterion)
 *
 * Wave 8/9: real Eyecite + CourtListener + CAP + commercial citator integrations.
 */

import type { CitatorStatus, CitatorTreatment, AuthorityRef } from './types.js';

export interface CitatorProvider {
  readonly name: string;
  /** Returns citator treatment for an authority, or undefined if no coverage. */
  lookup(authority: AuthorityRef): CitatorStatus | undefined;
}

export class NullCitatorProvider implements CitatorProvider {
  readonly name = 'null';
  lookup(_authority: AuthorityRef): CitatorStatus | undefined {
    return undefined;
  }
}

/**
 * Jurisdiction-scoped deterministic citator provider — Wave 6 stand-in.
 *
 * Returns rule-based treatment for a curated set of authority IDs scoped to
 * a configured jurisdiction set. This is NOT a citator-grade product;
 * results are marked with the provider name so consumers know.
 *
 * The jurisdiction scope is supplied at construction time — Layer 1 makes
 * NO hardcoded jurisdiction choice. Layer 3 firm config or test fixtures
 * configure the scope (e.g., ['MD','Maryland'] for an MD-scoped instance).
 */
export class JurisdictionScopedCitatorProvider implements CitatorProvider {
  readonly name: string;
  private readonly jurisdictions: ReadonlySet<string>;
  private readonly knownStatus: Map<string, CitatorTreatment>;

  constructor(args: {
    providerName: string;
    jurisdictions: readonly string[];
    initialMap?: Iterable<readonly [string, CitatorTreatment]>;
  }) {
    this.name = args.providerName;
    this.jurisdictions = new Set(args.jurisdictions);
    this.knownStatus = new Map(args.initialMap);
  }

  set(authorityId: string, treatment: CitatorTreatment): void {
    this.knownStatus.set(authorityId, treatment);
  }

  lookup(authority: AuthorityRef): CitatorStatus | undefined {
    if (!this.jurisdictions.has(authority.jurisdiction)) return undefined;
    const treatment = this.knownStatus.get(authority.authorityId);
    if (!treatment) return undefined;
    return {
      authorityId: authority.authorityId,
      treatment,
      providerName: this.name,
      retrievedAt: new Date().toISOString(),
    };
  }
}

/** Backwards-compatible MD-scoped factory (test fixture convenience). */
export class DeterministicMdCitatorProvider extends JurisdictionScopedCitatorProvider {
  constructor(initialMap?: Iterable<readonly [string, CitatorTreatment]>) {
    super({ providerName: 'deterministic_md_v1', jurisdictions: ['MD', 'Maryland'], initialMap });
  }
}

/** Multi-provider router — first hit wins; used when multiple providers are configured. */
export class CompositeCitator implements CitatorProvider {
  readonly name = 'composite';
  constructor(private readonly providers: readonly CitatorProvider[]) {}
  lookup(authority: AuthorityRef): CitatorStatus | undefined {
    for (const p of this.providers) {
      const r = p.lookup(authority);
      if (r) return r;
    }
    return undefined;
  }
}
