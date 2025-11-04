"""
Provider Outreach Views (Phase 2)
Handles CRUD operations for tracking provider outreach during bidding phase.
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404

from services.models import ProviderOutreach, ServiceRequest, ServiceProvider
from services.serializers.base_serializers import ProviderOutreachSerializer
from services.permissions import IsHestamaiStaff
from users.authentication import ServiceTokenAuthentication

logger = logging.getLogger('services')


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def list_create_outreach(request, request_id):
    """
    GET: List all provider outreach records for a service request
    POST: Create a new provider outreach record
    """
    service_request = get_object_or_404(ServiceRequest, id=request_id)
    
    if request.method == 'GET':
        try:
            outreach_records = ProviderOutreach.objects.filter(
                service_request=service_request
            ).select_related('provider', 'contacted_by')
            
            serializer = ProviderOutreachSerializer(outreach_records, many=True)
            
            logger.info(
                f"STAFF user {request.user.email} retrieved {len(outreach_records)} "
                f"outreach records for service request {service_request.id}"
            )
            
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f"Error listing outreach records: {str(e)}")
            return Response(
                {"error": "Failed to retrieve outreach records"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        try:
            # Add service_request to data
            data = request.data.copy()
            data['service_request'] = service_request.id
            
            serializer = ProviderOutreachSerializer(
                data=data,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                logger.error(f"Invalid outreach data: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            outreach = serializer.save()
            
            logger.info(
                f"STAFF user {request.user.email} created outreach record for "
                f"provider {outreach.provider.business_name} on service request {service_request.id}"
            )
            
            return Response(
                ProviderOutreachSerializer(outreach).data,
                status=status.HTTP_201_CREATED
            )
        
        except Exception as e:
            logger.error(f"Error creating outreach record: {str(e)}")
            return Response(
                {"error": "Failed to create outreach record"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def retrieve_update_delete_outreach(request, request_id, outreach_id):
    """
    GET: Retrieve a specific outreach record
    PATCH: Update an outreach record
    DELETE: Delete an outreach record
    """
    service_request = get_object_or_404(ServiceRequest, id=request_id)
    outreach = get_object_or_404(
        ProviderOutreach,
        id=outreach_id,
        service_request=service_request
    )
    
    if request.method == 'GET':
        try:
            serializer = ProviderOutreachSerializer(outreach)
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f"Error retrieving outreach record: {str(e)}")
            return Response(
                {"error": "Failed to retrieve outreach record"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'PATCH':
        try:
            serializer = ProviderOutreachSerializer(
                outreach,
                data=request.data,
                partial=True,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                logger.error(f"Invalid outreach update data: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            updated_outreach = serializer.save()
            
            logger.info(
                f"STAFF user {request.user.email} updated outreach record {outreach_id} "
                f"for service request {service_request.id}"
            )
            
            return Response(ProviderOutreachSerializer(updated_outreach).data)
        
        except Exception as e:
            logger.error(f"Error updating outreach record: {str(e)}")
            return Response(
                {"error": "Failed to update outreach record"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            provider_name = outreach.provider.business_name
            outreach.delete()
            
            logger.info(
                f"STAFF user {request.user.email} deleted outreach record for "
                f"provider {provider_name} on service request {service_request.id}"
            )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        except Exception as e:
            logger.error(f"Error deleting outreach record: {str(e)}")
            return Response(
                {"error": "Failed to delete outreach record"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
