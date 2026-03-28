# Stripe Webhook → Firestore (Cloudflare Pages)

## Architecture

The Stripe webhook handler runs as a **Cloudflare Pages Function** at `/api/stripe/webhook`.  
It receives payment events from Stripe, verifies the webhook signature, and writes results to Firestore via the REST API.

## Authentication

Cloudflare Workers cannot use `firebase-admin` (it requires Node.js APIs not available in the Workers runtime).  
Instead, we use **Google OAuth 2.0 service account** authentication:

1. A service account key is stored as the `FIREBASE_SERVICE_ACCOUNT_JSON` Cloudflare environment variable (secret).
2. At webhook invocation, `getServiceAccessToken(env)` in `firestore-rest.js`:
   - Parses the service account JSON
   - Signs a JWT using the service account's private key (RS256 via Web Crypto API)
   - Exchanges the JWT for a Google OAuth2 access token
3. The access token is passed as `Authorization: Bearer <token>` to all Firestore REST API calls.
4. OAuth access tokens from service accounts bypass Firestore security rules — they have full read/write access.

## Required Cloudflare Environment Variables

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full service account key JSON (set as secret, not plaintext) |

## Setting Up the Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key" → download JSON file
3. In Cloudflare Dashboard → Pages → Settings → Environment Variables:
   - Add `FIREBASE_SERVICE_ACCOUNT_JSON` = paste the entire JSON content
   - Mark as **encrypted** (secret)

## Event Flow

```
Stripe → POST /api/stripe/webhook
       → Verify signature (HMAC-SHA256)
       → Check idempotency (KV store if available)
       → Get service account access token
       → Process event:
           checkout.session.completed → write ledger entry, update statement, create payment record, create alert
           payment_intent.payment_failed → write failed payment record, create alert
       → ACK 200 to Stripe
```

## Firestore Collections Written

- `rentStatements/{id}/ledger/{entryId}` — payment ledger entries
- `rentStatements/{id}` — balance updates, status changes
- `invoices/{id}` — mark paid
- `payments/{id}` — payment audit records
- `alerts/{id}` — tenant payment notifications
