"""
DSPy optimization for the `fr_saturation` prompt (pilot), targeting gpt-oss:20b.

Pipeline:
  1. Load trainset.jsonl harvested from workspace-127.
  2. Split each recorded prompt at "[INPUT]" → shared seed instruction + per-example input.
  3. Signature: decomposition_input -> decomposition, docstring = seed instruction.
  4. Metric: shell out to the TS scorer (real validators; optional LLM judges).
  5. Baseline-eval the zero-shot program, then compile with the chosen optimizer.
  6. Save the compiled program and export a candidate .system.md (Strategy C staging).

Run from the project root (janumicode_v2/). Config via env vars:
  PROGRAM_MODEL   default ollama_chat/gpt-oss:20b
  OLLAMA_API_BASE default http://localhost:11434
  PROGRAM_TEMP    default 1.0          (matches workspace-127 requirements_agent)
  WITH_JUDGES     "1" to add LLM judges to the metric (slow; days-scale OK)
  OPTIMIZER       bootstrap | mipro    (default bootstrap)
  TRAIN_N / VAL_N default 16 / 16      (larger val = lower-variance trial scores)
  MAX_DEMOS       default 3
  SMOKE           "1" → tiny config (4/2, bootstrap, no judges) to validate the pipeline

De-noising (read by the TS scorer, inherited via env):
  PROGRAM_TEMP    default 0.3          (was 1.0; cuts generation variance. NB: production
                                        runs requirements_agent at temp 1.0 — optimize at
                                        low temp for a clean signal, then confirm at 1.0)
  JUDGE_TEMPERATURE default 0.0        (deterministic judging)
  JUDGE_PASSES    default 3            (average N judge passes; result frozen in
                                        dspy/.judge_cache so identical outputs score
                                        identically — stops MIPRO chasing judge noise)
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# Windows consoles default to cp1252; our logs contain unicode. Force UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

import dspy

# ── Paths ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]          # janumicode_v2/
TRAINSET = ROOT / "dspy" / "trainsets" / "fr_saturation.trainset.jsonl"
PROGRAMS_DIR = ROOT / "dspy" / "programs"
CANDIDATES_DIR = ROOT / "dspy" / "candidates" / "phases" / "phase_02_requirements" / "fr_saturation"
REPORTS_DIR = ROOT / "dspy" / "reports"
SKELETON = ROOT / "prompts" / "phases" / "phase_02_requirements" / "fr_saturation" / "functional_requirements_decomposition.product.system.md"

# tsx scorer (project-local; avoids npx resolution cost per call)
TSX = ROOT / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
SCORE_CLI = ROOT / "dspy" / "src" / "scoreCli.ts"

# ── Config ──────────────────────────────────────────────────────────────────
SMOKE = os.environ.get("SMOKE") == "1"
WITH_JUDGES = os.environ.get("WITH_JUDGES") == "1" and not SMOKE
OPTIMIZER = os.environ.get("OPTIMIZER", "bootstrap")
PROGRAM_MODEL = os.environ.get("PROGRAM_MODEL", "ollama_chat/gpt-oss:20b")
OLLAMA_API_BASE = os.environ.get("OLLAMA_API_BASE", "http://localhost:11434")
PROGRAM_TEMP = float(os.environ.get("PROGRAM_TEMP", "0.3"))   # de-noised default (was 1.0)
TRAIN_N = 4 if SMOKE else int(os.environ.get("TRAIN_N", "16"))
VAL_N = 2 if SMOKE else int(os.environ.get("VAL_N", "16"))
MAX_DEMOS = int(os.environ.get("MAX_DEMOS", "3"))
# Demo-acceptance gate for bootstrapping. Judge-inclusive scores top out lower
# than deterministic-only, so the gate must be lower when judges are on or no
# example qualifies as a demo.
DEMO_THRESHOLD = float(os.environ.get("DEMO_THRESHOLD", "0.8" if WITH_JUDGES else "0.9"))

MARK = "[INPUT]"


# ── Metric bridge: shell out to the TS scorer ────────────────────────────────
def ts_score(full_prompt: str, output_text: str) -> dict:
    req = json.dumps({
        "agentRole": "requirements_agent",
        "subPhaseId": "fr_saturation",
        "prompt": full_prompt,
        "system": None,
        "outputText": output_text,
    })
    cmd = [str(TSX), str(SCORE_CLI)]
    if WITH_JUDGES:
        cmd.append("--with-judges")
    try:
        proc = subprocess.run(
            cmd, input=req, capture_output=True, text=True, cwd=str(ROOT),
            timeout=3600,  # judge calls can be minutes; days-scale runs are fine
        )
        out = proc.stdout.strip()
        return json.loads(out) if out else {"score": 0.0}
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"ts_score error: {e}\n")
        return {"score": 0.0}


def _as_text(value) -> str:
    """The decomposition field may arrive as a dict (JSONAdapter) or a string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value)
    except Exception:  # noqa: BLE001
        return str(value)


