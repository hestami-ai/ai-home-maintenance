import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from temporalio import workflow
from temporalio.common import RetryPolicy

# Configure logging
logger = logging.getLogger(__name__)

# Common retry policy for property operations
PROPERTY_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=10),
    maximum_attempts=3
)

@workflow.defn(name="PropertyCountyWorkflow")
class PropertyCountyWorkflow:
    @workflow.run
    async def run(self, property_id: str) -> dict:
        """
        Workflow to lookup and update the county information for a property.
        
        Args:
            property_id: The ID of the property to process
            
        Returns:
            dict: Status information about the workflow execution
        """
        # First, get the property details to access the address
        property_details = await workflow.execute_activity(
            "get_property_details",
            args=[property_id],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=PROPERTY_RETRY_POLICY
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
        county_info = await workflow.execute_activity(
            "find_property_county",
            args=[{"address": address}],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=PROPERTY_RETRY_POLICY
        )
        
        if not county_info.get("success", False):
            return {
                "status": "error",
                "message": county_info.get("error", "Failed to find county information"),
                "property_id": property_id
            }
        
        # Update the property with the county information
        update_result = await workflow.execute_activity(
            "update_property_county",
            args=[property_id, county_info],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=PROPERTY_RETRY_POLICY
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
    
    def _extract_full_address(self, property_details: Dict[str, Any]) -> str:
        """
        Extract a complete address string from property details.
        
        Args:
            property_details: The property details dictionary
            
        Returns:
            str: A complete address string or empty string if address cannot be formed
        """
        # Log what we received to help debug
        logger.debug(f"Property details for address extraction: {property_details}")
        
        address_parts = []
        
        # Add street address (the API uses 'address' not 'street_address')
        street_address = property_details.get("address", "")
        if street_address:
            address_parts.append(street_address)
        
        # Add city
        city = property_details.get("city", "")
        if city:
            address_parts.append(city)
        
        # Add state
        state = property_details.get("state", "")
        if state:
            address_parts.append(state)
        
        # Add postal code (API uses 'zip_code' not 'postal_code')
        zip_code = property_details.get("zip_code", "")
        if zip_code:
            address_parts.append(zip_code)
        
        # Join all parts with commas
        full_address = ", ".join([part for part in address_parts if part])
        
        return full_address


@workflow.defn(name="PropertyPermitRetrievalWorkflow")
class PropertyPermitRetrievalWorkflow:
    """Workflow to retrieve permit history for a property.
    
    This workflow:
    1. Updates property permit status to IN_PROGRESS
    2. Retrieves permit history using the get_property_permit_history activity
    3. Creates PermitHistory records with the retrieved data
    4. Updates property status to COMPLETED or FAILED based on results
    """
    
    @workflow.run
    async def run(self, property_id: str, address: str, county: str, permit_retry_interval_days: int) -> dict:
        try:
            logger.info(f"Starting permit retrieval workflow for property {property_id}")
            
            # Update status to IN_PROGRESS
            await workflow.execute_activity(
                "update_property_permit_status",
                args=[property_id, 'IN_PROGRESS', None, None],
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=1),
                    maximum_interval=timedelta(seconds=10),
                    maximum_attempts=3
                )
            )
            
            # Call the get_property_permit_history activity with a longer timeout
            # since permit searches can take a while
            permit_result = await workflow.execute_activity(
                "get_property_permit_history",
                args=[property_id, address, county],
                start_to_close_timeout=timedelta(minutes=10),  # 10 minute timeout
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=2
                )
            )
            
            if permit_result.get('success', False):
                # Successfully retrieved permit data
                
                # Create permit history records for each result
                results = permit_result.get('results', [])
                for permit_data in results:
                    # Create a permit history record
                    history_result = await workflow.execute_activity(
                        "create_permit_history_record",
                        args=[property_id, permit_data],
                        start_to_close_timeout=timedelta(minutes=1),
                        retry_policy=RetryPolicy(
                            initial_interval=timedelta(seconds=1),
                            maximum_interval=timedelta(seconds=10),
                            maximum_attempts=3
                        )
                    )
                    
                    if not history_result.get('success', False):
                        logger.warning(f"Failed to create permit history record: {history_result}")
                        # Continue anyway - we'll mark as completed but log the issue
                
                # Update status to COMPLETED
                await workflow.execute_activity(
                    "update_property_permit_status",
                    args=[property_id, 'COMPLETED', None, None],  # property_id, status, error, next_retrieval
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=RetryPolicy(
                        initial_interval=timedelta(seconds=1),
                        maximum_interval=timedelta(seconds=10),
                        maximum_attempts=3
                    )
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
                
                await workflow.execute_activity(
                    "update_property_permit_status",
                    args=[property_id, 'FAILED', error_message, next_retry.isoformat()],
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=RetryPolicy(
                        initial_interval=timedelta(seconds=1),
                        maximum_interval=timedelta(seconds=10),
                        maximum_attempts=3
                    )
                )
                
                logger.error(f"Failed permit retrieval for property {property_id}: {error_message}")
                return {
                    'success': False,
                    'property_id': property_id,
                    'error': error_message,
                    'next_retry': next_retry.isoformat()
                }
            
        except Exception as e:
            logger.exception(f"Error in PropertyPermitRetrievalWorkflow for property {property_id}: {str(e)}")
            
            # Try to update status to FAILED
            try:
                error_message = f"Workflow error: {str(e)}"
                
                # Calculate next retry date
                next_retry = workflow.now() + timedelta(days=permit_retry_interval_days)
                
                await workflow.execute_activity(
                    "update_property_permit_status",
                    args=[property_id, 'FAILED', error_message, next_retry.isoformat()],
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=RetryPolicy(
                        initial_interval=timedelta(seconds=1),
                        maximum_interval=timedelta(seconds=10),
                        maximum_attempts=3
                    )
                )
            except Exception as status_error:
                logger.exception(f"Failed to update permit status after workflow error: {status_error}")
            
            return {
                'success': False,
                'property_id': property_id,
                'error': f"Workflow error: {str(e)}"
            }
