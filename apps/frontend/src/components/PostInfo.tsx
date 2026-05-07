"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import Image from "./Image";
import EditPostModal from "./EditPostModal";

type PostPage = { posts: { id: number }[]; hasMore: boolean };

const PostInfo = ({
  postId,
  postUserId,
  postDesc,
  postMedia,
}: {
  postId: number;
  postUserId: string;
  postDesc: string | null;
  postMedia: { id: number; url: string; type: string }[];
}) => {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const session = useSession();
  const isOwner = session?.user?.id === postUserId;
  const isLoggedIn = !!session?.user;

  const queryClient = useQueryClient();
  const router = useRouter();

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const reportMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await api(`/api/posts/${postId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(String(res.status));
    },
    onSuccess: () => {
      setReported(true);
      setShowReportModal(false);
      setReportReason("");
      // auto-reset feedback after 3s
      setTimeout(() => setReported(false), 3000);
    },
    onError: () => {
      setReportError(true);
      setShowReportModal(false);
      setTimeout(() => setReportError(false), 3000);
    },
  });

  const handleReportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setShowReportModal(true);
  };

  const submitReport = () => {
    if (!reportReason.trim()) return;
    reportMutation.mutate(reportReason);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    },
    onMutate: async () => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      await queryClient.cancelQueries({ queryKey: ["profile-posts"] });

      // Optimistically remove from ALL feed variants (prefix match via setQueriesData)
      queryClient.setQueriesData<{ pages: PostPage[] }>(
        { queryKey: ["posts"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((p) => p.id !== postId),
            })),
          };
        }
      );
      queryClient.setQueriesData<{ pages: PostPage[] }>(
        { queryKey: ["profile-posts"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((p) => p.id !== postId),
            })),
          };
        }
      );
    },
    onError: () => {
      // Revert by invalidating — refetch will restore the post
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      setDeleteError(true);
      setTimeout(() => setDeleteError(false), 3000);
    },
    onSuccess: () => {
      // Confirm the optimistic removal with a real refetch + RSC refresh
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      router.refresh();
    },
  });

  if (!isOwner) {
    if (!isLoggedIn) {
      return (
        <div className="cursor-pointer w-4 h-4 relative">
          <Image path="icons/infoMore.svg" alt="" w={16} h={16} />
        </div>
      );
    }

    return (
      <div className="relative">
        <div
          className="cursor-pointer w-4 h-4"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        >
          <Image path="icons/infoMore.svg" alt="" w={16} h={16} />
        </div>
        {open && (
          <div className="absolute right-0 top-6 bg-black border border-borderGray rounded-xl shadow-lg z-20 min-w-[160px]">
            {reported ? (
              <p className="px-4 py-3 text-sm text-green-400 font-semibold">Reported ✓</p>
            ) : reportError ? (
              <p className="px-4 py-3 text-sm text-red-400">Failed to report</p>
            ) : (
              <button
                onClick={handleReportClick}
                disabled={reportMutation.isPending}
                className="w-full text-left px-4 py-3 text-textGray hover:bg-white/10 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {reportMutation.isPending ? "Reporting…" : "Report post"}
              </button>
            )}
          </div>
        )}
        {showReportModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowReportModal(false)}
          >
            <div 
              className="bg-black border border-borderGray rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold">Report Post</h3>
              <p className="text-textGray text-sm">Why are you reporting this post?</p>
              <textarea
                autoFocus
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason (e.g. Spam, Harassment, etc.)"
                className="bg-transparent border border-borderGray rounded-xl p-3 text-sm outline-none min-h-[100px] resize-none focus:border-white transition-colors"
                maxLength={500}
              />
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="py-2 px-6 rounded-full font-bold border border-borderGray hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={reportMutation.isPending || !reportReason.trim()}
                  onClick={submitReport}
                  className="py-2 px-6 bg-white text-black font-bold rounded-full disabled:opacity-50 hover:bg-white/90 transition-colors"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        )}
        {reportError && (
          <p className="absolute right-0 top-10 text-xs text-red-400 bg-black border border-borderGray rounded px-2 py-1 z-20">
            Could not report post
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="cursor-pointer w-4 h-4"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Image path="icons/infoMore.svg" alt="" w={16} h={16} />
      </div>
      {open && (
        <div className="absolute right-0 top-6 bg-black border border-borderGray rounded-xl shadow-lg z-20 min-w-[160px]">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setShowEditModal(true);
            }}
            className="w-full text-left px-4 py-3 text-textGray hover:bg-white/10 rounded-xl text-sm font-semibold"
          >
            Edit post
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="w-full text-left px-4 py-3 text-red-400 hover:bg-white/10 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete post"}
          </button>
        </div>
      )}
      {showEditModal && (
        <EditPostModal
          postId={postId}
          initialDesc={postDesc}
          initialMedia={postMedia}
          onClose={() => setShowEditModal(false)}
        />
      )}
      {deleteError && (
        <p className="absolute right-0 top-10 text-xs text-red-400 bg-black border border-borderGray rounded px-2 py-1 z-20">
          Could not delete post
        </p>
      )}
    </div>
  );
};

export default PostInfo;
