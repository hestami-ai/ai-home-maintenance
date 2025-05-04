from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from rest_framework import status, generics, request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenVerifyView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.conf import settings
from ..serializers import UserSerializer, UserLoginSerializer, PasswordChangeSerializer, PasswordResetSerializer
from temporalio.client import Client
from temporalio.exceptions import TemporalError
import asyncio
import logging
import threading

logger = logging.getLogger(__name__)

User = get_user_model()

class UserProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Log request details for debugging
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        logger.info(f'Auth header: {auth_header}')
        logger.info(f'User authenticated: {request.user.is_authenticated}')
        logger.info(f'Request META: {dict(request.META)}')
        
        # Try to manually authenticate
        try:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(auth_header.split(' ')[1] if len(auth_header.split(' ')) > 1 else '')
            logger.info(f'Token validation successful. Token payload: {validated_token.payload}')
            user = jwt_auth.get_user(validated_token)
            logger.info(f'User retrieved from token: {user.email if user else None}')
        except (InvalidToken, TokenError, IndexError) as e:
            logger.error(f'Token validation failed: {str(e)}')
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f'Unexpected error during token validation: {str(e)}')
            return Response({'error': 'Authentication failed'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    async def create_user_subscription(self, user):
        """Initiate Temporal workflow for user subscription"""
        logger.info(f"Starting create_user_subscription for user {user.id}")
        try:
            # Connect to Temporal server
            logger.info(f"Attempting to connect to Temporal server at {settings.TEMPORAL_SETTINGS['host']}")
            client = await Client.connect(
                settings.TEMPORAL_SETTINGS['host'],
                namespace=settings.TEMPORAL_SETTINGS.get('namespace', 'default')
            )
            logger.info("Successfully connected to Temporal server")
            
            # Start the workflow
            workflow_id = f"create-subscription-{user.id}"
            logger.info(f"Starting workflow with ID: {workflow_id}")
            await client.start_workflow(
                "CreateSubscriptionWorkflow",
                args=[user.id],  # New workflow only needs user_id
                id=workflow_id,
                task_queue=settings.TEMPORAL_SETTINGS['task_queue']
            )
            
            logger.info(f"Successfully started subscription workflow {workflow_id} for user {user.id}")
            
        except TemporalError as e:
            logger.error(f"Failed to start subscription workflow for user {user.id}: {str(e)}")
            logger.error(f"Temporal Error details: {e.__dict__}")
        except Exception as e:
            logger.error(f"Unexpected error in create_user_subscription: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")

    def launch_subscription_task(self, user):
        """Helper method to launch the async task in a sync context"""
        logger.info(f"Launching subscription task for user {user.id}")
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            logger.info("Created new event loop")
            try:
                loop.run_until_complete(self.create_user_subscription(user))
                logger.info("Successfully completed subscription task")
            except Exception as e:
                logger.error(f"Error in event loop execution: {str(e)}")
                import traceback
                logger.error(f"Event loop error traceback: {traceback.format_exc()}")
            finally:
                loop.close()
                logger.info("Closed event loop")
        except Exception as e:
            logger.error(f"Error in launch_subscription_task: {str(e)}")
            import traceback
            logger.error(f"Launch task error traceback: {traceback.format_exc()}")

    def post(self, request, *args, **kwargs):
        logger.info("Starting user registration process")
        logger.info(f"Received registration data: {request.data}")
        
        try:
            serializer = UserSerializer(data=request.data)
            logger.info("Created UserSerializer")
        except Exception as e:
            logger.error(f"Error creating serializer: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
        if serializer.is_valid():
            logger.info("Serializer validation passed")
            try:
                # Validate password against custom password policies
                validate_password(serializer.validated_data['password'])
                logger.info("Password validation passed")
                
                user = serializer.save()
                logger.info(f"Created user with ID: {user.id}")
                
                # Generate tokens
                refresh = RefreshToken.for_user(user)
                logger.info("Generated refresh token")
                
                # Create response object
                response = Response({
                    'message': 'User registered successfully',
                    'user': UserSerializer(user).data
                }, status=status.HTTP_201_CREATED)
                
                # Set JWT cookies
                response.set_cookie(
                    'refresh_token',
                    str(refresh),
                    httponly=True,
                    samesite='Strict',
                    secure=True,
                    max_age=3600 * 24 * 7  # 7 days
                )
                response.set_cookie(
                    'access_token',
                    str(refresh.access_token),
                    httponly=True,
                    samesite='Strict',
                    secure=True,
                    max_age=3600  # 1 hour
                )
                
                # Launch subscription task in a separate thread
                thread = threading.Thread(target=self.launch_subscription_task, args=(user,))
                thread.start()
                logger.info("Launched subscription task thread")
                
                return response
                
            except ValidationError as e:
                logger.error(f"Password validation error: {str(e)}")
                return Response({
                    'password': list(e.messages)
                }, status=status.HTTP_400_BAD_REQUEST)
                
            except Exception as e:
                logger.error(f"Error creating user: {str(e)}")
                return Response({
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            logger.error(f"Serializer validation failed. Errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserLoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            logger.info(f'Login attempt for email: {request.data.get("email")}')
            serializer = UserLoginSerializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                logger.error(f'Login validation failed: {serializer.errors}')
                return Response(
                    {'error': 'Invalid email or password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            
            # Log token details
            logger.info(f'Generated access token for user {user.email}')
            logger.info(f'Token payload: {refresh.access_token.payload}')
            
            response_data = {
                'access': access_token,
                'refresh': str(refresh),
                'user': {
                    'id': str(user.id),  # Convert UUID to string
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_role': user.user_role,
                    'phone_number': user.phone_number
                }
            }
            
            response = Response(response_data)
            
            # Set access token in cookie
            response.set_cookie(
                'access_token',
                access_token,
                max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                httponly=True,
                samesite='Lax',  # Use 'Strict' in production
                secure=False,  # Set to True in production
            )
            
            # Set refresh token in cookie
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                httponly=True,
                samesite='Lax',  # Use 'Strict' in production
                secure=False,  # Set to True in production
            )
            
            # Log response details
            logger.info(f'Response cookies: {response.cookies}')
            logger.info(f'Response headers: {dict(response.headers)}')
            
            return response
            
        except Exception as e:
            logger.error(f'Login error: {str(e)}')
            return Response(
                {'error': 'An error occurred during login'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserLogoutView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Log authentication details for debugging
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            logger.info(f'Auth header in logout: {auth_header}')
            logger.info(f'User authenticated: {request.user.is_authenticated}')
            
            # Try to get refresh token from cookie first (preferred method)
            refresh_token = request.COOKIES.get('refresh_token')
            
            # Fallback to request body if cookie not present
            if not refresh_token:
                refresh_token = request.data.get('refresh_token')
                logger.info('Using refresh token from request body')
            else:
                logger.info('Using refresh token from cookie')
            
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                logger.info('Token blacklisted successfully')
            else:
                logger.warning('No refresh token found in request')
            
            # Create response and clear auth cookies
            response = Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            
            return response
        except Exception as e:
            logger.error(f'Logout error: {str(e)}')
            return Response({'detail': 'Invalid token or logout failed.'}, status=status.HTTP_400_BAD_REQUEST)

class CustomTokenRefreshView(APIView):
    """
    Custom token refresh view that sets HTTP-only cookies for consistency with login.
    Reimplemented from scratch to avoid IDE warnings about unreachable code.
    """
    permission_classes = ()
    authentication_classes = ()
    
    def post(self, request, *args, **kwargs):
        try:
            # Log the full request data and headers
            logger.info(f"Token refresh request received")
            logger.info(f"Request data: {request.data}")
            logger.info(f"Request headers: {dict(request.headers)}")
            logger.info(f"Request cookies: {request.COOKIES}")
            
            # Check for refresh token in cookies as well
            cookie_refresh_token = request.COOKIES.get('refresh_token')
            if cookie_refresh_token:
                if cookie_refresh_token.strip():
                    logger.info(f"Found non-empty refresh token in cookies")
                else:
                    logger.warning(f"Found empty refresh token in cookies")
                    cookie_refresh_token = None
            
            # Extract refresh token from request data
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                logger.info("No refresh token provided in request data")
                
                # Try to get it from cookies if not in request data
                if cookie_refresh_token:
                    logger.info(f"Using refresh token from cookies instead")
                    refresh_token = cookie_refresh_token
                else:
                    # Try to get it from the Authorization header
                    auth_header = request.headers.get('Authorization')
                    if auth_header and auth_header.startswith('Bearer '):
                        logger.info(f"Using token from Authorization header")
                        refresh_token = auth_header.split(' ')[1]
                    else:
                        # Try one more time with the cookie header
                        cookie_header = request.headers.get('Cookie')
                        if cookie_header:
                            logger.info(f"Trying to extract refresh token from Cookie header")
                            cookies = {}
                            for cookie in cookie_header.split(';'):
                                if '=' in cookie:
                                    name, value = cookie.split('=', 1)
                                    cookies[name.strip()] = value.strip()
                            
                            if 'refresh_token' in cookies and cookies['refresh_token']:
                                logger.info(f"Found refresh token in Cookie header")
                                refresh_token = cookies['refresh_token']
                            else:
                                logger.error("No refresh token found in Cookie header")
                        
                        if not refresh_token:
                            logger.error("No refresh token found in request data, cookies, or Authorization header")
                            return Response(
                                {"detail": "No refresh token provided. Please ensure you have a valid refresh token."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
            else:
                logger.info(f"Found refresh token in request data")
            
            # Validate the token is not empty
            if not refresh_token or not refresh_token.strip():
                logger.error("Refresh token is empty")
                return Response(
                    {"detail": "Refresh token cannot be empty. Please provide a valid refresh token."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Log the token length for debugging (don't log the actual token for security)
            logger.info(f"Refresh token length: {len(refresh_token)}")
            
            # Validate the refresh token
            try:
                # Create a RefreshToken instance
                logger.info(f"Attempting to validate refresh token")
                refresh = RefreshToken(refresh_token)
                
                # Get the access token
                access_token = str(refresh.access_token)
                logger.info(f"Generated new access token")
                
                # Prepare response data
                response_data = {'access': access_token}
                
                # If token rotation is enabled, include the new refresh token
                if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                    # Blacklist the old token if blacklisting is enabled
                    if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                        try:
                            refresh.blacklist()
                        except AttributeError:
                            # Blacklist app might not be installed
                            pass
                    
                    # Update the refresh token
                    refresh.set_jti()
                    refresh.set_exp()
                    refresh.set_iat()
                    
                    # Include the new refresh token in the response
                    response_data['refresh'] = str(refresh)
                
                # Create response
                response = Response(response_data)
                
                # Set access token in cookie
                response.set_cookie(
                    'access_token',
                    access_token,
                    max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                    httponly=True,
                    samesite='Lax',  # Use 'Strict' in production
                    secure=False,  # Set to True in production
                )
                
                # If a new refresh token was generated, set it in a cookie too
                if 'refresh' in response_data:
                    response.set_cookie(
                        'refresh_token',
                        response_data['refresh'],
                        max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                        httponly=True,
                        samesite='Lax',  # Use 'Strict' in production
                        secure=False,  # Set to True in production
                    )
                
                logger.info("Token refresh successful, cookies set")
                return response
                
            except TokenError as e:
                logger.error(f"Token refresh error: {str(e)}")
                return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            logger.error(f"Unexpected error in token refresh: {str(e)}")
            return Response({"detail": "An error occurred during token refresh"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                # Validate new password
                validate_password(serializer.validated_data['new_password'])
                
                user = request.user
                user.set_password(serializer.validated_data['new_password'])
                user.save()
                
                # Invalidate all existing sessions
                RefreshToken.for_user(user)
                
                # Log password change details for debugging
                logger.info(f'Password changed for user: {user.email}')
                logger.info(f'Request data: {request.data}')
                
                return Response({
                    'message': 'Password changed successfully. Please login again.'
                }, status=status.HTTP_200_OK)
            except ValidationError as e:
                return Response({'new_password': e.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetRequestView(APIView):
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                # Generate password reset token
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                
                # Log password reset request details for debugging
                logger.info(f'Password reset requested for user: {user.email}')
                logger.info(f'Request data: {request.data}')
                
                # TODO: Send password reset email with token
                # For MVP, we'll just return the token in response
                return Response({
                    'message': 'Password reset instructions sent',
                    'uid': uid,
                    'token': token
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                # Don't reveal whether a user exists
                pass
        return Response({
            'message': 'If an account exists with this email, you will receive password reset instructions.'
        }, status=status.HTTP_200_OK)

class PasswordResetConfirmView(APIView):
    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        if not all([uid, token, new_password]):
            return Response({
                'message': 'Invalid reset link'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid)
            
            if default_token_generator.check_token(user, token):
                try:
                    validate_password(new_password)
                    user.set_password(new_password)
                    user.save()
                    
                    # Log password reset details for debugging
                    logger.info(f'Password reset for user: {user.email}')
                    logger.info(f'Request data: {request.data}')
                    
                    return Response({
                        'message': 'Password reset successful'
                    }, status=status.HTTP_200_OK)
                except ValidationError as e:
                    return Response({'new_password': e.messages}, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    'message': 'Invalid reset link'
                }, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError, User.DoesNotExist):
            return Response({
                'message': 'Invalid reset link'
            }, status=status.HTTP_400_BAD_REQUEST)

class CustomTokenVerifyView(TokenVerifyView):
    """
    Custom token verification view that provides enhanced error handling and logging.
    Takes a token and indicates if it is valid.
    """
    
    def post(self, request, *args, **kwargs):
        logger.info('Token verification request received')
        
        try:
            # Use the parent class's serializer to validate the token
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # If we reach here, the token is valid
            logger.info('Token verified successfully')
            
            # Return additional information about the token
            return Response({
                'valid': True,
                'message': 'Token is valid'
            }, status=status.HTTP_200_OK)
            
        except TokenError as e:
            logger.warning(f'Token verification failed: {str(e)}')
            return Response({
                'valid': False,
                'detail': 'Token is invalid or expired',
                'error': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)
            
        except Exception as e:
            logger.error(f'Unexpected error during token verification: {str(e)}')
            return Response({
                'valid': False,
                'detail': 'An error occurred during token verification',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
