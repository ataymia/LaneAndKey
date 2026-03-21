import { requireAdmin, jsonResponse, handleApiError } from '../../lib/authz.js';
import { getDocument, updateDocument, createDocument } from '../../lib/firestore-rest.js';

function extractId(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

/**
 * PATCH /api/admin/leases/:id
 * Edit lease terms (rent, dates, notes) and optionally add a fee/credit to the current statement.
 */
export async function onRequestPatch(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAdmin(request, env);
    const leaseId = extractId(request.url);
    const body = await request.json();

    const lease = await getDocument(projectId, 'leases', leaseId, idToken);
    if (!lease) return jsonResponse({ error: 'Lease not found' }, 404, env);

    // Allowed editable fields
    const allowed = ['rentAmountCents', 'depositAmountCents', 'startDate', 'endDate', 'status', 'notes', 'gracePeriodDays', 'rentDueDay'];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    // Keep dollar equivalents in sync
    if (update.rentAmountCents !== undefined) {
      update.monthlyRent = update.rentAmountCents / 100;
    }
    if (update.depositAmountCents !== undefined) {
      update.securityDeposit = update.depositAmountCents / 100;
    }

    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: 'No valid fields to update' }, 400, env);
    }

    update.updatedAt = new Date().toISOString();
    await updateDocument(projectId, 'leases', leaseId, update, idToken);

    // Log activity
    try {
      await createDocument(projectId, 'activityLogs', {
        actorUid: user.uid,
        targetUid: lease.tenantUid || null,
        action: 'lease_edited',
        targetType: 'lease',
        targetId: leaseId,
        metadata: { updatedFields: Object.keys(update).filter(k => k !== 'updatedAt').join(', ') },
        createdAt: new Date().toISOString(),
      }, idToken);
    } catch { /* non-blocking */ }

    return jsonResponse({ success: true, updated: update }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
