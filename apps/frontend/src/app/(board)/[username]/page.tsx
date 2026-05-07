import type { Metadata } from "next";
import ProfileTabs from "@/components/ProfileTabs";
import UserActions from "@/components/UserActions";
import EditProfileButton from "@/components/EditProfileButton";
import MessageButton from "@/components/MessageButton";
import Image from "@/components/Image";
import ProfilePostSearch from "@/components/ProfilePostSearch";
import { getSession, serverFetch } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";

const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

function resolveImg(p?: string | null): string | undefined {
  if (!p) return undefined;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (!p.includes("/")) return `${BACKEND_INTERNAL}/uploads/${p}`;
  return undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const res = await serverFetch(`/api/users/${username}`);
  if (!res.ok) return {};
  const user = await res.json();
  const name = user.displayName ?? username;
  const title = `${name} (@${username})`;
  const img = resolveImg(user.img);
  return {
    title,
    description: user.bio ?? undefined,
    openGraph: {
      title,
      description: user.bio ?? undefined,
      ...(img ? { images: [{ url: img }] } : {}),
    },
    twitter: { card: img ? "summary" : "summary", title },
  };
}

const UserPage = async ({
  params,
}: {
  params: Promise<{ username: string }>;
}) => {
  const session = await getSession();
  const userId = session?.user?.id;

  const username = (await params).username;

  const res = await serverFetch(`/api/users/${username}`);
  if (!res.ok) return notFound();
  const user = await res.json();

  return (
    <div className="">
      {/* PROFILE TITLE */}
      <div className="flex items-center gap-8 sticky top-0 backdrop-blur-md p-4 z-10 bg-[#00000084]">
        <Link href="/">
          <Image path="icons/back.svg" alt="back" w={24} h={24} />
        </Link>
        <h1 className="font-bold text-lg">{user.displayName}</h1>
      </div>
      {/* INFO */}
      <div className="">
        {/* COVER & AVATAR CONTAINER */}
        <div className="relative w-full">
          {/* COVER */}
          <div className="w-full aspect-[3/1] relative">
            <Image
              path={user.cover || "general/noCover.png"}
              alt=""
              w={600}
              h={200}
              tr={true}
            />
          </div>
          {/* AVATAR */}
          <div className="relative w-1/5 aspect-square rounded-full overflow-hidden border-4 border-black bg-gray-300 absolute left-4 top-full -translate-y-1/2">
            <Image
              path={user.img || "general/noAvatar.png"}
              alt=""
              fill
              className="object-cover object-center"
              tr={true}
            />
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-2 p-2">
          {userId && userId !== user.id && (
            <MessageButton targetUserId={user.id} />
          )}
          {userId && userId === user.id ? (
            <EditProfileButton user={session!.user} />
          ) : userId && (
            <UserActions
              userId={user.id}
              isFollowed={!!user.followings.length}
              isBlocked={user.isBlocked ?? false}
              username={username}
            />
          )}
        </div>
        {/* USER DETAILS */}
        <div className="p-4 pt-0 flex flex-col gap-2" style={{ marginTop: '-5rem' }}>
          {/* USERNAME & HANDLE */}
          <div className="">
            <h1 className="text-2xl font-bold">{user.displayName}</h1>
            <span className="text-textGray text-sm">@{user.username}</span>
          </div>
          {user.bio && <p>{user.bio}</p>}
          {/* JOB & LOCATION & DATE */}
          <div className="flex gap-4 text-textGray text-[15px]">
            {user.location && (
              <div className="flex items-center gap-2">
                <Image
                  path="icons/userLocation.svg"
                  alt="location"
                  w={20}
                  h={20}
                />
                <span>{user.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Image path="icons/date.svg" alt="date" w={20} h={20} />
              <span>
                Joined{" "}
                {new Date(user.createdAt.toString()).toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric" }
                )}
              </span>
            </div>
          </div>
          {/* FOLLOWINGS & FOLLOWERS */}
          <div className="flex gap-4">
            <Link href={`/${username}/following`} className="flex items-center gap-2 hover:underline">
              <span className="font-bold">{user._count.followers}</span>
              <span className="text-textGray text-[15px]">Following</span>
            </Link>
            <Link href={`/${username}/followers`} className="flex items-center gap-2 hover:underline">
              <span className="font-bold">{user._count.followings}</span>
              <span className="text-textGray text-[15px]">Followers</span>
            </Link>
          </div>
        </div>
      </div>
      {/* PROFILE TABS */}
      <ProfilePostSearch username={username} />
    </div>
  );
};

export default UserPage;
