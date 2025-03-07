Core Concepts
Planning

Learn how to add planning to your CrewAI Crew and improve their performance.
​
Introduction

The planning feature in CrewAI allows you to add planning capability to your crew. When enabled, before each Crew iteration, all Crew information is sent to an AgentPlanner that will plan the tasks step by step, and this plan will be added to each task description.
​
Using the Planning Feature

Getting started with the planning feature is very easy, the only step required is to add planning=True to your Crew:

from crewai import Crew, Agent, Task, Process

# Assemble your crew with planning capabilities
my_crew = Crew(
    agents=self.agents,
    tasks=self.tasks,
    process=Process.sequential,
    planning=True,
)

From this point on, your crew will have planning enabled, and the tasks will be planned before each iteration.
​
Planning LLM

Now you can define the LLM that will be used to plan the tasks. You can use any ChatOpenAI LLM model available.

When running the base case example, you will see something like the output below, which represents the output of the AgentPlanner responsible for creating the step-by-step logic to add to the Agents’ tasks.

from crewai import Crew, Agent, Task, Process
from langchain_openai import ChatOpenAI

# Assemble your crew with planning capabilities and custom LLM
my_crew = Crew(
    agents=self.agents,
    tasks=self.tasks,
    process=Process.sequential,
    planning=True,
    planning_llm=ChatOpenAI(model="gpt-4o")
)

# Run the crew
my_crew.kickoff()
