import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase.ts';
import { authService } from '../services/firebaseServices.ts';
import {
  handleStandaloneApiRequest,
  ensureFirestoreUserAndSeed,
  setActiveLoginEmail,
  getActiveCloudUser,
} from '../services/standaloneFirestoreEngine.ts';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';

export interface AuthUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedDepartmentIds: number[];
  status: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const apiFetch = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      return (await handleStandaloneApiRequest(url, options)) as T;
    },
    []
  );

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const idToken = await auth.currentUser.getIdToken();
      setToken(idToken);
      const profile = await ensureFirestoreUserAndSeed();
      setUser(profile);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const profile = await ensureFirestoreUserAndSeed();
          if (mounted) {
            setToken(idToken);
            setUser(profile);
            setLoading(false);
          }
        } catch (err) {
          console.error('Firebase Auth & Firestore session resolution error:', err);
          if (mounted) {
            setUser(null);
            setToken(null);
            setLoading(false);
          }
        }
      } else if (mounted) {
        const activeUser = getActiveCloudUser();
        if (activeUser) {
          setUser(activeUser);
          setLoading(false);
        } else {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    const data = await authService.loginWithEmail(email, password);
    setToken(data.token);
    setUser(data.user);
  };

  const loginWithGoogle = async () => {
    const data = await authService.loginWithGooglePopup(apiFetch);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    setActiveLoginEmail(null);
    await authService.logout();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithCredentials,
        loginWithGoogle,
        logout,
        apiFetch,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
