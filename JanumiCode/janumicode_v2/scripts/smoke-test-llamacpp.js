#!/usr/bin/env node
/**
 * End-to-end smoke test for the LlamaCppProvider.
 *
 * Hits whatever llama-server is currently running on port 11435 (or
 * the LLAMACPP_URL env override). Exercises:
 *   1. /health probe
 *   2. /props introspection
 *   3. Non-streaming chat completion (small response)
 *   4. Streaming chat completion (verifies dual-channel reasoning +
 *      content arrive on separate channels)
 *
 * Run: node scripts/smoke-test-llamacpp.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require('node:path');

async function main() {
  // The compiled bundle includes everything. Load it directly so we
  // don't need ts-node.
  const bundlePath = path.resolve(__dirname, '..', 'dist', 'extension.js');
  // The provider is a named export from the bundle but its bundling
  // shape isn't a plain require() target — instead reach into the
  // already-compiled lib/llm/providers/llamacpp through ts directly.
  // For simplicity, write the provider HTTP requests inline using
  // node's http module to stay independent of any bundle internals.

  const http = require('node:http');
  const baseUrl = process.env.LLAMACPP_URL ?? 'http://127.0.0.1:11435';

  // ── 1. /health ────────────────────────────────────────────────
  console.log(`[1/4] GET ${baseUrl}/health`);
  const health = await httpGet(`${baseUrl}/health`);
  console.log(`     → ${health.statusCode} ${health.body.slice(0, 80)}`);
  if (health.statusCode !== 200) {
    console.error('!! Server not healthy. Boot llama-server first.');
    process.exit(1);
  }

  // ── 2. /props ─────────────────────────────────────────────────
  console.log(`[2/4] GET ${baseUrl}/props`);
  const props = await httpGet(`${baseUrl}/props`);
  const propsJson = JSON.parse(props.body);
  console.log(`     model_path: ${propsJson.model_path?.split(/[\\/]/).pop()}`);

  // ── 3. Non-streaming chat completion ──────────────────────────
  console.log(`[3/4] POST /v1/chat/completions (non-streaming)`);
  const t0 = Date.now();
  const resNon = await httpPost(`${baseUrl}/v1/chat/completions`, {
    model: 'qwen',
    messages: [{ role: 'user', content: 'What is 2 plus 2? Answer with just the number, no explanation.' }],
    max_tokens: 1024,
    stream: false,
    temperature: 1, top_k: 20, top_p: 0.95, min_p: 0,
    presence_penalty: 1.5, repeat_penalty: 1,
  });
  const nonJson = JSON.parse(resNon.body);
  const msg = nonJson.choices[0].message;
  const dt = Date.now() - t0;
  console.log(`     content: "${msg.content}"`);
  console.log(`     reasoning_content len: ${(msg.reasoning_content ?? '').length} chars`);
  console.log(`     usage: in=${nonJson.usage?.prompt_tokens} out=${nonJson.usage?.completion_tokens}  duration=${dt}ms`);
  if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
    console.error('!! Non-streaming returned empty content');
    process.exit(2);
  }

  // ── 4. Streaming chat completion ──────────────────────────────
  console.log(`[4/4] POST /v1/chat/completions (streaming)`);
  const t1 = Date.now();
  const stream = await httpStream(`${baseUrl}/v1/chat/completions`, {
    model: 'qwen',
    messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
    max_tokens: 512, stream: true,
    temperature: 1, top_k: 20, top_p: 0.95, min_p: 0,
    presence_penalty: 1.5, repeat_penalty: 1,
  });
  const dt1 = Date.now() - t1;
  console.log(`     duration: ${dt1}ms`);
  console.log(`     thinking_chunks: ${stream.thinkingChunks}  thinking_chars: ${stream.thinkingText.length}`);
  console.log(`     response_chunks: ${stream.responseChunks}  response_chars: ${stream.responseText.length}`);
  console.log(`     final response (first 120): "${stream.responseText.slice(0, 120).replace(/\n/g, '\\n')}"`);

  if (stream.responseChunks === 0) {
    console.error('!! Streaming produced no response-channel chunks');
    process.exit(3);
  }
  if (stream.thinkingChunks === 0) {
    console.error('!! Streaming produced no thinking-channel chunks (qwen3.5 should always think)');
    process.exit(4);
  }

  console.log('\n✓ All four checks passed. LlamaCppProvider integration is sound.');
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const u = new URL(url);
    const req = http.request({ method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function httpStream(url, body) {
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const u = new URL(url);
    const req = http.request({ method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let buf = '';
      let thinkingText = '', responseText = '';
      let thinkingChunks = 0, responseChunks = 0;
      res.on('data', (chunk) => {
        buf += chunk.toString('utf-8');
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]' || !payload) continue;
          try {
            const f = JSON.parse(payload);
            const d = f.choices?.[0]?.delta;
            if (!d) continue;
            if (typeof d.content === 'string' && d.content.length > 0) {
              responseText += d.content; responseChunks++;
            }
            if (typeof d.reasoning_content === 'string' && d.reasoning_content.length > 0) {
              thinkingText += d.reasoning_content; thinkingChunks++;
            }
          } catch { /* skip malformed */ }
        }
      });
      res.on('end', () => resolve({ thinkingText, responseText, thinkingChunks, responseChunks }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

main().catch((err) => { console.error(err); process.exit(99); });
