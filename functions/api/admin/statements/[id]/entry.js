import { requireAdmin, jsonResponse, handleApiError } from '../../../lib/authz.js';
import { getDocument, createDocument, getSubcollection, updateDocument } from '../../../lib/firestore-rest.js';

function extractId(url) {
  // URL: /api/admin/statements/:id/entry
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  // parts: ['api', 'admin', 'statements', ':id', 'entry']
  return parts[3];
}

/**
 * POST /api/admin/statements/:id/entry
 * Add a fee or credit to a rent statement.
 * Body: { type: 'fee'|'credit', label, amountCents, notes? }
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAdmin(request, env);
    const statementId = extractId(request.url);
    const body = await request.json();

    const { type, label, amountCents, notes } = body || {};

    if (!type || !label || !amountCents) {
      return jsonResponse({ error: 'type, label, and amountCents are required' }, 400, env);
    }
    if (type !== 'fee' && type !== 'credit' && type !== 'adjustment') {
      return jsonResponse({ error: 'type must be fee, credit, or adjustment' }, 400, env);
    }

    const statement = await getDocument(projectId, 'rentStatements', statementId, idToken);
    if (!statement) return jsonResponse({ error: 'Statement not found' }, 404, env);

    // fees are positive (increase balance), credits are negative (reduce balance), adjustments keep sign as-is
    const signedAmount = type === 'credit' ? -Math.abs(amountCents) : type === 'fee' ? Math.abs(amountCents) : amountCents;

    const now = new Date().toISOString();
    const entry = {
      type,
      label,
      amountCents: signedAmount,
      effectiveDate: now.slice(0, 10),
      notes: notes || '',
      createdByUid: user.uid,
      createdAt: now,
    };

    await createDocument(
      projectId,
      `rentStatements/${statementId}/ledger`,
      entry,
      idToken
    );

    // Recompute balance
    const allEntries = await getSubcollection(
      projectId,
      `rentStatements/${statementId}`,
      'ledger',
      idToken
    );
    const newBalance = allEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);
    const updateData = {
      balanceCents: newBalance,
      updatedAt: now,
    };
    if (newBalance <= 0) {
      updateData.status = 'paid';
      updateData.paidAt = now;
    } else {
      updateData.status = 'open';
    }

    await updateDocument(projectId, 'rentStatements', statementId, updateData, idToken);

    // Log activity
    try {
      await createDocument(projectId, 'activityLogs', {
        actorUid: user.uid,
        targetUid: statement.tenantUid || null,
        action: type === 'fee' ? 'fee_added' : type === 'credit' ? 'credit_added' : 'adjustment_added',
        targetType: 'lease',
        targetId: statement.leaseId || statementId,
        metadata: { label, amountCents: signedAmount, statementId },
        createdAt: now,
      }, idToken);
    } catch { /* non-blocking */ }

    return jsonResponse({ success: true, newBalance }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
