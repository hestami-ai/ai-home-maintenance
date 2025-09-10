from rest_framework import viewsets, mixins, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from services.models.timeline_models import TimelineEntry, TimelineComment, TimelineReadReceipt
from services.models.base_models import ServiceRequest
from services.serializers.timeline_serializers import (
    TimelineEntrySerializer,
    TimelineCommentSerializer,
    TimelineReadReceiptSerializer,
    TimelineEntryCreateSerializer,
    TimelineCommentCreateSerializer,
    UnreadCountSerializer
)
from services.permissions import IsServiceRequestParticipant


class TimelineEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for timeline entries with role-based access control.
    """
    permission_classes = [IsAuthenticated, IsServiceRequestParticipant]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entry_type', 'created_by']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """
        Filter timeline entries based on user role and service request.
        Apply visibility filters for TimelineComment entries.
        """
        service_request_id = self.kwargs.get('service_request_id')
        if not service_request_id:
            return TimelineEntry.objects.none()
            
        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        self.check_object_permissions(self.request, service_request)
        
        user = self.request.user
        queryset = TimelineEntry.objects.filter(
            service_request=service_request,
            is_deleted=False
        )
        
        # Apply visibility filters for comments
        if hasattr(user, 'user_role'):
            comment_filters = Q()
            
            # TimelineComment objects have visibility settings
            if user.user_role == 'PROPERTY_OWNER':
                comment_filters |= Q(
                    timelinecomment__isnull=False,
                    timelinecomment__visibility__in=[
                        'ALL', 'PROPERTY_OWNER_ONLY'
                    ]
                )
            elif user.user_role == 'SERVICE_PROVIDER':
                comment_filters |= Q(
                    timelinecomment__isnull=False,
                    timelinecomment__visibility__in=[
                        'ALL', 'PROVIDER_ONLY'
                    ]
                )
            elif user.is_staff:
                # Staff can see all entries
                pass
            else:
                # Default: only show ALL visibility
                comment_filters |= Q(
                    timelinecomment__isnull=False,
                    timelinecomment__visibility='ALL'
                )
                
            # Combine with non-comment entries
            queryset = queryset.filter(
                Q(timelinecomment__isnull=True) | comment_filters
            )
            
        return queryset.select_related('created_by', 'updated_by')
    
    def get_serializer_class(self):
        """
        Return appropriate serializer based on action and entry type.
        """
        if self.action == 'create':
            return TimelineEntryCreateSerializer
        
        # For retrieve, list, update actions
        if getattr(self, 'swagger_fake_view', False):
            # Handle schema generation
            return TimelineEntrySerializer
            
        obj = self.get_object() if self.action in ['retrieve', 'update', 'partial_update'] else None
        
        if obj and hasattr(obj, 'timelinecomment'):
            return TimelineCommentSerializer
        return TimelineEntrySerializer
    
    def perform_destroy(self, instance):
        """
        Soft delete instead of hard delete.
        """
        instance.is_deleted = True
        instance.updated_by = self.request.user
        instance.save()
    
    @action(detail=True, methods=['post'])
    def read(self, request, service_request_id=None, pk=None):
        """
        Mark a timeline entry as read by the current user.
        """
        timeline_entry = self.get_object()
        
        # Check if read receipt already exists
        read_receipt, created = TimelineReadReceipt.objects.get_or_create(
            timeline_entry=timeline_entry,
            user=request.user
        )
        
        serializer = TimelineReadReceiptSerializer(read_receipt)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)
    
    @action(detail=False, methods=['get'])
    def unread(self, request, service_request_id=None):
        """
        Get count of unread timeline entries for the current service request.
        """
        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        self.check_object_permissions(request, service_request)
        
        # Get all visible entries for this user
        visible_entries = self.get_queryset()
        
        # Count entries that don't have a read receipt for this user
        unread_count = visible_entries.exclude(
            read_receipts__user=request.user
        ).count()
        
        data = {
            'service_request': service_request.id,
            'unread_count': unread_count
        }
        
        serializer = UnreadCountSerializer(data)
        return Response(serializer.data)


class TimelineCommentViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for creating comment-type timeline entries.
    """
    permission_classes = [IsAuthenticated, IsServiceRequestParticipant]
    serializer_class = TimelineCommentCreateSerializer
    
    def get_queryset(self):
        return TimelineComment.objects.none()  # Not used for listing
    
    def create(self, request, service_request_id=None, *args, **kwargs):
        """
        Create a new comment for the specified service request.
        """
        service_request = get_object_or_404(ServiceRequest, id=service_request_id)
        self.check_object_permissions(request, service_request)
        
        # Add service_request to the data
        data = request.data.copy()
        data['service_request'] = service_request.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        
        # Return the full comment data
        response_serializer = TimelineCommentSerializer(
            comment, context={'request': request}
        )
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED
        )
