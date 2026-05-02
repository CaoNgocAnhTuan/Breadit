"use client";

import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiMultipart } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import NextImage from "next/image";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function resolveImgSrc(path: string | null | undefined, fallback: string) {
  if (!path) return `/${fallback}`;
  if (path.startsWith("http") || path.startsWith("/") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${BACKEND_URL}/uploads/${path}`;
}

export default function EditProfileModal({
  user,
  onClose,
}: {
  user: SessionUser;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [job, setJob] = useState(user.job ?? "");
  const [website, setWebsite] = useState(user.website ?? "");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const mutation = useMutation({
    mutationFn: async () => {
      let imgFilename: string | undefined;
      let coverFilename: string | undefined;

      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        fd.append("imgType", "square");
        const res = await apiMultipart("/api/uploads", fd);
        if (!res.ok) throw new Error("Avatar upload failed");
        const data = await res.json() as { filename: string };
        imgFilename = data.filename;
      }

      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        fd.append("imgType", "wide");
        const res = await apiMultipart("/api/uploads", fd);
        if (!res.ok) throw new Error("Cover upload failed");
        const data = await res.json() as { filename: string };
        coverFilename = data.filename;
      }

      const body: Record<string, string> = {
        displayName,
        bio,
        location,
        job,
        website,
      };
      if (imgFilename) body.img = imgFilename;
      if (coverFilename) body.cover = coverFilename;

      const res = await api("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Profile update failed");
    },
    onSuccess: () => {
      window.location.href = `/${user.username}`;
    },
  });

  const currentAvatar = avatarPreview ?? resolveImgSrc(user.img, "general/noAvatar.png");
  const currentCover = coverPreview ?? resolveImgSrc(user.cover, "general/noCover.png");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-black border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-black z-10">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-white font-bold text-lg leading-none">✕</button>
            <h2 className="font-bold text-lg">Edit profile</h2>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-white text-black font-bold text-sm px-4 py-1.5 rounded-full disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Cover */}
        <div className="relative w-full aspect-[3/1] bg-gray-800 cursor-pointer" onClick={() => coverInputRef.current?.click()}>
          <NextImage src={currentCover} alt="cover" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-2xl">🖼</span>
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-10 mb-4 relative">
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-4 border-black bg-gray-600 cursor-pointer relative"
            onClick={() => avatarInputRef.current?.click()}
          >
            <NextImage src={currentAvatar} alt="avatar" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
              <span className="text-white text-xl">📷</span>
            </div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Fields */}
        <div className="px-4 pb-6 flex flex-col gap-4">
          {mutation.isError && (
            <p className="text-red-500 text-sm">{(mutation.error as Error).message}</p>
          )}

          <Field label="Name" value={displayName} onChange={setDisplayName} maxLength={50} />
          <Field label="Bio" value={bio} onChange={setBio} maxLength={160} multiline />
          <Field label="Location" value={location} onChange={setLocation} maxLength={30} />
          <Field label="Job" value={job} onChange={setJob} maxLength={60} />
          <Field label="Website" value={website} onChange={setWebsite} maxLength={100} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (_v: string) => void;
  maxLength: number;
  multiline?: boolean;
}) {
  const cls =
    "w-full bg-transparent border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className={cls}
        />
      )}
    </div>
  );
}
