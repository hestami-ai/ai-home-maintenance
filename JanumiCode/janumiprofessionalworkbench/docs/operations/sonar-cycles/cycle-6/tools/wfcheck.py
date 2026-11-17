"""Syntax-check a Workflow script the way the runtime runs it: body wrapped in an async function, meta export stripped."""
import subprocess, sys, os
for p in sys.argv[1:]:
    body = open(p, encoding="utf-8").read().replace("export const meta =", "const meta =", 1)
    tmp = p + ".check.cjs"
    open(tmp, "w", encoding="utf-8").write("async function __wf(agent, parallel, pipeline, log, phase, args, budget) {\n" + body + "\n}\n")
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    os.remove(tmp)
    print(("syntax OK: " if r.returncode == 0 else "SYNTAX ERROR: ") + os.path.basename(p) + ("" if r.returncode == 0 else "\n" + r.stderr[:800]))
