"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/session";
import EditProfileModal from "./EditProfileModal";

export default function EditProfileButton({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-1.5 rounded-full border border-gray-500 text-sm font-bold hover:bg-white/10 transition-colors"
      >
        Edit profile
      </button>
      {open && <EditProfileModal user={user} onClose={() => setOpen(false)} />}
    </>
  );
}
