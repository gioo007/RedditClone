import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { setAccessToken } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const authRequestId = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = ++authRequestId.current;
    api.auth
      .refresh()
      .then((res) => {
        if (!active || requestId !== authRequestId.current) return;
        setAccessToken(res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
      })
      .catch((err) => {
        if (!active || requestId !== authRequestId.current) return;
        if (err.statusCode !== 401) setAuthError(err);
        setAccessToken(null);
      })
      .finally(() => {
        if (active && requestId === authRequestId.current) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    authRequestId.current += 1;
    setIsLoading(false);
    const res = await api.auth.login(credentials);
    setAccessToken(res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setAuthError(null);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    authRequestId.current += 1;
    setIsLoading(false);
    const res = await api.auth.register(payload);
    setAccessToken(res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setAuthError(null);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    authRequestId.current += 1;
    setIsLoading(false);
    try {
      await api.auth.logout();
    } catch {
      // Clear local session regardless of server status
    }
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      authError,
      isAuthenticated: Boolean(token),
      setUser,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, authError, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
