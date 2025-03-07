Business Requirements Document (BRD)
Project Name:Agentic AI Agents for Property Management Implementation

Hestami AI-Driven Property Management System
1. Executive Summary

The Hestami AI-Driven Property Management System leverages a multi-agent AI architecture to streamline residential property management tasks. This new subsystem focuses on handling client service requests, identifying suitable service providers, and ensuring transparent communication. Haystack is employed to manage data retrieval and query processing, integrating seamlessly with Elasticsearch for long-term state storage and Bing Search API for real-time provider discovery. The MVP features three core agents—Client Liaison Agent, Research Agent, and Business Contact Agent—coordinated by CrewAI's Orchestrator.
2. Business Goals

    Automate the service request lifecycle using AI-driven workflows.
    Implement structured, query-driven research via Haystack for provider discovery.
    Ensure reliability and scalability by using Elasticsearch for state management and Haystack for RAG workflows.
    Enhance user trust through transparency and auditable decision logs.

3. Functional Requirements
Core Features

    Client Liaison Agent:
        Gathers initial service request details from clients.
        Relays updates to clients about workflow progress.
        Focused on client interaction, not backend tasks like data retrieval.
    Research Agent:
        Queries Bing Search API via Haystack for relevant service providers.
        Uses Haystack to process, rank, and filter results based on client-defined priorities.
        Stores processed results in Elasticsearch for persistence and further analysis.
    Business Contact Agent:
        Contacts shortlisted providers via APIs like Twilio or SendGrid.
        Collects availability, pricing, and other responses.
        Updates Elasticsearch with communication outcomes.
    Haystack Integration:
        Centralizes RAG workflows, connecting Bing Search API, Elasticsearch, and query logic.
        Ensures all search results are cached, processed, and retrievable for transparency.
    Orchestrator (CrewAI):
        Manages agent workflows, coordinating tasks like provider research, communication, and client updates.

State Management

    Redis:
        Handles transient task notifications and quick inter-agent communication.
        Works in tandem with Celery for asynchronous task management.
    Elasticsearch (via Haystack):
        Acts as the durable data store for service request states, agent decisions, and query results.
        Supports advanced queries for auditing and analysis.

Transparency and Accountability

    Haystack logs all queries and results for full traceability.
    Elasticsearch maintains a detailed record of agent decisions and interactions.
    Client-facing updates summarize workflow progress, providing both high-level and detailed insights.

4. Technical Requirements
System Architecture

    Frontend:
        NextJS for capturing client requests and displaying status updates.
    Backend:
        Django REST Framework (DRF) for service request APIs.
        Celery for asynchronous task processing.
    Agents and Orchestrator:
        CrewAI to coordinate workflows and inter-agent communication.
    Data Retrieval:
        Haystack integrates with Bing Search API for external queries and Elasticsearch for storage and analysis.
    Storage:
        Redis for transient state and notifications.
        Elasticsearch for durable state and query caching.
    Third-Party Services:
        Bing Search API for provider discovery.
        Twilio or SendGrid for provider communication.

5. Non-Functional Requirements

    Reliability:
        Redis ensures rapid notification delivery with TTL for cleanup.
        Haystack and Elasticsearch provide durable state storage.
    Scalability:
        Haystack supports growing query needs by caching results in Elasticsearch.
        Modular design allows easy addition of new agents or APIs.
    Performance:
        Redis provides low-latency task handling.
        Elasticsearch, optimized via Haystack, ensures efficient querying and logging.

6. Workflow Description
Service Request Lifecycle

    Client Interaction:
        The Client Liaison Agent gathers service request details and notifies the Orchestrator.
    Research and Recommendations:
        The Research Agent uses Haystack to query Bing Search API for service providers.
        Results are processed (e.g., ranked, filtered) and cached in Elasticsearch.
    Provider Engagement:
        The Business Contact Agent contacts shortlisted providers using Twilio/SendGrid.
        Responses are logged in Elasticsearch.
    Progress Updates:
        The Client Liaison Agent provides updates to the client, using Elasticsearch logs for transparency.

