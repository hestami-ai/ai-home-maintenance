from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import FileExtensionValidator
from properties.models import Property
import uuid
import os
from django.core.exceptions import ValidationError

class MediaType(models.TextChoices):
    IMAGE = 'IMAGE', 'Image'
    VIDEO = 'VIDEO', 'Video'
    MODEL_3D = '3D_MODEL', '3D Model'
    FILE = 'FILE', 'File'
    OTHER = 'OTHER', 'Other'

class MediaSubType(models.TextChoices):
    REGULAR = 'REGULAR', 'Regular'
    DEGREE_360 = '360_DEGREE', '360 Degree'
    FLOORPLAN = 'FLOORPLAN', 'Floorplan'
    MODEL_3D = 'USDZ', 'USDZ Model'
    DOCUMENT = 'DOCUMENT', 'Document'
    OTHER = 'OTHER', 'Other'

class LocationType(models.TextChoices):
    INTERIOR = 'INTERIOR', 'Interior'
    EXTERIOR = 'EXTERIOR', 'Exterior'
    SPECIALIZED = 'SPECIALIZED', 'Specialized'
    MISCELLANEOUS = 'MISCELLANEOUS', 'Miscellaneous'
    OTHER = 'OTHER', 'Other'

    @classmethod
    def get_subtypes(cls, location_type):
        """Get all subtypes for a given location type."""
        mapping = {
            cls.INTERIOR: [
                LocationSubType.ENTRYWAY,
                LocationSubType.LIVING_ROOM,
                LocationSubType.FAMILY_ROOM,
                LocationSubType.KITCHEN,
                LocationSubType.DINING_ROOM,
                LocationSubType.HOME_OFFICE,
                LocationSubType.MASTER_BEDROOM,
                LocationSubType.GUEST_BEDROOM,
                LocationSubType.CHILDREN_BEDROOM,
                LocationSubType.NURSERY,
                LocationSubType.MASTER_BATHROOM,
                LocationSubType.GUEST_BATHROOM,
                LocationSubType.HALF_BATH,
                LocationSubType.LAUNDRY_ROOM,
                LocationSubType.MUDROOM,
                LocationSubType.PANTRY,
                LocationSubType.WALK_IN_CLOSET,
                LocationSubType.LINEN_CLOSET,
                LocationSubType.COAT_CLOSET,
                LocationSubType.FINISHED_BASEMENT,
                LocationSubType.UNFINISHED_BASEMENT,
                LocationSubType.ATTIC,
                LocationSubType.HALLWAY,
                LocationSubType.STAIRCASE,
                LocationSubType.FURNACE_ROOM,
                LocationSubType.WATER_HEATER_AREA,
            ],
            cls.EXTERIOR: [
                LocationSubType.FRONT_YARD,
                LocationSubType.BACK_YARD,
                LocationSubType.SIDE_YARD,
                LocationSubType.DRIVEWAY,
                LocationSubType.ATTACHED_GARAGE,
                LocationSubType.DETACHED_GARAGE,
                LocationSubType.CARPORT,
                LocationSubType.PATIO,
                LocationSubType.DECK,
                LocationSubType.FRONT_PORCH,
                LocationSubType.BACK_PORCH,
                LocationSubType.BALCONY,
                LocationSubType.ROOFTOP_TERRACE,
                LocationSubType.FLOWER_GARDEN,
                LocationSubType.VEGETABLE_GARDEN,
                LocationSubType.POOL_AREA,
                LocationSubType.HOT_TUB_AREA,
                LocationSubType.OUTDOOR_KITCHEN,
                LocationSubType.FIRE_PIT_AREA,
                LocationSubType.GAZEBO,
                LocationSubType.STORAGE_SHED,
                LocationSubType.DOG_RUN,
                LocationSubType.STREET_VIEW,
                LocationSubType.MAP_VIEW,
            ],
            cls.SPECIALIZED: [
                LocationSubType.HOME_GYM,
                LocationSubType.HOME_THEATER,
                LocationSubType.GAME_ROOM,
                LocationSubType.PLAYROOM,
                LocationSubType.WINE_CELLAR,
                LocationSubType.WORKSHOP,
                LocationSubType.SUNROOM,
                LocationSubType.GREENHOUSE,
                LocationSubType.LIBRARY,
                LocationSubType.SPA_ROOM,
                LocationSubType.MUSIC_ROOM,
            ],
            cls.MISCELLANEOUS: [
                LocationSubType.OTHER,
            ],
            cls.OTHER: [
                LocationSubType.OTHER,
            ],
        }
        return mapping.get(location_type, [])

    @classmethod
    def get_subtype_choices(cls, location_type):
        """Get choices tuple for subtypes of a given location type."""
        subtypes = cls.get_subtypes(location_type)
        return [(subtype.value, subtype.label) for subtype in subtypes]

