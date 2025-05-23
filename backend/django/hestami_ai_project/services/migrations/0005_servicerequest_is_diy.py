# Generated by Django 5.1.1 on 2025-02-26 15:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0004_alter_providercategory_category_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicerequest',
            name='is_diy',
            field=models.BooleanField(default=False, help_text='Whether this is a DIY (Do It Yourself) project'),
        ),
    ]
