"""
Historian Benchmark Runner

Runs the gold benchmark suite against the Historian model
and reports metrics for promotion/regression decisions.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

import httpx
from tabulate import tabulate

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
HISTORIAN_URL = os.getenv("HISTORIAN_URL", "http://historian-infer:8000")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hestami:hestami@registry-db:5432/historian_registry")
CASES_DIR = Path(os.getenv("CASES_DIR", "/app/cases"))


@dataclass
class BenchmarkCase:
    """A single benchmark test case"""
    id: str
    name: str
    description: str
    proposal: dict
    expected_status: str  # CONSISTENT, INCONSISTENT, CONDITIONAL, UNKNOWN
    expected_conflicts: list[str] = field(default_factory=list)
    expected_conditions: list[str] = field(default_factory=list)
    must_cite: list[str] = field(default_factory=list)  # Required citation IDs
    must_not_cite: list[str] = field(default_factory=list)  # Forbidden citation IDs


@dataclass
class BenchmarkResult:
    """Result of running a single benchmark case"""
    case_id: str
    passed: bool
    actual_status: str
    expected_status: str
    status_match: bool
    citation_precision: float
    citation_recall: float
    conflicts_match: bool
    conditions_match: bool
    json_valid: bool
    error: Optional[str] = None
    # Enhanced fields for debugging
    case_description: str = ""
    case_name: str = ""
    full_request: Optional[dict] = None  # The proposal sent to historian
    full_response: Optional[dict] = None  # The complete response from historian
    actual_evidence: list = field(default_factory=list)
    actual_conflicts: list = field(default_factory=list)
    actual_conditions: list = field(default_factory=list)
    model_comments: str = ""
    verification_queries: list = field(default_factory=list)


@dataclass
class BenchmarkReport:
    """Aggregated benchmark results"""
    total_cases: int
    passed_cases: int
    failed_cases: int
    label_accuracy: float
    avg_citation_precision: float
    avg_citation_recall: float
    json_validity_rate: float
    unknown_accuracy: float  # Accuracy on UNKNOWN cases
    results: list[BenchmarkResult] = field(default_factory=list)


def load_cases(cases_dir: Path) -> list[BenchmarkCase]:
    """Load all benchmark cases from the cases directory"""
    cases = []

    if not cases_dir.exists():
        logger.warning(f"Cases directory not found: {cases_dir}")
        return cases

    for case_file in cases_dir.glob("*.json"):
        try:
            with open(case_file) as f:
                data = json.load(f)
                cases.append(BenchmarkCase(
                    id=data.get("id", case_file.stem),
                    name=data.get("name", case_file.stem),
                    description=data.get("description", ""),
                    proposal=data.get("proposal", {}),
                    expected_status=data.get("expected_status", "UNKNOWN"),
                    expected_conflicts=data.get("expected_conflicts", []),
                    expected_conditions=data.get("expected_conditions", []),
                    must_cite=data.get("must_cite", []),
                    must_not_cite=data.get("must_not_cite", []),
                ))
        except Exception as e:
            logger.error(f"Failed to load case {case_file}: {e}")

    return cases


async def run_case(client: httpx.AsyncClient, case: BenchmarkCase) -> BenchmarkResult:
    """Run a single benchmark case against the Historian"""
    try:
        response = await client.post(
            f"{HISTORIAN_URL}/adjudicate",
            json=case.proposal,
            timeout=120.0,  # Increased for model inference
        )
        response.raise_for_status()
        result = response.json()

        # Validate JSON structure
        json_valid = all(key in result for key in ["action_id", "status"])

        # Check status match
        actual_status = result.get("status", "UNKNOWN")
        status_match = actual_status == case.expected_status

        # Check citations
        actual_evidence = result.get("evidence", [])
        cited_ids = {e.get("id") for e in actual_evidence}
        must_cite_set = set(case.must_cite)
        must_not_cite_set = set(case.must_not_cite)

        citation_hits = len(must_cite_set & cited_ids)
        citation_precision = citation_hits / len(cited_ids) if cited_ids else 1.0
        citation_recall = citation_hits / len(must_cite_set) if must_cite_set else 1.0

        # Check for forbidden citations
        if cited_ids & must_not_cite_set:
            citation_precision = 0.0  # Penalty for citing forbidden sources

        # Check conflicts and conditions
        actual_conflicts = result.get("conflicts", [])
        expected_conflicts = set(case.expected_conflicts)
        conflicts_match = len(actual_conflicts) > 0 if len(expected_conflicts) > 0 else len(actual_conflicts) == 0

        actual_conditions = result.get("conditions", [])
        expected_conditions = set(case.expected_conditions)
        conditions_match = len(actual_conditions) > 0 if len(expected_conditions) > 0 else len(actual_conditions) == 0

        passed = status_match and json_valid

        return BenchmarkResult(
            case_id=case.id,
            passed=passed,
            actual_status=actual_status,
            expected_status=case.expected_status,
            status_match=status_match,
            citation_precision=citation_precision,
            citation_recall=citation_recall,
            conflicts_match=conflicts_match,
            conditions_match=conditions_match,
            json_valid=json_valid,
            # Enhanced debugging fields
            case_description=case.description,
            case_name=case.name,
            full_request=case.proposal,
            full_response=result,
            actual_evidence=actual_evidence,
            actual_conflicts=actual_conflicts,
            actual_conditions=actual_conditions,
            model_comments=result.get("comments", ""),
            verification_queries=result.get("verification_queries", []),
        )

    except Exception as e:
        logger.error(f"Case {case.id} failed with error: {e}")
        return BenchmarkResult(
            case_id=case.id,
            passed=False,
            actual_status="ERROR",
            expected_status=case.expected_status,
            status_match=False,
            citation_precision=0.0,
            citation_recall=0.0,
            conflicts_match=False,
            conditions_match=False,
            json_valid=False,
            error=str(e),
            case_description=case.description,
            case_name=case.name,
            full_request=case.proposal,
        )


async def run_benchmark(cases_dir: Optional[Path] = None) -> BenchmarkReport:
    """Run the full benchmark suite"""
    cases_dir = cases_dir or CASES_DIR
    cases = load_cases(cases_dir)

    if not cases:
        logger.warning("No benchmark cases found")
        return BenchmarkReport(
            total_cases=0,
            passed_cases=0,
            failed_cases=0,
            label_accuracy=0.0,
            avg_citation_precision=0.0,
            avg_citation_recall=0.0,
            json_validity_rate=0.0,
            unknown_accuracy=0.0,
        )

    logger.info(f"Running {len(cases)} benchmark cases")

    results = []
    async with httpx.AsyncClient() as client:
        for case in cases:
            result = await run_case(client, case)
            results.append(result)
            status = "PASS" if result.passed else "FAIL"
            logger.info(f"  [{status}] {case.id}: {result.actual_status} (expected {result.expected_status})")

    # Calculate aggregate metrics
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    label_accuracy = sum(1 for r in results if r.status_match) / len(results) if results else 0.0
    avg_citation_precision = sum(r.citation_precision for r in results) / len(results) if results else 0.0
    avg_citation_recall = sum(r.citation_recall for r in results) / len(results) if results else 0.0
    json_validity_rate = sum(1 for r in results if r.json_valid) / len(results) if results else 0.0

    # Calculate UNKNOWN accuracy specifically
    unknown_cases = [r for r in results if r.expected_status == "UNKNOWN"]
    unknown_accuracy = sum(1 for r in unknown_cases if r.status_match) / len(unknown_cases) if unknown_cases else 1.0

    return BenchmarkReport(
        total_cases=len(results),
        passed_cases=passed,
        failed_cases=failed,
        label_accuracy=label_accuracy,
        avg_citation_precision=avg_citation_precision,
        avg_citation_recall=avg_citation_recall,
        json_validity_rate=json_validity_rate,
        unknown_accuracy=unknown_accuracy,
        results=results,
    )


def print_case_details(r: BenchmarkResult, show_diagnostics: bool = False):
    """Print detailed information for a single case result"""
    status_icon = "✅" if r.passed else "❌"
    print(f"\n{'─' * 80}")
    print(f"{status_icon} CASE: {r.case_id}")
    print(f"   NAME: {r.case_name}")
    print(f"{'─' * 80}")

    if r.case_description:
        print(f"Description: {r.case_description}")

    print(f"\nExpected: {r.expected_status}")
    print(f"Actual:   {r.actual_status}")
    print(f"Status:   {'MATCH' if r.status_match else 'MISMATCH'}")

    if r.error:
        print(f"\n⚠️  ERROR: {r.error}")
        return

    # Show model's reasoning
    if r.model_comments:
        print("\n📝 Model Comments:")
        wrapped = r.model_comments[:500] + "..." if len(r.model_comments) > 500 else r.model_comments
        for line in wrapped.split("\n"):
            print(f"   {line}")

    # Show evidence cited
    if r.actual_evidence:
        print(f"\n📚 Evidence Cited ({len(r.actual_evidence)} items):")
        for i, ev in enumerate(r.actual_evidence[:5]):
            source = ev.get("source", "?")
            ev_id = ev.get("id", "?")
            excerpt = ev.get("excerpt", "")[:100]
            print(f"   [{i+1}] {source}/{ev_id}")
            if excerpt:
                print(f"       \"{excerpt}...\"")
        if len(r.actual_evidence) > 5:
            print(f"   ... and {len(r.actual_evidence) - 5} more")
    else:
        print("\n📚 Evidence Cited: None")

    # Show conflicts (important for INCONSISTENT cases)
    if r.actual_conflicts:
        print(f"\n⚔️  Conflicts ({len(r.actual_conflicts)}):")
        for conflict in r.actual_conflicts[:3]:
            print(f"   • {conflict[:150]}{'...' if len(conflict) > 150 else ''}")

    # Show conditions (important for CONDITIONAL cases)
    if r.actual_conditions:
        print(f"\n⚡ Conditions ({len(r.actual_conditions)}):")
        for cond in r.actual_conditions[:3]:
            print(f"   • {cond[:150]}{'...' if len(cond) > 150 else ''}")

    # Show verification queries (important for UNKNOWN cases)
    if r.verification_queries:
        print(f"\n❓ Verification Queries ({len(r.verification_queries)}):")
        for query in r.verification_queries[:3]:
            print(f"   • {query[:150]}{'...' if len(query) > 150 else ''}")

    # Validation check for passes - verify the response makes sense
    if r.passed:
        print("\n✓ Validation Check:")
        issues = []
        if r.actual_status == "CONSISTENT" and r.actual_conflicts:
            issues.append("⚠️  CONSISTENT but reported conflicts - may be false positive")
        if r.actual_status == "INCONSISTENT" and not r.actual_conflicts:
            issues.append("⚠️  INCONSISTENT but no conflicts listed - weak justification")
        if r.actual_status == "CONDITIONAL" and not r.actual_conditions:
            issues.append("⚠️  CONDITIONAL but no conditions listed - weak justification")
        if r.actual_status == "UNKNOWN" and not r.verification_queries:
            issues.append("⚠️  UNKNOWN but no verification queries - should suggest what's missing")
        if not r.actual_evidence:
            issues.append("⚠️  No evidence cited - response may lack grounding")

        if issues:
            for issue in issues:
                print(f"   {issue}")
        else:
            print("   All checks passed - response is well-formed")

    # Diagnostic hints for failures
    if show_diagnostics and not r.passed:
        print("\n💡 Diagnostic Hints:")
        if r.expected_status == "CONDITIONAL" and r.actual_status == "CONSISTENT":
            print("   → Model may be missing conditions that require additional validation")
            print("   → Check if evidence includes conditional language (if, when, unless)")
        elif r.expected_status == "INCONSISTENT" and r.actual_status == "CONSISTENT":
            print("   → Model failed to detect conflicts in the proposal")
            print("   → Check if evidence contains contradicting requirements")
        elif r.expected_status == "INCONSISTENT" and r.actual_status == "UNKNOWN":
            print("   → Model couldn't find sufficient evidence to determine inconsistency")
            print("   → May need more specific evidence in the bundle")
        elif r.expected_status == "CONSISTENT" and r.actual_status != "CONSISTENT":
            print("   → Model found unexpected issues with a valid proposal")
            print("   → Review the conflicts/conditions it reported")
        elif r.expected_status == "UNKNOWN" and r.actual_status != "UNKNOWN":
            print("   → Model made a determination when evidence was insufficient")
            print("   → May be hallucinating or over-confident")


def print_report(report: BenchmarkReport, verbose: bool = True):
    """Print a formatted benchmark report"""
    print("\n" + "=" * 80)
    print("HISTORIAN BENCHMARK REPORT")
    print("=" * 80)

    print(f"\nTotal Cases: {report.total_cases}")
    print(f"Passed: {report.passed_cases}")
    print(f"Failed: {report.failed_cases}")

    print("\nMetrics:")
    metrics = [
        ["Label Accuracy", f"{report.label_accuracy:.2%}"],
        ["Citation Precision", f"{report.avg_citation_precision:.2%}"],
        ["Citation Recall", f"{report.avg_citation_recall:.2%}"],
        ["JSON Validity", f"{report.json_validity_rate:.2%}"],
        ["UNKNOWN Accuracy", f"{report.unknown_accuracy:.2%}"],
    ]
    print(tabulate(metrics, headers=["Metric", "Value"], tablefmt="simple"))

    if report.results:
        print("\nResults Summary:")
        rows = [
            [r.case_id, r.expected_status, r.actual_status, "✅ PASS" if r.passed else "❌ FAIL"]
            for r in report.results
        ]
        print(tabulate(rows, headers=["Case", "Expected", "Actual", "Result"], tablefmt="simple"))

    if verbose:
        # Show all case details grouped by status
        passed_results = [r for r in report.results if r.passed]
        failed_results = [r for r in report.results if not r.passed]

        if passed_results:
            print("\n" + "=" * 80)
            print(f"PASSED CASES ({len(passed_results)})")
            print("=" * 80)
            for r in passed_results:
                print_case_details(r, show_diagnostics=False)

        if failed_results:
            print("\n" + "=" * 80)
            print(f"FAILED CASES ({len(failed_results)})")
            print("=" * 80)
            for r in failed_results:
                print_case_details(r, show_diagnostics=True)

    print("\n" + "=" * 80)


def save_results_json(report: BenchmarkReport, output_path: Path):
    """Save detailed results to a JSON file for further analysis"""
    import datetime

    output = {
        "metadata": {
            "timestamp": datetime.datetime.now().isoformat(),
            "historian_url": HISTORIAN_URL,
            "cases_dir": str(CASES_DIR),
        },
        "summary": {
            "total_cases": report.total_cases,
            "passed_cases": report.passed_cases,
            "failed_cases": report.failed_cases,
            "label_accuracy": report.label_accuracy,
            "avg_citation_precision": report.avg_citation_precision,
            "avg_citation_recall": report.avg_citation_recall,
            "json_validity_rate": report.json_validity_rate,
            "unknown_accuracy": report.unknown_accuracy,
        },
        "results": [
            {
                "case_id": r.case_id,
                "case_name": r.case_name,
                "case_description": r.case_description,
                "passed": r.passed,
                "expected_status": r.expected_status,
                "actual_status": r.actual_status,
                "status_match": r.status_match,
                "citation_precision": r.citation_precision,
                "citation_recall": r.citation_recall,
                "conflicts_match": r.conflicts_match,
                "conditions_match": r.conditions_match,
                "json_valid": r.json_valid,
                "error": r.error,
                "model_comments": r.model_comments,
                "actual_evidence": r.actual_evidence,
                "actual_conflicts": r.actual_conflicts,
                "actual_conditions": r.actual_conditions,
                "verification_queries": r.verification_queries,
                "full_request": r.full_request,  # The proposal sent to historian
                "full_response": r.full_response,  # Complete historian response
            }
            for r in report.results
        ],
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    logger.info(f"Detailed results saved to {output_path}")


async def main():
    """Entry point for the benchmark runner"""
    import datetime

    logger.info("Historian Benchmark Service starting...")
    logger.info(f"Historian URL: {HISTORIAN_URL}")
    logger.info(f"Cases directory: {CASES_DIR}")

    report = await run_benchmark()
    print_report(report, verbose=True)

    # Save detailed results to JSON
    output_dir = Path(os.getenv("OUTPUT_DIR", "/app/results"))
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"bench_results_{timestamp}.json"
    save_results_json(report, output_path)

    # Return exit code based on pass/fail
    if report.failed_cases > 0:
        exit(1)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
