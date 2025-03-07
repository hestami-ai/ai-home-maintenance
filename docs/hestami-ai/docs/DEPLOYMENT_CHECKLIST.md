Before making changes, show me all related types/interfaces/functions that this code depends on or extends. Compare your proposed changes with the existing codebase and highlight all affected components. Check the official documentation and type definitions for any components we're modifying and list all required elements. Before implementing, verify that your changes maintain all existing functionality. Show your verification process. For each modification you're proposing, explain why it's needed and how it relates to existing code.

# Deployment Checklist

## Pre-Deployment Tasks

### Security
- [ ] Set up SSL certificates for domains:
  - [ ] app.hestami-ai.com
  - [ ] static.hestami-ai.com
  - [ ] www.hestami-ai.com
- [ ] Configure secure environment variables in `.env.prod`
- [ ] Review and update CORS settings
- [ ] Ensure all secrets are properly secured
- [ ] Enable rate limiting on API endpoints

### Database
- [ ] Run and test all migrations
- [ ] Create database backup strategy
- [ ] Set up database monitoring
- [ ] Configure connection pooling

### Backend
- [ ] Enable production settings in Django
- [ ] Configure logging and monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Review and optimize API endpoints
- [ ] Configure Redis for caching
- [ ] Set up ClamAV for file scanning

### Frontend
- [ ] Build and test production assets
- [ ] Configure CDN for static files
- [ ] Enable service worker for PWA
- [ ] Test client-side error handling
- [ ] Verify all API endpoints use production URLs

### Infrastructure
- [ ] Configure Traefik for production
- [ ] Set up container health checks
- [ ] Configure backup volumes
- [ ] Set up monitoring and alerting
- [ ] Configure auto-scaling rules

## Deployment Steps

1. **Database Setup**
   ```bash
   # Create required volumes
   docker volume create postgres_data_prod
   docker volume create hestami_media_data_prod
   ```

2. **SSL Certificates**
   ```bash
   # Place SSL certificates in
   ./volumes/common/traefik/certs/
   ```

3. **Environment Configuration**
   ```bash
   # Copy and update environment variables
   cp .env.example .env.prod
   # Update all necessary variables in .env.prod
   ```

4. **Build and Deploy**
   ```bash
   # Build and start all services
   docker-compose -f compose.common.yaml -f compose.prod.yaml up -d --build
   
   # Run migrations
   docker-compose -f compose.common.yaml -f compose.prod.yaml exec api python manage.py migrate
   
   # Collect static files
   docker-compose -f compose.common.yaml -f compose.prod.yaml exec api python manage.py collectstatic --noinput
   ```

5. **Post-Deployment Verification**
   ```bash
   # Check service status
   docker-compose -f compose.common.yaml -f compose.prod.yaml ps
   
   # Check logs for errors
   docker-compose -f compose.common.yaml -f compose.prod.yaml logs
   ```

## Post-Deployment Tasks

### Monitoring
- [ ] Set up application performance monitoring
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring
- [ ] Configure alerts for critical events

### Security
- [ ] Run security scan
- [ ] Test backup and restore procedures
- [ ] Verify SSL configuration
- [ ] Test rate limiting

### Performance
- [ ] Run load tests
- [ ] Monitor resource usage
- [ ] Check database query performance
- [ ] Verify caching effectiveness

### Documentation
- [ ] Update API documentation
- [ ] Document deployment procedures
- [ ] Update troubleshooting guide
- [ ] Document rollback procedures

## Rollback Plan

1. **Database Rollback**
   ```bash
   # Restore from backup if needed
   docker-compose -f compose.common.yaml -f compose.prod.yaml exec db pg_restore -U postgres -d hestami_db backup.sql
   ```

2. **Application Rollback**
   ```bash
   # Roll back to previous version
   docker-compose -f compose.common.yaml -f compose.prod.yaml down
   git checkout <previous-version>
   docker-compose -f compose.common.yaml -f compose.prod.yaml up -d --build
   ```

## Monitoring and Maintenance

### Daily Checks
- [ ] Review error logs
- [ ] Check system resources
- [ ] Monitor API response times
- [ ] Verify backup completion

### Weekly Tasks
- [ ] Review security logs
- [ ] Check database performance
- [ ] Update SSL certificates if needed
- [ ] Review and clean up old data

### Monthly Tasks
- [ ] Run security updates
- [ ] Review and update documentation
- [ ] Test disaster recovery procedures
- [ ] Review and optimize resource usage
