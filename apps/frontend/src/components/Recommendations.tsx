import Link from "next/link";
import Image from "./Image";
import FollowButton from "./FollowButton";
import { getSession, serverFetch } from "@/lib/session";

type RecommendedUser = {
  id: string;
  displayName: string | null;
  username: string;
  img: string | null;
};

const Recommendations = async () => {
  const session = await getSession();
  if (!session?.user) return;

  const res = await serverFetch('/api/users/recommendations');
  if (!res.ok) return null;
  const friendRecommendations: RecommendedUser[] = await res.json();

  return (
    <div className="p-4 rounded-2xl border-[1px] border-borderGray flex flex-col gap-4">
      {friendRecommendations.map((person) => (
        <div className="flex items-center justify-between" key={person.id}>
          {/* IMAGE AND USER INFO */}
          <Link href={`/${person.username}`} className="flex items-center gap-2 hover:opacity-80">
            <div className="relative rounded-full overflow-hidden w-10 h-10">
              <Image
                path={person.img || "general/noAvatar.png"}
                alt={person.username}
                w={100}
                h={100}
                tr={true}
              />
            </div>
            <div className="">
              <h1 className="text-md font-bold">{person.displayName || person.username}</h1>
              <span className="text-textGray text-sm">@{person.username}</span>
            </div>
          </Link>
          {/* BUTTON */}
          <FollowButton userId={person.id} isFollowed={false} username={person.username} />
        </div>
      ))}

      <Link href="/connect" className="text-iconBlue">
        Show More
      </Link>
    </div>
  );
};

export default Recommendations;
