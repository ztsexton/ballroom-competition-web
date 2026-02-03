import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required configuration
const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
const missingKeys = requiredKeys.filter(
  (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
);

if (missingKeys.length > 0) {
  console.error(
    `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
    'Please check your .env.local file and ensure all VITE_FIREBASE_* variables are set.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Create Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
