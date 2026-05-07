"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, apiMultipartWithMethod } from "@/lib/api";
import { format } from "timeago.js";
import Image from "@/components/Image";

type Member = {
  id: number;
  role: "MEMBER" | "MOD" | "OWNER";
  user: { id: string; username: string; displayName: string | null; img: string | null };
};

type BannedUser = {
  userId: string;
  reason: string | null;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null; img: string | null };
};

type PendingPost = {
  id: number;
  desc: string | null;
  createdAt: string;
  user: { username: string; displayName: string | null; img: string | null };
  media: { id: number; url: string; type: string }[];
};

export default function CommunityAboutAdmin({
  communityId,
  communitySlug,
  communityImg,
  communityCover,
  members,
  role,
}: {
  communityId: number;
  communitySlug: string;
  communityImg?: string | null;
  communityCover?: string | null;
  members: Member[];
  role: "OWNER" | "MOD";
}) {
  const router = useRouter();

  // ── Images (avatar / cover) ─────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imagesSaving, setImagesSaving] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const saveImages = async () => {
    if (!avatarFile && !coverFile) return;
    setImagesSaving(true);
    setImagesError(null);
    try {
      const fd = new FormData();
      if (avatarFile) fd.append("avatar", avatarFile);
      if (coverFile) fd.append("cover", coverFile);

      const res = await apiMultipartWithMethod(
        `/api/communities/${communityId}/images`,
        "PATCH",
        fd,
        60_000
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || "Failed to update community images");
      }

      // cleanup previews
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setAvatarFile(null);
      setCoverFile(null);
      setAvatarPreview(null);
      setCoverPreview(null);

      router.refresh();
    } catch (e) {
      setImagesError(e instanceof Error ? e.message : "Failed to update images");
    } finally {
      setImagesSaving(false);
    }
  };

  // ── Pending posts ──────────────────────────────────────────────
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  useEffect(() => {
    api(`/api/communities/${communityId}/posts/pending`)
      .then((r) => r.json())
      .then(setPendingPosts)
      .catch(() => setPendingPosts([]))
      .finally(() => setPendingLoading(false));
  }, [communityId]);

  const handleModerate = async (postId: number, action: "APPROVE" | "REMOVE") => {
    setModeratingId(postId);
    try {
      await api(`/api/communities/${communityId}/posts/${postId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
      if (action === "APPROVE") router.refresh();
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };

  // ── Add Rule ───────────────────────────────────────────────────
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState("");

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleLoading(true);
    setRuleError("");
    try {
      const res = await api(`/api/communities/${communityId}/rules`, {
        method: "POST",
        body: JSON.stringify({ title: ruleTitle, description: ruleDesc }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setRuleError(d.message || "Failed to add rule");
      } else {
        setRuleTitle("");
        setRuleDesc("");
        router.refresh();
      }
    } catch {
      setRuleError("Failed to add rule");
    } finally {
      setRuleLoading(false);
    }
  };

  // ── Banned Users list ──────────────────────────────────────────
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [bannedLoading, setBannedLoading] = useState(true);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/communities/${communityId}/bans`)
      .then((r) => r.json())
      .then(setBannedUsers)
      .catch(() => setBannedUsers([]))
      .finally(() => setBannedLoading(false));
  }, [communityId]);

  const handleUnban = async (userId: string) => {
    setUnbanningId(userId);
    try {
      await api(`/api/communities/${communityId}/ban/${userId}`, { method: "DELETE" });
      setBannedUsers((prev) => prev.filter((b) => b.userId !== userId));
    } catch {
      // ignore
    } finally {
      setUnbanningId(null);
    }
  };

  // ── Ban Members ────────────────────────────────────────────────
  const [banningId, setBanningId] = useState<string | null>(null);

  const handleBan = async (userId: string, username: string) => {
    if (!confirm(`Ban @${username} from this community?`)) return;
    setBanningId(userId);
    try {
      await api(`/api/communities/${communityId}/ban/${userId}`, { method: "POST" });
      router.refresh();
    } catch {
      // ignore
    } finally {
      setBanningId(null);
    }
  };

  // ── Delete Community ───────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api(`/api/communities/${communityId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/communities");
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const bannable = members.filter(
    (m) => m.role !== "OWNER" && (role === "OWNER" || m.role === "MEMBER"),
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Community Images */}
      <div className="border border-borderGray rounded-xl overflow-hidden">
        <div className="p-4 border-b border-borderGray flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Community images</h3>
            <p className="text-xs text-textGray">
              Owners and mods can update avatar and cover.
            </p>
          </div>
          <button
            onClick={saveImages}
            disabled={imagesSaving || (!avatarFile && !coverFile)}
            className="bg-white text-black font-bold text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {imagesSaving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Cover preview */}
        <div
          className="relative w-full aspect-[3/1] bg-iconBlue/10 cursor-pointer"
          onClick={() => coverInputRef.current?.click()}
        >
          <Image
            path={coverPreview ?? communityCover ?? undefined}
            alt="community cover"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-sm font-bold px-4 py-1.5 rounded-full bg-black/60 border border-white/10">
              Change cover
            </span>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
        </div>

        {/* Avatar preview */}
        <div className="p-4 flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-xl overflow-hidden border border-borderGray bg-iconBlue/20 cursor-pointer"
            onClick={() => avatarInputRef.current?.click()}
          >
            <Image
              path={avatarPreview ?? communityImg ?? "general/event.png"}
              alt="community avatar"
              fill
              className="object-cover object-center"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Avatar</p>
            <p className="text-xs text-textGray">
              Click the image to upload a new square avatar.
            </p>
            {imagesError && <p className="text-xs text-red-400 mt-2">{imagesError}</p>}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Pending Posts */}
      <div className="border border-borderGray rounded-xl p-4">
        <h3 className="font-bold mb-3">
          Pending Approval
          {pendingPosts.length > 0 && (
            <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {pendingPosts.length}
            </span>
          )}
        </h3>
        {pendingLoading ? (
          <p className="text-sm text-textGray">Loading...</p>
        ) : pendingPosts.length === 0 ? (
          <p className="text-sm text-textGray">No posts pending approval.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingPosts.map((p) => (
              <div key={p.id} className="border border-borderGray rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold">@{p.user.username}</span>
                  <span className="text-xs text-textGray">{format(p.createdAt)}</span>
                </div>
                {p.desc && <p className="text-sm mb-2">{p.desc}</p>}
                {p.media.length > 0 && (
                  <p className="text-xs text-textGray mb-2">[{p.media.length} attachment(s)]</p>
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
        )}
      </div>

      {/* Add Rule */}
      <div className="border border-borderGray rounded-xl p-4">
        <h3 className="font-bold mb-3">Add Rule</h3>
        <form onSubmit={handleAddRule} className="flex flex-col gap-2">
          <input
            value={ruleTitle}
            onChange={(e) => setRuleTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Rule title"
            className="bg-transparent border border-borderGray rounded-lg p-2 text-sm outline-none focus:border-iconBlue"
          />
          <input
            value={ruleDesc}
            onChange={(e) => setRuleDesc(e.target.value)}
            maxLength={500}
            placeholder="Description (optional)"
            className="bg-transparent border border-borderGray rounded-lg p-2 text-sm outline-none focus:border-iconBlue"
          />
          {ruleError && <p className="text-red-500 text-xs">{ruleError}</p>}
          <button
            type="submit"
            disabled={ruleLoading}
            className="bg-white text-black font-bold text-sm py-1.5 rounded-full disabled:opacity-50"
          >
            {ruleLoading ? "Adding..." : "Add Rule"}
          </button>
        </form>
      </div>

      {/* Ban Members */}
      {bannable.length > 0 && (
        <div className="border border-borderGray rounded-xl p-4">
          <h3 className="font-bold mb-3">Ban Members</h3>
          <div className="flex flex-col gap-2">
            {bannable.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-sm">@{m.user.username}</span>
                <button
                  onClick={() => handleBan(m.user.id, m.user.username)}
                  disabled={banningId === m.user.id}
                  className="text-xs text-red-400 border border-red-400/40 px-3 py-1 rounded-full hover:bg-red-400/10 transition disabled:opacity-50"
                >
                  {banningId === m.user.id ? "Banning..." : "Ban"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banned Users */}
      <div className="border border-borderGray rounded-xl p-4">
        <h3 className="font-bold mb-3">
          Banned Users
          {bannedUsers.length > 0 && (
            <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {bannedUsers.length}
            </span>
          )}
        </h3>
        {bannedLoading ? (
          <p className="text-sm text-textGray">Loading...</p>
        ) : bannedUsers.length === 0 ? (
          <p className="text-sm text-textGray">No banned users.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {bannedUsers.map((b) => (
              <div key={b.userId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">@{b.user.username}</p>
                  {b.reason && (
                    <p className="text-xs text-textGray truncate">Reason: {b.reason}</p>
                  )}
                  <p className="text-xs text-textGray">{format(b.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleUnban(b.userId)}
                  disabled={unbanningId === b.userId}
                  className="text-xs border border-green-500/40 text-green-400 px-3 py-1 rounded-full hover:bg-green-500/10 transition disabled:opacity-50 flex-shrink-0"
                >
                  {unbanningId === b.userId ? "..." : "Unban"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Community — owner only */}
      {role === "OWNER" && (
        <div className="border border-red-500/40 rounded-xl p-4">
          <h3 className="font-bold text-red-400 mb-1">Danger Zone</h3>
          <p className="text-xs text-textGray mb-3">
            Permanently delete this community, all its members, rules, and posts.
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-sm text-red-400 border border-red-400/40 px-4 py-1.5 rounded-full hover:bg-red-400/10 transition"
            >
              Delete Community
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm bg-red-500 text-white font-bold px-4 py-1.5 rounded-full disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-sm border border-borderGray px-4 py-1.5 rounded-full"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
