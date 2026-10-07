import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase.ts';
import { authService } from '../services/firebaseServices.ts';
import { handleStandaloneApiRequest } from '../services/standaloneFirestoreEngine.ts';

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

const SESSION_TOKEN_KEY = 'hrf_auth_session_token';
let memoryToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_TOKEN_KEY) : null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(memoryToken);
  const [loading, setLoading] = useState<boolean>(true);

  const setActiveToken = (newToken: string | null) => {
    memoryToken = newToken;
    setToken(newToken);
    if (typeof window !== 'undefined') {
      if (newToken) {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, newToken);
      } else {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  };

  const apiFetch = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      const currentToken = memoryToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      if (
        typeof window !== 'undefined' &&
        window.location.hostname.includes('netlify.app')
      ) {
        return (await handleStandaloneApiRequest(url, options)) as T;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        const rawText = await response.text();
        const trimmed = rawText.trim();

        // If static hosting (e.g. Netlify / custom domain) returns an HTML page or empty non-JSON
        if (
          trimmed.startsWith('<') ||
          trimmed.toLowerCase().startsWith('<!doctype') ||
          !(trimmed.startsWith('{') || trimmed.startsWith('['))
        ) {
          return (await handleStandaloneApiRequest(url, options)) as T;
        }

        const data = JSON.parse(trimmed);

        if (!response.ok) {
          throw new Error(data.error || 'সার্ভারে অনুরোধ সম্পন্ন করতে সমস্যা হয়েছে।');
        }

        return data as T;
      } catch (err: any) {
        if (
          err instanceof SyntaxError ||
          String(err?.message || '').includes('Unexpected token') ||
          String(err?.message || '').includes('Failed to fetch') ||
          String(err?.message || '').includes('NetworkError')
        ) {
          return (await handleStandaloneApiRequest(url, options)) as T;
        }
        throw err;
      }
    },
    []
  );

  const refreshUser = useCallback(async () => {
    if (!memoryToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setActiveToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setActiveToken(idToken);
          const res = await apiFetch<{ user: AuthUser }>('/api/auth/me');
          if (mounted) {
            setUser(res.user);
            setLoading(false);
          }
          return;
        } catch (err) {
          console.error('Firebase session sync failed:', err);
        }
      }

      if (memoryToken) {
        await refreshUser();
      } else if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [apiFetch, refreshUser]);

  const loginWithCredentials = async (email: string, password: string) => {
    const data = await authService.loginWithEmail(email, password);
    setActiveToken(data.token);
    setUser(data.user);
  };

  const loginWithGoogle = async () => {
    const data = await authService.loginWithGooglePopup(apiFetch);
    setActiveToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await authService.logout();
    setActiveToken(null);
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
