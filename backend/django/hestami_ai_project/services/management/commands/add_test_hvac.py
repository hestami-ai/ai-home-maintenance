"""
Add a test HVAC provider for semantic search testing.
"""
from django.core.management.base import BaseCommand
from services.models import ServiceProvider
from services.workflows.enrichment_utils import generate_embedding


class Command(BaseCommand):
    help = 'Add a test HVAC provider with embedding'

    def handle(self, *args, **options):
        # Check if already exists
        if ServiceProvider.objects.filter(business_name='ABC HVAC Services').exists():
            self.stdout.write(self.style.WARNING('Test HVAC provider already exists'))
            return
        
        # Create test HVAC provider
        description = """
        ABC HVAC Services is a full-service heating, ventilation, and air conditioning company 
        serving Northern Virginia since 2005. We specialize in HVAC repair, air conditioning 
        installation, furnace repair, heat pump service, ductwork installation, and emergency 
        HVAC repairs available 24/7. Our certified HVAC technicians provide expert heating and 
        cooling solutions for residential and commercial properties. We service all major brands 
        including Carrier, Trane, Lennox, and Rheem. Call us for fast, reliable HVAC service, 
        AC repair, furnace maintenance, and indoor air quality solutions.
        """
        
        self.stdout.write('Creating test HVAC provider...')
        
        provider = ServiceProvider.objects.create(
            business_name='ABC HVAC Services',
            description=description.strip(),
            is_available=True,
            phone='(555) 123-4567',
            website='https://example.com/abc-hvac',
        )
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created provider: {provider.business_name}'))
        
        # Generate embedding
        self.stdout.write('Generating embedding...')
        try:
            embedding = generate_embedding(description)
            if embedding:
                provider.description_embedding = embedding
                provider.save(update_fields=['description_embedding'])
                self.stdout.write(self.style.SUCCESS(f'✓ Generated {len(embedding)}-dim embedding'))
            else:
                self.stdout.write(self.style.WARNING('⚠ No embedding generated'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error: {e}'))
        
        self.stdout.write(self.style.SUCCESS('\n✓ Test HVAC provider added successfully!'))
        self.stdout.write('\nNow try searching for "HVAC repair" - it should return this provider first.')
