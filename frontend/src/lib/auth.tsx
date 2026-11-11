"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { LoginResponse, Role, User } from "./types";

interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);
const USER_KEY = "tabletap.user";

export function homeFor(role: Role) {
  return role === "PLATFORM_ADMIN" ? "/admin" : "/dashboard";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthState["status"]>("loading");

  const logout = React.useCallback(() => {
    tokenStore.clear();
    try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    setUser(null);
    setStatus("anonymous");
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(logout);
    const token = tokenStore.get();
    if (!token) { setStatus("anonymous"); return; }
    try {
      const cached = localStorage.getItem(USER_KEY);
      if (cached) { setUser(JSON.parse(cached)); setStatus("authenticated"); }
    } catch { /* ignore */ }
    // Validate the token and refresh the profile in the background.
    api<User>("/auth/me")
      .then((u) => { setUser(u); setStatus("authenticated"); try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* ignore */ } })
      .catch(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = React.useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false });
    tokenStore.set(res.accessToken);
    try { localStorage.setItem(USER_KEY, JSON.stringify(res.user)); } catch { /* ignore */ }
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  }, []);

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Client-side route guard. The backend enforces the same rules on every request. */
export function useRequireRole(roles: Role[]) {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);
  React.useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" && user && !roles.includes(user.role)) router.replace(homeFor(user.role));
  }, [status, user, roles, router]);
  return { user, ready: status === "authenticated" && allowed };
}
