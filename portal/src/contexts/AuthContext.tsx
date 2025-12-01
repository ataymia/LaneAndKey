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
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
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

  // Fetch user profile when user changes
  const fetchUserProfile = async (currentUser: User | null) => {
    if (currentUser) {
      const profile = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser);
      await fetchUserProfile(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    await firebaseSignUp(email, password, displayName);
    // Profile will be fetched automatically by onAuthChange
  };

  const signIn = async (email: string, password: string) => {
    await firebaseSignIn(email, password);
    // Profile will be fetched automatically by onAuthChange
  };

  const logOut = async () => {
    await firebaseLogOut();
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await firebaseResetPassword(email);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    await updateUserProfile(user.uid, updates);
    await fetchUserProfile(user);
  };

  const updateRole = async (uid: string, role: UserRole) => {
    await firebaseUpdateUserRole(uid, role);
    // Refresh profile if it's the current user
    if (user && user.uid === uid) {
      await fetchUserProfile(user);
    }
  };

  const refreshProfile = async () => {
    await fetchUserProfile(user);
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
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
