# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0026_alter_vector_dimensions_for_ollama'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceprovider',
            name='geocode_address',
            field=models.JSONField(blank=True, default=dict, help_text='Structured address data from geocoding service'),
        ),
        migrations.AddField(
            model_name='serviceprovider',
            name='geocode_address_source',
            field=models.CharField(blank=True, help_text="Source service used for geocoding (e.g., 'AZURE_MAPS')", max_length=50, null=True),
        ),
    ]
