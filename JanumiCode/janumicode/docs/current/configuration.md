# JanumiCode Configuration Settings

The JanumiCode extension is highly configurable, allowing you to tailor its behavior to your specific needs, models, and infrastructure.

You can access these settings in VS Code by going to **File > Preferences > Settings** and searching for "JanumiCode".

## General Settings

### Token Budget
*   **`janumicode.tokenBudget`**
*   **Description**: The maximum number of tokens to be used for building the context for each AI agent invocation. A higher budget allows for more historical context but may increase cost and latency.
*   **Default**: `10000`

### Database Path
*   **`janumicode.databasePath`**
*   **Description**: The absolute path to the SQLite database file where JanumiCode stores all its data (dialogues, claims, verdicts, etc.). If left empty, a new database will be created in the default workspace location.
*   **Default**: `""`

### Log Level
*   **`janumicode.logLevel`**
*   **Description**: The verbosity of the logs in the "JanumiCode" output channel.
*   **Options**: `debug`, `info`, `warn`, `error`, `none`
*   **Default**: `"info"`

## LLM Provider Settings

JanumiCode's multi-agent system allows you to configure a different Large Language Model (LLM) provider and model for each of the primary roles. This allows you to use the best model for each task (e.g., a powerful model for the Executor, and a faster, cheaper model for the Evaluator).

For each role, you can set:
*   `...provider`: The LLM provider to use (`CLAUDE`, `OPENAI`, or `GEMINI`).
*   `...model`: The specific model name (e.g., `claude-sonnet-4`, `gpt-4`, `gemini-3.0-flash`).

### Executor Role
*   **`janumicode.llm.executor.provider`**: Default `"CLAUDE"`
*   **`janumicode.llm.executor.model`**: Default `"claude-sonnet-4"`

### Technical Expert Role
*   **`janumicode.llm.technicalExpert.provider`**: Default `"OPENAI"`
*   **`janumicode.llm.technicalExpert.model`**: Default `"gpt-5.2"`

### Verifier Role
*   **`janumicode.llm.verifier.provider`**: Default `"OPENAI"`
*   **`janumicode.llm.verifier.model`**: Default `"gemini-3.0-flash"`

### Historian-Interpreter Role
*   **`janumicode.llm.historianInterpreter.provider`**: Default `"GEMINI"`
*   **`janumicode.llm.historianInterpreter.model`**: Default `"gemini-3.0-flash"`

### Response Evaluator Role
*   **`janumicode.evaluator.provider`**: Default `"GEMINI"`
*   **`janumicode.evaluator.model`**: Default `"gemini-3-flash-preview"`

## Mobile Specialist (MCP) Settings

The Multi-Copilot Provider (MCP) system allows the `Executor` to delegate tasks to external, specialized models. This section configures a specialist for mobile development (iOS/Android).

### Enable Mobile Specialist
*   **`janumicode.mcp.mobileSpecialist.enabled`**
*   **Description**: If `true`, the Executor can delegate mobile-specific tasks to a specialized LLM.
*   **Default**: `false`

### Server Path
*   **`janumicode.mcp.mobileSpecialist.serverPath`**
*   **Description**: The absolute path to the entry point of the mobile-specialist MCP server (e.g., `/path/to/mcp-servers/mobile-specialist/dist/index.js`).
*   **Default**: `""`

### Base URL
*   **`janumicode.mcp.mobileSpecialist.baseUrl`**
*   **Description**: The base URL for the specialist LLM's API.
*   **Default**: `""`

### API Key
*   **`janumicode.mcp.mobileSpecialist.apiKey`**
*   **Description**: The API key for the specialist LLM service.
*   **Default**: `""`

### Model
*   **`janumicode.mcp.mobileSpecialist.model`**
*   **Description**: The model name for the specialist LLM.
*   **Default**: `"glm-4.6"`

## Embedding and Semantic Search Settings

These settings configure the vector embedding capabilities, which are used for semantic search across the project's history ("narrative memory").

### Enable Embeddings
*   **`janumicode.embedding.enabled`**
*   **Description**: If `true`, the system will generate and store vector embeddings for dialogue artifacts, enabling semantic search.
*   **Default**: `false`

### Embedding Provider
*   **`janumicode.embedding.provider`**
*   **Description**: The provider to use for generating embeddings. `voyage-api` uses the Voyage AI cloud API. `voyage-local` uses a local ONNX model via the `voyage-embed` CLI tool.
*   **Options**: `voyage-api`, `voyage-local`
*   **Default**: `"voyage-api"`

### Embedding Model
*   **`janumicode.embedding.model`**
*   **Description**: The name of the embedding model to use.
*   **Default**: `"voyage-4-lite"`

### Embedding Dimensions
*   **`janumicode.embedding.dimensions`**
*   **Description**: The number of dimensions for the vector embeddings (a "Matryoshka" model). Lower dimensions are faster and cheaper, while higher dimensions provide more accuracy.
*   **Options**: `256`, `512`, `1024`, `2048`
*   **Default**: `1024`

### Local CLI Path
*   **`janumicode.embedding.localCliPath`**
*   **Description**: If using the `voyage-local` provider, this is the path to the `voyage-embed` CLI tool.
*   **Default**: `"voyage-embed"` (assumes it is in the system's PATH).
