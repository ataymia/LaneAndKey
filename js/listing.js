// Individual listing detail page functionality

document.addEventListener('DOMContentLoaded', function() {
    loadListingDetail();
});

function loadListingDetail() {
    // Get the listing ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    
    const contentDiv = document.getElementById('listing-detail-content');
    
    if (!listingId) {
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <h2>Property Not Found</h2>
                <p>No property ID was provided.</p>
                <a href="listings.html" class="btn" style="display: inline-block; margin-top: 1rem;">Browse All Listings</a>
            </div>
        `;
        return;
    }
    
    const listing = getListingById(listingId);
    
    if (!listing) {
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <h2>Property Not Found</h2>
                <p>The property you're looking for doesn't exist or has been removed.</p>
                <a href="listings.html" class="btn" style="display: inline-block; margin-top: 1rem;">Browse All Listings</a>
            </div>
        `;
        return;
    }
    
    // Render the listing detail
    contentDiv.innerHTML = createListingDetailHTML(listing);
}

function createListingDetailHTML(listing) {
    const photos = listing.photos && listing.photos.length > 0 
        ? listing.photos 
        : ['data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'600\'%3E%3Crect fill=\'%23CCD5FF\' width=\'800\' height=\'600\'/%3E%3Ctext fill=\'%23FFFFFF\' font-family=\'Arial\' font-size=\'36\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E'];
    
    const photoGalleryHTML = photos.map((photo, index) => 
        `<img src="${photo}" alt="${listing.address} - Photo ${index + 1}" class="gallery-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'800\\' height=\\'600\\'%3E%3Crect fill=\\'%23CCD5FF\\' width=\\'800\\' height=\\'600\\'/%3E%3Ctext fill=\\'%23FFFFFF\\' font-family=\\'Arial\\' font-size=\\'36\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3ENo Image%3C/text%3E%3C/svg%3E'">`
    ).join('');
    
    const propertyTypeLabel = formatPropertyType(listing.type);
    
    return `
        <div class="listing-detail">
            <div class="listing-detail-header">
                <h1>${listing.address}</h1>
                <div class="listing-detail-price">${formatPrice(listing.price)}</div>
            </div>
            
            <div class="listing-detail-gallery">
                ${photoGalleryHTML}
            </div>
            
            <div class="listing-detail-content">
                <div class="listing-detail-main">
                    <div class="listing-detail-stats">
                        <div class="stat-item">
                            <div class="stat-value">${listing.beds}</div>
                            <div class="stat-label">Bedrooms</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${listing.baths}</div>
                            <div class="stat-label">Bathrooms</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${formatNumber(listing.sqft)}</div>
                            <div class="stat-label">Square Feet</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${listing.yearBuilt}</div>
                            <div class="stat-label">Year Built</div>
                        </div>
                    </div>
                    
                    <div class="listing-detail-section">
                        <h2>Description</h2>
                        <p>${listing.description}</p>
                    </div>
                    
                    <div class="listing-detail-section">
                        <h2>Property Details</h2>
                        <div class="property-details-grid">
                            <div class="detail-row">
                                <span class="detail-label">Address:</span>
                                <span class="detail-value">${listing.address}, ${listing.city}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Property Type:</span>
                                <span class="detail-value">${propertyTypeLabel}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Bedrooms:</span>
                                <span class="detail-value">${listing.beds}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Bathrooms:</span>
                                <span class="detail-value">${listing.baths}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Square Feet:</span>
                                <span class="detail-value">${formatNumber(listing.sqft)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Year Built:</span>
                                <span class="detail-value">${listing.yearBuilt}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Price:</span>
                                <span class="detail-value">${formatPrice(listing.price)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="listing-detail-sidebar">
                    <div class="contact-card">
                        <h3>Interested in this property?</h3>
                        <p>Contact us to schedule a viewing or get more information.</p>
                        <button onclick="openContactModal()" class="btn">Schedule a Viewing</button>
                        <a href="contact.html" class="btn btn-secondary">Contact Us</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatPropertyType(type) {
    const typeMap = {
        'single-family': 'Single Family',
        'condo': 'Condo',
        'townhouse': 'Townhouse',
        'multi-family': 'Multi-Family',
        'land': 'Land'
    };
    return typeMap[type] || type;
}

function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    const form = document.getElementById('contact-form');
    if (form) {
        form.reset();
    }
}

function submitContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // In a real application, this would send data to a server
    console.log('Contact form submitted:', data);
    
    // Show success message
    alert('Thank you for your interest! We\'ll contact you soon to schedule a viewing.');
    
    closeContactModal();
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const contactModal = document.getElementById('contact-modal');
    if (event.target === contactModal) {
        closeContactModal();
    }
});
