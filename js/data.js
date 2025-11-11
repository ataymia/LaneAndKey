// Data storage and management using localStorage
const DATA_KEYS = {
    LISTINGS: 'lanekey_listings',
    PAGES: 'lanekey_pages',
    AUTH: 'lanekey_auth',
    CONTACT_SUBMISSIONS: 'lanekey_contact_submissions',
    VIEWING_REQUESTS: 'lanekey_viewing_requests',
    SELL_INQUIRIES: 'lanekey_sell_inquiries',
    SITE_SETTINGS: 'lanekey_site_settings'
};

// Initialize with sample data if needed
function initializeData() {
    if (!localStorage.getItem(DATA_KEYS.LISTINGS)) {
        const sampleListings = [
            {
                id: '1',
                address: '123 Main Street',
                city: 'Springfield',
                price: 425000,
                beds: 3,
                baths: 2.5,
                sqft: 2100,
                yearBuilt: 2015,
                type: 'single-family',
                description: 'Beautiful single-family home in desirable Springfield neighborhood. Features modern kitchen, spacious backyard, and great schools nearby.',
                photos: [
                    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'
                ],
                lat: 39.7817,
                lng: -89.6501,
                published: true
            },
            {
                id: '2',
                address: '456 Oak Avenue',
                city: 'Riverside',
                price: 589000,
                beds: 4,
                baths: 3,
                sqft: 2800,
                yearBuilt: 2018,
                type: 'single-family',
                description: 'Stunning 4-bedroom home with open floor plan, gourmet kitchen, and luxurious master suite. Walking distance to parks and shopping.',
                photos: [
                    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
                    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'
                ],
                lat: 39.7897,
                lng: -89.6701,
                published: true
            },
            {
                id: '3',
                address: '789 Pine Street',
                city: 'Lakeside',
                price: 315000,
                beds: 2,
                baths: 2,
                sqft: 1400,
                yearBuilt: 2020,
                type: 'condo',
                description: 'Modern condo with lake views, granite countertops, and hardwood floors. Amenities include pool, fitness center, and parking.',
                photos: [
                    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
                    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'
                ],
                lat: 39.7997,
                lng: -89.6401,
                published: true
            },
            {
                id: '4',
                address: '321 Elm Drive',
                city: 'Springfield',
                price: 750000,
                beds: 5,
                baths: 4,
                sqft: 3500,
                yearBuilt: 2019,
                type: 'single-family',
                description: 'Luxurious custom-built home featuring high-end finishes, chef\'s kitchen, home theater, and expansive outdoor living space.',
                photos: [
                    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
                    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800'
                ],
                lat: 39.7717,
                lng: -89.6601,
                published: true
            }
        ];
        localStorage.setItem(DATA_KEYS.LISTINGS, JSON.stringify(sampleListings));
    }

    if (!localStorage.getItem(DATA_KEYS.PAGES)) {
        const defaultPages = {
            home: {
                heroTitle: 'Find Your Dream Home',
                heroSubtitle: 'Discover the perfect property with Lane & Key Properties',
                content: ''
            },
            about: {
                content: 'Lane & Key Properties is owned by Latosha Lane, a retired U.S. veteran who brings the same dedication, discipline, and heart she had in service into providing clean, comfortable homes. With a soft spot for her six maltipoos and a sense of humor to match, she focuses on safe, well-maintained rentals and responsive communication for every tenant.'
            }
        };
        localStorage.setItem(DATA_KEYS.PAGES, JSON.stringify(defaultPages));
    }
}

// Listings CRUD operations
function getAllListings() {
    const data = localStorage.getItem(DATA_KEYS.LISTINGS);
    return data ? JSON.parse(data) : [];
}

function getPublishedListings() {
    return getAllListings().filter(listing => listing.published);
}

function getListingById(id) {
    const listings = getAllListings();
    return listings.find(listing => listing.id === id);
}

