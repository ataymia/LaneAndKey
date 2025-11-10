// Admin panel functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    if (checkAuth()) {
        showAdminPanel();
    }
});

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (login(username, password)) {
        showAdminPanel();
    } else {
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = 'Invalid username or password';
        errorDiv.style.display = 'block';
    }
}

function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadAdminListings();
    loadPageContent();
}

function handleLogout() {
    logout();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').style.display = 'none';
}

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
}

// Listings Management
function loadAdminListings() {
    const listings = getAllListings();
    const tbody = document.getElementById('admin-listings-table');
    
    if (listings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No listings yet. Add your first listing!</td></tr>';
        return;
    }
    
    tbody.innerHTML = listings.map(listing => `
        <tr>
            <td>${listing.address}, ${listing.city}</td>
            <td>${formatPrice(listing.price)}</td>
            <td>${listing.beds} / ${listing.baths}</td>
            <td>
                <span class="status-badge status-${listing.published ? 'published' : 'unpublished'}">
                    ${listing.published ? 'Published' : 'Unpublished'}
                </span>
            </td>
            <td class="listing-actions">
                <button onclick="editListing('${listing.id}')" class="btn btn-small">Edit</button>
                <button onclick="togglePublish('${listing.id}')" class="btn btn-small btn-secondary">
                    ${listing.published ? 'Unpublish' : 'Publish'}
                </button>
                <button onclick="confirmDelete('${listing.id}')" class="btn btn-small" style="background: #F44336;">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openListingForm(id = null) {
    const modal = document.getElementById('listing-modal');
    const form = document.getElementById('listing-form');
    const title = document.getElementById('listing-form-title');
    
    if (id) {
        // Edit existing listing
        const listing = getListingById(id);
        title.textContent = 'Edit Listing';
        
        document.getElementById('listing-id').value = listing.id;
        document.getElementById('listing-address').value = listing.address;
        document.getElementById('listing-city').value = listing.city;
        document.getElementById('listing-price').value = listing.price;
        document.getElementById('listing-type').value = listing.type;
        document.getElementById('listing-beds').value = listing.beds;
        document.getElementById('listing-baths').value = listing.baths;
        document.getElementById('listing-sqft').value = listing.sqft;
        document.getElementById('listing-year').value = listing.yearBuilt;
        document.getElementById('listing-description').value = listing.description;
        document.getElementById('listing-lat').value = listing.lat || '';
        document.getElementById('listing-lng').value = listing.lng || '';
        document.getElementById('listing-photos').value = (listing.photos || []).join('\n');
        document.getElementById('listing-published').checked = listing.published;
    } else {
        // New listing
        title.textContent = 'Add New Listing';
        form.reset();
        document.getElementById('listing-id').value = '';
        document.getElementById('listing-published').checked = true;
    }
    
    modal.classList.add('show');
}

function closeListingForm() {
    const modal = document.getElementById('listing-modal');
    modal.classList.remove('show');
}

function editListing(id) {
    openListingForm(id);
}

function saveListing(event) {
    event.preventDefault();
    
    const listing = {
        id: document.getElementById('listing-id').value || Date.now().toString(),
        address: document.getElementById('listing-address').value,
        city: document.getElementById('listing-city').value,
        price: parseFloat(document.getElementById('listing-price').value),
        type: document.getElementById('listing-type').value,
        beds: parseInt(document.getElementById('listing-beds').value),
        baths: parseFloat(document.getElementById('listing-baths').value),
        sqft: parseInt(document.getElementById('listing-sqft').value),
        yearBuilt: parseInt(document.getElementById('listing-year').value),
        description: document.getElementById('listing-description').value,
        lat: parseFloat(document.getElementById('listing-lat').value) || null,
        lng: parseFloat(document.getElementById('listing-lng').value) || null,
        photos: document.getElementById('listing-photos').value.split('\n').filter(url => url.trim()),
        published: document.getElementById('listing-published').checked
    };
    
    const savedListing = window.saveListing(listing);
    
    closeListingForm();
    loadAdminListings();
    
    alert('Listing saved successfully!');
}

function togglePublish(id) {
    toggleListingPublished(id);
    loadAdminListings();
}

function confirmDelete(id) {
    const listing = getListingById(id);
    if (confirm(`Are you sure you want to delete the listing at ${listing.address}?`)) {
        deleteListing(id);
        loadAdminListings();
    }
}

// Page Content Management
function loadPageContent() {
    const pageSelect = document.getElementById('page-select');
    if (!pageSelect) return;
    
    const page = pageSelect.value;
    const pageData = getPageContent(page);
    
    if (page === 'home') {
        document.getElementById('page-hero-title').value = pageData.heroTitle || '';
        document.getElementById('page-hero-subtitle').value = pageData.heroSubtitle || '';
        document.getElementById('page-hero-title').disabled = false;
        document.getElementById('page-hero-subtitle').disabled = false;
    } else {
        document.getElementById('page-hero-title').value = '';
        document.getElementById('page-hero-subtitle').value = '';
        document.getElementById('page-hero-title').disabled = true;
        document.getElementById('page-hero-subtitle').disabled = true;
    }
    
    document.getElementById('page-content').value = pageData.content || '';
}

function savePageContent() {
    const page = document.getElementById('page-select').value;
    const content = {
        content: document.getElementById('page-content').value
    };
    
    if (page === 'home') {
        content.heroTitle = document.getElementById('page-hero-title').value;
        content.heroSubtitle = document.getElementById('page-hero-subtitle').value;
    }
    
    window.savePageContent(page, content);
    
    const successMsg = document.getElementById('page-save-success');
    successMsg.style.display = 'block';
    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 3000);
}
