import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
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
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    if (user) {
      setUserLoading(true);
      try {
        const response = await usersApi.getMe();
        setCurrentUser(response.data);
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setUserLoading(false);
      }
    } else {
      setCurrentUser(null);
      setUserLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [user]);

  const login = async () => {
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
  };

  const logout = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setCurrentUser(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign out';
      setError(errorMessage);
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        currentUser,
        isAdmin: currentUser?.isAdmin || false,
        loading: firebaseLoading || userLoading,
        error: error || hookError?.message || null,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
