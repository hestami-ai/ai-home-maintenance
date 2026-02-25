#!/usr/bin/env python3
"""
Convert benchmark cases to training data format.

Reads the gold benchmark cases and converts them to JSONL training format
for the Historian LoRA fine-tuning.
"""

import json
from pathlib import Path


def convert_case_to_training_example(case: dict) -> dict:
    """Convert a benchmark case to a training example."""
    proposal = case.get("proposal", {})
    expected_status = case.get("expected_status", "UNKNOWN")
    must_cite = case.get("must_cite", [])
    expected_conflicts = case.get("expected_conflicts", [])
    expected_conditions = case.get("expected_conditions", [])
    
    # Build the expected adjudication response
    adjudication = {
        "status": expected_status,
        "evidence": must_cite,
        "conflicts": expected_conflicts if expected_status == "INCONSISTENT" else [],
        "conditions": expected_conditions if expected_status == "CONDITIONAL" else [],
        "verification_queries": [] if expected_status != "UNKNOWN" else ["Need additional specification details"],
        "supersession_notes": [],
        "comments": f"Adjudication based on evidence bundle analysis."
    }
    
    return {
        "proposal": proposal,
        "adjudication": adjudication
    }


def main():
    cases_dir = Path("services/bench/cases")
    output_file = Path("training-data/benchmark_gold.jsonl")
    
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    examples = []
    for case_file in sorted(cases_dir.glob("*.json")):
        with open(case_file, "r") as f:
            case = json.load(f)
        
        example = convert_case_to_training_example(case)
        examples.append(example)
        print(f"Converted: {case_file.name} -> {case.get('expected_status')}")

    with open(output_file, "w") as f:
        for example in examples:
            f.write(json.dumps(example) + "\n")

    print(f"\nWrote {len(examples)} training examples to {output_file}")


if __name__ == "__main__":
    main()
