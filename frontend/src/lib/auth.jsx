import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;

    try {
      const data = await api('/auth/me');

      // Ignore an old response if logout or another refresh happened.
      if (version === requestVersion.current) {
        setUser(data.user);
      }

      return data.user;
    } catch {
      if (version === requestVersion.current) {
        setUser(null);
      }

      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    // Invalidate any pending login-status request.
    const version = ++requestVersion.current;

    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      // Always clear the frontend user, even if the request fails.
      if (version === requestVersion.current) {
        setUser(null);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const can = (user, permission) =>
  Boolean(user?.permissions?.includes(permission));

export const isStaff = (user) =>
  Boolean(user && user.role !== 'customer');
