/**
 * Stripe Webhook Handler
 * Cloudflare Pages Function
 * 
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for payment processing.
 * Verifies webhook signature and processes payment events.
 * 
 * On successful payment (checkout.session.completed):
 * - Writes a payment ledger entry to the statement (idempotent: pay_{paymentIntentId})
 * - Recomputes statement balance and marks paid if <= 0
 * - Creates a payment record in the payments collection
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 * - FIREBASE_PROJECT_ID: Firebase project ID
 */

import {
  getDocument,
  setDocument,
  updateDocument,
  createDocument,
  getSubcollection,
  documentExists,
} from '../lib/firestore-rest.js';
import { getServiceAccessToken } from '../lib/firestore-rest.js';

// Stripe API base URL
const STRIPE_API_URL = 'https://api.stripe.com/v1';

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Compare two Uint8Arrays in constant time
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Compute HMAC-SHA256
 */
async function computeHmacSha256(key, data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return new Uint8Array(signature);
}

/**
 * Uint8Array to hex string
 */
function uint8ArrayToHex(arr) {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify Stripe webhook signature
 */
async function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  
  const elements = signature.split(',');
  const sigData = {};
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key === 't') {
      sigData.timestamp = value;
    } else if (key === 'v1') {
      sigData.signature = value;
    }
  }
  
  if (!sigData.timestamp || !sigData.signature) {
    return false;
  }
  
  // Check timestamp tolerance (5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  const timestamp = parseInt(sigData.timestamp, 10);
  
  if (Math.abs(now - timestamp) > tolerance) {
    console.error('Webhook timestamp outside tolerance');
    return false;
  }
  
  const signedPayload = `${sigData.timestamp}.${payload}`;
  const expectedSig = await computeHmacSha256(secret, signedPayload);
  const expectedSigHex = uint8ArrayToHex(expectedSig);
  
  const actualSigBytes = hexToUint8Array(sigData.signature);
  const expectedSigBytes = hexToUint8Array(expectedSigHex);
  
  return timingSafeEqual(actualSigBytes, expectedSigBytes);
}

/**
 * Store for processed event IDs (for idempotency)
 */
async function isEventProcessed(eventId, env) {
  if (env.PROCESSED_EVENTS) {
    const processed = await env.PROCESSED_EVENTS.get(eventId);
    return processed !== null;
  }
  return false;
}

async function markEventProcessed(eventId, env) {
  if (env.PROCESSED_EVENTS) {
    await env.PROCESSED_EVENTS.put(eventId, 'processed', { expirationTtl: 604800 });
  }
}

/**
 * Process checkout.session.completed event
 * 
 * Writes a ledger entry and recomputes statement balance
 */
async function handleCheckoutCompleted(session, env, accessToken) {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('FIREBASE_PROJECT_ID not set, cannot write to Firestore');
    return { success: false, action: 'checkout_completed', error: 'Missing project ID' };
  }

  const metadata = session.metadata || {};
  const tenantUid = metadata.tenantUid;
  const type = metadata.type;
  const statementId = metadata.statementId;
  const invoiceId = metadata.invoiceId;
  const leaseId = metadata.leaseId;
  const month = metadata.month;
  const paymentIntentId = session.payment_intent;
  const amountReceived = session.amount_total; // cents
  const now = new Date().toISOString();

  console.log('Payment completed:', {
    sessionId: session.id,
    paymentIntentId,
    amount: amountReceived,
    tenantUid,
    type,
    statementId,
  });

  // 1. If this is a statement-based rent payment, write a ledger entry
  if (statementId && type === 'rent') {
    const entryId = `pay_${paymentIntentId}`;
    
    // Idempotent: only write if entry doesn't exist
    const exists = await documentExists(
      projectId,
      `rentStatements/${statementId}/ledger`,
      entryId,
      accessToken
    );

    if (!exists) {
      // Write ledger entry (negative amount = payment)
      await setDocument(
        projectId,
        `rentStatements/${statementId}/ledger`,
        entryId,
        {
          type: 'payment',
          label: 'Payment',
          amountCents: -Math.abs(amountReceived),
          effectiveDate: now.split('T')[0],
          notes: `Stripe payment ${paymentIntentId}`,
          stripePaymentIntentId: paymentIntentId,
          stripeSessionId: session.id,
          createdByUid: tenantUid || 'system',
          createdAt: now,
        },
        accessToken
      );

      // Recompute balance
      const allEntries = await getSubcollection(
        projectId,
        `rentStatements/${statementId}`,
        'ledger',
        accessToken
      );
      const newBalance = allEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);

      const updateData = {
        balanceCents: newBalance,
        updatedAt: now,
      };
      if (newBalance <= 0) {
        updateData.status = 'paid';
        updateData.paidAt = now;
      }

      await updateDocument(projectId, 'rentStatements', statementId, updateData, accessToken);
      console.log(`Statement ${statementId} updated: balance=${newBalance}`);
    } else {
      console.log(`Ledger entry ${entryId} already exists, skipping (idempotent)`);
    }
  }

  // 2. If invoice-based payment, update the invoice
  if (invoiceId && invoiceId !== '') {
    try {
      await updateDocument(projectId, 'invoices', invoiceId, {
        status: 'paid',
        paidAt: now,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      }, accessToken);
      console.log(`Invoice ${invoiceId} marked as paid`);
    } catch (err) {
      console.error('Failed to update invoice:', err);
    }
  }

  // 3. Create a payment record (always, for audit trail)
  const paymentDocId = `stripe_${paymentIntentId}`;
  try {
    const exists = await documentExists(projectId, 'payments', paymentDocId, accessToken);
    if (!exists) {
      await setDocument(projectId, 'payments', paymentDocId, {
        tenantUid: tenantUid || '',
        tenantId: tenantUid || '',
        leaseId: leaseId || '',
        propertyId: '',
        invoiceId: invoiceId || '',
        statementId: statementId || '',
        amount: amountReceived,
        type: type || 'other',
        method: 'stripe',
        status: 'completed',
        dueDate: now,
        paidDate: now,
        stripePaymentId: paymentIntentId,
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: session.id,
        stripeEventId: session.id,
        createdAt: now,
        updatedAt: now,
      }, accessToken);
      console.log(`Payment record ${paymentDocId} created`);
    }
  } catch (err) {
    console.error('Failed to create payment record:', err);
  }

  // 4. Create an alert for the tenant
  if (tenantUid && projectId) {
    try {
      const cents = amountReceived || 0;
      const dollars = (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      await createDocument(projectId, 'alerts', {
        userId: tenantUid,
        type: 'payment_received',
        title: 'Payment Received',
        message: `Your payment of ${dollars} has been received and applied to your account.`,
        relatedId: statementId || '',
        relatedType: 'payment',
        read: false,
        archived: false,
        createdAt: now,
      }, accessToken);
    } catch (err) {
      console.error('Failed to create payment alert:', err);
    }
  }

  return { success: true, action: 'checkout_completed' };
}

