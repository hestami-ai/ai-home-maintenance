# Consolidation probe — ts-125 — model gpt-oss:20b


# Probe 2c-census — what a solid 2c auto-fix must handle (deterministic)

**Divergent-duplicate groups in the workspace: 9**

## group: stats  (3 divergent copies)
  - src/services/api-service/routes/stats.js  [ESM/async]  exports: {handleStats}
  - src/services/click-counter-service/routes/stats.js  [ESM/async]  exports: {}
  - src/services/click-counter-service/stats.js  [ESM/async]  exports: {handleStats}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## group: audit-log-service  (2 divergent copies)
  - src/services/api-service/services/audit-log-service.js  [ESM/async]  exports: {auditLogService}
  - src/services/redirect-service/services/audit-log-service.js  [ESM/async]  exports: {log, getLogs, getLogsAll}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## group: click-counter-service  (2 divergent copies)
  - src/services/api-service/services/click-counter-service.js  [ESM/async]  exports: {incrementClickCount, getLastClickTimestamp, resetClickCount, deleteClickStats, resetAllClickCounts}
  - src/services/redirect-service/services/click-counter-service.js  [ESM/async]  exports: {getClickCount, incrementClickCount, getClickHistory}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 1 (module systems among importers: CJS; tests among them: 0)

## group: encryption-service  (3 divergent copies)
  - src/services/api-service/services/encryption-service.js  [ESM/sync]  exports: {encryptUrl, decryptUrl, isEncrypted, validateUrl}
  - src/services/encryption-service/encryption-service.js  [CJS/async]  exports: {encryptUrl, decryptUrl, createEncryptedStorage, createStorageRetriever}
  - src/services/redirect-service/services/encryption-service.js  [ESM/sync]  exports: {encryptUrl, decryptUrl, isEncrypted, validateUrl}
  conflicts → export-surface differs: true | module-system split: true (ESM/CJS) | sync-vs-async split: true
  importers: 1 (module systems among importers: CJS; tests among them: 0)

## group: storage-service  (2 divergent copies)
  - src/services/api-service/services/storage-service.js  [ESM/async]  exports: {pool, createEntry, readEntry, deleteEntry, logAuditEntry, getAuditLog, resetDatabase}
  - src/services/redirect-service/services/storage-service.js  [ESM/async]  exports: {getURLBySlug, createMapping, deleteMapping}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 1 (module systems among importers: CJS; tests among them: 0)

## group: database  (2 divergent copies)
  - src/services/api-service/tests/mocks/database.js  [ESM/async]  exports: {createMockDatabase, getMockDatabase, resetMockDatabase}
  - src/services/click-counter-service/database.js  [ESM/async]  exports: {isMockMode, createPool, getPool, pool, mockPool}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## group: logger  (3 divergent copies)
  - src/services/api-service/utils/logger.js  [ESM/sync]  exports: {log, debug, info, warn, error}
  - src/services/click-counter-service/logger.js  [ESM/sync]  exports: {}
  - src/services/performance-service/alerting/logger.js  [ESM/sync]  exports: {loggerFunctions}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## group: config  (2 divergent copies)
  - src/services/encryption-service/config.js  [CJS/sync]  exports: {aesKey}
  - src/services/performance-service/alerting/config.js  [ESM/sync]  exports: {opsChannelUrl, latencyThresholdMs, metricsEndpoint, logLevel, port, host}
  conflicts → export-surface differs: true | module-system split: true (CJS/ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## group: metrics  (2 divergent copies)
  - src/services/performance-service/latency-instrumentation/metrics.js  [ESM/sync]  exports: {metrics}
  - src/services/performance-service/latency-instrumentation/routes/metrics.js  [ESM/sync]  exports: {}
  conflicts → export-surface differs: true | module-system split: false (ESM) | sync-vs-async split: false
  importers: 0 (module systems among importers: n/a; tests among them: 0)

## What a solid 2c auto-fix must handle (derived from the census)
- 9 duplicate groups, 9 with real conflicts (export-surface / module-system / sync-async).
- 3 import sites across 1 files to rewrite (relative paths differ per importer → must recompute each).
- Module-system interop: importers mix ESM/CJS → a single canonical module needs interop or per-importer conversion.
- Sync/async signature reconciliation where copies disagree (the original encryptUrl bug class).
- Test files among importers must be repointed and must still pass — behavioral equivalence, not just symbol presence.
- LLM is good at SYNTHESIS (canonical module); the above APPLICATION work is deterministic AST/path-rewriting (no such tooling in repo yet).
