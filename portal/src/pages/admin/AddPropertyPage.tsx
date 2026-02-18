import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  MapPin,
  DollarSign,
  Home,
  Image,
  FileText,
} from 'lucide-react';
import { propertyService } from '../../lib/firebase';
import { uploadPropertyPhoto } from '../../lib/firebase/storage';
import type { Property, PropertyType, PetPolicy } from '../../types';
import './AddProperty.css';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'single-family', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'multi-family', label: 'Multi-Family' },
  { value: 'apartment', label: 'Apartment' },
];

const APPLIANCE_OPTIONS = [
  'Refrigerator', 'Stove/Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer',
  'Garbage Disposal', 'Range Hood',
];

const UTILITY_OPTIONS = [
  'Water', 'Sewer', 'Trash', 'Electric', 'Gas', 'Internet', 'Cable',
];

interface PropertyForm {
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  propertyType: PropertyType;
  monthlyRent: number;
  securityDeposit: number;
  applicationFee: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  stories: number;
  lotSize: number;
  parking: string;
  parkingSpaces: number;
  laundry: string;
  heatingType: string;
  coolingType: string;
  flooringTypes: string;
  smokingAllowed: boolean;
  maxOccupancy: number;
  incomeRequirement: number;
  petAllowed: boolean;
  petDeposit: number;
  petMonthlyRent: number;
  petRestrictions: string;
  appliances: string[];
  utilitiesIncluded: string[];
  utilitiesTenantResponsibility: string[];
  publicDescription: string;
  neighborhoodDescription: string;
  nearbyAmenities: string;
  schoolDistrict: string;
  internalNotes: string;
  marketStatus: 'on' | 'off';
  acceptingApplications: boolean;
  lat: number;
  lng: number;
}

const defaultForm: PropertyForm = {
  address: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  propertyType: 'single-family',
  monthlyRent: 0,
  securityDeposit: 0,
  applicationFee: 50,
  bedrooms: 1,
  bathrooms: 1,
  sqft: 0,
  yearBuilt: new Date().getFullYear(),
  stories: 1,
  lotSize: 0,
  parking: 'driveway',
  parkingSpaces: 1,
  laundry: 'in-unit',
  heatingType: '',
  coolingType: '',
  flooringTypes: '',
  smokingAllowed: false,
  maxOccupancy: 4,
  incomeRequirement: 3,
  petAllowed: false,
  petDeposit: 0,
  petMonthlyRent: 0,
  petRestrictions: '',
  appliances: [],
  utilitiesIncluded: [],
  utilitiesTenantResponsibility: [],
  publicDescription: '',
  neighborhoodDescription: '',
  nearbyAmenities: '',
  schoolDistrict: '',
  internalNotes: '',
  marketStatus: 'off',
  acceptingApplications: false,
  lat: 0,
  lng: 0,
};

