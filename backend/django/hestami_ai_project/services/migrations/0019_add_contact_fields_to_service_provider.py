# Generated migration for adding contact fields to ServiceProvider

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0018_add_provider_enrichment_and_intervention_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceprovider',
            name='phone',
            field=models.CharField(blank=True, help_text='Primary contact phone number', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='serviceprovider',
            name='website',
            field=models.URLField(blank=True, help_text='Company website URL', null=True),
        ),
        migrations.AddField(
            model_name='serviceprovider',
            name='business_license',
            field=models.CharField(blank=True, help_text='Business license or registration number', max_length=100, null=True),
        ),
    ]
