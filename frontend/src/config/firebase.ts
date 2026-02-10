import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;

// Validate required configuration (skip when using emulator with fake keys)
if (!emulatorHost) {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
  const missingKeys = requiredKeys.filter(
    (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
  );
  if (missingKeys.length > 0) {
    console.error(
      `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
      'For Vite/React, these VITE_FIREBASE_* values must be present at build time (e.g. via .env.* files or Docker build args).'
    );
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Connect to Firebase Auth Emulator when configured (E2E testing)
if (emulatorHost) {
  const emulatorUrl = emulatorHost.startsWith('http')
    ? emulatorHost
    : `http://${emulatorHost}`;
  connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });

  // Expose test login function for Cypress E2E tests (only when emulator is active)
  (window as any).__testLogin = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password);
}

// Create Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
