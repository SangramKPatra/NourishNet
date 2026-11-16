import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const TOKEN_KEY = 'nourishnet_token';
const USER_KEY = 'nourishnet_user';

export interface AuthUser {
  id: string;
  email: string;
  role: 'supplier' | 'distributor';
  lat: number | null;
  lng: number | null;
  radius_km: number;
  active: boolean;
  created_at: string;
}

interface SignUpInput {
  email: string;
  password: string;
  role: 'supplier' | 'distributor';
  lat?: string;
  lng?: string;
  radius_km: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (input: SignUpInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => parseJson<AuthUser>(localStorage.getItem(USER_KEY)));
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize from localStorage on mount
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      const parsedUser = parseJson<AuthUser>(storedUser);
      if (parsedUser) {
        setUser(parsedUser);
        setToken(storedToken);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    // Listen for auth state changes - check if token is still valid
    let cancelled = false;

    const checkAuth = async () => {
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setReady(true);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // Token expired/invalid
          if (!cancelled) {
            setUser(null);
            setToken(null);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        } else {
          const data = await res.json() as AuthUser;
          if (!cancelled) {
            setUser(data);
            localStorage.setItem(USER_KEY, JSON.stringify(data));
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    checkAuth();

    // Periodic auth check
    const interval = setInterval(checkAuth, 300000); // 5 minutes
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  const persist = (nextUser: AuthUser, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  };

  const signIn = async (email: string, password: string) => {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error(await readError(res));
    }

    const data = await res.json() as { token: string; user: AuthUser };
    persist(data.user, data.token);
    return data.user;
  };

  const signUp = async (input: SignUpInput) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        role: input.role,
        lat: input.lat !== undefined ? Number(input.lat) : null,
        lng: input.lng !== undefined ? Number(input.lng) : null,
        radius_km: input.radius_km,
      }),
    });

    if (!res.ok) {
      throw new Error(await readError(res));
    }

    // After signup, auto-signin
    return signIn(input.email, input.password);
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);

    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, ready, signIn, signUp, signOut }),
    [user, token, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}