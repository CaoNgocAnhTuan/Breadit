"use client";

import { useSession } from "@/providers/SessionProvider";
import Image from "./Image";
import Post from "./Post";
import { Post as PostType } from "@breadit/shared";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiMultipart } from "@/lib/api";

type CommentWithDetails = PostType & {
  user: { displayName: string | null; username: string; img: string | null };
  _count: { likes: number; rePosts: number; comments: number };
  likes: { id: number }[];
  rePosts: { id: number }[];
  saves: { id: number }[];
};

const Comments = ({
  comments,
  postId,
  depth = 0,
}: {
  comments: CommentWithDetails[];
  postId: number;
  username: string;
  depth?: number;
}) => {
  const session = useSession();
  const user = session?.user;
  const descRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const commentMutation = useMutation({
    mutationFn: async () => {
      const desc = descRef.current?.value?.trim() ?? "";
      const formData = new FormData();
      if (desc) formData.append("desc", desc);
      const res = await apiMultipart(`/api/posts/${postId}/comments`, formData);
      if (!res.ok) throw new Error(String(res.status));
    },
    onSuccess: () => {
      if (descRef.current) descRef.current.value = "";
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      router.refresh();
    },
    onError: (err: Error) => {
      if (err.message === "401") setError("Please sign in to reply.");
      else if (err.message === "403") setError("Please verify your email before replying.");
      else setError("Something went wrong!");
    },
  });

  return (
    <div className="">
      {depth >= 1 ? (
        <p className="text-textGray text-sm px-4 py-2">Reply to the original post above ↑</p>
      ) : user && (
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="relative w-10 h-10 rounded-full overflow-hidden -z-10">
            <Image path={user?.img || "general/noAvatar.png"} alt="Avatar" w={100} h={100} tr={true} />
          </div>
          <input
            ref={descRef}
            type="text"
            className="flex-1 bg-transparent outline-none p-2 text-xl"
            placeholder="Post your reply"
          />
          <button
            onClick={() => commentMutation.mutate()}
            disabled={commentMutation.isPending}
            className="py-2 px-4 font-bold bg-white text-black rounded-full disabled:cursor-not-allowed disabled:bg-slate-200"
          >
            {commentMutation.isPending ? "Replying" : "Reply"}
          </button>
        </div>
      )}
      {error && <span className="text-red-300 p-4">{error}</span>}
      {comments.map((comment) => (
        <div key={comment.id}>
          <Post post={comment} type="comment" />
        </div>
      ))}
    </div>
  );
};

export default Comments;
