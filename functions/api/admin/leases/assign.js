import { requireAdmin, jsonResponse, handleApiError } from '../../lib/authz.js';
import { getDocument, createDocument, updateDocument, commitWrites, queryDocuments, setDocument } from '../../lib/firestore-rest.js';
import { defaultLeasePayload, getOrCreateMonthlyStatement } from '../../lib/workflow.js';

function toCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAdmin(request, env);
    const body = await request.json();

    const { tenantUid, propertyId, startDate, rentAmountCents, depositAmountCents, endCurrentLease = true } = body || {};

    if (!tenantUid || !propertyId) {
      return jsonResponse({ error: 'tenantUid and propertyId are required' }, 400, env);
    }

    const [tenantUser, property] = await Promise.all([
      getDocument(projectId, 'users', tenantUid, idToken),
      getDocument(projectId, 'properties', propertyId, idToken),
    ]);

    if (!tenantUser) return jsonResponse({ error: 'Tenant user not found' }, 404, env);
    if (tenantUser.role !== 'tenant') return jsonResponse({ error: 'User is not a tenant' }, 400, env);
    if (!property) return jsonResponse({ error: 'Property not found' }, 404, env);

    // Use single-field filter only — avoids needing composite index.
    const tenantLeases = await queryDocuments(
      projectId,
      'leases',
      [{ field: 'tenantUid', op: 'EQUAL', value: tenantUid }],
      null,
      idToken
    );
    const activeLease = tenantLeases.find((lease) => lease.status === 'active');

    if (activeLease && !endCurrentLease) {
      return jsonResponse({ error: 'Tenant already has an active lease. Set endCurrentLease=true to reassign.' }, 409, env);
    }

    const propertyLeases = await queryDocuments(
      projectId,
      'leases',
      [{ field: 'propertyId', op: 'EQUAL', value: propertyId }],
      null,
      idToken
    );
    const propertyActiveLease = propertyLeases.find((lease) => lease.status === 'active');
    if (propertyActiveLease && propertyActiveLease.tenantUid !== tenantUid) {
      return jsonResponse({ error: 'Property already has an active lease' }, 409, env);
    }

    const propertyRent = toCents(property.rentAmountCents ?? Math.round((property.monthlyRent || 0) * 100));
    const propertyDeposit = toCents(property.securityDepositCents ?? Math.round((property.securityDeposit || 0) * 100));

    const finalRent = toCents(rentAmountCents ?? propertyRent);
    const finalDeposit = toCents(depositAmountCents ?? propertyDeposit);

    if (!finalRent || finalRent <= 0) {
      return jsonResponse({ error: 'Valid rentAmountCents is required' }, 400, env);
    }
    if (finalDeposit === null) {
      return jsonResponse({ error: 'Invalid depositAmountCents' }, 400, env);
    }

    const lease = await createDocument(
      projectId,
      'leases',
      defaultLeasePayload({
        tenantUid,
        propertyId,
        rentAmountCents: finalRent,
        depositAmountCents: finalDeposit,
        startDate: startDate || today(),
        createdByUid: user.uid,
        status: 'active',
      }),
      idToken
    );

    const now = new Date().toISOString();
    const writes = [
      {
        op: 'update',
        path: `users/${tenantUid}`,
        data: {
          currentLeaseId: lease.id,
          currentPropertyId: propertyId,
          updatedAt: now,
        },
      },
      {
        op: 'update',
        path: `properties/${propertyId}`,
        data: {
          occupancyStatus: 'occupied',
          status: 'occupied',
          currentLeaseId: lease.id,
          currentTenantUid: tenantUid,
          updatedAt: now,
        },
      },
    ];

    if (activeLease) {
      writes.push({
        op: 'update',
        path: `leases/${activeLease.id}`,
        data: {
          status: 'ended',
          endDate: today(),
          updatedAt: now,
        },
      });
    }

    await commitWrites(projectId, writes, idToken);

    // Initialize rent statement for current month
    const month = currentMonth();
    const dueDate = `${month}-01`;
    try {
      await getOrCreateMonthlyStatement({
        projectId,
        lease: { ...lease, id: lease.id, rentAmountCents: finalRent },
        month,
        dueDate,
        createdByUid: user.uid,
        idToken,
      });
    } catch (stmtErr) {
      console.error('Statement init failed (non-blocking):', stmtErr);
    }

    // Create activity log entry
    try {
      await createDocument(projectId, 'activityLogs', {
        actorUid: user.uid,
        targetUid: tenantUid,
        action: 'lease_assigned',
        targetType: 'lease',
        targetId: lease.id,
        metadata: {
          propertyId,
          propertyAddress: property.address || '',
          rentAmountCents: finalRent,
          tenantName: tenantUser.displayName || tenantUser.email || '',
        },
        createdAt: now,
      }, idToken);
    } catch (logErr) {
      console.error('Activity log failed (non-blocking):', logErr);
    }

    return jsonResponse({
      success: true,
      leaseId: lease.id,
      endedPreviousLeaseId: activeLease?.id || null,
    }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