def metric(gold, pred, trace=None):
    text = _as_text(getattr(pred, "decomposition", None))
    res = ts_score(gold.full_prompt, text)
    score = float(res.get("score", 0.0))
    # Bootstrap uses truthiness of the return when trace is set; gate good demos.
    if trace is not None:
        return score >= DEMO_THRESHOLD
    return score


# ── Load data ────────────────────────────────────────────────────────────────
def load_examples():
    seed_instruction = None
    examples = []
    for line in TRAINSET.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        prompt = row["prompt"]
        i = prompt.find(MARK)
        if i == -1:
            continue
        if seed_instruction is None:
            seed_instruction = prompt[:i].strip()
        input_context = prompt[i + len(MARK):].strip()
        ex = dspy.Example(
            decomposition_input=input_context,
            full_prompt=prompt,           # carried for the metric (id resolution)
            label=row.get("label", ""),
        ).with_inputs("decomposition_input")
        examples.append(ex)
    return seed_instruction, examples


def main():
    seed_instruction, examples = load_examples()
    print(f"Loaded {len(examples)} examples; seed instruction {len(seed_instruction)} chars")
    print(f"Config: optimizer={OPTIMIZER} with_judges={WITH_JUDGES} smoke={SMOKE} "
          f"train={TRAIN_N} val={VAL_N} model={PROGRAM_MODEL} temp={PROGRAM_TEMP}")

    lm = dspy.LM(PROGRAM_MODEL, api_base=OLLAMA_API_BASE, temperature=PROGRAM_TEMP, max_tokens=8000)
    # JSONAdapter: the prompt mandates raw-JSON output, which conflicts with the
    # default ChatAdapter's "[[ ## field ## ]]" markers (smoke showed intermittent
    # empty-field parses). JSONAdapter expects the model to return a JSON object
    # keyed by the output field — aligned with a JSON-emitting model.
    dspy.configure(lm=lm, adapter=dspy.JSONAdapter())

    # Signature whose instruction is the existing template body (what we optimize).
    class FRDecompose(dspy.Signature):
        decomposition_input: str = dspy.InputField(desc="Parent FR, tier hint, sibling context, handoff context, existing assumptions.")
        decomposition: dict = dspy.OutputField(desc="The decomposition object: parent_branch_classification, parent_tier_assessment, children[], surfaced_assumptions[].")
    FRDecompose.__doc__ = seed_instruction

    program = dspy.Predict(FRDecompose)

    trainset = examples[:TRAIN_N]
    valset = examples[TRAIN_N:TRAIN_N + VAL_N]
    print(f"trainset={len(trainset)} valset={len(valset)}")

    evaluate = dspy.Evaluate(devset=valset, metric=metric, num_threads=1,
                             display_progress=True, display_table=0)

    print("\n=== Baseline (zero-shot, seed instruction) ===")
    base = evaluate(program)
    base_score = base.score if hasattr(base, "score") else float(base)
    print(f"baseline val score: {base_score}")

    print(f"\n=== Compiling ({OPTIMIZER}) ===")
    if OPTIMIZER == "mipro":
        opt = dspy.MIPROv2(metric=metric, auto="light", num_threads=1)
        compiled = opt.compile(program, trainset=trainset, valset=valset,
                               max_bootstrapped_demos=MAX_DEMOS, max_labeled_demos=MAX_DEMOS,
                               requires_permission_to_run=False)
    else:
        opt = dspy.BootstrapFewShot(metric=metric, max_bootstrapped_demos=MAX_DEMOS,
                                    max_labeled_demos=MAX_DEMOS, max_rounds=1)
        compiled = opt.compile(program, trainset=trainset)

    print("\n=== Optimized eval ===")
    opt_eval = evaluate(compiled)
    opt_score = opt_eval.score if hasattr(opt_eval, "score") else float(opt_eval)
    print(f"optimized val score: {opt_score}")

    # Save compiled program (instruction + demos).
    PROGRAMS_DIR.mkdir(parents=True, exist_ok=True)
    prog_path = PROGRAMS_DIR / "fr_saturation.compiled.json"
    compiled.save(str(prog_path))
    print(f"\nsaved program → {prog_path}")

    # Export candidate .system.md (Strategy C staging).
    export_candidate(compiled, seed_instruction)

    # Report.
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "fr_saturation.delta.md").write_text(
        f"# fr_saturation DSPy delta\n\n"
        f"- optimizer: {OPTIMIZER}  with_judges: {WITH_JUDGES}  smoke: {SMOKE}\n"
        f"- model: {PROGRAM_MODEL} @ temp {PROGRAM_TEMP}\n"
        f"- train/val: {len(trainset)}/{len(valset)}\n\n"
        f"| | val score |\n|---|---|\n"
        f"| baseline (seed instruction, zero-shot) | {base_score} |\n"
        f"| optimized ({OPTIMIZER}) | {opt_score} |\n",
        encoding="utf-8",
    )
    print(f"report → {REPORTS_DIR / 'fr_saturation.delta.md'}")
    print(f"\nDELTA: {base_score} → {opt_score}")


