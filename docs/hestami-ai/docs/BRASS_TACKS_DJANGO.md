Hestami AI Development Roadmap

This roadmap outlines the phased development of the Hestami AI platform using Agile methodology, specifically following the "Thin Vertical Slice" approach. The goal is to deliver incremental, end-to-end functionality that provides immediate value to users. Each phase represents a vertical slice of the system, encompassing all layers from the frontend to the backend, and is focused on a specific set of features.

This document outlines the system requirements for creating a secure REST API with Django 5.1 with Django REST Framework (DRF) for the backend with Python 3.12 as the base requirement. The application will use PostgreSQL 17 or later as the database and will be containerized with Docker and docker-compose. The application must support both production and development environments running on the same host machine using the following approach.

NOTA BENE: We are strictly focused on proof of concept and proof of value. Specifically we are just implementing Phases 1 and 2 which are the user registration and authentication and media upload and management phases.


IN SCOPE FOR MVP
Phase 1: User Registration and Authentication
Phase 2: Homeowner Media Upload and Management
Phase 3: Bid Request Creation and Viewing
Phase 4: Service Provider Registration and Bid Submission
Phase 5: Bid Evaluation and AI Agent Logging
Phase 6: Communication Logging and Notifications
Phase 7: Ratings and Reviews System
Phase 8: Availability Management for Service Providers
Phase 9: Mobile Optimization and Media Upload Enhancements
Phase 10: Social Login and Third-Party Integrations
Phase 11: Security Enhancements and Audit Trails
Phase 12: Deployment and Scalability Preparations

Hestami AI System Requirements

### Backend Specifications:

- **Framework:** Django 5.1 with Django REST Framework (DRF).
- **Authentication:**
    - Use SimpleJWT for token-based authentication.
    - Provide endpoints for login, signup, token refresh, and user roles.
    - Return tokens via Set-Cookie headers for secure storage.
    
    Password Policies:
        - Minimum length: 12 characters
        - Must contain at least:
            - One uppercase letter
            - One lowercase letter
            - One number
            - One special character
        - Cannot contain common patterns or dictionary words
        - Cannot be similar to user's personal information
        - Password change required every 90 days for staff users
        - Cannot reuse last 5 passwords
        - Account lockout after 5 failed attempts for 15 minutes
    
    Session Management:
        - Access token validity: 15 minutes
        - Refresh token validity: 7 days
        - Maximum 3 concurrent sessions per user
        - Force logout on password change
        - "Remember me" extends refresh token to 30 days
        - Session invalidation on:
            - Password change
            - Role change
            - Account suspension
            - Security breach detection


================================

Hestami AI Project Structure


backend/django/hestami_ai_project/
  |-- hestami_ai/  # Project-level settings and URLs
      |-- settings.py
      |-- urls.py
      |-- wsgi.py
      |-- asgi.py

  |-- users/   # Users and Authentication (users app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- auth_views.py    # Contains views for login, logout, password reset.
        |-- profile_views.py    # Contains views for user profile retrieval and updates.
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py
    |-- signals.py

  |-- properties/ # Property Management (properties app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- property_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- media/  # Media Management (media app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- media_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- bids/    # Bidding System (bids app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- bid_request_views.py
        |-- bid_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- ratings/   # Ratings and Reviews (ratings app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- ratings_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- ai_agents/   # AI Agents and Logging (ai_agents app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- ai_agents_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- communications/ # Communication (communications app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- communications_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py


  |-- availability/  # Availability Management (availability app)
    |-- __init__.py
    |-- admin.py
    |-- apps.py
    |-- models.py
    |-- serializers.py
    |-- views/
        |-- __init__.py
        |-- availability_views.py
    |-- urls.py
    |-- permissions.py
    |-- tests/
        |-- __init__.py
        |-- test_models.py
        |-- test_views.py

  |-- common/
    |-- __init__.py
    |-- decorators.py
    |-- utils.py
    |-- constants.py
    |-- exceptions.py

  |-- manage.py


  ================================

Hestami AI Data Model

