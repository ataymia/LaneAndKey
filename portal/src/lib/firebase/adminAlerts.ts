/**
 * Admin Alert Helper
 *
 * Creates alert records targeted at admin users so they appear in the
 * admin Alerts feed. Uses a special userId value 'ADMIN' that the
 * admin AlertsPage queries for.
 */
import { alertService, userService } from './firestore';
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
 * queries for this value in addition to the admin's own uid.
 */
export async function createAdminAlert(opts: AdminAlertOpts): Promise<void> {
  try {
    // Get all admin users and create an alert for each
    const admins = await userService.getByRole('admin');
    await Promise.allSettled(
      admins.map(admin =>
        alertService.create({
          userId: admin.uid,
          type: opts.type,
          title: opts.title,
          message: opts.message,
          relatedId: opts.relatedId,
          relatedType: opts.relatedType,
          read: false,
          archived: false,
        })
      )
    );
  } catch (err) {
    console.error('Failed to create admin alert:', err);
  }
}
