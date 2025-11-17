"""
Django management command to sync legacy users to LibreChat.

This command identifies users who were registered before LibreChat integration
and provisions them in LibreChat by triggering the DBOS workflow.

Usage:
    python manage.py sync_legacy_users_to_librechat [--dry-run] [--batch-size=50]
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q
from dbos import DBOS
import logging
import asyncio

logger = logging.getLogger(__name__)

User = get_user_model()


def initialize_dbos_for_command():
    """Initialize DBOS for management command context."""
    from services.dbos_init import get_dbos_instance
    try:
        dbos_instance = get_dbos_instance()
        logger.info("DBOS initialized for management command")
        return dbos_instance
    except Exception as e:
        logger.error(f"Failed to initialize DBOS: {e}")
        raise


class Command(BaseCommand):
    help = 'Sync legacy users (pre-LibreChat integration) to LibreChat'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show users that would be synced without actually syncing them',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Number of users to process in each batch (default: 50)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-sync even for users who already have LibreChat IDs',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        force = options['force']

        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(self.style.WARNING('LibreChat Legacy User Sync'))
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write('')

        # Initialize DBOS if not in dry-run mode
        if not dry_run:
            try:
                self.stdout.write('Initializing DBOS...')
                initialize_dbos_for_command()
                self.stdout.write(self.style.SUCCESS('✓ DBOS initialized'))
                self.stdout.write('')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Failed to initialize DBOS: {str(e)}'))
                self.stdout.write('Cannot proceed without DBOS. Please check your database configuration.')
                return

        # Find users who need LibreChat provisioning
        if force:
            # Force re-sync all users
            query = Q()
            self.stdout.write(self.style.WARNING('Force mode: Re-syncing ALL users'))
        else:
            # Only sync users without LibreChat ID or encrypted password
            query = Q(librechat_user_id__isnull=True) | Q(librechat_password_encrypted__isnull=True)
            self.stdout.write('Finding users without LibreChat accounts...')

        users_to_sync = User.objects.filter(query).exclude(
            service_token__isnull=False  # Skip service accounts (they have service_token)
        ).order_by('date_joined')

        total_users = users_to_sync.count()

        if total_users == 0:
            self.stdout.write(self.style.SUCCESS('✓ No users need syncing. All users are already synced!'))
            return

        self.stdout.write(f'Found {total_users} user(s) to sync')
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
            self.stdout.write('')
            self.stdout.write('Users that would be synced:')
            self.stdout.write('-' * 70)
            
            for user in users_to_sync[:10]:  # Show first 10
                sync_status = self._get_sync_status(user)
                self.stdout.write(
                    f'  • {user.email} (ID: {user.id})\n'
                    f'    Joined: {user.date_joined.strftime("%Y-%m-%d %H:%M")}\n'
                    f'    Status: {sync_status}'
                )
            
            if total_users > 10:
                self.stdout.write(f'  ... and {total_users - 10} more')
            
            self.stdout.write('')
            self.stdout.write(f'Total: {total_users} user(s) would be synced')
            self.stdout.write('')
            self.stdout.write('Run without --dry-run to perform the sync')
            return

        # Confirm before proceeding
        self.stdout.write(self.style.WARNING(f'About to sync {total_users} user(s) to LibreChat'))
        confirm = input('Continue? [y/N]: ')
        
        if confirm.lower() != 'y':
            self.stdout.write(self.style.ERROR('Aborted by user'))
            return

        self.stdout.write('')
        self.stdout.write('Starting sync...')
        self.stdout.write('')

        # Process users in batches
        success_count = 0
        error_count = 0
        skipped_count = 0
        workflow_ids = []

        for i, user in enumerate(users_to_sync, 1):
            try:
                # Generate LibreChat password if not already set
                if not user.librechat_password_encrypted or force:
                    try:
                        librechat_password = user.generate_librechat_password()
                        self.stdout.write(
                            f'[{i}/{total_users}] Generated password for {user.email}'
                        )
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f'[{i}/{total_users}] ✗ Failed to generate password for {user.email}: {str(e)}'
                            )
                        )
                        error_count += 1
                        continue
                else:
                    # Use existing password
                    try:
                        librechat_password = user.get_librechat_password()
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f'[{i}/{total_users}] ✗ Failed to retrieve password for {user.email}: {str(e)}'
                            )
                        )
                        error_count += 1
                        continue

                # Start DBOS workflow
                try:
                    from users.workflows.librechat_provisioning import provision_librechat_user
                    
                    workflow_id = f"legacy-sync-{user.id}"
                    DBOS.start_workflow(
                        provision_librechat_user,
                        user_id=str(user.id),
                        librechat_password=librechat_password,
                        workflow_id=workflow_id
                    )
                    
                    workflow_ids.append(workflow_id)
                    success_count += 1
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'[{i}/{total_users}] ✓ Started workflow for {user.email} (ID: {workflow_id})'
                        )
                    )
                
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'[{i}/{total_users}] ✗ Failed to start workflow for {user.email}: {str(e)}'
                        )
                    )
                    error_count += 1

                # Small delay between batches to avoid overwhelming the system
                if i % batch_size == 0 and i < total_users:
                    self.stdout.write(f'  Processed {i} users, pausing briefly...')
                    import time
                    time.sleep(2)

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'[{i}/{total_users}] ✗ Unexpected error for {user.email}: {str(e)}'
                    )
                )
                error_count += 1

        # Summary
        self.stdout.write('')
        self.stdout.write('=' * 70)
        self.stdout.write(self.style.SUCCESS('Sync Complete'))
        self.stdout.write('=' * 70)
        self.stdout.write(f'Total users processed: {total_users}')
        self.stdout.write(self.style.SUCCESS(f'✓ Workflows started: {success_count}'))
        
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'✗ Errors: {error_count}'))
        
        if skipped_count > 0:
            self.stdout.write(self.style.WARNING(f'⊘ Skipped: {skipped_count}'))

        self.stdout.write('')
        self.stdout.write('Note: Workflows are running asynchronously.')
        self.stdout.write('Check DBOS logs and Django user records to verify completion.')
        self.stdout.write('')
        
        if success_count > 0:
            self.stdout.write('Workflow IDs:')
            for wf_id in workflow_ids[:5]:
                self.stdout.write(f'  • {wf_id}')
            if len(workflow_ids) > 5:
                self.stdout.write(f'  ... and {len(workflow_ids) - 5} more')

    def _get_sync_status(self, user):
        """Get human-readable sync status for a user."""
        if user.librechat_user_id and user.librechat_password_encrypted:
            return 'Already synced (has LibreChat ID and password)'
        elif user.librechat_user_id:
            return 'Partial sync (has LibreChat ID but no password)'
        elif user.librechat_password_encrypted:
            return 'Partial sync (has password but no LibreChat ID)'
        else:
            return 'Not synced'
