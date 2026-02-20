#!/bin/bash
# Build script for Cloudflare Pages deployment
# 
# Authentication is now handled server-side via Cloudflare Pages Functions
# No build-time credential injection is needed
#
# Required environment variables (set in Cloudflare Pages dashboard):
# - ADMIN_USERNAME: The admin username
# - ADMIN_PASSWORD: The admin password

set -e

echo "Building Lane & Key Properties website..."

# Check if environment variables are set (informational only)
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Note: ADMIN_USERNAME and/or ADMIN_PASSWORD environment variables not detected."
    echo "Make sure to set these in Cloudflare Pages Environment Variables for production."
    echo "The /api/admin-auth endpoint requires these variables at runtime."
else
    echo "Environment variables detected (will be used by /api/admin-auth endpoint at runtime)."
fi

# Create output directory
echo "Creating output directory..."
rm -rf dist
mkdir -p dist

# Copy main website files
echo "Copying main website files..."
cp -r css dist/
cp -r js dist/
cp -r images dist/
cp -r functions dist/
cp *.html dist/
cp _headers dist/
cp _redirects dist/
cp _routes.json dist/

# Build the portal React application
echo "Building portal application..."
cd portal
npm ci
npm run build
cd ..

# Copy the built portal to the output directory
echo "Copying portal build to dist/portal..."
cp -r portal/dist dist/portal

echo "Build complete! Output is in the 'dist' directory."
