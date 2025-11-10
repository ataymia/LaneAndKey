// Listings page specific functionality
let map;
let markers = [];
let currentListings = [];

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadListings();
    
    // Check if there's a search query from navigation
    const searchQuery = sessionStorage.getItem('searchQuery');
    if (searchQuery) {
        document.getElementById('filter-city').value = searchQuery;
        sessionStorage.removeItem('searchQuery');
        applyFilters();
    }
});

function initMap() {
    // Initialize Leaflet map (free alternative to Google Maps)
    map = L.map('map').setView([39.7817, -89.6501], 11);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function loadListings(listings = null) {
    if (!listings) {
        listings = getPublishedListings();
    }
    
    currentListings = listings;
    updateResultsCount(listings.length);
    
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Add markers to map
    listings.forEach(listing => {
        if (listing.lat && listing.lng) {
            const marker = L.marker([listing.lat, listing.lng]).addTo(map);
            
            const popupContent = `
                <div style="min-width: 200px;">
                    <strong>${formatPrice(listing.price)}</strong><br>
                    ${listing.address}<br>
                    ${listing.beds} beds | ${listing.baths} baths<br>
                    <button onclick="viewListing('${listing.id}')" style="margin-top: 8px; padding: 4px 12px; background: #9BAAFF; color: white; border: none; border-radius: 4px; cursor: pointer;">View Details</button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markers.push(marker);
        }
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    // Update grid view
    updateGridView(listings);
}

function updateGridView(listings) {
    const grid = document.getElementById('listings-grid');
    
    if (listings.length > 0) {
        grid.innerHTML = listings.map(listing => createListingCard(listing)).join('');
    } else {
        grid.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No properties match your criteria. Try adjusting your filters.</p>';
    }
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = `${count} ${count === 1 ? 'property' : 'properties'} found`;
    }
}

function showMapView() {
    document.getElementById('map-container').style.display = 'block';
    document.getElementById('grid-container').style.display = 'none';
    document.getElementById('map-view-btn').classList.add('active');
    document.getElementById('grid-view-btn').classList.remove('active');
    
    // Refresh map
    setTimeout(() => map.invalidateSize(), 100);
}

function showGridView() {
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('grid-container').style.display = 'block';
    document.getElementById('map-view-btn').classList.remove('active');
    document.getElementById('grid-view-btn').classList.add('active');
}

function applyFilters() {
    const filters = {
        city: document.getElementById('filter-city').value.trim(),
        radius: parseInt(document.getElementById('filter-radius').value) || 25,
        priceMin: parseInt(document.getElementById('filter-price-min').value) || null,
        priceMax: parseInt(document.getElementById('filter-price-max').value) || null,
        beds: parseInt(document.getElementById('filter-beds').value) || null,
        baths: parseInt(document.getElementById('filter-baths').value) || null,
        sqftMin: parseInt(document.getElementById('filter-sqft-min').value) || null,
        sqftMax: parseInt(document.getElementById('filter-sqft-max').value) || null,
        yearMin: parseInt(document.getElementById('filter-year-min').value) || null,
        yearMax: parseInt(document.getElementById('filter-year-max').value) || null,
        type: document.getElementById('filter-type').value || null
    };
    
    const filteredListings = filterListings(filters);
    loadListings(filteredListings);
}

function clearFilters() {
    // Reset all filter inputs
    document.getElementById('filter-city').value = '';
    document.getElementById('filter-radius').value = 25;
    document.getElementById('filter-price-min').value = '';
    document.getElementById('filter-price-max').value = '';
    document.getElementById('filter-beds').value = '';
    document.getElementById('filter-baths').value = '';
    document.getElementById('filter-sqft-min').value = '';
    document.getElementById('filter-sqft-max').value = '';
    document.getElementById('filter-year-min').value = '';
    document.getElementById('filter-year-max').value = '';
    document.getElementById('filter-type').value = '';
    
    // Reload all listings
    loadListings();
}
