import { requireAuth, jsonResponse, handleApiError } from '../lib/authz.js';
import { getDocument, updateDocument } from '../lib/firestore-rest.js';
import { completeOnboardingStep } from '../lib/workflow.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAuth(request, env);

    const userProfile = await getDocument(projectId, 'users', user.uid, idToken);
    const currentLeaseId = userProfile?.currentLeaseId;
    if (!currentLeaseId) {
      return jsonResponse({ lease: null, onboardingRequired: false, message: 'No active lease assigned' }, 200, env);
    }

    const lease = await getDocument(projectId, 'leases', currentLeaseId, idToken);
    if (!lease || lease.tenantUid !== user.uid) {
      return jsonResponse({ error: 'Lease not found' }, 404, env);
    }

    const onboardingRequired = lease.status !== 'active' || lease.onboardingStatus !== 'complete';
    return jsonResponse({ lease, onboardingRequired }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  try {
    const { user, projectId, idToken } = await requireAuth(request, env);
    const body = await request.json();

    const step = body?.step;
    if (!step) return jsonResponse({ error: 'step is required' }, 400, env);

    const userProfile = await getDocument(projectId, 'users', user.uid, idToken);
    const currentLeaseId = userProfile?.currentLeaseId;
    if (!currentLeaseId) {
      return jsonResponse({ error: 'No lease assigned' }, 400, env);
    }

    const lease = await getDocument(projectId, 'leases', currentLeaseId, idToken);
    if (!lease || lease.tenantUid !== user.uid) {
      return jsonResponse({ error: 'Lease not found' }, 404, env);
    }

    const updatedLease = await completeOnboardingStep({ projectId, lease, step, idToken });

    if (step === 'contactConfirmed') {
      await updateDocument(projectId, 'users', user.uid, {
        phone: body?.phone || userProfile?.phone || '',
        preferredContactMethod: body?.preferredContactMethod || userProfile?.preferredContactMethod || 'email',
        emergencyContact: body?.emergencyContact || userProfile?.emergencyContact || null,
        updatedAt: new Date().toISOString(),
      }, idToken);
    }

    return jsonResponse({ success: true, lease: updatedLease }, 200, env);
  } catch (error) {
    return handleApiError(error, env);
  }
}

export async function onRequestOptions(context) {
  return jsonResponse({}, 204, context.env);
}
