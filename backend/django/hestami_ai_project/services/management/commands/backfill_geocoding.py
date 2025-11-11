"""
Management command to backfill geocoding data for existing providers.

This command geocodes providers that have an address but are missing
geocode_address_source or business_location fields.

Usage:
    python manage.py backfill_geocoding [--dry-run] [--force]
"""

from django.core.management.base import BaseCommand
from services.models import ServiceProvider
from services.workflows.enrichment_utils import geocode_address, create_point_from_coords
import time


class Command(BaseCommand):
    help = 'Backfill geocoding data for existing providers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be geocoded without making changes',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-geocode all providers with addresses, even if already geocoded',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        if force:
            self.stdout.write(self.style.WARNING('FORCE MODE - Will re-geocode all providers'))
        
        # Find providers that need geocoding
        if force:
            providers = ServiceProvider.objects.filter(address__isnull=False).exclude(address='')
        else:
            # Only geocode if missing geocode_address_source or business_location
            providers = ServiceProvider.objects.filter(
                address__isnull=False
            ).exclude(address='').filter(
                geocode_address_source__isnull=True
            ) | ServiceProvider.objects.filter(
                address__isnull=False
            ).exclude(address='').filter(
                business_location__isnull=True
            )
        
        total_count = providers.count()
        self.stdout.write(f"Found {total_count} providers to geocode")
        
        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No providers need geocoding'))
            return
        
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
        for i, provider in enumerate(providers, 1):
            self.stdout.write(f"\n[{i}/{total_count}] Processing {provider.business_name}")
            
            if not provider.address:
                self.stdout.write(self.style.WARNING(f"  Skipped: No address"))
                skipped_count += 1
                continue
            
            self.stdout.write(f"  Address: {provider.address}")
            
            if not dry_run:
                try:
                    geo_result = geocode_address(provider.address)
                    
                    if geo_result:
                        provider.business_location = create_point_from_coords(
                            geo_result['latitude'],
                            geo_result['longitude']
                        )
                        provider.plus_code = geo_result.get('plus_code')
                        provider.geocode_address = geo_result.get('full_response', {})
                        provider.geocode_address_source = geo_result.get('source')
                        provider.save(update_fields=[
                            'business_location',
                            'plus_code',
                            'geocode_address',
                            'geocode_address_source'
                        ])
                        
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  ✓ Geocoded: ({geo_result['latitude']}, {geo_result['longitude']}) via {geo_result.get('source')}"
                            )
                        )
                        success_count += 1
                        
                        # Rate limiting for Azure Maps (be nice to the API)
                        time.sleep(0.2)  # 5 requests per second max
                    else:
                        self.stdout.write(self.style.ERROR(f"  ✗ Failed: No geocoding result"))
                        failed_count += 1
                        
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ✗ Error: {str(e)}"))
                    failed_count += 1
            else:
                self.stdout.write(f"  [DRY RUN] Would geocode this address")
                success_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'Would geocode' if dry_run else 'Geocoded'} {success_count} providers, "
                f"failed {failed_count}, skipped {skipped_count}"
            )
        )
