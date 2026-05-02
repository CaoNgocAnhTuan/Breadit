"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type AdminReportItem = {
  id: number;
  reason: string;
  createdAt: string;
  reporter: { username: string };
  post: { id: number; desc: string | null; user: { username: string } };
};

export default function ReportTable({
  initialData,
  currentCursor,
}: {
  initialData: { items: AdminReportItem[]; nextCursor: number | null };
  currentCursor: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleDismiss = async (id: number) => {
    setLoadingId(id);
    const res = await api(`/api/admin/reports/${id}/dismiss`, { method: "POST" });
    if (res.ok) router.refresh();
    setLoadingId(null);
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    setLoadingId(id);
    const res = await api(`/api/admin/reports/${id}/delete-post`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setLoadingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#181818] border border-borderGray rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-borderGray bg-black">
              <th className="p-4">Report ID</th>
              <th className="p-4">Reporter</th>
              <th className="p-4">Reported Post</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialData.items.map((report) => (
              <tr key={report.id} className="border-b border-borderGray/50 hover:bg-black/40">
                <td className="p-4 font-mono text-sm text-textGray">#{report.id}</td>
                <td className="p-4">
                  <Link href={`/${report.reporter.username}`} target="_blank" className="font-bold hover:underline underline-offset-4">
                    @{report.reporter.username}
                  </Link>
                </td>
                <td className="p-4">
                  <div className="max-w-xs">
                    <Link href={`/${report.post.user.username}/status/${report.post.id}`} target="_blank" className="font-bold text-sm hover:underline underline-offset-4">
                      @{report.post.user.username}
                    </Link>
                    <div className="text-textGray text-sm truncate">{report.post.desc || "(Media only)"}</div>
                    <div className="text-xs text-red-400 mt-1 font-semibold">{report.reason}</div>
                  </div>
                </td>
                <td className="p-4 text-textGray text-sm">
                  {new Date(report.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleDismiss(report.id)}
                    disabled={loadingId === report.id}
                    className="px-3 py-1.5 rounded text-sm font-bold bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleDeletePost(report.id)}
                    disabled={loadingId === report.id}
                    className="px-3 py-1.5 rounded text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                  >
                    Delete Post
                  </button>
                </td>
              </tr>
            ))}
            {initialData.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-textGray">
                  No open reports.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm">
        {Number(currentCursor) > 1 ? (
          <button
            onClick={() => router.push(`/admin-console/reports?cursor=${Number(currentCursor) - 1}`)}
            className="text-iconBlue hover:underline"
          >
            ← Previous Page
          </button>
        ) : <div />}
        
        {initialData.nextCursor && (
          <button
            onClick={() => router.push(`/admin-console/reports?cursor=${initialData.nextCursor}`)}
            className="text-iconBlue hover:underline"
          >
            Next Page →
          </button>
        )}
      </div>
    </div>
  );
}
