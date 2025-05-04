from django.urls import path
from . import views

app_name = 'properties'

urlpatterns = [
    path('', views.list_properties, name='list_properties'),
    path('create/', views.create_property, name='create_property'),
    path('<uuid:property_id>/', views.property_detail, name='property_detail'),
    path('<uuid:property_id>/update/', views.update_property, name='update_property'),
    path('<uuid:property_id>/delete/', views.delete_property, name='delete_property'),
    path('<uuid:property_id>/access/', views.grant_property_access, name='grant_property_access'),
    path('<uuid:property_id>/access/<uuid:access_id>/', views.update_property_access, name='update_property_access'),
    path('<uuid:property_id>/scraped-data/', views.create_property_scraped_data, name='create_property_scraped_data'),
]
