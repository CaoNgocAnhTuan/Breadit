"use client";

import { useSession } from "@/providers/SessionProvider";
import { api, apiMultipart, apiMultipartWithMethod } from "@/lib/api";
import Image from "./Image";
import RichText from "./RichText";
import MentionInput, { type MentionInputHandle } from "./MentionInput";
import { Comment as CommentType } from "@breadit/shared";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "timeago.js";
import Link from "next/link";
import Video from "./Video";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const MAX_THREAD_DEPTH = 5;

function CommentNode({
  comment,
  postId,
  depth = 0,
}: {
  comment: CommentType;
  postId: number;
  depth?: number;
}) {
  const session = useSession();
  const user = session?.user;
  const [collapsed, setCollapsed] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const replyRef = useRef<MentionInputHandle>(null);
  const editRef = useRef<MentionInputHandle>(null);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyPreviews, setReplyPreviews] = useState<string[]>([]);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  const [editExistingMedia, setEditExistingMedia] = useState(comment.media ?? []);
  const [editRemovedMediaIds, setEditRemovedMediaIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isEditing) return;
    editRef.current?.setValue(comment.body);
  }, [isEditing, comment.body]);

  const [likeState, setLikeState] = useState({
    count: comment._count?.likes ?? 0,
    isLiked: !!(comment.likes?.length),
  });

  const replyMutation = useMutation({
    mutationFn: async (body: string): Promise<unknown> => {
      const fd = new FormData();
      fd.append("body", body);
      fd.append("parentCommentId", String(comment.id));
      replyFiles.forEach((f) => fd.append("files", f));

      const res = await apiMultipart(`/api/posts/${postId}/comments`, fd);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: () => {
      if (replyRef.current) replyRef.current.setValue("");
      setReplyFiles([]);
      setReplyPreviews([]);
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/comments/${comment.id}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<{ liked: boolean; count: number }>;
    },
    onMutate: () => {
      setLikeState((prev) => ({
        count: prev.isLiked ? prev.count - 1 : prev.count + 1,
        isLiked: !prev.isLiked,
      }));
    },
    onSuccess: (data) => {
      setLikeState({ count: data.count, isLiked: data.liked });
    },
    onError: () => {
      setLikeState((prev) => ({
        count: prev.isLiked ? prev.count - 1 : prev.count + 1,
        isLiked: !prev.isLiked,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(String(res.status));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const body = editRef.current?.getValue()?.trim() ?? "";
      const fd = new FormData();
      fd.append("body", body);
      if (editRemovedMediaIds.length) {
        fd.append("mediaIdsToRemove", JSON.stringify(editRemovedMediaIds));
      }
      editFiles.forEach((f) => fd.append("files", f));

      const res = await apiMultipartWithMethod(`/api/comments/${comment.id}`, "PATCH", fd);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      setEditFiles([]);
      setEditPreviews([]);
      setEditRemovedMediaIds([]);
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const handleSubmitReply = () => {
    const body = replyRef.current?.getValue()?.trim();
    if (!body) return;
    replyMutation.mutate(body);
  };

  const handleReplyPickFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    setReplyFiles((prev) => [...prev, ...picked]);
    setReplyPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const handleReplyRemoveNew = (idx: number) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== idx));
    setReplyPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditPickFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    setEditFiles((prev) => [...prev, ...picked]);
    setEditPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const handleEditRemoveNew = (idx: number) => {
    setEditFiles((prev) => prev.filter((_, i) => i !== idx));
    setEditPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditRemoveExisting = (mediaId: number) => {
    setEditRemovedMediaIds((prev) => (prev.includes(mediaId) ? prev : [...prev, mediaId]));
    setEditExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const replies = comment.replies ?? [];
  const hasReplies = replies.length > 0;

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 py-1.5 group">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-textGray hover:text-white transition-colors text-sm"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="fill-current">
            <path d="M3 1.5L9 6L3 10.5V1.5Z" />
          </svg>
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
            <Image
              path={comment.user.img || "general/noAvatar.png"}
              alt=""
              w={20}
              h={20}
              tr
            />
          </div>
          <span className="font-medium">{comment.user.displayName || comment.user.username}</span>
          <span className="text-textGray">
            {likeState.count} points · {comment._count?.replies ?? 0} replies
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-0">
        {/* Thread line + avatar column */}
        <div className="flex flex-col items-center flex-shrink-0 w-8 mr-2">
          <Link href={`/${comment.user.username}`}>
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
              <Image
                path={comment.user.img || "general/noAvatar.png"}
                alt={comment.user.username}
                w={28}
                h={28}
                tr
              />
            </div>
          </Link>
          {/* Vertical thread line - clickable to collapse */}
          {(hasReplies || showReply) && (
            <button
              onClick={() => setCollapsed(true)}
              className="group/line flex-1 w-full flex justify-center cursor-pointer py-1"
              title="Collapse thread"
            >
              <div className="w-0.5 h-full bg-borderGray group-hover/line:bg-iconBlue transition-colors" />
            </button>
          )}
        </div>

        {/* Comment content */}
        <div className="flex-1 min-w-0 pb-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 flex-wrap text-sm">
            <Link
              href={`/${comment.user.username}`}
              className="font-bold hover:underline text-[13px]"
            >
              {comment.user.displayName || comment.user.username}
            </Link>
            <span className="text-textGray text-xs">
              @{comment.user.username}
            </span>
            <span className="text-textGray text-xs">
              · {format(comment.createdAt)}
              {new Date(comment.updatedAt).getTime() -
                new Date(comment.createdAt).getTime() >
                1000
                ? " (edited)"
                : ""}
            </span>
          </div>

          {/* Body */}
          {isEditing ? (
            <div className="mt-2">
              <MentionInput
                ref={editRef}
                rows={3}
                className="w-full bg-transparent border border-borderGray rounded-lg p-2 text-sm outline-none focus:border-iconBlue resize-none"
              />

              {(editExistingMedia.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editExistingMedia.map((m) => (
                    <div key={m.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-borderGray">
                      {m.type === "VIDEO" ? (
                        <div className="w-full h-full bg-black flex items-center justify-center text-xs text-textGray">
                          VIDEO
                        </div>
                      ) : (
                        <Image path={m.url} alt="" fill className="object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditRemoveExisting(m.id)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {editPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editPreviews.map((src, i) => (
                    <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border border-borderGray">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleEditRemoveNew(i)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <label className="text-xs text-textGray hover:text-white px-3 py-1 cursor-pointer">
                  Add media
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleEditPickFiles(e.target.files)}
                  />
                </label>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditFiles([]);
                    setEditPreviews([]);
                    setEditRemovedMediaIds([]);
                    setEditExistingMedia(comment.media ?? []);
                  }}
                  className="text-xs text-textGray hover:text-white px-3 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editMutation.mutate()}
                  disabled={editMutation.isPending}
                  className="text-xs font-bold bg-white text-black rounded-full px-4 py-1.5 disabled:opacity-50"
                >
                  {editMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[15px] mt-0.5 break-words whitespace-pre-wrap">
              <RichText text={comment.body} mentions={comment.mentions} />
            </p>
          )}

          {/* Media */}
          {(comment.media?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.media!.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-xl border border-borderGray">
                  {m.type === "VIDEO" ? (
                    <Video path={m.url} className="max-h-72 max-w-full" />
                  ) : (
                    <div className="relative w-[220px] h-[220px]">
                      <Image path={m.url} alt="" fill className="object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-1.5 text-textGray">
            {/* Like */}
            <button
              onClick={() => {
                if (!user) return;
                likeMutation.mutate();
              }}
              className="flex items-center gap-1 text-xs hover:text-iconPink transition-colors group"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  className={`${likeState.isLiked ? "fill-iconPink" : "fill-textGray"} group-hover:fill-iconPink`}
                  d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"
                />
              </svg>
              <span className={likeState.isLiked ? "text-iconPink" : ""}>
                {likeState.count > 0 ? likeState.count : ""}
              </span>
            </button>

            {/* Reply */}
            {depth < MAX_THREAD_DEPTH && user && (
              <button
                onClick={() => setShowReply(!showReply)}
                className="flex items-center gap-1 text-xs hover:text-iconBlue transition-colors group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path
                    className="fill-textGray group-hover:fill-iconBlue"
                    d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"
                  />
                </svg>
                <span>Reply</span>
              </button>
            )}

            {/* Delete (own comment) */}
            {user && user.id === comment.userId && (
              <>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditExistingMedia(comment.media ?? []);
                  }}
                  className="text-xs hover:text-white transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this comment?")) deleteMutation.mutate();
                  }}
                  className="text-xs hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Inline reply input */}
          {showReply && (
            <div className="mt-2 flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-1">
                <Image
                  path={user?.img || "general/noAvatar.png"}
                  alt=""
                  w={24}
                  h={24}
                  tr
                />
              </div>
              <div className="flex-1">
                <MentionInput
                  ref={replyRef}
                  rows={2}
                  className="w-full bg-transparent border border-borderGray rounded-lg p-2 text-sm outline-none focus:border-iconBlue resize-none"
                  placeholder={`Reply to @${comment.user.username}...`}
                  autoFocus
                />

                {replyPreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {replyPreviews.map((src, i) => (
                      <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border border-borderGray">
                        {/* preview may be video or image; show as image thumbnail */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleReplyRemoveNew(i)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-1">
                  <label className="text-xs text-textGray hover:text-white px-3 py-1 cursor-pointer">
                    Add media
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleReplyPickFiles(e.target.files)}
                    />
                  </label>
                  <button
                    onClick={() => setShowReply(false)}
                    className="text-xs text-textGray hover:text-white px-3 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReply}
                    disabled={replyMutation.isPending}
                    className="text-xs font-bold bg-white text-black rounded-full px-4 py-1.5 disabled:opacity-50"
                  >
                    {replyMutation.isPending ? "Replying..." : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Nested replies */}
          {hasReplies && (
            <div className="mt-1">
              {replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}

          {/* "Continue thread" link for deeply nested */}
          {depth >= MAX_THREAD_DEPTH && (comment._count?.replies ?? 0) > 0 && (
            <Link
              href={`#comment-${comment.id}`}
              className="text-iconBlue text-xs mt-1 inline-block hover:underline"
            >
              Continue this thread →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

type SortMode = "relevant" | "recent" | "top";

const SORT_OPTIONS: { value: SortMode; label: string; desc: string }[] = [
  { value: "relevant", label: "Relevant", desc: "Replies you're likely to care about most" },
  { value: "recent", label: "Recent", desc: "The latest replies" },
  { value: "top", label: "Top", desc: "Replies with the most likes" },
];

function SortDropdown({
  sort,
  onSort,
}: {
  sort: SortMode;
  onSort: (s: SortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === sort)!;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-borderGray">
      <span className="text-sm text-textGray">Replies</span>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-bold text-iconBlue hover:underline"
        >
          {current.label}
          <svg width="14" height="14" viewBox="0 0 24 24" className="fill-iconBlue">
            <path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z" />
          </svg>
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-8 z-50 bg-black border border-borderGray rounded-2xl shadow-lg w-72 py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-borderGray">
                <h4 className="font-bold text-[15px]">Sort replies</h4>
              </div>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onSort(opt.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold">{opt.label}</p>
                    <p className="text-textGray text-[13px] mt-0.5">{opt.desc}</p>
                  </div>
                  {sort === opt.value && (
                    <svg width="20" height="20" viewBox="0 0 24 24" className="fill-iconBlue flex-shrink-0 mt-0.5">
                      <path d="M9.64 18.952l-5.55-4.861 1.317-1.504 3.951 3.459 8.459-10.948L19.4 6.32 9.64 18.952z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Comments = ({ postId }: { postId: number }) => {
  const session = useSession();
  const user = session?.user;
  const commentRef = useRef<MentionInputHandle>(null);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [commentPreviews, setCommentPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("relevant");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", postId, sort],
    queryFn: async () => {
      const res = await fetch(
        `${BACKEND_URL}/api/posts/${postId}/comments?sort=${sort}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<CommentType[]>;
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const body = commentRef.current?.getValue()?.trim() ?? "";
      if (!body) throw new Error("empty");
      const fd = new FormData();
      fd.append("body", body);
      commentFiles.forEach((f) => fd.append("files", f));

      const res = await apiMultipart(`/api/posts/${postId}/comments`, fd);
      if (!res.ok) throw new Error(String(res.status));
    },
    onSuccess: () => {
      if (commentRef.current) commentRef.current.setValue("");
      setCommentFiles([]);
      setCommentPreviews([]);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err: Error) => {
      if (err.message === "empty") setError("Comment cannot be empty.");
      else if (err.message === "401") setError("Please sign in to comment.");
      else if (err.message === "403")
        setError("Please verify your email before commenting.");
      else setError("Something went wrong!");
    },
  });

  const handlePickCommentFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    setCommentFiles((prev) => [...prev, ...picked]);
    setCommentPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const handleRemoveCommentNew = (idx: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== idx));
    setCommentPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {/* Top-level comment input */}
      {user && (
        <div className="p-4 border-b border-borderGray">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1">
              <Image
                path={user?.img || "general/noAvatar.png"}
                alt="Avatar"
                w={32}
                h={32}
                tr
              />
            </div>
            <div className="flex-1">
              <MentionInput
                ref={commentRef}
                rows={2}
                className="w-full bg-transparent outline-none p-2 text-[15px] resize-none border border-borderGray rounded-lg focus:border-iconBlue"
                placeholder="What are your thoughts?"
              />
              {commentPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {commentPreviews.map((src, i) => (
                    <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border border-borderGray">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveCommentNew(i)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-1">
                <label className="mr-auto text-xs text-textGray hover:text-white px-2 py-1 cursor-pointer">
                  Add media
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePickCommentFiles(e.target.files)}
                  />
                </label>
                <button
                  onClick={() => commentMutation.mutate()}
                  disabled={commentMutation.isPending}
                  className="py-1.5 px-5 font-bold bg-white text-black rounded-full text-sm disabled:opacity-50"
                >
                  {commentMutation.isPending ? "Commenting..." : "Comment"}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <span className="text-red-400 text-sm mt-1 block ml-11">
              {error}
            </span>
          )}
        </div>
      )}

      {/* Sort dropdown */}
      <SortDropdown sort={sort} onSort={setSort} />

      {/* Comments list */}
      <div className="px-4 py-2">
        {isLoading ? (
          <p className="text-textGray text-sm py-4 text-center">
            Loading comments...
          </p>
        ) : comments.length === 0 ? (
          <p className="text-textGray text-sm py-4 text-center">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              postId={postId}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;
