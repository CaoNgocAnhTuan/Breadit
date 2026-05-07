"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "./Image";
import Video from "./Video";
import { apiMultipartWithMethod } from "@/lib/api";

type Media = { id: number; url: string; type: string };

export default function EditPostModal({
  postId,
  initialDesc,
  initialMedia,
  onClose,
}: {
  postId: number;
  initialDesc: string | null;
  initialMedia: Media[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [desc, setDesc] = useState(initialDesc ?? "");
  const [existingMedia, setExistingMedia] = useState<Media[]>(initialMedia);
  const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const canSave = useMemo(() => {
    return desc.trim().length > 0 || existingMedia.length > 0 || newFiles.length > 0;
  }, [desc, existingMedia.length, newFiles.length]);

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("desc", desc);
      if (removedMediaIds.length) {
        fd.append("mediaIdsToRemove", JSON.stringify(removedMediaIds));
      }
      newFiles.forEach((f) => fd.append("files", f));

      const res = await apiMultipartWithMethod(`/api/posts/${postId}`, "PATCH", fd);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      onClose();
    },
  });

  const removeExisting = (id: number) => {
    setRemovedMediaIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setExistingMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const pickNewFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    setNewFiles((prev) => [...prev, ...picked]);
    setNewPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removeNew = (idx: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-borderGray rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-borderGray">
          <h3 className="text-lg font-bold">Edit post</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-borderGray rounded-lg p-2 text-sm outline-none focus:border-iconBlue resize-none"
          />

          {existingMedia.length > 0 && (
            <div>
              <p className="text-xs text-textGray mb-2">Current media</p>
              <div className="flex flex-wrap gap-2">
                {existingMedia.map((m) => (
                  <div
                    key={m.id}
                    className="relative overflow-hidden rounded-xl border border-borderGray"
                  >
                    {m.type === "VIDEO" ? (
                      <Video path={m.url} className="w-[220px] h-[220px] object-cover" />
                    ) : (
                      <div className="relative w-[220px] h-[220px]">
                        <Image path={m.url} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExisting(m.id)}
                      className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 text-sm"
                      aria-label="Remove media"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newPreviews.length > 0 && (
            <div>
              <p className="text-xs text-textGray mb-2">New media</p>
              <div className="flex flex-wrap gap-2">
                {newPreviews.map((src, i) => (
                  <div
                    key={src}
                    className="relative overflow-hidden rounded-xl border border-borderGray w-[110px] h-[110px]"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNew(i)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 text-xs"
                      aria-label="Remove new media"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm text-iconBlue hover:underline cursor-pointer">
              Add media
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => pickNewFiles(e.target.files)}
              />
            </label>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSave}
              className="py-2 px-6 bg-white text-black font-bold rounded-full disabled:opacity-50 hover:bg-white/90 transition-colors"
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

