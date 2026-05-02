"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import Image from "./Image";
import NewConversationModal from "./NewConversationModal";
import { socket } from "@/socket";
import { api } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import type { ConversationListItem, MessageItem } from "@breadit/shared";

type ConversationsPage = {
  items: ConversationListItem[];
  nextCursor: number | null;
};

type Props = {
  initialData: ConversationsPage;
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

const ConversationList = ({ initialData }: Props) => {
  const router = useRouter();
  const params = useParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["conversations"],
    queryFn: ({ pageParam }) => fetchConversations(pageParam as number | undefined),
    initialPageParam: undefined as number | undefined,
    initialData: { pages: [initialData], pageParams: [undefined] },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allConversations = data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const handler = (payload: { conversationId: number; message: MessageItem }) => {
      queryClient.setQueryData<{ pages: ConversationsPage[]; pageParams: unknown[] }>(
        ["conversations"],
        (old) => {
          if (!old) return old;
          const updated = old.pages.map((page) => ({
            ...page,
            items: page.items.map((conv) => {
              if (conv.id !== payload.conversationId) return conv;
              const isFromMe = payload.message.senderId === session?.user.id;
              return {
                ...conv,
                lastMessage: payload.message,
                updatedAt: payload.message.createdAt,
                unreadCount: isFromMe ? conv.unreadCount : conv.unreadCount + 1,
              };
            }),
          }));
          // Move updated conversation to top of first page
          const allItems = updated.flatMap((p) => p.items);
          const idx = allItems.findIndex((c) => c.id === payload.conversationId);
          if (idx > 0) {
            const [moved] = allItems.splice(idx, 1);
            allItems.unshift(moved);
          }
          // Rebuild pages (only first page for simplicity)
          const firstPage = { ...updated[0], items: allItems.slice(0, updated[0].items.length) };
          return { pages: [firstPage, ...updated.slice(1)], pageParams: old.pageParams };
        },
      );
    };

    socket.on("newMessage", handler);
    return () => { socket.off("newMessage", handler); };
  }, [queryClient, session?.user.id]);

  const openConversation = async (id: number) => {
    router.push(`/messages/${id}`);
    window.dispatchEvent(new CustomEvent("messages:clear-badge"));
    await api(`/api/conversations/${id}/read`, { method: "PATCH" });
    queryClient.setQueryData<{ pages: ConversationsPage[]; pageParams: unknown[] }>(
      ["conversations"],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((conv) =>
              conv.id === id ? { ...conv, unreadCount: 0 } : conv,
            ),
          })),
        };
      },
    );
  };

  const activeId = params?.conversationId ? Number(params.conversationId) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-borderGray">
        <h1 className="font-bold text-xl">Messages</h1>
        <button
          onClick={() => setShowModal(true)}
          className="p-2 rounded-full hover:bg-[#181818]"
          title="New message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div id="conversation-scroll" className="flex-1 overflow-y-auto">
        <InfiniteScroll
          dataLength={allConversations.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={<p className="text-center text-textGray text-sm py-2">Loading…</p>}
          scrollableTarget="conversation-scroll"
        >
          {allConversations.length === 0 ? (
            <p className="text-center text-textGray text-sm py-8 px-4">
              No conversations yet
            </p>
          ) : (
            allConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#181818] text-left border-b border-borderGray/30 ${
                  activeId === conv.id ? "bg-[#181818]" : ""
                }`}
              >
                <div className="w-12 h-12 relative rounded-full overflow-hidden shrink-0">
                  <Image
                    path={conv.otherMember.img || "general/noAvatar.png"}
                    alt=""
                    w={48}
                    h={48}
                    tr={true}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm truncate">
                      {conv.otherMember.displayName || conv.otherMember.username}
                    </span>
                    <span className="text-textGray text-xs shrink-0">
                      {conv.lastMessage ? timeAgo(conv.lastMessage.createdAt) : ""}
                    </span>
                  </div>
                  <p className="text-textGray text-xs truncate">
                    @{conv.otherMember.username}
                  </p>
                  {conv.lastMessage && (
                    <p className={`text-sm truncate mt-0.5 ${conv.unreadCount > 0 ? "font-semibold text-white" : "text-textGray"}`}>
                      {conv.lastMessage.body || (conv.lastMessage.mediaUrl ? "📎 Media" : "")}
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
        </InfiniteScroll>
      </div>

      {showModal && <NewConversationModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default ConversationList;
