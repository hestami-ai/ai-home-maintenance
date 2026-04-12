// Test setup — minimal, env vars only
process.env.JANUMICODE_TEST_SEED = '1337';
process.env.TZ = 'UTC';
// Ensure tests use direct SQLite mode (no sidecar)
process.env.JANUMICODE_DB_MODE = 'direct';