export function AddPropertyPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<PropertyForm>({ ...defaultForm });
  const [photos, setPhotos] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('basic');
  const [loadingProperty, setLoadingProperty] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      loadProperty(id);
    }
  }, [id]);

  const loadProperty = async (propertyId: string) => {
    setLoadingProperty(true);
    try {
      const property = await propertyService.get(propertyId);
      if (property) {
        setForm({
          address: property.address || '',
          unit: property.unit || '',
          city: property.city || '',
          state: property.state || '',
          zip: property.zip || '',
          propertyType: property.propertyType || 'single-family',
          monthlyRent: property.monthlyRent || 0,
          securityDeposit: property.securityDeposit || 0,
          applicationFee: property.applicationFee || 50,
          bedrooms: property.bedrooms || 1,
          bathrooms: property.bathrooms || 1,
          sqft: property.sqft || 0,
          yearBuilt: property.yearBuilt || new Date().getFullYear(),
          stories: property.stories || 1,
          lotSize: property.lotSize || 0,
          parking: property.parking?.type || 'driveway',
          parkingSpaces: property.parking?.spaces || 1,
          laundry: property.laundry || 'in-unit',
          heatingType: property.heatingType || '',
          coolingType: property.coolingType || '',
          flooringTypes: property.flooringTypes?.join(', ') || '',
          smokingAllowed: property.smokingAllowed || false,
          maxOccupancy: property.maxOccupancy || 4,
          incomeRequirement: property.incomeRequirement || 3,
          petAllowed: property.petPolicy?.allowed || false,
          petDeposit: property.petPolicy?.depositPerPet || 0,
          petMonthlyRent: property.petPolicy?.monthlyRentPerPet || 0,
          petRestrictions: property.petPolicy?.restrictions || '',
          appliances: property.appliances || [],
          utilitiesIncluded: property.utilitiesIncluded || [],
          utilitiesTenantResponsibility: property.utilitiesTenantResponsibility || [],
          publicDescription: property.publicDescription || '',
          neighborhoodDescription: property.neighborhoodDescription || '',
          nearbyAmenities: property.nearbyAmenities || '',
          schoolDistrict: property.schoolDistrict || '',
          internalNotes: property.internalNotes || '',
          marketStatus: property.marketStatus || 'off',
          acceptingApplications: property.acceptingApplications || false,
          lat: property.lat || 0,
          lng: property.lng || 0,
        });
        setPhotos(property.photos || []);
        setCoverPhotoIndex(property.coverPhotoIndex || 0);
      }
    } catch (error) {
      console.error('Error loading property:', error);
      setMessage('Error loading property');
    } finally {
      setLoadingProperty(false);
    }
  };

  const handleChange = (field: keyof PropertyForm, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const tempId = id || `temp_${Date.now()}`;
      const newPhotos = [...photos];

      for (let i = 0; i < files.length; i++) {
        const url = await uploadPropertyPhoto(tempId, files[i], newPhotos.length + i);
        newPhotos.push(url);
      }

      setPhotos(newPhotos);
    } catch (error) {
      console.error('Error uploading photos:', error);
      setMessage('Error uploading photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (coverPhotoIndex >= index && coverPhotoIndex > 0) {
      setCoverPhotoIndex(coverPhotoIndex - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.address || !form.city || !form.state || !form.zip) {
      setMessage('Please fill in all required address fields');
      setActiveSection('basic');
      return;
    }
    if (form.monthlyRent <= 0) {
      setMessage('Please set a valid monthly rent');
      setActiveSection('financial');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const petPolicy: PetPolicy = {
        allowed: form.petAllowed,
        depositPerPet: form.petDeposit,
        monthlyRentPerPet: form.petMonthlyRent,
        restrictions: form.petRestrictions,
      };

      const propertyData: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
        address: form.address,
        unit: form.unit || undefined,
        city: form.city,
        state: form.state,
        zip: form.zip,
        propertyType: form.propertyType,
        monthlyRent: form.monthlyRent,
        securityDeposit: form.securityDeposit,
        applicationFee: form.applicationFee,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        sqft: form.sqft,
        yearBuilt: form.yearBuilt,
        stories: form.stories,
        lotSize: form.lotSize,
        parking: {
          type: form.parking as 'garage' | 'carport' | 'driveway' | 'street' | 'lot',
          spaces: form.parkingSpaces,
        },
        laundry: form.laundry as 'in-unit' | 'on-site' | 'none',
        heatingType: form.heatingType || undefined,
        coolingType: form.coolingType || undefined,
        flooringTypes: form.flooringTypes ? form.flooringTypes.split(',').map(s => s.trim()) : undefined,
        smokingAllowed: form.smokingAllowed,
        maxOccupancy: form.maxOccupancy,
        incomeRequirement: form.incomeRequirement,
        petPolicy,
        appliances: form.appliances,
        utilitiesIncluded: form.utilitiesIncluded,
        utilitiesTenantResponsibility: form.utilitiesTenantResponsibility,
        publicDescription: form.publicDescription || undefined,
        neighborhoodDescription: form.neighborhoodDescription || undefined,
        nearbyAmenities: form.nearbyAmenities || undefined,
        schoolDistrict: form.schoolDistrict || undefined,
        internalNotes: form.internalNotes || undefined,
        photos,
        coverPhotoIndex,
        marketStatus: form.marketStatus,
        occupancyStatus: 'vacant',
        acceptingApplications: form.acceptingApplications,
        lat: form.lat || undefined,
        lng: form.lng || undefined,
      };

      if (isEditing && id) {
        await propertyService.update(id, propertyData);
        setMessage('Property updated successfully!');
      } else {
        await propertyService.create(propertyData);
        setMessage('Property created successfully!');
        setTimeout(() => navigate('/admin/properties'), 1500);
      }
    } catch (error) {
      console.error('Error saving property:', error);
      setMessage('Error saving property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: <Home size={16} /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={16} /> },
    { id: 'details', label: 'Details', icon: <FileText size={16} /> },
    { id: 'photos', label: 'Photos', icon: <Image size={16} /> },
    { id: 'location', label: 'Location', icon: <MapPin size={16} /> },
  ];

  if (loadingProperty) {
    return (
      <div className="add-property-page">
        <div className="page-header">
          <h1>Loading property...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="add-property-page">
      <div className="page-header">
        <div className="header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/admin/properties')}>
            <ArrowLeft size={18} />
            Back
          </button>
          <div>
            <h1>{isEditing ? 'Edit Property' : 'Add New Property'}</h1>
            <p>{isEditing ? 'Update property details' : 'Create a new property listing'}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          <Save size={18} />
          {saving ? 'Saving...' : isEditing ? 'Update Property' : 'Create Property'}
        </button>
      </div>

      {message && (
        <div className={`form-message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="property-form-layout">
        {/* Section Navigation */}
        <div className="section-nav">
          {sections.map(section => (
            <button
              key={section.id}
              className={`section-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.icon}
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        {/* Form Content */}
        <form className="property-form" onSubmit={handleSubmit}>

          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="form-section">
              <h2>Basic Information</h2>
              <p className="section-hint">Enter the property address and type</p>

              <div className="form-group">
                <label className="form-label">Street Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.address}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit / Apt #</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.unit}
                  onChange={e => handleChange('unit', e.target.value)}
                  placeholder="e.g. 2B"
                />
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.city}
                    onChange={e => handleChange('city', e.target.value)}
                    placeholder="Springfield"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.state}
                    onChange={e => handleChange('state', e.target.value)}
                    placeholder="IL"
                    maxLength={2}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ZIP *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.zip}
                    onChange={e => handleChange('zip', e.target.value)}
                    placeholder="62701"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select
                    className="form-input"
                    value={form.propertyType}
                    onChange={e => handleChange('propertyType', e.target.value)}
                  >
                    {PROPERTY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Year Built</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.yearBuilt}
                    onChange={e => handleChange('yearBuilt', parseInt(e.target.value))}
                    min={1800}
                    max={new Date().getFullYear() + 2}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Bedrooms</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.bedrooms}
                    onChange={e => handleChange('bedrooms', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bathrooms</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.bathrooms}
                    onChange={e => handleChange('bathrooms', parseFloat(e.target.value))}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sqft</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.sqft}
                    onChange={e => handleChange('sqft', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Stories</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.stories}
                    onChange={e => handleChange('stories', parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Lot Size (sqft)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.lotSize}
                    onChange={e => handleChange('lotSize', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Public Description</label>
                <textarea
                  className="form-textarea"
                  value={form.publicDescription}
                  onChange={e => handleChange('publicDescription', e.target.value)}
                  placeholder="Describe the property for prospective tenants..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Financial Section */}
          {activeSection === 'financial' && (
            <div className="form-section">
              <h2>Financial Details</h2>
              <p className="section-hint">Set the pricing and financial terms</p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Monthly Rent ($) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.monthlyRent}
                    onChange={e => handleChange('monthlyRent', parseInt(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Security Deposit ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.securityDeposit}
                    onChange={e => handleChange('securityDeposit', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Application Fee ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.applicationFee}
                    onChange={e => handleChange('applicationFee', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Income Requirement (x rent)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.incomeRequirement}
                    onChange={e => handleChange('incomeRequirement', parseFloat(e.target.value))}
                    min={0}
                    step={0.5}
                  />
                  <p className="form-hint">e.g. 3 = tenant must earn 3x monthly rent</p>
                </div>
              </div>

              <h3 className="subsection-title">Market & Applications</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Market Status</label>
                  <select
                    className="form-input"
                    value={form.marketStatus}
                    onChange={e => handleChange('marketStatus', e.target.value)}
                  >
                    <option value="on">On Market (Listed)</option>
                    <option value="off">Off Market (Hidden)</option>
                  </select>
                  <p className="form-hint">On Market properties appear on the public website</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Accepting Applications</label>
                  <select
                    className="form-input"
                    value={form.acceptingApplications ? 'yes' : 'no'}
                    onChange={e => handleChange('acceptingApplications', e.target.value === 'yes')}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Details Section */}
          {activeSection === 'details' && (
            <div className="form-section">
              <h2>Property Details</h2>
              <p className="section-hint">Amenities, utilities, and policies</p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Parking Type</label>
                  <select
                    className="form-input"
                    value={form.parking}
                    onChange={e => handleChange('parking', e.target.value)}
                  >
                    <option value="garage">Garage</option>
                    <option value="carport">Carport</option>
                    <option value="driveway">Driveway</option>
                    <option value="street">Street</option>
                    <option value="lot">Parking Lot</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Parking Spaces</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.parkingSpaces}
                    onChange={e => handleChange('parkingSpaces', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Laundry</label>
                  <select
                    className="form-input"
                    value={form.laundry}
                    onChange={e => handleChange('laundry', e.target.value)}
                  >
                    <option value="in-unit">In-Unit</option>
                    <option value="on-site">On-Site</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Heating</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.heatingType}
                    onChange={e => handleChange('heatingType', e.target.value)}
                    placeholder="Central, Baseboard, etc."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cooling</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.coolingType}
                    onChange={e => handleChange('coolingType', e.target.value)}
                    placeholder="Central AC, Window, etc."
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Flooring Types</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.flooringTypes}
                  onChange={e => handleChange('flooringTypes', e.target.value)}
                  placeholder="Hardwood, Tile, Carpet (comma-separated)"
                />
              </div>

              <h3 className="subsection-title">Appliances</h3>
              <div className="checkbox-grid">
                {APPLIANCE_OPTIONS.map(app => (
                  <label key={app} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.appliances.includes(app)}
                      onChange={e => {
                        if (e.target.checked) {
                          handleChange('appliances', [...form.appliances, app]);
                        } else {
                          handleChange('appliances', form.appliances.filter(a => a !== app));
                        }
                      }}
                    />
                    <span>{app}</span>
                  </label>
                ))}
              </div>

              <h3 className="subsection-title">Utilities Included in Rent</h3>
              <div className="checkbox-grid">
                {UTILITY_OPTIONS.map(util => (
                  <label key={util} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.utilitiesIncluded.includes(util)}
                      onChange={e => {
                        if (e.target.checked) {
                          handleChange('utilitiesIncluded', [...form.utilitiesIncluded, util]);
                          handleChange('utilitiesTenantResponsibility', form.utilitiesTenantResponsibility.filter(u => u !== util));
                        } else {
                          handleChange('utilitiesIncluded', form.utilitiesIncluded.filter(u => u !== util));
                        }
                      }}
                    />
                    <span>{util}</span>
                  </label>
                ))}
              </div>

              <h3 className="subsection-title">Tenant-Paid Utilities</h3>
              <div className="checkbox-grid">
                {UTILITY_OPTIONS.filter(u => !form.utilitiesIncluded.includes(u)).map(util => (
                  <label key={util} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.utilitiesTenantResponsibility.includes(util)}
                      onChange={e => {
                        if (e.target.checked) {
                          handleChange('utilitiesTenantResponsibility', [...form.utilitiesTenantResponsibility, util]);
                        } else {
                          handleChange('utilitiesTenantResponsibility', form.utilitiesTenantResponsibility.filter(u => u !== util));
                        }
                      }}
                    />
                    <span>{util}</span>
                  </label>
                ))}
              </div>

              <h3 className="subsection-title">Policies</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Max Occupancy</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.maxOccupancy}
                    onChange={e => handleChange('maxOccupancy', parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Smoking Allowed</label>
                  <select
                    className="form-input"
                    value={form.smokingAllowed ? 'yes' : 'no'}
                    onChange={e => handleChange('smokingAllowed', e.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              <h3 className="subsection-title">Pet Policy</h3>

              <div className="form-group">
                <label className="form-label">Pets Allowed</label>
                <select
                  className="form-input"
                  value={form.petAllowed ? 'yes' : 'no'}
                  onChange={e => handleChange('petAllowed', e.target.value === 'yes')}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {form.petAllowed && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Pet Deposit (per pet)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.petDeposit}
                        onChange={e => handleChange('petDeposit', parseInt(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Monthly Pet Rent (per pet)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.petMonthlyRent}
                        onChange={e => handleChange('petMonthlyRent', parseInt(e.target.value))}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pet Restrictions</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.petRestrictions}
                      onChange={e => handleChange('petRestrictions', e.target.value)}
                      placeholder="e.g. No aggressive breeds, max 50 lbs"
                    />
                  </div>
                </>
              )}

              <h3 className="subsection-title">Neighborhood</h3>

              <div className="form-group">
                <label className="form-label">Neighborhood Description</label>
                <textarea
                  className="form-textarea"
                  value={form.neighborhoodDescription}
                  onChange={e => handleChange('neighborhoodDescription', e.target.value)}
                  placeholder="Describe the neighborhood..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nearby Amenities</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.nearbyAmenities}
                    onChange={e => handleChange('nearbyAmenities', e.target.value)}
                    placeholder="Parks, shopping, transit..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">School District</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.schoolDistrict}
                    onChange={e => handleChange('schoolDistrict', e.target.value)}
                    placeholder="e.g. Springfield USD 186"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Internal Notes (admin only)</label>
                <textarea
                  className="form-textarea"
                  value={form.internalNotes}
                  onChange={e => handleChange('internalNotes', e.target.value)}
                  placeholder="Notes visible only to admins..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Photos Section */}
          {activeSection === 'photos' && (
            <div className="form-section">
              <h2>Property Photos</h2>
              <p className="section-hint">Upload photos of the property. Click a photo to set it as the cover image.</p>

              <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} />
                <p>Click to upload photos</p>
                <span>JPG, PNG, WebP - Max 10MB each</span>
                {uploading && <div className="upload-progress">Uploading...</div>}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />

              {photos.length > 0 && (
                <div className="photos-grid">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className={`photo-item ${index === coverPhotoIndex ? 'cover' : ''}`}
                      onClick={() => setCoverPhotoIndex(index)}
                    >
                      <img src={photo} alt={`Property photo ${index + 1}`} />
                      {index === coverPhotoIndex && (
                        <div className="cover-badge">Cover</div>
                      )}
                      <button
                        type="button"
                        className="photo-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(index);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Location Section */}
          {activeSection === 'location' && (
            <div className="form-section">
              <h2>Location</h2>
              <p className="section-hint">Set the map coordinates for this property</p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.lat}
                    onChange={e => handleChange('lat', parseFloat(e.target.value))}
                    step="0.0001"
                    placeholder="e.g. 33.4484"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.lng}
                    onChange={e => handleChange('lng', parseFloat(e.target.value))}
                    step="0.0001"
                    placeholder="e.g. -112.0740"
                  />
                </div>
              </div>

              <p className="form-hint">
                Tip: Find coordinates using <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Google Maps</a> — 
                right-click a location and select the coordinates.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
