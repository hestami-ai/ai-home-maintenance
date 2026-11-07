"""JAN-EXEC Phase 7, package Z2a - D54's live check: the REFERENCE PATH, step 1's own code (REG-D-146; design section 12.6).

Asks every question of the given cases ONE AT A TIME, COLD, by step 1's own definitions - loaded from step1_single.py exactly
as rev9's server_version_check.py loads them (the source up to `tags = {`, exec'd with its own __file__), so nothing of the
measured path is retyped: its state, its two questions, its cut, its `post` and its `cold` (wait_gone, then the request with
keep_alive 0). Writes one JSON line a question: the case, kind, key, score, the sha256 of the exact bytes posted, the request's
milliseconds, its input tokens and the other models the server held.

Its stops, the measured condition (REG-F-608): another model loaded, before the first request or by any request's own read;
the digest or the server version changed, read before each case and after the last. Resumes: a recorded (case, kind, key)
is not asked again. No paid call: a local model, free.

usage: python -I step1_reference.py <step1_single.py> <out.ndjson> <case id> [<case id> ...]
"""
import hashlib
import json
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
STEP1, OUT, *CASES = sys.argv[1:]
src = open(STEP1, encoding="utf-8").read()
ns = {"__file__": STEP1, "__name__": "step1_defs"}
exec(compile(src[: src.index("tags = {")], "step1_single.py", "exec"), ns)
get, cold, text_of, state_of, check_q, statement_q, plain_q, post, loaded, MODEL, DIGEST = (
    ns[k] for k in ("get", "cold", "text_of", "state_of", "check_q", "statement_q", "plain_q", "post", "loaded", "MODEL", "DIGEST")
)


def identity():
    tags = {m["name"]: m for m in get("/api/tags")["models"]}
    return (tags.get(MODEL) or {}).get("digest", ""), get("/api/version").get("version")


digest, version = identity()
if not digest.startswith(DIGEST):
    sys.exit(f"STOPPED: {MODEL} has digest {digest[:12]!r}, not {DIGEST}")
crowd = [m for m in loaded() if m != MODEL]
if crowd:
    sys.exit(f"STOPPED: another model is loaded ({', '.join(crowd)}): the reference is asked with none")
seen = set()
if os.path.exists(OUT):
    for line in open(OUT, encoding="utf-8"):
        if line.strip():
            r = json.loads(line)
            if r["server"] != version or r["digest"] != digest[:12]:
                sys.exit(f"STOPPED: {OUT} was asked on {r['digest']} on Ollama {r['server']}, not {digest[:12]} on Ollama {version}")
            seen.add((r["case"], r["kind"], r["key"]))
total = sum(len(check_q(text_of(c))) + len(statement_q(text_of(c))) for c in CASES)
print(f"{MODEL} {digest[:12]} on Ollama {version}; {total} questions of {len(CASES)} cases, {len(seen)} already asked; "
      f"about {(total - len(seen)) * 16.3 / 3600:.1f} h at 16.3 s a request", flush=True)
if MODEL in loaded():
    post({"model": MODEL, "keep_alive": 0, "state": "unload", "questions": plain_q("")})
started = time.time()
made = 0
for case in CASES:
    if identity() != (digest, version):
        sys.exit(f"STOPPED: before {case}, the server's digest or version changed (REG-F-608)")
    text = text_of(case)
    state = state_of(text)
    for kind, questions in (("checks", check_q(text)), ("statements", statement_q(text))):
        for qkey, q in questions.items():
            if (case, kind, qkey) in seen:
                continue
            body = json.dumps({"model": MODEL, "keep_alive": 0, "state": state, "questions": {qkey: q}}).encode("utf-8")
            scores, ms, tokens, others = cold(state, {qkey: q})
            if others:
                sys.exit(f"STOPPED: {case} {kind} {qkey}: another model was loaded ({', '.join(others)})")
            row = {"case": case, "kind": kind, "key": qkey, "score": scores[qkey], "bodySha256": hashlib.sha256(body).hexdigest(),
                   "ms": ms, "inputTokens": tokens, "otherModels": others, "server": version, "digest": digest[:12]}
            with open(OUT, "a", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(row) + "\n")
            seen.add((case, kind, qkey))
            made += 1
    print(f"{case}: asked; {made} requests made, {round(time.time() - started)} s", flush=True)
if identity() != (digest, version):
    sys.exit("STOPPED: after the last case, the server's digest or version changed (REG-F-608)")
if MODEL in loaded():
    post({"model": MODEL, "keep_alive": 0, "state": "unload", "questions": plain_q("")})
print(f"done: {made} requests made in {round(time.time() - started)} s", flush=True)
