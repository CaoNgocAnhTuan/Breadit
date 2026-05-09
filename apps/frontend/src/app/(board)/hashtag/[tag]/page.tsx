"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import Post from "@/components/Post";
import { use } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostPage = { posts: any[]; hasMore: boolean; tag: string; nextCursor?: number | string | null };

const HashtagPage = ({ params }: { params: Promise<{ tag: string }> }) => {
  const { tag } = use(params);

  const { data, error, hasNextPage, fetchNextPage } =
    useInfiniteQuery<PostPage>({
      queryKey: ["hashtag", tag],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await fetch(
          `${BACKEND_URL}/api/hashtags/${tag}/posts?cursor=${encodeURIComponent(String(pageParam))}`,
          { credentials: "include" }
        );
        return res.json();
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  const allPosts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div>
      <div className="px-4 py-4 border-b border-borderGray">
        <h1 className="text-xl font-bold">#{tag}</h1>
      </div>
      {error && (
        <p className="p-8 text-center text-textGray">Something went wrong.</p>
      )}
      <InfiniteScroll
        dataLength={allPosts.length}
        next={fetchNextPage}
        hasMore={!!hasNextPage}
        loader={<p className="p-4 text-center text-textGray">Loading…</p>}
        endMessage={
          allPosts.length === 0 ? (
            <p className="p-8 text-center text-textGray">
              No posts for #{tag} yet.
            </p>
          ) : (
            <p className="p-4 text-center text-textGray">All posts loaded.</p>
          )
        }
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {allPosts.map((post: any) => (
          <Post key={post.id} post={post} />
        ))}
      </InfiniteScroll>
    </div>
  );
};

export default HashtagPage;
