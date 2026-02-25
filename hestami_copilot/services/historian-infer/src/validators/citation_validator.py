"""
Citation Validator (Phase 1.3)

Validates that all normative claims in an adjudication response are properly cited.
Ensures no uncited normative statements exist in the response.
"""

import re
from dataclasses import dataclass, field


# Normative language patterns that require citations
NORMATIVE_PATTERNS = [
    r"\bmust\b",
    r"\bmust not\b",
    r"\bshall\b",
    r"\bshall not\b",
    r"\brequired\b",
    r"\brequirement\b",
    r"\bprohibited\b",
    r"\bforbidden\b",
    r"\bmandatory\b",
    r"\bviolates?\b",
    r"\bviolation\b",
    r"\bcompliant\b",
    r"\bnon-compliant\b",
    r"\binconsistent\b",
    r"\bconflicts?\s+with\b",
    r"\bcontradicts?\b",
    r"\bspecification\s+requires\b",
    r"\baccording\s+to\b",
    r"\bper\s+the\b",
]

# Citation patterns in text
CITATION_PATTERNS = [
    r"\[spec:[^\]]+\]",  # [spec:DOC#section]
    r"\[guideline:[^\]]+\]",  # [guideline:ID]
    r"\[decision:[^\]]+\]",  # [decision:DEC-123]
    r"\[discussion:[^\]]+\]",  # [discussion:ID]
    r"spec_ref:\s*[A-Z0-9_-]+#",  # spec_ref: format
    r"doc_id:\s*[A-Z0-9_-]+",  # doc_id: format
]


@dataclass
class CitationIssue:
    """A citation validation issue"""
    issue_type: str  # "uncited_normative", "orphan_citation", "invalid_citation"
    text: str
    line_number: int = 0
    suggestion: str = ""


@dataclass
class CitationValidationResult:
    """Result of citation validation"""
    valid: bool
    issues: list[CitationIssue] = field(default_factory=list)
    normative_count: int = 0
    cited_count: int = 0
    uncited_count: int = 0


def extract_normative_statements(text: str) -> list[tuple[str, int]]:
    """
    Extract sentences containing normative language.

    Returns list of (sentence, line_number) tuples.
    """
    # Split into sentences (simple approach)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    normative_statements = []

    line_num = 1
    for sentence in sentences:
        sentence_lower = sentence.lower()
        for pattern in NORMATIVE_PATTERNS:
            if re.search(pattern, sentence_lower):
                normative_statements.append((sentence.strip(), line_num))
                break
        line_num += sentence.count('\n') + 1

    return normative_statements


def extract_citations(text: str) -> list[str]:
    """
    Extract all citations from text.

    Returns list of citation strings.
    """
    citations = []
    for pattern in CITATION_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        citations.extend(matches)
    return citations


def sentence_has_citation(sentence: str, all_citations: list[str]) -> bool:
    """
    Check if a sentence contains or is associated with a citation.
    """
    # Direct citation in sentence
    for pattern in CITATION_PATTERNS:
        if re.search(pattern, sentence, re.IGNORECASE):
            return True

    # Check if any extracted citation appears in the sentence
    for citation in all_citations:
        if citation.lower() in sentence.lower():
            return True

    return False


def validate_citations(
    adjudication_text: str,
    evidence_items: list[dict],
    conflicts: list[str],
    comments: str,
) -> CitationValidationResult:
    """
    Validate that all normative claims are properly cited.

    Rules:
    1. Every sentence with normative language must have a citation
    2. Conflicts must cite the conflicting evidence
    3. No orphan citations (citing non-existent evidence)
    """
    issues: list[CitationIssue] = []

    # Combine all text for analysis
    full_text = f"{adjudication_text}\n{comments}\n" + "\n".join(conflicts)

    # Extract all citations
    all_citations = extract_citations(full_text)
    evidence_ids = {e.get("id", "") for e in evidence_items}

    # Rule 1: Check normative statements have citations
    normative_statements = extract_normative_statements(full_text)
    uncited_count = 0

    for statement, line_num in normative_statements:
        if not sentence_has_citation(statement, all_citations):
            uncited_count += 1
            issues.append(CitationIssue(
                issue_type="uncited_normative",
                text=statement[:100] + ("..." if len(statement) > 100 else ""),
                line_number=line_num,
                suggestion="Add a citation like [spec:DOC#section] to support this claim.",
            ))

    # Rule 2: Check conflicts have citations
    for i, conflict in enumerate(conflicts):
        if not extract_citations(conflict):
            issues.append(CitationIssue(
                issue_type="uncited_conflict",
                text=conflict[:100] + ("..." if len(conflict) > 100 else ""),
                suggestion="Conflicts must cite the specific evidence that shows the inconsistency.",
            ))

    # Rule 3: Check for orphan citations (citing non-existent evidence)
    for citation in all_citations:
        # Extract the ID from the citation
        match = re.search(r':([^:\]]+)\]?$', citation)
        if match:
            cited_id = match.group(1).strip()
            # Check if this ID exists in evidence
            found = any(
                cited_id in eid or eid in cited_id
                for eid in evidence_ids
            )
            if not found and evidence_ids:
                issues.append(CitationIssue(
                    issue_type="orphan_citation",
                    text=citation,
                    suggestion=f"Citation '{citation}' not found in evidence bundle. "
                    f"Available: {', '.join(list(evidence_ids)[:3])}",
                ))

    cited_count = len(normative_statements) - uncited_count

    return CitationValidationResult(
        valid=len(issues) == 0,
        issues=issues,
        normative_count=len(normative_statements),
        cited_count=cited_count,
        uncited_count=uncited_count,
    )


def validate_response_citations(response: dict) -> CitationValidationResult:
    """
    Validate citations in an AdjudicationResponse.
    """
    # Extract text fields to validate
    comments = response.get("comments", "")
    conflicts = response.get("conflicts", [])
    conditions = response.get("conditions", [])
    evidence = response.get("evidence", [])

    # Build adjudication text from all fields
    adjudication_text = comments + "\n" + "\n".join(conflicts) + "\n" + "\n".join(conditions)

    return validate_citations(
        adjudication_text=adjudication_text,
        evidence_items=evidence,
        conflicts=conflicts,
        comments=comments,
    )
