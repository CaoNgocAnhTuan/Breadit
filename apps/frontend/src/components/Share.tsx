"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "./Image";
import NextImage from "next/image";
import ImageEditor from "./ImageEditor";
import MentionInput, { type MentionInputHandle } from "./MentionInput";
import { useSession } from "@/providers/SessionProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMultipart } from "@/lib/api";

const Share = ({ communityId }: { communityId?: number }) => {
  const [mediaList, setMediaList] = useState<{ file: File; preview: string }[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [settings, setSettings] = useState<{
    type: "original" | "wide" | "square";
    sensitive: boolean;
  }>({
    type: "original",
    sensitive: false,
  });
  const [error, setError] = useState<string | null>(null);

  const descRef = useRef<MentionInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      const descVal = descRef.current?.getValue();
      if (descVal) formData.append("desc", descVal);
      formData.append("imgType", settings.type);
      if (settings.sensitive) formData.append("isSensitive", "true");
      if (communityId) formData.append("communityId", communityId.toString());
      mediaList.forEach(({ file }) => {
        formData.append("file", file);
      });

      const res = await apiMultipart("/api/posts", formData);
      if (!res.ok) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.message ?? "";
        } catch {}
        throw new Error(`${res.status}${detail ? `: ${detail}` : ""}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (descRef.current) descRef.current.setValue("");
      mediaList.forEach((m) => URL.revokeObjectURL(m.preview));
      setMediaList([]);
      setSettings({ type: "original", sensitive: false });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(null);
    },
    onError: (err: Error) => {
      if (err.message.startsWith("401")) {
        router.push("/sign-in");
      } else if (err.message.startsWith("403")) {
        setError("Please verify your email before posting.");
      } else if (err.message.startsWith("413")) {
        setError("File too large (max 500 MB).");
      } else if (err.name === "AbortError") {
        setError("Upload timed out. Try a smaller file or check your connection.");
      } else {
        setError(`Post failed: ${err.message}`);
      }
    },
  });

  const handlePost = () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    if (!user.emailVerified) {
      setError("Please verify your email before posting.");
      return;
    }
    mutation.mutate();
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setMediaList((prev) => [...prev, ...newFiles]);
    }
  };

  const removeMedia = (idx: number) => {
    setMediaList((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  };

  const openEditor = (idx: number) => {
    setEditingIdx(idx);
    setIsEditorOpen(true);
  };

  return (
    <div className="p-4 flex gap-4">
      {/* AVATAR */}
      <div className="relative w-10 h-10 rounded-full overflow-hidden">
        <Image path={user?.img || "general/noAvatar.png"} alt="" fill className="object-cover object-center" tr={true} />
      </div>
      {/* OTHERS */}
      <div className="flex-1 flex flex-col gap-4">
        <MentionInput
          ref={descRef}
          variant="input"
          placeholder="What is happening?!"
          className="bg-transparent outline-none placeholder:text-textGray text-xl w-full"
        />
        {/* PREVIEW MEDIA LIST */}
        {mediaList.length > 0 && (
          <div className={`grid gap-2 ${mediaList.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {mediaList.map((m, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden group">
                {m.file.type.includes("image") ? (
                  <NextImage
                    src={m.preview}
                    alt=""
                    width={600}
                    height={600}
                    className={`w-full h-full object-cover`}
                  />
                ) : (
                  <video src={m.preview} controls className="w-full h-full object-cover" />
                )}
                
                <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.file.type.includes("image") && (
                    <div
                      className="bg-black bg-opacity-50 text-white py-1 px-4 rounded-full font-bold text-sm cursor-pointer"
                      onClick={() => openEditor(idx)}
                    >
                      Edit
                    </div>
                  )}
                </div>
                <div
                  className="absolute top-2 right-2 bg-black bg-opacity-50 text-white h-8 w-8 flex items-center justify-center rounded-full cursor-pointer font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeMedia(idx)}
                >
                  X
                </div>
              </div>
            ))}
          </div>
        )}

        {isEditorOpen && editingIdx !== null && mediaList[editingIdx] && (
          <ImageEditor
            onClose={() => {
              setIsEditorOpen(false);
              setEditingIdx(null);
            }}
            previewURL={mediaList[editingIdx].preview}
            settings={settings}
            setSettings={setSettings}
          />
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-4 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleMediaChange}
              className="hidden"
              id="file"
              accept="image/*,video/*"
              multiple
            />
            <label htmlFor="file">
              <Image
                path="icons/image.svg"
                alt=""
                w={20}
                h={20}
                className="cursor-pointer"
              />
            </label>
            <Image path="icons/gif.svg" alt="" w={20} h={20} className="cursor-pointer" />
            <Image path="icons/poll.svg" alt="" w={20} h={20} className="cursor-pointer" />
            <Image path="icons/emoji.svg" alt="" w={20} h={20} className="cursor-pointer" />
            <Image path="icons/schedule.svg" alt="" w={20} h={20} className="cursor-pointer" />
            <Image path="icons/location.svg" alt="" w={20} h={20} className="cursor-pointer" />
          </div>
          <button
            onClick={handlePost}
            disabled={mutation.isPending}
            className="bg-iconBlue text-white font-bold rounded-full py-1.5 px-4 text-sm hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Posting" : "Post"}
          </button>
          {error && (
            <span className="text-red-300 p-4">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Share;
