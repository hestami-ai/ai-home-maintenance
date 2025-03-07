import re
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext as _
from django.contrib.auth import get_user_model

User = get_user_model()

class SpecialCharacterValidator:
    """
    Validate that the password contains at least one special character.
    """
    def __init__(self, special_chars=r'[!@#$%^&*(),.?":{}|<>]'):
        self.special_chars = special_chars

    def validate(self, password, user=None):
        if not re.search(self.special_chars, password):
            raise ValidationError(
                _("Password must contain at least one special character."),
                code='password_no_special_char',
            )

    def get_help_text(self):
        return _("Your password must contain at least one special character.")

class UpperLowerCaseValidator:
    """
    Validate that the password contains both uppercase and lowercase letters.
    """
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("Password must contain at least one uppercase letter."),
                code='password_no_upper',
            )
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("Password must contain at least one lowercase letter."),
                code='password_no_lower',
            )

    def get_help_text(self):
        return _("Your password must contain both uppercase and lowercase letters.")

class NumberValidator:
    """
    Validate that the password contains at least one number.
    """
    def validate(self, password, user=None):
        if not re.search(r'\d', password):
            raise ValidationError(
                _("Password must contain at least one number."),
                code='password_no_number',
            )

    def get_help_text(self):
        return _("Your password must contain at least one number.")

class PasswordHistoryValidator:
    """
    Validate that the password hasn't been used in the user's last 5 passwords.
    """
    def __init__(self, history_length=5):
        self.history_length = history_length

    def validate(self, password, user=None):
        if not user or not user.pk:
            return

        # This would require implementing password history tracking
        # For MVP, we'll just check the current password
        if user.check_password(password):
            raise ValidationError(
                _("Password cannot be the same as your current password."),
                code='password_already_used',
            )

    def get_help_text(self):
        return _("Your password cannot be one of your last 5 passwords.")

class PasswordExpiryValidator:
    """
    Validate that the password hasn't expired (90 days for staff users).
    """
    def __init__(self, max_age=90):
        self.max_age = timedelta(days=max_age)

    def validate(self, password, user=None):
        if not user or not user.pk or not user.is_staff:
            return

        last_change = getattr(user, 'last_password_change', None)
        if last_change and (timezone.now() - last_change) > self.max_age:
            raise ValidationError(
                _("Your password has expired. Please choose a new password."),
                code='password_expired',
            )

    def get_help_text(self):
        return _("Staff user passwords expire after 90 days.")

class PasswordComplexityValidator:
    """
    Validate overall password complexity requirements.
    """
    def validate(self, password, user=None):
        # Check for common patterns
        common_patterns = [
            r'12345',
            r'qwerty',
            r'password',
            r'admin',
            r'welcome',
            r'abc123',
        ]
        
        for pattern in common_patterns:
            if re.search(pattern, password.lower()):
                raise ValidationError(
                    _("Password contains a common pattern."),
                    code='password_common_pattern',
                )

        # Check for repeated characters
        if re.search(r'(.)\1{2,}', password):
            raise ValidationError(
                _("Password contains repeated characters."),
                code='password_repeated_chars',
            )

        # Check for sequential characters
        if (re.search(r'abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz', 
                     password.lower()) or
            re.search(r'123|234|345|456|567|678|789|890', password)):
            raise ValidationError(
                _("Password contains sequential characters."),
                code='password_sequential_chars',
            )

    def get_help_text(self):
        return _("Password must not contain common patterns, repeated characters, or sequential characters.")
