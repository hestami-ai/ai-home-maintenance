import sys, json
sys.stdout.reconfigure(encoding="utf-8")
import dspy
from pathlib import Path

ROOT = Path("dspy/trainsets/fr_saturation.trainset.jsonl")
rows = [json.loads(l) for l in ROOT.read_text(encoding="utf-8").splitlines() if l.strip()]
seed = rows[0]["prompt"].split("[INPUT]")[0].strip()
inp  = rows[0]["prompt"].split("[INPUT]")[1].strip()

class FRDecompose(dspy.Signature):
    decomposition_input: str = dspy.InputField(desc="Parent FR, tier hint, sibling context, handoff context, existing assumptions.")
    decomposition: dict = dspy.OutputField(desc="The decomposition object: parent_branch_classification, parent_tier_assessment, children[], surfaced_assumptions[].")
FRDecompose.__doc__ = seed

adapter = dspy.JSONAdapter()
# format() builds the exact message list DSPy sends — no LM call.
msgs = adapter.format(FRDecompose, demos=[], inputs={"decomposition_input": inp})
for m in msgs:
    print("="*30, m["role"].upper(), "="*30)
    print(m["content"])
