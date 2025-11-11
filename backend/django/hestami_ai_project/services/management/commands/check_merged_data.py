"""
Check which providers have merged_data populated.
"""
from django.core.management.base import BaseCommand
from services.models import ServiceProvider
import json


class Command(BaseCommand):
    help = 'Check which providers have merged_data populated'

    def handle(self, *args, **options):
        providers = ServiceProvider.objects.all()
        
        self.stdout.write(f'\nChecking {providers.count()} providers...\n')
        self.stdout.write('=' * 80)
        
        has_data = 0
        empty_data = 0
        
        for provider in providers:
            self.stdout.write(f'\n{provider.business_name}')
            
            if provider.merged_data and isinstance(provider.merged_data, dict):
                keys = list(provider.merged_data.keys())
                
                if keys:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Has merged_data with keys: {keys}'))
                    has_data += 1
                    
                    # Show services if available
                    services = provider.merged_data.get('services', {})
                    if services.get('offered'):
                        self.stdout.write(f'    Services: {services["offered"]}')
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠ merged_data is empty dict {{}}'))
                    empty_data += 1
            else:
                self.stdout.write(self.style.WARNING(f'  ⚠ merged_data is None or not a dict'))
                empty_data += 1
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(f'\nSummary:')
        self.stdout.write(self.style.SUCCESS(f'  Providers with data: {has_data}'))
        self.stdout.write(self.style.WARNING(f'  Providers without data: {empty_data}'))
        
        if empty_data > 0:
            self.stdout.write('\n' + self.style.WARNING('⚠ Some providers are missing merged_data!'))
            self.stdout.write('This means the ingestion workflow did not populate merged_data.')
            self.stdout.write('The embeddings will be based on description only, missing service keywords.')
