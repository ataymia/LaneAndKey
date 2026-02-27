import { requireAuth, getUserProfileOrThrow, jsonResponse, handleApiError } from '../../lib/authz.js';
import { queryDocuments, getSubcollection } from '../../lib/firestore-rest.js';

function sortByMonthDesc(a, b) {
  return (b.month || '').localeCompare(a.month || '');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAuth(request, env);
    const profile = await getUserProfileOrThrow(projectId, user.uid, idToken);
    const url = new URL(request.url);
    const tenantUid = url.searchParams.get('tenantUid');

    let statements;
    if (profile.role === 'admin') {
      if (tenantUid) {
        statements = await queryDocuments(projectId, 'rentStatements', [{ field: 'tenantUid', op: 'EQUAL', value: tenantUid }], { field: 'month', direction: 'DESCENDING' }, idToken);
      } else {
        statements = await queryDocuments(projectId, 'rentStatements', null, { field: 'month', direction: 'DESCENDING' }, idToken);
      }
    } else {
      statements = await queryDocuments(projectId, 'rentStatements', [{ field: 'tenantUid', op: 'EQUAL', value: user.uid }], { field: 'month', direction: 'DESCENDING' }, idToken);
    }

    statements = (statements || []).sort(sortByMonthDesc);
    return jsonResponse({ statements }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAuth(request, env);
    const profile = await getUserProfileOrThrow(projectId, user.uid, idToken);

    if (profile.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403, env);
    }

    const body = await request.json();
    const { statementId, label, amountCents, effectiveDate, notes } = body;

    if (!statementId || !label || !amountCents) {
      return jsonResponse({ error: 'statementId, label and amountCents are required' }, 400, env);
    }

    const entryId = `fee_${Date.now()}`;
    const nowIso = new Date().toISOString();

    await fetch(`${new URL(request.url).origin}/api/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        statementId,
        label,
        amountCents: Math.abs(Number(amountCents)),
        effectiveDate: effectiveDate || nowIso.slice(0, 10),
        notes: notes || '',
        entryId,
      }),
    });

    const ledger = await getSubcollection(projectId, `rentStatements/${statementId}`, 'ledger');
    return jsonResponse({ success: true, ledger }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
