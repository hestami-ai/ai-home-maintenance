// @janumipwb/rph-contracts — the machine-contract seam.
// Single Zod source → TS types + JSON Schema (Draft 2020-12). Envelope, ids, enums, errors, validation.
//
// NOTE: hash.ts (contentHash / canonicalJson / sha256Hex) is deliberately NOT re-exported from this barrel — it
// imports `node:crypto`, so keeping it out keeps `@janumipwb/rph-contracts` browser-safe (a browser surface can
// value-import enums/ids/schemas/types without pulling a Node builtin). Node consumers that need hashing import
// it from the subpath: `@janumipwb/rph-contracts/hash`.
export const RPH_CONTRACTS_VERSION = '0.0.0';

export * from './common.js';
export * from './ids.js';
export * from './enums.js';
export * from './errors.js';
export * from './envelopes.js';
// ⭑ AHEAD OF `objects.js`, WHICH IMPORTS IT. The barrel's order does not drive module evaluation — the
//   importing module does — but keeping a dependency ahead of its dependent keeps this file readable as a
//   layering rather than as an alphabet.
export * from './record-plane-bounds.js';
export * from './objects.js';
export * from './messages.js';
export * from './validate.js';
