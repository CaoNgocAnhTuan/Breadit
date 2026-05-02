"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "./Image";
import { socket } from "@/socket";
import { api } from "@/lib/api";

const MessagesBadge = () => {
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
    <Link
      href="/messages"
      className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
    >
      <div className="relative">
        <Image path="icons/message.svg" alt="" w={24} h={24} />
        {unreadCount > 0 && (
          <div className="absolute -top-4 -right-4 w-6 h-6 bg-iconBlue p-2 rounded-full flex items-center justify-center text-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        )}
      </div>
      <span className="hidden xxl:inline">Messages</span>
    </Link>
  );
};

export default MessagesBadge;
