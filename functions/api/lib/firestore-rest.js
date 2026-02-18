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

export {
  toFirestoreValue,
  fromFirestoreValue,
  docToObject,
  objectToFields,
};
