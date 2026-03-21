# Administration – Tenant Profile (Single-Pane-of-Glass)

> **Route:** `/admin/tenants/:id`
> **Component:** `TenantProfilePage.tsx`

## Overview

The Tenant Profile page gives administrators a unified view of every dimension of a tenant's relationship with the property.  
Every datum shown is fetched live — no summary caches, no stale numbers.

## Entry Points

| From | How |
|------|-----|
| **Tenants** table | Click any row, or click tenant name link |
| **Tenants** table | Actions dropdown → "View Profile" |
| **Users** table | Click the **Users** icon on any tenant-role row |
| Direct URL | `/admin/tenants/{uid}` |

## Page Sections

### Header
- Avatar, full name, email, phone
- **Refresh** button (re-fetches all data)
- **Actions** dropdown (see Actions Matrix below)
- Back navigation to Tenants list

### Summary Cards (always visible)
| Card | Source |
|------|--------|
| Property | Active lease → property lookup |
| Lease Status | Active lease `.status` |
| Monthly Rent | Active lease `.monthlyRent` |
| Open Balance | Most recent statement `.balanceCents` |
| Joined | User `.createdAt` |

### Contact Row (always visible)
- Contact info (email, phone) — editable via Edit Contact modal
- Emergency contact from user profile
- Occupants list from lease (editable via Manage Occupants modal)

### Tabs

#### Lease & Property
- Full lease details: dates, rent, deposit, due day, grace period
- Occupants list with edit button
- Lease history table for multiple past leases
- Actions: Assign Lease, Edit Lease, Renew Lease, End Lease

#### Statements
- Statement list with month, status, balance
- Click any statement to expand its **Ledger** (charges, payments, fees, credits, adjustments)
- Actions: Add Fee, Add Credit, Add Adjustment

#### Payments
- Full payment history table: date, amount, method, status, reference

#### Documents
- All portal documents for tenant: file name, category, status, uploaded date
- Download links when available
- Upload Lease Document action

#### Maintenance
- All maintenance tickets: title, status, priority, submitted date
- Color-coded priority badges

#### Notices
- All alerts/notices sent to tenant: title, type, status, sent date
- Send Notice action

#### Activity
- Complete activity feed for all actions involving this tenant
- Shows: action type, description, timestamp, metadata
- Ordered newest first

## Actions Matrix

| Action | Trigger | Backend | Activity Logged |
|--------|---------|---------|-----------------|
| Assign / Change Property | Modal → `POST /api/admin/assign` | assign.js | `lease_created` |
| Edit Lease Terms | Modal → `PATCH /api/admin/leases/:id` | leases/[id].js | `lease_edited` |
| End Lease | Confirm dialog → `PATCH /api/admin/leases/:id` | leases/[id].js | `lease_edited` |
| Renew Lease | Modal → `PATCH /api/admin/leases/:id` | leases/[id].js | `lease_renewed` |
| Add Fee | Modal → `POST /api/admin/statements/:id/entry` | entry.js | `fee_added` |
| Add Credit | Modal → `POST /api/admin/statements/:id/entry` | entry.js | `credit_added` |
| Add Adjustment | Modal → `POST /api/admin/statements/:id/entry` | entry.js | `adjustment_added` |
| Send Notice | Modal → `alertService.create()` | Firestore client | `notice_sent` |
| Upload Lease Doc | Modal → Storage upload + `portalDocumentService.create()` | Storage + Firestore | `lease_doc_uploaded` |
| Edit Contact | Modal → `userService.update()` | Firestore client | `contact_updated` |
| Manage Occupants | Modal → `editLease()` with occupants | leases/[id].js | `occupant_added` / `occupant_removed` |

## Co-Tenants / Occupants Model

Occupants are stored on the lease document:

```
leases/{leaseId}.occupants = [
  { fullName: string, email?: string, phone?: string, type: 'primary' | 'secondary', notes?: string }
]
```

- Managed via the Manage Occupants modal from the profile header or Lease tab
- Each add/remove is individually activity-logged
- The `occupants` field is whitelisted in the `leases/[id].js` PATCH endpoint

## Data Loading

All data is loaded in parallel via `Promise.allSettled` for resilience — if one query fails (e.g., missing index), other sections still render.

**Collections queried:**
- `users` (single doc by UID)
- `leases` (by `tenantUid`)
- `properties` (by lease `propertyId`)
- `rentStatements` (by `tenantUid`)
- `payments` (by `tenantUid`)
- `portalDocuments` (by `ownerUid`)
- `maintenanceTickets` (by `tenantUid`)
- `alerts` (by `recipientUid`)
- `activityLogs` (by `targetUid`)

## Firestore Indexes Required

- `activityLogs`: composite index on `targetUid ASC` + `createdAt DESC`
  (added in `firestore.indexes.json`)

## Security

- Route is nested under `/admin/*` and protected by `ProtectedRoute` (requires `admin` role)
- All API calls pass the admin's Firebase ID token
- Server-side endpoints re-verify the token and check admin role

## Files Changed

| File | Change |
|------|--------|
| `portal/src/pages/admin/TenantProfilePage.tsx` | New — full profile component |
| `portal/src/pages/admin/TenantProfile.css` | New — profile styles |
| `portal/src/pages/admin/index.ts` | Export TenantProfilePage |
| `portal/src/App.tsx` | Route `tenants/:id` |
| `portal/src/pages/admin/TenantsPage.tsx` | Clickable rows + Actions dropdown |
| `portal/src/pages/admin/UsersPage.tsx` | "View Tenant Profile" link for tenants |
| `portal/src/pages/admin/AdminDashboard.tsx` | `Promise.allSettled` resilience fix |
| `portal/src/types/index.ts` | `LeaseOccupant` interface, new `ActivityAction` types |
| `portal/src/lib/firebase/firestore.ts` | `activityLogService.getByTargetUid()` |
| `portal/src/lib/api/portalApi.ts` | `addStatementEntry` accepts `'adjustment'`, `editLease` accepts `occupants` |
| `functions/api/admin/leases/[id].js` | `occupants` in allowed fields |
| `functions/api/admin/statements/[id]/entry.js` | `adjustment` entry type support |
| `firestore.indexes.json` | `activityLogs` targetUid composite index |
