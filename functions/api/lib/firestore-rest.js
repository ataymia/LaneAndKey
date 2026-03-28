/**
 * Firestore REST API Client for Cloudflare Pages Functions
 * 
 * Since firebase-admin doesn't work in edge/Cloudflare runtime,
 * we use the Firestore REST API with the Firebase Web API key
 * for server-side operations that need admin access.
 * 
 * For authenticated operations, we use the user's Firebase ID token.
 */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

/**
 * Build the Firestore base URL for a project
 */
function getFirestoreUrl(projectId) {
  return `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents`;
}

/**
 * Convert a Firestore REST value to a plain JS value
 */
function fromFirestoreValue(value) {
  if (value === undefined || value === null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const result = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      result[k] = fromFirestoreValue(v);
    }
    return result;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

/**
 * Convert a plain JS value to a Firestore REST value
 */
function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Convert a Firestore document to a plain object
 */
function docToObject(doc) {
  const result = {};
  if (doc.fields) {
    for (const [key, value] of Object.entries(doc.fields)) {
      result[key] = fromFirestoreValue(value);
    }
  }
  // Extract ID from document name
  const parts = doc.name.split('/');
  result.id = parts[parts.length - 1];
  return result;
}

/**
 * Convert a plain object to Firestore fields
 */
function objectToFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'id') continue; // skip id, it's in the doc path
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

// ─── CRUD Operations ───────────────────────────────────────

/**
 * Get a document by path
 */
export async function getDocument(projectId, collectionPath, docId, idToken) {
  const url = `${getFirestoreUrl(projectId)}/${collectionPath}/${docId}`;
  const headers = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  
  const response = await fetch(url, { headers });
  if (response.status === 404) return null;
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore GET failed: ${err}`);
  }
  
  const doc = await response.json();
  return docToObject(doc);
}

/**
 * Query documents with structured query
 */
export async function queryDocuments(projectId, collectionPath, filters, orderByField, idToken) {
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:runQuery`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  // Build structured query
  const structuredQuery = {
    from: [{ collectionId: collectionPath.split('/').pop() }],
  };

  // Set parent path for subcollections
  const pathParts = collectionPath.split('/');
  let parent = `projects/${projectId}/databases/(default)/documents`;
  if (pathParts.length > 1) {
    parent += '/' + pathParts.slice(0, -1).join('/');
  }

  // Add filters
  if (filters && filters.length > 0) {
    if (filters.length === 1) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: filters[0].field },
          op: filters[0].op || 'EQUAL',
          value: toFirestoreValue(filters[0].value),
        }
      };
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: 'AND',
          filters: filters.map(f => ({
            fieldFilter: {
              field: { fieldPath: f.field },
              op: f.op || 'EQUAL',
              value: toFirestoreValue(f.value),
            }
          })),
        }
      };
    }
  }

  if (orderByField) {
    structuredQuery.orderBy = [{
      field: { fieldPath: orderByField.field },
      direction: orderByField.direction || 'DESCENDING',
    }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery, parent }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore query failed: ${err}`);
  }

  const results = await response.json();
  return results
    .filter(r => r.document)
    .map(r => docToObject(r.document));
}

/**
 * Create or overwrite a document at a specific path
 */
export async function setDocument(projectId, collectionPath, docId, data, idToken) {
  const url = `${getFirestoreUrl(projectId)}/${collectionPath}/${docId}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: objectToFields(data) }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore SET failed: ${err}`);
  }

  return await response.json();
}

/**
 * Update specific fields
 */
export async function updateDocument(projectId, collectionPath, docId, data, idToken) {
  const fields = objectToFields(data);
  const updateMask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${getFirestoreUrl(projectId)}/${collectionPath}/${docId}?${updateMask}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore UPDATE failed: ${err}`);
  }

  return await response.json();
}

/**
 * Create a document with auto-generated ID  
 */
export async function createDocument(projectId, collectionPath, data, idToken) {
  const url = `${getFirestoreUrl(projectId)}/${collectionPath}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fields: objectToFields(data) }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore CREATE failed: ${err}`);
  }

  const doc = await response.json();
  return docToObject(doc);
}

/**
 * Check if a document exists (without throwing on 404)
 */
export async function documentExists(projectId, collectionPath, docId, idToken) {
  const url = `${getFirestoreUrl(projectId)}/${collectionPath}/${docId}`;
  const headers = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  
  const response = await fetch(url, { headers });
  return response.status !== 404;
}

/**
 * Get subcollection documents
 */
export async function getSubcollection(projectId, parentPath, subcollection, idToken) {
  const url = `${getFirestoreUrl(projectId)}/${parentPath}/${subcollection}`;
  const headers = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore GET subcollection failed: ${err}`);
  }

  const data = await response.json();
  return (data.documents || []).map(docToObject);
}

/**
 * Atomically commit multiple writes.
 *
 * writes item format:
 * - { op: 'set', path: 'collection/doc[/sub/doc]', data: {...} }
 * - { op: 'update', path: 'collection/doc[/sub/doc]', data: {...} }
 */
export async function commitWrites(projectId, writes, idToken) {
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:commit`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const payloadWrites = writes.map((w) => {
    const fields = objectToFields(w.data || {});
    const docName = `projects/${projectId}/databases/(default)/documents/${w.path}`;

    if (w.op === 'set') {
      return {
        update: {
          name: docName,
          fields,
        },
      };
    }

    if (w.op === 'update') {
      return {
        update: {
          name: docName,
          fields,
        },
        updateMask: {
          fieldPaths: Object.keys(fields),
        },
      };
    }

    throw new Error(`Unsupported write op: ${w.op}`);
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes: payloadWrites }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore COMMIT failed: ${err}`);
  }

  return await response.json();
}

// ─── Service Account Auth ──────────────────────────────────

/**
 * Obtain a Google OAuth2 access token using a service account (JWT → token exchange).
 * Compatible with Cloudflare Workers runtime (uses Web Crypto API).
 *
 * Expects env.FIREBASE_SERVICE_ACCOUNT_JSON — a JSON string containing
 * the service account key file with at least:
 *   { client_email, private_key, token_uri }
 *
 * Tokens are scoped to Firestore/Datastore.
 */

// Base64url encode
function base64url(input) {
  const str = typeof input === 'string' ? input : new TextDecoder().decode(input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Import PEM private key as CryptoKey for RS256 signing
async function importPrivateKey(pem) {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Generate a Google OAuth2 access token from a service account key.
 * @param {object} env - Cloudflare environment bindings. Must contain FIREBASE_SERVICE_ACCOUNT_JSON.
 * @returns {Promise<string>} Google OAuth2 access token.
 */
export async function getServiceAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  }

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const iss = sa.client_email;
  const scope = 'https://www.googleapis.com/auth/datastore';
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  // Build JWT
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64url(JSON.stringify({ iss, scope, aud, iat, exp }));
  const unsignedToken = `${header}.${claimSet}`;

  const key = await importPrivateKey(sa.private_key);
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken));
  const signature = base64url(new Uint8Array(sigBuffer));
  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Service account token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

export {
  toFirestoreValue,
  fromFirestoreValue,
  docToObject,
  objectToFields,
};
