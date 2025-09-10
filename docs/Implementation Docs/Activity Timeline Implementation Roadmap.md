### [COMPLETED] **Phase 1: Database Schema Design**

1. Create TimelineEntry model with:  
   * Foreign key to ServiceRequest  
   * Entry type (enum: status\_change, comment, document\_upload, etc.)  
   * Content field (for comments, limited to 5,000 chars)  
   * Metadata field (JSON for flexible additional data)  
   * Created by/at fields  
   * Updated by/at fields  
   * Is\_deleted flag (for soft deletion)  
2. Create TimelineComment model extending from TimelineEntry:  
   * Comment type (question, update, issue, general)  
   * Visibility settings (all, property\_owner\_only, provider\_only, staff\_only)  
   * Edited flag and edit history  
   * Mentions (JSON array of user IDs)  
3. Create TimelineReadReceipt model:  
   * Foreign key to TimelineEntry  
   * Foreign key to User  
   * Read timestamp

### [READY FOR IMPLEMENTATION] **Phase 2: Backend API Development**

1. Create CRUD endpoints for timeline entries:  
   * GET /api/services/requests/{id}/timeline/ (with pagination & filtering)  
   * POST /api/services/requests/{id}/timeline/ (create entry)  
   * PATCH /api/services/requests/{id}/timeline/{entry\_id}/ (update entry)  
   * DELETE /api/services/requests/{id}/timeline/{entry\_id}/ (soft delete)  
2. Implement read receipt functionality:  
   * POST /api/services/requests/{id}/timeline/{entry\_id}/read/  
   * GET /api/services/requests/{id}/timeline/unread/ (get unread count)  
3. Implement permissions system:  
   * Property owners can only see their own requests  
   * Service providers can only see assigned requests  
   * Staff can see all requests  
   * Comment editing restricted to author and staff  
4. Add filtering and pagination:  
   * By date range  
   * By entry type  
   * By user  
   * Configurable page size

### [READY FOR IMPLEMENTATION] **Phase 3: Frontend Development**

1. Create timeline component in SvelteKit:  
   * Chronological display of entries  
   * Visual differentiation between entry types  
   * Comment form with rich text editor  
   * Read indicators  
2. Implement polling mechanism:  
   * [OUT OF SCOPE] Poll for updates every 30 seconds 
   * Update read status when entries are viewed  
3. Add user interaction features:  
   * Comment editing interface  
   * Soft deletion UI  
   * @mention autocomplete  
   * File upload integration

### [OUT OF SCOPE] **Phase 4: Notification System**

1. Create notification triggers:  
   * New comment notifications  
   * @mention notifications  
   * Status change notifications  
2. Implement notification delivery:  
   * Email notifications  
   * In-app notifications

### [OUT OF SCOPE] **Phase 5: Testing & Deployment**

1. Unit testing:  
   * Model validation  
   * API endpoint testing  
   * Permission testing  
2. Integration testing:  
   * End-to-end timeline functionality  
   * Performance testing with large datasets  
3. Deployment:  
   * Database migrations  
   * Feature flag for gradual rollout

