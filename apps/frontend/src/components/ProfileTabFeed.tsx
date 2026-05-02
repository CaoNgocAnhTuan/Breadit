"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import Post from "./Post";
import Link from "next/link";
import Image from "./Image";
import { format } from "timeago.js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReplyThread({ post }: { post: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parent = post.parentPost as any;

  return (
    <div className="border-b border-borderGray">
      {/* Reply row — avatar with vertical connector line */}
      <div className="flex gap-3 px-4 pt-3 pb-0">
        <div className="flex flex-col items-center flex-shrink-0">
          <Link href={`/${post.user.username}`}>
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                path={post.user.img || "general/noAvatar.png"}
                alt={post.user.username}
                w={40}
                h={40}
                tr
              />
            </div>
          </Link>
          {parent && <div className="w-0.5 flex-1 min-h-[16px] bg-borderGray mt-1" />}
        </div>

        <div className="flex-1 pb-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/${post.user.username}`} className="font-bold hover:underline">
                {post.user.displayName || post.user.username}
              </Link>
              <span className="text-textGray text-sm">@{post.user.username}</span>
              <span className="text-textGray text-sm">{format(post.createdAt)}</span>
            </div>
          </div>
          {/* Reply content */}
          <Link href={`/${post.user.username}/status/${post.id}`}>
            {post.desc && <p className="mt-1 mb-2">{post.desc}</p>}
          </Link>
          {/* Interactions inline */}
          <div className="flex items-center gap-6 text-textGray text-sm py-1">
            <span>{post._count?.comments ?? 0} replies</span>
            <span>{post._count?.rePosts ?? 0} reposts</span>
            <span>{post._count?.likes ?? 0} likes</span>
          </div>
        </div>
      </div>

      {/* Parent post context */}
      {parent && (
        <div className="flex gap-3 px-4 pb-3">
          {/* Indent to align with reply content */}
          <div className="w-10 flex-shrink-0 flex justify-center pt-1">
            <Link href={`/${parent.user.username}`}>
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image
                  path={parent.user.img || "general/noAvatar.png"}
                  alt={parent.user.username}
                  w={32}
                  h={32}
                  tr
                />
              </div>
            </Link>
          </div>
          <Link
            href={`/${parent.user.username}/status/${parent.id}`}
            className="flex-1 border border-borderGray rounded-xl p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-bold text-sm">{parent.user.displayName || parent.user.username}</span>
              <span className="text-textGray text-xs">@{parent.user.username}</span>
              <span className="text-textGray text-xs">{format(parent.createdAt)}</span>
            </div>
            {parent.desc && (
              <p className="text-sm text-textGray line-clamp-2">{parent.desc}</p>
            )}
            {parent.img && (
              <div className="mt-1 text-xs text-textGray">📷 Image</div>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}

const ProfileTabFeed = ({
  username,
  tab,
}: {
  username: string;
  tab: string;
}) => {
  const { data, error, status, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["profile-posts", username, tab],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `${BACKEND_URL}/api/users/${username}/posts?tab=${tab}&cursor=${pageParam}`,
        { credentials: "include" }
      );
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
  });

  if (error) return <p className="p-8 text-center text-textGray">Something went wrong.</p>;
  if (status === "pending") return <p className="p-8 text-center text-textGray">Loading...</p>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPosts = data?.pages?.flatMap((page: any) => page.posts) ?? [];

  if (allPosts.length === 0) {
    return <p className="p-8 text-center text-textGray">No posts yet.</p>;
  }

  return (
    <InfiniteScroll
      dataLength={allPosts.length}
      next={fetchNextPage}
      hasMore={!!hasNextPage}
      loader={<p className="p-4 text-center text-textGray">Loading...</p>}
      endMessage={<p className="p-4 text-center text-textGray">All posts loaded.</p>}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {allPosts.map((post: any) =>
        tab === "replies" ? (
          <ReplyThread key={post.id} post={post} />
        ) : (
          <Post key={post.id} post={post} />
        )
      )}
    </InfiniteScroll>
  );
};

export default ProfileTabFeed;
