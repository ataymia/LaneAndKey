// Common functions used across all pages

// Format price as currency
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Format number with commas
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

// Create listing card HTML
function createListingCard(listing) {
    // Use cover photo (already reordered by firebase-bridge) or first available photo
    const photo = listing.photos && listing.photos.length > 0 
        ? listing.photos[0] 
        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23CCD5FF\' width=\'400\' height=\'300\'/%3E%3Ctext fill=\'%23FFFFFF\' font-family=\'Arial\' font-size=\'24\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E';
    
    // Show "/mo" for rental properties (Firestore data)
    const priceLabel = listing._source === 'firestore' 
        ? `${formatPrice(listing.price)}/mo`
        : formatPrice(listing.price);
    
    const cityDisplay = [listing.city, listing.state].filter(Boolean).join(', ');
    
    return `
        <div class="listing-card" onclick="viewListing('${listing.id}')">
            <img src="${photo}" alt="${listing.address}" class="listing-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'300\\'%3E%3Crect fill=\\'%23CCD5FF\\' width=\\'400\\' height=\\'300\\'/%3E%3Ctext fill=\\'%23FFFFFF\\' font-family=\\'Arial\\' font-size=\\'24\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\'%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="listing-info">
                <div class="listing-price">${priceLabel}</div>
                <div class="listing-address">${listing.address}, ${cityDisplay}</div>
                <div class="listing-details">
                    <span class="listing-detail">${listing.beds} beds</span>
                    <span class="listing-detail">${listing.baths} baths</span>
                    <span class="listing-detail">${formatNumber(listing.sqft)} sqft</span>
                </div>
            </div>
        </div>
    `;
}

// View listing details - navigate to listing detail page
function viewListing(id) {
    window.location.href = `listing.html?id=${id}`;
}

// Global search functionality
function performGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    const query = searchInput.value.trim();
    
    if (query) {
        // Store search query and redirect to listings page
        sessionStorage.setItem('searchQuery', query);
        window.location.href = 'listings.html';
    }
}

// Allow Enter key to trigger search
document.addEventListener('DOMContentLoaded', function() {
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performGlobalSearch();
            }
        });
    }
});

// Sell Form Modal
function openSellForm() {
    const modal = document.getElementById('sell-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeSellForm() {
    const modal = document.getElementById('sell-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    // Reset form
    const form = document.getElementById('sell-form');
    if (form) {
        form.reset();
    }
}

function submitSellForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Submit';
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Sending...'; }

    const formData = new FormData(form);
    const inquiry = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        address: formData.get('address'),
        propertyType: formData.get('propertyType'),
        message: formData.get('message') || ''
    };
    
    // Submit to Firestore so it appears in admin Messages → Inquiries
    const firestoreDoc = {
        fields: {
            name: { stringValue: inquiry.name || '' },
            email: { stringValue: inquiry.email || '' },
            phone: { stringValue: inquiry.phone },
            interest: { stringValue: 'selling' },
            message: { stringValue: (inquiry.address ? 'Property: ' + inquiry.address + (inquiry.propertyType ? ' (' + inquiry.propertyType + ')' : '') + '\n\n' : '') + (inquiry.message || '') },
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
        // Also save to localStorage as backup
        try { saveSellInquiry(inquiry); } catch(e) { /* ignore */ }
        alert('Thank you for your interest! We\'ll contact you soon to discuss selling your property.');
        closeSellForm();
    })
    .catch(error => {
        console.error('Failed to save sell inquiry:', error);
        try { saveSellInquiry(inquiry); } catch(e) { /* ignore */ }
        alert('Sorry, there was an error submitting your inquiry. Please try again.');
    })
    .finally(() => {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalButtonText; }
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const sellModal = document.getElementById('sell-modal');
    if (event.target === sellModal) {
        closeSellForm();
    }
    
    const listingModal = document.getElementById('listing-modal');
    if (event.target === listingModal) {
        closeListingForm();
    }
}