class LocationSubType(models.TextChoices):
    # Interior Areas
    ENTRYWAY = 'ENTRYWAY', 'Entryway/Foyer'
    LIVING_ROOM = 'LIVING_ROOM', 'Living Room'
    FAMILY_ROOM = 'FAMILY_ROOM', 'Family Room/Den'
    KITCHEN = 'KITCHEN', 'Kitchen'
    DINING_ROOM = 'DINING_ROOM', 'Dining Room'
    HOME_OFFICE = 'HOME_OFFICE', 'Home Office'
    MASTER_BEDROOM = 'MASTER_BEDROOM', 'Master Bedroom'
    GUEST_BEDROOM = 'GUEST_BEDROOM', 'Guest Bedroom(s)'
    CHILDREN_BEDROOM = 'CHILDREN_BEDROOM', 'Children\'s Bedroom(s)'
    NURSERY = 'NURSERY', 'Nursery'
    MASTER_BATHROOM = 'MASTER_BATHROOM', 'Master Bathroom'
    GUEST_BATHROOM = 'GUEST_BATHROOM', 'Guest Bathroom'
    HALF_BATH = 'HALF_BATH', 'Half Bath/Powder Room'
    LAUNDRY_ROOM = 'LAUNDRY_ROOM', 'Laundry Room'
    MUDROOM = 'MUDROOM', 'Mudroom'
    PANTRY = 'PANTRY', 'Pantry'
    WALK_IN_CLOSET = 'WALK_IN_CLOSET', 'Walk-In Closet'
    LINEN_CLOSET = 'LINEN_CLOSET', 'Linen Closet'
    COAT_CLOSET = 'COAT_CLOSET', 'Coat Closet'
    FINISHED_BASEMENT = 'FINISHED_BASEMENT', 'Finished Basement'
    UNFINISHED_BASEMENT = 'UNFINISHED_BASEMENT', 'Unfinished Basement'
    ATTIC = 'ATTIC', 'Attic'
    HALLWAY = 'HALLWAY', 'Hallways'
    STAIRCASE = 'STAIRCASE', 'Staircases'
    FURNACE_ROOM = 'FURNACE_ROOM', 'Furnace Room'
    WATER_HEATER_AREA = 'WATER_HEATER_AREA', 'Water Heater Area'
    
    # Exterior Areas
    FRONT_YARD = 'FRONT_YARD', 'Front Yard'
    BACK_YARD = 'BACK_YARD', 'Back Yard'
    SIDE_YARD = 'SIDE_YARD', 'Side Yard(s)'
    DRIVEWAY = 'DRIVEWAY', 'Driveway'
    ATTACHED_GARAGE = 'ATTACHED_GARAGE', 'Attached Garage'
    DETACHED_GARAGE = 'DETACHED_GARAGE', 'Detached Garage'
    CARPORT = 'CARPORT', 'Carport'
    PATIO = 'PATIO', 'Patio'
    DECK = 'DECK', 'Deck'
    FRONT_PORCH = 'FRONT_PORCH', 'Front Porch'
    BACK_PORCH = 'BACK_PORCH', 'Back Porch'
    BALCONY = 'BALCONY', 'Balcony'
    ROOFTOP_TERRACE = 'ROOFTOP_TERRACE', 'Rooftop Terrace'
    FLOWER_GARDEN = 'FLOWER_GARDEN', 'Flower Garden'
    VEGETABLE_GARDEN = 'VEGETABLE_GARDEN', 'Vegetable Garden'
    POOL_AREA = 'POOL_AREA', 'Swimming Pool Area'
    HOT_TUB_AREA = 'HOT_TUB_AREA', 'Hot Tub Area'
    OUTDOOR_KITCHEN = 'OUTDOOR_KITCHEN', 'Outdoor Kitchen'
    FIRE_PIT_AREA = 'FIRE_PIT_AREA', 'Fire Pit Area'
    GAZEBO = 'GAZEBO', 'Gazebo/Pergola'
    STORAGE_SHED = 'STORAGE_SHED', 'Shed/Storage Building'
    DOG_RUN = 'DOG_RUN', 'Dog Run'
    STREET_VIEW = 'STREET_VIEW', 'Street View'
    MAP_VIEW = 'MAP_VIEW', 'Map View'
    
    # Specialized Areas
    HOME_GYM = 'HOME_GYM', 'Home Gym'
    HOME_THEATER = 'HOME_THEATER', 'Home Theater/Media Room'
    GAME_ROOM = 'GAME_ROOM', 'Game Room'
    PLAYROOM = 'PLAYROOM', 'Playroom'
    WINE_CELLAR = 'WINE_CELLAR', 'Wine Cellar'
    WORKSHOP = 'WORKSHOP', 'Workshop'
    SUNROOM = 'SUNROOM', 'Sunroom/Conservatory'
    GREENHOUSE = 'GREENHOUSE', 'Greenhouse'
    LIBRARY = 'LIBRARY', 'Library/Study'
    SPA_ROOM = 'SPA_ROOM', 'Spa/Steam Room'
    MUSIC_ROOM = 'MUSIC_ROOM', 'Music Room'

    # Miscellaneous
    OTHER = 'OTHER', 'Other'

    @classmethod
    def get_for_type(cls, location_type):
        """Get all valid subtypes for a given location type."""
        return LocationType.get_subtypes(location_type)

    @classmethod
    def validate_for_type(cls, location_type, subtype):
        """Validate if a subtype is valid for a given location type."""
        valid_subtypes = cls.get_for_type(location_type)
        return any(vst.value == subtype for vst in valid_subtypes)

