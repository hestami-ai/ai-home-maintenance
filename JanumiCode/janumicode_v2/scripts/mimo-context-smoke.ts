/**
 * A/B context-survival probe: does mimo TRUNCATE a large prompt to the model's
 * declared `limit.context` before sending it to the model? Sends a ~50KB prompt
 * with a unique token at the VERY END and asks the model to echo it. If the
 * token only survives when the declared context is large, mimo truncates input
 * to limit.context (the constitution-truncation hypothesis), and declaring the
 * real window is the fix.
 *
 *   # small declared window → expect token DROPPED if mimo truncates
 *   JANUMICODE_MIMO_OPENAI_CONTEXT=8192   npx tsx scripts/mimo-context-smoke.ts
 *   # real window → expect token SURVIVES
 *   JANUMICODE_MIMO_OPENAI_CONTEXT=262144 npx tsx scripts/mimo-context-smoke.ts
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveMimoConfig, MimoServerManager } from '../src/lib/cli/mimo/mimoServerManager';
import { parseModelRef } from '../src/lib/cli/mimo/mimoClient';

const TOKEN = 'ZEBRA7741XK';

function buildLargePrompt(): string {
  const head = `You are given a long document. There is a VERIFICATION TOKEN on the LAST line.\nIgnore the document body. Your ONLY job: reply with exactly the VERIFICATION TOKEN value and nothing else.\n\n--- DOCUMENT START ---\n`;
  // ~50KB of filler (well over an 8192-token window, well under 262144).
  const lines: string[] = [];
  for (let i = 0; i < 1200; i++) {
    lines.push(`Line ${i}: this is filler content describing engineering craft standards, comments, naming, and testing discipline that the agent must read carefully and apply proportionally to the task at hand.`);
  }
  const tail = `\n--- DOCUMENT END ---\nVERIFICATION TOKEN: ${TOKEN}\n`;
  return head + lines.join('\n') + tail;
}

async function main(): Promise<void> {
  process.env.JANUMICODE_MIMO_MODEL ??= 'ollama-local/gemma4:26b-a4b-it-qat';
  const declaredCtx = process.env.JANUMICODE_MIMO_OPENAI_CONTEXT ?? '262144';
  const cfg = resolveMimoConfig();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-mimo-ctx-'));
  const prompt = buildLargePrompt();
  console.log(`[ctx-smoke] model=${cfg.model} declaredContext=${declaredCtx} promptChars=${prompt.length} (~${Math.round(prompt.length / 4)} tokens)`);

  const { client } = await MimoServerManager.ensure(root, cfg);
  const sessionId = await client.createSession();
  console.log('[ctx-smoke] sending large prompt (token is on the LAST line)…');

  let finalText = '';
  const ac = new AbortController();
  void (async () => {
    try {
      for await (const ev of client.streamEvents(ac.signal)) {
        if (ev.type === 'message.part.delta') {
          const p = ev.properties as { field?: string; delta?: string };
          if (p.field === 'text' && typeof p.delta === 'string') finalText += p.delta;
        }
      }
    } catch { /* aborted */ }
  })();

  const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 300_000).unref?.());
  try {
    const res = await Promise.race([
      client.sendMessage(sessionId, { agent: cfg.agent, model: parseModelRef(cfg.model), text: prompt }),
      timer,
    ]);
    finalText += ` ${(res as { finish: string }).finish}`;
  } catch (e) {
    console.error('[ctx-smoke] turn error:', e instanceof Error ? e.message : String(e));
  } finally {
    ac.abort();
    MimoServerManager.shutdown(root);
  }

  const survived = finalText.includes(TOKEN);
  console.log(`[ctx-smoke] model response (last 200 chars): ${finalText.slice(-200).replace(/\s+/g, ' ')}`);
  console.log(`[ctx-smoke] declaredContext=${declaredCtx} → END-of-prompt token ${survived ? '✅ SURVIVED (full prompt reached the model)' : '❌ DROPPED (prompt was truncated before the model)'}`);
  process.exit(survived ? 0 : 1);
}

main().catch((e) => { console.error('[ctx-smoke] crashed:', e); process.exit(2); });
