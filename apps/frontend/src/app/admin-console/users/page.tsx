import { serverFetch } from "@/lib/session";
import UserTable from "./UserTable";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  const resolvedParams = await searchParams;
  const cursor = resolvedParams.cursor || "1";
  const q = resolvedParams.q || "";

  const query = new URLSearchParams();
  query.set("cursor", cursor);
  if (q) query.set("q", q);

  const res = await serverFetch(`/api/admin/users?${query.toString()}`);
  const data = res.ok ? await res.json() : { items: [], nextCursor: null };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Manage Users</h2>
      <UserTable initialData={data} currentQuery={q} currentCursor={cursor} />
    </div>
  );
}
