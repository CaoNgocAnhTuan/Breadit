"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "./Image";
import { api } from "@/lib/api";

type UserResult = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

type Props = {
  onClose: () => void;
};

const NewConversationModal = ({ onClose }: Props) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await api(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.users as UserResult[]) ?? []);
      }
      setLoading(false);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const startConversation = async (targetUserId: string) => {
    const res = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    });
    if (res.ok) {
      const data = await res.json();
      onClose();
      router.push(`/messages/${data.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60">
      <div className="bg-black border border-borderGray rounded-2xl w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">New message</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#181818]"
          >
            <Image path="icons/close.svg" alt="close" w={20} h={20} />
          </button>
        </div>
        <input
          autoFocus
          type="text"
          placeholder="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent border border-borderGray rounded-full px-4 py-2 outline-none text-sm mb-3"
        />
        {loading && (
          <p className="text-sm text-textGray text-center py-2">Searching…</p>
        )}
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => startConversation(u.id)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#181818] text-left"
            >
              <div className="w-10 h-10 relative rounded-full overflow-hidden shrink-0">
                <Image
                  path={u.img || "general/noAvatar.png"}
                  alt=""
                  w={40}
                  h={40}
                  tr={true}
                />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {u.displayName || u.username}
                </p>
                <p className="text-textGray text-xs">@{u.username}</p>
              </div>
            </button>
          ))}
          {!loading && query.trim() && results.length === 0 && (
            <p className="text-sm text-textGray text-center py-2">
              No users found
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewConversationModal;
