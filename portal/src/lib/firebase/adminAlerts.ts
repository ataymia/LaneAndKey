/**
 * Admin Alert Helper
 *
 * Creates alert records with a sentinel userId '__admin__' so they
 * appear in the admin Alerts feed without needing to query the users
 * collection (which tenants cannot read).
 */
import { alertService } from './firestore';
import type { AlertType } from '../../types';

interface AdminAlertOpts {
  type: AlertType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: 'application' | 'lead' | 'maintenance' | 'payment' | 'lease';
}

/**
 * Create an alert visible to all admin users.
 * Uses userId = '__admin__' as a sentinel value; the admin AlertsPage
 * reads all alerts via getAll() so these are always included.
 */
export async function createAdminAlert(opts: AdminAlertOpts): Promise<void> {
  try {
    await alertService.create({
      userId: '__admin__',
      type: opts.type,
      title: opts.title,
      message: opts.message,
      relatedId: opts.relatedId,
      relatedType: opts.relatedType,
      read: false,
      archived: false,
    });
  } catch (err) {
    console.error('Failed to create admin alert:', err);
  }
}
