import { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, signInWithRedirect, signOut as firebaseSignOut } from 'firebase/auth';
import { usersApi, databaseApi, setStagingBypassActive } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  currentUser: User | null;
  isAdmin: boolean;
  isCompetitionAdmin: boolean;
  adminCompetitionIds: number[];
  isAnyAdmin: boolean;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Fake Firebase user shape for staging bypass
const STAGING_FAKE_USER = {
  uid: 'staging-admin',
  email: 'staging@admin.local',
  displayName: 'Staging Admin',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  providerId: 'staging',
  refreshToken: '',
  tenantId: null,
  phoneNumber: null,
  photoURL: null,
  delete: async () => {},
  getIdToken: async () => 'staging-bypass-token',
  getIdTokenResult: async () => ({ token: 'staging-bypass-token', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null }),
  reload: async () => {},
  toJSON: () => ({}),
} as unknown as FirebaseUser;

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [firebaseUser, firebaseLoading, hookError] = useAuthState(auth);
  const [stagingBypass, setStagingBypass] = useState(false);
  const [bypassChecked, setBypassChecked] = useState(false);

  // Check staging bypass flag from backend on mount
  useEffect(() => {
    databaseApi.getStagingBypass()
      .then(res => {
        // Only activate bypass if the server explicitly allows staging mode
        const active = res.data.allowed && res.data.enabled;
        setStagingBypass(active);
        setStagingBypassActive(active);
      })
      .catch(() => {}) // Not available = not enabled
      .finally(() => setBypassChecked(true));
  }, []);

  // In staging bypass mode, always use the fake user
  const user = stagingBypass ? STAGING_FAKE_USER : firebaseUser;
  const effectiveLoading = stagingBypass ? false : (bypassChecked ? firebaseLoading : true);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminCompetitionIds, setAdminCompetitionIds] = useState<number[]>([]);
  const [isCompetitionAdmin, setIsCompetitionAdmin] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (user) {
      setUserLoading(true);
      try {
        const [meRes, adminRes] = await Promise.allSettled([
          usersApi.getMe(),
          usersApi.getAdminCompetitions(),
        ]);
        if (meRes.status === 'fulfilled') {
          setCurrentUser(meRes.value.data);
        }
        if (adminRes.status === 'fulfilled') {
          setAdminCompetitionIds(adminRes.value.data.competitionIds);
          setIsCompetitionAdmin(adminRes.value.data.isCompetitionAdmin);
        } else {
          setAdminCompetitionIds([]);
          setIsCompetitionAdmin(false);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setUserLoading(false);
      }
    } else {
      setCurrentUser(null);
      setAdminCompetitionIds([]);
      setIsCompetitionAdmin(false);
      setUserLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async () => {
    if (stagingBypass) return; // Already "logged in"
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const errorMessage = err instanceof Error ? err.message || 'Failed to sign in' : 'Failed to sign in';
      setError(errorMessage);
      console.error('Login error:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    if (stagingBypass) return; // Can't log out in staging bypass
    try {
      setError(null);
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setAdminCompetitionIds([]);
      setIsCompetitionAdmin(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message || 'Failed to sign out' : 'Failed to sign out';
      setError(errorMessage);
      console.error('Logout error:', err);
    }
  }, []);

  // In staging bypass, force admin if backend hasn't returned the user yet
  const isAdmin = stagingBypass ? true : (currentUser?.isAdmin || false);
  const isAnyAdmin = isAdmin || isCompetitionAdmin;

  const value = useMemo(() => ({
    user: user ?? null,
    currentUser,
    isAdmin,
    isCompetitionAdmin,
    adminCompetitionIds,
    isAnyAdmin,
    loading: effectiveLoading || userLoading,
    error: error || hookError?.message || null,
    login,
    logout,
    refreshUser,
  }), [user, currentUser, isAdmin, isCompetitionAdmin, adminCompetitionIds, isAnyAdmin, effectiveLoading, userLoading, error, hookError, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
