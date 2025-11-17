"""
Celery tasks for user management and LibreChat synchronization.
"""
import logging
import time
from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from dbos import DBOS

# Use celery logger so logs go to celery.log
logger = logging.getLogger('celery')

User = get_user_model()


@shared_task(name='users.sync_unsynced_librechat_users')
def sync_unsynced_librechat_users():
    """
    Celery task to sync users who don't have LibreChat accounts.
    
    This task:
    1. Finds users without librechat_user_id or librechat_password_encrypted
    2. Generates encrypted passwords for them
    3. Triggers DBOS workflows to provision them in LibreChat
    
    Runs periodically via Celery Beat.
    """
    logger.info("Starting LibreChat sync task for unsynced users")
    
    # Initialize DBOS if not already initialized
    try:
        from services.dbos_init import get_dbos_instance
        get_dbos_instance()
        logger.info("DBOS initialized for sync task")
    except Exception as e:
        logger.error(f"Failed to initialize DBOS: {str(e)}")
        return {
            'status': 'error',
            'message': f'DBOS initialization failed: {str(e)}',
            'synced': 0
        }
    
    # Find users who need LibreChat provisioning
    # Exclude service accounts (they have service_token)
    users_to_sync = User.objects.filter(
        Q(librechat_user_id__isnull=True) | Q(librechat_password_encrypted__isnull=True)
    ).exclude(
        service_token__isnull=False
    ).order_by('date_joined')
    
    total_users = users_to_sync.count()
    
    if total_users == 0:
        logger.info("No users need LibreChat sync")
        return {
            'status': 'success',
            'message': 'No users to sync',
            'synced': 0
        }
    
    logger.info(f"Found {total_users} user(s) to sync with LibreChat")
    
    # Process only the first unsynced user to avoid rate limiting
    # The task runs every 10 seconds, so all users will be synced gradually
    user = users_to_sync.first()
    
    if not user:
        logger.info("No users to sync")
        return {
            'status': 'success',
            'message': 'No users to sync',
            'synced': 0
        }
    
    # Generate LibreChat password if not already set
    if not user.librechat_password_encrypted:
        try:
            librechat_password = user.generate_librechat_password()
            logger.info(f"Generated LibreChat password for user {user.email}")
        except Exception as e:
            logger.error(f"Failed to generate password for {user.email}: {str(e)}")
            return {
                'status': 'error',
                'message': f'Failed to generate password: {str(e)}',
                'synced': 0
            }
    else:
        # Use existing password
        try:
            librechat_password = user.get_librechat_password()
        except Exception as e:
            logger.error(f"Failed to retrieve password for {user.email}: {str(e)}")
            return {
                'status': 'error',
                'message': f'Failed to retrieve password: {str(e)}',
                'synced': 0
            }
    
    # Start DBOS workflow
    try:
        from users.workflows.librechat_provisioning import provision_librechat_user
        
        workflow_id = f"celery-sync-{user.id}"
        DBOS.start_workflow(
            provision_librechat_user,
            user_id=str(user.id),
            librechat_password=librechat_password,
            workflow_id=workflow_id
        )
        
        logger.info(f"Started LibreChat provisioning workflow for {user.email} (ID: {workflow_id})")
        
        return {
            'status': 'success',
            'total_found': total_users,
            'user_synced': user.email,
            'workflow_id': workflow_id,
            'remaining': total_users - 1
        }
    
    except Exception as e:
        logger.error(f"Failed to start workflow for {user.email}: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'message': f'Failed to start workflow: {str(e)}',
            'synced': 0
        }


@shared_task(name='users.check_failed_librechat_syncs')
def check_failed_librechat_syncs():
    """
    Check for users who have passwords but no LibreChat IDs after a reasonable time.
    This indicates workflow failures that need attention.
    
    Runs periodically to identify stuck syncs.
    """
    logger.info("Checking for failed LibreChat syncs")
    
    # Find users with passwords but no LibreChat ID, created more than 1 hour ago
    one_hour_ago = timezone.now() - timedelta(hours=1)
    
    failed_syncs = User.objects.filter(
        librechat_password_encrypted__isnull=False,
        librechat_user_id__isnull=True,
        date_joined__lt=one_hour_ago
    ).exclude(
        service_token__isnull=False
    )
    
    count = failed_syncs.count()
    
    if count > 0:
        logger.warning(f"Found {count} user(s) with failed LibreChat syncs")
        
        # Log details for first few users
        for user in failed_syncs[:5]:
            logger.warning(
                f"Failed sync for user {user.email} (ID: {user.id}), "
                f"joined: {user.date_joined}"
            )
        
        return {
            'status': 'warning',
            'failed_syncs': count,
            'message': f'{count} users have passwords but no LibreChat IDs'
        }
    else:
        logger.info("No failed LibreChat syncs found")
        return {
            'status': 'success',
            'failed_syncs': 0,
            'message': 'All syncs are healthy'
        }


@shared_task(name='users.retry_failed_librechat_syncs')
def retry_failed_librechat_syncs():
    """
    Retry LibreChat provisioning for users who have passwords but no LibreChat IDs.
    
    This task is useful for recovering from temporary failures.
    """
    logger.info("Retrying failed LibreChat syncs")
    
    # Initialize DBOS if not already initialized
    try:
        from services.dbos_init import get_dbos_instance
        get_dbos_instance()
        logger.info("DBOS initialized for retry task")
    except Exception as e:
        logger.error(f"Failed to initialize DBOS: {str(e)}")
        return {
            'status': 'error',
            'message': f'DBOS initialization failed: {str(e)}',
            'retried': 0
        }
    
    # Find users with passwords but no LibreChat ID
    failed_syncs = User.objects.filter(
        librechat_password_encrypted__isnull=False,
        librechat_user_id__isnull=True
    ).exclude(
        service_token__isnull=False
    ).order_by('date_joined')
    
    count = failed_syncs.count()
    
    if count == 0:
        logger.info("No failed syncs to retry")
        return {
            'status': 'success',
            'message': 'No failed syncs to retry',
            'retried': 0
        }
    
    logger.info(f"Found {count} failed LibreChat sync(s), retrying first one")
    
    # Process only the first failed sync to avoid rate limiting
    user = failed_syncs.first()
    
    try:
        librechat_password = user.get_librechat_password()
        
        from users.workflows.librechat_provisioning import provision_librechat_user
        
        workflow_id = f"retry-sync-{user.id}"
        DBOS.start_workflow(
            provision_librechat_user,
            user_id=str(user.id),
            librechat_password=librechat_password,
            workflow_id=workflow_id
        )
        
        logger.info(f"Retrying LibreChat sync for {user.email} (ID: {workflow_id})")
        
        return {
            'status': 'success',
            'total_failed': count,
            'user_retried': user.email,
            'workflow_id': workflow_id,
            'remaining': count - 1
        }
    
    except Exception as e:
        logger.error(f"Failed to retry sync for {user.email}: {str(e)}")
        return {
            'status': 'error',
            'message': f'Failed to retry: {str(e)}',
            'retried': 0
        }
