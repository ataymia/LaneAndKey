// Modern Admin panel functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    if (checkAuth()) {
        showAdminPanel();
    }
});

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    const submitButton = event.target.querySelector('button[type="submit"]');
    
    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';
    errorDiv.style.display = 'none';
    
    try {
        const success = await login(username, password);
        
        if (success) {
            showAdminPanel();
        } else {
            errorDiv.textContent = 'Invalid username or password';
            errorDiv.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In';
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Sign In';
    }
}

function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadDashboard();
    loadAdminListings();
    loadContactSubmissions();
    loadViewingRequests();
    loadSellInquiries();
    loadPageContent();
    loadSiteSettingsForm();
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        logout();
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('login-error').style.display = 'none';
    }
}

// Tab switching
function showAdminTab(tabName) {
    // Remove active class from all nav items and tabs
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active class to selected items
    const navItem = document.querySelector(`.nav-item[onclick*="${tabName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) {
        tab.classList.add('active');
    }
    
    // Reload data for specific tabs
    if (tabName === 'dashboard') {
        loadDashboard();
    } else if (tabName === 'contacts') {
        loadContactSubmissions();
    } else if (tabName === 'viewings') {
        loadViewingRequests();
    } else if (tabName === 'sell-inquiries') {
        loadSellInquiries();
    }
}

// Dashboard
function loadDashboard() {
    const listings = getAllListings();
    const published = listings.filter(l => l.published).length;
    const contacts = getContactSubmissions().filter(s => s.status === 'new').length;
    const viewings = getViewingRequests().filter(r => r.status === 'new').length;
    const sells = getSellInquiries().filter(i => i.status === 'new').length;
    
    // Update stats
    document.getElementById('stat-listings').textContent = listings.length;
    document.getElementById('stat-published').textContent = published;
    document.getElementById('stat-contacts').textContent = contacts;
    document.getElementById('stat-viewings').textContent = viewings;
    
    // Update badges
    document.getElementById('contacts-badge').textContent = contacts;
    document.getElementById('viewings-badge').textContent = viewings;
    document.getElementById('sell-badge').textContent = sells;
    
    // Load recent activity
    loadRecentActivity();
}

function loadRecentActivity() {
    const activityList = document.getElementById('recent-activity');
    const contacts = getContactSubmissions().slice(0, 3);
    const viewings = getViewingRequests().slice(0, 3);
    const sells = getSellInquiries().slice(0, 3);
    
    const activities = [];
    
    contacts.forEach(c => {
        activities.push({
            icon: '📧',
            title: `New contact from ${c.name}`,
            time: formatDate(c.date),
            date: c.date
        });
    });
    
    viewings.forEach(v => {
        activities.push({
            icon: '👁️',
            title: `Viewing request from ${v.name} for ${v.listingAddress}`,
            time: formatDate(v.date),
            date: v.date
        });
    });
    
    sells.forEach(s => {
        activities.push({
            icon: '💰',
            title: `Sell inquiry from ${s.name} for ${s.address}`,
            time: formatDate(s.date),
            date: s.date
        });
    });
    
    // Sort by date
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (activities.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No Recent Activity</h3>
                <p>New submissions and actions will appear here</p>
            </div>
        `;
        return;
    }
    
    activityList.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

// Listings Management
function loadAdminListings() {
    const listings = getAllListings();
    const tbody = document.getElementById('admin-listings-table');
    
    if (listings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-state-icon">🏠</div>
                        <h3>No Listings Yet</h3>
                        <p>Click "Add New Listing" to create your first property listing</p>
                    </div>
                </td>
            </tr>
        `;
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
            <td>
                <div class="action-buttons">
                    <button onclick="editListing('${listing.id}')" class="btn btn-primary btn-sm">Edit</button>
                    <button onclick="togglePublish('${listing.id}')" class="btn btn-warning btn-sm">
                        ${listing.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button onclick="confirmDelete('${listing.id}')" class="btn btn-danger btn-sm">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openListingForm(id = null) {
    const modal = document.getElementById('listing-modal');
    const form = document.getElementById('listing-form');
    const title = document.getElementById('listing-form-title');
    
    if (id) {
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
    
    window.saveListing(listing);
    
    closeListingForm();
    loadAdminListings();
    loadDashboard();
    
    showNotification('Listing saved successfully!');
}

function togglePublish(id) {
    toggleListingPublished(id);
    loadAdminListings();
    loadDashboard();
}

function confirmDelete(id) {
    const listing = getListingById(id);
    if (confirm(`Are you sure you want to delete the listing at ${listing.address}?`)) {
        deleteListing(id);
        loadAdminListings();
        loadDashboard();
        showNotification('Listing deleted successfully');
    }
}

// Contact Submissions
function loadContactSubmissions() {
    const submissions = getContactSubmissions();
    const tbody = document.getElementById('contacts-table');
    
    if (submissions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon">📧</div>
                        <h3>No Contact Submissions</h3>
                        <p>Contact form submissions will appear here</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = submissions.map(s => `
        <tr>
            <td>${formatDate(s.date)}</td>
            <td>${s.name}</td>
            <td>${s.email}</td>
            <td>${s.phone || 'N/A'}</td>
            <td>${s.interest || 'N/A'}</td>
            <td>
                <span class="status-badge status-${s.status}">
                    ${s.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="viewContactDetail('${s.id}')" class="btn btn-info btn-sm">View</button>
                    <button onclick="updateContactStatus('${s.id}', 'contacted')" class="btn btn-success btn-sm">Mark Contacted</button>
                    <button onclick="deleteContactSubmission('${s.id}')" class="btn btn-danger btn-sm">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewContactDetail(id) {
    const submissions = getContactSubmissions();
    const submission = submissions.find(s => s.id === id);
    if (!submission) return;
    
    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-title').textContent = 'Contact Submission Details';
    document.getElementById('detail-modal-content').innerHTML = `
        <div class="form-card">
            <p><strong>Date:</strong> ${new Date(submission.date).toLocaleString()}</p>
            <p><strong>Name:</strong> ${submission.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${submission.email}">${submission.email}</a></p>
            <p><strong>Phone:</strong> ${submission.phone || 'N/A'}</p>
            <p><strong>Interest:</strong> ${submission.interest || 'N/A'}</p>
            <p><strong>Message:</strong></p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
                ${submission.message || 'No message provided'}
            </div>
            <p style="margin-top: 1rem;"><strong>Status:</strong> <span class="status-badge status-${submission.status}">${submission.status}</span></p>
        </div>
    `;
    modal.classList.add('show');
}

function updateContactStatus(id, status) {
    updateContactSubmissionStatus(id, status);
    loadContactSubmissions();
    loadDashboard();
    showNotification('Status updated successfully');
}

function deleteContactSubmission(id) {
    if (confirm('Are you sure you want to delete this submission?')) {
        window.deleteContactSubmission(id);
        loadContactSubmissions();
        loadDashboard();
        showNotification('Submission deleted successfully');
    }
}

// Viewing Requests
function loadViewingRequests() {
    const requests = getViewingRequests();
    const tbody = document.getElementById('viewings-table');
    
    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon">👁️</div>
                        <h3>No Viewing Requests</h3>
                        <p>Property viewing requests will appear here</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = requests.map(r => `
        <tr>
            <td>${formatDate(r.date)}</td>
            <td>${r.listingAddress}</td>
            <td>${r.name}</td>
            <td>${r.email}</td>
            <td>${r.phone}</td>
            <td>
                <span class="status-badge status-${r.status}">
                    ${r.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="viewViewingDetail('${r.id}')" class="btn btn-info btn-sm">View</button>
                    <button onclick="updateViewingStatus('${r.id}', 'contacted')" class="btn btn-success btn-sm">Mark Contacted</button>
                    <button onclick="deleteViewingRequest('${r.id}')" class="btn btn-danger btn-sm">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewViewingDetail(id) {
    const requests = getViewingRequests();
    const request = requests.find(r => r.id === id);
    if (!request) return;
    
    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-title').textContent = 'Viewing Request Details';
    document.getElementById('detail-modal-content').innerHTML = `
        <div class="form-card">
            <p><strong>Date:</strong> ${new Date(request.date).toLocaleString()}</p>
            <p><strong>Property:</strong> ${request.listingAddress}</p>
            <p><strong>Name:</strong> ${request.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${request.email}">${request.email}</a></p>
            <p><strong>Phone:</strong> ${request.phone}</p>
            <p><strong>Message:</strong></p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
                ${request.message || 'No message provided'}
            </div>
            <p style="margin-top: 1rem;"><strong>Status:</strong> <span class="status-badge status-${request.status}">${request.status}</span></p>
        </div>
    `;
    modal.classList.add('show');
}

function updateViewingStatus(id, status) {
    updateViewingRequestStatus(id, status);
    loadViewingRequests();
    loadDashboard();
    showNotification('Status updated successfully');
}

function deleteViewingRequest(id) {
    if (confirm('Are you sure you want to delete this request?')) {
        window.deleteViewingRequest(id);
        loadViewingRequests();
        loadDashboard();
        showNotification('Request deleted successfully');
    }
}

// Sell Inquiries
function loadSellInquiries() {
    const inquiries = getSellInquiries();
    const tbody = document.getElementById('sell-inquiries-table');
    
    if (inquiries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-state-icon">💰</div>
                        <h3>No Sell Inquiries</h3>
                        <p>Property sell inquiries will appear here</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = inquiries.map(i => `
        <tr>
            <td>${formatDate(i.date)}</td>
            <td>${i.name}</td>
            <td>${i.email}</td>
            <td>${i.phone}</td>
            <td>${i.address}</td>
            <td>${i.propertyType}</td>
            <td>
                <span class="status-badge status-${i.status}">
                    ${i.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="viewSellDetail('${i.id}')" class="btn btn-info btn-sm">View</button>
                    <button onclick="updateSellStatus('${i.id}', 'contacted')" class="btn btn-success btn-sm">Mark Contacted</button>
                    <button onclick="deleteSellInquiry('${i.id}')" class="btn btn-danger btn-sm">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewSellDetail(id) {
    const inquiries = getSellInquiries();
    const inquiry = inquiries.find(i => i.id === id);
    if (!inquiry) return;
    
    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-title').textContent = 'Sell Inquiry Details';
    document.getElementById('detail-modal-content').innerHTML = `
        <div class="form-card">
            <p><strong>Date:</strong> ${new Date(inquiry.date).toLocaleString()}</p>
            <p><strong>Name:</strong> ${inquiry.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${inquiry.email}">${inquiry.email}</a></p>
            <p><strong>Phone:</strong> ${inquiry.phone}</p>
            <p><strong>Property Address:</strong> ${inquiry.address}</p>
            <p><strong>Property Type:</strong> ${inquiry.propertyType}</p>
            <p><strong>Additional Information:</strong></p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
                ${inquiry.message || 'No additional information provided'}
            </div>
            <p style="margin-top: 1rem;"><strong>Status:</strong> <span class="status-badge status-${inquiry.status}">${inquiry.status}</span></p>
        </div>
    `;
    modal.classList.add('show');
}

function updateSellStatus(id, status) {
    updateSellInquiryStatus(id, status);
    loadSellInquiries();
    loadDashboard();
    showNotification('Status updated successfully');
}

function deleteSellInquiry(id) {
    if (confirm('Are you sure you want to delete this inquiry?')) {
        window.deleteSellInquiry(id);
        loadSellInquiries();
        loadDashboard();
        showNotification('Inquiry deleted successfully');
    }
}

// Page Content Management
function loadPageContent() {
    const pageSelect = document.getElementById('page-select');
    if (!pageSelect) return;
    
    const page = pageSelect.value;
    const pageData = getPageContent(page);
    
    const homeFields = document.getElementById('home-page-fields');
    if (page === 'home') {
        homeFields.style.display = 'block';
        document.getElementById('page-hero-title').value = pageData.heroTitle || '';
        document.getElementById('page-hero-subtitle').value = pageData.heroSubtitle || '';
    } else {
        homeFields.style.display = 'none';
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

// Site Settings
function loadSiteSettingsForm() {
    const settings = getSiteSettings();
    
    document.getElementById('settings-site-name').value = settings.siteName;
    document.getElementById('settings-tagline').value = settings.tagline;
    document.getElementById('settings-email').value = settings.email;
    document.getElementById('settings-phone').value = settings.phone;
    document.getElementById('settings-hours-weekday').value = settings.officeHours.weekday;
    document.getElementById('settings-hours-saturday').value = settings.officeHours.saturday;
    document.getElementById('settings-hours-sunday').value = settings.officeHours.sunday;
}

function saveSiteSettingsForm() {
    const settings = {
        siteName: document.getElementById('settings-site-name').value,
        tagline: document.getElementById('settings-tagline').value,
        email: document.getElementById('settings-email').value,
        phone: document.getElementById('settings-phone').value,
        officeHours: {
            weekday: document.getElementById('settings-hours-weekday').value,
            saturday: document.getElementById('settings-hours-saturday').value,
            sunday: document.getElementById('settings-hours-sunday').value
        }
    };
    
    saveSiteSettings(settings);
    
    const successMsg = document.getElementById('settings-save-success');
    successMsg.style.display = 'block';
    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 3000);
    
    showNotification('Settings saved successfully!');
}

// Modal utilities
function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('show');
}

// Notification system
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: #4CAF50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const listingModal = document.getElementById('listing-modal');
    const detailModal = document.getElementById('detail-modal');
    
    if (event.target === listingModal) {
        closeListingForm();
    }
    
    if (event.target === detailModal) {
        closeDetailModal();
    }
});

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
