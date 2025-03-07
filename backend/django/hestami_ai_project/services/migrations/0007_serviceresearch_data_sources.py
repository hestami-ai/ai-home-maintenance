# Generated by Django 5.1.1 on 2025-03-04 17:37

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0006_alter_servicerequest_status_serviceresearch'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceresearch',
            name='data_sources',
            field=models.JSONField(default=list, help_text="List of data sources used for the research (e.g., 'Angi's List', 'Thumbtack', 'Bing Search', 'Yelp')"),
        ),
    ]
