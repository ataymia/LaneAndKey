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

console.log('[Firebase Config] isFirebaseConfigured:', isFirebaseConfigured);
console.log('[Firebase Config] API Key present:', !!import.meta.env.VITE_FIREBASE_API_KEY);
console.log('[Firebase Config] Project ID present:', !!import.meta.env.VITE_FIREBASE_PROJECT_ID);

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
  console.warn(
    `Firebase configuration incomplete. Missing environment variables: ${missingEnvVars.join(', ')}. ` +
    'Running in demo mode. See README.md for setup instructions.'
  );
}

// Initialize Firebase or create placeholder objects for demo mode
let app: FirebaseApp | null = null;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (isFirebaseConfigured) {
  try {
    console.log('[Firebase Config] Initializing Firebase app...');
    app = initializeApp(firebaseConfig);
    console.log('[Firebase Config] Getting auth...');
    auth = getAuth(app);
    console.log('[Firebase Config] Getting firestore...');
    db = getFirestore(app);
    console.log('[Firebase Config] Getting storage...');
    storage = getStorage(app);
    console.log('[Firebase Config] Firebase initialized successfully');
  } catch (error) {
    console.error('[Firebase Config] Failed to initialize Firebase:', error);
    // Create placeholder objects that will throw when accessed
    // The isFirebaseConfigured check in auth.ts will prevent actual usage
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
  }
} else {
  console.log('[Firebase Config] Demo mode - using placeholder objects');
  // Demo mode - create placeholder objects
  // The isFirebaseConfigured check in auth.ts will prevent actual usage
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { auth, db, storage };
export default app;
