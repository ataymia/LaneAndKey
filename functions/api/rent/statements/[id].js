import { requireAuth, getUserProfileOrThrow, jsonResponse, handleApiError } from '../../lib/authz.js';
import { getDocument, getSubcollection } from '../../lib/firestore-rest.js';

function sortLedger(ledger) {
  return [...ledger].sort((a, b) => (a.effectiveDate || '').localeCompare(b.effectiveDate || ''));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAuth(request, env);
    const profile = await getUserProfileOrThrow(projectId, user.uid, idToken);

    const parts = new URL(request.url).pathname.split('/').filter(Boolean);
    const statementId = parts[parts.length - 1];

    const statement = await getDocument(projectId, 'rentStatements', statementId, idToken);
    if (!statement) {
      return jsonResponse({ error: 'Statement not found' }, 404, env);
    }

    if (profile.role !== 'admin' && statement.tenantUid !== user.uid) {
      return jsonResponse({ error: 'Unauthorized' }, 403, env);
    }

    const ledger = await getSubcollection(projectId, `rentStatements/${statementId}`, 'ledger', idToken);
    return jsonResponse({ statement, ledger: sortLedger(ledger) }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
