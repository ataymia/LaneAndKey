import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type {
  Property,
  Lead,
  Tour,
  Application,
  Household,
  Tenant,
  Lease,
  Payment,
  Invoice,
  MaintenanceTicket,
  Message,
  Conversation,
  Alert,
  DocumentTemplate,
  AdminSettings,
  UserProfile,
} from '../../types';

// Helper to convert Firestore timestamps to Date objects
function convertTimestamps<T extends DocumentData>(data: DocumentData): T {
  const converted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    } else if (Array.isArray(value)) {
      converted[key] = value.map(item => 
        item instanceof Timestamp ? item.toDate() : 
        (typeof item === 'object' && item !== null ? convertTimestamps(item) : item)
      );
    } else if (typeof value === 'object' && value !== null) {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  
  return converted as T;
}

// Generic CRUD operations
async function createDocument<T extends { id?: string }>(
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

async function getDocument<T extends DocumentData>(
  collectionName: string,
  docId: string
): Promise<(T & { id: string }) | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      ...convertTimestamps<T>(docSnap.data() as T),
      id: docSnap.id,
    };
  }
  
  return null;
}

async function getDocuments<T extends DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<(T & { id: string })[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(docSnap => ({
    ...convertTimestamps<T>(docSnap.data() as T),
    id: docSnap.id,
  }));
}

async function updateDocument<T>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

