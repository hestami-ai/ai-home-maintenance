/**
 * Shared helpers for probe test files.
 * Reduces boilerplate for the standardized result logging.
 */

import type { ProbeResult } from './probeRunner';

export function logResult(result: ProbeResult): void {
  console.log(`\n[${result.name}] ${result.success ? 'PASS' : 'FAIL'} (${result.durationMs}ms)`);
  if (result.schemaErrors.length) console.log('  Schema errors:', result.schemaErrors);
  if (result.structuralErrors.length) console.log('  Structural errors:', result.structuralErrors);
  if (result.error) console.log('  Error:', result.error);
  if (result.parsed) {
    console.log(`  Top-level keys: ${Object.keys(result.parsed).join(', ')}`);
  }
}
