"""
Management command to generate embeddings for existing providers.
"""
from django.core.management.base import BaseCommand
from services.models import ServiceProvider
from services.workflows.enrichment_utils import generate_embedding, prepare_embedding_text
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate embeddings for providers that are missing them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate embeddings even for providers that already have them',
        )
        parser.add_argument(
            '--provider-id',
            type=str,
            help='Generate embedding for a specific provider by ID',
        )

    def handle(self, *args, **options):
        force = options['force']
        provider_id = options.get('provider_id')
        
        # Get providers to process
        if provider_id:
            providers = ServiceProvider.objects.filter(id=provider_id)
            if not providers.exists():
                self.stdout.write(self.style.ERROR(f'Provider {provider_id} not found'))
                return
        elif force:
            providers = ServiceProvider.objects.all()
        else:
            providers = ServiceProvider.objects.filter(description_embedding__isnull=True)
        
        total = providers.count()
        self.stdout.write(f'Processing {total} provider(s)...\n')
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for i, provider in enumerate(providers, 1):
            self.stdout.write(f'[{i}/{total}] {provider.business_name}')
            
            # Check if provider has description
            if not provider.description or not provider.description.strip():
                self.stdout.write(self.style.WARNING(f'  ⚠ Skipping - no description'))
                skip_count += 1
                continue
            
            try:
                # Generate embedding from merged_data if available, otherwise from description
                self.stdout.write(f'  Generating embedding...')
                
                if provider.merged_data and isinstance(provider.merged_data, dict) and provider.merged_data:
                    # Use prepare_embedding_text to extract rich text from merged_data
                    embedding_text = prepare_embedding_text(provider.merged_data)
                    self.stdout.write(f'  Using merged_data ({len(embedding_text)} chars)')
                else:
                    # Fall back to description only
                    embedding_text = provider.description
                    self.stdout.write(f'  Using description only ({len(embedding_text) if embedding_text else 0} chars)')
                
                embedding = generate_embedding(embedding_text)
                
                if embedding:
                    provider.description_embedding = embedding
                    provider.save(update_fields=['description_embedding'])
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Generated {len(embedding)}-dim embedding'))
                    success_count += 1
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠ No embedding generated'))
                    skip_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Error: {str(e)}'))
                error_count += 1
                logger.error(f'Error generating embedding for {provider.business_name}: {e}', exc_info=True)
        
        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(f'✓ Success: {success_count}'))
        if skip_count:
            self.stdout.write(self.style.WARNING(f'⚠ Skipped: {skip_count}'))
        if error_count:
            self.stdout.write(self.style.ERROR(f'✗ Errors: {error_count}'))
        self.stdout.write('=' * 60)
        
        # Show final stats
        total_providers = ServiceProvider.objects.count()
        with_embeddings = ServiceProvider.objects.exclude(description_embedding__isnull=True).count()
        self.stdout.write(f'\nTotal providers: {total_providers}')
        self.stdout.write(f'With embeddings: {with_embeddings}')
        self.stdout.write(f'Coverage: {(with_embeddings/total_providers*100):.1f}%\n')
