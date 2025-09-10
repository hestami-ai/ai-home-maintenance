import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Set, Union
from enum import Enum, auto

from temporalio import workflow
from temporalio.common import RetryPolicy, SearchAttributeKey

# Configure logging
logger = logging.getLogger(__name__)

# Common retry policy for initial attempts
INITIAL_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=10),
    maximum_attempts=2  # Reduced to allow for intervention sooner
)

# No retry policy for post-intervention execution
NO_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=1),
    maximum_attempts=1
)

# Define signal names
RETRY_ACTIVITY_SIGNAL = "retry_activity"
RESUME_WORKFLOW_SIGNAL = "resume_workflow"

# Define search attributes
IsBlocked = SearchAttributeKey.for_bool("IsBlocked")
BlockedActivity = SearchAttributeKey.for_keyword("BlockedActivity")
BlockedError = SearchAttributeKey.for_text("BlockedError")
BlockedAt = SearchAttributeKey.for_datetime("BlockedAt")
InterventionId = SearchAttributeKey.for_keyword("InterventionId")

# Activity state enum
class ActivityState(Enum):
    """Enum representing the possible states of an activity execution."""
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    AWAITING_INTERVENTION = auto()
    INTERVENTION_RESOLVED = auto()

# Activity execution record
class ActivityExecution:
    """Class to track the state and metadata of an activity execution."""
    def __init__(self, activity_name: str, attempt: int = 1):
        self.activity_name: str = activity_name
        self.attempt: int = attempt
        self.state: ActivityState = ActivityState.PENDING
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.error: Optional[str] = None
        self.intervention_id: Optional[str] = None
        self.result: Any = None
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert the execution record to a dictionary for queries."""
        return {
            "activity_name": self.activity_name,
            "attempt": self.attempt,
            "state": self.state.name,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "error": self.error,
            "intervention_id": self.intervention_id
        }

class InterventionAwareWorkflow:
    """
    Base class for workflows that support activity intervention.
    
    This class provides the core functionality for tracking activity executions,
    handling failures, and managing interventions. Workflows that need intervention
    support should inherit from this class.
    """
    def __init__(self):
        # Track all activity executions by execution_id
        self.activity_executions: Dict[str, ActivityExecution] = {}
        
        # Map intervention_ids to execution_ids for quick lookup
        self.intervention_map: Dict[str, str] = {}
        
        # Track if the workflow is currently blocked
        self.is_blocked: bool = False
        
        # Current activity being executed
        self.current_activity: Optional[str] = None
        
        # Optional timeout for interventions (None = indefinite)
        self.intervention_timeout: Optional[timedelta] = None
    
    async def _execute_activity_with_intervention(
        self, 
        activity_name: str, 
        args: Optional[List] = None, 
        kwargs: Optional[Dict[str, Any]] = None,
        start_to_close_timeout: Optional[timedelta] = None,
        schedule_to_close_timeout: Optional[timedelta] = None,
        intervention_timeout: Optional[timedelta] = None,
    ) -> Any:
        """
        Execute an activity with intervention support.
        
        If the activity fails after retries, this method will:
        1. Generate a unique intervention ID
        2. Update workflow state to indicate intervention is needed
        3. Wait for an intervention signal
        4. Retry the activity after intervention
        
        Args:
            activity_name: Name of the activity to execute
            args: Positional arguments for the activity
            kwargs: Keyword arguments for the activity
            start_to_close_timeout: Timeout for activity execution
            schedule_to_close_timeout: Overall timeout for activity scheduling and execution
            intervention_timeout: Optional timeout for waiting for intervention
            
        Returns:
            The result of the activity execution
        """
        args = args or []
        kwargs = kwargs or {}
        
        # Generate a unique execution ID for this activity execution
        execution_id = f"{activity_name}_{workflow.uuid4()}"
        
        # Create and store execution record
        execution = ActivityExecution(activity_name)
        self.activity_executions[execution_id] = execution
        
        # Update state
        execution.state = ActivityState.RUNNING
        execution.start_time = workflow.now()
        self.current_activity = activity_name
        
        try:
            # Execute the activity with initial retry policy
            # Handle kwargs properly
            if kwargs:
                result = await workflow.execute_activity(
                    activity_name,
                    args=args,
                    **kwargs,
                    retry_policy=INITIAL_RETRY_POLICY,
                    start_to_close_timeout=start_to_close_timeout,
                    schedule_to_close_timeout=schedule_to_close_timeout
                )
            else:
                result = await workflow.execute_activity(
                    activity_name,
                    args=args,
                    retry_policy=INITIAL_RETRY_POLICY,
                    start_to_close_timeout=start_to_close_timeout,
                    schedule_to_close_timeout=schedule_to_close_timeout
                )
            
            # Activity completed successfully
            execution.state = ActivityState.COMPLETED
            execution.end_time = workflow.now()
            execution.result = result
            self.current_activity = None
            
            return result
            
        except Exception as e:
            # Activity failed after retries
            execution.state = ActivityState.FAILED
            execution.end_time = workflow.now()
            execution.error = str(e)
            
            # Generate intervention ID
            workflow_id = workflow.info().workflow_id
            workflow_run_id = workflow.info().run_id
            intervention_id = f"{workflow_id}:{workflow_run_id}:{execution_id}"
            
            # Update execution record
            execution.state = ActivityState.AWAITING_INTERVENTION
            execution.intervention_id = intervention_id
            self.intervention_map[intervention_id] = execution_id
            
            # Mark workflow as blocked
            self.is_blocked = True
            
            # Update search attributes for visibility in Temporal UI
            await workflow.upsert_search_attributes({
                IsBlocked: True,
                BlockedActivity: activity_name,
                BlockedError: str(e),
                BlockedAt: workflow.now(),
                InterventionId: intervention_id
            })
            
            # Define condition for waiting
            def intervention_resolved():
                return self.activity_executions[execution_id].state == ActivityState.INTERVENTION_RESOLVED
            
            # Wait for intervention with optional timeout
            if intervention_timeout:
                try:
                    await workflow.wait_condition(intervention_resolved, timeout=intervention_timeout)
                except workflow.DeadlineExceeded:
                    # Intervention timeout exceeded
                    raise workflow.ApplicationError(
                        f"Intervention timeout exceeded for activity {activity_name}",
                        non_retryable=True
                    )
            else:
                # Wait indefinitely
                await workflow.wait_condition(intervention_resolved)
            
            # Intervention received, retry the activity without retries
            try:
                result = await workflow.execute_activity(
                    activity_name,
                    args=args,
                    kwargs=kwargs,
                    retry_policy=NO_RETRY_POLICY,  # No retries after intervention
                    start_to_close_timeout=start_to_close_timeout,
                    schedule_to_close_timeout=schedule_to_close_timeout
                )
                
                # Activity completed successfully after intervention
                execution.state = ActivityState.COMPLETED
                execution.end_time = workflow.now()
                execution.result = result
                self.current_activity = None
                
                # Clear blocked state
                self.is_blocked = False
                await workflow.upsert_search_attributes({
                    IsBlocked: False,
                    BlockedActivity: "",
                    BlockedError: "",
                    InterventionId: ""
                })
                
                return result
                
            except Exception as new_e:
                # Activity failed again after intervention
                execution.state = ActivityState.FAILED
                execution.end_time = workflow.now()
                execution.error = str(new_e)
                
                # Re-mark as awaiting intervention with new error
                execution.state = ActivityState.AWAITING_INTERVENTION
                
                # Update search attributes
                await workflow.upsert_search_attributes({
                    BlockedError: str(new_e)
                })
                
                # Raise the error to fail the workflow
                raise
    
    @workflow.signal
    async def resolve_intervention(self, intervention_id: str) -> None:
        """
        Signal handler to resolve an intervention.
        
        Args:
            intervention_id: The ID of the intervention to resolve
        """
        if intervention_id in self.intervention_map:
            execution_id = self.intervention_map[intervention_id]
            execution = self.activity_executions[execution_id]
            
            # Mark as resolved
            execution.state = ActivityState.INTERVENTION_RESOLVED
            
            # Log the resolution
            workflow.logger.info(f"Intervention {intervention_id} resolved for activity {execution.activity_name}")
        else:
            workflow.logger.warning(f"Unknown intervention ID: {intervention_id}")
    
    @workflow.query
    def get_activity_states(self) -> Dict[str, Dict[str, Any]]:
        """
        Query handler to get the state of all activity executions.
        
        Returns:
            Dictionary mapping execution IDs to activity execution states
        """
        return {k: v.to_dict() for k, v in self.activity_executions.items()}
    
    @workflow.query
    def get_intervention_ids(self) -> List[str]:
        """
        Query handler to get all intervention IDs.
        
        Returns:
            List of intervention IDs
        """
        return list(self.intervention_map.keys())
    
    @workflow.query
    def get_blocked_activities(self) -> List[Dict[str, Any]]:
        """
        Query handler to get activities awaiting intervention.
        
        Returns:
            List of activity execution records awaiting intervention
        """
        return [v.to_dict() for v in self.activity_executions.values() 
                if v.state == ActivityState.AWAITING_INTERVENTION]
    
    @workflow.query
    def is_workflow_blocked(self) -> bool:
        """
        Query handler to check if the workflow is blocked.
        
        Returns:
            True if the workflow is blocked, False otherwise
        """
        return self.is_blocked
