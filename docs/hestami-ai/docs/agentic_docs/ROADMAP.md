This roadmap reflects the current state where Phase 1 (core backend functionality and database setup) has been completed. It removes timeline references, focusing purely on technical steps for implementation.

Phase 2: Agent and Orchestrator Integration

Objective: Deploy CrewAI orchestrator and integrate the multi-agent system to handle workflows and task automation.
Tasks:

    CrewAI Orchestrator:
        Set up the orchestrator to manage agent workflows for service requests.
        Define the workflow sequence:
            Client Liaison Agent gathers details.
            Research Agent performs provider discovery via Bing Search API.
            Business Contact Agent contacts providers and collects responses.

    Redis for State Notifications:
        Configure Redis as the transient state handler for:
            Task notifications.
            Workflow triggers and updates.

    Client Liaison Agent:
        Automate client notifications, such as:
            Confirmation of service requests.
            Updates on workflow progress.
        Log all actions in Elasticsearch for auditing and transparency.

    Research Agent:
        Integrate Haystack for:
            Querying Bing Search API.
            Ranking and filtering results.
            Caching results in Elasticsearch for reusability.
        Develop fallback mechanisms:
            Expand search parameters if initial results are insufficient.

    Business Contact Agent:
        Automate provider outreach using Twilio or SendGrid.
        Log provider responses in Elasticsearch, including:
            Availability.
            Pricing.
            Additional comments.

Deliverables:

    Fully operational CrewAI workflows.
    Logging of agent actions and outcomes in Elasticsearch.

Phase 3: Advanced Features

Objective: Enhance functionality with fallback handling, transparency mechanisms, and feedback loops.
Tasks:

    Fallback Handling:
        Implement fallback workflows in CrewAI to:
            Expand provider search criteria.
            Notify clients of failed attempts and next steps.

    Provider Ratings and Feedback:
        Extend the backend and frontend to support:
            Clients submitting post-service feedback.
            Rating providers for future reference.
        Store feedback in Elasticsearch.

    Transparency Features:
        Provide client-facing explanations for agent decisions, including:
            Provider selection criteria.
            Search result filtering and ranking.

    Enhanced Query Handling:
        Refine Haystack pipelines for:
            Handling complex search queries.
            Combining cached and live results for efficiency.

Deliverables:

    Robust fallback workflows.
    Feedback and ratings system integrated.
    Transparent decision logs accessible to clients.

Phase 4: Performance Optimization

Objective: Ensure the system performs efficiently under load and scales as needed.
Tasks:

    Redis and Elasticsearch Optimization:
        Tune Redis for transient notifications and configure TTL for keys.
        Implement Elasticsearch retention policies to manage index growth.

    Load Testing:
        Simulate high-concurrency scenarios for:
            API endpoints.
            Agent workflows.

    Monitoring:
        Deploy monitoring tools (e.g., ELK Stack) to track:
            Workflow performance.
            System resource utilization.

Deliverables:

    Optimized Redis and Elasticsearch configurations.
    Performance metrics for key workflows.

Phase 5: Deployment and Feedback

Objective: Deploy the MVP and collect feedback to guide iterative improvements.
Tasks:

    Deployment:
        Finalize Docker configurations for multi-container deployment:
            Backend and agents.
            Redis and Elasticsearch.
        
        Deploy system using Docker Compose and Dockerfile.

    Feedback Loop:
        Collect feedback from:
            Property owners on service request workflows.
            Providers on communication and ease of use.

    Iterative Refinements:
        Address usability issues based on feedback.
        Plan for post-MVP feature expansion.

Deliverables:

    MVP deployed in production.
    Feedback gathered and analyzed for future iterations.

Revised Workflow Integration with Current System

    Backend:
        Extend Django models to support agent actions, search results, and provider feedback.
        Develop API endpoints for querying agent logs and providing transparency to clients.

    Frontend:
        Update the NextJS frontend to display:
            Provider selection criteria.
            Workflow progress with detailed logs.

    Haystack and Elasticsearch:
        Use Haystack for search query management, connected to Bing Search API and Elasticsearch.
        Enable cached query reuse to optimize search performance.


APPENDIX: Guardrails Component Roadmap Addendum

