from django.contrib.auth import get_user_model, authenticate
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'confirm_password', 'user_role', 
                 'first_name', 'last_name', 'phone_number']
        extra_kwargs = {
            'email': {'required': True},
            'user_role': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'phone_number': {'required': True}
        }

    def validate(self, data):
        # Check if passwords match
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({
                'confirm_password': ['Passwords do not match.']
            })

        # Check if email already exists
        email = data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError({
                'email': ['A user with this email address already exists.']
            })

        return data

    def create(self, validated_data):
        # Remove confirm_password from the data
        validated_data.pop('confirm_password', None)
        
        try:
            # Create the user
            user = User.objects.create_user(
                email=validated_data['email'],
                password=validated_data['password'],
                user_role=validated_data['user_role'],
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                phone_number=validated_data.get('phone_number')
            )
            return user
        except Exception as e:
            error_msg = str(e)
            if 'email' in error_msg.lower():
                raise serializers.ValidationError({
                    'email': ['A user with this email address already exists.']
                })
            raise serializers.ValidationError({
                'general': ['Failed to create account. Please try again.']
            })

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            # Check if user exists
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise serializers.ValidationError({
                    'email': ['No account found with this email address.']
                })

            # Check if account is active
            if not user.is_active:
                raise serializers.ValidationError({
                    'email': ['This account has been deactivated.']
                })

            # Authenticate user
            user = authenticate(
                request=self.context.get('request'),
                email=email,
                password=password
            )

            if not user:
                # Track failed login attempts (to be implemented)
                raise serializers.ValidationError({
                    'password': ['Invalid password.']
                })

            attrs['user'] = user
            return attrs

        raise serializers.ValidationError({
            'error': ['Must include "email" and "password".']
        })

class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_new_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_new_password']:
            raise serializers.ValidationError({
                'confirm_new_password': ['New passwords do not match.']
            })

        # Check if current password is correct
        user = self.context['request'].user
        if not user.check_password(data['current_password']):
            raise serializers.ValidationError({
                'current_password': ['Current password is incorrect.']
            })

        # Check if new password is different from current
        if data['current_password'] == data['new_password']:
            raise serializers.ValidationError({
                'new_password': ['New password must be different from current password.']
            })

        return data

class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

class PasswordResetConfirmSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': ['Passwords do not match.']
            })
        return data
