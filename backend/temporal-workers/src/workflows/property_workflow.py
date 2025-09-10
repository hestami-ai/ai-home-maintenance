import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple, Set, Union

from temporalio import workflow

# Import common workflow components
from workflows.workflow_common import (
    InterventionAwareWorkflow,
    ActivityState,
    ActivityExecution,
    INITIAL_RETRY_POLICY,
    NO_RETRY_POLICY,
    IsBlocked,
    BlockedActivity,
    BlockedError,
    BlockedAt,
    InterventionId
)

# Configure logging
logger = logging.getLogger(__name__)

@workflow.defn
class PropertyCountyWorkflow(InterventionAwareWorkflow):
    """Workflow to lookup and update the county information for a property."""
    
    @workflow.run
    async def run(self, property_id: str) -> Dict[str, Any]:
        """
        Workflow to lookup and update the county information for a property.
        
        Args:
            property_id: The ID of the property to process
            
        Returns:
            dict: Status information about the workflow execution
        """
        # Initialize parent class
        super().__init__()
        
        try:
            # First, get the property details to access the address
            property_details = await self._execute_activity_with_intervention(
                "get_property_details",
                args=[property_id],
                start_to_close_timeout=timedelta(seconds=30)
            )
            
            # Extract the address from the property details
            address = self._extract_full_address(property_details)
            
            if not address:
                return {
                    "status": "error",
                    "message": "Could not extract a valid address from property details",
                    "property_id": property_id
                }
            
            # Call Azure Maps to find county information
            county_info = await self._execute_activity_with_intervention(
                "find_property_county",
                args=[{"address": address}],
                start_to_close_timeout=timedelta(seconds=30)
            )
            
            if not county_info.get("success", False):
                return {
                    "status": "error",
                    "message": county_info.get("error", "Failed to find county information"),
                    "property_id": property_id
                }
            
            # Update the property with the county information
            update_result = await self._execute_activity_with_intervention(
                "update_property_county",
                args=[property_id, county_info],
                start_to_close_timeout=timedelta(seconds=30)
            )
            
            return {
                "status": "success",
                "message": "Property county information updated",
                "property_id": property_id,
                "county": county_info.get("county", ""),
                "geocoded_data": {
                    "formatted_address": county_info.get("formatted_address", ""),
                    "county": county_info.get("county", ""),
                    "locality": county_info.get("locality", ""),
                    "state": county_info.get("state", ""),
                    "source": "azure_maps"
                }
            }
        except Exception as e:
            # If any unhandled exception occurs, ensure we update search attributes
            # to reflect the blocked state for visibility in the UI
            if self.is_blocked:
                workflow.logger.error(f"Workflow blocked due to activity failure: {str(e)}")
                return {
                    "status": "blocked",
                    "message": f"Workflow blocked waiting for intervention: {str(e)}",
                    "property_id": property_id,
                    "blocked_activity": self.current_activity,
                    "intervention_ids": self.get_intervention_ids()
                }
            else:
                # Re-raise if not blocked (unexpected error)
                raise
    
    def _extract_full_address(self, property_details: Dict[str, Any]) -> str:
        """
        Extract a complete address string from property details.
        
        Args:
            property_details: The property details dictionary
            
        Returns:
            str: A complete address string or empty string if address cannot be formed
        """
        try:
            address_parts = []
            
            # Add street address
            if property_details.get("street_address"):
                address_parts.append(property_details["street_address"])
            
            # Add city
            if property_details.get("city"):
                address_parts.append(property_details["city"])
            
            # Add state
            if property_details.get("state"):
                address_parts.append(property_details["state"])
            
            # Add zip code
            if property_details.get("zip_code"):
                address_parts.append(property_details["zip_code"])
            
            # Join all parts with commas
            if len(address_parts) >= 3:  # At least street, city, and state/zip
                return ", ".join(address_parts)
            else:
                return ""
                
        except Exception as e:
            workflow.logger.error(f"Error extracting address: {str(e)}")
            return ""


