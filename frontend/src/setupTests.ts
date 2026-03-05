import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ToastContext globally so components using useToast work in tests
vi.mock('./context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  initializeAuth: vi.fn(() => ({})),
  browserLocalPersistence: {},
  browserPopupRedirectResolver: {},
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(() => Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } })),
  signInWithRedirect: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    // Immediately call callback with mock user
    callback({ uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' });
    return vi.fn(); // Return unsubscribe function
  }),
}));

// Mock react-firebase-hooks/auth
vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: vi.fn(() => [
    { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' }, // user
    false, // loading
    null, // error
  ]),
}));
