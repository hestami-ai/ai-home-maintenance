from typing import Dict, List, Optional
from pydantic import BaseModel


class ServiceRequest(BaseModel):
    """Input model for service requests"""
    location: str
    service_type: str
    description: str
    client_criteria: Optional[List[str]] = None


class ServiceProvider(BaseModel):
    """Model for service provider information"""
    name: str
    contact_info: str
    services: List[str]
    notes: str


class IntakeQuestion(BaseModel):
    """Model for intake questions"""
    question: str
    context: str  # Why this question is important
    required: bool = True


class IntakeDetails(BaseModel):
    """Model for service request intake details"""
    questions: List[IntakeQuestion]
    answers: Dict[str, str]
    additional_notes: Optional[str] = None


class ContactAttempt(BaseModel):
    """Model for provider contact attempts"""
    provider_name: str
    timestamp: str
    method: str  # email, phone, etc.
    outcome: str
    notes: Optional[str] = None


class ServiceRequestOutput(BaseModel):
    """Output model for processed service requests"""
    service_request: ServiceRequest
    intake_details: IntakeDetails
    providers: List[ServiceProvider]
    contact_attempts: List[ContactAttempt]
