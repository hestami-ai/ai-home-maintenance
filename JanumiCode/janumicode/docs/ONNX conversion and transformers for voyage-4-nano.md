Tell me more about: ONNX conversion \+ transformers.js (not yet viable) Convert voyage-4-nano to ONNX, then load via @huggingface/transformers in Node.js. This is the ideal path but is blocked by trust\_remote\_code=True — the custom architecture would need manual ONNX export and validation. The onnx-community on HuggingFace hasn't published a conversion yet. Pro: Would be the cleanest in-process solution. Con: Doesn't exist yet. 340M params is large for in-process VS Code extension inference.  
Thought for 34s

Here’s what’s really going on with the “ONNX conversion \+ transformers.js” path for **voyage-4-nano**, what was blocked before, and what’s changed recently.

## **1\) Why `trust_remote_code=True` blocks the *clean* JS path**

`trust_remote_code=True` is a **Python-side** Hugging Face Transformers mechanism that says: “to load this model correctly, you must execute custom modeling code shipped in the model repo (via `auto_map`, custom `modeling_*.py`, etc.).” That’s normal for architectures that aren’t fully supported as a first-class `transformers` model type.

For **voyage-4-nano**, the custom code matters because it’s not just “Qwen3”; it’s essentially a **bidirectional Qwen3** variant (embedding model) with custom attention-mask behavior. If you load it without the remote code, you can end up with a *wrong* causal behavior instead of an explicit error.

**Transformers.js** (JS) does *not* run arbitrary Python modeling code. It runs **ONNX graphs** through ONNX Runtime. So the “blocked by `trust_remote_code`” statement is basically: *you can’t just point transformers.js at the original PyTorch weights and expect it to instantiate the architecture.*

That leads to the ideal plan you described:

Export to ONNX (freezing the exact forward pass into a static graph) → load the ONNX in Node via `@huggingface/transformers`.

…and the remaining work would have been “manual ONNX export \+ validation” for a custom architecture (exactly what HF describes for unsupported architectures).

## **2\) The status update: the ONNX conversion *now exists* (as of Feb 2026\)**

Contrary to the “onnx-community hasn’t published it yet” assumption: there **is** now an ONNX community repo:

* `onnx-community/voyage-4-nano-ONNX`

It includes multiple weight formats with very relevant sizes for in-process inference:

* `model_fp16.onnx_data` \~703 MB  
* `model_q4.onnx_data` \~243 MB  
* `model_q4f16.onnx_data` \~211 MB  
* `model_quantized.onnx_data` \~422 MB

So the “doesn’t exist yet” part is no longer true; what *may still be true* is “not viable inside a VS Code extension for UX/perf reasons.”

## **3\) What transformers.js buys you (and what it doesn’t)**

Transformers.js runs ONNX Runtime under the hood. The docs explicitly position it as “convert to ONNX (often via Optimum) then run.”

**What you gain:**

* No Python runtime in the extension host.  
* No `trust_remote_code` problem, because you’re executing a graph, not instantiating custom classes.  
* You can choose quantized variants (Q4 / mixed Q4F16 / etc.) to reduce RAM \+ bandwidth.

**What you don’t automatically get:**

* A guarantee that the ONNX export matches the reference PyTorch model *for your exact pooling / truncation / normalization behavior*. For embedding models, “looks close” isn’t good enough—you usually want explicit validation tests (cosine similarity drift, top-k recall stability, etc.). HF calls this out as a core step in custom exports.

## **4\) Practical Node.js usage (what “clean in-process” looks like)**

Because the ONNX repo is tagged as **Feature Extraction**, the most natural transformers.js usage is `pipeline('feature-extraction', ...)`.

Example (Node.js):

import { pipeline } from "@huggingface/transformers";

// For embeddings, feature-extraction is typically the right pipeline.  
const extractor \= await pipeline(  
 "feature-extraction",  
 "onnx-community/voyage-4-nano-ONNX",  
 {  
   // You’ll likely want a quantized variant for a VS Code extension:  
   // revision can be used if you pin a commit; otherwise select via model files.  
 }  
);

const text \= "Represent the query for retrieving supporting documents: Which planet is known as the Red Planet?";  
const out \= await extractor(text, { pooling: "mean", normalize: true });

console.log(out.length); // e.g. embedding dimensionality

Notes:

* The *model card* for the ONNX repo shows direct ONNX Runtime usage returning `last_hidden_state` \+ `pooler_output`, which hints that you’ll want to be explicit about how you derive the final embedding (mean pooling, using pooler output, normalization, truncation dims, etc.).  
* For voyage-4-nano specifically, prompts matter (query vs document prompt prefixes), so you’ll want a thin wrapper that enforces the right prompt templates consistently.

