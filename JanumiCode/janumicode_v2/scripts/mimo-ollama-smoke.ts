/**
 * Live smoke: prove `mimo serve` drives a TOOL-USING turn through a LOCAL Ollama
 * model (via the synthesized `ollama-local` openai-compatible provider) — no
 * Xiaomi cloud involved. Success = the agent writes `hello.txt` into the project
 * root using its file-write tool, proving tool_call flows over Ollama's `/v1`.
 *
 *   JANUMICODE_MIMO_MODEL=ollama-local/qwen3.5:9b npx tsx scripts/mimo-ollama-smoke.ts
 *
 * Env: JANUMICODE_MIMO_MODEL (default ollama-local/qwen3.5:9b), JANUMICODE_MIMO_AGENT
 * (default compose), JANUMICODE_MIMO_SMOKE_TIMEOUT_S (default 720).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveMimoConfig, MimoServerManager } from '../src/lib/cli/mimo/mimoServerManager';
import { parseModelRef } from '../src/lib/cli/mimo/mimoClient';

async function main(): Promise<void> {
  process.env.JANUMICODE_MIMO_MODEL ??= 'ollama-local/qwen3.5:9b';
  const cfg = resolveMimoConfig();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-mimo-smoke-'));
  const target = path.join(root, 'hello.txt');
  const timeoutMs = Number(process.env.JANUMICODE_MIMO_SMOKE_TIMEOUT_S ?? 720) * 1000;
  console.log(`[smoke] model=${cfg.model} agent=${cfg.agent} root=${root}`);

  const { client } = await MimoServerManager.ensure(root, cfg);
  console.log('[smoke] server ready; opening event stream');

  // Surface tool activity so we can see the model actually calling tools.
  const ac = new AbortController();
  void (async () => {
    try {
      for await (const ev of client.streamEvents(ac.signal)) {
        if (/tool|message\.part|session\.(idle|error)|error/i.test(ev.type)) {
          const p = ev.properties as Record<string, unknown>;
          const tag = p.tool ?? p.field ?? p.error ?? '';
          console.log(`[sse] ${ev.type}${tag ? ' · ' + JSON.stringify(tag).slice(0, 120) : ''}`);
        }
      }
    } catch { /* aborted on completion */ }
  })();

  const sessionId = await client.createSession();
  const prompt = 'Create a single file named hello.txt in the current directory whose entire contents are exactly: HELLO FROM OLLAMA. Then stop.';
  console.log('[smoke] sending turn (POST blocks until the agent finishes)…');

  const turn = client.sendMessage(sessionId, { agent: cfg.agent, model: parseModelRef(cfg.model), text: prompt });
  const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`smoke timed out after ${timeoutMs / 1000}s`)), timeoutMs).unref?.());

  let ok = false;
  try {
    const res = await Promise.race([turn, timer]);
    console.log(`[smoke] turn finished: finish=${(res as { finish: string }).finish}`);
    ok = fs.existsSync(target) && /HELLO FROM OLLAMA/i.test(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    console.error('[smoke] FAILED:', err instanceof Error ? err.message : String(err));
    await client.abort(sessionId).catch(() => {});
  } finally {
    ac.abort();
    MimoServerManager.shutdown(root);
  }

  if (ok) {
    console.log(`[smoke] ✅ PASS — ${target} written with expected content via local Ollama tool_call`);
    process.exit(0);
  }
  console.error(`[smoke] ❌ FAIL — ${target} ${fs.existsSync(target) ? 'has wrong content' : 'was not written'}`);
  process.exit(1);
}

main().catch((e) => { console.error('[smoke] crashed:', e); process.exit(1); });
