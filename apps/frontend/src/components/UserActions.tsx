"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import FollowButton from "./FollowButton";
import Image from "./Image";
import { api } from "@/lib/api";

const UserActions = ({
  userId,
  isFollowed,
  youBlockedThem,
  theyBlockedYou,
  username,
}: {
  userId: string;
  isFollowed: boolean;
  youBlockedThem: boolean;
  theyBlockedYou: boolean;
  username: string;
}) => {
  const [youBlocked, setYouBlocked] = useState(youBlockedThem);
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const blockMutation = useMutation({
    mutationFn: () =>
      api(`/api/users/${userId}/block`, { method: "POST" }),
    onMutate: () => setYouBlocked((b) => !b),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      router.refresh();
    },
    onError: () => setYouBlocked((b) => !b),
  });

  if (theyBlockedYou && !youBlocked) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-500 cursor-pointer hover:bg-white/10"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Image path="icons/more.svg" alt="more" w={20} h={20} />
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-10 bg-black border border-borderGray rounded-xl shadow-lg z-10 min-w-[180px]">
            <button
              onClick={() => {
                setMenuOpen(false);
                blockMutation.mutate();
              }}
              disabled={blockMutation.isPending}
              className="w-full text-left px-4 py-3 text-red-400 hover:bg-white/10 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {youBlocked ? `Unblock @${username}` : `Block @${username}`}
            </button>
          </div>
        )}
      </div>
      {!youBlocked && (
        <FollowButton
          userId={userId}
          isFollowed={isFollowed}
          username={username}
        />
      )}
    </div>
  );
};

export default UserActions;
