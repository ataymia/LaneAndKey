// Individual listing detail page functionality

document.addEventListener('DOMContentLoaded', function() {
    loadListingDetail();
});

// Firestore bridge callback — re-render listing detail when Firestore data arrives
window._refreshWithFirestoreData = function(listings) {
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    if (listingId && listings) {
        const listing = listings.find(l => l.id === listingId);
        if (listing) {
            const contentDiv = document.getElementById('listing-detail-content');
            if (contentDiv) {
                contentDiv.innerHTML = createListingDetailHTML(listing);
            }
        }
    }
};

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
    
    // Try localStorage first (may have Firestore-cached data)
    let listing = getListingById(listingId);
    
    if (listing) {
        contentDiv.innerHTML = createListingDetailHTML(listing);
    } else {
        // Show loading state — Firestore bridge may load it
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <p>Loading property details...</p>
            </div>
        `;
        
        // Try fetching directly from Firestore REST API
        if (typeof fetchPropertyByIdFromFirestore === 'function') {
            fetchPropertyByIdFromFirestore(listingId).then(firestoreListing => {
                if (firestoreListing) {
                    contentDiv.innerHTML = createListingDetailHTML(firestoreListing);
                } else {
                    contentDiv.innerHTML = `
                        <div style="text-align: center; padding: 3rem;">
                            <h2>Property Not Found</h2>
                            <p>The property you're looking for doesn't exist or has been removed.</p>
                            <a href="listings.html" class="btn" style="display: inline-block; margin-top: 1rem;">Browse All Listings</a>
                        </div>
                    `;
                }
            });
        } else {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <h2>Property Not Found</h2>
                    <p>The property you're looking for doesn't exist or has been removed.</p>
                    <a href="listings.html" class="btn" style="display: inline-block; margin-top: 1rem;">Browse All Listings</a>
                </div>
            `;
        }
    }
}