7. Risks and Mitigation
Risk	Mitigation
Redis state loss on restart	Configure Redis with AOF or RDB for persistence.
Elasticsearch index growth	Use Haystack’s caching policies and Elasticsearch ILM rules.
Query result inconsistencies	Cache all Bing Search results via Haystack to ensure reusability.
API rate limits (Bing Search)	Implement rate-limiting and use cached results to reduce queries.
8. Role of Haystack in the System

    Central RAG Framework:
        Manages external queries (Bing Search API) and result processing.
        Ensures all results are cached in Elasticsearch for transparency and reusability.
    Query Processing:
        Handles client priorities (e.g., cost, reputation) by applying ranking and filtering.
    Transparency:
        Logs all queries and results, enabling full traceability.
    Workflow Integration:
        Seamlessly integrates with the Research Agent and Elasticsearch.

9. Future Enhancements

    Enhanced Haystack Pipelines:
        Use Haystack for more complex RAG workflows, such as generating detailed client-facing reports.
    Advanced Query Handling:
        Integrate additional APIs (e.g., Google Maps) into Haystack for broader provider searches.
    Feedback Mechanisms:
        Use Elasticsearch logs to analyze agent performance and improve decision-making.

10. Approval and Next Steps

    Approval:
        Stakeholders to review and approve the revised BRD.
    Next Steps:
        Implement Haystack integration with Elasticsearch and Bing Search API.
        Finalize agent workflows in CrewAI with state management via Redis and Elasticsearch.
        Begin MVP testing and validation.



Guardrails Component

Objective: Ensure that all interactions—whether between users and agents, or agents themselves—remain on topic, professional, and within ethical, legal, and organizational boundaries.
Responsibilities of the Guardrails Component

    Content Monitoring:
        Analyze user input and agent responses to ensure they align with the purpose of the interaction.
        Detect and flag inappropriate, off-topic, or forbidden content.

    Intervention Mechanisms:
        Issue real-time alerts to agents when violations occur.
        Modify or block inappropriate responses before they are presented to users.
        Escalate unresolved issues to the Client Liaison Agent or Hestami AI Staff for review.

    Logging and Reporting:
        Maintain a log of flagged interactions for auditing and improvement.
        Provide detailed feedback to improve agent models over time.

Technical Requirements for the Guardrails Component

    Integration:
        Intercept all communications passing through the CrewAI orchestrator for analysis.
        Interface with Redis for transient state and Elasticsearch for logging flagged interactions.

    Detection Capabilities:
        Use a combination of rule-based systems (e.g., regular expressions) and AI-based models (e.g., OpenAI Moderation API, Hugging Face toxicity detection models).
        Detect:
            Offensive or harmful language.
            Unauthorized topics (e.g., unrelated to property management).
            Potential illegal activity.

    Escalation Workflow:
        When a guardrails violation is detected:
            Notify the offending agent (or user).
            Escalate to a supervisor (e.g., Hestami AI Staff) if the issue persists.
        Integrate escalation steps into the CrewAI orchestrator workflows.

    User Feedback:
        Include a feedback mechanism for users to flag interactions they find inappropriate or unhelpful.

Guardrails Integration with System Architecture

    Workflow Overview:
        Pre-Processing:
            Analyze user input before sending it to agents.
        Post-Processing:
            Review agent responses before presenting them to users.
        Continuous Monitoring:
            Actively monitor long-running interactions for violations.

    Data Flow:
        Guardrails intercept messages and pass valid content to agents.
        Flagged content is logged in Elasticsearch with details for auditing.

Key Benefits

    Improved Trust:
        Users feel confident knowing inappropriate behavior is monitored and addressed.
    Compliance:
        Ensures adherence to ethical, legal, and organizational standards.
    Scalability:
        Modular integration with CrewAI allows guardrails to adapt to new workflows or agents.

Implementation Roadmap for Guardrails
Phase 1: Rule-Based Detection

    Develop basic detection rules for known violations.
    Log flagged interactions in Elasticsearch for review.

Phase 2: AI-Driven Monitoring

    Integrate pre-trained models for detecting harmful or off-topic content.
    Test and fine-tune detection thresholds.

Phase 3: Real-Time Escalation

    Implement workflows to escalate unresolved issues to human supervisors.
    Add UI components for user feedback.

Updated Integration into the Project Structure
Component	Responsibility	Dependencies
Guardrails	Content monitoring, escalation, and logging of violations.	CrewAI, Redis, Elasticsearch
Client Liaison Agent	Communicates updates and flagged escalations to users.	CrewAI, Guardrails
Research Agent	Processes filtered queries that pass through guardrails.	CrewAI, Haystack, Bing Search API
Business Contact Agent	Communicates with service providers using validated content.	CrewAI, Twilio/SendGrid, Guardrails
