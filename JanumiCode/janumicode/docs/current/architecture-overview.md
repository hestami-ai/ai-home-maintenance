# JanumiCode Architecture Overview

JanumiCode is a VS Code extension designed to facilitate "spec-driven development" through a sophisticated multi-agent AI system. It assists developers by automating parts of the coding process based on specifications, ensuring that the generated code aligns with the given requirements.

The architecture is built around a few key concepts:

*   **Governed Stream:** The primary user interface, a webview within VS Code, where developers interact with the AI agents.
*   **Multi-Agent System:** A team of specialized AI agents (roles) that collaborate to understand specifications, write code, and verify the output.
*   **Narrative Memory:** A persistent memory system that stores the history of interactions and decisions, allowing the system to learn and improve over time.
*   **Configurable LLM Providers:** The ability to use different Large Language Models (LLMs) from various providers for each agent role.
*   **Extensibility:** A "Multi-Copilot Provider" (MCP) mechanism to delegate tasks to external, specialized AI models.

## Core Components

The system is composed of several modules that work together:

*   **`extension.ts`**: The main entry point that initializes the extension, registers commands, and sets up the Governed Stream UI.
*   **UI (`src/lib/ui`)**: Manages the Governed Stream webview, handling communication between the user and the backend components.
*   **Dialogue (`src/lib/dialogue`)**: Manages the conversation flow and state.
*   **Workflow (`src/lib/workflow`)**: Orchestrates the overall process, coordinating the different agent roles to fulfill a user's request.
*   **Roles (`src/lib/roles`)**: Defines the specialized AI agents. The key roles include:
    *   **Executor**: The primary agent responsible for generating code or other outputs based on the user's request.
    *   **Technical Expert**: Provides technical guidance and information.
    *   **Verifier**: Checks the output of the Executor for correctness and quality.
    *   **Historian-Interpreter**: Manages the system's memory, retrieving relevant context from past interactions.
    *   **Evaluator**: Assesses the quality of the Executor's output before it is presented to the user.
*   **LLM (`src/lib/llm`)**: A generic interface for interacting with various LLM providers (e.g., Claude, OpenAI, Gemini).
*   **Config (`src/lib/config`)**: Manages the extension's settings, which are defined in `package.json` and configurable by the user.
*   **Database (`src/lib/database`)**: Implements the "Narrative Memory" using a SQLite database. It stores dialogue history, code artifacts, and other relevant data.
*   **Embedding (`src/lib/embedding`)**: Provides semantic search capabilities over the narrative memory using vector embeddings. It supports both cloud-based and local embedding models.
*   **MCP (`src/lib/mcp`)**: The Multi-Copilot Provider, which allows the system to delegate tasks to external, specialized models (e.g., a mobile development expert).
*   **Claude Code (`src/lib/claudeCode`)**: A specialized integration with a "Claude Code" model or service.

This modular architecture allows for flexibility and extensibility. Each component has a distinct responsibility, making the system easier to understand, maintain, and enhance.
