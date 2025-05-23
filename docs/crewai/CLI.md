Core Concepts
CLI

Learn how to use the CrewAI CLI to interact with CrewAI.
​
CrewAI CLI Documentation

The CrewAI CLI provides a set of commands to interact with CrewAI, allowing you to create, train, run, and manage crews & flows.
​
Installation

To use the CrewAI CLI, make sure you have CrewAI installed:

pip install crewai

​
Basic Usage

The basic structure of a CrewAI CLI command is:

crewai [COMMAND] [OPTIONS] [ARGUMENTS]

​
Available Commands
​
1. Create

Create a new crew or flow.

crewai create [OPTIONS] TYPE NAME

    TYPE: Choose between “crew” or “flow”
    NAME: Name of the crew or flow

Example:

crewai create crew my_new_crew
crewai create flow my_new_flow

​
2. Version

Show the installed version of CrewAI.

crewai version [OPTIONS]

    --tools: (Optional) Show the installed version of CrewAI tools

Example:

crewai version
crewai version --tools

​
3. Train

Train the crew for a specified number of iterations.

crewai train [OPTIONS]

    -n, --n_iterations INTEGER: Number of iterations to train the crew (default: 5)
    -f, --filename TEXT: Path to a custom file for training (default: “trained_agents_data.pkl”)

Example:

crewai train -n 10 -f my_training_data.pkl

​
4. Replay

Replay the crew execution from a specific task.

crewai replay [OPTIONS]

    -t, --task_id TEXT: Replay the crew from this task ID, including all subsequent tasks

Example:

crewai replay -t task_123456

​
5. Log-tasks-outputs

Retrieve your latest crew.kickoff() task outputs.

crewai log-tasks-outputs

​
6. Reset-memories

Reset the crew memories (long, short, entity, latest_crew_kickoff_outputs).

crewai reset-memories [OPTIONS]

    -l, --long: Reset LONG TERM memory
    -s, --short: Reset SHORT TERM memory
    -e, --entities: Reset ENTITIES memory
    -k, --kickoff-outputs: Reset LATEST KICKOFF TASK OUTPUTS
    -a, --all: Reset ALL memories

Example:

crewai reset-memories --long --short
crewai reset-memories --all

​
7. Test

Test the crew and evaluate the results.

crewai test [OPTIONS]

    -n, --n_iterations INTEGER: Number of iterations to test the crew (default: 3)
    -m, --model TEXT: LLM Model to run the tests on the Crew (default: “gpt-4o-mini”)

Example:

crewai test -n 5 -m gpt-3.5-turbo

​
8. Run

Run the crew.

crewai run

Make sure to run these commands from the directory where your CrewAI project is set up. Some commands may require additional configuration or setup within your project structure.
​
9. API Keys

When running crewai create crew command, the CLI will first show you the top 5 most common LLM providers and ask you to select one.

Once you’ve selected an LLM provider, you will be prompted for API keys.
​
Initial API key providers

The CLI will initially prompt for API keys for the following services:

    OpenAI
    Groq
    Anthropic
    Google Gemini

When you select a provider, the CLI will prompt you to enter your API key.
​
Other Options

If you select option 6, you will be able to select from a list of LiteLLM supported providers.

When you select a provider, the CLI will prompt you to enter the Key name and the API key.

See the following link for each provider’s key name:

    LiteLLM Providers
