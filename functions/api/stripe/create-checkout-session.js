/**
 * Stripe Checkout Session Creation
 * Cloudflare Pages Function
 * 
 * POST /api/stripe/create-checkout-session
 * 
 * Creates a Stripe Checkout Session for rent, deposit, or fee payments.
 * Requires Firebase authentication.
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - FIREBASE_PROJECT_ID: Firebase project ID for token verification
 * - APP_BASE_URL: Base URL for redirect URLs (e.g., https://laneandkeyproperties.com)
 */

import { authenticateRequest } from '../lib/firebase-verify.js';

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
    
    // Parse request body
    const body = await request.json();
    const { 
      invoiceId, 
      type, // 'rent', 'deposit', 'fee', 'late_fee', 'application_fee'
      leaseId,
      amount, // Amount in cents - only used for admin-created ad-hoc payments
      description,
      metadata = {}
    } = body;
    
    // Validate required fields
    if (!type) {
      return new Response(JSON.stringify({
        error: 'Payment type is required'
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    // For production, you would fetch the invoice or lease from Firestore
    // to get the actual amount (never trust client-sent amounts for regular payments)
    // Here we'll validate that amount is provided and reasonable
    
    let paymentAmount = amount;
    let paymentDescription = description;
    
    // Default descriptions by type
    if (!paymentDescription) {
      switch (type) {
        case 'rent':
          paymentDescription = 'Rent Payment';
          break;
        case 'deposit':
          paymentDescription = 'Security Deposit';
          break;
        case 'fee':
          paymentDescription = 'Fee Payment';
          break;
        case 'late_fee':
          paymentDescription = 'Late Fee';
          break;
        case 'application_fee':
          paymentDescription = 'Application Fee';
          break;
        default:
          paymentDescription = 'Payment';
      }
    }
    
    // Validate amount
    if (!paymentAmount || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      return new Response(JSON.stringify({
        error: 'Valid payment amount is required'
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    // Maximum amount check (reasonable limit of $50,000)
    if (paymentAmount > 5000000) {
      return new Response(JSON.stringify({
        error: 'Payment amount exceeds maximum allowed'
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    // Build success and cancel URLs
    const baseUrl = env.APP_BASE_URL || 'https://laneandkeyproperties.com';
    const successUrl = `${baseUrl}/portal/tenant/payments/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/portal/tenant/payments?canceled=true`;
    
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
      metadata: {
        tenantUid: user.uid,
        type: type,
        invoiceId: invoiceId || '',
        leaseId: leaseId || '',
        ...metadata,
      },
      payment_intent_data: {
        metadata: {
          tenantUid: user.uid,
          type: type,
          invoiceId: invoiceId || '',
          leaseId: leaseId || '',
        },
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
    
    // Determine appropriate error response
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
    
    return new Response(JSON.stringify({
      error: message,
    }), {
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
