#!/bin/bash
# Build script for Cloudflare Pages deployment
# 
# Authentication is now handled server-side via Cloudflare Pages Functions
# No build-time credential injection is needed
#
# Required environment variables (set in Cloudflare Pages dashboard):
# - ADMIN_USERNAME: The admin username
# - ADMIN_PASSWORD: The admin password

echo "Building Lane & Key Properties website..."

# Check if environment variables are set (informational only)
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Note: ADMIN_USERNAME and/or ADMIN_PASSWORD environment variables not detected."
    echo "Make sure to set these in Cloudflare Pages Environment Variables for production."
    echo "The /api/admin-auth endpoint requires these variables at runtime."
else
    echo "Environment variables detected (will be used by /api/admin-auth endpoint at runtime)."
fi

echo "Build complete!"
