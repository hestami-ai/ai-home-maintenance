"""
DBOS Workflow for LibreChat User Provisioning

This workflow orchestrates the creation of LibreChat users after Django registration.
It ensures reliable user provisioning with automatic retries and error handling.
"""
from dbos import DBOS
from django.contrib.auth import get_user_model
from django.utils import timezone
from users.services.librechat_sync import LibreChatSyncService
import logging

# Use celery logger so DBOS workflow logs go to celery.log when triggered by Celery
logger = logging.getLogger('celery')

User = get_user_model()


@DBOS.step()
async def get_user_by_id(user_id: str) -> dict:
    """
    Get user from Django database.
    
    Args:
        user_id: Django user UUID
    
    Returns:
        dict: User data including id, email, first_name, last_name
    """
    try:
        user = await User.objects.aget(id=user_id)
        return {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        raise ValueError(f"User {user_id} not found")


@DBOS.step()
async def create_librechat_user_step(user_data: dict, password: str) -> dict:
    """
    Create user in LibreChat via API.
    
    Args:
        user_data: User information (email, first_name, last_name)
        password: Generated LibreChat password
    
    Returns:
        dict: Result with success status, user_id, and error (if any)
    """
    service = LibreChatSyncService()
    result = await service.create_user(
        email=user_data['email'],
        password=password,
        first_name=user_data['first_name'],
        last_name=user_data['last_name']
    )
    return result


@DBOS.step()
async def update_user_librechat_id(user_id: str, librechat_user_id: str):
    """
    Update Django user with LibreChat ID and sync timestamp.
    
    Args:
        user_id: Django user UUID
        librechat_user_id: LibreChat internal user ID
    """
    try:
        user = await User.objects.aget(id=user_id)
        user.librechat_user_id = librechat_user_id
        user.librechat_synced_at = timezone.now()
        await user.asave(update_fields=['librechat_user_id', 'librechat_synced_at'])
        logger.info(f"Updated user {user_id} with LibreChat ID {librechat_user_id}")
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for LibreChat ID update")
        raise ValueError(f"User {user_id} not found")


@DBOS.workflow()
async def provision_librechat_user(
    user_id: str, 
    librechat_password: str,
    **kwargs  # Accept additional kwargs like workflow_id
) -> dict:
    """
    Workflow to provision user in LibreChat after Django registration.
    
    This workflow:
    1. Retrieves user data from Django
    2. Creates user in LibreChat with generated password
    3. Updates Django user with LibreChat user ID
    
    Args:
        user_id: Django user UUID
        librechat_password: Generated password for LibreChat
    
    Returns:
        dict: {
            'success': bool,
            'librechat_user_id': str (if successful),
            'error': str (if failed)
        }
    """
    try:
        logger.info(f"Starting LibreChat provisioning workflow for user {user_id}")
        
        # Step 1: Get user from Django
        user_data = await get_user_by_id(user_id)
        logger.info(f"Retrieved user data for {user_data['email']}")
        
        # Step 2: Create LibreChat user
        result = await create_librechat_user_step(user_data, librechat_password)
        
        if not result['success']:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"Failed to create LibreChat user for {user_data['email']}: {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
        
        librechat_user_id = result['user_id']
        logger.info(f"Created LibreChat user {librechat_user_id} for {user_data['email']}")
        
        # Step 3: Update Django user with LibreChat ID
        await update_user_librechat_id(user_id, librechat_user_id)
        
        logger.info(f"Successfully completed LibreChat provisioning for user {user_id}")
        return {
            'success': True,
            'librechat_user_id': librechat_user_id
        }
    
    except Exception as e:
        logger.error(f"LibreChat provisioning workflow failed for user {user_id}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
