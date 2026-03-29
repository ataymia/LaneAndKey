// User Roles
export type UserRole = 'admin' | 'applicant' | 'tenant';

// User Profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  currentLeaseId?: string;
  currentPropertyId?: string;
  preferredContactMethod?: 'email' | 'phone' | 'sms';
  emergencyContact?: EmergencyContact;
  emergencyContacts?: EmergencyContact[];
  notificationPreferences?: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  rentReminders: boolean;
  maintenanceUpdates: boolean;
  leaseAlerts: boolean;
}

// Property
export interface Property {
  id: string;
  // Basic Info
  address: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  
  // Financials
  monthlyRent: number;
  securityDeposit: number;
  otherFees?: Fee[];
  applicationFee?: number;
  
  // Details
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  availabilityDate?: Date;
  propertyType: PropertyType;
  yearBuilt: number;
  lotSize?: number;
  stories?: number;
  
  // Features
  parking?: ParkingDetails;
  laundry?: LaundryOption;
  appliances?: string[];
  heatingType?: string;
  coolingType?: string;
  flooringTypes?: string[];
  
  // Policies
  petPolicy?: PetPolicy;
  smokingAllowed: boolean;
  maxOccupancy?: number;
  
  // Utilities
  utilitiesIncluded?: string[];
  utilitiesTenantResponsibility?: string[];
  
  // Requirements
  incomeRequirement?: number; // Multiplier (e.g., 3x rent)
  
  // Descriptions
  neighborhoodDescription?: string;
  nearbyAmenities?: string;
  schoolDistrict?: string;
  internalNotes?: string;
  publicDescription?: string;
  
  // Media
  photos: string[];
  coverPhotoIndex: number;
  
  // Status
  marketStatus: 'on' | 'off';
  occupancyStatus: 'vacant' | 'occupied' | 'applications_in_progress';
  acceptingApplications: boolean;
  
  // Current tenant/lease linkage (set by assign endpoint)
  currentLeaseId?: string;
  currentTenantUid?: string;
  