Updated Data Model
Key Entities

    User
    PropertyOwnerProfile
    ServiceProviderProfile
    Property
    PropertyOwnership
    Media
    BidRequest
    Bid
    BidEvaluation
    AIActivityLog
    CommunicationLog
    Rating
    Availability

Entity Definitions and Attributes
1. User

    Fields:
        id: Auto-incrementing primary key
        email: Unique email address (used as username)
        password: Hashed password
        user_type: Enum (PROPERTY_OWNER, SERVICE_PROVIDER, STAFF)
        status: Enum (ACTIVE, INACTIVE, SUSPENDED), default INACTIVE
        first_name
        last_name
        phone_number
        date_joined: Timestamp
        last_login: Timestamp
        notification_preferences: JSON field (e.g., email, SMS, phone calls)
        social_login_provider: Nullable string (e.g., GOOGLE, FACEBOOK)

2. PropertyOwnerProfile

    Fields:
        user: One-to-One relationship with User
        preferred_contact_method: Enum (EMAIL, PHONE, SMS)

3. ServiceProviderProfile

    Fields:
        user: One-to-One relationship with User
        business_name
        service_categories: Array of strings
        service_areas: Array of strings (geographic areas)
        availability: One-to-One relationship with Availability
        ratings_average: Calculated field based on Rating

4. Property

    Fields:
        id: Auto-incrementing primary key
        address: String
        descriptives: JSON field (e.g., number of bedrooms, bathrooms, square footage, date built, etc.)
        created_at: Timestamp
        updated_at: Timestamp

5. PropertyOwnership

    Fields:
        id: Auto-incrementing primary key
        property: Foreign Key to Property
        property_owner: Foreign Key to PropertyOwnerProfile
        ownership_start_date: Date
        ownership_end_date: Date (nullable for current owners)

    Notes:
        Represents ownership history of a property.
        Allows tracking of multiple owners over time.

6. Media

    Fields:
        id: Auto-incrementing primary key
        uploaded_by: Foreign Key to User
        file_path: String (path to the file on the server)
        file_type: Enum (IMAGE, VIDEO, FLOORPLAN )
        subtype: Enum (REGULAR, 360_DEGREE)
        metadata: JSON field (e.g., timestamps, geolocation, equipment used)
        uploaded_at: Timestamp
        property: Foreign Key to Property
        property_owner_at_upload: Foreign Key to PropertyOwnerProfile
        uploaded_by: Foreign Key to User
        access_permissions: JSON field (who can access this media)
        location_on_property: Short description of location (e.g., "Kitchen", "Living Room", "Bathroom", "Backyard", "Deck", "Driveway", etc.)

7. BidRequest

    Fields:
        id: Auto-incrementing primary key
        property_owner: Foreign Key to PropertyOwnerProfile
        property: Foreign Key to Property
        title: Short description of the project
        description: Detailed description
        priority: Enum (PRICE, REPUTATION, URGENCY)
        status: Enum (OPEN, IN_PROGRESS, CLOSED)
        preferred_date_time: DateTime, nullable
        created_at: Timestamp
        updated_at: Timestamp
        media: Many-to-Many relationship with Media
        budget: Decimal
        

8. Bid

    Fields:
        id: Auto-incrementing primary key
        bid_request: Foreign Key to BidRequest
        service_provider: Foreign Key to ServiceProviderProfile
        amount: Decimal
        estimated_time: Duration or DateTime
        message: Text field (additional details)
        created_at: Timestamp
        updated_at: Timestamp
        communication_method: Enum (EMAIL, PHONE, PLATFORM)

9. BidEvaluation

    Fields:
        id: Auto-incrementing primary key
        bid: Foreign Key to Bid
        evaluation_score: Integer or Decimal (based on criteria)
        recommendation: Enum (RECOMMENDED, NOT_RECOMMENDED, NEUTRAL)
        notes: Text field
        evaluated_at: Timestamp
        evaluated_by: Foreign Key to User (could be an AI agent or staff)

