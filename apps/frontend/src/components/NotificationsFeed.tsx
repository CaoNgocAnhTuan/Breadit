"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import { useRouter } from "next/navigation";
import { format } from "timeago.js";
import Image from "./Image";
import { api } from "@/lib/api";
import type { NotificationItem } from "@breadit/shared";

type NotifPage = { items: NotificationItem[]; nextCursor: number | null; total: number };

const fetchNotifications = async (cursor: number): Promise<NotifPage> => {
  const res = await api(`/api/notifications?cursor=${cursor}`);
  return res.json();
};

function notifText(type: NotificationItem["type"]): string {
  switch (type) {
    case "LIKE": return "liked your post";
    case "REPLY": return "replied to your post";
    case "REPOST": return "reposted your post";
    case "FOLLOW": return "followed you";
    case "MENTION": return "mentioned you in a post";
    case "COMMUNITY_POST": return "submitted a post pending your approval";
    case "COMMUNITY_NEW_POST": return "posted in a community you're in";
    case "REPORT": return "reported a post for review";
    default: return "sent you a notification";
  }
}

function notifLink(n: NotificationItem): string {
  if (n.type === "FOLLOW") return `/${n.actor.username}`;
  if (n.type === "REPORT") return "/admin-console/reports";
  if (n.post) return `/${n.post.user.username}/status/${n.post.id}`;
  return "/notifications";
}

const NotificationsFeed = ({ initialData }: { initialData: NotifPage }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam as number),
    initialPageParam: 1,
    initialData: { pages: [initialData], pageParams: [1] },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (id: number) =>
      api(`/api/notifications/${id}/read`, { method: "PATCH" }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      window.dispatchEvent(new CustomEvent('notifications:clear-badge'));
    },
  });

  const handleClick = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate(n.id);
    router.push(notifLink(n));
  };

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="flex justify-end px-4 py-2 border-b border-borderGray">
        <button
          onClick={() => markAllRead.mutate()}
          className="text-sm text-iconBlue hover:underline"
        >
          Mark all as read
        </button>
      </div>
      {allItems.length === 0 && (
        <p className="text-center text-textGray py-10">No notifications yet</p>
      )}
      <InfiniteScroll
        dataLength={allItems.length}
        next={fetchNextPage}
        hasMore={!!hasNextPage}
        loader={<p className="text-center text-textGray py-4">Loading…</p>}
        endMessage={
          allItems.length > 0 ? (
            <p className="text-center text-textGray py-4">All caught up</p>
          ) : null
        }
      >
        {allItems.map((n) => (
          <div
            key={n.id}
            onClick={() => handleClick(n)}
            className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#181818] border-b border-borderGray ${
              !n.readAt ? "bg-[#0d1926]" : ""
            }`}
          >
            <div className="w-10 h-10 relative rounded-full overflow-hidden flex-shrink-0">
              <Image
                path={n.actor.img || "general/noAvatar.png"}
                alt={n.actor.username}
                w={40}
                h={40}
                tr={true}
              />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm">
                <span className="font-bold">{n.actor.displayName ?? n.actor.username}</span>{" "}
                <span className="text-textGray">{notifText(n.type)}</span>
              </p>
              <span className="text-xs text-textGray">{format(n.createdAt)}</span>
            </div>
            {!n.readAt && (
              <div className="w-2 h-2 bg-iconBlue rounded-full flex-shrink-0 mt-1 ml-auto" />
            )}
          </div>
        ))}
      </InfiniteScroll>
    </div>
  );
};

export default NotificationsFeed;
