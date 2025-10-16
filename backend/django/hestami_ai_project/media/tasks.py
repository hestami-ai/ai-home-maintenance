from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
import logging
from .services import MediaProcessor
from .models import Media
from .utils import scan_file as scan_file_util

logger = logging.getLogger('security')

@shared_task(
    bind=True,
    name='media.process_media',
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,  # Maximum retry delay of 10 minutes
    acks_late=True  # Task messages will be acknowledged after the task has been executed
)
def process_media_task(self, media_id):
    """
    Process media file (generate thumbnails, extract metadata) asynchronously
    """
    try:
        # Get media instance
        media = Media.objects.get(id=media_id)
        logger.info(f"Starting to process media {media_id}, file: {media.file.name}")
        
        # Update cache with processing status
        cache_key = f'media_processing_{media_id}'
        cache.set(cache_key, {
            'status': 'processing',
            'task_id': self.request.id,
            'current_retry': self.request.retries
        }, timeout=3600)
        
        # Update metadata with processing status
        if not media.metadata:
            media.metadata = {}
        media.metadata['processing_status'] = 'processing'
        media.metadata['processing_started_at'] = timezone.now().isoformat()
        media.save(update_fields=['metadata'])
        
        # Log file details
        logger.info(f"Media file details - size: {media.file_size}, type: {media.file_type}")
        logger.info(f"Media file path: {media.file.path}")
        
        # Note: Virus scanning is now done synchronously during upload (before file is saved)
        # This task only handles thumbnail generation and metadata extraction
        logger.info(f"Processing media {media_id} (virus scan already completed during upload)")
        
        # Process the media (thumbnails, metadata, etc.)
        MediaProcessor.process_media(media)
        
        # Update cache with success status
        cache.set(cache_key, {
            'status': 'completed',
            'task_id': self.request.id,
            'thumbnails': media.metadata.get('thumbnails', {}),
            'video_info': media.metadata.get('video_info', {}) if media.is_video else None,
            'exif': media.metadata.get('exif', {}) if media.is_image else None
        }, timeout=3600)
        
        # Update metadata with completion status
        media.metadata['processing_status'] = 'completed'
        media.metadata['processing_completed_at'] = timezone.now().isoformat()
        media.save(update_fields=['metadata'])
        
        logger.info(f"Successfully processed media {media_id}")
        return {'status': 'success', 'media_id': media_id}
    
    except Media.DoesNotExist:
        logger.error(f"Media {media_id} not found")
        cache.set(cache_key, {
            'status': 'failed',
            'error': 'Media not found'
        }, timeout=3600)
        raise
    
    except Exception as exc:
        logger.error(f"Error processing media {media_id}: {str(exc)}", exc_info=True)
        
        # Update cache with error status
        cache.set(cache_key, {
            'status': 'failed',
            'task_id': self.request.id,
            'current_retry': self.request.retries,
            'error': str(exc)
        }, timeout=3600)
        
        try:
            # Update metadata with failure status and mark as deleted
            media = Media.objects.get(id=media_id)
            if not media.metadata:
                media.metadata = {}
            media.metadata['processing_status'] = 'failed'
            media.metadata['processing_error'] = str(exc)
            media.metadata['processing_failed_at'] = timezone.now().isoformat()
            
            # Mark media as deleted so it doesn't appear to users
            # This handles edge cases where file type validation passed but processing failed
            media.is_deleted = True
            media.deleted_at = timezone.now()
            media.save(update_fields=['metadata', 'is_deleted', 'deleted_at'])
            
            logger.warning(f"Marked media {media_id} as deleted due to processing failure")
        except Exception as inner_exc:
            logger.error(f"Error updating metadata for failed media {media_id}: {str(inner_exc)}")
            
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    name='media.scan_file',
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,  # Maximum retry delay of 5 minutes
    acks_late=True  # Task messages will be acknowledged after the task has been executed
)
def scan_file(self, media_id):
    """
    DEPRECATED: Scan a media file for viruses asynchronously
    
    This task is no longer used. Virus scanning is now done synchronously
    during upload (before the file is saved to disk) for better security.
    
    This task is kept for backwards compatibility with any queued tasks,
    but should not be called by new code.
    """
    logger.warning(f"DEPRECATED: scan_file task called for media {media_id}. "
                   "Virus scanning is now done synchronously during upload.")
    try:
        # Get media instance
        media = Media.objects.get(id=media_id)
        logger.info(f"Starting to scan media {media_id}, file: {media.file.name}")
        
        # Log file path details for debugging
        import os
        if hasattr(media.file, 'path'):
            logger.info(f"File path: {media.file.path}")
            logger.info(f"File exists: {os.path.exists(media.file.path)}")
        else:
            logger.warning(f"Media file does not have a path attribute")
        
        # Store scan status in metadata
        if not media.metadata:
            media.metadata = {}
        media.metadata['scan_status'] = 'SCANNING'
        media.save(update_fields=['metadata'])
        
        # Scan the file
        try:
            is_clean, message = scan_file_util(media.file)
            
            # Update media with scan results in metadata
            if not media.metadata:
                media.metadata = {}
            media.metadata['is_safe'] = is_clean
            media.metadata['scan_message'] = message
            media.metadata['scan_status'] = 'COMPLETED'
            media.metadata['scan_date'] = timezone.now().isoformat()
            
            # If the file is not clean, mark it as deleted for security
            if not is_clean:
                media.is_deleted = True
                media.deleted_at = timezone.now()
                logger.warning(f"Unsafe file detected: {message} for media {media_id}. Marking as deleted.")
                media.save(update_fields=['metadata', 'is_deleted', 'deleted_at'])
            else:
                media.save(update_fields=['metadata'])
                
            logger.info(f"Scan completed for media {media_id}: {message}")
            
            # If the file is clean, trigger media processing
            if is_clean:
                logger.info(f"File is clean, triggering media processing for {media_id}")
                process_media_task.delay(media_id)
            else:
                logger.warning(f"File is not safe, skipping media processing for {media_id}")
                
            return {'status': 'success', 'media_id': media_id, 'is_clean': is_clean}
            
        except Exception as scan_error:
            logger.error(f"Error scanning file {media_id}: {str(scan_error)}", exc_info=True)
            # Update metadata with error information
            if not media.metadata:
                media.metadata = {}
            media.metadata['scan_status'] = 'FAILED'
            media.metadata['scan_message'] = f"Error scanning file: {str(scan_error)}"
            media.metadata['scan_date'] = timezone.now().isoformat()
            media.is_deleted = True
            media.deleted_at = timezone.now()
            media.save(update_fields=['metadata', 'is_deleted', 'deleted_at'])
            raise
    
    except Media.DoesNotExist:
        logger.error(f"Media {media_id} not found for scanning")
        raise
    
    except Exception as exc:
        logger.error(f"Error in scan_file task for media {media_id}: {str(exc)}", exc_info=True)
        raise self.retry(exc=exc)