Phase 2: Agent and Orchestrator Integration

Objective: Deploy CrewAI orchestrator and integrate the multi-agent system with guardrails functionality.
Tasks:

    CrewAI Orchestrator:
        Set up orchestrator workflows for:
            Client Liaison Agent gathering details.
            Research Agent querying providers via Bing Search API.
            Business Contact Agent contacting providers and logging outcomes.
        Add guardrails as a middleware layer for content validation.

    Guardrails Component (Initial Setup):
        Rule-Based Monitoring:
            Implement basic rules to detect:
                Inappropriate language.
                Off-topic requests.
            Use Redis for real-time monitoring of transient tasks.
        Integration with Orchestrator:
            Add guardrails to validate messages before they reach agents or users.
        Logging:
            Store flagged interactions in Elasticsearch for auditing.

    Client Liaison Agent:
        Handle flagged interactions by escalating issues to supervisors or clients.
        Update users on flagged issues and actions taken.

    Research Agent:
        Query Bing Search API via Haystack with validated inputs from guardrails.
        Log search results and any flagged queries.

    Business Contact Agent:
        Interact with service providers using guardrail-validated messages.
        Notify the orchestrator of any flagged responses for escalation.

Deliverables:

    Fully operational CrewAI workflows.
    Basic guardrails functionality integrated.
    Logging of flagged interactions in Elasticsearch.

Phase 3: Advanced Guardrails Functionality

Objective: Enhance the guardrails component with AI-driven monitoring and real-time escalation.
Tasks:

    AI-Driven Monitoring:
        Integrate pre-trained AI models for detecting:
            Harmful or offensive language.
            Unauthorized topics.
        Fine-tune detection thresholds for property management context.

    Real-Time Escalation:
        Define workflows in CrewAI for escalation:
            Notify the orchestrator of flagged issues.
            Escalate unresolved issues to human supervisors (Hestami AI Staff).
        Implement automated feedback loops to improve guardrail performance.

    UI and Feedback Mechanisms:
        Add frontend components to:
            Notify users of flagged content and resolution actions.
            Allow users to flag inappropriate interactions for further review.

    Enhanced Logging:
        Expand Elasticsearch logs to include:
            Full context of flagged interactions.
            Resolution outcomes and timestamps.

Deliverables:

    AI-enhanced guardrails operational.
    Real-time escalation workflows implemented.
    User feedback loop integrated.

Phase 4: System Optimization and Finalization

Objective: Ensure the system performs efficiently with guardrails and other core functionalities.
Tasks:

    Guardrails Optimization:
        Optimize rule-based and AI-driven detection for:
            Speed in real-time workflows.
            Accuracy in flagging content.
        Implement periodic re-training of AI models.

    Integration Testing:
        Test guardrails integration with CrewAI workflows and agent interactions.
        Simulate scenarios with flagged content to validate escalation mechanisms.

    Performance Tuning:
        Benchmark the impact of guardrails on:
            Workflow processing times.
            System resource utilization.

Deliverables:

    Optimized guardrails integrated across workflows.
    Fully tested system ready for deployment.

Phase 5: Deployment and Feedback

Objective: Deploy the system with guardrails and gather user feedback for refinement.
Tasks:

    Deployment:
        Finalize Docker configurations for multi-container deployment.
        Ensure guardrails functionality is integrated in production workflows.

    Feedback Collection:
        Gather feedback on flagged interactions from:
            Property owners.
            Service providers.
        Refine guardrails detection rules and workflows based on feedback.

    Iterative Improvements:
        Use feedback to:
            Adjust detection thresholds and escalation paths.
            Improve user notifications and feedback mechanisms.

Deliverables:

    Guardrails-enabled MVP deployed.
    Feedback collected and analyzed for iterative improvements.

Revised Workflow Overview with Guardrails

    Client Interaction:
        Guardrails validate client input before passing it to agents.
        Flagged input triggers escalation to Hestami AI Staff.

    Agent Communication:
        Guardrails review agent-generated responses for compliance.
        Flagged responses are logged and escalated for review.

    Provider Outreach:
        Guardrails ensure all messages to providers adhere to professional standards.
        Flagged provider responses are logged and reviewed.