10. AIActivityLog

    Fields:
        id: Auto-incrementing primary key
        agent_type: Enum (BID_MANAGER, BUSINESS_RESEARCHER, etc.)
        action: Text field (e.g., "Searched for service providers")
        details: JSON field (additional data)
        timestamp: Timestamp
        related_bid_request: Foreign Key to BidRequest, nullable

11. CommunicationLog

    Fields:
        id: Auto-incrementing primary key
        from_user: Foreign Key to User, nullable (could be AI agent)
        to_user: Foreign Key to User, nullable
        method: Enum (EMAIL, SMS, PHONE_CALL, PLATFORM_MESSAGE)
        content: Text field or JSON (e.g., transcript)
        timestamp: Timestamp
        related_bid: Foreign Key to Bid, nullable

12. Rating

    Fields:
        id: Auto-incrementing primary key
        service_provider: Foreign Key to ServiceProviderProfile
        property_owner: Foreign Key to PropertyOwnerProfile
        bid_request: Foreign Key to **BidRequest`
        score: Integer (e.g., 1 to 5)
        review: Text field
        created_at: Timestamp

13. Availability

    Fields:
        id: Auto-incrementing primary key
        service_provider: One-to-One relationship with ServiceProviderProfile
        availability_data: JSON field (e.g., working hours, blackout dates)

Relationships Between Entities

    User has one PropertyOwnerProfile or one ServiceProviderProfile, depending on user_type.
    PropertyOwnerProfile can have multiple PropertyOwnerships.
    Property can have multiple PropertyOwnerships.
    PropertyOwnership links a PropertyOwnerProfile to a Property with ownership dates.
    PropertyOwnerProfile can create multiple BidRequests associated with properties they own.
    BidRequest can have multiple Media items attached.
    Media is associated with a Property and the PropertyOwnerProfile at the time of upload.
    BidRequest can receive multiple Bids from different ServiceProviderProfiles.
    PropertyOwnerProfile can rate ServiceProviderProfiles via Rating after a bid is completed.
    ServiceProviderProfile has one Availability.
    AIActivityLog records actions related to BidRequests and Bids.
    CommunicationLog tracks communications between users and AI agents.

Entity Relationship Diagram (ERD)

Since I'm unable to provide visual diagrams, I'll describe the relationships in text format.

    User (1) — (1) PropertyOwnerProfile (optional)
    User (1) — (1) ServiceProviderProfile (optional)
    PropertyOwnerProfile (1) — (M) PropertyOwnership
    Property (1) — (M) PropertyOwnership
    PropertyOwnership links PropertyOwnerProfile to Property
    PropertyOwnerProfile (1) — (M) BidRequest
    Property (1) — (M) BidRequest
    BidRequest (M) — (M) Media
    Media (M) — (1) Property
    Media (M) — (1) PropertyOwnerProfile
    BidRequest (1) — (M) Bid
    Bid (1) — (1) BidEvaluation (optional)
    PropertyOwnerProfile (1) — (M) Rating
    ServiceProviderProfile (1) — (M) Rating
    ServiceProviderProfile (1) — (1) Availability

================================================

Starter Django code for Hestami AI Data Model
NOTA BENE: (AbstractBaseUser, PermissionsMixin, BaseUserManager and models.TextChoices are preferred implementations)

from django.contrib.postgres.fields import ArrayField, JSONField

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models

class UserRoles(models.TextChoices):
    PROPERTY_OWNER = 'PROPERTY_OWNER', 'Property Owner'
    SERVICE_PROVIDER = 'SERVICE_PROVIDER', 'Service Provider'
    STAFF = 'STAFF', 'Hestami AI Staff'

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')

        email = self.normalize_email(email)
        user_role = extra_fields.get('user_role')
        if not user_role:
            raise ValueError('The user_role field must be set')

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('user_role', UserRoles.STAFF)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    user_role = models.CharField(max_length=20, choices=UserRoles.choices)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # Can login
    is_staff = models.BooleanField(default=False)  # Can access admin site

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['user_role']

    objects = CustomUserManager()

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'


class PropertyOwnerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    preferred_contact_method = models.CharField(max_length=5, choices=[
        ('EMAIL', 'Email'),
        ('PHONE', 'Phone'),
        ('SMS', 'SMS'),
    ])

class ServiceProviderProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    business_name = models.CharField(max_length=255)
    service_categories = ArrayField(models.CharField(max_length=100))
    service_areas = ArrayField(models.CharField(max_length=100))
    ratings_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    # Availability is linked via One-to-One relationship

class Property(models.Model):
    address = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Additional fields like geolocation can be added

class PropertyOwnership(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE)
    property_owner = models.ForeignKey(PropertyOwnerProfile, on_delete=models.CASCADE)
    ownership_start_date = models.DateField()
    ownership_end_date = models.DateField(null=True, blank=True)  # Null if current owner

    class Meta:
        unique_together = ('property', 'property_owner', 'ownership_start_date')

class Media(models.Model):
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    file_path = models.CharField(max_length=500)
    file_type = models.CharField(max_length=10, choices=[('IMAGE', 'Image'), ('VIDEO', 'Video')])
    subtype = models.CharField(max_length=15, choices=[('REGULAR', 'Regular'), ('360_DEGREE', '360 Degree')])
    metadata = JSONField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    property = models.ForeignKey(Property, on_delete=models.CASCADE)
    property_owner_at_upload = models.ForeignKey(PropertyOwnerProfile, on_delete=models.CASCADE)
    access_permissions = JSONField()  # E.g., list of user IDs who can access

class BidRequest(models.Model):
    property_owner = models.ForeignKey(PropertyOwnerProfile, on_delete=models.CASCADE)
    property = models.ForeignKey(Property, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=[
        ('PRICE', 'Price'),
        ('REPUTATION', 'Reputation'),
        ('URGENCY', 'Urgency'),
    ])
    status = models.CharField(max_length=15, choices=[
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('CLOSED', 'Closed'),
    ], default='OPEN')
    preferred_date_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    media = models.ManyToManyField(Media)


class Rating(models.Model):
    service_provider = models.ForeignKey(ServiceProviderProfile, on_delete=models.CASCADE)
    property_owner = models.ForeignKey(PropertyOwnerProfile, on_delete=models.SET_NULL, null=True)
    bid_request = models.ForeignKey(BidRequest, on_delete=models.SET_NULL, null=True)
    score = models.IntegerField()
    review = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


================================================

Prefer Function Based Views (with decorators: @api_view, @authentication_classes, @permission_classes, @renderer_classes, @parser_classes) over Class Based Views when and where possible.

NOTA BENE: Class Based Views for the Django admin interface is probably recommended.


List of API Endpoints to be Implemented

Based on the project's requirements, functionalities, and the updated structure focusing on Function-Based Views (FBVs) with appropriate decorators, here is a comprehensive list of API endpoints that need to be implemented. The endpoints are organized by app and include the HTTP methods, URL patterns, and brief descriptions.
1. Users App (users/)
Authentication Endpoints

    POST /api/users/register/
        Description: Register a new user with role selection (Property Owner or Service Provider).
        Data:
            email
            password
            user_role (choices: PROPERTY_OWNER, SERVICE_PROVIDER)
            first_name
            last_name
            phone_number

    POST /api/users/login/
        Description: Authenticate user and return JWT tokens.
        Data:
            email
            password

    POST /api/users/logout/
        Description: Log out the user by blacklisting the refresh token.

    POST /api/users/token/refresh/
        Description: Refresh JWT access token using a refresh token.
        Data:
            refresh (refresh token)

Profile Endpoints

    GET /api/users/profile/
        Description: Retrieve the authenticated user's profile information.
        Authentication: Required.

    PUT /api/users/profile/
        Description: Update the authenticated user's profile information.
        Authentication: Required.
        Data:
            first_name
            last_name
            phone_number
            Other profile fields as necessary.

    GET /api/users/{user_id}/
        Description: Retrieve public profile information of another user.
        Authentication: Optional or Required (depending on privacy settings).

Password Management Endpoints

    POST /api/users/password/reset/
        Description: Request a password reset email.
        Data:
            email

    POST /api/users/password/reset/confirm/
        Description: Confirm password reset with token and set new password.
        Data:
            uid
            token
            new_password

2. Properties App (properties/)
Property Endpoints

    GET /api/properties/
        Description: List all properties owned by the authenticated user.
        Authentication: Required (Property Owners).

    POST /api/properties/
        Description: Create a new property.
        Authentication: Required (Property Owners).
        Data:
            address
            city
            state
            zip_code
            description
            Other relevant property details.

    GET /api/properties/{property_id}/
        Description: Retrieve details of a specific property.
        Authentication: Required (must own the property or have permissions).

    PUT /api/properties/{property_id}/
        Description: Update details of a specific property.
        Authentication: Required (Property Owners).
        Data:
            Fields to update.

    DELETE /api/properties/{property_id}/
        Description: Delete a specific property.
        Authentication: Required (Property Owners).

Property Ownership Endpoints

    POST /api/properties/{property_id}/transfer/
        Description: Transfer ownership of a property to another user.
        Authentication: Required (Current Property Owner).
        Data:
            new_owner_email or new_owner_id

3. Media App (media/)
Media Upload and Management Endpoints

    POST /api/media/properties/{property_id}/upload/
        Description: Upload media (images/videos) associated with a specific property.
        Authentication: Required (Property Owners).
        Data:
            file (uploaded media file)
            media_type (choices: IMAGE, VIDEO)
            description (optional)

    GET /api/media/properties/{property_id}/
        Description: List all media files associated with a specific property.
        Authentication: Required (Property Owners or authorized users).

    DELETE /api/media/{media_id}/
        Description: Delete a media file.
        Authentication: Required (Uploader or Property Owner).

4. Bids App (bids/)
Bid Request Endpoints

    GET /api/bids/requests/
        Description: List all bid requests created by the authenticated property owner.
        Authentication: Required (Property Owners).

    POST /api/bids/requests/
        Description: Create a new bid request for a specific property.
        Authentication: Required (Property Owners).
        Data:
            property_id
            title
            description
            due_date
            budget

    GET /api/bids/requests/{bid_request_id}/
        Description: Retrieve details of a specific bid request.
        Authentication: Required (Owner or authorized service providers).

    PUT /api/bids/requests/{bid_request_id}/
        Description: Update a bid request.
        Authentication: Required (Property Owner).
        Data:
            Fields to update.

    DELETE /api/bids/requests/{bid_request_id}/
        Description: Delete a bid request.
        Authentication: Required (Property Owner).

Bid Submission Endpoints

    GET /api/bids/requests/{bid_request_id}/bids/
        Description: List all bids submitted for a specific bid request.
        Authentication: Required (Property Owner or bidding Service Providers).

    POST /api/bids/requests/{bid_request_id}/bids/
        Description: Submit a bid for a bid request.
        Authentication: Required (Service Providers).
        Data:
            amount
            description
            availability_date

    GET /api/bids/{bid_id}/
        Description: Retrieve details of a specific bid.
        Authentication: Required (Bidder or Property Owner).

    PUT /api/bids/{bid_id}/
        Description: Update a bid.
        Authentication: Required (Bidder).
        Data:
            Fields to update.

    DELETE /api/bids/{bid_id}/
        Description: Withdraw a bid.
        Authentication: Required (Bidder).

Bid Evaluation Endpoints

    POST /api/bids/{bid_id}/accept/
        Description: Accept a bid, forming an agreement with the service provider.
        Authentication: Required (Property Owner).

    POST /api/bids/{bid_id}/decline/
        Description: Decline a bid.
        Authentication: Required (Property Owner).

5. Ratings App (ratings/)
Rating and Review Endpoints

    POST /api/ratings/bids/{bid_id}/
        Description: Submit a rating and review for a service provider after job completion.
        Authentication: Required (Property Owner).
        Data:
            rating (e.g., 1 to 5)
            review (textual feedback)

    GET /api/ratings/service_providers/{service_provider_id}/
        Description: Retrieve all ratings and reviews for a specific service provider.
        Authentication: Optional.

    GET /api/ratings/my/
        Description: Retrieve all ratings and reviews given by the authenticated user.
        Authentication: Required.