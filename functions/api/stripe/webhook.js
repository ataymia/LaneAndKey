/**
 * Stripe Webhook Handler
 * Cloudflare Pages Function
 * 
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for payment processing.
 * Verifies webhook signature and processes payment events.
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_SERVICE_ACCOUNT_KEY: Firebase service account (optional, for Firestore writes)
 */

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
 * 
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @param {string} secret - Webhook signing secret
 * @returns {boolean} - Whether signature is valid
 */
async function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  
  // Parse the signature header
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
  
  // Compute expected signature
  const signedPayload = `${sigData.timestamp}.${payload}`;
  const expectedSig = await computeHmacSha256(secret, signedPayload);
  const expectedSigHex = uint8ArrayToHex(expectedSig);
  
  // Compare signatures
  const actualSigBytes = hexToUint8Array(sigData.signature);
  const expectedSigBytes = hexToUint8Array(expectedSigHex);
  
  return timingSafeEqual(actualSigBytes, expectedSigBytes);
}

/**
 * Store for processed event IDs (for idempotency)
 * In production, this should be stored in a database like Firestore
 * For now, we'll use a simple in-memory check with KV storage if available
 */
async function isEventProcessed(eventId, env) {
  if (env.PROCESSED_EVENTS) {
    // Use Cloudflare KV if available
    const processed = await env.PROCESSED_EVENTS.get(eventId);
    return processed !== null;
  }
  return false;
}

async function markEventProcessed(eventId, env) {
  if (env.PROCESSED_EVENTS) {
    // Store with 7-day TTL
    await env.PROCESSED_EVENTS.put(eventId, 'processed', { expirationTtl: 604800 });
  }
}

/**
 * Process checkout.session.completed event
 */
async function handleCheckoutCompleted(session, env) {
  console.log('Processing checkout.session.completed:', session.id);
  
  const metadata = session.metadata || {};
  const tenantUid = metadata.tenantUid;
  const type = metadata.type;
  const invoiceId = metadata.invoiceId;
  const leaseId = metadata.leaseId;
  
  // Log the payment details (in production, write to Firestore)
  console.log('Payment completed:', {
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency,
    customerEmail: session.customer_email,
    tenantUid,
    type,
    invoiceId,
    leaseId,
  });
  
  // TODO: Write to Firestore
  // In a production environment, you would:
  // 1. Update the invoice status to 'paid'
  // 2. Create a payment record
  // 3. Send confirmation email to tenant
  // 4. Create an alert for admin
  
  // Example Firestore write (requires Firebase Admin or REST API):
  // await updateInvoice(invoiceId, { status: 'paid', paidAt: new Date(), stripeSessionId: session.id });
  // await createPayment({ tenantUid, invoiceId, amount: session.amount_total, ... });
  
  return { success: true, action: 'checkout_completed' };
}

/**
 * Process payment_intent.succeeded event
 */
async function handlePaymentSucceeded(paymentIntent, env) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);
  
  const metadata = paymentIntent.metadata || {};
  
  console.log('Payment intent succeeded:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata,
  });
  
  return { success: true, action: 'payment_succeeded' };
}

/**
 * Process payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent, env) {
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
  
  // TODO: Update invoice status to reflect failed payment
  // TODO: Create alert for tenant and admin
  
  return { success: true, action: 'payment_failed' };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Check required environment variables
    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook secret not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }
    
    // Get the raw body for signature verification
    const payload = await request.text();
    
    // Get the Stripe signature header
    const signature = request.headers.get('Stripe-Signature');
    
    if (!signature) {
      console.error('No Stripe signature header');
      return new Response('No signature', { status: 400 });
    }
    
    // Verify the webhook signature
    const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    
    if (!isValid) {
      console.error('Invalid Stripe signature');
      return new Response('Invalid signature', { status: 400 });
    }
    
    // Parse the event
    const event = JSON.parse(payload);
    
    console.log('Received Stripe event:', event.type, event.id);
    
    // Check idempotency - don't process the same event twice
    const alreadyProcessed = await isEventProcessed(event.id, env);
    if (alreadyProcessed) {
      console.log('Event already processed:', event.id);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Process the event based on type
    let result = { success: true, action: 'ignored' };
    
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event.data.object, env);
        break;
        
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(event.data.object, env);
        break;
        
      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(event.data.object, env);
        break;
        
      case 'charge.succeeded':
        console.log('Charge succeeded:', event.data.object.id);
        result = { success: true, action: 'charge_succeeded' };
        break;
        
      case 'charge.failed':
        console.log('Charge failed:', event.data.object.id);
        result = { success: true, action: 'charge_failed' };
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
        result = { success: true, action: 'unhandled' };
    }
    
    // Mark event as processed for idempotency
    await markEventProcessed(event.id, env);
    
    return new Response(JSON.stringify({ 
      received: true, 
      ...result 
    }), {
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