def get_upload_path(instance, filename):
    """
    Generate the upload path for media files.
    Format: media/properties/<property_id>/<year>/<month>/<day>/<uuid>.<extension>
    """
    import logging
    logger = logging.getLogger('security')
    
    ext = os.path.splitext(filename)[1].lower()
    date = timezone.now()
    
    # Determine the property ID from the appropriate relationship
    if instance.property_ref:
        # Direct property media
        property_id = str(instance.property_ref.id)
        logger.info(f"get_upload_path: Using property_ref: {property_id}")
    elif instance.service_request and instance.service_request.property:
        # Service request media - get property from service request
        property_id = str(instance.service_request.property.id)
        logger.info(f"get_upload_path: Using service_request.property: {property_id}")
    elif instance.service_report and instance.service_report.service_request and instance.service_report.service_request.property:
        # Service report media - get property from service request via service report
        property_id = str(instance.service_report.service_request.property.id)
        logger.info(f"get_upload_path: Using service_report.service_request.property: {property_id}")
    else:
        # Fallback if no property reference can be found
        property_id = 'unknown'
        logger.warning(f"get_upload_path: No property reference found, using 'unknown'")
    
    upload_path = os.path.join(
        settings.PROPERTY_MEDIA_PATH.format(
            property_id=property_id,
            year=date.strftime('%Y'),
            month=date.strftime('%m'),
            day=date.strftime('%d')
        ),
        f"{instance.id}{ext}"
    )
    
    logger.info(f"get_upload_path: Generated path: {upload_path}")
    return upload_path

class Media(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Parent relationships (only one should be set)
    property_ref = models.ForeignKey(
        'properties.Property',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='media'
    )
    service_request = models.ForeignKey(
        'services.ServiceRequest',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='media'
    )
    service_report = models.ForeignKey(
        'services.ServiceReport',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='media'
    )
    report_photo_type = models.CharField(
        max_length=10,
        choices=[('BEFORE', 'Before'), ('AFTER', 'After')],
        null=True,
        blank=True,
        help_text='For service report photos, indicates if taken before or after service'
    )

    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_media'
    )
    file = models.FileField(
        upload_to=get_upload_path,
        validators=[FileExtensionValidator(
            allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'md', 'pdf', 'docx', 'txt', 'doc', 'usdz']
        )]
    )
    file_type = models.CharField(max_length=50)
    file_size = models.BigIntegerField()
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    location_type = models.CharField(
        max_length=50,
        choices=LocationType.choices,
        blank=True,
        help_text='The location or area of the property where this media was captured'
    )
    location_sub_type = models.CharField(
        max_length=50,
        choices=LocationSubType.choices,
        blank=True,
        help_text='The specific location or area of the property where this media was captured'
    )
    media_type = models.CharField(
        max_length=50,
        choices=MediaType.choices,
        default=MediaType.OTHER
    )
    media_sub_type = models.CharField(
        max_length=50,
        choices=MediaSubType.choices,
        default=MediaSubType.OTHER
    )
    upload_date = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-upload_date']
        verbose_name_plural = 'Media'
        indexes = [
            models.Index(fields=['uploader', '-upload_date']),
            models.Index(fields=['file_type']),
        ]

    def __str__(self):
        return f"{self.title or self.original_filename}"

    def clean(self):
        # Count primary parent relationships (property_ref can coexist with service_request/service_report)
        # The primary parent is the direct relationship: property, service_request, or service_report
        # property_ref is a denormalized field that can be set alongside service_request/service_report
        primary_parents = [
            self.service_request is not None,
            self.service_report is not None
        ]
        
        # If no service_request or service_report, then property_ref must be set
        if sum(primary_parents) == 0 and self.property_ref is None:
            raise ValidationError("Media must belong to a Property, ServiceRequest, or ServiceReport")
        
        # If service_request or service_report is set, only one should be set
        if sum(primary_parents) > 1:
            raise ValidationError("Media cannot belong to both ServiceRequest and ServiceReport")

        # Ensure report_photo_type is only set for service report media
        if self.report_photo_type and not self.service_report:
            raise ValidationError("report_photo_type can only be set for service report media")
        if self.service_report and not self.report_photo_type:
            raise ValidationError("report_photo_type must be set for service report media")

        # Validate location_sub_type matches location_type
        if self.location_type and self.location_sub_type:
            if not LocationSubType.validate_for_type(self.location_type, self.location_sub_type):
                raise ValidationError({
                    'location_sub_type': f'Invalid sub-type "{self.location_sub_type}" for location type "{self.location_type}"'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    @property
    def file_extension(self):
        return os.path.splitext(self.file.name)[1].lower() if self.file else ''

    @property
    def is_image(self):
        return self.media_type == MediaType.IMAGE

    @property
    def is_video(self):
        return self.media_type == MediaType.VIDEO
