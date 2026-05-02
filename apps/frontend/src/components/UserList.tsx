"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import UserCard from "./UserCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type UserSummary = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  bio: string | null;
};

const UserList = ({
  username,
  type,
  initialUsers,
  initialHasMore,
}: {
  username: string;
  type: "followers" | "following";
  initialUsers: UserSummary[];
  initialHasMore: boolean;
}) => {
  const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["users", username, type],
    queryFn: async ({ pageParam = 2 }) => {
      const res = await fetch(
        `${BACKEND_URL}/api/users/${username}/${type}?cursor=${pageParam}`,
        { credentials: "include" }
      );
      return res.json();
    },
    initialPageParam: 2,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 2 : undefined,
    initialData: {
      pages: [{ users: initialUsers, hasMore: initialHasMore }],
      pageParams: [1],
    },
  });

  const allUsers = data?.pages?.flatMap((page) => page.users) ?? [];

  if (allUsers.length === 0) {
    return <p className="p-8 text-center text-textGray">No users found.</p>;
  }

  return (
    <InfiniteScroll
      dataLength={allUsers.length}
      next={fetchNextPage}
      hasMore={!!hasNextPage}
      loader={<p className="p-4 text-center text-textGray">Loading...</p>}
      endMessage={<p className="p-4 text-center text-textGray">All users loaded.</p>}
    >
      {allUsers.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </InfiniteScroll>
  );
};

export default UserList;
