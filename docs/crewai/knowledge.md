Core Concepts
Knowledge

What is knowledge in CrewAI and how to use it.
​
Using Knowledge in CrewAI
​
What is Knowledge?

Knowledge in CrewAI is a powerful system that allows AI agents to access and utilize external information sources during their tasks. Think of it as giving your agents a reference library they can consult while working.

Key benefits of using Knowledge:

    Enhance agents with domain-specific information
    Support decisions with real-world data
    Maintain context across conversations
    Ground responses in factual information

​
Supported Knowledge Sources

CrewAI supports various types of knowledge sources out of the box:
Text Sources

    Raw strings
    Text files (.txt)
    PDF documents

Structured Data

    CSV files
    Excel spreadsheets
    JSON documents

​
Quick Start

Here’s an example using string-based knowledge:
Code

from crewai import Agent, Task, Crew, Process, LLM
from crewai.knowledge.source.string_knowledge_source import StringKnowledgeSource

# Create a knowledge source
content = "Users name is John. He is 30 years old and lives in San Francisco."
string_source = StringKnowledgeSource(
    content=content,
)

# Create an LLM with a temperature of 0 to ensure deterministic outputs
llm = LLM(model="gpt-4o-mini", temperature=0)

# Create an agent with the knowledge store
agent = Agent(
    role="About User",
    goal="You know everything about the user.",
    backstory="""You are a master at understanding people and their preferences.""",
    verbose=True,
    allow_delegation=False,
    llm=llm,
)
task = Task(
    description="Answer the following questions about the user: {question}",
    expected_output="An answer to the question.",
    agent=agent,
)

crew = Crew(
    agents=[agent],
    tasks=[task],
    verbose=True,
    process=Process.sequential,
    knowledge_sources=[string_source], # Enable knowledge by adding the sources here. You can also add more sources to the sources list.
)

result = crew.kickoff(inputs={"question": "What city does John live in and how old is he?"})

​
Knowledge Configuration
​
Chunking Configuration

Control how content is split for processing by setting the chunk size and overlap.
Code

knowledge_source = StringKnowledgeSource(
    content="Long content...",
    chunk_size=4000,     # Characters per chunk (default)
    chunk_overlap=200    # Overlap between chunks (default)
)

​
Embedder Configuration

You can also configure the embedder for the knowledge store. This is useful if you want to use a different embedder for the knowledge store than the one used for the agents.
Code

...
string_source = StringKnowledgeSource(
    content="Users name is John. He is 30 years old and lives in San Francisco.",
)
crew = Crew(
    ...
    knowledge_sources=[string_source],
    embedder={
        "provider": "openai",
        "config": {"model": "text-embedding-3-small"},
    },
)

​
Clearing Knowledge

If you need to clear the knowledge stored in CrewAI, you can use the crewai reset-memories command with the --knowledge option.
Command

crewai reset-memories --knowledge

This is useful when you’ve updated your knowledge sources and want to ensure that the agents are using the most recent information.
​
Custom Knowledge Sources

CrewAI allows you to create custom knowledge sources for any type of data by extending the BaseKnowledgeSource class. Let’s create a practical example that fetches and processes space news articles.
​
Space News Knowledge Source Example

from crewai import Agent, Task, Crew, Process, LLM
from crewai.knowledge.source.base_knowledge_source import BaseKnowledgeSource
import requests
from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel, Field

class SpaceNewsKnowledgeSource(BaseKnowledgeSource):
    """Knowledge source that fetches data from Space News API."""

    api_endpoint: str = Field(description="API endpoint URL")
    limit: int = Field(default=10, description="Number of articles to fetch")

    def load_content(self) -> Dict[Any, str]:
        """Fetch and format space news articles."""
        try:
            response = requests.get(
                f"{self.api_endpoint}?limit={self.limit}"
            )
            response.raise_for_status()

            data = response.json()
            articles = data.get('results', [])

            formatted_data = self._format_articles(articles)
            return {self.api_endpoint: formatted_data}
        except Exception as e:
            raise ValueError(f"Failed to fetch space news: {str(e)}")

    def _format_articles(self, articles: list) -> str:
        """Format articles into readable text."""
        formatted = "Space News Articles:\n\n"
        for article in articles:
            formatted += f"""
                Title: {article['title']}
                Published: {article['published_at']}
                Summary: {article['summary']}
                News Site: {article['news_site']}
                URL: {article['url']}
                -------------------"""
        return formatted

    def add(self) -> None:
        """Process and store the articles."""
        content = self.load_content()
        for _, text in content.items():
            chunks = self._chunk_text(text)
            self.chunks.extend(chunks)

        self._save_documents()

# Create knowledge source
recent_news = SpaceNewsKnowledgeSource(
    api_endpoint="https://api.spaceflightnewsapi.net/v4/articles",
    limit=10,
)

# Create specialized agent
space_analyst = Agent(
    role="Space News Analyst",
    goal="Answer questions about space news accurately and comprehensively",
    backstory="""You are a space industry analyst with expertise in space exploration,
    satellite technology, and space industry trends. You excel at answering questions
    about space news and providing detailed, accurate information.""",
    knowledge_sources=[recent_news],
    llm=LLM(model="gpt-4", temperature=0.0)
)

# Create task that handles user questions
analysis_task = Task(
    description="Answer this question about space news: {user_question}",
    expected_output="A detailed answer based on the recent space news articles",
    agent=space_analyst
)

# Create and run the crew
crew = Crew(
    agents=[space_analyst],
    tasks=[analysis_task],
    verbose=True,
    process=Process.sequential
)

# Example usage
result = crew.kickoff(
    inputs={"user_question": "What are the latest developments in space exploration?"}
)

​
Key Components Explained

    Custom Knowledge Source (SpaceNewsKnowledgeSource):
        Extends BaseKnowledgeSource for integration with CrewAI
        Configurable API endpoint and article limit
        Implements three key methods:
            load_content(): Fetches articles from the API
            _format_articles(): Structures the articles into readable text
            add(): Processes and stores the content

    Agent Configuration:
        Specialized role as a Space News Analyst
        Uses the knowledge source to access space news

    Task Setup:
        Takes a user question as input through {user_question}
        Designed to provide detailed answers based on the knowledge source

    Crew Orchestration:
        Manages the workflow between agent and task
        Handles input/output through the kickoff method

This example demonstrates how to:

    Create a custom knowledge source that fetches real-time data
    Process and format external data for AI consumption
    Use the knowledge source to answer specific user questions
    Integrate everything seamlessly with CrewAI’s agent system

​
About the Spaceflight News API

The example uses the Spaceflight News API, which:

    Provides free access to space-related news articles
    Requires no authentication
    Returns structured data about space news
    Supports pagination and filtering

You can customize the API query by modifying the endpoint URL:

# Fetch more articles
recent_news = SpaceNewsKnowledgeSource(
    api_endpoint="https://api.spaceflightnewsapi.net/v4/articles",
    limit=20,  # Increase the number of articles
)

# Add search parameters
recent_news = SpaceNewsKnowledgeSource(
    api_endpoint="https://api.spaceflightnewsapi.net/v4/articles?search=NASA", # Search for NASA news
    limit=10,
)

​
Best Practices
