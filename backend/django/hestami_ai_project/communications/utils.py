from typing import Optional
from django.contrib.auth import get_user_model
from .models import Notification, Message, NotificationType, MessageType

User = get_user_model()

def send_notification(
    recipient: User,
    content: str,
    notification_type: str = NotificationType.SYSTEM,
    sender: Optional[User] = None
) -> Notification:
    """
    Send a notification to a user.
    
    Args:
        recipient: User to receive the notification
        content: Notification content
        notification_type: Type of notification (default: SYSTEM)
        sender: Optional sender of the notification
        
    Returns:
        Created Notification instance
    """
    return Notification.objects.create(
        recipient=recipient,
        content=content,
        notification_type=notification_type,
        sender=sender
    )

def send_message(
    recipient: User,
    content: str,
    conversation_id: str,
    sender: User,
    message_type: str = MessageType.USER_MESSAGE
) -> Message:
    """
    Send a message in a conversation.
    
    Args:
        recipient: User to receive the message
        content: Message content
        conversation_id: UUID of the conversation
        sender: User sending the message
        message_type: Type of message (default: USER_MESSAGE)
        
    Returns:
        Created Message instance
    """
    return Message.objects.create(
        recipient=recipient,
        content=content,
        conversation_id=conversation_id,
        sender=sender,
        message_type=message_type
    )

def send_agent_notification(
    recipient: User,
    content: str,
    agent_user: User
) -> Notification:
    """
    Send a notification from an AI agent to a user.
    
    Args:
        recipient: User to receive the notification
        content: Notification content
        agent_user: User account representing the AI agent
        
    Returns:
        Created Notification instance
    """
    return send_notification(
        recipient=recipient,
        content=content,
        notification_type=NotificationType.AGENT_UPDATE,
        sender=agent_user
    )

def send_agent_message(
    recipient: User,
    content: str,
    conversation_id: str,
    agent_user: User
) -> Message:
    """
    Send a message from an AI agent in a conversation.
    
    Args:
        recipient: User to receive the message
        content: Message content
        conversation_id: UUID of the conversation
        agent_user: User account representing the AI agent
        
    Returns:
        Created Message instance
    """
    return send_message(
        recipient=recipient,
        content=content,
        conversation_id=conversation_id,
        sender=agent_user,
        message_type=MessageType.AGENT_MESSAGE
    )