## **5\) The real “viability” constraint for a VS Code extension**

Even with quantization, **you’re still shipping or downloading hundreds of MB**, then doing CPU inference in the extension host (unless you offload to WebGPU in a webview context, which is a different architecture and still has rough edges).

Key constraints you’ll hit:

* **Cold start & download:** 200–700MB artifacts are brutal for a “user installed an extension and expects it to work now” experience. (You can lazy-download, but then you’re building an asset manager.)  
* **Memory pressure:** VS Code extension host is not where you want to allocate big contiguous buffers \+ ORT arenas while the editor is open with other extensions.  
* **Latency:** Embedding throughput on CPU can be “fine” for occasional calls, but will feel laggy if you do interactive embedding (search-as-you-type, background indexing, etc.).  
* **Packaging pain:** transformers.js \+ ONNX Runtime can be chunky, and native runtimes complicate cross-platform distribution (Windows/macOS/Linux, glibc variants, etc.). (Transformers.js is explicitly built on ONNX Runtime.)

So: **the ONNX \+ transformers.js route is now technically unblocked**, but “in-process VS Code extension inference” is still a product/UX trade.

## **6\) A pragmatic decision rule**

If your VS Code feature is:

* **Occasional, user-triggered embeddings** (e.g., “embed current file” / “embed selection”) → try ONNX quantized (`model_q4f16` is the smallest listed)  
* **Continuous indexing / background retrieval / multi-file workspace embedding** → you probably want a **sidecar** (local service / separate process) or a remote API, because extension-host CPU+RAM+download constraints will become the limiting factor.

If you tell me your target interaction pattern (one-off embeds vs continuous indexing) and whether you can tolerate a sidecar, I can outline an “extension-host vs sidecar vs webview/WebGPU” architecture with concrete failure modes and mitigations.

It doesn't need to run in the VS Code Extension memory or process space. This could be a CLI type tool that the extension calls. The host machine could have a relevant GPU with CPU as fallback. I think the expectation is that the external dependencies such as Python, CUDA drivers, etc. would be installed by the host machine administrator.

Good — that removes the hardest constraint (extension-host RAM/CPU/packaging) and turns this into a **local “embedding runtime” service** problem. In that world, ONNX becomes much more viable, and you can make GPU a first-class path with CPU fallback.

Below is a design that’s realistic to ship and operate on admin-managed machines, while still being extension-friendly.

---

## **1\) Recommended shape: Extension → CLI (or daemon) → embeddings**

### **Two viable topologies**

**A) Pure CLI (one-shot)**

* VS Code extension shells out:  
  * `voyage-embed embed --input file.txt --format jsonl`  
* Pros: simplest deployment \+ security model (no resident process).  
* Cons: repeated cold-start overhead if each call loads model weights.

**B) Local daemon \+ thin CLI**

* Extension shells out to a *thin* CLI that calls a local daemon over localhost:  
  * `voyage-embed embed ...` → talks to `http://127.0.0.1:PORT/embed`  
* Pros: amortizes model load; lower latency; can batch requests; easier caching.  
* Cons: service lifecycle, port mgmt, health checks.

If you plan to embed lots of files (workspace indexing), **daemon wins**.

---

## **2\) Runtime stack options (GPU-first, CPU fallback)**

You have 3 practical “engines” for this specific situation:

### **Option 1 — Python \+ ONNX Runtime (GPU/CPU)**

**Best general-purpose path.**

* Use `onnxruntime-gpu` when CUDA is present; fallback to `onnxruntime` CPU.  
* Load the community ONNX export of `voyage-4-nano` (quantized variant ideally).  
* Tokenization can be:  
  * Hugging Face `tokenizers` (fast Rust-backed) in Python, or  
  * the repo’s tokenizer if it’s standard. (Most “trust\_remote\_code” pain is on the *model*, not the tokenizer.)

Why this is attractive:

* No JS packaging pain.  
* Straightforward GPU detection (`CUDAExecutionProvider` availability).  
* Easy to build “validation mode” to check embedding drift.

### **Option 2 — Python \+ PyTorch (remote-code load) \+ export/cache ONNX**

**If you don’t fully trust the community ONNX.**

* On first run, in a controlled environment:  
  * load the model with `trust_remote_code=True`  
  * export to ONNX yourself  
  * store the ONNX \+ metadata checksums locally  
* After that, inference runs via ONNX Runtime as in Option 1\.

This gives you:

* Full control over correctness (you own export \+ test vectors).  
* A reproducible “build once, run many” pipeline.

