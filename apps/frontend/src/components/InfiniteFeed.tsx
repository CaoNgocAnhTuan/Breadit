"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import Post, { PostWithDetails } from "./Post";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type PostPage = { posts: PostWithDetails[]; hasMore: boolean };

const fetchPosts = async (
  pageParam: number,
  userProfileId?: string,
  feed?: string,
  communityId?: number
): Promise<PostPage> => {
  const params = new URLSearchParams({ cursor: String(pageParam) });
  if (userProfileId) params.set("user", userProfileId);
  if (feed) params.set("feed", feed);
  if (communityId) params.set("communityId", String(communityId));
  const res = await fetch(`${BACKEND_URL}/api/posts?${params}`, {
    credentials: "include",
  });
  return res.json();
};

const InfiniteFeed = ({
  userProfileId,
  feed,
  communityId,
  initialData,
}: {
  userProfileId?: string;
  feed?: string;
  communityId?: number;
  initialData?: PostPage;
}) => {
  const { data, error, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["posts", userProfileId ?? "", feed ?? "", communityId ?? ""],
    queryFn: ({ pageParam }) =>
      fetchPosts(pageParam as number, userProfileId, feed, communityId),
    initialPageParam: 1,
    initialData: initialData
      ? { pages: [initialData], pageParams: [1] }
      : undefined,
    refetchOnMount: true,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
  });

  if (error) return "Something went wrong!";
  if (!data) return "Loading...";

  const allPosts = data.pages.flatMap((page) => page.posts);

  return (
    <InfiniteScroll
      dataLength={allPosts.length}
      next={fetchNextPage}
      hasMore={!!hasNextPage}
      loader={<h1>Posts are loading...</h1>}
      endMessage={<h1>All posts loaded!</h1>}
    >
      {allPosts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </InfiniteScroll>
  );
};

export default InfiniteFeed;
