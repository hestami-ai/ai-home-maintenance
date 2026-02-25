"""
Static Verifier Pass (Phase 1.4)

Post-inference verification that scans adjudication responses for:
1. Uncited must/must not statements
2. Evidence-claim alignment
3. Potential conflicts via keyword extraction
"""

import re
from dataclasses import dataclass, field
from typing import Optional
from collections import Counter


@dataclass
class VerifierIssue:
    """An issue found by the static verifier"""
    category: str  # "uncited_normative", "weak_alignment", "potential_conflict", "keyword_mismatch"
    severity: str  # "error", "warning", "info"
    text: str
    location: str
    suggestion: str = ""


@dataclass
class AlignmentScore:
    """Score for evidence-claim alignment"""
    claim: str
    evidence_id: str
    score: float  # 0.0 to 1.0
    matched_keywords: list[str] = field(default_factory=list)
    reason: str = ""


@dataclass
class StaticVerifierResult:
    """Result of static verification pass"""
    passed: bool
    issues: list[VerifierIssue] = field(default_factory=list)
    alignment_scores: list[AlignmentScore] = field(default_factory=list)
    extracted_keywords: dict[str, list[str]] = field(default_factory=dict)
    error_count: int = 0
    warning_count: int = 0


# Strong normative patterns (require citation)
MUST_PATTERNS = [
    (r"\bmust\s+(?!not)", "MUST"),
    (r"\bmust\s+not\b", "MUST NOT"),
    (r"\bshall\s+(?!not)", "SHALL"),
    (r"\bshall\s+not\b", "SHALL NOT"),
    (r"\brequired\b", "REQUIRED"),
    (r"\bprohibited\b", "PROHIBITED"),
    (r"\bforbidden\b", "FORBIDDEN"),
    (r"\bmandatory\b", "MANDATORY"),
]

# Weak normative patterns (suggest citation)
SHOULD_PATTERNS = [
    (r"\bshould\s+(?!not)", "SHOULD"),
    (r"\bshould\s+not\b", "SHOULD NOT"),
    (r"\brecommended\b", "RECOMMENDED"),
    (r"\bpreferred\b", "PREFERRED"),
]

# Conflict indicator patterns
CONFLICT_PATTERNS = [
    r"\bviolates?\b",
    r"\bcontradicts?\b",
    r"\binconsistent\s+with\b",
    r"\bconflicts?\s+with\b",
    r"\bbreaks?\b.*\binvariant\b",
    r"\bincompatible\b",
]

# Citation patterns
CITATION_PATTERN = r"\[(spec|guideline|decision|discussion):[^\]]+\]"


def extract_domain_keywords(text: str) -> list[str]:
    """
    Extract domain-specific keywords from text for conflict detection.

    Focuses on technical terms, component names, and action verbs.
    """
    # Remove common words and extract meaningful terms
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "shall", "can", "this", "that",
        "these", "those", "it", "its", "with", "from", "for", "on", "at",
        "to", "of", "in", "and", "or", "but", "not", "no", "if", "then",
        "else", "when", "where", "which", "what", "who", "how", "why",
    }

    # Extract words (alphanumeric, allowing underscores and hyphens)
    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9]\b', text.lower())

    # Filter and count
    keywords = [w for w in words if w not in stop_words and len(w) > 2]
    counts = Counter(keywords)

    # Return most common keywords (appearing more than once or being significant)
    significant = [
        word for word, count in counts.most_common(20)
        if count > 1 or len(word) > 5
    ]

    return significant


def check_sentence_citation(sentence: str) -> bool:
    """Check if a sentence contains a citation."""
    return bool(re.search(CITATION_PATTERN, sentence, re.IGNORECASE))


def scan_uncited_normatives(
    text: str,
    location: str = "response",
) -> list[VerifierIssue]:
    """
    Scan text for uncited normative statements.

    Returns issues for:
    - MUST/SHALL without citations (error)
    - SHOULD/RECOMMENDED without citations (warning)
    """
    issues: list[VerifierIssue] = []

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        has_citation = check_sentence_citation(sentence)

        # Check strong normatives (errors)
        for pattern, norm_type in MUST_PATTERNS:
            if re.search(pattern, sentence, re.IGNORECASE) and not has_citation:
                issues.append(VerifierIssue(
                    category="uncited_normative",
                    severity="error",
                    text=sentence[:100] + ("..." if len(sentence) > 100 else ""),
                    location=location,
                    suggestion=f"'{norm_type}' statement requires citation. "
                    "Add [spec:DOC#section] or [decision:ID].",
                ))
                break  # One issue per sentence

        # Check weak normatives (warnings)
        if not any(re.search(p, sentence, re.IGNORECASE) for p, _ in MUST_PATTERNS):
            for pattern, norm_type in SHOULD_PATTERNS:
                if re.search(pattern, sentence, re.IGNORECASE) and not has_citation:
                    issues.append(VerifierIssue(
                        category="uncited_normative",
                        severity="warning",
                        text=sentence[:100] + ("..." if len(sentence) > 100 else ""),
                        location=location,
                        suggestion=f"'{norm_type}' statement should ideally have a citation.",
                    ))
                    break

    return issues


