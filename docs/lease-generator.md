# Lease Template & Generator System

## Overview

The Lease Template + Generator system allows admins to create **HTML-based lease templates** with explicit placeholders and signature anchors, generate tenant-specific PDFs with **deterministic field placement**, and enable tenants to electronically sign leases through the portal.

**Design principle:** No guessing. Every field has an explicit anchor. Every signature/date/initial position is computed at layout time with exact page coordinates. No "magic detection."

---

## Architecture

### Data Flow

```
1. Admin creates HTML template with {{PLACEHOLDERS}} and [[ANCHORS]]
2. Admin publishes template (validates all anchors present)
3. Admin selects template + tenant → fills field values → generates PDF
4. PDF engine places signature/date/initial boxes at known coordinates
5. Generated lease record stores exact field map (page, x, y, w, h)
6. Admin sends lease for signing → tenant gets notified
7. Tenant views PDF → completes each field (signature pad / date / initials)
8. On submit: pdf-lib stamps completed values at exact field coordinates
9. Signed PDF uploaded to Storage, records updated
```

### Collections

| Collection | Purpose |
|---|---|
| `leaseTemplates` | Template definitions (HTML body, field schemas, signature schemas, versioning) |
| `generatedLeases` | Per-tenant generated lease records (field values, signing status, PDF paths, field map) |

### Storage Paths

| Path | Contents |
|---|---|
| `generated-leases/{leaseId}/original_{timestamp}.pdf` | Generated (unsigned) PDF |
| `generated-leases/{leaseId}/signed_{timestamp}.pdf` | Tenant-signed PDF |

---

## Template Syntax

### Placeholders

Use double curly braces for variable substitution:

```html
<p>Tenant Name: {{TENANT_NAME}}</p>
<p>Monthly Rent: {{MONTHLY_RENT}}</p>
<p>Lease Start: {{LEASE_START}} through {{LEASE_END}}</p>
<p>Property: {{PROPERTY_ADDRESS}}</p>
```

Placeholders are replaced with actual values at generation time. The admin fills values in the Generate Lease workflow, with auto-population from tenant/lease/property data.

### Signature Anchors

Use double square brackets with type and role:

```html
[[SIGNATURE:tenant]]    <!-- Tenant signature field (200×40 box) -->
[[SIGNATURE:landlord]]  <!-- Landlord signature field -->
[[DATE:tenant]]         <!-- Tenant date field (140×24 box) -->
[[DATE:landlord]]       <!-- Landlord date field -->
[[INITIAL:tenant]]      <!-- Tenant initials field (60×24 box) -->
[[INITIAL:landlord]]    <!-- Landlord initials field -->
```

**Rules:**
- Every anchor in the `signatureSchema` must appear in the template body
- Anchors are rendered as labeled boxes at exact coordinates in the PDF
- The field map returned by generation records `{ page, x, y, width, height }` for each anchor
- Templates cannot be published if any anchor is missing

### Example Template

```html
<h1>RESIDENTIAL LEASE AGREEMENT</h1>
<h2>State of Arizona</h2>

<p>This Residential Lease Agreement ("Lease") is entered into on {{LEASE_START}} by and between:</p>

<p><strong>Landlord:</strong> Lane & Key Properties LLC</p>
<p><strong>Tenant:</strong> {{TENANT_NAME}}</p>

<h2>1. PROPERTY</h2>
<p>The Landlord agrees to lease to the Tenant the property located at:</p>
<p>{{PROPERTY_ADDRESS}}</p>

<h2>2. LEASE TERM</h2>
<p>The lease term begins on {{LEASE_START}} and ends on {{LEASE_END}}.</p>

<h2>3. RENT</h2>
<p>Monthly rent: {{MONTHLY_RENT}}, due on the {{RENT_DUE_DAY}} of each month.</p>
<p>Security deposit: {{SECURITY_DEPOSIT}}</p>

<p><em>Tenant acknowledges the above terms:</em></p>
<p>Tenant Initials: [[INITIAL:tenant]]</p>

<h2>SIGNATURES</h2>

<p>Tenant Signature: [[SIGNATURE:tenant]]</p>
<p>Date: [[DATE:tenant]]</p>

<p>Landlord Signature: [[SIGNATURE:landlord]]</p>
<p>Date: [[DATE:landlord]]</p>
```

---

## Admin Workflows

### Creating a Template

1. Navigate to **Admin → Lease Templates**
2. Click **New Template**
3. Enter template name and HTML body in the editor
4. Use the **Source / Split / Preview** tabs to edit and preview
5. The sidebar auto-detects `{{PLACEHOLDERS}}` and `[[ANCHORS]]`
6. Click **Validate Anchors** to check all schema anchors exist in body
7. **Save** to create as draft

