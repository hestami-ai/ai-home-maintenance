#!/usr/bin/env python3
"""
Simple test script to verify STAFF endpoints work correctly.
Run this in the Django container: python manage.py shell < test_staff_endpoints.py
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hestami_ai_project.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.test import RequestFactory
from services.views.base_views import staff_queue_dashboard, update_service_request_status
from services.models.base_models import ServiceRequest, ServiceCategory
from properties.models import Property
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

def test_staff_endpoints():
    print("🧪 Testing STAFF endpoints...")
    
    # Create test data
    factory = RequestFactory()
    
    # Create or get STAFF user
    staff_user, created = User.objects.get_or_create(
        username='test_staff',
        defaults={
            'email': 'staff@test.com',
            'first_name': 'Test',
            'last_name': 'Staff',
            'user_role': 'STAFF',
            'is_staff': True
        }
    )
    
    # Create test property
    test_property, created = Property.objects.get_or_create(
        title='Test Property',
        defaults={
            'address': '123 Test St',
            'city': 'Test City',
            'state': 'TS',
            'zip_code': '12345'
        }
    )
    
    # Create test service request
    test_request, created = ServiceRequest.objects.get_or_create(
        title='Test HVAC Repair',
        defaults={
            'property': test_property,
            'category': ServiceCategory.HVAC,
            'description': 'Test description',
            'status': ServiceRequest.Status.PENDING,
            'priority': ServiceRequest.Priority.MEDIUM,
            'assigned_to': staff_user
        }
    )
    
    # Generate JWT token
    refresh = RefreshToken.for_user(staff_user)
    access_token = str(refresh.access_token)
    
    print(f"✅ Created test user: {staff_user.username}")
    print(f"✅ Created test request: {test_request.title}")
    
    # Test queue dashboard endpoint
    print("\n📊 Testing queue dashboard endpoint...")
    request = factory.get('/api/services/requests/queue/')
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'
    request.user = staff_user
    
    try:
        response = staff_queue_dashboard(request)
        print(f"✅ Queue dashboard status: {response.status_code}")
        if response.status_code == 200:
            data = response.data
            print(f"   - Total requests: {data['queue_counts']['total']}")
            print(f"   - My queue: {data['queue_counts']['my_queue']}")
            print(f"   - Pending: {data['queue_counts']['pending']}")
    except Exception as e:
        print(f"❌ Queue dashboard error: {e}")
    
    # Test status update endpoint
    print("\n🔄 Testing status update endpoint...")
    request = factory.patch(f'/api/services/requests/{test_request.id}/status/', {
        'status': 'IN_RESEARCH',
        'reason': 'Moving to research phase'
    })
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'
    request.user = staff_user
    
    try:
        response = update_service_request_status(request, test_request.id)
        print(f"✅ Status update status: {response.status_code}")
        if response.status_code == 200:
            data = response.data
            print(f"   - Old status: {data['old_status']}")
            print(f"   - New status: {data['new_status']}")
            
            # Verify the change
            test_request.refresh_from_db()
            print(f"   - Verified new status: {test_request.status}")
    except Exception as e:
        print(f"❌ Status update error: {e}")
    
    print("\n🎉 STAFF endpoint testing complete!")

if __name__ == '__main__':
    test_staff_endpoints()
