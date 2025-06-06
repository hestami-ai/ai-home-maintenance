# Generated by Django 5.1.1 on 2025-04-25 10:18

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0009_serviceproviderscrapeddata'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(
            model_name='serviceprovider',
            name='user',
        ),
        migrations.AddField(
            model_name='serviceprovider',
            name='users',
            field=models.ManyToManyField(blank=True, related_name='service_provider_associations', to=settings.AUTH_USER_MODEL),
        ),
    ]
