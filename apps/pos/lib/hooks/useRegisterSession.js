"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";

const STORAGE_KEY = "bigeds-pos-session-id";
const RegisterSessionContext = createContext(null);

function readStoredSessionId() {
  return typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
}

export function RegisterSessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | open | none

  const loadFromStorage = useCallback(() => {
    const storedId = readStoredSessionId();
    const lookup = storedId ? api.get(`/pos/sessions/${storedId}`) : Promise.resolve(null);

    return lookup
      .then((data) => {
        if (data?.session.status === "OPEN") {
          setSession(data.session);
          setStatus("open");
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
          setStatus("none");
        }
      })
      .catch(() => {
        window.sessionStorage.removeItem(STORAGE_KEY);
        setStatus("none");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedId = readStoredSessionId();
    const lookup = storedId ? api.get(`/pos/sessions/${storedId}`) : Promise.resolve(null);

    lookup
      .then((data) => {
        if (cancelled) return;
        if (data?.session.status === "OPEN") {
          setSession(data.session);
          setStatus("open");
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
          setStatus("none");
        }
      })
      .catch(() => {
        if (cancelled) return;
        window.sessionStorage.removeItem(STORAGE_KEY);
        setStatus("none");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openSession = useCallback((newSession) => {
    window.sessionStorage.setItem(STORAGE_KEY, newSession.id);
    setSession(newSession);
    setStatus("open");
  }, []);

  const closeSession = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setStatus("none");
  }, []);

  return (
    <RegisterSessionContext.Provider value={{ session, status, openSession, closeSession, reload: loadFromStorage }}>
      {children}
    </RegisterSessionContext.Provider>
  );
}

export function useRegisterSession() {
  const context = useContext(RegisterSessionContext);
  if (!context) {
    throw new Error("useRegisterSession must be used within a RegisterSessionProvider");
  }
  return context;
}
