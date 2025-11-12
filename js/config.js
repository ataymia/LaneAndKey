// Configuration file for environment-specific settings
// 
// SECURITY NOTE: Authentication is now handled server-side via Cloudflare Pages Functions
// No credentials are stored or exposed in client-side JavaScript
// 
// Authentication endpoint: /api/admin-auth (POST)
// Required environment variables in Cloudflare Pages:
// - ADMIN_USERNAME
// - ADMIN_PASSWORD

const CONFIG = {
    // Authentication is now handled server-side
    // No client-side credential storage
    AUTH_ENDPOINT: '/api/admin-auth'
};
