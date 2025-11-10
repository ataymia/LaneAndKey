#!/bin/bash
# Build script for Cloudflare Pages deployment
# This script injects environment variables into the config file

echo "Building Lane & Key Properties website..."

# If environment variables are set, inject them into config.js
if [ ! -z "$ADMIN_USERNAME" ] && [ ! -z "$ADMIN_PASSWORD" ]; then
    echo "Injecting admin credentials from environment variables..."
    cat > js/config.js << EOF
// Configuration file - Generated during build
// Credentials injected from Cloudflare environment variables

const CONFIG = {
    ADMIN_USERNAME: '${ADMIN_USERNAME}',
    ADMIN_PASSWORD: '${ADMIN_PASSWORD}'
};

function validateCredentials(username, password) {
    return username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD;
}

async function loadRemoteConfig() {
    return CONFIG;
}
EOF
    echo "Credentials injected successfully"
else
    echo "Warning: ADMIN_USERNAME and ADMIN_PASSWORD not set."
    echo "For production, set ADMIN_USERNAME=Latosha and ADMIN_PASSWORD=Ataymia!0"
    echo "in Cloudflare Pages Environment Variables."
fi

echo "Build complete!"
