# Payments & Authentication Guide

This document explains how to set up and use the Stripe payments integration and Firebase authentication in the Lane & Key Properties portal.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Environment Variables](#environment-variables)
4. [Firebase Setup](#firebase-setup)
5. [Stripe Setup](#stripe-setup)
6. [Data Model](#data-model)
7. [API Endpoints](#api-endpoints)
8. [Testing](#testing)
9. [Security Considerations](#security-considerations)

---

## Overview

The Lane & Key Properties portal implements a complete payment and authentication system:

- **Firebase Authentication**: Email/password authentication with role-based access (admin, tenant, applicant)
- **Stripe Checkout**: Secure payment processing for rent, deposits, and fees
- **Cloudflare Pages Functions**: Serverless API endpoints for secure payment processing

### Key Features

- Tenants can pay rent, security deposits, and fees via Stripe Checkout
- Admins can create invoices and track payment status
- All payment amounts are validated server-side (never trust client-sent amounts)
- Webhook handling for real-time payment status updates
- Idempotent event processing to prevent duplicate transactions

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│   React Frontend    │     │   Cloudflare Pages       │
│   (Vite + React)    │────▶│   Functions              │
│                     │     │                          │
│  - Auth Context     │     │  - /api/stripe/          │
│  - Payment UI       │     │    create-checkout-session│
│  - Protected Routes │     │  - /api/stripe/webhook   │
└─────────────────────┘     └──────────────────────────┘
         │                            │
         │                            │
         ▼                            ▼
┌─────────────────────┐     ┌──────────────────────────┐
│   Firebase          │     │   Stripe                 │
│                     │     │                          │
│  - Authentication   │     │  - Checkout Sessions     │
│  - Firestore DB     │     │  - Payment Processing    │
│  - User Profiles    │     │  - Webhooks              │
└─────────────────────┘     └──────────────────────────┘
```

---

## Environment Variables

### Client-Side (Public)

These are embedded in the frontend build and are safe to expose:

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (e.g., `project-id.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (starts with `pk_`) |

### Server-Side (Secrets)

These must be configured in Cloudflare Pages dashboard under **Settings > Environment variables**:

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (starts with `sk_`) - **NEVER expose in client code** |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (starts with `whsec_`) |
| `FIREBASE_PROJECT_ID` | Firebase project ID (for token verification) |
| `APP_BASE_URL` | Application base URL (e.g., `https://laneandkeyproperties.com`) |

### Setting Environment Variables in Cloudflare Pages

1. Go to Cloudflare Dashboard > Pages > Your Project
2. Navigate to **Settings** > **Environment variables**
3. Add each variable with appropriate scope:
   - Production secrets: Set for "Production" environment only
   - Use "Encrypt" for sensitive values like `STRIPE_SECRET_KEY`

---

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** with Email/Password provider
4. Enable **Cloud Firestore**

### 2. Configure Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password**
3. (Optional) Enable additional providers like Google

### 3. Set Up Firestore

Create the following collections:

```
users/
  {uid}/
    - email: string
    - displayName: string
    - role: "admin" | "tenant" | "applicant"
    - phone: string (optional)
    - createdAt: timestamp
    - updatedAt: timestamp

invoices/
  {invoiceId}/
    - tenantUid: string
    - tenantId: string
    - leaseId: string
    - propertyId: string
    - type: "rent" | "deposit" | "fee" | "late_fee" | "application_fee"
    - description: string
    - amountCents: number
    - dueDate: timestamp
    - status: "due" | "pending" | "paid" | "overdue" | "void"
    - stripeSessionId: string (optional)
    - stripePaymentIntentId: string (optional)
    - paidAt: timestamp (optional)
    - createdAt: timestamp
    - updatedAt: timestamp

payments/
  {paymentId}/
    - tenantUid: string
    - tenantId: string
    - leaseId: string
    - propertyId: string
    - invoiceId: string (optional)
    - amount: number (in cents)
    - type: "rent" | "deposit" | "fee" | "late_fee"
    - method: "stripe" | "check" | "cash"
    - status: "pending" | "processing" | "completed" | "failed"
    - stripeSessionId: string (optional)
    - stripePaymentIntentId: string (optional)
    - stripeEventId: string (for idempotency)
    - dueDate: timestamp
    - paidDate: timestamp (optional)
    - createdAt: timestamp
    - updatedAt: timestamp
```

### 4. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins can read/write all users
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Invoices - tenants can read their own, admins can read/write all
    match /invoices/{invoiceId} {
      allow read: if request.auth != null && 
        (resource.data.tenantUid == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Payments - similar rules
    match /payments/{paymentId} {
      allow read: if request.auth != null && 
        (resource.data.tenantUid == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## Stripe Setup

### 1. Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create an account (or sign in)
3. Complete business verification for live mode

### 2. Get API Keys

1. In Stripe Dashboard, go to **Developers** > **API keys**
2. Copy the **Publishable key** → Set as `VITE_STRIPE_PUBLISHABLE_KEY`
3. Copy the **Secret key** → Set as `STRIPE_SECRET_KEY`

### 3. Configure Webhook

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** → Set as `STRIPE_WEBHOOK_SECRET`

### 4. Test Mode vs Live Mode

- Use **test mode** keys during development (they start with `pk_test_` and `sk_test_`)
- Switch to **live mode** keys for production (they start with `pk_live_` and `sk_live_`)
- Test card numbers: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)

---

## Data Model

### Invoice Types

| Type | Description |
|------|-------------|
| `rent` | Monthly rent payment |
| `deposit` | Security deposit |
| `fee` | General fee |
| `late_fee` | Late payment fee |
| `application_fee` | Rental application fee |

### Invoice Status

| Status | Description |
|--------|-------------|
| `due` | Payment is due but not overdue |
| `overdue` | Past due date |
| `pending` | Payment initiated but not confirmed |
| `paid` | Payment completed |
| `void` | Invoice cancelled |
| `refunded` | Payment refunded |

### Payment Flow

1. Admin creates invoice for tenant
2. Tenant views invoice in portal
3. Tenant clicks "Pay Now"
4. Client calls `/api/stripe/create-checkout-session`
5. Server validates and creates Stripe Checkout Session
6. Client redirects to Stripe Checkout
7. Tenant completes payment on Stripe
8. Stripe sends webhook to `/api/stripe/webhook`
9. Server updates invoice status to `paid`
10. Tenant redirected back to portal success page

---

## API Endpoints

### POST /api/stripe/create-checkout-session

Creates a Stripe Checkout Session for payment.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "rent",
  "amount": 150000,
  "description": "January 2026 Rent",
  "invoiceId": "inv_abc123",
  "leaseId": "lease_xyz789"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_test_..."
}
```

### POST /api/stripe/webhook

Handles Stripe webhook events. Called by Stripe, not by client.

**Headers:**
```
Stripe-Signature: <stripe-signature>
Content-Type: application/json
```

**Handled Events:**
- `checkout.session.completed` - Mark invoice as paid
- `payment_intent.succeeded` - Log successful payment
- `payment_intent.payment_failed` - Log failed payment

---

## Testing

### Local Development with Stripe CLI

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Download from https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:8788/api/stripe/webhook
   ```

4. Copy the webhook signing secret shown in output and set as `STRIPE_WEBHOOK_SECRET`

5. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger payment_intent.succeeded
   stripe trigger payment_intent.payment_failed
   ```

### Test Cards

| Number | Description |
|--------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0027 6000 3184` | Requires 3D Secure |

Use any future expiry date and any 3-digit CVC.

### Testing Auth Protection

1. **Unauthenticated access**: Try accessing `/portal/tenant` without logging in - should redirect to `/login`
2. **Role mismatch**: Login as tenant, try accessing `/admin` - should redirect to tenant dashboard
3. **API protection**: Call `/api/stripe/create-checkout-session` without token - should return 401

---

## Security Considerations

### Client-Side Security

- Firebase ID token is used for authentication
- All protected routes use `ProtectedRoute` component
- Roles are checked both client-side (UX) and server-side (security)
- No secret keys in client code

### Server-Side Security

- All API endpoints verify Firebase ID token
- Token verification uses Google's public keys (JWKS)
- Payment amounts are validated server-side
- Webhook signature verification prevents spoofing
- Idempotent event processing prevents duplicate charges

### Best Practices

1. **Never trust client-sent amounts** - Always fetch amounts from database
2. **Always verify webhook signatures** - Prevents fake webhook calls
3. **Use environment variables** - Never commit secrets to code
4. **Encrypt secrets in Cloudflare** - Use "Encrypt" option for sensitive values
5. **Use test mode in development** - Avoid real charges during testing

---

## Troubleshooting

### Common Issues

**"Firebase is not configured"**
- Check that all `VITE_FIREBASE_*` environment variables are set
- Rebuild the application after setting variables

**"Stripe not configured"**
- Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set
- Verify the key starts with `pk_`

**"Authentication required" error**
- Ensure user is logged in
- Check that Firebase ID token is valid and not expired

**Webhook not receiving events**
- Verify webhook URL is correct in Stripe Dashboard
- Check that `STRIPE_WEBHOOK_SECRET` matches the endpoint
- Review Cloudflare Pages function logs

**Payment status not updating**
- Check webhook is receiving events (Stripe Dashboard > Webhooks)
- Verify Firestore write permissions
- Check server logs for errors

---

## File Structure

```
portal/
├── src/
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.ts      # Firebase initialization
│   │   │   ├── auth.ts        # Auth functions
│   │   │   └── firestore.ts   # Firestore services
│   │   └── stripe.ts          # Stripe client utilities
│   ├── contexts/
│   │   └── AuthContext.tsx    # Auth state management
│   ├── components/
│   │   └── auth/
│   │       └── ProtectedRoute.tsx
│   └── pages/
│       ├── tenant/
│       │   ├── TenantPaymentsPage.tsx
│       │   └── PaymentSuccessPage.tsx
│       └── admin/
│           └── InvoicesPage.tsx
└── ...

functions/
└── api/
    ├── lib/
    │   └── firebase-verify.js  # JWT verification
    └── stripe/
        ├── create-checkout-session.js
        └── webhook.js
```

---

## Support

For issues with:
- **Firebase**: Check [Firebase Documentation](https://firebase.google.com/docs)
- **Stripe**: Check [Stripe Documentation](https://stripe.com/docs)
- **Cloudflare Pages**: Check [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
