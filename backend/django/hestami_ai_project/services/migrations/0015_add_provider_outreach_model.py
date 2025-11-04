# Generated manually for Phase 2: Provider Outreach & Bidding

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0014_add_assigned_to_field'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProviderOutreach',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(
                    choices=[
                        ('NOT_CONTACTED', 'Not Contacted'),
                        ('CONTACTED', 'Contacted'),
                        ('INTERESTED', 'Interested'),
                        ('DECLINED', 'Declined'),
                        ('BID_SUBMITTED', 'Bid Submitted'),
                        ('NO_RESPONSE', 'No Response')
                    ],
                    default='NOT_CONTACTED',
                    max_length=20
                )),
                ('last_contact_date', models.DateTimeField(blank=True, help_text='Date of last contact attempt', null=True)),
                ('expected_response_date', models.DateTimeField(blank=True, help_text='Expected date for provider response', null=True)),
                ('notes', models.TextField(blank=True, help_text='Internal notes about outreach attempts and provider responses')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('contacted_by', models.ForeignKey(
                    blank=True,
                    help_text='STAFF member who made the contact',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='provider_outreach_contacts',
                    to=settings.AUTH_USER_MODEL
                )),
                ('provider', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='outreach_records',
                    to='services.serviceprovider'
                )),
                ('service_request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='provider_outreach',
                    to='services.servicerequest'
                )),
            ],
            options={
                'verbose_name': 'Provider Outreach',
                'verbose_name_plural': 'Provider Outreach Records',
                'ordering': ['-updated_at'],
                'unique_together': {('service_request', 'provider')},
            },
        ),
        migrations.AddIndex(
            model_name='provideroutreach',
            index=models.Index(fields=['service_request', 'status'], name='services_pr_service_idx'),
        ),
        migrations.AddIndex(
            model_name='provideroutreach',
            index=models.Index(fields=['provider', 'status'], name='services_pr_provide_idx'),
        ),
        migrations.AddIndex(
            model_name='provideroutreach',
            index=models.Index(fields=['last_contact_date'], name='services_pr_last_co_idx'),
        ),
    ]
