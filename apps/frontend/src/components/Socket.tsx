"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../socket";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/lib/api";

export default function Socket() {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");

  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (socket.connected) {
      onConnect();
    }

    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });
      if (user) {
        socket.emit("newUser", user.username);
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    // Fired by the backend when an Admin bans this user's account.
    // Immediately log out and redirect so the user can't continue acting.
    async function onAccountBanned() {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/sign-in?banned=true");
      router.refresh();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("accountBanned", onAccountBanned);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("accountBanned", onAccountBanned);
    };
  }, [user, router]);

  return (
    <span></span>
  );
}

