import logging
from datetime import datetime
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger('security')

class SecurityEvent:
    # Authentication events
    LOGIN_SUCCESS = 'LOGIN_SUCCESS'
    LOGIN_FAILED = 'LOGIN_FAILED'
    LOGOUT = 'LOGOUT'
    PASSWORD_CHANGE = 'PASSWORD_CHANGE'
    PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST'
    PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS'
    
    # Account events
    ACCOUNT_CREATED = 'ACCOUNT_CREATED'
    ACCOUNT_UPDATED = 'ACCOUNT_UPDATED'
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED'
    ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED'
    
    # Session events
    SESSION_STARTED = 'SESSION_STARTED'
    SESSION_ENDED = 'SESSION_ENDED'
    SESSION_EXPIRED = 'SESSION_EXPIRED'
    SESSION_INVALIDATED = 'SESSION_INVALIDATED'
    
    # Security events
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
    PERMISSION_DENIED = 'PERMISSION_DENIED'
    CSRF_FAILURE = 'CSRF_FAILURE'
    
    @classmethod
    def get_severity(cls, event_type):
        """Get the severity level for an event type."""
        high_severity = {
            cls.LOGIN_FAILED, cls.ACCOUNT_LOCKED, cls.SUSPICIOUS_ACTIVITY,
            cls.PERMISSION_DENIED, cls.CSRF_FAILURE
        }
        medium_severity = {
            cls.PASSWORD_CHANGE, cls.PASSWORD_RESET_REQUEST,
            cls.PASSWORD_RESET_SUCCESS, cls.ACCOUNT_UPDATED
        }
        
        if event_type in high_severity:
            return 'HIGH'
        elif event_type in medium_severity:
            return 'MEDIUM'
        return 'LOW'

class SecurityLogger:
    def __init__(self):
        self.logger = logger
    
    def _format_log_message(self, event_type, user_id=None, ip_address=None, details=None):
        """Format the log message with consistent structure."""
        timestamp = datetime.utcnow().isoformat()
        severity = SecurityEvent.get_severity(event_type)
        
        message = {
            'timestamp': timestamp,
            'event_type': event_type,
            'severity': severity,
            'user_id': user_id,
            'ip_address': ip_address,
            'details': details or {}
        }
        
        return message
    
    def _should_alert(self, event_type, user_id=None, ip_address=None):
        """Determine if an alert should be triggered based on event patterns."""
        if event_type == SecurityEvent.LOGIN_FAILED:
            # Check for multiple failed login attempts
            cache_key = f'failed_logins:{ip_address}:{user_id}'
            failed_attempts = cache.get(cache_key, 0)
            return failed_attempts >= 3
        
        if event_type == SecurityEvent.SUSPICIOUS_ACTIVITY:
            # Always alert for suspicious activity
            return True
        
        return SecurityEvent.get_severity(event_type) == 'HIGH'
    
    def log_security_event(self, event_type, user_id=None, ip_address=None, details=None):
        """Log a security event with appropriate severity and alerting."""
        message = self._format_log_message(event_type, user_id, ip_address, details)
        severity = SecurityEvent.get_severity(event_type)
        
        # Log based on severity
        if severity == 'HIGH':
            self.logger.error(message)
        elif severity == 'MEDIUM':
            self.logger.warning(message)
        else:
            self.logger.info(message)
        
        # Check if alerting is needed
        if self._should_alert(event_type, user_id, ip_address):
            self._trigger_alert(message)
    
    def _trigger_alert(self, message):
        """Trigger alerts for high-priority security events."""
        # Log alert separately
        self.logger.critical({
            'alert_type': 'SECURITY_ALERT',
            'message': message
        })
        
        # TODO: Implement additional alert mechanisms (email, SMS, etc.)
    
    def log_login_attempt(self, success, user_id, ip_address, details=None):
        """Log login attempts with success/failure tracking."""
        event_type = SecurityEvent.LOGIN_SUCCESS if success else SecurityEvent.LOGIN_FAILED
        
        if not success:
            # Track failed login attempts
            cache_key = f'failed_logins:{ip_address}:{user_id}'
            failed_attempts = cache.get(cache_key, 0) + 1
            cache.set(cache_key, failed_attempts, 300)  # Expire after 5 minutes
            
            details = details or {}
            details['failed_attempts'] = failed_attempts
        
        self.log_security_event(event_type, user_id, ip_address, details)
    
    def log_password_change(self, user_id, ip_address, reset_request=False):
        """Log password changes and reset requests."""
        event_type = (SecurityEvent.PASSWORD_RESET_REQUEST if reset_request 
                     else SecurityEvent.PASSWORD_CHANGE)
        self.log_security_event(event_type, user_id, ip_address)
    
    def log_account_lockout(self, user_id, ip_address, details=None):
        """Log account lockout events."""
        self.log_security_event(SecurityEvent.ACCOUNT_LOCKED, user_id, ip_address, details)
    
    def log_suspicious_activity(self, user_id, ip_address, details):
        """Log suspicious activity with immediate alerting."""
        self.log_security_event(SecurityEvent.SUSPICIOUS_ACTIVITY, user_id, ip_address, details)
    
    def log_permission_denied(self, user_id, ip_address, details):
        """Log permission denied events."""
        self.log_security_event(SecurityEvent.PERMISSION_DENIED, user_id, ip_address, details)
    
    def log_session_event(self, event_type, user_id, ip_address, session_id=None):
        """Log session-related events."""
        details = {'session_id': session_id} if session_id else None
        self.log_security_event(event_type, user_id, ip_address, details)
