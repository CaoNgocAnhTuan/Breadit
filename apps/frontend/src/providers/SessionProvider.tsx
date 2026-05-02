"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

type Session = { user: SessionUser } | null;

const SessionContext = createContext<Session>(null);

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Session;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
