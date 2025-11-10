# Lane & Key Properties

A modern, responsive real estate website built with vanilla HTML, CSS, and JavaScript. Features a periwinkle and white color scheme optimized for Cloudflare Pages deployment.

## Features

### Public-Facing Pages
- **Home Page**: Hero section with search functionality and featured listings
- **About Page**: Company information with agent headshot and values
- **Listings Page**: Interactive map view (using Leaflet/OpenStreetMap) and grid view with advanced filtering
- **Contact Page**: Contact form for inquiries

### Listing Features
- Property details: price, beds, baths, square footage, year built, address, description, photos
- Zillow-style map search with interactive markers
- Advanced filters: city, radius, price range, beds, baths, sqft, year built, property type
- Sitewide search functionality
- "Looking to Sell" form modal

### Admin Panel
- Secure login system with environment variable-based authentication
- Create, edit, and delete listings
- Publish/unpublish toggle for listings
- Edit page content (Home and About pages)
- Photo URL management
- JSON-based storage using localStorage

## Technology Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Custom CSS with CSS Grid and Flexbox
- **Mapping**: Leaflet.js with OpenStreetMap tiles
- **Storage**: Browser localStorage (JSON format)
- **Deployment**: Optimized for Cloudflare Pages

## Color Scheme
- Primary: Periwinkle (#9BAAFF, #CCD5FF)
- Secondary: White (#FFFFFF)
- Text: Dark gray (#333333, #666666)

## Getting Started

### Installation
No build process required! Simply clone the repository and open `index.html` in a web browser.

```bash
git clone https://github.com/ataymia/LaneAndKey.git
cd LaneAndKey
```

### Local Development
Open `index.html` in your browser or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

### Deployment to Cloudflare Pages
1. Push your code to a GitHub repository
2. Log in to Cloudflare Pages
3. Create a new project and connect your repository
4. Build settings:
   - Build command: (leave empty)
   - Build output directory: `/`
5. Deploy!

## Project Structure
```
LaneAndKey/
├── index.html          # Home page
├── about.html          # About page
├── listings.html       # Listings page with map and filters
├── contact.html        # Contact page
├── admin.html          # Admin panel
├── css/
│   └── styles.css      # Main stylesheet
├── js/
│   ├── data.js         # Data management and localStorage
│   ├── common.js       # Shared functions
│   ├── home.js         # Home page functionality
│   ├── listings.js     # Listings page with map
│   ├── contact.js      # Contact form handling
│   └── admin.js        # Admin panel functionality
└── images/
    └── README.md       # Instructions for images

```

## Usage

### For Visitors
1. Browse listings on the home page or navigate to the Listings page
2. Use filters to narrow down properties by city, price, beds, baths, etc.
3. Toggle between map view and grid view
4. Click "Looking to Sell" to submit property information
5. Use the contact form to get in touch

### For Administrators
1. Navigate to `/admin.html`
2. Login with configured credentials (see DEPLOYMENT.md for setup)
3. Manage listings:
   - Add new listings with all property details
   - Edit existing listings
   - Publish or unpublish listings
   - Delete listings
4. Edit page content for Home and About pages
5. Add photo URLs for property images

## Data Storage
The application uses browser localStorage to store:
- Property listings (JSON format)
- Page content
- Authentication state

**Note**: For production use, you should implement a proper backend with a database. The current localStorage implementation is for demonstration purposes.

## Security Notes

### Admin Portal Password Protection
The admin portal uses environment variables for secure credential management:
- **Local Development**: Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables before running build.sh
- **Production**: Credentials injected from Cloudflare Pages environment variables

### Deployment Security
1. **NEVER commit production passwords** to the repository
2. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as environment variables in Cloudflare Pages
3. The build script (`build.sh`) automatically injects these credentials during deployment
4. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed security setup instructions

### Production Deployment Checklist
- [ ] Set `ADMIN_USERNAME` environment variable in Cloudflare Pages (value: Latosha)
- [ ] Set `ADMIN_PASSWORD` environment variable in Cloudflare Pages (value: Ataymia!0)
- [ ] Test admin login after deployment with the configured credentials

### Additional Security Recommendations
- For production use, consider implementing proper server-side authentication
- Add rate limiting for login attempts
- Implement session timeout
- Use HTTPS only (Cloudflare Pages provides this automatically)
- Consider implementing 2FA for admin access

## Browser Compatibility
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is available for use under the MIT License.

## Support
For issues or questions, please open an issue on GitHub.