  // Coordinates for map
  lat?: number;
  lng?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type PropertyType = 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'apartment';

export interface Fee {
  name: string;
  amount: number;
  frequency: 'one-time' | 'monthly' | 'annual';
}

export interface ParkingDetails {
  type: 'garage' | 'carport' | 'driveway' | 'street' | 'lot';
  spaces: number;
}

export type LaundryOption = 'in-unit' | 'on-site' | 'none';

export interface PetPolicy {
  allowed: boolean;
  depositPerPet?: number;
  monthlyRentPerPet?: number;
  restrictions?: string;
}

// Lead
export interface Lead {
  id: string;
  propertyId: string;
  source: LeadSource;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: LeadStatus;
  notes?: string;
  reminders?: Reminder[];
  createdAt: Date;
  updatedAt: Date;
}

export type LeadSource = 'website' | 'zillow' | 'referral' | 'walk-in' | 'phone' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'tour_scheduled' | 'applied' | 'closed';

export interface Reminder {
  id: string;
  date: Date;
  note: string;
  completed: boolean;
}

// Tour
export interface Tour {
  id: string;
  leadId: string;
  propertyId: string;
  scheduledDate: Date;
  status: TourStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TourStatus = 'pending' | 'approved' | 'declined' | 'rescheduled' | 'completed' | 'no_show';

// Application
export interface Application {
  id: string;
  propertyId: string;
  householdId: string;
  primaryApplicantId: string;
  coApplicantIds: string[];
  desiredMoveInDate?: Date;
  status: ApplicationStatus;
  documents: ApplicationDocument[];
  notes?: string;
  timeline: TimelineEvent[];
  applicantSnapshot?: ApplicantProfile;
  submittedAt?: Date;
  withdrawnAt?: Date;
  deniedAt?: Date;
  approvedAt?: Date;
  approvedByUid?: string;
  leaseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationStatus = 'new' | 'in_review' | 'approved' | 'declined' | 'withdrawn' | 'archived';

export interface ApplicantProfile {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  monthlyIncome: number;
  employer: string;
  employerPhone?: string;
  currentAddress?: string;
  moveInDate?: string;
  additionalNotes?: string;
}

export interface ApplicationDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Date;
}

export interface TimelineEvent {
  id: string;
  event: string;
  description?: string;
  date: Date;
  userId?: string;
}

// Household (for grouping applicants)
export interface Household {
  id: string;
  primaryApplicantId: string;
  memberIds: string[];
  applicationId?: string;
  members: HouseholdMember[];
  pets?: Pet[];
  vehicles?: Vehicle[];
  createdAt: Date;
}

export interface HouseholdMember {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  employmentInfo?: EmploymentInfo;
  monthlyIncome?: number;
  relationship: 'primary' | 'co-applicant' | 'occupant';
}

export interface EmploymentInfo {
  employer: string;
  position: string;
  monthlyIncome: number;
  startDate: Date;
}

export interface Pet {
  type: string;
  breed: string;
  weight?: number;
  name?: string;
}

export interface Vehicle {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate?: string;
}

// Tenant
export interface Tenant {
  id: string;
  userId: string;
  propertyId: string;
  currentLeaseId?: string;
  pastLeaseIds: string[];
  documents: TenantDocument[];
  balance: number;
  applicationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantDocument {
  id: string;
  name: string;
  type: TenantDocumentType;
  url: string;
  required: boolean;
  uploadedAt?: Date;
}

export type TenantDocumentType = 'lease' | 'insurance' | 'id' | 'notice' | 'infraction' | 'other';

// Lease
export interface Lease {
  id: string;
  propertyId: string;
  tenantUid?: string;
  tenantIds: string[];
  startDate: Date;
  endDate: Date | null;
  monthlyRent: number;
  securityDeposit: number;
  rentAmountCents?: number;
  depositAmountCents?: number;
  rentDueDay: number;
  gracePeriodDays: number;
  includedUtilities?: string[];
  includedServices?: string[];
  attachments: LeaseAttachment[];
  notes?: string;
  status: LeaseStatus;
  onboardingStatus?: 'not_started' | 'in_progress' | 'complete';
  onboardingChecklist?: {
    leaseSigned: boolean;
    contactConfirmed: boolean;
    paymentReady: boolean;
  };
  leaseSignedAt?: Date | null;
  occupants?: LeaseOccupant[];
  createdByUid?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaseOccupant {
  fullName: string;
  email?: string;
  phone?: string;
  type: 'primary' | 'secondary';
  notes?: string;
}

export type LeaseStatus = 'draft' | 'pending' | 'active' | 'ended' | 'expired' | 'terminated';

export interface LeaseAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Date;
}

// ==================== LEASE TEMPLATES ====================

export type LeaseTemplateStatus = 'draft' | 'published' | 'archived';
export type LeaseTemplateFormat = 'html' | 'markdown';
export type TemplateFieldType = 'text' | 'date' | 'money' | 'list' | 'boolean';
export type SignatureFieldType = 'signature' | 'date' | 'initial' | 'check' | 'text';
export type SignatureFieldRole = 'tenant' | 'landlord';
export type FieldOwnerRole = 'admin' | 'tenant' | 'landlord';
export type FieldPhase = 'generation' | 'signing' | 'move_in_inspection' | 'any';
export type LeaseSigningStatus = 'not_generated' | 'generated' | 'sent' | 'viewed' | 'signed' | 'voided';
export type InspectionStatus = 'not_started' | 'in_progress' | 'submitted';

export interface TemplateFieldDef {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  ownerRole?: FieldOwnerRole;       // defaults to 'admin' for backward compat
  phase?: FieldPhase;               // defaults to 'generation'
  default?: string;
}

export interface SignatureFieldDef {
  id: string;
  type: SignatureFieldType;
  role: SignatureFieldRole;
  anchor: string;           // e.g. [[SIGNATURE:tenant]]
  required: boolean;
  displayLabel: string;     // e.g. "Tenant Signature"
  ownerRole?: FieldOwnerRole;
  phase?: FieldPhase;
}

export interface LeaseTemplate {
  id: string;
  name: string;
  version: string;               // semver e.g. "1.0.0"
  status: LeaseTemplateStatus;
  templateFormat: LeaseTemplateFormat;
  templateBody: string;          // HTML/markdown with placeholders + anchors
  fieldSchema: TemplateFieldDef[];
  signatureSchema: SignatureFieldDef[];
  createdByUid: string;
  createdAt: Date;
  updatedAt: Date;
}

// Signing fields stored on the generated lease
export interface LeaseSignatureFieldValue {
  fieldId: string;               // matches signatureSchema[].id
  type: SignatureFieldType;
  role: SignatureFieldRole;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  displayLabel: string;
  ownerRole?: FieldOwnerRole;
  phase?: FieldPhase;
  value?: string;                // date string or typed name
  signedImagePath?: string;      // Storage path for signature/initial image
  completedAt?: Date;
}

// Move-in Inspection response (stored per field)
export interface InspectionFieldResponse {
  fieldId: string;
  type: 'check' | 'text' | 'date';
  label: string;
  value: string;                 // 'true'/'false' for check, text for text/date
  completedAt: Date;
}

// Move-in Inspection record (stored at leases/{leaseId}/inspection)
export interface MoveInInspection {
  id: string;
  leaseId: string;
  tenantUid: string;
  propertyId: string;
  status: InspectionStatus;
  responses: InspectionFieldResponse[];
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Generated lease document tracking (extends portalDocuments)
export interface GeneratedLease {
  id: string;
  leaseId: string;
  templateId: string;
  templateVersion: string;
  tenantUid: string;
  propertyId: string;
  generatedByUid: string;
  generatedAt: Date;
  fieldValues: Record<string, string>; // template variable values used
  signingStatus: LeaseSigningStatus;
  signatureFields: LeaseSignatureFieldValue[];
  pdfOriginalPath: string;       // Storage path
  pdfSignedPath?: string;        // Storage path after signing
  signedAt?: Date;
  portalDocumentId?: string;     // link to portalDocuments entry
  createdAt: Date;
  updatedAt: Date;
}

// Invoice - represents amounts due from tenants
export interface Invoice {
  id: string;
  tenantUid: string; // User UID
  tenantId: string; // Tenant document ID
  leaseId: string;
  propertyId: string;
  type: InvoiceType;
  description: string;
  amountCents: number; // Amount in cents
  dueDate: Date;
  status: InvoiceStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceType = 'rent' | 'deposit' | 'fee' | 'late_fee' | 'application_fee' | 'other';
export type InvoiceStatus = 'due' | 'pending' | 'paid' | 'overdue' | 'void' | 'refunded';

// Payment - represents completed payment transactions
export interface Payment {
  id: string;
  leaseId: string;
  tenantId: string;
  tenantUid: string; // User UID
  propertyId: string;
  invoiceId?: string; // Link to invoice if applicable
  amount: number; // Amount in cents
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  stripePaymentId?: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  stripeEventId?: string; // For idempotency
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentType = 'rent' | 'deposit' | 'fee' | 'late_fee' | 'application_fee' | 'other';
export type PaymentMethod = 'stripe' | 'check' | 'cash' | 'bank_transfer' | 'other';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// Maintenance Ticket
export interface MaintenanceTicket {
  id: string;
  propertyId: string;
  unit?: string;
  tenantId?: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  description: string;
  attachments: TicketAttachment[];
  assignedVendor?: string;
  costEstimate?: number;
  dueDate?: Date;
  status: MaintenanceStatus;
  comments: TicketComment[];
  createdAt: Date;
  updatedAt: Date;
}

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'pest' | 'landscaping' | 'other';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'emergency';
export type MaintenanceStatus = 'new' | 'in_progress' | 'waiting' | 'completed' | 'archived';

export interface TicketAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Date;
}

export interface TicketComment {
  id: string;
  userId: string;
  userRole: UserRole;
  content: string;
  createdAt: Date;
}

// Message
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'maintenance' | 'lead';
  relatedId?: string; // ticketId or leadId
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
}

// Alert/Notification
export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: 'application' | 'lead' | 'maintenance' | 'payment' | 'lease';
  read: boolean;
  archived: boolean;
  createdAt: Date;
}

export type AlertType = 'application' | 'lead' | 'maintenance' | 'payment_received' | 'payment_failed' | 'lease_expiring' | 'general';

// Document Template
export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentTemplateType;
  url: string;
  isTemplate: boolean;
  tenantId?: string;
  propertyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentTemplateType = 'lease' | 'addendum' | 'notice' | 'checklist' | 'other';

// Admin Settings
export interface AdminSettings {
  id: string;
  companyName: string;
  logo?: string;
  primaryColor: string;
  accentColors?: string[];
  
