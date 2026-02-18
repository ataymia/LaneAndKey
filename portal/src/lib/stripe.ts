/**
 * Stripe Integration Module
 * 
 * This module provides integration with Stripe payment processing.
 * 
 * Setup:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your publishable key from the Stripe Dashboard
 * 3. Set the VITE_STRIPE_PUBLISHABLE_KEY environment variable
 * 4. Backend endpoints are in /functions/api/stripe/
 * 5. Configure webhooks in Stripe Dashboard to point to /api/stripe/webhook
 * 
 * Required Environment Variables:
 * - VITE_STRIPE_PUBLISHABLE_KEY (client-side)
 * - STRIPE_SECRET_KEY (server-side only)
 * - STRIPE_WEBHOOK_SECRET (server-side only)
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { auth } from './firebase/config';

// Stripe publishable key from environment variables
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// API base URL for Stripe endpoints
const API_BASE = '/api/stripe';

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
 * Get the current user's Firebase ID token for API authentication
 */
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be logged in to make payments');
  }
  return await user.getIdToken();
}

/**
 * Payment type options
 */
export type PaymentType = 'rent' | 'deposit' | 'fee' | 'late_fee' | 'application_fee' | 'other';

/**
 * Create a checkout session request
 */
export interface CreateCheckoutSessionRequest {
  type: PaymentType;
  amount?: number; // Amount in cents (alias for amountCents)
  amountCents?: number; // Amount in cents
  description?: string;
  statementId?: string; // For statement-based rent payments
  invoiceId?: string;
  leaseId?: string;
  metadata?: Record<string, string>;
}

/**
 * Checkout session response
 */
export interface CheckoutSessionResponse {
  url: string;
  sessionId: string;
}

/**
 * Create a Stripe Checkout session and redirect to payment
 * 
 * This calls the server-side endpoint which:
 * 1. Authenticates the user via Firebase token
 * 2. Creates a Stripe Checkout Session
 * 3. Returns the checkout URL
 * 
 * @param params - Payment parameters
 * @returns Checkout session data with URL for redirect
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionRequest
): Promise<CheckoutSessionResponse> {
  const idToken = await getIdToken();
  
  const response = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Payment failed' }));
    throw new Error(error.error || 'Failed to create checkout session');
  }
  
  return await response.json();
}

/**
 * Redirect to Stripe Checkout
 * 
 * @param params - Payment parameters
 */
export async function redirectToCheckout(params: CreateCheckoutSessionRequest): Promise<void> {
  const session = await createCheckoutSession(params);
  
  // Redirect to Stripe's hosted checkout page
  window.location.href = session.url;
}

/**
 * Pay rent - convenience function
 * 
 * @param amount - Amount in cents
 * @param leaseId - Lease ID
 * @param invoiceId - Invoice ID (optional)
 */
export async function payRent(
  amount: number,
  leaseId: string,
  invoiceId?: string
): Promise<void> {
  await redirectToCheckout({
    type: 'rent',
    amount,
    description: 'Rent Payment',
    leaseId,
    invoiceId,
  });
}

/**
 * Pay security deposit - convenience function
 * 
 * @param amount - Amount in cents
 * @param leaseId - Lease ID
 * @param invoiceId - Invoice ID (optional)
 */
export async function payDeposit(
  amount: number,
  leaseId: string,
  invoiceId?: string
): Promise<void> {
  await redirectToCheckout({
    type: 'deposit',
    amount,
    description: 'Security Deposit',
    leaseId,
    invoiceId,
  });
}

/**
 * Pay a fee (late fee, application fee, etc.)
 * 
 * @param amount - Amount in cents
 * @param feeType - Type of fee
 * @param description - Fee description
 * @param invoiceId - Invoice ID (optional)
 */
export async function payFee(
  amount: number,
  feeType: 'fee' | 'late_fee' | 'application_fee',
  description: string,
  invoiceId?: string
): Promise<void> {
  await redirectToCheckout({
    type: feeType,
    amount,
    description,
    invoiceId,
  });
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