### **Option 3 — TensorRT (or TRT-LLM style) for max throughput**

This is only worth it if you’re doing **very high volume** embeddings on GPU and want maximum perf. It adds operational complexity (engine building per GPU architecture, versioning, etc.). Most teams don’t need it for editor tooling.

---

## **3\) The contract between extension and CLI/daemon**

Treat your CLI as a **stable ABI boundary**. Your extension should never care about ONNX vs PyTorch vs TensorRT — only about:

### **Core commands**

**`voyage-embed doctor`**

* prints JSON:  
  * available providers: `["cuda", "cpu"]`  
  * selected provider  
  * model cache directory  
  * detected GPU name(s), CUDA/cuDNN versions (if available)  
  * tokenizer hash / model hash  
  * max batch size recommendation (optional)  
* Extension uses this to show “Local embeddings: READY / DEGRADED / OFF”.

**`voyage-embed embed`**

* input forms:  
  * `--text` (single)  
  * `--jsonl` (batch)  
  * `--paths` (files, with chunking rules)  
* output forms:  
  * JSON (single), JSONL (batch)  
* required output fields:  
  * `id` (stable for the input)  
  * `embedding` (float array) OR (recommended) base64-encoded float16/float32 to reduce IPC overhead  
  * `dim`, `dtype`, `provider`, `model_revision`, `token_count`, `truncated`

**`voyage-embed serve`** (daemon mode)

* starts localhost HTTP server (or stdio RPC)  
* supports `/health`, `/embed`, `/stats`, `/shutdown` (optional)

### **IPC choice: HTTP vs stdio**

* **stdio RPC** is great for extension spawn-and-talk patterns and avoids port issues.  
* **HTTP** is great when you want other tools to reuse the daemon (indexer, background jobs).  
* Either is fine; if you already have a multi-agent local platform mindset, HTTP is often easier to integrate with other components.

---

## **4\) Model management & caching (what admins will care about)**

Because admins manage dependencies, you can assume:

* Python installed  
* CUDA drivers installed (maybe)  
* Disk available for model cache

Still, you need predictable behavior:

### **Cache layout**

* `~/.cache/voyage-embed/models/<model_id>/<revision>/...`  
* `~/.cache/voyage-embed/onnx/<model_id>/<revision>/<variant>/...`  
* Store a manifest JSON with:  
  * SHA256 of ONNX files  
  * tokenizer files hash  
  * embedding dimension, normalization method, pooling method  
  * “prompt template version” (see below)

### **Variant selection**

Have a deterministic selection algorithm:

1. If GPU available and memory sufficient: prefer `fp16` or `q4f16` depending on perf/accuracy needs.  
2. If CPU: prefer `q4f16` or `q4`.  
3. Allow override flags:  
   * `--variant fp16|q4|q4f16`  
   * `--provider cuda|cpu`

---

## **5\) Correctness: the *real* risk with embeddings is silent drift**

For editor features (RAG search, semantic navigation), drift shows up as “search feels off” — hard to diagnose.

So build correctness into the runtime:

### **A “golden vectors” test**

Ship a small set of test strings \+ expected embeddings (or expected pairwise similarities) produced by a known-good reference (e.g., the official Voyage API, or a pinned PyTorch run).

`voyage-embed validate`

* Computes embeddings for golden inputs.  
* Computes cosine similarities vs expected.  
* Fails if:  
  * max abs error \> threshold OR  
  * rank-order of nearest neighbors changes beyond tolerance

This is especially important if you:

* switch ONNX variants (q4 vs fp16)  
* change pooling/normalization defaults  
* change tokenization/prompt formatting

---

## **6\) Prompting/prefix rules: bake them into the runtime**

Embedding models often expect different prefixes for:

* query vs document  
* classification vs clustering, etc.

Don’t leave that responsibility to the extension UI. Put it in the runtime:

`voyage-embed embed --mode query|doc|raw`

Internally, runtime applies:

* correct prefix template  
* normalization  
* pooling choice

That ensures the extension always produces embeddings that “match themselves” across versions.

---

## **7\) Performance knobs that matter (batching \+ chunking)**

For workspace indexing, performance is dominated by:

* **batch size** (GPU likes larger batches; CPU may prefer smaller)  
* **chunking policy** (file splitting)  
* **token limit** (truncate vs sliding window)  
* **parallelism** (don’t oversubscribe CPU threads)

Your runtime should own:

* chunking strategy: `--chunk_tokens 256 --overlap 32` etc.  
* batching: `--batch_tokens` or `--batch_size`  
* concurrency: `--workers N` (CPU) but keep it conservative on GPU

---

