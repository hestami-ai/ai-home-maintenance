"""
Verification Workflow - DBOS durable workflow for proposal verification.

This workflow implements the Historian verification pipeline as a
durable, checkpointed process that can recover from failures.
"""

from datetime import datetime
from typing import Any

import structlog
from dbos import DBOS, SetWorkflowID

from historian.config import get_settings
from historian.models import (
    BeadsTrace,
    ClaimSet,
    CoveragePlan,
    EvidencePacketSet,
    FailureMode,
    Judgment,
    Proposal,
    RetrievalPlan,
    TruthContext,
    Verdict,
    WorkflowState,
)
from historian.models.artifacts import AuditBundle
from historian.services import DoltClient, PageIndexClient, VLLMClient

logger = structlog.get_logger()


class WorkflowContext:
    """
    Context object tracking the state of a verification workflow.

    Holds all artifacts produced during execution and tracks
    the current workflow state.
    """

    def __init__(self, run_id: str, proposal: Proposal):
        self.run_id = run_id
        self.proposal = proposal
        self.state = WorkflowState.INIT
        self.spec_commit: str | None = None
        self.index_version: str | None = None
        self.claim_set: ClaimSet | None = None
        self.coverage_plan: CoveragePlan | None = None
        self.retrieval_plan: RetrievalPlan | None = None
        self.evidence_set: EvidencePacketSet | None = None
        self.truth_context: TruthContext | None = None
        self.beads_trace: BeadsTrace | None = None
        self.judgment: Judgment | None = None
        self.failure_mode: FailureMode | None = None
        self.error_details: str | None = None
        self.started_at: datetime = datetime.utcnow()
        self.completed_at: datetime | None = None