def check_evidence_claim_alignment(
    claims: list[str],
    evidence_items: list[dict],
) -> list[AlignmentScore]:
    """
    Check how well evidence excerpts align with claims.

    Uses keyword overlap as a heuristic for alignment.
    """
    scores: list[AlignmentScore] = []

    for claim in claims:
        claim_keywords = set(extract_domain_keywords(claim))

        best_match: Optional[AlignmentScore] = None
        best_score = 0.0

        for ev in evidence_items:
            excerpt = ev.get("excerpt", "")
            ev_id = ev.get("id", "unknown")
            excerpt_keywords = set(extract_domain_keywords(excerpt))

            if not claim_keywords or not excerpt_keywords:
                continue

            # Jaccard similarity
            intersection = claim_keywords & excerpt_keywords
            union = claim_keywords | excerpt_keywords
            score = len(intersection) / len(union) if union else 0.0

            if score > best_score:
                best_score = score
                best_match = AlignmentScore(
                    claim=claim[:80] + ("..." if len(claim) > 80 else ""),
                    evidence_id=ev_id,
                    score=score,
                    matched_keywords=list(intersection)[:5],
                    reason="Keyword overlap" if score > 0.2 else "Weak keyword match",
                )

        if best_match:
            scores.append(best_match)
        else:
            scores.append(AlignmentScore(
                claim=claim[:80] + ("..." if len(claim) > 80 else ""),
                evidence_id="(none)",
                score=0.0,
                matched_keywords=[],
                reason="No matching evidence found",
            ))

    return scores


def detect_potential_conflicts(
    comments: str,
    conflicts: list[str],
    evidence_items: list[dict],
) -> list[VerifierIssue]:
    """
    Detect potential conflicts that might not be explicitly listed.

    Looks for conflict language in comments that isn't backed by conflicts[].
    """
    issues: list[VerifierIssue] = []

    # Check if comments contain conflict language
    for pattern in CONFLICT_PATTERNS:
        matches = re.findall(pattern, comments, re.IGNORECASE)
        if matches:
            # This language suggests a conflict - is it documented?
            if not conflicts:
                issues.append(VerifierIssue(
                    category="potential_conflict",
                    severity="warning",
                    text=f"Conflict language detected ('{matches[0]}') but conflicts[] is empty",
                    location="comments",
                    suggestion="If a conflict exists, add it to the conflicts[] array.",
                ))
            break

    return issues


def verify_response(
    response: dict,
    proposal: Optional[dict] = None,
) -> StaticVerifierResult:
    """
    Run full static verification on an adjudication response.

    Checks:
    1. Uncited normative statements in comments, conflicts, conditions
    2. Evidence-claim alignment
    3. Potential undocumented conflicts
    """
    issues: list[VerifierIssue] = []
    alignment_scores: list[AlignmentScore] = []
    extracted_keywords: dict[str, list[str]] = {}

    comments = response.get("comments", "")
    conflicts = response.get("conflicts", [])
    conditions = response.get("conditions", [])
    evidence = response.get("evidence", [])

    # 1. Scan for uncited normatives
    issues.extend(scan_uncited_normatives(comments, "comments"))
    for i, conflict in enumerate(conflicts):
        issues.extend(scan_uncited_normatives(conflict, f"conflicts[{i}]"))
    for i, condition in enumerate(conditions):
        issues.extend(scan_uncited_normatives(condition, f"conditions[{i}]"))

    # 2. Check evidence-claim alignment
    all_claims = conflicts + conditions
    if all_claims and evidence:
        alignment_scores = check_evidence_claim_alignment(all_claims, evidence)

        # Flag weak alignments
        for score in alignment_scores:
            if score.score < 0.1 and score.evidence_id != "(none)":
                issues.append(VerifierIssue(
                    category="weak_alignment",
                    severity="warning",
                    text=f"Weak alignment (score={score.score:.2f}) between claim and evidence",
                    location=f"claim: {score.claim}",
                    suggestion=f"Evidence '{score.evidence_id}' may not support this claim.",
                ))

    # 3. Detect potential conflicts
    issues.extend(detect_potential_conflicts(comments, conflicts, evidence))

    # 4. Extract keywords for analysis
    extracted_keywords["comments"] = extract_domain_keywords(comments)
    extracted_keywords["conflicts"] = extract_domain_keywords(" ".join(conflicts))
    extracted_keywords["evidence"] = extract_domain_keywords(
        " ".join(e.get("excerpt", "") for e in evidence)
    )

    # Count by severity
    error_count = sum(1 for i in issues if i.severity == "error")
    warning_count = sum(1 for i in issues if i.severity == "warning")

    return StaticVerifierResult(
        passed=error_count == 0,
        issues=issues,
        alignment_scores=alignment_scores,
        extracted_keywords=extracted_keywords,
        error_count=error_count,
        warning_count=warning_count,
    )
