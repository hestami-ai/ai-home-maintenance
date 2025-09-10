from django.shortcuts import render, get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from services.models.base_models import ServiceRequest, ServiceRequestClarification, ServiceProvider
from datetime import datetime

@api_view(['POST'])
@permission_classes([AllowAny])
def update_service_request_status(request):
    """Update service request status from AI agent"""
    try:
        service_request_id = request.data.get('service_request_id')
        new_status = request.data.get('status')
        details = request.data.get('details', {})

        if not service_request_id or not new_status:
            return Response(
                {'error': 'service_request_id and status are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        service_request.status = new_status
        service_request.last_updated = datetime.now()
        
        # Add any additional fields from details
        for key, value in details.items():
            if hasattr(service_request, key):
                setattr(service_request, key, value)
        
        service_request.save()

        return Response({'status': 'success'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def add_service_request_clarification(request):
    """Add clarification to service request from AI agent"""
    try:
        service_request_id = request.data.get('service_request_id')
        question = request.data.get('question')
        answer = request.data.get('answer')
        agent_id = request.data.get('agent_id')

        if not all([service_request_id, question]):
            return Response(
                {'error': 'service_request_id and question are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        
        clarification = ServiceRequestClarification.objects.create(
            service_request=service_request,
            question=question,
            answer=answer,
            agent_id=agent_id,
            timestamp=datetime.now()
        )

        return Response({
            'status': 'success',
            'clarification_id': clarification.id
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def add_service_provider(request):
    """Add potential service provider from AI agent"""
    try:
        service_request_id = request.data.get('service_request_id')
        provider_data = request.data.get('provider_data', {})

        if not service_request_id or not provider_data:
            return Response(
                {'error': 'service_request_id and provider_data are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        
        # Create or update service provider
        provider, created = ServiceProvider.objects.update_or_create(
            email=provider_data.get('email', ''),
            defaults={
                'name': provider_data.get('name', ''),
                'phone': provider_data.get('phone', ''),
                'website': provider_data.get('website', ''),
                'address': provider_data.get('address', ''),
                'description': provider_data.get('description', ''),
                'services_offered': provider_data.get('services_offered', []),
                'rating': provider_data.get('rating', 0.0),
                'last_updated': datetime.now()
            }
        )

        # Associate provider with service request if not already
        service_request.potential_providers.add(provider)

        return Response({
            'status': 'success',
            'provider_id': provider.id,
            'created': created
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
