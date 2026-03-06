# MCP and Delegation

The JanumiCode system includes a powerful and flexible delegation mechanism called the **Multi-Copilot Provider (MCP)**. This system allows the primary `Executor` agent to delegate specific tasks to external, specialized sub-agents. These sub-agents can be other LLMs, tools, or services that have expertise in a particular domain.

This architecture allows the core JanumiCode workflow to remain generic while still being able to leverage specialized knowledge when needed.

## The Mobile Specialist

JanumiCode comes with one out-of-the-box specialist: a **Mobile Specialist** for iOS and Android development. When this specialist is enabled, the `Executor` gains access to a new tool called `query_mobile_specialist`. If the `Executor` determines that a user's goal requires platform-specific mobile knowledge (e.g., writing Swift code, configuring Gradle), it can use this tool to delegate that part of the task to the Mobile Specialist.

## The Delegation Workflow

The process of delegating a task to the Mobile Specialist is a multi-step workflow orchestrated by JanumiCode:

1.  **Goal Detection**: When a new task starts, the `Orchestrator` uses a `Goal Detector` to analyze the user's goal for keywords related to mobile development (e.g., `iOS`, `Swift`, `Kotlin`, `React Native`).

2.  **MCP Configuration**: If the goal is identified as mobile-related and the MCP is enabled in the settings, the `Orchestrator` dynamically creates a temporary JSON configuration file.

3.  **Prompt Injection**: The `Orchestrator` modifies the `Executor`'s system prompt, "injecting" the `query_mobile_specialist` tool into its available toolset and explaining when to use it.

4.  **CLI Invocation**: JanumiCode's `RoleCLIProvider` (e.g., the `ClaudeCodeCLIProvider`) is invoked. The path to the temporary MCP configuration file is passed as a command-line flag to the underlying external tool (e.g., `claude-code --mcp-config /path/to/temp/mcp-config.json`).

5.  **Tool Use**: The external CLI tool reads the MCP config file. Now, when the `Executor` LLM decides to use the `query_mobile_specialist` tool, the CLI tool knows how to start the specialist's sub-process (a Node.js server in this case) and route the query to it.

## The MCP Configuration File

The temporary JSON file is the key to the system's flexibility. It tells the external CLI tool how to manage the specialist sub-agents. The file contains an `mcpServers` object, which maps a specialist's name to its server definition.

A simplified example for the `mobile-specialist` looks like this:

```json
{
  "mcpServers": {
    "mobile-specialist": {
      "command": "node",
      "args": ["/path/to/mobile-specialist-server/index.js"],
      "env": {
        "MOBILE_SPECIALIST_BASE_URL": "https://api.specialist.com",
        "MOBILE_SPECIALIST_API_KEY": "...",
        "MOBILE_SPECIALIST_MODEL": "special-mobile-model-v1"
      }
    }
  }
}
```

This tells the CLI tool that to use the `mobile-specialist`, it needs to execute a `node` process, passing it the path to the server's entry point and setting the necessary environment variables for API authentication.

## Extensibility

This architecture is highly extensible. By creating a new server definition and a new goal detector, JanumiCode could be extended to support any number of other specialists in the future, such as:

*   A database specialist for writing complex SQL queries.
*   A cloud infrastructure specialist for generating Terraform or CloudFormation templates.
*   A security specialist for analyzing code for vulnerabilities.