## **8\) Minimal implementation plan (fastest path to “works”)**

If I were building this quickly:

1. **Python CLI** using `typer` (or `click`) with subcommands: `doctor`, `embed`, `validate`, `serve`.  
2. Inference engine: **ONNX Runtime**  
   * try CUDA provider; fallback CPU  
3. Tokenization: HF `tokenizers` in Python.  
4. Use a quantized ONNX variant by default.  
5. Add a manifest \+ cache directory.  
6. Add `validate` with a small golden suite.

Then the VS Code extension integration is trivial:

* spawn `voyage-embed embed --jsonl -` and stream results back.

---

## **9\) If you want a “service contract” spec (implementation-ready)**

If you tell me which IPC you want (stdio RPC vs HTTP), I’ll write:

* a concrete JSON schema for request/response  
* command-line UX  
* error taxonomy (missing CUDA, model not cached, invalid input)  
* a versioning scheme for the contract (so the extension can remain stable)

But even without that: the key move is **treat embeddings as a local subsystem** with a stable contract, and let ONNX/Python/CUDA be an implementation detail behind it.

stdio RPC

Great — stdio RPC is the cleanest fit for VS Code because it avoids ports, firewall policy, and daemon lifecycle headaches. Here’s an implementation-ready contract you can hand to your Executor/CLI engineer.

## **1\) Transport: newline-delimited JSON over stdio (NDJSON)**

* Client (VS Code extension) spawns the runtime:  
  * `voyage-embed rpc --model onnx-community/voyage-4-nano-ONNX --variant q4f16`  
* Client writes **one JSON object per line** to **stdin**.  
* Server writes **one JSON object per line** to **stdout**.  
* Server writes logs/diagnostics to **stderr only** (never stdout).

This keeps parsing trivial and resilient.

### **Core envelope fields (every message)**

* `v`: protocol version (integer, start at `1`)  
* `id`: client-generated request id (string; unique per request)  
* `type`: message type string  
* `ts`: optional ISO timestamp (server may include)

---

## **2\) Message types**

### **2.1 Handshake / capability discovery**

**Client → Server**

{"v":1,"id":"h1","type":"hello","client":{"name":"hestami-vscode","version":"0.3.0"},"want":{"providers":true,"model":true,"limits":true}}

**Server → Client**

{"v":1,"id":"h1","type":"hello.ok","server":{"name":"voyage-embed","version":"0.1.0"},"providers":{"available":\["cuda","cpu"\],"selected":"cuda","details":{"cuda":{"device":"NVIDIA RTX 4090","runtime":"CUDAExecutionProvider"},"cpu":{"runtime":"CPUExecutionProvider"}}},"model":{"id":"onnx-community/voyage-4-nano-ONNX","revision":"\<commit-or-tag\>","variant":"q4f16","dim":1024,"dtype":"float32"},"limits":{"max\_batch\_items":256,"max\_input\_tokens":8192,"recommended\_batch\_items":32},"cache":{"dir":"\~/.cache/voyage-embed","status":"warm"}}

Notes:

* `dim` should be explicit; extension needs it to build an index.  
* `revision` should be pinned (commit hash). Don’t silently float.

---

### **2.2 Embed (single or batch)**

**Client → Server**

{"v":1,"id":"e1","type":"embed","mode":"query","inputs":\[{"id":"q1","text":"best way to waterproof a deck?"}\],"options":{"normalize":true,"pooling":"mean","truncate":"end"}}

**Server → Client**

{"v":1,"id":"e1","type":"embed.ok","mode":"query","outputs":\[{"id":"q1","dim":1024,"dtype":"float32","embedding\_b64":"\<base64 of float32 bytes\>","token\_count":11,"truncated":false}\],"stats":{"provider":"cuda","latency\_ms":7.4}}

Why `embedding_b64`:

* NDJSON with raw float arrays is huge/slow.  
* Base64 of packed floats is predictable and fast.

Encoding details (must be specified):

* `dtype` either `"float32"` or `"float16"`  
* byte order: little-endian  
* layout: contiguous array of length `dim`

If you want a human-friendly mode for debugging:

* allow `--json-floats` flag that returns `embedding: [..]` instead of b64. Not recommended for production.

---

### **2.3 Chunk \+ embed files (optional but useful)**

If you plan workspace indexing, add a higher-level call so the runtime owns chunking.

**Client → Server**

{"v":1,"id":"f1","type":"embed\_files","mode":"doc","files":\[{"path":"C:\\\\repo\\\\README.md","id":"readme"}\],"chunk":{"strategy":"tokens","chunk\_tokens":256,"overlap\_tokens":32},"options":{"normalize":true,"pooling":"mean"}}

