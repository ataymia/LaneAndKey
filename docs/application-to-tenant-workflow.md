# Application → Tenant Workflow

## Goal
When an admin approves an application, the system must atomically and idempotently:
1. promote applicant to tenant
2. create a lease linked to the applied property
3. link user to lease/property
4. mark property occupied
5. record application approval linkage
6. require tenant onboarding before lease activation

## Approval Path
Frontend action:
- Admin clicks Approve in Applications page.
- Frontend calls `POST /api/admin/applications/{id}/approve`.

Backend behavior:
- Verifies Firebase token and admin role.
- Loads application, applicant user, property.
- If `application.leaseId` already set: returns existing linkage (idempotent response).
- Writes in a single commit:
  - `leases/{leaseId}` with `status=pending`, onboarding checklist
  - `users/{uid}.role=tenant`
  - `users/{uid}.currentLeaseId=leaseId`
  - `users/{uid}.currentPropertyId=propertyId`
  - `properties/{propertyId}.occupancyStatus=occupied`
  - `applications/{id}.status=approved`, `approvedAt`, `approvedByUid`, `leaseId`
  - onboarding alert document for tenant

## Onboarding Gating
- Tenant layout checks `/api/tenant/onboarding` on navigation.
- If onboarding incomplete, tenant is redirected to `/tenant/onboarding`.
- Completing steps updates lease checklist via `PATCH /api/tenant/onboarding`.
- Lease transitions to `active` only when all checklist flags are complete.

## Lease Assignment Outside Applications
Admin can assign/reassign from Tenants page:
- calls `POST /api/admin/leases/assign`
- validates tenant and property
- ends current active lease if configured
- creates active lease for target property
- updates user linkage and property occupancy

## Functional Verification Steps
1. **Approve application**
   - approve one `new` application
   - verify linked lease created and application now has `leaseId`
2. **Onboarding route**
   - login as approved user
   - verify redirect to onboarding page
3. **Complete onboarding**
   - complete all three steps
   - verify lease `status=active`
4. **Tenant dashboard/payments**
   - verify real lease/statement data appears
   - verify Pay button initiates Stripe checkout
5. **Idempotency**
   - call approval endpoint again for same application
   - verify no duplicate lease created

## Data Integrity Constraints
- one active lease per tenant (default enforced by assignment endpoint)
- one active lease per property (default enforced by assignment endpoint)
- statement ledger payments idempotent by payment intent

## Operational Notes
- Keep Firestore rules aligned with endpoint expectations.
- If adding new onboarding checklist steps, update:
  - lease schema
  - onboarding API
  - onboarding UI/gate logic
