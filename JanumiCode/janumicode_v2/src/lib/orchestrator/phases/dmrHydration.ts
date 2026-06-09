/**
 * DMR detail-file hydration.
 *
 * The Deep Memory Research detail file was historically a raw
 * `JSON.stringify(ContextPacket)` dump — material findings as record-id
 * references, materiality-score breakdowns, and placeholder summaries like
 * `[interface_contracts]`. A CLI coding agent (no governed-stream access)
 * cannot dereference any of it, so the side-channel was dead weight.
 *
 * `renderHydratedPacket` replaces that dump with a curated markdown reference
 * that RESOLVES the packet's record-id references into actual content excerpts
 * (interface bodies, data models, …) and foregrounds DMR's genuinely-unique
 * signal — governing-constraint bodies, supersession chains, contradictions.
 *
 * Pure: it takes a `resolve` callback rather than an engine, so it is unit
 * testable and has no DB/FS coupling.
 */

import type { ContextPacket } from '../../agents/deepMemoryResearch';

/** Minimal shape of a resolved governed-stream record. */
export interface ResolvedRecord {
  record_type: string;
  content: Record<string, unknown>;
}

export type RecordResolver = (recordId: string) => ResolvedRecord | null;

export interface HydrateOptions {
  /** Max material findings rendered in full (rest collapse to a footer). */
  maxFindings?: number;
  /** Per-record excerpt character cap. */
  excerptCap?: number;
  /** Overall output character cap (defensive; the detail-file writer also caps). */
  totalCap?: number;
}

const DEFAULTS: Required<HydrateOptions> = {
  maxFindings: 12,
  excerptCap: 1200,
  totalCap: 40_000,
};

/** Record types that are provenance-only (no body worth inlining for an agent). */
const PROVENANCE_TYPES = new Set([
  'decision_trace', 'phase_gate_approved', 'phase_gate_evaluation',
  'mirror_approved', 'mirror_presented', 'decision_bundle_presented',
  'decision_bundle_resolved', 'raw_intent_received',
]);

/** True when a finding summary is an empty or `[label]`-only placeholder. */
function isPlaceholderSummary(summary: string | undefined): boolean {
  if (!summary) return true;
  const t = summary.trim();
  return t.length === 0 || /^\[[^\]]+\]$/.test(t);
}

export function renderHydratedPacket(
  packet: ContextPacket,
  resolve: RecordResolver,
  options: HydrateOptions = {},
): string {
  const opts = { ...DEFAULTS, ...options };
  const out: string[] = [];

  out.push('# Deep Memory Research — Context Reference');
  out.push(
    `_Completeness: ${packet.completenessStatus}. ${oneLine(packet.completenessNarrative)}_\n\n` +
    `_This is a curated reference — read the section relevant to your current step. ` +
    `Authoritative task content is delivered inline in the prompt; this file supplies supporting governing context._`,
  );
  out.push('');

  // ── Governing constraints (resolved bodies) ─────────────────────────
  if (packet.activeConstraints.length > 0) {
    out.push('## Governing Constraints (Authority ≥ 6 — apply without exception)');
    for (const c of packet.activeConstraints) {
      const head = `- **[Auth ${c.authorityLevel}]** ${cleanStatement(c.statement)}`;
      if (isPlaceholderSummary(c.statement) && c.sourceRecordIds[0]) {
        const rec = resolve(c.sourceRecordIds[0]);
        out.push(rec ? `${head}\n${indent(renderRecordExcerpt(rec, opts.excerptCap))}` : head);
      } else {
        out.push(head);
      }
    }
    out.push('');
  }

  // ── Supersession chains (resolved before → after) ───────────────────
  if (packet.supersessionChains.length > 0) {
    out.push('## Supersession Chains (a prior decision was overridden — honor the LATEST)');
    for (const sc of packet.supersessionChains) {
      out.push(`### ${sc.subject}`);
      for (const link of sc.chain) {
        const rec = resolve(link.recordId);
        const label = `- ${link.position}${link.timestamp ? ` (${link.timestamp})` : ''}`;
        out.push(rec ? `${label}: ${oneLine(renderRecordExcerpt(rec, 280))}` : `${label}: ${short(link.recordId)}`);
      }
    }
    out.push('');
  }

  // ── Contradictions ──────────────────────────────────────────────────
  if (packet.contradictions.length > 0) {
    out.push('## Contradictions (unresolved conflicts — escalate rather than guess)');
    for (const c of packet.contradictions) {
      out.push(`- **${c.resolutionStatus}** — ${oneLine(c.explanation)}` +
        (c.resolvedByRecordId ? ` (resolved by ${short(c.resolvedByRecordId)})` : ''));
    }
    out.push('');
  }

  // ── Material findings (top N, resolved one-liners) ──────────────────
  const sorted = [...packet.materialFindings].sort((a, b) => b.materialityScore - a.materialityScore);
  const provenance = sorted.filter(f => PROVENANCE_TYPES.has(f.recordType) && isPlaceholderSummary(f.summary));
  const substantive = sorted.filter(f => !(PROVENANCE_TYPES.has(f.recordType) && isPlaceholderSummary(f.summary)));
  const shown = substantive.slice(0, opts.maxFindings);

  if (shown.length > 0) {
    out.push(`## Most Material Findings (top ${shown.length})`);
    for (const f of shown) {
      let line = `- **${f.recordType}** (Auth ${f.authorityLevel}, ${f.governingStatus})`;
      if (!isPlaceholderSummary(f.summary)) {
        line += `: ${oneLine(f.summary, 200)}`;
      } else {
        const rec = resolve(f.id);
        line += rec ? `: ${oneLine(renderRecordExcerpt(rec, 280))}` : '';
      }
      out.push(line);
    }
    const remaining = substantive.length - shown.length;
    if (remaining > 0) out.push(`- _… +${remaining} more material finding(s) (lower materiality)_`);
    out.push('');
  }

  if (provenance.length > 0) {
    out.push(`_+${provenance.length} provenance record(s) (decision traces / gate approvals) omitted — audit only._`);
  }

  let md = out.join('\n');
  if (md.length > opts.totalCap) {
    md = `${md.slice(0, opts.totalCap)}\n\n_[truncated — hydrated reference exceeded ${opts.totalCap} chars]_`;
  }
  return md;
}

