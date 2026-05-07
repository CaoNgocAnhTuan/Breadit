"use client";

import Image from "@/components/Image";
import { api } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CommunityHeader({ community }: { community: {
  id: number;
  name: string;
  slug: string;
  description?: string;
  img?: string;
  cover?: string;
  isBanned?: boolean;
  membership?: {
    id: number;
    role: "MEMBER" | "MOD" | "OWNER";
  } | null;
  _count?: {
    members: number;
    posts: number;
  };
} }) {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const role = community.membership?.role ?? null;
  const isStaff = role === "OWNER" || role === "MOD";
  const isMember = !!community.membership;
  const isBanned = community.isBanned ?? false;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/communities/${community.id}/join`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to join/leave community");
      return res.json();
    },
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message.includes("401")) router.push("/sign-in");
    },
  });

  const handleJoin = () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="border-b border-borderGray pb-4">
      <div className="relative w-full aspect-[3/1] bg-iconBlue/10 overflow-hidden">
        {community.cover && (
          <Image path={community.cover} alt="" fill className="object-cover object-center" />
        )}
      </div>
      <div className="px-4 -mt-6 flex justify-between items-end">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border-4 border-black bg-iconBlue/20">
          <Image path={community.img || "general/event.png"} alt={community.name} fill className="object-cover object-center" />
        </div>
        {isBanned ? (
          <span className="text-xs font-bold px-3 py-1 rounded-full border border-red-500 text-red-400">
            Banned
          </span>
        ) : isStaff ? (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              role === "OWNER"
                ? "border-yellow-500 text-yellow-400"
                : "border-blue-500 text-blue-400"
            }`}>
              {role}
            </span>
            <Link
              href={`/c/${community.slug}/about`}
              className="border border-borderGray text-white font-bold py-2 px-4 rounded-full text-sm hover:bg-white/10 transition"
            >
              Manage
            </Link>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={mutation.isPending}
            className={`${
              isMember
                ? "border border-borderGray text-white"
                : "bg-white text-black"
            } font-bold py-2 px-6 rounded-full transition hover:opacity-90`}
          >
            {mutation.isPending ? "..." : isMember ? "Leave" : "Join"}
          </button>
        )}
      </div>
      <div className="px-4 mt-2">
        <h1 className="text-xl font-bold">{community.name}</h1>
        <p className="text-textGray">c/{community.slug}</p>
        <div className="flex gap-4 mt-2 text-sm text-textGray">
          <span>
            <strong className="text-white">{community._count?.members || 0}</strong>{" "}
            Members
          </span>
          <span>
            <strong className="text-white">{community._count?.posts || 0}</strong>{" "}
            Posts
          </span>
        </div>
      </div>
      <div className="flex mt-4 px-2">
        <Link
          href={`/c/${community.slug}`}
          className="px-4 py-2 hover:bg-[#181818] border-b-4 border-transparent hover:border-iconBlue font-bold transition"
        >
          Feed
        </Link>
        <Link
          href={`/c/${community.slug}/about`}
          className="px-4 py-2 hover:bg-[#181818] border-b-4 border-transparent hover:border-iconBlue font-bold transition"
        >
          About
        </Link>
      </div>
    </div>
  );
}
