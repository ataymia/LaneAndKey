import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { storage } from './config';

// Upload a file to Firebase Storage
export async function uploadFile(
  path: string,
  file: File,
  metadata?: { [key: string]: string }
): Promise<string> {
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file, {
    customMetadata: metadata,
  });
  
  return getDownloadURL(storageRef);
}

// Upload property photo
export async function uploadPropertyPhoto(
  propertyId: string,
  file: File,
  index: number
): Promise<string> {
  const path = `properties/${propertyId}/photos/${index}_${file.name}`;
  return uploadFile(path, file);
}

// Upload application document
export async function uploadApplicationDocument(
  applicationId: string,
  file: File
): Promise<string> {
  const path = `applications/${applicationId}/${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Upload tenant document
export async function uploadTenantDocument(
  tenantId: string,
  documentType: string,
  file: File
): Promise<string> {
  const path = `tenants/${tenantId}/${documentType}/${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Upload maintenance attachment
export async function uploadMaintenanceAttachment(
  ticketId: string,
  file: File
): Promise<string> {
  const path = `maintenance/${ticketId}/${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Upload lease document
export async function uploadLeaseDocument(
  leaseId: string,
  file: File
): Promise<string> {
  const path = `leases/${leaseId}/${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Upload template document
export async function uploadTemplateDocument(file: File): Promise<string> {
  const path = `templates/${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Upload company logo
export async function uploadCompanyLogo(file: File): Promise<string> {
  const path = `branding/logo_${Date.now()}_${file.name}`;
  return uploadFile(path, file);
}

// Delete a file from Firebase Storage
export async function deleteFile(url: string): Promise<void> {
  try {
    // Extract the path from the download URL
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Get download URL for a path
export async function getFileUrl(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

// List all files in a directory
export async function listFiles(path: string): Promise<string[]> {
  const storageRef = ref(storage, path);
  const result = await listAll(storageRef);
  
  const urls = await Promise.all(
    result.items.map(item => getDownloadURL(item))
  );
  
  return urls;
}
