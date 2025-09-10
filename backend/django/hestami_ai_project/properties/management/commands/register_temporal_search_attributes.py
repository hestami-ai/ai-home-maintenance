"""
Django management command to register Temporal search attributes
"""
import os
import asyncio
from django.core.management.base import BaseCommand
from temporalio.client import Client


class Command(BaseCommand):
    help = 'Register custom search attributes with Temporal server'

    def handle(self, *args, **options):
        asyncio.run(self.register_attributes())
    
    async def register_attributes(self):
        """Register custom search attributes with Temporal"""
        
        # Connect to Temporal server
        temporal_host = os.getenv("TEMPORAL_HOST", "temporal:7233")
        self.stdout.write(f"Connecting to Temporal at {temporal_host}...")
        
        try:
            client = await Client.connect(temporal_host)
            operator = client.operator
            
            # Define search attributes to register
            search_attributes = {
                "IsBlocked": "Bool",
                "BlockedActivity": "Text", 
                "BlockedError": "Text",
                "BlockedAt": "Datetime"
            }
            
            # Register each search attribute
            for name, attr_type in search_attributes.items():
                try:
                    await operator.add_search_attributes({name: attr_type})
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Registered search attribute: {name} ({attr_type})")
                    )
                except Exception as e:
                    if "already exists" in str(e):
                        self.stdout.write(
                            self.style.WARNING(f"  Search attribute {name} already exists")
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(f"✗ Failed to register {name}: {e}")
                        )
                        
            self.stdout.write(
                self.style.SUCCESS("\nSearch attributes registration complete!")
            )
            self.stdout.write("\nYou can now search for blocked workflows in Temporal UI using:")
            self.stdout.write("  IsBlocked=true")
            self.stdout.write("  BlockedActivity='process_property_scraped_data'")
            self.stdout.write("  etc.")
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error connecting to Temporal: {e}")
            )
            self.stdout.write("Make sure Temporal server is running and accessible")
