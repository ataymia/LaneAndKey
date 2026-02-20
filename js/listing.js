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
    
    const showArrows = photos.length > 1;
    const photoSlidesHTML = photos.map((photo, index) => 
        `<div class="carousel-slide${index === 0 ? ' active' : ''}" data-index="${index}">
            <img src="${photo}" alt="${listing.address} - Photo ${index + 1}" class="carousel-img" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'800\\' height=\\'600\\'%3E%3Crect fill=\\'%23CCD5FF\\' width=\\'800\\' height=\\'600\\'/%3E%3Ctext fill=\\'%23FFFFFF\\' font-family=\\'Arial\\' font-size=\\'36\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3ENo Image%3C/text%3E%3C/svg%3E'">
        </div>`
    ).join('');
    const arrowsHTML = showArrows ? `
        <button class="carousel-arrow carousel-prev" onclick="carouselNav(-1)" aria-label="Previous photo">&#10094;</button>
        <button class="carousel-arrow carousel-next" onclick="carouselNav(1)" aria-label="Next photo">&#10095;</button>
    ` : '';
    const counterHTML = showArrows ? `<div class="carousel-counter"><span id="carousel-index">1</span> / ${photos.length}</div>` : '';
    const expandBtnHTML = `<button class="carousel-expand-btn" onclick="openLightbox()" aria-label="Expand photo" title="View fullscreen">&#x26F6;</button>`;
    const photoGalleryHTML = `${photoSlidesHTML}${arrowsHTML}${counterHTML}${expandBtnHTML}`;
    
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
            
            <div class="listing-detail-gallery" onclick="if(window.innerWidth<=768)openLightbox()">
                ${photoGalleryHTML}
            </div>

            <!-- Fullscreen Lightbox -->
            <div id="photo-lightbox" class="lightbox-overlay" onclick="if(event.target===this)closeLightbox()">
                <button class="lightbox-close" onclick="closeLightbox()" aria-label="Close">&#10005;</button>
                <div class="lightbox-content">
                    <img id="lightbox-img" src="" alt="" />
                </div>
                ${showArrows ? `
                <button class="lightbox-arrow lightbox-prev" onclick="event.stopPropagation();lightboxNav(-1)">&#10094;</button>
                <button class="lightbox-arrow lightbox-next" onclick="event.stopPropagation();lightboxNav(1)">&#10095;</button>
                ` : ''}
                <div class="lightbox-counter"><span id="lightbox-index">1</span> / ${photos.length}</div>
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

// ── Image Carousel ──
let _carouselIdx = 0;

function carouselNav(dir) {
    const slides = document.querySelectorAll('.carousel-slide');
    if (!slides.length) return;
    slides[_carouselIdx].classList.remove('active');
    _carouselIdx = (_carouselIdx + dir + slides.length) % slides.length;
    slides[_carouselIdx].classList.add('active');
    const counter = document.getElementById('carousel-index');
    if (counter) counter.textContent = _carouselIdx + 1;
}

// Keyboard arrows
document.addEventListener('keydown', function(e) {
    const lb = document.getElementById('photo-lightbox');
    const inLightbox = lb && lb.classList.contains('open');
    if (e.key === 'Escape' && inLightbox) { closeLightbox(); return; }
    if (e.key === 'ArrowLeft') { inLightbox ? lightboxNav(-1) : carouselNav(-1); }
    if (e.key === 'ArrowRight') { inLightbox ? lightboxNav(1) : carouselNav(1); }
});

// Swipe support (gallery + lightbox)
(function() {
    let touchStartX = 0;
    document.addEventListener('touchstart', function(e) {
        const gallery = document.querySelector('.listing-detail-gallery');
        const lightbox = document.getElementById('photo-lightbox');
        if ((gallery && gallery.contains(e.target)) || (lightbox && lightbox.classList.contains('open') && lightbox.contains(e.target))) {
            touchStartX = e.changedTouches[0].screenX;
        }
    }, { passive: true });
    document.addEventListener('touchend', function(e) {
        const gallery = document.querySelector('.listing-detail-gallery');
        const lightbox = document.getElementById('photo-lightbox');
        const inLightbox = lightbox && lightbox.classList.contains('open') && lightbox.contains(e.target);
        const inGallery = gallery && gallery.contains(e.target);
        if (inLightbox) {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 40) { lightboxNav(diff > 0 ? 1 : -1); }
        } else if (inGallery) {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 40) { carouselNav(diff > 0 ? 1 : -1); }
        }
    }, { passive: true });
})();

// ── Fullscreen Lightbox ──
let _lightboxIdx = 0;
let _lightboxPhotos = [];

function openLightbox() {
    const slides = document.querySelectorAll('.carousel-slide img');
    if (!slides.length) return;
    _lightboxPhotos = Array.from(slides).map(img => img.src);
    _lightboxIdx = _carouselIdx;
    const lb = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    img.src = _lightboxPhotos[_lightboxIdx];
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    const counter = document.getElementById('lightbox-index');
    if (counter) counter.textContent = _lightboxIdx + 1;
}

function closeLightbox() {
    const lb = document.getElementById('photo-lightbox');
    if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
}

function lightboxNav(dir) {
    if (!_lightboxPhotos.length) return;
    _lightboxIdx = (_lightboxIdx + dir + _lightboxPhotos.length) % _lightboxPhotos.length;
    const img = document.getElementById('lightbox-img');
    if (img) img.src = _lightboxPhotos[_lightboxIdx];
    const counter = document.getElementById('lightbox-index');
    if (counter) counter.textContent = _lightboxIdx + 1;
    // Sync inline carousel
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length) {
        slides[_carouselIdx].classList.remove('active');
        _carouselIdx = _lightboxIdx;
        slides[_carouselIdx].classList.add('active');
        const ic = document.getElementById('carousel-index');
        if (ic) ic.textContent = _carouselIdx + 1;
    }
}
