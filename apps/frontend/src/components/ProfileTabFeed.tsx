"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import Post from "./Post";
import Link from "next/link";
import Image from "./Image";
import { format } from "timeago.js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReplyThread({ comment }: { comment: any }) {
  const post = comment.post;

  return (
    <div className="border-b border-borderGray">
      {/* Parent post context */}
      {post && (
        <div className="flex gap-3 px-4 pt-3 pb-0">
          <div className="flex flex-col items-center flex-shrink-0">
            <Link href={`/${post.user.username}`}>
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image
                  path={post.user.img || "general/noAvatar.png"}
                  alt={post.user.username}
                  w={32}
                  h={32}
                  tr
                />
              </div>
            </Link>
            <div className="w-0.5 flex-1 min-h-[16px] bg-borderGray mt-1" />
          </div>

          <Link
            href={`/${post.user.username}/status/${post.id}`}
            className="flex-1 pb-2"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-sm">{post.user.displayName || post.user.username}</span>
              <span className="text-textGray text-xs">@{post.user.username}</span>
              <span className="text-textGray text-xs">{format(post.createdAt)}</span>
            </div>
            {post.desc && (
              <p className="text-sm text-textGray line-clamp-2">{post.desc}</p>
            )}
          </Link>
        </div>
      )}

      {/* Comment reply row */}
      <div className="flex gap-3 px-4 pb-3 pt-1">
        <div className="flex flex-col items-center flex-shrink-0">
          <Link href={`/${comment.user.username}`}>
            <div className="w-10 h-10 relative rounded-full overflow-hidden">
              <Image
                path={comment.user.img || "general/noAvatar.png"}
                alt={comment.user.username}
                fill
                className="object-cover object-center"
                tr
              />
            </div>
          </Link>
        </div>

        <div className="flex-1 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/${comment.user.username}`} className="font-bold hover:underline">
                {comment.user.displayName || comment.user.username}
              </Link>
              <span className="text-textGray text-sm">@{comment.user.username}</span>
              <span className="text-textGray text-sm">{format(comment.createdAt)}</span>
            </div>
          </div>
          <Link href={post ? `/${post.user.username}/status/${post.id}` : "#"}>
            {comment.body && <p className="mt-1 mb-2">{comment.body}</p>}
          </Link>
          <div className="flex items-center gap-6 text-textGray text-sm py-1">
            <span>{comment._count?.replies ?? 0} replies</span>
            <span>{comment._count?.likes ?? 0} likes</span>
          </div>
        </div>
      </div>
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
      {allPosts.map((item: any) =>
        tab === "replies" ? (
          <ReplyThread key={item.id} comment={item} />
        ) : (
          <Post key={item.id} post={item} />
        )
      )}
    </InfiniteScroll>
  );
};

export default ProfileTabFeed;
