import {
  getDocument,
  queryDocuments,
  createDocument,
  setDocument,
  updateDocument,
} from './firestore-rest.js';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function findActiveLeaseByTenant(projectId, tenantUid, idToken) {
  // Single-field filter avoids composite index requirement.
  // Lease count per tenant is small; filter/sort client-side.
  const result = await queryDocuments(
    projectId,
    'leases',
    [{ field: 'tenantUid', op: 'EQUAL', value: tenantUid }],
    null,
    idToken
  );
  return result
    .filter((l) => l.status === 'active')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
}

export async function findPendingOrActiveLeaseByTenant(projectId, tenantUid, idToken) {
  const result = await queryDocuments(
    projectId,
    'leases',
    [{ field: 'tenantUid', op: 'EQUAL', value: tenantUid }],
    null,
    idToken
  );
  const sorted = result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return sorted.find((l) => l.status === 'active' || l.status === 'pending') || null;
}

export async function findActiveLeaseByProperty(projectId, propertyId, idToken) {
  const result = await queryDocuments(
    projectId,
    'leases',
    [{ field: 'propertyId', op: 'EQUAL', value: propertyId }],
    null,
    idToken
  );
  return result
    .filter((l) => l.status === 'active')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
}

export async function getOrCreateMonthlyStatement({
  projectId,
  lease,
  month,
  dueDate,
  createdByUid,
  idToken,
}) {
  // Two equality filters on leaseId+month are served by the existing
  // composite index (leaseId ASC, month DESC).  No orderBy needed since
  // at most one statement exists per lease+month.
  const existing = await queryDocuments(
    projectId,
    'rentStatements',
    [
      { field: 'leaseId', op: 'EQUAL', value: lease.id },
      { field: 'month', op: 'EQUAL', value: month },
    ],
    null,
    idToken
  );

  if (existing[0]) {
    return existing[0];
  }

  const now = new Date().toISOString();
  const statement = await createDocument(projectId, 'rentStatements', {
    leaseId: lease.id,
    tenantUid: lease.tenantUid,
    propertyId: lease.propertyId,
    month,
    status: 'open',
    dueDate,
    rentChargeCents: lease.rentAmountCents,
    balanceCents: lease.rentAmountCents,
    lateFeesEnabled: true,
    lateFeesThroughDate: null,
    createdAt: now,
    updatedAt: now,
  }, idToken);

  await setDocument(projectId, `rentStatements/${statement.id}/ledger`, `charge_${month}`, {
    type: 'charge',
    label: `Rent - ${month}`,
    amountCents: lease.rentAmountCents,
    effectiveDate: dueDate,
    createdByUid: createdByUid || 'system',
    createdAt: now,
  }, idToken);

  return { ...statement, balanceCents: lease.rentAmountCents };
}

export async function completeOnboardingStep({
  projectId,
  lease,
  step,
  idToken,
}) {
  const checklist = {
    leaseSigned: !!lease?.onboardingChecklist?.leaseSigned,
    contactConfirmed: !!lease?.onboardingChecklist?.contactConfirmed,
    paymentReady: !!lease?.onboardingChecklist?.paymentReady,
  };

  if (!(step in checklist)) {
    throw new Error('Invalid onboarding step');
  }

  checklist[step] = true;
  const onboardingComplete = checklist.leaseSigned && checklist.contactConfirmed && checklist.paymentReady;

  const update = {
    onboardingChecklist: checklist,
    onboardingStatus: onboardingComplete ? 'complete' : 'in_progress',
    status: onboardingComplete ? 'active' : 'pending',
    leaseSignedAt: step === 'leaseSigned' ? new Date().toISOString() : lease.leaseSignedAt || null,
    updatedAt: new Date().toISOString(),
  };

  await updateDocument(projectId, 'leases', lease.id, update, idToken);

  return {
    ...lease,
    ...update,
  };
}

export function defaultLeasePayload({
  tenantUid,
  propertyId,
  rentAmountCents,
  depositAmountCents,
  startDate,
  endDate,
  createdByUid,
  status,
}) {
  const now = new Date().toISOString();
  const start = startDate || todayDateString();

  // Default endDate: 12 months from start if not explicitly provided
  let computedEndDate = endDate || null;
  if (!computedEndDate) {
    const startParts = start.split('-');
    const d = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    d.setFullYear(d.getFullYear() + 1);
    computedEndDate = d.toISOString().slice(0, 10);
  }

  return {
    tenantUid,
    tenantIds: [tenantUid],
    propertyId,
    startDate: start,
    endDate: computedEndDate,
    rentAmountCents,
    depositAmountCents,
    monthlyRent: rentAmountCents / 100,
    securityDeposit: depositAmountCents / 100,
    rentDueDay: 1,
    gracePeriodDays: 5,
    attachments: [],
    onboardingStatus: status === 'pending' ? 'not_started' : 'complete',
    onboardingChecklist: {
      leaseSigned: status !== 'pending',
      contactConfirmed: status !== 'pending',
      paymentReady: status !== 'pending',
    },
    createdByUid,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureTenantUserLink(projectId, tenantUid, leaseId) {
  await updateDocument(projectId, 'users', tenantUid, {
    currentLeaseId: leaseId,
    currentPropertyId: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function markPropertyOccupied(projectId, propertyId) {
  const property = await getDocument(projectId, 'properties', propertyId);
  if (!property) return;

  await updateDocument(projectId, 'properties', propertyId, {
    occupancyStatus: 'occupied',
    status: 'occupied',
    updatedAt: new Date().toISOString(),
  });
}
