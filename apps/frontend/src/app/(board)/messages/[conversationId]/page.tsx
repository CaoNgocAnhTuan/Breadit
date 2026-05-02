import { notFound, redirect } from "next/navigation";
import MessageThread from "@/components/MessageThread";
import { getSession, serverFetch } from "@/lib/session";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { conversationId } = await params;
  const id = parseInt(conversationId, 10);
  if (isNaN(id)) notFound();

  const [convsRes, msgsRes] = await Promise.all([
    serverFetch("/api/conversations"),
    serverFetch(`/api/conversations/${id}/messages`),
  ]);

  if (!msgsRes.ok) notFound();

  const convList = convsRes.ok ? await convsRes.json() : { items: [] };
  const initialData = await msgsRes.json();

  const conv = (convList.items as { id: number; otherMember: { id: string; username: string; displayName: string | null; img: string | null } }[])
    .find((c) => c.id === id);

  const otherUser = conv?.otherMember ?? {
    id: "",
    username: "unknown",
    displayName: null,
    img: null,
  };

  return (
    <MessageThread
      conversationId={id}
      initialData={initialData}
      otherUser={otherUser}
    />
  );
}
