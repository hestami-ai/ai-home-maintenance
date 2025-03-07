from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Notification, Message
from .serializers import NotificationSerializer, MessageSerializer

# Create your views here.

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Return notifications for the current user.
        """
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """
        Mark all notifications as read for the current user.
        """
        self.get_queryset().update(is_read=True)
        return Response({'status': 'notifications marked as read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """
        Mark a specific notification as read.
        """
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'})

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Return messages for conversations involving the current user.
        """
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        )

    def perform_create(self, serializer):
        """
        Set the sender to the current user when creating a message.
        """
        serializer.save(sender=self.request.user)

    @action(detail=False)
    def conversations(self, request):
        """
        Get a list of all conversations for the current user.
        """
        user = request.user
        conversations = Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).values_list('conversation_id', flat=True).distinct()
        
        return Response({
            'conversations': list(conversations)
        })

    @action(detail=False)
    def conversation_messages(self, request):
        """
        Get all messages for a specific conversation.
        """
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            return Response(
                {'error': 'conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        messages = self.get_queryset().filter(conversation_id=conversation_id)
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
