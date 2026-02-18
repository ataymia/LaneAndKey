#!/usr/bin/env node
/**
 * bootstrap-admin.js
 *
 * Sets a Firestore user document's role to "admin".
 *
 * Usage:
 *   node scripts/bootstrap-admin.js <uid>
 *
 * Requirements:
 *   - FIREBASE_PROJECT_ID   env var
 *   - FIREBASE_SA_KEY       env var  (base-64 encoded service-account JSON)
 *     OR run from a machine with Application Default Credentials.
 *
 * This script uses the Firestore REST API so it works without firebase-admin SDK.
 */

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/bootstrap-admin.js <uid>');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('Error: FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID env var required');
  process.exit(1);
}

async function getAccessToken() {
  // If a service account key is provided, exchange it for a token
  const saKey = process.env.FIREBASE_SA_KEY;
  if (saKey) {
    const sa = JSON.parse(Buffer.from(saKey, 'base64').toString('utf-8'));
    // Build a JWT and exchange via Google OAuth endpoint
    const { createSign } = await import('node:crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
    return data.access_token;
  }

  // Fall back to Application Default Credentials (e.g. gcloud auth)
  const { execSync } = await import('node:child_process');
  return execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
}

async function main() {
  console.log(`Setting user ${uid} as admin in project ${projectId}…`);
  const token = await getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

  // First check if the document exists
  const getRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  let fields = {};
  if (getRes.ok) {
    const existing = await getRes.json();
    // Preserve existing fields
    if (existing.fields) {
      fields = { ...existing.fields };
    }
  }

  // Set role to admin
  fields.role = { stringValue: 'admin' };

  // PATCH (upsert)
  const patchRes = await fetch(`${url}?updateMask.fieldPaths=role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error(`Failed: ${patchRes.status} ${err}`);
    process.exit(1);
  }

  console.log(`✓ User ${uid} is now an admin.`);
  console.log('  They will see the admin portal on their next login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
