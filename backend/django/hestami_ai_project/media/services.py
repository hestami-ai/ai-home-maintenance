from PIL import Image
import os
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
import cv2
import numpy as np
from io import BytesIO
import magic
import logging

logger = logging.getLogger('security')

class MediaProcessor:
    THUMBNAIL_SIZES = {
        'small': (150, 150),
        'medium': (300, 300),
        'large': (600, 600)
    }
    
    VIDEO_THUMBNAIL_TIME = 2  # seconds from start to capture thumbnail
    
    @staticmethod
    def process_media(media_instance):
        """
        Process uploaded media file based on its type.
        Generates thumbnails and optimizes the file.
        """
        try:
            mime_type = magic.from_buffer(media_instance.file.read(1024), mime=True)
            media_instance.file.seek(0)
            
            # Skip processing for 3D models (USDZ files - all variants)
            if mime_type in ['model/vnd.usdz+zip', 'model/vnd.pixar.usd-binary+zip']:
                logger.info(f"Skipping processing for 3D model {media_instance.id} (MIME: {mime_type})")
                return True
            
            if mime_type.startswith('image/'):
                MediaProcessor._process_image(media_instance)
            elif mime_type.startswith('video/'):
                MediaProcessor._process_video(media_instance)
            
            return True
        except Exception as e:
            logger.error(f"Error processing media {media_instance.id}: {str(e)}")
            return False
    
    @staticmethod
    def _process_image(media_instance):
        """
        Process image files:
        1. Generate thumbnails
        2. Optimize original image
        3. Extract EXIF data
        """
        try:
            # Reset file pointer to beginning (after virus scan)
            media_instance.file.seek(0)
            
            # Open image using PIL
            image = Image.open(media_instance.file)
            
            # Get file path components
            file_dir = os.path.dirname(media_instance.file.name)
            _, ext = os.path.splitext(media_instance.file.name)
            
            # Generate thumbnails
            for size_name, dimensions in MediaProcessor.THUMBNAIL_SIZES.items():
                thumbnail = MediaProcessor._create_thumbnail(image, dimensions)
                
                # Generate thumbnail filename using the pattern
                thumb_filename = settings.THUMBNAIL_FILENAME_PATTERN.format(
                    size=size_name,
                    uuid=media_instance.id,
                    extension=ext
                )
                
                # Full path for thumbnail
                thumb_path = os.path.join(file_dir, thumb_filename)
                
                # Save thumbnail
                thumb_io = BytesIO()
                thumbnail.save(thumb_io, format='JPEG' if ext.lower() in ['.jpg', '.jpeg'] else 'PNG', quality=85)
                
                # Store using Django's storage
                default_storage.save(thumb_path, ContentFile(thumb_io.getvalue()))
                
                # Add thumbnail path to media metadata
                if 'thumbnails' not in media_instance.metadata:
                    media_instance.metadata['thumbnails'] = {}
                media_instance.metadata['thumbnails'][size_name] = thumb_path
            
            # Optimize original image if it's large
            if max(image.size) > 2000:
                optimized = MediaProcessor._optimize_image(image)
                
                # Save optimized image
                output_io = BytesIO()
                optimized.save(output_io, format=image.format, quality=85)
                media_instance.file.save(
                    media_instance.file.name,
                    ContentFile(output_io.getvalue()),
                    save=False
                )
            
            # Extract EXIF data
            media_instance.metadata['exif'] = MediaProcessor._extract_exif(image)
            
            # Save changes
            media_instance.save()
            
        except Exception as e:
            logger.error(f"Error processing image {media_instance.id}: {str(e)}")
            raise
            
    @staticmethod
    def _process_video(media_instance):
        """
        Process video files:
        1. Generate thumbnail from video frame
        2. Extract video metadata
        """
        try:
            # Get the absolute path to the video file
            video_path = default_storage.path(media_instance.file.name)
            video = cv2.VideoCapture(video_path)
            
            # Get video metadata
            fps = video.get(cv2.CAP_PROP_FPS)
            frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count/fps if fps > 0 else 0
            width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # Store video metadata
            media_instance.metadata['video_info'] = {
                'duration': duration,
                'fps': fps,
                'width': width,
                'height': height,
                'frame_count': frame_count
            }
            
            # Generate thumbnail from video
            video.set(cv2.CAP_PROP_POS_MSEC, MediaProcessor.VIDEO_THUMBNAIL_TIME * 1000)
            success, frame = video.read()
            
            if success:
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = Image.fromarray(frame_rgb)
                
                # Get file path components
                file_dir = os.path.dirname(media_instance.file.name)
                _, ext = os.path.splitext(media_instance.file.name)
                
                # Generate thumbnails
                for size_name, dimensions in MediaProcessor.THUMBNAIL_SIZES.items():
                    thumbnail = MediaProcessor._create_thumbnail(image, dimensions)
                    
                    # Generate thumbnail filename using the pattern
                    thumb_filename = settings.THUMBNAIL_FILENAME_PATTERN.format(
                        size=size_name,
                        uuid=media_instance.id,
                        extension='.jpg'  # Always use jpg for video thumbnails
                    )
                    
                    # Full path for thumbnail
                    thumb_path = os.path.join(file_dir, thumb_filename)
                    
                    # Save thumbnail
                    thumb_io = BytesIO()
                    thumbnail.save(thumb_io, 'JPEG', quality=85)
                    
                    # Store using Django's storage
                    default_storage.save(thumb_path, ContentFile(thumb_io.getvalue()))
                    
                    # Add thumbnail path to media metadata
                    if 'thumbnails' not in media_instance.metadata:
                        media_instance.metadata['thumbnails'] = {}
                    media_instance.metadata['thumbnails'][size_name] = thumb_path
            
            # Close video file
            video.release()
            
            # Save changes
            media_instance.save()
            
        except Exception as e:
            logger.error(f"Error processing video {media_instance.id}: {str(e)}")
            raise
    
    @staticmethod
    def _create_thumbnail(image, size):
        """Create a thumbnail maintaining aspect ratio"""
        # Convert RGBA images to RGB with white background
        if image.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        
        # Create thumbnail
        image.thumbnail(size, Image.Resampling.LANCZOS)
        return image
    
    @staticmethod
    def _optimize_image(image):
        """Optimize image for web delivery"""
        if image.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        return image
    
    @staticmethod
    def _extract_exif(image):
        """Extract relevant EXIF data from image"""
        try:
            exif_data = {}
            if hasattr(image, '_getexif') and image._getexif():
                exif = image._getexif()
                for tag_id, value in exif.items():
                    tag = ExifTags.TAGS.get(tag_id, tag_id)
                    if tag in ['DateTimeOriginal', 'Make', 'Model', 
                             'GPSInfo', 'ImageWidth', 'ImageLength']:
                        exif_data[tag] = str(value)
            return exif_data
        except:
            return {}
