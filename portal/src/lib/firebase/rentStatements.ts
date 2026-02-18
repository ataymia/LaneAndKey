/**
 * Rent Statement & Ledger Firestore Services
 * 
 * Data model:
 *   rentStatements/{statementId}
 *   rentStatements/{statementId}/ledger/{entryId}
 * 
 * Balance rule: balanceCents = SUM(ledger.amountCents)
 * A statement is paid when balanceCents <= 0
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import type { RentStatement, LedgerEntry, PortalDocument, DocumentEvent } from '../../types';

// ─── Helpers ───────────────────────────────────────────────

function convertTimestamps<T extends DocumentData>(data: DocumentData): T {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted as T;
}

// ─── Rent Statements ──────────────────────────────────────

export const rentStatementService = {
  /** Get a single statement by ID */
  async get(statementId: string): Promise<RentStatement | null> {
    const snap = await getDoc(doc(db, 'rentStatements', statementId));
    if (!snap.exists()) return null;
    return { ...convertTimestamps<RentStatement>(snap.data()), id: snap.id };
  },

  /** Get all statements for a tenant, ordered newest-first */
  async getByTenantUid(tenantUid: string): Promise<RentStatement[]> {
    const q = query(
      collection(db, 'rentStatements'),
      where('tenantUid', '==', tenantUid),
      orderBy('month', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<RentStatement>(d.data()), id: d.id }));
  },

  /** Get all statements for a lease */
  async getByLeaseId(leaseId: string): Promise<RentStatement[]> {
    const q = query(
      collection(db, 'rentStatements'),
      where('leaseId', '==', leaseId),
      orderBy('month', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<RentStatement>(d.data()), id: d.id }));
  },

  /** Get all statements (admin) */
  async getAll(): Promise<RentStatement[]> {
    const q = query(
      collection(db, 'rentStatements'),
      orderBy('month', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<RentStatement>(d.data()), id: d.id }));
  },

  /** Create a new statement */
  async create(data: Omit<RentStatement, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'rentStatements'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /** Update statement fields */
  async update(statementId: string, data: Partial<RentStatement>): Promise<void> {
    await updateDoc(doc(db, 'rentStatements', statementId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },
};

// ─── Ledger Entries (subcollection) ────────────────────────

export const ledgerService = {
  /** Get all ledger entries for a statement, ordered by effectiveDate */
  async getByStatement(statementId: string): Promise<LedgerEntry[]> {
    const q = query(
      collection(db, 'rentStatements', statementId, 'ledger'),
      orderBy('effectiveDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<LedgerEntry>(d.data()), id: d.id }));
  },

  /** Create a ledger entry with auto-generated ID */
  async create(statementId: string, data: Omit<LedgerEntry, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'rentStatements', statementId, 'ledger'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /** Create a ledger entry with a deterministic ID (for idempotency) */
  async createWithId(statementId: string, entryId: string, data: Omit<LedgerEntry, 'id' | 'createdAt'>): Promise<void> {
    const docRef = doc(db, 'rentStatements', statementId, 'ledger', entryId);
    // setDoc with merge won't overwrite if it already exists  
    // We use a check: only write if doc doesn't exist
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  },

  /** Recompute balance from all ledger entries */
  async recomputeBalance(statementId: string): Promise<number> {
    const entries = await this.getByStatement(statementId);
    const balance = entries.reduce((sum, e) => sum + e.amountCents, 0);
    
    const updateData: Partial<RentStatement> = { balanceCents: balance };
    if (balance <= 0) {
      updateData.status = 'paid';
      updateData.paidAt = new Date();
    }
    
    await rentStatementService.update(statementId, updateData);
    return balance;
  },
};

// ─── Portal Documents ──────────────────────────────────────

export const portalDocumentService = {
  /** Get all documents for a user */
  async getByOwner(ownerUid: string): Promise<PortalDocument[]> {
    const q = query(
      collection(db, 'portalDocuments'),
      where('ownerUid', '==', ownerUid),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<PortalDocument>(d.data() as PortalDocument), id: d.id }));
  },

  /** Get all documents (admin) */
  async getAll(): Promise<PortalDocument[]> {
    const q = query(collection(db, 'portalDocuments'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...convertTimestamps<PortalDocument>(d.data() as PortalDocument), id: d.id }));
  },

  /** Get single document */
  async get(docId: string): Promise<PortalDocument | null> {
    const snap = await getDoc(doc(db, 'portalDocuments', docId));
    if (!snap.exists()) return null;
    return { ...convertTimestamps<PortalDocument>(snap.data() as PortalDocument), id: snap.id };
  },

  /** Create a portal document record */
  async create(data: Omit<PortalDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'portalDocuments'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /** Update document */
  async update(docId: string, data: Partial<PortalDocument>): Promise<void> {
    await updateDoc(doc(db, 'portalDocuments', docId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /** Add an audit event */
  async addEvent(docId: string, event: Omit<DocumentEvent, 'id'>): Promise<void> {
    await addDoc(collection(db, 'portalDocuments', docId, 'events'), {
      ...event,
      timestamp: serverTimestamp(),
    });
  },
};