/**
 * Process payment_intent.succeeded event
 */
async function handlePaymentSucceeded(paymentIntent, env) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);
  // Most logic is handled by checkout.session.completed
  return { success: true, action: 'payment_succeeded' };
}

/**
 * Process payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent, env, accessToken) {
  const projectId = env.FIREBASE_PROJECT_ID;
  console.log('Processing payment_intent.payment_failed:', paymentIntent.id);
  
  const metadata = paymentIntent.metadata || {};
  const lastError = paymentIntent.last_payment_error;
  
  console.log('Payment failed:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    errorMessage: lastError?.message,
    errorCode: lastError?.code,
    metadata,
  });

  // Create a failed payment record for audit
  if (projectId) {
    try {
      const paymentDocId = `stripe_failed_${paymentIntent.id}`;
      await setDocument(projectId, 'payments', paymentDocId, {
        tenantUid: metadata.tenantUid || '',
        tenantId: metadata.tenantUid || '',
        statementId: metadata.statementId || '',
        amount: paymentIntent.amount,
        type: metadata.type || 'other',
        method: 'stripe',
        status: 'failed',
        notes: lastError?.message || 'Payment failed',
        stripePaymentIntentId: paymentIntent.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, accessToken);
    } catch (err) {
      console.error('Failed to record failed payment:', err);
    }

    // Create a failed payment alert for the tenant
    if (metadata.tenantUid) {
      try {
        await setDocument(projectId, 'alerts', `alert_payfail_${paymentIntent.id}`, {
          userId: metadata.tenantUid,
          type: 'payment_failed',
          title: 'Payment Failed',
          message: `A payment attempt failed: ${lastError?.message || 'Unknown error'}. Please try again.`,
          relatedType: 'payment',
          read: false,
          archived: false,
          createdAt: new Date().toISOString(),
        }, accessToken);
      } catch (alertErr) {
        console.error('Failed to create payment-failed alert:', alertErr);
      }
    }
  }
  
  return { success: true, action: 'payment_failed' };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook secret not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }
    
    const payload = await request.text();
    const signature = request.headers.get('Stripe-Signature');
    
    if (!signature) {
      console.error('No Stripe signature header');
      return new Response('No signature', { status: 400 });
    }
    
    const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    
    if (!isValid) {
      console.error('Invalid Stripe signature');
      return new Response('Invalid signature', { status: 400 });
    }
    
    const event = JSON.parse(payload);
    
    console.log('Received Stripe event:', event.type, event.id);
    
    // Idempotency check
    const alreadyProcessed = await isEventProcessed(event.id, env);
    if (alreadyProcessed) {
      console.log('Event already processed:', event.id);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    let result = { success: true, action: 'ignored' };

    // Obtain service account access token for Firestore writes.
    // The webhook is server-to-server (no user auth), so we use a service account.
    let accessToken = null;
    try {
      accessToken = await getServiceAccessToken(env);
    } catch (tokenErr) {
      console.error('Failed to get service account token:', tokenErr.message);
      // Continue — calls without token will fail at Firestore rules, but we still ACK the webhook
    }
    
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event.data.object, env, accessToken);
        break;
        
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(event.data.object, env);
        break;
        
      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(event.data.object, env, accessToken);
        break;
        
      case 'charge.succeeded':
        console.log('Charge succeeded:', event.data.object.id);
        result = { success: true, action: 'charge_succeeded' };
        break;
        
      case 'charge.failed':
        console.log('Charge failed:', event.data.object.id);
        result = { success: true, action: 'charge_failed' };
        break;

      case 'charge.refunded':
        console.log('Charge refunded:', event.data.object.id);
        // TODO: If needed, reverse the ledger entry
        result = { success: true, action: 'charge_refunded' };
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
        result = { success: true, action: 'unhandled' };
    }
    
    await markEventProcessed(event.id, env);
    
    return new Response(JSON.stringify({ received: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    
    return new Response(JSON.stringify({
      error: 'Webhook processing failed',
      message: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
