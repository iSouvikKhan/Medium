import type { AuthResponse, PublicUser } from "@medium/common";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../api/client";

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  status: "loading" | "ready";
  startSession: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => tokenStore.get());
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">(() => (tokenStore.get() ? "loading" : "ready"));

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
    setStatus("ready");
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!token || user) return;
    let cancelled = false;
    api
      .me()
      .then(({ user: me }) => !cancelled && setUser(me))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setStatus("ready"));
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const startSession = useCallback((data: AuthResponse) => {
    tokenStore.set(data.token);
    setToken(data.token);
    setUser(data.user);
    setStatus("ready");
  }, []);

  const value = useMemo(() => ({ user, token, status, startSession, logout }), [user, token, status, startSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
