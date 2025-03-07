'use client';

import React, { useState, useEffect } from 'react';

type PropertyType = 'single-family' | 'townhome' | 'apartment';

interface DescriptivesFormData {
  propertyType: PropertyType;
  unitNumber: string;
  gatedCommunity: boolean;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  yearBuilt: string;
  garage: boolean;
  garageCapacity?: string;
  basement: boolean;
  basementFinished?: boolean;
  utilities: {
    electricity: string;
    gas: string;
    water: string;
    sewer: string;
    internetCable: string;
  };
  solarPanels?: boolean;
  heatingSystem: string;
  airConditioning: boolean;
  lotSize?: string;
  fencedYard?: boolean;
  pool?: boolean;
  poolType?: 'in-ground' | 'above-ground';
  sprinklerSystem?: boolean;
  sharedWalls?: boolean;
  floorNumber?: string;
  freightElevator?: boolean;
  passengerElevator?: boolean;
  parkingSpaces?: string;
  assignedParking?: boolean;
  hoaContact?: string;
  hoaRules?: string;
  quietHours?: string;
  knownIssues?: string;
  recentRenovations?: boolean;
  renovationDetails?: string;
}

interface DescriptivesSectionProps {
  propertyId: string;
  initialData?: Partial<DescriptivesFormData>;
  onSave?: (data: DescriptivesFormData) => Promise<void>;
}

const defaultUtilities = {
  electricity: '',
  gas: '',
  water: '',
  sewer: '',
  internetCable: '',
};

const defaultFormData: DescriptivesFormData = {
  propertyType: 'single-family',
  unitNumber: '',
  gatedCommunity: false,
  squareFootage: '',
  bedrooms: '',
  bathrooms: '',
  yearBuilt: '',
  garage: false,
  basement: false,
  utilities: defaultUtilities,
  heatingSystem: '',
  airConditioning: false,
};