// ==================== PROPERTIES ====================
export const propertyService = {
  create: (data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Property>('properties', data),
  
  get: (id: string) => getDocument<Property>('properties', id),
  
  getAll: () => getDocuments<Property>('properties', orderBy('createdAt', 'desc')),
  
  getByStatus: (status: Property['marketStatus']) =>
    getDocuments<Property>('properties', where('marketStatus', '==', status)),
  
  update: (id: string, data: Partial<Property>) =>
    updateDocument<Property>('properties', id, data),
  
  delete: (id: string) => deleteDocument('properties', id),
};

// ==================== LEADS ====================
export const leadService = {
  create: (data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Lead>('leads', data),
  
  get: (id: string) => getDocument<Lead>('leads', id),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Lead>('leads', where('propertyId', '==', propertyId), orderBy('createdAt', 'desc')),
  
  getByStatus: (status: Lead['status']) =>
    getDocuments<Lead>('leads', where('status', '==', status)),
  
  update: (id: string, data: Partial<Lead>) =>
    updateDocument<Lead>('leads', id, data),
  
  delete: (id: string) => deleteDocument('leads', id),
};

// ==================== TOURS ====================
export const tourService = {
  create: (data: Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Tour>('tours', data),
  
  get: (id: string) => getDocument<Tour>('tours', id),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Tour>('tours', where('propertyId', '==', propertyId)),
  
  getByLead: (leadId: string) =>
    getDocuments<Tour>('tours', where('leadId', '==', leadId)),
  
  update: (id: string, data: Partial<Tour>) =>
    updateDocument<Tour>('tours', id, data),
  
  delete: (id: string) => deleteDocument('tours', id),
};

// ==================== APPLICATIONS ====================
export const applicationService = {
  create: (data: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Application>('applications', data),
  
  get: (id: string) => getDocument<Application>('applications', id),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Application>('applications', where('propertyId', '==', propertyId)),
  
  getByApplicant: (applicantId: string) =>
    getDocuments<Application>('applications', where('primaryApplicantId', '==', applicantId)),
  
  getByStatus: (status: Application['status']) =>
    getDocuments<Application>('applications', where('status', '==', status)),
  
  update: (id: string, data: Partial<Application>) =>
    updateDocument<Application>('applications', id, data),
  
  delete: (id: string) => deleteDocument('applications', id),
};

// ==================== HOUSEHOLDS ====================
export const householdService = {
  create: async (data: Omit<Household, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'households'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
  
  get: (id: string) => getDocument<Household>('households', id),
  
  getByPrimaryApplicant: (applicantId: string) =>
    getDocuments<Household>('households', where('primaryApplicantId', '==', applicantId)),
  
  update: async (id: string, data: Partial<Household>) => {
    const docRef = doc(db, 'households', id);
    await updateDoc(docRef, data);
  },
};

// ==================== TENANTS ====================
export const tenantService = {
  create: (data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Tenant>('tenants', data),
  
  get: (id: string) => getDocument<Tenant>('tenants', id),
  
  getByUser: (userId: string) =>
    getDocuments<Tenant>('tenants', where('userId', '==', userId), limit(1)),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Tenant>('tenants', where('propertyId', '==', propertyId)),
  
  update: (id: string, data: Partial<Tenant>) =>
    updateDocument<Tenant>('tenants', id, data),
  
  delete: (id: string) => deleteDocument('tenants', id),
};

// ==================== LEASES ====================
export const leaseService = {
  create: (data: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Lease>('leases', data),
  
  get: (id: string) => getDocument<Lease>('leases', id),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Lease>('leases', where('propertyId', '==', propertyId)),
  
  getByTenant: (tenantId: string) =>
    getDocuments<Lease>('leases', where('tenantIds', 'array-contains', tenantId)),
  
  getActive: () =>
    getDocuments<Lease>('leases', where('status', '==', 'active')),
  
  update: (id: string, data: Partial<Lease>) =>
    updateDocument<Lease>('leases', id, data),
  
  delete: (id: string) => deleteDocument('leases', id),
};

// ==================== PAYMENTS ====================
export const paymentService = {
  create: (data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Payment>('payments', data),
  
  get: (id: string) => getDocument<Payment>('payments', id),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Payment>('payments', where('propertyId', '==', propertyId), orderBy('createdAt', 'desc')),
  
  getByTenant: (tenantId: string) =>
    getDocuments<Payment>('payments', where('tenantId', '==', tenantId), orderBy('createdAt', 'desc')),
  
  getByTenantUid: (tenantUid: string) =>
    getDocuments<Payment>('payments', where('tenantUid', '==', tenantUid), orderBy('createdAt', 'desc')),
  
  getByLease: (leaseId: string) =>
    getDocuments<Payment>('payments', where('leaseId', '==', leaseId)),
  
  getByStatus: (status: Payment['status']) =>
    getDocuments<Payment>('payments', where('status', '==', status)),
  
  getByStripeSessionId: (sessionId: string) =>
    getDocuments<Payment>('payments', where('stripeSessionId', '==', sessionId), limit(1)),
  
  update: (id: string, data: Partial<Payment>) =>
    updateDocument<Payment>('payments', id, data),
  
  delete: (id: string) => deleteDocument('payments', id),
};

// ==================== INVOICES ====================
export const invoiceService = {
  create: (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<Invoice>('invoices', data),
  
  get: (id: string) => getDocument<Invoice>('invoices', id),
  
  getByTenant: (tenantId: string) =>
    getDocuments<Invoice>('invoices', where('tenantId', '==', tenantId), orderBy('dueDate', 'desc')),
  
  getByTenantUid: (tenantUid: string) =>
    getDocuments<Invoice>('invoices', where('tenantUid', '==', tenantUid), orderBy('dueDate', 'desc')),
  
  getByLease: (leaseId: string) =>
    getDocuments<Invoice>('invoices', where('leaseId', '==', leaseId), orderBy('dueDate', 'desc')),
  
  getByProperty: (propertyId: string) =>
    getDocuments<Invoice>('invoices', where('propertyId', '==', propertyId), orderBy('dueDate', 'desc')),
  
  getByStatus: (status: Invoice['status']) =>
    getDocuments<Invoice>('invoices', where('status', '==', status), orderBy('dueDate', 'desc')),
  
  getDue: (tenantUid: string) =>
    getDocuments<Invoice>('invoices', 
      where('tenantUid', '==', tenantUid), 
      where('status', 'in', ['due', 'overdue']),
      orderBy('dueDate', 'asc')
    ),
  
  getAll: () =>
    getDocuments<Invoice>('invoices', orderBy('dueDate', 'desc')),
  
  update: (id: string, data: Partial<Invoice>) =>
    updateDocument<Invoice>('invoices', id, data),
  
  markPaid: async (id: string, stripeSessionId?: string, stripePaymentIntentId?: string) => {
    await updateDocument<Invoice>('invoices', id, {
      status: 'paid',
      paidAt: new Date(),
      ...(stripeSessionId && { stripeSessionId }),
      ...(stripePaymentIntentId && { stripePaymentIntentId }),
    });
  },
  
  delete: (id: string) => deleteDocument('invoices', id),
};

// ==================== MAINTENANCE ====================
export const maintenanceService = {
  create: (data: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<MaintenanceTicket>('maintenance', data),
  
  get: (id: string) => getDocument<MaintenanceTicket>('maintenance', id),
  
  getAll: () =>
    getDocuments<MaintenanceTicket>('maintenance', orderBy('createdAt', 'desc')),
  
  getByProperty: (propertyId: string) =>
    getDocuments<MaintenanceTicket>('maintenance', where('propertyId', '==', propertyId)),
  
  getByTenant: (tenantId: string) =>
    getDocuments<MaintenanceTicket>('maintenance', where('tenantId', '==', tenantId)),
  
  getByStatus: (status: MaintenanceTicket['status']) =>
    getDocuments<MaintenanceTicket>('maintenance', where('status', '==', status)),
  
  update: (id: string, data: Partial<MaintenanceTicket>) =>
    updateDocument<MaintenanceTicket>('maintenance', id, data),
  
  delete: (id: string) => deleteDocument('maintenance', id),
  
  addComment: async (ticketId: string, comment: MaintenanceTicket['comments'][0]) => {
    const ticket = await getDocument<MaintenanceTicket>('maintenance', ticketId);
    if (ticket) {
      const comments = [...(ticket.comments || []), comment];
      await updateDocument<MaintenanceTicket>('maintenance', ticketId, { comments });
    }
  },
};

// ==================== MESSAGES ====================
export const messageService = {
  create: async (data: Omit<Message, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'messages'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
  
  getByConversation: (conversationId: string) =>
    getDocuments<Message>('messages', 
      where('conversationId', '==', conversationId), 
      orderBy('createdAt', 'asc')
    ),
  
  markAsRead: (id: string) =>
    updateDoc(doc(db, 'messages', id), { read: true }),
};

export const conversationService = {
  create: async (data: Omit<Conversation, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'conversations'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
  
  get: (id: string) => getDocument<Conversation>('conversations', id),
  
  getByParticipant: (userId: string) =>
    getDocuments<Conversation>('conversations', 
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    ),
  
  update: (id: string, data: Partial<Conversation>) =>
    updateDoc(doc(db, 'conversations', id), data),
};

// ==================== ALERTS ====================
export const alertService = {
  create: async (data: Omit<Alert, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'alerts'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
  
  getByUser: (userId: string) =>
    getDocuments<Alert>('alerts', 
      where('userId', '==', userId),
      where('archived', '==', false),
      orderBy('createdAt', 'desc')
    ),
  
  getUnread: (userId: string) =>
    getDocuments<Alert>('alerts', 
      where('userId', '==', userId),
      where('read', '==', false)
    ),
  
  markAsRead: (id: string) =>
    updateDoc(doc(db, 'alerts', id), { read: true }),
  
  archive: (id: string) =>
    updateDoc(doc(db, 'alerts', id), { archived: true }),
};

// ==================== DOCUMENTS ====================
export const documentService = {
  create: (data: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    createDocument<DocumentTemplate>('documents', data),
  
  get: (id: string) => getDocument<DocumentTemplate>('documents', id),
  
  getTemplates: () =>
    getDocuments<DocumentTemplate>('documents', where('isTemplate', '==', true)),
  
  getByTenant: (tenantId: string) =>
    getDocuments<DocumentTemplate>('documents', where('tenantId', '==', tenantId)),
  
  update: (id: string, data: Partial<DocumentTemplate>) =>
    updateDocument<DocumentTemplate>('documents', id, data),
  
  delete: (id: string) => deleteDocument('documents', id),
};

// ==================== ADMIN SETTINGS ====================
export const adminSettingsService = {
  get: async (): Promise<AdminSettings | null> => {
    const docRef = doc(db, 'settings', 'admin');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...convertTimestamps<DocumentData>(data),
        id: docSnap.id,
      } as unknown as AdminSettings;
    }
    
    return null;
  },
  
  update: async (data: Partial<AdminSettings>): Promise<void> => {
    const docRef = doc(db, 'settings', 'admin');
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },
  
  initialize: async (data: Omit<AdminSettings, 'id' | 'updatedAt'>): Promise<void> => {
    const docRef = doc(db, 'settings', 'admin');
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },
};

// ==================== USERS ====================
export const userService = {
  get: (uid: string) => getDocument<UserProfile>('users', uid),
  
  getAll: () => getDocuments<UserProfile>('users'),
  
  getByRole: (role: UserProfile['role']) =>
    getDocuments<UserProfile>('users', where('role', '==', role)),
  
  update: (uid: string, data: Partial<UserProfile>) =>
    updateDocument<UserProfile>('users', uid, data),
};
