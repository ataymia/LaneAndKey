# Deployment Guide for Cloudflare Pages

## Overview
This guide explains how to deploy Lane & Key Properties to Cloudflare Pages with secure server-side admin authentication.

## Prerequisites
- A Cloudflare account
- Your GitHub repository connected to Cloudflare Pages
- Admin credentials you want to use (username and password)

## Cloudflare Pages Deployment Steps

### 1. Connect Your Repository
1. Log in to your Cloudflare dashboard
2. Navigate to **Pages** in the sidebar
3. Click **Create a project**
4. Select **Connect to Git**
5. Choose your GitHub account and select the `LaneAndKey` repository
6. Click **Begin setup**

### 2. Configure Build Settings
On the build configuration page:

- **Project name**: Choose a name (e.g., `laneandkey-properties`)
- **Production branch**: `main` (or your default branch)
- **Build command**: `bash build.sh` (optional - no build step required)
- **Build output directory**: `/`

Click **Save and Deploy**

### 3. Set Environment Variables (IMPORTANT - Secure Admin Access)

**IMPORTANT**: Environment variables must be set BEFORE the authentication will work.

1. Go to your project in Cloudflare Pages
2. Click **Settings** > **Environment variables**
3. Add the following variables for **Production**:

   ```
   Variable name: ADMIN_USERNAME
   Value: Latosha
   ```

   ```
   Variable name: ADMIN_PASSWORD
   Value: Ataymia!0
   ```

4. Click **Save**

These environment variables are used by the `/api/admin-auth` Cloudflare Pages Function at runtime to validate admin credentials securely on the server side.

### 4. Verify Deployment

After setting environment variables:

1. Visit your site at `https://[your-project].pages.dev`
2. Navigate to `/admin.html`
3. Try logging in with your configured credentials
4. Verify you can access the admin panel

**No redeployment is necessary** - environment variables are available to Cloudflare Pages Functions immediately.

## Security Best Practices

### DO ✅
- Use strong, unique passwords for admin access
- Keep credentials in Cloudflare environment variables only
- Never commit credentials to the repository
- Change default credentials immediately after first deployment
- Use different credentials for staging and production environments
- Verify credentials are not exposed in browser DevTools or page source

### DON'T ❌
- Don't commit production passwords to the repository
- Don't share admin credentials publicly
- Don't store credentials in client-side code
- Don't use weak or default passwords in production

## How Authentication Works

### Server-Side Authentication (Secure)
1. User enters username and password in the admin login form
2. Credentials are sent via POST request to `/api/admin-auth`
3. The Cloudflare Pages Function validates credentials against environment variables **on the server**
4. Only the authentication result (success/failure) is sent back to the client
5. **No credentials are ever exposed in client-side JavaScript**

### Architecture
```
Browser (Client)           Cloudflare Pages Function (Server)
     |                              |
     |  POST /api/admin-auth        |
     |  {username, password}        |
     |----------------------------->|
     |                              | Check against
     |                              | env.ADMIN_USERNAME
     |                              | env.ADMIN_PASSWORD
     |  {success: true/false}       |
     |<-----------------------------|
     |                              |
```

## Local Development

For local development, you'll need to test with Cloudflare Pages locally or use a mock server:

### Option 1: Cloudflare Wrangler (Recommended)
```bash
npm install -g wrangler
wrangler pages dev . --binding ADMIN_USERNAME=Latosha --binding ADMIN_PASSWORD='Ataymia!0'
```

### Option 2: Simple HTTP Server (No auth testing)
```bash
python -m http.server 8000
# Note: Authentication won't work without the Cloudflare Pages Function runtime
```

## Environment-Specific Variables

You can set different credentials for different environments:

- **Production**: Set via Cloudflare Pages > Settings > Environment variables > Production
- **Preview**: Set via Cloudflare Pages > Settings > Environment variables > Preview

## Updating Admin Credentials

To update admin credentials after deployment:

1. Go to Cloudflare Pages dashboard
2. Select your project
3. Go to **Settings** > **Environment variables**
4. Update `ADMIN_USERNAME` and/or `ADMIN_PASSWORD`
5. Click **Save**
6. Trigger a new deployment (push a commit or retry deployment)

## Verifying Deployment

After deployment and setting environment variables:

1. Visit your site at `https://[your-project].pages.dev`
2. Navigate to `/admin.html`
3. Try logging in with your configured credentials
4. Verify that you can access the admin panel
5. **Open browser DevTools** → Sources/Debugger → Check `js/config.js`:
   - ✅ Should NOT contain any credentials
   - ✅ Should only contain `AUTH_ENDPOINT: '/api/admin-auth'`

## Troubleshooting

### Admin login not working after deployment

**Check environment variables:**
1. Go to Cloudflare Pages dashboard → Your project → Settings → Environment variables
2. Verify both `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set
3. Click "Edit" to verify the values are correct (they won't be displayed)

**Test the authentication endpoint:**
```bash
curl -X POST https://your-project.pages.dev/api/admin-auth \
  -H "Content-Type: application/json" \
  -d '{"username":"YourUsername","password":"YourPassword"}'
```

Expected response for valid credentials:
```json
{"success":true,"message":"Authentication successful."}
```

Expected response for invalid credentials:
```json
{"success":false,"message":"Invalid username or password."}
```

**Common issues:**
- Environment variables not set → Returns 500 error or "Server configuration error"
- Wrong credentials → Returns 401 error "Invalid username or password"
- CORS issues → Check browser console for CORS errors
- Network issues → Check if `/api/admin-auth` endpoint is accessible

### Verify credentials are NOT exposed
1. Open browser DevTools (F12)
2. Go to Sources/Debugger tab
3. Find and open `js/config.js`
4. **Verify**: No `ADMIN_USERNAME` or `ADMIN_PASSWORD` values are visible
5. Search entire page source (Ctrl+U) for your password - it should NOT appear

### Build warnings
- "Environment variables not detected" warning during build is **normal**
- Build-time environment variables are not needed (only runtime variables for the Function)
- The warning is informational only

### Clear cache
- Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
- Clear localStorage: Browser DevTools → Application → Local Storage → Clear
- Hard refresh: Ctrl+F5 (or Cmd+Shift+R on Mac)

## Support

For issues or questions, please open an issue on the GitHub repository.
