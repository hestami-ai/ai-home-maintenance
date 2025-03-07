Data Model Document
Project Name:

Hestami AI-Driven Property Management System
1. Overview

The data model for the Hestami AI-Driven Property Management System supports the lifecycle of service requests, agent workflows, and state management. It integrates three key storage systems: Postgres for structured relational data, Redis for transient state management, and Elasticsearch for durable storage and analytics.
2. Data Model Overview
Entity	Purpose	Storage
User	Tracks property owners, service providers, and staff roles.	Postgres
Property	Stores property details for property owners.	Postgres
Service Request	Tracks service requests and their status.	Postgres
Agent Activity	Logs actions taken by agents for auditing and transparency.	Elasticsearch
Search Query	Logs external queries made by agents (e.g., Bing Search API).	Elasticsearch
Search Result	Stores individual results from provider searches.	Elasticsearch
Task Notification (Transient)	Tracks notifications sent to agents for new tasks.	Redis
3. Entity Descriptions
3.1 User

Tracks users in the system, including property owners, service providers, and Hestami AI staff.
Field	Type	Description
id	UUID	Unique identifier for the user.
username	String	User’s username.
email	String	User’s email address.
role	Enum	Role (PropertyOwner, ServiceProvider, Staff).
created_at	Timestamp	Timestamp of when the user was created.
3.2 Property

Tracks properties owned by property owners.
Field	Type	Description
id	UUID	Unique identifier for the property.
user_id	UUID (FK)	Foreign key to the owner in the User table.
address	String	Address of the property.
created_at	Timestamp	Timestamp of when the property was added.
3.3 Service Request

Tracks service requests submitted by property owners.
Field	Type	Description
id	UUID	Unique identifier for the service request.
property_id	UUID (FK)	Foreign key to the Property table.
status	Enum	Status (PENDING, IN_PROGRESS, COMPLETED).
description	Text	Description of the issue.
created_by	UUID (FK)	Foreign key to the creator in the User table.
created_at	Timestamp	Timestamp of when the request was created.
3.4 Agent Activity

Logs actions taken by agents.
Field	Type	Description
id	UUID	Unique identifier for the activity.
service_request_id	UUID (FK)	Foreign key to the Service Request.
agent_name	String	Name of the agent performing the action.
activity_type	String	Type of action (e.g., QUERY, CONTACT).
details	Text	Description of the action.
timestamp	Timestamp	Time when the action was performed.
3.5 Search Query

Logs external queries performed by agents (e.g., Bing Search API).
Field	Type	Description
id	UUID	Unique identifier for the query.
service_request_id	UUID (FK)	Foreign key to the Service Request.
query_text	Text	The query text sent to the API.
parameters	JSON	Query parameters (e.g., filters, radius).
response_metadata	JSON	Metadata from the API response.
created_at	Timestamp	Time when the query was made.
3.6 Search Result

Stores individual results retrieved from external queries.
Field	Type	Description
id	UUID	Unique identifier for the search result.
search_query_id	UUID (FK)	Foreign key to the Search Query.
business_name	String	Name of the business.
business_url	URL	Website of the business.
rating	Float	Average rating of the business.
reviews_count	Integer	Total number of reviews.
address	String	Address of the business.
is_shortlisted	Boolean	Whether the result was shortlisted.
created_at	Timestamp	Time when the result was saved.
3.7 Task Notification (Transient)

Tracks transient notifications sent to agents via Redis.
Field	Type	Description
task_id	String	Unique identifier for the task.
agent_name	String	Agent receiving the notification.
payload	JSON	Task details and relevant metadata.
expires_at	Timestamp	Expiration time for the notification.
4. Relationships
Relationship	Description
User → Property (1:M)	A user can own multiple properties.
Property → Service Request (1:M)	A property can have multiple service requests.
Service Request → Agent Activity (1:M)	A service request can log multiple agent activities.
Service Request → Search Query (1:M)	A service request can have multiple related queries.
Search Query → Search Result (1:M)	A query can produce multiple search results.
5. Data Flow

    Service Request Creation:
        A property owner submits a request via the frontend.
        Request is saved in Postgres and triggers a notification in Redis.

    Agent Workflows:
        CrewAI orchestrator triggers agents.
        Agents log actions (e.g., queries, decisions) in Elasticsearch.

    Search Queries:
        The Research Agent queries Bing Search API via Haystack.
        Results are cached in Elasticsearch for transparency.

6. Schema Diagram

+------------------+     +------------------+     +------------------+
|      User        |     |     Property     |     | Service Request  |
+------------------+     +------------------+     +------------------+
| id               |<---1| user_id          |<---1| property_id      |
| username         |     | address          |     | status           |
| role             |     | created_at       |     | description      |
| created_at       |     +------------------+     | created_at       |
+------------------+                                +------------------+
        ^                                                    |
        |                                                    |
        +-----------------+                     +------------+
                          |                     |
                          v                     v
                   +------------------+   +------------------+
                   |  Agent Activity  |   |    Search Query   |
                   +------------------+   +------------------+
                   | id               |   | id               |
                   | agent_name       |   | query_text       |
                   | activity_type    |   | response_metadata|
                   | timestamp        |   | created_at       |
                   +------------------+   +------------------+

7. Implementation Details Addendum

7.1 Communications App Models

```python
# Notification Model
class Notification:
    id: UUID
    recipient_id: UUID (FK to User)
    sender_id: UUID (FK to User)
    notification_type: Enum (SERVICE_REQUEST, AGENT_UPDATE, SYSTEM)
    content: Text
    is_read: Boolean
    created_at: Timestamp
    updated_at: Timestamp

# Message Model
class Message:
    id: UUID
    conversation_id: UUID
    sender_id: UUID (FK to User)
    recipient_id: UUID (FK to User)
    content: Text
    message_type: Enum (AGENT_MESSAGE, USER_MESSAGE, SYSTEM_MESSAGE)
    created_at: Timestamp
```

7.2 Haystack Document Store

The Elasticsearch indices for Haystack will include:

1. Provider Documents:
```json
{
    "id": "UUID",
    "business_name": "string",
    "services": ["string"],
    "location": {
        "lat": float,
        "lon": float,
        "address": "string"
    },
    "contact_info": {
        "phone": "string",
        "email": "string",
        "website": "string"
    },
    "ratings": {
        "average": float,
        "count": integer
    },
    "source": "string",  // e.g., "bing_search"
    "last_updated": "timestamp"
}
```

2. Search Metadata:
```json
{
    "id": "UUID",
    "service_request_id": "UUID",
    "query": "string",
    "filters": {
        "service_type": "string",
        "location_radius": integer,
        "min_rating": float
    },
    "results_count": integer,
    "timestamp": "timestamp"
}
```

7.3 Redis Schema

Key patterns for Redis:
```
# Service Request Notifications
service_request:{request_id}:status
service_request:{request_id}:agent_updates

# Agent Task Queue
agent_tasks:{agent_type}:queue

# Transient State
workflow:{workflow_id}:state
```