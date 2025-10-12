"""
API views for property descriptives schema.
Provides schema structure and field choices to the frontend.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .descriptives_schema import (
    DEFAULT_DESCRIPTIVES,
    PROPERTY_TYPE_CHOICES,
    HEATING_SYSTEM_CHOICES,
    COOLING_SYSTEM_CHOICES,
    ROOF_TYPE_CHOICES,
    EXTERIOR_MATERIAL_CHOICES,
    FOUNDATION_TYPE_CHOICES,
    PARKING_TYPE_CHOICES,
    BASEMENT_TYPE_CHOICES,
    GARAGE_TYPE_CHOICES,
    POOL_TYPE_CHOICES,
    FENCE_TYPE_CHOICES,
    DECK_MATERIAL_CHOICES,
    PATIO_MATERIAL_CHOICES,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_descriptives_schema(request):
    """
    Get the default descriptives schema structure.
    Returns the complete field structure with default values.
    """
    return Response({
        'schema': DEFAULT_DESCRIPTIVES,
        'version': '1.0'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_descriptives_choices(request):
    """
    Get all field choices for dropdowns.
    Returns choice lists for all enum-type fields.
    """
    return Response({
        'propertyType': PROPERTY_TYPE_CHOICES,
        'heatingSystem': HEATING_SYSTEM_CHOICES,
        'coolingSystem': COOLING_SYSTEM_CHOICES,
        'roofType': ROOF_TYPE_CHOICES,
        'exteriorMaterial': EXTERIOR_MATERIAL_CHOICES,
        'foundationType': FOUNDATION_TYPE_CHOICES,
        'parkingType': PARKING_TYPE_CHOICES,
        'basementType': BASEMENT_TYPE_CHOICES,
        'garageType': GARAGE_TYPE_CHOICES,
        'poolType': POOL_TYPE_CHOICES,
        'fenceType': FENCE_TYPE_CHOICES,
        'heatingFuel': [
            ('natural_gas', 'Natural Gas'),
            ('electric', 'Electric'),
            ('oil', 'Oil'),
            ('propane', 'Propane'),
            ('solar', 'Solar'),
            ('other', 'Other'),
        ],
        'thermostatType': [
            ('programmable', 'Programmable'),
            ('smart', 'Smart'),
            ('manual', 'Manual'),
        ],
        'waterSource': [
            ('municipal', 'Municipal'),
            ('well', 'Well'),
            ('shared', 'Shared'),
        ],
        'sewerSystem': [
            ('municipal', 'Municipal'),
            ('septic', 'Septic'),
            ('shared', 'Shared'),
        ],
        'electricalPanel': [
            ('breaker', 'Breaker'),
            ('fuse', 'Fuse'),
        ],
        'plumbingType': [
            ('copper', 'Copper'),
            ('pex', 'PEX'),
            ('galvanized', 'Galvanized'),
            ('pvc', 'PVC'),
            ('mixed', 'Mixed'),
        ],
        'wiringType': [
            ('copper', 'Copper'),
            ('aluminum', 'Aluminum'),
            ('knob_tube', 'Knob & Tube'),
            ('mixed', 'Mixed'),
        ],
        'waterHeaterType': [
            ('tank', 'Tank'),
            ('tankless', 'Tankless'),
            ('hybrid', 'Hybrid'),
            ('solar', 'Solar'),
            ('other', 'Other'),
        ],
        'waterHeaterFuel': [
            ('electric', 'Electric'),
            ('gas', 'Gas'),
            ('propane', 'Propane'),
            ('solar', 'Solar'),
            ('other', 'Other'),
        ],
        'fireplaceType': [
            ('wood', 'Wood'),
            ('gas', 'Gas'),
            ('electric', 'Electric'),
            ('none', 'None'),
        ],
        'atticAccess': [
            ('pull_down', 'Pull Down'),
            ('stairway', 'Stairway'),
            ('scuttle', 'Scuttle'),
            ('none', 'None'),
        ],
        'deckMaterial': DECK_MATERIAL_CHOICES,
        'patioMaterial': PATIO_MATERIAL_CHOICES,
    })
