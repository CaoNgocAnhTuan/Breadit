"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/Image";
import FollowButton from "@/components/FollowButton";
import { api } from "@/lib/api";

type ConnectUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  bio: string | null;
  _count: { followers: number };
};

type Props = {
  initialUsers: ConnectUser[];
  initialHasMore: boolean;
};

export default function ConnectFeed({ initialUsers, initialHasMore }: Props) {
  const [users, setUsers] = useState<ConnectUser[]>(initialUsers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState(2);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/users/connect?cursor=${cursor}`);
      if (res.ok) {
        const data: { users: ConnectUser[]; hasMore: boolean } = await res.json();
        setUsers((prev) => [...prev, ...data.users]);
        setHasMore(data.hasMore);
        setCursor((c) => c + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 divide-y divide-borderGray">
        {users.map((person) => (
          <div key={person.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
            <Link href={`/${person.username}`} className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  path={person.img || "general/noAvatar.png"}
                  alt={person.username}
                  w={48}
                  h={48}
                  tr={true}
                />
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-tight truncate">
                  {person.displayName || person.username}
                </p>
                <p className="text-textGray text-sm">@{person.username}</p>
                {person.bio && (
                  <p className="text-textGray text-sm mt-0.5 line-clamp-1">{person.bio}</p>
                )}
                <p className="text-textGray text-xs mt-0.5">
                  {person._count.followers.toLocaleString()} follower{person._count.followers !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
            <div className="flex-shrink-0 ml-3">
              <FollowButton userId={person.id} isFollowed={false} username={person.username} />
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center py-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-white text-black font-bold rounded-full disabled:opacity-50"
          >
            {loading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}

      {!hasMore && users.length > 0 && (
        <p className="text-center text-textGray py-6 text-sm">You&apos;ve seen everyone</p>
      )}
    </div>
  );
}
