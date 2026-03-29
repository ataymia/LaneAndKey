/**
 * Cloudflare Pages Function — Proxy for Firebase Storage downloads.
 *
 * The Firebase JS SDK's getBytes() / getBlob() use XHR to
 * firebasestorage.googleapis.com, which is CORS-blocked from
 * laneandkey.com because the Storage bucket has no CORS policy.
 *
 * This function runs server-side (no CORS restrictions), verifies the
 * caller's Firebase ID token, then fetches the file from Storage using
 * that same token (so Firebase Storage rules still apply).
 *
 * Client usage:
 *   POST /api/proxy-storage
 *   Authorization: Bearer <firebase-id-token>
 *   Body: { "storagePath": "generated-leases/abc/original.pdf" }
 *
 *   Response: raw PDF bytes (application/pdf)
 */

import { verifyFirebaseToken } from './lib/firebase-verify.js';

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestPost(context) {
  const cors = { 'Access-Control-Allow-Origin': '*' };

  try {
    // 1. Extract & verify Firebase ID token
    const authHeader = context.request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const idToken = authHeader.slice(7);
    const projectId = context.env.FIREBASE_PROJECT_ID || 'laneandkey1';
    await verifyFirebaseToken(idToken, projectId);

    // 2. Parse storage path from body
    const { storagePath } = await context.request.json();
    if (!storagePath || typeof storagePath !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing storagePath' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Prevent path traversal
    if (storagePath.includes('..') || storagePath.startsWith('/')) {
      return new Response(JSON.stringify({ error: 'Invalid storagePath' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch from Firebase Storage REST API (server-side — no CORS restriction)
    const bucket = context.env.FIREBASE_STORAGE_BUCKET || 'laneandkey1.firebasestorage.app';
    const encodedPath = encodeURIComponent(storagePath);
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

    const storageResp = await fetch(storageUrl, {
      headers: { 'Authorization': `Firebase ${idToken}` },
    });

    if (!storageResp.ok) {
      const text = await storageResp.text().catch(() => '');
      console.error('Storage fetch failed:', storageResp.status, text);
      return new Response(JSON.stringify({ error: 'Storage fetch failed' }), {
        status: storageResp.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 4. Stream bytes back to client
    const contentType = storageResp.headers.get('Content-Type') || 'application/octet-stream';
    return new Response(storageResp.body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': contentType,
      },
    });
  } catch (err) {
    console.error('proxy-storage error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}
