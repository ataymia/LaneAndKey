# Portal Routing & Lease Lifecycle

## SPA Routing (Cloudflare Pages)

The portal is a React SPA served from `/portal/`. Deep-links such as `/portal/tenant/payments`
must resolve to `/portal/index.html` so React Router can handle client-side routing.

### How it works

| File | Purpose |
|---|---|
| `_routes.json` | Routes only `/api/*` to Cloudflare Pages Functions. Everything else is static. |
| `_redirects` | SPA fallback: `/portal/* → /portal/index.html` (200 rewrite). |
| `vite.config.ts` | `base: '/portal/'` so built assets reference `/portal/assets/…`. |
| `BrowserRouter` | `basename="/portal"` — all React routes are relative to `/portal`. |

**Flow for a deep link like `/portal/tenant/payments`:**

1. `_routes.json` — not `/api/*` → served as static asset.
2. `_redirects` — matches `/portal/*` → rewrites to `/portal/index.html` with 200 status.
3. Browser receives the SPA shell.
4. React Router matches `/tenant/payments` → renders `TenantPaymentsPage`.

### Common pitfalls

- `_redirects` must be in the **build output root** (`dist/`). The `build.sh` copies it.
- Vite's `base` must match the deploy path (`/portal/`).
- Links inside React must use `<Link to="/tenant/…">` (relative to basename), **not** `<a href="/portal/tenant/…">` (which causes a full-page reload and bypasses React Router).

---

## Lease Document Lifecycle

### Data model

Portal documents live in the `portalDocuments` Firestore collection:

```
portalDocuments/{docId}
  ownerUid       – tenant UID
  uploadedByUid  – who uploaded (admin UID for lease docs)
  category       – 'lease' | 'pay_stub' | 'id' | …
  status         – 'sent' | 'pending_signature' | 'signed' | 'void' | …
  requiresSignature – boolean
  fileName, originalFilePath, signedFilePath, signatureHash
```

Generated leases (structured signing) are tracked in `generatedLeases/{id}`:

```
generatedLeases/{id}
  leaseId, templateId, tenantUid, propertyId
  signingStatus  – 'not_generated' | 'generated' | 'sent' | 'viewed' | 'signed'
  signatureFields, pdfOriginalPath, pdfSignedPath
```

### How the active lease is selected

When the tenant opens **View & Sign** (`/tenant/lease`), the page:

1. Loads all `portalDocuments` for the tenant via `getByOwner(uid)`.
2. Finds the first doc where `category === 'lease' && requiresSignature && status !== 'void'`.
3. Also checks `generatedLeases` for the first record with `signingStatus` of `'sent'` or `'viewed'`.
4. Whichever is found first is displayed for signing.

**Important:** Only ONE non-void lease document should be active at a time. The admin upload flow enforces this.

### Uploading a new lease (admin)

When an admin uploads a new lease doc from the tenant profile page:

1. All existing **non-void, non-signed** lease documents for that tenant are set to `status: 'void'`.
2. The new document is created with `status: 'sent'` and `requiresSignature: true`.
3. The tenant will see only the new lease on their **View & Sign** page.

### Voiding a lease document (admin)

Admins can click **Void** on any non-signed, non-void document in the tenant profile's Documents tab. Voided documents:

- Appear greyed out in the admin view with a "Void" badge.
- Are excluded from the tenant's signing flow.
- Cannot be updated by the tenant (enforced by Firestore Security Rules).

### Replacing a lease

To replace a lease:

1. Upload a new lease document (the old one is auto-voided).
2. Or manually void the old doc first, then upload a new one.

Signed leases are never auto-voided — they serve as the permanent record.

---

## Firestore Security Rules (relevant)

```
portalDocuments/{docId}:
  read:   ownerUid == auth.uid || isAdmin()
  create: uploadedByUid == auth.uid
  update: isAdmin() || (ownerUid == auth.uid && status != 'void')
  delete: isAdmin()
```

Tenants cannot update void documents, preventing re-signing of revoked leases.

---

## Payments Flow

### Loading statements

`TenantPaymentsPage` → `GET /api/rent/statements` → `functions/api/rent/statements/index.js`

The API authenticates via Firebase ID token, reads the user profile to determine role,
then queries `rentStatements` filtered by `tenantUid`. All Firestore REST calls use the
authenticated ID token for Security Rules compliance.

### Pay Rent → Stripe Checkout

`handlePayRent()` → `createCheckoutSession()` → `POST /api/stripe/create-checkout-session`

The server validates auth, checks the user's role, verifies the statement is open and the
amount is within bounds, then creates a Stripe Checkout Session and returns the URL.

On completion, Stripe redirects to `/portal/tenant/payments/success?session_id=…`.
The webhook at `/api/stripe/webhook` processes `checkout.session.completed` to post the
ledger entry and update the statement balance.

**Note:** The success page shows "Payment Submitted" — actual confirmation happens
asynchronously via the Stripe webhook, not the redirect.