### Publishing a Template

1. From the template list, click **Publish** on a draft template
2. System validates: at least 1 signature anchor must exist, all anchors must be in body
3. Published templates become available for lease generation
4. Published templates can be **Archived** (removed from generation but preserved)
5. To create a new version: **Clone to Draft** → edit → publish (version auto-increments)

### Generating a Lease

1. Navigate to **Admin → Generate Lease**
2. **Step 1:** Select a published template
3. **Step 2:** Select a tenant and their active lease
4. **Step 3:** Fill in placeholder values (auto-populated from tenant/lease/property data)
5. Review the signature fields that will be placed
6. Click **Generate Lease PDF**
7. System generates the PDF, uploads to Storage, creates records
8. Click **Send for Signature** to notify the tenant

### Viewing Generated Leases

The **Generated Leases** tab shows all generated leases with:
- Template version used
- Tenant name
- Signing status (Not Generated → Generated → Sent → Viewed → Signed)
- Download links for original and signed PDFs
- Ability to resend for signature

---

## Tenant Signing Workflow

1. Tenant navigates to **My Lease** page
2. If a structured generated lease exists (status: `sent` or `viewed`):
   - PDF preview is displayed
   - **Required Fields** section shows each tenant field (signature/date/initial)
   - Tenant clicks each field to complete it:
     - **Signature:** Opens signature pad (draw or type)
     - **Date:** Auto-fills today's date
     - **Initial:** Auto-fills initials from display name
   - Progress bar shows `X/Y fields completed`
   - Once all fields are complete + consent checkbox → **Submit Signed Lease**
3. On submit:
   - All field values are stamped onto the PDF at exact coordinates from the field map
   - Signed PDF is uploaded to Storage
   - `generatedLease` record updated: `signingStatus = 'signed'`, `signedAt`, `pdfSignedPath`
   - Portal document updated: `status = 'signed'`
   - Signed copy auto-downloads for the tenant
4. **Legacy flow** (no generated lease): Original signature-on-last-page behavior is preserved

---

## Security Model

| Action | Who |
|---|---|
| Create/edit/delete/publish templates | Admin only |
| Generate leases | Admin only |
| Send for signature | Admin only |
| View own generated lease | Tenant (own `tenantUid` only) |
| Update signing status (`sent`→`viewed`→`signed`) | Tenant (own record, restricted field changes) |
| Read/write generated-leases Storage | Authenticated users |

**Firestore rule constraints for tenant updates:**
- Can only transition `signingStatus`: `sent` → `viewed` or `viewed` → `signed`
- Cannot change `tenantUid`, `leaseId`, or `templateId`

---

## PDF Engine Details

The PDF engine (`portal/src/lib/leaseGenerator.ts`) uses **pdf-lib** for deterministic layout:

- **Page size:** US Letter (612 × 792 points)
- **Margins:** 60pt all sides
- **Fonts:** Helvetica (body), Helvetica-Bold (headings)
- **Field box sizes:** Signature 200×40, Date 140×24, Initial 60×24
- **Layout:** Sequential top-to-bottom rendering; new page auto-created on overflow

The engine returns a `fieldMap` with exact `{ pageNumber, x, y, width, height }` for every anchor. This map is stored in the `generatedLease.signatureFields` array and used at signing time to stamp values at the correct positions.

---

## Testing Checklist

1. ✅ Create a template with placeholders + anchors, save as draft
2. ✅ Publish template (verify anchor validation catches missing anchors)
3. ✅ Generate a lease from a published template for a specific tenant
4. ✅ Verify PDF has correct field values and signature boxes at known positions
5. ✅ Send lease for signing, verify tenant sees it on their Lease page
6. ✅ Tenant completes all fields and submits → signed PDF generated with signatures at correct positions
7. ✅ Verify Firestore records updated correctly (signingStatus, paths, timestamps)

---

## Key Files

| File | Purpose |
|---|---|
| `portal/src/types/index.ts` | LeaseTemplate, GeneratedLease, and related types |
| `portal/src/lib/firebase/firestore.ts` | `leaseTemplateService` and `generatedLeaseService` |
| `portal/src/lib/leaseGenerator.ts` | PDF generation engine (generateLeasePdf, applySignaturesToPdf) |
| `portal/src/pages/admin/LeaseTemplatesPage.tsx` | Admin template CRUD page |
| `portal/src/pages/admin/GenerateLeasePage.tsx` | Admin generate/history page |
| `portal/src/pages/tenant/TenantLeaseSignPage.tsx` | Tenant signing page (structured + legacy) |
| `firestore.rules` | Security rules for leaseTemplates + generatedLeases |
| `storage.rules` | Storage rules for generated-leases path |
| `firestore.indexes.json` | Composite indexes for new collections |
