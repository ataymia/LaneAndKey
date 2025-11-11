# Admin Portal Guide

## Overview
The Lane & Key Properties admin portal has been completely revamped to provide a comprehensive content management system for the website.

## Features

### 1. Dashboard
- Overview statistics (total listings, published listings, new contacts, viewing requests)
- Recent activity feed
- Quick access to all sections

### 2. Listings Management
- Add, edit, and delete property listings
- Publish/unpublish listings
- Full property details including photos, location, and specifications

### 3. Form Submissions Management
The admin portal now manages all form submissions internally (EmailJS has been removed):

#### Contact Forms
- View all contact form submissions
- Mark submissions as contacted
- Delete submissions
- Filter by status

#### Viewing Requests
- See all property viewing requests
- View which property the request is for
- Manage request status
- Contact information for follow-up

#### Sell Inquiries
- Manage "Get Started" form submissions
- Property details from sellers
- Track inquiry status

### 4. Content Editor
- Edit home page hero title and subtitle
- Edit about page content
- Customize page content without touching code

### 5. Site Settings
- Configure site name and tagline
- Update contact information (email, phone)
- Edit office hours
- Global settings management

## Access

To access the admin portal:
1. Navigate to `/admin.html`
2. Login with credentials set in Cloudflare Pages environment variables:
   - `ADMIN_USERNAME`: Latosha
   - `ADMIN_PASSWORD`: Ataymia!0

## Data Storage

All data is stored in browser localStorage:
- Listings
- Form submissions
- Page content
- Site settings

**Note**: Data is stored locally in each user's browser. For production use, consider implementing a backend database solution.

## Key Changes from Previous Version

1. **Removed EmailJS**: All forms now save submissions to localStorage for review in the admin portal
2. **Modern UI**: Professional gradient sidebar design with intuitive navigation
3. **Comprehensive Management**: Can now manage all aspects of the website from one place
4. **Status Tracking**: Track the status of all form submissions (new, contacted, completed)
5. **Logo Integration**: Logo appears on all pages with drop shadow effect

## Technical Details

### Files Added/Modified:
- `admin.html` - Completely redesigned admin interface
- `css/admin-modern.css` - Modern professional styling
- `js/admin-modern.js` - Enhanced admin functionality
- `js/data.js` - Added submission storage functions
- `js/contact.js` - Removed EmailJS, added localStorage saving
- `js/common.js` - Updated sell form to save to localStorage
- `js/listing.js` - Updated viewing request form to save to localStorage
- All HTML files - Added logo to navigation

### Color Scheme
- Primary: #9BAAFF (Periwinkle)
- Light: #CCD5FF (Light Periwinkle)
- Dark: #6B7FFF (Dark Periwinkle)
- Maintains the existing brand colors throughout

## Browser Compatibility

The admin portal works with all modern browsers that support:
- ES6+ JavaScript
- CSS Grid and Flexbox
- localStorage API

## Future Enhancements

Consider implementing:
- Backend database for data persistence
- Email notifications for new submissions
- Export submissions to CSV
- Image upload functionality
- Multi-user support with different permission levels
