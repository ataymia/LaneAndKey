/**
 * Rent Statements API
 * Cloudflare Pages Function
 * 
 * GET /api/statements
 *   - For tenants: returns their own statements with ledger + late fees applied
 *   - For admins: returns all statements (optionally filtered by tenantUid query param)
 * 
 * POST /api/statements/add-fee
 *   - Admin only: adds a fee to a statement
 * 
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID
 */

import { authenticateRequest } from './lib/firebase-verify.js';
import {
  getDocument,
  queryDocuments,
  getSubcollection,
  setDocument,
  updateDocument,
  createDocument,
} from './lib/firestore-rest.js';
import { applyLateFeesIfNeeded, getTodayStr } from './lib/late-fees.js';

// ─── CORS headers ──────────────────────────────────────────

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_BASE_URL || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// ─── Get user role from Firestore ──────────────────────────

async function getUserRole(projectId, uid) {
  const user = await getDocument(projectId, 'users', uid);
  return user?.role || 'applicant';
}

// ─── GET handler ───────────────────────────────────────────

async function handleGet(request, env) {
  const user = await authenticateRequest(request, env);
  const projectId = env.FIREBASE_PROJECT_ID;
  const role = await getUserRole(projectId, user.uid);
  const url = new URL(request.url);
  const tenantUidParam = url.searchParams.get('tenantUid');
  const statementIdParam = url.searchParams.get('statementId');

  // Single statement fetch
  if (statementIdParam) {
    const statement = await getDocument(projectId, 'rentStatements', statementIdParam);
    if (!statement) {
      return new Response(JSON.stringify({ error: 'Statement not found' }), {
        status: 404,
        headers: corsHeaders(env),
      });
    }

    // Authorization check
    if (role !== 'admin' && statement.tenantUid !== user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: corsHeaders(env),
      });
    }

    // Apply late fees before returning
    const today = getTodayStr();
    const updatedStatement = await applyLateFeesIfNeeded(projectId, statementIdParam, today);

    // Get ledger entries
    const ledger = await getSubcollection(
      projectId,
      `rentStatements/${statementIdParam}`,
      'ledger'
    );

    // Sort ledger by effectiveDate
    ledger.sort((a, b) => (a.effectiveDate || '').localeCompare(b.effectiveDate || ''));

    return new Response(JSON.stringify({
      statement: updatedStatement,
      ledger,
    }), {
      status: 200,
      headers: corsHeaders(env),
    });
  }

  // List statements
  let statements;
  if (role === 'admin') {
    // Admin: all or filtered by tenantUid
    if (tenantUidParam) {
      statements = await queryDocuments(
        projectId,
        'rentStatements',
        [{ field: 'tenantUid', op: 'EQUAL', value: tenantUidParam }],
        { field: 'month', direction: 'DESCENDING' }
      );
    } else {
      statements = await queryDocuments(
        projectId,
        'rentStatements',
        null,
        { field: 'month', direction: 'DESCENDING' }
      );
    }
  } else {
    // Non-admin: own statements only
    statements = await queryDocuments(
      projectId,
      'rentStatements',
      [{ field: 'tenantUid', op: 'EQUAL', value: user.uid }],
      { field: 'month', direction: 'DESCENDING' }
    );
  }

  // Apply late fees to each open statement
  const today = getTodayStr();
  const enrichedStatements = [];
  for (const stmt of statements) {
    if (stmt.status === 'open' && stmt.balanceCents > 0) {
      const updated = await applyLateFeesIfNeeded(projectId, stmt.id, today);
      enrichedStatements.push(updated);
    } else {
      enrichedStatements.push(stmt);
    }
  }

  return new Response(JSON.stringify({ statements: enrichedStatements }), {
    status: 200,
    headers: corsHeaders(env),
  });
}

// ─── POST handler (add-fee) ───────────────────────────────

async function handlePost(request, env) {
  const user = await authenticateRequest(request, env);
  const projectId = env.FIREBASE_PROJECT_ID;
  const role = await getUserRole(projectId, user.uid);

  if (role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: corsHeaders(env),
    });
  }

  const body = await request.json();
  const { statementId, label, amountCents, notes, effectiveDate } = body;

  if (!statementId || !label || !amountCents) {
    return new Response(JSON.stringify({ error: 'statementId, label, and amountCents are required' }), {
      status: 400,
      headers: corsHeaders(env),
    });
  }

  // Verify statement exists
  const statement = await getDocument(projectId, 'rentStatements', statementId);
  if (!statement) {
    return new Response(JSON.stringify({ error: 'Statement not found' }), {
      status: 404,
      headers: corsHeaders(env),
    });
  }

  // Create ledger entry
  const entry = {
    type: 'fee',
    label,
    amountCents: Math.abs(amountCents), // fees are always positive
    effectiveDate: effectiveDate || getTodayStr(),
    notes: notes || '',
    createdByUid: user.uid,
    createdAt: new Date().toISOString(),
  };

  const created = await createDocument(
    projectId,
    `rentStatements/${statementId}/ledger`,
    entry
  );

  // Recompute balance
  const allEntries = await getSubcollection(
    projectId,
    `rentStatements/${statementId}`,
    'ledger'
  );
  const newBalance = allEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);

  const updateData = {
    balanceCents: newBalance,
    updatedAt: new Date().toISOString(),
  };
  if (newBalance <= 0) {
    updateData.status = 'paid';
    updateData.paidAt = new Date().toISOString();
  } else {
    updateData.status = 'open';
  }

  await updateDocument(projectId, 'rentStatements', statementId, updateData);

  return new Response(JSON.stringify({
    success: true,
    entry: created,
    newBalance,
  }), {
    status: 200,
    headers: corsHeaders(env),
  });
}

// ─── Request Router ────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    return await handleGet(request, env);
  } catch (error) {
    console.error('Statements GET error:', error);
    const status = error.message.includes('authentication') ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: corsHeaders(env),
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    return await handlePost(request, env);
  } catch (error) {
    console.error('Statements POST error:', error);
    const status = error.message.includes('authentication') ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: corsHeaders(env),
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(context.env),
      'Access-Control-Max-Age': '86400',
    },
  });
}
