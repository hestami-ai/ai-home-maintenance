"""
Django management command to check LibreChat sync status.

This command provides a summary of user sync status with LibreChat,
showing how many users are synced, partially synced, or not synced.

Usage:
    python manage.py check_librechat_sync_status [--detailed]
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q, Count, Case, When, CharField
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class Command(BaseCommand):
    help = 'Check LibreChat synchronization status for all users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed list of users by sync status',
        )
        parser.add_argument(
            '--show-unsynced',
            action='store_true',
            help='Show list of users who are not synced',
        )

    def handle(self, *args, **options):
        detailed = options['detailed']
        show_unsynced = options['show_unsynced']

        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(self.style.WARNING('LibreChat Sync Status Report'))
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write('')

        # Get all non-service-account users
        all_users = User.objects.exclude(service_token__isnull=False)
        total_users = all_users.count()

        # Categorize users by sync status
        fully_synced = all_users.filter(
            librechat_user_id__isnull=False,
            librechat_password_encrypted__isnull=False
        )
        
        has_id_no_password = all_users.filter(
            librechat_user_id__isnull=False,
            librechat_password_encrypted__isnull=True
        )
        
        has_password_no_id = all_users.filter(
            librechat_user_id__isnull=True,
            librechat_password_encrypted__isnull=False
        )
        
        not_synced = all_users.filter(
            librechat_user_id__isnull=True,
            librechat_password_encrypted__isnull=True
        )

        # Count each category
        fully_synced_count = fully_synced.count()
        has_id_no_password_count = has_id_no_password.count()
        has_password_no_id_count = has_password_no_id.count()
        not_synced_count = not_synced.count()

        # Calculate percentages
        if total_users > 0:
            synced_percentage = (fully_synced_count / total_users) * 100
        else:
            synced_percentage = 0

        # Summary
        self.stdout.write('Summary:')
        self.stdout.write('-' * 70)
        self.stdout.write(f'Total users: {total_users}')
        self.stdout.write('')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Fully synced: {fully_synced_count} ({synced_percentage:.1f}%)'
            )
        )
        
        if has_id_no_password_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠ Has LibreChat ID but no password: {has_id_no_password_count}'
                )
            )
        
        if has_password_no_id_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'⚠ Has password but no LibreChat ID: {has_password_no_id_count}'
                )
            )
        
        if not_synced_count > 0:
            self.stdout.write(
                self.style.ERROR(
                    f'✗ Not synced: {not_synced_count}'
                )
            )

        # Recent sync activity
        self.stdout.write('')
        self.stdout.write('Recent Activity:')
        self.stdout.write('-' * 70)
        
        last_24h = timezone.now() - timedelta(hours=24)
        last_7d = timezone.now() - timedelta(days=7)
        
        synced_24h = fully_synced.filter(librechat_synced_at__gte=last_24h).count()
        synced_7d = fully_synced.filter(librechat_synced_at__gte=last_7d).count()
        
        self.stdout.write(f'Synced in last 24 hours: {synced_24h}')
        self.stdout.write(f'Synced in last 7 days: {synced_7d}')

        # Show detailed lists if requested
        if detailed:
            self.stdout.write('')
            self.stdout.write('=' * 70)
            self.stdout.write('Detailed Breakdown')
            self.stdout.write('=' * 70)
            
            if fully_synced_count > 0:
                self.stdout.write('')
                self.stdout.write(self.style.SUCCESS('Fully Synced Users:'))
                self.stdout.write('-' * 70)
                for user in fully_synced.order_by('-librechat_synced_at')[:10]:
                    sync_time = user.librechat_synced_at.strftime('%Y-%m-%d %H:%M') if user.librechat_synced_at else 'Unknown'
                    self.stdout.write(
                        f'  • {user.email}\n'
                        f'    LibreChat ID: {user.librechat_user_id}\n'
                        f'    Synced: {sync_time}'
                    )
                if fully_synced_count > 10:
                    self.stdout.write(f'  ... and {fully_synced_count - 10} more')
            
            if has_password_no_id_count > 0:
                self.stdout.write('')
                self.stdout.write(self.style.WARNING('Users with Password but No LibreChat ID:'))
                self.stdout.write('-' * 70)
                for user in has_password_no_id[:10]:
                    self.stdout.write(
                        f'  • {user.email} (ID: {user.id})\n'
                        f'    Joined: {user.date_joined.strftime("%Y-%m-%d %H:%M")}'
                    )
                if has_password_no_id_count > 10:
                    self.stdout.write(f'  ... and {has_password_no_id_count - 10} more')

        # Show unsynced users if requested
        if show_unsynced or (not detailed and not_synced_count > 0 and not_synced_count <= 20):
            self.stdout.write('')
            self.stdout.write(self.style.ERROR('Users Not Synced:'))
            self.stdout.write('-' * 70)
            
            display_count = min(not_synced_count, 20)
            for user in not_synced.order_by('date_joined')[:display_count]:
                self.stdout.write(
                    f'  • {user.email} (ID: {user.id})\n'
                    f'    Joined: {user.date_joined.strftime("%Y-%m-%d %H:%M")}\n'
                    f'    Role: {user.user_role}'
                )
            
            if not_synced_count > display_count:
                self.stdout.write(f'  ... and {not_synced_count - display_count} more')

        # Recommendations
        self.stdout.write('')
        self.stdout.write('=' * 70)
        self.stdout.write('Recommendations:')
        self.stdout.write('-' * 70)
        
        if not_synced_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'• Run sync command to provision {not_synced_count} unsynced user(s):'
                )
            )
            self.stdout.write('  python manage.py sync_legacy_users_to_librechat --dry-run')
            self.stdout.write('  python manage.py sync_legacy_users_to_librechat')
        
        if has_password_no_id_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'• {has_password_no_id_count} user(s) have passwords but no LibreChat ID.'
                )
            )
            self.stdout.write('  This may indicate workflow failures. Check DBOS logs.')
        
        if has_id_no_password_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'• {has_id_no_password_count} user(s) have LibreChat IDs but no passwords.'
                )
            )
            self.stdout.write('  Run sync with --force to regenerate passwords.')
        
        if fully_synced_count == total_users:
            self.stdout.write(
                self.style.SUCCESS(
                    '• All users are fully synced! No action needed.'
                )
            )

        self.stdout.write('')
