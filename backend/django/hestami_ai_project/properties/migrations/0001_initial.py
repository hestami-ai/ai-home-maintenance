# Generated by Django 5.1.1 on 2024-12-08 19:11

import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Property',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('address', models.TextField()),
                ('city', models.CharField(max_length=100)),
                ('state', models.CharField(max_length=100)),
                ('zip_code', models.CharField(max_length=20)),
                ('country', models.CharField(max_length=100)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('PENDING', 'Pending'), ('INACTIVE', 'Inactive'), ('ARCHIVED', 'Archived')], default='PENDING', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('descriptives', models.JSONField(blank=True, default=dict)),
            ],
            options={
                'verbose_name_plural': 'Properties',
                'ordering': ['-created_at'],
                'permissions': [('view_property_details', 'Can view property details'), ('manage_property_media', 'Can manage property media'), ('assign_property_services', 'Can assign property services')],
            },
        ),
        migrations.CreateModel(
            name='PropertyAccess',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('can_view', models.BooleanField(default=True)),
                ('can_edit', models.BooleanField(default=False)),
                ('can_manage_media', models.BooleanField(default=False)),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name_plural': 'Property Access Permissions',
            },
        ),
    ]
