import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import * as api from '../api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; email?: string; error?: string }>;
  updateUser: (user: User) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

const USER_CACHE_KEY = 'stopefy-cached-user';

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_CACHE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api
        .getMe()
        .then((freshUser) => {
          setUser(freshUser);
          setCachedUser(freshUser);
        })
        .catch(() => {
          // If getMe() failed, always try cached user first.
          // This covers offline, bad WiFi, server down, etc.
          const cached = getCachedUser();
          if (cached) {
            setUser(cached);
            return;
          }
          // No cached user — only then clear tokens
          api.logout();
          setCachedUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setUser(res.user);
    setCachedUser(res.user);
    return true;
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      try {
        const res = await api.register(username, email, password);
        return { success: true, email: res.email };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Registration failed';
        return { success: false, error: message };
      }
    },
    []
  );

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    setCachedUser(updatedUser);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setCachedUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, updateUser, logout, isAdmin: user?.is_admin ?? false }}
    >
      {children}
    </AuthContext.Provider>
  );
}
