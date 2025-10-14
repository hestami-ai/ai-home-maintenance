import logging

logger = logging.getLogger('security')

class UploadLoggingMiddleware:
    """Middleware to log all upload requests for debugging"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Log all requests to upload endpoints
        if '/upload/' in request.path:
            logger.info(f"[MIDDLEWARE] Upload request to: {request.path}")
            logger.info(f"[MIDDLEWARE] Method: {request.method}")
            logger.info(f"[MIDDLEWARE] Content-Type: {request.content_type}")
            logger.info(f"[MIDDLEWARE] Content-Length: {request.META.get('CONTENT_LENGTH', 'unknown')}")
            logger.info(f"[MIDDLEWARE] User: {request.user if hasattr(request, 'user') else 'Not authenticated yet'}")
        
        response = self.get_response(request)
        
        # Log response for upload endpoints
        if '/upload/' in request.path:
            logger.info(f"[MIDDLEWARE] Response status: {response.status_code}")
            if response.status_code >= 400:
                logger.error(f"[MIDDLEWARE] Upload failed with status {response.status_code}")
                if hasattr(response, 'content'):
                    logger.error(f"[MIDDLEWARE] Response content: {response.content[:500]}")
        
        return response
