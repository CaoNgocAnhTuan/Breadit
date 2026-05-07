"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/Image";
import ProfileTabs from "@/components/ProfileTabs";

export default function ProfilePostSearch({ username }: { username: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = useMemo(() => debounced.length > 0, [debounced]);

  return (
    <div>
      <div id="profile-post-search" className="border-b border-borderGray">
        {!open ? (
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-textGray">Search this profile</p>
            <button
              onClick={() => {
                setOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-borderGray hover:bg-white/5 transition-colors"
              aria-label="Search profile posts"
              title="Search"
            >
              <Image path="icons/explore.svg" alt="" w={18} h={18} />
            </button>
          </div>
        ) : (
          <div className="px-4 pt-2 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border border-borderGray flex items-center justify-center flex-shrink-0">
                <Image path="icons/explore.svg" alt="" w={18} h={18} />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts on this profile"
                className="flex-1 bg-transparent outline-none placeholder:text-textGray text-sm"
              />
              {query.length > 0 && (
                <button
                  onClick={() => setQuery("")}
                  className="text-xs text-textGray hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="text-xs text-textGray hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
            {hasQuery && (
              <p className="text-xs text-textGray mt-2">
                Showing results for “{debounced}”
              </p>
            )}
          </div>
        )}
      </div>

      {open ? (
        hasQuery ? (
          <ProfileTabs username={username} query={debounced} />
        ) : (
          <p className="p-8 text-center text-textGray">
            Type to search this profile’s posts.
          </p>
        )
      ) : (
        <ProfileTabs username={username} />
      )}
    </div>
  );
}

