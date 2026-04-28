/**
 * Regression tests for normalizeTechnicalConstraints (Phase 1.0c).
 *
 * Background — silent loss of every technical constraint:
 *   The 1.0c prompt template asks for `text` as the canonical
 *   constraint description. qwen3.5-35b-a3b (and likely other mid-size
 *   open models) routinely returns items without a `text` field —
 *   content lives in `rationale`, source quote in
 *   `source_ref.excerpt`. The original normalizer's
 *   `.filter(t => t.text.length > 0)` then dropped every captured
 *   constraint. cal-22b shipped 21 LLM-extracted technical constraints
 *   (TECH-SVELTEKIT-1, TECH-BUN-1, TECH-POSTGRES-1, TECH-DBOS-1, ...)
 *   and persisted zero. Downstream phases reinvented Python/FastAPI
 *   defaults because the active-constraints channel was empty.
 *
 * The fix is a fallback chain (text → rationale → source_ref.excerpt →
 * technology) before deciding to drop. These tests pin both halves —
 * (a) constraints with `text` keep using it, (b) constraints without
 * `text` are recovered from the alternates rather than silently lost.
 */

import { describe, it, expect } from 'vitest';
import { normalizeTechnicalConstraints, normalizeSourceRef } from '../../../../lib/orchestrator/phases/phase1Normalizers';

