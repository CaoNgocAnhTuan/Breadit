"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "@/components/Image";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

type BlockedUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

export default function BlockedAccountsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ["blocked-accounts"],
    queryFn: async () => {
      const res = await api("/api/users/me/blocked");
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ users: BlockedUser[] }>;
    },
  });

  const unblock = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/users/${userId}/block`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      router.refresh();
    },
  });

  const users = data?.users ?? [];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 backdrop-blur-md p-4 z-10 border-b border-borderGray bg-black/50 flex items-center gap-4">
        <Link href="/settings" className="p-1 rounded-full hover:bg-white/10">
          <Image path="icons/back.svg" alt="Back" w={20} h={20} />
        </Link>
        <h1 className="font-bold text-xl">Blocked accounts</h1>
      </div>
      <p className="px-4 py-3 text-textGray text-sm border-b border-borderGray">
        People you’ve blocked won’t appear in your feeds or searches and can’t message you.
      </p>
      {isPending && (
        <p className="p-8 text-center text-textGray">Loading…</p>
      )}
      {isError && (
        <p className="p-8 text-center text-red-400">Could not load the list.</p>
      )}
      {!isPending && !isError && users.length === 0 && (
        <p className="p-8 text-center text-textGray">You haven’t blocked anyone.</p>
      )}
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center justify-between gap-3 px-4 py-3 border-b border-borderGray hover:bg-white/5"
        >
          <Link href={`/${u.username}`} className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image
                path={u.img || "general/noAvatar.png"}
                alt=""
                fill
                className="object-cover object-center"
                tr
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{u.displayName ?? u.username}</p>
              <p className="text-textGray text-sm truncate">@{u.username}</p>
            </div>
          </Link>
          <button
            type="button"
            disabled={unblock.isPending}
            onClick={() => unblock.mutate(u.id)}
            className="text-sm font-semibold text-iconBlue hover:underline disabled:opacity-50 flex-shrink-0"
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}
