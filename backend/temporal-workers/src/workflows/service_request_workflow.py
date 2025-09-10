import logging
from datetime import timedelta
from typing import Dict, Any, List
from uuid import UUID

from temporalio import workflow
from temporalio.exceptions import ApplicationError

# Import activities
with workflow.unsafe.imports_passed_through():
    from activities.service_request_activities import (
        get_service_request_details,
        update_service_request_status
    )
    from workflows.workflow_common import (
        InterventionAwareWorkflow,
        ActivityState
    )

# Configure logging
logger = logging.getLogger(__name__)

@workflow.defn
class ServiceRequestProcessingWorkflow(InterventionAwareWorkflow):
    """
    Workflow for processing service requests with intervention support.
    
    This workflow handles the processing of service requests, including:
    1. Retrieving service request details
    2. Processing the service request based on its status
    3. Updating the service request status as needed
    
    It inherits from InterventionAwareWorkflow to support activity intervention
    when activities fail, allowing for manual intervention and retry.
    """
    
    @workflow.run
    async def run(self, request_id: str) -> Dict[str, Any]:
        """
        Execute the service request processing workflow.
        
        Args:
            request_id: UUID of the service request to process
            
        Returns:
            Dict containing the final service request details
        """
        workflow.logger.info(f"Starting service request processing workflow for request ID: {request_id}")
        
        try:
            # Step 1: Retrieve service request details using intervention-aware execution
            service_request = await self._execute_activity_with_intervention(
                "get_service_request_details",
                args=[request_id],
                start_to_close_timeout=timedelta(seconds=30)
            )
            
            workflow.logger.info(f"Retrieved service request: {service_request['title']} (Status: {service_request['status']})")
            
            # Step 2: Process the service request based on its status
            # This is a placeholder for additional processing steps that would be added
            # based on specific requirements
            
            # Example of conditional processing based on status
            current_status = service_request['status']
            new_status = None
            
            if current_status == "PENDING":
                # Example: If the request is pending, move it to IN_RESEARCH
                workflow.logger.info(f"Processing pending service request: {request_id}")
                new_status = "IN_RESEARCH"
                
            elif current_status == "IN_RESEARCH":
                # Example: Additional processing for research phase
                workflow.logger.info(f"Processing research phase for service request: {request_id}")
                # Additional activities would be called here using self._execute_activity_with_intervention
                
            # Step 3: Update the service request status if needed
            if new_status and new_status != current_status:
                updated_service_request = await self._execute_activity_with_intervention(
                    "update_service_request_status",
                    args=[request_id, new_status],
                    start_to_close_timeout=timedelta(seconds=30)
                )
                workflow.logger.info(f"Updated service request status to {new_status}")
                service_request = updated_service_request
            
            workflow.logger.info(f"Completed service request processing workflow for request ID: {request_id}")
            return service_request
            
        except Exception as e:
            # If any unhandled exception occurs, check if we're blocked
            if self.is_blocked:
                workflow.logger.error(f"Workflow blocked due to activity failure: {str(e)}")
                return {
                    "status": "blocked",
                    "message": f"Workflow blocked waiting for intervention: {str(e)}",
                    "request_id": request_id,
                    "blocked_activity": self.current_activity,
                    "intervention_ids": self.get_intervention_ids()
                }
            else:
                # Log the error before re-raising
                workflow.logger.error(f"Failed service request processing for request ID: {request_id}: {str(e)}")
                # Re-raise the original error
                raise
    
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
