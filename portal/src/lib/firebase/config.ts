import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration - loaded from environment variables
// NEVER hard-code these values in production
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

// Validate that all required environment variables are set
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !import.meta.env[envVar]
);

if (missingEnvVars.length > 0) {
  const message = `Firebase configuration incomplete. Missing environment variables: ${missingEnvVars.join(', ')}. ` +
    'See README.md for setup instructions.';
  
  if (import.meta.env.PROD) {
    // In production, throw an error to prevent running with incomplete config
    throw new Error(message);
  } else {
    // In development, show warning but allow app to load for UI development
    console.warn(message);
  }
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

export { auth, db, storage };
export default app;
