"""
Django management command to initialize the DBOS schema in PostgreSQL.

This command creates the 'dbos' schema that DBOS uses for its internal state tracking.
Run this once after setting up the database and before starting the application.

Usage:
    python manage.py init_dbos_schema
"""
from django.core.management.base import BaseCommand
from django.db import connection
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Initialize the DBOS schema in PostgreSQL for workflow state tracking'

    def handle(self, *args, **options):
        """
        Create the 'dbos' schema if it doesn't exist.
        """
        self.stdout.write("Initializing DBOS schema...")
        
        try:
            with connection.cursor() as cursor:
                # Check if schema exists
                cursor.execute("""
                    SELECT schema_name 
                    FROM information_schema.schemata 
                    WHERE schema_name = 'dbos'
                """)
                
                if cursor.fetchone():
                    self.stdout.write(
                        self.style.WARNING('DBOS schema already exists, skipping creation')
                    )
                else:
                    # Create the schema
                    cursor.execute("CREATE SCHEMA IF NOT EXISTS dbos")
                    self.stdout.write(
                        self.style.SUCCESS('Successfully created DBOS schema')
                    )
                
                # Grant permissions to the current database user
                cursor.execute("""
                    GRANT ALL PRIVILEGES ON SCHEMA dbos TO CURRENT_USER
                """)
                
                self.stdout.write(
                    self.style.SUCCESS('Granted permissions on DBOS schema')
                )
                
            self.stdout.write(
                self.style.SUCCESS('DBOS schema initialization complete!')
            )
            self.stdout.write(
                'DBOS will automatically create its internal tables when the application starts.'
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to initialize DBOS schema: {e}')
            )
            logger.exception("Error initializing DBOS schema")
            raise
