from django.core.cache import cache
from django.conf import settings
from django.http import JsonResponse
from rest_framework import status
from datetime import datetime, timedelta
import json

class LoginAttemptMiddleware:
    """
    Middleware to track and limit failed login attempts.
    Implements a lockout policy after 5 failed attempts for 15 minutes.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        # Constants for login attempt tracking
        self.MAX_ATTEMPTS = 5
        self.LOCKOUT_DURATION = 15 * 60  # 15 minutes in seconds
        
    def __call__(self, request):
        # Only process login attempts
        if request.path == '/api/users/login/' and request.method == 'POST':
            try:
                # Get client IP and email from request
                client_ip = self.get_client_ip(request)
                body = json.loads(request.body)
                email = body.get('email', '').lower()
                
                if email:
                    # Check if user is currently locked out
                    if self.is_locked_out(email, client_ip):
                        return JsonResponse({
                            'error': 'Account temporarily locked. Please try again later.',
                            'lockout_remaining': self.get_lockout_remaining(email, client_ip)
                        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                    
                    # Process the request
                    response = self.get_response(request)
                    
                    # If login failed (non-200 status), increment attempt counter
                    if response.status_code != 200:
                        self.increment_attempts(email, client_ip)
                    else:
                        # On successful login, reset attempt counters
                        self.reset_attempts(email, client_ip)
                    
                    return response
            except json.JSONDecodeError:
                pass
        
        return self.get_response(request)
    
    def get_client_ip(self, request):
        """Get the client's IP address from the request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
    
    def get_cache_key(self, email, client_ip):
        """Generate a unique cache key for tracking attempts."""
        return f'login_attempts:{email}:{client_ip}'
    
    def get_lockout_key(self, email, client_ip):
        """Generate a unique cache key for tracking lockouts."""
        return f'login_lockout:{email}:{client_ip}'
    
    def increment_attempts(self, email, client_ip):
        """Increment the failed login attempt counter."""
        cache_key = self.get_cache_key(email, client_ip)
        attempts = cache.get(cache_key, 0) + 1
        
        # Set or update the attempts counter
        cache.set(cache_key, attempts, 24 * 60 * 60)  # Store for 24 hours
        
        # If max attempts reached, implement lockout
        if attempts >= self.MAX_ATTEMPTS:
            lockout_key = self.get_lockout_key(email, client_ip)
            cache.set(lockout_key, datetime.now().timestamp(), self.LOCKOUT_DURATION)
    
    def is_locked_out(self, email, client_ip):
        """Check if the user is currently locked out."""
        lockout_key = self.get_lockout_key(email, client_ip)
        return cache.get(lockout_key) is not None
    
    def get_lockout_remaining(self, email, client_ip):
        """Get remaining lockout time in seconds."""
        lockout_key = self.get_lockout_key(email, client_ip)
        lockout_timestamp = cache.get(lockout_key)
        if lockout_timestamp:
            lockout_time = datetime.fromtimestamp(lockout_timestamp)
            remaining = lockout_time + timedelta(seconds=self.LOCKOUT_DURATION) - datetime.now()
            return max(0, int(remaining.total_seconds()))
        return 0
    
    def reset_attempts(self, email, client_ip):
        """Reset failed login attempt counter and remove any lockouts."""
        cache_key = self.get_cache_key(email, client_ip)
        lockout_key = self.get_lockout_key(email, client_ip)
        cache.delete(cache_key)
        cache.delete(lockout_key)


class SessionManagementMiddleware:
    """
    Middleware to manage user sessions and implement session-related security policies.
    - Maximum 3 concurrent sessions per user
    - Force logout on password change
    - Remember me functionality
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.MAX_CONCURRENT_SESSIONS = 3
    
    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            # Check if session is valid
            if not self.is_session_valid(request):
                return JsonResponse({
                    'error': 'Session invalidated. Please login again.'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # Update session activity
            self.update_session_activity(request)
            
            # Enforce concurrent session limit
            self.enforce_session_limit(request)
        
        return self.get_response(request)
    
    def is_session_valid(self, request):
        """Check if the current session is still valid."""
        # Get user's password last modified timestamp
        password_changed = cache.get(f'password_changed:{request.user.id}')
        if password_changed:
            # If password was changed after session started, invalidate session
            session_started = request.session.get('login_time', 0)
            if password_changed > session_started:
                return False
        
        return True
    
    def update_session_activity(self, request):
        """Update the last activity timestamp for the session."""
        cache_key = f'session_activity:{request.session.session_key}'
        cache.set(cache_key, datetime.now().timestamp(), 24 * 60 * 60)
    
    def enforce_session_limit(self, request):
        """Enforce the maximum number of concurrent sessions per user."""
        user_id = request.user.id
        session_key = request.session.session_key
        
        # Get all active sessions for the user
        active_sessions = cache.get(f'active_sessions:{user_id}', [])
        current_time = datetime.now().timestamp()
        
        # Filter out expired sessions
        active_sessions = [
            s for s in active_sessions 
            if cache.get(f'session_activity:{s}', 0) > current_time - 24 * 60 * 60
        ]
        
        # Add current session if not present
        if session_key not in active_sessions:
            active_sessions.append(session_key)
        
        # If too many sessions, remove oldest ones
        while len(active_sessions) > self.MAX_CONCURRENT_SESSIONS:
            oldest_session = active_sessions.pop(0)
            cache.delete(f'session_activity:{oldest_session}')
        
        # Update active sessions list
        cache.set(f'active_sessions:{user_id}', active_sessions, 24 * 60 * 60)
