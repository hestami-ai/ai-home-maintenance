# LibreChat Legacy User Sync

**Date**: November 14, 2025  
**Purpose**: Provision existing Django users in LibreChat

---

## Overview

For users who registered before the LibreChat integration was implemented, we need to provision them in LibreChat retroactively. This document describes the Django management commands created for this purpose.

---

## Commands

### 1. Check Sync Status

**Command**: `check_librechat_sync_status`

**Purpose**: Provides a summary of how many users are synced with LibreChat.

#### Basic Usage

```bash
# In Docker container
docker exec django-dev python manage.py check_librechat_sync_status

# Or in development
python manage.py check_librechat_sync_status
```

#### Options

```bash
# Show detailed breakdown by category
python manage.py check_librechat_sync_status --detailed

# Show list of unsynced users
python manage.py check_librechat_sync_status --show-unsynced

# Both detailed and unsynced
python manage.py check_librechat_sync_status --detailed --show-unsynced
```

#### Output Example

```
======================================================================
LibreChat Sync Status Report
======================================================================

Summary:
----------------------------------------------------------------------
Total users: 150

✓ Fully synced: 120 (80.0%)
⚠ Has password but no LibreChat ID: 5
✗ Not synced: 25

Recent Activity:
----------------------------------------------------------------------
Synced in last 24 hours: 3
Synced in last 7 days: 15

======================================================================
Recommendations:
----------------------------------------------------------------------
• Run sync command to provision 25 unsynced user(s):
  python manage.py sync_legacy_users_to_librechat --dry-run
  python manage.py sync_legacy_users_to_librechat
```

---

### 2. Sync Legacy Users

**Command**: `sync_legacy_users_to_librechat`

**Purpose**: Provisions legacy users in LibreChat by triggering DBOS workflows.

#### Dry Run (Recommended First)

Always run with `--dry-run` first to see what will happen:

```bash
docker exec django-dev python manage.py sync_legacy_users_to_librechat --dry-run
```

This shows:
- How many users will be synced
- List of users (first 10)
- Their current sync status
- No actual changes made

#### Actual Sync

```bash
docker exec django-dev python manage.py sync_legacy_users_to_librechat
```

**Interactive Confirmation**:
```
About to sync 25 user(s) to LibreChat
Continue? [y/N]: y
```

#### Options

```bash
# Dry run - preview without making changes
--dry-run

# Process users in batches (default: 50)
--batch-size=100

# Force re-sync even for users with LibreChat IDs
--force
```

#### Examples

```bash
# Preview sync for all unsynced users
python manage.py sync_legacy_users_to_librechat --dry-run

# Sync with smaller batch size
python manage.py sync_legacy_users_to_librechat --batch-size=25

# Force re-sync all users (regenerate passwords and LibreChat accounts)
python manage.py sync_legacy_users_to_librechat --force

# Dry run with force to see what would be re-synced
python manage.py sync_legacy_users_to_librechat --dry-run --force
```

---

## How It Works

### Sync Process

1. **Identify Users**: Finds users without `librechat_user_id` or `librechat_password_encrypted`
2. **Generate Password**: Creates encrypted LibreChat password for each user
3. **Start Workflow**: Triggers DBOS `provision_librechat_user` workflow
4. **Async Execution**: Workflows run in background via DBOS/Celery

### Workflow Steps

Each user sync triggers the same workflow used for new registrations:

1. **Get User Data**: Retrieves user info from Django
2. **Create LibreChat User**: Makes API call to LibreChat `/api/auth/register`
3. **Update Django**: Saves `librechat_user_id` and `librechat_synced_at` back to Django

### Safety Features

- **Service Accounts Excluded**: Automatically skips service accounts
- **Batch Processing**: Processes users in batches with delays to avoid overwhelming system
- **Error Handling**: Continues processing even if individual users fail
- **Dry Run Mode**: Preview changes before executing
- **Interactive Confirmation**: Requires explicit confirmation before syncing

---

## User Sync States

Users can be in one of four states:

