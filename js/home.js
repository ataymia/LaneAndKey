// Home page specific functionality

document.addEventListener('DOMContentLoaded', function() {
    loadFeaturedListings();
    loadPageContent();
});

// Firestore bridge callback — re-render featured listings when Firestore data arrives
window._refreshWithFirestoreData = function(listings) {
    if (typeof loadFeaturedListings === 'function') {
        loadFeaturedListings(listings);
    }
};

function loadFeaturedListings(listings) {
    if (!listings) {
        listings = getAllListings();
    }
    const featuredListings = listings.slice(0, 3); // Show first 3 listings
    
    const grid = document.getElementById('featured-grid');
    if (grid && featuredListings.length > 0) {
        grid.innerHTML = featuredListings.map(listing => createListingCard(listing)).join('');
    } else if (grid) {
        grid.innerHTML = '<p style="text-align: center; color: #666;">No listings available at this time.</p>';
    }
}

function loadPageContent() {
    const pageData = getPageContent('home');
    
    // Update hero title if customized
    if (pageData.heroTitle) {
        const heroTitle = document.querySelector('.hero-content h1');
        if (heroTitle) {
            heroTitle.textContent = pageData.heroTitle;
        }
    }
    
    // Update hero subtitle if customized
    if (pageData.heroSubtitle) {
        const heroSubtitle = document.querySelector('.hero-content p');
        if (heroSubtitle) {
            heroSubtitle.textContent = pageData.heroSubtitle;
        }
    }
}

function searchFromHero() {
    const heroSearch = document.getElementById('hero-search');
    const query = heroSearch.value.trim();
    
    if (query) {
        sessionStorage.setItem('searchQuery', query);
        window.location.href = 'listings.html';
    }
}

// Allow Enter key in hero search
const heroSearch = document.getElementById('hero-search');
if (heroSearch) {
    heroSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchFromHero();
        }
    });
}
