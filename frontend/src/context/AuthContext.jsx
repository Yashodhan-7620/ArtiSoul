import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const STORAGE_KEY = 'artisoul.auth';
const AuthContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private mode / cleared storage — just start logged out
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStored);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — session simply won't survive a refresh */
    }
  }, [session]);

  const login = useCallback(async (phone, password) => {
    const { data } = await api.auth.login({ phone, password });
    setSession(data);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.auth.register(payload);
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isArtisan: session?.user?.role === 'artisan',
      login,
      register,
      logout,
    }),
    [session, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
