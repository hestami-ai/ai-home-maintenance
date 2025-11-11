# Provider Ingestion UI Setup Guide

## Overview

This guide covers the setup and usage of the Provider Ingestion UI components for adding service providers to the roster and managing intervention workflows.

## Prerequisites

The UI components require shadcn/ui components. If not already installed, run:

```bash
cd frontend/nextjs

# Install required shadcn/ui components
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge

# Install lucide-react if not present
npm install lucide-react
```

## Components

### 1. AddProviderModal

**Location**: `src/components/services/AddProviderModal.tsx`

**Purpose**: Modal dialog for staff to manually add service providers from external sources.

**Usage**:

```tsx
import { AddProviderModal } from '@/components/services/AddProviderModal';

function MyComponent() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSuccess = (scrapedDataId: string) => {
    console.log('Provider added:', scrapedDataId);
    // Optionally navigate to status page or refresh list
  };

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>
        Add Provider to Roster
      </Button>
      
      <AddProviderModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
```

**Fields**:
- **Source Name** (required): e.g., "Yelp", "Angi", "Google"
- **Source URL** (required): Full URL to the provider's page
- **Raw HTML** (optional): Paste HTML content if available
- **Notes** (optional): Additional context or notes

**Workflow**:
1. User fills out the form
2. Submits to `/api/services/providers/add-to-roster/`
3. Creates `ServiceProviderScrapedData` record with status `pending`
4. Celery task picks it up within 5 seconds
5. DBOS workflow processes the provider

### 2. PendingInterventions

**Location**: `src/components/services/PendingInterventions.tsx`

**Purpose**: Dashboard for viewing and resolving ambiguous provider matches that require human intervention.

**Usage**:

```tsx
import { PendingInterventions } from '@/components/services/PendingInterventions';

function InterventionDashboard() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Pending Interventions</h1>
      <PendingInterventions />
    </div>
  );
}
```

**Features**:
- Lists all providers paused for intervention
- Shows match scores for candidate providers
- Displays intervention reason
- Allows staff to:
  - Link to an existing provider
  - Create a new provider

**Workflow**:
1. Component fetches from `/api/services/providers/interventions/`
2. Displays cards for each pending intervention
3. Staff clicks "Resolve Intervention"
4. Modal shows options:
   - Link to existing provider (with match scores)
   - Create new provider
5. Submits resolution to `/api/services/providers/scraped/{id}/resolve/`

## API Endpoints

### POST `/api/services/providers/add-to-roster/`

Add a provider to the ingestion queue.

**Request**:
```json
{
  "source_name": "Yelp",
  "source_url": "https://www.yelp.com/biz/acme-hvac",
  "raw_html": "<html>...</html>",  // Optional
  "notes": "Found via manual search"  // Optional
}
```

**Response**:
```json
{
  "id": "uuid",
  "source_name": "Yelp",
  "source_url": "https://www.yelp.com/biz/acme-hvac",
  "scrape_status": "pending",
  "message": "Provider added to ingestion queue. Processing will begin shortly."
}
```

### GET `/api/services/providers/scraped/{id}/status/`

Get the status of a scraped data record.

**Response**:
```json
{
  "id": "uuid",
  "source_name": "Yelp",
  "source_url": "https://www.yelp.com/biz/acme-hvac",
  "scrape_status": "paused_intervention",
  "workflow_id": "workflow-uuid",
  "last_scraped_at": "2025-11-04T16:00:00Z",
  "processed_at": null,
  "error_message": null,
  "service_provider_id": null,
  "intervention_data": {
    "reason": "Ambiguous match: multiple candidates with 70-84% similarity",
    "candidate_providers": [...],
    "match_scores": {...}
  }
}
```

### GET `/api/services/providers/interventions/`

List all pending interventions.

**Response**:
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
      "candidate_providers": [
        {
          "id": "provider-uuid",
          "business_name": "ACME HVAC",
          "phone": "555-1234",
          "website": "https://acmehvac.com"
        }
      ],
      "match_scores": {
        "provider-uuid": 78.5
      }
    }
  ]
}
```

### POST `/api/services/providers/scraped/{id}/resolve/`

Resolve an intervention.

**Request (Link to existing)**:
```json
{
  "action": "link",
  "provider_id": "uuid"
}
```

**Request (Create new)**:
```json
{
  "action": "create"
}
```

**Response**:
```json
{
  "message": "Successfully linked to existing provider",
  "provider_id": "uuid"
}
```

## Integration Example

Here's a complete example of integrating both components into a staff dashboard:

```tsx
// app/staff/providers/page.tsx
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddProviderModal } from '@/components/services/AddProviderModal';
import { PendingInterventions } from '@/components/services/PendingInterventions';
import { PlusCircle } from 'lucide-react';

export default function ProviderManagementPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Provider Management</h1>
        <Button onClick={() => setAddModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      <Tabs defaultValue="interventions">
        <TabsList>
          <TabsTrigger value="interventions">Pending Interventions</TabsTrigger>
          <TabsTrigger value="all">All Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="interventions" className="mt-6">
          <PendingInterventions />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {/* Your existing provider list component */}
        </TabsContent>
      </Tabs>

      <AddProviderModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={(id) => {
          console.log('Provider added:', id);
          // Optionally refresh the list or show a toast
        }}
      />
    </div>
  );
}
```

## Permissions

All endpoints require:
- Authentication (`IsAuthenticated`)
- Staff permissions (`IsHestamaiStaff`)

Ensure users have the appropriate permissions before accessing these features.

## Monitoring

Monitor the ingestion workflow:

```bash
# Watch Celery logs
docker logs -f api-dev | grep -E "scraped data|workflow"

# Check DBOS workflow status
# Visit DBOS Conductor at https://console.dbos.dev/self-host?appname=hestami-ai-services

# Query database
docker exec -it api-dev python manage.py shell
>>> from services.models import ServiceProviderScrapedData
>>> ServiceProviderScrapedData.objects.filter(scrape_status='paused_intervention').count()
```

## Troubleshooting

### Provider not processing

1. Check Celery worker is running:
   ```bash
   docker logs api-dev | grep "celery worker"
   ```

2. Check for errors in workflow:
   ```bash
   docker logs api-dev | grep "ERROR"
   ```

3. Verify DBOS is initialized:
   ```bash
   docker logs api-dev | grep "DBOS initialized"
   ```

### Intervention not appearing

1. Check match scores in logs:
   ```bash
   docker logs api-dev | grep "Match score"
   ```

2. Verify thresholds in `identity_resolution.py`:
   - Auto-link: ≥85%
   - Intervention: 70-84%
   - Auto-create: <70%

### API errors

1. Check authentication token is valid
2. Verify user has `IsHestamaiStaff` permission
3. Check Django logs for detailed error messages

## Next Steps

1. Install required UI dependencies
2. Create a staff dashboard page
3. Add the components to your routing
4. Test the end-to-end workflow
5. Monitor interventions and refine matching thresholds
