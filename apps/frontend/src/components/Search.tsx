"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "./Image";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type SearchUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

type SearchHashtag = { id: number; tag: string };

type SearchCommunity = { id: number; name: string; slug: string; img: string | null };

type SearchResults = {
  posts: {
    id: number;
    desc: string;
    user: { username: string };
  }[];
  users: SearchUser[];
  hashtags: SearchHashtag[];
  communities: SearchCommunity[];
};

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`,
          { credentials: "include" }
        );
        if (res.ok) setResults(await res.json());
      } catch {
        /* ignore */
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasResults =
    results &&
    (results.users.length > 0 ||
      results.hashtags.length > 0 ||
      results.communities?.length > 0 ||
      results.posts.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="bg-inputGray py-2 px-4 flex items-center gap-4 rounded-full">
        <Image path="icons/explore.svg" alt="search" w={16} h={16} />
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="bg-transparent outline-none placeholder:text-textGray w-full"
        />
      </form>

      {open && query.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-black border border-borderGray rounded-2xl shadow-xl overflow-hidden">
          {!hasResults && (
            <p className="p-4 text-textGray text-sm">No results for &ldquo;{query}&rdquo;</p>
          )}

          {results && results.users.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">People</p>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { router.push(`/${u.username}`); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-left"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={u.img || undefined} alt={u.username} w={32} h={32} tr />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{u.displayName ?? u.username}</p>
                    <p className="text-textGray text-xs">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results && results.communities && results.communities.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">Communities</p>
              {results.communities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { router.push(`/c/${c.slug}`); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-left"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-iconBlue/20">
                    <Image path={c.img || "icons/community.svg"} alt={c.name} w={32} h={32} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{c.name}</p>
                    <p className="text-textGray text-xs">c/{c.slug}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results && results.hashtags.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">Hashtags</p>
              {results.hashtags.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { router.push(`/hashtag/${h.tag}`); setOpen(false); setQuery(""); }}
                  className="w-full px-4 py-2 hover:bg-white/5 text-left text-sm font-semibold"
                >
                  #{h.tag}
                </button>
              ))}
            </div>
          )}

          {results && results.posts.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">Posts</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.posts.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => { router.push(`/${p.user.username}/status/${p.id}`); setOpen(false); setQuery(""); }}
                  className="w-full px-4 py-2 hover:bg-white/5 text-left text-sm"
                >
                  <span className="text-textGray text-xs">@{p.user.username} · </span>
                  <span className="line-clamp-1">{p.desc}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { router.push(`/search?q=${encodeURIComponent(query.trim())}`); setOpen(false); setQuery(""); }}
            className="w-full px-4 py-3 text-left text-sm text-iconBlue hover:bg-white/5 border-t border-borderGray"
          >
            See all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
};

export default Search;
