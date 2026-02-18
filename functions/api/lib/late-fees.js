/**
 * Late Fee Engine
 * 
 * Compute-on-demand + idempotent posting (Option A)
 * 
 * Policy:
 * - Late fees start on the 5th day of the month
 * - Initial late charge: $25
 * - Additional: $10 per day until rent is satisfied (balance <= 0)
 * - Late fees stop accruing immediately once statement is paid
 * 
 * Idempotency:
 * - Initial late fee entry ID: late_init_{YYYY-MM}
 * - Daily late fee entry IDs: late_daily_{YYYY-MM-DD}
 * - Refreshing 50 times must NOT create duplicate fees
 */

import {
  getDocument,
  setDocument,
  updateDocument,
  getSubcollection,
  documentExists,
} from './firestore-rest.js';

const INITIAL_LATE_FEE_CENTS = 2500;  // $25
const DAILY_LATE_FEE_CENTS = 1000;    // $10

/**
 * Apply late fees idempotently to a rent statement
 * 
 * Called every time a statement is fetched for display.
 * 
 * @param {string} projectId - Firebase project ID
 * @param {string} statementId - Firestore document ID for the statement
 * @param {string} todayStr - Today's date as YYYY-MM-DD
 * @returns {Object} Updated statement data
 */
export async function applyLateFeesIfNeeded(projectId, statementId, todayStr) {
  // 1. Fetch the statement
  const statement = await getDocument(projectId, 'rentStatements', statementId);
  if (!statement) {
    throw new Error('Statement not found');
  }

  // 2. If already paid/void or balance <= 0, skip
  if (statement.status === 'paid' || statement.status === 'void') {
    return statement;
  }
  if (statement.balanceCents <= 0) {
    return statement;
  }
  if (statement.lateFeesEnabled === false) {
    return statement;
  }

  const month = statement.month; // YYYY-MM
  const lateStartDate = `${month}-05`; // Late fees begin on the 5th

  // 3. If today is before the late start date, nothing to do
  if (todayStr < lateStartDate) {
    return statement;
  }

  // 4. Get existing ledger entries to compute current state
  const ledgerEntries = await getSubcollection(
    projectId,
    `rentStatements/${statementId}`,
    'ledger'
  );

  // Build set of existing entry IDs for idempotency check
  const existingIds = new Set(ledgerEntries.map(e => e.id));

  // Calculate current balance
  let runningBalance = ledgerEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);

  // Track what we post this run
  const newEntries = [];

  // 5. Post initial late fee if missing and balance > 0
  const initEntryId = `late_init_${month}`;
  if (!existingIds.has(initEntryId) && runningBalance > 0) {
    const entry = {
      type: 'fee',
      label: 'Late Fee (Initial)',
      amountCents: INITIAL_LATE_FEE_CENTS,
      effectiveDate: lateStartDate,
      notes: `Initial late fee for ${month}`,
      createdByUid: 'system',
    };
    await setDocument(
      projectId,
      `rentStatements/${statementId}/ledger`,
      initEntryId,
      { ...entry, createdAt: new Date().toISOString() }
    );
    runningBalance += INITIAL_LATE_FEE_CENTS;
    newEntries.push(initEntryId);
    existingIds.add(initEntryId);
  }

  // 6. Post daily late fees from (lateStartDate + 1 day) through today
  //    Convention: daily fees apply from the 6th onward (day after initial)
  const startDaily = incrementDate(lateStartDate);
  let currentDate = startDaily;

  while (currentDate <= todayStr && runningBalance > 0) {
    const dailyEntryId = `late_daily_${currentDate}`;
    
    if (!existingIds.has(dailyEntryId)) {
      const entry = {
        type: 'fee',
        label: `Late Fee (Daily - ${currentDate})`,
        amountCents: DAILY_LATE_FEE_CENTS,
        effectiveDate: currentDate,
        notes: `Daily late fee for ${currentDate}`,
        createdByUid: 'system',
      };
      await setDocument(
        projectId,
        `rentStatements/${statementId}/ledger`,
        dailyEntryId,
        { ...entry, createdAt: new Date().toISOString() }
      );
      runningBalance += DAILY_LATE_FEE_CENTS;
      newEntries.push(dailyEntryId);
      existingIds.add(dailyEntryId);
    }

    currentDate = incrementDate(currentDate);
  }

  // 7. Recompute balance from ALL entries (including newly posted)
  if (newEntries.length > 0) {
    // Refetch all ledger entries for accurate balance
    const allEntries = await getSubcollection(
      projectId,
      `rentStatements/${statementId}`,
      'ledger'
    );
    const newBalance = allEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);

    const updateData = {
      balanceCents: newBalance,
      lateFeesThroughDate: todayStr,
      updatedAt: new Date().toISOString(),
    };

    if (newBalance <= 0) {
      updateData.status = 'paid';
      updateData.paidAt = new Date().toISOString();
    }

    await updateDocument(projectId, 'rentStatements', statementId, updateData);
    
    return {
      ...statement,
      ...updateData,
    };
  }

  return statement;
}

/**
 * Increment a YYYY-MM-DD date string by one day
 */
function incrementDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}
