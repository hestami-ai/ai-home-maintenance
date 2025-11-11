"""
Management command to backfill address and phone fields from merged_data.

This command extracts contact information from the merged_data JSONB field
and populates the address and phone fields in the ServiceProvider model.

Usage:
    python manage.py backfill_contact_info [--dry-run]
"""

from django.core.management.base import BaseCommand
from services.models import ServiceProvider


class Command(BaseCommand):
    help = 'Backfill address and phone fields from merged_data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        providers = ServiceProvider.objects.all()
        updated_count = 0
        skipped_count = 0
        
        for provider in providers:
            updated = False
            changes = []
            
            # Extract contact information from merged_data
            merged_data = provider.merged_data or {}
            business_info = merged_data.get('business_info', {})
            contact_info = business_info.get('contact_information', {})
            
            # Update phone if missing
            if not provider.phone:
                phone = contact_info.get('phone') or business_info.get('phone')
                if phone:
                    if not dry_run:
                        provider.phone = phone
                    changes.append(f"phone: {phone}")
                    updated = True
            
            # Update address if missing
            if not provider.address:
                address = contact_info.get('address')
                if address:
                    if not dry_run:
                        provider.address = address
                    changes.append(f"address: {address}")
                    updated = True
            
            # Update website if missing
            if not provider.website:
                website = contact_info.get('website') or business_info.get('website')
                if website:
                    if not dry_run:
                        provider.website = website
                    changes.append(f"website: {website}")
                    updated = True
            
            if updated:
                if not dry_run:
                    provider.save(update_fields=['phone', 'address', 'website'])
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{'[DRY RUN] Would update' if dry_run else 'Updated'} {provider.business_name}: {', '.join(changes)}"
                    )
                )
                updated_count += 1
            else:
                skipped_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'Would update' if dry_run else 'Updated'} {updated_count} providers, skipped {skipped_count}"
            )
        )