### 1. Fully Synced ✓
- Has `librechat_user_id`
- Has `librechat_password_encrypted`
- Has `librechat_synced_at` timestamp
- **Action**: None needed

### 2. Not Synced ✗
- Missing both `librechat_user_id` and `librechat_password_encrypted`
- **Action**: Run sync command

### 3. Partial Sync - Has Password, No ID ⚠
- Has `librechat_password_encrypted`
- Missing `librechat_user_id`
- **Cause**: Workflow started but failed to create LibreChat user
- **Action**: Check DBOS logs, may need manual intervention

### 4. Partial Sync - Has ID, No Password ⚠
- Has `librechat_user_id`
- Missing `librechat_password_encrypted`
- **Cause**: Unusual state, possibly manual database changes
- **Action**: Run sync with `--force` to regenerate password

---

## Typical Workflow

### Initial Deployment

```bash
# 1. Check current status
docker exec django-dev python manage.py check_librechat_sync_status

# 2. Preview what will be synced
docker exec django-dev python manage.py sync_legacy_users_to_librechat --dry-run

# 3. Perform the sync
docker exec django-dev python manage.py sync_legacy_users_to_librechat

# 4. Wait a few minutes for workflows to complete

# 5. Check status again to verify
docker exec django-dev python manage.py check_librechat_sync_status
```

### Monitoring Progress

```bash
# Check Django logs
docker logs django-dev | grep -i librechat

# Check Celery logs
docker logs celery-dev | grep -i librechat

# Check DBOS workflow status (if DBOS UI is available)
# Navigate to DBOS dashboard and search for workflow IDs
```

---

## Troubleshooting

### Issue: Users Not Syncing

**Symptoms**: Sync command runs but users still show as unsynced

**Possible Causes**:
1. LibreChat API not accessible
2. DBOS workflows failing
3. Network connectivity issues

**Solutions**:
```bash
# Check LibreChat is running
docker ps | grep librechat

# Test connectivity from Django container
docker exec django-dev curl http://librechat-api:3080/api/health

# Check Django logs for errors
docker logs django-dev --tail=100 | grep -i error

# Check Celery is running
docker ps | grep celery
docker logs celery-dev --tail=50
```

### Issue: Partial Syncs (Password but No ID)

**Symptoms**: Users have passwords but no LibreChat IDs

**Cause**: Workflow created password but failed to create LibreChat user

**Solutions**:
```bash
# Check DBOS logs for workflow failures
docker logs celery-dev | grep -i "provision-librechat"

# Check LibreChat logs
docker logs librechat-api --tail=100

# Re-run sync for these users
python manage.py sync_legacy_users_to_librechat
```

### Issue: Duplicate Users in LibreChat

**Symptoms**: Running sync multiple times creates duplicate LibreChat accounts

**Prevention**: 
- Always check status first
- Use `--dry-run` before actual sync
- Don't use `--force` unless necessary

**Solution**:
- LibreChat API should handle duplicates by email
- If duplicates exist, may need manual cleanup in LibreChat database

---

## Performance Considerations

### Batch Size

- **Default**: 50 users per batch
- **Small deployments** (<100 users): Use default
- **Large deployments** (>1000 users): Consider smaller batches (25-30)
- **Powerful infrastructure**: Can increase to 100+

### Timing

- Each user takes ~1-2 seconds to process
- 100 users ≈ 2-3 minutes
- 1000 users ≈ 20-30 minutes

### System Load

- Workflows run asynchronously in Celery
- Minimal impact on Django web server
- LibreChat API may experience increased load
- Consider running during off-peak hours for large syncs

---

## Security Notes

### Password Generation

- Each user gets a unique, cryptographically secure password
- Passwords are encrypted with Fernet symmetric encryption
- Encryption key stored in `LIBRECHAT_ENCRYPTION_KEY` environment variable
- Passwords never exposed to users or logs

### Access Control

- Only Django superusers should run these commands
- Commands require shell access to Django container
- No API endpoints expose this functionality

