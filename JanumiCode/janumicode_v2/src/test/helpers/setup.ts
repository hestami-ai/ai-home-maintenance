// Test setup — minimal, env vars only
process.env.JANUMICODE_TEST_SEED = '1337';
process.env.TZ = 'UTC';
// Ensure tests use direct SQLite mode (no sidecar)
process.env.JANUMICODE_DB_MODE = 'direct';
// Scope gatekeeper makes an extra LLM call per bloom round; existing
// mock-LLM tests don't queue gatekeeper responses (predates the
// gatekeeper) and would see their proposer-call counts inflated. Tests
// that specifically exercise the gatekeeper should override this in
// their own beforeEach via `process.env.JANUMICODE_SCOPE_GATEKEEPER = 'on'`.
process.env.JANUMICODE_SCOPE_GATEKEEPER = 'off';
