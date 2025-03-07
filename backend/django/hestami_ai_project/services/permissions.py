from rest_framework import permissions

class IsServiceProvider(permissions.BasePermission):
    """
    Custom permission to only allow service providers to perform certain actions.
    """
    def has_permission(self, request, view):
        return hasattr(request.user, 'serviceprovider')

class IsPropertyOwner(permissions.BasePermission):
    """
    Custom permission to only allow property owners to perform certain actions.
    """
    def has_permission(self, request, view):
        return hasattr(request.user, 'propertyowner')

class CanViewServiceRequest(permissions.BasePermission):
    """
    Custom permission to determine if a user can view a service request.
    """
    def has_object_permission(self, request, view, obj):
        # Property owners can view their own requests
        if hasattr(request.user, 'propertyowner'):
            return obj.property_owner == request.user.propertyowner
        # Service providers can view requests they have access to
        elif hasattr(request.user, 'serviceprovider'):
            return obj.is_visible_to_provider(request.user.serviceprovider)
        return False

class CanBidOnServiceRequest(permissions.BasePermission):
    """
    Custom permission to determine if a service provider can bid on a service request.
    """
    def has_object_permission(self, request, view, obj):
        # Only service providers can bid
        if not hasattr(request.user, 'serviceprovider'):
            return False
        # Can't bid on closed or completed requests
        if obj.status not in ['OPEN', 'BIDDING']:
            return False
        # Must be in the same category and location
        provider = request.user.serviceprovider
        return (obj.category == provider.category and
                obj.is_within_provider_range(provider))

class IsHestamaiStaff(permissions.BasePermission):
    """
    Custom permission to only allow Hestami AI staff members to perform certain actions.
    """
    def has_permission(self, request, view):
        return (
            request.user.is_staff and 
            request.user.user_role == 'STAFF'
        )
