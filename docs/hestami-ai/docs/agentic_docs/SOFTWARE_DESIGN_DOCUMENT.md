Software Design Document (SDD)
Project Name:

Hestami AI-Driven Property Management System
1. Introduction
1.1 Purpose

This document provides a detailed design for the Hestami AI-Driven Property Management System. It outlines the system architecture, component responsibilities, and interaction flows to support the MVP’s functionality, including agent orchestration, state management, and the guardrails component.
1.2 Scope

The system automates the lifecycle of residential property service requests, from intake to provider engagement. Key components include:

    Multi-agent system (Client Liaison Agent, Research Agent, Business Contact Agent).
    Orchestrator (CrewAI) to manage agent workflows.
    Guardrails for content validation and escalation.
    State management using Redis (transient) and Elasticsearch (durable).

2. System Overview
2.1 Key Features

    Client Liaison Agent:
        Gathers service request details.
        Updates clients on workflow progress.
    Research Agent:
        Queries Bing Search API via Haystack for service providers.
        Filters and ranks results based on client priorities.
    Business Contact Agent:
        Contacts service providers via Twilio or SendGrid.
        Logs provider responses.
    Guardrails Component:
        Validates content for compliance with organizational standards.
        Escalates flagged issues for resolution.
    State Management:
        Redis for transient notifications.
        Elasticsearch for durable storage and analytics.

3. System Architecture
3.1 Logical Architecture

    Frontend:
        Built using NextJS for client and service provider interaction.
    Backend:
        Django REST Framework (DRF) with Postgres as the database.
    Agent Framework:
        CrewAI orchestrator coordinating multi-agent workflows.
    Data Management:
        Redis for transient task state and inter-agent communication.
        Elasticsearch for durable storage of service request states and logs.
    Third-Party Services:
        Bing Search API for provider discovery.
        Twilio/SendGrid for provider communication.

3.2 Physical Architecture
Component	Technology	Deployment
Frontend	NextJS	Docker container, NGINX server
Backend	Django REST Framework	Docker container
Orchestrator	CrewAI	Docker container
Redis	Redis (transient state)	Docker container
Elasticsearch	Elasticsearch	Docker container
Agent Workflows	Python (CrewAI-based)	Docker container
Third-Party Services	Bing Search, Twilio	External APIs
4. Detailed Design
4.1 Components
4.1.1 Client Liaison Agent

    Responsibilities:
        Validate and log client input using guardrails.
        Notify clients of workflow progress.
    Integration:
        Consumes APIs from the Django backend.
        Updates Elasticsearch with logs of interactions.

4.1.2 Research Agent

    Responsibilities:
        Query Bing Search API for providers via Haystack.
        Rank and filter results based on client-defined priorities.
        Cache results in Elasticsearch.
    Integration:
        Uses Haystack for RAG workflows.
        Logs all queries and results in Elasticsearch.

4.1.3 Business Contact Agent

    Responsibilities:
        Contact providers using Twilio or SendGrid.
        Log provider responses (e.g., availability, pricing) in Elasticsearch.
    Integration:
        Sends validated messages via guardrails.
        Logs communication outcomes in Elasticsearch.

4.1.4 Guardrails Component

    Responsibilities:
        Pre-process and validate all user inputs and agent responses.
        Flag inappropriate content and escalate to supervisors.
    Integration:
        Middleware between agents and external systems.
        Logs flagged interactions in Elasticsearch.

4.2 Data Flow

    Service Request Creation:
        Client submits a request through the NextJS frontend.
        Backend creates a service request and stores it in Postgres.
        Redis notifies the orchestrator to start the workflow.

    Agent Workflow:
        CrewAI orchestrator triggers:
            Client Liaison Agent to gather additional details.
            Research Agent to query providers via Haystack and store results in Elasticsearch.
            Business Contact Agent to reach out to providers and log responses.

    Content Validation:
        Guardrails intercept messages at each step:
            Pre-process user input before agents receive it.
            Post-process agent responses before sending them to users.

5. Data Management
5.1 Data Stores

    Postgres:
        Stores user data, properties, and service requests.
    Redis:
        Handles transient state and Celery task notifications.
        Keys expire based on TTL to prevent unbounded growth.
    Elasticsearch:
        Logs:
            Service request state.
            Agent activities.
            Search query results.
        Implements retention policies for efficient storage.

5.2 Sample Data Structures

Service Request (Postgres):

{
  "id": "12345",
  "property_id": "abc123",
  "status": "PENDING",
  "description": "Leaking pipe under the sink",
  "created_by": "user_001"
}

Search Query (Elasticsearch):

{
  "service_request_id": "12345",
  "query": "Plumbers near ZIP 90210",
  "results": [
    {
      "business_name": "Fast Plumbers",
      "rating": 4.5,
      "reviews": 25,
      "url": "http://fastplumbers.com"
    }
  ],
  "timestamp": "2024-12-10T12:00:00Z"
}

Agent Activity Log (Elasticsearch):

{
  "agent": "Client Liaison Agent",
  "activity_type": "NOTIFY_CLIENT",
  "details": "Client updated about search results",
  "timestamp": "2024-12-10T12:05:00Z"
}

6. Security Design

    Authentication and Authorization:
        JWT-based authentication for API endpoints.
        Role-based access control for users (Property Owner, Service Provider, Hestami AI Staff).

    Data Validation:
        Guardrails ensure all inputs and outputs are sanitized.
        Strict schema validation for Elasticsearch and Postgres data.

    Transport Security:
        All APIs secured with HTTPS.

7. Deployment

    Dockerized Architecture:
        All components (frontend, backend, orchestrator, agents) run in Docker containers.
        Docker Compose used for local development and deployment.

    Cloud Deployment:
        Target AWS or GCP with:
            Elastic Beanstalk for the backend.
            Managed Elasticsearch service.
            Redis for task state.

8. Future Considerations

    Scalability:
        Add new agents (e.g., Billing Agent, Feedback Agent) as needed.
        Use Kubernetes for container orchestration.

    Advanced Guardrails:
        Train custom AI models for property management-specific validation.

    Client Insights:
        Integrate analytics for client feedback and workflow optimization.

9. Implementation Details Addendum

9.1 Agent Service Architecture

The `backend/agents` directory will contain two main components:
- FastAPI application (running as a separate process)
- CrewAI orchestrator and agent workflows

Directory Structure:
```
backend/agents/
    |-- fastapi/           # FastAPI application
        |-- app/           # Following FastAPI best practices
        |-- core/
        |-- api/
    |-- crewai/           # CrewAI and agent workflows
        |-- agents/       # Individual agent implementations
        |-- workflows/    # Workflow definitions
        |-- tools/       # Agent tools and utilities
    |-- Dockerfile       # Combined container for both processes
```

9.2 Communication Patterns

1. Service Request Flow:
   - Django backend saves new service request in Postgres
   - Celery task triggered post-save
   - Task sends message via Redis to CrewAI
   - CrewAI orchestrator initiates agent workflow

2. Notifications:
   - Implemented in Django `communications` app
   - Basic models: `Notification` and `Message`
   - REST endpoints for sending/receiving notifications
   - Agents use these endpoints to communicate with users

9.3 Data Storage

1. Elasticsearch:
   - Dedicated to Haystack document store
   - No shared indices with other components
   - Used for provider search and caching

2. Redis:
   - Shared instance with existing Celery tasks
   - Used for:
     - Service request notifications
     - Inter-process communication
     - Transient state management

9.4 Authentication & Authorization

- Agents operate as system users with `is_hestami_staff=True`
- Specific user accounts/roles aligned with agent types
- JWT-based authentication for API access