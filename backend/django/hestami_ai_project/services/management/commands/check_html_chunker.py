"""
Management command to check HTML chunker connectivity.
"""
import os
import requests
import json
from django.core.management.base import BaseCommand
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Check connectivity to the HTML chunker service'

    def handle(self, *args, **options):
        # Get HTML chunker configuration from environment variables
        html_chunker_url = os.environ.get('HTML_CHUNKER_URL', 'http://html-chunker:8000')
        
        self.stdout.write(self.style.SUCCESS(f"Checking HTML chunker connectivity"))
        self.stdout.write(f"HTML_CHUNKER_URL: {html_chunker_url}")
        
        # Check Redis connectivity
        self.stdout.write(self.style.SUCCESS(f"Checking Redis connectivity"))
        redis_url = settings.CELERY_BROKER_URL if hasattr(settings, 'CELERY_BROKER_URL') else 'redis://redis:6379/0'
        self.stdout.write(f"REDIS_URL: {redis_url}")
        
        # Check if the HTML chunker service is accessible
        try:
            # Try to connect to the HTML chunker service
            health_url = f"{html_chunker_url}/health"
            self.stdout.write(f"Checking HTML chunker health at: {health_url}")
            
            health_response = requests.get(health_url, timeout=5)
            if health_response.status_code == 200:
                self.stdout.write(self.style.SUCCESS(f"HTML chunker service is accessible: {health_response.text}"))
            else:
                self.stdout.write(self.style.ERROR(f"HTML chunker service returned non-200 status: {health_response.status_code}"))
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Failed to connect to HTML chunker service: {str(e)}"))
        
        # Print all environment variables related to HTML chunker
        self.stdout.write(self.style.SUCCESS(f"Environment variables related to HTML chunker:"))
        for key, value in os.environ.items():
            if 'HTML_CHUNKER' in key or 'CHUNKER' in key:
                self.stdout.write(f"{key}: {value}")
        
        # Check Celery configuration
        self.stdout.write(self.style.SUCCESS(f"Celery configuration:"))
        self.stdout.write(f"CELERY_BROKER_URL: {getattr(settings, 'CELERY_BROKER_URL', 'Not set')}")
        self.stdout.write(f"CELERY_RESULT_BACKEND: {getattr(settings, 'CELERY_RESULT_BACKEND', 'Not set')}")
        
        # Print all registered tasks
        try:
            from hestami_ai.celery import app
            self.stdout.write(self.style.SUCCESS(f"Registered Celery tasks:"))
            for task in sorted(app.tasks.keys()):
                self.stdout.write(f"  - {task}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error getting Celery tasks: {str(e)}"))
