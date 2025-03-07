# Generated by Django 5.1.1 on 2024-12-09 07:47

import django.core.validators
import django.db.models.deletion
import media.models
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('properties', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Media',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('report_photo_type', models.CharField(blank=True, choices=[('BEFORE', 'Before'), ('AFTER', 'After')], help_text='For service report photos, indicates if taken before or after service', max_length=10, null=True)),
                ('file', models.FileField(upload_to=media.models.get_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'])])),
                ('file_type', models.CharField(max_length=50)),
                ('file_size', models.BigIntegerField()),
                ('title', models.CharField(blank=True, max_length=255)),
                ('description', models.TextField(blank=True)),
                ('location_type', models.CharField(blank=True, choices=[('INTERIOR', 'Interior'), ('EXTERIOR', 'Exterior'), ('SPECIALIZED', 'Specialized'), ('MISCELLANEOUS', 'Miscellaneous'), ('OTHER', 'Other')], help_text='The location or area of the property where this media was captured', max_length=50)),
                ('location_sub_type', models.CharField(blank=True, choices=[('ENTRYWAY', 'Entryway/Foyer'), ('LIVING_ROOM', 'Living Room'), ('FAMILY_ROOM', 'Family Room/Den'), ('KITCHEN', 'Kitchen'), ('DINING_ROOM', 'Dining Room'), ('HOME_OFFICE', 'Home Office'), ('MASTER_BEDROOM', 'Master Bedroom'), ('GUEST_BEDROOM', 'Guest Bedroom(s)'), ('CHILDREN_BEDROOM', "Children's Bedroom(s)"), ('NURSERY', 'Nursery'), ('MASTER_BATHROOM', 'Master Bathroom'), ('GUEST_BATHROOM', 'Guest Bathroom'), ('HALF_BATH', 'Half Bath/Powder Room'), ('LAUNDRY_ROOM', 'Laundry Room'), ('MUDROOM', 'Mudroom'), ('PANTRY', 'Pantry'), ('WALK_IN_CLOSET', 'Walk-In Closet'), ('LINEN_CLOSET', 'Linen Closet'), ('COAT_CLOSET', 'Coat Closet'), ('FINISHED_BASEMENT', 'Finished Basement'), ('UNFINISHED_BASEMENT', 'Unfinished Basement'), ('ATTIC', 'Attic'), ('HALLWAY', 'Hallways'), ('STAIRCASE', 'Staircases'), ('FURNACE_ROOM', 'Furnace Room'), ('WATER_HEATER_AREA', 'Water Heater Area'), ('FRONT_YARD', 'Front Yard'), ('BACK_YARD', 'Back Yard'), ('SIDE_YARD', 'Side Yard(s)'), ('DRIVEWAY', 'Driveway'), ('ATTACHED_GARAGE', 'Attached Garage'), ('DETACHED_GARAGE', 'Detached Garage'), ('CARPORT', 'Carport'), ('PATIO', 'Patio'), ('DECK', 'Deck'), ('FRONT_PORCH', 'Front Porch'), ('BACK_PORCH', 'Back Porch'), ('BALCONY', 'Balcony'), ('ROOFTOP_TERRACE', 'Rooftop Terrace'), ('FLOWER_GARDEN', 'Flower Garden'), ('VEGETABLE_GARDEN', 'Vegetable Garden'), ('POOL_AREA', 'Swimming Pool Area'), ('HOT_TUB_AREA', 'Hot Tub Area'), ('OUTDOOR_KITCHEN', 'Outdoor Kitchen'), ('FIRE_PIT_AREA', 'Fire Pit Area'), ('GAZEBO', 'Gazebo/Pergola'), ('STORAGE_SHED', 'Shed/Storage Building'), ('DOG_RUN', 'Dog Run'), ('STREET_VIEW', 'Street View'), ('MAP_VIEW', 'Map View'), ('HOME_GYM', 'Home Gym'), ('HOME_THEATER', 'Home Theater/Media Room'), ('GAME_ROOM', 'Game Room'), ('PLAYROOM', 'Playroom'), ('WINE_CELLAR', 'Wine Cellar'), ('WORKSHOP', 'Workshop'), ('SUNROOM', 'Sunroom/Conservatory'), ('GREENHOUSE', 'Greenhouse'), ('LIBRARY', 'Library/Study'), ('SPA_ROOM', 'Spa/Steam Room'), ('MUSIC_ROOM', 'Music Room'), ('OTHER', 'Other')], help_text='The specific location or area of the property where this media was captured', max_length=50)),
                ('media_type', models.CharField(choices=[('IMAGE', 'Image'), ('VIDEO', 'Video'), ('FILE', 'File'), ('OTHER', 'Other')], default='OTHER', max_length=50)),
                ('media_sub_type', models.CharField(choices=[('REGULAR', 'Regular'), ('360_DEGREE', '360 Degree'), ('FLOORPLAN', 'Floorplan'), ('DOCUMENT', 'Document'), ('OTHER', 'Other')], default='OTHER', max_length=50)),
                ('upload_date', models.DateTimeField(auto_now_add=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('original_filename', models.CharField(max_length=255)),
                ('mime_type', models.CharField(max_length=100)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('property_ref', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='media', to='properties.property')),
            ],
            options={
                'verbose_name_plural': 'Media',
                'ordering': ['-upload_date'],
            },
        ),
    ]
