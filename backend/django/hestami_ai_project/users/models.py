import uuid
import secrets

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet

class UserRoles(models.TextChoices):
    PROPERTY_OWNER = 'PROPERTY_OWNER', 'Property Owner'
    SERVICE_PROVIDER = 'SERVICE_PROVIDER', 'Service Provider'
    STAFF = 'STAFF', 'Hestami AI Staff'
    SERVICE_ACCOUNT = 'SERVICE_ACCOUNT', 'Service Account'  # Added for Temporal integration

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

    def create_service_account(self, service_name, domain="service.hestami-ai.com", **extra_fields):
        """Create a service account user"""
        email = f"{service_name}@{domain}"
        password = uuid.uuid4().hex  # Generate a random password
        
        extra_fields['user_role'] = UserRoles.SERVICE_ACCOUNT
        extra_fields['is_active'] = True
        extra_fields.setdefault('first_name', service_name)
        extra_fields.setdefault('last_name', 'Service Account')
        
        # Set the service token from extra_fields or generate a new one
        service_token = extra_fields.pop('service_token', uuid.uuid4().hex)
        extra_fields['service_token'] = service_token
        
        user = self.create_user(email=email, password=password, **extra_fields)
        return user

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    user_role = models.CharField(max_length=20, choices=UserRoles.choices)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # Can login
    is_staff = models.BooleanField(default=False)  # Can access admin site
    service_token = models.CharField(max_length=255, blank=True, null=True)  # For service accounts
    service_provider = models.ForeignKey(
        'services.ServiceProvider',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    
    # LibreChat integration fields
    librechat_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="LibreChat internal user ID"
    )
    librechat_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last successful sync with LibreChat"
    )
    librechat_password_encrypted = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="Encrypted password for LibreChat authentication"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['user_role']

    objects = CustomUserManager()

    def __str__(self):
        return self.email

    @property
    def is_service_account(self):
        return self.user_role == UserRoles.SERVICE_ACCOUNT
    
    def generate_librechat_password(self) -> str:
        """
        Generate and encrypt a random password for LibreChat authentication.
        
        Returns:
            str: The plaintext password (for immediate use in provisioning)
        """
        # Generate 32-character random password
        password = secrets.token_urlsafe(32)
        
        # Encrypt and store
        encryption_key = getattr(settings, 'LIBRECHAT_ENCRYPTION_KEY', None)
        if not encryption_key:
            raise ValueError("LIBRECHAT_ENCRYPTION_KEY not configured in settings")
        
        cipher = Fernet(encryption_key.encode())
        encrypted = cipher.encrypt(password.encode())
        self.librechat_password_encrypted = encrypted.decode()
        self.save(update_fields=['librechat_password_encrypted'])
        
        return password
    
    def get_librechat_password(self) -> str:
        """
        Decrypt and return the LibreChat password.
        
        Returns:
            str: The decrypted plaintext password
            
        Raises:
            ValueError: If no LibreChat password is set or encryption key is missing
        """
        if not self.librechat_password_encrypted:
            raise ValueError("No LibreChat password set for this user")
        
        encryption_key = getattr(settings, 'LIBRECHAT_ENCRYPTION_KEY', None)
        if not encryption_key:
            raise ValueError("LIBRECHAT_ENCRYPTION_KEY not configured in settings")
        
        cipher = Fernet(encryption_key.encode())
        decrypted = cipher.decrypt(self.librechat_password_encrypted.encode())
        return decrypted.decode()
