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
import { auth, db, isFirebaseConfigured } from './config';
import type { UserProfile, UserRole } from '../../types';

// Sign up a new user
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = 'applicant'
): Promise<User> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Cannot sign up in demo mode.');
  }
  
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
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Use demo mode to sign in.');
  }
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Sign out
export async function logOut(): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }
  await signOut(auth);
}

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured) {
    return null;
  }
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
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Cannot update profile in demo mode.');
  }
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Update user role (admin only)
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Cannot update role in demo mode.');
  }
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    role,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Cannot reset password in demo mode.');
  }
  await sendPasswordResetEmail(auth, email);
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  console.log('[Auth] onAuthChange called, isFirebaseConfigured:', isFirebaseConfigured);
  
  if (!isFirebaseConfigured) {
    // In demo mode, immediately call with null and return a no-op unsubscribe
    console.log('[Auth] Demo mode - calling callback with null');
    callback(null);
    return () => {};
  }
  
  try {
    // Check if auth is properly initialized (not an empty placeholder object)
    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      console.warn('[Auth] Firebase auth not properly initialized, falling back to demo mode');
      callback(null);
      return () => {};
    }
    
    console.log('[Auth] Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[Auth] onAuthStateChanged fired, user:', user ? user.email : null);
      callback(user);
    });
    console.log('[Auth] Listener set up successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[Auth] Error setting up auth state listener:', error);
    // Fallback: call with null so the app doesn't hang
    callback(null);
    return () => {};
  }
}

// Get current user
export function getCurrentUser(): User | null {
  if (!isFirebaseConfigured) {
    return null;
  }
  return auth.currentUser;
}
