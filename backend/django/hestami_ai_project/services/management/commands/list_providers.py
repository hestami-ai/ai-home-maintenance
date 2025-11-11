"""
Management command to list all providers and their descriptions.
"""
from django.core.management.base import BaseCommand
from services.models import ServiceProvider


class Command(BaseCommand):
    help = 'List all providers and their descriptions'

    def handle(self, *args, **options):
        providers = ServiceProvider.objects.all().order_by('business_name')
        
        self.stdout.write(f'\nFound {providers.count()} providers:\n')
        self.stdout.write('=' * 80)
        
        for provider in providers:
            self.stdout.write(f'\n{provider.business_name}')
            self.stdout.write(f'  Available: {provider.is_available}')
            self.stdout.write(f'  Has embedding: {provider.description_embedding is not None}')
            
            if provider.description:
                desc = provider.description[:200]
                self.stdout.write(f'  Description: {desc}...')
            else:
                self.stdout.write(f'  Description: (empty)')
            
            # Check for service keywords
            if provider.description:
                desc_lower = provider.description.lower()
                keywords = []
                
                if 'hvac' in desc_lower or 'heating' in desc_lower or 'cooling' in desc_lower or 'air conditioning' in desc_lower:
                    keywords.append('HVAC')
                if 'roof' in desc_lower:
                    keywords.append('Roofing')
                if 'plumb' in desc_lower:
                    keywords.append('Plumbing')
                if 'electric' in desc_lower:
                    keywords.append('Electrical')
                if 'landscape' in desc_lower or 'lawn' in desc_lower:
                    keywords.append('Landscaping')
                if 'remodel' in desc_lower or 'renovation' in desc_lower:
                    keywords.append('Remodeling')
                
                if keywords:
                    self.stdout.write(f'  Services: {", ".join(keywords)}')
            
            self.stdout.write('')
        
        self.stdout.write('=' * 80)
