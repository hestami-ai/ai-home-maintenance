"""
Schema Field Validator (Phase 1.3)

Validates that AdjudicationResponse fields are correct for the given status.
Enforces schema requirements from adjudication-response.v2.json.
"""

from dataclasses import dataclass, field


@dataclass
class SchemaViolation:
    """A schema validation violation"""
    field: str
    expected: str
    actual: str
    severity: str = "error"  # error, warning


@dataclass
class SchemaValidationResult:
    """Result of schema validation"""
    valid: bool
    violations: list[SchemaViolation] = field(default_factory=list)


def validate_response_schema(response: dict) -> SchemaValidationResult:
    """
    Validate that an AdjudicationResponse has correct fields for its status.

    Rules by status:
    - CONSISTENT: evidence required, conflicts empty, anchor_sufficiency.sufficient=true
    - INCONSISTENT: conflicts required (>= 1), evidence required for conflict citations
    - CONDITIONAL: conditions required (>= 1)
    - UNKNOWN: verification_queries required (>= 1), anchor_sufficiency.sufficient should be false
    """
    violations: list[SchemaViolation] = []
    status = response.get("status", "")

    # Basic required fields
    if not response.get("action_id") and response.get("action_id") is not None:
        # action_id can be null, but not empty string
        if response.get("action_id") == "":
            violations.append(SchemaViolation(
                field="action_id",
                expected="non-empty string or null",
                actual="empty string",
            ))

    if status not in ["CONSISTENT", "INCONSISTENT", "CONDITIONAL", "UNKNOWN"]:
        violations.append(SchemaViolation(
            field="status",
            expected="CONSISTENT | INCONSISTENT | CONDITIONAL | UNKNOWN",
            actual=status or "(missing)",
        ))
        # Can't validate further without valid status
        return SchemaValidationResult(valid=False, violations=violations)

    evidence = response.get("evidence", [])
    conflicts = response.get("conflicts", [])
    conditions = response.get("conditions", [])
    verification_queries = response.get("verification_queries", [])
    anchor_sufficiency = response.get("anchor_sufficiency", {})

    # Status-specific validation
    if status == "CONSISTENT":
        # Evidence required
        if not evidence:
            violations.append(SchemaViolation(
                field="evidence",
                expected="at least one evidence item for CONSISTENT status",
                actual=f"{len(evidence)} items",
            ))

        # Conflicts should be empty
        if conflicts:
            violations.append(SchemaViolation(
                field="conflicts",
                expected="empty array for CONSISTENT status",
                actual=f"{len(conflicts)} conflicts",
                severity="warning",
            ))

        # Anchor sufficiency should be true
        if anchor_sufficiency and not anchor_sufficiency.get("sufficient", True):
            violations.append(SchemaViolation(
                field="anchor_sufficiency.sufficient",
                expected="true for CONSISTENT status",
                actual="false",
            ))

    elif status == "INCONSISTENT":
        # Conflicts required
        if not conflicts:
            violations.append(SchemaViolation(
                field="conflicts",
                expected="at least one conflict for INCONSISTENT status",
                actual=f"{len(conflicts)} conflicts",
            ))

        # Evidence should cite the conflict
        if not evidence:
            violations.append(SchemaViolation(
                field="evidence",
                expected="evidence citing the conflict source",
                actual=f"{len(evidence)} items",
                severity="warning",
            ))

    elif status == "CONDITIONAL":
        # Conditions required
        if not conditions:
            violations.append(SchemaViolation(
                field="conditions",
                expected="at least one condition for CONDITIONAL status",
                actual=f"{len(conditions)} conditions",
            ))

    elif status == "UNKNOWN":
        # Verification queries required
        if not verification_queries:
            violations.append(SchemaViolation(
                field="verification_queries",
                expected="at least one verification query for UNKNOWN status",
                actual=f"{len(verification_queries)} queries",
            ))

        # Anchor sufficiency should typically be false (but not strictly required)
        if anchor_sufficiency and anchor_sufficiency.get("sufficient", False):
            violations.append(SchemaViolation(
                field="anchor_sufficiency.sufficient",
                expected="false for UNKNOWN status (typically)",
                actual="true",
                severity="warning",
            ))

    # Validate evidence items structure
    for i, ev in enumerate(evidence):
        if not ev.get("source"):
            violations.append(SchemaViolation(
                field=f"evidence[{i}].source",
                expected="spec | guideline | decision | discussion",
                actual="(missing)",
            ))
        elif ev["source"] not in ["spec", "guideline", "decision", "discussion"]:
            violations.append(SchemaViolation(
                field=f"evidence[{i}].source",
                expected="spec | guideline | decision | discussion",
                actual=ev["source"],
            ))

        if not ev.get("id"):
            violations.append(SchemaViolation(
                field=f"evidence[{i}].id",
                expected="non-empty stable identifier",
                actual="(missing)",
            ))

        if not ev.get("excerpt"):
            violations.append(SchemaViolation(
                field=f"evidence[{i}].excerpt",
                expected="non-empty excerpt text",
                actual="(missing)",
            ))

    # Validate supersession_notes structure
    for i, note in enumerate(response.get("supersession_notes", [])):
        if not note.get("old_id"):
            violations.append(SchemaViolation(
                field=f"supersession_notes[{i}].old_id",
                expected="superseded ID",
                actual="(missing)",
            ))
        if not note.get("new_id"):
            violations.append(SchemaViolation(
                field=f"supersession_notes[{i}].new_id",
                expected="superseding ID",
                actual="(missing)",
            ))
        if not note.get("note"):
            violations.append(SchemaViolation(
                field=f"supersession_notes[{i}].note",
                expected="explanation of supersession",
                actual="(missing)",
            ))

    # Check for errors (not just warnings)
    has_errors = any(v.severity == "error" for v in violations)

    return SchemaValidationResult(
        valid=not has_errors,
        violations=violations,
    )


def validate_json_structure(json_str: str) -> tuple[bool, str, dict | None]:
    """
    Validate that a string is valid JSON.

    Returns:
        (is_valid, error_message, parsed_dict)
    """
    import json

    try:
        parsed = json.loads(json_str)
        if not isinstance(parsed, dict):
            return False, "Response must be a JSON object, not " + type(parsed).__name__, None
        return True, "", parsed
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e.msg} at position {e.pos}", None
