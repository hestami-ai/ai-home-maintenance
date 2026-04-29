# **Provider Configuration**

Relevant source files

* [crates/goose/examples/image\_tool.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/examples/image_tool.rs)  
*   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs)  
*   
* [crates/goose/src/config/declarative\_providers.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/declarative_providers.rs)  
*   
* [crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs)  
*   
* [crates/goose/src/providers/anthropic.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs)  
*   
* [crates/goose/src/providers/azure.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/azure.rs)  
*   
* [crates/goose/src/providers/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/base.rs)  
*   
* [crates/goose/src/providers/bedrock.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/bedrock.rs)  
*   
* [crates/goose/src/providers/chatgpt\_codex.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/chatgpt_codex.rs)  
*   
* [crates/goose/src/providers/claude\_code.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs)  
*   
* [crates/goose/src/providers/codex.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/codex.rs)  
*   
* [crates/goose/src/providers/cursor\_agent.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/cursor_agent.rs)  
*   
* [crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs)  
*   
* [crates/goose/src/providers/declarative/kimi.json](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/declarative/kimi.json)  
*   
* [crates/goose/src/providers/declarative/lmstudio.json](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/declarative/lmstudio.json)  
*   
* [crates/goose/src/providers/declarative/moonshot.json](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/declarative/moonshot.json)  
*   
* [crates/goose/src/providers/declarative/tanzu.json](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/declarative/tanzu.json)  
*   
* [crates/goose/src/providers/errors.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/errors.rs)  
*   
* [crates/goose/src/providers/gemini\_cli.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/gemini_cli.rs)  
*   
* [crates/goose/src/providers/githubcopilot.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/githubcopilot.rs)  
*   
* [crates/goose/src/providers/google.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/google.rs)  
*   
* [crates/goose/src/providers/init.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/init.rs)  
*   
* [crates/goose/src/providers/litellm.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/litellm.rs)  
*   
* [crates/goose/src/providers/mod.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/mod.rs)  
*   
* [crates/goose/src/providers/ollama.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs)  
*   
* [crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs)  
*   
* [crates/goose/src/providers/openai\_compatible.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai_compatible.rs)  
*   
* [crates/goose/src/providers/openrouter.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openrouter.rs)  
*   
* [crates/goose/src/providers/provider\_registry.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/provider_registry.rs)  
*   
* [crates/goose/src/providers/retry.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/retry.rs)  
*   
* [crates/goose/src/providers/sagemaker\_tgi.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/sagemaker_tgi.rs)  
*   
* [crates/goose/src/providers/snowflake.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/snowflake.rs)  
*   
* [crates/goose/src/providers/tetrate.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/tetrate.rs)  
*   
* [crates/goose/src/providers/utils.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/utils.rs)  
*   
* [crates/goose/src/providers/venice.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/venice.rs)  
*   
* [crates/goose/src/providers/xai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/xai.rs)  
*   
* [crates/goose/tests/compaction.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/tests/compaction.rs)  
*   
* [crates/goose/tests/providers.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/tests/providers.rs)  
*   
* [documentation/docs/guides/tanzu-ai-services.md](https://github.com/block/goose/blob/e94f3047/documentation/docs/guides/tanzu-ai-services.md?plain=1)  
*   
* [documentation/docs/guides/tanzu-cli-testing-guide.md](https://github.com/block/goose/blob/e94f3047/documentation/docs/guides/tanzu-cli-testing-guide.md?plain=1)  
*   
* [scripts/build-windows.ps1](https://github.com/block/goose/blob/e94f3047/scripts/build-windows.ps1)  
* 

This page explains how to configure LLM providers in Goose, including authentication methods, configuration sources, and provider-specific settings. Providers give Goose access to AI models that power its capabilities.

Scope: This page covers technical aspects of provider configuration including API keys, environment variables, custom providers, and authentication flows. For initial setup instructions, see 

[Quick Start](https://github.com/block/goose/blob/e94f3047/Quick%20Start)

 For OAuth-specific Desktop flows, see 

[Desktop Application Setup](https://github.com/block/goose/blob/e94f3047/Desktop%20Application%20Setup)

## **Provider System Architecture**

Goose uses a trait-based provider abstraction that supports multiple LLM services through a unified interface. Each provider implements the Provider trait 

[crates/goose/src/providers/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/base.rs#L187-L210)

[187-210](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/base.rs#L187-L210)

 and handles its own authentication, request formatting, and response parsing.

Provider Trait Implementations

Sources: 

[crates/goose/src/providers/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/base.rs#L187-L210)

[187-210](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/base.rs#L187-L210)

 

[crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L58-L70)

[58-70](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L58-L70)

 

[crates/goose/src/providers/anthropic.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L52-L59)

[52-59](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L52-L59)

 

[crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L121-L135)

[121-135](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L121-L135)

 

[crates/goose/src/providers/api\_client.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/api_client.rs#L1-L15)

[1-15](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/api_client.rs#L1-L15)

## **Configuration Sources**

Provider configuration is loaded from multiple sources with a defined priority hierarchy. Settings from higher-priority sources override those from lower-priority sources.

Configuration Priority Hierarchy

Sources: 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L77-L129)

[77-129](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L77-L129)

 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L139-L173)

[139-173](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L139-L173)

### Environment Variables

Each provider's from\_env() method reads environment variables via Config::global() 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L137-L138)

[137-138](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L137-L138)

 Variables are checked in order: environment (exact key match), then configuration file 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)

[87-89](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)

Provider Environment Variables:

| Provider | Required Variables | Optional Variables |
| ----- | ----- | ----- |
| OpenAI | OPENAI\_API\_KEY | OPENAI\_HOST, OPENAI\_ORGANIZATION, OPENAI\_PROJECT, OPENAI\_TIMEOUT  [crates/goose/src/providers/openai.rs 77-95](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L77-L95) |
| Anthropic | ANTHROPIC\_API\_KEY | ANTHROPIC\_HOST  [crates/goose/src/providers/anthropic.rs 66-69](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L66-L69) |
| Google Gemini | GOOGLE\_API\_KEY | — |
| Databricks | DATABRICKS\_HOST | DATABRICKS\_TOKEN (falls back to OAuth), DATABRICKS\_MAX\_RETRIES  [crates/goose/src/providers/databricks.rs 145-165](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L145-L165) |
| OpenRouter | OPENROUTER\_API\_KEY | OPENROUTER\_HOST  [crates/goose/src/providers/openrouter.rs 53-56](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openrouter.rs#L53-L56) |
| Ollama | — | OLLAMA\_HOST, OLLAMA\_TIMEOUT  [crates/goose/src/providers/ollama.rs 100-105](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L100-L105) |
| Snowflake | SNOWFLAKE\_HOST, SNOWFLAKE\_TOKEN | — |

Sources: 

[crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L77-L95)

[77-95](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L77-L95)

 

[crates/goose/src/providers/anthropic.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L66-L69)

[66-69](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L66-L69)

 

[crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L145-L165)

[145-165](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L145-L165)

 

[crates/goose/src/providers/ollama.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L100-L105)

[100-105](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L100-L105)

### Configuration File (config.yaml)

The config.yaml file is named by the constant CONFIG\_YAML\_NAME 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L39-L39)

[39](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L39-L39)

 and its path is determined by Paths::config\_dir().

* Precedence: Environment variables override values in the configuration file   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)  
* [87-89](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)  
*   
* Snake Case: The system recommends snake\_case for keys in the YAML, which are converted to UPPERCASE when checking environment variables   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L118-L120)  
* [118-120](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L118-L120)  
* 

Sources: 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L39-L39)

[39](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L39-L39)

 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)

[87-89](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L87-L89)

 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L118-L120)

[118-120](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L118-L120)

### Keychain Storage

Secrets (like API keys) are stored using the system keyring by default, unless GOOSE\_DISABLE\_KEYRING is set 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L155-L165)

[155-165](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L155-L165)

* Service: "goose"   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L37-L37)  
* [37](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L37-L37)  
*   
* Username: "secrets"   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L38-L38)  
* [38](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L38-L38)  
*   
* Fallback: If the keyring is disabled, secrets are stored in a secrets.yaml file with 0o600 permissions on Unix   
* [crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L17-L29)  
* [17-29](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L17-L29)  
* 

