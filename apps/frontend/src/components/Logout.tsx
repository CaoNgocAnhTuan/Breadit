"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Image from "./Image";

const Logout = ({ username }: { username: string }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await api("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        className="p-2 rounded-full hover:bg-white/10 flex items-center justify-center"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Image path="icons/more.svg" alt="" w={20} h={20} />
      </button>
      {open && (
        <div className="bg-white py-4 px-6 rounded-xl absolute right-0 bottom-full mb-2 flex flex-col gap-3 w-max z-50 shadow-lg border border-black/5">
          <Link
            href={`/${username}`}
            className="text-gray-600 text-sm hover:text-black transition-colors"
            onClick={() => setOpen(false)}
          >
            User Profile Page
          </Link>
          <Link
            href="/bookmarks"
            className="text-gray-600 text-sm hover:text-black transition-colors"
            onClick={() => setOpen(false)}
          >
            Saved Posts
          </Link>
          <Link
            href="/settings"
            className="text-gray-600 text-sm hover:text-black transition-colors"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <hr className="border-black/10" />
          <button
            type="button"
            className="bg-black rounded-full px-4 py-2 text-white text-sm font-semibold hover:bg-black/90"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default Logout;
