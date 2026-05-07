"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Image from "./Image";
import NewConversationModal from "./NewConversationModal";
import { api } from "@/lib/api";
import type { ConversationListItem, MessageItem } from "@breadit/shared";

type ConversationsPage = {
  items: ConversationListItem[];
  nextCursor: number | null;
};

type SearchUserHit = {
  conversationId: number;
  otherMember: {
    id: string;
    username: string;
    displayName: string | null;
    img: string | null;
  };
};

type SearchMessageHit = {
  conversationId: number;
  otherMember: {
    id: string;
    username: string;
    displayName: string | null;
    img: string | null;
  };
  message: MessageItem;
};

type SearchResponse = {
  users: SearchUserHit[];
  messages: SearchMessageHit[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const fetchConversations = async (cursor?: number): Promise<ConversationsPage> => {
  const params = cursor ? `?cursor=${cursor}` : "";
  const res = await api(`/api/conversations${params}`);
  return res.json();
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function ChatDrawer({ open, onClose }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["conversations"],
      queryFn: ({ pageParam }) =>
        fetchConversations(pageParam as number | undefined),
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: open,
    });

  const conversations = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setSearch(null);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api(
          `/api/conversations/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (res.ok) setSearch(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [q, open]);

  const openPopup = (
    conversationId: number,
    otherMember: SearchUserHit["otherMember"],
    message?: MessageItem,
  ) => {
    window.dispatchEvent(
      new CustomEvent("open-chat-popup", {
        detail: {
          conversationId,
          message:
            message ??
            ({
              id: 0,
              body: null,
              mediaUrl: null,
              senderId: otherMember.id,
              createdAt: new Date().toISOString(),
            } satisfies MessageItem),
          senderHint: otherMember,
        },
      }),
    );
    onClose();
  };

  if (!open) return null;

  const showSearch = q.trim().length > 0;
  const people = search?.users ?? [];
  const messages = search?.messages ?? [];

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close chat drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        ref={panelRef}
        className="fixed bottom-20 right-4 lg:right-8 w-[360px] max-w-[calc(100vw-32px)] bg-black border border-borderGray rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-borderGray flex items-center gap-2">
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight">Chat</p>
            <p className="text-textGray text-xs leading-tight">All</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="p-2 rounded-full hover:bg-[#181818] text-textGray hover:text-white transition-colors"
              title="New message"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#181818] text-textGray hover:text-white transition-colors"
              title="Close"
            >
              <Image path="icons/close.svg" alt="close" w={18} h={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-borderGray">
          <div className="bg-inputGray py-2 px-4 flex items-center gap-3 rounded-full">
            <Image path="icons/explore.svg" alt="search" w={16} h={16} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search messages or people"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent outline-none placeholder:text-textGray w-full text-sm"
            />
            {q.trim() && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-textGray hover:text-white"
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
          {searching && (
            <p className="text-textGray text-xs mt-2 px-1">Searching…</p>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[520px] overflow-y-auto">
          {showSearch ? (
            <div className="py-2">
              <p className="px-4 pt-2 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">
                People
              </p>
              {people.length === 0 ? (
                <p className="px-4 py-2 text-sm text-textGray">No users found</p>
              ) : (
                people.map((u) => (
                  <button
                    key={`u-${u.conversationId}-${u.otherMember.id}`}
                    type="button"
                    onClick={() => openPopup(u.conversationId, u.otherMember)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-left"
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <Image
                        path={u.otherMember.img || "general/noAvatar.png"}
                        alt=""
                        fill
                        className="object-cover object-center"
                        tr={true}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {u.otherMember.displayName || u.otherMember.username}
                      </p>
                      <p className="text-textGray text-xs truncate">
                        @{u.otherMember.username}
                      </p>
                    </div>
                  </button>
                ))
              )}

              <p className="px-4 pt-4 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">
                Messages
              </p>
              {messages.length === 0 ? (
                <p className="px-4 py-2 text-sm text-textGray">
                  No messages found
                </p>
              ) : (
                messages.map((m) => (
                  <button
                    key={`m-${m.conversationId}-${m.message.id}`}
                    type="button"
                    onClick={() =>
                      openPopup(m.conversationId, m.otherMember, m.message)
                    }
                    className="w-full flex items-start gap-3 px-4 py-2 hover:bg-white/5 text-left"
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 mt-0.5">
                      <Image
                        path={m.otherMember.img || "general/noAvatar.png"}
                        alt=""
                        fill
                        className="object-cover object-center"
                        tr={true}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">
                          {m.otherMember.displayName || m.otherMember.username}
                        </p>
                        <span className="text-textGray text-xs shrink-0">
                          {timeAgo(m.message.createdAt)}
                        </span>
                      </div>
                      <p className="text-textGray text-xs truncate">
                        {m.message.body ||
                          (m.message.mediaUrl ? "📎 Media" : "")}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="py-2">
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-sm text-textGray text-center">
                  No conversations yet
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() =>
                      openPopup(
                        conv.id,
                        conv.otherMember,
                        conv.lastMessage ?? undefined,
                      )
                    }
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#181818] text-left border-b border-borderGray/30"
                  >
                    <div className="w-11 h-11 relative rounded-full overflow-hidden shrink-0">
                      <Image
                        path={conv.otherMember.img || "general/noAvatar.png"}
                        alt=""
                        fill
                        className="object-cover object-center"
                        tr={true}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm truncate">
                          {conv.otherMember.displayName ||
                            conv.otherMember.username}
                        </span>
                        <span className="text-textGray text-xs shrink-0">
                          {conv.lastMessage
                            ? timeAgo(conv.lastMessage.createdAt)
                            : ""}
                        </span>
                      </div>
                      <p className="text-textGray text-xs truncate">
                        @{conv.otherMember.username}
                      </p>
                      {conv.lastMessage && (
                        <p
                          className={`text-sm truncate mt-0.5 ${
                            conv.unreadCount > 0
                              ? "font-semibold text-white"
                              : "text-textGray"
                          }`}
                        >
                          {conv.lastMessage.body ||
                            (conv.lastMessage.mediaUrl ? "📎 Media" : "")}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-iconBlue rounded-full flex items-center justify-center text-xs shrink-0 mt-1">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </div>
                    )}
                  </button>
                ))
              )}

              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                  className="w-full py-2 rounded-xl border border-borderGray text-sm text-textGray hover:text-white hover:bg-[#181818] disabled:opacity-40 transition-colors"
                >
                  {hasNextPage
                    ? isFetchingNextPage
                      ? "Loading…"
                      : "Load more"
                    : "No more"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && <NewConversationModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

