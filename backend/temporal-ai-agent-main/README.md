# Temporal AI Agent

This demo shows a multi-turn conversation with an AI agent running inside a Temporal workflow. The goal is to collect information towards a goal. There's a simple DSL input for collecting information (currently set up to use mock functions to search for events, book flights around those events then create an invoice for those flights). The AI will respond with clarifications and ask for any missing information to that goal. It uses ChatGPT 4o but can be made to use a local LLM via [Ollama](https://ollama.com) (see the deprecated section below).

[Watch the demo (5 minute YouTube video)](https://www.youtube.com/watch?v=GEXllEH2XiQ)

[![Watch the demo](./agent-youtube-screenshot.jpeg)](https://www.youtube.com/watch?v=GEXllEH2XiQ)

## Configuration

This application uses `.env` files for configuration. Copy the [.env.example](.env.example) file to `.env` and update the values:

```bash
cp .env.example .env
```

The agent requires an OpenAI key for the gpt-4o model. Set this in the `OPENAI_API_KEY` environment variable in .env

#### Using a local LLM instead of ChatGPT 4o
* Install [Ollama](https://ollama.com) and the [Qwen2.5 14B](https://ollama.com/library/qwen2.5) model (`ollama run qwen2.5:14b`). (note this model is about 9GB to download).
  * Local LLM is disabled as ChatGPT 4o was better for this use case. To use Ollama, examine `./activities/tool_activities.py` and rename the functions.

## Agent Tools
* Requires a Rapidapi key for sky-scrapper (how we find flights). Set this in the `RAPIDAPI_KEY` environment variable in .env
    * It's free to sign up and get a key at [RapidAPI](https://rapidapi.com/apiheya/api/sky-scrapper)
    * If you're lazy go to `tools/search_flights.py` and replace the `get_flights` function with the mock `search_flights_example` that exists in the same file.
* Requires a Stripe key for the `create_invoice` tool. Set this in the `STRIPE_API_KEY` environment variable in .env
    * It's free to sign up and get a key at [Stripe](https://stripe.com/)
    * If you're lazy go to `tools/create_invoice.py` and replace the `create_invoice` function with the mock `create_invoice_example` that exists in the same file.

## Configuring Temporal Connection

By default, this application will connect to a local Temporal server (`localhost:7233`) in the default namespace, using the `agent-task-queue` task queue. You can override these settings in your `.env` file.

### Use Temporal Cloud

See [.env.example](.env.example) for details on connecting to Temporal Cloud using mTLS or API key authentication.

[Sign up for Temporal Cloud](https://temporal.io/get-cloud)

### Use a local Temporal Dev Server

On a Mac
```bash
brew install temporal
temporal server start-dev
```
See the [Temporal documentation](https://learn.temporal.io/getting_started/python/dev_environment/) for other platforms.


## Running the Application

### Python Backend

Requires [Poetry](https://python-poetry.org/) to manage dependencies.

1. `python -m venv venv`

2. `source venv/bin/activate`

3. `poetry install`

Run the following commands in separate terminal windows:

1. Start the Temporal worker:
```bash
poetry run python scripts/run_worker.py
```

2. Start the API server:
```bash
poetry run uvicorn api.main:app --reload
```
Access the API at `/docs` to see the available endpoints.

### React UI
Start the frontend:
```bash
cd frontend
npm install
npx vite
```
Access the UI at `http://localhost:5173`

## Customizing the Agent
- `tool_registry.py` contains the mapping of tool names to tool definitions (so the AI understands how to use them)
- `goal_registry.py` contains descriptions of goals and the tools used to achieve them
- The tools themselves are defined in their own files in `/tools`
- Note the mapping in `tools/__init__.py` to each tool
- See main.py where some tool-specific logic is defined (todo, move this to the tool definition)

## TODO
- I should prove this out with other tool definitions outside of the event/flight search case (take advantage of my nice DSL).
- Currently hardcoded to the Temporal dev server at localhost:7233. Need to support options incl Temporal Cloud.
