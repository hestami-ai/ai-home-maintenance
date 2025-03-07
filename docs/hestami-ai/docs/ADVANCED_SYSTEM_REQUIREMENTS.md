# Advanced System Requirements

## Database Backup and Recovery Strategy

### 1. Backup Types and Frequency

#### Full Database Backups
- **Frequency:** Daily
- **Type:** Full database dumps using pg_dump
- **Timing:** During low-traffic periods (configurable)
- **Format:** Custom format (.backup)

#### WAL (Write-Ahead Log) Archiving
- **Frequency:** Continuous
- **Type:** Transaction log archiving
- **Purpose:** Point-in-time recovery capability
- **Implementation:** Using WAL-E or WAL-G

### 2. Storage Configuration

#### Local Storage
- Dedicated Docker volume for backups
- Separate volume for WAL archives
- Regular backup verification

#### Cloud Storage (Optional)
- Support for multiple providers:
  - AWS S3
  - Azure Blob Storage
  - Google Cloud Storage
- Encrypted transmission
- Access control via IAM

### 3. Retention Policy

#### Backup Retention Schedule
- **Daily Backups:** 7 days retention
- **Weekly Backups:** 1 month retention
- **Monthly Backups:** 6 months retention
- **WAL Archives:** Retained until corresponding backup is deleted

#### Storage Management
- Automatic cleanup of expired backups
- Verification before deletion
- Logging of backup management activities

### 4. Implementation Details

#### Docker Configuration
```yaml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - postgres_backup:/backup
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    command: |
      postgres
      -c wal_level=replica
      -c archive_mode=on
      -c archive_command='test ! -f /backup/%f && cp %p /backup/%f'

  backup:
    image: postgres:17
    volumes:
      - postgres_backup:/backup
      - ./scripts/backup:/scripts
    environment:
      POSTGRES_HOST: db
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    entrypoint: ["/scripts/backup.sh"]
```

#### Backup Process
1. **Pre-backup checks:**
   - Available storage space
   - Database connectivity
   - Previous backup status

2. **Backup execution:**
   - Database size check
   - Full backup creation
   - WAL archiving status
   - Backup verification

3. **Post-backup tasks:**
   - Compression
   - Encryption (if configured)
   - Transfer to secondary storage
   - Cleanup of old backups

### 5. Recovery Procedures

#### Full Database Recovery
1. Stop application containers
2. Restore latest full backup
3. Apply WAL archives if needed
4. Verify database consistency
5. Restart application

#### Point-in-Time Recovery
1. Identify target recovery time
2. Restore latest backup before target
3. Apply WAL archives until target time
4. Verify database state
5. Resume application operation

### 6. Monitoring and Alerts

#### Backup Monitoring
- Success/failure notifications
- Backup size trends
- Storage usage alerts
- WAL archiving status

#### Health Checks
- Backup integrity verification
- Recovery testing schedule
- Performance impact monitoring
- Storage capacity planning

### 7. Security Considerations

#### Backup Security
- Encryption at rest
- Secure transmission
- Access control
- Audit logging

#### Recovery Security
- Authentication for restore operations
- Validation of backup sources
- Activity logging
- Role-based access control

### 8. Documentation Requirements

#### Backup Documentation
- Backup configuration details
- Retention policies
- Storage locations
- Access procedures

#### Recovery Documentation
- Step-by-step recovery procedures
- Emergency contact information
- Verification procedures
- Troubleshooting guides

## Authentication and Authorization

### 1. OAuth Providers Integration

#### Supported Providers
- **Google OAuth2**
  - Required scopes:
    - email
    - profile
  - Additional scopes for calendar integration (optional)
  - Google Cloud Console setup required

- **Microsoft Azure AD**
  - Business account integration
  - Required scopes:
    - openid
    - email
    - profile
  - Tenant configuration options

- **LinkedIn**
  - Professional account linking
  - Required scopes:
    - r_emailaddress
    - r_liteprofile
  - Useful for service provider verification

- **GitHub**
  - Optional for staff accounts
  - Required scopes:
    - user:email
    - read:user

