"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function CreateCommunityForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api("/api/communities", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          description,
        }),
      });

      if (res.ok) {
        router.push(`/c/${slug}`);
      } else {
        try {
          const data = await res.json();
          const msg = data?.message;
          setError(Array.isArray(msg) ? msg[0] : (msg || "Something went wrong"));
        } catch {
          setError("Something went wrong");
        }
      }
    } catch (_err) {
      setError("Failed to create community");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-textGray">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          className="bg-transparent border border-borderGray rounded-lg p-2 outline-none focus:border-iconBlue transition"
          placeholder="Community Name"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-textGray">Slug (url)</label>
        <div className="flex items-center gap-1 border border-borderGray rounded-lg p-2 focus-within:border-iconBlue transition">
          <span className="text-textGray">c/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            required
            maxLength={30}
            className="bg-transparent outline-none flex-1"
            placeholder="community_slug"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-textGray">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
          rows={3}
          className="bg-transparent border border-borderGray rounded-lg p-2 outline-none focus:border-iconBlue transition resize-none"
          placeholder="What is this community about?"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-white text-black font-bold py-2 rounded-full hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Community"}
      </button>
    </form>
  );
}