function saveListing(listing) {
    const listings = getAllListings();
    const existingIndex = listings.findIndex(l => l.id === listing.id);
    
    if (existingIndex >= 0) {
        listings[existingIndex] = listing;
    } else {
        listing.id = Date.now().toString();
        listings.push(listing);
    }
    
    localStorage.setItem(DATA_KEYS.LISTINGS, JSON.stringify(listings));
    return listing;
}

function deleteListing(id) {
    const listings = getAllListings();
    const filtered = listings.filter(listing => listing.id !== id);
    localStorage.setItem(DATA_KEYS.LISTINGS, JSON.stringify(filtered));
}

function toggleListingPublished(id) {
    const listings = getAllListings();
    const listing = listings.find(l => l.id === id);
    if (listing) {
        listing.published = !listing.published;
        localStorage.setItem(DATA_KEYS.LISTINGS, JSON.stringify(listings));
    }
    return listing;
}

// Pages operations
function getPageContent(page) {
    const pages = localStorage.getItem(DATA_KEYS.PAGES);
    const data = pages ? JSON.parse(pages) : {};
    return data[page] || {};
}

function savePageContent(page, content) {
    const pages = localStorage.getItem(DATA_KEYS.PAGES);
    const data = pages ? JSON.parse(pages) : {};
    data[page] = content;
    localStorage.setItem(DATA_KEYS.PAGES, JSON.stringify(data));
}

// Authentication (simple demonstration - not secure for production)
function checkAuth() {
    const auth = localStorage.getItem(DATA_KEYS.AUTH);
    return auth === 'authenticated';
}

