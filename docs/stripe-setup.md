# Stripe Setup Guide

This guide covers configuring Stripe for Lane & Key Properties payment processing.

## 1. Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Complete business verification
3. Get API keys from **Developers → API keys**

## 2. Environment Variables

### Portal (client-side)

In `portal/.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

For development, use the test key:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Cloudflare Functions (server-side)

Set these as Cloudflare Pages environment variables:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SA_KEY=<base64-encoded service account JSON>
```

For development:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

## 3. Create Webhook

1. Go to **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **signing secret** → set as `STRIPE_WEBHOOK_SECRET`

## 4. Payment Flow

### Rent Payments (Statement-Based)

```
┌──────────┐   POST /api/stripe/     ┌──────────┐   Stripe    ┌─────────┐
│  Tenant  │──create-checkout-session─│ Function │──Checkout──│ Stripe  │
│  Portal  │                          │ (Edge)   │            │  API    │
└──────────┘                          └──────────┘            └─────────┘
                                                                  │
                                                          webhook callback
                                                                  │
                                                          ┌──────────┐
                                                          │ Webhook  │
                                                          │ Handler  │
                                                          └──────────┘
                                                                  │
                                                       writes ledger entry,
                                                       recomputes balance,
                                                       marks statement paid
```

1. **Tenant** selects a statement and enters payment amount
2. **Client** calls `POST /api/stripe/create-checkout-session`
   - Server validates: user owns the statement, amount ≤ balance
3. **Stripe Checkout** session created → tenant redirected
4. **Webhook** fires on `checkout.session.completed`
   - Writes idempotent ledger entry: `pay_{paymentIntentId}`
   - Recomputes statement balance
   - If balance ≤ 0, marks statement as `paid`
   - Creates payment record in `payments` collection

### Application Fees

Similar flow but with `type: 'application_fee'`. Only applicants can create these sessions.

## 5. Partial Payments

- Minimum payment: **$1.00** (100 cents)
- Maximum payment: current statement balance
- Multiple partial payments are tracked via separate ledger entries
- Balance recomputed after each payment

## 6. Idempotency

All ledger entries use deterministic IDs:

| Type | ID Pattern |
|------|-----------|
| Payment | `pay_{stripe_payment_intent_id}` |
| Initial Late Fee | `late_init_{YYYY-MM}` |
| Daily Late Fee | `late_daily_{YYYY-MM-DD}` |

This ensures duplicate webhook deliveries or fee calculations never double-charge.

## 7. Testing

Use Stripe's test card numbers:

| Card | Number |
|------|--------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Auth Required | `4000 0025 0000 3155` |

Use any future expiry, any CVC, any ZIP.

## 8. Going Live

1. Switch to live API keys in environment variables
2. Update webhook endpoint URL
3. Verify webhook signature is using the live signing secret
4. Test a real transaction with a small amount