def export_candidate(compiled, seed_instruction):
    """Render the optimized instruction + demos into a candidate .system.md."""
    pred = compiled.predictors()[0]
    instruction = pred.signature.instructions
    demos = getattr(pred, "demos", []) or []

    frontmatter = ""
    skeleton = SKELETON.read_text(encoding="utf-8")
    if skeleton.startswith("---"):
        end = skeleton.find("---", 3)
        frontmatter = skeleton[:end + 3] + "\n"
        # Reuse the original [INPUT] tail so {{variables}} are preserved verbatim.
    input_tail = ""
    i = skeleton.find(MARK)
    if i != -1:
        input_tail = skeleton[i:]

    demo_blocks = []
    for k, d in enumerate(demos, 1):
        ctx = getattr(d, "decomposition_input", "")
        out = _as_text(getattr(d, "decomposition", None))
        demo_blocks.append(f"## Example {k}\nINPUT:\n{ctx}\n\nOUTPUT:\n{out}\n")
    demos_section = ("\n# Examples (bootstrapped by DSPy from validated runs)\n\n" + "\n".join(demo_blocks)) if demo_blocks else ""

    body = (
        f"{frontmatter}"
        f"[JC:SYSTEM SCOPE]\n{instruction}\n"
        f"{demos_section}\n"
        f"{input_tail}\n"
    )
    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CANDIDATES_DIR / "functional_requirements_decomposition.product.system.md"
    out_path.write_text(body, encoding="utf-8")
    print(f"candidate → {out_path}  (instruction {len(instruction)} chars, {len(demos)} demos)")


if __name__ == "__main__":
    main()
