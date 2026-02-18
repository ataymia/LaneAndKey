import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthChange,
  getUserProfile,
  signUp as firebaseSignUp,
  signIn as firebaseSignIn,
  logOut as firebaseLogOut,
  updateUserProfile,
  resetPassword as firebaseResetPassword,
  updateUserRole as firebaseUpdateUserRole,
} from '../lib/firebase';
import { isFirebaseConfigured } from '../lib/firebase/config';
import type { UserProfile, UserRole } from '../types';

// Demo accounts for testing when Firebase is not configured
const DEMO_ACCOUNTS: Record<string, { password: string; profile: UserProfile }> = {
  'admin@laneandkey.com': {
    password: 'Demo123!',
    profile: {
      uid: 'demo-admin-001',
      email: 'admin@laneandkey.com',
      displayName: 'Demo Admin',
      role: 'admin' as UserRole,
      phone: '(555) 123-4567',
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPreferences: {
        emailNotifications: true,
        smsNotifications: false,
        rentReminders: true,
        maintenanceUpdates: true,
        leaseAlerts: true,
      },
    },
  },
  'tenant@laneandkey.com': {
    password: 'Demo123!',
    profile: {
      uid: 'demo-tenant-001',
      email: 'tenant@laneandkey.com',
      displayName: 'Demo Tenant',
      role: 'tenant' as UserRole,
      phone: '(555) 234-5678',
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPreferences: {
        emailNotifications: true,
        smsNotifications: false,
        rentReminders: true,
        maintenanceUpdates: true,
        leaseAlerts: true,
      },
    },
  },
  'applicant@laneandkey.com': {
    password: 'Demo123!',
    profile: {
      uid: 'demo-applicant-001',
      email: 'applicant@laneandkey.com',
      displayName: 'Demo Applicant',
      role: 'applicant' as UserRole,
      phone: '(555) 345-6789',
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPreferences: {
        emailNotifications: true,
        smsNotifications: false,
        rentReminders: true,
        maintenanceUpdates: true,
        leaseAlerts: true,
      },
    },
  },
};

// Check if demo mode is enabled (Firebase not configured)
export const isDemoMode = !isFirebaseConfigured;

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  isDemoMode: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateRole: (uid: string, role: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch user profile when user changes
  const fetchUserProfile = async (currentUser: User | null) => {
    if (currentUser) {
      try {
        setProfileError(null);
        // Pass user info so profile can be auto-created if missing
        const profile = await getUserProfile(currentUser.uid, {
          email: currentUser.email,
          displayName: currentUser.displayName,
        });
        setUserProfile(profile);
        if (!profile) {
          setProfileError('Could not load your profile. Please try again.');
        }
      } catch (err) {
        console.error('[AuthProvider] Profile fetch error:', err);
        setProfileError(err instanceof Error ? err.message : 'Failed to load profile');
        setUserProfile(null);
      }
    } else {
      setUserProfile(null);
      setProfileError(null);
    }
  };

  useEffect(() => {
    console.log('[AuthProvider] useEffect running, isDemoMode:', isDemoMode);
    
    // In demo mode, check for stored demo session
    if (isDemoMode) {
      console.log('[AuthProvider] Demo mode - checking localStorage');
      const storedProfile = localStorage.getItem('demo_user_profile');
      if (storedProfile) {
        try {
          setUserProfile(JSON.parse(storedProfile));
          console.log('[AuthProvider] Restored demo profile from localStorage');
        } catch {
          localStorage.removeItem('demo_user_profile');
        }
      }
      console.log('[AuthProvider] Demo mode - setting loading to false');
      setLoading(false);
      return;
    }

    // Normal Firebase auth flow
    console.log('[AuthProvider] Firebase mode - setting up auth listener');
    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = onAuthChange(async (currentUser) => {
        console.log('[AuthProvider] Auth callback received, user:', currentUser?.email || 'null');
        setUser(currentUser);
        try {
          await fetchUserProfile(currentUser);
        } catch (err) {
          console.error('[AuthProvider] Profile fetch failed in callback:', err);
        } finally {
          console.log('[AuthProvider] Setting loading to false');
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('[AuthProvider] Failed to initialize auth listener:', error);
      // Ensure loading state is cleared even on error
      setLoading(false);
    }
    
    // Timeout fallback: if loading doesn't complete in 5 seconds, force it
    const timeout = setTimeout(() => {
      console.warn('[AuthProvider] Auth loading timeout (5s) - forcing completion');
      setLoading(false);
    }, 5000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    if (isDemoMode) {
      throw new Error('Sign up is not available in demo mode. Please use one of the demo accounts.');
    }
    await firebaseSignUp(email, password, displayName);
    // Profile will be fetched automatically by onAuthChange
  };

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      // Demo mode login
      const demoAccount = DEMO_ACCOUNTS[email.toLowerCase()];
      if (!demoAccount) {
        throw new Error('Invalid demo account. Use admin@laneandkey.com, tenant@laneandkey.com, or applicant@laneandkey.com');
      }
      if (demoAccount.password !== password) {
        throw new Error('Invalid password for demo account');
      }
      setUserProfile(demoAccount.profile);
      localStorage.setItem('demo_user_profile', JSON.stringify(demoAccount.profile));
      return;
    }
    await firebaseSignIn(email, password);
    // Profile will be fetched automatically by onAuthChange
  };

  const logOut = async () => {
    if (isDemoMode) {
      setUserProfile(null);
      localStorage.removeItem('demo_user_profile');
      return;
    }
    await firebaseLogOut();
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (isDemoMode) {
      throw new Error('Password reset is not available in demo mode.');
    }
    await firebaseResetPassword(email);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (isDemoMode) {
      if (userProfile) {
        const updatedProfile = { ...userProfile, ...updates };
        setUserProfile(updatedProfile);
        localStorage.setItem('demo_user_profile', JSON.stringify(updatedProfile));
      }
      return;
    }
    if (!user) throw new Error('No user logged in');
    await updateUserProfile(user.uid, updates);
    await fetchUserProfile(user);
  };

  const updateRole = async (uid: string, role: UserRole) => {
    if (isDemoMode) {
      throw new Error('Role updates are not available in demo mode.');
    }
    await firebaseUpdateUserRole(uid, role);
    // Refresh profile if it's the current user
    if (user && user.uid === uid) {
      await fetchUserProfile(user);
    }
  };

  const refreshProfile = async () => {
    if (isDemoMode) {
      return;
    }
    await fetchUserProfile(user);
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    profileError,
    isDemoMode,
    signUp,
    signIn,
    logOut,
    resetPassword,
    updateProfile,
    updateRole,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
