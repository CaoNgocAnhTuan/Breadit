"use client";

import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";

const FollowButton = ({
  userId,
  isFollowed,
}: {
  userId: string;
  isFollowed: boolean;
  username: string;
}) => {
  const [following, setFollowing] = useState(isFollowed);

  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/users/${userId}/follow`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<{ following: boolean }>;
    },
    onMutate: () => {
      setFollowing((prev) => !prev);
    },
    onSuccess: (data) => {
      setFollowing(data.following);
      router.refresh();
    },
    onError: () => {
      setFollowing((prev) => !prev);
    },
  });

  if (!user) {
    return (
      <button
        onClick={() => router.push("/sign-in")}
        className="py-2 px-4 bg-white text-black font-bold rounded-full"
      >
        Follow
      </button>
    );
  }

  return (
    <button
      onClick={() => followMutation.mutate()}
      disabled={followMutation.isPending}
      className="py-2 px-4 bg-white text-black font-bold rounded-full disabled:opacity-70"
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
};

export default FollowButton;
