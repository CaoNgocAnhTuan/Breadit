"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Image from "@/components/Image";

type AdminUserItem = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  img: string | null;
  role: "USER" | "ADMIN";
  banned: boolean;
  createdAt: string;
};

export default function UserTable({
  initialData,
  currentQuery,
  currentCursor,
}: {
  initialData: { items: AdminUserItem[]; nextCursor: number | null };
  currentQuery: string;
  currentCursor: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(currentQuery);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin-console/users?q=${encodeURIComponent(search)}`);
  };

  const handleBanToggle = async (user: AdminUserItem) => {
    setLoadingId(user.id);
    const endpoint = user.banned ? "unban" : "ban";
    const res = await api(`/api/admin/users/${user.id}/${endpoint}`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    }
    setLoadingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#181818] border border-borderGray rounded px-4 py-2 flex-1"
        />
        <button type="submit" className="bg-white text-black px-6 font-bold rounded">
          Search
        </button>
      </form>

      <div className="bg-[#181818] border border-borderGray rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-borderGray bg-black">
              <th className="p-4">User</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Joined</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialData.items.map((user) => (
              <tr key={user.id} className="border-b border-borderGray/50 hover:bg-black/40">
                <td className="p-4 flex items-center gap-3">
                  <Link href={`/${user.username}`} target="_blank" className="flex items-center gap-3 hover:underline underline-offset-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <Image path={user.img || "general/noAvatar.png"} alt="" w={40} h={40} tr />
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2 text-white">
                        {user.displayName || user.username}
                        {user.banned && <span className="bg-red-900/50 text-red-400 text-[10px] px-2 py-0.5 rounded no-underline">BANNED</span>}
                      </div>
                      <div className="text-textGray text-sm">@{user.username}</div>
                    </div>
                  </Link>
                </td>
                <td className="p-4 text-textGray">{user.email}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded ${user.role === "ADMIN" ? "bg-red-900 text-white" : "bg-gray-800"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-textGray text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleBanToggle(user)}
                    disabled={loadingId === user.id || user.role === "ADMIN"}
                    className={`px-4 py-1.5 rounded text-sm font-bold disabled:opacity-50 ${
                      user.banned
                        ? "bg-gray-700 hover:bg-gray-600 text-white"
                        : "bg-red-600 hover:bg-red-500 text-white"
                    }`}
                  >
                    {loadingId === user.id ? "..." : user.banned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
            {initialData.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-textGray">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm">
        {Number(currentCursor) > 1 ? (
          <button
            onClick={() => router.push(`/admin-console/users?cursor=${Number(currentCursor) - 1}${currentQuery ? `&q=${currentQuery}` : ""}`)}
            className="text-iconBlue hover:underline"
          >
            ← Previous Page
          </button>
        ) : <div />}
        
        {initialData.nextCursor && (
          <button
            onClick={() => router.push(`/admin-console/users?cursor=${initialData.nextCursor}${currentQuery ? `&q=${currentQuery}` : ""}`)}
            className="text-iconBlue hover:underline"
          >
            Next Page →
          </button>
        )}
      </div>
    </div>
  );
}