function login(username, password) {
    // Authentication using config (which can use Cloudflare secrets)
    if (typeof validateCredentials === 'function' && validateCredentials(username, password)) {
        localStorage.setItem(DATA_KEYS.AUTH, 'authenticated');
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem(DATA_KEYS.AUTH);
}

// Search and filter functions
function searchListings(query) {
    const listings = getPublishedListings();
    const lowerQuery = query.toLowerCase();
    
    return listings.filter(listing => 
        listing.address.toLowerCase().includes(lowerQuery) ||
        listing.city.toLowerCase().includes(lowerQuery) ||
        listing.description.toLowerCase().includes(lowerQuery) ||
        listing.type.toLowerCase().includes(lowerQuery)
    );
}

function filterListings(filters) {
    let listings = getPublishedListings();
    
    // City filter
    if (filters.city) {
        const cityLower = filters.city.toLowerCase();
        listings = listings.filter(l => l.city.toLowerCase().includes(cityLower));
    }
    
    // Price range
    if (filters.priceMin) {
        listings = listings.filter(l => l.price >= filters.priceMin);
    }
    if (filters.priceMax) {
        listings = listings.filter(l => l.price <= filters.priceMax);
    }
    
    // Bedrooms
    if (filters.beds) {
        listings = listings.filter(l => l.beds >= filters.beds);
    }
    
    // Bathrooms
    if (filters.baths) {
        listings = listings.filter(l => l.baths >= filters.baths);
    }
    
    // Square feet
    if (filters.sqftMin) {
        listings = listings.filter(l => l.sqft >= filters.sqftMin);
    }
    if (filters.sqftMax) {
        listings = listings.filter(l => l.sqft <= filters.sqftMax);
    }
    
    // Year built
    if (filters.yearMin) {
        listings = listings.filter(l => l.yearBuilt >= filters.yearMin);
    }
    if (filters.yearMax) {
        listings = listings.filter(l => l.yearBuilt <= filters.yearMax);
    }
    
    // Property type
    if (filters.type) {
        listings = listings.filter(l => l.type === filters.type);
    }
    
    return listings;
}

// Submissions CRUD operations
function saveContactSubmission(submission) {
    const submissions = getContactSubmissions();
    submission.id = Date.now().toString();
    submission.date = new Date().toISOString();
    submission.status = 'new';
    submissions.unshift(submission);
    localStorage.setItem(DATA_KEYS.CONTACT_SUBMISSIONS, JSON.stringify(submissions));
    return submission;
}

function getContactSubmissions() {
    const data = localStorage.getItem(DATA_KEYS.CONTACT_SUBMISSIONS);
    return data ? JSON.parse(data) : [];
}

function deleteContactSubmission(id) {
    const submissions = getContactSubmissions();
    const filtered = submissions.filter(s => s.id !== id);
    localStorage.setItem(DATA_KEYS.CONTACT_SUBMISSIONS, JSON.stringify(filtered));
}

function updateContactSubmissionStatus(id, status) {
    const submissions = getContactSubmissions();
    const submission = submissions.find(s => s.id === id);
    if (submission) {
        submission.status = status;
        localStorage.setItem(DATA_KEYS.CONTACT_SUBMISSIONS, JSON.stringify(submissions));
    }
}

function saveViewingRequest(request) {
    const requests = getViewingRequests();
    request.id = Date.now().toString();
    request.date = new Date().toISOString();
    request.status = 'new';
    requests.unshift(request);
    localStorage.setItem(DATA_KEYS.VIEWING_REQUESTS, JSON.stringify(requests));
    return request;
}

function getViewingRequests() {
    const data = localStorage.getItem(DATA_KEYS.VIEWING_REQUESTS);
    return data ? JSON.parse(data) : [];
}

function deleteViewingRequest(id) {
    const requests = getViewingRequests();
    const filtered = requests.filter(r => r.id !== id);
    localStorage.setItem(DATA_KEYS.VIEWING_REQUESTS, JSON.stringify(filtered));
}

function updateViewingRequestStatus(id, status) {
    const requests = getViewingRequests();
    const request = requests.find(r => r.id === id);
    if (request) {
        request.status = status;
        localStorage.setItem(DATA_KEYS.VIEWING_REQUESTS, JSON.stringify(requests));
    }
}

function saveSellInquiry(inquiry) {
    const inquiries = getSellInquiries();
    inquiry.id = Date.now().toString();
    inquiry.date = new Date().toISOString();
    inquiry.status = 'new';
    inquiries.unshift(inquiry);
    localStorage.setItem(DATA_KEYS.SELL_INQUIRIES, JSON.stringify(inquiries));
    return inquiry;
}

function getSellInquiries() {
    const data = localStorage.getItem(DATA_KEYS.SELL_INQUIRIES);
    return data ? JSON.parse(data) : [];
}

function deleteSellInquiry(id) {
    const inquiries = getSellInquiries();
    const filtered = inquiries.filter(i => i.id !== id);
    localStorage.setItem(DATA_KEYS.SELL_INQUIRIES, JSON.stringify(filtered));
}

function updateSellInquiryStatus(id, status) {
    const inquiries = getSellInquiries();
    const inquiry = inquiries.find(i => i.id === id);
    if (inquiry) {
        inquiry.status = status;
        localStorage.setItem(DATA_KEYS.SELL_INQUIRIES, JSON.stringify(inquiries));
    }
}

// Site Settings operations
function getSiteSettings() {
    const data = localStorage.getItem(DATA_KEYS.SITE_SETTINGS);
    if (!data) {
        const defaultSettings = {
            siteName: 'Lane & Key Properties',
            tagline: 'Every Lane leads you home.',
            email: 'laneandkey@gmail.com',
            phone: '(623) 340-9861',
            officeHours: {
                weekday: 'Monday - Friday: 9:00 AM - 6:00 PM',
                saturday: 'Saturday: 10:00 AM - 4:00 PM',
                sunday: 'Sunday: By Appointment'
            }
        };
        localStorage.setItem(DATA_KEYS.SITE_SETTINGS, JSON.stringify(defaultSettings));
        return defaultSettings;
    }
    return JSON.parse(data);
}

function saveSiteSettings(settings) {
    localStorage.setItem(DATA_KEYS.SITE_SETTINGS, JSON.stringify(settings));
}

// Initialize data on load
initializeData();
