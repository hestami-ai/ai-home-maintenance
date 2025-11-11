# Generated manually

from django.db import migrations
from pgvector.django import VectorField


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0027_add_geocode_fields'),
    ]

    operations = [
        # Drop the existing vector column
        migrations.RemoveField(
            model_name='serviceprovider',
            name='description_embedding',
        ),
        # Recreate with 4096 dimensions
        migrations.AddField(
            model_name='serviceprovider',
            name='description_embedding',
            field=VectorField(blank=True, dimensions=4096, help_text='Vector embedding of business description for semantic search', null=True),
        ),
    ]
