import { redirect } from "next/navigation";
import { getSession, serverFetch } from "@/lib/session";
import NotificationsFeed from "@/components/NotificationsFeed";

export const metadata = { title: "Notifications / Breadit" };

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const res = await serverFetch("/api/notifications?cursor=1");
  const data = res.ok
    ? await res.json()
    : { items: [], nextCursor: null, total: 0 };

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-borderGray">
        <h1 className="font-bold text-xl">Notifications</h1>
      </div>
      <NotificationsFeed initialData={data} />
    </div>
  );
}
