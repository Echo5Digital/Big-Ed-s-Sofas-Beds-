"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated

  const refresh = useCallback(async () => {
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/auth/me")
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const hasPermission = useCallback(
    (permissionKey) => user?.permissions?.includes(permissionKey) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refresh, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

// Cashier is a POS-only role — this is a dedicated admin-app check, not a
// permission gate, because Cashier legitimately holds some admin-relevant
// permissions (catalog:read, inventory:read, orders:read) for other reasons;
// the point here is to keep Cashiers in POS entirely, not to withhold a
// specific permission. "Cashier-only" (not just "has Cashier") so a user
// holding Cashier plus a real admin role, e.g. Manager, is unaffected.
export function isCashierOnlyUser(user) {
  return Boolean(user?.roles?.includes("CASHIER") && user.roles.length === 1);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
