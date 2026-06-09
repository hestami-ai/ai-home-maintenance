"""
Held-out confirmation: does the optimized program's gain survive on examples MIPRO
never saw? Evaluates baseline (seed instruction, no demos) vs optimized (compiled:
seed instruction + bootstrapped demos) on examples[32:40] — the 8 not used for
train (0:16) or val (16:32).

Run from project root:
  WITH_JUDGES=1 JUDGE_PASSES=3 PROGRAM_TEMP=0.3 JUDGE_TEMPERATURE=0.0 SCOPE_INHERITED=1 \
    PYTHONIOENCODING=utf-8 ./dspy/optimize/.venv/Scripts/python.exe dspy/optimize/holdout_eval.py
"""
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8"); sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import dspy
import fr_saturation_optimize as M  # reuse metric, load_examples, LM config

def main():
    seed, examples = M.load_examples()
    holdout = examples[32:40]
    print(f"held-out examples: {len(holdout)} (indices 32..39, never seen by MIPRO)")

    lm = dspy.LM(M.PROGRAM_MODEL, api_base=M.OLLAMA_API_BASE, temperature=M.PROGRAM_TEMP, max_tokens=8000)
    dspy.configure(lm=lm, adapter=dspy.JSONAdapter())

    class FRDecompose(dspy.Signature):
        decomposition_input: str = dspy.InputField()
        decomposition: dict = dspy.OutputField()
    FRDecompose.__doc__ = seed

    baseline = dspy.Predict(FRDecompose)                       # seed, no demos
    optimized = dspy.Predict(FRDecompose)
    optimized.load(str(M.PROGRAMS_DIR / "fr_saturation.compiled.json"))  # seed + 3 demos

    ev = dspy.Evaluate(devset=holdout, metric=M.metric, num_threads=1, display_progress=True)

    print("\n=== BASELINE on held-out ===")
    b = ev(baseline); b = b.score if hasattr(b, "score") else float(b)
    print(f"baseline held-out: {b}")

    print("\n=== OPTIMIZED on held-out ===")
    o = ev(optimized); o = o.score if hasattr(o, "score") else float(o)
    print(f"optimized held-out: {o}")

    print(f"\nHELD-OUT DELTA: {b} -> {o}  ({'+' if o>=b else ''}{round(o-b,2)})")
    (M.REPORTS_DIR / "fr_saturation.holdout.md").write_text(
        f"# fr_saturation held-out confirmation (8 unseen examples)\n\n"
        f"| | held-out score |\n|---|---|\n"
        f"| baseline (seed, no demos) | {b} |\n"
        f"| optimized (seed + 3 demos) | {o} |\n\n"
        f"Val-set delta was 85.47 -> 87.76. Held-out delta: {b} -> {o}.\n",
        encoding="utf-8")
    print(f"report -> {M.REPORTS_DIR / 'fr_saturation.holdout.md'}")

if __name__ == "__main__":
    main()