---

## Database Impact

### Tables Modified

- `users_user`: Updates `librechat_password_encrypted`, `librechat_user_id`, `librechat_synced_at`

### Queries

- Read queries: Minimal impact
- Write queries: One UPDATE per user
- No table locks or migrations required

---

## Production Checklist

Before running in production:

- [ ] LibreChat is running and accessible
- [ ] `LIBRECHAT_ENCRYPTION_KEY` is set
- [ ] `LIBRECHAT_API_URL` is correct
- [ ] DBOS/Celery workers are running
- [ ] Network connectivity tested
- [ ] Dry run completed successfully
- [ ] Backup database (optional but recommended)
- [ ] Schedule during maintenance window or off-peak hours
- [ ] Monitor logs during execution
- [ ] Verify sync status after completion

---

## Example Session

```bash
# Step 1: Check current state
$ docker exec django-dev python manage.py check_librechat_sync_status

======================================================================
LibreChat Sync Status Report
======================================================================

Summary:
----------------------------------------------------------------------
Total users: 50
✓ Fully synced: 25 (50.0%)
✗ Not synced: 25

Recommendations:
----------------------------------------------------------------------
• Run sync command to provision 25 unsynced user(s)

# Step 2: Dry run
$ docker exec django-dev python manage.py sync_legacy_users_to_librechat --dry-run

======================================================================
LibreChat Legacy User Sync
======================================================================

Finding users without LibreChat accounts...
Found 25 user(s) to sync

DRY RUN MODE - No changes will be made

Users that would be synced:
----------------------------------------------------------------------
  • user1@example.com (ID: abc-123)
    Joined: 2024-10-15 14:23
    Status: Not synced
  • user2@example.com (ID: def-456)
    Joined: 2024-10-16 09:15
    Status: Not synced
  ... and 23 more

Total: 25 user(s) would be synced

Run without --dry-run to perform the sync

# Step 3: Actual sync
$ docker exec django-dev python manage.py sync_legacy_users_to_librechat

======================================================================
LibreChat Legacy User Sync
======================================================================

Finding users without LibreChat accounts...
Found 25 user(s) to sync

About to sync 25 user(s) to LibreChat
Continue? [y/N]: y

Starting sync...

[1/25] Generated password for user1@example.com
[1/25] ✓ Started workflow for user1@example.com (ID: legacy-sync-abc-123)
[2/25] Generated password for user2@example.com
[2/25] ✓ Started workflow for user2@example.com (ID: legacy-sync-def-456)
...
[25/25] ✓ Started workflow for user25@example.com (ID: legacy-sync-xyz-789)

======================================================================
Sync Complete
======================================================================
Total users processed: 25
✓ Workflows started: 25
✗ Errors: 0

Note: Workflows are running asynchronously.
Check DBOS logs and Django user records to verify completion.

Workflow IDs:
  • legacy-sync-abc-123
  • legacy-sync-def-456
  • legacy-sync-ghi-789
  • legacy-sync-jkl-012
  • legacy-sync-mno-345
  ... and 20 more

# Step 4: Wait and verify
$ sleep 120  # Wait 2 minutes for workflows to complete

$ docker exec django-dev python manage.py check_librechat_sync_status

======================================================================
LibreChat Sync Status Report
======================================================================

Summary:
----------------------------------------------------------------------
Total users: 50
✓ Fully synced: 50 (100.0%)

Recent Activity:
----------------------------------------------------------------------
Synced in last 24 hours: 25
Synced in last 7 days: 50

======================================================================
Recommendations:
----------------------------------------------------------------------
• All users are fully synced! No action needed.
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Progress Bar**: Real-time progress indicator during sync
2. **Email Notifications**: Notify admins when sync completes
3. **Retry Failed**: Command to retry only failed syncs
4. **Export Report**: Generate CSV report of sync results
5. **Scheduled Sync**: Automatic daily check for unsynced users
6. **Webhook Integration**: Trigger sync from external systems

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Author**: Cascade AI Assistant