export default function DescriptivesSection({ propertyId, initialData, onSave }: DescriptivesSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyType>('single-family');
  const [formData, setFormData] = useState<DescriptivesFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      // Ensure utilities object is properly initialized
      const utilities = {
        ...defaultUtilities,
        ...(initialData.utilities || {}),
      };

      setFormData(prevData => ({
        ...defaultFormData,
        ...initialData,
        utilities,
        propertyType: (initialData.propertyType as PropertyType) || prevData.propertyType,
      }));
      
      if (initialData.propertyType) {
        setPropertyType(initialData.propertyType as PropertyType);
      }
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUtilityChange = (utility: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        [utility]: value
      }
    }));
  };

  const handlePropertyTypeChange = (type: PropertyType) => {
    setPropertyType(type);
    setFormData(prev => ({
      ...prev,
      propertyType: type
    }));
  };

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(formData);
        setIsEditing(false);
      } catch (error) {
        console.error('Error saving descriptives:', error);
        // TODO: Add error handling UI
      } finally {
        setIsSaving(false);
      }
    }
  };

  const renderCommonFields = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="unitNumber" className="block text-sm font-medium text-foreground mb-1">
            Unit Number
          </label>
          <input
            id="unitNumber"
            type="text"
            value={formData.unitNumber}
            onChange={(e) => handleInputChange('unitNumber', e.target.value)}
            disabled={!isEditing}
            className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            placeholder="Enter unit number"
            aria-label="Unit Number"
          />
        </div>
        <div>
          <label htmlFor="gatedCommunity" className="block text-sm font-medium text-foreground mb-1">
            Gated Community
          </label>
          <input
            id="gatedCommunity"
            type="checkbox"
            checked={formData.gatedCommunity}
            onChange={(e) => handleInputChange('gatedCommunity', e.target.checked)}
            disabled={!isEditing}
            className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
            aria-label="Gated Community"
          />
        </div>
        <div>
          <label htmlFor="squareFootage" className="block text-sm font-medium text-foreground mb-1">
            Square Footage
          </label>
          <input
            id="squareFootage"
            type="text"
            value={formData.squareFootage}
            onChange={(e) => handleInputChange('squareFootage', e.target.value)}
            disabled={!isEditing}
            className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            placeholder="Enter square footage"
            aria-label="Square Footage"
          />
        </div>
        <div>
          <label htmlFor="bedrooms" className="block text-sm font-medium text-foreground mb-1">
            Bedrooms
          </label>
          <input
            id="bedrooms"
            type="number"
            value={formData.bedrooms}
            onChange={(e) => handleInputChange('bedrooms', e.target.value)}
            disabled={!isEditing}
            className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            placeholder="Number of bedrooms"
            aria-label="Number of Bedrooms"
            min="0"
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className="block text-sm font-medium text-foreground mb-1">
            Bathrooms
          </label>
          <input
            id="bathrooms"
            type="number"
            value={formData.bathrooms}
            onChange={(e) => handleInputChange('bathrooms', e.target.value)}
            disabled={!isEditing}
            className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            placeholder="Number of bathrooms"
            aria-label="Number of Bathrooms"
            min="0"
            step="0.5"
          />
        </div>
        <div>
          <label htmlFor="yearBuilt" className="block text-sm font-medium text-foreground mb-1">
            Year Built
          </label>
          <input
            id="yearBuilt"
            type="number"
            value={formData.yearBuilt}
            onChange={(e) => handleInputChange('yearBuilt', e.target.value)}
            disabled={!isEditing}
            className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            placeholder="Enter year built"
            aria-label="Year Built"
            min="1900"
            max="2100"
          />
        </div>
        <div>
          <label htmlFor="garage" className="block text-sm font-medium text-foreground mb-1">
            Garage
          </label>
          <input
            id="garage"
            type="checkbox"
            checked={formData.garage}
            onChange={(e) => handleInputChange('garage', e.target.checked)}
            disabled={!isEditing}
            className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
            aria-label="Has Garage"
          />
        </div>
        {formData.garage && (
          <div>
            <label htmlFor="garageCapacity" className="block text-sm font-medium text-foreground mb-1">
              Garage Capacity
            </label>
            <input
              id="garageCapacity"
              type="number"
              value={formData.garageCapacity || ''}
              onChange={(e) => handleInputChange('garageCapacity', e.target.value)}
              disabled={!isEditing}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="Enter garage capacity"
              aria-label="Garage Capacity"
              min="0"
            />
          </div>
        )}
        <div>
          <label htmlFor="basement" className="block text-sm font-medium text-foreground mb-1">
            Basement
          </label>
          <input
            id="basement"
            type="checkbox"
            checked={formData.basement}
            onChange={(e) => handleInputChange('basement', e.target.checked)}
            disabled={!isEditing}
            className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
            aria-label="Has Basement"
          />
        </div>
        {formData.basement && (
          <div>
            <label htmlFor="basementFinished" className="block text-sm font-medium text-foreground mb-1">
              Basement Finished
            </label>
            <input
              id="basementFinished"
              type="checkbox"
              checked={formData.basementFinished || false}
              onChange={(e) => handleInputChange('basementFinished', e.target.checked)}
              disabled={!isEditing}
              className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
              aria-label="Basement Finished"
            />
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Utilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(formData.utilities).map(([utility, value]) => (
            <div key={utility}>
              <label
                htmlFor={`utility-${utility}`}
                className="block text-sm font-medium text-foreground mb-1"
              >
                {utility.charAt(0).toUpperCase() + utility.slice(1)}
              </label>
              <input
                id={`utility-${utility}`}
                type="text"
                value={value}
                onChange={(e) => handleUtilityChange(utility, e.target.value)}
                disabled={!isEditing}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                placeholder={`Enter ${utility} provider`}
                aria-label={`${utility} provider`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Basic Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="heatingSystem" className="block text-sm font-medium text-foreground mb-1">
              Heating System
            </label>
            <input
              id="heatingSystem"
              type="text"
              value={formData.heatingSystem}
              onChange={(e) => handleInputChange('heatingSystem', e.target.value)}
              disabled={!isEditing}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="Enter heating system type"
              aria-label="Heating System Type"
            />
          </div>
          <div>
            <label htmlFor="airConditioning" className="block text-sm font-medium text-foreground mb-1">
              Air Conditioning
            </label>
            <input
              id="airConditioning"
              type="checkbox"
              checked={formData.airConditioning}
              onChange={(e) => handleInputChange('airConditioning', e.target.checked)}
              disabled={!isEditing}
              className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
              aria-label="Air Conditioning Available"
            />
          </div>
          <div>
            <label htmlFor="solarPanels" className="block text-sm font-medium text-foreground mb-1">
              Solar Panels
            </label>
            <input
              id="solarPanels"
              type="checkbox"
              checked={formData.solarPanels || false}
              onChange={(e) => handleInputChange('solarPanels', e.target.checked)}
              disabled={!isEditing}
              className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
              aria-label="Has Solar Panels"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Additional Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="hoaContact" className="block text-sm font-medium text-foreground mb-1">
              HOA Contact
            </label>
            <input
              id="hoaContact"
              type="text"
              value={formData.hoaContact || ''}
              onChange={(e) => handleInputChange('hoaContact', e.target.value)}
              disabled={!isEditing}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="Enter HOA contact"
              aria-label="HOA Contact"
            />
          </div>
          <div>
            <label htmlFor="hoaRules" className="block text-sm font-medium text-foreground mb-1">
              HOA Rules
            </label>
            <input
              id="hoaRules"
              type="text"
              value={formData.hoaRules || ''}
              onChange={(e) => handleInputChange('hoaRules', e.target.value)}
              disabled={!isEditing}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="Enter HOA rules"
              aria-label="HOA Rules"
            />
          </div>
          <div>
            <label htmlFor="knownIssues" className="block text-sm font-medium text-foreground mb-1">
              Known Issues
            </label>
            <input
              id="knownIssues"
              type="text"
              value={formData.knownIssues || ''}
              onChange={(e) => handleInputChange('knownIssues', e.target.value)}
              disabled={!isEditing}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="Enter known issues"
              aria-label="Known Issues"
            />
          </div>
          <div>
            <label htmlFor="recentRenovations" className="block text-sm font-medium text-foreground mb-1">
              Recent Renovations
            </label>
            <input
              id="recentRenovations"
              type="checkbox"
              checked={formData.recentRenovations || false}
              onChange={(e) => handleInputChange('recentRenovations', e.target.checked)}
              disabled={!isEditing}
              className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
              aria-label="Has Recent Renovations"
            />
          </div>
          {formData.recentRenovations && (
            <div>
              <label htmlFor="renovationDetails" className="block text-sm font-medium text-foreground mb-1">
                Renovation Details
              </label>
              <input
                id="renovationDetails"
                type="text"
                value={formData.renovationDetails || ''}
                onChange={(e) => handleInputChange('renovationDetails', e.target.value)}
                disabled={!isEditing}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                placeholder="Enter renovation details"
                aria-label="Renovation Details"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPropertyTypeSpecificFields = () => {
    switch (propertyType) {
      case 'single-family':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Single-Family Specific Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lotSize" className="block text-sm font-medium text-foreground mb-1">
                  Lot Size
                </label>
                <input
                  id="lotSize"
                  type="text"
                  value={formData.lotSize || ''}
                  onChange={(e) => handleInputChange('lotSize', e.target.value)}
                  disabled={!isEditing}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                  placeholder="Enter lot size"
                  aria-label="Lot Size"
                />
              </div>
              <div>
                <label htmlFor="fencedYard" className="block text-sm font-medium text-foreground mb-1">
                  Fenced Yard
                </label>
                <input
                  id="fencedYard"
                  type="checkbox"
                  checked={formData.fencedYard || false}
                  onChange={(e) => handleInputChange('fencedYard', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Fenced Yard Available"
                />
              </div>
              <div>
                <label htmlFor="pool" className="block text-sm font-medium text-foreground mb-1">
                  Pool
                </label>
                <input
                  id="pool"
                  type="checkbox"
                  checked={formData.pool || false}
                  onChange={(e) => handleInputChange('pool', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Pool Available"
                />
              </div>
              {formData.pool && (
                <div>
                  <label htmlFor="poolType" className="block text-sm font-medium text-foreground mb-1">
                    Pool Type
                  </label>
                  <select
                    id="poolType"
                    value={formData.poolType || ''}
                    onChange={(e) => handleInputChange('poolType', e.target.value)}
                    disabled={!isEditing}
                    className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                    aria-label="Pool Type"
                  >
                    <option value="">Select pool type</option>
                    <option value="in-ground">In-Ground</option>
                    <option value="above-ground">Above-Ground</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="sprinklerSystem" className="block text-sm font-medium text-foreground mb-1">
                  Sprinkler System
                </label>
                <input
                  id="sprinklerSystem"
                  type="checkbox"
                  checked={formData.sprinklerSystem || false}
                  onChange={(e) => handleInputChange('sprinklerSystem', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Sprinkler System Available"
                />
              </div>
            </div>
          </div>
        );
      case 'townhome':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Townhome Specific Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sharedWalls" className="block text-sm font-medium text-foreground mb-1">
                  Shared Walls
                </label>
                <input
                  id="sharedWalls"
                  type="checkbox"
                  checked={formData.sharedWalls || false}
                  onChange={(e) => handleInputChange('sharedWalls', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Has Shared Walls"
                />
              </div>
              <div>
                <label htmlFor="quietHours" className="block text-sm font-medium text-foreground mb-1">
                  Quiet Hours
                </label>
                <input
                  id="quietHours"
                  type="text"
                  value={formData.quietHours || ''}
                  onChange={(e) => handleInputChange('quietHours', e.target.value)}
                  disabled={!isEditing}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                  placeholder="Enter quiet hours"
                  aria-label="Quiet Hours"
                />
              </div>
            </div>
          </div>
        );
      case 'apartment':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Apartment/Condo Specific Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="floorNumber" className="block text-sm font-medium text-foreground mb-1">
                  Floor Number
                </label>
                <input
                  id="floorNumber"
                  type="text"
                  value={formData.floorNumber || ''}
                  onChange={(e) => handleInputChange('floorNumber', e.target.value)}
                  disabled={!isEditing}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                  placeholder="Enter floor number"
                  aria-label="Floor Number"
                />
              </div>
              <div>
                <label htmlFor="parkingSpaces" className="block text-sm font-medium text-foreground mb-1">
                  Parking Spaces
                </label>
                <input
                  id="parkingSpaces"
                  type="number"
                  value={formData.parkingSpaces || ''}
                  onChange={(e) => handleInputChange('parkingSpaces', e.target.value)}
                  disabled={!isEditing}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                  placeholder="Number of parking spaces"
                  aria-label="Number of Parking Spaces"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="assignedParking" className="block text-sm font-medium text-foreground mb-1">
                  Assigned Parking
                </label>
                <input
                  id="assignedParking"
                  type="checkbox"
                  checked={formData.assignedParking || false}
                  onChange={(e) => handleInputChange('assignedParking', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Has Assigned Parking"
                />
              </div>
              <div>
                <label htmlFor="freightElevator" className="block text-sm font-medium text-foreground mb-1">
                  Freight Elevator
                </label>
                <input
                  id="freightElevator"
                  type="checkbox"
                  checked={formData.freightElevator || false}
                  onChange={(e) => handleInputChange('freightElevator', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Has Freight Elevator"
                />
              </div>
              <div>
                <label htmlFor="passengerElevator" className="block text-sm font-medium text-foreground mb-1">
                  Passenger Elevator
                </label>
                <input
                  id="passengerElevator"
                  type="checkbox"
                  checked={formData.passengerElevator || false}
                  onChange={(e) => handleInputChange('passengerElevator', e.target.checked)}
                  disabled={!isEditing}
                  className="h-5 w-5 text-secondary-main rounded disabled:opacity-50"
                  aria-label="Has Passenger Elevator"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-background p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-foreground">Property Descriptives</h2>
        <div className="space-x-4">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 text-sm rounded-md bg-primary-main text-white hover:bg-primary-dark"
            aria-label={isEditing ? "Cancel editing" : "Edit property details"}
            disabled={isSaving}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {isEditing && (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm rounded-md bg-secondary-main text-white hover:bg-secondary-dark disabled:opacity-50"
              aria-label="Save property details"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="propertyType" className="block text-sm font-medium text-foreground mb-2">
          Property Type
        </label>
        <select
          id="propertyType"
          value={propertyType}
          onChange={(e) => handlePropertyTypeChange(e.target.value as PropertyType)}
          disabled={!isEditing}
          className="w-full md:w-auto p-2 border rounded-md bg-background disabled:opacity-50"
          aria-label="Select property type"
        >
          <option value="single-family">Single-Family Home</option>
          <option value="townhome">Townhome</option>
          <option value="apartment">Apartment/Condominium</option>
        </select>
      </div>

      <div className="space-y-8">
        {renderCommonFields()}
        {renderPropertyTypeSpecificFields()}
      </div>
    </div>
  );
}