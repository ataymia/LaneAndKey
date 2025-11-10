# Deployment Guide for Cloudflare Pages

## Overview
This guide explains how to deploy Lane & Key Properties to Cloudflare Pages with secure admin credentials.

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
- **Build command**: `bash build.sh`
- **Build output directory**: `/`

Click **Save and Deploy**

### 3. Set Environment Variables (IMPORTANT - Secure Admin Access)

After the initial deployment:

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

### 4. Redeploy with Credentials

After setting environment variables:

1. Go to the **Deployments** tab
2. Click **Retry deployment** on the latest deployment
   OR push a new commit to trigger a rebuild

The build script will now inject your secure credentials into the config file during deployment.

## Security Best Practices

### DO ✅
- Use strong, unique passwords for admin access
- Keep credentials in Cloudflare environment variables only
- Never commit `js/config.js` with production credentials
- Change default credentials immediately after first deployment
- Use different credentials for staging and production environments

### DON'T ❌
- Don't commit production passwords to the repository
- Don't share admin credentials publicly
- Don't store credentials directly in client-side code without using environment variables during build
- Don't use placeholder values in production

## Local Development

For local development without environment variables set, authentication will not work. 
You must set the environment variables locally:

```bash
export ADMIN_USERNAME=Latosha
export ADMIN_PASSWORD='Ataymia!0'
bash build.sh
```

Then open the site locally to test admin login.

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

After deployment:

1. Visit your site at `https://[your-project].pages.dev`
2. Navigate to `/admin.html`
3. Try logging in with:
   - Username: Latosha
   - Password: Ataymia!0
4. Verify that you can access the admin panel

## Troubleshooting

### Admin login not working after deployment
- Check that environment variables are set correctly in Cloudflare dashboard
  - ADMIN_USERNAME should be: Latosha
  - ADMIN_PASSWORD should be: Ataymia!0
- Verify the build script ran successfully (check build logs)
- Try redeploying after setting environment variables
- Clear browser cache and localStorage

### Build fails
- Ensure `build.sh` has execute permissions in the repository
- Check build logs in Cloudflare Pages dashboard
- Verify bash is available in the build environment

### Environment variables not being injected
- Ensure you clicked "Save" after adding environment variables
- Make sure you triggered a new deployment after adding variables
- Check that variable names match exactly: `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Verify values are set to: Latosha and Ataymia!0

## Alternative: Using Cloudflare Workers

For even more security, you can use Cloudflare Workers to handle authentication without exposing credentials in client-side code. Contact us for implementation details.

## Support

For issues or questions, please open an issue on the GitHub repository.
