import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import type { UserProfile, UserRole } from '../../types';

// Sign up a new user
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = 'applicant'
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Update display name
  await updateProfile(user, { displayName });

  // Create user profile in Firestore
  const userProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
    uid: user.uid,
    email: email,
    displayName: displayName,
    role: role,
    notificationPreferences: {
      emailNotifications: true,
      smsNotifications: false,
      rentReminders: true,
      maintenanceUpdates: true,
      leaseAlerts: true,
    },
  };

  await setDoc(doc(db, 'users', user.uid), {
    ...userProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return user;
}

// Sign in existing user
export async function signIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserProfile;
  }
  
  return null;
}

// Update user profile
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Update user role (admin only)
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    role,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
