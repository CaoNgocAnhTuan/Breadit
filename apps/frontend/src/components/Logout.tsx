"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const Logout = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <div className="hidden xxl:block relative">
      <div
        className="cursor-pointer font-bold"
        onClick={() => setOpen((prev) => !prev)}
      >
        ...
      </div>
      {open && (
        <div className=" bg-white py-6 px-8 rounded-xl absolute left-4 bottom-4 flex flex-col gap-2 w-max z-50 shadow-lg">
          <Link
            href="/profile"
            className="text-textGray text-sm"
            onClick={() => setOpen(false)}
          >
            User Profile Page
          </Link>
          <Link
            href="/profile"
            className="text-textGray text-sm"
            onClick={() => setOpen(false)}
          >
            Saved Posts
          </Link>
          <Link
            href="/profile"
            className="text-textGray text-sm"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <hr />
          <button
            className="bg-black rounded-md px-2 py-1 text-white"
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
