/**
 * Firebase Token Verification for Cloudflare Workers/Pages Functions
 * 
 * Since firebase-admin doesn't work in edge runtime, we verify Firebase ID tokens
 * manually using jose library for JWT verification with Google's public keys (JWKS).
 */

// Google's JWKS endpoint for Firebase tokens
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Cache for JWKS keys
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_DURATION = 3600 * 1000; // 1 hour

/**
 * Fetch and cache Google's public keys for Firebase token verification
 */
async function getGooglePublicKeys() {
  const now = Date.now();
  
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_DURATION) {
    return jwksCache;
  }
  
  try {
    const response = await fetch(GOOGLE_JWKS_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch Google public keys');
    }
    
    const data = await response.json();
    jwksCache = data.keys;
    jwksCacheTime = now;
    
    return jwksCache;
  } catch (error) {
    console.error('Error fetching Google public keys:', error);
    throw error;
  }
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(base64 + padding);
  return decoded;
}

/**
 * Convert JWK to CryptoKey
 */
async function jwkToCryptoKey(jwk) {
  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      use: 'sig'
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
}

/**
 * Verify Firebase ID token
 * 
 * @param {string} idToken - The Firebase ID token to verify
 * @param {string} projectId - Firebase project ID (for audience validation)
 * @returns {Promise<Object>} - The decoded token payload with uid
 */
export async function verifyFirebaseToken(idToken, projectId) {
  if (!idToken) {
    throw new Error('No ID token provided');
  }
  
  if (!projectId) {
    throw new Error('Firebase project ID not configured');
  }
  
  // Split the token
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const [headerB64, payloadB64, signatureB64] = parts;
  
  // Decode header
  let header;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    throw new Error('Invalid token header');
  }
  
  // Decode payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    throw new Error('Invalid token payload');
  }
  
  // Validate algorithm
  if (header.alg !== 'RS256') {
    throw new Error('Invalid token algorithm');
  }
  
  // Validate issuer
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }
  
  // Validate audience
  if (payload.aud !== projectId) {
    throw new Error('Invalid token audience');
  }
  
  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Token has expired');
  }
  
  // Validate not before (auth_time)
  if (payload.auth_time > now) {
    throw new Error('Token used before auth_time');
  }
  
  // Validate subject (uid)
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token subject');
  }
  
  // Get the public keys
  const publicKeys = await getGooglePublicKeys();
  
  // Find the key matching the token's kid
  const key = publicKeys.find(k => k.kid === header.kid);
  if (!key) {
    throw new Error('Public key not found for token');
  }
  
  // Convert JWK to CryptoKey
  const cryptoKey = await jwkToCryptoKey(key);
  
  // Prepare signature verification
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  
  // Decode signature from base64url
  const signatureStr = base64UrlDecode(signatureB64);
  const signature = new Uint8Array(signatureStr.length);
  for (let i = 0; i < signatureStr.length; i++) {
    signature[i] = signatureStr.charCodeAt(i);
  }
  
  // Verify signature
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    signedData
  );
  
  if (!isValid) {
    throw new Error('Invalid token signature');
  }
  
  // Return the decoded payload with uid
  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
    auth_time: payload.auth_time,
    iat: payload.iat,
    exp: payload.exp,
  };
}

/**
 * Extract the Bearer token from Authorization header
 * 
 * @param {Request} request - The incoming request
 * @returns {string|null} - The token or null if not found
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Middleware-style helper to authenticate a request
 * 
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} - The authenticated user data
 */
export async function authenticateRequest(request, env) {
  const token = extractBearerToken(request);
  
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  const projectId = env.FIREBASE_PROJECT_ID;
  
  return await verifyFirebaseToken(token, projectId);
}
