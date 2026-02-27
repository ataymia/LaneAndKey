import { authenticateRequest, extractBearerToken } from './firebase-verify.js';
import { getDocument } from './firestore-rest.js';

export async function requireAuth(request, env) {
  const idToken = extractBearerToken(request);
  const user = await authenticateRequest(request, env);
  if (!user?.uid) {
    throw new Error('Authentication required');
  }
  return {
    user,
    idToken,
    projectId: env.FIREBASE_PROJECT_ID,
  };
}

export async function getUserProfileOrThrow(projectId, uid, idToken) {
  const profile = await getDocument(projectId, 'users', uid, idToken);
  if (!profile) {
    throw new Error('User profile not found');
  }
  return profile;
}

export async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  const { user, projectId, idToken } = auth;
  if (!projectId) {
    throw new Error('Firebase project ID not configured');
  }

  const profile = await getUserProfileOrThrow(projectId, user.uid, idToken);
  if (profile.role !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }

  return { user, profile, projectId, idToken };
}

export function jsonResponse(body, status = 200, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': env?.APP_BASE_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function handleApiError(error, env) {
  console.error('[API Error]', error);
  const status = error?.statusCode || (String(error?.message || '').toLowerCase().includes('auth') ? 401 : 500);
  return jsonResponse({ error: error?.message || 'Internal server error' }, status, env);
}
