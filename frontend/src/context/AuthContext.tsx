import { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, signInWithRedirect, signOut as firebaseSignOut } from 'firebase/auth';
import { usersApi } from '../api/client';
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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, firebaseLoading, hookError] = useAuthState(auth);
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
          // Graceful fallback if competition_admins table doesn't exist yet
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
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const errorMessage = err.message || 'Failed to sign in';
      setError(errorMessage);
      console.error('Login error:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setAdminCompetitionIds([]);
      setIsCompetitionAdmin(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign out';
      setError(errorMessage);
      console.error('Logout error:', err);
    }
  }, []);

  const isAdmin = currentUser?.isAdmin || false;
  const isAnyAdmin = isAdmin || isCompetitionAdmin;

  const value = useMemo(() => ({
    user: user ?? null,
    currentUser,
    isAdmin,
    isCompetitionAdmin,
    adminCompetitionIds,
    isAnyAdmin,
    loading: firebaseLoading || userLoading,
    error: error || hookError?.message || null,
    login,
    logout,
    refreshUser,
  }), [user, currentUser, isAdmin, isCompetitionAdmin, adminCompetitionIds, isAnyAdmin, firebaseLoading, userLoading, error, hookError, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
