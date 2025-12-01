/**
 * Stripe Integration Module
 * 
 * This module provides integration stubs for Stripe payment processing.
 * To complete the integration:
 * 
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your publishable key from the Stripe Dashboard
 * 3. Set the VITE_STRIPE_PUBLISHABLE_KEY environment variable
 * 4. For backend processing, set up Cloudflare Workers or Firebase Functions
 *    with your Stripe secret key (NEVER expose in client code)
 * 5. Configure webhooks in Stripe Dashboard to point to your webhook endpoint
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Stripe publishable key from environment variables
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Lazy-loaded Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe instance
 * Returns null if the publishable key is not configured
 */
export function getStripe(): Promise<Stripe | null> {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('Stripe publishable key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY environment variable.');
    return Promise.resolve(null);
  }
  
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  
  return stripePromise;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_PUBLISHABLE_KEY;
}

/**
 * Create a payment session for rent payment
 * 
 * This is a stub that should be implemented with a backend function.
 * The backend should use the Stripe secret key to create the session.
 * 
 * @param tenantId - The tenant making the payment
 * @param amount - Payment amount in cents
 * @param description - Payment description
 * @returns Session ID for Stripe Checkout
 */
export async function createPaymentSession(
  tenantId: string,
  amount: number,
  description: string
): Promise<{ sessionId: string; url: string } | null> {
  // TODO: Implement backend API call
  // This should call a Cloudflare Worker or Firebase Function that:
  // 1. Authenticates the user
  // 2. Creates a Stripe Checkout Session using the secret key
  // 3. Returns the session ID and checkout URL
  
  console.log('Creating payment session:', { tenantId, amount, description });
  
  // Placeholder - replace with actual API call
  const API_ENDPOINT = import.meta.env.VITE_STRIPE_API_ENDPOINT || '/api/stripe/create-session';
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        amount,
        description,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create payment session');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating payment session:', error);
    return null;
  }
}

/**
 * Create an invoice for a tenant
 * 
 * This is a stub that should be implemented with a backend function.
 * 
 * @param tenantId - The tenant to invoice
 * @param items - Line items for the invoice
 * @returns Invoice ID
 */
export async function createInvoice(
  tenantId: string,
  items: Array<{ description: string; amount: number }>
): Promise<{ invoiceId: string; url: string } | null> {
  // TODO: Implement backend API call
  
  console.log('Creating invoice:', { tenantId, items });
  
  const API_ENDPOINT = import.meta.env.VITE_STRIPE_API_ENDPOINT || '/api/stripe/create-invoice';
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        items,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create invoice');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating invoice:', error);
    return null;
  }
}

/**
 * Redirect to Stripe Checkout
 * 
 * @param sessionId - The Checkout session ID
 */
export async function redirectToCheckout(sessionId: string): Promise<void> {
  const stripe = await getStripe();
  
  if (!stripe) {
    throw new Error('Stripe not configured');
  }
  
  // Redirect to checkout session URL via backend
  // The backend should return the checkout URL from Stripe
  window.location.href = `/api/stripe/checkout?session_id=${sessionId}`;
}

/**
 * Setup auto-pay for a tenant
 * 
 * This is a stub that should be implemented with a backend function.
 * Uses Stripe Setup Intents to save payment methods.
 * 
 * @param tenantId - The tenant setting up auto-pay
 * @returns Setup Intent client secret
 */
export async function setupAutoPay(
  tenantId: string
): Promise<{ clientSecret: string } | null> {
  // TODO: Implement backend API call
  
  console.log('Setting up auto-pay for:', tenantId);
  
  const API_ENDPOINT = import.meta.env.VITE_STRIPE_API_ENDPOINT || '/api/stripe/setup-autopay';
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to setup auto-pay');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error setting up auto-pay:', error);
    return null;
  }
}

/**
 * Cancel auto-pay for a tenant
 * 
 * @param tenantId - The tenant canceling auto-pay
 */
export async function cancelAutoPay(tenantId: string): Promise<boolean> {
  // TODO: Implement backend API call
  
  console.log('Canceling auto-pay for:', tenantId);
  
  const API_ENDPOINT = import.meta.env.VITE_STRIPE_API_ENDPOINT || '/api/stripe/cancel-autopay';
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error canceling auto-pay:', error);
    return false;
  }
}

/**
 * Payment status types that can be received from Stripe webhooks
 */
export type StripePaymentStatus = 
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'checkout.session.completed';

/**
 * Webhook handler stub
 * 
 * This should be implemented as a Cloudflare Worker or Firebase Function.
 * Example webhook endpoint implementation:
 * 
 * ```typescript
 * // In Cloudflare Worker or Firebase Function
 * import Stripe from 'stripe';
 * 
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
 * 
 * export async function handleWebhook(request: Request) {
 *   const sig = request.headers.get('stripe-signature');
 *   const body = await request.text();
 *   
 *   let event: Stripe.Event;
 *   
 *   try {
 *     event = stripe.webhooks.constructEvent(
 *       body,
 *       sig!,
 *       process.env.STRIPE_WEBHOOK_SECRET
 *     );
 *   } catch (err) {
 *     return new Response('Webhook signature verification failed', { status: 400 });
 *   }
 *   
 *   switch (event.type) {
 *     case 'checkout.session.completed':
 *       // Update payment status in Firestore
 *       break;
 *     case 'payment_intent.succeeded':
 *       // Record successful payment
 *       break;
 *     case 'payment_intent.payment_failed':
 *       // Handle failed payment
 *       break;
 *   }
 *   
 *   return new Response('OK');
 * }
 * ```
 */

/**
 * Stripe configuration information
 * Used in admin settings to display Stripe setup status
 */
export interface StripeConfig {
  isConfigured: boolean;
  publishableKey: string | undefined;
  webhookEndpoint: string;
  requiredEnvVars: string[];
}

export function getStripeConfig(): StripeConfig {
  return {
    isConfigured: isStripeConfigured(),
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    webhookEndpoint: '/api/stripe/webhook',
    requiredEnvVars: [
      'VITE_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_SECRET_KEY (backend only)',
      'STRIPE_WEBHOOK_SECRET (backend only)',
    ],
  };
}
