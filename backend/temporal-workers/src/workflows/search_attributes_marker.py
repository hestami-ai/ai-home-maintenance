"""
Simple marker workflow to indicate search attributes have been registered.
This workflow doesn't do anything except exist as a record in Temporal.
"""
from datetime import timedelta
from temporalio import workflow

@workflow.defn(name="SearchAttributesRegistrationMarker")
class SearchAttributesRegistrationMarker:
    """
    Marker workflow that indicates search attributes have been registered.
    This workflow doesn't do anything except exist as a record in Temporal.
    """
    
    @workflow.run
    async def run(self) -> str:
        """
        Run the marker workflow.
        
        Returns:
            str: Confirmation message
        """
        # This workflow doesn't do anything except exist as a record
        workflow.logger.info("Search attributes registration marker workflow started")
        
        # Complete immediately - we just need the workflow to exist in history
        return "Search attributes registration marker completed"
