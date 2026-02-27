import { requireAdmin, jsonResponse, handleApiError } from '../../../lib/authz.js';
import { getDocument, updateDocument, commitWrites } from '../../../lib/firestore-rest.js';
import { defaultLeasePayload } from '../../../lib/workflow.js';

function extractIdFromRequest(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 2];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAdmin(request, env);
    const applicationId = extractIdFromRequest(request.url);

    const body = await request.json().catch(() => ({}));
    const requestedStartDate = body?.startDate || today();

    const application = await getDocument(projectId, 'applications', applicationId, idToken);
    if (!application) {
      return jsonResponse({ error: 'Application not found' }, 404, env);
    }

    if (application.leaseId) {
      return jsonResponse({
        success: true,
        idempotent: true,
        leaseId: application.leaseId,
        message: 'Application already approved and linked to lease',
      }, 200, env);
    }

    const applicantUid = application.primaryApplicantId;
    const propertyId = application.propertyId;

    if (!applicantUid || !propertyId) {
      return jsonResponse({ error: 'Application missing applicant or property reference' }, 400, env);
    }

    const [applicant, property] = await Promise.all([
      getDocument(projectId, 'users', applicantUid, idToken),
      getDocument(projectId, 'properties', propertyId, idToken),
    ]);

    if (!applicant) return jsonResponse({ error: 'Applicant user not found' }, 404, env);
    if (!property) return jsonResponse({ error: 'Property not found' }, 404, env);

    const rentAmountCents = Number(property.rentAmountCents ?? Math.round((property.monthlyRent || 0) * 100));
    const depositAmountCents = Number(property.securityDepositCents ?? Math.round((property.securityDeposit || 0) * 100));

    if (!Number.isFinite(rentAmountCents) || rentAmountCents <= 0) {
      return jsonResponse({ error: 'Property rent amount is invalid' }, 400, env);
    }

    const leaseId = `app_${applicationId}_lease`;
    const nowIso = new Date().toISOString();

    const leasePayload = defaultLeasePayload({
      tenantUid: applicantUid,
      propertyId,
      rentAmountCents,
      depositAmountCents: Number.isFinite(depositAmountCents) ? depositAmountCents : 0,
      startDate: requestedStartDate,
      createdByUid: user.uid,
      status: 'pending',
    });

    await commitWrites(projectId, [
      {
        op: 'set',
        path: `leases/${leaseId}`,
        data: {
          ...leasePayload,
          id: leaseId,
          onboardingStatus: 'not_started',
          onboardingChecklist: {
            leaseSigned: false,
            contactConfirmed: false,
            paymentReady: false,
          },
        },
      },
      {
        op: 'update',
        path: `users/${applicantUid}`,
        data: {
          role: 'tenant',
          currentLeaseId: leaseId,
          currentPropertyId: propertyId,
          updatedAt: nowIso,
        },
      },
      {
        op: 'update',
        path: `properties/${propertyId}`,
        data: {
          occupancyStatus: 'occupied',
          status: 'occupied',
          updatedAt: nowIso,
        },
      },
      {
        op: 'update',
        path: `applications/${applicationId}`,
        data: {
          status: 'approved',
          approvedAt: nowIso,
          approvedByUid: user.uid,
          leaseId,
          updatedAt: nowIso,
        },
      },
      {
        op: 'set',
        path: `alerts/onboarding_${applicantUid}_${Date.now()}`,
        data: {
          userId: applicantUid,
          type: 'general',
          title: 'Welcome to Lane & Key',
          message: 'Your application was approved. Please complete onboarding to activate your lease.',
          relatedId: leaseId,
          relatedType: 'lease',
          read: false,
          archived: false,
          createdAt: nowIso,
        },
      },
    ], idToken);

    return jsonResponse({
      success: true,
      leaseId,
      tenantUid: applicantUid,
      propertyId,
      onboardingRequired: true,
    }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
