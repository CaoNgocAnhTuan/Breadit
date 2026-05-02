"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatPopup, { type ChatPopupHandle, type OtherUser } from "./ChatPopup";
import { socket } from "@/socket";
import { api } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import type { MessageItem } from "@breadit/shared";

type NewMessagePayload = {
  conversationId: number;
  message: MessageItem;
  sender?: OtherUser;
};

// per-popup latest incoming message (keyed by conversationId)
type IncomingMap = Record<number, MessageItem | null>;

const MAX_POPUPS = 3;

export default function ChatPopupManager() {
  const session = useSession();
  const pathname = usePathname();

  const [popups, setPopups] = useState<ChatPopupHandle[]>([]);
  const [incoming, setIncoming] = useState<IncomingMap>({});

  // keep popups in a ref so the socket handler always has fresh value
  const popupsRef = useRef<ChatPopupHandle[]>([]);
  popupsRef.current = popups;

  const fetchConvDetails = useCallback(
    async (conversationId: number): Promise<OtherUser | null> => {
      const res = await api(`/api/conversations/${conversationId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.otherMember as OtherUser;
    },
    [],
  );

  const openOrUpdatePopup = useCallback(
    async (conversationId: number, msg: MessageItem, senderHint?: OtherUser) => {
      const existing = popupsRef.current.find(
        (p) => p.conversationId === conversationId,
      );

      if (existing) {
        // update unread count if minimized; always push incoming message
        setPopups((prev) =>
          prev.map((p) =>
            p.conversationId === conversationId
              ? { ...p, unread: p.minimized ? p.unread + 1 : 0 }
              : p,
          ),
        );
        setIncoming((prev) => ({ ...prev, [conversationId]: msg }));
        return;
      }

      // need to open a new popup — resolve otherUser
      const otherUser =
        senderHint ?? (await fetchConvDetails(conversationId));
      if (!otherUser) return;

      const newPopup: ChatPopupHandle = {
        conversationId,
        otherUser,
        minimized: false,
        unread: 1,
      };

      setPopups((prev) => {
        const next = [...prev, newPopup];
        // trim to max, removing leftmost (oldest)
        return next.length > MAX_POPUPS ? next.slice(next.length - MAX_POPUPS) : next;
      });
      setIncoming((prev) => ({ ...prev, [conversationId]: msg }));
    },
    [fetchConvDetails],
  );

  useEffect(() => {
    if (!session?.user) return;

    const handler = (payload: NewMessagePayload) => {
      const { conversationId, message, sender } = payload;

      // don't show popup if the message is from ourselves
      if (message.senderId === session.user.id) return;

      // don't show popup if the user is already viewing this conversation
      if (pathname === `/messages/${conversationId}`) return;

      openOrUpdatePopup(conversationId, message, sender ?? undefined);
    };

    socket.on("newMessage", handler);
    return () => { socket.off("newMessage", handler); };
  }, [session, pathname, openOrUpdatePopup]);

  useEffect(() => {
    const onOpenPopup = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      openOrUpdatePopup(detail.conversationId, detail.message, detail.senderHint);
    };
    window.addEventListener("open-chat-popup", onOpenPopup);
    return () => { window.removeEventListener("open-chat-popup", onOpenPopup); };
  }, [openOrUpdatePopup]);


  const closePopup = (conversationId: number) => {
    setPopups((prev) => prev.filter((p) => p.conversationId !== conversationId));
    setIncoming((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const toggleMinimize = (conversationId: number) => {
    setPopups((prev) =>
      prev.map((p) =>
        p.conversationId === conversationId
          ? { ...p, minimized: !p.minimized, unread: p.minimized ? 0 : p.unread }
          : p,
      ),
    );
  };

  const markRead = (conversationId: number) => {
    setPopups((prev) =>
      prev.map((p) =>
        p.conversationId === conversationId ? { ...p, unread: 0 } : p,
      ),
    );
    api(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
    window.dispatchEvent(new CustomEvent("messages:clear-badge"));
  };

  if (!session?.user || popups.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 lg:right-20 z-50 flex items-end gap-3 pointer-events-none">
      {popups.map((popup) => (
        <div key={popup.conversationId} className="pointer-events-auto">
          <ChatPopup
            popup={popup}
            incomingMessage={incoming[popup.conversationId] ?? null}
            onClose={() => closePopup(popup.conversationId)}
            onToggleMinimize={() => toggleMinimize(popup.conversationId)}
            onRead={() => markRead(popup.conversationId)}
          />
        </div>
      ))}
    </div>
  );
}
