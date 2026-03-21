# Admin Portal Runbook

## Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | SPA at `/portal` basename |
| Auth | Firebase Auth | JWT token forwarded to every API call |
| Database | Cloud Firestore | Client SDK for reads, REST API for server writes |
| Edge Functions | Cloudflare Pages Functions | No `firebase-admin`; uses REST + idToken |
| Payments | Stripe Checkout + Webhooks | `functions/api/stripe/` |

## Data Flow — Single Source of Truth

```
properties  ──┐
leases      ──┤  Admin reads via client SDK
rentStatements┤  (leaseService, rentStatementService, etc.)
users       ──┘

POST /api/admin/leases/assign
  → creates lease doc
  → updates user.currentPropertyId + user.role
  → updates property.currentLeaseId + property.currentTenantUid
  → calls getOrCreateMonthlyStatement (initialises rent statement)
  → writes activityLogs entry
```

**Non-negotiable rules:**
- A tenant is "assigned" **only** when a lease doc exists with `status: 'active'` AND the property has `currentLeaseId` populated.
- A balance is shown **only** from `rentStatements` with `status: 'open'`. Zero means zero entries — never a fallback.
- No demo data anywhere. If Firestore returns empty, the UI shows an empty-state.

## Collections & Key Fields

### `properties`
- `currentLeaseId` / `currentTenantUid` — written by assign endpoint, cleared on lease termination.
- `acceptingApplications` — controls whether public listing shows an Apply button.

### `leases`
- `tenantUid`, `propertyId`, `status` (`active`/`terminated`/`expired`).
- `rentAmountCents`, `depositAmountCents` — canonical amounts in cents.
- `monthlyRent`, `securityDeposit` — dollar equivalents kept in sync by the edit API.

### `rentStatements`
- `leaseId`, `tenantUid`, `month` (YYYY-MM), `dueDate`, `balanceCents`, `status` (`open`/`paid`/`partial`/`overdue`).
- Created automatically on lease assignment and can be created per-month via `getOrCreateMonthlyStatement`.

### `ledger_{statementId}` (subcollection pattern via top-level collection)
- `type` (`charge`/`payment`/`fee`/`credit`), `amountCents` (signed), `label`, `createdAt`.

### `activityLogs`
- `actorUid`, `action`, `targetType`, `targetId`, `metadata`, `createdAt`.
- **Immutable** — firestore rules allow create only, no update/delete.

### `portalDocuments`
- `ownerUid`, `category` (`lease`/`other`), `requiresSignature`, `status` (`pending_signature`/`signed`), `signedFilePath`.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/leases/assign` | Create lease, init statement, update property+user |
| PATCH | `/api/admin/leases/[id]` | Edit lease terms (rent, dates, grace period, etc.) |
| POST | `/api/admin/statements/[id]/entry` | Add fee or credit to a statement |
| GET | `/api/statements` | List statements for current tenant |
| POST | `/api/stripe/create-checkout-session` | Start Stripe payment |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

## Admin Pages — What They Read

| Page | Primary Data | Joined Data |
|---|---|---|
| Dashboard | properties, applications, maintenance, leases | rentStatements (overdue calc), activityLogs (recent 10) |
| Tenants | users (role=tenant), leases (active) | rentStatements (balance per tenant) |
| Properties | properties | leases (active, by propertyId), maintenance (open tickets), users (tenant names) |
| Statements | rentStatements | ledger entries (on expand), users (tenant names) |
| Documents | documentTemplates | portalDocuments (lease docs tab, user uploads tab) |
| Payments | payments | users (tenant names) |
| Maintenance | maintenanceTickets | users, properties |
| Applications | applications | users, properties |
| Invoices | invoices | users, properties |

## Composite Indexes Required

All indexes are declared in `firestore.indexes.json`. Key new additions:

```
activityLogs: targetType ASC + targetId ASC + createdAt DESC
activityLogs: actorUid ASC + createdAt DESC
```

Deploy with: `firebase deploy --only firestore:indexes`

## Smoke Test Checklist

### 1. Lease Assignment
- [ ] Go to **Tenants** → **Assign Lease** on an unassigned tenant
- [ ] Select a property, set rent amount, confirm
- [ ] Verify: Tenants page shows the tenant with property name and balance
- [ ] Verify: Properties page shows "Leased" badge and tenant name on that property
- [ ] Verify: Statements page shows a new statement for the current month
- [ ] Verify: Dashboard activity log shows "Lease Assigned" entry

### 2. Statement Accuracy
- [ ] Open **Statements** → expand a statement → verify ledger entries match balance
- [ ] Add a fee via the statement detail → balance increases
- [ ] Add a credit → balance decreases
- [ ] If balance reaches 0, status changes to `paid`

### 3. Dashboard Stats
- [ ] **Overdue Rent** reflects sum of open statements past due date
- [ ] **Active Leases** count matches real leases with `status: 'active'`
- [ ] **Activity Log** shows last 10 actions in chronological order

### 4. Documents Workflow
- [ ] Upload a template in **Documents** → Templates tab
- [ ] Send template to a tenant with "Require Signature" checked
- [ ] Verify: **Lease Documents** tab shows the document with "Pending Signature" badge
- [ ] Verify: Activity log shows "Document Sent" entry

### 5. Lease Editing
- [ ] Use PATCH `/api/admin/leases/:id` to update rentAmountCents
- [ ] Verify: Both `rentAmountCents` and `monthlyRent` are updated
- [ ] Verify: Activity log shows "Lease Edited" entry

### 6. Properties Context
- [ ] Properties page cards show: tenant name, open maintenance tickets, lease status
- [ ] A property with no lease shows no tenant info and no "Leased" badge

### 7. No Demo Data
- [ ] With empty Firestore collections, every page shows appropriate empty states
- [ ] No hardcoded demo arrays exist anywhere in the codebase

## Troubleshooting

**FAILED_PRECONDITION on queries**: Missing composite index. Check the Firebase console error message — it contains a direct link to create the index. Also run `firebase deploy --only firestore:indexes` to push all declared indexes.

**$0 balance after assignment**: Verify `getOrCreateMonthlyStatement` was called in assign.js. Check that `workflow.js` passes `idToken` to all Firestore REST calls.

**Tenant shows "No Property"**: Check that `property.currentLeaseId` was written during assignment. The TenantsPage resolves property via `lease.propertyId` → `propertyService.getById()`.

**Activity log empty**: Verify `activityLogs` Firestore rules allow `create` for admins. Check that the composite indexes are deployed.
