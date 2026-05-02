"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "./Image";
import { socket } from "@/socket";
import { api } from "@/lib/api";

const Notification = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api("/api/notifications?unread=true&cursor=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { total: number } | null) => {
        if (data) setUnreadCount(data.total);
      });

    const handler = () => setUnreadCount((c) => c + 1);
    socket.on("getNotification", handler);
    const clearHandler = () => setUnreadCount(0);
    window.addEventListener('notifications:clear-badge', clearHandler);
    return () => {
      socket.off("getNotification", handler);
      window.removeEventListener('notifications:clear-badge', clearHandler);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
    >
      <div className="relative">
        <Image path="icons/notification.svg" alt="" w={24} h={24} />
        {unreadCount > 0 && (
          <div className="absolute -top-4 -right-4 w-6 h-6 bg-iconBlue p-2 rounded-full flex items-center justify-center text-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        )}
      </div>
      <span className="hidden xxl:inline">Notifications</span>
    </Link>
  );
};

export default Notification;
