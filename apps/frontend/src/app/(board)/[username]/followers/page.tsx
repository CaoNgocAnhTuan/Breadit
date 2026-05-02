import Image from "@/components/Image";
import UserList from "@/components/UserList";
import { serverFetch } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";

const FollowersPage = async ({
  params,
}: {
  params: Promise<{ username: string }>;
}) => {
  const { username } = await params;

  const res = await serverFetch(`/api/users/${username}/followers?cursor=1`);
  if (!res.ok) return notFound();
  const { users, hasMore } = await res.json();

  return (
    <div>
      <div className="flex items-center gap-8 sticky top-0 backdrop-blur-md p-4 z-10 bg-[#00000084]">
        <Link href={`/${username}`}>
          <Image path="icons/back.svg" alt="back" w={24} h={24} />
        </Link>
        <div>
          <h1 className="font-bold text-lg">@{username}</h1>
          <p className="text-textGray text-sm">Followers</p>
        </div>
      </div>
      <UserList
        username={username}
        type="followers"
        initialUsers={users}
        initialHasMore={hasMore}
      />
    </div>
  );
};

export default FollowersPage;
