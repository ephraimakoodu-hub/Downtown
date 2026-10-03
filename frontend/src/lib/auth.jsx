import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined while loading, null when signed out
  const refresh = useCallback(() => api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)), []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); }, []);
  return <AuthContext.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const can = (user, permission) => Boolean(user?.permissions?.includes(permission));
export const isStaff = (user) => Boolean(user && user.role !== 'customer');
