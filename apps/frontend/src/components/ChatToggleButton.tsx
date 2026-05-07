"use client";

import { useEffect, useState } from "react";
import Image from "./Image";
import { api } from "@/lib/api";
import { socket } from "@/socket";

export default function ChatToggleButton() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api("/api/conversations/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { count: number } | null) => {
        if (data) setUnreadCount(data.count);
      });

    const handler = () => setUnreadCount((c) => c + 1);
    socket.on("newMessage", handler);
    const clearHandler = () => setUnreadCount(0);
    window.addEventListener("messages:clear-badge", clearHandler);
    return () => {
      socket.off("newMessage", handler);
      window.removeEventListener("messages:clear-badge", clearHandler);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("chatdrawer:toggle"))}
      className="relative w-12 h-12 rounded-full bg-black/80 backdrop-blur border border-borderGray hover:bg-[#181818] transition-colors shadow-lg flex items-center justify-center"
      title="Chat"
    >
      <Image path="icons/message.svg" alt="Chat" w={22} h={22} />
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-iconBlue rounded-full flex items-center justify-center text-[10px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </div>
      )}
    </button>
  );
}

