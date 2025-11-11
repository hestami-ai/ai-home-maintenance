# Provider Ingestion - SvelteKit UI Setup

## Overview

This guide covers the SvelteKit UI components for the service provider ingestion workflow.

## Files Created

### Components

1. **`src/lib/components/AddProviderModal.svelte`**
   - Modal for adding providers manually
   - Form with source_name, source_url, raw_html, notes
   - Success/error handling
   - Auto-closes after successful submission

2. **`src/lib/components/PendingInterventions.svelte`**
   - Lists providers needing manual review
   - Shows match scores for candidate providers
   - Resolution modal with link/create options
   - Auto-refreshes after resolution

### Pages

3. **`src/routes/staff/providers/+page.svelte`**
   - Staff dashboard for provider management
   - Integrates both components
   - "Add Provider" button
   - Pending interventions tab

### API Routes

4. **`src/routes/api/services/providers/add-to-roster/+server.ts`**
   - POST endpoint proxy to Django backend
   - Forwards auth token from cookies

5. **`src/routes/api/services/providers/interventions/+server.ts`**
   - GET endpoint proxy to Django backend
   - Returns list of pending interventions

6. **`src/routes/api/services/providers/scraped/[id]/resolve/+server.ts`**
   - POST endpoint proxy to Django backend
   - Resolves interventions (link or create)

## Setup Instructions

### 1. Install Node Types (if needed)

```bash
cd frontend/sveltekit/hestami-ai-ui
npm install --save-dev @types/node
```

### 2. Configure API Base URL

Add to your `.env` file:

```bash
API_BASE_URL=http://localhost:8050
```

Or update in each `+server.ts` file if you prefer.

### 3. Verify Auth Cookie Name

The API routes expect `access_token` cookie. If your auth uses a different cookie name, update:

```typescript
const accessToken = cookies.get('your_cookie_name');
```

### 4. Access the Page

Navigate to:
```
http://localhost:5173/staff/providers
```

(Or whatever your SvelteKit dev server URL is)

## Component Usage

### AddProviderModal

```svelte
<script>
  import AddProviderModal from '$lib/components/AddProviderModal.svelte';
  
  let modalOpen = false;
  
  function handleSuccess(event) {
    console.log('Provider added:', event.detail.id);
  }
</script>

<button on:click={() => modalOpen = true}>Add Provider</button>

<AddProviderModal bind:open={modalOpen} on:success={handleSuccess} />
```

### PendingInterventions

```svelte
<script>
  import PendingInterventions from '$lib/components/PendingInterventions.svelte';
</script>

<PendingInterventions />
```

## Features

### Add Provider Modal
- ✅ Form validation
- ✅ Loading states
- ✅ Success/error alerts
- ✅ Auto-close on success
- ✅ Keyboard shortcuts (Escape to close)

### Pending Interventions
- ✅ Auto-fetch on mount
- ✅ Loading spinner
- ✅ Empty state
- ✅ Match score display
- ✅ Link to source URL
- ✅ Resolution modal
- ✅ Auto-refresh after resolution

## Styling

All components use inline styles for portability. You can:

1. **Keep inline styles** - Works out of the box
2. **Extract to global CSS** - Move styles to `app.css`
3. **Use Tailwind** - Replace classes with Tailwind utilities
4. **Use your design system** - Adapt to match your existing components

## API Endpoints

All endpoints require authentication (staff permissions).

### POST `/api/services/providers/add-to-roster/`

**Request:**
```json
{
  "source_name": "Yelp",
  "source_url": "https://www.yelp.com/biz/acme-hvac",
  "raw_html": "<html>...</html>",  // Optional
  "notes": "Found via manual search"  // Optional
}
```

**Response:**
```json
{
  "id": "uuid",
  "source_name": "Yelp",
  "source_url": "https://www.yelp.com/biz/acme-hvac",
  "scrape_status": "pending",
  "message": "Provider added to ingestion queue. Processing will begin shortly."
}
```

### GET `/api/services/providers/interventions/`

**Response:**
```json
{
  "count": 2,
  "results": [
    {
      "id": "uuid",
      "source_name": "Yelp",
      "source_url": "https://www.yelp.com/biz/acme-hvac",
      "last_scraped_at": "2025-11-04T16:00:00Z",
      "intervention_reason": "Ambiguous match",
      "candidate_providers": [...],
      "match_scores": {...}
    }
  ]
}
```

### POST `/api/services/providers/scraped/{id}/resolve/`

**Request (Link):**
```json
{
  "action": "link",
  "provider_id": "uuid"
}
```

**Request (Create):**
```json
{
  "action": "create"
}
```

## Testing

### Test 1: Add Provider

1. Navigate to `/staff/providers`
2. Click "Add Provider"
3. Fill in:
   - Source Name: "Yelp"
   - Source URL: "https://www.yelp.com/biz/test-hvac"
   - Notes: "Test provider"
4. Submit
5. Should see success message
6. Modal closes after 2 seconds

### Test 2: View Interventions

1. Create a provider that triggers intervention (70-84% match)
2. Navigate to `/staff/providers`
3. Should see intervention card
4. Click "Resolve Intervention"
5. Choose "Link to Existing Provider" or "Create New Provider"
6. Intervention should disappear from list

### Test 3: Backend Integration

Check Django logs to verify:
```bash
docker logs api-dev | grep -E "Provider added|Intervention resolved"
```

## Troubleshooting

### Issue: API calls return 401

**Solution**: Check that:
1. User is logged in
2. Auth cookie is being sent
3. Cookie name matches in API routes
4. User has staff permissions

### Issue: Components not rendering

**Solution**: Check browser console for:
1. Import errors
2. API errors
3. CORS issues (should be handled by proxy)

### Issue: Interventions not appearing

**Solution**: 
1. Check database: `ServiceProviderScrapedData.objects.filter(scrape_status='paused_intervention')`
2. Verify backend API: `curl http://localhost:8050/api/services/providers/interventions/`
3. Check browser network tab for API call

### Issue: TypeScript errors

**Solution**:
```bash
npm install --save-dev @types/node
```

## Next Steps

1. ✅ Components created
2. ✅ API routes created
3. ✅ Page created
4. ⏳ Test with real data
5. ⏳ Add toast notifications (optional)
6. ⏳ Add loading states to page (optional)
7. ⏳ Integrate with existing staff navigation

## Integration with Existing UI

Add a link to your staff navigation:

```svelte
<!-- In your staff layout or navigation component -->
<nav>
  <a href="/staff/requests">Service Requests</a>
  <a href="/staff/providers">Provider Management</a>
  <!-- other links -->
</nav>
```

## Customization

### Change Colors

Update the color values in the `<style>` sections:

```css
/* Primary color (blue) */
background-color: #3b82f6;  /* Change to your brand color */

/* Success color (green) */
background-color: #f0fdf4;  /* Change to your success color */

/* Error color (red) */
background-color: #fef2f2;  /* Change to your error color */
```

### Add Toast Notifications

Install a toast library:
```bash
npm install svelte-french-toast
```

Then update the components to show toasts instead of inline alerts.

### Add Pagination

For large numbers of interventions, add pagination to `PendingInterventions.svelte`:

```svelte
<script>
  let page = 1;
  let pageSize = 10;
  
  async function fetchInterventions() {
    const response = await fetch(
      `/api/services/providers/interventions/?page=${page}&page_size=${pageSize}`
    );
    // ...
  }
</script>
```

---

**Status**: ✅ Ready to use
**Last Updated**: November 4, 2025
