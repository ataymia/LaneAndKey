# Portal Roles & Permissions

The Lane & Key Properties portal uses role-based access control.
Each user has a `role` field in their Firestore `users/{uid}` document.

## Roles

| Role | Description | Access |
|------|------------|--------|
| `admin` | Property manager / administrator | Full access to all data |
| `tenant` | Active tenant with a lease | Own lease, payments, statements, documents |
| `applicant` | Prospective tenant | Own application, uploaded documents |

## Route Access

| Route prefix | Allowed Roles |
|-------------|---------------|
| `/portal/admin/*` | `admin` |
| `/portal/tenant/*` | `tenant` |
| `/portal/applicant/*` | `applicant` |
| `/portal/login` | Public |
| `/portal/signup` | Public |

## Firestore Security Rules Summary

### Users (`users/{uid}`)
- **Read**: Owner or admin
- **Write**: Owner (own doc) or admin

### Properties (`properties/{id}`)
- **Read**: Any authenticated user
- **Write**: Admin only

### Rent Statements (`rentStatements/{id}`)
- **Read**: Owner (`tenantUid == uid`) or admin
- **Create/Update**: Admin only
- **Ledger subcollection** (`rentStatements/{id}/ledger/{entryId}`):
  - Read: If parent statement's `tenantUid == uid`, or admin
  - Write: Admin only

### Portal Documents (`portalDocuments/{id}`)
- **Read**: Owner (`ownerUid == uid`) or admin
- **Create**: Owner or admin
- **Update**: Owner or admin
- **Events subcollection**: Same as parent

### Leases (`leases/{id}`)
- **Read**: Tenant listed in `tenantIds` array, or admin
- **Write**: Admin only

### Applications (`applications/{id}`)
- **Read**: Applicant (`applicantUid == uid`) or admin
- **Create**: Applicant
- **Update**: Applicant (own) or admin

### Payments, Invoices, Maintenance, Messages, etc.
- See `firestore.rules` for complete details

## How to Promote a User to Admin

```bash
node scripts/bootstrap-admin.js <firebase-uid>
```

See [Firebase Setup Guide](firebase-setup.md) for details.

## Late Fee Policy

- **$25.00** initial late fee on the **5th** of the month
- **$10.00/day** daily late fee starting the **6th**
- Fees are computed on-demand when statements are fetched
- Fees use idempotent IDs to prevent double-posting:
  - Initial: `late_init_{YYYY-MM}`
  - Daily: `late_daily_{YYYY-MM-DD}`
- Fees stop accruing when the statement balance reaches $0

## Document Categories

| Category | Description | Who uploads |
|----------|------------|-------------|
| `pay_stub` | Pay stubs / proof of income | Tenant / Applicant |
| `id` | Government-issued ID | Tenant / Applicant |
| `bank_statement` | Bank statements | Tenant / Applicant |
| `tax_return` | Tax returns | Tenant / Applicant |
| `lease` | Lease agreement | Admin |
| `other` | Miscellaneous | Anyone |

## E-Sign Workflow

1. Admin uploads lease PDF → creates `portalDocuments` record with `requiresSignature: true`
2. Tenant sees "Awaiting Signature" banner on Documents page
3. Tenant navigates to **My Lease** → clicks **Sign Lease**
4. Tenant draws or types signature, checks consent box
5. System stamps signature + timestamp + SHA-256 hash onto PDF
6. Signed PDF uploaded to Storage, document status → `signed`
7. Event recorded in `portalDocuments/{id}/events` subcollection
