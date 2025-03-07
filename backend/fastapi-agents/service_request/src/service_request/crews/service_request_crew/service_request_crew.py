from pathlib import Path
import yaml
from crewai import LLM, Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from .models import ServiceRequest, IntakeQuestion, IntakeDetails, ServiceProvider, ContactAttempt, ServiceRequestOutput
from ...tools.bing_search_tool import BingSearchTool

# Configure Ollama LLM
local_llm = LLM(
    #model="ollama/phi3:medium-128k",  # Include provider prefix
    model="hosted_vllm/Qwen/Qwen2.5-14B-Instruct-GPTQ-Int4",
    base_url="http://localhost:8000/v1/",
    config={
        "context_window": 128000,
        "max_tokens": 4096,
        "temperature": 0.3,  # Lower temperature for more focused outputs
        "response_format": {"type": "json_object"}  # Force JSON output
    }
)

@CrewBase
class ServiceRequestCrew:
    """Service Request Processing Crew"""

    def __init__(self, service_request: ServiceRequest):
        self.service_request = service_request
        self._load_configs()
        self.bing_search_tool = BingSearchTool()

    def _load_configs(self):
        """Load YAML configurations"""
        base_path = Path(__file__).parent
        
        with open(base_path / "config/agents.yaml", "r") as f:
            self.agents_config = yaml.safe_load(f)
            
        with open(base_path / "config/tasks.yaml", "r") as f:
            self.tasks_config = yaml.safe_load(f)

    def _load_task_config(self, task_name):
        return self.tasks_config[task_name]

    @agent
    def client_liaison(self) -> Agent:
        return Agent(
            config=self.agents_config["client_liaison"],
            llm=local_llm,
            verbose=True
        )

    @agent
    def research_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["research_specialist"],
            llm=local_llm,
            verbose=True
        )

    @agent
    def business_contact(self) -> Agent:
        return Agent(
            config=self.agents_config["business_contact"],
            llm=local_llm,
            verbose=True
        )

    @task
    def determine_service_questions(self) -> Task:
        """Create a task to determine questions for gathering service request details."""
        config = self._load_task_config("determine_service_questions")

        return Task(config=config)

    @task
    def gather_service_details(self) -> Task:
        """Create a task to gather detailed information about the maintenance needs."""
        config = self._load_task_config("gather_service_details")

        return Task(config=config)

    @task
    def search_providers(self) -> Task:
        """Create a task to search for qualified service providers."""
        config = self._load_task_config("search_providers")
        
        # Add the Bing Search Tool to the task
        config["tools"] = [self.bing_search_tool]
        
        # Add ServiceProvider model schema to the config
        config["service_provider_schema"] = ServiceProvider.model_json_schema()
        
        # Add dependency on gather_service_details task
        config["context"] = ["gather_service_details"]
        
        return Task(config=config)

    @task
    def contact_providers(self) -> Task:
        """Create a task to contact identified service providers."""
        config = self._load_task_config("contact_providers")

        return Task(config=config)

    @crew
    def crew(self) -> Crew:
        """Creates the Service Request Processing Crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            output_pydantic=ServiceRequestOutput
        )

    def process(self) -> ServiceRequestOutput:
        """Process the service request and return structured output"""
        crew_result = self.crew().kickoff(inputs={
            "service_request": self.service_request,
            "intake_questions_schema": IntakeQuestion.model_json_schema(),
        })

        # Structure the output according to ServiceRequestOutput model
        return ServiceRequestOutput(
            service_request=self.service_request,
            intake_details=crew_result["gather_service_details"],
            providers=[crew_result["search_providers"]],
            contact_attempts=[crew_result["contact_providers"]]
        )
