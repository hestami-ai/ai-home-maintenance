#!/usr/bin/env python
import json
from pathlib import Path

from pydantic import BaseModel
from crewai.flow.flow import Flow, listen, start

from .crews.service_request_crew.models import ServiceRequest, ServiceRequestOutput
from .crews.service_request_crew.service_request_crew import ServiceRequestCrew


class ServiceRequestState(BaseModel):
    service_request: ServiceRequest = None
    output: ServiceRequestOutput = None


class ServiceRequestFlow(Flow[ServiceRequestState]):

    @start()
    def load_service_request(self):
        """Load the service request from the input file"""
        print("Loading service request")
        input_file = Path("service_request_input.json")
        if not input_file.exists():
            raise FileNotFoundError("Service request input file not found")
        
        with open(input_file) as f:
            data = json.load(f)
            self.state.service_request = ServiceRequest(**data)

    @listen(load_service_request)
    def process_service_request(self):
        """Process the service request using the crew"""
        print("Processing service request")
        crew = ServiceRequestCrew(self.state.service_request)
        result = crew.process()
        
        # Parse the crew output into our structured format
        self.state.output = ServiceRequestOutput.model_validate_json(result.raw)

    @listen(process_service_request)
    def save_output(self):
        """Save the processed output"""
        print("Saving output")
        output_file = Path("service_request_output.json")
        with open(output_file, "w") as f:
            f.write(self.state.output.model_dump_json(indent=2))


def kickoff():
    flow = ServiceRequestFlow()
    flow.kickoff()


def plot():
    flow = ServiceRequestFlow()
    flow.plot()


if __name__ == "__main__":
    kickoff()