**Server → Client**

{"v":1,"id":"f1","type":"embed\_files.ok","mode":"doc","chunks":\[{"file\_id":"readme","chunk\_id":"readme\#0001","start\_byte":0,"end\_byte":842,"token\_count":256,"embedding\_b64":"...","dim":1024,"dtype":"float32"}\],"stats":{"provider":"cuda","latency\_ms":34.2}}

This keeps your extension lighter and makes it easy to swap chunking policies later.

---

### **2.4 Health / stats**

**Client → Server**

{"v":1,"id":"s1","type":"stats"}

**Server → Client**

{"v":1,"id":"s1","type":"stats.ok","uptime\_s":1884,"provider":"cuda","model\_load\_ms":912,"requests":4312,"avg\_latency\_ms":8.1,"p95\_latency\_ms":14.7,"cache":{"status":"warm"}}  
---

### **2.5 Validate (golden vectors)**

**Client → Server**

{"v":1,"id":"v1","type":"validate","suite":"default","tolerance":{"cosine\_min":0.9990}}

**Server → Client**

{"v":1,"id":"v1","type":"validate.ok","suite":"default","result":"pass","worst\_case":{"id":"case7","cosine":0.9994},"stats":{"provider":"cpu","latency\_ms":120.8}}

This is how you catch silent “pooling/prefix/tokenization drift”.

---

### **2.6 Error format (uniform)**

Any request may return:

{"v":1,"id":"e1","type":"error","error":{"code":"MODEL\_NOT\_FOUND","message":"ONNX model files missing; run \`voyage-embed warmup\` or allow auto-download.","retryable":true,"details":{"model":"onnx-community/voyage-4-nano-ONNX","variant":"q4f16"}}}

Recommended error codes:

* `BAD_REQUEST` (schema/field errors)  
* `MODEL_NOT_FOUND`  
* `PROVIDER_UNAVAILABLE` (CUDA requested but not available)  
* `OUT_OF_MEMORY` (GPU OOM)  
* `TOKENIZER_ERROR`  
* `INTERNAL`

---

## **3\) Process lifecycle**

### **Startup behavior**

* `voyage-embed rpc ...` should:  
  1. load tokenizer  
  2. load model into selected provider  
  3. emit nothing until it receives `hello`  
* On `hello`, respond with `hello.ok`.

### **Shutdown**

Client sends:

{"v":1,"id":"x1","type":"shutdown"}

Server responds `shutdown.ok` then exits 0\.

Also handle EOF on stdin as “clean shutdown.”

---

## **4\) CLI flags (admin-friendly)**

Suggested:

* `voyage-embed rpc`  
  * `--model <hf_repo_or_local_path>`  
  * `--revision <commit|tag>` (default pinned; never float by default)  
  * `--variant q4|q4f16|fp16|fp32`  
  * `--provider auto|cuda|cpu`  
  * `--cache-dir <path>`  
  * `--threads <n>` (CPU)  
  * `--max-batch-items <n>`  
  * `--log-level info|debug`

Plus utility:

* `voyage-embed doctor` (human-readable \+ `--json`)  
* `voyage-embed warmup` (download/cache weights ahead of time)

---

## **5\) GPU fallback algorithm (deterministic)**

When `--provider auto`:

1. If CUDA EP present **and** model loads without OOM → select `cuda`.  
2. Else select `cpu`.  
3. Include selected provider in `hello.ok` and every response `stats`.

For OOM mid-run:

* return `OUT_OF_MEMORY` with `retryable=true`  
* client may retry with:  
  * smaller batch, or  
  * `provider=cpu` (extension can decide policy)

---

## **6\) Extension integration pattern (what works well)**

In VS Code:

* spawn long-lived RPC process per workspace (or per window)  
* maintain a request map keyed by `id`  
* send `hello` once, await `hello.ok`  
* batch embeddings (e.g., 16–64 inputs per request) to reduce overhead  
* parse stdout by line; treat stderr as logs

This gives you near-daemon performance without a network service.

---

## **7\) Next step: pick 2 defaults**

To fully lock the contract, you need two “policy defaults”:

1. **embedding output format**  
* I recommend: `embedding_b64` with `dtype=float32` (or float16 if you want smaller transfers).  
2. **embedding derivation**  
* For example: `pooling=mean` \+ `normalize=true` \+ `truncate=end`  
* And fixed `mode` templates: `query|doc|raw`

If you say “use float16 b64” vs “float32 b64”, I’ll tighten the spec with exact decoding code snippets for the extension side (Node) and the runtime (Python), including byte order and sanity checks.

