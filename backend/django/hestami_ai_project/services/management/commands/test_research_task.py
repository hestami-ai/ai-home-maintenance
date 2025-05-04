"""
Management command to test the research task activation.
"""
import uuid
import logging
from django.core.management.base import BaseCommand
from services.models import ServiceRequest, ServiceResearch
from services.tasks import process_research_content
from django.utils import timezone

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Test the research task activation'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mode',
            choices=['create', 'update', 'process'],
            default='create',
            help='Test mode: create a new entry, update existing, or process content directly'
        )
        parser.add_argument(
            '--id',
            type=str,
            help='ID of the ServiceResearch entry to update or process (only for update/process mode)'
        )

    def handle(self, *args, **options):
        mode = options['mode']
        
        if mode == 'process':
            # Test by directly processing a research entry's content
            research_id = options['id']
            if not research_id:
                self.stdout.write(self.style.ERROR('You must provide an ID for process mode'))
                return
            self.test_process_content(research_id)
        elif mode == 'update':
            # Test by updating an existing entry
            research_id = options['id']
            if not research_id:
                self.stdout.write(self.style.ERROR('You must provide an ID for update mode'))
                return
            self.test_update_entry(research_id)
        else:
            # Test by creating a new entry
            self.test_create_entry()

    def test_process_content(self, research_id):
        """Test by directly processing a research entry's content."""
        self.stdout.write(self.style.SUCCESS('Testing direct content processing'))
        
        try:
            # Get the research entry
            research_entry = ServiceResearch.objects.get(id=research_id)
            
            self.stdout.write(f'Found research entry: {research_entry.id}')
            
            # Process the content directly
            self.stdout.write(f'Processing content for research entry: {research_entry.id}')
            result = process_research_content(research_entry)
            
            if result['success']:
                self.stdout.write(self.style.SUCCESS(f'Successfully processed research content: {result["message"]}'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to process research content: {result["message"]}'))
                
            self.stdout.write('Note: In the production environment, research entries are automatically processed by the background task')
        
        except ServiceResearch.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Research entry with ID {research_id} not found'))

    def test_create_entry(self):
        """Test by creating a new ServiceResearch entry."""
        self.stdout.write(self.style.SUCCESS('Testing task activation via new entry creation'))
        
        # Create or get a service request with "In Research" status
        service_request, created = ServiceRequest.objects.get_or_create(
            name=f'Test Request {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}',
            defaults={
                'status': ServiceRequest.Status.IN_RESEARCH,
                'description': 'Test service request for research task testing',
            }
        )
        
        if created:
            self.stdout.write(f'Created new service request: {service_request.id}')
        else:
            # Update the status if needed
            if service_request.status != ServiceRequest.Status.IN_RESEARCH:
                service_request.status = ServiceRequest.Status.IN_RESEARCH
                service_request.save()
                self.stdout.write(f'Updated service request status to IN_RESEARCH: {service_request.id}')
            else:
                self.stdout.write(f'Using existing service request: {service_request.id}')
        
        # Create a new research entry
        research_entry = ServiceResearch.objects.create(
            service_request=service_request,
            research_content='<html><body><h1>Test Company</h1><p>This is a test for the HTML chunker.</p></body></html>',
            research_content_raw_text='Test Company. This is a test for the HTML chunker.',
            source_url='https://example.com/test',
        )
        
        self.stdout.write(self.style.SUCCESS(f'Created new research entry: {research_entry.id}'))
        self.stdout.write('The entry will be automatically processed by the background task')
        self.stdout.write('Check the logs to see when the background task processes this entry')

    def test_update_entry(self, research_id):
        """Test by updating an existing ServiceResearch entry."""
        self.stdout.write(self.style.SUCCESS(f'Testing task activation via entry update for ID: {research_id}'))
        
        try:
            # Get the research entry
            research_entry = ServiceResearch.objects.get(id=research_id)
            
            # Get the associated service request
            service_request = research_entry.service_request
            
            # Update the service request status if needed
            if service_request.status != ServiceRequest.Status.IN_RESEARCH:
                service_request.status = ServiceRequest.Status.IN_RESEARCH
                service_request.save()
                self.stdout.write(f'Updated service request status to IN_RESEARCH: {service_request.id}')
            
            # Update the research entry with new content
            research_entry.research_content = f'<html><body><h1>Updated Test Company</h1><p>This is an updated test for the HTML chunker at {timezone.now()}.</p></body></html>'
            research_entry.research_content_raw_text = f'Updated Test Company. This is an updated test for the HTML chunker at {timezone.now()}.'
            research_entry.research_data = {}  # Clear existing data to force reprocessing
            research_entry.save()
            
            self.stdout.write(self.style.SUCCESS(f'Updated research entry: {research_entry.id}'))
            self.stdout.write('The entry will be automatically processed by the background task')
            self.stdout.write('Check the logs to see when the background task processes this entry')
            
        except ServiceResearch.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Research entry with ID {research_id} not found'))
