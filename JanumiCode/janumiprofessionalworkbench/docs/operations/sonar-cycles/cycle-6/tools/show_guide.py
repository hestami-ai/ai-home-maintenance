"""Print the GUIDE lines of a generated workflow script that match a pattern, exactly as an agent receives them."""
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for line in open(sys.argv[1], encoding="utf-8"):
    if line.startswith("const GUIDE = "):
        g = json.loads(line[len("const GUIDE = "):].strip())
        for l in g.split("\n"):
            if re.search(sys.argv[2], l):
                print("  " + l[:200])
        break
