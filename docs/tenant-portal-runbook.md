# Tenant Portal Runbook (Production)

## Scope
This runbook covers tenant-critical workflows in the portal:
- lease assignment
- onboarding gating
- payments and rent statements
- tenant settings updates
- maintenance request submission

## Required Environment
- Firebase Auth + Firestore configured
- Firestore rules deployed from `firestore.rules`
- Stripe configured:
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- API routes deployed under `/api/*`

## API Endpoints in Use
- `POST /api/admin/leases/assign`
- `POST /api/admin/applications/{id}/approve`
- `GET /api/tenant/onboarding`
- `PATCH /api/tenant/onboarding`
- `GET /api/rent/statements`
- `GET /api/rent/statements/{id}`
- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`

## Daily Operational Checks
1. **Tenant dashboard no mock data**
   - Login as tenant with lease.
   - Confirm dashboard rent and lease fields reflect actual Firestore lease/statements.
   - If no lease: confirm explicit message: “No lease assigned. Contact management.”

2. **Payments tab health**
   - Open tenant payments.
   - Confirm statement list loads.
   - Confirm no generic “failed to load payment data” when statements are absent; should show empty/open-state.

3. **Maintenance submit flow**
   - Submit tenant maintenance request.
   - Confirm write appears in `maintenance` with `tenantId`, `propertyId`, `status=new`.

4. **Settings persistence**
   - Update phone/preferred contact/emergency contact in tenant settings.
   - Confirm values persist in `users/{uid}` and survive refresh/re-login.

## Incident Response

### Payments not loading
- Check browser console for API error from `/api/rent/statements`.
- Verify tenant has `users/{uid}.currentLeaseId`.
- Verify at least one statement exists for lease/month where applicable.
- Confirm Firestore rules deployed and no cross-tenant read violation.

### Stripe checkout starts but ledger not updated
- Check Stripe webhook delivery logs for `/api/stripe/webhook`.
- Confirm metadata includes `statementId`, `tenantUid`, `leaseId`.
- Verify idempotent ledger entry exists: `rentStatements/{id}/ledger/pay_{paymentIntentId}`.

### Tenant stuck in onboarding
- Inspect `leases/{leaseId}`:
  - `onboardingChecklist.leaseSigned`
  - `onboardingChecklist.contactConfirmed`
  - `onboardingChecklist.paymentReady`
- Lease activates only when all three are true.

## Backfill / Migration
For existing tenants created before this workflow:
1. For each tenant user (`role=tenant`) missing `currentLeaseId`:
   - create/identify active lease
   - set `users/{uid}.currentLeaseId`
2. For active leases missing current month statement:
   - create `rentStatements/{statementId}`
   - seed initial `ledger` charge row
3. Ensure property occupancy is consistent with active lease assignment.

## Security Checklist
- Non-admin cannot call admin endpoints successfully.
- Tenant cannot read another tenant’s lease/statements.
- Tenant cannot elevate own `role` or assign self leases.
- Application approval is idempotent (`application.leaseId` prevents duplicates).
- Webhook replay does not duplicate payment ledger entries.
