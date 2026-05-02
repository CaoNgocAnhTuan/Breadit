import { serverFetch } from "@/lib/session";
import ReportTable from "./ReportTable";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const resolvedParams = await searchParams;
  const cursor = resolvedParams.cursor || "1";

  const res = await serverFetch(`/api/admin/reports?cursor=${cursor}`);
  const data = res.ok ? await res.json() : { items: [], nextCursor: null };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Reported Content</h2>
      <ReportTable initialData={data} currentCursor={cursor} />
    </div>
  );
}
