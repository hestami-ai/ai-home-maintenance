from django.urls import path
from . import views

app_name = 'ai_agents'

urlpatterns = [
    path(
        'service-request/update-status/',
        views.update_service_request_status,
        name='update_service_request_status'
    ),
    path(
        'service-request/add-clarification/',
        views.add_service_request_clarification,
        name='add_service_request_clarification'
    ),
    path(
        'service-request/add-provider/',
        views.add_service_provider,
        name='add_service_provider'
    ),
]