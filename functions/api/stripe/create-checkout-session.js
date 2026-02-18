/**
 * Stripe Checkout Session Creation
 * Cloudflare Pages Function
 * 
 * POST /api/stripe/create-checkout-session
 * 
 * Creates a Stripe Checkout Session for:
 * - Rent payments (partial allowed, tied to a rent statement)
 * - Application fees
 * - Deposits and other fees
 * 
 * Requires Firebase authentication.
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - FIREBASE_PROJECT_ID: Firebase project ID for token verification
 * - APP_BASE_URL: Base URL for redirect URLs (e.g., https://laneandkeyproperties.com)
 */

import { authenticateRequest } from '../lib/firebase-verify.js';
import { getDocument, queryDocuments } from '../lib/firestore-rest.js';

// Stripe API base URL
const STRIPE_API_URL = 'https://api.stripe.com/v1';

/**
 * Make a request to Stripe API
 */
async function stripeRequest(endpoint, method, body, secretKey) {
  const response = await fetch(`${STRIPE_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error');
  }
  
  return data;
}

/**
 * Create URL-encoded body for Stripe API
 * Handles nested objects using Stripe's bracket notation
 */
function buildStripeBody(params, prefix = '') {
  const body = {};
  
  for (const [key, value] of Object.entries(params)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    
    if (value === null || value === undefined) {
      continue;
    }
    
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          Object.assign(body, buildStripeBody(item, `${fullKey}[${index}]`));
        } else {
          body[`${fullKey}[${index}]`] = item;
        }
      });
    } else if (typeof value === 'object') {
      Object.assign(body, buildStripeBody(value, fullKey));
    } else {
      body[fullKey] = String(value);
    }
  }
  
  return body;
}

/**
 * Get user role from Firestore
 */
async function getUserRole(projectId, uid) {
  const user = await getDocument(projectId, 'users', uid);
  return user?.role || 'applicant';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.APP_BASE_URL || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
  
  try {
    // Check required environment variables
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }
    
    if (!env.FIREBASE_PROJECT_ID) {
      throw new Error('Firebase project ID not configured');
    }
    
    // Authenticate the request
    const user = await authenticateRequest(request, env);
    const projectId = env.FIREBASE_PROJECT_ID;
    const role = await getUserRole(projectId, user.uid);
    
    // Parse request body
    const body = await request.json();
    const { 
      statementId,    // for rent payments tied to a statement
      invoiceId,      // for legacy invoice-based payments
      type,           // 'rent' | 'application_fee' | 'deposit' | 'fee' | 'late_fee'
      leaseId,
      amount,         // Amount in cents (validated server-side)
      amountCents,    // Alias for amount
      description,
      metadata = {}
    } = body;
    
    // Validate required fields
    if (!type) {
      return new Response(JSON.stringify({
        error: 'Payment type is required'
      }), { status: 400, headers: corsHeaders });
    }

    // Role-based access control
    if (type === 'application_fee' && role !== 'applicant' && role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Only applicants can pay application fees'
      }), { status: 403, headers: corsHeaders });
    }
    if (type === 'rent' && role !== 'tenant' && role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Only tenants can pay rent'
      }), { status: 403, headers: corsHeaders });
    }

    let paymentAmount = amountCents || amount;
    let paymentDescription = description;
    let paymentMetadata = { ...metadata, tenantUid: user.uid, type };

    // ─── Statement-based rent payment ──────────────────────
    if (statementId && type === 'rent') {
      const statement = await getDocument(projectId, 'rentStatements', statementId);
      
      if (!statement) {
        return new Response(JSON.stringify({ error: 'Statement not found' }), {
          status: 404, headers: corsHeaders,
        });
      }

      // Verify ownership
      if (role !== 'admin' && statement.tenantUid !== user.uid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: corsHeaders,
        });
      }

      // Verify statement is still open
      if (statement.status !== 'open') {
        return new Response(JSON.stringify({ error: 'Statement is already paid or void' }), {
          status: 400, headers: corsHeaders,
        });
      }

      // Validate amount with server-side bounds
      const maxAmount = statement.balanceCents;
      const minAmount = 100; // $1 minimum

      if (!paymentAmount || paymentAmount < minAmount) {
        return new Response(JSON.stringify({
          error: `Minimum payment is $1.00`
        }), { status: 400, headers: corsHeaders });
      }

      if (paymentAmount > maxAmount) {
        return new Response(JSON.stringify({
          error: `Maximum payment for this statement is $${(maxAmount / 100).toFixed(2)}`
        }), { status: 400, headers: corsHeaders });
      }

      paymentDescription = paymentDescription || `Rent Payment - ${statement.month}`;
      paymentMetadata.statementId = statementId;
      paymentMetadata.month = statement.month;
      paymentMetadata.leaseId = statement.leaseId;
      paymentMetadata.amountCents = String(paymentAmount);
    }
    
    // ─── Default descriptions ──────────────────────────────
    if (!paymentDescription) {
      switch (type) {
        case 'rent': paymentDescription = 'Rent Payment'; break;
        case 'deposit': paymentDescription = 'Security Deposit'; break;
        case 'fee': paymentDescription = 'Fee Payment'; break;
        case 'late_fee': paymentDescription = 'Late Fee'; break;
        case 'application_fee': paymentDescription = 'Application Fee'; break;
        default: paymentDescription = 'Payment';
      }
    }
    
    // Validate amount
    if (!paymentAmount || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      return new Response(JSON.stringify({
        error: 'Valid payment amount is required'
      }), { status: 400, headers: corsHeaders });
    }
    
    // Max $50,000
    if (paymentAmount > 5000000) {
      return new Response(JSON.stringify({
        error: 'Payment amount exceeds maximum allowed'
      }), { status: 400, headers: corsHeaders });
    }
    
    // Build success and cancel URLs
    const baseUrl = env.APP_BASE_URL || 'https://laneandkeyproperties.com';
    const successUrl = type === 'application_fee'
      ? `${baseUrl}/portal/applicant/applications?payment=success&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/portal/tenant/payments/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = type === 'application_fee'
      ? `${baseUrl}/portal/applicant/applications?payment=canceled`
      : `${baseUrl}/portal/tenant/payments?canceled=true`;
    
    // Prepare Stripe Checkout Session parameters
    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: paymentAmount,
            product_data: {
              name: paymentDescription,
              description: `Lane & Key Properties - ${paymentDescription}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
      metadata: paymentMetadata,
      payment_intent_data: {
        metadata: paymentMetadata,
      },
    };
    
    // Convert to Stripe API format
    const stripeBody = buildStripeBody(sessionParams);
    
    // Create Checkout Session
    const session = await stripeRequest(
      '/checkout/sessions',
      'POST',
      stripeBody,
      env.STRIPE_SECRET_KEY
    );
    
    // Return the session URL for redirect
    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
    }), {
      status: 200,
      headers: corsHeaders,
    });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    let status = 500;
    let message = 'Internal server error';
    
    if (error.message.includes('authentication') || error.message.includes('token')) {
      status = 401;
      message = 'Authentication required';
    } else if (error.message.includes('not configured')) {
      status = 503;
      message = 'Service not properly configured';
    } else {
      message = error.message;
    }
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: corsHeaders,
    });
  }
}

// Handle CORS preflight requests
export async function onRequestOptions(context) {
  const { env } = context;
  
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': env.APP_BASE_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
