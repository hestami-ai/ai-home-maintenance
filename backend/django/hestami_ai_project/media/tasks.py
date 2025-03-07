from celery import shared_task
from django.core.cache import cache
import logging
from .services import MediaProcessor
from .models import Media

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
        
        # Log file details
        logger.info(f"Media file details - size: {media.file_size}, type: {media.file_type}")
        logger.info(f"Media file path: {media.file.path}")
        
        # Process the media
        MediaProcessor.process_media(media)
        
        # Update cache with success status
        cache.set(cache_key, {
            'status': 'completed',
            'task_id': self.request.id,
            'thumbnails': media.metadata.get('thumbnails', {}),
            'video_info': media.metadata.get('video_info', {}) if media.is_video else None,
            'exif': media.metadata.get('exif', {}) if media.is_image else None
        }, timeout=3600)
        
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
        cache.set(cache_key, {
            'status': 'processing',
            'task_id': self.request.id,
            'current_retry': self.request.retries,
            'error': str(exc)
        }, timeout=3600)
        raise self.retry(exc=exc)