describe('normalizeTechnicalConstraints', () => {
  it('keeps the canonical `text` field when present', () => {
    const out = normalizeTechnicalConstraints([
      { id: 'TECH-CDN-1', category: 'cdn', text: 'Cloudflare CDN is the only public entry point.' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Cloudflare CDN is the only public entry point.');
    expect(out[0].id).toBe('TECH-CDN-1');
  });

  it('falls back to `rationale` when `text` is missing — the cal-22b LLM shape', () => {
    // This is the exact shape qwen3.5-35b-a3b emits: no `text`,
    // descriptive content lives in `rationale`. The pre-fix
    // normalizer dropped every one of these.
    const out = normalizeTechnicalConstraints([
      {
        id: 'TECH-SVELTEKIT-1',
        category: 'frontend',
        technology: 'SvelteKit',
        rationale: 'Stated as the framework for web-based portals.',
        source_ref: {
          document_path: 'specs/Hestami AI Real Property OS and Platform Product Description.md',
          section_heading: 'Core Technological Infrastructure and Stack - High-Level Architecture Table',
          excerpt: '| **Frontend** | SvelteKit | Used for the web-based admin, staff, ...',
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Stated as the framework for web-based portals.');
    expect(out[0].technology).toBe('SvelteKit');
    expect(out[0].rationale).toBe('Stated as the framework for web-based portals.');
  });

  it('falls back to `source_ref.excerpt` when both `text` and `rationale` are missing', () => {
    const out = normalizeTechnicalConstraints([
      {
        id: 'TECH-POSTGRES-1',
        category: 'database',
        technology: 'PostgreSQL',
        source_ref: {
          document_path: 'specs/x.md',
          excerpt: 'PostgreSQL with Row-Level Security for tenant isolation.',
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('PostgreSQL with Row-Level Security for tenant isolation.');
  });

  it('falls back to `technology` as last resort when nothing else has content', () => {
    const out = normalizeTechnicalConstraints([
      { id: 'TECH-BUN-1', category: 'backend', technology: 'Bun' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Bun');
  });

  it('drops items where every fallback path is empty', () => {
    // Genuinely unfounded captures (no text, no rationale, no excerpt,
    // no technology) still get filtered out — preserves the original
    // intent of "don't persist content the model couldn't ground."
    const out = normalizeTechnicalConstraints([
      { id: 'TECH-NULL-1', category: 'uncategorized' },
      { id: 'TECH-NULL-2', category: 'uncategorized', source_ref: { document_path: 'x.md' } /* missing excerpt */ },
    ]);
    expect(out).toHaveLength(0);
  });

  it('preserves the cal-22b fixture: 21 LLM-emitted constraints all reach the persisted set', () => {
    // The exact failure mode that broke cal-22b. Pre-fix this
    // returned []; post-fix all 21 must come through with non-empty
    // text. If a future regression reintroduces strict text-only
    // filtering, this test fires immediately.
    const cal22bShape = [
      { id: 'TECH-CLOUDFLARE-1', category: 'cdn', technology: 'Cloudflare', rationale: 'Stated as the only public entry point.' },
      { id: 'TECH-TLS-1', category: 'security', technology: 'TLS', rationale: 'TLS connection between Cloudflare and origin.' },
      { id: 'TECH-ORIGIN-ACCESS-1', category: 'security', rationale: 'Origin host access locked to Cloudflare egress.' },
      { id: 'TECH-UBUNTU-1', category: 'deployment', technology: 'Ubuntu Linux' },
      { id: 'TECH-DOCKER-COMPOSE-1', category: 'deployment', technology: 'Docker Compose' },
      { id: 'TECH-TRAEFIK-1', category: 'cdn', technology: 'Traefik' },
      { id: 'TECH-SVELTEKIT-1', category: 'frontend', technology: 'SvelteKit', rationale: 'Stated as the framework for web-based portals.' },
      { id: 'TECH-NATIVE-MOBILE-1', category: 'mobile', technology: 'Native iOS and Android' },
      { id: 'TECH-BUN-1', category: 'backend', technology: 'Bun', rationale: 'Stated as the runtime for high-performance API execution.' },
      { id: 'TECH-DBOS-1', category: 'workflow_engine', technology: 'DBOS' },
      { id: 'TECH-POSTGRES-1', category: 'database', technology: 'PostgreSQL', rationale: 'PostgreSQL with RLS for multi-tenant isolation.' },
      { id: 'TECH-ORPC-1', category: 'integration_protocol', technology: 'oRPC' },
      { id: 'TECH-CERBOS-1', category: 'identity', technology: 'Cerbos' },
      { id: 'TECH-BETTER-AUTH-1', category: 'identity', technology: 'Better-Auth' },
      { id: 'TECH-OPENTELEMETRY-1', category: 'monitoring', technology: 'OpenTelemetry' },
      { id: 'TECH-SIGNOZ-1', category: 'monitoring', technology: 'SigNoz' },
      { id: 'TECH-SEAWEDFS-1', category: 'database', technology: 'SeaweedFS' },
      { id: 'TECH-TUSD-1', category: 'integration_protocol', technology: 'tusd' },
      { id: 'TECH-CLAMAV-1', category: 'security', technology: 'ClamAV' },
      { id: 'TECH-FFMPEG-1', category: 'integration_protocol', technology: 'FFmpeg' },
      { id: 'TECH-EXIFTOOL-1', category: 'integration_protocol', technology: 'ExifTool' },
    ];
    const out = normalizeTechnicalConstraints(cal22bShape);
    expect(out).toHaveLength(21);
    for (const c of out) {
      expect(c.text.length).toBeGreaterThan(0);
    }
    // Spot-check the load-bearing trio for downstream phases. The
    // technology name itself surfaces via the `technology` field; the
    // free-form text comes from rationale or excerpt fallbacks.
    expect(out.find(c => c.id === 'TECH-SVELTEKIT-1')?.technology).toBe('SvelteKit');
    expect(out.find(c => c.id === 'TECH-BUN-1')?.technology).toBe('Bun');
    expect(out.find(c => c.id === 'TECH-POSTGRES-1')?.technology).toBe('PostgreSQL');
  });

  it('still assigns sequential fallback IDs when the LLM omits id', () => {
    const out = normalizeTechnicalConstraints([
      { category: 'frontend', technology: 'SvelteKit' },
      { category: 'backend', technology: 'Bun' },
    ]);
    expect(out[0].id).toBe('TECH-1');
    expect(out[1].id).toBe('TECH-2');
  });

  it('preserves source_ref provenance through normalization', () => {
    const out = normalizeTechnicalConstraints([
      {
        id: 'TECH-X-1',
        category: 'database',
        text: 'X is the database.',
        source_ref: {
          document_path: 'spec.md',
          section_heading: 'Stack',
          excerpt: 'X is the database.',
        },
      },
    ]);
    expect(out[0].source_ref?.document_path).toBe('spec.md');
    expect(out[0].source_ref?.excerpt).toBe('X is the database.');
    expect(out[0].source_ref?.section_heading).toBe('Stack');
  });
});

describe('normalizeSourceRef', () => {
  it('returns undefined when document_path or excerpt is missing', () => {
    expect(normalizeSourceRef(null)).toBeUndefined();
    expect(normalizeSourceRef({})).toBeUndefined();
    expect(normalizeSourceRef({ document_path: 'x.md' })).toBeUndefined();
    expect(normalizeSourceRef({ excerpt: 'foo' })).toBeUndefined();
  });

  it('preserves all provided fields when document_path and excerpt are present', () => {
    const out = normalizeSourceRef({
      document_path: 'a/b.md', section_heading: 'Heading', excerpt: 'quote',
      excerpt_start: 10, excerpt_end: 20,
    });
    expect(out).toEqual({
      document_path: 'a/b.md', section_heading: 'Heading', excerpt: 'quote',
      excerpt_start: 10, excerpt_end: 20,
    });
  });
});
