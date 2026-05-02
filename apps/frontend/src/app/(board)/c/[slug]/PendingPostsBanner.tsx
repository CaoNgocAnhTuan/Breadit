"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { format } from "timeago.js";

type PendingPost = {
  id: number;
  desc: string | null;
  createdAt: string;
  user: { username: string; displayName: string | null };
  media: { id: number }[];
};

export default function PendingPostsBanner({ communityId }: { communityId: number }) {
  const router = useRouter();
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  useEffect(() => {
    api(`/api/communities/${communityId}/posts/pending`)
      .then((r) => r.json())
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [communityId]);

  const handleModerate = async (postId: number, action: "APPROVE" | "REMOVE") => {
    setModeratingId(postId);
    try {
      await api(`/api/communities/${communityId}/posts/${postId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (action === "APPROVE") router.refresh();
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  if (loading || posts.length === 0) return null;

  return (
    <div className="border-b border-borderGray bg-yellow-500/5 px-4 py-3">
      <h3 className="text-sm font-bold text-yellow-400 mb-3">
        Pending Approval
        <span className="ml-2 text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full">
          {posts.length}
        </span>
      </h3>
      <div className="flex flex-col gap-3">
        {posts.map((p) => (
          <div key={p.id} className="border border-borderGray rounded-lg p-3 bg-black/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold">@{p.user.username}</span>
              <span className="text-xs text-textGray">{format(p.createdAt)}</span>
              {p.media.length > 0 && (
                <span className="text-xs text-textGray">[{p.media.length} attachment(s)]</span>
              )}
            </div>
            {p.desc && (
              <p className="text-sm text-textGray mb-2 line-clamp-2">{p.desc}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleModerate(p.id, "APPROVE")}
                disabled={moderatingId === p.id}
                className="text-xs bg-green-600 text-white font-bold px-3 py-1 rounded-full disabled:opacity-50 hover:bg-green-700 transition"
              >
                {moderatingId === p.id ? "..." : "Approve"}
              </button>
              <button
                onClick={() => handleModerate(p.id, "REMOVE")}
                disabled={moderatingId === p.id}
                className="text-xs border border-red-400/40 text-red-400 px-3 py-1 rounded-full disabled:opacity-50 hover:bg-red-400/10 transition"
              >
                {moderatingId === p.id ? "..." : "Reject"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