Sources: 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L17-L38)

[17-38](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L17-L38)

 

[crates/goose/src/config/base.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L155-L165)

[155-165](https://github.com/block/goose/blob/e94f3047/crates/goose/src/config/base.rs#L155-L165)

## **Model Configuration**

ModelConfig 

[crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L48-L62)

[48-62](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L48-L62)

 is the central structure for LLM parameters.

Key Parameters and Resolution:

| Parameter | Code Entity | Source / Default |
| ----- | ----- | ----- |
| Context Limit | context\_limit | GOOSE\_CONTEXT\_LIMIT or DEFAULT\_CONTEXT\_LIMIT (128k)  [crates/goose/src/model.rs 8-10](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L8-L10)   [crates/goose/src/model.rs 91-110](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L91-L110) |
| Temperature | temperature | GOOSE\_TEMPERATURE  [crates/goose/src/model.rs 178-196](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L178-L196) |
| Max Tokens | max\_tokens | GOOSE\_MAX\_TOKENS  [crates/goose/src/model.rs 198-210](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L198-L210) |
| Tool Shim | toolshim | GOOSE\_TOOLSHIM (bool)  [crates/goose/src/model.rs 212-219](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L212-L219) |

Sources: 

[crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L8-L10)

[8-10](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L8-L10)

 

[crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L48-L62)

[48-62](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L48-L62)

 

[crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L91-L219)

[91-219](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L91-L219)

### Canonical Model Registry

Goose maintains a registry of "known" models to automatically apply correct context limits and capabilities.

* Resolution: with\_canonical\_limits   
* [crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L134-L156)  
* [134-156](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L134-L156)  
*  checks the maybe\_get\_canonical\_model registry.  
* Provider Mapping: Each provider defines KNOWN\_MODELS (e.g., OPEN\_AI\_KNOWN\_MODELS   
* [crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L40-L53)  
* [40-53](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L40-L53)  
* ) to provide metadata like context windows.

Sources: 

[crates/goose/src/model.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L134-L156)

[134-156](https://github.com/block/goose/blob/e94f3047/crates/goose/src/model.rs#L134-L156)

 

[crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L40-L53)

[40-53](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L40-L53)

 

[crates/goose/src/providers/anthropic.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L30-L46)

[30-46](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/anthropic.rs#L30-L46)

## **Authentication Mechanisms**

Goose supports several complex authentication flows beyond simple API keys.

### OAuth and Token Refresh

Some providers, like Databricks, support both static tokens and OAuth flows.

* Databricks OAuth: Uses DatabricksAuthProvider   
* [crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L83-L86)  
* [83-86](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L83-L86)  
*  which calls oauth::get\_oauth\_token\_async   
* [crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L109-L114)  
* [109-114](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L109-L114)  
*   
* Token Caching: The token\_cache (an Arc\<Mutex\<Option\<String\>\>\>)   
* [crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L134-L134)  
* [134](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L134-L134)  
*  ensures that OAuth tokens are reused across requests.

Sources: 

[crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L83-L118)

[83-118](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L83-L118)

 

[crates/goose/src/providers/databricks.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L134-L134)

[134](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/databricks.rs#L134-L134)

### CLI-based Providers

Providers like claude-code interact with an external CLI process rather than a direct HTTP API.

* Process Management: CliProcess   
* [crates/goose/src/providers/claude\_code.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L150-L160)  
* [150-160](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L150-L160)  
*  manages the lifecycle of the subprocess.  
* JSON-RPC: Communication happens over stdin/stdout using send\_control\_request   
* [crates/goose/src/providers/claude\_code.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L178-L184)  
* [178-184](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L178-L184)  
* 

Sources: 

[crates/goose/src/providers/claude\_code.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L150-L184)

[150-184](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/claude_code.rs#L150-L184)

## **Custom Providers (Declarative)**

Users can define custom providers using JSON files in the custom\_providers/ directory. These are parsed into DeclarativeProviderConfig.

Resolution Flow:

* OpenAI Compatible: The from\_custom\_config implementation for OpenAI   
* [crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L152-L190)  
* [152-190](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L152-L190)  
*  allows pointing to any OpenAI-compatible endpoint (like LM Studio or LocalAI).  
* Ollama Specifics: Ollama's from\_custom\_config   
* [crates/goose/src/providers/ollama.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L137-L183)  
* [137-183](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L137-L183)  
*  handles specific port defaults (11434) and ensures streaming is enabled.

Sources: 

[crates/goose/src/providers/openai.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L152-L190)

[152-190](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/openai.rs#L152-L190)

 

[crates/goose/src/providers/ollama.rs](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L137-L183)

[137-183](https://github.com/block/goose/blob/e94f3047/crates/goose/src/providers/ollama.rs#L137-L183)

