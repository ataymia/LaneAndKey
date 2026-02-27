import { auth } from '../firebase/config';
import type { Lease, RentStatement, UserProfile } from '../../types';

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function approveApplication(applicationId: string, startDate?: string) {
  return apiRequest<{ success: boolean; leaseId: string; onboardingRequired: boolean }>(
    `/api/admin/applications/${applicationId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ startDate }),
    }
  );
}

export async function assignLease(payload: {
  tenantUid: string;
  propertyId: string;
  startDate: string;
  rentAmountCents: number;
  depositAmountCents: number;
  endCurrentLease?: boolean;
}) {
  return apiRequest<{ success: boolean; leaseId: string; endedPreviousLeaseId?: string | null }>(
    '/api/admin/leases/assign',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function getOnboardingStatus() {
  return apiRequest<{ lease: Lease | null; onboardingRequired: boolean; message?: string }>('/api/tenant/onboarding');
}

export async function completeOnboardingStep(payload: {
  step: 'leaseSigned' | 'contactConfirmed' | 'paymentReady';
  phone?: string;
  preferredContactMethod?: 'email' | 'phone' | 'sms';
  emergencyContact?: UserProfile['emergencyContact'];
}) {
  return apiRequest<{ success: boolean; lease: Lease }>('/api/tenant/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getRentStatements(tenantUid?: string) {
  const query = tenantUid ? `?tenantUid=${encodeURIComponent(tenantUid)}` : '';
  return apiRequest<{ statements: RentStatement[] }>(`/api/rent/statements${query}`);
}

export async function getRentStatement(statementId: string) {
  return apiRequest<{ statement: RentStatement; ledger: Array<{ id: string; amountCents: number; label: string; type: string; effectiveDate: string }> }>(
    `/api/rent/statements/${statementId}`
  );
}