class VerificationWorkflow:
    """
    DBOS-enabled durable workflow for proposal verification.

    Implements the full Historian verification pipeline with
    checkpointing at each state transition for recovery.
    """

    def __init__(self):
        self.settings = get_settings()
        self.vllm = VLLMClient()
        self.pageindex = PageIndexClient()
        self.dolt = DoltClient()

    async def initialize(self) -> None:
        """Initialize service connections."""
        await self.dolt.initialize()

    async def cleanup(self) -> None:
        """Clean up service connections."""
        await self.pageindex.close()
        await self.dolt.close()

    @DBOS.workflow()
    async def run(self, proposal: Proposal) -> Judgment | None:
        """
        Execute the full verification workflow.

        Args:
            proposal: The proposal to verify

        Returns:
            Judgment if successful, None if failed
        """
        ctx = WorkflowContext(
            run_id=DBOS.workflow_id or f"run_{datetime.utcnow().isoformat()}",
            proposal=proposal,
        )

        logger.info(
            "workflow_started",
            run_id=ctx.run_id,
            proposal_id=proposal.proposal_id,
        )

        try:
            # Phase 1: Setup
            await self._ingest_proposal(ctx)
            await self._resolve_truth_baseline(ctx)
            await self._validate_index_alignment(ctx)

            # Phase 2: Decomposition
            await self._decompose_claims(ctx)
            await self._generate_coverage_plan(ctx)
            await self._build_retrieval_plan(ctx)

            # Phase 3: Evidence gathering
            await self._retrieve_evidence(ctx)
            await self._assemble_truth_context(ctx)

            # Phase 4: Reasoning
            await self._construct_beads_trace(ctx)
            await self._validate_trace_and_coverage(ctx)

            # Phase 5: Output
            await self._emit_judgment(ctx)
            await self._package_audit_bundle(ctx)

            ctx.state = WorkflowState.DONE
            ctx.completed_at = datetime.utcnow()

            logger.info(
                "workflow_completed",
                run_id=ctx.run_id,
                verdict=ctx.judgment.verdict if ctx.judgment else None,
            )

            return ctx.judgment

        except WorkflowFailure as e:
            ctx.failure_mode = e.failure_mode
            ctx.error_details = str(e)
            logger.error(
                "workflow_failed",
                run_id=ctx.run_id,
                failure_mode=e.failure_mode,
                error=str(e),
            )
            return None

    # =========================================================================
    # Workflow Steps (DBOS steps for durability)
    # =========================================================================

    @DBOS.step()
    async def _ingest_proposal(self, ctx: WorkflowContext) -> None:
        """Validate and ingest the proposal."""
        ctx.state = WorkflowState.INGEST_PROPOSAL
        logger.debug("step_ingest_proposal", proposal_id=ctx.proposal.proposal_id)

        # Validate proposal has content
        if not ctx.proposal.content or not ctx.proposal.content.strip():
            raise WorkflowFailure(
                FailureMode.FAIL_INPUT_INVALID,
                "Proposal content is empty or missing",
            )

        # TODO: Additional validation in Phase 1

    @DBOS.step()
    async def _resolve_truth_baseline(self, ctx: WorkflowContext) -> None:
        """Determine which spec version to use."""
        ctx.state = WorkflowState.RESOLVE_TRUTH_BASELINE
        logger.debug("step_resolve_truth_baseline")

        try:
            ctx.spec_commit = await self.dolt.get_current_commit()
            logger.info("truth_baseline_resolved", spec_commit=ctx.spec_commit)
        except Exception as e:
            raise WorkflowFailure(
                FailureMode.FAIL_SYSTEM_ERROR,
                f"Failed to resolve truth baseline: {e}",
            )

    @DBOS.step()
    async def _validate_index_alignment(self, ctx: WorkflowContext) -> None:
        """Verify PageIndex is aligned with truth baseline."""
        ctx.state = WorkflowState.VALIDATE_INDEX_ALIGNMENT
        logger.debug("step_validate_index_alignment")

        try:
            ctx.index_version = await self.pageindex.get_index_version()

            # TODO: Implement actual alignment check in Phase 1
            # For now, just log the versions
            logger.info(
                "index_alignment_check",
                spec_commit=ctx.spec_commit,
                index_version=ctx.index_version,
            )
        except Exception as e:
            raise WorkflowFailure(
                FailureMode.FAIL_AUTHORITY_MISMATCH,
                f"Index alignment check failed: {e}",
            )

    @DBOS.step()
    async def _decompose_claims(self, ctx: WorkflowContext) -> None:
        """Parse proposal into verifiable claims."""
        ctx.state = WorkflowState.DECOMPOSE_CLAIMS
        logger.debug("step_decompose_claims")

        # TODO: Implement claim decomposition with LLM in Phase 1
        # For now, create placeholder ClaimSet
        ctx.claim_set = ClaimSet(
            proposal_id=ctx.proposal.proposal_id,
            claims=[],
        )

    @DBOS.step()
    async def _generate_coverage_plan(self, ctx: WorkflowContext) -> None:
        """Define what complete verification looks like."""
        ctx.state = WorkflowState.GENERATE_COVERAGE_PLAN
        logger.debug("step_generate_coverage_plan")

        # TODO: Implement coverage planning in Phase 1
        ctx.coverage_plan = CoveragePlan(
            coverage_threshold=self.settings.orchestrator.coverage_threshold,
        )

    @DBOS.step()
    async def _build_retrieval_plan(self, ctx: WorkflowContext) -> None:
        """Create queries for evidence retrieval."""
        ctx.state = WorkflowState.BUILD_RETRIEVAL_PLAN
        logger.debug("step_build_retrieval_plan")

        # TODO: Implement retrieval planning in Phase 1
        ctx.retrieval_plan = RetrievalPlan()

    @DBOS.step()
    async def _retrieve_evidence(self, ctx: WorkflowContext) -> None:
        """Execute retrieval plan against PageIndex."""
        ctx.state = WorkflowState.RETRIEVE_EVIDENCE
        logger.debug("step_retrieve_evidence")

        # TODO: Implement evidence retrieval in Phase 1
        ctx.evidence_set = EvidencePacketSet()

    @DBOS.step()
    async def _assemble_truth_context(self, ctx: WorkflowContext) -> None:
        """Query Dolt for relevant truth context."""
        ctx.state = WorkflowState.ASSEMBLE_TRUTH_CONTEXT
        logger.debug("step_assemble_truth_context")

        # TODO: Implement truth context assembly in Phase 1
        ctx.truth_context = TruthContext(
            spec_version=ctx.spec_commit or "unknown",
        )

    @DBOS.step()
    async def _construct_beads_trace(self, ctx: WorkflowContext) -> None:
        """Build reasoning trace comparing claims to evidence."""
        ctx.state = WorkflowState.CONSTRUCT_BEADS_TRACE
        logger.debug("step_construct_beads_trace")

        # TODO: Implement reasoning in Phase 2
        ctx.beads_trace = BeadsTrace()

    @DBOS.step()
    async def _validate_trace_and_coverage(self, ctx: WorkflowContext) -> None:
        """Validate trace consistency and coverage completeness."""
        ctx.state = WorkflowState.VALIDATE_TRACE_AND_COVERAGE
        logger.debug("step_validate_trace_and_coverage")

        # TODO: Implement validation in Phase 2
        pass

    @DBOS.step()
    async def _emit_judgment(self, ctx: WorkflowContext) -> None:
        """Generate final judgment based on reasoning."""
        ctx.state = WorkflowState.EMIT_JUDGMENT
        logger.debug("step_emit_judgment")

        # TODO: Implement judgment logic in Phase 2
        # For now, create placeholder judgment
        ctx.judgment = Judgment(
            run_id=ctx.run_id,
            verdict=Verdict.REVISE,  # Default to REVISE until implemented
            audit_trail_refs={
                "spec_commit": ctx.spec_commit or "unknown",
                "index_version": ctx.index_version or "unknown",
            },
        )

    @DBOS.step()
    async def _package_audit_bundle(self, ctx: WorkflowContext) -> None:
        """Package all artifacts into audit bundle."""
        ctx.state = WorkflowState.PACKAGE_AUDIT_BUNDLE
        logger.debug("step_package_audit_bundle")

        # Create audit bundle (in Phase 1, we'll persist this)
        bundle = AuditBundle(
            run_id=ctx.run_id,
            proposal=ctx.proposal,
            claim_set=ctx.claim_set or ClaimSet(proposal_id=ctx.proposal.proposal_id),
            coverage_plan=ctx.coverage_plan or CoveragePlan(),
            retrieval_plan=ctx.retrieval_plan or RetrievalPlan(),
            evidence_set=ctx.evidence_set or EvidencePacketSet(),
            truth_context=ctx.truth_context or TruthContext(spec_version="unknown"),
            beads_trace=ctx.beads_trace or BeadsTrace(),
            judgment=ctx.judgment or Judgment(run_id=ctx.run_id, verdict=Verdict.REVISE),
            metadata={
                "started_at": ctx.started_at.isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
                "spec_commit": ctx.spec_commit,
                "index_version": ctx.index_version,
            },
        )

        # TODO: Persist audit bundle to disk in Phase 1
        logger.info("audit_bundle_created", run_id=ctx.run_id)


class WorkflowFailure(Exception):
    """Exception raised when a workflow step fails."""

    def __init__(self, failure_mode: FailureMode, message: str):
        self.failure_mode = failure_mode
        super().__init__(f"{failure_mode.value}: {message}")