// ── Record excerpt rendering (kind-aware) ─────────────────────────────

/**
 * Compact, agent-readable excerpt of a record's actual content. Kind-aware for
 * the interface kinds (so an agent sees the contract/model/endpoints), with a
 * capped-JSON fallback for everything else.
 */
export function renderRecordExcerpt(rec: ResolvedRecord, cap = 1200): string {
  const c = rec.content ?? {};
  const kind = typeof c.kind === 'string' ? c.kind : rec.record_type;

  let body: string;
  switch (kind) {
    case 'interface_contracts':
      body = renderList(c.contracts, (x) => `${str(x, ['id', 'name'])}: ${str(x, ['protocol', 'data_format', 'type']) || 'contract'}`);
      break;
    case 'api_definitions':
      body = renderList(
        flat(c.definitions, (d) => arr((d as Record<string, unknown>)?.endpoints)),
        (e) => `${(str(e, ['method', 'verb']) || 'GET').toUpperCase()} ${str(e, ['path', 'route']) || '?'}`,
      );
      break;
    case 'data_models':
      body = renderList(
        flat(c.models, (m) => flat(arr((m as Record<string, unknown>)?.entities), (en) => arr((en as Record<string, unknown>)?.fields).map((fl) => ({ en, fl })))),
        (pair) => {
          const { en, fl } = pair as { en: Record<string, unknown>; fl: unknown };
          return `${str(en, ['name', 'id']) || 'Entity'}.${str(fl, ['name', 'id']) || '?'}: ${str(fl, ['type', 'data_type']) || '?'}`;
        },
      );
      break;
    case 'constitutional_invariant':
      body = str(c, ['statement', 'summary']) || jsonCap(c, cap);
      break;
    case 'refactoring_scope':
      body = `${arr(c.refactoring_tasks).length} refactoring task(s); modification_type=${str(c, ['modification_type']) || '?'}`;
      break;
    case 'cross_run_impact_report':
      body = `changed ${str(c, ['interface_kind']) || 'interface'}; ${str(c, ['modification_type']) || '?'}; ` +
        `${arr(c.affected_artifact_ids).length} affected artifact(s)`;
      break;
    default:
      body = str(c, ['statement', 'summary', 'description', 'name']) || jsonCap(c, cap);
  }

  return body.length > cap ? `${body.slice(0, cap)}…` : body;
}

// ── small helpers ─────────────────────────────────────────────────────

function renderList(value: unknown, fmt: (x: unknown) => string, max = 30): string {
  const items = arr(value);
  if (items.length === 0) return '(no members)';
  const rendered = items.slice(0, max).map(fmt).filter(Boolean);
  const more = items.length > max ? ` … (+${items.length - max} more)` : '';
  return rendered.join('; ') + more;
}

function flat(value: unknown, fn: (x: unknown) => unknown[]): unknown[] {
  return arr(value).flatMap(fn);
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(obj: unknown, keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '';
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const val = rec[k];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return '';
}

function jsonCap(v: unknown, cap: number): string {
  let s: string;
  try { s = JSON.stringify(v); } catch { return '(unserializable)'; }
  return s.length > cap ? `${s.slice(0, cap)}…` : s;
}

function cleanStatement(s: string): string {
  return /^\[[^\]]+\]$/.test(s.trim()) ? s.trim().replace(/^\[|\]$/g, '').replace(/_/g, ' ') : s;
}

function oneLine(s: string, cap = 400): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > cap ? `${t.slice(0, cap)}…` : t;
}

function indent(s: string): string {
  return s.split('\n').map(l => `  ${l}`).join('\n');
}

function short(id: string): string {
  return id ? id.slice(0, 8) : '?';
}
