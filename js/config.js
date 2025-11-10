// Configuration file for environment-specific settings
// This file should be replaced during deployment with actual credentials

// SECURITY NOTE: For Cloudflare Pages deployment
// Replace this file during the build process with credentials from environment variables
// OR use Cloudflare Workers to serve this file dynamically with secrets

const CONFIG = {
    // Default credentials for local development only
    // These should be overridden in production
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin123'
};

// Function to check if credentials match
function validateCredentials(username, password) {
    return username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD;
}

// Function to load credentials from remote source (optional)
async function loadRemoteConfig() {
    try {
        // In production, this could fetch from a Cloudflare Worker that has access to secrets
        // For now, we'll use the hardcoded config
        return CONFIG;
    } catch (error) {
        console.error('Failed to load remote config', error);
        return CONFIG;
    }
}
