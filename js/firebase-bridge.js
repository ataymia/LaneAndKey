// Firebase bridge for the main site
// Fetches properties from Firestore REST API and syncs to localStorage
// No Firebase SDK required — uses the Firestore REST API with the project ID

const FIRESTORE_PROJECT_ID = 'laneandkey1';
const FIRESTORE_REST_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// Convert Firestore REST document fields to plain JS values
function _fsVal(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(v => _fsVal(v));
  }
  if ('mapValue' in field) {
    const obj = {};
    const fields = field.mapValue.fields || {};
    for (const key in fields) {
      obj[key] = _fsVal(fields[key]);
    }
    return obj;
  }
  if ('nullValue' in field) return null;
  if ('timestampValue' in field) return field.timestampValue;
  return null;
}

// Convert a Firestore REST document to our listing format
function _docToListing(doc) {
  const f = doc.fields || {};
  // Extract doc ID from the name path: projects/.../documents/properties/{id}
  const id = doc.name.split('/').pop();
  
  const photos = _fsVal(f.photos) || [];
  const coverPhotoIndex = _fsVal(f.coverPhotoIndex) || 0;
  // Reorder photos so cover photo is first
  if (coverPhotoIndex > 0 && coverPhotoIndex < photos.length) {
    const cover = photos[coverPhotoIndex];
    const reordered = [cover, ...photos.filter((_, i) => i !== coverPhotoIndex)];
    photos.splice(0, photos.length, ...reordered);
  }

  return {
    id: id,
    address: _fsVal(f.address) || '',
    city: _fsVal(f.city) || '',
    state: _fsVal(f.state) || '',
    zip: _fsVal(f.zip) || '',
    price: _fsVal(f.monthlyRent) || 0,
    monthlyRent: _fsVal(f.monthlyRent) || 0,
    securityDeposit: _fsVal(f.securityDeposit) || 0,
    applicationFee: _fsVal(f.applicationFee) || 0,
    beds: _fsVal(f.bedrooms) || 0,
    baths: _fsVal(f.bathrooms) || 0,
    sqft: _fsVal(f.sqft) || 0,
    yearBuilt: _fsVal(f.yearBuilt) || 0,
    type: _fsVal(f.propertyType) || 'single-family',
    description: _fsVal(f.publicDescription) || '',
    photos: photos,
    coverPhotoIndex: 0,
    lat: _fsVal(f.lat) || null,
    lng: _fsVal(f.lng) || null,
    published: true,
    marketStatus: _fsVal(f.marketStatus) || 'off',
    acceptingApplications: _fsVal(f.acceptingApplications) || false,
    occupancyStatus: _fsVal(f.occupancyStatus) || 'vacant',
    unit: _fsVal(f.unit) || '',
    parking: _fsVal(f.parking) || null,
    laundry: _fsVal(f.laundry) || '',
    petPolicy: _fsVal(f.petPolicy) || null,
    appliances: _fsVal(f.appliances) || [],
    utilitiesIncluded: _fsVal(f.utilitiesIncluded) || [],
    utilitiesTenantResponsibility: _fsVal(f.utilitiesTenantResponsibility) || [],
    neighborhoodDescription: _fsVal(f.neighborhoodDescription) || '',
    nearbyAmenities: _fsVal(f.nearbyAmenities) || '',
    schoolDistrict: _fsVal(f.schoolDistrict) || '',
    smokingAllowed: _fsVal(f.smokingAllowed) || false,
    maxOccupancy: _fsVal(f.maxOccupancy) || 0,
    incomeRequirement: _fsVal(f.incomeRequirement) || 0,
    heatingType: _fsVal(f.heatingType) || '',
    coolingType: _fsVal(f.coolingType) || '',
    flooringTypes: _fsVal(f.flooringTypes) || [],
    stories: _fsVal(f.stories) || 1,
    _source: 'firestore',
  };
}

// Fetch all properties from Firestore REST API
async function fetchPropertiesFromFirestore() {
  try {
    const url = `${FIRESTORE_REST_URL}/properties`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Firebase Bridge] Firestore REST error:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    const documents = data.documents || [];
    
    // Map all properties (show both on-market and off-market with badges)
    const listings = documents.map(doc => _docToListing(doc));

    // Cache to localStorage for instant-load next time
    localStorage.setItem('lanekey_listings', JSON.stringify(listings));
    console.log(`[Firebase Bridge] Loaded ${listings.length} properties from Firestore`);
    return listings;
  } catch (error) {
    console.warn('[Firebase Bridge] Error fetching from Firestore:', error.message);
    return null;
  }
}

// Fetch a single property by ID from Firestore REST API
async function fetchPropertyByIdFromFirestore(propertyId) {
  try {
    const url = `${FIRESTORE_REST_URL}/properties/${propertyId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const doc = await response.json();
    return _docToListing(doc);
  } catch (error) {
    console.warn('[Firebase Bridge] Error fetching property:', error.message);
    return null;
  }
}

// Main load function: tries Firestore first, falls back to localStorage
let _firestoreLoadPromise = null;

function getFirestoreListingsAsync() {
  if (!_firestoreLoadPromise) {
    _firestoreLoadPromise = fetchPropertiesFromFirestore().then(listings => {
      return listings; // null means fallback to localStorage
    });
  }
  return _firestoreLoadPromise;
}

// Auto-init on DOMContentLoaded: fetch from Firestore and refresh UI
document.addEventListener('DOMContentLoaded', function() {
  getFirestoreListingsAsync().then(listings => {
    if (listings !== null) {
      // Refresh page content with Firestore data
      if (typeof window._refreshWithFirestoreData === 'function') {
        window._refreshWithFirestoreData(listings);
      }
    }
  });
});
