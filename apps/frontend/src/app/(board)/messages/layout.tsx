import { redirect } from "next/navigation";
import ConversationList from "@/components/ConversationList";
import { getSession, serverFetch } from "@/lib/session";

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const res = await serverFetch("/api/conversations");
  const initialData = res.ok
    ? await res.json()
    : { items: [], nextCursor: null };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-[360px] border-r border-borderGray overflow-hidden flex flex-col shrink-0">
        <ConversationList initialData={initialData} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
