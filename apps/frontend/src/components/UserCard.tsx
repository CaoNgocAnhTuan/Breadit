import Image from "./Image";
import Link from "next/link";

type UserSummary = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  bio: string | null;
};

const UserCard = ({ user }: { user: UserSummary }) => {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-borderGray hover:bg-white/5 transition-colors">
      <Link href={`/${user.username}`} className="shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            path={user.img || "general/noAvatar.png"}
            alt=""
            w={40}
            h={40}
            tr={true}
          />
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/${user.username}`}>
          <p className="font-bold hover:underline truncate">
            {user.displayName || user.username}
          </p>
          <p className="text-textGray text-sm">@{user.username}</p>
        </Link>
        {user.bio && (
          <p className="text-sm mt-1 text-gray-300 line-clamp-2">{user.bio}</p>
        )}
      </div>
    </div>
  );
};

export default UserCard;
