# Activity Timeline API Documentation

## Overview

The Activity Timeline API provides endpoints for managing timeline entries related to service requests. It supports creating, retrieving, updating, and deleting timeline entries, as well as marking entries as read and getting unread counts.

## Authentication

All endpoints require authentication. Users can only access timeline entries for service requests they are participants in:

- Property owners can access timelines for their own service requests
- Service providers can access timelines for service requests assigned to them
- Staff members can access all timelines

## Endpoints

### List Timeline Entries

```
GET /api/services/requests/{service_request_id}/timeline/
```

Retrieves a paginated list of timeline entries for a specific service request.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request
- `entry_type` (string, query parameter, optional): Filter by entry type
- `created_by` (UUID, query parameter, optional): Filter by creator
- `ordering` (string, query parameter, optional): Order by field (e.g., `-created_at` for descending)
- `page` (integer, query parameter, optional): Page number
- `page_size` (integer, query parameter, optional): Number of items per page

**Response:**

```json
{
  "count": 25,
  "next": "http://example.com/api/services/requests/{id}/timeline/?page=2",
  "previous": null,
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "service_request": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "entry_type": "COMMENT",
      "content": "This is a comment",
      "metadata": {},
      "created_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "user_role": "PROPERTY_OWNER"
      },
      "created_at": "2023-01-01T12:00:00Z",
      "updated_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "user_role": "PROPERTY_OWNER"
      },
      "updated_at": "2023-01-01T12:00:00Z",
      "is_deleted": false,
      "read_status": {
        "is_read": true,
        "read_at": "2023-01-01T12:05:00Z"
      }
    }
    // Additional entries...
  ]
}
```

### Create Timeline Entry

```
POST /api/services/requests/{service_request_id}/timeline/
```

Creates a new timeline entry for a specific service request.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request

**Request Body:**

```json
{
  "entry_type": "STATUS_CHANGE",
  "content": "Status changed from PENDING to IN_PROGRESS",
  "metadata": {
    "old_status": "PENDING",
    "new_status": "IN_PROGRESS"
  }
}
```

**Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "service_request": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entry_type": "STATUS_CHANGE",
  "content": "Status changed from PENDING to IN_PROGRESS",
  "metadata": {
    "old_status": "PENDING",
    "new_status": "IN_PROGRESS"
  },
  "created_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_role": "STAFF"
  },
  "created_at": "2023-01-01T12:00:00Z",
  "updated_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_role": "STAFF"
  },
  "updated_at": "2023-01-01T12:00:00Z",
  "is_deleted": false,
  "read_status": {
    "is_read": false,
    "read_at": null
  }
}
```

### Create Comment

```
POST /api/services/requests/{service_request_id}/timeline/comment/
```

Creates a new comment-type timeline entry for a specific service request.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request

**Request Body:**

```json
{
  "content": "This is a comment with a question",
  "comment_type": "QUESTION",
  "visibility": "ALL",
  "mentions": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
}
```

**Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "service_request": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entry_type": "COMMENT",
  "content": "This is a comment with a question",
  "metadata": {},
  "created_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_role": "PROPERTY_OWNER"
  },
  "created_at": "2023-01-01T12:00:00Z",
  "updated_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_role": "PROPERTY_OWNER"
  },
  "updated_at": "2023-01-01T12:00:00Z",
  "is_deleted": false,
  "read_status": {
    "is_read": false,
    "read_at": null
  },
  "comment_type": "QUESTION",
  "visibility": "ALL",
  "is_edited": false,
  "edit_history": [],
  "mentions": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
}
```

### Retrieve Timeline Entry

```
GET /api/services/requests/{service_request_id}/timeline/{entry_id}/
```

Retrieves a specific timeline entry.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request
- `entry_id` (UUID, path parameter): ID of the timeline entry

**Response:**

Same format as the create response.

### Update Timeline Entry

```
PATCH /api/services/requests/{service_request_id}/timeline/{entry_id}/
```

Updates a specific timeline entry. For comments, this will track edit history.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request
- `entry_id` (UUID, path parameter): ID of the timeline entry

**Request Body:**

```json
{
  "content": "Updated content"
}
```

**Response:**

Same format as the create response, with updated fields and edit history if applicable.

### Delete Timeline Entry

```
DELETE /api/services/requests/{service_request_id}/timeline/{entry_id}/
```

Soft-deletes a timeline entry (sets `is_deleted` to true).

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request
- `entry_id` (UUID, path parameter): ID of the timeline entry

**Response:**

HTTP 204 No Content

### Mark Entry as Read

```
POST /api/services/requests/{service_request_id}/timeline/{entry_id}/read/
```

Marks a timeline entry as read by the current user.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request
- `entry_id` (UUID, path parameter): ID of the timeline entry

**Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timeline_entry": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "read_at": "2023-01-01T12:05:00Z"
}
```

### Get Unread Count

```
GET /api/services/requests/{service_request_id}/timeline/unread/
```

Gets the count of unread timeline entries for the current user.

**Parameters:**

- `service_request_id` (UUID, path parameter): ID of the service request

**Response:**

```json
{
  "service_request": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "unread_count": 5
}
```

## Error Responses

### Authentication Error

```json
{
  "detail": "Authentication credentials were not provided."
}
```

### Permission Error

```json
{
  "detail": "You do not have permission to perform this action."
}
```

### Not Found Error

```json
{
  "detail": "Not found."
}
```

### Validation Error

```json
{
  "field_name": [
    "Error message"
  ]
}
```