#### OAuth Implementation Details
- NextAuth.js configuration for frontend
- Django Social Auth for backend
- Proper error handling and fallback
- Account linking capabilities
- Provider-specific profile data mapping

### 2. Multi-Factor Authentication (MFA)

#### Requirements by User Type
- **Staff Users**
  - MFA mandatory
  - Must set up within 24 hours of account creation
  - Backup codes provided
  - Device management interface

- **Property Owners**
  - MFA optional but encouraged
  - Prompted during high-value transactions
  - Can be required by organization policy

- **Service Providers**
  - MFA optional but encouraged
  - Required for accessing sensitive information
  - Can be required based on service type

#### Supported MFA Methods
1. **Authenticator Apps**
   - Google Authenticator
   - Microsoft Authenticator
   - Authy
   - Time-based One-Time Password (TOTP)

2. **SMS Authentication**
   - Fallback method only
   - Rate limiting applied
   - International number support

3. **Email Authentication**
   - Secondary email required
   - Used as backup method
   - Rate limiting applied

#### MFA Implementation
- **Setup Process**
  - QR code generation
  - Manual key entry option
  - Backup codes generation
  - Recovery email verification

- **Recovery Process**
  - Identity verification required
  - Support ticket integration
  - Audit logging
  - Time-limited recovery tokens

- **Security Measures**
  - Rate limiting on attempts
  - Suspicious activity monitoring
  - Geographic location tracking
  - Device fingerprinting

### 3. Integration Requirements

#### Frontend Integration
- Seamless OAuth flow in Next.js
- MFA setup wizard
- Device remember functionality
- Graceful degradation
- Offline support considerations

#### Backend Integration
- OAuth state management
- MFA secret storage
- Session handling
- Audit logging
- Security monitoring

#### Security Considerations
- CSRF protection
- OAuth state verification
- Rate limiting
- IP-based restrictions
- Suspicious activity detection

## Database Management Tools

### 1. pgAdmin 4 Integration

#### Docker Configuration
```yaml
services:
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: hestami-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    networks:
      - backend-dev
    volumes:
      - pgadmin_data:/var/lib/pgadmin
```

#### Environment Variables
Add to `.env.dev`:
```
PGADMIN_EMAIL=admin@hestami.local
PGADMIN_PASSWORD=devpassword
```

#### Access Configuration
- Web Interface: http://localhost:5050
- Default credentials from environment variables
- Auto-connect to PostgreSQL container

### 2. Alternative Management Tools

#### DBeaver (Desktop Application)
- Universal database tool
- Direct connection to PostgreSQL
- Connection details:
  - Host: localhost
  - Port: 5432
  - Database: ${POSTGRES_DB}
  - Username: ${POSTGRES_USER}
  - Password: ${POSTGRES_PASSWORD}

#### DataGrip (JetBrains IDE)
- Professional database IDE
- Advanced SQL editing features
- Same connection details as DBeaver
- Integration with other JetBrains tools

#### Command-line Tools (psql)
- Available inside backend container
- Direct database access
- Connection command:
  ```bash
  docker-compose exec backend psql -h db -U ${POSTGRES_USER} -d ${POSTGRES_DB}
  ```

### 3. Security Considerations

#### Development Environment
- Database ports exposed only in development
- Password protection for all management tools
- Access restricted to development network
- Regular password rotation recommended

#### Production Environment
- No exposed database ports
- No management tools in production
- Access only through backend service
- Database management through secure bastion host

### 4. Tool-specific Features

#### pgAdmin 4
- Database object management
- Query tool with explain analyzer
- Server monitoring
- Backup/restore interface
- Schema comparison tools

#### Development Workflow Integration
- Version control for database scripts
- Schema migration tracking
- Query history preservation
- Shared team settings

### 5. Best Practices

#### Access Management
- Use environment variables for credentials
- Implement connection pooling
- Monitor active connections
- Regular security audits

#### Development Guidelines
- Use management tools for:
  - Schema visualization
  - Query optimization
  - Performance monitoring
  - Data exploration
- Avoid direct production database access
- Document all database changes
- Use migration scripts for schema changes