  // Payment defaults
  lateFeeAmount?: number;
  lateFeeType: 'fixed' | 'percentage';
  defaultRentDueDay: number;
  defaultGracePeriod: number;
  
  // Property defaults
  defaultLeaseLength: number; // months
  defaultSecurityDeposit?: number;
  
  // Stripe
  stripeConnected: boolean;
  stripeAccountId?: string;
  
  // Notification preferences
  adminNotifications: NotificationPreferences;
  
  updatedAt: Date;
}

// ==================== RENT STATEMENTS + LEDGER ====================

export type RentStatementStatus = 'open' | 'paid' | 'void';

export interface RentStatement {
  id: string;
  leaseId: string;
  tenantUid: string;
  month: string; // YYYY-MM
  status: RentStatementStatus;
  dueDate: string; // YYYY-MM-DD
  rentChargeCents: number;
  balanceCents: number; // server-maintained: SUM(ledger.amountCents)
  lateFeesEnabled: boolean;
  lateFeesThroughDate?: string | null; // YYYY-MM-DD for idempotency
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date | null;
}

export type LedgerEntryType = 'charge' | 'fee' | 'payment' | 'credit' | 'adjustment';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  label: string;
  amountCents: number; // positive for charges/fees; negative for payments/credits
  effectiveDate: string; // YYYY-MM-DD
  notes?: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  createdByUid: string; // "system" or UID
  createdAt: Date;
}

// ==================== PORTAL DOCUMENTS ====================

export type PortalDocCategory = 'lease' | 'pay_stub' | 'id' | 'bank_statement' | 'tax_return' | 'other';
export type PortalDocStatus = 'pending' | 'approved' | 'rejected' | 'pending_signature' | 'signed' | 'uploaded' | 'sent' | 'viewed' | 'void';

export interface PortalDocument {
  id: string;
  ownerUid: string;       // the user the doc belongs to
  uploadedByUid: string;  // who uploaded
  roleScope?: 'applicant' | 'tenant';
  category: PortalDocCategory;
  fileName: string;
  originalFilePath: string; // Firebase Storage path
  status: PortalDocStatus;
  requiresSignature: boolean;
  signedFilePath?: string;  // Storage path for signed PDF
  signatureHash?: string;   // SHA-256 of signed PDF
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentEvent {
  id: string;
  type: string;
  actorUid: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

// ==================== ACTIVITY LOGS ====================

export type ActivityAction =
  | 'lease_assigned'
  | 'lease_ended'
  | 'lease_edited'
  | 'fee_added'
  | 'credit_added'
  | 'payment_recorded'
  | 'document_sent'
  | 'document_signed'
  | 'notice_sent'
  | 'application_approved'
  | 'application_declined'
  | 'property_created'
  | 'property_updated'
  | 'maintenance_created'
  | 'maintenance_updated'
  | 'user_role_changed'
  | 'adjustment_added'
  | 'occupant_added'
  | 'occupant_removed'
  | 'contact_updated'
  | 'lease_doc_uploaded'
  | 'lease_renewed'
  | 'template_created'
  | 'template_published'
  | 'lease_generated'
  | 'lease_sent_for_signature'
  | 'lease_signed'
  | 'lease_voided'
  | 'inspection_submitted';

export interface ActivityLog {
  id: string;
  actorUid: string;
  targetUid?: string;
  action: ActivityAction;
  targetType: 'lease' | 'property' | 'user' | 'payment' | 'document' | 'maintenance' | 'application';
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