@workflow.defn
class PropertyPermitRetrievalWorkflow(InterventionAwareWorkflow):
    """Temporal workflow that retrieves property permit history.
    
    This workflow:
    1. Updates property permit status to IN_PROGRESS
    2. Retrieves permit history using the get_property_permit_history activity
    3. Creates PermitHistory records with the retrieved data
    4. Updates property status to COMPLETED or FAILED based on results
    
    This workflow uses the intervention-aware system to handle activity failures.
    """
    
    @workflow.run
    async def run(self, property_id: str, address: str, county: str, state: str, permit_retry_interval_days: int) -> dict:
        """
        Execute the property permit retrieval workflow.
        
        Args:
            property_id: The ID of the property to process
            address: The property address
            county: The property county
            state: The property state
            permit_retry_interval_days: Number of days to wait before retrying after failure
            
        Returns:
            dict: Status information about the workflow execution
        """
        # Initialize parent class
        super().__init__()
        
        try:
            logger.info(f"Starting permit retrieval workflow for property {property_id}")
            
            # Update status to IN_PROGRESS
            await self._execute_activity_with_intervention(
                "update_property_permit_status",
                args=[property_id, 'IN_PROGRESS', None, None],
                start_to_close_timeout=timedelta(minutes=1)
            )
            
            # Call the get_property_permit_history activity with a longer timeout
            # since permit searches can take a while
            permit_result = await self._execute_activity_with_intervention(
                "get_property_permit_history",
                args=[property_id, address, county, state],
                start_to_close_timeout=timedelta(minutes=10)  # 10 minute timeout
            )
            
            # Process pending scraped data for the property
            scraped_process_result = await self._execute_activity_with_intervention(
                "process_property_scraped_data",
                args=[property_id, state, county],
                start_to_close_timeout=timedelta(minutes=5)
            )
            logger.info(f"Processed scraped data for property {property_id}: {scraped_process_result}")
            
            # Convert any scraped permit history data to permit history records
            if scraped_process_result.get('success', False) and scraped_process_result.get('tracking_id'):
                tracking_id = scraped_process_result.get('tracking_id')
                convert_result = await self._execute_activity_with_intervention(
                    "convert_property_scraped_data_to_permit_history_record",
                    args=[property_id, tracking_id],
                    start_to_close_timeout=timedelta(minutes=10)
                )
                logger.info(f"Converted scraped permit data for property {property_id}: {convert_result}")
            
            if permit_result.get('success', False):
                # Successfully retrieved permit data
                
                # Create permit history records for each result
                results = permit_result.get('results', [])
                for permit_data in results:
                    # Create a permit history record
                    history_result = await self._execute_activity_with_intervention(
                        "create_permit_history_record",
                        args=[property_id, permit_data],
                        start_to_close_timeout=timedelta(minutes=1)
                    )
                    
                    if not history_result.get('success', False):
                        logger.warning(f"Failed to create permit history record: {history_result}")
                        # Continue anyway - we'll mark as completed but log the issue
                
                # Update status to COMPLETED
                await self._execute_activity_with_intervention(
                    "update_property_permit_status",
                    args=[property_id, 'COMPLETED', None, None],  # property_id, status, error, next_retrieval
                    start_to_close_timeout=timedelta(minutes=1)
                )
                
                logger.info(f"Successfully completed permit retrieval for property {property_id}")
                return {
                    'success': True,
                    'property_id': property_id,
                    'permits_found': bool(permit_result.get('results')),
                    'message': 'Permit retrieval completed successfully'
                }
            
            else:
                # Failed - update status to FAILED with error message and retry date
                error_message = permit_result.get('error', 'Unknown error during permit retrieval')
                
                # Calculate next retry date
                next_retry = workflow.now() + timedelta(days=permit_retry_interval_days)
                
                await self._execute_activity_with_intervention(
                    "update_property_permit_status",
                    args=[property_id, 'FAILED', error_message, next_retry.isoformat()],
                    start_to_close_timeout=timedelta(minutes=1)
                )
                
                logger.info(f"Permit retrieval failed for property {property_id}: {error_message}")
                return {
                    'success': False,
                    'property_id': property_id,
                    'error': error_message,
                    'next_retry': next_retry.isoformat(),
                    'message': 'Permit retrieval failed, scheduled for retry'
                }
        
        except Exception as e:
            # If any unhandled exception occurs, ensure we update search attributes
            # to reflect the blocked state for visibility in the UI
            if self.is_blocked:
                workflow.logger.error(f"Workflow blocked due to activity failure: {str(e)}")
                return {
                    "status": "blocked",
                    "message": f"Workflow blocked waiting for intervention: {str(e)}",
                    "property_id": property_id,
                    "blocked_activity": self.current_activity,
                    "intervention_ids": self.get_intervention_ids()
                }
            else:
                # Try to update status to FAILED with error message
                try:
                    error_message = str(e)
                    next_retry = workflow.now() + timedelta(days=permit_retry_interval_days)
                    
                    await self._execute_activity_with_intervention(
                        "update_property_permit_status",
                        args=[property_id, 'FAILED', error_message, next_retry.isoformat()],
                        start_to_close_timeout=timedelta(minutes=1)
                    )
                except Exception as update_error:
                    # If we can't even update the status, log the error
                    workflow.logger.error(f"Failed to update property status after error: {str(update_error)}")
                
                # Log the error before re-raising
                logger.error(f"Failed permit retrieval for property {property_id}: {error_message}")
                
                # Re-raise the original error
                raise
        
        except Exception as e:
            # Log the unhandled exception
            workflow.logger.exception(f"Error in PropertyPermitRetrievalWorkflow for property {property_id}: {str(e)}")
            
            # Re-raise to fail the workflow and make the error visible in Temporal UI
            raise
