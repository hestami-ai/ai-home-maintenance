/**
 * Fixture discovery + validation. Used by both the deterministic and
 * live test files plus the CLI entry points.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { FixtureSchema, type Fixture } from './fixtureSchema.js';

export const FIXTURE_DIR = resolve(__dirname, 'fixtures');

export interface LoadedFixture {
  fixture: Fixture;
  path: string;
}

export function loadFixtures(filterSubPhases?: Set<string>): Map<string, LoadedFixture> {
  const out = new Map<string, LoadedFixture>();
  let entries: string[];
  try {
    entries = readdirSync(FIXTURE_DIR);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.endsWith('.fixture.json')) continue;
    const fullPath = join(FIXTURE_DIR, name);
    const raw = readFileSync(fullPath, 'utf-8');
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Fixture ${fullPath} is not valid JSON: ${(err as Error).message}`);
    }
    const parsed = FixtureSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('\n');
      throw new Error(`Fixture ${fullPath} failed schema validation:\n${issues}`);
    }
    const fixture = parsed.data;
    if (filterSubPhases && !filterSubPhases.has(fixture.template_ref.sub_phase)) continue;
    out.set(fixture.fixture_id, { fixture, path: fullPath });
  }
  return out;
}

/**
 * Load a single fixture by absolute path. Used by the acceptance
 * harness which addresses fixtures by registered path rather than
 * discovering all of them.
 */
export function loadFixture(absPath: string): Fixture {
  const raw = readFileSync(absPath, 'utf-8');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Fixture ${absPath} is not valid JSON: ${(err as Error).message}`);
  }
  const parsed = FixtureSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Fixture ${absPath} failed schema validation:\n${issues}`);
  }
  return parsed.data;
}

export function parseTemplateFilter(env: string | undefined): Set<string> | undefined {
  if (!env) return undefined;
  const items = env.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? new Set(items) : undefined;
}