function createListingDetailHTML(listing) {
    const photos = listing.photos && listing.photos.length > 0 
        ? listing.photos 
        : ['data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'600\'%3E%3Crect fill=\'%23CCD5FF\' width=\'800\' height=\'600\'/%3E%3Ctext fill=\'%23FFFFFF\' font-family=\'Arial\' font-size=\'36\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E'];
    
    const photoGalleryHTML = photos.map((photo, index) => 
        `<img src="${photo}" alt="${listing.address} - Photo ${index + 1}" class="gallery-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'800\\' height=\\'600\\'%3E%3Crect fill=\\'%23CCD5FF\\' width=\\'800\\' height=\\'600\\'/%3E%3Ctext fill=\\'%23FFFFFF\\' font-family=\\'Arial\\' font-size=\\'36\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3ENo Image%3C/text%3E%3C/svg%3E'">`
    ).join('');
    
    const propertyTypeLabel = formatPropertyType(listing.type);
    
    // Build address display
    const fullAddress = [listing.address, listing.unit ? `Unit ${listing.unit}` : ''].filter(Boolean).join(', ');
    const cityStateZip = [listing.city, listing.state, listing.zip].filter(Boolean).join(', ');
    
    // Build extra details rows if available (from Firestore data)
    let extraDetailsHTML = '';
    if (listing.securityDeposit) {
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Security Deposit:</span>
                <span class="detail-value">${formatPrice(listing.securityDeposit)}</span>
            </div>`;
    }
    if (listing.parking) {
        const parkingLabel = listing.parking === 'garage' ? 'Garage' : listing.parking === 'driveway' ? 'Driveway' : listing.parking === 'street' ? 'Street' : listing.parking === 'lot' ? 'Parking Lot' : listing.parking;
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Parking:</span>
                <span class="detail-value">${parkingLabel}</span>
            </div>`;
    }
    if (listing.laundry) {
        const laundryLabel = listing.laundry === 'in-unit' ? 'In-Unit' : listing.laundry === 'on-site' ? 'On-Site' : listing.laundry === 'none' ? 'None' : listing.laundry;
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Laundry:</span>
                <span class="detail-value">${laundryLabel}</span>
            </div>`;
    }
    if (listing.petPolicy && listing.petPolicy.allowed) {
        let petText = 'Pets Allowed';
        if (listing.petPolicy.deposit) petText += ` (Deposit: ${formatPrice(listing.petPolicy.deposit)})`;
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Pet Policy:</span>
                <span class="detail-value">${petText}</span>
            </div>`;
    } else if (listing.petPolicy && !listing.petPolicy.allowed) {
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Pet Policy:</span>
                <span class="detail-value">No Pets</span>
            </div>`;
    }
    if (listing.appliances && listing.appliances.length > 0) {
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Appliances:</span>
                <span class="detail-value">${listing.appliances.join(', ')}</span>
            </div>`;
    }
    if (listing.utilitiesIncluded && listing.utilitiesIncluded.length > 0) {
        extraDetailsHTML += `
            <div class="detail-row">
                <span class="detail-label">Utilities Included:</span>
                <span class="detail-value">${listing.utilitiesIncluded.join(', ')}</span>
            </div>`;
    }
    
    // Apply Now button - only show if accepting applications
    const applyButtonHTML = listing.acceptingApplications 
        ? `<a href="portal/#/signup" class="btn" style="background: #4CAF50; margin-top: 0.5rem; display: block; text-align: center;">Apply Now</a>`
        : '';
    
    // Application fee info
    const appFeeHTML = listing.applicationFee 
        ? `<p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">Application Fee: ${formatPrice(listing.applicationFee)}</p>`
        : '';

    // Status badge for detail page
    const isOnMarket = listing.marketStatus === 'on';
    const detailBadgeStyle = isOnMarket
        ? 'background: #16a34a; color: #fff;'
        : 'background: #6b7280; color: #fff;';
    const detailBadgeText = isOnMarket ? 'Available' : 'Off Market';
    const detailBadgeHTML = `<span style="${detailBadgeStyle} padding: 5px 14px; border-radius: 4px; font-size: 0.85rem; font-weight: 600; display: inline-block; margin-bottom: 0.5rem;">${detailBadgeText}</span>`;

    return `
        <div class="listing-detail">
            <div class="listing-detail-header">
                ${detailBadgeHTML}
                <h1>${fullAddress}</h1>
                <p style="color: #666; margin-top: 0.25rem;">${cityStateZip}</p>
                <div class="listing-detail-price">${formatPrice(listing.price)}/mo</div>
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
                            <div class="stat-value">${listing.yearBuilt || 'N/A'}</div>
                            <div class="stat-label">Year Built</div>
                        </div>
                    </div>
                    
                    <div class="listing-detail-section">
                        <h2>Description</h2>
                        <p>${listing.description || 'No description available.'}</p>
                    </div>
                    
                    <div class="listing-detail-section">
                        <h2>Property Details</h2>
                        <div class="property-details-grid">
                            <div class="detail-row">
                                <span class="detail-label">Address:</span>
                                <span class="detail-value">${fullAddress}, ${cityStateZip}</span>
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
                                <span class="detail-value">${listing.yearBuilt || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Monthly Rent:</span>
                                <span class="detail-value">${formatPrice(listing.price)}</span>
                            </div>
                            ${extraDetailsHTML}
                        </div>
                    </div>
                </div>
                
                <div class="listing-detail-sidebar">
                    <div class="contact-card">
                        <h3>Interested in this property?</h3>
                        <p>Contact us to schedule a viewing or get more information.</p>
                        ${applyButtonHTML}
                        ${appFeeHTML}
                        <button onclick="openContactModal()" class="btn" style="margin-top: 0.5rem;">Schedule a Viewing</button>
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
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Send';
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Sending...'; }

    const formData = new FormData(form);
    
    // Get the listing ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    const listing = getListingById(listingId);
    
    const request = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        message: formData.get('message') || '',
        listingId: listingId,
        listingAddress: listing ? listing.address : 'Unknown'
    };
    
    // Submit to Firestore so it appears in admin Messages → Inquiries
    const firestoreDoc = {
        fields: {
            name: { stringValue: request.name || '' },
            email: { stringValue: request.email || '' },
            phone: { stringValue: request.phone },
            interest: { stringValue: 'renting' },
            message: { stringValue: 'Viewing Request for: ' + request.listingAddress + '\n\n' + request.message },
            status: { stringValue: 'new' },
            createdAt: { timestampValue: new Date().toISOString() },
            read: { booleanValue: false },
        }
    };

    fetch('https://firestore.googleapis.com/v1/projects/laneandkey1/databases/(default)/documents/contactSubmissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreDoc),
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to submit');
        try { saveViewingRequest(request); } catch(e) { /* ignore */ }
        alert('Thank you for your interest! We\'ll contact you soon to schedule a viewing.');
        closeContactModal();
    })
    .catch(error => {
        console.error('Failed to save viewing request:', error);
        try { saveViewingRequest(request); } catch(e) { /* ignore */ }
        alert('Sorry, there was an error submitting your request. Please try again.');
    })
    .finally(() => {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalButtonText; }
    });
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const contactModal = document.getElementById('contact-modal');
    if (event.target === contactModal) {
        closeContactModal();
    }
});
